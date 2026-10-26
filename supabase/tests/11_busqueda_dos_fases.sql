-- =============================================================================
-- 11 · Búsqueda en dos fases: `search_part_keys` y `search_offers` (`0076`)
-- =============================================================================
-- Se prueba como un miembro de verdad (rol `authenticated`, RLS encendida), no como `postgres`:
-- un aserto de visibilidad hecho por el superusuario no comprueba nada.
-- Fixture propia (prefijo `11a`/`11b`) dentro de una transacción que se deshace; no depende de
-- 01 ni de 07.
--
-- La serie 7711 no existe: así ningún otro fichero de la fase 1 (que comparte base) cuela líneas.
--
--   V  · la que busca      · ES, EU · tiene su propia 7711-2RS: no puede salir
--   A  · vende             · DE, EU · 7711-2RS ×1 (más una DRAFT), 7711-2RS C3, 7711 ZZ, S-7711-2RS
--   B  · vende             · TR, AS · 7711-2RS y 77112RS (misma clave), NSK
--   C  · vende, pero excluye a V (RESTRINGIDA) · FR, EU · 7711-2RS: no puede salir
--
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

create function public.t11_org(n int) returns uuid language sql immutable as
  $$ select ('11a00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

do $$
declare
  v uuid := public.t11_org(1);
  a uuid := public.t11_org(2);
  b uuid := public.t11_org(3);
  c uuid := public.t11_org(4);
  m uuid := '11b00000-0000-4000-8000-000000000001';
begin
  insert into public.organizations (id, name, country, continent, status) values
    (v, 'Once V', 'ES', 'EU', 'APPROVED'),
    (a, 'Once A', 'DE', 'EU', 'APPROVED'),
    (b, 'Once B', 'TR', 'AS', 'APPROVED'),
    (c, 'Once C', 'FR', 'EU', 'APPROVED');
  update public.organizations set inventory_visibility_mode = 'RESTRINGIDA' where id = c;
  insert into public.inventory_exclusions (owner_org_id, excluded_org_id) values (c, v);

  insert into auth.users (id, email) values (m, 'v@once.test');
  insert into public.members (id, org_id, email, role, state) values (m, v, 'v@once.test', 'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex') where id = m;

  insert into public.inventory_lines
    (org_id, part_number, brand, quantity, location_country, product_family, status, last_upload_at) values
    (v, '7711-2RS',    'SKF', 99, 'ES', 'F', 'PUBLISHED', now()),
    (a, '7711-2RS',    'SKF', 10, 'DE', 'F', 'PUBLISHED', now() - interval '1 day'),
    (a, '7711-2RS',    'SKF', 77, 'DE', 'F', 'DRAFT',     now()),
    (a, '7711-2RS C3', 'SKF',  5, 'DE', 'F', 'PUBLISHED', now() - interval '2 days'),
    (a, '7711 ZZ',     'FAG',  2, 'DE', 'F', 'PUBLISHED', now() - interval '3 days'),
    (a, 'S-7711-2RS',  'SKF',  4, 'DE', 'F', 'PUBLISHED', now() - interval '4 days'),
    (b, '7711-2RS',    'NSK', 20, 'TR', 'F', 'PUBLISHED', now() - interval '5 hours'),
    (b, '77112RS',     'NSK',  1, 'TR', 'F', 'PUBLISHED', now() - interval '6 days'),
    (c, '7711-2RS',    'SKF', 50, 'FR', 'F', 'PUBLISHED', now());
end
$$;

-- Actúa como el miembro de V, con RLS.
create function public.t11_como_v() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '11b00000-0000-4000-8000-000000000001', true);
  execute 'set local role authenticated';
end;
$$;

