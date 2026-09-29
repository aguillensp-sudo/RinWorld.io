-- =============================================================================
-- 0040 · Tokens de acceso de un solo uso (F-223): el enlace de invitacion
-- =============================================================================
-- Decision del PO (29-sep-2026, F-223): sin proveedor de correo por ahora, asi que al
-- APROBAR una solicitud de registro el Operador recibe un enlace con un token de un
-- solo uso y 7 dias, y lo envia el por su cuenta. REG-01 canjea ese token. El mismo
-- mecanismo tiene que servir a las invitaciones de INVT-01 (F-212): por eso la tabla
-- es de tokens y no de solicitudes, y lleva ya la columna para colgar de una
-- invitacion (todavia sin funcion que la use).
--
-- **Que se guarda: solo el HASH (sha256), nunca el token.** Un volcado de la tabla,
-- una copia de seguridad o un `select` con un fallo de RLS no regalan enlaces
-- canjeables. El precio, y el PO tiene que saberlo: el enlace solo se ve UNA vez, en
-- el momento de generarlo. Si el Operador cierra el panel sin copiarlo, se genera
-- otro (`issue_registration_link` revoca el anterior); no se puede recuperar el que
-- hubo. Es una decision de forma que el PO puede revocar cambiando esta tabla (guardar
-- el token cifrado con una clave del servidor) sin tocar nada de la pantalla.
--
-- **El token** son 64 caracteres hexadecimales de dos `gen_random_uuid()` (244 bits
-- del generador criptografico de Postgres). No hay que limitar intentos de adivinarlo:
-- a esa entropia, el limite lo pone el universo.
--
-- **Los clientes no tocan la tabla.** Ninguna politica y ningun privilegio para
-- `anon` ni `authenticated`: escribe y lee solo el servidor, por funciones. Los
-- privilegios se dejan explicitos y se comprueban contra el catalogo (F-146): la
-- plataforma da EXECUTE a `anon`/`authenticated` por DEFAULT PRIVILEGES y `revoke ...
-- from public` no lo quita.
--
-- **Lo que NO hace, y es deliberado:**
--   · No crea la organizacion ni el ADMIN: es REG-01. Aqui solo se valida y se canjea.
--   · No cambia la aprobacion: `INVITED_APPROVED` sigue siendo el UPDATE de ADMIN-01,
--     con el guardia de 0028. Se aprueba y, despues, se pide el enlace. Si algo falla
--     entre las dos, la solicitud queda aprobada sin enlace y el Operador lo genera.
--   · No manda ningun correo.
-- =============================================================================

create table public.access_tokens (
  id                      uuid primary key default gen_random_uuid(),
  purpose                 text not null,
  -- sha256 en hexadecimal del token. Unico: dos tokens con el mismo hash serian
  -- indistinguibles al canjear.
  token_hash              text not null,
  registration_request_id uuid references public.registration_requests (id) on delete cascade,
  member_invitation_id    uuid references public.member_invitations (id) on delete cascade,
  created_by              uuid,
  created_at              timestamptz not null default now(),
  -- F-223: un solo uso y 7 dias.
  expires_at              timestamptz not null default now() + interval '7 days',
  used_at                 timestamptz,
  revoked_at              timestamptz,

  constraint access_tokens_purpose_chk
    check (purpose in ('REGISTRATION', 'MEMBER_INVITATION')),
  -- Cada token cuelga de exactamente una cosa, la que dice su proposito. `case` y no
  -- `and`/`or`, por lo de 0028: un CHECK que da NULL pasa.
  constraint access_tokens_target_chk check (
    case purpose
      when 'REGISTRATION'      then registration_request_id is not null and member_invitation_id is null
      when 'MEMBER_INVITATION' then member_invitation_id is not null and registration_request_id is null
      else false
    end
  ),
  constraint access_tokens_hash_chk   check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint access_tokens_expiry_chk check (expires_at > created_at),
  -- Canjeado o revocado, pero no las dos cosas: un token revocado no se canjea, asi
  -- que un `used_at` sobre uno revocado seria un estado que nada produce.
  constraint access_tokens_end_chk    check (used_at is null or revoked_at is null)
);

create unique index access_tokens_hash_key on public.access_tokens (token_hash);

-- Un solo token VIGENTE por solicitud y por invitacion. Generar otro revoca el
-- anterior antes de insertar; este indice es la red por si dos operadores lo piden a
-- la vez (el segundo falla en vez de dejar dos enlaces vivos).
create unique index access_tokens_one_live_per_request
  on public.access_tokens (registration_request_id)
  where used_at is null and revoked_at is null and registration_request_id is not null;
create unique index access_tokens_one_live_per_invitation
  on public.access_tokens (member_invitation_id)
  where used_at is null and revoked_at is null and member_invitation_id is not null;

comment on table public.access_tokens is
  'Tokens de un solo uso y 7 dias (F-223). Guarda solo el hash sha256; el token se ve una vez al generarlo. Sin politicas ni privilegios para clientes: escriben y leen solo las funciones security definer.';

alter table public.access_tokens enable row level security;

