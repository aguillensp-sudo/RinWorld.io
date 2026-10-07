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
  -- 0052: antes lo paraba el disparador; ahora ni siquiera hay permiso de columna (el disparador sigue, como segunda guarda).
  select public.expect_denied(
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

-- ⚠ ESTE ELEMENTO SE INSERTA A PELO, Y ANTES NO. Lo escribia `create_thread_
-- item` desde la sesion de a2, y desde `0023` esa via **ya no puede producir
-- este dato**: el guardia de Q-1 exige que el ADMIN de las dos organizaciones
-- (aqui a1) reciba copia de todo, y este bloque necesita justo lo contrario --
-- un hilo donde a1 NO tenga ninguna clave envuelta- para poder distinguir a
-- continuacion si a1 lo ve por ser ORG_METADATA (D-2) o por tener clave.
--
-- No se relaja el guardia ni se cambia lo que el bloque comprueba: se cambia
-- COMO se siembra. Y el dato sigue siendo realista, que es lo que decide que
-- esto valga: quedan tres formas de que un ADMIN no tenga clave de un elemento
-- de su organizacion -- los elementos anteriores al 4-sep-2026, los de un ADMIN
-- que todavia no ha publicado su `public_key` (el guardia lo exceptua a
-- proposito, ver `0023` §4), y los anteriores a que a esa persona la
-- ascendieran a ADMIN. La politica que se prueba aqui abajo es la que los
-- cubre, y por eso sigue haciendo falta.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   content_ciphertext, content_iv)
values
  ('12000000-0000-0000-0000-00000000000a', '11110000-0000-0000-0000-000000000002',
   :orgA, '0a000002-0000-0000-0000-000000000002', 'MENSAJE',
   decode(repeat('12', 32), 'hex'), decode(repeat('16', 12), 'hex'));

insert into public.thread_item_keys
  (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
values
  ('12000000-0000-0000-0000-00000000000a', '0a000002-0000-0000-0000-000000000002',
   decode(repeat('11',48),'hex'), decode(repeat('16',12),'hex'), decode(repeat('22',32),'hex')),
  ('12000000-0000-0000-0000-00000000000a', '0c000001-0000-0000-0000-000000000001',
   decode(repeat('33',48),'hex'), decode(repeat('16',12),'hex'), decode(repeat('44',32),'hex'));

do $$
begin
  assert not exists (
    select 1 from public.thread_item_keys
     where item_id = '12000000-0000-0000-0000-00000000000a'
       and recipient_member_id = '0a000001-0000-0000-0000-000000000001'),
    'la siembra de este hilo tiene que dejar a a1 SIN clave: es lo que distingue D-2 de tener copia';
  raise notice 'OK · a2 abre Alpha-Gamma; a1 no participa en ningun elemento de este hilo';
end
$$;

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
      -- a1 va aqui desde `0023`: es el ADMIN de Alpha y Q-1 le da copia de todo,
      -- asi que el guardia rechaza el reparto si falta. Antes bastaba con b1.
      jsonb_build_array(
        jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('28',12),
          'ephemeral_pubkey', repeat('66',32)),
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('99',48), 'wrap_iv', repeat('28',12),
          'ephemeral_pubkey', repeat('aa',32))
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
-- Q-1 (0023, ADR-002 §10) · el reparto de la CEK
-- -----------------------------------------------------------------------------
-- Hace falta mas plantilla que la de arriba: para distinguir "todos" de "yo y
-- mis ADMIN" hace falta un tercer miembro en Alpha, y para distinguir "quien ha
-- escrito" de "todos los de la contraparte" hacen falta tres en Gamma.
insert into auth.users (id, email) values
  ('0a000003-0000-0000-0000-000000000003', 'a3@alpha.test'),
  ('0c000002-0000-0000-0000-000000000002', 'c2@gamma.test'),
  ('0c000003-0000-0000-0000-000000000003', 'c3@gamma.test');

insert into public.members (id, org_id, email, role, state) values
  ('0a000003-0000-0000-0000-000000000003', :orgA, 'a3@alpha.test', 'EDITOR', 'PENDING_REVIEW'),
  ('0c000002-0000-0000-0000-000000000002', :orgC, 'c2@gamma.test', 'EDITOR', 'PENDING_REVIEW'),
  ('0c000003-0000-0000-0000-000000000003', :orgC, 'c3@gamma.test', 'EDITOR', 'PENDING_REVIEW');

update public.members set state = 'ACTIVE'
 where id in ('0a000003-0000-0000-0000-000000000003',
              '0c000002-0000-0000-0000-000000000002',
              '0c000003-0000-0000-0000-000000000003');

-- Claves publicadas para los seis: el guardia solo exige al ADMIN que TIENE
-- `public_key` (0023 §4), asi que sin esto la mitad de los asertos de abajo
-- pasarian por el camino de la excepcion en vez de por el que se quiere probar.
update public.members set public_key = decode(repeat('a1', 32), 'hex') where id = :a1;
update public.members set public_key = decode(repeat('a2', 32), 'hex') where id = :a2;
update public.members set public_key = decode(repeat('a3', 32), 'hex') where id = '0a000003-0000-0000-0000-000000000003';
update public.members set public_key = decode(repeat('c1', 32), 'hex') where id = :c1;
update public.members set public_key = decode(repeat('c2', 32), 'hex') where id = '0c000002-0000-0000-0000-000000000002';
update public.members set public_key = decode(repeat('c3', 32), 'hex') where id = '0c000003-0000-0000-0000-000000000003';

-- Estado de partida, dicho aqui y no heredado de bloques anteriores (regla 2
-- del relevo: se comprueba, no se recuerda).
update public.organizations set visibility_scope_enabled = true  where id = :orgA;
update public.organizations set visibility_scope_enabled = false where id = :orgC;

-- 1 · Con el ambito de Gamma APAGADO, la contraparte entera sigue entrando --
-- comportamiento de 0012, que es lo que D-7 promete a quien no toca nada.
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    quienes uuid[];
  begin
    select array_agg(member_id order by member_id) into quienes
      from public.thread_public_keys('11110000-0000-0000-0000-000000000002');

    assert quienes @> array['0c000001-0000-0000-0000-000000000001'::uuid,
                           '0c000002-0000-0000-0000-000000000002'::uuid,
                           '0c000003-0000-0000-0000-000000000003'::uuid],
      'Q-1: con el ambito de la contraparte apagado, entran TODOS sus miembros';
    assert quienes @> array['0a000001-0000-0000-0000-000000000001'::uuid],
      'Q-1/D-2: el ADMIN de la propia organizacion entra siempre';
    assert not (quienes @> array['0a000003-0000-0000-0000-000000000003'::uuid]),
      'Q-1/V-1: con MI ambito encendido, un companero EDITOR que no participa NO entra';
    raise notice 'OK · Q-1: mi lado acotado (yo + ADMIN), contraparte con ambito apagado entera';
  end
  $$;
commit;

-- 2 · Y si apago el mio, vuelve a ser exactamente lo de 0012: todos con todos.
update public.organizations set visibility_scope_enabled = false where id = :orgA;
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    quienes uuid[];
  begin
    select array_agg(member_id order by member_id) into quienes
      from public.thread_public_keys('11110000-0000-0000-0000-000000000002');
    assert quienes @> array['0a000003-0000-0000-0000-000000000003'::uuid],
      'D-7: con el ambito apagado no cambia NADA -- el companero que no participa vuelve a entrar';
    raise notice 'OK · D-7: con el interruptor apagado, 0023 se comporta como 0012';
  end
  $$;
commit;
update public.organizations set visibility_scope_enabled = true where id = :orgA;

-- 3 · Los DOS ambitos encendidos y nadie de Gamma ha escrito todavia en esta
-- conversacion: entran todos los de Gamma. Es la regla 3 de Q-1, el buzon
-- abierto -- si no, el elemento entrante no lo podria leer nadie alli.
update public.organizations set visibility_scope_enabled = true where id = :orgC;
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    quienes uuid[];
  begin
    select array_agg(member_id order by member_id) into quienes
      from public.thread_public_keys('11110000-0000-0000-0000-000000000002');
    assert quienes @> array['0c000002-0000-0000-0000-000000000002'::uuid,
                           '0c000003-0000-0000-0000-000000000003'::uuid],
      'Q-1 regla 3: si nadie de la contraparte ha escrito, el elemento es ENTRANTE para ellos y entran todos';
    raise notice 'OK · Q-1: buzon abierto mientras nadie ha asumido la conversacion';
  end
  $$;
commit;

-- 4 · c2 asume: responde. A partir de aqui, c3 deja de entrar -- y c1 sigue,
-- por ADMIN. Es "asumir es responder", sin accion de reparto.
begin;
  select set_config('request.jwt.claim.sub', '0c000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    creado uuid;
  begin
    -- ⚠ ANCLA DE F-148, y se queda puesta. Estas tres son las condiciones de
    -- `thread_items_insert_own` (0003:333), y las tres se cumplian cuando la
    -- escritura fallaba con "new row violates row-level security policy". Sin
    -- ellas, el diagnostico habria empezado por acusar a la sesion o al rol --
    -- que era lo mas probable a ojo- en vez de al `RETURNING` y a la politica
    -- de LECTURA derivada de 0019, que era la causa. **Este bloque entero es la
    -- prueba de que se puede escribir con el ambito encendido**: antes de 0023
    -- no se podia, ni un mensaje.
    assert app.is_active_member(), 'F-148: c2 tiene que estar ACTIVE para poder escribir';
    assert app.current_org_id() = '33333333-3333-3333-3333-333333333333',
      'F-148: c2 tiene que resolver a Gamma';
    assert app.can_access_thread('11110000-0000-0000-0000-000000000002'),
      'F-148: Gamma participa en el hilo Alpha-Gamma';

    creado := public.create_thread_item(
      '11110000-0000-0000-0000-000000000002', 'MENSAJE',
      repeat('31', 32), repeat('32', 12),
      jsonb_build_array(
        -- c2 (quien escribe) + c1 (ADMIN de Gamma) + a1 (ADMIN de Alpha) +
        -- a2 (el participante de la otra organizacion). c3 NO: seria V-1.
        jsonb_build_object('member_id','0c000002-0000-0000-0000-000000000002',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('32',12), 'ephemeral_pubkey', repeat('22',32)),
        jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('32',12), 'ephemeral_pubkey', repeat('44',32)),
        jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
          'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('32',12), 'ephemeral_pubkey', repeat('66',32)),
        jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
          'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('32',12), 'ephemeral_pubkey', repeat('88',32))
      ));
    assert creado is not null, 'c2 responde y con eso asume la conversacion';
    raise notice 'OK · Q-1: asumir no es una accion, es responder';
  end
  $$;
commit;

begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    quienes uuid[];
  begin
    select array_agg(member_id order by member_id) into quienes
      from public.thread_public_keys('11110000-0000-0000-0000-000000000002');
    assert quienes @> array['0c000002-0000-0000-0000-000000000002'::uuid],
      'Q-1: quien respondio sigue entrando -- ha escrito en esta conversacion';
    assert quienes @> array['0c000001-0000-0000-0000-000000000001'::uuid],
      'Q-1/D-2: el ADMIN de la contraparte entra aunque no haya escrito';
    assert not (quienes @> array['0c000003-0000-0000-0000-000000000003'::uuid]),
      'Q-1: una vez asumida la conversacion, el companero que no escribio DEJA de recibir copia';
    raise notice 'OK · Q-1: asumida la conversacion, el reparto se cierra sobre quien habla';
  end
  $$;
commit;

