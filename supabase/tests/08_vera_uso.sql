-- =============================================================================
-- 08 · El registro de uso de VERA y su cupo por hora (`0068`, F-256)
-- =============================================================================
-- Cada aserción lleva su mitad positiva: que el dueño puede, y que el otro, `anon` y el que no tiene
-- sesión no. Fixture propia (prefijo `8a`/`8b`); no depende de 01 ni de 07.
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

create or replace function public.t8_org(n int) returns uuid language sql immutable as
  $$ select ('8a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function public.t8_mem(n int) returns uuid language sql immutable as
  $$ select ('8b000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Tres miembros, cada uno en su organización, y un operador sin organización (el 9).
do $$
begin
  for n in 1..3 loop
    insert into auth.users (id, email) values (public.t8_mem(n), 'v' || n || '@ocho.test');
    insert into public.organizations (id, name, country, continent, status)
    values (public.t8_org(n), 'Ocho ' || n, 'ES', 'EU', 'APPROVED');
    insert into public.members (id, org_id, email, role, state)
    values (public.t8_mem(n), public.t8_org(n), 'v' || n || '@ocho.test', 'EDITOR', 'PENDING_REVIEW');
    update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex') where id = public.t8_mem(n);
  end loop;
  insert into auth.users (id, email) values (public.t8_mem(9), 'op@ocho.test');
  insert into public.platform_operators (id, full_name) values (public.t8_mem(9), 'Operador ocho');

  -- El 1 ya ha gastado su cupo: 150 llamadas hace 30 minutos. El 3 también, pero hace 61: ya no cuentan.
  insert into public.vera_usage (user_id, org_id, created_at, closed_at, ok)
  select public.t8_mem(1), public.t8_org(1), now() - interval '30 minutes', now() - interval '30 minutes', true
    from generate_series(1, 150);
  insert into public.vera_usage (user_id, org_id, created_at, closed_at, ok)
  select public.t8_mem(3), public.t8_org(3), now() - interval '61 minutes', now() - interval '61 minutes', true
    from generate_series(1, 150);
end
$$;

-- -----------------------------------------------------------------------------
-- 1 · Con cupo: abre, deja la fila contada con su organización, y solo el dueño la cierra, una vez
-- -----------------------------------------------------------------------------
do $$
declare r jsonb; t uuid; t2 uuid;
begin
  perform set_config('request.jwt.claim.sub', public.t8_mem(2)::text, true);
  set local role authenticated;
  r := public.vera_abrir_turno(true);
  assert (r->>'permitido')::boolean, '0068: con cupo, vera_abrir_turno permite';
  assert (r->>'restantes')::int = 149, '0068: la primera llamada de la hora deja 149';
  t := (r->>'turno')::uuid;
  assert t is not null, '0068: devuelve el turno';

  r := public.vera_abrir_turno(false);
  t2 := (r->>'turno')::uuid;
  assert (r->>'restantes')::int = 148, '0068: la segunda cuenta, aunque sea una vuelta de herramienta';

  assert public.vera_cerrar_turno(t, true, 'claude-sonnet-5', 'end_turn', 100, 20, 0, 18700),
    '0068: el dueño cierra su turno';
  assert not public.vera_cerrar_turno(t, true, 'claude-sonnet-5', 'end_turn', 1, 1, 1, 1),
    '0068: un turno cerrado no se reescribe';
  reset role;

  assert (select org_id from public.vera_usage where id = t) = public.t8_org(2), '0068: la fila lleva la organización';
  assert (select cache_read_input_tokens from public.vera_usage where id = t) = 18700, '0068: guarda el usage del cierre';
  assert (select es_pregunta from public.vera_usage where id = t2) = false, '0068: guarda si era pregunta';

  -- Otro usuario no cierra el turno abierto del 2.
  perform set_config('request.jwt.claim.sub', public.t8_mem(3)::text, true);
  set local role authenticated;
  assert not public.vera_cerrar_turno(t2, true, 'x', 'x', 0, 0, 0, 0), '0068: nadie cierra el turno de otro';
  reset role;
  assert (select closed_at from public.vera_usage where id = t2) is null, '0068: el turno ajeno sigue abierto';
  raise notice 'OK · 0068: abrir y cerrar turno, solo el propio y una vez';
end
$$;

-- -----------------------------------------------------------------------------
-- 2 · Sin cupo: no abre, y dice cuándo vuelve a caber. Lo de hace más de una hora no cuenta.
-- -----------------------------------------------------------------------------
do $$
declare r jsonb; antes int;
begin
  select count(*) into antes from public.vera_usage where user_id = public.t8_mem(1);
  perform set_config('request.jwt.claim.sub', public.t8_mem(1)::text, true);
  set local role authenticated;
  r := public.vera_abrir_turno(true);
  reset role;
  assert not (r->>'permitido')::boolean, '0068: con 150 llamadas en la hora, no permite';
  assert (r->>'reintentar_en_s')::int between 1700 and 1801,
    '0068: reintentar cuando salga la más antigua (~30 min), no en una hora entera';
  assert (select count(*) from public.vera_usage where user_id = public.t8_mem(1)) = antes,
    '0068: una petición rechazada no deja fila';

  perform set_config('request.jwt.claim.sub', public.t8_mem(3)::text, true);
  set local role authenticated;
  r := public.vera_abrir_turno(true);
  reset role;
  assert (r->>'permitido')::boolean, '0068: 150 llamadas de hace 61 minutos ya no cuentan';
  raise notice 'OK · 0068: el cupo cierra a las 150 en 60 minutos deslizantes';
end
$$;

-- -----------------------------------------------------------------------------
-- 3 · La tabla: el miembro no la lee ni la escribe a mano; el operador la lee
-- -----------------------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', public.t8_mem(2)::text, true);
  set local role authenticated;
  select count(*) into n from public.vera_usage;
  assert n = 0, '0068: un miembro no ve filas de vera_usage, ni las suyas';
  begin
    insert into public.vera_usage (user_id) values (public.t8_mem(2));
    assert false, '0068: un miembro no inserta a mano en vera_usage';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.vera_usage;
    assert false, '0068: un miembro no borra filas para recuperar cupo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.vera_usage set created_at = now() - interval '2 hours';
    assert false, '0068: un miembro no envejece sus filas para recuperar cupo';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claim.sub', public.t8_mem(9)::text, true);
  set local role authenticated;
  select count(*) into n from public.vera_usage where user_id in (public.t8_mem(1), public.t8_mem(2), public.t8_mem(3));
  assert n > 0, '0068: el Operador de Plataforma lee vera_usage';
  reset role;
  raise notice 'OK · 0068: la tabla solo la lee el operador y nadie la escribe a mano';
end
$$;

-- -----------------------------------------------------------------------------
-- 4 · Sin sesión, nada; y `anon` no ejecuta ni lee (en el catálogo, como en 0022)
-- -----------------------------------------------------------------------------
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.vera_abrir_turno(true);
    assert false, '0068: sin sesión no se abre turno';
  exception when sqlstate '28000' then null;
  end;
  reset role;

  assert not has_function_privilege('anon', 'public.vera_abrir_turno(boolean)', 'execute'),
    '0068: anon no ejecuta vera_abrir_turno';
  assert not has_function_privilege('anon',
    'public.vera_cerrar_turno(uuid, boolean, text, text, integer, integer, integer, integer)', 'execute'),
    '0068: anon no ejecuta vera_cerrar_turno';
  assert not has_function_privilege('anon', 'public.vera_cupo_por_hora()', 'execute'),
    '0068: anon no ejecuta vera_cupo_por_hora';
  assert has_function_privilege('authenticated', 'public.vera_abrir_turno(boolean)', 'execute'),
    '0068: authenticated sí ejecuta vera_abrir_turno (control positivo)';
  assert not has_table_privilege('anon', 'public.vera_usage', 'select'), '0068: anon no lee vera_usage';
  raise notice 'OK · 0068: sin sesión y anon, fuera';
end
$$;

-- -----------------------------------------------------------------------------
-- 5 · 0079: una organización suspendida no abre turno ni gasta cupo; al reactivarla, sí
-- -----------------------------------------------------------------------------
do $$
declare r jsonb; antes int;
begin
  select count(*) into antes from public.vera_usage where user_id = public.t8_mem(2);
  update public.organizations set status = 'SUSPENDED' where id = public.t8_org(2);

  perform set_config('request.jwt.claim.sub', public.t8_mem(2)::text, true);
  set local role authenticated;
  r := public.vera_abrir_turno(true);
  reset role;
  assert not (r->>'permitido')::boolean, '0079: suspendida, vera_abrir_turno no permite';
  assert r->>'motivo' = 'organizacion_no_activa', '0079: suspendida, motivo organizacion_no_activa';
  assert (select count(*) from public.vera_usage where user_id = public.t8_mem(2)) = antes,
    '0079: el rechazo no deja fila ni gasta cupo';

  update public.organizations set status = 'APPROVED' where id = public.t8_org(2);
  perform set_config('request.jwt.claim.sub', public.t8_mem(2)::text, true);
  set local role authenticated;
  r := public.vera_abrir_turno(true);
  reset role;
  assert (r->>'permitido')::boolean, '0079: reactivada, vuelve a abrir turno (control positivo)';
  raise notice 'OK · 0079: organización suspendida fuera de VERA, reactivada dentro';
end
$$;
