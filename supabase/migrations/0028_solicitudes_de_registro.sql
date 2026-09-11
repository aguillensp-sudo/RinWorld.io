-- =============================================================================
-- 0028 · La cola de solicitudes de registro y el Operador de Plataforma
--        (ADMIN-01, segunda pantalla del H1)
-- =============================================================================
-- ADMIN-01 es el Panel de Aprobación del Operador. A diferencia de DIR-01, que
-- solo necesitaba dos columnas, esta pantalla **no tiene ni una sola fila de
-- esquema debajo**: ni la cola de solicitudes, ni el historial que enseña su
-- panel lateral, ni el actor que la usa.
--
-- ⚠ **LA DECISIÓN QUE ESTA MIGRACIÓN TOMA Y QUE EL PO PUEDE REVOCAR BARATO.**
-- La spec dice que el Operador de Plataforma es *"un rol distinto al de miembro
-- distribuidor"* que *"accede con credenciales propias"*, y el esquema no tiene
-- hoy ningún concepto de operador: todo lo que hay es `members`, y todo lo que
-- hay cuelga de una organización. Tres formas de resolverlo:
--
--   (a) **Una tabla `platform_operators` y un ayudante `security definer`**, igual
--       que `app.is_org_admin()`. Es la que se implementa aquí.
--   (b) Un *claim* en el JWT (`app_metadata.role = 'operator'`). Más barato de
--       escribir y peor de auditar: quién es operador deja de ser una fila que se
--       puede consultar y pasa a ser un atributo del token.
--   (c) Que el panel no hable con la base directamente y vaya por una función de
--       borde con `service_role`. Es la más cerrada y la que más código añade,
--       y rompe la forma que tienen las otras seis pantallas.
--
-- Se elige **(a)** porque es literalmente el patrón que ya usa el proyecto para
-- "este que llama, ¿puede?" y porque deja el "quién" en una tabla auditable. Si
-- el PO prefiere otra, lo que cambia es `app.is_platform_operator()` y las
-- políticas que la invocan: nada del resto de esta migración se mueve.
--
-- **LO QUE ESTA MIGRACIÓN NO HACE, Y ES DELIBERADO:**
--
--   · **No crea ninguna cuenta de operador.** Una cuenta es credenciales, y eso
--     lo decide el PO (como se hizo con `E2E_EDITOR_*` el 5-sep). Sin al menos
--     una, ADMIN-01 no se puede ver ni probar de extremo a extremo: es lo único
--     que esta pantalla necesita de fuera.
--   · **No abre ninguna vía de escritura para el solicitante.** El FSR lo rellena
--     alguien que todavía no es usuario, así que su `INSERT` es una decisión de
--     REG-00 (¿`anon` con política propia? ¿función de borde?) y no se prejuzga
--     aquí. Hoy solo escribe `service_role`, que salta RLS. **`anon` no recibe
--     ni un `GRANT`**, y se revoca explícitamente por si las *default privileges*
--     de la plataforma lo abren por su cuenta -- el agujero de `F-146`.
--   · **No manda ningún correo.** EML-07 y EML-08 son del módulo 01.
--   · **No enlaza la solicitud con la organización que nazca de ella.** Ese enlace
--     ocurre en el FRO, dos pantallas más adelante, y una columna especulativa
--     hoy sería una columna que nadie rellena y que el día que se use ya no
--     significará lo que decía su comentario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · El Operador de Plataforma
-- -----------------------------------------------------------------------------
create table public.platform_operators (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

comment on table public.platform_operators is
  'Operador de Plataforma (ADMIN-01): actor sin organizacion, con credenciales propias. Quien esta aqui decide solicitudes de registro; nadie mas.';

-- El ayudante, mismo patrón que `app.is_org_admin()`: `security definer` para
-- que la política que lo invoca no dependa de que el llamante pueda LEER la
-- tabla de operadores. Es la lección de `F-148`/`F-155`: un `SELECT` bajo RLS
-- dentro de una decisión de permiso devuelve `false` sin error y cierra la
-- puerta en silencio.
create or replace function app.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_operators where id = auth.uid());
$$;

