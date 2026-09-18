-- =============================================================================
-- 0034 · Billing y suscripción anual (ADMIN-02)
-- =============================================================================
--
-- Capa de datos de ADMIN-02 (Panel de Gestión de Cobros), escrita a mano ANTES
-- de la tarea, mismo patrón que `0030`/`0031`-`0033` para el foro
-- (`UMBRAL-FABRICA-V1.md` §7, paso 2). Fuente: `openspec/specs/billing-subscription/spec.md`
-- (ocho Requirements) y `Rinworld_spec_ADMIN-02.md`.
--
-- ⚠ **"ACTIVE" DE LA SPEC ES "APPROVED" DE LA BASE, Y NO SE AÑADE UN VALOR
-- NUEVO.** `organizations.status` ya trae `PENDING_REVIEW`/`APPROVED`/`REJECTED`/
-- `SUSPENDED` desde `0001`, y `SUSPENDED` YA es el que usan las políticas de
-- visibilidad (`organizations_select_approved`: `status = 'APPROVED' or id =
-- current_org_id()`) y de búsqueda (`0014`/`0023`: mismo criterio). El billing
-- REUSA esas dos palabras -no crea `billing_accounts.status` en paralelo- porque
-- lo que la spec pide ("su inventario deja de aparecer en los resultados de
-- búsqueda de otros miembros") YA es exactamente lo que hace `status =
-- 'SUSPENDED'` hoy. "ACTIVE" y "EN PRUEBA" son la MISMA fila (`status =
-- 'APPROVED'`), distinguidas solo por si ya hay un pago o el periodo de prueba
-- sigue corriendo -- se calculan, no se guardan, mismo criterio que
-- `forum_category_stats`/`forum_thread_list`.
--
-- ⚠ **NO HAY `approved_at`, Y ES UNA SUPOSICIÓN EXPLÍCITA, NO UN HECHO
-- COMPROBADO.** El periodo de prueba cuenta "desde la fecha de aprobación"
-- (RNG-BILL-02), y hoy no existe ninguna columna así: las organizaciones nacen
-- directamente en `organizations` sin pasar por un estado `PENDING_REVIEW` con
-- fila propia -el flujo real de aprobación (`0028`, `registration_requests`)
-- vive ANTES de que exista ninguna fila en `organizations`, y el paso que crea
-- esa fila no está construido todavía-. Se usa `organizations.created_at` como
-- sustituto: es razonable porque hoy son la misma fecha en todo dato real (las
-- seis organizaciones de la base tienen 42-43 días, dentro de su prueba de 90),
-- pero el día que exista un `approved_at` de verdad, esta migración deja de ser
-- exacta y hay que sustituirlo.
--
-- ⚠ **`billing_accounts` es una tabla APARTE de `organizations`, y no una
-- columna más.** `organizations` es legible por CUALQUIER miembro activo de
-- CUALQUIER organización (`organizations_select_approved`), porque el
-- directorio y la contraparte de un hilo lo necesitan. Meter aquí
-- `suspended_since` o el histórico de pagos filtraría datos de cobro a
-- cualquier competidor que lea esa fila. Aparte, con su propia RLS solo para
-- el Operador, es el mismo patrón que separar `thread_item_keys` de
-- `thread_items`.
--
-- LO QUE ESTA MIGRACIÓN NO HACE, A PROPÓSITO:
--   · **`Iniciar borrado`** (deletion-after-prolonged-suspension): no se
--     implementa la función que borra. Es un borrado en cascada real -inventario,
--     miembros, claves E2EE, la parte de mensajería de esa organización- que
--     toca casi todas las tablas del esquema con distintos `on delete`
--     (`restrict` en varias), y merece su propia auditoría fila a fila antes de
--     escribir una sola línea, no una función de relleno dentro de esta tarea.
--     La vista de abajo SÍ calcula qué es "candidata a borrado" -es una fecha,
--     barato y sin riesgo-, pero el botón que borra de verdad queda para
--     cuando se audite esa cascada.
--   · **El aviso de vencimiento por email** (expiration-warning): no existe
--     ningún proveedor de correo en el proyecto (mismo hueco que EML-07/EML-08
--     de `ADMIN-01`, F-100). No se pinta ninguna promesa de envío en la base.
--   · **La transición automática por cron**: `app.billing_evaluate_expirations()`
--     hace el trabajo, pero no está enganchada a `pg_cron` (disponible en el
--     proyecto, `installed_version` null hoy) ni a ningún job programado. Se
--     deja para cuando se decida el mecanismo -cron en la base o Edge Function-,
--     documentado como pendiente, no como hecho.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La cuenta de billing, 1:1 con cada organización
-- -----------------------------------------------------------------------------
create table public.billing_accounts (
  org_id          uuid primary key references public.organizations (id) on delete cascade,
  -- NULL = activa o en prueba. Se pone al suspender (automático o manual) y se
  -- limpia al confirmar un pago. Es el evento que `forum_thread_list`-style NO
  -- se podría derivar solo de `organizations.status`: el "desde cuándo" no está
  -- en ningún otro sitio.
  suspended_since timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.billing_accounts is
  'ADMIN-02: metadatos de billing por organizacion, separados de organizations a proposito -esa tabla es legible por cualquier miembro activo, esta no-. suspended_since es el unico dato que no se puede derivar de otra tabla.';

-- Toda organización nueva nace con su fila de billing, sin hueco que rellenar
-- a mano -- mismo criterio que las cuatro categorías del foro en `0029`.
create or replace function app.init_billing_account()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.billing_accounts (org_id) values (new.id)
  on conflict (org_id) do nothing;
  return new;
end;
$$;

create trigger organizations_init_billing
  after insert on public.organizations
  for each row execute function app.init_billing_account();

-- Backfill de las organizaciones que ya existían antes de esta migración.
insert into public.billing_accounts (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2 · Los pagos confirmados (manual-payment-confirmation)
-- -----------------------------------------------------------------------------
create table public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  payment_date date not null,
  -- Spec §4: "ej. referencia de transferencia, banco emisor". Texto libre del
  -- operador, nunca dato de tarjeta -no hay pasarela de pago, RNG-BILL-01-.
  note         text,
  recorded_by  uuid not null references public.platform_operators (id),
  created_at   timestamptz not null default now(),

  constraint billing_payments_date_chk check (payment_date <= current_date),
  constraint billing_payments_note_chk check (note is null or char_length(note) <= 300)
);

create index billing_payments_org_idx on public.billing_payments (org_id, payment_date desc);

comment on table public.billing_payments is
  'ADMIN-02: historial de pagos confirmados por el Operador. Se escribe SOLO desde public.billing_confirm_payment(), nunca por INSERT directo del cliente.';

-- -----------------------------------------------------------------------------
-- 3 · El historial de cambios de estado (para el panel lateral, spec §3)
-- -----------------------------------------------------------------------------
create table public.billing_status_events (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  from_status text not null,
  to_status   text not null,
  -- NULL = transición automática (vencimiento sin pago), no un operador que
  -- decidió. El panel lateral tiene que poder distinguir las dos cosas.
  changed_by  uuid references public.platform_operators (id),
  created_at  timestamptz not null default now()
);

create index billing_status_events_org_idx on public.billing_status_events (org_id, created_at);

comment on table public.billing_status_events is
  'ADMIN-02: historial de transiciones ACTIVE<->SUSPENDED. changed_by NULL significa transicion automatica por vencimiento, no un operador.';

-- -----------------------------------------------------------------------------
-- 4 · Confirmar un pago (manual-payment-confirmation, RNG-BILL-06)
-- -----------------------------------------------------------------------------
-- `security definer`: escribe en billing_payments (sin politica de INSERT para
-- nadie) y en organizations/billing_accounts (sin politica de UPDATE para
-- operadores) -- mismo patron que create_inquiry/counter_offer: el cliente
-- llama a un verbo, no edita la tabla directamente.
create or replace function public.billing_confirm_payment(
  p_org_id      uuid,
  p_payment_date date,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_status text;
begin
  if not app.is_platform_operator() then
    raise exception 'Solo un Operador de Plataforma confirma un pago (manual-payment-confirmation).';
  end if;

  if p_payment_date > current_date then
    raise exception 'La fecha del pago no puede ser futura.';
  end if;

  if p_note is not null and char_length(p_note) > 300 then
    raise exception 'La nota interna no puede superar los 300 caracteres.';
  end if;

  select status into v_status from public.organizations where id = p_org_id for update;
  if v_status is null then
    raise exception 'La organizacion % no existe.', p_org_id;
  end if;
  if v_status not in ('APPROVED', 'SUSPENDED') then
    raise exception 'Solo se confirma un pago sobre una organizacion activa, en prueba o suspendida (estado actual: %).', v_status;
  end if;

  insert into public.billing_payments (org_id, payment_date, note, recorded_by)
  values (p_org_id, p_payment_date, p_note, auth.uid());

  if v_status = 'SUSPENDED' then
    update public.organizations set status = 'APPROVED' where id = p_org_id;
    update public.billing_accounts set suspended_since = null where org_id = p_org_id;
    insert into public.billing_status_events (org_id, from_status, to_status, changed_by)
    values (p_org_id, 'SUSPENDED', 'APPROVED', auth.uid());
  end if;
end;
$$;

comment on function public.billing_confirm_payment(uuid, date, text) is
  'ADMIN-02: "Marcar pago recibido" / "Reactivar" son el MISMO verbo -la spec de pantalla los pinta como dos botones, pero la spec de comportamiento (manual-payment-confirmation) solo describe uno-. Reactiva si estaba suspendida, siempre recalcula el vencimiento (vista billing_org_status) desde esta fecha.';

-- -----------------------------------------------------------------------------
-- 5 · Suspender (automatic-suspension, RNG-BILL-05, y su via manual)
-- -----------------------------------------------------------------------------
create or replace function public.billing_suspend_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_status text;
begin
  if not app.is_platform_operator() then
    raise exception 'Solo un Operador de Plataforma suspende una organizacion.';
  end if;

  select status into v_status from public.organizations where id = p_org_id for update;
  if v_status is null then
    raise exception 'La organizacion % no existe.', p_org_id;
  end if;
  if v_status <> 'APPROVED' then
    raise exception 'Solo se suspende una organizacion activa o en prueba (estado actual: %).', v_status;
  end if;

  update public.organizations set status = 'SUSPENDED' where id = p_org_id;
  update public.billing_accounts set suspended_since = now() where org_id = p_org_id;
  insert into public.billing_status_events (org_id, from_status, to_status, changed_by)
  values (p_org_id, 'APPROVED', 'SUSPENDED', auth.uid());
end;
$$;

comment on function public.billing_suspend_organization(uuid) is
  'ADMIN-02, panel lateral: "Suspender manualmente" (spec §3, solo visible si ACTIVE). Misma mecanica que la transicion automatica, con changed_by = el operador en vez de NULL.';

-- -----------------------------------------------------------------------------
-- 6 · La transicion automatica (RNG-BILL-05) -- escrita, SIN enganchar a cron
-- -----------------------------------------------------------------------------
-- Vive en `app`, no en `public`: no es un verbo que el cliente pueda pedir bajo
-- demanda para una organizacion suya -- barre TODAS las que vencieron, sin
-- distincion de quien llama. Pensada para `pg_cron` (disponible, no instalado
-- hoy) o una invocacion manual con `service_role`; revocada de `authenticated`
-- explicitamente porque no es un verbo de usuario.
create or replace function app.billing_evaluate_expirations()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer := 0;
  v_org record;
begin
  for v_org in
    select o.id
      from public.organizations o
      join public.billing_accounts b on b.org_id = o.id
      left join lateral (
        select max(p.payment_date) as last_payment_date
          from public.billing_payments p
         where p.org_id = o.id
      ) lp on true
     where o.status = 'APPROVED'
       and coalesce(lp.last_payment_date + interval '365 days',
                     o.created_at + interval '90 days') < now()
  loop
    update public.organizations set status = 'SUSPENDED' where id = v_org.id;
    update public.billing_accounts set suspended_since = now() where org_id = v_org.id;
    insert into public.billing_status_events (org_id, from_status, to_status, changed_by)
    values (v_org.id, 'APPROVED', 'SUSPENDED', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

comment on function app.billing_evaluate_expirations() is
  'RNG-BILL-05: suspende TODA organizacion vencida sin pago. Sin enganchar a pg_cron todavia -- ver la cabecera de 0034. changed_by NULL marca la transicion como automatica en billing_status_events.';

revoke execute on function app.billing_evaluate_expirations() from public, authenticated;

-- -----------------------------------------------------------------------------
-- 7 · La vista de ADMIN-02 (collections-panel)
-- -----------------------------------------------------------------------------
-- `security_invoker = true`: respeta la RLS de `organizations`/`billing_accounts`
-- de quien consulta. Un miembro normal ve sus propias organizaciones aprobadas
-- en `organizations`, pero el INNER JOIN con `billing_accounts` -RLS solo para
-- el Operador, ver mas abajo- lo deja sin ninguna fila: la exclusividad de la
-- pantalla (spec §7) la impone la RLS de las tablas, no un filtro de la vista.
create view public.billing_org_status
with (security_invoker = true) as
  select
    o.id                                                      as org_id,
    o.name,
    o.country,
    o.status,
    o.created_at                                               as org_created_at,
    b.suspended_since,
    lp.last_payment_date,
    (o.created_at::date + 90)                                  as trial_ends_at,
    coalesce(lp.last_payment_date + 365, o.created_at::date + 90) as current_period_ends_at,
    (coalesce(lp.last_payment_date + 365, o.created_at::date + 90) - current_date)::integer as days_remaining,
    case
      when o.status = 'SUSPENDED'
           and b.suspended_since is not null
           and b.suspended_since <= now() - interval '6 months'
        then 'CANDIDATA A BORRADO'
      when o.status = 'SUSPENDED' then 'SUSPENDED'
      when o.status = 'APPROVED'
           and lp.last_payment_date is null
           and current_date < (o.created_at::date + 90)
        then 'EN PRUEBA'
      when o.status = 'APPROVED' then 'ACTIVE'
      else o.status
    end                                                          as billing_state
    from public.organizations   o
    join public.billing_accounts b on b.org_id = o.id
    left join lateral (
      select max(p.payment_date) as last_payment_date
        from public.billing_payments p
       where p.org_id = o.id
    ) lp on true;

comment on view public.billing_org_status is
  'ADMIN-02: tabla principal. billing_state es EN PRUEBA/ACTIVE (organizations.status=APPROVED) o SUSPENDED/CANDIDATA A BORRADO (status=SUSPENDED, esta ultima con 6+ meses en suspended_since). days_remaining negativo = ya vencida.';

-- -----------------------------------------------------------------------------
-- 8 · RLS
-- -----------------------------------------------------------------------------
alter table public.billing_accounts      enable row level security;
alter table public.billing_payments      enable row level security;
alter table public.billing_status_events enable row level security;

-- El Operador ve TODAS las organizaciones, no solo las APPROVED: sin esto,
-- una organizacion SUSPENDED desaparece tambien del panel que existe
-- precisamente para gestionar suspensiones. Aditiva a `organizations_select_approved`
-- (0001): un miembro normal no gana nada, un Operador gana el resto.
create policy organizations_select_operator on public.organizations
  for select to authenticated
  using (app.is_platform_operator());

create policy billing_accounts_select_operator on public.billing_accounts
  for select to authenticated
  using (app.is_platform_operator());

create policy billing_payments_select_operator on public.billing_payments
  for select to authenticated
  using (app.is_platform_operator());

create policy billing_status_events_select_operator on public.billing_status_events
  for select to authenticated
  using (app.is_platform_operator());

-- Ni INSERT ni UPDATE ni DELETE para nadie autenticado, en las tres tablas: se
-- escribe SOLO desde las funciones security definer de arriba. Un historial o
-- un pago que su propio sujeto pudiera editar no es evidencia de nada.

-- -----------------------------------------------------------------------------
-- 9 · GRANTs, y anon fuera
-- -----------------------------------------------------------------------------
grant select on public.billing_accounts      to authenticated, service_role;
grant select on public.billing_payments      to authenticated, service_role;
grant select on public.billing_status_events to authenticated, service_role;
grant select on public.billing_org_status    to authenticated, service_role;
grant insert on public.billing_payments      to service_role;
grant insert on public.billing_status_events to service_role;

revoke all on public.billing_accounts      from anon;
revoke all on public.billing_payments      from anon;
revoke all on public.billing_status_events from anon;
revoke all on public.billing_org_status    from anon;