-- 5 · V-2 INVERTIDO (ADR-002 §4, 4-sep-2026): sin el ADMIN, no se escribe.
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_thread_item(
        '11110000-0000-0000-0000-000000000002', 'MENSAJE',
        repeat('41',32), repeat('42',12),
        jsonb_build_array(jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('42',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'V-2 invertido: un reparto que deja fuera al ADMIN de la organizacion');
commit;

-- 6 · V-1 precisado: con el ambito encendido, no se envuelve para un companero
-- que no participa -- ni aunque quien escribe quiera.
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_thread_item(
        '11110000-0000-0000-0000-000000000002', 'MENSAJE',
        repeat('43',32), repeat('44',12),
        jsonb_build_array(
          jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
            'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('44',12), 'ephemeral_pubkey', repeat('22',32)),
          jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('44',12), 'ephemeral_pubkey', repeat('44',32)),
          jsonb_build_object('member_id','0a000003-0000-0000-0000-000000000003',
            'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('44',12), 'ephemeral_pubkey', repeat('66',32))))$$,
    'V-1: envolver para un companero EDITOR que no participa, con el ambito encendido');
commit;

-- 7 · org_public_keys, el primer contacto: de la propia organizacion solo yo y
-- mis ADMIN; de la otra, todos (buzon abierto).
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  declare
    mios  uuid[];
    otros uuid[];
  begin
    select array_agg(member_id order by member_id) into mios
      from public.org_public_keys('11111111-1111-1111-1111-111111111111');
    select array_agg(member_id order by member_id) into otros
      from public.org_public_keys('33333333-3333-3333-3333-333333333333');

    assert mios @> array['0a000002-0000-0000-0000-000000000002'::uuid,
                         '0a000001-0000-0000-0000-000000000001'::uuid]
       and not (mios @> array['0a000003-0000-0000-0000-000000000003'::uuid]),
      'Q-1: de la propia organizacion, con el ambito encendido, solo quien escribe y sus ADMIN';
    assert otros @> array['0c000001-0000-0000-0000-000000000001'::uuid,
                          '0c000002-0000-0000-0000-000000000002'::uuid,
                          '0c000003-0000-0000-0000-000000000003'::uuid],
      'Q-1 regla 3: de la contraparte, TODOS -- aunque tenga el ambito encendido';
    raise notice 'OK · Q-1: org_public_keys acota mi lado y deja entero el de enfrente';
  end
  $$;
commit;

-- -----------------------------------------------------------------------------
-- 0024 · el guardia recalcula el conjunto EXACTO (backlog de 0023 §4, F-154)
-- -----------------------------------------------------------------------------
-- Reutiliza el hilo y el estado de arriba: c2 ya asumio la conversacion (paso
-- 4), asi que el conjunto correcto de Gamma esta cerrado a {c1 (ADMIN), c2
-- (escribio)} -- c3 quedo fuera. Es justo el estado donde el hueco de 0023
-- §4 era real: nada impedia antes pedir de mas hacia la contraparte.

-- 8 · F-154 · ningun destinatario puede ser de una TERCERA organizacion,
-- ajena por completo a este hilo -- aqui, b1 de Beta Rodamientos.
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_thread_item(
        '11110000-0000-0000-0000-000000000002', 'MENSAJE',
        repeat('51',32), repeat('52',12),
        jsonb_build_array(
          jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
            'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('52',12), 'ephemeral_pubkey', repeat('22',32)),
          jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('52',12), 'ephemeral_pubkey', repeat('44',32)),
          jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('52',12), 'ephemeral_pubkey', repeat('66',32)),
          jsonb_build_object('member_id','0c000002-0000-0000-0000-000000000002',
            'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('52',12), 'ephemeral_pubkey', repeat('88',32)),
          jsonb_build_object('member_id','0b000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('99',48), 'wrap_iv', repeat('52',12), 'ephemeral_pubkey', repeat('aa',32))))$$,
    'F-154 (0024): envolver para un miembro de una TERCERA organizacion, ajena al hilo');
commit;

-- 9 · 0024, backlog de 0023 §4 · con hilo ya asumido, el reparto no puede
-- incluir a mas gente de la CONTRAPARTE de la que thread_public_keys
-- devuelve ahora mismo -- aqui, c3, que tiene clave publicada y pertenece a
-- la organizacion correcta, pero dejo de entrar en el paso 4 de arriba
-- porque no participo. Esto es exactamente lo que 0023 §4 dejaba declarado
-- y sin cerrar: "un cliente manipulado podria envolver de mas hacia la
-- CONTRAPARTE".
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_thread_item(
        '11110000-0000-0000-0000-000000000002', 'MENSAJE',
        repeat('53',32), repeat('54',12),
        jsonb_build_array(
          jsonb_build_object('member_id','0a000002-0000-0000-0000-000000000002',
            'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('54',12), 'ephemeral_pubkey', repeat('22',32)),
          jsonb_build_object('member_id','0a000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('54',12), 'ephemeral_pubkey', repeat('44',32)),
          jsonb_build_object('member_id','0c000001-0000-0000-0000-000000000001',
            'wrapped_cek', repeat('55',48), 'wrap_iv', repeat('54',12), 'ephemeral_pubkey', repeat('66',32)),
          jsonb_build_object('member_id','0c000002-0000-0000-0000-000000000002',
            'wrapped_cek', repeat('77',48), 'wrap_iv', repeat('54',12), 'ephemeral_pubkey', repeat('88',32)),
          jsonb_build_object('member_id','0c000003-0000-0000-0000-000000000003',
            'wrapped_cek', repeat('bb',48), 'wrap_iv', repeat('54',12), 'ephemeral_pubkey', repeat('cc',32))))$$,
    '0024 (backlog 0023 §4): envolver de mas hacia la CONTRAPARTE -- c3 ya no entra tras asumirse la conversacion');
commit;

-- -----------------------------------------------------------------------------
-- 0026 · F-156 · "ya has consultado" no se salta para un EDITOR sin clave
-- -----------------------------------------------------------------------------
-- a3 es EDITOR de Alpha (ambito ya encendido desde la linea ~1433), no ha
-- escrito nada y no tiene ninguna clave envuelta en la CONSULTA que a1 le
-- mando a Beta sobre la linea e1000000-...-003 (bloque "create_inquiry
-- (0014)", mas arriba). Antes de 0026, el EXISTS de create_inquiry caia bajo
-- thread_items_select_participant (0019) y a3 no veia esa fila -- el
-- guardia se saltaba en silencio y la consulta duplicada se habria creado.
-- Confirmado contra un Postgres desechable antes de escribir 0026, no
-- razonado.
begin;
  select set_config('request.jwt.claim.sub', '0a000003-0000-0000-0000-000000000003', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.create_inquiry('e1000000-0000-0000-0000-000000000003',
        repeat('cc',48), repeat('16',12),
        jsonb_build_array(jsonb_build_object('member_id','0a000003-0000-0000-0000-000000000003',
          'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('16',12),
          'ephemeral_pubkey', repeat('22',32))))$$,
    'F-156 (0026): a3 (EDITOR sin clave en la consulta previa) no puede duplicar la consulta que a1 ya mando a Beta');
commit;

do $$
begin
  assert (select count(*) from public.thread_items
          where item_type = 'CONSULTA'
            and inventory_line_id = 'e1000000-0000-0000-0000-000000000003'
            and sender_org_id = '11111111-1111-1111-1111-111111111111') = 1,
    'F-156: sigue habiendo UNA sola CONSULTA de Alpha a Beta sobre esta linea -- ninguna duplicada se creo';
  raise notice 'OK · F-156: app.org_already_inquired ve la consulta previa aunque el llamador no tenga clave en ella';
end
$$;

-- -----------------------------------------------------------------------------
-- 0027 · el contacto publico lo escribe el operador, no el cliente
-- -----------------------------------------------------------------------------
-- `contact_phone` y `contact_email` son datos publicos --los pinta DIR-01 para
-- cualquier miembro-- pero publicos de LEER no es lo mismo que editables. La
-- politica `organizations_update_visibility_admin` filtra por ORGANIZACION, no
-- por columna: un ADMIN puede escribir en su propia fila, y lo unico que acota
-- QUE columna es el disparador `app.guard_organization_columns`.
--
-- Asi que una columna nueva NO entra sola en ese guardia: nace editable por
-- cualquier ADMIN. `0027` las mete a las dos, y este bloque lo fija. Sin el, la
-- proxima columna que alguien anada a `organizations` volvera a nacer abierta y
-- no se vera hasta que un cliente manipulado cambie el telefono publico de su
-- organizacion por otro.

-- Se guarda el valor de antes para devolverlo al final: este bloque escribe de
-- verdad, y dejar el terreno movido es como se cuelan los fallos entre pruebas.
select inventory_visibility_mode as modo_a_antes
  from public.organizations where id = :orgA \gset

begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;

  -- 1 · ANCLA POSITIVA. Lo que el guardia SI deja pasar sigue pasando, o este
  -- bloque estaria midiendo que el ADMIN no puede tocar nada de nada.
  update public.organizations
     set inventory_visibility_mode = 'RESTRINGIDA'
   where id = :orgA;

  do $$
  begin
    assert (select inventory_visibility_mode from public.organizations
             where id = '11111111-1111-1111-1111-111111111111') = 'RESTRINGIDA',
      '0027: un ADMIN sigue pudiendo cambiar inventory_visibility_mode -- si esto falla, el guardia bloquea de mas';
    raise notice 'OK · 0027: el ADMIN sigue pudiendo cambiar lo que siempre pudo';
  end
  $$;

  -- 2 · Y las dos columnas nuevas, no.
  select public.expect_fail(
    'update public.organizations set contact_email = ''otro@ejemplo.com'' where id = ''11111111-1111-1111-1111-111111111111''',
    '0027: un ADMIN no puede cambiar el email de contacto de su propia organizacion');

  select public.expect_fail(
    'update public.organizations set contact_phone = ''+34 000 000 000'' where id = ''11111111-1111-1111-1111-111111111111''',
    '0027: ni el telefono');
commit;

-- 3 · Y el operador si, que es quien los rellena en la siembra.
update public.organizations
   set contact_phone = '+34 954 123 456', contact_email = 'info@alpha.test'
 where id = :orgA;

do $$
begin
  assert (select contact_email from public.organizations
           where id = '11111111-1111-1111-1111-111111111111') = 'info@alpha.test',
    '0027: el operador (postgres/service_role) si escribe el contacto publico';

  -- 4 · Y el CHECK del email no deja pasar cualquier cosa.
  raise notice 'OK · 0027: el contacto publico lo escribe el operador';
end
$$;

select public.expect_fail(
  'update public.organizations set contact_email = ''esto no es un email'' where id = ''11111111-1111-1111-1111-111111111111''',
  '0027: organizations_contact_email_chk rechaza un email sin arroba');

-- Terreno devuelto a como estaba.
update public.organizations
   set inventory_visibility_mode = :'modo_a_antes'
 where id = :orgA;

-- -----------------------------------------------------------------------------
-- 0036 · la direccion postal tambien la escribe el operador, no el cliente
-- -----------------------------------------------------------------------------
-- Misma forma que el bloque de 0027: una columna nueva NO entra sola en
-- `app.guard_organization_columns`, y sin este bloque la proxima nace editable
-- por cualquier ADMIN sin que nada lo diga.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;

  select public.expect_fail(
    'update public.organizations set address = ''Otra calle 1'' where id = ''11111111-1111-1111-1111-111111111111''',
    '0036: un ADMIN no puede cambiar la direccion de su propia organizacion');
  select public.expect_fail(
    'update public.organizations set city = ''Otra'' where id = ''11111111-1111-1111-1111-111111111111''',
    '0036: ni la ciudad');
  select public.expect_fail(
    'update public.organizations set postal_code = ''00000'' where id = ''11111111-1111-1111-1111-111111111111''',
    '0036: ni el codigo postal');
commit;

update public.organizations
   set address = 'Calle Industria 14', city = 'Sevilla', postal_code = '41013'
 where id = :orgA;

do $$
begin
  assert (select postal_code from public.organizations
           where id = '11111111-1111-1111-1111-111111111111') = '41013',
    '0036: el operador (postgres/service_role) si escribe la direccion';
  raise notice 'OK · 0036: la direccion postal la escribe el operador';
end
$$;

select public.expect_fail(
  'update public.organizations set postal_code = '''' where id = ''11111111-1111-1111-1111-111111111111''',
  '0036: organizations_postal_code_chk rechaza una cadena vacia');

-- -----------------------------------------------------------------------------
-- 0037 · invitaciones de usuario y revocacion de acceso (INVT-01)
-- -----------------------------------------------------------------------------
-- Todo el que escribe lo hace por funcion `security definer` que comprueba DENTRO
-- que quien llama es ADMIN activo de SU organizacion. Este bloque mide las dos
-- mitades de cada regla -- que el ADMIN puede, y que un Editor, otro ADMIN y `anon`
-- no -- mas el limite de 5 con las invitaciones pendientes contando, y que revocar
-- deja al usuario sin acceso sin tocarle la clave (`user-revocation`).
--
-- Se crea una organizacion PROPIA (Delta Test, con su ADMIN d1 y su Editor d2) y se
-- borra al final: Alpha ya tiene varios miembros y revocarlos aqui romperia los
-- bloques que vienen despues, y el limite de 5 no se puede medir en una organizacion
-- cuyo tamano no controla este bloque.
insert into public.organizations (id, name, country, continent, status)
values ('44444444-4444-4444-4444-444444444444', 'Delta Test', 'FR', 'EU', 'APPROVED');

insert into auth.users (id, email) values
  ('0d000001-0000-0000-0000-000000000001', 'd1@delta.test'),
  ('0d000002-0000-0000-0000-000000000002', 'd2@delta.test'),
  ('0d0000aa-0000-0000-0000-0000000000aa', 'solo-auth@delta.test');

-- El primero de la organizacion sale ADMIN, el segundo EDITOR (role-auto-assignment).
insert into public.members (id, org_id, email, state)
values ('0d000001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'd1@delta.test', 'ACTIVE');
insert into public.members (id, org_id, email, state, public_key)
values ('0d000002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'd2@delta.test', 'ACTIVE',
        decode('0909090909090909090909090909090909090909090909090909090909090909', 'hex'));

do $$
begin
  assert (select role || '/' || state from public.members where id = '0d000001-0000-0000-0000-000000000001') = 'ADMIN/ACTIVE',
    '0037: el ancla -- d1 es ADMIN activo de Delta';
  assert (select role || '/' || state from public.members where id = '0d000002-0000-0000-0000-000000000002') = 'EDITOR/ACTIVE',
    '0037: el ancla -- d2 es EDITOR activo de Delta';
  assert (select role || '/' || state from public.members where id = '0a000001-0000-0000-0000-000000000001') = 'ADMIN/ACTIVE',
    '0037: el ancla -- a1 es ADMIN activo de Alpha (el ADMIN ajeno de los puntos 6 y 8)';
  assert app.org_seats_used('44444444-4444-4444-4444-444444444444') = 2, '0037: Delta empieza con 2 plazas ocupadas';
  raise notice 'OK · 0037: anclas -- Delta tiene un ADMIN y un Editor, y a1 es un ADMIN ajeno';
end
$$;

-- 1 · Un EDITOR no invita, no comprueba emails, no ve invitaciones y no revoca.
begin;
  select set_config('request.jwt.claim.sub', '0d000002-0000-0000-0000-000000000002', true);
  set local role authenticated;

  select public.expect_fail($q$select public.invite_member('nuevo@empresa.test')$q$,
    '0037: un EDITOR no puede invitar');
  select public.expect_fail($q$select public.email_has_account('nuevo@empresa.test')$q$,
    '0037: un EDITOR no puede comprobar que emails tienen cuenta');
  select public.expect_fail($q$select public.remove_member('0d000002-0000-0000-0000-000000000002')$q$,
    '0037: un EDITOR no puede revocar a nadie');
commit;

-- 2 · `anon` no ejecuta nada de esto ni lee la tabla. Se mide en el CATALOGO, no
--     intentando la llamada: un permiso denegado es SQLSTATE 42501, y `expect_fail`
--     rechaza los 42xxx como test roto (F-146: los privilegios se leen del catalogo).
do $$
begin
  assert not has_function_privilege('anon', 'public.invite_member(text)', 'execute'),
    '0037: anon no ejecuta invite_member';
  assert not has_function_privilege('anon', 'public.resend_invitation(uuid)', 'execute'),
    '0037: anon no ejecuta resend_invitation';
  assert not has_function_privilege('anon', 'public.remove_member(uuid)', 'execute'),
    '0037: anon no ejecuta remove_member';
  assert not has_function_privilege('anon', 'public.email_has_account(text)', 'execute'),
    '0037: anon no ejecuta email_has_account';
  assert not has_function_privilege('authenticated', 'app.org_seats_used(uuid)', 'execute'),
    '0037: el contador de plazas es interno, ni authenticated lo ejecuta';
  assert not has_table_privilege('anon', 'public.member_invitations', 'select'),
    '0037: anon no lee member_invitations';
  assert not has_table_privilege('anon', 'public.member_invitation_list', 'select'),
    '0037: anon no lee la vista';
  assert has_function_privilege('authenticated', 'public.invite_member(text)', 'execute'),
    '0037: el ancla positiva -- authenticated SI ejecuta invite_member';
  raise notice 'OK · 0037: anon no ejecuta ni lee nada de esto';
end
$$;

-- 3 · El ADMIN invita: la invitacion sale Pendiente y con 7 dias.
begin;
  select set_config('request.jwt.claim.sub', '0d000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  select public.invite_member('  Nuevo@Empresa.TEST ') as inv_id \gset

  do $$
  declare v record;
  begin
    select * into v from public.member_invitation_list where email = 'nuevo@empresa.test';
    assert v.status = 'Pendiente', '0037: la invitacion recien creada esta Pendiente';
    assert v.days_left = 7, '0037: y le quedan 7 dias, no ' || coalesce(v.days_left::text, 'NULL');
    assert v.org_id = '44444444-4444-4444-4444-444444444444', '0037: es de la organizacion de quien invita';
    raise notice 'OK · 0037: invitar crea una Pendiente de 7 dias, con el email normalizado';
  end
  $$;

  select public.expect_fail($q$select public.invite_member('nuevo@empresa.test')$q$,
    '0037: invitar dos veces al mismo email falla (ya hay una pendiente)');
  select public.expect_fail($q$select public.invite_member('d2@delta.test')$q$,
    '0037: un email que ya es miembro de la organizacion no se invita');
  select public.expect_fail($q$select public.invite_member('b1@beta.test')$q$,
    '0037: ni el de un miembro de OTRA organizacion (RN-INV: bajo cualquier organizacion)');
  select public.expect_fail($q$select public.invite_member('solo-auth@delta.test')$q$,
    '0037: ni el que solo existe en auth.users');
  select public.expect_fail($q$select public.invite_member('esto no es un email')$q$,
    '0037: un email sin forma de email se rechaza');

  do $$
  begin
    assert public.email_has_account('D2@delta.test'), '0037: email_has_account ve a un miembro, sin importar las mayusculas';
    assert public.email_has_account('solo-auth@delta.test'), '0037: y a quien solo esta en auth.users';
    assert not public.email_has_account('libre@empresa.test'), '0037: y dice que no a uno libre';
    raise notice 'OK · 0037: email_has_account responde al ADMIN';
  end
  $$;
commit;

-- 4 · El limite de 5 cuenta miembros MAS invitaciones pendientes. Se rellena por el
--     operador hasta dejar UNA plaza libre, y luego se usa esa.
do $$
declare v_n int; v_i int := 0;
begin
  v_n := 5 - app.org_seats_used('44444444-4444-4444-4444-444444444444');
  while v_i < v_n - 1 loop
    v_i := v_i + 1;
    insert into public.member_invitations (org_id, email)
    values ('44444444-4444-4444-4444-444444444444', 'relleno' || v_i || '@empresa.test');
  end loop;
  assert app.org_seats_used('44444444-4444-4444-4444-444444444444') = 4,
    '0037: con una plaza libre, la organizacion tiene 4 ocupadas';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0d000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.invite_member('quinto@empresa.test');   -- la ultima plaza: pasa
  select public.expect_fail($q$select public.invite_member('sexto@empresa.test')$q$,
    '0037: con 5 plazas ocupadas (miembros + pendientes) no se puede invitar a nadie mas');
commit;

do $$
begin
  assert app.org_seats_used('44444444-4444-4444-4444-444444444444') = 5, '0037: exactamente 5, nunca 6';
  raise notice 'OK · 0037: el limite de 5 cuenta las pendientes';
end
$$;

-- 5 · Reenviar: solo una EXPIRADA, y respeta el limite (una caducada no ocupaba plaza).
update public.member_invitations
   set sent_at = now() - interval '8 days', expires_at = now() - interval '1 day'
 where email = 'quinto@empresa.test';

select id as inv_caducada from public.member_invitations where email = 'quinto@empresa.test' \gset

do $$
begin
  assert (select status from public.member_invitation_list where email = 'quinto@empresa.test') = 'Expirada',
    '0037: pasado el plazo la invitacion sale Expirada sin que nadie la toque';
  assert (select days_left from public.member_invitation_list where email = 'quinto@empresa.test') is null,
    '0037: y una expirada no tiene dias restantes';
  assert app.org_seats_used('44444444-4444-4444-4444-444444444444') = 4,
    '0037: una expirada libera su plaza';
  raise notice 'OK · 0037: la expiracion es un hecho del reloj y libera la plaza';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0d000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(format('select public.resend_invitation(%L)', :'inv_id'),
    '0037: no se reenvia una invitacion vigente');
  select public.resend_invitation(:'inv_caducada'::uuid);
commit;

do $$
begin
  assert (select status from public.member_invitation_list where email = 'quinto@empresa.test') = 'Pendiente',
    '0037: reenviar la deja Pendiente';
  assert (select days_left from public.member_invitation_list where email = 'quinto@empresa.test') = 7,
    '0037: con 7 dias otra vez';
  assert app.org_seats_used('44444444-4444-4444-4444-444444444444') = 5, '0037: y vuelve a ocupar plaza';
  raise notice 'OK · 0037: reenviar renueva la MISMA fila';
end
$$;

-- Reenviar respeta el limite: se caduca otra vez, se ocupa su plaza con otra
-- invitacion y ya no cabe.
update public.member_invitations
   set sent_at = now() - interval '8 days', expires_at = now() - interval '1 day'
 where email = 'quinto@empresa.test';
insert into public.member_invitations (org_id, email)
values ('44444444-4444-4444-4444-444444444444', 'ocupa@empresa.test');

begin;
  select set_config('request.jwt.claim.sub', '0d000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(format('select public.resend_invitation(%L)', :'inv_caducada'),
    '0037: reenviar una caducada con la organizacion llena falla (INVT-01 §3)');
commit;

-- 6 · Otro ADMIN no ve ni toca las de Alpha.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  do $$
  begin
    assert (select count(*) from public.member_invitation_list) = 0,
      '0037: el ADMIN de otra organizacion no ve ninguna invitacion de Delta';
    assert (select count(*) from public.member_invitations) = 0,
      '0037: ni por la tabla';
    raise notice 'OK · 0037: las invitaciones de una organizacion no se ven desde otra';
  end
  $$;

  select public.expect_fail(format('select public.resend_invitation(%L)', :'inv_caducada'),
    '0037: otro ADMIN no reenvia una invitacion ajena');
  select public.expect_fail($q$select public.remove_member('0d000002-0000-0000-0000-000000000002')$q$,
    '0037: ni revoca a un miembro ajeno');
commit;

-- 7 · Un ADMIN no puede escribir la tabla directamente (solo por las funciones).
--     Catalogo, por lo mismo que en el punto 2.
do $$
begin
  assert has_table_privilege('authenticated', 'public.member_invitations', 'select'),
    '0037: el ancla positiva -- authenticated SI lee member_invitations (la RLS acota a su ADMIN)';
  assert not has_table_privilege('authenticated', 'public.member_invitations', 'insert'),
    '0037: el cliente no inserta invitaciones a mano';
  assert not has_table_privilege('authenticated', 'public.member_invitations', 'update'),
    '0037: ni alarga su caducidad';
  assert not has_table_privilege('authenticated', 'public.member_invitations', 'delete'),
    '0037: ni las borra';
  raise notice 'OK · 0037: el cliente solo lee; escribe el servidor';
end
$$;

-- 8 · Revocar: solo un Editor de la propia organizacion, nunca uno mismo, y sin
--     tocar la clave.
begin;
  select set_config('request.jwt.claim.sub', '0d000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  select public.expect_fail($q$select public.remove_member('0d000001-0000-0000-0000-000000000001')$q$,
    '0037: el ADMIN no se elimina a si mismo');
  select public.expect_fail($q$select public.remove_member('0b000001-0000-0000-0000-000000000001')$q$,
    '0037: ni a un miembro de otra organizacion');
  select public.expect_fail($q$select public.remove_member('00000000-0000-0000-0000-00000000dead')$q$,
    '0037: ni a alguien que no existe');

  select public.remove_member('0d000002-0000-0000-0000-000000000002');
  select public.expect_fail($q$select public.remove_member('0d000002-0000-0000-0000-000000000002')$q$,
    '0037: revocar dos veces falla: ya no tiene acceso');
commit;

do $$
begin
  assert (select state from public.members where id = '0d000002-0000-0000-0000-000000000002') = 'CANCELLED',
    '0037: revocar deja al miembro CANCELLED';
  assert (select public_key from public.members where id = '0d000002-0000-0000-0000-000000000002')
       = decode('0909090909090909090909090909090909090909090909090909090909090909', 'hex'),
    '0037: y su clave publica intacta (user-revocation)';
  raise notice 'OK · 0037: revocar cancela el acceso y no toca la clave';
end
$$;

-- El miembro revocado deja de poder leer lo suyo en el acto: `is_active_member()`
-- exige `state = ACTIVE`, y toda la RLS pasa por ahi.
begin;
  select set_config('request.jwt.claim.sub', '0d000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  begin
    assert not app.is_active_member(), '0037: un miembro revocado deja de ser miembro activo en el acto';
    raise notice 'OK · 0037: el revocado pierde el acceso en el acto';
  end
  $$;
commit;

-- Terreno devuelto: se borra lo que este bloque creo (Alpha y Beta no se han tocado).
delete from public.members where org_id = '44444444-4444-4444-4444-444444444444';
delete from public.organizations where id = '44444444-4444-4444-4444-444444444444';   -- arrastra las invitaciones (on delete cascade)
delete from auth.users where id in ('0d000001-0000-0000-0000-000000000001', '0d000002-0000-0000-0000-000000000002', '0d0000aa-0000-0000-0000-0000000000aa');

select 1 / (case when not exists (select 1 from public.member_invitations where org_id = '44444444-4444-4444-4444-444444444444') then 1 else 0 end) as terreno_como_estaba;

-- -----------------------------------------------------------------------------
-- 0038 · bienvenida del ADMIN y alta de usuarios adicionales (REG-09, FRU)
-- -----------------------------------------------------------------------------
-- Organizacion PROPIA (Echo Test): su ADMIN e1 esta en KEY_ACTIVE, que es donde REG-09
-- lo encuentra. Se mide que ESE estado puede consultar sus plazas, comprobar emails y
-- activarse, que un Editor y `anon` no, y que el alta respeta el limite de 5.
insert into public.organizations (id, name, country, continent, status)
values ('77777777-7777-7777-7777-777777777777', 'Echo Test', 'PT', 'EU', 'APPROVED');

insert into auth.users (id, email) values
  ('1e000001-0000-0000-0000-000000000001', 'e1@echo.test'),
  ('1e000002-0000-0000-0000-000000000002', 'e2@echo.test'),
  ('1e000003-0000-0000-0000-000000000003', 'e3@echo.test'),
  ('1e000004-0000-0000-0000-000000000004', 'e4@echo.test'),
  ('1e000005-0000-0000-0000-000000000005', 'e5@echo.test'),
  ('1e000006-0000-0000-0000-000000000006', 'e6@echo.test');

insert into public.members (id, org_id, email, state)
values ('1e000001-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'e1@echo.test', 'KEY_ACTIVE');

do $$
begin
  assert (select role || '/' || state from public.members where id = '1e000001-0000-0000-0000-000000000001') = 'ADMIN/KEY_ACTIVE',
    '0038: el ancla -- e1 es ADMIN en KEY_ACTIVE';
  raise notice 'OK · 0038: ancla -- Echo tiene un ADMIN en KEY_ACTIVE';
end
$$;

-- 1 · El ADMIN KEY_ACTIVE consulta sus plazas y comprueba emails (no es ACTIVE).
begin;
  select set_config('request.jwt.claim.sub', '1e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert public.onboarding_seats_used() = 1, '0038: un ADMIN recien llegado ocupa 1 plaza';
    assert not app.is_active_member(), '0038: y sigue sin ser miembro activo (es lo que hace necesaria la funcion)';
    assert public.email_has_account('E1@echo.test'), '0038: email_has_account funciona desde KEY_ACTIVE';
    assert not public.email_has_account('libre@echo.test'), '0038: y dice que no a uno libre';
    raise notice 'OK · 0038: un ADMIN KEY_ACTIVE ve sus plazas y comprueba emails';
  end
  $$;
commit;

-- 2 · El alta: solo service_role, con el limite de 5, y entra como EDITOR REGISTERED.
do $$
begin
  assert not has_function_privilege('anon', 'public.add_registered_member(uuid,uuid,text,text)', 'execute'),
    '0038: anon no da de alta a nadie';
  assert not has_function_privilege('authenticated', 'public.add_registered_member(uuid,uuid,text,text)', 'execute'),
    '0038: ni un miembro autenticado: solo la Edge Function (service_role)';
  assert has_function_privilege('service_role', 'public.add_registered_member(uuid,uuid,text,text)', 'execute'),
    '0038: el ancla positiva -- service_role SI la ejecuta';
  assert not has_function_privilege('anon', 'public.onboarding_seats_used()', 'execute'), '0038: anon no ve plazas';
  assert not has_function_privilege('anon', 'public.activate_own_membership()', 'execute'), '0038: anon no activa';
  assert not has_function_privilege('authenticated', 'app.is_onboarding_admin()', 'execute'),
    '0038: la puerta es interna';
  assert has_function_privilege('authenticated', 'public.onboarding_seats_used()', 'execute'),
    '0038: el ancla positiva -- authenticated SI ve sus plazas';
  raise notice 'OK · 0038: privilegios leidos del catalogo';
end
$$;

select public.add_registered_member('1e000002-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', '  E2@Echo.TEST ', '  Eva Dos ');

do $$
declare v record;
begin
  select * into v from public.members where id = '1e000002-0000-0000-0000-000000000002';
  assert v.role = 'EDITOR' and v.state = 'REGISTERED', '0038: el alta es EDITOR/REGISTERED, no ' || v.role || '/' || v.state;
  assert v.email = 'e2@echo.test' and v.full_name = 'Eva Dos', '0038: con email y nombre normalizados';
  assert v.visibility_scope = 'OWN', '0038: y con el alcance mas estrecho';
  assert app.org_seats_used('77777777-7777-7777-7777-777777777777') = 2, '0038: ocupa plaza';
  raise notice 'OK · 0038: add_registered_member crea un EDITOR REGISTERED';
end
$$;

select public.add_registered_member('1e000003-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777777', 'e3@echo.test', 'Eva Tres');
select public.add_registered_member('1e000004-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777777', 'e4@echo.test', 'Eva Cuatro');
select public.add_registered_member('1e000005-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777777', 'e5@echo.test', 'Eva Cinco');

select public.expect_fail(
  $q$select public.add_registered_member('1e000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'e6@echo.test', 'Eva Seis')$q$,
  '0038: con 5 plazas ocupadas no se da de alta a nadie mas');
select public.expect_fail(
  $q$select public.add_registered_member('1e000002-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 'e2@echo.test', 'Otra vez')$q$,
  '0038: y el mismo usuario no se da de alta dos veces');

-- 3 · Un Editor REGISTERED no consulta plazas, ni comprueba emails, ni se activa.
begin;
  select set_config('request.jwt.claim.sub', '1e000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail($q$select public.onboarding_seats_used()$q$, '0038: un Editor no consulta las plazas');
  select public.expect_fail($q$select public.email_has_account('x@echo.test')$q$, '0038: ni comprueba emails');
  select public.expect_fail($q$select public.activate_own_membership()$q$, '0038: ni se activa a si mismo');
commit;

-- 4 · Activarse: el ADMIN KEY_ACTIVE pasa a ACTIVE, una sola vez, y sin tocar nada mas.
begin;
  select set_config('request.jwt.claim.sub', '1e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.activate_own_membership();
  select public.expect_fail($q$select public.activate_own_membership()$q$,
    '0038: activarse dos veces falla: ya no esta pendiente');
commit;

do $$
begin
  assert (select state from public.members where id = '1e000001-0000-0000-0000-000000000001') = 'ACTIVE',
    '0038: la activacion deja al ADMIN ACTIVE';
  assert (select state from public.members where id = '1e000002-0000-0000-0000-000000000002') = 'REGISTERED',
    '0038: y a los demas como estaban';
  raise notice 'OK · 0038: activate_own_membership pasa KEY_ACTIVE a ACTIVE una vez';
end
$$;

-- El cliente sigue sin poder mover su estado a mano (member-state-machine).
begin;
  select set_config('request.jwt.claim.sub', '1e000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_denied($q$update public.members set state = 'ACTIVE' where id = '1e000002-0000-0000-0000-000000000002'$q$,
    '0038: un Editor REGISTERED no se activa por UPDATE directo');
commit;

-- -----------------------------------------------------------------------------
-- 0039 · la lectura exige ser miembro ACTIVE (F-222)
-- -----------------------------------------------------------------------------
-- El test de 0037 medio la FUNCION (`not app.is_active_member()`) y no la LECTURA, y por
-- eso no vio que siete politicas SELECT no la llamaban. Este bloque mide la lectura, con
-- datos propios en TODAS las tablas: una organizacion Foxtrot con un ADMIN ACTIVE (f1) y un
-- Editor (f2) que primero esta REGISTERED y despues CANCELLED. Foxtrot tiene inventario,
-- una exclusion, un hilo con Alpha, un elemento de hilo, una clave envuelta PARA f2 (lo que
-- conserva un revocado) y un favorito de f2. f2 tiene que leer CERO de todo ello y solo su
-- propia fila de `members`; f1 sigue leyendo lo de siempre.
create function public.f222_lecturas() returns text
language sql stable as $$
  select concat_ws(',',
    (select count(*) from public.inventory_lines),
    (select count(*) from public.inventory_exclusions),
    (select count(*) from public.threads),
    (select count(*) from public.thread_items),
    (select count(*) from public.thread_item_keys),
    (select count(*) from public.favorite_distributors));
$$;
grant execute on function public.f222_lecturas() to authenticated;

insert into public.organizations (id, name, country, continent, status)
values ('66666666-6666-6666-6666-666666666666', 'Foxtrot Test', 'IT', 'EU', 'APPROVED');

insert into auth.users (id, email) values
  ('3f000001-0000-0000-0000-000000000001', 'f1@foxtrot.test'),
  ('3f000002-0000-0000-0000-000000000002', 'f2@foxtrot.test');

insert into public.members (id, org_id, email, state)
values ('3f000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'f1@foxtrot.test', 'ACTIVE');
insert into public.members (id, org_id, email, state)
values ('3f000002-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'f2@foxtrot.test', 'REGISTERED');

insert into public.inventory_lines
  (id, org_id, part_number, brand, quantity, location_country, product_family, status)
values ('3f100000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666',
        'F-6205', 'SKF', 10, 'IT', 'Rodamiento rigido de bolas', 'PUBLISHED');

insert into public.inventory_exclusions (owner_org_id, excluded_continent)
values ('66666666-6666-6666-6666-666666666666', 'NA');

insert into public.threads (id, org_low_id, org_high_id, created_by_org_id)
select '3f200000-0000-0000-0000-000000000001',
       least(o.org_id, '66666666-6666-6666-6666-666666666666'::uuid),
       greatest(o.org_id, '66666666-6666-6666-6666-666666666666'::uuid),
       '66666666-6666-6666-6666-666666666666'::uuid   -- crea Foxtrot: el tope de 25 hilos/dia es por organizacion creadora
  from (select org_id from public.members where id = '0a000001-0000-0000-0000-000000000001') o;

insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, inventory_line_id, estado_consulta, content_ciphertext, content_iv)
select '3f300000-0000-0000-0000-000000000001', '3f200000-0000-0000-0000-000000000001',
       m.org_id, m.id, 'CONSULTA', 'F-6205', 'SKF',
       '3f100000-0000-0000-0000-000000000001', 'Pendiente',
       decode(repeat('aa', 64), 'hex'), decode(repeat('04', 12), 'hex')
  from public.members m where m.id = '0a000001-0000-0000-0000-000000000001';

insert into public.thread_item_keys (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
values ('3f300000-0000-0000-0000-000000000001', '3f000002-0000-0000-0000-000000000002',
        decode(repeat('11', 48), 'hex'), decode(repeat('07', 12), 'hex'), decode(repeat('22', 32), 'hex'));

insert into public.favorite_distributors (member_id, distributor_org_id)
values ('3f000002-0000-0000-0000-000000000002', (select org_id from public.members where id = '0a000001-0000-0000-0000-000000000001'));

-- 1 · f1 (ADMIN ACTIVE) lee todo lo suyo.
begin;
  select set_config('request.jwt.claim.sub', '3f000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines where org_id = '66666666-6666-6666-6666-666666666666') = 1,
      '0039: un ADMIN ACTIVE lee el inventario de su organizacion';
    assert (select count(*) from public.inventory_exclusions where owner_org_id = '66666666-6666-6666-6666-666666666666') = 1,
      '0039: sus exclusiones';
    assert (select count(*) from public.threads where id = '3f200000-0000-0000-0000-000000000001') = 1, '0039: sus hilos';
    assert (select count(*) from public.thread_items where id = '3f300000-0000-0000-0000-000000000001') = 1, '0039: sus elementos de hilo';
    assert (select count(*) from public.members where org_id = '66666666-6666-6666-6666-666666666666') = 2,
      '0039: y los dos miembros de su organizacion, tambien el aun REGISTERED';
    raise notice 'OK · 0039: un miembro ACTIVE lee lo de siempre';
  end
  $$;
commit;

-- 2 · f2 REGISTERED: solo su propia fila, y cero en las seis tablas.
begin;
  select set_config('request.jwt.claim.sub', '3f000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  begin
    assert not app.is_active_member(), '0039: el ancla -- f2 no es miembro activo';
    assert (select count(*) from public.members) = 1, '0039: un REGISTERED lee solo UNA fila de members';
    assert (select count(*) from public.members where id = auth.uid()) = 1, '0039: la suya (session.ts la necesita)';
    assert public.f222_lecturas() = '0,0,0,0,0,0',
      '0039: un REGISTERED lee cero de inventario, exclusiones, hilos, elementos, claves y favoritos: ' || public.f222_lecturas();
    raise notice 'OK · 0039: un REGISTERED no lee nada de su organizacion';
  end
  $$;
commit;

-- 3 · f2 CANCELLED (revocado): lo mismo, aunque conserve sesion Y su clave envuelta.
update public.members set state = 'CANCELLED' where id = '3f000002-0000-0000-0000-000000000002';
do $$
begin
  assert (select count(*) from public.thread_item_keys where recipient_member_id = '3f000002-0000-0000-0000-000000000002') = 1,
    '0039: el ancla -- la clave envuelta de f2 existe (user-revocation no la toca)';
end
$$;
begin;
  select set_config('request.jwt.claim.sub', '3f000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.members) = 1,
      '0039: un CANCELLED lee solo su propia fila de members (para que la app le diga que esta revocado)';
    assert public.f222_lecturas() = '0,0,0,0,0,0',
      '0039: un CANCELLED lee cero de las seis tablas, aunque conserve su clave: ' || public.f222_lecturas();
    raise notice 'OK · 0039: un CANCELLED no lee nada de su organizacion ni descifra su historial';
  end
  $$;
commit;

-- Terreno devuelto.
delete from public.thread_item_keys where item_id = '3f300000-0000-0000-0000-000000000001';
delete from public.thread_items where id = '3f300000-0000-0000-0000-000000000001';
delete from public.threads where id = '3f200000-0000-0000-0000-000000000001';
delete from public.favorite_distributors where member_id = '3f000002-0000-0000-0000-000000000002';
delete from public.inventory_exclusions where owner_org_id = '66666666-6666-6666-6666-666666666666';
delete from public.inventory_lines where org_id = '66666666-6666-6666-6666-666666666666';
delete from public.members where org_id = '66666666-6666-6666-6666-666666666666';
delete from public.organizations where id = '66666666-6666-6666-6666-666666666666';
delete from auth.users where id in ('3f000001-0000-0000-0000-000000000001', '3f000002-0000-0000-0000-000000000002');
drop function public.f222_lecturas();

-- -----------------------------------------------------------------------------
-- 0028 · la cola de solicitudes solo la ve y la decide el Operador
-- -----------------------------------------------------------------------------
-- ADMIN-01 estrena un actor que el esquema no tenia: alguien sin organizacion
-- que decide sobre organizaciones que todavia no existen. Todo lo que sigue
-- comprueba las dos mitades de eso -- que el Operador puede, y que un miembro
-- normal no -- mas la maquina de estados y la firma de la decision.
--
-- ⚠ Y una de las comprobaciones es de las que no fallan solas: un UPDATE que la
-- RLS no deja pasar NO da error, afecta a cero filas. Por eso el aserto lee la
-- fila DESPUES en vez de esperar una excepcion: es la forma de F-148, y aqui se
-- mide a proposito.

-- Un operador (como postgres: el operador lo da de alta la plataforma) y una
-- solicitud en cola. La solicitud entra por `service_role`/postgres porque
-- ninguna politica de INSERT existe para nadie mas -- el FSR es de REG-00.
insert into auth.users (id, email) values
  ('0e000001-0000-0000-0000-000000000001', 'operador@plataforma.test');
insert into public.platform_operators (id, full_name) values
  ('0e000001-0000-0000-0000-000000000001', 'Operadora de Plataforma');

insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, applicant_phone, website, submitted_at)
values
  ('11110000-0000-4000-8000-000000000001', 'Distribuciones Alvarez SL', 'ES',
   'Juan Alvarez Garcia', 'jalvarez@distribalvarez.test', '+34 91 234 56 78', null,
   now() - interval '52 hours');

do $$
begin
  assert (select count(*) from public.registration_request_events
           where request_id = '11110000-0000-4000-8000-000000000001') = 1,
    '0028: el disparador escribe la fila de historial del envio del FSR';
  assert (select state from public.registration_request_events
           where request_id = '11110000-0000-4000-8000-000000000001') = 'PENDING_REVIEW',
    '0028: y nace en PENDING_REVIEW';
  raise notice 'OK · 0028: el historial lo escribe la base desde el primer momento';
end
$$;

-- 1 · Un miembro normal de una organizacion no ve NADA de la cola.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.registration_requests) = 0,
      '0028: un ADMIN de organizacion no ve la cola de solicitudes';
    assert (select count(*) from public.registration_request_events) = 0,
      '0028: ni el historial';
    assert (select count(*) from public.platform_operators) = 0,
      '0028: ni quienes son los operadores';
    raise notice 'OK · 0028: la cola es invisible para quien no es Operador';
  end
  $$;

  -- Y tampoco la puede decidir. ⚠ Esto NO lanza excepcion: la politica de
  -- UPDATE simplemente no le aplica y el UPDATE afecta a cero filas.
  update public.registration_requests set state = 'INVITED_APPROVED'
   where id = '11110000-0000-4000-8000-000000000001';
commit;

do $$
begin
  assert (select state from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000001') = 'PENDING_REVIEW',
    '0028: el UPDATE de un no-Operador no cambio nada -- y no dio error, que es lo que hay que medir';
  raise notice 'OK · 0028: un no-Operador no decide, y su intento pasa en silencio (por eso se lee la fila)';
end
$$;

-- 2 · El Operador si la ve, y la aprueba.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  do $$
  begin
    assert (select count(*) from public.registration_requests) = 1,
      '0028: ANCLA POSITIVA -- el Operador si ve la cola';
    raise notice 'OK · 0028: el Operador ve la cola';
  end
  $$;

  -- Intenta ademas firmar la decision a nombre de otro y con otra fecha: la base
  -- lo tiene que pisar con quien llama y cuando.
  update public.registration_requests
     set state = 'INVITED_APPROVED',
         decided_by = null,
         decided_at = '2020-01-01T00:00:00Z'
   where id = '11110000-0000-4000-8000-000000000001';
commit;

do $$
begin
  assert (select state from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000001') = 'INVITED_APPROVED',
    '0028: el Operador aprueba';
  assert (select decided_by from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000001')
         = '0e000001-0000-0000-0000-000000000001',
    '0028: la firma la pone la base con quien llama, no el cliente';
  assert (select decided_at from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000001') > now() - interval '1 minute',
    '0028: y la fecha es la de ahora, no la que mando el cliente';
  assert (select count(*) from public.registration_request_events
           where request_id = '11110000-0000-4000-8000-000000000001') = 2,
    '0028: el historial gana su segunda fila';
  raise notice 'OK · 0028: aprobar firma con quien llama y deja rastro';
end
$$;

-- 3 · Una transicion que la maquina de estados no permite.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    'update public.registration_requests set state = ''REJECTED'', rejection_reason = ''se rechaza tarde'' where id = ''11110000-0000-4000-8000-000000000001''',
    '0028: una solicitud ya aprobada no se puede rechazar despues');
commit;

-- 4 · Rechazo: sin motivo no, con motivo si, y el historial lo guarda.
insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, submitted_at)
values
  ('11110000-0000-4000-8000-000000000002', 'Nordic Bearings AB', 'SE',
   'Sven Nordic', 'info@nordicbearings.test', now() - interval '18 hours');

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;

  select public.expect_fail(
    'update public.registration_requests set state = ''REJECTED'' where id = ''11110000-0000-4000-8000-000000000002''',
    '0028: rechazar sin motivo no se puede');

  select public.expect_fail(
    'update public.registration_requests set state = ''REJECTED'', rejection_reason = ''corto'' where id = ''11110000-0000-4000-8000-000000000002''',
    '0028: ni con un motivo de menos de diez caracteres');

  update public.registration_requests
     set state = 'REJECTED', rejection_reason = 'Sin actividad comprobable en el sector.'
   where id = '11110000-0000-4000-8000-000000000002';
commit;

do $$
begin
  assert (select note from public.registration_request_events
           where request_id = '11110000-0000-4000-8000-000000000002'
             and state = 'REJECTED') = 'Sin actividad comprobable en el sector.',
    '0028: el motivo del rechazo queda en el historial, que es lo que el panel lateral enseña';
  raise notice 'OK · 0028: el rechazo exige motivo y el motivo se guarda';
end
$$;

-- 5 · `Volver a revision` limpia el motivo y la firma.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  update public.registration_requests set state = 'PENDING_REVIEW'
   where id = '11110000-0000-4000-8000-000000000002';
commit;

do $$
begin
  assert (select rejection_reason from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000002') is null,
    '0028: al volver a revision el motivo NO se queda pegado';
  assert (select decided_by from public.registration_requests
           where id = '11110000-0000-4000-8000-000000000002') is null,
    '0028: ni la firma de la decision que ya no existe';
  raise notice 'OK · 0028: volver a revision devuelve la solicitud limpia a la cola';
end
$$;

-- 6 · El historial no se escribe a mano, ni siquiera siendo Operador.
--
-- Se comprueba con el catalogo de privilegios y no intentando el INSERT, y es a
-- proposito: el intento falla con `42501 permission denied`, que es un fallo de
-- GRANT y no de politica, y `expect_fail` lo clasifica -- con razon -- como test
-- roto. La invariante que importa no es "que error sale": es que NADIE
-- autenticado tiene con que escribir esta tabla ni con que insertar en la cola.
-- Lo escribe el disparador `security definer`, y punto.
do $$
declare
  sobran text;
begin
  select string_agg(privilege_type || ' en ' || table_name, ', ' order by table_name || privilege_type)
    into sobran
    from information_schema.role_table_grants
   where grantee = 'authenticated'
     and table_schema = 'public'
     and (
       (table_name = 'registration_request_events' and privilege_type in ('INSERT','UPDATE','DELETE'))
       or (table_name = 'registration_requests' and privilege_type in ('INSERT','DELETE'))
       or (table_name = 'platform_operators' and privilege_type in ('INSERT','UPDATE','DELETE'))
     );

  assert sobran is null,
    '0028: authenticated tiene privilegios de escritura que no deberia: ' || coalesce(sobran, '');
  raise notice 'OK · 0028: nadie autenticado puede escribir el historial ni insertar en la cola';
end
$$;

-- 7 · El Operador ve la cola y NADA MAS.
--
-- Es la mitad que nadie comprueba de un actor privilegiado. El Operador entra
-- con credenciales propias y decide sobre organizaciones, asi que la pregunta
-- interesante no es que puede ver -- eso ya se ha probado arriba -- sino que NO
-- puede: no pertenece a ninguna organizacion, y todo lo comercial de este
-- producto cuelga de pertenecer a una. El dia que alguien escriba una politica
-- con `authenticated` a secas donde iba `app.is_active_member()`, el Operador
-- empezaria a ver inventario ajeno y hilos cifrados sin que nada fallara.
--
-- Comprobado ademas contra las dos bases reales el 11-sep-2026, con la cuenta de
-- Operador ya creada: 0 lineas de inventario, 0 hilos, 0 elementos, 0 categorias
-- de foro y 3 solicitudes.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.inventory_lines) = 0,
      '0028: el Operador no ve inventario de nadie -- no pertenece a ninguna organizacion';
    assert (select count(*) from public.threads) = 0,
      '0028: ni un solo hilo cifrado';
    assert (select count(*) from public.thread_items) = 0,
      '0028: ni un solo elemento de hilo';
    assert (select count(*) from public.forum_categories) = 0,
      '0028: ni el foro, que exige ser miembro activo aunque sea publico';
    assert (select count(*) from public.registration_requests) > 0,
      '0028: ANCLA POSITIVA -- pero la cola SI la ve, o esto estaria midiendo que no ve nada de nada';
    raise notice 'OK · 0028: el Operador ve la cola y nada mas';
  end
  $$;
commit;

-- 7 · Y `anon` no tiene ni un privilegio sobre las tres tablas nuevas.
do $$
declare
  abiertas text;
begin
  select string_agg(distinct table_name, ', ' order by table_name) into abiertas
    from information_schema.role_table_grants
   where grantee = 'anon'
     and table_schema = 'public'
     and table_name in ('platform_operators','registration_requests','registration_request_events');

  assert abiertas is null,
    '0028: anon tiene privilegios sobre la cola de solicitudes: ' || coalesce(abiertas, '');
  raise notice 'OK · 0028: anon no tiene ni un privilegio sobre las tres tablas nuevas';
end
$$;

-- -----------------------------------------------------------------------------
-- 0029 · el foro: publico para la comunidad, firmado por la base
-- -----------------------------------------------------------------------------
-- El foro es la unica parte NO cifrada del producto, asi que lo que aqui se
-- comprueba no es que nadie lea: es que lea **todo miembro activo** y que nadie
-- pueda publicar a nombre de otro. Lo segundo importa mas justamente porque el
-- contenido se lee en claro.

do $$
begin
  assert (select count(*) from public.forum_categories) = 4,
    '0029: las cuatro categorias de lanzamiento vienen en la migracion, no en la siembra';
  assert (select string_agg(slug, ',' order by position) from public.forum_categories)
         = 'general,referencias-tecnicas,logistica-y-aduanas,plataforma-y-soporte',
    '0029: y en el orden que fija el producto, no el alfabetico';
  raise notice 'OK · 0029: las cuatro categorias, en su orden';
end
$$;

-- Dos hilos y tres publicaciones, sembrados como postgres (el disparador de
-- firma se aparta para el operador, como en toda la siembra).
insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id, created_at, last_post_at)
select '22220000-0000-4000-8000-00000000bbb1',
       (select id from public.forum_categories where slug = 'general'),
       'Bienvenidos al foro', :a1, :orgA, now() - interval '3 days', now() - interval '3 days';

insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id, created_at, last_post_at)
select '22220000-0000-4000-8000-00000000bbb2',
       (select id from public.forum_categories where slug = 'logistica-y-aduanas'),
       'Aranceles a Marruecos', :b1, :orgB, now() - interval '2 hours', now() - interval '2 hours';

insert into public.forum_posts (thread_id, author_member_id, author_org_id, body, created_at) values
  ('22220000-0000-4000-8000-00000000bbb1', :a1, :orgA, 'Primer mensaje.',  now() - interval '3 days'),
  ('22220000-0000-4000-8000-00000000bbb1', :b1, :orgB, 'Segundo mensaje.', now() - interval '1 day'),
  ('22220000-0000-4000-8000-00000000bbb2', :b1, :orgB, 'Tercer mensaje.',  now() - interval '2 hours');

do $$
begin
  assert (select last_post_at from public.forum_threads
           where id = '22220000-0000-4000-8000-00000000bbb1') > now() - interval '2 days',
    '0029: publicar mueve el reloj del hilo -- lo que ordena la lista de recientes';
  raise notice 'OK · 0029: el reloj del hilo lo mueve la publicacion, no el cliente';
end
$$;

-- 1 · Los contadores de la tarjeta, que es lo que la pantalla pinta.
do $$
declare
  hilos_general int;
  pubs_general  int;
begin
  select thread_count, post_count into hilos_general, pubs_general
    from public.forum_category_stats where slug = 'general';

  assert hilos_general = 1, '0029: la categoria General cuenta su hilo';
  assert pubs_general = 2,  '0029: y sus dos publicaciones';
  assert (select thread_count from public.forum_category_stats where slug = 'plataforma-y-soporte') = 0,
    '0029: una categoria vacia cuenta cero, no desaparece de la rejilla';
  assert (select last_activity_at from public.forum_category_stats where slug = 'logistica-y-aduanas')
         > (select last_activity_at from public.forum_category_stats where slug = 'general'),
    '0029: la ultima actividad distingue una categoria de otra';
  raise notice 'OK · 0029: los contadores de la tarjeta salen calculados y una categoria vacia sigue estando';
end
$$;

-- 2 · Un miembro activo lo ve todo; quien no es miembro, nada.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.forum_categories) = 4,
      '0029: ANCLA POSITIVA -- un miembro activo ve las cuatro categorias';
    assert (select count(*) from public.forum_posts) = 3,
      '0029: y las publicaciones de todas las organizaciones, que para eso es publico';
    assert (select count(*) from public.forum_category_stats) = 4,
      '0029: y la vista de contadores';
    raise notice 'OK · 0029: el foro es publico para cualquier miembro activo';
  end
  $$;
commit;

-- Un usuario autenticado SIN fila en `members` no es miembro de nada.
insert into auth.users (id, email) values
  ('0f000001-0000-0000-0000-000000000001', 'sinorg@nadie.test');

begin;
  select set_config('request.jwt.claim.sub', '0f000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.forum_categories) = 0,
      '0029: quien no es miembro no ve el foro';
    assert (select count(*) from public.forum_category_stats) = 0,
      '0029: y la vista NO se salta la RLS de sus tablas -- es el security_invoker';
    raise notice 'OK · 0029: la vista de contadores respeta la RLS de quien consulta';
  end
  $$;
commit;

-- 3 · La firma la pone la base: se publica a nombre propio aunque se mande otro.
begin;
  select set_config('request.jwt.claim.sub', :b1, true);
  set local role authenticated;

  insert into public.forum_posts (thread_id, author_member_id, author_org_id, body)
  values ('22220000-0000-4000-8000-00000000bbb1',
          '0a000001-0000-0000-0000-000000000001',   -- a1: NO es quien llama
          '11111111-1111-1111-1111-111111111111',   -- orgA: tampoco es su organizacion
          'Publicado con la firma de otro, a ver.');
commit;

do $$
declare
  quien uuid;
  org   uuid;
begin
  select author_member_id, author_org_id into quien, org
    from public.forum_posts
   where body = 'Publicado con la firma de otro, a ver.';

  assert quien = '0b000001-0000-0000-0000-000000000001',
    '0029: el autor es quien llama, no el que venia en el INSERT';
  assert org = '22222222-2222-2222-2222-222222222222',
    '0029: y la organizacion, la suya -- publicar a nombre de otra es lo peor que puede pasar en el unico sitio sin cifrar';
  raise notice 'OK · 0029: la firma de una publicacion la pone la base';
end
$$;

-- 4 · No hay moderacion todavia, y eso se nota en los privilegios.
do $$
declare
  sobran text;
begin
  select string_agg(privilege_type || ' en ' || table_name, ', ' order by table_name || privilege_type)
    into sobran
    from information_schema.role_table_grants
   where grantee in ('authenticated','anon')
     and table_schema = 'public'
     and table_name in ('forum_categories','forum_threads','forum_posts','forum_category_stats')
     and (grantee = 'anon' or privilege_type in ('UPDATE','DELETE','TRUNCATE'));

  assert sobran is null,
    '0029: privilegios que no deberia haber en el foro: ' || coalesce(sobran, '');
  raise notice 'OK · 0029: nadie edita ni borra en el foro, y anon no tiene nada';
end
$$;

-- -----------------------------------------------------------------------------
-- 0030 · reacciones del foro y la lista de hilos de FORO-02
-- -----------------------------------------------------------------------------
-- En este punto `bbb1` tiene TRES publicaciones (las dos sembradas arriba y la
-- de "la firma de otro") y `bbb2`, una.

-- 1 · Reaccionar a nombre de otro no se puede: la firma la pone la base.
begin;
  select set_config('request.jwt.claim.sub', :b1, true);
  set local role authenticated;
  insert into public.forum_reactions (post_id, member_id)
  select id, '0a000001-0000-0000-0000-000000000001'   -- a1: NO es quien llama
    from public.forum_posts where body = 'Primer mensaje.';
commit;

do $$
begin
  assert (select member_id from public.forum_reactions r
            join public.forum_posts p on p.id = r.post_id
           where p.body = 'Primer mensaje.') = '0b000001-0000-0000-0000-000000000001',
    '0030: la reaccion es de quien llama, no del member_id que venia en el INSERT';
  raise notice 'OK · 0030: la firma de una reaccion la pone la base';
end
$$;

-- 2 · Una por usuario y publicacion; dos usuarios cuentan dos (Scenario
--     "reacciones independientes"), y se suman todas las del hilo.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  insert into public.forum_reactions (post_id)
  select id from public.forum_posts where body in ('Primer mensaje.', 'Segundo mensaje.');
  select public.expect_fail(
    $$insert into public.forum_reactions (post_id)
      select id from public.forum_posts where body = 'Primer mensaje.'$$,
    '0030: el mismo usuario no reacciona dos veces a la misma publicacion');
commit;

begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  do $$
  begin
    assert (select reply_count from public.forum_thread_list
             where id = '22220000-0000-4000-8000-00000000bbb1') = 2,
      '0030: tres publicaciones son DOS respuestas -- la inicial no cuenta';
    assert (select reaction_count from public.forum_thread_list
             where id = '22220000-0000-4000-8000-00000000bbb1') = 3,
      '0030: las reacciones del hilo son la suma de TODAS sus publicaciones (2 en la inicial + 1 en la segunda)';
    assert (select reply_count from public.forum_thread_list
             where id = '22220000-0000-4000-8000-00000000bbb2') = 0,
      '0030: un hilo sin respuestas cuenta cero, no menos uno';
    assert (select reaction_count from public.forum_thread_list
             where id = '22220000-0000-4000-8000-00000000bbb2') = 0,
      '0030: y sin reacciones, cero';
    assert (select author_org_name from public.forum_thread_list
             where id = '22220000-0000-4000-8000-00000000bbb2') is not null,
      '0030: ANCLA POSITIVA -- la organizacion autora llega con nombre';
    raise notice 'OK · 0030: la lista cuenta respuestas sin la inicial y reacciones de todo el hilo';
  end
  $$;
commit;

-- 3 · Cada uno quita SOLO lo suyo.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  delete from public.forum_reactions
   where post_id = (select id from public.forum_posts where body = 'Primer mensaje.');
commit;

do $$
begin
  assert (select count(*) from public.forum_reactions r
            join public.forum_posts p on p.id = r.post_id
           where p.body = 'Primer mensaje.') = 1,
    '0030: a1 quita su reaccion y la de b1 sigue ahi -- un DELETE sin filtro no borra lo ajeno';
  assert (select member_id from public.forum_reactions r
            join public.forum_posts p on p.id = r.post_id
           where p.body = 'Primer mensaje.') = '0b000001-0000-0000-0000-000000000001',
    '0030: y la que queda es precisamente la de b1';
  raise notice 'OK · 0030: quitar una reaccion solo quita la propia';
end
$$;

-- 4 · Quien no es miembro no ve ni reacciones ni lista.
begin;
  select set_config('request.jwt.claim.sub', '0f000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.forum_reactions) = 0,
      '0030: quien no es miembro no ve reacciones';
    assert (select count(*) from public.forum_thread_list) = 0,
      '0030: y la vista de la lista NO se salta la RLS -- es el security_invoker';
    raise notice 'OK · 0030: reacciones y lista respetan la RLS de quien consulta';
  end
  $$;
commit;

-- 5 · Privilegios: anon nada; authenticated no edita reacciones ni la vista.
do $$
declare
  sobran text;
begin
  select string_agg(grantee || ':' || privilege_type || ' en ' || table_name, ', '
                    order by grantee, table_name, privilege_type)
    into sobran
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('forum_reactions','forum_thread_list')
     and (grantee = 'anon'
          or (grantee = 'authenticated' and privilege_type in ('UPDATE','TRUNCATE','REFERENCES','TRIGGER'))
          or (grantee = 'authenticated' and table_name = 'forum_thread_list' and privilege_type <> 'SELECT'));

  assert sobran is null,
    '0030: privilegios que no deberia haber: ' || coalesce(sobran, '');
  raise notice 'OK · 0030: anon no tiene nada y nadie edita reacciones';
end
$$;

-- -----------------------------------------------------------------------------
-- 0031 · limite de publicaciones por hora (RNG-FORO-06)
-- -----------------------------------------------------------------------------
-- orgA (a1) no tiene NINGUNA publicacion en la hora natural actual todavia:
-- las suyas de la siembra de 0029 son de hace dias, y la unica publicacion
-- "de ahora mismo" hasta este punto (la de "firma de otro", mas arriba) quedo
-- firmada por orgB, no por orgA -- es la propia base la que decide el autor.
-- Partir de cero en orgA evita depender de cuantas lleve ya sembradas orgB.

begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;

  do $$
  declare
    estado record;
  begin
    select * into estado from app.forum_rate_limit_status();
    assert estado.used = 0,
      '0031: orgA no tiene ninguna publicacion en esta hora natural todavia';
    assert estado."limit" = 10,
      '0031: el limite es 10, literal de RNG-FORO-06';
    assert estado.seconds_until_reset > 0 and estado.seconds_until_reset <= 3600,
      '0031: quedan entre 1 segundo y una hora para que cambie la hora natural';
    raise notice 'OK · 0031: el estado se puede consultar ANTES de publicar, para pintar el aviso';
  end
  $$;

  -- Diez publicaciones dentro de la hora: las diez tienen que pasar.
  do $$
  declare
    i int;
  begin
    -- Literales, no :a1/:orgA: psql NO interpola variables dentro de un
    -- cuerpo "do" dolar-entrecomillado -- se descubrio corriendo esto
    -- contra el Postgres desechable (la razon de que este banco exista).
    for i in 1..10 loop
      insert into public.forum_posts (thread_id, author_member_id, author_org_id, body)
      values ('22220000-0000-4000-8000-00000000bbb1',
              '0a000001-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111',
              'Publicacion de limite numero ' || i::text || '.');
    end loop;
  end
  $$;

  do $$
  begin
    assert (select used from app.forum_rate_limit_status()) = 10,
      '0031: diez publicaciones dentro de la misma hora, las diez contadas';
    raise notice 'OK · 0031: diez publicaciones en la hora, todas contadas';
  end
  $$;

  select public.expect_fail(
    $$insert into public.forum_posts (thread_id, author_member_id, author_org_id, body)
      values ('22220000-0000-4000-8000-00000000bbb1', '0a000001-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111', 'La publicacion numero once.')$$,
    '0031: RNG-FORO-06 -- la publicacion numero once en la misma hora se bloquea');
commit;

do $$
begin
  assert (select count(*) from public.forum_posts
           where author_org_id = '11111111-1111-1111-1111-111111111111'
             and created_at >= date_trunc('hour', now())) = 10,
    '0031: el intento numero once no dejo huella -- expect_fail corrio dentro de su propia transaccion y se deshizo';
  raise notice 'OK · 0031: el intento bloqueado no se cuela en el recuento';
end
$$;

-- Reaccionar NO es publicar: a1 ya reacciono a dos publicaciones en el bloque
-- de 0030 y el recuento de arriba (10, ni una mas) no se movio por eso.
do $$
begin
  assert (select count(*) from public.forum_reactions
           where member_id = '0a000001-0000-0000-0000-000000000001') >= 1,
    '0031: (sanity) a1 tiene alguna reaccion puesta desde el bloque de 0030';
  raise notice 'OK · 0031: reaccionar no cuenta para RNG-FORO-06 -- forum_rate_limit_status solo mira forum_posts';
end
$$;

-- Quien no es miembro, no tiene organizacion que consultar.
begin;
  select set_config('request.jwt.claim.sub', '0f000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select used from app.forum_rate_limit_status()) = 0,
      '0031: sin organizacion (app.current_org_id() es NULL), el estado no revienta y cuenta cero';
    raise notice 'OK · 0031: quien no es miembro de ninguna organizacion no rompe la consulta de estado';
  end
  $$;
commit;

-- Privilegios: ninguna funcion nueva la puede ejecutar `anon` -- lo cubre ya
-- el aserto general de F-146 mas abajo, que barre TODO `public`. Las dos
-- funciones de esta migracion viven en `app`, y `anon` no tiene ni USAGE
-- sobre ese esquema (0001): no hace falta revocar EXECUTE una a una.
do $$
begin
  assert not exists (
    select 1 from information_schema.role_usage_grants
     where object_type = 'SCHEMA' and object_name = 'app' and grantee = 'anon'
  ), '0031: anon no deberia tener USAGE sobre el esquema app -- si lo tiene, SI hace falta revocar EXECUTE aqui';
  raise notice 'OK · 0031: anon sigue sin USAGE sobre app; sus funciones son inalcanzables sin tocar nada mas';
end
$$;

-- -----------------------------------------------------------------------------
-- 0032 · el envoltorio publico de RNG-FORO-06, el que SI puede llamar el cliente
-- -----------------------------------------------------------------------------
-- `app.forum_rate_limit_status()` no lo alcanza PostgREST (0032, cabecera):
-- este aserto prueba el camino que de verdad usara `forum.ts`, no el interno.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select used from public.forum_rate_limit_status()) = 10,
      '0032: el envoltorio publico devuelve lo mismo que app.forum_rate_limit_status() -- orgA sigue en 10 desde el bloque de 0031';
    raise notice 'OK · 0032: el cliente puede llamar public.forum_rate_limit_status() con supabase.rpc()';
  end
  $$;
commit;

-- -----------------------------------------------------------------------------
-- 0033 · forum_post_detail -- reacciones POR PUBLICACION, para FORO-03
-- -----------------------------------------------------------------------------
-- En este punto, gracias al bloque de 0031, "Primer mensaje." (bbb1) tiene DOS
-- reacciones (a1 la quito, b1 sigue) y "Segundo mensaje." tiene UNA (a1). Las
-- diez publicaciones de limite de 0031 no tienen ninguna reaccion.
do $$
begin
  assert (select reaction_count from public.forum_post_detail
           where body = 'Primer mensaje.') = 1,
    '0033: "Primer mensaje." tiene la reaccion de b1 -- a1 quito la suya en 0030';
  assert (select reaction_count from public.forum_post_detail
           where body = 'Segundo mensaje.') = 1,
    '0033: "Segundo mensaje." tiene la de a1';
  assert (select reaction_count from public.forum_post_detail
           where body = 'Publicacion de limite numero 1.') = 0,
    '0033: una publicacion sin ninguna reaccion cuenta cero, no NULL';
  raise notice 'OK · 0033: el recuento es POR PUBLICACION, no el total del hilo (eso es forum_thread_list, otra cosa)';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', :b1, true);
  set local role authenticated;
  do $$
  begin
    assert (select reacted_by_me from public.forum_post_detail
             where body = 'Primer mensaje.') = true,
      '0033: b1 SI reacciono a "Primer mensaje." -- reacted_by_me lo dice';
    assert (select reacted_by_me from public.forum_post_detail
             where body = 'Tercer mensaje.') = false,
      '0033: b1 no reacciono a "Tercer mensaje." -- false, no NULL, aunque esa publicacion no tenga ninguna reaccion de nadie';
    raise notice 'OK · 0033: reacted_by_me distingue "reacciono otro", "no reacciono nadie" y "reacciono quien consulta"';
  end
  $$;
commit;

-- Quien no es miembro, no ve nada -- mismo criterio que forum_thread_list.
begin;
  select set_config('request.jwt.claim.sub', '0f000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.forum_post_detail) = 0,
      '0033: quien no es miembro no ve el detalle de ninguna publicacion';
    raise notice 'OK · 0033: forum_post_detail respeta la RLS de quien consulta';
  end
  $$;
commit;

do $$
declare
  sobran text;
begin
  select string_agg(grantee || ':' || privilege_type, ', ' order by grantee, privilege_type)
    into sobran
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'forum_post_detail'
     and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type <> 'SELECT'));

  assert sobran is null,
    '0033: privilegios que no deberia haber en forum_post_detail: ' || coalesce(sobran, '');
  raise notice 'OK · 0033: anon nada, authenticated solo SELECT';
end
$$;

-- -----------------------------------------------------------------------------
-- 0034 · billing y suscripcion (ADMIN-02)
-- -----------------------------------------------------------------------------
-- Dos organizaciones nuevas, para no interferir con orgA/orgB (ya tienen
-- historial del foro por encima). :op1 (0e000001-...) ya es Operador desde
-- el bloque de 0028.

insert into public.organizations (id, name, country, continent, status, created_at) values
  ('66660000-0000-4000-8000-000000000001', 'Timken Europe GmbH', 'DE', 'EU', 'APPROVED', now() - interval '100 days'),
  ('66660000-0000-4000-8000-000000000002', 'Nordic Bearings AB', 'SE', 'EU', 'APPROVED', now() - interval '10 days')
on conflict (id) do nothing;

do $$
begin
  assert (select count(*) from public.billing_accounts
           where org_id in ('66660000-0000-4000-8000-000000000001',
                             '66660000-0000-4000-8000-000000000002')) = 2,
    '0034: el disparador crea la fila de billing al nacer la organizacion, sin hueco que rellenar';
  assert (select count(*) from public.billing_accounts) >= 8,
    '0034: y el backfill cubre TAMBIEN las organizaciones que ya existian (orgA, orgB y las seis de la siembra real)';
  raise notice 'OK · 0034: toda organizacion tiene su fila de billing, nueva o vieja';
end
$$;

-- 1 · La vista, para un Operador. Timken (100 dias, sin pago) ya paso los 90
-- de prueba y esta VENCIDA -pero sigue APPROVED hasta que algo la suspenda,
-- que es justo lo que esta seccion comprueba luego-. Nordic (10 dias) sigue
-- EN PRUEBA de sobra.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare
    fila record;
  begin
    select * into fila from public.billing_org_status
     where org_id = '66660000-0000-4000-8000-000000000002';
    assert fila.billing_state = 'EN PRUEBA',
      '0034: Nordic Bearings, 10 dias, sigue en prueba (fecha de aprobacion + 90 sin pago)';
    assert fila.days_remaining = 80,
      '0034: y le quedan 80 dias de los 90 -- calculado, no guardado';

    select * into fila from public.billing_org_status
     where org_id = '66660000-0000-4000-8000-000000000001';
    assert fila.billing_state = 'ACTIVE',
      '0034: Timken vencio su prueba SIN pago -- organizations.status sigue en APPROVED hasta que algo la suspenda, y la regla de la vista lee eso: sin SUSPENDED, no hay EN PRUEBA que aplicar, así que cae en ACTIVE';
    assert fila.days_remaining = -10,
      '0034: dias_restantes negativo -- ya establecido en la organizacion vencida (100 - 90 = 10 dias de mas)';
    raise notice 'OK · 0034: billing_org_status calcula el estado y los dias restantes contra la fecha real, no un valor guardado';
  end
  $$;
commit;

-- 2 · Quien no es Operador no ve NADA de billing, ni de su propia organizacion.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.billing_org_status) = 0,
      '0034: un miembro normal no ve ninguna fila -- el INNER JOIN con billing_accounts (solo Operador) la deja vacia';
    assert (select count(*) from public.billing_accounts) = 0,
      '0034: ni billing_accounts directamente';
    assert (select count(*) from public.billing_payments) = 0,
      '0034: ni billing_payments';
    raise notice 'OK · 0034: ADMIN-02 es invisible para cualquier miembro distribuidor (spec §7)';
  end
  $$;

  select public.expect_fail(
    $$select public.billing_confirm_payment('66660000-0000-4000-8000-000000000001', current_date, null)$$,
    '0034: un miembro normal no puede confirmar un pago');
  select public.expect_fail(
    $$select public.billing_suspend_organization('66660000-0000-4000-8000-000000000001')$$,
    '0034: ni suspender una organizacion');
commit;

-- 3 · Operador: no se puede ver el futuro, ni pasarse de 300 caracteres.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.billing_confirm_payment('66660000-0000-4000-8000-000000000001', current_date + 1, null)$$,
    '0034: la fecha de pago no puede ser futura');
  select public.expect_fail(
    format($$select public.billing_confirm_payment('66660000-0000-4000-8000-000000000001', current_date, %L)$$,
           repeat('x', 301)),
    '0034: la nota interna no puede pasar de 300 caracteres');
commit;

-- 4 · Suspender manualmente Timken (ACTIVE, vencida de hecho) y comprobar el
-- rastro completo: estado, suspended_since, historial, y que desaparece de
-- "candidata a borrado" hasta que pasen los 6 meses.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.billing_suspend_organization('66660000-0000-4000-8000-000000000001');
commit;

do $$
begin
  assert (select status from public.organizations
           where id = '66660000-0000-4000-8000-000000000001') = 'SUSPENDED',
    '0034: Timken queda SUSPENDED tras la suspension manual';
  assert (select suspended_since from public.billing_accounts
           where org_id = '66660000-0000-4000-8000-000000000001') is not null,
    '0034: y suspended_since queda marcado';
  assert (select billing_state from public.billing_org_status
           where org_id = '66660000-0000-4000-8000-000000000001') = 'SUSPENDED',
    '0034: recien suspendida, SUSPENDED -- CANDIDATA A BORRADO exige 6 meses';
  assert (select to_status from public.billing_status_events
           where org_id = '66660000-0000-4000-8000-000000000001'
           order by created_at desc limit 1) = 'SUSPENDED',
    '0034: y queda en el historial, con el operador que la suspendio';
  assert (select changed_by from public.billing_status_events
           where org_id = '66660000-0000-4000-8000-000000000001'
           order by created_at desc limit 1) = '0e000001-0000-0000-0000-000000000001',
    '0034: changed_by es el operador -- NULL es solo para la transicion automatica';
  raise notice 'OK · 0034: suspender deja rastro completo -- estado, fecha y quien lo hizo';
end
$$;

-- No se puede suspender dos veces, ni confirmar un pago sobre una organizacion
-- que no existe.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.billing_suspend_organization('66660000-0000-4000-8000-000000000001')$$,
    '0034: no se puede suspender una organizacion que ya esta SUSPENDED');
  select public.expect_fail(
    $$select public.billing_confirm_payment(gen_random_uuid(), current_date, null)$$,
    '0034: no se puede confirmar un pago sobre una organizacion que no existe');
commit;

-- 5 · Confirmar el pago: reactiva, recalcula el vencimiento a 365 dias desde
-- la fecha del pago (no desde hoy), y limpia suspended_since.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.billing_confirm_payment(
    '66660000-0000-4000-8000-000000000001', current_date - 3, 'Transferencia recibida, ref. 88213');
commit;

do $$
begin
  assert (select status from public.organizations
           where id = '66660000-0000-4000-8000-000000000001') = 'APPROVED',
    '0034: el pago reactiva Timken de inmediato';
  assert (select suspended_since from public.billing_accounts
           where org_id = '66660000-0000-4000-8000-000000000001') is null,
    '0034: y limpia suspended_since -- si vuelve a suspenderse, el contador de 6 meses se reinicia (RNG-BILL-08)';
  assert (select days_remaining from public.billing_org_status
           where org_id = '66660000-0000-4000-8000-000000000001') = 362,
    '0034: 365 dias desde la fecha DEL PAGO (hace 3 dias), no desde hoy -- 365 - 3 = 362';
  assert (select recorded_by from public.billing_payments
           where org_id = '66660000-0000-4000-8000-000000000001') = '0e000001-0000-0000-0000-000000000001',
    '0034: el pago queda firmado por el operador que lo registro';
  assert (select note from public.billing_payments
           where org_id = '66660000-0000-4000-8000-000000000001') = 'Transferencia recibida, ref. 88213',
    '0034: con su nota interna, verbatim';
  assert (select to_status from public.billing_status_events
           where org_id = '66660000-0000-4000-8000-000000000001'
           order by created_at desc limit 1) = 'APPROVED',
    '0034: y la reactivacion tambien queda en el historial de estados';
  raise notice 'OK · 0034: confirmar un pago reactiva, recalcula desde la fecha real del pago y limpia el rastro de suspension';
end
$$;

-- Pagar sobre una organizacion YA activa no falla -- solo suma un pago y no
-- toca el historial de estados, porque no hubo transicion.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.billing_confirm_payment(
    '66660000-0000-4000-8000-000000000002', current_date, null);
commit;

do $$
begin
  assert (select count(*) from public.billing_payments
           where org_id = '66660000-0000-4000-8000-000000000002') = 1,
    '0034: pagar en EN PRUEBA (sin estar suspendida) simplemente registra el pago';
  assert (select count(*) from public.billing_status_events
           where org_id = '66660000-0000-4000-8000-000000000002') = 0,
    '0034: sin transicion de estado, no hay fila de historial que escribir';
  assert (select billing_state from public.billing_org_status
           where org_id = '66660000-0000-4000-8000-000000000002') = 'ACTIVE',
    '0034: y Nordic pasa de EN PRUEBA a ACTIVE en cuanto hay un pago, aunque su prueba no hubiera terminado';
  raise notice 'OK · 0034: pagar durante la prueba adelanta a ACTIVE sin pasar por SUSPENDED';
end
$$;

-- 6 · Candidata a borrado: 6+ meses en SUSPENDED, no antes.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.billing_suspend_organization('66660000-0000-4000-8000-000000000002');
commit;

update public.billing_accounts
   set suspended_since = now() - interval '7 months'
 where org_id = '66660000-0000-4000-8000-000000000002';

do $$
begin
  assert (select billing_state from public.billing_org_status
           where org_id = '66660000-0000-4000-8000-000000000002') = 'CANDIDATA A BORRADO',
    '0034: 7 meses en SUSPENDED -- ya es candidata a borrado';
end
$$;

update public.billing_accounts
   set suspended_since = now() - interval '3 months'
 where org_id = '66660000-0000-4000-8000-000000000002';

do $$
begin
  assert (select billing_state from public.billing_org_status
           where org_id = '66660000-0000-4000-8000-000000000002') = 'SUSPENDED',
    '0034: 3 meses en SUSPENDED -- todavia no, sin acortar el umbral de 6';
  raise notice 'OK · 0034: candidata a borrado exige 6 meses exactos, ni un dia menos por interpretacion generosa';
end
$$;

-- 7 · app.billing_evaluate_expirations(): revocada de authenticated, corre
-- como postgres/service_role (la siembra y los jobs futuros).
--
-- ⚠ NO se prueba llamandola como `authenticated` y esperando el fallo con
-- `expect_fail`: un `permission denied` es SQLSTATE 42501, y ese detector
-- trata TODO lo que empieza por "42" como "el test esta roto" (F-081), no
-- como un bloqueo legitimo -- confundiria una funcion sin permiso con un
-- nombre mal escrito. Se comprueba contra el catalogo, como el resto de
-- privilegios de este fichero (F-146).
do $$
begin
  assert not exists (
    select 1 from information_schema.role_routine_grants
     where routine_schema = 'app' and routine_name = 'billing_evaluate_expirations'
       and grantee in ('anon', 'authenticated') and privilege_type = 'EXECUTE'
  ), '0034: app.billing_evaluate_expirations no deberia ser ejecutable por anon ni authenticated -- ni el Operador la llama directamente';
  raise notice 'OK · 0034: la evaluacion masiva de vencimientos no es un verbo de cliente, revocada de authenticated y anon';
end
$$;

-- Nordic (ahora SUSPENDED, no vale para esta prueba) -- se prueba con una
-- organizacion nueva, ACTIVE y vencida de verdad, sin pago.
insert into public.organizations (id, name, country, continent, status, created_at) values
  ('66660000-0000-4000-8000-000000000003', 'Distribuciones Ruiz SL', 'ES', 'EU', 'APPROVED', now() - interval '200 days')
on conflict (id) do nothing;

do $$
declare
  n int;
begin
  n := app.billing_evaluate_expirations();
  assert n >= 1,
    '0034: evalua y suspende al menos Distribuciones Ruiz (200 dias, sin pago, vencida hace 110)';
  assert (select status from public.organizations
           where id = '66660000-0000-4000-8000-000000000003') = 'SUSPENDED',
    '0034: Distribuciones Ruiz queda SUSPENDED';
  assert (select changed_by from public.billing_status_events
           where org_id = '66660000-0000-4000-8000-000000000003') is null,
    '0034: changed_by NULL -- fue automatica, no un operador';
  assert (select status from public.organizations
           where id = '66660000-0000-4000-8000-000000000001') = 'APPROVED',
    '0034: y Timken (activa, con pago reciente) no se toca -- la evaluacion no suspende de mas';
  raise notice 'OK · 0034: la evaluacion automatica suspende solo lo vencido, con changed_by NULL, y no toca lo que esta al dia';
end
$$;

-- 8 · El Operador ve TODAS las organizaciones, incluidas las SUSPENDED --
-- sin esto el panel que gestiona suspensiones no podria ver a quien suspendio.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.organizations
             where id in ('66660000-0000-4000-8000-000000000002',
                          '66660000-0000-4000-8000-000000000003')) = 2,
      '0034: el Operador ve las dos SUSPENDED, que un miembro normal no vería';
    raise notice 'OK · 0034: organizations_select_operator da visibilidad completa, sin excepcion de estado';
  end
  $$;
commit;

-- 9 · Privilegios: anon nada; authenticated solo SELECT, nunca escritura
-- directa a las tres tablas.
do $$
declare
  sobran text;
begin
  select string_agg(grantee || ':' || privilege_type || ' en ' || table_name, ', '
                    order by grantee, table_name, privilege_type)
    into sobran
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('billing_accounts', 'billing_payments', 'billing_status_events', 'billing_org_status')
     and (grantee = 'anon'
          or (grantee = 'authenticated' and privilege_type <> 'SELECT'));

  assert sobran is null,
    '0034: privilegios que no deberia haber: ' || coalesce(sobran, '');
  raise notice 'OK · 0034: anon nada, authenticated solo SELECT en las cuatro piezas de billing';
end
$$;

-- -----------------------------------------------------------------------------
-- 0035 · watchers (SRCH-03)
-- -----------------------------------------------------------------------------
-- a1/a2 son de Alpha (orgA), b1 de Beta (orgB). Los tres estan ACTIVE a estas
-- alturas del fichero. Se comprueba el ciclo de vida entero con la sesion de un
-- miembro -- no con postgres --, porque lo que esta migracion protege es lo que
-- un cliente NO puede hacer.

do $$
begin
  assert (select count(*) from public.members
           where id in ('0a000001-0000-0000-0000-000000000001',
                        '0a000002-0000-0000-0000-000000000002',
                        '0b000001-0000-0000-0000-000000000001')
             and state = 'ACTIVE') = 3,
    '0035: el banco necesita a a1, a2 y b1 ACTIVE';
end
$$;

-- 1 · Alta por un miembro: el cliente pide EXPIRED y un expires_at de 2030 y la
-- base lo ignora (init_watcher). Cinco pruebas de validacion de paso.
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  insert into public.watchers (id, org_id, created_by, part_number, min_quantity, status, expires_at)
  values ('aa350000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
          '0a000001-0000-0000-0000-000000000001', '  6308-ZZ ', 100, 'EXPIRED', '2030-01-01');
  select public.expect_fail(
    $$insert into public.watchers (org_id, created_by, part_number, min_quantity)
      values ('11111111-1111-1111-1111-111111111111', '0a000001-0000-0000-0000-000000000001', 'X', 5)$$,
    '0035: la referencia necesita al menos 2 caracteres');
  select public.expect_fail(
    $$insert into public.watchers (org_id, created_by, part_number, min_quantity)
      values ('11111111-1111-1111-1111-111111111111', '0a000001-0000-0000-0000-000000000001', '6308-ZZ', 0)$$,
    '0035: la cantidad minima es un entero positivo');
  select public.expect_fail(
    $$insert into public.watchers (org_id, created_by, part_number, min_quantity, country)
      values ('11111111-1111-1111-1111-111111111111', '0a000001-0000-0000-0000-000000000001', '6308-ZZ', 5, 'esp')$$,
    '0035: el pais es un codigo ISO de dos letras en mayusculas');
  -- Los dos de abajo los corta la RLS (SQLSTATE 42501), que `expect_fail` trata
  -- como test roto: se capturan a mano.
  do $chk$
  begin
    begin
      insert into public.watchers (org_id, created_by, part_number, min_quantity)
      values ('22222222-2222-2222-2222-222222222222', '0a000001-0000-0000-0000-000000000001', '6308-ZZ', 5);
      raise exception 'TEST FALLIDO: 0035 dejo crear un watcher a nombre de otra organizacion';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.watchers (org_id, created_by, part_number, min_quantity)
      values ('11111111-1111-1111-1111-111111111111', '0a000002-0000-0000-0000-000000000002', '6308-ZZ', 5);
      raise exception 'TEST FALLIDO: 0035 dejo crear un watcher a nombre de otro miembro';
    exception when insufficient_privilege then null;
    end;
  end
  $chk$;
commit;

do $$
declare
  w public.watchers;
begin
  select * into w from public.watchers where id = 'aa350000-0000-4000-8000-000000000001';
  assert w.status = 'ACTIVE', '0035: nace ACTIVE aunque el cliente pidiera EXPIRED';
  assert w.part_number = '6308-ZZ', '0035: la referencia se guarda sin espacios sobrantes';
  assert w.expires_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour',
    '0035: expira a los 30 dias aunque el cliente pidiera 2030';
  raise notice 'OK · 0035: el alta ignora el estado y la fecha de expiracion que pida el cliente';
end
$$;

-- 2 · Aislamiento por organizacion: b1 no ve ni toca el watcher de Alpha.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.watchers) = 0,
      '0035: Beta no ve ningun watcher de Alpha (tabla)';
    assert (select count(*) from public.watcher_list) = 0,
      '0035: ni por la vista';
    delete from public.watchers where id = 'aa350000-0000-4000-8000-000000000001';
  end
  $$;
  select public.expect_fail(
    $$select public.watcher_set_paused('aa350000-0000-4000-8000-000000000001', true)$$,
    '0035: Beta no pausa un watcher de Alpha -- mismo error que un id que no existe');
  select public.expect_fail(
    $$select public.watcher_renew('aa350000-0000-4000-8000-000000000001')$$,
    '0035: ni lo renueva');
commit;
do $$
begin
  assert (select count(*) from public.watchers where id = 'aa350000-0000-4000-8000-000000000001') = 1,
    '0035: el DELETE de Beta no borro el watcher de Alpha (RLS lo filtra en silencio)';
  raise notice 'OK · 0035: un watcher solo lo ve y lo toca su organizacion';
end
$$;

-- 3 · Ciclo de vida con a2 (otro miembro de la MISMA organizacion: el watcher
-- es de la organizacion, no de quien lo creo).
begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.watcher_set_paused('aa350000-0000-4000-8000-000000000001', true);
commit;
do $$
begin
  assert (select status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'PAUSED',
    '0035: pausar deja PAUSED (y lo hizo otro miembro de la organizacion)';
  assert (select days_remaining from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 30,
    '0035: recien creado, 30 dias restantes';
  raise notice 'OK · 0035: pausar, y cualquier miembro de la organizacion puede';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0a000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.watcher_set_paused('aa350000-0000-4000-8000-000000000001', true)$$,
    '0035: no se pausa dos veces');
  select public.watcher_update('aa350000-0000-4000-8000-000000000001', ' 6308-2RS ', 250, '  SKF ', 'de', true);
  select public.expect_fail(
    $$select public.watcher_update('aa350000-0000-4000-8000-000000000001', '6308', 0, null, null, false)$$,
    '0035: editar exige cantidad positiva');
  select public.expect_fail(
    $$select public.watcher_update('aa350000-0000-4000-8000-000000000001', 'A', 5, null, null, false)$$,
    '0035: y referencia de 2 caracteres');
  select public.watcher_set_paused('aa350000-0000-4000-8000-000000000001', false);
commit;
do $$
declare
  w public.watcher_list;
begin
  select * into w from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001';
  assert w.status = 'ACTIVE', '0035: reactivar deja ACTIVE';
  assert w.part_number = '6308-2RS' and w.min_quantity = 250 and w.brand = 'SKF'
         and w.country = 'DE' and w.email_channel,
    '0035: editar guarda los cinco campos, con la marca recortada y el pais en mayusculas';
  raise notice 'OK · 0035: editar y reactivar';
end
$$;

-- 4 · Vencimiento SIN cron: se envejece el watcher a mano y la VISTA ya lo ve
-- PENDIENTE RENOVACION aunque la columna diga ACTIVE.
update public.watchers set created_at = now() - interval '31 days', expires_at = now() - interval '1 day'
 where id = 'aa350000-0000-4000-8000-000000000001';
do $$
begin
  assert (select status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'PENDIENTE RENOVACION',
    '0035: vencido, la vista lo muestra PENDIENTE RENOVACION sin que nadie escriba la columna';
  assert (select stored_status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'ACTIVE',
    '0035: y stored_status sigue diciendo lo que dice la tabla';
  assert (select days_remaining from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') is null,
    '0035: sin dias restantes fuera de ACTIVE/PAUSED vigentes';
  raise notice 'OK · 0035: el vencimiento se ve sin cron';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.watcher_set_paused('aa350000-0000-4000-8000-000000000001', true)$$,
    '0035: un watcher vencido no se pausa -- se renueva');
  select public.expect_fail(
    $$select public.watcher_update('aa350000-0000-4000-8000-000000000001', '6308', 5, null, null, false)$$,
    '0035: ni se edita');
  select public.watcher_renew('aa350000-0000-4000-8000-000000000001');
commit;
do $$
begin
  assert (select status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'ACTIVE',
    '0035: renovar vuelve a ACTIVE';
  assert (select days_remaining from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 30,
    '0035: con el contador reiniciado a 30 dias';
  raise notice 'OK · 0035: renovar reinicia el contador';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $$select public.watcher_renew('aa350000-0000-4000-8000-000000000001')$$,
    '0035: no se renueva un watcher que sigue vigente');
  select public.expect_fail(
    $$select public.watcher_let_expire('aa350000-0000-4000-8000-000000000001')$$,
    '0035: ni se deja expirar');
commit;

-- 5 · Dejar expirar, y el evaluador de la columna.
update public.watchers set expires_at = now() - interval '1 second'
 where id = 'aa350000-0000-4000-8000-000000000001';
do $$
begin
  assert app.watchers_evaluate_expirations() >= 1,
    '0035: el evaluador mueve a la columna lo que la vista ya mostraba';
  assert (select stored_status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'PENDIENTE RENOVACION',
    '0035: y ahora tambien lo dice la tabla';
end
$$;
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.watcher_let_expire('aa350000-0000-4000-8000-000000000001');
  select public.expect_fail(
    $$select public.watcher_renew('aa350000-0000-4000-8000-000000000001')$$,
    '0035: un watcher EXPIRED no se renueva');
commit;
do $$
begin
  assert (select status from public.watcher_list where id = 'aa350000-0000-4000-8000-000000000001') = 'EXPIRED',
    '0035: dejar que expire deja EXPIRED';
  raise notice 'OK · 0035: dejar que expire, y solo desde PENDIENTE RENOVACION';
end
$$;

-- 6 · El limite de 50 ACTIVE por organizacion. Se siembran 49 + 1 pausado como
-- postgres (auth.uid() nulo: init_watcher respeta lo escrito); el 50 entra por
-- sesion y el 51 falla, igual que reactivar el pausado.
insert into public.watchers (org_id, part_number, min_quantity)
select '22222222-2222-2222-2222-222222222222', 'LIM-' || g, 10 from generate_series(1, 49) g;
insert into public.watchers (id, org_id, part_number, min_quantity, status)
values ('bb350000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'LIM-PAUSADO', 10, 'PAUSED');
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  insert into public.watchers (org_id, created_by, part_number, min_quantity)
  values ('22222222-2222-2222-2222-222222222222', '0b000001-0000-0000-0000-000000000001', 'LIM-50', 10);
  select public.expect_fail(
    $$insert into public.watchers (org_id, created_by, part_number, min_quantity)
      values ('22222222-2222-2222-2222-222222222222', '0b000001-0000-0000-0000-000000000001', 'LIM-51', 10)$$,
    '0035: el watcher 51 ACTIVE de una organizacion no entra');
  select public.expect_fail(
    $$select public.watcher_set_paused('bb350000-0000-4000-8000-000000000001', false)$$,
    '0035: ni reactivando uno pausado');
commit;
do $$
begin
  assert (select count(*) from public.watchers
           where org_id = '22222222-2222-2222-2222-222222222222' and status = 'ACTIVE') = 50,
    '0035: 50 ACTIVE y ni uno mas';
  raise notice 'OK · 0035: el limite de 50 ACTIVE, por organizacion, tambien al reactivar';
end
$$;
-- Un PAUSED no cuenta para el limite: se pausa uno y entra otro.
begin;
  select set_config('request.jwt.claim.sub', '0b000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.watcher_set_paused((select id from public.watchers
                                     where org_id = '22222222-2222-2222-2222-222222222222' and part_number = 'LIM-1'), true);
  insert into public.watchers (org_id, created_by, part_number, min_quantity)
  values ('22222222-2222-2222-2222-222222222222', '0b000001-0000-0000-0000-000000000001', 'LIM-51', 10);
commit;

-- 7 · TRIGGERED lleva su rastro o no es TRIGGERED (CHECK), y no se puede
-- falsificar desde un cliente.
select public.expect_fail(
  $$insert into public.watchers (org_id, part_number, min_quantity, status)
    values ('11111111-1111-1111-1111-111111111111', 'TRG-1', 10, 'TRIGGERED')$$,
  '0035: TRIGGERED sin triggered_at no existe');
begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  insert into public.watchers (id, org_id, created_by, part_number, min_quantity, status, triggered_at, triggered_distributor)
  values ('aa350000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111',
          '0a000001-0000-0000-0000-000000000001', 'NU2210-E', 50, 'TRIGGERED', now(), 'Falso SL');
commit;
do $$
begin
  assert (select status from public.watchers where id = 'aa350000-0000-4000-8000-000000000002') = 'ACTIVE'
     and (select triggered_distributor from public.watchers where id = 'aa350000-0000-4000-8000-000000000002') is null,
    '0035: un cliente no puede fabricar un disparo';
  raise notice 'OK · 0035: TRIGGERED solo lo escribe quien no es un cliente';
end
$$;

-- 8 · Privilegios (F-146: contra el catalogo, no contra el .sql).
do $$
begin
  assert not has_table_privilege('anon', 'public.watchers', 'select')
     and not has_table_privilege('anon', 'public.watcher_list', 'select'),
    '0035: anon no lee watchers';
  assert has_table_privilege('authenticated', 'public.watchers', 'select')
     and has_table_privilege('authenticated', 'public.watchers', 'insert')
     and has_table_privilege('authenticated', 'public.watchers', 'delete'),
    '0035: authenticated selecciona, inserta y borra';
  assert not has_table_privilege('authenticated', 'public.watchers', 'update'),
    '0035: pero NO actualiza -- todo cambio de estado pasa por las funciones';
  assert not has_function_privilege('anon', 'public.watcher_renew(uuid)', 'execute')
     and not has_function_privilege('anon', 'public.watcher_let_expire(uuid)', 'execute')
     and not has_function_privilege('anon', 'public.watcher_set_paused(uuid, boolean)', 'execute')
     and not has_function_privilege('anon', 'public.watcher_update(uuid, text, integer, text, text, boolean)', 'execute'),
    '0035: anon no ejecuta ninguna accion de watchers';
  assert not has_function_privilege('authenticated', 'app.watchers_evaluate_expirations()', 'execute')
     and not has_function_privilege('authenticated', 'app.watcher_lock_own(uuid)', 'execute'),
    '0035: y authenticated no ejecuta el evaluador ni el ayudante';
  raise notice 'OK · 0035: anon nada, authenticated select/insert/delete y las cuatro funciones';
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
     and p.proname not in ('expect_fail','expect_denied')
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

-- -----------------------------------------------------------------------------
-- F-155 / F-156 (Día 14) · ninguna función `security invoker` nueva puede leer
-- una tabla con RLS
-- -----------------------------------------------------------------------------
-- El ancla estructural de la familia `F-148`/`F-155`/`F-156`. Los tres eran el
-- mismo error: un `SELECT`/`EXISTS` contra una tabla con RLS, dentro de una
-- función `security invoker`, cuyo resultado vacío no fallaba — decidía. La
-- auditoría del Día 14 recorrió los siete disparadores y las funciones internas
-- de `app` y no encontró ninguno más: **ningún disparador lee ninguna tabla**,
-- y todo lo que sí lee es `security definer` y propiedad del dueño de las
-- tablas, así que RLS no le aplica.
--
-- Ese resultado es de hoy y caduca con la próxima migración, así que se ancla:
-- la lista de abajo es la superficie auditada entera, y cualquier función
-- `invoker` que nazca nombrando una tabla con RLS la rompe. Las tablas NO van
-- literales: salen de `pg_class`, para que una tabla con RLS nueva quede
-- cubierta sin tocar este fichero.
--
-- Por qué cada una de las seis está permitida:
--   · `create_inquiry`, `create_thread_item`, `counter_offer` — auditadas línea
--     a línea el Día 13; sus lecturas sensibles ya van por ayudantes
--     `security definer` (`app.thread_counterpart`, `app.org_already_inquired`,
--     `app.resolve_thread`). Lo que les queda bajo RLS son escrituras, que
--     fallan con error en vez de decidir en silencio.
--   · `demo_state`, `demo_reanchor_freshness` — utilidades de demo, no guardias:
--     no hay ninguna decisión colgando de que su lectura salga vacía.
--   · `guard_member_privileges` — falso positivo del detector, y se deja dentro
--     a propósito para que se vea: lo único que nombra es `members.role` DENTRO
--     del texto de una excepción. No lee nada.
--   · `guard_forum_rate_limit` (0031, RNG-FORO-06) — SÍ lee `forum_posts` de
--     verdad, para contar y decidir si bloquea. Entra en la lista porque su
--     política de SELECT (`forum_posts_select_member`) no restringe por
--     organización -cualquier miembro activo ve TODAS las publicaciones, es
--     un foro público-, así que el recuento por `author_org_id` da el mismo
--     número sea quien sea que llama: no hay conjunto oculto que un invoker
--     pueda ver de menos, que es justo lo que esta familia vigila. (Y no es
--     casualidad que sea invoker: la primera versión la hizo `security
--     definer` y eso rompió el propio guardia -- `current_user` dentro de una
--     función definer es su DUEÑO, no quien llama, así que el bypass de
--     siembra se activaba siempre. Cazado por la prueba de abajo, antes de
--     tocar las bases reales.)
create or replace function app.f155_detector() returns text
  language sql security definer set search_path to 'pg_catalog','public' as $detector$
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname || '.' || p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public')
     and p.prokind = 'f'
     and not p.prosecdef
     and p.proname not in ('expect_fail','expect_denied','f146_canaria')
     and n.nspname || '.' || p.proname not in (
           'public.create_inquiry',
           'public.create_thread_item',
           'public.counter_offer',
           'public.demo_state',
           'public.demo_reanchor_freshness',
           'app.guard_member_privileges',
           'app.guard_forum_rate_limit')
     and exists (
           select 1
             from pg_class c
             join pg_namespace cn on cn.oid = c.relnamespace
            where cn.nspname = 'public'
              and c.relkind = 'r'
              and c.relrowsecurity
              and p.prosrc ~* ('\y' || c.relname || '\y'));
$detector$;

do $$
declare
  intrusas text;
begin
  intrusas := app.f155_detector();
  assert intrusas is null,
    'F-155: estas funciones security invoker nombran una tabla con RLS y no estan en la superficie auditada: '
    || coalesce(intrusas, '') || ' -- si la lectura decide algo, es el agujero de F-148/F-155/F-156 otra vez';
  raise notice 'OK · F-155: ninguna funcion invoker fuera de la superficie auditada nombra una tabla con RLS';
end
$$;

-- Y que el detector detecte. Sin esta canaria el aserto de arriba pasaria en
-- vacio el dia que alguien cambie `prosrc` por otra cosa -- la leccion de F-146.
create or replace function app.f155_canaria() returns int
  language plpgsql as $canaria$
begin
  return (select count(*)::int from thread_items);
end;
$canaria$;

do $$
begin
  assert app.f155_detector() = 'app.f155_canaria',
    'F-155: el detector no ve una funcion invoker que lee thread_items -- el ancla de arriba mide en vacio. Vio: '
    || coalesce(app.f155_detector(), '(nada)');
  raise notice 'OK · F-155: el detector si ve una funcion invoker nueva que lee una tabla con RLS';
end
$$;

drop function app.f155_canaria();
drop function app.f155_detector();

-- Y que nadie construya el SQL a mano dentro de una funcion `invoker`. El
-- detector de arriba lee el CUERPO de la funcion: una tabla nombrada dentro de
-- un `execute` compuesto en tiempo de ejecucion no aparece en el cuerpo y el
-- barrido no la ve. Hoy no hay ni una sola funcion asi en `app` ni en `public`
-- —comprobado contra el catalogo, no supuesto—, y por eso el barrido literal
-- basta. El dia que aparezca una, este aserto la pone delante de quien la
-- escriba en vez de dejarla pasar callando.
do $$
declare
  dinamicas text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname || '.' || p.proname)
    into dinamicas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public')
     and p.prokind = 'f'
     and not p.prosecdef
     and p.proname not in ('expect_fail','expect_denied','f146_canaria')
     and p.prosrc ~* '\yexecute\y';

  assert dinamicas is null,
    'F-155: estas funciones security invoker montan SQL dinamico, asi que el barrido de cuerpos no puede ver que tablas tocan: '
    || coalesce(dinamicas, '') || ' -- auditalas a mano contra el criterio de F-155 antes de dejarlas pasar';
  raise notice 'OK · F-155: ninguna funcion invoker monta SQL dinamico, asi que el barrido de cuerpos mide toda la superficie';
end
$$;

-- -----------------------------------------------------------------------------
-- 0040 · tokens de acceso de un solo uso (F-223)
-- -----------------------------------------------------------------------------
-- Mide las dos mitades de cada regla: que el Operador genera y el servidor valida, y que
-- un ADMIN de organizacion y `anon` no generan; que el token se guarda como hash y no en claro;
-- que caduca, que generar otro revoca el anterior, y que canjear es de un solo uso.
-- Los privilegios se leen del CATALOGO (F-146), no intentando la llamada. El token en
-- claro viaja entre bloques en un GUC de sesion (`bw.tokN`): psql no interpola
-- variables dentro de un `do $$`.
insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, applicant_phone, website, state)
values
  ('40400000-0000-4000-8000-000000000001', 'Rodamientos Token SL', 'ES',
   'Ana Token', 'ana@rodamientostoken.test', '+34 600 000 001', 'https://rodamientostoken.test', 'INVITED_APPROVED'),
  ('40400000-0000-4000-8000-000000000002', 'Pendiente Token SL', 'ES',
   'Pepe Pendiente', 'pepe@pendientetoken.test', null, null, 'PENDING_REVIEW'),
  ('40400000-0000-4000-8000-000000000003', 'Caduca Token SL', 'ES',
   'Carla Caduca', 'carla@caducatoken.test', null, null, 'INVITED_APPROVED'),
  ('40400000-0000-4000-8000-000000000004', 'Cancelada Token SL', 'ES',
   'Cris Cancelada', 'cris@canceladatoken.test', null, null, 'INVITED_APPROVED');

-- 1 · Catalogo: quien puede ejecutar que, y que la tabla es de nadie.
do $$
begin
  assert not has_table_privilege('anon', 'public.access_tokens', 'select'),
    '0040: anon no lee access_tokens';
  assert not has_table_privilege('authenticated', 'public.access_tokens', 'select'),
    '0040: ni authenticated (el hash tampoco se lee desde el cliente)';
  assert not has_table_privilege('authenticated', 'public.access_tokens', 'insert'),
    '0040: authenticated no escribe';
  assert not has_table_privilege('anon', 'public.access_tokens', 'insert'),
    '0040: anon tampoco escribe';
  assert not has_function_privilege('anon', 'public.issue_registration_link(uuid)', 'execute'),
    '0040: anon no genera enlaces';
  assert not has_function_privilege('anon', 'public.registration_link_status(uuid)', 'execute'),
    '0040: anon no ve el estado de un enlace';
  assert not has_function_privilege('anon', 'public.registration_link_validate(text)', 'execute'),
    '0040: anon no valida: REG-01 pasa por una Edge Function con service_role (F-146)';
  assert not has_function_privilege('authenticated', 'public.registration_link_validate(text)', 'execute'),
    '0040: ni authenticated';
  assert has_function_privilege('service_role', 'public.registration_link_validate(text)', 'execute'),
    '0040: ANCLA POSITIVA -- service_role SI valida';
  assert has_function_privilege('authenticated', 'public.issue_registration_link(uuid)', 'execute'),
    '0040: ANCLA POSITIVA -- authenticated SI ejecuta issue_registration_link (la puerta es is_platform_operator)';
  assert not has_function_privilege('anon', 'app.redeem_registration_token(text)', 'execute'),
    '0040: anon no canjea';
  assert not has_function_privilege('authenticated', 'app.redeem_registration_token(text)', 'execute'),
    '0040: ni authenticated: canjear es interno';
  assert has_function_privilege('service_role', 'app.redeem_registration_token(text)', 'execute'),
    '0040: ANCLA POSITIVA -- service_role SI canjea';
  raise notice 'OK · 0040: privilegios leidos del catalogo';
end
$$;

-- 2 · Un ADMIN de organizacion no genera el enlace de nadie ni ve su estado.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  select public.expect_fail($q$select * from public.issue_registration_link('40400000-0000-4000-8000-000000000001')$q$,
    '0040: un ADMIN de organizacion no genera el enlace de una solicitud');
  select public.expect_fail($q$select * from public.registration_link_status('40400000-0000-4000-8000-000000000001')$q$,
    '0040: ni ve su estado');
commit;

-- 3 · El Operador no genera sobre una solicitud sin aprobar ni inexistente; si sobre la aprobada.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail($q$select * from public.issue_registration_link('40400000-0000-4000-8000-000000000002')$q$,
    '0040: una solicitud PENDING_REVIEW no tiene enlace');
  select public.expect_fail($q$select * from public.issue_registration_link('40400000-0000-4000-8000-0000000000ff')$q$,
    '0040: una solicitud que no existe tampoco');
  do $$
  begin
    assert not exists (select 1 from public.registration_link_status('40400000-0000-4000-8000-000000000001')),
      '0040: antes de generar, la solicitud no tiene estado de enlace';
  end
  $$;
  select set_config('bw.tok1', (select token from public.issue_registration_link('40400000-0000-4000-8000-000000000001')), false);
commit;

do $$
declare v record; t text := current_setting('bw.tok1');
begin
  assert t ~ '^[0-9a-f]{64}$', '0040: el token son 64 caracteres hexadecimales';
  assert (select count(*) from public.access_tokens where registration_request_id = '40400000-0000-4000-8000-000000000001') = 1,
    '0040: una fila de token';
  assert not exists (select 1 from public.access_tokens where token_hash = t),
    '0040: el token en claro NO esta guardado';
  assert exists (select 1 from public.access_tokens
                  where token_hash = encode(sha256(convert_to(t, 'UTF8')), 'hex')),
    '0040: lo guardado es su hash sha256';
  select * into v from public.access_tokens where registration_request_id = '40400000-0000-4000-8000-000000000001';
  assert v.expires_at - v.created_at = interval '7 days', '0040: caduca a los 7 dias';
  assert v.created_by = '0e000001-0000-0000-0000-000000000001', '0040: firmado por el Operador que lo genero';
  raise notice 'OK · 0040: el Operador genera un token de 7 dias y se guarda solo su hash';
end
$$;

-- 4 · Validar (como el servidor: la Edge Function): devuelve los datos del FSR; con un token malo, NADA.
begin;
  do $$
  declare v record; n int;
  begin
    select * into v from public.registration_link_validate(current_setting('bw.tok1'));
    assert v.org_name = 'Rodamientos Token SL' and v.applicant_email = 'ana@rodamientostoken.test'
       and v.country = 'ES' and v.applicant_phone = '+34 600 000 001',
      '0040: validar devuelve lo que se escribio en el FSR';
    select count(*) into n from public.registration_link_validate('no-es-un-token');
    assert n = 0, '0040: un token inventado no valida';
    select count(*) into n from public.registration_link_validate(null);
    assert n = 0, '0040: NULL tampoco';
    select count(*) into n from public.registration_link_validate(repeat('0', 64));
    assert n = 0, '0040: ni uno con forma correcta que no existe';
    -- Validar no consume: vale otra vez.
    select count(*) into n from public.registration_link_validate(current_setting('bw.tok1'));
    assert n = 1, '0040: validar no gasta el token';
    raise notice 'OK · 0040: solo vale el token verdadero y validar no lo gasta';
  end
  $$;
commit;

-- 5 · Volver a generar revoca el anterior: solo el ultimo vale.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.tok2', (select token from public.issue_registration_link('40400000-0000-4000-8000-000000000001')), false);
  do $$
  begin
    assert (select status from public.registration_link_status('40400000-0000-4000-8000-000000000001')) = 'Vigente',
      '0040: el estado del enlace es Vigente';
  end
  $$;
commit;

do $$
begin
  assert current_setting('bw.tok1') <> current_setting('bw.tok2'), '0040: el segundo token es otro';
  assert (select count(*) from public.access_tokens where registration_request_id = '40400000-0000-4000-8000-000000000001') = 2,
    '0040: quedan dos filas';
  assert (select count(*) from public.access_tokens
           where registration_request_id = '40400000-0000-4000-8000-000000000001'
             and used_at is null and revoked_at is null) = 1,
    '0040: y solo una vigente';
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.tok1'))),
    '0040: el primero, revocado, ya no valida';
  assert exists (select 1 from public.registration_link_validate(current_setting('bw.tok2'))),
    '0040: el segundo si';
  assert app.redeem_registration_token(current_setting('bw.tok1')) is null,
    '0040: el revocado tampoco se canjea';
  raise notice 'OK · 0040: generar otro revoca el anterior';
end
$$;

-- 6 · Canjear es de un solo uso.
do $$
begin
  assert app.redeem_registration_token(current_setting('bw.tok2')) = '40400000-0000-4000-8000-000000000001',
    '0040: canjear devuelve la solicitud';
  assert app.redeem_registration_token(current_setting('bw.tok2')) is null,
    '0040: y a la segunda ya no vale';
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.tok2'))),
    '0040: un token canjeado ya no valida';
  assert app.redeem_registration_token('no-es-un-token') is null and app.redeem_registration_token(null) is null,
    '0040: un token inventado o NULL no se canjea';
  raise notice 'OK · 0040: un token se canjea una vez';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select status from public.registration_link_status('40400000-0000-4000-8000-000000000001')) = 'Canjeado',
      '0040: el estado pasa a Canjeado';
  end
  $$;
  select public.expect_fail($q$select * from public.issue_registration_link('40400000-0000-4000-8000-000000000001')$q$,
    '0040: tras canjear no se genera otro enlace de la misma solicitud');
commit;

-- 7 · Caducado: ni valida ni se canjea, y se puede volver a generar.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.tok3', (select token from public.issue_registration_link('40400000-0000-4000-8000-000000000003')), false);
commit;

update public.access_tokens
   set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
 where registration_request_id = '40400000-0000-4000-8000-000000000003';

do $$
begin
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.tok3'))),
    '0040: un token caducado no valida';
  assert app.redeem_registration_token(current_setting('bw.tok3')) is null,
    '0040: ni se canjea';
  raise notice 'OK · 0040: un token caducado no vale';
end
$$;

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select status from public.registration_link_status('40400000-0000-4000-8000-000000000003')) = 'Caducado',
      '0040: el estado es Caducado';
  end
  $$;
  select set_config('bw.tok3b', (select token from public.issue_registration_link('40400000-0000-4000-8000-000000000003')), false);
commit;

do $$
begin
  assert exists (select 1 from public.registration_link_validate(current_setting('bw.tok3b'))),
    '0040: tras caducar se genera uno nuevo y ese valida';
  raise notice 'OK · 0040: un enlace caducado se sustituye por otro';
end
$$;

-- 8 · Si la solicitud deja de estar aprobada, el token no vale aunque este vivo.
begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.tok4', (select token from public.issue_registration_link('40400000-0000-4000-8000-000000000004')), false);
commit;

update public.registration_requests set state = 'CANCELLED'
 where id = '40400000-0000-4000-8000-000000000004';

do $$
begin
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.tok4'))),
    '0040: el token de una solicitud cancelada no valida';
  assert app.redeem_registration_token(current_setting('bw.tok4')) is null,
    '0040: ni se canjea';
  raise notice 'OK · 0040: el token depende de que la solicitud siga aprobada';
end
$$;

-- -----------------------------------------------------------------------------
-- 0041 · alta de organizacion desde el FRO (REG-01, F-226)
-- -----------------------------------------------------------------------------
-- `register_organization` solo la ejecuta `service_role` (la Edge Function); aqui se
-- llama como postgres, que es lo mas cercano que tiene el banco. Mide: privilegios
-- del catalogo (F-146), el camino feliz entero (organizacion, NIF, ADMIN `REGISTERED`
-- y el token canjeado), que un fallo DESPUES de canjear deshace el canje, que cada
-- validacion de la spec se rechaza, y que el NIF solo lo lee el ADMIN de SU
-- organizacion. Un ayudante temporal rellena los quince argumentos con los valores
-- buenos y deja sobreescribir uno.
create function pg_temp.reg(p_over jsonb default '{}'::jsonb)
returns uuid
language plpgsql
as $$
declare
  d jsonb := jsonb_build_object(
    'token',   current_setting('bw.rtok', true),
    'user',    '41f00001-0000-0000-0000-000000000001',
    'aemail',  'admin@sur.test',
    'aname',   'Juan Martinez Herrera',
    'legal',   'Rodamientos del Sur SL',
    'tax',     'B-12345678',
    'address', 'Calle Industria 47 Nave 3',
    'postal',  '41900',
    'country', 'ES',
    'cemail',  'info@sur.test',
    'phone',   '+34 954 123 456',
    'web',     'https://www.sur.test',
    'ops',     '["ES","PT","ES"]'::jsonb,
    'brands',  '["SKF","FAG","SKF"," NSK "]'::jsonb,
    'vis',     'VISIBLE_TODOS') || p_over;
begin
  return public.register_organization(
    d->>'token', (d->>'user')::uuid, d->>'aemail', d->>'aname', d->>'legal', d->>'tax',
    d->>'address', d->>'postal', d->>'country', d->>'cemail', d->>'phone', d->>'web',
    (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(d->'ops') x),
    (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(d->'brands') x),
    d->>'vis');
end;
$$;

-- Una solicitud aprobada con su enlace (lo genera el Operador, como en la pantalla), y
-- las cuentas de Auth que la Edge Function habria creado antes de llamar.
insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, state)
values
  ('41410000-0000-4000-8000-000000000001', 'Rodamientos del Sur SL', 'ES',
   'Juan Martinez Herrera', 'admin@sur.test', 'INVITED_APPROVED');
insert into auth.users (id, email) values
  ('41f00001-0000-0000-0000-000000000001', 'admin@sur.test'),
  ('41f00002-0000-0000-0000-000000000002', 'otro@sur.test');

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.rtok', (select token from public.issue_registration_link('41410000-0000-4000-8000-000000000001')), false);
commit;

-- 1 · Catalogo.
do $$
declare f text := 'public.register_organization(text, uuid, text, text, text, text, text, text, text, text, text, text, text[], text[], text)';
begin
  assert not has_function_privilege('anon', f, 'execute'), '0041: anon no da de alta organizaciones';
  assert not has_function_privilege('authenticated', f, 'execute'),
    '0041: ni authenticated: la puerta es la Edge Function con service_role';
  assert has_function_privilege('service_role', f, 'execute'), '0041: ANCLA POSITIVA -- service_role SI';
  assert not has_function_privilege('anon', 'app.continent_of(text)', 'execute')
     and not has_function_privilege('authenticated', 'app.continent_of(text)', 'execute'),
    '0041: continent_of es interno';
  assert not has_table_privilege('anon', 'public.organization_internal', 'select'),
    '0041: anon no lee el NIF';
  assert not has_table_privilege('authenticated', 'public.organization_internal', 'insert')
     and not has_table_privilege('authenticated', 'public.organization_internal', 'update')
     and not has_table_privilege('authenticated', 'public.organization_internal', 'delete'),
    '0041: ningun cliente escribe el NIF';
  assert has_table_privilege('authenticated', 'public.organization_internal', 'select'),
    '0041: ANCLA POSITIVA -- authenticated SI selecciona (la politica lo acota)';
  assert (select relrowsecurity from pg_class where oid = 'public.organization_internal'::regclass),
    '0041: organization_internal tiene RLS';
  raise notice 'OK · 0041: privilegios leidos del catalogo';
end
$$;

-- 2 · Pais -> continente.
do $$
begin
  assert app.continent_of('ES') = 'EU' and app.continent_of('US') = 'NA' and app.continent_of('BR') = 'SA'
     and app.continent_of('EG') = 'AF' and app.continent_of('JP') = 'AS' and app.continent_of('NZ') = 'OC',
    '0041: cada pais cae en su continente';
  assert app.continent_of('KZ') = 'EU' and app.continent_of('TL') = 'AS',
    '0041: un pais en dos continentes gana el primero (EU, AS, NA, SA, AF, OC)';
  assert app.continent_of('ZZ') is null and app.continent_of(null) is null and app.continent_of('es') is null,
    '0041: un codigo que no existe (o en minusculas) no tiene continente';
  raise notice 'OK · 0041: continent_of';
end
$$;

-- 3 · Cada validacion de la spec se rechaza (y ninguna gasta el token).
select public.expect_fail($q$select pg_temp.reg('{"legal":"Sur"}')$q$, '0041: nombre legal de menos de 5');
select public.expect_fail($q$select pg_temp.reg('{"tax":""}')$q$, '0041: NIF vacio');
select public.expect_fail($q$select pg_temp.reg('{"tax":"123456789012345678901"}')$q$, '0041: NIF de mas de 20');
select public.expect_fail($q$select pg_temp.reg(jsonb_build_object('address', repeat('a', 151)))$q$, '0041: direccion de mas de 150');
select public.expect_fail($q$select pg_temp.reg('{"postal":"12345678901"}')$q$, '0041: CP de mas de 10');
select public.expect_fail($q$select pg_temp.reg('{"country":"ZZ"}')$q$, '0041: pais de sede inexistente');
select public.expect_fail($q$select pg_temp.reg('{"cemail":"sin-arroba"}')$q$, '0041: email de contacto sin forma');
select public.expect_fail($q$select pg_temp.reg('{"cemail":"informacion.general@rodamientos-sur.test"}')$q$, '0041: email de contacto de mas de 30');
select public.expect_fail($q$select pg_temp.reg('{"phone":"954123456"}')$q$, '0041: telefono sin prefijo');
select public.expect_fail($q$select pg_temp.reg('{"web":"http://sur.test"}')$q$, '0041: web sin https');
select public.expect_fail($q$select pg_temp.reg('{"aname":"Juan"}')$q$, '0041: nombre del administrador de menos de 6');
select public.expect_fail($q$select pg_temp.reg('{"aemail":"no es email"}')$q$, '0041: email del administrador sin forma');
select public.expect_fail($q$select pg_temp.reg('{"ops":[]}')$q$, '0041: sin paises de operacion');
select public.expect_fail($q$select pg_temp.reg('{"ops":["ES","ZZ"]}')$q$, '0041: un pais de operacion inexistente');
select public.expect_fail($q$select pg_temp.reg('{"vis":"TODO"}')$q$, '0041: visibilidad invalida');
select public.expect_fail($q$select pg_temp.reg(jsonb_build_object('brands', (select jsonb_agg('m' || i) from generate_series(1, 21) i)))$q$, '0041: 21 marcas');
select public.expect_fail($q$select pg_temp.reg(jsonb_build_object('brands', jsonb_build_array(repeat('m', 61))))$q$, '0041: una marca de 61');
select public.expect_fail($q$select pg_temp.reg('{"user":"41f000ff-0000-0000-0000-0000000000ff"}')$q$, '0041: una cuenta de Auth que no existe');
select public.expect_fail($q$select pg_temp.reg('{"aemail":"a1@alpha.test","cemail":"x@sur.test"}')$q$, '0041: un email que ya es de un miembro');
select public.expect_fail($q$select pg_temp.reg('{"token":"no-es-un-token"}')$q$, '0041: un token que no existe');

do $$
begin
  assert exists (select 1 from public.registration_link_validate(current_setting('bw.rtok'))),
    '0041: tras tantos rechazos el token sigue valiendo (ninguno lo gasto)';
  assert not exists (select 1 from public.organizations where legal_name = 'Rodamientos del Sur SL'),
    '0041: y no se creo ninguna organizacion';
  raise notice 'OK · 0041: las validaciones rechazan y no gastan el token';
end
$$;

-- 4 · Un fallo DESPUES de canjear deshace el canje: el user ya es miembro (PK repetida
--     al insertar en `members`, lo ultimo que hace la funcion).
select public.expect_fail(
  $q$select pg_temp.reg('{"user":"0a000001-0000-0000-0000-000000000001","aemail":"nuevo@sur.test"}')$q$,
  '0041: si el alta falla al final, todo se deshace');

do $$
begin
  assert exists (select 1 from public.registration_link_validate(current_setting('bw.rtok'))),
    '0041: el canje se deshizo con el resto: el enlace sigue valiendo';
  assert not exists (select 1 from public.organizations where legal_name = 'Rodamientos del Sur SL'),
    '0041: y la organizacion a medio crear tampoco quedo';
  raise notice 'OK · 0041: un fallo tardio no gasta el token ni deja organizaciones a medias';
end
$$;

-- 5 · El camino feliz.
select pg_temp.reg() as org_id \gset

do $$
declare o record; m record; i record;
begin
  select * into o from public.organizations where legal_name = 'Rodamientos del Sur SL';
  assert o.id = (select org_id from public.organization_internal where tax_id = 'B-12345678'), '0041: el NIF cuelga de la organizacion';
  assert o.name = 'Rodamientos del Sur SL' and o.country = 'ES' and o.continent = 'EU' and o.status = 'APPROVED',
    '0041: nombre, pais, continente derivado y estado APPROVED';
  assert o.address = 'Calle Industria 47 Nave 3' and o.postal_code = '41900' and o.contact_email = 'info@sur.test'
     and o.contact_phone = '+34 954 123 456' and o.website = 'https://www.sur.test',
    '0041: direccion, CP, contacto, telefono y web';
  assert o.operating_countries = array['ES','PT'], '0041: paises de operacion sin repetidos y ordenados: ' || o.operating_countries::text;
  assert o.brands = array['FAG','NSK','SKF'], '0041: marcas recortadas, sin repetidos: ' || o.brands::text;
  assert o.inventory_visibility_mode = 'VISIBLE_TODOS', '0041: visibilidad';
  select * into m from public.members where id = '41f00001-0000-0000-0000-000000000001';
  assert m.org_id = o.id and m.role = 'ADMIN' and m.state = 'REGISTERED' and m.email = 'admin@sur.test'
     and m.full_name = 'Juan Martinez Herrera' and m.visibility_scope = 'ORG_METADATA',
    '0041: el usuario es ADMIN REGISTERED de la organizacion nueva';
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.rtok'))),
    '0041: el token se canjeo';
  assert app.redeem_registration_token(current_setting('bw.rtok')) is null, '0041: y no se canjea dos veces';
  raise notice 'OK · 0041: el alta crea organizacion, NIF y ADMIN REGISTERED, y gasta el token';
end
$$;

-- 6 · Reusar el enlace ya canjeado no crea otra organizacion.
select public.expect_fail(
  $q$select pg_temp.reg('{"user":"41f00002-0000-0000-0000-000000000002","aemail":"otro@sur.test","legal":"Otra Organizacion SL","cemail":"otra@sur.test"}')$q$,
  '0041: un enlace canjeado no da de alta una segunda organizacion');

-- 7 · El NIF: solo el ADMIN (activo) de SU organizacion.
begin;
  select set_config('request.jwt.claim.sub', :a1, true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.organization_internal) = 0,
      '0041: el ADMIN de otra organizacion no ve ningun NIF';
  end
  $$;
commit;

update public.members set state = 'ACTIVE' where id = '41f00001-0000-0000-0000-000000000001';

begin;
  select set_config('request.jwt.claim.sub', '41f00001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  begin
    assert (select count(*) from public.organization_internal) = 1
       and (select tax_id from public.organization_internal) = 'B-12345678',
      '0041: ANCLA POSITIVA -- el ADMIN activo de la organizacion lee su NIF, y solo el suyo';
    raise notice 'OK · 0041: el NIF solo lo lee el ADMIN de su organizacion';
  end
  $$;
commit;

-- 8 · 0042 · El email de contacto PUEDE ser el del administrador (C5 del PO, 29-sep). Una segunda
--     solicitud aprobada, con su token, y un alta cuyo contacto y administrador son el mismo.
insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, state)
values
  ('41410000-0000-4000-8000-000000000042', 'Mismo Email SL', 'ES', 'Mia Mismo', 'mismo@sur.test', 'INVITED_APPROVED');
insert into auth.users (id, email) values ('41f00003-0000-0000-0000-000000000003', 'mismo@sur.test');

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.rtok', (select token from public.issue_registration_link('41410000-0000-4000-8000-000000000042')), false);
commit;

select pg_temp.reg('{"user":"41f00003-0000-0000-0000-000000000003","aemail":"mismo@sur.test","cemail":"mismo@sur.test","legal":"Mismo Email SL"}') as org_mismo \gset

do $$
declare o record;
begin
  select * into o from public.organizations where legal_name = 'Mismo Email SL';
  assert o.contact_email = 'mismo@sur.test', '0042: el contacto publico es el email del administrador';
  assert (select email from public.members where id = '41f00003-0000-0000-0000-000000000003') = 'mismo@sur.test',
    '0042: y el administrador tiene ese mismo email';
  assert not exists (select 1 from public.registration_link_validate(current_setting('bw.rtok'))),
    '0042: y el token se canjeo';
  raise notice 'OK · 0042: el email de contacto puede ser el del administrador';
end
$$;

-- 9 · 0043 · El email de contacto NO puede ser el de OTRA organizacion (C5 del PO, 29-sep).
--     Propia organizacion y propia cuenta de solo-Auth: los bloques anteriores borran las suyas.
insert into public.organizations (id, name, country, continent, status, contact_email)
values ('43430000-0000-4000-8000-000000000001', 'Ocupada Test', 'FR', 'EU', 'APPROVED', 'contacto@ocupado.test');
insert into auth.users (id, email) values ('43430000-0000-4000-8000-0000000000aa', 'solo-auth@ocupado.test');

do $$
begin
  assert not has_function_privilege('anon', 'public.contact_email_available(text, text)', 'execute')
     and not has_function_privilege('authenticated', 'public.contact_email_available(text, text)', 'execute'),
    '0043: contact_email_available no la ejecuta anon ni authenticated (es un oraculo de emails)';
  assert has_function_privilege('service_role', 'public.contact_email_available(text, text)', 'execute'),
    '0043: ANCLA POSITIVA -- service_role SI';
  assert public.contact_email_available('libre@nadie.test', 'admin@nuevo.test'), '0043: un email libre vale';
  assert public.contact_email_available('admin@nuevo.test', 'ADMIN@nuevo.test'),
    '0043: el del propio administrador vale, sin mirar mayusculas';
  assert not public.contact_email_available('a1@alpha.test', 'admin@nuevo.test'),
    '0043: el email de acceso de un usuario de otra organizacion NO vale';
  assert not public.contact_email_available(' A1@Alpha.TEST ', 'admin@nuevo.test'),
    '0043: ni con espacios ni mayusculas';
  assert not public.contact_email_available('solo-auth@ocupado.test', 'admin@nuevo.test'),
    '0043: ni el de una cuenta que solo esta en auth.users';
  raise notice 'OK · 0043: contact_email_available';
end
$$;

-- El contacto publico de otra organizacion tampoco vale.
do $$
begin
  assert not public.contact_email_available('contacto@ocupado.test', 'admin@nuevo.test'),
    '0043: el contacto publico de otra organizacion NO vale';
  assert not public.contact_email_available('CONTACTO@ocupado.test', 'admin@nuevo.test'), '0043: sin mirar mayusculas';
  raise notice 'OK · 0043: tampoco el contacto publico de otra organizacion';
end
$$;

-- Y la funcion de alta lo rechaza (sin gastar el token). Una tercera solicitud aprobada.
insert into public.registration_requests
  (id, org_name, country, applicant_full_name, applicant_email, state)
values
  ('41410000-0000-4000-8000-000000000043', 'Contacto Ajeno SL', 'ES', 'Cora Ajena', 'cora@ajena.test', 'INVITED_APPROVED');
insert into auth.users (id, email) values ('41f00004-0000-0000-0000-000000000004', 'cora@ajena.test');

begin;
  select set_config('request.jwt.claim.sub', '0e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.rtok', (select token from public.issue_registration_link('41410000-0000-4000-8000-000000000043')), false);
commit;

select public.expect_fail(
  $q$select pg_temp.reg('{"user":"41f00004-0000-0000-0000-000000000004","aemail":"cora@ajena.test","cemail":"a1@alpha.test","legal":"Contacto Ajeno SL"}')$q$,
  '0043: un contacto que es el email de acceso de otra organizacion se rechaza');
select public.expect_fail(
  $q$select pg_temp.reg('{"user":"41f00004-0000-0000-0000-000000000004","aemail":"cora@ajena.test","cemail":"contacto@ocupado.test","legal":"Contacto Ajeno SL"}')$q$,
  '0043: y el contacto publico de otra organizacion tambien');

do $$
begin
  assert exists (select 1 from public.registration_link_validate(current_setting('bw.rtok'))),
    '0043: los rechazos no gastaron el token';
  perform pg_temp.reg('{"user":"41f00004-0000-0000-0000-000000000004","aemail":"cora@ajena.test","cemail":"cora@ajena.test","legal":"Contacto Ajeno SL"}');
  assert exists (select 1 from public.organizations where legal_name = 'Contacto Ajeno SL' and contact_email = 'cora@ajena.test'),
    '0043: y el del propio administrador SI se admite';
  raise notice 'OK · 0043: el alta rechaza el contacto ajeno y admite el propio';
end
$$;

-- -----------------------------------------------------------------------------
-- 0044 · import_inventory (INV-02)
-- -----------------------------------------------------------------------------
-- Una organización propia para que los recuentos no dependan de lo que las
-- secciones anteriores hayan hecho con Alpha/Beta. Un EDITOR activo, un ADMIN
-- REGISTERED (no puede) y una organización suspendida (tampoco).
insert into auth.users (id, email) values
  ('44000001-0000-0000-0000-000000000001', 'ed@imp.test'),
  ('44000002-0000-0000-0000-000000000002', 'reg@imp.test'),
  ('44000003-0000-0000-0000-000000000003', 'sus@imp.test');
insert into public.organizations (id, name, country, continent, status) values
  ('44440000-0000-4000-8000-000000000001', 'Importa SL', 'ES', 'EU', 'APPROVED'),
  ('44440000-0000-4000-8000-000000000002', 'Suspendida SL', 'ES', 'EU', 'APPROVED');
insert into public.members (id, org_id, email, role, state) values
  ('44000002-0000-0000-0000-000000000002', '44440000-0000-4000-8000-000000000001', 'reg@imp.test', 'ADMIN', 'REGISTERED'),
  ('44000001-0000-0000-0000-000000000001', '44440000-0000-4000-8000-000000000001', 'ed@imp.test', 'EDITOR', 'ACTIVE'),
  ('44000003-0000-0000-0000-000000000003', '44440000-0000-4000-8000-000000000002', 'sus@imp.test', 'ADMIN', 'ACTIVE');
update public.members set role = 'EDITOR', state = 'ACTIVE' where id = '44000001-0000-0000-0000-000000000001';
update public.members set state = 'ACTIVE' where id = '44000003-0000-0000-0000-000000000003';
update public.organizations set status = 'SUSPENDED' where id = '44440000-0000-4000-8000-000000000002';

-- Dos líneas ya publicadas y una archivada: la base sobre la que se importa.
insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status) values
  ('44440000-0000-4000-8000-000000000001', '6205-2RS', 'SKF', 10, 'ES', 'Rodamiento rigido de bolas', 'PUBLISHED'),
  ('44440000-0000-4000-8000-000000000001', 'NU216', 'FAG', 5, 'ES', 'Rodamiento de rodillos cilindricos', 'PUBLISHED'),
  ('44440000-0000-4000-8000-000000000001', '30204', 'TIMKEN', 2, 'DE', 'Rodamiento de rodillos conicos', 'ARCHIVED');

do $$
begin
  assert (select state from public.members where id = '44000001-0000-0000-0000-000000000001') = 'ACTIVE',
    '0044 (semilla): el EDITOR de Importa SL tiene que estar ACTIVE';
  assert not has_function_privilege('anon', 'public.import_inventory(jsonb,text,text,text,jsonb)', 'execute'),
    '0044: anon NO ejecuta import_inventory';
  assert has_function_privilege('authenticated', 'public.import_inventory(jsonb,text,text,text,jsonb)', 'execute'),
    '0044: authenticated SI ejecuta import_inventory';
  assert not has_table_privilege('authenticated', 'public.inventory_import_profiles', 'insert'),
    '0044: los perfiles no se escriben directamente';
  raise notice 'OK · 0044: privilegios de import_inventory y de los perfiles';
end
$$;

-- Quién NO puede.
begin;
  select set_config('request.jwt.claim.sub', '44000002-0000-0000-0000-000000000002', true);
  set local role authenticated;
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"}]', 'ACCUMULATE')$q$,
    '0044: un ADMIN REGISTERED no importa');
commit;
begin;
  select set_config('request.jwt.claim.sub', '44000003-0000-0000-0000-000000000003', true);
  set local role authenticated;
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"}]', 'ACCUMULATE')$q$,
    '0044: un miembro de una organización suspendida no importa');
commit;

-- Lotes inválidos: se rechazan enteros y sin escribir nada.
begin;
  select set_config('request.jwt.claim.sub', '44000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"}]', 'TODO')$q$,
    '0044: política desconocida');
  select public.expect_fail(
    $q$select public.import_inventory('[]', 'ACCUMULATE')$q$,
    '0044: lote vacío');
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":-1,"location_country":"ES","product_family":"X"}]', 'ACCUMULATE')$q$,
    '0044: cantidad negativa');
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"España","product_family":"X"}]', 'ACCUMULATE')$q$,
    '0044: país que no es ISO-2');
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"}]', 'ACCUMULATE', 'ab', 'sig', '[]')$q$,
    '0044: nombre de perfil corto (la familia vacía ya NO falla, 0045)');
  select public.expect_fail(
    format($q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"%s"}]', 'ACCUMULATE')$q$, repeat('x', 81)),
    '0045: una familia de más de 80 caracteres sigue rechazándose');
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"},{"part_number":"6205","brand":"skf","quantity":2,"location_country":"es","product_family":"X"}]', 'ACCUMULATE')$q$,
    '0044: líneas repetidas (sin mirar mayúsculas)');
  select public.expect_fail(
    $q$select public.import_inventory('[{"part_number":"6205","brand":"SKF","quantity":1,"location_country":"ES","product_family":"X"}]', 'ACCUMULATE', 'ab', 'sig', '[]')$q$,
    '0044: nombre de perfil de menos de 3 caracteres');
commit;

do $$
begin
  assert (select count(*) from public.inventory_lines where org_id = '44440000-0000-4000-8000-000000000001') = 3,
    '0044: ningún lote rechazado escribió nada';
  raise notice 'OK · 0044: quién no puede y qué lotes se rechazan';
end
$$;

-- Acumulativo: actualiza 6205 (con otra caja), inserta 7205B, no toca NU216, y
-- reactiva la archivada 30204/DE. Guarda un perfil.
begin;
  select set_config('request.jwt.claim.sub', '44000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.imp1', public.import_inventory(
    '[{"part_number":"6205-2rs","brand":"skf","quantity":40,"location_country":"es","product_family":"Rodamiento rigido de bolas","lead_time_days":3,"notes":" Almacén norte "},
      {"part_number":"7205B","brand":"SKF","quantity":7,"location_country":"FR","product_family":"Rodamiento de bolas de contacto angular"},
      {"part_number":"30204","brand":"Timken","quantity":9,"location_country":"DE","product_family":"Rodamiento de rodillos conicos"}]',
    'ACCUMULATE', ' Formato ERP ', 'ref|marca|uds|pais', '["part_number","brand","quantity","location_country"]')::text, false);
commit;

do $$
declare
  r jsonb := current_setting('bw.imp1')::jsonb;
  o uuid := '44440000-0000-4000-8000-000000000001';
begin
  assert (r->>'published')::int = 3, '0044: acumulativo publica las 3 líneas del lote';
  assert r->'removed' = 'null'::jsonb, '0044: acumulativo devuelve removed = null';
  assert (r->>'inserted')::int = 1 and (r->>'updated')::int = 2,
    '0046: acumulativo cuenta 1 línea nueva (7205B) y 2 que ya existían (6205 y la archivada 30204)';
  assert (select count(*) from public.inventory_lines where org_id = o) = 4, '0044: 3 que había + 1 nueva';
  assert (select quantity from public.inventory_lines where org_id = o and part_number = '6205-2RS') = 40,
    '0044: la existente se actualiza (sin mirar mayúsculas) y conserva su escritura original';
  assert (select notes from public.inventory_lines where org_id = o and part_number = '6205-2RS') = 'Almacén norte',
    '0044: las notas llegan recortadas';
  assert (select status from public.inventory_lines where org_id = o and part_number = 'NU216') = 'PUBLISHED',
    '0044: acumulativo no toca lo que no viene';
  assert (select status from public.inventory_lines where org_id = o and part_number = '30204') = 'PUBLISHED',
    '0044: una archivada que viene en el archivo vuelve a publicarse';
  assert (select location_country from public.inventory_lines where org_id = o and part_number = '7205B') = 'FR',
    '0044: la nueva entra con su país en mayúsculas';
  assert (select name from public.inventory_import_profiles where org_id = o and header_signature = 'ref|marca|uds|pais') = 'Formato ERP',
    '0044: el perfil se guarda con el nombre recortado';
  raise notice 'OK · 0044: importación acumulativa';
end
$$;

-- Reemplazo total: solo viene 6205. NU216, 7205B y 30204 pasan a DELETED.
-- Mismo perfil (misma estructura): se sobrescribe, no se duplica.
begin;
  select set_config('request.jwt.claim.sub', '44000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.imp2', public.import_inventory(
    '[{"part_number":"6205-2RS","brand":"SKF","quantity":41,"location_country":"ES","product_family":"Rodamiento rigido de bolas"}]',
    'REPLACE', 'Formato ERP v2', 'ref|marca|uds|pais', '["part_number","brand","quantity","location_country"]')::text, false);
  -- Por RLS, el EDITOR ve el perfil de su organización.
  select set_config('bw.imp_prof', (select count(*) from public.inventory_import_profiles)::text, false);
commit;

begin;
  select set_config('request.jwt.claim.sub', '0a000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.imp_prof_ajeno', (select count(*) from public.inventory_import_profiles)::text, false);
commit;

do $$
declare
  r jsonb := current_setting('bw.imp2')::jsonb;
  o uuid := '44440000-0000-4000-8000-000000000001';
begin
  assert (r->>'published')::int = 1, '0044: reemplazo publica la línea del lote';
  assert (r->>'removed')::int = 3, '0044: reemplazo retira las 3 publicadas que no vienen';
  assert (r->>'inserted')::int = 0 and (r->>'updated')::int = 1, '0046: reemplazo: 0 nuevas y 1 que ya existía';
  assert (select count(*) from public.inventory_lines where org_id = o and status = 'DELETED') = 3,
    '0044: retiradas = DELETED, sin borrar filas';
  assert (select count(*) from public.inventory_lines where org_id = o) = 4, '0044: ninguna fila borrada';
  assert (select notes from public.inventory_lines where org_id = o and part_number = '6205-2RS') is null,
    '0044: una línea sin notas en el archivo queda sin notas';
  assert (select count(*) from public.inventory_import_profiles where org_id = o) = 1,
    '0044: misma estructura, un solo perfil';
  assert (select name from public.inventory_import_profiles where org_id = o) = 'Formato ERP v2',
    '0044: el perfil se sobrescribe';
  assert current_setting('bw.imp_prof') = '1', '0044: el EDITOR lee el perfil de su organización';
  assert current_setting('bw.imp_prof_ajeno') = '0', '0044: otra organización no lo ve';
  raise notice 'OK · 0044: reemplazo total y perfiles';
end
$$;

-- 0045 · la familia es opcional: sin ella la línea entra, y una existente conserva la suya.
begin;
  select set_config('request.jwt.claim.sub', '44000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select set_config('bw.imp3', public.import_inventory(
    '[{"part_number":"ZZ-1","brand":"SKF","quantity":3,"location_country":"ES"},
      {"part_number":"ZZ-2","brand":"SKF","quantity":4,"location_country":"ES","product_family":""},
      {"part_number":"6205-2RS","brand":"SKF","quantity":50,"location_country":"ES"}]',
    'ACCUMULATE')::text, false);