revoke execute on function app.is_platform_operator() from public;
grant  execute on function app.is_platform_operator() to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · La cola de solicitudes
-- -----------------------------------------------------------------------------
-- Las ocho columnas de la tabla de ADMIN-01, más lo que su panel lateral enseña
-- y lo que sus tres acciones escriben. `state` reusa el vocabulario que ya tiene
-- `members.state` -- PENDING_REVIEW, INVITED_APPROVED, REJECTED, CANCELLED -- y
-- no inventa uno paralelo: dos máquinas de estados con los mismos nombres y
-- distintos valores es de las cosas que no se descubren hasta producción.
create table public.registration_requests (
  id                  uuid primary key default gen_random_uuid(),

  -- Lo que el solicitante escribe en el FSR.
  org_name            text not null,
  country             text not null,
  applicant_full_name text not null,
  applicant_email     text not null,
  applicant_phone     text,
  website             text,
  submitted_at        timestamptz not null default now(),

  -- Lo que el Operador decide.
  state               text not null default 'PENDING_REVIEW',
  rejection_reason    text,
  decided_by          uuid references public.platform_operators (id),
  decided_at          timestamptz,

  constraint registration_requests_state_chk check (
    state in ('PENDING_REVIEW','INVITED_APPROVED','REJECTED','CANCELLED')
  ),
  constraint registration_requests_country_chk check (country ~ '^[A-Z]{2}$'),
  constraint registration_requests_email_chk check (
    applicant_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),

  -- El motivo es obligatorio al rechazar y no puede quedarse pegado después:
  -- `Volver a revisión` lo borra. Si no, la solicitud reaparece en la cola
  -- arrastrando el motivo de un rechazo que ya no existe.
  --
  -- ⚠ **VA CON `case` Y NO CON `and`/`or`, Y NO ES ESTILO.** La primera versión
  -- de este CHECK era
  --     (state = 'REJECTED' and char_length(rejection_reason) between 10 and 500)
  --     or (state <> 'REJECTED' and rejection_reason is null)
  -- y **dejaba pasar un rechazo sin motivo**: con `rejection_reason` a NULL, la
  -- primera rama vale NULL y la segunda FALSE, y `NULL or FALSE` es NULL -- y un
  -- CHECK que da NULL **pasa**. Lo cazó el aserto de `01_schema_smoke.sql` que
  -- ya estaba escrito antes de aplicar nada, contra un Postgres desechable. Un
  -- `case` siempre devuelve verdadero o falso, nunca NULL.
  constraint registration_requests_reason_chk check (
    case when state = 'REJECTED'
         then rejection_reason is not null
              and char_length(rejection_reason) between 10 and 500
         else rejection_reason is null
    end
  ),

  -- Quién y cuándo decidió van juntos o no van. Una decisión sin firma es
  -- exactamente lo que el panel lateral promete enseñar y no podría.
  constraint registration_requests_decision_chk check (
    (decided_by is null and decided_at is null)
    or (decided_by is not null and decided_at is not null)
  )
);

-- El orden por defecto de la pantalla es la más antigua arriba, filtrando por
-- estado. Este índice es exactamente esa consulta.
create index registration_requests_cola_idx
  on public.registration_requests (state, submitted_at);

comment on table public.registration_requests is
  'Cola del FSR (ADMIN-01). Una fila por solicitud de registro; el Operador la aprueba, la rechaza o la devuelve a revision.';

-- -----------------------------------------------------------------------------
-- 3 · El historial que enseña el panel lateral
-- -----------------------------------------------------------------------------
-- *"Historial de cambios de estado (con timestamp y operador que tomó la
-- decisión)"*. No lo escribe el cliente: lo escribe un disparador, y **no hay
-- ninguna política de INSERT para nadie**. Un historial que su propio sujeto
-- puede editar no es un historial.
create table public.registration_request_events (
  id          bigint generated always as identity primary key,
  request_id  uuid not null references public.registration_requests (id) on delete cascade,
  state       text not null,
  operator_id uuid references public.platform_operators (id),
  note        text,
  at          timestamptz not null default now()
);

create index registration_request_events_req_idx
  on public.registration_request_events (request_id, at);

comment on table public.registration_request_events is
  'Historial de estados de una solicitud (ADMIN-01, panel lateral). Lo escribe un disparador security definer; ninguna politica permite escribirlo a mano.';

