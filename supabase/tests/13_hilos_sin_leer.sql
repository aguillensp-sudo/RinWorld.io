-- =============================================================================
-- 13 · Hilos sin leer (`0082`, F-027 a)
-- =============================================================================
-- Decisión del PO del 18-nov-2026 (`DECISIONES-V1.md`). Spec PANEL-01 §4.4 y MSG-01 §3.
--
-- «Sin leer» es por MIEMBRO, no por organización. Un hilo tiene algo sin leer si, después de la
-- última vez que ese miembro lo abrió (o de su alta, si no lo ha abierto nunca):
--   · la otra empresa ha creado un elemento (mensaje, consulta u oferta), o
--   · ha cambiado el estado de uno propio (aceptar, rechazar, contraofertar).
-- Lo que escribe la propia empresa no cuenta.
--
-- Se prueba como un miembro de verdad (rol `authenticated`, RLS encendida), no como `postgres`.
-- Fixture propia (prefijo `13a`/`13b`/`13c`/`13d`) dentro de una transacción que se deshace.
-- Dentro de una transacción `now()` no avanza, así que los instantes van explícitos.
--
--   X · empresa con dos miembros, mx y mx2
--   Y · contraparte de X en T
--   Z · contraparte de X en T2
--
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  x uuid := '13a00000-0000-4000-8000-000000000001';
  y uuid := '13a00000-0000-4000-8000-000000000002';
  z uuid := '13a00000-0000-4000-8000-000000000003';
  mx  uuid := '13b00000-0000-4000-8000-000000000001';
  mx2 uuid := '13b00000-0000-4000-8000-000000000002';
  my  uuid := '13b00000-0000-4000-8000-000000000003';
  mz  uuid := '13b00000-0000-4000-8000-000000000004';
  t   uuid := '13c00000-0000-4000-8000-000000000001';
  t2  uuid := '13c00000-0000-4000-8000-000000000002';
begin
  insert into public.organizations (id, name, country, continent, status) values
    (x, 'Trece X', 'ES', 'EU', 'APPROVED'),
    (y, 'Trece Y', 'DE', 'EU', 'APPROVED'),
    (z, 'Trece Z', 'FR', 'EU', 'APPROVED');

  insert into auth.users (id, email) values
    (mx, 'x@trece.test'), (mx2, 'x2@trece.test'), (my, 'y@trece.test'), (mz, 'z@trece.test');
  insert into public.members (id, org_id, email, role, state) values
    (mx,  x, 'x@trece.test',  'EDITOR', 'PENDING_REVIEW'),
    (mx2, x, 'x2@trece.test', 'EDITOR', 'PENDING_REVIEW'),
    (my,  y, 'y@trece.test',  'EDITOR', 'PENDING_REVIEW'),
    (mz,  z, 'z@trece.test',  'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex'),
                            created_at = now() - interval '10 days'
   where id in (mx, mx2, my, mz);

  insert into public.threads (id, org_low_id, org_high_id, created_by_org_id) values
    (t,  x, y, x),
    (t2, x, z, x);

  -- T: un mensaje de Y de hace 5 días. T2: una oferta PROPIA de X de hace 4 días.
  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv, created_at)
  values
    ('13d00000-0000-4000-8000-000000000001', t, y, my, 'MENSAJE',
     decode(repeat('aa', 48), 'hex'), decode(repeat('04', 12), 'hex'), now() - interval '5 days');

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, quantity,
     estado_oferta, content_ciphertext, content_iv, created_at)
  values
    ('13d00000-0000-4000-8000-000000000002', t2, x, mx, 'OFERTA', '6205-2RS', 'SKF', 10,
     'Pendiente', decode(repeat('aa', 48), 'hex'), decode(repeat('04', 12), 'hex'), now() - interval '4 days');
  -- El disparador de 0007 pone `estado_changed_at = now()` al insertar; como se hace hoy, al crearla.
  update public.thread_items set estado_changed_at = created_at
   where id = '13d00000-0000-4000-8000-000000000002';
end
$$;

-- Actúa como el miembro indicado, con RLS. Se vuelve a `postgres` con `reset role`.
create function public.t13_como(p_member uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_member::text, true);
  execute 'set local role authenticated';
end;
$$;