commit;

do $$
declare o uuid := '44440000-0000-4000-8000-000000000001';
begin
  assert (current_setting('bw.imp3')::jsonb->>'published')::int = 3, '0045: las tres líneas sin familia entran';
  assert (current_setting('bw.imp3')::jsonb->>'inserted')::int = 2 and (current_setting('bw.imp3')::jsonb->>'updated')::int = 1,
    '0046: ZZ-1 y ZZ-2 nuevas, 6205-2RS ya existía';
  assert (select product_family from public.inventory_lines where org_id = o and part_number = 'ZZ-1') is null,
    '0045: sin familia en el archivo, NULL';
  assert (select product_family from public.inventory_lines where org_id = o and part_number = 'ZZ-2') is null,
    '0045: una familia vacía es NULL, no cadena vacía';
  assert (select product_family from public.inventory_lines where org_id = o and part_number = '6205-2RS') = 'Rodamiento rigido de bolas',
    '0045: una línea existente conserva su familia si el archivo no la trae';
  assert (select quantity from public.inventory_lines where org_id = o and part_number = '6205-2RS') = 50,
    '0045: y se actualiza lo demás';
  raise notice 'OK · 0045: familia opcional';
end
$$;

-- -----------------------------------------------------------------------------
-- F-155 · la premisa que hace inmune a `security definer`, comprobada
-- -----------------------------------------------------------------------------
-- Que un ayudante `security definer` no vea RLS no es un axioma: depende de dos
-- cosas que hoy se cumplen y que una migración futura puede romper sin tocar
-- ninguna función. Si alguna de las dos cae, `app.can_access_thread`,
-- `app.thread_counterpart` y `app.org_already_inquired` vuelven a filtrar por
-- RLS y F-148 renace entero, en silencio y en todas partes a la vez.
do $$
declare
  forzadas text;
  ajenas   text;
  dueno    oid;
