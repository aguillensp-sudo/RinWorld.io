-- =============================================================================
-- 0050 · Canje de invitación (INVT-02) y activación de un EDITOR (ACT-02)
-- =============================================================================
-- Cierra F-212 (una invitación de INVT-01 no llevaba a ningún sitio) y F-217 (el alta
-- de un usuario adicional dejaba una cuenta que nadie podía activar). Decisiones del PO
-- del 7-oct-2026 sobre la propuesta `openspec/v1/diseno/PROPUESTA-INVT-02-ACT-02.md`.
--
-- 1 · **El enlace.** `access_tokens` (0040) ya admite `MEMBER_INVITATION`: mismo patrón
--     que el enlace de REG-01 — 244 bits, solo el hash, un solo uso, se ve una vez.
--     `issue_invitation_link` lo genera para una invitación VIGENTE; vence cuando vence
--     la invitación. `invite_member` y `resend_invitation` no lo devuelven: el cliente
--     los llama y después pide el enlace, así que sus firmas no cambian.
-- 2 · **Anular.** `member_invitations.revoked_at`: la invitación anulada no ocupa plaza,
--     no se canjea y se puede volver a invitar al mismo correo (reutiliza la fila: hay
--     una por correo y organización).
-- 3 · **Canjear sin sesión.** `invitation_link_validate` y `redeem_invitation` son de
--     `service_role`: las llama la Edge Function `accept-invitation` (F-146: `anon` no
--     ejecuta nada de `public`). A diferencia de REG-01, validar SÍ distingue «caducada»
--     de «no vale»: adivinar el token son 244 bits, así que no hay nada que aprender.
-- 4 · **Un EDITOR llega a ACTIVE por sí solo.** `activate_own_membership` (0038) era
--     solo del ADMIN porque REG-09 era su pantalla. Con ACT-02 el EDITOR hace la Fase B y
--     la app lo activa al terminar REG-07.
-- 5 · **Un EDITOR puede empezar con una clave nueva** (`discard_key_backup`, 0049). Se
--     restringió al ADMIN porque «un EDITOR no tiene flujo para activarse» (F-217): con
--     ACT-02 sí lo tiene. Lo cifrado para la clave anterior se pierde, como para el ADMIN.
--     (La propuesta decía «tendría que invitarte de nuevo»: es falso, `invite_member`
--     rechaza un correo que ya tiene cuenta, así que esa salida no existía.)
-- =============================================================================

alter table public.member_invitations add column revoked_at timestamptz;
alter table public.member_invitations
  add constraint member_invitations_end_chk check (accepted_at is null or revoked_at is null);

-- Las anuladas no ocupan plaza, igual que las caducadas.
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
           where org_id = p_org and accepted_at is null and revoked_at is null
             and expires_at > now())::int;
$$;

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
    when i.revoked_at is not null  then 'Anulada'
    when i.expires_at <= now()     then 'Expirada'
    else 'Pendiente'
  end as status,
  case
    when i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
      then greatest(1, ceil(extract(epoch from (i.expires_at - now())) / 86400))::int
  end as days_left
from public.member_invitations i;

