-- =============================================================================
-- 0048 · REG-07: guardar el backup cifrado de la clave privada y pasar a KEY_ACTIVE
-- =============================================================================
-- ADR-001 §6 y §7.1. El navegador genera el par X25519, deriva con Argon2id una
-- clave de envoltura a partir de la frase de seguridad (REG-06), cifra con ella la
-- privada (AES-256-GCM, AAD = id del miembro) y sube SOLO esto:
--
--   { public_key, encrypted_key_blob, key_iv, argon2_salt, kdf_params }
--
-- La frase, la clave de envoltura y la privada en claro no llegan aquí nunca
-- (invariante server-blind, ADR-001 §8). Las columnas existen desde `0001:78`, con
-- `members_backup_all_or_none_chk` y las longitudes de IV y sal.
--
-- **Dos funciones y no una, a propósito.** REG-07 tiene cuatro pasos; el 3 sube el
-- backup y el 4 lo verifica: el navegador relee su fila, DESCIFRA la copia que
-- guardó el servidor y comprueba que sale la misma pública. Solo entonces confirma.
-- Si el estado cambiara en el paso 3, un backup que no se puede abrir dejaría la
-- cuenta en `KEY_ACTIVE` sin vuelta atrás (este cambio no se deshace desde el
-- cliente). Así, hasta la confirmación la cuenta sigue `REGISTERED` y REG-07 se
-- puede repetir entero, sobrescribiendo.
--
-- **Las dos aguantan una respuesta perdida.** El «Reintentar» de REG-07 repite la
-- llamada que falló con los MISMOS bytes. Si la primera sí llegó al servidor y lo
-- que se perdió fue la respuesta, repetirla no puede fallar: con la cuenta ya en
-- `KEY_ACTIVE`, la misma subida y la misma confirmación son un no-op. Cualquier
-- OTRA subida sobre una cuenta que ya tiene clave falla: cambiar la frase es
-- SET-SEC-01 y recuperar la clave es REC-01, y ninguna de las dos pasa por aquí.
--
-- **Cualquier miembro `REGISTERED`, no solo el ADMIN.** Hoy REG-07 solo lo ve el
-- ADMIN que crea REG-01, pero un usuario de FRU también nace `REGISTERED` y
-- necesitará sus claves por el mismo camino (F-217). El rol no cambia nada aquí.
--
-- `members.state` solo lo mueve el servidor (`guard_member_privileges`, 0001): estas
-- funciones son `security definer`, igual que `activate_own_membership` (0038).
-- =============================================================================

-- Los parámetros de Argon2id que fija ADR-001 §6.1/§6.3, exactos. Un cambio de
-- parámetros es una migración nueva, no algo que decida el cliente.
create or replace function app.kdf_params_v1()
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select '{"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}'::jsonb
$$;

-- Paso 3 de REG-07: sube el backup y publica la pública que le corresponde.
create or replace function public.store_key_backup(
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
  v public.members%rowtype;
begin
  -- Las formas, antes que nada: ADR-001 §6.2 (48 = 32 de la privada + 16 de la
  -- etiqueta GCM), §6.1 (sal de 32) y X25519 (pública de 32). Las restricciones de
  -- la tabla cubren IV, sal y pública, pero no el blob ni los parámetros.
  if octet_length(p_public_key) is distinct from 32
     or octet_length(p_encrypted_key_blob) is distinct from 48
     or octet_length(p_key_iv) is distinct from 12
     or octet_length(p_argon2_salt) is distinct from 32 then
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
           kdf_params         = p_kdf_params
     where id = v.id;
    return;
  end if;

  -- La misma subida otra vez sobre una cuenta ya confirmada: una respuesta perdida.
  if v.state = 'KEY_ACTIVE'
     and v.public_key = p_public_key
     and v.encrypted_key_blob = p_encrypted_key_blob
     and v.key_iv = p_key_iv
     and v.argon2_salt = p_argon2_salt
     and v.kdf_params = p_kdf_params then
    return;
  end if;

  raise exception 'Tu cuenta no está pendiente de generar claves.';
end;
$$;

-- Paso 4 de REG-07: el navegador ya ha descifrado la copia del servidor; la cuenta
-- pasa a KEY_ACTIVE. Lleva la pública para confirmar ESE backup y no otro (dos
-- pestañas a la vez sobrescribirían la fila entre la subida y la confirmación).
create or replace function public.confirm_key_backup(p_public_key bytea)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v public.members%rowtype;
begin
  select * into v from public.members where id = auth.uid() for update;
  if not found then
    raise exception 'No eres miembro de ninguna organización.';
  end if;

  if v.state = 'REGISTERED'
     and v.encrypted_key_blob is not null
     and v.public_key = p_public_key then
    update public.members set state = 'KEY_ACTIVE' where id = v.id;
    return;
  end if;

  -- La misma confirmación otra vez: una respuesta perdida.
  if v.state = 'KEY_ACTIVE' and v.public_key = p_public_key then
    return;
  end if;

  raise exception 'No hay un backup de clave pendiente de confirmar.';
end;
$$;

revoke execute on function app.kdf_params_v1() from public, anon, authenticated;
revoke execute on function public.store_key_backup(bytea, bytea, bytea, bytea, jsonb) from public, anon;
revoke execute on function public.confirm_key_backup(bytea) from public, anon;
grant  execute on function public.store_key_backup(bytea, bytea, bytea, bytea, jsonb) to authenticated;
grant  execute on function public.confirm_key_backup(bytea) to authenticated;