-- -----------------------------------------------------------------------------
-- 1 · Fase A: «empieza por», orden, totales, y lo que no puede salir
-- -----------------------------------------------------------------------------
do $$
declare got text; tk bigint; toff bigint; mr text;
begin
  perform public.t11_como_v();

  select string_agg(part_key || ':' || offers, ' ' order by offers desc, part_key),
         max(total_keys), max(total_offers), max(matched_ref)
    into got, tk, toff, mr
    from public.search_part_keys('7711-2rs');

  -- 77112RS: A (1 publicada; la DRAFT no), B ×2. Ni la propia, ni C (excluye a V), ni S-7711-2RS.
  if got is distinct from '77112RS:3 77112RSC3:1' then
    raise exception '0076 · 1: empieza por 7711-2rs dio [%]', got;
  end if;
  if (tk, toff, mr) is distinct from (2::bigint, 4::bigint, '77112RS'::text) then
    raise exception '0076 · 1: totales % / % y matched_ref %', tk, toff, mr;
  end if;

  -- El orden lo da la propia RPC, no el string_agg de arriba.
  select string_agg(part_key, ' ') into got from public.search_part_keys('7711-2rs');
  if got is distinct from '77112RS 77112RSC3' then
    raise exception '0076 · 1: orden de la RPC [%]', got;
  end if;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 2 · «Contiene» trae también los prefijos
-- -----------------------------------------------------------------------------
do $$
declare got text;
begin
  perform public.t11_como_v();
  select string_agg(part_key, ' ') into got from public.search_part_keys('77112RS', p_contains => true);
  if got is distinct from '77112RS 77112RSC3 S77112RS' then
    raise exception '0076 · 2: contiene dio [%]', got;
  end if;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 3 · Caso 1.3 (recorte por el final) y caso 1.4 (nada)
-- -----------------------------------------------------------------------------
do $$
declare got text; mr text; n int;
begin
  perform public.t11_como_v();

  select string_agg(part_key, ' '), max(matched_ref) into got, mr from public.search_part_keys('7711-2RX');
  if (got, mr) is distinct from ('77112RS 77112RSC3'::text, '77112R'::text) then
    raise exception '0076 · 3: 7711-2RX dio [%] con matched_ref %', got, mr;
  end if;

  -- El recorte también con «contiene»: '7112RSX' no está en ninguna clave, '7112RS' sí (en medio).
  select string_agg(part_key, ' '), max(matched_ref) into got, mr from public.search_part_keys('7112RSX', p_contains => true);
  if (got, mr) is distinct from ('77112RS 77112RSC3 S77112RS'::text, '7112RS'::text) then
    raise exception '0076 · 3: contiene 7112RSX dio [%] con matched_ref %', got, mr;
  end if;

  -- El recorte cuenta solo lo que pasa los filtros: con marca FAG, de 7711-2RS solo casa 7711.
  select string_agg(part_key, ' '), max(matched_ref) into got, mr from public.search_part_keys('7711-2RS', p_brand => 'FAG');
  if (got, mr) is distinct from ('7711ZZ'::text, '7711'::text) then
    raise exception '0076 · 3: 7711-2RS con marca FAG dio [%] con matched_ref %', got, mr;
  end if;

  select count(*) into n from public.search_part_keys('Q999');
  if n <> 0 then
    raise exception '0076 · 3: Q999 debía dar cero filas y dio %', n;
  end if;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 4 · Filtros, aplicados antes de contar
-- -----------------------------------------------------------------------------
do $$
declare got text;
begin
  perform public.t11_como_v();

  select string_agg(part_key || ':' || offers, ' ') into got from public.search_part_keys('7711', p_zone => 'EU');
  if got is distinct from '77112RS:1 77112RSC3:1 7711ZZ:1' then   -- sin B (sede en AS); empate: clave asc
    raise exception '0076 · 4: zona EU dio [%]', got;
  end if;

  select string_agg(part_key || ':' || offers, ' ') into got from public.search_part_keys('7711', p_country => 'tr');
  if got is distinct from '77112RS:2' then                           -- solo el stock que está en TR
    raise exception '0076 · 4: país TR dio [%]', got;
  end if;

  select string_agg(part_key || ':' || offers, ' ') into got from public.search_part_keys('7711', p_brand => 'skf');
  if got is distinct from '77112RS:1 77112RSC3:1' then
    raise exception '0076 · 4: marca skf dio [%]', got;
  end if;

  select string_agg(part_key || ':' || offers, ' ') into got from public.search_part_keys('7711', p_min_quantity => 5);
  if got is distinct from '77112RS:2 77112RSC3:1' then              -- 10 y 20; 5; fuera 2, 1
    raise exception '0076 · 4: cantidad >= 5 dio [%]', got;
  end if;

  select string_agg(part_key, ' ') into got from public.search_part_keys('7711', p_include => 'c-3');
  if got is distinct from '77112RSC3' then
    raise exception '0076 · 4: incluir c-3 dio [%]', got;
  end if;

  select string_agg(part_key, ' ') into got from public.search_part_keys('7711', p_exclude => 'C3');
  if got is distinct from '77112RS 7711ZZ' then
    raise exception '0076 · 4: excluir C3 dio [%]', got;
  end if;

  begin
    perform * from public.search_part_keys('7711', p_zone => 'EU', p_country => 'DE');
    raise exception '0076 · 4: zona y país a la vez no fallaron';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform * from public.search_part_keys(' -- ');
    raise exception '0076 · 4: una referencia vacía al normalizar no falló';
  exception when sqlstate '22023' then null;
  end;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 5 · Paginación de la lista previa
