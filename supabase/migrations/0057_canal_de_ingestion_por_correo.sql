-- =============================================================================
-- 0057 · INV-04 fase 1: la base del canal de ingestión por correo
-- =============================================================================
-- `openspec/v1/plan-inv04-ingestion-por-correo.md`, fase 1. Solo la base: tres tablas,
-- RLS solo ADMIN y las funciones que la pantalla necesitará. **Nada recibe correo todavía**
-- (eso es la fase 2) y la pantalla `INV-04` no se enseña hasta entonces: una dirección que no
-- recibe sería mentir.
--
--   ingest_addresses  la dirección de la organización: `ingest-<12>@ingest.<dominio>`. Aquí solo
--                     vive el token; el dominio es de la aplicación, no de la base. Rotar =
--                     revocar la vigente e insertar otra (decisión 4 del plan: 12 caracteres).
--   ingest_senders    la lista de remitentes autorizados. El del ADMIN que abre el canal es
--                     protegido: no se puede eliminar (spec INV-04 §3).
--   ingest_events     el historial. Los rechazados también cuentan (decisión 6): sin respuesta al
--                     remitente, pero con fila. **Nunca lleva contenido del correo**, solo
--                     remitente, nombre de archivo, resultado y un código de motivo.
--
-- Quién escribe qué:
--   · Los clientes no escriben NUNCA en las tablas: solo `select` (RLS, solo ADMIN de la misma
--     organización) y las funciones de abajo, que son `security definer` porque rotar es a la
--     vez revocar e insertar y porque ningún cliente debe poder fijar `is_protected`.
--   · Los eventos los escribe la función de borde con `service_role` (fase 2); por eso no hay
--     RPC para insertarlos y `authenticated` no tiene `insert` en la tabla.
--
-- ⚠ `revoke … from anon, authenticated` explícito en las tres tablas: Supabase concede por
-- defecto todos los privilegios sobre tablas nuevas de `public` a `anon` y `authenticated`
-- (F-146), y `revoke … from public` no los quita.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Tablas
-- -----------------------------------------------------------------------------
create table public.ingest_addresses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- 12 caracteres de un alfabeto de 32 (sin `l` ni `o`; a-z menos esas dos son 24, más los dígitos 2-9): 60 bits. Minúsculas, porque el local-part de
  -- un correo no distingue mayúsculas en la práctica y la función de borde compara en minúsculas.
  token       text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  -- Una dirección rotada deja de funcionar en el mismo instante (spec §7): no se borra, se revoca,
  -- para que el historial y una auditoría puedan decir a qué dirección llegó un correo.
  revoked_at  timestamptz,

  constraint ingest_addresses_token_chk check (token ~ '^[a-km-np-z2-9]{12}$')
);

create unique index ingest_addresses_token_key on public.ingest_addresses (token);
-- Una sola vigente por organización. La RPC revoca antes de insertar; esto es la red por si dos
-- ADMIN rotan a la vez (el segundo falla en vez de dejar dos direcciones vivas).
create unique index ingest_addresses_one_live_per_org
  on public.ingest_addresses (org_id) where revoked_at is null;