-- -----------------------------------------------------------------------------
-- 1 · Generar el enlace de una solicitud APROBADA (Operador)
-- -----------------------------------------------------------------------------
-- Devuelve el token EN CLARO, una sola vez. Revoca el vigente si lo hay: es a la vez
-- «generar» y «volver a generar».
create or replace function public.issue_registration_link(p_request_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
  v_token text;
  v_exp   timestamptz;
begin
  if not app.is_platform_operator() then
    raise exception 'Solo un Operador de Plataforma genera el enlace de una solicitud.';
  end if;

  -- `for update`: serializa a dos operadores sobre la misma solicitud.
  select r.state into v_state
    from public.registration_requests r
   where r.id = p_request_id
     for update;

  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if v_state <> 'INVITED_APPROVED' then
    raise exception 'Solo se genera el enlace de una solicitud aprobada (estado actual: %).', v_state;
  end if;

  -- Un token canjeado ya creo su organizacion: otro enlace de la misma solicitud
  -- permitiria crear una segunda. Para volver a empezar hay que rechazar y recibir
  -- una solicitud nueva.
  if exists (select 1 from public.access_tokens t
              where t.registration_request_id = p_request_id and t.used_at is not null) then
    raise exception 'El enlace de esta solicitud ya se canjeo: no se genera otro.';
  end if;

  update public.access_tokens t
     set revoked_at = now()
   where t.registration_request_id = p_request_id
     and t.used_at is null
     and t.revoked_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.access_tokens (purpose, token_hash, registration_request_id, created_by)
  values ('REGISTRATION',
          encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
          p_request_id,
          auth.uid())
  returning access_tokens.expires_at into v_exp;

  return query select v_token, v_exp;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2 · Que enlace tiene una solicitud (Operador) -- sin el token
-- -----------------------------------------------------------------------------
-- Para que el panel diga «enlace vigente hasta...», «canjeado» o «caducado» sin poder
-- volver a enseñarlo. Lee el token MAS RECIENTE de la solicitud.
create or replace function public.registration_link_status(p_request_id uuid)
returns table (status text, expires_at timestamptz, used_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_operator() then
    raise exception 'Solo un Operador de Plataforma ve el estado del enlace de una solicitud.';
  end if;

  return query
    select case
             when t.used_at    is not null then 'Canjeado'
             when t.revoked_at is not null then 'Revocado'
             when t.expires_at <= now()    then 'Caducado'
             else 'Vigente'
           end,
           t.expires_at,
           t.used_at
      from public.access_tokens t
     where t.registration_request_id = p_request_id
     order by t.created_at desc
     limit 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3 · Validar un token SIN canjearlo (REG-01, sin sesion)
-- -----------------------------------------------------------------------------
-- **`anon` NO la ejecuta** (F-146: ninguna funcion de `public` la puede ejecutar `anon`,
-- y el barrido de `01_schema_smoke.sql` lo mide). REG-01 no tiene sesion, asi que la
-- llama una Edge Function con `service_role`, igual que `access-request` con el FSR:
-- ademas, ahi se puede limitar el ritmo de intentos, que aqui no se puede.
-- Devuelve lo que el solicitante escribio en el FSR para pre-rellenar REG-01, o
-- NINGUNA fila. Nunca dice POR QUE no vale (no existe, caducado, canjeado, revocado):
-- quien adivina tokens no tiene que aprender nada de la respuesta. Solo lee; canjear
-- es `app.redeem_registration_token`, que llamara la funcion que crea la organizacion.
create or replace function public.registration_link_validate(p_token text)
returns table (
  org_name            text,
  country             text,
  applicant_full_name text,
  applicant_email     text,
  applicant_phone     text,
  website             text,
  expires_at          timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.org_name, r.country, r.applicant_full_name, r.applicant_email,
         r.applicant_phone, r.website, t.expires_at
    from public.access_tokens t
    join public.registration_requests r on r.id = t.registration_request_id
   where t.purpose = 'REGISTRATION'
     and t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and t.used_at is null
     and t.revoked_at is null
     and t.expires_at > now()
     and r.state = 'INVITED_APPROVED';
$$;

-- -----------------------------------------------------------------------------
-- 4 · Canjear (interno)
-- -----------------------------------------------------------------------------
-- El UPDATE es la puerta: `used_at is null` en el WHERE y `returning` hacen que dos
-- canjes a la vez tengan un solo ganador, sin lectura previa que se pueda colar.
-- Devuelve la solicitud, o NULL si el token no vale. Nadie con sesion ni sin ella lo
-- ejecuta: lo llaman las funciones `security definer` que crean la organizacion.
create or replace function app.redeem_registration_token(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_request uuid;
begin
  update public.access_tokens t
     set used_at = now()
   where t.purpose = 'REGISTRATION'
     and t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and t.used_at is null
     and t.revoked_at is null
     and t.expires_at > now()
     and exists (select 1 from public.registration_requests r
                  where r.id = t.registration_request_id and r.state = 'INVITED_APPROVED')
  returning t.registration_request_id into v_request;

  return v_request;   -- NULL si no valia
end;
$$;

-- -----------------------------------------------------------------------------
-- 5 · Privilegios, explicitos (F-146)
-- -----------------------------------------------------------------------------
revoke all on public.access_tokens from anon, authenticated;
grant select, insert, update, delete on public.access_tokens to service_role;

revoke execute on function public.issue_registration_link(uuid)    from public, anon;
revoke execute on function public.registration_link_status(uuid)   from public, anon;
revoke execute on function public.registration_link_validate(text) from public, anon, authenticated;
revoke execute on function app.redeem_registration_token(text)     from public, anon, authenticated;

grant execute on function public.issue_registration_link(uuid)    to authenticated;
grant execute on function public.registration_link_status(uuid)   to authenticated;
-- REG-01 no tiene sesion: valida la Edge Function, con `service_role`.
grant execute on function public.registration_link_validate(text) to service_role;
grant execute on function app.redeem_registration_token(text)     to service_role;
