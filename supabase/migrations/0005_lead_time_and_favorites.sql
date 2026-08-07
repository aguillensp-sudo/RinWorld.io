-- =============================================================================
-- 0005 · Plazo de entrega en el inventario y favoritos por distribuidora
-- =============================================================================
-- Fuente de verdad: openspec/specs/conversational-search/spec.md
--                   openspec/design-gui/specs y html aprobados/specs/Rinworld_spec_SRCH-01.md
--
-- Dos huecos que SRCH-01 abre y que el esquema del día 2 no cubría. Se detectaron
-- al diseñar el catálogo sembrado del día 3, antes de que el Coder generara las
-- 200 líneas: si salieran después, habría que sembrar dos veces.
--
-- No es una ampliación de alcance. `single-reference-search` es explícito:
-- "aplicar filtros por marca, país, cantidad mínima y LEAD TIME como chips
-- editables", y la tabla de `Rinworld_spec_SRCH-01.md` lista `Plazo` como columna 5
-- y ordenable por clic de cabecera y por instrucción a VERA. Sin estos campos,
-- SRCH-01 no cumple su spec — y SRCH-01 es la pantalla que no se recorta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lead_time_days · EN CLARO, indexado
--
-- El mismo patrón que `quantity`, y por la misma razón: en el CATÁLOGO es un
-- atributo de disponibilidad que hay que poder filtrar y ordenar entre
-- organizaciones; en la TARJETA DE OFERTA es una cifra negociada y va cifrada
-- (RNG-VND-01 lo lista entre los ocho campos E2EE de la oferta).
--
-- Mismo nombre, tratamiento opuesto según dónde viva. Es la segunda vez que pasa
-- en este esquema; la primera fue `quantity`.
-- -----------------------------------------------------------------------------
alter table public.inventory_lines
  add column lead_time_days integer;

alter table public.inventory_lines
  add constraint inventory_lines_lead_time_chk
  check (lead_time_days is null or lead_time_days >= 0);

-- Chip de filtro y columna ordenable: necesita índice sobre lo publicado.
create index inventory_lines_lead_time_idx
  on public.inventory_lines (lead_time_days)
  where status = 'PUBLISHED';

comment on column public.inventory_lines.lead_time_days is
  'Plazo en dias, EN CLARO. Chip de filtro y columna 5 ordenable de SRCH-01 (single-reference-search). Cifrado solo cuando viaja en una tarjeta de oferta (RNG-VND-01).';

-- -----------------------------------------------------------------------------
-- favorite_distributors · favorites-system
--
-- El favorito es de la ORGANIZACIÓN DISTRIBUIDORA, no de la línea: "pulsa el
-- indicador de favoritos de una fila → la organización distribuidora queda
-- marcada como favorita". Manual, informativo, y **sin efecto en la ordenación**
-- (RNG-SRCH-08): ningún evento de plataforma puede crear, modificar ni borrar uno.
-- Por eso no hay trigger que los toque — solo la acción explícita del miembro.
-- -----------------------------------------------------------------------------
create table public.favorite_distributors (
  member_id          uuid not null references public.members (id) on delete cascade,
  distributor_org_id uuid not null references public.organizations (id) on delete cascade,
  created_at         timestamptz not null default now(),

  primary key (member_id, distributor_org_id)
);

create index favorite_distributors_org_idx
  on public.favorite_distributors (distributor_org_id);

alter table public.favorite_distributors enable row level security;

-- Cada miembro gestiona exclusivamente su propia lista.
create policy favorites_select_own on public.favorite_distributors
  for select to authenticated
  using (member_id = auth.uid());

create policy favorites_insert_own on public.favorite_distributors
  for insert to authenticated
  with check (member_id = auth.uid() and app.is_active_member());

create policy favorites_delete_own on public.favorite_distributors
  for delete to authenticated
  using (member_id = auth.uid());

-- El RECUENTO de la columna 9 es agregado: la estrella la marca cada uno, pero el
-- número que se ve es de toda la plataforma. Con RLS restringida a las filas
-- propias, ese número no se puede calcular desde el cliente.
--
-- Se resuelve con un contador desnormalizado en `organizations`, mantenido por
-- trigger. La alternativa era una vista agregada, pero una vista se ejecuta con
-- los privilegios de su dueño y por tanto bypasea RLS: el linter de Supabase la
-- marca como `security_definer_view` a nivel **ERROR**, y con razón — es un objeto
-- que lee por encima de RLS y hay que justificarlo cada vez. Un contador no
-- necesita ningún privilegio especial para leerse: vive en una tabla que ya es
-- legible, y `organizations` ya se consulta en la misma query de SRCH-01.
--
-- No choca con RNG-SRCH-08 ("sin efecto en la ordenación ni influenciable por
-- ningún algoritmo o evento de actividad"): esa regla prohíbe crear o modificar
-- **favoritos** automáticamente, no cachear su recuento. Ningún evento de
-- plataforma escribe en `favorite_distributors`; solo el miembro.
alter table public.organizations
  add column favorite_count integer not null default 0;

alter table public.organizations
  add constraint organizations_favorite_count_chk check (favorite_count >= 0);

comment on column public.organizations.favorite_count is
  'Recuento agregado de favoritos, para la columna 9 de SRCH-01. Cache derivado de favorite_distributors: expone el numero, nunca quien marco.';

create or replace function app.sync_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.organizations
      set favorite_count = favorite_count + 1
      where id = new.distributor_org_id;
  elsif tg_op = 'DELETE' then
    update public.organizations
      set favorite_count = greatest(favorite_count - 1, 0)
      where id = old.distributor_org_id;
  end if;
  return null;
end;
$$;

create trigger favorite_distributors_sync_count
  after insert or delete on public.favorite_distributors
  for each row execute function app.sync_favorite_count();

-- El contador es derivado: el cliente no lo toca. `organizations_guard_columns`
-- ya impedía cambiar nombre, sede y status desde el cliente; se le añade
-- favorite_count. El trigger de arriba pasa porque es SECURITY DEFINER y dentro
-- de él `current_user` es el dueño de la función.
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
  or new.status is distinct from old.status
  or new.favorite_count is distinct from old.favorite_count then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode (INV-07); el resto es del operador o derivado';
  end if;
  return new;
end;
$$;

grant select, insert, delete on public.favorite_distributors to authenticated, service_role;