-- -----------------------------------------------------------------------------
-- 4 · El guardia de la máquina de estados
-- -----------------------------------------------------------------------------
-- `security invoker` a propósito, como los otros seis guardias de `app`: decide
-- con OLD/NEW, `current_user`, `auth.uid()` y un ayudante `definer`. **No lee
-- ninguna tabla**, que es lo que el ancla de `F-155` en `01_schema_smoke.sql`
-- exige de toda función `invoker` -- por eso tampoco nombra ninguna tabla en sus
-- mensajes de error.
create or replace function app.guard_registration_request()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- La siembra y los trabajos programados (el vencimiento a 30 días) entran por
  -- aquí: no hay sesión de usuario que mirar.
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  if not app.is_platform_operator() then
    raise exception 'Solo un Operador de Plataforma decide una solicitud de registro (operator-approval).';
  end if;

  if new.state is distinct from old.state then
    if not (
         (old.state = 'PENDING_REVIEW' and new.state in ('INVITED_APPROVED','REJECTED','CANCELLED'))
      or (old.state = 'REJECTED'       and new.state = 'PENDING_REVIEW')
    ) then
      raise exception
        'Transicion no permitida: % -> %. Desde PENDING_REVIEW se aprueba, se rechaza o se cancela; un rechazo se puede devolver a revision, y nada mas.',
        old.state, new.state;
    end if;
  end if;

  -- Los datos del FSR son del solicitante: el Operador decide, no corrige.
  if new.org_name            is distinct from old.org_name
  or new.country             is distinct from old.country
  or new.applicant_full_name is distinct from old.applicant_full_name
  or new.applicant_email     is distinct from old.applicant_email
  or new.applicant_phone     is distinct from old.applicant_phone
  or new.website             is distinct from old.website
  or new.submitted_at        is distinct from old.submitted_at then
    raise exception 'Los datos del formulario de solicitud no se editan desde el panel: el Operador decide, no corrige.';
  end if;

  -- La firma de la decisión la pone la base, NO el cliente: es lo que el panel
  -- lateral promete enseñar, y dejársela al cliente es dejar que la invente. Se
  -- toca solo cuando el estado cambia; un `UPDATE` que no decide nada no puede
  -- refrescar la fecha de una decisión que ya se tomó.
  if new.state is distinct from old.state then
    if new.state = 'PENDING_REVIEW' then
      -- `Volver a revisión`: la solicitud reaparece en la cola limpia. Si el
      -- motivo se quedara pegado, volvería arrastrando la explicación de un
      -- rechazo que ya no existe -- y el CHECK de arriba lo rechazaría.
      new.decided_by      := null;
      new.decided_at      := null;
      new.rejection_reason := null;
    else
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
  else
    new.decided_by := old.decided_by;
    new.decided_at := old.decided_at;
  end if;

  return new;
end;
$$;

create trigger registration_requests_guard
  before update on public.registration_requests
  for each row execute function app.guard_registration_request();

-- -----------------------------------------------------------------------------
-- 5 · El disparador que escribe el historial
-- -----------------------------------------------------------------------------
-- `security definer`: el historial se escribe **siempre**, lo escriba quien lo
-- escriba, y su tabla no tiene ninguna política de INSERT. Si esto fuera
-- `invoker`, la fila del historial dependería de que el llamante tuviera permiso
-- para escribir en una tabla en la que nadie lo tiene.
create or replace function app.log_registration_request_state()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.registration_request_events (request_id, state, operator_id, note)
    values (new.id, new.state, null, 'Envio FSR');
  elsif new.state is distinct from old.state then
    insert into public.registration_request_events (request_id, state, operator_id, note)
    values (new.id, new.state, new.decided_by, new.rejection_reason);
  end if;
  return new;
end;
$$;

create trigger registration_requests_log
  after insert or update on public.registration_requests
  for each row execute function app.log_registration_request_state();

-- -----------------------------------------------------------------------------
-- 6 · RLS
-- -----------------------------------------------------------------------------
alter table public.platform_operators        enable row level security;
alter table public.registration_requests     enable row level security;
alter table public.registration_request_events enable row level security;

-- El Operador ve la lista de operadores porque el historial enseña **quién**
-- decidió, y ese nombre tiene que salir de algún sitio. Nadie más la ve.
create policy platform_operators_select_operator on public.platform_operators
  for select to authenticated
  using (app.is_platform_operator());

create policy registration_requests_select_operator on public.registration_requests
  for select to authenticated
  using (app.is_platform_operator());

create policy registration_requests_update_operator on public.registration_requests
  for update to authenticated
  using (app.is_platform_operator())
  with check (app.is_platform_operator());

create policy registration_request_events_select_operator on public.registration_request_events
  for select to authenticated
  using (app.is_platform_operator());

-- ⚠ Ni INSERT ni DELETE para nadie autenticado, en ninguna de las tres. La
-- entrada del FSR es de REG-00 y hoy la hace `service_role`; el historial lo
-- escribe el disparador de arriba.

-- -----------------------------------------------------------------------------
-- 7 · GRANTs, y la revocación explícita a `anon`
-- -----------------------------------------------------------------------------
-- La plataforma tiene *default privileges* que abren las tablas nuevas de
-- `public` a `anon` y `authenticated`. RLS las dejaría igualmente vacías para
-- `anon` -- ninguna de las tres políticas le aplica -- pero el `GRANT` que
-- sobra es exactamente lo que dejó vivo `F-146` desde `0012`, y no se deja al
-- azar de una política bien escrita.
grant select         on public.platform_operators          to authenticated, service_role;
grant select, update on public.registration_requests       to authenticated, service_role;
grant insert         on public.registration_requests       to service_role;
grant select         on public.registration_request_events to authenticated, service_role;
grant insert         on public.registration_request_events to service_role;

revoke all on public.platform_operators          from anon;
revoke all on public.registration_requests       from anon;
revoke all on public.registration_request_events from anon;
