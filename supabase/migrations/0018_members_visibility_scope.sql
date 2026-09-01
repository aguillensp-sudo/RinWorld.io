-- =============================================================================
-- 0018 · members.visibility_scope (ADR-002 D-4)
-- =============================================================================
-- Fuente de verdad: docs/ADR-002_Ambito_de_visibilidad_por_usuario.md §5, D-4.
--
-- Columna soldada al ROL en V1 -- el comportamiento es el que pide el PO, pero
-- NO se implementa reutilizando `role`: el dia que un cliente pida desacoplar
-- administracion de supervision, esto se resuelve con un selector, cero
-- migracion. La rellena el mismo trigger que ya asigna `role` (0001:126-141),
-- en la misma pasada -- un segundo trigger BEFORE INSERT podria correr en
-- cualquier orden respecto al primero, y aqui el orden importa.
--
-- Ningun cliente puede pedirla, igual que hoy pasa con el rol: `guard_member_
-- privileges` (0001:222-247) ya bloquea `role`/`state`/`org_id` desde el
-- cliente por UPDATE; visibility_scope entra en la misma guardia.
-- =============================================================================

alter table public.members
  add column visibility_scope text;

-- Backfill: los miembros que ya existen se derivan del rol que ya tienen.
update public.members set visibility_scope = case role
  when 'ADMIN' then 'ORG_METADATA'
  else 'OWN'
end;

alter table public.members
  alter column visibility_scope set not null;

alter table public.members
  add constraint members_visibility_scope_chk
  check (visibility_scope in ('OWN','ORG_METADATA'));

comment on column public.members.visibility_scope is
  'ADR-002 D-4: ambito de visibilidad, soldado al rol en V1 (ADMIN -> ORG_METADATA, EDITOR -> OWN). Lo rellena app.assign_member_role(); ningun cliente lo pide.';

-- role-auto-assignment (0001) ya calcula `role` antes del insert. Se extiende
-- para derivar `visibility_scope` del mismo valor, en la misma funcion.
create or replace function app.assign_member_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.members where org_id = new.org_id) then
    new.role := 'EDITOR';
  else
    new.role := 'ADMIN';
  end if;

  new.visibility_scope := case new.role
    when 'ADMIN' then 'ORG_METADATA'
    else 'OWN'
  end;

  return new;
end;
$$;

-- members_guard_privileges (0001) ya bloquea role/state/org_id desde el
-- cliente. visibility_scope entra en la misma guardia -- D-4 lo dice de forma
-- explicita: "ningun cliente puede pedirlo, igual que hoy con el rol".
create or replace function app.guard_member_privileges()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- `service_role` (operador, jobs) puede mover rol y estado. El usuario, no.
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  if new.role <> old.role then
    raise exception 'members.role no se cambia desde el cliente (role-auto-assignment)';
  end if;
  if new.state <> old.state then
    raise exception 'members.state no se cambia desde el cliente (member-state-machine)';
  end if;
  if new.org_id <> old.org_id then
    raise exception 'members.org_id es inmutable';
  end if;
  if new.visibility_scope <> old.visibility_scope then
    raise exception 'members.visibility_scope no se cambia desde el cliente (ADR-002 D-4)';
  end if;
  return new;
end;
$$;
