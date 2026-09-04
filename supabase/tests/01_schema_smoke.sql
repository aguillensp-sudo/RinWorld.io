-- =============================================================================
-- Smoke test del esquema del día 2
-- =============================================================================
-- Comprueba que el esquema impone lo que los specs cerrados exigen. No prueba la
-- app: prueba que la base de datos dice "no" cuando tiene que decir "no".
-- Se ejecuta con: supabase/tests/run.sh
-- =============================================================================

\set ON_ERROR_STOP on

-- UUIDs fijos para que el test sea determinista.
\set orgA  '''11111111-1111-1111-1111-111111111111'''
\set orgB  '''22222222-2222-2222-2222-222222222222'''
\set orgC  '''33333333-3333-3333-3333-333333333333'''
\set a1    '''0a000001-0000-0000-0000-000000000001'''
\set a2    '''0a000002-0000-0000-0000-000000000002'''
\set b1    '''0b000001-0000-0000-0000-000000000001'''
\set c1    '''0c000001-0000-0000-0000-000000000001'''

-- ---------------------------------------------------------------------------
-- Semilla. Como postgres (equivalente a service_role): el operador aprueba
-- organizaciones y crea miembros.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  (:a1, 'a1@alpha.test'), (:a2, 'a2@alpha.test'),
  (:b1, 'b1@beta.test'),  (:c1, 'c1@gamma.test');

insert into public.organizations (id, name, country, continent, status) values
  (:orgA, 'Alpha Bearings', 'ES', 'EU', 'APPROVED'),
  (:orgB, 'Beta Rodamientos', 'DE', 'EU', 'APPROVED'),
  (:orgC, 'Gamma Bearings', 'MX', 'NA', 'APPROVED');

-- role-auto-assignment: se pide EDITOR a propósito en los dos casos. El primero
-- tiene que salir ADMIN de todas formas.
insert into public.members (id, org_id, email, role, state) values
  (:a1, :orgA, 'a1@alpha.test', 'EDITOR', 'PENDING_REVIEW'),
  (:a2, :orgA, 'a2@alpha.test', 'EDITOR', 'PENDING_REVIEW'),
  (:b1, :orgB, 'b1@beta.test',  'EDITOR', 'PENDING_REVIEW'),
  (:c1, :orgC, 'c1@gamma.test', 'EDITOR', 'PENDING_REVIEW');

do $$
begin
  assert (select role from public.members where id = '0a000001-0000-0000-0000-000000000001') = 'ADMIN',
    'role-auto-assignment: el primer miembro de la organización tiene que ser ADMIN';
  assert (select role from public.members where id = '0a000002-0000-0000-0000-000000000002') = 'EDITOR',
    'role-auto-assignment: los adicionales tienen que ser EDITOR';
  raise notice 'OK · role-auto-assignment (ADMIN al primero, EDITOR al resto)';

  -- ADR-002 D-4: visibility_scope está soldado al rol en V1, lo pone el mismo
  -- trigger que asigna el rol.
  assert (select visibility_scope from public.members where id = '0a000001-0000-0000-0000-000000000001') = 'ORG_METADATA',
    'D-4: el ADMIN tiene que salir con visibility_scope = ORG_METADATA';
  assert (select visibility_scope from public.members where id = '0a000002-0000-0000-0000-000000000002') = 'OWN',
    'D-4: el EDITOR tiene que salir con visibility_scope = OWN';
  raise notice 'OK · ADR-002 D-4: visibility_scope derivado del rol (ORG_METADATA / OWN)';
end
$$;

-- D-4: "ningún cliente puede pedirlo, igual que hoy con el rol" — misma
-- guardia que ya protege role/state/org_id (0001:222-247).
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$update public.members set visibility_scope = 'ORG_METADATA'
      where id = '0a000002-0000-0000-0000-000000000002'$$,
    'ADR-002 D-4: un EDITOR no puede auto-concederse ORG_METADATA');
commit;

-- El backup es atómico: los cuatro campos o ninguno.
select public.expect_fail(
  $$update public.members set encrypted_key_blob = '\x00'::bytea
    where id = '0a000001-0000-0000-0000-000000000001'$$,
  'backup de clave parcial (solo encrypted_key_blob)');

-- EL CASO DEL MVP, y es un test positivo a propósito: un miembro llega a ACTIVE
-- SIN material de clave en servidor. El plan del MVP excluye el backup de clave
-- (§9 "Fuera") y CLAUDE.md §4 fija claves en memoria de sesión, así que
-- encrypted_key_blob es NULL siempre en el MVP. Si esto se rompe, ningún miembro
-- puede estar ACTIVE y SRCH-01 se queda sin lectura cruzada el día 6.
update public.members set state = 'ACTIVE';

do $$
begin
  assert (select count(*) from public.members
          where state = 'ACTIVE' and encrypted_key_blob is null) = 4,
    'MVP: se llega a ACTIVE sin backup de clave en servidor';
  raise notice 'OK · MVP: ACTIVE sin material de clave (el backup es de V1, no del MVP)';
end
$$;

-- Cuando V1 traiga ADR-001 completo, los cuatro campos ya están y validan.
update public.members set
  public_key         = decode(repeat('ab', 32), 'hex'),
  encrypted_key_blob = decode(repeat('cd', 48), 'hex'),
  key_iv             = decode(repeat('01', 12), 'hex'),
  argon2_salt        = decode(repeat('02', 32), 'hex'),
  kdf_params         = '{"m":65536,"t":3,"p":4}'::jsonb;

-- key-wrapping: IV de 12 bytes, salt de 32.
select public.expect_fail(
  $$update public.members set key_iv = decode(repeat('01', 16), 'hex')
    where id = '0a000001-0000-0000-0000-000000000001'$$,
  'key_iv de 16 bytes (AES-GCM exige 12)');

-- ---------------------------------------------------------------------------
-- Inventario y frontera de cifrado
-- ---------------------------------------------------------------------------
insert into public.inventory_lines
  (id, org_id, part_number, brand, quantity, location_country, product_family, status,
   unit_price_ciphertext, unit_price_iv)
values
  ('e1000000-0000-0000-0000-000000000001', :orgB, '6205-2RS', 'SKF', 800, 'PL', 'Rodamiento rígido de bolas', 'PUBLISHED',
   decode(repeat('ff', 32), 'hex'), decode(repeat('03', 12), 'hex')),
  ('e1000000-0000-0000-0000-000000000002', :orgB, '6206-2RS', 'FAG', 120, 'DE', 'Rodamiento rígido de bolas', 'DRAFT',
   decode(repeat('ff', 32), 'hex'), decode(repeat('03', 12), 'hex'));

select public.expect_fail(
  $$insert into public.inventory_lines
      (org_id, part_number, brand, quantity, location_country, product_family, status)
    values ('22222222-2222-2222-2222-222222222222','X','Y',-5,'DE','F','DRAFT')$$,
  'cantidad negativa en línea de inventario');

select public.expect_fail(
  $$insert into public.inventory_lines
      (org_id, part_number, brand, quantity, location_country, product_family, status)
    values ('22222222-2222-2222-2222-222222222222','X','Y',5,'DE','F','PUBLICADO')$$,
  'estado de línea fuera de DRAFT/PUBLISHED/ARCHIVED/DELETED');

-- El precio no se puede quedar a medias.
select public.expect_fail(
  $$insert into public.inventory_lines
      (org_id, part_number, brand, quantity, location_country, product_family, unit_price_ciphertext)
    values ('22222222-2222-2222-2222-222222222222','X','Y',5,'DE','F', decode('ff','hex'))$$,
  'unit_price cifrado sin su IV');

-- ---------------------------------------------------------------------------
-- RLS: lectura cruzada e INV-07
-- ---------------------------------------------------------------------------
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 1,
      'Alpha debe ver exactamente 1 línea de Beta (la PUBLISHED), nunca la DRAFT';
    assert (select count(*) from public.members) = 2,
      'Alpha debe ver solo a los miembros de su propia organización';
    raise notice 'OK · RLS: solo PUBLISHED entre organizaciones, miembros solo de la propia';
  end
  $$;
commit;

-- Beta excluye a Alpha por nombre de organización. Efecto inmediato.
update public.organizations set inventory_visibility_mode = 'RESTRINGIDA' where id = :orgB;
insert into public.inventory_exclusions (owner_org_id, excluded_org_id) values (:orgB, :orgA);

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 0,
      'INV-07: Alpha está excluida, no debe ver nada de Beta — y el efecto es inmediato';
    raise notice 'OK · INV-07: exclusión por organización, efecto inmediato';
  end
  $$;
