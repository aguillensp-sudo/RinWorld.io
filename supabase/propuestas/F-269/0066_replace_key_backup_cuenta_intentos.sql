-- BORRADOR · NO APLICAR sin decisión del PO (F-269). Ver README.md de esta carpeta.
-- Cambia replace_key_backup: de `void` a una tabla de estado, para que un intento fallido SE CUENTE
-- (un raise lo revertiría). Misma tabla y ventana de 5 por 30 min que begin_key_recovery (0052).

drop function if exists public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea, bytea);

create function public.replace_key_backup(
  p_public_key bytea,
  p_encrypted_key_blob bytea,
  p_key_iv bytea,
  p_argon2_salt bytea,
  p_kdf_params jsonb,
  p_key_verifier bytea,
  p_old_proof bytea default null
)
returns table (status text, seconds_left integer, attempts_left integer)
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
  v_ok boolean;
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
  -- Sin verificador no hay con qué comprobar la prueba: ya no se deja pasar (cierra «sin prueba, una vez»).
  if m.key_verifier is null then
    raise exception 'Este backup no lleva verificador: genera claves nuevas.';
  end if;

  insert into public.key_recovery_attempts (member_id) values (m.id) on conflict do nothing;
  select * into a from public.key_recovery_attempts where member_id = m.id for update;

  if a.locked_until is not null and a.locked_until > now() then
    return query select 'locked'::text,
                        ceil(extract(epoch from (a.locked_until - now())))::integer, 0;
    return;
  end if;

  v_ok := p_old_proof is not null
          and octet_length(p_old_proof) = 32
          and sha256(p_old_proof) = m.key_verifier;

  if not v_ok then
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
    return query select 'wrong_proof'::text,
                        case when a.locked_until is null then 0
                             else ceil(extract(epoch from (a.locked_until - now())))::integer end,
                        v_max - a.attempts;
    return;
  end if;

  update public.members
     set encrypted_key_blob = p_encrypted_key_blob,
         key_iv             = p_key_iv,
         argon2_salt        = p_argon2_salt,
         kdf_params         = p_kdf_params,
         key_verifier       = p_key_verifier
   where id = m.id;
  -- Un acierto NO reinicia el contador (0052): solo vence la ventana.
  return query select 'ok'::text, 0, greatest(v_max - a.attempts, 0);
end;
$$;

revoke execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea, bytea) from public, anon;
grant  execute on function public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb, bytea, bytea) to authenticated;
