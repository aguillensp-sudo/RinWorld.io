-- =============================================================================
-- 0049 · REC-01 y SET-SEC-01: recuperar la clave en otro navegador y cambiar la frase
-- =============================================================================
-- ADR-001 §7.2 (recuperación en un dispositivo nuevo) y §8 (cambio de frase). Sigue a
-- 0048, que dejó al miembro con su backup en el servidor y su privada en un solo
-- navegador. Cuatro funciones y una tabla de intentos:
--
--   begin_key_recovery()   entrega el backup Y cuenta un intento. Es el único camino
--                          que usa la interfaz para leerlo desde `KEY_ACTIVE`.
--   end_key_recovery(pub)  el navegador abrió la copia: borra el contador.
--   replace_key_backup()   SET-SEC-01: misma privada, otra frase, otro blob.
--   discard_key_backup()   «He perdido mi frase»: borra el backup y devuelve a
--                          REGISTERED para generar un par nuevo (REG-05 a REG-07).
--
-- **El límite de ADR-001 §7.2 («5 intentos y 30 minutos, EN EL SERVIDOR»).** El
-- servidor no puede saber si una frase es buena (zero-knowledge): lo que cuenta es
-- cada vez que se pide el backup. El intento n.º 5 sigue devolviendo el backup, pero
-- cierra el grifo: la 6.ª petición, antes de pasar 30 minutos, recibe `locked` y NADA
-- más. Abrirlo con éxito (`end_key_recovery`) borra el contador.
--
-- ⚠ **Lo que NO cierra, y está dicho en F-239.** `members_select_own` sigue dejando a
-- cada miembro leer SU fila entera, backup incluido, con un `select` directo que no
-- pasa por aquí; y `end_key_recovery` lo puede llamar un cliente que no ha abierto
-- nada. Esto limita a la interfaz y a quien no sepa saltársela; frente a quien tenga
-- una sesión robada, la defensa sigue siendo el coste de Argon2id (ADR-001 §7.2: «la
-- fuerza bruta es inviable sea cual sea el límite»). Cerrarlo del todo es revocar el
-- `select` de esas cuatro columnas, y eso toca REG-07 y el riesgo aceptado F-192.
--
-- Todas `security definer`, igual que 0038 y 0048: `members.state` y el backup solo los
-- mueve el servidor.
-- =============================================================================

create table if not exists public.key_recovery_attempts (
  member_id    uuid primary key references public.members (id) on delete cascade,
  attempts     integer not null default 0 check (attempts between 0 and 5),
  locked_until timestamptz
);

comment on table public.key_recovery_attempts is
  'Peticiones del backup de clave desde que se abrió con éxito por última vez (REC-01). Solo la tocan begin/end_key_recovery.';

alter table public.key_recovery_attempts enable row level security;
-- Sin políticas a propósito: ni siquiera el miembro lee su contador; lo ve por la respuesta.
revoke all on public.key_recovery_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- begin_key_recovery
-- ---------------------------------------------------------------------------
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

  -- El bloqueo ya pasó: se empieza de cero.
  if a.locked_until is not null then
    a.attempts := 0;
    a.locked_until := null;
  end if;

  a.attempts := a.attempts + 1;
  if a.attempts >= v_max then
    a.locked_until := now() + v_lock;
  end if;
  update public.key_recovery_attempts
     set attempts = a.attempts, locked_until = a.locked_until
   where member_id = m.id;

  return query select 'ok'::text,
                      case when a.locked_until is null then 0
                           else ceil(extract(epoch from (a.locked_until - now())))::integer end,
                      v_max - a.attempts,
                      m.public_key, m.encrypted_key_blob, m.key_iv, m.argon2_salt, m.kdf_params;
end;
$$;

-- ---------------------------------------------------------------------------
-- end_key_recovery
-- ---------------------------------------------------------------------------
create or replace function public.end_key_recovery(p_public_key bytea)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  -- Solo reinicia si es la pública de ESE backup; con otra no hace nada.
  delete from public.key_recovery_attempts k
   using public.members m
   where m.id = auth.uid() and k.member_id = m.id and m.public_key = p_public_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- replace_key_backup · SET-SEC-01
-- ---------------------------------------------------------------------------
-- La MISMA privada con otra frase: la pública no cambia (cambiarla dejaría sin abrir
-- todo lo que ya está cifrado para ella). El blob, el IV y la sal sí.
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
  delete from public.key_recovery_attempts where member_id = m.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- discard_key_backup · «He perdido mi frase de seguridad»
-- ---------------------------------------------------------------------------
-- Solo el ADMIN: es el único que tiene camino de vuelta (REG-05 a REG-07). Un EDITOR
-- que quedara `REGISTERED` se quedaría sin acceso a nada (F-217).
-- Lo cifrado para la clave anterior se pierde para siempre; es lo que avisa REC-01.
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
  if m.role <> 'ADMIN' or m.state not in ('KEY_ACTIVE', 'ACTIVE') then
    raise exception 'Solo un administrador activo puede generar claves nuevas.';
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

revoke execute on function public.begin_key_recovery()                                         from public, anon;
revoke execute on function public.end_key_recovery(bytea)                                      from public, anon;
revoke execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb)        from public, anon;
revoke execute on function public.discard_key_backup()                                         from public, anon;
grant  execute on function public.begin_key_recovery()                                         to authenticated;
grant  execute on function public.end_key_recovery(bytea)                                      to authenticated;
grant  execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb)        to authenticated;
grant  execute on function public.discard_key_backup()                                         to authenticated;