commit;

-- visibility-control: al volver a VISIBLE_TODOS la lista queda inactiva pero NO
-- se borra, y al reactivar el modo la exclusión vuelve a aplicar.
update public.organizations set inventory_visibility_mode = 'VISIBLE_TODOS' where id = :orgB;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 1,
      'Con modo VISIBLE_TODOS la exclusión queda inactiva';
    raise notice 'OK · INV-07: exclusión inactiva en modo VISIBLE_TODOS';
  end
  $$;
commit;

do $$
begin
  assert (select count(*) from public.inventory_exclusions
          where owner_org_id = '22222222-2222-2222-2222-222222222222') = 1,
    'visibility-control: la lista de exclusión no se borra al cambiar de modo';
  raise notice 'OK · INV-07: la lista sobrevive al cambio de modo';
end
$$;

-- Exclusión por continente: Gamma (NA) queda fuera, Alpha (EU) sigue dentro.
update public.organizations set inventory_visibility_mode = 'RESTRINGIDA' where id = :orgB;
delete from public.inventory_exclusions where owner_org_id = :orgB;
insert into public.inventory_exclusions (owner_org_id, excluded_continent) values (:orgB, 'NA');

begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 0,
      'INV-07: Gamma (NA) excluida por continente';
    raise notice 'OK · INV-07: exclusión por continente';
  end
  $$;
commit;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 1,
      'INV-07: Alpha (EU) no está excluida por la regla de NA';
    raise notice 'OK · INV-07: la exclusión por continente no arrastra a otros';
  end
  $$;
commit;

update public.organizations set inventory_visibility_mode = 'VISIBLE_TODOS' where id = :orgB;
delete from public.inventory_exclusions where owner_org_id = :orgB;

-- ---------------------------------------------------------------------------
-- Hilos: un solo hilo por par de organizaciones
-- ---------------------------------------------------------------------------
insert into public.threads (id, org_low_id, org_high_id, created_by_org_id)
values ('11110000-0000-0000-0000-000000000001', :orgA, :orgB, :orgA);

select public.expect_fail(
  $$insert into public.threads (org_low_id, org_high_id, created_by_org_id)
    values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
            '22222222-2222-2222-2222-222222222222')$$,
  'single-thread-model: segundo hilo entre el mismo par de organizaciones');

select public.expect_fail(
  $$insert into public.threads (org_low_id, org_high_id, created_by_org_id)
    values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',
            '11111111-1111-1111-1111-111111111111')$$,
  'orden canónico invertido (evita duplicar el par)');

select public.expect_fail(
  $$insert into public.threads (org_low_id, org_high_id, created_by_org_id)
    values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333')$$,
  'creador que no participa en el hilo');

select public.expect_fail(
  $$update public.threads set state = 'CERRADO'
    where id = '11110000-0000-0000-0000-000000000001'$$,
  'thread-lifecycle: estado de hilo fuera de los cinco del spec');

-- ---------------------------------------------------------------------------
-- Tarjetas y la máquina de la oferta
-- ---------------------------------------------------------------------------
-- Consulta de Alpha sobre la línea PUBLISHED de Beta.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, inventory_line_id, estado_consulta, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000001', '11110000-0000-0000-0000-000000000001',
   :orgA, :a1, 'CONSULTA', '6205-2RS', 'SKF',
   'e1000000-0000-0000-0000-000000000001', 'Pendiente',
   decode(repeat('aa', 64), 'hex'), decode(repeat('04', 12), 'hex'));

-- inquiry-card: una sola consulta por línea y organización compradora.
select public.expect_fail(
  $$insert into public.thread_items
      (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand,
       inventory_line_id, estado_consulta, content_ciphertext, content_iv)
    values ('11110000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
            '0a000002-0000-0000-0000-000000000002','CONSULTA','6205-2RS','SKF',
            'e1000000-0000-0000-0000-000000000001','Pendiente',
            decode('aa','hex'), decode(repeat('04',12),'hex'))$$,
  'inquiry-card: segunda consulta sobre la misma línea por la misma organización');

-- Un mensaje libre no lleva metadatos de tarjeta.
select public.expect_fail(
  $$insert into public.thread_items
      (thread_id, sender_org_id, sender_member_id, item_type, part_number,
       content_ciphertext, content_iv)
    values ('11110000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
            '0a000001-0000-0000-0000-000000000001','MENSAJE','6205-2RS',
            decode('aa','hex'), decode(repeat('04',12),'hex'))$$,
  'MENSAJE con part_number (forma de tarjeta en un mensaje libre)');

-- Un miembro no puede escribir en nombre de otra organización.
select public.expect_fail(
  $$insert into public.thread_items
      (thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
    values ('11110000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
            '0a000001-0000-0000-0000-000000000001','MENSAJE',
            decode('aa','hex'), decode(repeat('04',12),'hex'))$$,
  'miembro de Alpha enviando como Beta');

-- Oferta de Beta respondiendo a la consulta.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, estado_oferta, responds_to_item_id, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000002', '11110000-0000-0000-0000-000000000001',
   :orgB, :b1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente',
   '12000000-0000-0000-0000-000000000001',
   decode(repeat('bb', 96), 'hex'), decode(repeat('05', 12), 'hex'));

update public.thread_items set estado_consulta = 'Respondida con oferta'
  where id = '12000000-0000-0000-0000-000000000001';

-- offer-card: un estado inventado no entra.
select public.expect_fail(
  $$update public.thread_items set estado_oferta = 'ENVIADA'
    where id = '12000000-0000-0000-0000-000000000002'$$,
  'offer-card: estado ENVIADA (el spec dice Pendiente)');

select public.expect_fail(
  $$update public.thread_items set estado_oferta = 'RETIRADA'
    where id = '12000000-0000-0000-0000-000000000002'$$,
  'offer-card: estado RETIRADA (no existe en el spec)');

-- "Superada por contraoferta" y el puntero son inseparables.
select public.expect_fail(
  $$update public.thread_items set estado_oferta = 'Superada por contraoferta'
    where id = '12000000-0000-0000-0000-000000000002'$$,
  'Superada por contraoferta sin superseded_by_item_id');

-- La contraoferta es una FILA NUEVA; la anterior queda terminal apuntando a ella.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, estado_oferta, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000003', '11110000-0000-0000-0000-000000000001',
   :orgA, :a1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente',
   decode(repeat('cc', 96), 'hex'), decode(repeat('06', 12), 'hex'));

update public.thread_items set
  estado_oferta = 'Superada por contraoferta',
  superseded_by_item_id = '12000000-0000-0000-0000-000000000003'
where id = '12000000-0000-0000-0000-000000000002';

-- Y ya no se mueve: es terminal. Esto es la otra mitad de "sin eliminarse del
-- historial" — no basta con no borrar la fila, hay que no reescribirla.
select public.expect_fail(
  $$update public.thread_items set estado_oferta = 'Aceptada'
    where id = '12000000-0000-0000-0000-000000000002'$$,
  'reabrir una oferta ya Superada por contraoferta');

update public.thread_items set estado_oferta = 'Aceptada'
  where id = '12000000-0000-0000-0000-000000000003';

select public.expect_fail(
  $$update public.thread_items set estado_oferta = 'Rechazada'
    where id = '12000000-0000-0000-0000-000000000003'$$,
  'cambiar una oferta ya Aceptada');

do $$
begin
  assert (select count(*) from public.thread_items
          where item_type = 'OFERTA'
            and estado_oferta in ('Aceptada','Superada por contraoferta')) = 2,
    'El historial conserva las dos ofertas, la superada y la aceptada';
  raise notice 'OK · offer-card: contraoferta = fila nueva, terminal irreversible, historial intacto';
end
$$;

-- ---------------------------------------------------------------------------
-- Claves envueltas: cada miembro ve solo la suya
-- ---------------------------------------------------------------------------
insert into public.thread_item_keys (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
values
  ('12000000-0000-0000-0000-000000000003', :a1, decode(repeat('11',48),'hex'),
   decode(repeat('07',12),'hex'), decode(repeat('22',32),'hex')),
  ('12000000-0000-0000-0000-000000000003', :b1, decode(repeat('33',48),'hex'),
   decode(repeat('07',12),'hex'), decode(repeat('44',32),'hex'));

begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.thread_item_keys) = 1,
      'Cada miembro ve exclusivamente su propia CEK envuelta';
    raise notice 'OK · RLS: la CEK envuelta es por persona';
  end
  $$;
