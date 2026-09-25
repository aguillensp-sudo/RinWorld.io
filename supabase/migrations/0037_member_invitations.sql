-- =============================================================================
-- 0037 · Invitaciones de usuario y revocación de acceso (INVT-01)
-- =============================================================================
-- INVT-01, el Panel de Gestión de Invitaciones, es la pantalla del ADMIN para
-- traer a su organización hasta cuatro usuarios más (5 en total) y para retirar
-- el acceso a uno. Nada de eso tenía dónde vivir: `members` guarda a quien YA
-- está dentro y no existe ninguna tabla de invitaciones.
--
-- **Qué hace esta migración y qué NO.** Registra la invitación (`Pendiente`, con
-- caducidad de 7 días, `organization-onboarding` § additional-user-invitation),
-- aplica el límite de 5 y la regla de «email ya registrado», permite REENVIAR una
-- caducada y REVOCAR el acceso de un Editor. **No envía ningún correo y no genera
-- ningún token que alguien pueda canjear**: ni hay proveedor de correo en el
-- proyecto ni existe todavía el flujo de registro por invitación (Ruta 00.1,
-- `FRU`). Por eso la pantalla no afirma que se haya enviado un email (mismo
-- criterio que `ADMIN-01`, `DECISIONES-V1.md`); cuando ese flujo exista, colgará
-- de estas filas.
--
-- **Escribe solo el servidor, con funciones.** Toda la escritura pasa por tres
-- funciones `security definer` que comprueban DENTRO que quien llama es ADMIN
-- activo de la organización: el límite de 5 y la búsqueda de «este email ya tiene
-- cuenta» cruzan filas que la RLS de un miembro no ve (`members` de otras
-- organizaciones, `auth.users`), y una política de INSERT no podría expresarlo. El
-- cliente solo LEE su propia lista, y solo si es ADMIN.
--
-- **Revocar = `members.state = 'CANCELLED'`.** `user-revocation`: el usuario pierde
-- el acceso en el acto y su clave privada y su historial cifrado NO se tocan. Todo
-- lo que la RLS protege pasa por `app.is_active_member()`, que exige
-- `state = 'ACTIVE'`, así que un miembro `CANCELLED` deja de leer y de escribir
-- aunque conserve una sesión abierta. Lo hace la función y no el cliente porque
-- `app.guard_member_privileges` prohíbe cambiar `state` desde el cliente.
-- =============================================================================

create table public.member_invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- En minúsculas y sin espacios, así la unicidad y la búsqueda de «ya registrado»
  -- no dependen de cómo lo escribió quien invita.
  email       text not null,
  invited_by  uuid references public.members (id) on delete set null,
  sent_at     timestamptz not null default now(),
  -- `additional-user-invitation`: token válido durante 7 días.
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,

  constraint member_invitations_email_chk
    check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint member_invitations_expiry_chk check (expires_at > sent_at)
);

-- Una fila por email y organización: reenviar RENUEVA la fila, no crea otra.
create unique index member_invitations_org_email_key
  on public.member_invitations (org_id, email);

comment on table public.member_invitations is
  'Invitaciones de usuario adicional (INVT-01). Las escribe solo el servidor (invite_member, resend_invitation); el cliente ADMIN solo lee las de su organizacion. No hay envio de correo ni token canjeable todavia.';

alter table public.member_invitations enable row level security;

-- Solo el ADMIN de la propia organización. INVT-01 §2: «Accesible únicamente por el
-- rol Administrador». Un Editor no ve ni el número de invitaciones.
create policy member_invitations_select_admin on public.member_invitations
  for select to authenticated
  using (org_id = app.current_org_id() and app.is_org_admin());

-- -----------------------------------------------------------------------------
-- La vista: el estado EFECTIVO
-- -----------------------------------------------------------------------------
-- El estado no se guarda: `Expirada` es un hecho del reloj, no un evento, y una
-- columna `status` habría que mantenerla con un job que nadie ha enganchado (mismo
-- motivo que `watcher_list`, 0035). `security_invoker` para que la RLS de la tabla
-- aplique al que lee y no al dueño de la vista.
create or replace view public.member_invitation_list
with (security_invoker = true) as
select
  i.id,
  i.org_id,
  i.email,
  i.sent_at,
  i.expires_at,
  i.accepted_at,
  case
    when i.accepted_at is not null then 'Aceptada'
    when i.expires_at <= now()     then 'Expirada'
    else 'Pendiente'
  end as status,
  -- `Expira en: 5 días`. Solo para las pendientes; nunca 0 (una pendiente que vence
  -- dentro de dos horas dice «1 día», no «0 días»).
  case
    when i.accepted_at is null and i.expires_at > now()
      then greatest(1, ceil(extract(epoch from (i.expires_at - now())) / 86400))::int
  end as days_left
from public.member_invitations i;

comment on view public.member_invitation_list is
  'Invitaciones con el estado efectivo (Pendiente/Aceptada/Expirada) y los dias que quedan. security_invoker: la RLS de member_invitations aplica al que lee.';

-- -----------------------------------------------------------------------------
-- Plazas ocupadas
-- -----------------------------------------------------------------------------
-- «Una invitación pendiente ocupa plaza» (INVT-01 §3, F-170, decisión del PO).
-- Ocupan plaza los miembros que no están rechazados ni revocados (un suspendido
-- sigue siendo un usuario de la organización) MÁS las invitaciones pendientes.
-- Las caducadas no ocupan: por eso `Reenviar` vuelve a comprobar el límite.
create or replace function app.org_seats_used(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select count(*) from public.members
           where org_id = p_org and state not in ('REJECTED', 'CANCELLED'))::int
       + (select count(*) from public.member_invitations
           where org_id = p_org and accepted_at is null and expires_at > now())::int;