begin
  select string_agg(c.relname, ', ' order by c.relname) into forzadas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity;

  assert forzadas is null,
    'F-155: estas tablas tienen FORCE ROW LEVEL SECURITY, asi que RLS le aplica tambien a su dueno y los ayudantes security definer dejan de ser inmunes: '
    || coalesce(forzadas, '');

  select c.relowner into dueno
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'thread_items';

  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname || '.' || p.proname) into ajenas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public') and p.prosecdef and p.proowner <> dueno;

  assert ajenas is null,
    'F-155: estas funciones security definer no son del dueno de las tablas, asi que siguen sujetas a RLS: '
    || coalesce(ajenas, '');

  raise notice 'OK · F-155: ninguna tabla fuerza RLS sobre su dueno y todo security definer es del dueno de las tablas';
end
$$;

-- -----------------------------------------------------------------------------
-- 0048 · REG-07: subir el backup de la clave y confirmarlo (ADR-001 §6–§7.1)
-- -----------------------------------------------------------------------------
-- Con los miembros de Echo de 0038: e3 y e4 siguen REGISTERED, e1 es ADMIN ACTIVE.
-- Bytes de relleno con la forma exacta: pública 32, blob 48, IV 12, sal 32.
do $$
begin
  assert not has_function_privilege('anon', 'public.store_key_backup(bytea,bytea,bytea,bytea,jsonb)', 'execute'),
    '0048: anon no sube backups';
  assert not has_function_privilege('anon', 'public.confirm_key_backup(bytea)', 'execute'), '0048: anon no confirma';
  assert not has_function_privilege('authenticated', 'app.kdf_params_v1()', 'execute'), '0048: los parametros son internos';
  assert has_function_privilege('authenticated', 'public.store_key_backup(bytea,bytea,bytea,bytea,jsonb)', 'execute'),
    '0048: el ancla positiva -- authenticated SI sube su backup';
  assert has_function_privilege('authenticated', 'public.confirm_key_backup(bytea)', 'execute'),
    '0048: y SI lo confirma';
  raise notice 'OK · 0048: privilegios leidos del catalogo';
