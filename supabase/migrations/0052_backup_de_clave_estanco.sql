-- =============================================================================
-- 0052 · El backup de la clave, estanco (F-239)
-- =============================================================================
-- `0049` limitó a 5 intentos y 30 minutos las peticiones del backup (`begin_key_recovery`),
-- pero dejó tres puertas por las que el límite no pasaba. El PO decidió cerrarlas del todo
-- (7-oct-2026, antes de datos reales):
--
-- 1 · **Lectura directa.** `members_select_own_org` deja a un miembro ACTIVO leer su fila y
--     las de TODOS los compañeros de su organización —no solo la suya—, `encrypted_key_blob`
--     y `key_iv` incluidos, con un `select` que no cuenta. Ahora `authenticated` no tiene
--     `select` sobre esas dos columnas: el único camino es `begin_key_recovery` (cuenta) y,
--     para REG-07, `read_pending_key_backup` (solo mientras la cuenta es `REGISTERED`).
--     `argon2_salt` y `kdf_params` siguen legibles a propósito: la sal y los parámetros de
--     Argon2id no son secretos y sin el blob no sirven para nada; `ensureKeyring` usa
--     `kdf_params` para saber si hay backup.
-- 2 · **Reiniciar el contador.** `end_key_recovery(pública)` la podía llamar cualquiera, porque
--     la pública es pública. Se elimina. ADR-001 §7.2 pide «5 intentos y 30 minutos de espera»
--     y no dice que acertar reinicie nada: el límite pasa a ser de **5 peticiones por ventana
--     fija de 30 minutos** (`window_started_at`), y abrirlo con éxito o cambiar la frase
--     (`replace_key_backup`) ya no borra el contador. Quien robe una sesión tiene como mucho
--     5 intentos cada 30 minutos.
-- 3 · **Escritura directa.** `members_update_self` + el `update` de tabla dejaban a un miembro
--     escribir su propio `encrypted_key_blob`, `key_iv`, `argon2_salt` o `kdf_params` sin pasar
--     por `store_key_backup`/`replace_key_backup`, que son las que validan la forma. Ahora
--     `authenticated` solo puede actualizar `public_key` (lo que hace `ensureKeyring` en el
--     camino sin backup), y el disparador de `members` no deja cambiar la pública a quien ya
--     tiene backup (cambiarla redirigiría lo que otros cifran para él).
--
-- **Lo que NO cierra, y está en F-242:** `replace_key_backup` no exige probar la frase
-- anterior, así que quien tenga la sesión puede SUSTITUIR el backup por uno que solo abre su
-- frase (no leer el de la víctima: dejarla sin recuperación). Cerrarlo pide un verificador de
-- la frase guardado en el servidor y cambia el formato del backup; no es de esta migración.
--
-- **F-192 (privilegios por defecto anchos):** con `select` y `update` por columna, una columna
-- nueva de `members` nace SIN permiso para `authenticated`: hay que concederla a propósito. Es
-- lo que se quiere (falla ruidoso, no legible por omisión), y quien añada una columna lo verá
-- en el primer `select` con ella.
-- =============================================================================

-- ── 1 y 3 · privilegios por columna ─────────────────────────────────────────
revoke select on public.members from anon, authenticated;
grant select (id, org_id, email, full_name, role, state, public_key, argon2_salt, kdf_params,
              created_at, visibility_scope)
  on public.members to authenticated;

revoke update on public.members from anon, authenticated;
grant update (public_key) on public.members to authenticated;

-- Con backup, la pública no se cambia desde el cliente. Los verbos del servidor (`security
-- definer`, dueño `postgres`) sí: `discard_key_backup` la pone a NULL.
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
  if old.encrypted_key_blob is not null and new.public_key is distinct from old.public_key then
    raise exception 'members.public_key no se cambia desde el cliente cuando hay un backup de la clave (F-239)';
  end if;
  return new;
end;
$$;