-- -----------------------------------------------------------------------------
-- invite_member: una anulada se reutiliza (misma fila, fechas nuevas)
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

  perform 1 from public.organizations where id = v_org for update;

  if exists (select 1 from public.members where lower(email) = v_email)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Este email ya tiene cuenta en Bearingworld.io.';
  end if;

  select * into v_existing from public.member_invitations
   where org_id = v_org and email = v_email;
  if found and v_existing.revoked_at is null then
    if v_existing.expires_at > now() then
      raise exception 'Ya hay una invitación pendiente para este email.';
    else
      raise exception 'Esa invitación ha expirado: usa Reenviar.';
    end if;
  end if;

  if app.org_seats_used(v_org) >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes.';
  end if;

  if found then
    update public.member_invitations
       set sent_at = now(), expires_at = now() + interval '7 days', revoked_at = null,
           invited_by = auth.uid()
     where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.member_invitations (org_id, email, invited_by)
  values (v_org, v_email, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- resend_invitation: una expirada o una anulada se renuevan
-- -----------------------------------------------------------------------------
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
  if v_inv.revoked_at is null and v_inv.expires_at > now() then
    raise exception 'Esa invitación sigue vigente: no hace falta reenviarla.';
  end if;

  if exists (select 1 from public.members where lower(email) = v_inv.email)
     or exists (select 1 from auth.users where lower(email) = v_inv.email) then
    raise exception 'Este email ya tiene cuenta en Bearingworld.io.';
  end if;

  if app.org_seats_used(v_org) >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes.';
  end if;

  update public.member_invitations
     set sent_at = now(), expires_at = now() + interval '7 days', revoked_at = null
   where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- El enlace de una invitación vigente (ADMIN). Token en claro, una sola vez.
-- -----------------------------------------------------------------------------
-- Es a la vez «generar» y «volver a generar»: revoca el vigente si lo hay.
create or replace function public.issue_invitation_link(p_invitation_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv   public.member_invitations%rowtype;
  v_token text;
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización genera el enlace de una invitación.';
  end if;

  select * into v_inv from public.member_invitations
   where id = p_invitation_id and org_id = app.current_org_id()
   for update;
  if not found then
    raise exception 'La invitación no existe.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esa invitación ya fue aceptada.';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Esa invitación está anulada: usa Reenviar.';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'Esa invitación ha expirado: usa Reenviar.';
  end if;

  update public.access_tokens t
     set revoked_at = now()
   where t.member_invitation_id = p_invitation_id
     and t.used_at is null and t.revoked_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.access_tokens (purpose, token_hash, member_invitation_id, created_by, expires_at)
  values ('MEMBER_INVITATION', encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
          p_invitation_id, auth.uid(), v_inv.expires_at);

  return query select v_token, v_inv.expires_at;
end;
$$;

-- Anular: el enlace deja de valer en el acto y la plaza queda libre.
create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.member_invitations%rowtype;
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización puede anular invitaciones.';
  end if;

  select * into v_inv from public.member_invitations
   where id = p_id and org_id = app.current_org_id()
   for update;
  if not found then
    raise exception 'La invitación no existe.';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Esa invitación ya fue aceptada.';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Esa invitación ya está anulada.';
  end if;

  update public.member_invitations set revoked_at = now() where id = p_id;
  update public.access_tokens t
     set revoked_at = now()
   where t.member_invitation_id = p_id and t.used_at is null and t.revoked_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- INVT-02, sin sesión (Edge Function con service_role)
-- -----------------------------------------------------------------------------
-- Ninguna fila = no vale (no existe, usado, anulado, aceptada). Con fila, `status`:
-- OK · EXPIRED · EXISTS (el correo ya tiene cuenta) · FULL (la organización ya está
-- completa sin contar esta invitación, que sí tiene plaza reservada).
create or replace function public.invitation_link_validate(p_token text)
returns table (status text, org_name text, inviter_name text, email text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.access_tokens%rowtype;
  v_i public.member_invitations%rowtype;
  v_status text;
begin
  select t.* into v_t from public.access_tokens t
   where t.purpose = 'MEMBER_INVITATION'
     and t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and t.used_at is null and t.revoked_at is null;
  if not found then return; end if;

  select i.* into v_i from public.member_invitations i where i.id = v_t.member_invitation_id;
  if not found or v_i.accepted_at is not null or v_i.revoked_at is not null then return; end if;

  if v_t.expires_at <= now() or v_i.expires_at <= now() then
    v_status := 'EXPIRED';
  elsif exists (select 1 from public.members m where lower(m.email) = v_i.email)
     or exists (select 1 from auth.users u where lower(u.email) = v_i.email) then
    v_status := 'EXISTS';
  elsif app.org_seats_used(v_i.org_id) - 1 >= 5 then
    v_status := 'FULL';
  else
    v_status := 'OK';
  end if;

  return query
    select v_status,
           (select o.name from public.organizations o where o.id = v_i.org_id),
           (select m.full_name from public.members m where m.id = v_i.invited_by),
           v_i.email::text,
           least(v_t.expires_at, v_i.expires_at);
end;
$$;

-- Canjear: una transacción. La cuenta de Auth ya existe (la crea la función de borde
-- con el correo de la INVITACIÓN, nunca con uno del cliente). Si algo falla aquí, la
-- función de borde borra esa cuenta y el token sigue valiendo.
create or replace function public.redeem_invitation(p_token text, p_user_id uuid, p_full_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.access_tokens%rowtype;
  v_i public.member_invitations%rowtype;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Datos no validos: El nombre debe tener entre 2 y 100 caracteres.';
  end if;

  select t.* into v_t from public.access_tokens t
   where t.purpose = 'MEMBER_INVITATION'
     and t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and t.used_at is null and t.revoked_at is null and t.expires_at > now()
   for update;
  if not found then raise exception 'El enlace no es valido o ha caducado.'; end if;

  select i.* into v_i from public.member_invitations i
   where i.id = v_t.member_invitation_id
     and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
   for update;
  if not found then raise exception 'El enlace no es valido o ha caducado.'; end if;

  perform 1 from public.organizations where id = v_i.org_id for update;

  if exists (select 1 from public.members m where lower(m.email) = v_i.email) then
    raise exception 'Este email ya tiene cuenta en Bearingworld.io.';
  end if;
  if app.org_seats_used(v_i.org_id) - 1 >= 5 then
    raise exception 'Tu organización ha alcanzado el límite de 5 usuarios.';
  end if;

  update public.access_tokens set used_at = now() where id = v_t.id;
  update public.member_invitations set accepted_at = now() where id = v_i.id;

  -- El rol lo asigna el disparador (`role-auto-assignment`): con ADMIN ya presente, EDITOR.
  insert into public.members (id, org_id, email, full_name, state, visibility_scope)
  values (p_user_id, v_i.org_id, v_i.email, v_name, 'REGISTERED', 'OWN');

  return v_i.org_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- ACT-02: el EDITOR se activa solo y puede empezar con una clave nueva
-- -----------------------------------------------------------------------------
create or replace function public.activate_own_membership()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update public.members
     set state = 'ACTIVE'
   where id = auth.uid() and state = 'KEY_ACTIVE';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Tu cuenta no está pendiente de activación.';
  end if;
end;
$$;

create or replace function public.discard_key_backup()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members where id = auth.uid() for update;
  if not found then
    raise exception 'No eres miembro de ninguna organización.';
  end if;
  if m.state not in ('KEY_ACTIVE', 'ACTIVE') then
    raise exception 'Solo un miembro activo puede generar claves nuevas.';
  end if;

  update public.members
     set state              = 'REGISTERED',
         public_key         = null,
         encrypted_key_blob = null,
         key_iv             = null,
         argon2_salt        = null,
         kdf_params         = null
   where id = m.id;
  delete from public.key_recovery_attempts where member_id = m.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilegios, explícitos (F-146)
-- -----------------------------------------------------------------------------
revoke execute on function public.issue_invitation_link(uuid)           from public, anon;
revoke execute on function public.revoke_invitation(uuid)               from public, anon;
revoke execute on function public.invitation_link_validate(text)        from public, anon, authenticated;
revoke execute on function public.redeem_invitation(text, uuid, text)   from public, anon, authenticated;

grant execute on function public.issue_invitation_link(uuid)         to authenticated;
grant execute on function public.revoke_invitation(uuid)             to authenticated;
grant execute on function public.invitation_link_validate(text)      to service_role;
grant execute on function public.redeem_invitation(text, uuid, text) to service_role;