$$;

-- -----------------------------------------------------------------------------
-- «Este email ya tiene cuenta»
-- -----------------------------------------------------------------------------
-- La validación en tiempo real de INVT-01 (§5). Cruza `members` de TODAS las
-- organizaciones y `auth.users`, que la RLS de un miembro no ve, así que es
-- `security definer`. **Y por eso mismo solo la puede llamar un ADMIN activo**: sin
-- esa puerta cualquier miembro podría averiguar qué correos tienen cuenta (es el
-- precio de la spec, y se acota a quien la necesita).
create or replace function public.email_has_account(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización puede comprobar emails.';
  end if;
  return exists (select 1 from public.members where lower(email) = v_email)
      or exists (select 1 from auth.users where lower(email) = v_email);
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitar
-- -----------------------------------------------------------------------------
create or replace function public.invite_member(p_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_org      uuid := app.current_org_id();
  v_existing public.member_invitations%rowtype;
  v_id       uuid;
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización puede invitar usuarios.';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El email no tiene un formato válido.';
  end if;

  -- Serializa a los invitadores de la MISMA organización: dos invitaciones a la vez
  -- con cuatro plazas ocupadas pasarían las dos la comprobación de abajo y dejarían
  -- a la organización en seis.
  perform 1 from public.organizations where id = v_org for update;

  if exists (select 1 from public.members where lower(email) = v_email)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Este email ya tiene cuenta en Bearingworld.io.';
  end if;

  select * into v_existing from public.member_invitations
   where org_id = v_org and email = v_email;
  if found then
    if v_existing.expires_at > now() then
      raise exception 'Ya hay una invitación pendiente para este email.';
    else
      raise exception 'Esa invitación ha expirado: usa Reenviar.';
    end if;
  end if;

  if app.org_seats_used(v_org) >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes.';
  end if;

  insert into public.member_invitations (org_id, email, invited_by)
  values (v_org, v_email, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reenviar una invitación expirada
-- -----------------------------------------------------------------------------
-- Renueva las fechas de la MISMA fila. Respeta el límite: una caducada no ocupaba
-- plaza y al renovarla pasa a ocuparla (INVT-01 §3).
create or replace function public.resend_invitation(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := app.current_org_id();
  v_inv public.member_invitations%rowtype;
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización puede reenviar invitaciones.';
  end if;

  perform 1 from public.organizations where id = v_org for update;

  select * into v_inv from public.member_invitations
   where id = p_id and org_id = v_org
   for update;
  if not found then
    raise exception 'La invitación no existe.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esa invitación ya fue aceptada.';
  end if;
  if v_inv.expires_at > now() then
    raise exception 'Esa invitación sigue vigente: no hace falta reenviarla.';
  end if;

  if app.org_seats_used(v_org) >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes.';
  end if;

  update public.member_invitations
     set sent_at = now(), expires_at = now() + interval '7 days'
   where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Revocar el acceso de un usuario
-- -----------------------------------------------------------------------------
-- Solo Editores (INVT-01 §3: «Administrador (el propio)», sin acción). Nunca uno
-- mismo. `CANCELLED` es un estado que `members_state_chk` ya admite. La clave
-- pública, el blob de backup y los `thread_item_keys` NO se tocan (`user-revocation`).
create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org    uuid := app.current_org_id();
  v_target public.members%rowtype;
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización puede eliminar usuarios.';
  end if;

  select * into v_target from public.members
   where id = p_member_id and org_id = v_org
   for update;
  if not found then
    raise exception 'El usuario no existe en tu organización.';
  end if;
  if v_target.id = auth.uid() then
    raise exception 'No se puede eliminar al propio administrador.';
  end if;
  if v_target.role <> 'EDITOR' then
    raise exception 'Solo se pueden eliminar usuarios con rol Editor.';
  end if;
  if v_target.state in ('CANCELLED', 'REJECTED') then
    raise exception 'Ese usuario ya no tiene acceso.';
  end if;

  update public.members set state = 'CANCELLED' where id = p_member_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios (F-146, F-192: se leen del catálogo, no de este fichero)
-- -----------------------------------------------------------------------------
-- Supabase concede ALL sobre cada tabla y EXECUTE sobre cada función nuevas a
-- `anon` y `authenticated` por DEFAULT PRIVILEGES; `revoke ... from public` no lo
-- quita. Se recortan a mano, como en `0035`.
revoke all on public.member_invitations     from anon, authenticated;
revoke all on public.member_invitation_list from anon, authenticated;
grant select on public.member_invitations     to authenticated;
grant select on public.member_invitation_list to authenticated;
grant select, insert, update, delete on public.member_invitations to service_role;

revoke execute on function app.org_seats_used(uuid) from public, anon, authenticated;

revoke execute on function public.email_has_account(text)   from public, anon;
revoke execute on function public.invite_member(text)       from public, anon;
revoke execute on function public.resend_invitation(uuid)   from public, anon;
revoke execute on function public.remove_member(uuid)       from public, anon;
grant  execute on function public.email_has_account(text)   to authenticated;
grant  execute on function public.invite_member(text)       to authenticated;
grant  execute on function public.resend_invitation(uuid)   to authenticated;
grant  execute on function public.remove_member(uuid)      to authenticated;
