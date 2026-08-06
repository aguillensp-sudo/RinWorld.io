-- =============================================================================
-- 0002 · Inventario, visibilidad (INV-07) y lectura cruzada entre organizaciones
-- =============================================================================
-- Fuente de verdad: openspec/specs/inventory-management/spec.md
--                   openspec/specs/conversational-search/spec.md
--                   openspec/mvp/Dia-02_decisiones_esquema.md §1.1 y §2
--
-- LA FRONTERA, AQUÍ: el catálogo es buscable entre organizaciones, pero
-- `unit_price` va cifrado E2EE también en la línea de inventario y "nunca se
-- indexa en texto plano ni es accesible para el servidor"
-- (inventory-management · scenario "unit_price cifrado E2EE").
-- Consecuencia aceptada por el PO el 6-ago-2026: SRCH-01 no ordena ni filtra
-- por precio — ya está en Out of Scope de conversational-search.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- visibility-control · modo por organización
--
-- La lista de exclusión es tabla propia y NO se borra al pasar a VISIBLE_TODOS:
-- "la lista de exclusión queda inactiva pero no se borra ... si el miembro
-- reactiva el modo restringido, la lista previa se recupera".
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column inventory_visibility_mode text not null default 'VISIBLE_TODOS';

alter table public.organizations
  add constraint organizations_visibility_mode_chk
  check (inventory_visibility_mode in ('VISIBLE_TODOS','RESTRINGIDA'));

comment on column public.organizations.inventory_visibility_mode is
  'INV-07. VISIBLE_TODOS = "VISIBLE PARA TODOS LOS MIEMBROS" (defecto). RESTRINGIDA activa inventory_exclusions.';

create table public.inventory_exclusions (
  id                uuid primary key default gen_random_uuid(),
  owner_org_id      uuid not null references public.organizations (id) on delete cascade,

  -- Exactamente uno de los tres. Por organización concreta (se busca por nombre
  -- parcial en INV-07 y se guarda el id), por país o por continente.
  excluded_org_id   uuid references public.organizations (id) on delete cascade,
  excluded_country  text,
  excluded_continent text,

  created_at        timestamptz not null default now(),

  constraint inventory_exclusions_one_target_chk check (
    (excluded_org_id   is not null)::int
  + (excluded_country  is not null)::int
  + (excluded_continent is not null)::int = 1
  ),
  constraint inventory_exclusions_not_self_chk check (excluded_org_id is distinct from owner_org_id),
  constraint inventory_exclusions_country_chk check (excluded_country is null or excluded_country ~ '^[A-Z]{2}$'),
  constraint inventory_exclusions_continent_chk check (
    excluded_continent is null or excluded_continent in ('AF','AN','AS','EU','NA','OC','SA')
  )
);

create unique index inventory_exclusions_org_uniq
  on public.inventory_exclusions (owner_org_id, excluded_org_id)
  where excluded_org_id is not null;
create unique index inventory_exclusions_country_uniq
  on public.inventory_exclusions (owner_org_id, excluded_country)
  where excluded_country is not null;
create unique index inventory_exclusions_continent_uniq
  on public.inventory_exclusions (owner_org_id, excluded_continent)
  where excluded_continent is not null;

-- -----------------------------------------------------------------------------
-- inventory_lines · canonical-schema
-- -----------------------------------------------------------------------------
create table public.inventory_lines (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,

  -- Obligatorios y EN CLARO: son lo que hace buscable el catálogo (SRCH-01).
  part_number       text not null,
  brand             text not null,
  quantity          integer not null,
  location_country  text not null,
  -- product_family es obligatoria; el motor IA la infiere si el archivo no la
  -- trae, y las líneas donde no sea posible inferirla "quedan marcadas como
  -- error" — es decir, no llegan a insertarse como línea válida.
  product_family    text not null,

  -- inventory-line-lifecycle: CUATRO estados, sin transición automática por
  -- antigüedad. Ojo: INV-01 solo pinta tres (DRAFT/PUBLISHED/ARCHIVED); DELETED
  -- existe en el spec y falta en la pantalla.
  status            text not null default 'DRAFT',

  -- ⚠ E2EE. Nunca en claro, nunca indexado. Ver cabecera.
  unit_price_ciphertext bytea,
  unit_price_iv         bytea,

  -- data-freshness: los indicadores de 7 y 30 días se derivan de last_upload_at.
  -- Los dos timestamps de notificación garantizan "una sola vez por umbral"
  -- (NOT-INV-03 / NOT-INV-04). Sin uso en el MVP: no hay email en las 8 pantallas.
  last_upload_at    timestamptz not null default now(),
  freshness_notified_7d_at  timestamptz,
  freshness_notified_30d_at timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint inventory_lines_status_chk check (
    status in ('DRAFT','PUBLISHED','ARCHIVED','DELETED')
  ),
  -- "cantidad negativa" es uno de los errores de importación que el spec nombra.
  constraint inventory_lines_quantity_chk check (quantity >= 0),
  constraint inventory_lines_country_chk check (location_country ~ '^[A-Z]{2}$'),
  constraint inventory_lines_price_pair_chk check (
    (unit_price_ciphertext is null and unit_price_iv is null)
    or (unit_price_ciphertext is not null and unit_price_iv is not null)
  ),
  constraint inventory_lines_price_iv_len_chk check (
    unit_price_iv is null or octet_length(unit_price_iv) = 12
  )
);

