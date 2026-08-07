-- =============================================================================
-- 0006 · Sustituir la vista agregada de favoritos por un contador
-- =============================================================================
-- La primera versión de 0005 resolvía el recuento de la columna 9 de SRCH-01 con
-- una vista agregada. `get_advisors` la marcó como `security_definer_view` a nivel
-- **ERROR**: una vista se ejecuta con los privilegios de su dueño, así que lee por
-- encima de RLS. Exponía solo el número y no la identidad de quien marcó, pero un
-- ERROR de seguridad abierto es lo que después tapa uno de verdad.
--
-- 0005 ya está corregida en origen, así que en una base nueva esta migración no
-- cambia nada: es idempotente. Existe para la base donde la vista ya se creó, que
-- es el proyecto remoto.
-- =============================================================================

drop view if exists public.distributor_favorite_counts;

alter table public.organizations
  add column if not exists favorite_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_favorite_count_chk'
  ) then
    alter table public.organizations
      add constraint organizations_favorite_count_chk check (favorite_count >= 0);
  end if;
end
$$;

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

drop trigger if exists favorite_distributors_sync_count on public.favorite_distributors;
create trigger favorite_distributors_sync_count
  after insert or delete on public.favorite_distributors
  for each row execute function app.sync_favorite_count();

-- Recalcular por si ya había favoritos antes del contador.
update public.organizations o
  set favorite_count = coalesce(
    (select count(*) from public.favorite_distributors f where f.distributor_org_id = o.id), 0);

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