-- La sentencia tiene que fallar; si pasa, el test falla con `p_que`.
create function public.t13_falla(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK · rechazado: % (%)', p_que, sqlerrm;
    return;
  end;
  raise exception 'DEBIA FALLAR y paso: %', p_que;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1 · Sin haber abierto nada: lo de la otra empresa desde el alta, sin leer; lo propio, no
-- -----------------------------------------------------------------------------
select public.t13_como('13b00000-0000-4000-8000-000000000001');

do $$
declare
  r record;
  n int;
begin
  select count(*) into n from public.unread_threads();
  assert n = 1, format('mx tendria que tener 1 hilo sin leer (T), tiene %s', n);

  select * into r from public.unread_threads();
  assert r.thread_id = '13c00000-0000-4000-8000-000000000001', 'el hilo sin leer tendria que ser T';
  assert r.counterparty_name = 'Trece Y', format('contraparte: %s', r.counterparty_name);
  assert r.thread_state = 'ABIERTO', format('estado: %s', r.thread_state);
  assert r.unread_count = 1, format('elementos sin leer: %s', r.unread_count);
  assert r.last_unread_at = now() - interval '5 days', 'last_unread_at es el del mensaje de Y';
  raise notice 'OK · sin abrir: T sin leer con el mensaje de Y; la oferta propia de T2 no cuenta';
end
$$;

-- -----------------------------------------------------------------------------
-- 2 · Abrir el hilo lo marca como leído, y solo para quien lo abre
-- -----------------------------------------------------------------------------
select public.mark_thread_read('13c00000-0000-4000-8000-000000000001');

do $$
declare n int;
begin
  select count(*) into n from public.unread_threads();
  assert n = 0, format('tras abrir T, mx no tendria que tener nada sin leer, tiene %s', n);
  raise notice 'OK · abrir T lo marca como leido';
end
$$;

-- Abrirlo otra vez no falla (actualiza, no duplica).
select public.mark_thread_read('13c00000-0000-4000-8000-000000000001');

reset role;
select public.t13_como('13b00000-0000-4000-8000-000000000002');

do $$
declare n int;
begin
  select count(*) into n from public.unread_threads();
  assert n = 1, format('mx2 no ha abierto T: tendria que verlo sin leer, ve %s', n);
  raise notice 'OK · leido es por miembro: mx2 sigue con T sin leer';
end
$$;

-- -----------------------------------------------------------------------------
-- 3 · Lo nuevo de la otra empresa vuelve a contar; lo propio, no
-- -----------------------------------------------------------------------------
reset role;
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv, created_at)
values
  ('13d00000-0000-4000-8000-000000000003', '13c00000-0000-4000-8000-000000000001',
   '13a00000-0000-4000-8000-000000000002', '13b00000-0000-4000-8000-000000000003', 'MENSAJE',
   decode(repeat('aa', 48), 'hex'), decode(repeat('04', 12), 'hex'), now() + interval '1 minute'),
  ('13d00000-0000-4000-8000-000000000004', '13c00000-0000-4000-8000-000000000001',
   '13a00000-0000-4000-8000-000000000001', '13b00000-0000-4000-8000-000000000001', 'MENSAJE',
   decode(repeat('aa', 48), 'hex'), decode(repeat('04', 12), 'hex'), now() + interval '2 minutes');

select public.t13_como('13b00000-0000-4000-8000-000000000001');

do $$
declare r record;
begin
  select * into strict r from public.unread_threads();
  assert r.thread_id = '13c00000-0000-4000-8000-000000000001', 'T vuelve a estar sin leer';
  assert r.unread_count = 1, format('solo el mensaje nuevo de Y cuenta, no el de antes ni el propio: %s', r.unread_count);
  assert r.last_unread_at = now() + interval '1 minute', 'last_unread_at es el del mensaje nuevo de Y';
  raise notice 'OK · lo nuevo de Y cuenta; lo leido y lo propio, no';
end
$$;

-- -----------------------------------------------------------------------------
-- 4 · Que la otra empresa cambie el estado de algo propio también cuenta
-- -----------------------------------------------------------------------------
select public.mark_thread_read('13c00000-0000-4000-8000-000000000002');
reset role;
-- Z acepta la oferta de X dentro de 3 minutos (el disparador pondría `now()`, que aquí no avanza).
update public.thread_items set estado_oferta = 'Aceptada'
 where id = '13d00000-0000-4000-8000-000000000002';
update public.thread_items set estado_changed_at = now() + interval '3 minutes'
 where id = '13d00000-0000-4000-8000-000000000002';

select public.t13_como('13b00000-0000-4000-8000-000000000001');

do $$
declare n int;
begin
  select unread_count into n from public.unread_threads()
   where thread_id = '13c00000-0000-4000-8000-000000000002';
  assert n = 1, format('la oferta propia aceptada por Z tendria que contar en T2: %s', n);
  raise notice 'OK · el cambio de estado de lo propio cuenta';
end
$$;

-- -----------------------------------------------------------------------------
-- 5 · Cada uno solo ve y escribe sus propias lecturas
-- -----------------------------------------------------------------------------
reset role;
select public.t13_como('13b00000-0000-4000-8000-000000000003');

do $$
declare n int;
begin
  select count(*) into n from public.thread_reads;
  assert n = 0, format('my no tendria que ver las lecturas de mx: ve %s', n);
  raise notice 'OK · las lecturas de otro miembro no se ven';
end
$$;

select public.t13_falla($q$
  insert into public.thread_reads (member_id, thread_id, last_read_at)
  values ('13b00000-0000-4000-8000-000000000001', '13c00000-0000-4000-8000-000000000001', now())$q$,
  'escribir la lectura de otro miembro');

select public.t13_falla($q$ select public.mark_thread_read('13c00000-0000-4000-8000-000000000002') $q$,
  'marcar como leido un hilo en el que no participa (T2 es X-Z, my es de Y)');

reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.unread_threads()', 'execute'), 'anon no ejecuta unread_threads';
  assert not has_function_privilege('anon', 'public.mark_thread_read(uuid)', 'execute'), 'anon no ejecuta mark_thread_read';
  assert has_function_privilege('authenticated', 'public.unread_threads()', 'execute'), 'authenticated ejecuta unread_threads';
  assert has_function_privilege('authenticated', 'public.mark_thread_read(uuid)', 'execute'), 'authenticated ejecuta mark_thread_read';
  raise notice 'OK · privilegios de las dos funciones';
end
$$;

rollback;