end
$$;

-- 1 · La forma la decide el servidor, no el cliente; y sin backup no hay confirmacion.
begin;
  select set_config('request.jwt.claim.sub', '1e000003-0000-0000-0000-000000000003', true);
  set local role authenticated;
  select public.expect_fail($q$select public.confirm_key_backup(decode(repeat('a1', 32), 'hex'))$q$,
    '0048: no se confirma un backup que no existe');
  select public.expect_fail($q$select public.store_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b1', 47), 'hex'),
      decode(repeat('c1', 12), 'hex'), decode(repeat('d1', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}')$q$,
    '0048: un blob que no es de 48 bytes (32 + etiqueta GCM) no entra');
  select public.expect_fail($q$select public.store_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b1', 48), 'hex'),
      decode(repeat('c1', 12), 'hex'), decode(repeat('d1', 32), 'hex'), '{"algo":"argon2id","m":1024,"t":1,"p":1,"v":19}')$q$,
    '0048: ni unos parametros de Argon2id mas flojos que los de ADR-001');
  select public.expect_fail($q$select public.store_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b1', 48), 'hex'),
      decode(repeat('c1', 16), 'hex'), decode(repeat('d1', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}')$q$,
    '0048: ni un IV de 16');
commit;

-- 2 · Subir: los cinco campos, y la cuenta SIGUE REGISTERED. Se puede repetir entero.
begin;
  select set_config('request.jwt.claim.sub', '1e000003-0000-0000-0000-000000000003', true);
  set local role authenticated;
  select public.store_key_backup(decode(repeat('a0', 32), 'hex'), decode(repeat('b0', 48), 'hex'),
      decode(repeat('c0', 12), 'hex'), decode(repeat('d0', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
  select public.store_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b1', 48), 'hex'),
      decode(repeat('c1', 12), 'hex'), decode(repeat('d1', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
  select public.expect_fail($q$select public.confirm_key_backup(decode(repeat('a0', 32), 'hex'))$q$,
    '0048: no se confirma una publica que ya no es la del backup');
commit;

do $$
declare v record;
begin
  select * into v from public.members where id = '1e000003-0000-0000-0000-000000000003';
  assert v.state = 'REGISTERED', '0048: subir el backup no cambia el estado, es ' || v.state;
  assert v.public_key = decode(repeat('a1', 32), 'hex') and v.encrypted_key_blob = decode(repeat('b1', 48), 'hex')
     and v.key_iv = decode(repeat('c1', 12), 'hex') and v.argon2_salt = decode(repeat('d1', 32), 'hex')
     and v.kdf_params = '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}'::jsonb,
    '0048: la segunda subida sobrescribe la primera, los cinco campos';
  raise notice 'OK · 0048: store_key_backup guarda los cinco campos y deja la cuenta REGISTERED';
end
$$;

-- 3 · Confirmar: KEY_ACTIVE. Repetir la misma subida o la misma confirmacion es un
-- no-op (respuesta perdida); una subida distinta ya no entra.
begin;
  select set_config('request.jwt.claim.sub', '1e000003-0000-0000-0000-000000000003', true);
  set local role authenticated;
  select public.confirm_key_backup(decode(repeat('a1', 32), 'hex'));
  select public.confirm_key_backup(decode(repeat('a1', 32), 'hex'));
  select public.store_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b1', 48), 'hex'),
      decode(repeat('c1', 12), 'hex'), decode(repeat('d1', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
  select public.expect_fail($q$select public.store_key_backup(decode(repeat('a2', 32), 'hex'), decode(repeat('b2', 48), 'hex'),
      decode(repeat('c2', 12), 'hex'), decode(repeat('d2', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}')$q$,
    '0048: con la cuenta en KEY_ACTIVE no se sustituye la clave (eso es SET-SEC-01)');
commit;

-- 4 · Un miembro que ya esta ACTIVE no pasa por REG-07.
begin;
  select set_config('request.jwt.claim.sub', '1e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_fail($q$select public.store_key_backup(decode(repeat('a3', 32), 'hex'), decode(repeat('b3', 48), 'hex'),
      decode(repeat('c3', 12), 'hex'), decode(repeat('d3', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}')$q$,
    '0048: un ADMIN ACTIVE no sube un backup nuevo por aqui');
commit;

do $$
begin
  assert (select state from public.members where id = '1e000003-0000-0000-0000-000000000003') = 'KEY_ACTIVE',
    '0048: la confirmacion deja al miembro KEY_ACTIVE';
  assert (select public_key from public.members where id = '1e000003-0000-0000-0000-000000000003') = decode(repeat('a1', 32), 'hex'),
    '0048: con la publica del backup confirmado';
  assert (select state from public.members where id = '1e000004-0000-0000-0000-000000000004') = 'REGISTERED'
     and (select encrypted_key_blob from public.members where id = '1e000004-0000-0000-0000-000000000004') is null,
    '0048: y a los demas como estaban';
  assert (select encrypted_key_blob from public.members where id = '1e000001-0000-0000-0000-000000000001') is null,
    '0048: el ADMIN ACTIVE sigue sin backup';
  raise notice 'OK · 0048: confirm_key_backup pasa a KEY_ACTIVE y las repeticiones son no-op';
end
$$;

-- -----------------------------------------------------------------------------
-- 0049 · REC-01 y SET-SEC-01: recuperar la clave y cambiar la frase (ADR-001 §7.2, §8)
-- -----------------------------------------------------------------------------
-- e3 es EDITOR y esta KEY_ACTIVE con el backup a1/b1/c1/d1 de 0048. Las funciones son
-- security definer y leen auth.uid() del claim, asi que se llaman desde un DO fijandolo.
do $$
begin
  assert not has_function_privilege('anon', 'public.begin_key_recovery()', 'execute'), '0049: anon no pide backups';
  assert not has_function_privilege('anon', 'public.replace_key_backup(bytea,bytea,bytea,bytea,jsonb)', 'execute'), '0049: anon no sustituye';
  assert not has_function_privilege('anon', 'public.discard_key_backup()', 'execute'), '0049: anon no descarta';
  assert has_function_privilege('authenticated', 'public.begin_key_recovery()', 'execute'),
    '0049: el ancla positiva -- authenticated SI pide su backup';
  assert has_function_privilege('authenticated', 'public.replace_key_backup(bytea,bytea,bytea,bytea,jsonb)', 'execute'),
    '0049: y SI lo sustituye';
  assert not has_table_privilege('authenticated', 'public.key_recovery_attempts', 'select'),
    '0049: el contador no se lee';
  assert not has_table_privilege('authenticated', 'public.key_recovery_attempts', 'update'),
    '0049: ni se escribe';
  raise notice 'OK · 0049: privilegios leidos del catalogo';
end
$$;

do $$
declare
  r record;
  n integer;
begin
  perform set_config('request.jwt.claim.sub', '1e000003-0000-0000-0000-000000000003', true);

  -- Cinco peticiones devuelven el backup, con 4, 3, 2, 1 y 0 intentos; solo la quinta abre los 30 minutos.
  for n in 1..5 loop
    select * into r from public.begin_key_recovery();
    assert r.status = 'ok' and r.encrypted_key_blob = decode(repeat('b1', 48), 'hex')
       and r.public_key = decode(repeat('a1', 32), 'hex'), '0049: el intento ' || n || ' devuelve el backup';
    assert r.attempts_left = 5 - n, '0049: tras el intento ' || n || ' quedan ' || (5 - n);
    assert (n < 5 and r.seconds_left = 0) or (n = 5 and r.seconds_left between 1790 and 1800),
      '0049: la cuenta atras empieza en el quinto';
  end loop;

  -- La sexta: locked y ningun byte.
  select * into r from public.begin_key_recovery();
  assert r.status = 'locked' and r.encrypted_key_blob is null and r.public_key is null and r.argon2_salt is null
     and r.seconds_left between 1790 and 1800, '0049: la sexta peticion recibe locked y nada del backup';

  -- 0052: no hay forma de reiniciar el contador desde fuera; end_key_recovery ya no existe.
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'end_key_recovery'),
    '0052: end_key_recovery se ha eliminado';
  select * into r from public.begin_key_recovery();
  assert r.status = 'locked', '0052: sigue bloqueado: nada lo reinicia';

  -- Un bloqueo vencido se olvida: se envejece la fila a mano.
  update public.key_recovery_attempts set attempts = 5, locked_until = now() - interval '1 second'
   where member_id = '1e000003-0000-0000-0000-000000000003';
  select * into r from public.begin_key_recovery();
  assert r.status = 'ok' and r.attempts_left = 4, '0049: pasados los 30 minutos se empieza de cero';

  -- 0052: ventana fija de 30 minutos. Dentro de ella se acumula; vencida, empieza otra.
  update public.key_recovery_attempts set attempts = 2, locked_until = null, window_started_at = now() - interval '10 minutes'
   where member_id = '1e000003-0000-0000-0000-000000000003';
  select * into r from public.begin_key_recovery();
  assert r.status = 'ok' and r.attempts_left = 2, '0052: dentro de la ventana el intento 3 deja 2, dijo: ' || r.attempts_left;
  update public.key_recovery_attempts set attempts = 4, locked_until = null, window_started_at = now() - interval '31 minutes'
   where member_id = '1e000003-0000-0000-0000-000000000003';
  select * into r from public.begin_key_recovery();
  assert r.status = 'ok' and r.attempts_left = 4, '0052: vencida la ventana se empieza de cero, dijo: ' || r.attempts_left;
  update public.key_recovery_attempts set attempts = 4, locked_until = null, window_started_at = now() - interval '5 minutes'
   where member_id = '1e000003-0000-0000-0000-000000000003';
  select * into r from public.begin_key_recovery();
  assert r.status = 'ok' and r.attempts_left = 0 and r.seconds_left between 1790 and 1800,
    '0052: el quinto de la ventana cierra el grifo, dijo: ' || r.attempts_left || '/' || r.seconds_left;
  select * into r from public.begin_key_recovery();
  assert r.status = 'locked' and r.encrypted_key_blob is null, '0052: y el sexto, nada';
  -- Se deja el contador como lo esperan los bloques siguientes (uno en ventana nueva).
  delete from public.key_recovery_attempts where member_id = '1e000003-0000-0000-0000-000000000003';

  raise notice 'OK · 0049: begin_key_recovery cuenta cinco peticiones por ventana de media hora';
end
$$;

-- Quien no tiene backup no lo pide (e4 es REGISTERED); y descartar es de un miembro activo
-- (0050: tambien de un EDITOR; lo que no puede es un REGISTERED, que no tiene nada que descartar).
do $$
begin
  perform set_config('request.jwt.claim.sub', '1e000004-0000-0000-0000-000000000004', true);
  begin
    perform * from public.begin_key_recovery();
    raise exception 'DEBIA FALLAR';
  exception when others then
    assert sqlerrm like '%no tiene un backup%', '0049: un REGISTERED no pide backup, dijo: ' || sqlerrm;
  end;
  begin
    perform public.discard_key_backup();
    raise exception 'DEBIA FALLAR';
  exception when others then
    assert sqlerrm like 'Solo un miembro activo%', '0050: un REGISTERED no descarta nada, dijo: ' || sqlerrm;
  end;
  raise notice 'OK · 0049: un REGISTERED no pide backup ni descarta';
end
$$;

-- SET-SEC-01: misma publica, otro blob. Con otra publica, o con la forma mala, no.
do $$
begin
  perform set_config('request.jwt.claim.sub', '1e000003-0000-0000-0000-000000000003', true);
  perform public.replace_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b9', 48), 'hex'),
    decode(repeat('c9', 12), 'hex'), decode(repeat('d9', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
  assert (select encrypted_key_blob from public.members where id = '1e000003-0000-0000-0000-000000000003') = decode(repeat('b9', 48), 'hex')
     and (select public_key from public.members where id = '1e000003-0000-0000-0000-000000000003') = decode(repeat('a1', 32), 'hex')
     and (select state from public.members where id = '1e000003-0000-0000-0000-000000000003') = 'KEY_ACTIVE',
    '0049: replace_key_backup cambia el blob y deja la publica y el estado';
  perform public.begin_key_recovery();
  perform public.replace_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b9', 48), 'hex'),
    decode(repeat('c9', 12), 'hex'), decode(repeat('d9', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
  assert (select attempts from public.key_recovery_attempts where member_id = '1e000003-0000-0000-0000-000000000003') = 1,
    '0052: cambiar la frase NO reinicia el contador';
  begin
    perform public.replace_key_backup(decode(repeat('a2', 32), 'hex'), decode(repeat('b2', 48), 'hex'),
      decode(repeat('c2', 12), 'hex'), decode(repeat('d2', 32), 'hex'), '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}');
    raise exception 'DEBIA FALLAR';
  exception when others then
    assert sqlerrm like 'El cambio de frase no puede cambiar la clave%', '0049: otra publica no entra, dijo: ' || sqlerrm;
  end;
  begin
    perform public.replace_key_backup(decode(repeat('a1', 32), 'hex'), decode(repeat('b2', 48), 'hex'),
      decode(repeat('c2', 12), 'hex'), decode(repeat('d2', 32), 'hex'), '{"algo":"argon2id","m":1024,"t":1,"p":1,"v":19}');
    raise exception 'DEBIA FALLAR';
  exception when others then
    assert sqlerrm like 'Par%metros de derivaci%', '0049: unos parametros flojos no entran, dijo: ' || sqlerrm;
  end;
  raise notice 'OK · 0049: replace_key_backup mantiene la clave y solo cambia la envoltura';
end
$$;

-- discard_key_backup: un ADMIN activo vuelve a REGISTERED sin nada de clave. Se deshace al final.
do $$
begin
  perform set_config('request.jwt.claim.sub', '1e000001-0000-0000-0000-000000000001', true);
  -- e1 (ADMIN ACTIVE): se le da un backup de prueba, se descarta, y se le devuelve a como estaba.
  update public.members set public_key = decode(repeat('a7', 32), 'hex'), encrypted_key_blob = decode(repeat('b7', 48), 'hex'),
         key_iv = decode(repeat('c7', 12), 'hex'), argon2_salt = decode(repeat('d7', 32), 'hex'),
         kdf_params = '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}'::jsonb
   where id = '1e000001-0000-0000-0000-000000000001';
  perform public.begin_key_recovery();
  perform public.discard_key_backup();
  assert (select state from public.members where id = '1e000001-0000-0000-0000-000000000001') = 'REGISTERED'
     and (select public_key from public.members where id = '1e000001-0000-0000-0000-000000000001') is null
     and (select encrypted_key_blob from public.members where id = '1e000001-0000-0000-0000-000000000001') is null
     and (select kdf_params from public.members where id = '1e000001-0000-0000-0000-000000000001') is null,
    '0049: discard_key_backup deja al ADMIN REGISTERED y sin nada de clave';
  assert not exists (select 1 from public.key_recovery_attempts where member_id = '1e000001-0000-0000-0000-000000000001'),
    '0049: y sin contador';
  update public.members set state = 'ACTIVE' where id = '1e000001-0000-0000-0000-000000000001';
  raise notice 'OK · 0049: discard_key_backup devuelve al ADMIN a REGISTERED';
end
$$;

-- -----------------------------------------------------------------------------
-- 0050 · Canje de invitacion (INVT-02) y activacion de un EDITOR (ACT-02)
-- -----------------------------------------------------------------------------
-- Organizacion propia (Golf Test): ADMIN x1, EDITOR x2. Se borra al final.
insert into public.organizations (id, name, country, continent, status)
values ('55555555-5555-5555-5555-555555555555', 'Golf Test', 'PT', 'EU', 'APPROVED');
insert into auth.users (id, email) values
  ('5e000001-0000-0000-0000-000000000001', 'x1@echo.test'),
  ('5e000002-0000-0000-0000-000000000002', 'x2@echo.test');
insert into public.members (id, org_id, email, full_name, state)
values ('5e000001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'x1@echo.test', 'Ada Admin', 'ACTIVE');
insert into public.members (id, org_id, email, state)
values ('5e000002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'x2@echo.test', 'ACTIVE');

do $$
begin
  assert not has_function_privilege('anon', 'public.issue_invitation_link(uuid)', 'execute'), '0050: anon no genera enlaces';
  assert not has_function_privilege('anon', 'public.revoke_invitation(uuid)', 'execute'), '0050: anon no anula';
  assert not has_function_privilege('anon', 'public.invitation_link_validate(text)', 'execute'), '0050: anon no valida';
  assert not has_function_privilege('anon', 'public.redeem_invitation(text,uuid,text)', 'execute'), '0050: anon no canjea';
  assert not has_function_privilege('authenticated', 'public.invitation_link_validate(text)', 'execute'),
    '0050: ni un miembro con sesion valida: es de la funcion de borde';
  assert not has_function_privilege('authenticated', 'public.redeem_invitation(text,uuid,text)', 'execute'),
    '0050: ni canjea';
  assert has_function_privilege('service_role', 'public.invitation_link_validate(text)', 'execute')
     and has_function_privilege('service_role', 'public.redeem_invitation(text,uuid,text)', 'execute'),
    '0050: el ancla positiva -- service_role SI valida y canjea';
  assert has_function_privilege('authenticated', 'public.issue_invitation_link(uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.revoke_invitation(uuid)', 'execute'),
    '0050: y authenticated SI genera y anula (la funcion comprueba que sea ADMIN)';
  raise notice 'OK · 0050: privilegios leidos del catalogo';
end
$$;

-- El enlace: solo lo genera el ADMIN de la organizacion; se guarda el hash; el nuevo revoca el viejo.
do $$
declare
  v_id uuid; v_tok text; v_tok2 text; v_exp timestamptz; r record;
begin
  perform set_config('request.jwt.claim.sub', '5e000002-0000-0000-0000-000000000002', true);
  begin perform public.invite_member('nuevo@echo.test'); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'Solo el administrador%', '0050: un EDITOR no invita'; end;

  perform set_config('request.jwt.claim.sub', '5e000001-0000-0000-0000-000000000001', true);
  v_id := public.invite_member('nuevo@echo.test');

  perform set_config('request.jwt.claim.sub', '5e000002-0000-0000-0000-000000000002', true);
  begin perform public.issue_invitation_link(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'Solo el administrador%', '0050: un EDITOR no genera el enlace'; end;
  begin perform public.revoke_invitation(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'Solo el administrador%', '0050: ni anula'; end;

  perform set_config('request.jwt.claim.sub', '5e000001-0000-0000-0000-000000000001', true);
  select t.token, t.expires_at into v_tok, v_exp from public.issue_invitation_link(v_id) t;
  assert v_tok ~ '^[0-9a-f]{64}$', '0050: el token son 64 hexadecimales';
  assert v_exp = (select expires_at from public.member_invitations where id = v_id), '0050: el enlace vence con la invitacion';
  assert not exists (select 1 from public.access_tokens where token_hash = v_tok), '0050: el token no se guarda';
  assert exists (select 1 from public.access_tokens where purpose = 'MEMBER_INVITATION' and member_invitation_id = v_id
                    and token_hash = encode(sha256(convert_to(v_tok, 'UTF8')), 'hex')), '0050: solo su hash';

  select * into r from public.invitation_link_validate(v_tok);
  assert r.status = 'OK' and r.org_name = 'Golf Test' and r.inviter_name = 'Ada Admin' and r.email = 'nuevo@echo.test',
    '0050: validar devuelve la invitacion, dijo: ' || coalesce(r.status, 'nada');
  assert not exists (select 1 from public.invitation_link_validate('no-es-un-token')), '0050: un token que no existe, ninguna fila';

  select t.token into v_tok2 from public.issue_invitation_link(v_id) t;
  assert v_tok2 <> v_tok, '0050: otro enlace, otro token';
  assert not exists (select 1 from public.invitation_link_validate(v_tok)), '0050: el anterior ya no vale';
  assert (select count(*) from public.access_tokens where member_invitation_id = v_id and revoked_at is null and used_at is null) = 1,
    '0050: un solo enlace vigente por invitacion';
  raise notice 'OK · 0050: el enlace se genera una vez, con hash, y el nuevo revoca el anterior';
end
$$;

-- Canjear: crea el miembro REGISTERED con el correo de la INVITACION; un solo uso.
do $$
declare
  v_id uuid; v_tok text; v_org uuid; seats_before int;
begin
  select id into v_id from public.member_invitations where email = 'nuevo@echo.test';
  perform set_config('request.jwt.claim.sub', '5e000001-0000-0000-0000-000000000001', true);
  select t.token into v_tok from public.issue_invitation_link(v_id) t;
  seats_before := app.org_seats_used('55555555-5555-5555-5555-555555555555');

  insert into auth.users (id, email) values ('5e000003-0000-0000-0000-000000000003', 'nuevo@echo.test');
  begin perform public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', 'A');
    raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'Datos no validos%', '0050: un nombre de un caracter no entra, dijo: ' || sqlerrm; end;

  v_org := public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', '  Nuria Nueva ');
  assert v_org = '55555555-5555-5555-5555-555555555555', '0050: devuelve la organizacion';
  assert (select role || '/' || state || '/' || email || '/' || full_name from public.members where id = '5e000003-0000-0000-0000-000000000003')
         = 'EDITOR/REGISTERED/nuevo@echo.test/Nuria Nueva', '0050: nace EDITOR REGISTERED con el correo de la invitacion';
  assert (select status from public.member_invitation_list where id = v_id) = 'Aceptada', '0050: la invitacion queda Aceptada';
  assert app.org_seats_used('55555555-5555-5555-5555-555555555555') = seats_before, '0050: la plaza no se cuenta dos veces';

  begin perform public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', 'Otra Vez');
    raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'El enlace no es valido%', '0050: un enlace canjeado no se canjea otra vez, dijo: ' || sqlerrm; end;
  assert not exists (select 1 from public.invitation_link_validate(v_tok)), '0050: ni se valida';
  begin perform public.issue_invitation_link(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like '%ya fue aceptada%', '0050: ni se le genera otro enlace'; end;
  raise notice 'OK · 0050: redeem_invitation crea un EDITOR REGISTERED y es de un solo uso';
end
$$;

-- Anular: libera la plaza, mata el enlace, y el mismo correo se puede volver a invitar.
do $$
declare
  v_id uuid; v_tok text; seats int;
begin
  perform set_config('request.jwt.claim.sub', '5e000001-0000-0000-0000-000000000001', true);
  v_id := public.invite_member('otro@echo.test');
  select t.token into v_tok from public.issue_invitation_link(v_id) t;
  seats := app.org_seats_used('55555555-5555-5555-5555-555555555555');

  perform public.revoke_invitation(v_id);
  assert (select status from public.member_invitation_list where id = v_id) = 'Anulada', '0050: Anulada';
  assert app.org_seats_used('55555555-5555-5555-5555-555555555555') = seats - 1, '0050: libera la plaza';
  assert not exists (select 1 from public.invitation_link_validate(v_tok)), '0050: el enlace anulado no vale';
  begin perform public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', 'Nadie');
    raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'El enlace no es valido%', '0050: ni se canjea'; end;
  begin perform public.revoke_invitation(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like '%ya est%anulada%', '0050: anular dos veces falla'; end;
  begin perform public.issue_invitation_link(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like '%anulada%', '0050: a una anulada no se le genera enlace'; end;

  -- Volver a invitar al mismo correo reutiliza la fila; Reenviar tambien renueva una anulada.
  assert public.invite_member('otro@echo.test') = v_id, '0050: misma fila para el mismo correo';
  assert (select status from public.member_invitation_list where id = v_id) = 'Pendiente', '0050: otra vez Pendiente';
  perform public.revoke_invitation(v_id);
  perform public.resend_invitation(v_id);
  assert (select status from public.member_invitation_list where id = v_id) = 'Pendiente', '0050: Reenviar renueva una anulada';
  raise notice 'OK · 0050: revoke_invitation anula, libera la plaza y se puede reinvitar';
end
$$;

-- Caducada, correo existente y organizacion llena: lo que dice validate y lo que niega redeem.
do $$
declare
  v_id uuid; v_tok text; r record;
begin
  perform set_config('request.jwt.claim.sub', '5e000001-0000-0000-0000-000000000001', true);
  v_id := (select id from public.member_invitations where email = 'otro@echo.test');
  select t.token into v_tok from public.issue_invitation_link(v_id) t;

  -- FULL: 3 miembros + esta + 2 de relleno = 6 plazas; sin contar la suya, 5.
  insert into public.member_invitations (org_id, email) values
    ('55555555-5555-5555-5555-555555555555', 'r1@echo.test'),
    ('55555555-5555-5555-5555-555555555555', 'r2@echo.test');
  select * into r from public.invitation_link_validate(v_tok);
  assert r.status = 'FULL', '0050: organizacion llena, dijo: ' || coalesce(r.status, 'nada');
  begin perform public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', 'Lleno');
    raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like '%l_mite de 5%', '0050: redeem respeta el limite, dijo: ' || sqlerrm; end;
  delete from public.member_invitations where email in ('r1@echo.test', 'r2@echo.test');

  -- EXISTS: el correo de la invitacion ya tiene cuenta.
  insert into auth.users (id, email) values ('5e000004-0000-0000-0000-000000000004', 'otro@echo.test');
  select * into r from public.invitation_link_validate(v_tok);
  assert r.status = 'EXISTS', '0050: correo ya registrado, dijo: ' || coalesce(r.status, 'nada');
  delete from auth.users where id = '5e000004-0000-0000-0000-000000000004';

  -- EXPIRED: se envejece la fila a mano.
  update public.member_invitations set sent_at = now() - interval '8 days', expires_at = now() - interval '1 day' where id = v_id;
  select * into r from public.invitation_link_validate(v_tok);
  assert r.status = 'EXPIRED', '0050: caducada, dijo: ' || coalesce(r.status, 'nada');
  begin perform public.redeem_invitation(v_tok, '5e000003-0000-0000-0000-000000000003', 'Tarde');
    raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'El enlace no es valido%', '0050: una caducada no se canjea'; end;
  begin perform public.issue_invitation_link(v_id); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like '%expirado%', '0050: ni se le genera enlace'; end;
  perform public.resend_invitation(v_id);
  select t.token into v_tok from public.issue_invitation_link(v_id) t;
  assert (select status from public.invitation_link_validate(v_tok)) = 'OK', '0050: renovada y con enlace nuevo, vale';
  raise notice 'OK · 0050: validate distingue caducada, existente y llena; redeem las niega';
end
$$;

-- ACT-02: un EDITOR KEY_ACTIVE se activa solo y puede empezar con una clave nueva.
do $$
begin
  update public.members set state = 'KEY_ACTIVE', public_key = decode(repeat('e1', 32), 'hex'),
         encrypted_key_blob = decode(repeat('e2', 48), 'hex'), key_iv = decode(repeat('e3', 12), 'hex'),
         argon2_salt = decode(repeat('e4', 32), 'hex'), kdf_params = '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}'::jsonb
   where id = '5e000003-0000-0000-0000-000000000003';
  perform set_config('request.jwt.claim.sub', '5e000003-0000-0000-0000-000000000003', true);
  perform public.activate_own_membership();
  assert (select state from public.members where id = '5e000003-0000-0000-0000-000000000003') = 'ACTIVE',
    '0050: un EDITOR KEY_ACTIVE pasa a ACTIVE';
  begin perform public.activate_own_membership(); raise exception 'DEBIA FALLAR';
  exception when others then assert sqlerrm like 'Tu cuenta no est%', '0050: y solo una vez'; end;

  perform public.discard_key_backup();
  assert (select state || '/' || coalesce(public_key::text, 'null') || '/' || coalesce(encrypted_key_blob::text, 'null')
            from public.members where id = '5e000003-0000-0000-0000-000000000003') = 'REGISTERED/null/null',
    '0050: un EDITOR activo empieza con una clave nueva: REGISTERED y sin nada de clave';
  raise notice 'OK · 0050: un EDITOR se activa solo y puede descartar su backup';
end
$$;

delete from public.member_invitations where org_id = '55555555-5555-5555-5555-555555555555';
delete from public.members where org_id = '55555555-5555-5555-5555-555555555555';
delete from auth.users where id::text like '5e00000%';
delete from public.organizations where id = '55555555-5555-5555-5555-555555555555';

-- -----------------------------------------------------------------------------
-- 0051 · F-234 en la mensajeria: las funciones de sesion de las ocho politicas van envueltas
-- -----------------------------------------------------------------------------
-- Se lee del CATALOGO (pg_policies), no del .sql. Postgres normaliza `(select app.f())` como
-- `( SELECT app.f() AS f)`: se quitan esos envoltorios y no debe quedar ninguna llamada a pelo.
-- El comportamiento (quien ve y escribe que) lo miden los bloques anteriores de este banco.
do $$
declare
  r record;
  e text;
  n int := 0;
begin
  for r in
    select tablename, policyname, cmd, roles::text as roles, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
      from pg_policies
     where schemaname = 'public'
       and tablename in ('threads', 'thread_items', 'thread_item_keys')
       and policyname in ('threads_insert_participant', 'threads_select_participant', 'threads_update_participant',
                          'thread_items_insert_own', 'thread_items_select_participant', 'thread_items_update_participant',
                          'item_keys_insert_sender', 'item_keys_select_own')
  loop
    n := n + 1;
    assert r.roles = '{authenticated}', '0051: ' || r.policyname || ' sigue siendo solo de authenticated';
    e := regexp_replace(r.expr, '\(\s*SELECT\s+(app\.[a-z_]+\(\)|auth\.uid\(\))\s+AS\s+[a-z_]+\)', '', 'gi');
    assert e !~* 'app\.(current_org_id|is_active_member|caller_bypasses_visibility_scope)\(\)' and e !~* 'auth\.uid\(\)',
      '0051: ' || r.policyname || ' tiene una funcion de sesion a pelo: ' || e;
    assert r.expr ~* 'SELECT\s+(app\.[a-z_]+\(\)|auth\.uid\(\))',
      '0051: ' || r.policyname || ' envuelve al menos una funcion';
  end loop;
  assert n = 8, '0051: las ocho politicas existen, hay ' || n;
  -- Lo que depende de la fila NO se envuelve: se queda como estaba.
  assert (select qual from pg_policies where policyname = 'thread_items_select_participant') ~ 'app\.can_access_thread\(thread_id\)',
    '0051: can_access_thread(thread_id) sigue por fila';
  raise notice 'OK · 0051: las ocho politicas de threads, thread_items y thread_item_keys evaluan sus funciones una vez';
end
$$;

-- -----------------------------------------------------------------------------
-- 0052 · El backup de la clave, estanco (F-239)
-- -----------------------------------------------------------------------------
-- Organizacion propia (Hotel Test): h1 ADMIN con backup, h2 EDITOR con backup, h3 EDITOR REGISTERED con
-- un backup recien subido (lo que REG-07 relee), h4 EDITOR sin backup. Se borra al final.
insert into public.organizations (id, name, country, continent, status)
values ('99999999-9999-4999-8999-999999999999', 'Hotel Test', 'FR', 'EU', 'APPROVED');
insert into auth.users (id, email) values
  ('9e000001-0000-0000-0000-000000000001', 'h1@hotel.test'), ('9e000002-0000-0000-0000-000000000002', 'h2@hotel.test'),
  ('9e000003-0000-0000-0000-000000000003', 'h3@hotel.test'), ('9e000004-0000-0000-0000-000000000004', 'h4@hotel.test');
insert into public.members (id, org_id, email, state) values
  ('9e000001-0000-0000-0000-000000000001', '99999999-9999-4999-8999-999999999999', 'h1@hotel.test', 'ACTIVE'),
  ('9e000002-0000-0000-0000-000000000002', '99999999-9999-4999-8999-999999999999', 'h2@hotel.test', 'ACTIVE'),
  ('9e000003-0000-0000-0000-000000000003', '99999999-9999-4999-8999-999999999999', 'h3@hotel.test', 'REGISTERED'),
  ('9e000004-0000-0000-0000-000000000004', '99999999-9999-4999-8999-999999999999', 'h4@hotel.test', 'ACTIVE');
update public.members m set public_key = decode(repeat(x.k, 32), 'hex'), encrypted_key_blob = decode(repeat(x.k, 48), 'hex'),
       key_iv = decode(repeat(x.k, 12), 'hex'), argon2_salt = decode(repeat(x.k, 32), 'hex'),
       kdf_params = '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}'::jsonb
  from (values ('9e000001-0000-0000-0000-000000000001'::uuid, 'f1'), ('9e000002-0000-0000-0000-000000000002', 'f2'),
               ('9e000003-0000-0000-0000-000000000003', 'f3')) as x(id, k)
 where m.id = x.id;

do $$
begin
  assert not has_column_privilege('authenticated', 'public.members', 'encrypted_key_blob', 'select'), '0052: authenticated no lee el blob';
  assert not has_column_privilege('authenticated', 'public.members', 'key_iv', 'select'), '0052: ni el iv';
  assert not has_column_privilege('anon', 'public.members', 'encrypted_key_blob', 'select'), '0052: anon tampoco';
  assert not has_table_privilege('authenticated', 'public.members', 'select'), '0052: no hay select de tabla entero';
  assert has_column_privilege('authenticated', 'public.members', 'public_key', 'select')
     and has_column_privilege('authenticated', 'public.members', 'kdf_params', 'select')
     and has_column_privilege('authenticated', 'public.members', 'state', 'select'),
    '0052: el ancla positiva -- las demas columnas siguen legibles';
  assert not has_column_privilege('authenticated', 'public.members', 'encrypted_key_blob', 'update')
     and not has_column_privilege('authenticated', 'public.members', 'key_iv', 'update')
     and not has_column_privilege('authenticated', 'public.members', 'argon2_salt', 'update')
     and not has_column_privilege('authenticated', 'public.members', 'kdf_params', 'update')
     and not has_column_privilege('authenticated', 'public.members', 'state', 'update'),
    '0052: no se escribe el backup ni el estado a mano';
  assert has_column_privilege('authenticated', 'public.members', 'public_key', 'update'),
    '0052: el ancla positiva -- public_key si (ensureKeyring la publica)';
  assert not has_function_privilege('anon', 'public.read_pending_key_backup()', 'execute'), '0052: anon no lee el backup pendiente';
  assert has_function_privilege('authenticated', 'public.read_pending_key_backup()', 'execute'),
    '0052: el ancla positiva -- authenticated SI lo lee';
  raise notice 'OK · 0052: privilegios por columna leidos del catalogo';
end
$$;

-- Lo que un miembro ve de verdad: el ADMIN h1 NO lee el blob de su compañero h2 ni el suyo, con select directo.
begin;
  select set_config('request.jwt.claim.sub', '9e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  select public.expect_denied($q$select encrypted_key_blob from public.members where id = '9e000002-0000-0000-0000-000000000002'$q$,
    '0052: un ADMIN no lee el blob de un companero');
  select public.expect_denied($q$select key_iv from public.members where id = '9e000001-0000-0000-0000-000000000001'$q$,
    '0052: ni el iv propio, con select directo');
  select public.expect_denied($q$select * from public.members$q$, '0052: select * ya no vale');
  select public.expect_denied($q$update public.members set encrypted_key_blob = decode(repeat('00', 48), 'hex') where id = '9e000001-0000-0000-0000-000000000001'$q$,
    '0052: no se sustituye el blob con un update');
  select public.expect_denied($q$update public.members set kdf_params = null where id = '9e000001-0000-0000-0000-000000000001'$q$,
    '0052: ni se borran los parametros');
  select public.expect_fail($q$update public.members set public_key = decode(repeat('00', 32), 'hex') where id = '9e000001-0000-0000-0000-000000000001'$q$,
    '0052: con backup, la publica no se cambia desde el cliente');
commit;

-- Y lo que SI ve: las columnas permitidas, de si mismo y de sus companeros de organizacion.
begin;
  select set_config('request.jwt.claim.sub', '9e000001-0000-0000-0000-000000000001', true);
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from (select id, org_id, email, full_name, role, state, public_key, argon2_salt, kdf_params, created_at, visibility_scope
                                   from public.members) t;
    assert n = 4, '0052: el ADMIN sigue viendo a los 4 de su organizacion con las columnas permitidas, ve ' || n;
  end $$;
commit;

-- Un miembro sin backup (h4) sigue publicando su clave con un update, como hace ensureKeyring.
begin;
  select set_config('request.jwt.claim.sub', '9e000004-0000-0000-0000-000000000004', true);
  set local role authenticated;
  update public.members set public_key = decode(repeat('44', 32), 'hex') where id = '9e000004-0000-0000-0000-000000000004';
commit;

do $$
begin
  assert (select public_key from public.members where id = '9e000004-0000-0000-0000-000000000004') = decode(repeat('44', 32), 'hex'),
    '0052: sin backup, el miembro publica su clave';
  raise notice 'OK · 0052: el blob no se lee ni se escribe a mano, y lo demas sigue funcionando';
end
$$;

-- read_pending_key_backup: solo REGISTERED y con blob; no devuelve el de nadie mas.
do $$
declare r record; n int;
begin
  perform set_config('request.jwt.claim.sub', '9e000003-0000-0000-0000-000000000003', true);
  select * into r from public.read_pending_key_backup();
  assert r.encrypted_key_blob = decode(repeat('f3', 48), 'hex') and r.public_key = decode(repeat('f3', 32), 'hex'),
    '0052: un REGISTERED con backup recien subido lo relee (REG-07)';
  perform set_config('request.jwt.claim.sub', '9e000002-0000-0000-0000-000000000002', true);
  select count(*) into n from public.read_pending_key_backup();
  assert n = 0, '0052: un miembro ACTIVE no lo lee por aqui (solo por begin_key_recovery)';
  perform set_config('request.jwt.claim.sub', '9e000004-0000-0000-0000-000000000004', true);
  select count(*) into n from public.read_pending_key_backup();
  assert n = 0, '0052: y sin backup, nada';
  raise notice 'OK · 0052: read_pending_key_backup solo responde a un REGISTERED con backup';
end
$$;

delete from public.key_recovery_attempts where member_id::text like '9e00000%';
delete from public.members where org_id = '99999999-9999-4999-8999-999999999999';
delete from auth.users where id::text like '9e00000%';
delete from public.organizations where id = '99999999-9999-4999-8999-999999999999';

select 'TODOS LOS ASSERTS PASAN' as resultado;