commit;

-- Un tercero (Gamma) no ve nada del hilo entre Alpha y Beta.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.threads) = 0, 'Gamma no participa: no ve el hilo';
    assert (select count(*) from public.thread_items) = 0, 'Gamma no ve los elementos del hilo';
    raise notice 'OK · RLS: un tercero no ve el hilo ni su contenido';
  end
  $$;
commit;

-- ---------------------------------------------------------------------------
-- 0007/0008/0009 · la máquina de estados del hilo
-- ---------------------------------------------------------------------------
-- Esto llegó tarde y por eso está anotado: las tres migraciones se aplicaron sin
-- que un solo aserto las tocara (F-055). Que la CI siguiera verde demostraba que
-- no rompían nada, que no es lo mismo que demostrar que funcionan.
--
-- Y hay un motivo por el que no bastaba con mirarlas desde fuera: las dos guardias
-- se auto-exceptúan con `current_user in ('service_role','postgres')` —tiene que
-- ser así, por ahí entra la siembra—, así que **ninguna conexión administrativa
-- puede dispararlas**. Se prueban como se prueba RLS en este mismo fichero: con el
-- stub de `auth.uid()` y `set local role authenticated`.

-- 0007 · nadie ha escrito `state` en todo el fichero: lo puso la derivación sola.
do $$
begin
  assert (select state from public.threads
          where id = '11110000-0000-0000-0000-000000000001') = 'ACUERDO ALCANZADO',
    'thread-lifecycle: la oferta aceptada deja el hilo en ACUERDO ALCANZADO sin que nadie escriba el estado';
  raise notice 'OK · 0007: el estado del hilo lo deriva la base, no la siembra';
end
$$;

-- Una oferta nueva de Beta, Pendiente, para probar quién puede decidirla.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, estado_oferta, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000004', '11110000-0000-0000-0000-000000000001',
   :orgB, :b1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente',
   decode(repeat('ee', 96), 'hex'), decode(repeat('09', 12), 'hex'));

do $$
begin
  assert (select state from public.threads
          where id = '11110000-0000-0000-0000-000000000001') = 'CON OFERTA PENDIENTE',
    'thread-lifecycle: una oferta Pendiente manda sobre el acuerdo anterior (regla 1)';
  raise notice 'OK · 0007: la oferta pendiente mueve el hilo sola';
end
$$;

-- 0008 · el emisor NO decide su propia oferta. Como Beta, que la emitió.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$update public.thread_items set estado_oferta = 'Aceptada'
      where id = '12000000-0000-0000-0000-000000000004'$$,
    'offer-card: Beta aceptando la oferta que ella misma emitió');
commit;

-- Y el receptor sí. Como Alpha.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  update public.thread_items set estado_oferta = 'Aceptada'
    where id = '12000000-0000-0000-0000-000000000004';
commit;

do $$
begin
  assert (select estado_oferta from public.thread_items
          where id = '12000000-0000-0000-0000-000000000004') = 'Aceptada',
    'offer-card: el receptor sí puede aceptar — la guardia acota quién, no prohíbe a todos';
  assert (select state from public.threads
          where id = '11110000-0000-0000-0000-000000000001') = 'ACUERDO ALCANZADO',
    'thread-lifecycle: aceptada la oferta, el hilo vuelve a ACUERDO ALCANZADO';
  raise notice 'OK · 0008: la oferta la decide quien la recibe, y solo esa parte';
end
$$;

-- 0009 · el cierre manual, y la reapertura al volver a escribir (decisión del PO).
update public.threads set state = 'CERRADO SIN ACUERDO'
  where id = '11110000-0000-0000-0000-000000000001';

-- Un UPDATE sobre un elemento que ya existía NO es volver a escribir en el hilo.
-- Se reescribe el mismo valor a propósito: lo que se prueba es que el trigger se
-- dispara y decide no reabrir, no que no se haya disparado.
update public.thread_items set estado_consulta = 'Respondida con oferta'
  where id = '12000000-0000-0000-0000-000000000001';

do $$
begin
  assert (select state from public.threads
          where id = '11110000-0000-0000-0000-000000000001') = 'CERRADO SIN ACUERDO',
    '0009: tocar un elemento que ya existía no reabre un hilo cerrado';
  raise notice 'OK · 0009: un update sobre lo que ya había no resucita el hilo';
end
$$;

-- Un elemento NUEVO sí lo reabre.
insert into public.thread_items
  (thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
values
  ('11110000-0000-0000-0000-000000000001', :orgA, :a1, 'MENSAJE',
   decode(repeat('ff', 32), 'hex'), decode(repeat('0a', 12), 'hex'));

do $$
declare
  ahora text;
begin
  select state into ahora from public.threads
    where id = '11110000-0000-0000-0000-000000000001';

  assert ahora <> 'CERRADO SIN ACUERDO',
    '0009: escribir en un hilo cerrado lo reabre (decisión del PO, 11-ago)';
  -- Y reabre a lo que digan sus filas, no a un ABIERTO forzado: este hilo tiene
  -- una oferta aceptada y vigente, así que le toca ACUERDO ALCANZADO.
  assert ahora = app.derive_thread_state('11110000-0000-0000-0000-000000000001'),
    '0009: reabre al estado que derivan sus elementos, no a uno inventado';
  raise notice 'OK · 0009: un elemento nuevo reabre el hilo, y al estado que dicen sus filas (%)', ahora;
end
$$;

-- ---------------------------------------------------------------------------
-- thread-rate-limiting: 25 hilos nuevos por día natural
-- ---------------------------------------------------------------------------
do $$
declare
  i int;
  new_org uuid;
begin
  -- Alpha ya creó 1. Le quedan 24.
  for i in 1..24 loop
    new_org := gen_random_uuid();
    insert into public.organizations (id, name, country, continent, status)
      values (new_org, 'Filler ' || i, 'FR', 'EU', 'APPROVED');
    insert into public.threads (org_low_id, org_high_id, created_by_org_id)
      values (least('11111111-1111-1111-1111-111111111111'::uuid, new_org),
              greatest('11111111-1111-1111-1111-111111111111'::uuid, new_org),
              '11111111-1111-1111-1111-111111111111');
  end loop;
  raise notice 'OK · 25 hilos creados por Alpha en el día';
end
$$;

do $$
declare
  new_org uuid := gen_random_uuid();
begin
  insert into public.organizations (id, name, country, continent, status)
    values (new_org, 'Filler 26', 'FR', 'EU', 'APPROVED');
  begin
    insert into public.threads (org_low_id, org_high_id, created_by_org_id)
      values (least('11111111-1111-1111-1111-111111111111'::uuid, new_org),
              greatest('11111111-1111-1111-1111-111111111111'::uuid, new_org),
              '11111111-1111-1111-1111-111111111111');
    raise exception 'TEST FALLIDO · el hilo 26 debería estar bloqueado';
  exception
    when others then
      if sqlerrm like 'TEST FALLIDO%' then raise; end if;
      raise notice 'OK · thread-rate-limiting: el hilo 26 del día queda bloqueado';
  end;
end
$$;

-- Y el límite no afecta al envío en hilos ya existentes.
insert into public.thread_items
  (thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
values
  ('11110000-0000-0000-0000-000000000001', :orgA, :a1, 'MENSAJE',
   decode(repeat('dd', 32), 'hex'), decode(repeat('08', 12), 'hex'));

-- ---------------------------------------------------------------------------
-- 0005 · plazo en claro y favoritos
-- ---------------------------------------------------------------------------
-- single-reference-search: el plazo es chip de filtro Y columna ordenable, asi
-- que tiene que estar EN CLARO y ser consultable entre organizaciones.
update public.inventory_lines set lead_time_days = 5
  where id = 'e1000000-0000-0000-0000-000000000001';

select public.expect_fail(
  $$update public.inventory_lines set lead_time_days = -1
    where id = 'e1000000-0000-0000-0000-000000000001'$$,
  'plazo de entrega negativo');

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    -- Alpha filtra y ordena por plazo sobre inventario de Beta, sin descifrar nada.
    assert (select count(*) from public.inventory_lines
            where lead_time_days <= 7 and status = 'PUBLISHED') = 1,
      'El plazo tiene que ser filtrable entre organizaciones (chip de SRCH-01)';
    raise notice 'OK · SRCH-01: plazo en claro, filtrable y ordenable entre organizaciones';
  end
  $$;
commit;

-- favorites-system: manual, y el recuento es agregado sin revelar quien marco.
insert into public.favorite_distributors (member_id, distributor_org_id) values
  ('0a000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('0c000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.favorite_distributors) = 1,
      'Cada miembro ve solo su propia lista de favoritos';
    assert (select favorite_count from public.organizations
            where id = '22222222-2222-2222-2222-222222222222') = 2,
      'El recuento agregado es de toda la plataforma, no solo del miembro';
    raise notice 'OK · favorites-system: estrella propia, recuento global, sin revelar quien marco';
  end
  $$;
commit;

-- El contador es derivado: el cliente no lo escribe.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$update public.organizations set favorite_count = 999
      where id = '11111111-1111-1111-1111-111111111111'$$,
    'cliente escribiendo favorite_count a mano');
commit;

-- Y baja al quitar el favorito.
delete from public.favorite_distributors
  where member_id = '0c000001-0000-0000-0000-000000000001';

do $$
begin
  assert (select favorite_count from public.organizations
          where id = '22222222-2222-2222-2222-222222222222') = 1,
    'El contador baja al retirar un favorito';
  raise notice 'OK · favorites-system: el contador sigue a la tabla en los dos sentidos';
end
$$;

-- ---------------------------------------------------------------------------
-- Realtime (0011) · las dos tablas publicadas, y ninguna en identidad completa
--
-- Esto es F-056 aplicado por adelantado: la publicación es exactamente la clase
-- de cosa que se rompe en silencio. Si `threads` cayera de `supabase_realtime`,
-- el canal seguiría conectando, seguiría devolviendo SUBSCRIBED y no entregaría
-- un solo evento — no hay error que mirar, solo una pantalla que no se entera.
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select count(*) from pg_publication p
            join pg_publication_rel pr on pr.prpubid = p.oid
            join pg_class c on c.oid = pr.prrelid
           where p.pubname = 'supabase_realtime'
             and c.relname in ('threads','thread_items')) = 2,
    'threads y thread_items tienen que estar en supabase_realtime (0011): sin eso Realtime conecta y no entrega nada';

  -- El aserto que protege la DECISIÓN, no solo el estado. `REPLICA IDENTITY
  -- FULL` sobre `thread_items` mandaría el `content_ciphertext` VIEJO en cada
  -- UPDATE, a todos los suscriptores que pasen RLS, a cambio de un evento DELETE
  -- que este MVP ni produce ni escucha. Ver 0011 §2.
  assert (select relreplident from pg_class
           where relname = 'thread_items'
             and relnamespace = 'public'::regnamespace) <> 'f',
    'thread_items NO puede ir en REPLICA IDENTITY FULL: empujaria el ciphertext viejo por el socket en cada update (0011 §2)';

  raise notice 'OK · realtime: las dos tablas publicadas, sin identidad de replica completa';