create table public.ingest_senders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  -- Siempre en minúsculas: la comparación con el remitente autenticado es exacta.
  email         text not null,
  -- El ADMIN que abrió el canal. No se elimina (spec §3: «no se puede eliminar»).
  is_protected  boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid,

  constraint ingest_senders_email_chk
    check (email = lower(email) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create unique index ingest_senders_org_email_key on public.ingest_senders (org_id, email);

create table public.ingest_events (
  id            uuid primary key default gen_random_uuid(),
  -- Nulo si el correo llegó a una dirección que no existe o ya no vale: no hay organización a la
  -- que atribuirlo, y entonces solo lo ve `service_role`.
  org_id        uuid references public.organizations (id) on delete cascade,
  address_id    uuid references public.ingest_addresses (id) on delete set null,
  received_at   timestamptz not null default now(),
  -- Lo que dice el correo (`From`); el remitente AUTENTICADO es el que decide, pero el historial
  -- enseña ambos como un único texto ya resuelto por la función de borde.
  sender_email  text not null,
  file_name     text,
  result        text not null,
  -- Código corto y estable, nunca texto libre ni contenido del correo (el correo es dato no
  -- confiable). Los que producirá la fase 2: REMITENTE_NO_AUTORIZADO, AUTENTICACION, EXTENSION,
  -- TAMANO, FORMATO_NO_RECONOCIDO, DIRECCION_INEXISTENTE, LIMITE_POR_HORA, ERROR_INTERNO.
  reason        text,
  rows_imported integer,
  -- Id del mensaje en SES: SNS reintenta, y un mismo correo no debe contar dos veces.
  message_id    text,

  constraint ingest_events_result_chk check (result in ('PROCESADO', 'RECHAZADO', 'ERROR')),
  constraint ingest_events_reason_chk check (reason is null or reason ~ '^[A-Z_]{1,40}$'),
  constraint ingest_events_rows_chk   check (rows_imported is null or rows_imported >= 0),
  -- Solo un correo procesado importa filas.
  constraint ingest_events_rows_result_chk check (rows_imported is null or result = 'PROCESADO'),
  constraint ingest_events_sender_len_chk  check (length(sender_email) <= 254),
  constraint ingest_events_file_len_chk    check (file_name is null or length(file_name) <= 255)
);

create unique index ingest_events_message_key on public.ingest_events (message_id) where message_id is not null;
-- «Las últimas 10 ingestiones» de la pantalla.
create index ingest_events_org_received_idx on public.ingest_events (org_id, received_at desc);

comment on table public.ingest_addresses is
  'INV-04: direcciones de ingestión por correo. Una vigente por organización; rotar revoca y crea. Solo select para el ADMIN de la organización.';
comment on table public.ingest_senders is
  'INV-04: remitentes autorizados a escribir a la dirección de ingestión. Se gestiona solo por las funciones add_/remove_ingest_sender.';
comment on table public.ingest_events is
  'INV-04: historial de correos recibidos, también los rechazados. Sin contenido del correo. Lo escribe solo service_role (función de borde, fase 2).';

-- -----------------------------------------------------------------------------
-- 2 · Privilegios y RLS: select solo para el ADMIN de la misma organización
-- -----------------------------------------------------------------------------
revoke all on public.ingest_addresses, public.ingest_senders, public.ingest_events from public, anon, authenticated;
grant select on public.ingest_addresses, public.ingest_senders, public.ingest_events to authenticated;

alter table public.ingest_addresses enable row level security;
alter table public.ingest_senders   enable row level security;
alter table public.ingest_events    enable row level security;

-- Con las funciones envueltas en `(select …)` desde el principio (F-234): una vez por consulta.
create policy ingest_addresses_select_admin on public.ingest_addresses for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_org_admin()));
create policy ingest_senders_select_admin on public.ingest_senders for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_org_admin()));
create policy ingest_events_select_admin on public.ingest_events for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_org_admin()));

-- -----------------------------------------------------------------------------
-- 3 · Funciones
-- -----------------------------------------------------------------------------
-- Token nuevo: 12 caracteres de un alfabeto de 32 sacados de `gen_random_uuid()` (CSPRNG del
-- servidor). 256 es múltiplo de 32, así que `byte % 32` no sesga.
create or replace function app.new_ingest_token()
returns text
language plpgsql
volatile
set search_path = pg_catalog, pg_temp
as $$
declare
  alfabeto constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  hex  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  salida text := '';
  i int;
