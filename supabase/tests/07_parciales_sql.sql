-- =============================================================================
-- 07 · Los parciales «solo SQL» de la matriz de trazabilidad (corriente C, Nivel 1)
-- =============================================================================
-- Cada bloque cierra un escenario que el cliente ya ejercía y al que le faltaba la
-- mitad de la base (`openspec/v1/trazabilidad.csv`, estado PARCIAL, «Falta solo SQL»).
-- Se aserta desde la SPEC, no desde el código: si un bloque falla, o la base no hace
-- lo que la spec dice (hallazgo) o el bloque está mal escrito — nunca se ajusta la
-- aserción al resultado sin mirar cuál de las dos.
--
-- Fixture propia (prefijo `7a`/`7b`): no depende de lo que deje `01_schema_smoke.sql`
-- ni lo toca. Corre justo después de él, en la misma base.
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixture: organizaciones numeradas, cada una con un ADMIN ACTIVO con clave pública.
-- `single-thread-model` permite UN hilo por par de organizaciones, así que cada
-- escenario que necesita un hilo nuevo usa una organización nueva. La 1 es la compradora.
-- ---------------------------------------------------------------------------
create or replace function public.t7_org(n int) returns uuid language sql immutable as
  $$ select ('7a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function public.t7_mem(n int) returns uuid language sql immutable as
  $$ select ('7b000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

create or replace function public.t7_alta(n int, pais text default 'DE', continente text default 'EU') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into auth.users (id, email) values (public.t7_mem(n), 'm' || n || '@siete.test');
  insert into public.organizations (id, name, country, continent, status)
  values (public.t7_org(n), 'Siete ' || n, pais, continente, 'APPROVED');
  insert into public.members (id, org_id, email, role, state)
  values (public.t7_mem(n), public.t7_org(n), 'm' || n || '@siete.test', 'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex') where id = public.t7_mem(n);
  return public.t7_org(n);
end;
$$;

-- Actúa como el miembro n, con RLS (el stub de auth.uid() lee este claim).
create or replace function public.t7_como(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', public.t7_mem(n)::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Los CEK de un elemento: uno por miembro ACTIVO de las dos organizaciones (el reparto exacto de 0024).
create or replace function public.t7_keys(a uuid, b uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_agg(jsonb_build_object('member_id', m.id, 'wrapped_cek', repeat('11', 48),
                                      'wrap_iv', repeat('14', 12), 'ephemeral_pubkey', repeat('22', 32)))
    from public.members m where m.org_id in (a, b) and m.state = 'ACTIVE';
$$;
grant execute on function public.t7_keys(uuid, uuid) to authenticated;

-- Un hilo vacío entre dos organizaciones, en orden canónico.
create or replace function public.t7_hilo(a int, b int) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare t uuid := gen_random_uuid();
begin
  insert into public.threads (id, org_low_id, org_high_id, created_by_org_id)
  values (t, least(public.t7_org(a), public.t7_org(b)), greatest(public.t7_org(a), public.t7_org(b)), public.t7_org(a));
  return t;
end;
$$;

-- Un elemento de `quien` en el hilo `t`: tipo OFERTA o CONSULTA, Pendiente.
create or replace function public.t7_item(t uuid, quien int, tipo text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare i uuid := gen_random_uuid();
begin
  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type, part_number, brand,
     estado_oferta, estado_consulta, content_ciphertext, content_iv)
  values (i, t, public.t7_org(quien), public.t7_mem(quien), tipo, '6204-2RS', 'SKF',
          case when tipo = 'OFERTA' then 'Pendiente' end, case when tipo = 'CONSULTA' then 'Pendiente' end,
          decode(repeat('ee', 96), 'hex'), decode(repeat('09', 12), 'hex'));
  return i;
end;
$$;

do $$ begin perform public.t7_alta(n) from generate_series(1, 20) n; end $$;

-- ===========================================================================
-- messaging-and-negotiation/thread-lifecycle #1, #3, #5, #6
-- ===========================================================================
-- #1 · una oferta Pendiente en un hilo ABIERTO lo pasa a CON OFERTA PENDIENTE (origen ABIERTO).
do $$
declare t uuid := public.t7_hilo(1, 2);
begin
  assert (select state from public.threads where id = t) = 'ABIERTO', 'thread-lifecycle#1: el hilo nuevo nace ABIERTO';
  perform public.t7_item(t, 2, 'OFERTA');
  assert (select state from public.threads where id = t) = 'CON OFERTA PENDIENTE',
    'thread-lifecycle#1: una oferta Pendiente en un hilo ABIERTO lo pasa a CON OFERTA PENDIENTE';
  raise notice 'OK · thread-lifecycle#1: ABIERTO -> CON OFERTA PENDIENTE';
end
$$;

-- #3 · rechazar la oferta: sin consulta pendiente vuelve a ABIERTO; con otra consulta pendiente, a CON CONSULTA PENDIENTE.
do $$
declare t1 uuid; t2 uuid; of1 uuid; of2 uuid;
begin
  -- Rama 1: solo la oferta. La emite el 3; la rechaza el 1 (el receptor), con RLS.
  t1 := public.t7_hilo(1, 3);
  of1 := public.t7_item(t1, 3, 'OFERTA');
  -- Rama 2: además hay una consulta Pendiente del 1.
  t2 := public.t7_hilo(1, 4);
  perform public.t7_item(t2, 1, 'CONSULTA');
  of2 := public.t7_item(t2, 4, 'OFERTA');
  assert (select state from public.threads where id = t2) = 'CON OFERTA PENDIENTE',
    'thread-lifecycle#3: la oferta pendiente manda sobre la consulta pendiente';
  perform public.t7_como(1);
  update public.thread_items set estado_oferta = 'Rechazada' where id = of1;
  update public.thread_items set estado_oferta = 'Rechazada' where id = of2;
  reset role;
  assert (select state from public.threads where id = t1) = 'ABIERTO',
    'thread-lifecycle#3: sin consulta pendiente, rechazar la oferta devuelve el hilo a ABIERTO';
  assert (select state from public.threads where id = t2) = 'CON CONSULTA PENDIENTE',
    'thread-lifecycle#3: con otra consulta pendiente, rechazar la oferta deja CON CONSULTA PENDIENTE';
  raise notice 'OK · thread-lifecycle#3: el rechazo vuelve a ABIERTO o a CON CONSULTA PENDIENTE según haya consulta';
end
$$;

-- #5 · revertir un acuerdo: cualquiera de las dos partes, sin límite de tiempo, y queda sellado agreement_reverted_at.
-- Tres bloques, cada uno su transacción: `now()` no avanza dentro de una, y la derivación compara
-- «aceptada después de la última reversión» con él.
do $$
declare t uuid; of1 uuid;
begin
  t := public.t7_hilo(1, 5);
  of1 := public.t7_item(t, 5, 'OFERTA');
  perform public.t7_como(1);
  update public.thread_items set estado_oferta = 'Aceptada' where id = of1;
  reset role;
  assert (select state from public.threads where id = t) = 'ACUERDO ALCANZADO', 'thread-lifecycle#5: parte de un acuerdo';
  -- El acuerdo es antiguo (400 días): la reversión no tiene periodo de gracia ni caducidad.
  update public.thread_items set estado_changed_at = now() - interval '400 days' where id = of1;
end
$$;

do $$
declare t uuid := (select id from public.threads where org_low_id = public.t7_org(1) and org_high_id = public.t7_org(5));
begin
  -- La revierte la compradora (1).
  perform public.t7_como(1);
  update public.threads set state = 'ABIERTO' where id = t;
  reset role;
  assert (select state from public.threads where id = t) = 'ABIERTO', 'thread-lifecycle#5: la compradora revierte a ABIERTO';
  assert (select agreement_reverted_at from public.threads where id = t) is not null,
    'thread-lifecycle#5: la reversión sella agreement_reverted_at';
  -- Y un elemento cualquiera después NO resucita el acuerdo (la reversión dura).
  insert into public.thread_items (thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
  values (t, public.t7_org(1), public.t7_mem(1), 'MENSAJE', decode(repeat('ff', 32), 'hex'), decode(repeat('0a', 12), 'hex'));
  assert (select state from public.threads where id = t) = 'ABIERTO', 'thread-lifecycle#5: un mensaje posterior no resucita el acuerdo revertido';
end
$$;

-- Otro acuerdo en el mismo hilo (transacción nueva, instante posterior a la reversión).
do $$
declare t uuid := (select id from public.threads where org_low_id = public.t7_org(1) and org_high_id = public.t7_org(5));
        of2 uuid := public.t7_item(t, 5, 'OFERTA');
begin
  perform public.t7_como(1);
  update public.thread_items set estado_oferta = 'Aceptada' where id = of2;
  reset role;
  assert (select state from public.threads where id = t) = 'ACUERDO ALCANZADO', 'thread-lifecycle#5: el segundo acuerdo es vigente tras la reversión';
end
$$;

-- Y lo revierte la OTRA parte (5, la vendedora).
do $$
declare t uuid := (select id from public.threads where org_low_id = public.t7_org(1) and org_high_id = public.t7_org(5));
begin
  perform public.t7_como(5);
  update public.threads set state = 'ABIERTO' where id = t;
  reset role;
  assert (select state from public.threads where id = t) = 'ABIERTO'
     and (select agreement_reverted_at from public.threads where id = t)
       > (select max(estado_changed_at) from public.thread_items where thread_id = t and item_type = 'OFERTA' and estado_oferta = 'Aceptada'),
    'thread-lifecycle#5: la vendedora también revierte, y el sello es posterior al acuerdo';
  raise notice 'OK · thread-lifecycle#5: ACUERDO ALCANZADO -> ABIERTO por cualquiera de las dos partes, sin límite de tiempo';
end
$$;

-- #6 · cerrar sin acuerdo no toca el marcado de la consulta.
do $$
declare t uuid; c uuid;
begin
  t := public.t7_hilo(1, 6);
  c := public.t7_item(t, 1, 'CONSULTA');
  assert (select state from public.threads where id = t) = 'CON CONSULTA PENDIENTE', 'thread-lifecycle#6: parte de una consulta pendiente';
  perform public.t7_como(1);
  update public.threads set state = 'CERRADO SIN ACUERDO' where id = t;
  reset role;
  assert (select state from public.threads where id = t) = 'CERRADO SIN ACUERDO', 'thread-lifecycle#6: el hilo queda cerrado';
  assert (select estado_consulta from public.thread_items where id = c) = 'Pendiente',
    'thread-lifecycle#6: cerrar el hilo no cambia el estado de la consulta (sigue Pendiente)';
  raise notice 'OK · thread-lifecycle#6: el cierre sin acuerdo no altera thread_items.estado_consulta';
end
$$;

-- ===========================================================================
-- Consultas: inquiry-card #1, single-thread-model #3, results-row-actions #5
-- ===========================================================================
-- Una línea PUBLISHED de la organización `n`.
create or replace function public.t7_linea(n int, pn text, pais text default 'DE') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare l uuid := gen_random_uuid();
begin
  insert into public.inventory_lines (id, org_id, part_number, brand, quantity, location_country, product_family, status)
  values (l, public.t7_org(n), pn, 'SKF', 100, pais, 'Rodamiento rigido de bolas', 'PUBLISHED');
  return l;
end;
$$;

-- Consultar como el miembro `quien` la línea `l` (reparto exacto de CEK entre las dos organizaciones).
create or replace function public.t7_consultar(quien int, vende int, l uuid) returns uuid
language plpgsql as $$
declare r record;
begin
  perform public.t7_como(quien);
  select * into r from public.create_inquiry(l, repeat('aa', 48), repeat('14', 12),
                                             public.t7_keys(public.t7_org(quien), public.t7_org(vende)));
  reset role;
  return r.thread_id;
end;
$$;

-- inquiry-card #1 · tras create_inquiry el hilo pasa de ABIERTO a CON CONSULTA PENDIENTE; con una oferta pendiente, se queda en CON OFERTA PENDIENTE.
do $$
declare t uuid; l uuid;
begin
  t := public.t7_hilo(1, 7);
  l := public.t7_linea(7, '7001-A');
  assert (select state from public.threads where id = t) = 'ABIERTO', 'inquiry-card#1: el hilo existente parte ABIERTO';
  assert public.t7_consultar(1, 7, l) = t, 'inquiry-card#1: la consulta cae en el hilo existente';
  assert (select state from public.threads where id = t) = 'CON CONSULTA PENDIENTE',
    'inquiry-card#1: tras enviar la consulta el hilo pasa de ABIERTO a CON CONSULTA PENDIENTE';

  t := public.t7_hilo(1, 8);
  perform public.t7_item(t, 8, 'OFERTA');
  l := public.t7_linea(8, '7001-B');
  assert (select state from public.threads where id = t) = 'CON OFERTA PENDIENTE', 'inquiry-card#1: parte con una oferta pendiente';
  assert public.t7_consultar(1, 8, l) = t, 'inquiry-card#1: la consulta cae en el hilo con la oferta';
  assert (select state from public.threads where id = t) = 'CON OFERTA PENDIENTE',
    'inquiry-card#1: con una oferta pendiente, la consulta no baja el estado: sigue CON OFERTA PENDIENTE';
  raise notice 'OK · inquiry-card#1: create_inquiry mueve el hilo a CON CONSULTA PENDIENTE y respeta la oferta pendiente';
end
$$;

-- single-thread-model #3 y results-row-actions #5 · varias consultas seguidas al mismo distribuidor SIN hilo previo = un único hilo.
do $$
declare l1 uuid; l2 uuid; l3 uuid; t1 uuid; t2 uuid; t3 uuid;
begin
  assert not exists (select 1 from public.threads
                      where org_low_id = least(public.t7_org(1), public.t7_org(9)) and org_high_id = greatest(public.t7_org(1), public.t7_org(9))),
    'single-thread-model#3: no hay hilo previo con el distribuidor 9';
  l1 := public.t7_linea(9, '7002-A'); l2 := public.t7_linea(9, '7002-B'); l3 := public.t7_linea(9, '7002-C');
  t1 := public.t7_consultar(1, 9, l1);
  t2 := public.t7_consultar(1, 9, l2);
  t3 := public.t7_consultar(1, 9, l3);
  assert t1 = t2 and t2 = t3, 'single-thread-model#3: las tres consultas devuelven el mismo hilo';
  assert (select count(*) from public.threads
           where org_low_id = least(public.t7_org(1), public.t7_org(9)) and org_high_id = greatest(public.t7_org(1), public.t7_org(9))) = 1,
    'single-thread-model#3 / results-row-actions#5: el par de organizaciones tiene exactamente un hilo tras el lote';
  assert (select count(*) from public.thread_items where thread_id = t1 and item_type = 'CONSULTA' and estado_consulta = 'Pendiente') = 3,
    'single-thread-model#3: las tres consultas viven en ese hilo, una por línea';
  raise notice 'OK · single-thread-model#3 y results-row-actions#5: un lote al mismo distribuidor acaba en un único hilo con todas las consultas';
end
$$;

-- ===========================================================================
-- inventory-management: update-policy #1, visibility-control #2 y #3 · messaging: inquiry-card #4
-- ===========================================================================
-- update-policy #1 · reemplazo total con 1.000 líneas publicadas y un lote de 800 que mezcla coincidentes y nuevas.
-- (El ejemplo de la spec supone las 800 dentro de las 1.000; con nuevas la cuenta de retiradas sale de lo que NO está en el lote.)
do $$
declare r jsonb; antes_publicadas int; fuera int;
begin
  perform public.t7_alta(30);
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  select public.t7_org(30), 'PN' || i, 'MARCA', 10, 'DE', 'Rodamiento', 'PUBLISHED' from generate_series(1, 1000) i;
  select count(*) into antes_publicadas from public.inventory_lines where org_id = public.t7_org(30) and status = 'PUBLISHED';
  assert antes_publicadas = 1000, 'update-policy#1: parte de 1.000 líneas publicadas';

  perform public.t7_como(30);
  -- 700 coincidentes (PN1..PN700, cantidad nueva) + 100 nuevas = 800 líneas.
  select public.import_inventory(
    (select jsonb_agg(jsonb_build_object('part_number', 'PN' || i, 'brand', 'MARCA', 'quantity', 99, 'location_country', 'DE'))
       from generate_series(1, 700) i)
    || (select jsonb_agg(jsonb_build_object('part_number', 'NUEVA' || i, 'brand', 'MARCA', 'quantity', 5, 'location_country', 'DE'))
          from generate_series(1, 100) i),
    'REPLACE') into r;
  reset role;

  fuera := 1000 - 700;
  assert (r->>'inserted')::int = 100 and (r->>'inserted')::int > 0, 'update-policy#1: inserta las 100 líneas nuevas, dijo ' || r::text;
  assert (r->>'updated')::int = 700, 'update-policy#1: actualiza las 700 coincidentes, dijo ' || r::text;
  assert (r->>'removed')::int = fuera, 'update-policy#1: retira las que no están en el archivo (' || fuera || '), dijo ' || r::text;
  assert (select count(*) from public.inventory_lines where org_id = public.t7_org(30) and status = 'DELETED') = fuera,
    'update-policy#1: las retiradas quedan DELETED';
  assert (select count(*) from public.inventory_lines where org_id = public.t7_org(30) and status = 'PUBLISHED') = 800,
    'update-policy#1: el inventario publicado refleja exactamente las 800 líneas del archivo';
  assert (select quantity from public.inventory_lines where org_id = public.t7_org(30) and part_number = 'PN1' and status = 'PUBLISHED') = 99,
    'update-policy#1: las coincidentes toman los datos nuevos';
  raise notice 'OK · update-policy#1: REPLACE inserta 100, actualiza 700, retira 300 y deja exactamente 800 publicadas';
end
$$;

-- visibility-control #2 y #3 · exclusión por PAÍS, y reactivar RESTRINGIDA sin tocar la lista.
do $$
begin
  perform public.t7_alta(21, 'ES'); perform public.t7_alta(22, 'FR'); perform public.t7_alta(23, 'PL'); perform public.t7_alta(24, 'MX', 'NA');
  perform public.t7_linea(23, '7003-A', 'PL');
  update public.organizations set inventory_visibility_mode = 'RESTRINGIDA' where id = public.t7_org(23);
  insert into public.inventory_exclusions (owner_org_id, excluded_country) values (public.t7_org(23), 'ES');
end
$$;

do $$
declare n int;
begin
  perform public.t7_como(21);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 0, 'visibility-control#2: la organización de España excluida por país no ve nada del dueño, ve ' || n;
  perform public.t7_como(22);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 1, 'visibility-control#2: la de Francia (mismo continente) NO queda arrastrada por la exclusión de España, ve ' || n;
  perform public.t7_como(24);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 1, 'visibility-control#2: la de otro continente tampoco, ve ' || n;
  raise notice 'OK · visibility-control#2: la exclusión por país oculta solo a las organizaciones de ese país';
end
$$;

-- #3: el dueño (con RLS, como en la pantalla) pasa a VISIBLE_TODOS y vuelve a RESTRINGIDA sin tocar la lista.
do $$
declare n int;
begin
  perform public.t7_como(23);
  update public.organizations set inventory_visibility_mode = 'VISIBLE_TODOS' where id = public.t7_org(23);
  reset role;
  perform public.t7_como(21);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 1, 'visibility-control#3: en VISIBLE_TODOS la lista queda inactiva y la excluida ve el inventario, ve ' || n;
  assert (select count(*) from public.inventory_exclusions where owner_org_id = public.t7_org(23)) = 1,
    'visibility-control#3: la lista sigue ahí tras el cambio de modo';

  perform public.t7_como(23);
  update public.organizations set inventory_visibility_mode = 'RESTRINGIDA' where id = public.t7_org(23);
  reset role;
  perform public.t7_como(21);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 0, 'visibility-control#3: al reactivar RESTRINGIDA sin tocar la lista, la excluida deja de ver, ve ' || n;
  perform public.t7_como(22);
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(23); reset role;
  assert n = 1, 'visibility-control#3: y la no excluida sigue viendo, ve ' || n;
  raise notice 'OK · visibility-control#3: reactivar RESTRINGIDA vuelve a aplicar la lista intacta';
end
$$;

-- inquiry-card #4 · el marcado de «consultada» es por ID de línea.
-- La spec: una línea consultada SUSTITUIDA por una nueva (nuevo ID) tras un reemplazo total aparece como no consultada, aunque coincida.
-- Lo que hace import_inventory (0046): una línea ausente del archivo pasa a DELETED y, si reaparece más tarde, nace con ID nuevo
-- (cumple); una línea COINCIDENTE se actualiza en el sitio y CONSERVA su ID, así que su consulta pendiente sigue marcada
-- (no cumple la frase «independientemente de que part_number, brand y cantidad coincidan»). Se aserta lo que hace la base;
-- la divergencia queda registrada en F-271 para decisión del PO.
do $$
declare ausente uuid; coincidente uuid; nueva uuid;
begin
  perform public.t7_alta(31);
  ausente := public.t7_linea(31, '7004-AUSENTE'); coincidente := public.t7_linea(31, '7004-COINCIDE');
  perform public.t7_consultar(1, 31, ausente);
  perform public.t7_consultar(1, 31, coincidente);
  assert app.org_has_pending_inquiry(ausente, public.t7_org(1)) and app.org_has_pending_inquiry(coincidente, public.t7_org(1)),
    'inquiry-card#4: las dos líneas parten marcadas como consultadas';

  perform public.t7_como(31);
  perform public.import_inventory(
    jsonb_build_array(jsonb_build_object('part_number', '7004-COINCIDE', 'brand', 'SKF', 'quantity', 100, 'location_country', 'DE')),
    'REPLACE');
  reset role;
  assert (select status from public.inventory_lines where id = ausente) = 'DELETED', 'inquiry-card#4: la ausente queda DELETED';

  perform public.t7_como(31);
  perform public.import_inventory(
    jsonb_build_array(jsonb_build_object('part_number', '7004-COINCIDE', 'brand', 'SKF', 'quantity', 100, 'location_country', 'DE'),
                      jsonb_build_object('part_number', '7004-AUSENTE', 'brand', 'SKF', 'quantity', 100, 'location_country', 'DE')),
    'REPLACE');
  reset role;
  nueva := (select id from public.inventory_lines where org_id = public.t7_org(31) and part_number = '7004-AUSENTE' and status = 'PUBLISHED');
  assert nueva is not null and nueva <> ausente, 'inquiry-card#4: la línea que reaparece nace con ID nuevo';
  assert not app.org_has_pending_inquiry(nueva, public.t7_org(1)),
    'inquiry-card#4: la línea nueva aparece como no consultada (Consultar disponible de nuevo)';
  assert (select status from public.inventory_lines where id = coincidente) = 'PUBLISHED'
     and app.org_has_pending_inquiry(coincidente, public.t7_org(1)),
    'inquiry-card#4 (F-271): la línea coincidente conserva su ID y su consulta pendiente sigue marcada';
  raise notice 'OK · inquiry-card#4: ID nuevo para lo que reaparece; la coincidente conserva el suyo (divergencia F-271)';
end
$$;

-- ===========================================================================
-- conversational-search/favorites-system #2 · ningún evento de plataforma toca los favoritos
-- ===========================================================================
do $$
declare t uuid; o uuid; antes text; despues text;
begin
  perform public.t7_alta(40); perform public.t7_alta(41); perform public.t7_alta(42);
  -- La acción explícita: el miembro 40 marca como favorita a la organización 41, el 42 también.
  perform public.t7_como(40);
  insert into public.favorite_distributors (member_id, distributor_org_id) values (public.t7_mem(40), public.t7_org(41));
  reset role;
  perform public.t7_como(42);
  insert into public.favorite_distributors (member_id, distributor_org_id) values (public.t7_mem(42), public.t7_org(41));
  reset role;
  assert (select favorite_count from public.organizations where id = public.t7_org(41)) = 2, 'favorites-system#2: parte con dos favoritos explícitos';

  select coalesce(string_agg(member_id::text || distributor_org_id::text || created_at::text, '|' order by member_id, distributor_org_id), '')
         || '#' || (select string_agg(id::text || favorite_count, ',' order by id) from public.organizations where id::text like '7a0000%')
    into antes from public.favorite_distributors;

  -- Eventos de actividad: una oferta, su aceptación, la reversión, el cierre, más volumen y antigüedad del miembro.
  t := public.t7_hilo(40, 41);
  o := public.t7_item(t, 41, 'OFERTA');
  perform public.t7_como(40); update public.thread_items set estado_oferta = 'Aceptada' where id = o; reset role;
  perform public.t7_item(t, 41, 'OFERTA'); perform public.t7_item(t, 41, 'OFERTA');
  perform public.t7_como(40); update public.threads set state = 'ABIERTO' where id = t; reset role;
  update public.threads set state = 'CERRADO SIN ACUERDO' where id = t;
  update public.members set created_at = now() - interval '3 years' where id in (public.t7_mem(40), public.t7_mem(41));
  update public.organizations set country = 'FR' where id = public.t7_org(41);

  select coalesce(string_agg(member_id::text || distributor_org_id::text || created_at::text, '|' order by member_id, distributor_org_id), '')
         || '#' || (select string_agg(id::text || favorite_count, ',' order by id) from public.organizations where id::text like '7a0000%')
    into despues from public.favorite_distributors;
  assert antes = despues, 'favorites-system#2: un acuerdo, ofertas, una reversión, un cierre y la antigüedad del miembro no cambian ni una fila de favoritos ni su recuento';

  -- Y solo la acción explícita del usuario los modifica.
  perform public.t7_como(40);
  delete from public.favorite_distributors where member_id = public.t7_mem(40) and distributor_org_id = public.t7_org(41);
  reset role;
  assert (select favorite_count from public.organizations where id = public.t7_org(41)) = 1,
    'favorites-system#2: la retirada explícita sí cambia el recuento';
  raise notice 'OK · favorites-system#2: los eventos de actividad no tocan los favoritos; solo la acción explícita del usuario';
end
$$;

-- ===========================================================================
-- e2ee-key-management/schema-desde-dia-uno #1 · los cuatro campos de clave en members
-- ===========================================================================
do $$
declare r record;
begin
  for r in select * from (values ('encrypted_key_blob', 'bytea'), ('key_iv', 'bytea'), ('argon2_salt', 'bytea'), ('kdf_params', 'jsonb')) v(col, tipo)
  loop
    assert (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = r.col) = r.tipo,
      'schema-desde-dia-uno#1: public.members.' || r.col || ' debe ser ' || r.tipo;
    assert (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = r.col) = 'YES',
      'schema-desde-dia-uno#1: public.members.' || r.col || ' debe admitir NULL (el backup es opcional hasta REG-07)';
  end loop;
  raise notice 'OK · schema-desde-dia-uno#1: members tiene encrypted_key_blob, key_iv, argon2_salt (bytea) y kdf_params (jsonb), todos NULL';
end
$$;

-- ===========================================================================
-- community-forum: thread-and-reply-creation #3, reactions #2, not-e2ee-content #1
-- ===========================================================================
do $$
declare cat uuid := (select id from public.forum_categories where slug = 'general');
        th uuid := gen_random_uuid();
begin
  perform public.t7_alta(50, 'ES'); perform public.t7_alta(51, 'FR'); perform public.t7_alta(52, 'PL');
  -- Una segunda persona de la organización 52 (para «dos usuarios de la misma organización»).
  insert into auth.users (id, email) values (public.t7_mem(53), 'm53@siete.test');
  insert into public.members (id, org_id, email, role, state) values (public.t7_mem(53), public.t7_org(52), 'm53@siete.test', 'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE' where id = public.t7_mem(53);

  -- El miembro 50 abre un hilo y publica, con RLS y a su nombre.
  perform public.t7_como(50);
  insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id)
  values (th, cat, 'Hilo de prueba siete', public.t7_mem(50), public.t7_org(50));
  insert into public.forum_posts (id, thread_id, author_member_id, author_org_id, body)
  values ('7c000000-0000-4000-8000-000000000001', th, public.t7_mem(50), public.t7_org(50), 'Texto en claro: busco 6204-2RS');
  reset role;
end
$$;

-- thread-and-reply-creation #3 · la identidad interna queda registrada y no se muestra a otros miembros.
-- La base la GUARDA (author_member_id) y las vistas no la exponen; pero la tabla forum_posts concede SELECT de tabla entera
-- a authenticated (0029:252) y cualquier miembro activo la lee: el uuid del autor es legible por la API desde otra organización.
-- Se aserta lo que hace la base. El uuid no se resuelve a un nombre fuera de la propia organización (members solo se lee en la
-- propia); lo que permite es CORRELACIONAR publicaciones de una misma persona. Registrado en F-272 para decisión del PO.
do $$
declare visto uuid; n int;
begin
  assert (select author_member_id from public.forum_posts where id = '7c000000-0000-4000-8000-000000000001') = public.t7_mem(50),
    'thread-and-reply-creation#3: la base guarda qué usuario concreto escribió la publicación';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('forum_post_detail', 'forum_thread_list')
                        and column_name like '%member%'),
    'thread-and-reply-creation#3: las vistas del foro no exponen ninguna columna de persona';
  perform public.t7_como(51);
  select author_member_id into visto from public.forum_posts where id = '7c000000-0000-4000-8000-000000000001';
  select count(*) into n from public.members where id = public.t7_mem(50);
  reset role;
  assert visto = public.t7_mem(50), 'thread-and-reply-creation#3 (F-272): otra organización lee author_member_id por la API';
  assert n = 0, 'thread-and-reply-creation#3: pero no puede resolverlo a una persona: members no se lee fuera de la organización';
  raise notice 'OK · thread-and-reply-creation#3: autoría guardada; el uuid del autor es legible cross-org pero no resoluble (F-272)';
end
$$;

-- reactions #2 · dos usuarios de la misma organización reaccionando a la misma publicación cuentan como dos.
do $$
declare n bigint;
begin
  perform public.t7_como(52);
  insert into public.forum_reactions (post_id, member_id) values ('7c000000-0000-4000-8000-000000000001', public.t7_mem(52));
  reset role;
  perform public.t7_como(53);
  insert into public.forum_reactions (post_id, member_id) values ('7c000000-0000-4000-8000-000000000001', public.t7_mem(53));
  select reaction_count into n from public.forum_post_detail where id = '7c000000-0000-4000-8000-000000000001';
  reset role;
  assert n = 2, 'reactions#2: dos miembros de la misma organización cuentan como dos reacciones, cuenta ' || n;
  raise notice 'OK · reactions#2: la misma organización, dos reacciones';
end
$$;

-- not-e2ee-content #1 · el servidor lee el cuerpo en texto plano y la tabla no tiene columnas de cifrado.
do $$
declare cuerpo text;
begin
  set local role service_role;
  select body into cuerpo from public.forum_posts where id = '7c000000-0000-4000-8000-000000000001';
  reset role;
  assert cuerpo = 'Texto en claro: busco 6204-2RS', 'not-e2ee-content#1: service_role lee el cuerpo tal como se envió';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'forum_posts'
                        and (column_name ~* 'cipher|_iv$|^iv$|wrapped|nonce|key')),
    'not-e2ee-content#1: forum_posts no tiene columnas de cifrado';
  assert (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'forum_posts' and column_name = 'body') = 'text',
    'not-e2ee-content#1: body es text, no bytea';
  raise notice 'OK · not-e2ee-content#1: el cuerpo del foro es texto plano legible por el servidor';
end
$$;

-- ===========================================================================
-- billing-subscription: trial-period #1, automatic-suspension #4, deletion-after-prolonged-suspension #1 y #3
-- ===========================================================================
-- Un Operador de Plataforma (sin organización) para los verbos de cobro.
insert into auth.users (id, email) values ('7b0000ff-0000-4000-8000-0000000000ff', 'operador@siete.test');
insert into public.platform_operators (id, full_name) values ('7b0000ff-0000-4000-8000-0000000000ff', 'Operador Siete');

-- trial-period #1 · una organización EN PRUEBA usa todo sin bloqueo.
do $$
declare l uuid; th uuid := gen_random_uuid(); cat uuid := (select id from public.forum_categories where slug = 'general'); n int;
begin
  perform public.t7_alta(60); perform public.t7_alta(61);
  update public.organizations set created_at = now() - interval '80 days' where id = public.t7_org(60);
  l := public.t7_linea(61, '7005-A');

  perform set_config('request.jwt.claim.sub', '7b0000ff-0000-4000-8000-0000000000ff', true);
  set local role authenticated;
  assert (select billing_state from public.billing_org_status where org_id = public.t7_org(60)) = 'EN PRUEBA',
    'trial-period#1: la organización de 80 días aparece EN PRUEBA para el Operador';
  reset role;

  -- Inventario: escribe y lee el de otra organización.
  perform public.t7_como(60);
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  values (public.t7_org(60), '7005-PROPIA', 'SKF', 10, 'DE', 'Rodamiento', 'PUBLISHED');
  select count(*) into n from public.inventory_lines where org_id = public.t7_org(61);
  reset role;
  assert n = 1, 'trial-period#1: en prueba lee el inventario de otras organizaciones, ve ' || n;
  -- Hilos: consulta a otra organización.
  assert public.t7_consultar(60, 61, l) is not null, 'trial-period#1: en prueba puede consultar';
  -- Foro: abre un hilo y publica.
  perform public.t7_como(60);
  insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id) values (th, cat, 'Hilo en prueba', public.t7_mem(60), public.t7_org(60));
  insert into public.forum_posts (thread_id, author_member_id, author_org_id, body) values (th, public.t7_mem(60), public.t7_org(60), 'Hola desde la prueba');
  reset role;
  assert (select count(*) from public.forum_posts where thread_id = th) = 1, 'trial-period#1: en prueba publica en el foro';
  assert (select status from public.organizations where id = public.t7_org(60)) = 'APPROVED', 'trial-period#1: la organización sigue APPROVED mientras usa todo';
  raise notice 'OK · trial-period#1: una organización EN PRUEBA usa inventario, hilos y foro sin bloqueo';
end
$$;

-- automatic-suspension #4 · no existe forma de prorrogar a mano: ni función, ni política, ni privilegio.
do $$
declare escritoras text[];
begin
  -- (`watcher_renew` renueva watchers, no la suscripción: no es de cobro.)
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname in ('public', 'app') and p.proname !~* 'watcher'
                        and (p.proname ~* 'prorrog|extend|extension|extender|renew|grace|gracia'
                             or (p.prosrc ~* 'billing_' and p.proname ~* 'prorrog|extend|renew|grace'))),
    'automatic-suspension#4: no hay ninguna función de prórroga o gracia de cobro en public ni app';
  -- Ningún privilegio de escritura de cliente sobre las tablas de cobro.
  assert not (has_table_privilege('authenticated', 'public.billing_payments', 'insert')
           or has_table_privilege('authenticated', 'public.billing_payments', 'update')
           or has_table_privilege('authenticated', 'public.billing_payments', 'delete')
           or has_table_privilege('authenticated', 'public.billing_accounts', 'insert')
           or has_table_privilege('authenticated', 'public.billing_accounts', 'update')
           or has_table_privilege('authenticated', 'public.billing_accounts', 'delete')),
    'automatic-suspension#4: authenticated no escribe billing_payments ni billing_accounts';
  -- ⚠ F-273 · DIVERGENCIA CONOCIDA. `created_at` es el inicio de la prueba de 90 días (`billing_org_status`,
  -- `app.billing_evaluate_expirations`) y `app.guard_organization_columns` (0002) no lo protege: un ADMIN lo mueve con RLS.
  -- La spec dice «ausencia absoluta de extensión manual». Se aserta lo que hace la base HOY; el día que F-273 se cierre,
  -- este bloque falla a propósito y se invierte (el update tiene que ser rechazado o no surtir efecto).
  declare antes timestamptz := (select created_at from public.organizations where id = public.t7_org(60));
  begin
    perform public.t7_como(60);
    begin
      update public.organizations set created_at = now() + interval '5 years' where id = public.t7_org(60);
    exception when others then
      null;
    end;
    reset role;
    assert (select created_at from public.organizations where id = public.t7_org(60)) > antes + interval '4 years',
      'automatic-suspension#4 (F-273): se esperaba que HOY un ADMIN pueda mover organizations.created_at; si ya no puede, F-273 está cerrado: invierte este aserto';
    update public.organizations set created_at = antes where id = public.t7_org(60);
  end;
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('billing_payments', 'billing_accounts', 'billing_status_events')
                        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
    'automatic-suspension#4: ninguna política de escritura sobre las tablas de cobro';
  -- Las únicas funciones que escriben pagos o suspensión: confirmar pago, suspender y la evaluación automática.
  select array_agg(distinct n.nspname || '.' || p.proname order by n.nspname || '.' || p.proname) into escritoras
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app')
     and (p.prosrc ~* 'insert\s+into\s+public\.billing_payments' or p.prosrc ~* 'update\s+public\.billing_accounts');
  assert escritoras = array['app.billing_evaluate_expirations', 'public.billing_confirm_payment', 'public.billing_suspend_organization'],
    'automatic-suspension#4: solo estas tres funciones escriben cobro, y hay: ' || coalesce(escritoras::text, 'ninguna');
  raise notice 'OK · automatic-suspension#4: sin función, política ni privilegio de prórroga manual; abierto F-273 (created_at movible por un ADMIN)';
end
$$;

-- deletion-after-prolonged-suspension #1 · alcanzar los 6 meses marca la candidata y no genera ninguna notificación.
do $$
declare eventos0 bigint; watchers0 bigint; tablas_aviso int; eventos1 bigint; watchers1 bigint; marcadas int;
begin
  perform public.t7_alta(62);
  perform set_config('request.jwt.claim.sub', '7b0000ff-0000-4000-8000-0000000000ff', true);
  set local role authenticated;
  perform public.billing_suspend_organization(public.t7_org(62));
  reset role;
  update public.billing_accounts set suspended_since = now() - interval '7 months' where org_id = public.t7_org(62);

  select count(*) into eventos0 from public.billing_status_events;
  select count(*) into watchers0 from public.watchers;
  -- Si algún día existe una tabla de avisos, este bloque la tiene que contar: hoy no hay ninguna.
  select count(*) into tablas_aviso from information_schema.tables where table_schema = 'public' and table_name ~* 'notif|aviso|alert|email_queue';
  assert tablas_aviso = 0, 'deletion-after-prolonged-suspension#1: no hay tablas de avisos que contar (hay ' || tablas_aviso || '); hay que añadirlas a este bloque';

  perform app.billing_evaluate_expirations();

  select count(*) into eventos1 from public.billing_status_events;
  select count(*) into watchers1 from public.watchers;
  select count(*) into marcadas from public.billing_org_status where org_id = public.t7_org(62) and billing_state = 'CANDIDATA A BORRADO';
  assert marcadas = 1, 'deletion-after-prolonged-suspension#1: a los 7 meses la vista la marca CANDIDATA A BORRADO';
  assert eventos1 = eventos0, 'deletion-after-prolonged-suspension#1: ser candidata no genera eventos de estado (' || eventos0 || ' -> ' || eventos1 || ')';
  assert watchers1 = watchers0, 'deletion-after-prolonged-suspension#1: ni toca los avisos de watchers';
  assert (select status from public.organizations where id = public.t7_org(62)) = 'SUSPENDED',
    'deletion-after-prolonged-suspension#1: sigue SUSPENDED, sin acción adicional (no se borra)';
  assert exists (select 1 from public.organizations where id = public.t7_org(62)), 'deletion-after-prolonged-suspension#1: la organización sigue existiendo';
  raise notice 'OK · deletion-after-prolonged-suspension#1: la candidatura a borrado no dispara notificaciones ni acciones';
end
$$;

-- deletion-after-prolonged-suspension #3 · un pago antes del borrado cancela la candidatura y reinicia el contador de 6 meses.
do $$
declare ss timestamptz;
begin
  perform set_config('request.jwt.claim.sub', '7b0000ff-0000-4000-8000-0000000000ff', true);
  set local role authenticated;
  assert (select billing_state from public.billing_org_status where org_id = public.t7_org(62)) = 'CANDIDATA A BORRADO', 'deletion#3: parte candidata';
  perform public.billing_confirm_payment(public.t7_org(62), current_date, 'transferencia de prueba');
  assert (select billing_state from public.billing_org_status where org_id = public.t7_org(62)) = 'ACTIVE',
    'deletion-after-prolonged-suspension#3: el pago la deja ACTIVE y fuera de CANDIDATA A BORRADO';
  assert (select suspended_since from public.billing_org_status where org_id = public.t7_org(62)) is null,
    'deletion-after-prolonged-suspension#3: suspended_since vuelve a NULL';
  reset role;
end
$$;

do $$
declare ss timestamptz;
begin
  perform set_config('request.jwt.claim.sub', '7b0000ff-0000-4000-8000-0000000000ff', true);
  set local role authenticated;
  perform public.billing_suspend_organization(public.t7_org(62));
  select suspended_since into ss from public.billing_org_status where org_id = public.t7_org(62);
  assert ss > now() - interval '1 minute', 'deletion-after-prolonged-suspension#3: al suspenderla otra vez, suspended_since es ahora, no hace 7 meses';
  assert (select billing_state from public.billing_org_status where org_id = public.t7_org(62)) = 'SUSPENDED',
    'deletion-after-prolonged-suspension#3: queda SUSPENDED, con el contador de 6 meses reiniciado';
  reset role;
  raise notice 'OK · deletion-after-prolonged-suspension#3: el pago cancela la candidatura y reinicia los 6 meses';
end
$$;