end
$$;

-- ---------------------------------------------------------------------------
-- Rebanada E2EE (0012) · la pública de la contraparte se lee, la fila no se abre
--
-- Los cuatro asertos van en este orden a propósito (F-059): el primero es el
-- ANCLA POSITIVA —la función devuelve de verdad la clave de la otra parte— y los
-- tres siguientes acotan qué NO devuelve. Sin el ancla delante, "no devuelve a
-- Gamma" y "no devuelve email" los cumpliría igual una función que no devuelve
-- nada, que es exactamente el defecto que costó tres fallos el día 7.
-- ---------------------------------------------------------------------------
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    filas int;
    pub_de_beta bytea;
  begin
    -- 1 · ANCLA. Alpha pide las claves del hilo Alpha↔Beta y le llegan las tres
    -- que hay: sus dos miembros y el de Beta. La CEK va envuelta por PERSONA
    -- (0003:263), así que "los dos lados" son todos los miembros de ambas.
    select count(*) into filas
      from public.thread_public_keys('11110000-0000-0000-0000-000000000001');
    assert filas = 3,
      'thread_public_keys tiene que devolver los 3 miembros de las dos organizaciones del hilo, y devolvio ' || filas;

    select public_key into pub_de_beta
      from public.thread_public_keys('11110000-0000-0000-0000-000000000001')
     where member_id = '0b000001-0000-0000-0000-000000000001';
    assert pub_de_beta is not null and octet_length(pub_de_beta) = 32,
      'Alpha tiene que poder leer la X25519 publica de Beta: sin eso no puede envolver la CEK y la rebanada E2EE no existe';

    -- 2 · Ámbito. Gamma no participa en este hilo y no sale, aunque su fila de
    -- `members` exista y tenga clave publicada.
    assert not exists (
      select 1 from public.thread_public_keys('11110000-0000-0000-0000-000000000001')
       where member_id = '0c000001-0000-0000-0000-000000000001'),
      'thread_public_keys no puede devolver miembros de una organizacion ajena al hilo';

    -- 3 · LA REGRESIÓN QUE MÁS IMPORTA. 0012 abre una ventana de tres columnas,
    -- no la puerta: `members_select_own_org` (0001:207) sigue cerrada y Alpha
    -- sigue sin ver la fila de Beta. Si esto se cae, alguien "arregló" la
    -- rebanada relajando la política y con ella se fueron `email` y los cuatro
    -- campos del respaldo de clave (ADR-001 §8).
    select count(*) into filas from public.members;
    assert filas = 2,
      'members_select_own_org tiene que seguir cerrada: Alpha ve sus 2 miembros y ninguno mas, y vio ' || filas;
  end
  $$;
commit;

-- 4 · Quien no participa no obtiene filas, y no obtiene tampoco un error que le
-- diga que el hilo existe (mismo criterio que `maybeSingle` en thread-detail.ts).
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.thread_public_keys('11110000-0000-0000-0000-000000000001')) = 0,
      'Un tercero no puede sacar las claves publicas de un hilo en el que no participa';
    raise notice 'OK · 0012: la publica de la contraparte se lee, la fila de members sigue cerrada';
  end
  $$;
commit;

-- 5 · Un miembro sin clave publicada VUELVE, con `public_key` a NULL. Filtrarlo
-- seria el fallo silencioso de 0012 §3: el emisor envolveria la CEK para menos
-- gente de la que debe, el insert funcionaria, y la otra parte se quedaria con
-- "Contenido cifrado" para siempre sin nada que lo explicara.
begin;
  update public.members set public_key = null
    where id = '0b000001-0000-0000-0000-000000000001';

  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.thread_public_keys('11110000-0000-0000-0000-000000000001')) = 3,
      'Un miembro sin clave publicada sigue apareciendo: el hueco se pinta, no se esconde';
    assert (select public_key from public.thread_public_keys('11110000-0000-0000-0000-000000000001')
             where member_id = '0b000001-0000-0000-0000-000000000001') is null,
      'El miembro sin clave publicada vuelve con public_key NULL, para que el cliente pueda negarse a enviar y decir de quien falta';
    raise notice 'OK · 0012: el destinatario sin clave publicada se ve, no se filtra';
  end
  $$;
rollback;

-- ---------------------------------------------------------------------------
-- create_thread_item (0012 §5) · el elemento y sus claves, o ninguna de las dos
--
-- Lo que se prueba aquí no es que inserte: es que **no puede quedar un elemento
-- sin claves**, que es corrupción permanente e irreparable, y que agrupar las
-- dos escrituras no ha abierto ninguna puerta (`security invoker`).
-- ---------------------------------------------------------------------------
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    creado uuid;
  begin
    -- 1 · ANCLA. Alpha escribe un mensaje cifrado y deposita las dos CEK
    -- envueltas —la de Nordwälz y la suya propia— en la misma transacción.
    creado := public.create_thread_item(
      '11110000-0000-0000-0000-000000000001',
      'MENSAJE',
      repeat('ab', 64),   -- ciphertext, hex pelado sin \x
      repeat('07', 12),   -- iv de 12 bytes, thread_items_iv_len_chk
      jsonb_build_array(
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
                           'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('07',12),
                           'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
                           'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('07',12),
                           'ephemeral_pubkey', repeat('44',32))
      ));

    assert creado is not null, 'create_thread_item tiene que devolver el id del elemento creado';
    assert (select item_type from public.thread_items where id = creado) = 'MENSAJE',
      'El elemento creado tiene que existir y ser un MENSAJE';
    assert (select content_ciphertext from public.thread_items where id = creado)
             = decode(repeat('ab',64),'hex'),
      'El ciphertext se guarda tal cual llega: hex pelado decodificado, sin reinterpretar';

    -- Las dos claves entraron. Se cuenta como `postgres` mas abajo porque
    -- `item_keys_select_own` solo deja ver la propia — aqui se ve una.
    assert (select count(*) from public.thread_item_keys where item_id = creado) = 1,
      'Alpha ve exclusivamente su propia CEK envuelta, tambien en el elemento que acaba de crear';
  end
  $$;