begin
  for i in 0..11 loop
    salida := salida || substr(alfabeto, (('x' || substr(hex, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1);
  end loop;
  return salida;
end;
$$;

-- El ADMIN activo de quien llama, o error. Un EDITOR no gestiona el canal (plan, fase 1: «RLS solo ADMIN»).
create or replace function app.ingest_admin_context(out o_org uuid, out o_email text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_org_admin() then
    raise exception 'Solo el administrador de la organización gestiona el canal de ingestión.' using errcode = '42501';
  end if;
  select m.org_id, lower(m.email) into o_org, o_email from public.members m where m.id = auth.uid();
end;
$$;

-- Abre el canal si no existe (dirección + el remitente protegido) y devuelve el token vigente.
-- Idempotente: con el canal abierto no cambia nada. Es lo que llamará la pantalla al entrar.
create or replace function public.ensure_ingest_channel()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid;
  v_email text;
  v_token text;
begin
  select * into v_org, v_email from app.ingest_admin_context();

  -- Serializa a dos ADMIN que abren a la vez la misma organización.
  perform 1 from public.organizations where id = v_org for update;

  select token into v_token from public.ingest_addresses where org_id = v_org and revoked_at is null;
  if v_token is null then
    v_token := app.new_ingest_token();
    insert into public.ingest_addresses (org_id, token, created_by) values (v_org, v_token, auth.uid());
  end if;

  insert into public.ingest_senders (org_id, email, is_protected, created_by)
  values (v_org, v_email, true, auth.uid())
  on conflict (org_id, email) do update set is_protected = true;

  return v_token;
end;
$$;

-- Rotar: la vigente se revoca y se crea otra, en la misma transacción. Irreversible e inmediata.
create or replace function public.rotate_ingest_address()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid;
  v_email text;
  v_token text;
begin
  select * into v_org, v_email from app.ingest_admin_context();
  perform 1 from public.organizations where id = v_org for update;

  if not exists (select 1 from public.ingest_addresses where org_id = v_org and revoked_at is null) then
    raise exception 'La organización no tiene canal de ingestión que rotar.';
  end if;

  update public.ingest_addresses set revoked_at = now() where org_id = v_org and revoked_at is null;
  v_token := app.new_ingest_token();
  insert into public.ingest_addresses (org_id, token, created_by) values (v_org, v_token, auth.uid());
  return v_token;
end;
$$;

-- Tope de remitentes por organización: la lista es una superficie (quien está en ella puede escribir).
create or replace function public.add_ingest_sender(p_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid;
  v_email text;
  v_norm  text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
begin
  select * into v_org, v_email from app.ingest_admin_context();
  perform 1 from public.organizations where id = v_org for update;

  if v_norm = '' or length(v_norm) > 254 or v_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email del remitente no es válido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ingest_addresses where org_id = v_org and revoked_at is null) then
    raise exception 'Abre primero el canal de ingestión.';
  end if;
  if (select count(*) from public.ingest_senders where org_id = v_org) >= 20 then
    raise exception 'Se ha alcanzado el máximo de 20 remitentes autorizados.';
  end if;

  insert into public.ingest_senders (org_id, email, created_by) values (v_org, v_norm, auth.uid())
  on conflict (org_id, email) do nothing
  returning id into v_id;

  -- Ya estaba: devolver la fila existente, no fallar (un doble clic no es un error).
  if v_id is null then
    select id into v_id from public.ingest_senders where org_id = v_org and email = v_norm;
  end if;
  return v_id;
end;
$$;

create or replace function public.remove_ingest_sender(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid;
  v_email text;
  v_prot  boolean;
begin
  select * into v_org, v_email from app.ingest_admin_context();

  select is_protected into v_prot from public.ingest_senders where id = p_id and org_id = v_org for update;
  if not found then
    raise exception 'Ese remitente no existe.';
  end if;
  if v_prot then
    raise exception 'El remitente del administrador no se puede eliminar.' using errcode = '42501';
  end if;
  delete from public.ingest_senders where id = p_id and org_id = v_org;
end;
$$;

-- Purga del historial: solo `service_role` (la programará la fase 4). 90 días por defecto; el
-- crudo en S3 se borra a los 30 (spec §7) por una regla del bucket, no por aquí.
create or replace function public.purge_ingest_events(p_days integer default 90)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  if p_days is null or p_days < 1 then
    raise exception 'El plazo de purga debe ser de al menos 1 día.' using errcode = '22023';
  end if;
  delete from public.ingest_events where received_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Privilegios de las funciones. `app.*` no se exponen: las llaman las de `public`, que son
-- `security definer` y corren con los permisos de su dueño.
revoke execute on function app.new_ingest_token()              from public, anon, authenticated;
revoke execute on function app.ingest_admin_context()          from public, anon, authenticated;
revoke execute on function public.ensure_ingest_channel()      from public, anon;
revoke execute on function public.rotate_ingest_address()      from public, anon;
revoke execute on function public.add_ingest_sender(text)      from public, anon;
revoke execute on function public.remove_ingest_sender(uuid)   from public, anon;
revoke execute on function public.purge_ingest_events(integer) from public, anon, authenticated;
grant  execute on function public.ensure_ingest_channel()      to authenticated;
grant  execute on function public.rotate_ingest_address()      to authenticated;
grant  execute on function public.add_ingest_sender(text)      to authenticated;
grant  execute on function public.remove_ingest_sender(uuid)   to authenticated;
grant  execute on function public.purge_ingest_events(integer) to service_role;
