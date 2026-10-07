-- =============================================================================
-- 0053 · Verificador de la frase: sustituir el backup exige la frase anterior (F-242)
-- =============================================================================
-- `0052` cerró la lectura y la escritura directas del backup, pero `replace_key_backup` seguía
-- aceptando cualquier blob con la misma pública de quien tuviera la sesión: no leía nada de la
-- víctima, pero la dejaba sin recuperación. El servidor no puede saber si alguien conoce la frase
-- (zero-knowledge), así que guarda un **verificador**:
--
--   · El navegador deriva de la salida de Argon2id (la misma que da la clave de envoltura) una
--     «prueba» de 32 bytes con HKDF-SHA-256 y una etiqueta propia. La prueba y la clave de
--     envoltura son independientes: conocer una no da la otra.
--   · Al crear el backup (REG-07) y al cambiarlo (SET-SEC-01) sube `sha256(prueba)`, y SOLO
--     eso. Para cambiarlo después, sube la prueba de la frase anterior: el servidor comprueba
--     que `sha256(prueba)` es el verificador guardado.
--
-- **No debilita nada:** el blob ya permite probar frases fuera de línea con el mismo coste de
-- Argon2id; el verificador no es más barato de atacar. Tampoco sale del servidor: la columna
-- nace SIN permiso para `authenticated` (desde `0052` no hay `select` de tabla) y solo la
-- tocan estas funciones `security definer`.
--
-- **Backups anteriores** (los de antes de `0053`: JULSA y las cuentas de prueba) no tienen
-- verificador. Hasta que lo suban siguen con el agujero de `F-242`: `replace_key_backup` les
-- deja sustituir sin prueba, porque no hay con qué comprobarla. Lo suben solos la primera vez
-- que su dueño abre el backup en REC-01 o cambia la frase en SET-SEC-01 (el navegador acaba de
-- demostrar que la conoce). `begin_key_recovery` devuelve `has_verifier` para que lo sepa.
--
-- **Despliegue en dos pasos**, para no romper a nadie en el cambio: esta migración es ADITIVA
-- (las firmas de cinco argumentos de `store_key_backup` y `replace_key_backup` siguen vivas);
-- `0054` las elimina cuando el cliente nuevo ya está desplegado.
-- =============================================================================

alter table public.members add column if not exists key_verifier bytea;
alter table public.members
  add constraint members_key_verifier_chk check (key_verifier is null or octet_length(key_verifier) = 32);

comment on column public.members.key_verifier is
  'sha256 de la prueba de la frase de seguridad (HKDF de la salida de Argon2id). Sin permiso para authenticated: solo lo tocan store/replace/discard_key_backup. NULL en los backups anteriores a 0053 (F-242).';

-- ── REG-07: subir el backup, con su verificador ─────────────────────────────
create or replace function public.store_key_backup(
  p_public_key bytea,
  p_encrypted_key_blob bytea,
  p_key_iv bytea,
  p_argon2_salt bytea,
  p_kdf_params jsonb,
  p_key_verifier bytea
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v public.members%rowtype;
begin
  if octet_length(p_public_key) is distinct from 32
     or octet_length(p_encrypted_key_blob) is distinct from 48
     or octet_length(p_key_iv) is distinct from 12
     or octet_length(p_argon2_salt) is distinct from 32
     or octet_length(p_key_verifier) is distinct from 32 then
    raise exception 'El backup de la clave no tiene la forma esperada.' using errcode = '22023';
  end if;
  if p_kdf_params is distinct from app.kdf_params_v1() then
    raise exception 'Parámetros de derivación no admitidos.' using errcode = '22023';
  end if;

  select * into v from public.members where id = auth.uid() for update;
  if not found then
    raise exception 'No eres miembro de ninguna organización.';
  end if;

  if v.state = 'REGISTERED' then
    update public.members
       set public_key         = p_public_key,
           encrypted_key_blob = p_encrypted_key_blob,
           key_iv             = p_key_iv,
           argon2_salt        = p_argon2_salt,
           kdf_params         = p_kdf_params,
           key_verifier       = p_key_verifier
     where id = v.id;
    return;
  end if;

  -- Repetir exactamente lo ya guardado (un reintento de red) no es un error.
  if v.state = 'KEY_ACTIVE'
     and v.public_key = p_public_key
     and v.encrypted_key_blob = p_encrypted_key_blob
     and v.key_iv = p_key_iv
     and v.argon2_salt = p_argon2_salt
     and v.kdf_params = p_kdf_params
     and v.key_verifier = p_key_verifier then
    return;
  end if;

  raise exception 'Tu cuenta no está pendiente de generar claves.';
end;
$$;

-- ── SET-SEC-01: sustituir el backup exige la prueba de la frase anterior ────
create or replace function public.replace_key_backup(
  p_public_key bytea,
  p_encrypted_key_blob bytea,
  p_key_iv bytea,
  p_argon2_salt bytea,
  p_kdf_params jsonb,
  p_key_verifier bytea,
  p_old_proof bytea default null
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
     or octet_length(p_argon2_salt) is distinct from 32
     or octet_length(p_key_verifier) is distinct from 32 then
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

  -- Con verificador guardado, hace falta la prueba de la frase anterior. Sin él (backup anterior a
  -- 0053) no hay con qué comprobarla: se deja pasar UNA vez y el nuevo ya lo lleva.
  if m.key_verifier is not null
     and (p_old_proof is null
          or octet_length(p_old_proof) is distinct from 32
          or sha256(p_old_proof) is distinct from m.key_verifier) then
    raise exception 'La frase actual no es correcta.';
  end if;

  update public.members
     set encrypted_key_blob = p_encrypted_key_blob,
         key_iv             = p_key_iv,
         argon2_salt        = p_argon2_salt,
         kdf_params         = p_kdf_params,
         key_verifier       = p_key_verifier
   where id = m.id;
end;
$$;

-- «He perdido mi frase»: sin backup no hay verificador.
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
         kdf_params         = null,
         key_verifier       = null
   where id = m.id;
  delete from public.key_recovery_attempts where member_id = m.id;
end;
$$;

-- ── REC-01: el navegador sabe si el backup lleva verificador ────────────────
-- Cambia el tipo de retorno (una columna más, al final): hay que soltarla y crearla de nuevo.
drop function public.begin_key_recovery();
create function public.begin_key_recovery()
returns table (
  status             text,
  seconds_left       integer,
  attempts_left      integer,
  public_key         bytea,
  encrypted_key_blob bytea,
  key_iv             bytea,
  argon2_salt        bytea,
  kdf_params         jsonb,
  has_verifier       boolean
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

  if a.locked_until is not null and a.locked_until > now() then
    return query select 'locked'::text,
                        ceil(extract(epoch from (a.locked_until - now())))::integer,
                        0, null::bytea, null::bytea, null::bytea, null::bytea, null::jsonb, null::boolean;
    return;
  end if;

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
                      m.public_key, m.encrypted_key_blob, m.key_iv, m.argon2_salt, m.kdf_params,
                      (m.key_verifier is not null);
end;
$$;

-- ── privilegios, explícitos (F-146) ─────────────────────────────────────────
revoke execute on function public.store_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea)                from public, anon;
revoke execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea, bytea)       from public, anon;
revoke execute on function public.begin_key_recovery()                                                      from public, anon;
grant  execute on function public.store_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea)                to authenticated;
grant  execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea, bytea)       to authenticated;
grant  execute on function public.begin_key_recovery()                                                      to authenticated;