-- Índices de búsqueda (§2 del documento de decisiones). Ninguno toca el precio.
create index inventory_lines_search_idx
  on public.inventory_lines (part_number, brand)
  where status = 'PUBLISHED';
create index inventory_lines_part_trgm
  on public.inventory_lines using gin (part_number gin_trgm_ops);
create index inventory_lines_org_status_idx on public.inventory_lines (org_id, status);
create index inventory_lines_country_idx on public.inventory_lines (location_country) where status = 'PUBLISHED';
create index inventory_lines_family_idx  on public.inventory_lines (product_family) where status = 'PUBLISHED';
create index inventory_lines_freshness_idx on public.inventory_lines (last_upload_at) where status = 'PUBLISHED';

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger inventory_lines_touch
  before update on public.inventory_lines
  for each row execute function app.touch_updated_at();

-- Límite de 500.000 líneas PUBLISHED por organización. A nivel de sentencia, no
-- de fila: una importación de 50 MB es una sola sentencia y no debe contar
-- 500.000 veces. El índice (org_id, status) lo resuelve con index-only scan.
create or replace function app.check_inventory_line_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  offending record;
begin
  for offending in
    select org_id, count(*) as n
    from public.inventory_lines
    where status = 'PUBLISHED'
    group by org_id
    having count(*) > 500000
  loop
    raise exception
      'Límite de inventario alcanzado: la organización % tendría % líneas PUBLISHED (máximo 500000). Archiva o elimina stock antes de continuar.',
      offending.org_id, offending.n;
  end loop;
  return null;
end;
$$;

create trigger inventory_lines_limit
  after insert or update on public.inventory_lines
  for each statement execute function app.check_inventory_line_limit();

-- -----------------------------------------------------------------------------
-- visibility-control · ¿puede la organización activa ver el inventario de otra?
--
-- SECURITY DEFINER para poder leer `organizations` y `inventory_exclusions` sin
-- que las políticas de esas tablas escondan la respuesta. Se evalúa dentro de la
-- política de lectura, así que el efecto de un cambio de exclusión es inmediato
-- — no hay job ni caché por medio, como exige el spec.
-- -----------------------------------------------------------------------------
create or replace function app.can_view_inventory_of(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select o.id, o.country, o.continent
    from public.organizations o
    where o.id = app.current_org_id()
  )
  select
    case
      when (select id from viewer) is null then false
      when owner = (select id from viewer) then true
      when (select inventory_visibility_mode from public.organizations where id = owner)
           = 'VISIBLE_TODOS' then true
      else not exists (
        select 1
        from public.inventory_exclusions e, viewer v
        where e.owner_org_id = owner
          and (
            e.excluded_org_id    = v.id
         or e.excluded_country   = v.country
         or e.excluded_continent = v.continent
          )
      )
    end;
$$;

revoke execute on function app.can_view_inventory_of(uuid) from public;
grant  execute on function app.can_view_inventory_of(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.inventory_lines      enable row level security;
alter table public.inventory_exclusions enable row level security;

-- La organización ve su propio inventario completo, en cualquier estado.
create policy inventory_select_own on public.inventory_lines
  for select to authenticated
  using (org_id = app.current_org_id());

-- Y ve el de las demás solo PUBLISHED y solo si no está excluida. Esto es lo que
-- alimenta SRCH-01 el día 6.
create policy inventory_select_cross_org on public.inventory_lines
  for select to authenticated
  using (
    status = 'PUBLISHED'
    and org_id <> app.current_org_id()
    and app.is_active_member()
    and app.can_view_inventory_of(org_id)
  );

create policy inventory_write_own on public.inventory_lines
  for all to authenticated
  using (org_id = app.current_org_id() and app.is_active_member())
  with check (org_id = app.current_org_id() and app.is_active_member());

-- La lista de exclusión es configuración de organización: solo el ADMIN, y nadie
-- ve las exclusiones de otra organización.
-- INV-07 es una pantalla de configuración: el ADMIN tiene que poder cambiar el
-- modo de visibilidad de su organización. Sin esta política, `organizations` solo
-- sería escribible por el operador y la pantalla no funcionaría. El trigger de
-- abajo acota el permiso a esa única columna: nombre, sede y status siguen siendo
-- del operador (operator-approval).
create policy organizations_update_visibility_admin on public.organizations
  for update to authenticated
  using (id = app.current_org_id() and app.is_org_admin())
  with check (id = app.current_org_id() and app.is_org_admin());

create or replace function app.guard_organization_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  if new.name   is distinct from old.name
  or new.legal_name is distinct from old.legal_name
  or new.country is distinct from old.country
  or new.continent is distinct from old.continent
  or new.status is distinct from old.status then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode (INV-07); el resto es del operador';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_columns
  before update on public.organizations
  for each row execute function app.guard_organization_columns();

create policy exclusions_select_own on public.inventory_exclusions
  for select to authenticated
  using (owner_org_id = app.current_org_id());

create policy exclusions_write_admin on public.inventory_exclusions
  for all to authenticated
  using (owner_org_id = app.current_org_id() and app.is_org_admin())
  with check (owner_org_id = app.current_org_id() and app.is_org_admin());

grant select, insert, update, delete on public.inventory_lines      to authenticated, service_role;
grant select, insert, update, delete on public.inventory_exclusions to authenticated, service_role;

comment on column public.inventory_lines.unit_price_ciphertext is
  'E2EE. inventory-management exige unit_price cifrado en la propia linea y no indexado. Por eso SRCH-01 no ordena por precio (Out of Scope de conversational-search).';
