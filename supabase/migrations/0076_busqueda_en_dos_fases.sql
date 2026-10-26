-- =============================================================================
-- 0076 · Búsqueda en dos fases: `search_part_keys` (lista previa) y `search_offers` (ofertas)
-- =============================================================================
-- Contrato: `openspec/changes/amend-srch01-busqueda-en-dos-fases/` (requirements
-- `single-reference-search`, `preliminary-list`, `offers-list`), decidido por el PO el
-- 25-oct-2026 (`DECISIONES-V1.md`). Se apoya en la clave `part_key` de `0073`-`0075`.
--
-- QUÉ HAY:
--   · `app.normalize_ref(text)`: la misma regla que la columna generada, para normalizar en
--     el servidor lo que escribe el usuario (REF, incluir, excluir, las claves de un lote).
--     Así la regla tiene una sola fuente dentro de la base; `10_clave_normalizada.sql` compara
--     las dos. `normalizeRef()` del cliente solo valida y pinta.
--   · `app.search_where(...)`: el FROM y el WHERE comunes, con todos los valores como literales.
--   · `app.ref_hit_len(...)`: hasta qué longitud casa una referencia con una clave (caso 1.3).
--   · `public.search_part_keys(...)`: fase A. Agrupa por clave, cuenta ofertas, ordena por
--     ofertas desc y clave asc, pagina, y hace el recorte del caso 1.3.
--   · `public.search_offers(...)`: fase C. Las ofertas de unas claves (`p_keys`) o de toda la
--     búsqueda (`p_ref`), por `last_upload_at desc, id asc`, paginadas.
--
-- POR QUÉ SQL DINÁMICO CON LITERALES. Un `like $1` con parámetro deja al planificador sin
-- saber que el patrón empieza por `NU214`, y en plan genérico no usa el btree de prefijo.
-- `format('%L')` pone el valor en el texto: plan a medida en cada llamada, y `%L` escapa,
-- así que no hay inyección. Es el «SQL dinámico» que `F-253` ya preveía para `search_catalog`.
--
-- VISIBILIDAD. Las dos RPC son `security invoker`: la RLS de `inventory_lines` sigue mandando.
-- Además el WHERE repite literalmente los predicados de `inventory_select_cross_org` (`0064`):
-- `PUBLISHED`, no la propia organización, miembro activo y `visible_inventory_owner_ids()`.
-- Repetirlos no cambia qué se ve (la RLS ya lo impone), pero excluye explícitamente la política
-- `inventory_select_own`, que si no colaría el inventario propio (`search.ts`, F de `fetchResults`).
--
-- FILTROS (todos opcionales salvo la referencia o las claves):
--   · marca: `brand ilike %marca%`, con `%`, `_` y `\` escapados;
--   · cantidad: `quantity >= n`;
--   · incluir / excluir: sobre la clave normalizada;
--   · zona: continente de la SEDE (`organizations.continent`); país: dónde está el STOCK
--     (`location_country`). Son excluyentes: el desplegable ARE da uno u otro, nunca los dos.
--
-- CASO 1.3. Si la referencia no da ninguna clave con los filtros puestos, se recorta por el final
-- hasta la cadena más larga que sí dé algo. `matched_ref` dice con qué cadena se encontró; si es
-- la referencia entera, no hubo recorte. Si ni el primer carácter da nada (caso 1.4), cero filas.
-- La fase C recibe `matched_ref` como `p_ref`: no repite el recorte.
-- El recorte NO se hace probando carácter a carácter: cada prueba es un barrido de lo visible
-- (~300 ms en producción el 25-oct-2026), y una referencia de 8 caracteres sin nada que casar
-- serían 8 barridos. Se hace en UNA pasada sobre las líneas que casan con el primer carácter:
-- `app.ref_hit_len` dice, para cada clave, hasta qué longitud casa la referencia, y el máximo es
-- el recorte. Como mucho tres consultas: la entera, la del recorte y la final.
--
-- TOTALES. `total_keys`, `total_offers` y `total` salen con cada fila (`count(*) over ()`, que se
-- calcula antes del LIMIT). Una página fuera de rango devuelve cero filas y por tanto sin totales:
-- el cliente los tiene de la página que ya enseña.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La regla de normalización, como función
-- -----------------------------------------------------------------------------
create or replace function app.normalize_ref(p text)
returns text
language sql
immutable
parallel safe
as $$
  select upper(translate(
           regexp_replace(
             regexp_replace(p, '[^A-Za-z0-9/.,]', '', 'g'),
             '(?<![0-9])[/.,]|[/.,](?![0-9])', '', 'g'),
           ',', '.'));
$$;

comment on function app.normalize_ref(text) is
  'La misma regla que inventory_lines.part_key (0073-0075). Si se cambia una, se cambia la otra: 10_clave_normalizada.sql las compara.';

-- -----------------------------------------------------------------------------
-- 2 · FROM y WHERE comunes
-- -----------------------------------------------------------------------------
create or replace function app.search_where(
  p_pattern      text,
  p_keys         text[],
  p_brand        text,
  p_min_quantity integer,
  p_include      text,
  p_exclude      text,
  p_zone         text,
  p_country      text
)
returns text
language plpgsql
immutable
as $$
declare
  w       text;
  v_brand text := nullif(btrim(p_brand), '');
  v_inc   text := nullif(app.normalize_ref(p_include), '');
  v_exc   text := nullif(app.normalize_ref(p_exclude), '');
  v_zone  text := nullif(upper(btrim(p_zone)), '');
  v_ctry  text := nullif(upper(btrim(p_country)), '');
begin
  if v_zone is not null and v_ctry is not null then
    raise exception 'Zona y país son excluyentes: se filtra por uno o por otro' using errcode = '22023';
  end if;
  if v_zone is not null and v_zone not in ('AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA') then
    raise exception 'Zona desconocida: %', v_zone using errcode = '22023';
  end if;
  if v_ctry is not null and v_ctry !~ '^[A-Z]{2}$' then
    raise exception 'País no es un código ISO-3166-1 alfa-2: %', v_ctry using errcode = '22023';
  end if;

  w := $w$
      from public.inventory_lines l
      join public.organizations o on o.id = l.org_id
     where l.status = 'PUBLISHED'
       and l.org_id <> (select app.current_org_id())
       and (select app.is_active_member())
       and l.org_id in (select app.visible_inventory_owner_ids())$w$;

  if p_pattern is not null then
    w := w || format(' and l.part_key like %L', p_pattern);
  end if;
  if p_keys is not null then
    w := w || format(' and l.part_key = any (%L::text[])', p_keys);
  end if;
  if v_brand is not null then
    w := w || format(' and l.brand ilike %L',
                     '%' || replace(replace(replace(v_brand, '\', '\\'), '%', '\%'), '_', '\_') || '%');
  end if;
  if p_min_quantity is not null then
    w := w || format(' and l.quantity >= %s', p_min_quantity);
  end if;
  if v_inc is not null then
    w := w || format(' and l.part_key like %L', '%' || v_inc || '%');
  end if;
  if v_exc is not null then
    w := w || format(' and l.part_key not like %L', '%' || v_exc || '%');
  end if;
  if v_zone is not null then
    w := w || format(' and o.continent = %L', v_zone);
  end if;
  if v_ctry is not null then
    w := w || format(' and l.location_country = %L', v_ctry);
  end if;

  return w;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3 · Hasta qué longitud casa una referencia con una clave (para el caso 1.3)
-- -----------------------------------------------------------------------------
-- La mayor `n` tal que los `n` primeros caracteres de `p_ref` casan con `p_key`: como prefijo,
-- o en cualquier posición con `p_contains`. 0 si ni el primero casa.
create or replace function app.ref_hit_len(p_key text, p_ref text, p_contains boolean)
returns integer
language plpgsql
immutable
parallel safe
as $$
begin
  for n in reverse length(p_ref)..1 loop
    if (p_contains and strpos(p_key, left(p_ref, n)) > 0)
       or (not p_contains and left(p_key, n) = left(p_ref, n)) then
      return n;
    end if;
  end loop;
  return 0;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4 · Fase A: lista previa
-- -----------------------------------------------------------------------------
create or replace function public.search_part_keys(
  p_ref          text,
  p_contains     boolean default false,
  p_brand        text    default null,
  p_min_quantity integer default null,
  p_include      text    default null,
  p_exclude      text    default null,
  p_zone         text    default null,
  p_country      text    default null,
  p_page         integer default 1,
  p_page_size    integer default 60
)
returns table (part_key text, offers bigint, total_keys bigint, total_offers bigint, matched_ref text)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ref      text    := app.normalize_ref(p_ref);
  v_contains boolean := coalesce(p_contains, false);
  v_size     integer := least(greatest(coalesce(p_page_size, 60), 1), 200);
  v_page     integer := greatest(coalesce(p_page, 1), 1);
  v_try      text;
  v_len      integer;
  v_found    boolean;
begin
  if v_ref is null or v_ref = '' then
    raise exception 'La referencia es obligatoria' using errcode = '22023';
  end if;

  -- 1.1 / 1.2: la referencia entera.
  v_try := v_ref;
  execute 'select exists (select 1 '
          || app.search_where(case when v_contains then '%' || v_try || '%' else v_try || '%' end,
                              null, p_brand, p_min_quantity, p_include, p_exclude, p_zone, p_country)
          || ')'
     into v_found;

  -- 1.3: el recorte más largo que casa, en una pasada sobre lo que casa con el primer carácter.
  if not v_found then
    execute format('select coalesce(max(app.ref_hit_len(l.part_key, %L, %L)), 0) ', v_ref, v_contains)
            || app.search_where(case when v_contains then '%' || left(v_ref, 1) || '%' else left(v_ref, 1) || '%' end,
                                null, p_brand, p_min_quantity, p_include, p_exclude, p_zone, p_country)
       into v_len;
    if v_len = 0 then
      return;  -- 1.4: ni el primer carácter casa. Cero filas.
    end if;
    v_try := left(v_ref, v_len);
  end if;

  return query execute format($q$
    select k.part_key, k.offers, count(*) over (), (sum(k.offers) over ())::bigint, %L::text
      from (select l.part_key, count(*) as offers %s group by l.part_key) k
     order by k.offers desc, k.part_key
     limit %s offset %s$q$,
    v_try,
    app.search_where(case when v_contains then '%' || v_try || '%' else v_try || '%' end,
                     null, p_brand, p_min_quantity, p_include, p_exclude, p_zone, p_country),
    v_size, (v_page - 1) * v_size);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5 · Fase C: ofertas
-- -----------------------------------------------------------------------------
create or replace function public.search_offers(
  p_ref          text    default null,
  p_contains     boolean default false,
  p_keys         text[]  default null,
  p_brand        text    default null,
  p_min_quantity integer default null,
  p_include      text    default null,
  p_exclude      text    default null,
  p_zone         text    default null,
  p_country      text    default null,
  p_page         integer default 1,
  p_page_size    integer default 50
)
returns table (
  id               uuid,
  part_number      text,
  part_key         text,
  brand            text,
  quantity         integer,
  lead_time_days   integer,
  location_country text,
  last_upload_at   timestamptz,
  org_id           uuid,
  org_name         text,
  org_country      text,
  org_continent    text,
  favorite_count   integer,
  total            bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ref     text    := nullif(app.normalize_ref(p_ref), '');
  v_size    integer := least(greatest(coalesce(p_page_size, 50), 1), 200);
  v_page    integer := greatest(coalesce(p_page, 1), 1);
  v_keys    text[];
  v_pattern text;
begin
  if p_keys is not null then
    select array_agg(distinct k) into v_keys
      from (select app.normalize_ref(x) as k from unnest(p_keys) as x) s
     where k <> '';
    if v_keys is null then
      raise exception 'Ninguna clave válida' using errcode = '22023';
    end if;
  elsif v_ref is null then
    raise exception 'La referencia o las claves son obligatorias' using errcode = '22023';
  else
    v_pattern := case when coalesce(p_contains, false) then '%' || v_ref || '%' else v_ref || '%' end;
  end if;

  return query execute format($q$
    select l.id, l.part_number, l.part_key, l.brand, l.quantity, l.lead_time_days, l.location_country,
           l.last_upload_at, l.org_id, o.name, o.country, o.continent, o.favorite_count, count(*) over ()
      %s
     order by l.last_upload_at desc, l.id
     limit %s offset %s$q$,
    app.search_where(v_pattern, v_keys, p_brand, p_min_quantity, p_include, p_exclude, p_zone, p_country),
    v_size, (v_page - 1) * v_size);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6 · Privilegios: solo `authenticated` (0022, 0071: ninguna función de public la ejecuta anon)
-- -----------------------------------------------------------------------------
revoke execute on function app.normalize_ref(text) from public, anon;
revoke execute on function app.ref_hit_len(text, text, boolean) from public, anon;
grant  execute on function app.ref_hit_len(text, text, boolean) to authenticated;
revoke execute on function app.search_where(text, text[], text, integer, text, text, text, text) from public, anon;
revoke execute on function public.search_part_keys(text, boolean, text, integer, text, text, text, text, integer, integer) from public, anon;
revoke execute on function public.search_offers(text, boolean, text[], text, integer, text, text, text, text, integer, integer) from public, anon;
grant  execute on function app.normalize_ref(text) to authenticated;
grant  execute on function app.search_where(text, text[], text, integer, text, text, text, text) to authenticated;
grant  execute on function public.search_part_keys(text, boolean, text, integer, text, text, text, text, integer, integer) to authenticated;
grant  execute on function public.search_offers(text, boolean, text[], text, integer, text, text, text, text, integer, integer) to authenticated;