-- ── lector del backup para REG-07 ───────────────────────────────────────────
-- REG-07 sube el backup (`store_key_backup`), lo relee, lo abre con la envoltura y solo entonces
-- confirma (`confirm_key_backup`). Todo eso con la cuenta en `REGISTERED`: en cuanto pasa a
-- `KEY_ACTIVE` esta función no devuelve nada y el blob solo sale por `begin_key_recovery`.
create or replace function public.read_pending_key_backup()
returns table (
  public_key         bytea,
  encrypted_key_blob bytea,
  key_iv             bytea,
  argon2_salt        bytea,
  kdf_params         jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.public_key, m.encrypted_key_blob, m.key_iv, m.argon2_salt, m.kdf_params
    from public.members m
   where m.id = auth.uid() and m.state = 'REGISTERED' and m.encrypted_key_blob is not null;
$$;

-- ── 2 · límite de 5 peticiones por ventana fija de 30 minutos ───────────────
alter table public.key_recovery_attempts add column if not exists window_started_at timestamptz;
update public.key_recovery_attempts set window_started_at = now() where attempts > 0 and window_started_at is null;

comment on table public.key_recovery_attempts is
  'Peticiones del backup de clave en la ventana de 30 minutos en curso (REC-01). No se reinicia al acertar: solo vence la ventana. Solo la toca begin_key_recovery.';

create or replace function public.begin_key_recovery()
returns table (
  status             text,
  seconds_left       integer,
  attempts_left      integer,
  public_key         bytea,
  encrypted_key_blob bytea,
  key_iv             bytea,
  argon2_salt        bytea,
  kdf_params         jsonb
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
  a public.key_recovery_attempts%rowtype;
  v_max constant integer := 5;
  v_lock constant interval := interval '30 minutes';
begin
  select * into m from public.members where id = auth.uid() for update;
  if not found then
    raise exception 'No eres miembro de ninguna organización.';
  end if;
  if m.state not in ('KEY_ACTIVE', 'ACTIVE') or m.encrypted_key_blob is null then
    raise exception 'Tu cuenta no tiene un backup de clave que recuperar.';
  end if;

  insert into public.key_recovery_attempts (member_id) values (m.id) on conflict do nothing;
  select * into a from public.key_recovery_attempts where member_id = m.id for update;

  -- Bloqueado: ni un byte del backup.
  if a.locked_until is not null and a.locked_until > now() then
    return query select 'locked'::text,
                        ceil(extract(epoch from (a.locked_until - now())))::integer,
                        0, null::bytea, null::bytea, null::bytea, null::bytea, null::jsonb;
    return;
  end if;

  -- Ventana nueva: el bloqueo ya pasó, o la ventana de 30 minutos venció, o es la primera.
  if a.locked_until is not null or a.window_started_at is null or a.window_started_at <= now() - v_lock then
    a.attempts := 0;
    a.locked_until := null;
    a.window_started_at := now();
  end if;

  a.attempts := a.attempts + 1;
  if a.attempts >= v_max then
    a.locked_until := now() + v_lock;
  end if;
  update public.key_recovery_attempts
     set attempts = a.attempts, locked_until = a.locked_until, window_started_at = a.window_started_at
   where member_id = m.id;

  return query select 'ok'::text,
                      case when a.locked_until is null then 0
                           else ceil(extract(epoch from (a.locked_until - now())))::integer end,
                      v_max - a.attempts,
                      m.public_key, m.encrypted_key_blob, m.key_iv, m.argon2_salt, m.kdf_params;
end;
$$;

-- Ya no existe forma de reiniciar el contador desde fuera.
drop function if exists public.end_key_recovery(bytea);

-- SET-SEC-01 tampoco lo reinicia: era la otra puerta (`delete from key_recovery_attempts`).
create or replace function public.replace_key_backup(
  p_public_key bytea,
  p_encrypted_key_blob bytea,
  p_key_iv bytea,
  p_argon2_salt bytea,
  p_kdf_params jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
begin
  if octet_length(p_public_key) is distinct from 32
     or octet_length(p_encrypted_key_blob) is distinct from 48
     or octet_length(p_key_iv) is distinct from 12
     or octet_length(p_argon2_salt) is distinct from 32 then
    raise exception 'El backup de la clave no tiene la forma esperada.' using errcode = '22023';
  end if;
  if p_kdf_params is distinct from app.kdf_params_v1() then
    raise exception 'Parámetros de derivación no admitidos.' using errcode = '22023';
  end if;

  select * into m from public.members where id = auth.uid() for update;
  if not found then
    raise exception 'No eres miembro de ninguna organización.';
  end if;
  if m.state not in ('KEY_ACTIVE', 'ACTIVE') or m.encrypted_key_blob is null then
    raise exception 'Tu cuenta no tiene un backup de clave que cambiar.';
  end if;
  if m.public_key is distinct from p_public_key then
    raise exception 'El cambio de frase no puede cambiar la clave.';
  end if;

  update public.members
     set encrypted_key_blob = p_encrypted_key_blob,
         key_iv             = p_key_iv,
         argon2_salt        = p_argon2_salt,
         kdf_params         = p_kdf_params
   where id = m.id;
end;
$$;

-- ── privilegios, explícitos (F-146) ─────────────────────────────────────────
revoke execute on function public.read_pending_key_backup() from public, anon;
grant  execute on function public.read_pending_key_backup() to authenticated;
