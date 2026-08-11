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
end
$$;

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

select 'TODOS LOS ASSERTS PASAN' as resultado;
