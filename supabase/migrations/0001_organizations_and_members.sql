-- =============================================================================
-- 0001 · Organizaciones, miembros, auth y RLS base
-- =============================================================================
-- Fuente de verdad: openspec/specs/organization-onboarding/spec.md
--                   openspec/specs/e2ee-key-management/spec.md
--                   openspec/mvp/Dia-02_decisiones_esquema.md (aprobado 6-ago-2026)
--
-- NOTA DE NOMBRADO. `e2ee-key-management` · schema-desde-dia-uno exige los cuatro
-- campos de backup "en la tabla `users`". En Supabase `auth.users` es gestionada y
-- no se puede extender, así que el perfil vive en `public.members`, cuya PK ES el
-- `auth.users.id`. Por tanto `member_id == auth.uid()`, que es el identificador que
-- key-wrapping usa como AAD y local-storage como sufijo de IndexedDB. El requisito
-- se cumple: los cuatro campos existen desde esta primera migración y son nullable.
-- =============================================================================

create schema if not exists app;

-- Búsqueda por nombre parcial de organización (lista de exclusión de INV-07).
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  legal_name    text,
  -- ISO-3166-1 alpha-2. Necesarios para la exclusión geográfica de INV-07
  -- ("todas las organizaciones con sede en ese continente").
  country       text not null,
  continent     text not null,
  status        text not null default 'PENDING_REVIEW',
  created_at    timestamptz not null default now(),

  constraint organizations_status_chk check (
    status in ('PENDING_REVIEW','APPROVED','REJECTED','SUSPENDED')
  ),
  constraint organizations_country_chk check (country ~ '^[A-Z]{2}$'),
  constraint organizations_continent_chk check (
    continent in ('AF','AN','AS','EU','NA','OC','SA')
  )
);

-- El nombre se busca por parcial en la lista de exclusión de INV-07.
create unique index organizations_name_key on public.organizations (lower(name));
create index organizations_name_trgm on public.organizations using gin (name gin_trgm_ops);
create index organizations_geo_idx on public.organizations (continent, country);

-- -----------------------------------------------------------------------------
-- members — perfil 1:1 con auth.users. member_id = auth.uid()
-- -----------------------------------------------------------------------------
create table public.members (
  id            uuid primary key references auth.users (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete restrict,
  email         text not null,
  full_name     text,

  -- role-auto-assignment: ADMIN al primer miembro de la organización, EDITOR al
  -- resto. No hay selector de rol en ningún formulario — lo fija el trigger de
  -- abajo, nunca el cliente.
  role          text not null,

  -- member-state-machine:
  --   PENDING_REVIEW → INVITED_APPROVED → REGISTERED → KEY_ACTIVE → ACTIVE
  --   laterales: ACTIVE ↔ SUSPENDED · PENDING_REVIEW → REJECTED / CANCELLED
  state         text not null default 'PENDING_REVIEW',

  -- X25519 pública (key-generation). La privada NUNCA llega aquí.
  public_key    bytea,

  -- schema-desde-dia-uno · server-blind-storage. Lo único que el servidor
  -- almacena del backup de clave; indistinguible de bytes aleatorios sin la
  -- passphrase del miembro. Nullable hasta que el miembro completa FL-03.
  encrypted_key_blob bytea,
  key_iv             bytea,
  argon2_salt        bytea,
  kdf_params         jsonb,

  created_at    timestamptz not null default now(),

  constraint members_role_chk  check (role in ('ADMIN','EDITOR')),
  constraint members_state_chk check (
    state in ('PENDING_REVIEW','INVITED_APPROVED','REGISTERED',
              'KEY_ACTIVE','ACTIVE','SUSPENDED','REJECTED','CANCELLED')
  ),
  -- key-wrapping: AES-256-GCM con IV de 12 bytes y salt Argon2id de 32 bytes.
  constraint members_key_iv_len_chk check (key_iv is null or octet_length(key_iv) = 12),
  constraint members_salt_len_chk   check (argon2_salt is null or octet_length(argon2_salt) = 32),
  constraint members_pubkey_len_chk check (public_key is null or octet_length(public_key) = 32),
  -- El backup es atómico: o están los cuatro campos, o ninguno.
  constraint members_backup_all_or_none_chk check (
    (encrypted_key_blob is null and key_iv is null
       and argon2_salt is null and kdf_params is null)
    or
    (encrypted_key_blob is not null and key_iv is not null
       and argon2_salt is not null and kdf_params is not null)
  ),
  -- KEY_ACTIVE y posteriores exigen backup en servidor (transición a KEY_ACTIVE
  -- ocurre "cuando el sistema confirma el backup de clave almacenado en servidor").
  constraint members_key_active_needs_backup_chk check (
    state not in ('KEY_ACTIVE','ACTIVE','SUSPENDED')
    or (encrypted_key_blob is not null and public_key is not null)
  )
);

create unique index members_email_key on public.members (lower(email));
create index members_org_idx on public.members (org_id);

-- role-auto-assignment: el primer miembro de una organización es ADMIN, el resto
-- EDITOR. Se impone en servidor para que ningún cliente pueda pedir un rol.
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
  return new;
end;
$$;

create trigger members_assign_role
  before insert on public.members
  for each row execute function app.assign_member_role();

-- -----------------------------------------------------------------------------
-- Helpers de sesión.
--
-- SECURITY DEFINER a propósito: leen `members` saltándose RLS. Sin esto, una
-- política sobre `members` que consultara `members` entraría en recursión
-- infinita. Es el patrón, no un atajo.
-- -----------------------------------------------------------------------------
create or replace function app.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.members where id = auth.uid();
$$;

create or replace function app.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and state = 'ACTIVE'
  );