-- -----------------------------------------------------------------------------
do $$
declare got text; tk bigint;
begin
  perform public.t11_como_v();
  select string_agg(part_key, ' '), max(total_keys) into got, tk
    from public.search_part_keys('7711-2RS', p_page => 2, p_page_size => 1);
  if (got, tk) is distinct from ('77112RSC3'::text, 2::bigint) then
    raise exception '0076 · 5: página 2 de 1 dio [%] con total %', got, tk;
  end if;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 6 · Fase C: por claves, por toda la búsqueda, orden por fecha y paginación
-- -----------------------------------------------------------------------------
do $$
declare got text; tot bigint; n bigint;
begin
  perform public.t11_como_v();

  -- Las claves llegan sin normalizar (como las pega un lote) y se normalizan en el servidor.
  select string_agg(org_name || '/' || quantity, ' '), max(total) into got, tot
    from public.search_offers(p_keys => array['7711-2RS']);
  if (got, tot) is distinct from ('Once B/20 Once A/10 Once B/1'::text, 3::bigint) then
    raise exception '0076 · 6: claves [7711-2RS] dio [%] total %', got, tot;
  end if;

  select count(*), max(total) into n, tot from public.search_offers(p_ref => '77112RS');
  if (n, tot) is distinct from (4::bigint, 4::bigint) then
    raise exception '0076 · 6: todas las de 77112RS debían ser 4 y fueron % (total %)', n, tot;
  end if;

  select string_agg(org_name || '/' || quantity, ' ') into got
    from public.search_offers(p_keys => array['77112RS', '77112RSC3'], p_page => 2, p_page_size => 2);
  if got is distinct from 'Once A/5 Once B/1' then
    raise exception '0076 · 6: página 2 de 2 dio [%]', got;
  end if;

  select string_agg(part_number, ' ') into got from public.search_offers(p_keys => array['77112RS'], p_country => 'DE');
  if got is distinct from '7711-2RS' then
    raise exception '0076 · 6: los filtros también valen en la fase C, y dio [%]', got;
  end if;

  begin
    perform * from public.search_offers();
    raise exception '0076 · 6: sin referencia ni claves no falló';
  exception when sqlstate '22023' then null;
  end;
  reset role;
end
$$;

-- -----------------------------------------------------------------------------
-- 7 · Privilegios y paridad de la regla
-- -----------------------------------------------------------------------------
do $$
declare n int;
begin
  if has_function_privilege('anon', 'public.search_part_keys(text, boolean, text, integer, text, text, text, text, integer, integer)', 'execute')
     or has_function_privilege('anon', 'public.search_offers(text, boolean, text[], text, integer, text, text, text, text, integer, integer)', 'execute') then
    raise exception '0076 · 7: anon puede ejecutar las RPC de búsqueda';
  end if;
  if not has_function_privilege('authenticated', 'public.search_part_keys(text, boolean, text, integer, text, text, text, text, integer, integer)', 'execute') then
    raise exception '0076 · 7: authenticated no puede ejecutar search_part_keys';
  end if;

  select count(*) into n from public.inventory_lines where app.normalize_ref(part_number) is distinct from part_key;
  if n <> 0 then
    raise exception '0076 · 7: app.normalize_ref y la columna part_key no dan lo mismo en % líneas', n;
  end if;
end
$$;

rollback;