commit;

-- Las dos filas están de verdad, mirando sin RLS.
do $$
begin
  assert (select count(*) from public.thread_item_keys tik
            join public.thread_items ti on ti.id = tik.item_id
           where ti.item_type = 'MENSAJE') = 2,
    'create_thread_item deposita UNA fila por destinatario: sin la del emisor, quien escribe no puede releerse';
  raise notice 'OK · 0012: elemento y claves en la misma transaccion';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  -- 2 · Sin claves no se crea nada. Es el caso irreparable.
  select public.expect_fail(
    $$select public.create_thread_item('11110000-0000-0000-0000-000000000001','MENSAJE',
        repeat('ab',32), repeat('07',12), '[]'::jsonb)$$,
    'elemento cifrado sin una sola CEK envuelta (seria ilegible para siempre)');

  -- 3 · Y solo MENSAJE: OFERTA es MSG-03 y CONSULTA llega con el envio de SRCH-01.
  select public.expect_fail(
    $$select public.create_thread_item('11110000-0000-0000-0000-000000000001','OFERTA',
        repeat('ab',32), repeat('07',12),
        jsonb_build_array(jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('07',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'create_thread_item con un tipo que no es MENSAJE');
commit;

-- 4 · `security invoker`: agrupar dos escrituras NO concede ningún permiso.
-- Gamma no participa en el hilo y la función no le sirve de puerta trasera.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_thread_item('11110000-0000-0000-0000-000000000001','MENSAJE',
        repeat('ab',32), repeat('07',12),
        jsonb_build_array(jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('07',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'un tercero escribiendo en un hilo ajeno a traves de create_thread_item');
commit;

do $$
begin
  raise notice 'OK · 0012: create_thread_item no concede permisos (security invoker)';
end
$$;

-- -----------------------------------------------------------------------------
-- counter_offer (0013) · fila nueva + supersesión, en una transacción
-- -----------------------------------------------------------------------------
-- Una oferta Pendiente nueva de Beta, limpia, para no interferir con el resto
-- del historial de este hilo (que ya lleva ofertas Aceptada y Superada).
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, estado_oferta, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000005', '11110000-0000-0000-0000-000000000001',
   :orgB, :b1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente',
   decode(repeat('11', 96), 'hex'), decode(repeat('12', 12), 'hex'));

-- 1 · Gamma no participa en el hilo: la fila no existe para ella, ni un error
-- que confirme que existe. Mismo criterio que `thread_public_keys` y
-- `create_thread_item` con un tercero.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.counter_offer('12000000-0000-0000-0000-000000000005',
        repeat('aa',96), repeat('13',12),
        jsonb_build_array(jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('13',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'un tercero ajeno al hilo contraofertando (la fila no es visible)');
commit;

-- 2 · El emisor no puede contraofertar su propia oferta. Beta la emitió.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.counter_offer('12000000-0000-0000-0000-000000000005',
        repeat('aa',96), repeat('13',12),
        jsonb_build_array(jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('13',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'offer-card: Beta contraofertando la oferta que ella misma emitio');
commit;

-- 3 · Sin ninguna CEK envuelta, ni como receptor legítimo: el caso irreparable.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.counter_offer('12000000-0000-0000-0000-000000000005',
        repeat('aa',96), repeat('13',12), '[]'::jsonb)$$,
    'contraoferta sin ninguna CEK envuelta (seria ilegible para siempre)');
commit;

-- 4 · ANCLA. Alpha, el receptor, contraoferta de verdad.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    nueva uuid;
  begin
    nueva := public.counter_offer(
      '12000000-0000-0000-0000-000000000005',
      repeat('aa', 96), repeat('13', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('13',12),
          'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('13',12),
          'ephemeral_pubkey', repeat('44',32))
      ));

    assert nueva is not null, 'counter_offer tiene que devolver el id de la nueva oferta';

    assert (select item_type from public.thread_items where id = nueva) = 'OFERTA'
       and (select estado_oferta from public.thread_items where id = nueva) = 'Pendiente'
       and (select sender_org_id from public.thread_items where id = nueva) = '11111111-1111-1111-1111-111111111111',
      'la nueva fila es una OFERTA Pendiente, emitida por quien contraoferta (Alpha)';

    assert (select part_number from public.thread_items where id = nueva) = '6205-2RS'
       and (select brand from public.thread_items where id = nueva) = 'SKF',
      'part_number y brand se heredan de la oferta anterior, no llegan por parametro';

    assert (select estado_oferta from public.thread_items
             where id = '12000000-0000-0000-0000-000000000005') = 'Superada por contraoferta'
       and (select superseded_by_item_id from public.thread_items
             where id = '12000000-0000-0000-0000-000000000005') = nueva,
      'la anterior queda Superada por contraoferta apuntando a la nueva, sin eliminarse';

    -- Alpha ve exclusivamente su propia CEK envuelta (item_keys_select_own).
    assert (select count(*) from public.thread_item_keys where item_id = nueva) = 1,
      'quien contraoferta ve su propia CEK envuelta en el elemento que acaba de crear';

    raise notice 'OK · 0013: counter_offer crea la fila nueva y supersede la anterior, atomico';
  end
  $$;
commit;

-- Las dos claves están de verdad, mirando sin RLS — igual que se comprobó para
-- create_thread_item: el emisor no se queda sin su propia copia.
do $$
declare
  nueva_id uuid;
begin
  select id into nueva_id from public.thread_items
   where responds_to_item_id is null and item_type = 'OFERTA' and estado_oferta = 'Pendiente'
     and sender_org_id = '11111111-1111-1111-1111-111111111111'
     and part_number = '6205-2RS' and brand = 'SKF'
   order by created_at desc limit 1;

  assert (select count(*) from public.thread_item_keys where item_id = nueva_id) = 2,
    'counter_offer deposita UNA fila de CEK por destinatario, incluida la del emisor';
  raise notice 'OK · 0013: las dos CEK de la contraoferta estan, la del emisor incluida';
end
$$;

-- 5 · La oferta superada es terminal: contraofertar sobre ella ahora también
-- falla, con el mensaje de estado no-Pendiente y no con el de "no existe".
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.counter_offer('12000000-0000-0000-0000-000000000005',
        repeat('aa',96), repeat('13',12),
        jsonb_build_array(jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('13',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'contraofertar sobre una oferta ya Superada por contraoferta');
commit;

-- 6 · thread-lifecycle: la contraoferta no cierra el ciclo, el hilo permanece
-- CON OFERTA PENDIENTE — ahora referido a la nueva (spec.md:214).
do $$
begin
  assert (select state from public.threads
          where id = '11110000-0000-0000-0000-000000000001') = 'CON OFERTA PENDIENTE',
    'thread-lifecycle: tras la contraoferta el hilo sigue CON OFERTA PENDIENTE, referido a la nueva';
  raise notice 'OK · 0013: thread-lifecycle — la contraoferta mantiene CON OFERTA PENDIENTE';
end
$$;

-- -----------------------------------------------------------------------------
-- org_public_keys (0014 §1) · la pública del primer contacto, sin hilo previo
-- -----------------------------------------------------------------------------
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    filas int;
    pub   bytea;
  begin
    -- 1 · ANCLA. Alpha nunca ha tenido hilo con Gamma —de hecho todavía no lo
    -- tiene en este punto del fichero— y aun así puede leer la pública de sus
    -- miembros: es justo la propiedad que `thread_public_keys` (0012) no
    -- puede dar, porque exige un hilo que en el primer contacto no existe.
    select count(*) into filas from public.org_public_keys('33333333-3333-3333-3333-333333333333');
    assert filas = 1, 'org_public_keys tiene que devolver el único miembro de Gamma, y devolvio ' || filas;

    select public_key into pub from public.org_public_keys('33333333-3333-3333-3333-333333333333');
    assert pub is not null and octet_length(pub) = 32,
      'la publica de Gamma tiene que llegar completa: sin ella no se puede envolver la CEK del primer contacto';

    raise notice 'OK · 0014: org_public_keys da la publica de un distribuidor sin hilo previo';
  end
  $$;
commit;

-- 2 · Una organización NO aprobada no es un distribuidor visible en SRCH-01, y
-- tampoco lo es aquí: misma condición que `organizations_select_approved`.
begin;
  update public.organizations set status = 'PENDING_REVIEW'
   where id = '33333333-3333-3333-3333-333333333333';

  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.org_public_keys('33333333-3333-3333-3333-333333333333')) = 0,
      'una organizacion no aprobada no expone la publica de sus miembros a un tercero';
    raise notice 'OK · 0014: org_public_keys respeta organizations_select_approved';
  end
  $$;
rollback;

-- -----------------------------------------------------------------------------
-- create_inquiry (0014) · GAP-004, hilo encontrado-o-creado + CONSULTA
-- -----------------------------------------------------------------------------
-- Línea PUBLISHED nueva de Beta, sin consultar todavía: la única otra
-- PUBLISHED de Beta (e1000000-...-001) ya la consultó Alpha al principio de
-- este fichero, y eso es justo lo que prueba el punto 3 de abajo.
insert into public.inventory_lines
  (id, org_id, part_number, brand, quantity, location_country, product_family, status)
values
  ('e1000000-0000-0000-0000-000000000003', :orgB, '6207-2RS', 'NSK', 400, 'DE',
   'Rodamiento rigido de bolas', 'PUBLISHED');

-- 1 · No se puede consultar el propio inventario.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_inquiry('e1000000-0000-0000-0000-000000000003',
        repeat('aa',48), repeat('14',12),
        jsonb_build_array(jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('14',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'Beta consultando su propio inventario');
commit;

-- 2 · Una línea no PUBLISHED no se puede consultar.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_inquiry('e1000000-0000-0000-0000-000000000002',
        repeat('aa',48), repeat('14',12),
        jsonb_build_array(jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('14',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'linea DRAFT (no PUBLISHED)');
commit;

-- 3 · Segunda consulta sobre una línea ya consultada: bloqueada con el
-- literal exacto de inquiry-card, no con la excepción cruda del índice único.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_inquiry('e1000000-0000-0000-0000-000000000001',
        repeat('aa',48), repeat('14',12),
        jsonb_build_array(jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('14',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'segunda consulta sobre una linea ya consultada (inquiry-card)');
commit;

-- 4 · ANCLA · el hilo YA EXISTE (Alpha-Beta): create_inquiry lo tiene que
-- ENCONTRAR, no duplicarlo, y depositar la consulta sobre la línea sin
-- consultar todavía.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    fila record;
  begin
    select * into fila from public.create_inquiry(
      'e1000000-0000-0000-0000-000000000003',
      repeat('aa', 48), repeat('14', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('14',12),
          'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('14',12),
          'ephemeral_pubkey', repeat('44',32))
      ));

    assert fila.thread_id = '11110000-0000-0000-0000-000000000001',
      'el hilo Alpha-Beta ya existia: create_inquiry lo tiene que ENCONTRAR, no crear otro';
    assert fila.item_id is not null, 'create_inquiry tiene que devolver el id de la tarjeta creada';

    assert (select item_type from public.thread_items where id = fila.item_id) = 'CONSULTA'
       and (select estado_consulta from public.thread_items where id = fila.item_id) = 'Pendiente'
       and (select inventory_line_id from public.thread_items where id = fila.item_id)
             = 'e1000000-0000-0000-0000-000000000003',
      'la tarjeta es una CONSULTA Pendiente sobre la linea correcta';

    assert (select part_number from public.thread_items where id = fila.item_id) = '6207-2RS'
       and (select brand from public.thread_items where id = fila.item_id) = 'NSK',
      'part_number y brand se derivan de la linea, no llegan por parametro';

    assert (select count(*) from public.thread_item_keys where item_id = fila.item_id) = 1,
      'Alpha ve exclusivamente su propia CEK envuelta en la tarjeta que acaba de crear';

    raise notice 'OK · 0014: create_inquiry reutiliza el hilo existente y deposita la CONSULTA';
  end
  $$;
commit;

do $$
begin
  assert (select count(*) from public.threads
          where org_low_id = '11111111-1111-1111-1111-111111111111'
            and org_high_id = '22222222-2222-2222-2222-222222222222') = 1,
    'create_inquiry no duplica el hilo cuando ya existe (single-thread-model)';
  raise notice 'OK · 0014: single-thread-model se mantiene tras create_inquiry';
end
$$;

-- 5 · ANCLA · el hilo NO existía: Gamma consulta a Beta por primera vez y
-- create_inquiry lo CREA. Gamma no ha creado ningún hilo en todo este
-- fichero, así que no puede chocar con el límite de 25/día que sí agotó
-- Alpha más arriba — es a propósito: prueba la RAMA de creación, no la de
-- reencontrar, sin acoplarse al rate-limiting de otro caso.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    fila record;
  begin
    assert not exists (
      select 1 from public.threads
       where org_low_id  = least('22222222-2222-2222-2222-222222222222'::uuid,
                                  '33333333-3333-3333-3333-333333333333'::uuid)
         and org_high_id = greatest('22222222-2222-2222-2222-222222222222'::uuid,
                                     '33333333-3333-3333-3333-333333333333'::uuid)
    ), 'ancla previa: Beta y Gamma todavia NO tienen hilo antes de esta consulta';

    select * into fila from public.create_inquiry(
      'e1000000-0000-0000-0000-000000000001',
      repeat('bb', 48), repeat('15', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('15',12),
          'ephemeral_pubkey', repeat('66',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('15',12),
          'ephemeral_pubkey', repeat('88',32))
      ));

    assert fila.thread_id is not null, 'create_inquiry crea el hilo cuando no existia';
    assert (select created_by_org_id from public.threads where id = fila.thread_id)
             = '33333333-3333-3333-3333-333333333333',
      'quien consulta primero es quien crea el hilo';

    raise notice 'OK · 0014: create_inquiry crea el hilo cuando el distribuidor es nuevo';
  end
  $$;
commit;

-- Las dos claves están de verdad, mirando sin RLS — mismo patrón que
-- create_thread_item y counter_offer: quien escribe no se queda sin su copia.
do $$
begin
  assert (select count(*) from public.thread_item_keys tik
            join public.thread_items ti on ti.id = tik.item_id
           where ti.item_type = 'CONSULTA' and ti.inventory_line_id = 'e1000000-0000-0000-0000-000000000001'
             and ti.sender_org_id = '33333333-3333-3333-3333-333333333333') = 2,
    'create_inquiry deposita UNA fila de CEK por destinatario, incluida la del emisor';
  raise notice 'OK · 0014: las dos CEK de la consulta de Gamma estan, la del emisor incluida';
end
$$;

-- -----------------------------------------------------------------------------
-- thread_items.quantity (0020, ADR-002 D-3) · create_inquiry la deposita en
-- claro, ademas de cifrada en content_ciphertext
-- -----------------------------------------------------------------------------
-- MENSAJE la sigue prohibiendo (thread_items_shape_chk extendida en 0020).
select public.expect_fail(
  $$insert into public.thread_items
      (thread_id, sender_org_id, sender_member_id, item_type, quantity, content_ciphertext, content_iv)
    values ('11110000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
            '0a000001-0000-0000-0000-000000000001','MENSAJE', 10,
            decode('aa','hex'), decode(repeat('04',12),'hex'))$$,
  'D-3: un MENSAJE no lleva quantity (forma de tarjeta en un mensaje libre)');

-- Gamma consulta la OTRA línea PUBLISHED de Beta (la de e1000000...003, que
-- Gamma todavía no había tocado) con una cantidad real -- ANCLA: la columna
-- en claro tiene que traer exactamente lo que se mandó, no lo que había en
-- el ciphertext ni en el stock de la línea.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    fila record;
  begin
    select * into fila from public.create_inquiry(
      'e1000000-0000-0000-0000-000000000003',
      repeat('cc', 48), repeat('17', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('17',12),
          'ephemeral_pubkey', repeat('66',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('17',12),
          'ephemeral_pubkey', repeat('88',32))
      ),
      42);

    assert (select quantity from public.thread_items where id = fila.item_id) = 42,
      'D-3: create_inquiry deposita quantity en claro, tal cual se mandó';
    raise notice 'OK · D-3: create_inquiry escribe quantity en claro (42)';
  end
  $$;
commit;

-- Una tercera línea PUBLISHED de Beta, fresca -- las dos originales (001,
-- 003) ya las consultaron Alpha Y Gamma en los bloques de arriba, y el
-- índice único es por (línea, organización compradora): no queda ningún par
-- reutilizable para lo que falta comprobar.
insert into public.inventory_lines
  (id, org_id, part_number, brand, quantity, location_country, product_family, status)
values
  ('e1000000-0000-0000-0000-000000000004', :orgB, '6208-2RS', 'SKF', 300, 'DE',
   'Rodamiento rigido de bolas', 'PUBLISHED');

-- Sin mandar p_quantity, la firma de 5 parametros sigue aceptando la llamada
-- de siempre (default null) -- el llamador de ayer no se rompe.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    fila record;
  begin
    select * into fila from public.create_inquiry(
      'e1000000-0000-0000-0000-000000000004',
      repeat('dd', 48), repeat('18', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('18',12),
          'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('18',12),
          'ephemeral_pubkey', repeat('44',32))
      ));

    assert (select quantity from public.thread_items where id = fila.item_id) is null,
      'D-3: sin p_quantity, la llamada de 4 parametros de siempre sigue funcionando y guarda NULL';
    raise notice 'OK · D-3: create_inquiry retrocompatible, p_quantity default null';
  end
  $$;
commit;

-- Negativa, bloqueada -- mismo criterio que inventory_lines.quantity (0002).
-- Gamma, no Alpha: la misma línea 004 ya la consultó Alpha arriba, y el
-- índice único es por organización compradora -- Gamma todavía no la ha
-- tocado, así que llega limpia hasta la comprobación de la cantidad.
begin;
  select set_config('request.jwt.claim.sub', '0c000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_inquiry('e1000000-0000-0000-0000-000000000004',
        repeat('ee',48), repeat('19',12),
        jsonb_build_array(jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('19',12),
          'ephemeral_pubkey', repeat('22',32))),
        -5)$$,
    'D-3: create_inquiry rechaza una cantidad negativa');
commit;

-- -----------------------------------------------------------------------------
-- organizations.visibility_scope_enabled (0019, ADR-002 D-7) · activa "Lista
-- de hilos" (threads_select_participant / thread_items_select_participant)
-- -----------------------------------------------------------------------------
do $$
begin
  assert (select visibility_scope_enabled from public.organizations
          where id = '11111111-1111-1111-1111-111111111111') = false,
    'D-7: visibility_scope_enabled tiene que venir apagado por defecto';
  raise notice 'OK · D-7: el ambito viene apagado por defecto';
end
$$;

-- Guardia, ANTES de tocar nada de Alpha: el ADMIN de una organizacion no
-- activa el ambito de OTRA. La fila ajena queda fuera de
-- organizations_update_visibility_admin (0002): el UPDATE no la toca, no
-- hace falta una excepcion nueva para probarlo.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  update public.organizations set visibility_scope_enabled = true
    where id = '33333333-3333-3333-3333-333333333333';
commit;

do $$
begin
  assert (select visibility_scope_enabled from public.organizations
          where id = '33333333-3333-3333-3333-333333333333') = false,
    'D-7: el ADMIN de Beta no puede activar el ambito de Gamma';
  raise notice 'OK · D-7: el interruptor de una organizacion no lo toca el ADMIN de otra';
end
$$;

-- Y dentro de la MISMA organizacion, un EDITOR tampoco: is_org_admin() ya
-- acota organizations_update_visibility_admin al rol, aqui se confirma para
-- la columna nueva.
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  update public.organizations set visibility_scope_enabled = true
    where id = '11111111-1111-1111-1111-111111111111';
commit;

do $$
begin
  assert (select visibility_scope_enabled from public.organizations
          where id = '11111111-1111-1111-1111-111111111111') = false,
    'D-7: un EDITOR no puede activar el ambito de su propia organizacion, solo el ADMIN';
  raise notice 'OK · D-7: el interruptor es del ADMIN, no de cualquier miembro activo';
end
$$;

-- Segundo hilo de Alpha, con Gamma, creado por Gamma (Alpha ya agoto su
-- limite diario en el bloque de thread-rate-limiting, arriba). Solo a2 y c1
-- tienen clave aqui -- a1 nunca es destinatario -- para poder distinguir
-- OWN de ORG_METADATA en las comprobaciones de abajo.
insert into public.threads (id, org_low_id, org_high_id, created_by_org_id)
values ('11110000-0000-0000-0000-000000000002',
        least(:orgA::uuid, :orgC::uuid), greatest(:orgA::uuid, :orgC::uuid), :orgC);

begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    creado uuid;
  begin
    creado := public.create_thread_item(
      '11110000-0000-0000-0000-000000000002', 'MENSAJE',
      repeat('12', 32), repeat('16', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('16',12),
          'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('16',12),
          'ephemeral_pubkey', repeat('44',32))
      ));
    assert creado is not null, 'a2 abre el hilo Alpha-Gamma con su primer mensaje';
    raise notice 'OK · a2 abre Alpha-Gamma; a1 no participa en ningun elemento de este hilo';
  end
  $$;
commit;

-- Ancla PRE-interruptor: con el ambito todavia apagado, a2 sigue viendo TODO
-- lo de Alpha -- comportamiento actual, tal como exige D-7 por defecto. Se
-- calcula la verdad de fondo sin RLS (como postgres) para no acoplar el
-- aserto a un recuento fijo de hilos/elementos de bloques anteriores del
-- fichero.
-- Los dos totales viajan por `current_setting()`, no por `:variable` de psql:
-- la interpolacion de psql no entra dentro de un cuerpo `do $$ ... $$`
-- (lo lee el servidor tal cual, y ahi ":total_hilos_alpha" es solo texto).
select count(*) as total_hilos_alpha from public.threads
  where :orgA::uuid in (org_low_id, org_high_id) \gset
select count(*) as total_items_alpha from public.thread_items ti
  where exists (select 1 from public.threads t where t.id = ti.thread_id
                  and :orgA::uuid in (t.org_low_id, t.org_high_id)) \gset
select set_config('test.total_hilos_alpha', :'total_hilos_alpha', false);
select set_config('test.total_items_alpha', :'total_items_alpha', false);

begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    esperado_hilos int := current_setting('test.total_hilos_alpha')::int;
    esperado_items int := current_setting('test.total_items_alpha')::int;
  begin
    assert (select count(*) from public.threads) = esperado_hilos,
      'D-7: con el ambito apagado a2 sigue viendo TODOS los hilos de Alpha, como hoy';
    assert (select count(*) from public.thread_items) = esperado_items,
      'D-7: con el ambito apagado a2 sigue viendo TODOS los elementos de Alpha, como hoy';
    raise notice 'OK · D-7: apagado por defecto, comportamiento identico al de hoy (% hilos, % elementos)', esperado_hilos, esperado_items;
  end
  $$;
commit;

-- Se enciende el ambito para Alpha -- lo hace el propio ADMIN (a1), la via
-- real (organizations_update_visibility_admin, ya existente desde INV-07).
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  update public.organizations set visibility_scope_enabled = true where id = :orgA;
commit;

do $$
begin
  assert (select visibility_scope_enabled from public.organizations
          where id = '11111111-1111-1111-1111-111111111111') = true,
    'D-7: el ADMIN de la propia organizacion SI puede activar su interruptor';
  raise notice 'OK · D-7: a1 activa el ambito de Alpha por la via real (ADMIN, propia organizacion)';
end
$$;

-- a2 (EDITOR/OWN): a partir de aqui, solo lo suyo -- por hilo (D-1/D-8) y
-- por elemento (D-1: "el ambito es por ELEMENTO, no por hilo").
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.threads) = 1,
      'D-1/D-8: con el ambito encendido, a2 ve exactamente 1 hilo -- el suyo con Gamma';
    assert exists (select 1 from public.threads where id = '11110000-0000-0000-0000-000000000002'),
      'D-1: el hilo donde a2 tiene una clave envuelta esta en su lista';
    assert not exists (select 1 from public.threads where id = '11110000-0000-0000-0000-000000000001'),
      'D-8: a2 deja de ver el hilo Alpha-Beta en cuanto se enciende el ambito -- nunca tuvo clave ahi';
    assert (select count(*) from public.thread_items) = 1,
      'D-1: el ambito es por ELEMENTO -- a2 ve exactamente el suyo, no el hilo entero';
    raise notice 'OK · D-1/D-8: a2 (OWN) pasa de ver todo a ver solo lo suyo en cuanto se activa';
  end
  $$;
commit;

-- a1 (ADMIN/ORG_METADATA): el plano completo, sin ser destinatario de
-- ninguna clave del hilo nuevo (D-2).
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    esperado_hilos int := current_setting('test.total_hilos_alpha')::int;
    esperado_items int := current_setting('test.total_items_alpha')::int;
  begin
    assert (select count(*) from public.threads) = esperado_hilos,
      'D-2: el ADMIN (ORG_METADATA) sigue viendo TODOS los hilos de Alpha con el ambito encendido';
    assert (select count(*) from public.thread_items) = esperado_items,
      'D-2: el ADMIN (ORG_METADATA) sigue viendo TODOS los elementos de Alpha con el ambito encendido';
    assert exists (select 1 from public.threads where id = '11110000-0000-0000-0000-000000000002'),
      'D-2: a1 ve el hilo Alpha-Gamma aunque nunca le envolvieron una clave ahi';
    raise notice 'OK · D-2: a1 (ORG_METADATA) ve el plano completo sin ser destinatario criptografico';
  end
  $$;
commit;

-- Beta nunca activo el interruptor: b1 sigue viendo lo de siempre. La
-- regresion que demuestra que D-7 es de verdad opcional, no solo en teoria.
-- Ground truth de nuevo por SQL, no a mano: Beta acumulo un segundo hilo
-- propio (con Gamma, bloque `create_inquiry` §5 mas arriba) ademas del de
-- Alpha, y contarlo de memoria es exactamente el error que la regla 2 del
-- relevo (ESTADO-V1.md) existe para evitar.
select count(*) as total_hilos_beta from public.threads
  where :orgB::uuid in (org_low_id, org_high_id) \gset
select set_config('test.total_hilos_beta', :'total_hilos_beta', false);

begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    esperado_hilos int := current_setting('test.total_hilos_beta')::int;
  begin
    assert (select count(*) from public.threads) = esperado_hilos,
      'D-7: Beta nunca activo el ambito -- b1 sigue viendo todos sus hilos, sin cambios';
    raise notice 'OK · D-7: una organizacion que no activa el ambito no nota ningun cambio (% hilos)', esperado_hilos;
  end
  $$;
commit;

-- -----------------------------------------------------------------------------
-- counter_offer con quantity (0021, ADR-002 D-3) · la mitad de OFERTA que 0020
-- dejo a proposito
-- -----------------------------------------------------------------------------
-- Tres ofertas Pendiente nuevas de Alpha, una por caso: cada contraoferta
-- supersede a la suya, asi que no se pueden encadenar sobre la misma fila.
-- Beta las contraoferta -- Beta nunca activo el ambito (bloque de arriba), asi
-- que b1 ve el hilo con el criterio de siempre y esto no mide D-7 de rebote.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, estado_oferta, quantity, content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-000000000007', '11110000-0000-0000-0000-000000000001',
   :orgA, :a1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente', null,
   decode(repeat('21', 96), 'hex'), decode(repeat('22', 12), 'hex')),
  ('12000000-0000-0000-0000-000000000008', '11110000-0000-0000-0000-000000000001',
   :orgA, :a1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente', 500,
   decode(repeat('23', 96), 'hex'), decode(repeat('24', 12), 'hex')),
  ('12000000-0000-0000-0000-000000000009', '11110000-0000-0000-0000-000000000001',
   :orgA, :a1, 'OFERTA', '6205-2RS', 'SKF', 'Pendiente', null,
   decode(repeat('25', 96), 'hex'), decode(repeat('26', 12), 'hex'));

-- 1 · ANCLA. La cantidad llega en claro tal cual se mando, y NO sale del
-- ciphertext ni de la oferta anterior.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    nueva uuid;
  begin
    nueva := public.counter_offer(
      '12000000-0000-0000-0000-000000000007',
      repeat('bb', 96), repeat('27', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('27',12),
          'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('27',12),
          'ephemeral_pubkey', repeat('44',32))
      ),
      250);

    assert (select quantity from public.thread_items where id = nueva) = 250,
      'D-3: counter_offer deposita quantity en claro, tal cual se mando';
    assert (select part_number from public.thread_items where id = nueva) = '6205-2RS',
      'D-3: lo que se heredaba (part_number) se sigue heredando';
    raise notice 'OK · D-3: counter_offer escribe quantity en claro (250)';
  end
  $$;
commit;

-- 2 · La cantidad NO se hereda de la oferta anterior. Es el aserto que sostiene
-- el §2 de 0021: la anterior tiene 500 en claro, el llamador viejo no manda
-- nada, y la nueva guarda NULL -- no 500. Heredarla escribiria en el plano en
-- claro una cifra que el ciphertext de la contraoferta puede desmentir, y un
-- ADMIN leyendo D-2 no tendria como saberlo (F-010 con otra ropa).
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    nueva uuid;
  begin
    nueva := public.counter_offer(
      '12000000-0000-0000-0000-000000000008',
      repeat('cc', 96), repeat('28', 12),
      jsonb_build_array(
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('28',12),
          'ephemeral_pubkey', repeat('66',32))
      ));

    assert (select quantity from public.thread_items where id = nueva) is null,
      'D-3: sin p_quantity la contraoferta guarda NULL, NO hereda la cantidad de la anterior';
    assert (select quantity from public.thread_items
             where id = '12000000-0000-0000-0000-000000000008') = 500,
      'D-3: la oferta superada conserva su propia cantidad, la contraoferta no la reescribe';
    raise notice 'OK · D-3: counter_offer retrocompatible y sin herencia de quantity';
  end
  $$;
commit;

-- 3 · Negativa, bloqueada con mensaje propio antes de que salte el check.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.counter_offer('12000000-0000-0000-0000-000000000009',
        repeat('dd',96), repeat('29',12),
        jsonb_build_array(jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('29',12),
          'ephemeral_pubkey', repeat('88',32))),
        -5)$$,
    'D-3: una contraoferta con cantidad negativa');
commit;

-- La firma vieja de cuatro parametros ya no existe: 0021 la borra antes de
-- crear la de cinco, para que la llamada de siempre resuelva al default y no
-- quede ambigua entre dos funciones ("function is not unique").
do $$
begin
  assert (select count(*) from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'counter_offer') = 1,
    '0021: counter_offer tiene UNA sola firma, la de cinco parametros';
  raise notice 'OK · 0021: una sola firma de counter_offer';
end
$$;

-- -----------------------------------------------------------------------------
-- F-146 (0022) · ninguna funcion de `public` la puede ejecutar `anon`
-- -----------------------------------------------------------------------------
-- El aserto que no existia el 4-sep-2026, y por eso el agujero vivio desde
-- 0012. Mide de verdad desde que `00_auth_stub.sql` copia las DEFAULT
-- PRIVILEGES de la plataforma: sin eso, ninguna funcion local nacia ejecutable
-- por `anon` y esto habria pasado en vacio.
--
-- `expect_fail` se excluye porque no es esquema: la crea este mismo banco de
-- pruebas y no existe en el proyecto real.
do $$
declare
  abiertas text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname <> 'expect_fail'
     and exists (select 1 from aclexplode(p.proacl) a
                   join pg_roles r on r.oid = a.grantee
                  where r.rolname = 'anon' and a.privilege_type = 'EXECUTE');

  assert abiertas is null,
    'F-146: estas funciones de public las puede ejecutar anon: ' || coalesce(abiertas, '');
  raise notice 'OK · F-146: ninguna funcion de public es ejecutable por anon';
end
$$;

-- Y que una funcion NUEVA tampoco nazca abierta -- la segunda mitad de 0022,
-- la default privilege. Sin este aserto, la proxima migracion reintroduce el
-- agujero y solo se veria al revocar a mano una por una.
create or replace function public.f146_canaria() returns int
  language sql immutable as $$ select 1 $$;

do $$
begin
  assert not exists (select 1 from pg_proc p
                       join pg_namespace n on n.oid = p.pronamespace,
                     lateral aclexplode(p.proacl) a
                       join pg_roles r on r.oid = a.grantee
                      where n.nspname = 'public' and p.proname = 'f146_canaria'
                        and r.rolname = 'anon' and a.privilege_type = 'EXECUTE'),
    'F-146: una funcion nueva de public sigue naciendo ejecutable por anon -- la default privilege de 0022 no esta puesta';
  raise notice 'OK · F-146: una funcion nueva de public no nace ejecutable por anon';
end
$$;

drop function public.f146_canaria();

select 'TODOS LOS ASSERTS PASAN' as resultado;