$$;

create or replace function app.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and state = 'ACTIVE' and role = 'ADMIN'
  );
$$;

revoke execute on function app.current_org_id()  from public;
revoke execute on function app.is_active_member() from public;
revoke execute on function app.is_org_admin()     from public;
grant  execute on function app.current_org_id()  to authenticated;
grant  execute on function app.is_active_member() to authenticated;
grant  execute on function app.is_org_admin()     to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.members       enable row level security;

-- El Directorio de Organizaciones (MSG-05 / organization-directory) hace que las
-- organizaciones aprobadas sean descubribles. Solo nombre y sede: no hay dato
-- comercial en esta tabla.
create policy organizations_select_approved on public.organizations
  for select to authenticated
  using (status = 'APPROVED' or id = app.current_org_id());

-- Un miembro ve a los de su propia organización y a nadie más.
create policy members_select_own_org on public.members
  for select to authenticated
  using (org_id = app.current_org_id());

-- El miembro mantiene su propio perfil y su propio backup de clave. `role`,
-- `state` y `org_id` quedan fuera: los mueve el servidor (trigger / operador),
-- no el cliente. Lo impone el trigger de abajo, porque RLS no filtra por columna.
create policy members_update_self on public.members
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- OJO: este trigger NO puede ser SECURITY DEFINER. Con SECURITY DEFINER,
-- `current_user` pasa a ser el dueño de la función (postgres) y la guarda se
-- desactivaría siempre a sí misma. Sin él, `current_user` es el rol que PostgREST
-- fija en la petición — que es exactamente lo que hay que distinguir. Tampoco
-- necesita privilegios: solo lee OLD y NEW.
create or replace function app.guard_member_privileges()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- `service_role` (operador, jobs) puede mover rol y estado. El usuario, no.
  -- PostgREST hace SET LOCAL ROLE con la clave de servicio, así que current_user
  -- es la comprobación fiable; auth.uid() nulo cubre el acceso directo por SQL.
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
  return new;
end;
$$;

create trigger members_guard_privileges
  before update on public.members
  for each row execute function app.guard_member_privileges();

-- Supabase concede estos privilegios por default privileges, pero se hacen
-- explícitos: la migración tiene que ser legible y reproducible fuera de Supabase
-- (es lo que permite probarla en un Postgres pelado). RLS es lo que acota de
-- verdad; el GRANT solo abre la puerta.
grant usage on schema app to authenticated, service_role;
grant select, insert, update on public.organizations to authenticated, service_role;
grant select, insert, update on public.members       to authenticated, service_role;

comment on table  public.members is
  'Perfil de miembro, 1:1 con auth.users. La PK es auth.users.id, de modo que member_id = auth.uid().';
comment on column public.members.encrypted_key_blob is
  'server-blind-storage: clave privada X25519 envuelta con AES-256-GCM. El servidor no puede descifrarla en ningún flujo.';
