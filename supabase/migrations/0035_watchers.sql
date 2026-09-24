-- =============================================================================
-- 0035 · Watchers (SRCH-03 · Gestión de Watchers)
-- =============================================================================
--
-- Capa de datos de SRCH-03, escrita a mano ANTES de la tarea, mismo patrón que
-- `0034` para ADMIN-02 (`UMBRAL-FABRICA-V1.md` §7, paso 2). Fuente:
-- `openspec/specs/conversational-search/spec.md` (`watcher-lifecycle`,
-- `watcher-notification-throttle`) y `Rinworld_spec_SRCH-03.md`.
--
-- ⚠ **EL ESTADO QUE VE EL USUARIO SE CALCULA, NO SE GUARDA, EN UN CASO.** La
-- expiración a los 30 días (`watcher-lifecycle`) no tiene ningún cron que la
-- mueva -mismo hueco que `0034`: `pg_cron` no está instalado-. Si el estado
-- solo cambiara cuando algo lo escribe, un watcher ACTIVE olvidado seguiría
-- diciendo «ACTIVE» meses después de su día 30. Por eso `watcher_list` deriva el
-- estado EFECTIVO: un ACTIVE o PAUSED cuyo `expires_at` ya pasó se ve como
-- `PENDIENTE RENOVACION`, escriba o no `app.watchers_evaluate_expirations()`
-- (que existe y hace lo mismo sobre la columna, sin enganchar a ningún job).
--
-- ⚠ **LA VENTANA DE RENOVACIÓN DE 3 DÍAS ES UN SUPUESTO MÍO, NO UN DATO DE LA
-- SPEC.** `watcher-lifecycle` dice que al día 30 el watcher pasa a PENDIENTE DE
-- RENOVACIÓN y que «si el miembro declina o no responde» pasa a EXPIRED, pero no
-- dice CUÁNTO se espera la respuesta. La spec de pantalla, en cambio, pinta en la
-- tarjeta `Expira en: 2 días` para un PENDIENTE RENOVACIÓN, y eso solo se puede
-- calcular si hay un plazo. Se fija en 3 días (`app.watcher_effective_status`, un
-- solo sitio) para que las dos specs se cumplan a la vez; es una decisión de
-- producto que el PO puede cambiar tocando esa constante.
--
-- ⚠ **EL VALOR DE LA BASE ES `PENDIENTE RENOVACION`, SIN TILDE, Y LA SPEC PINTA
-- `PENDIENTE RENOVACIÓN`.** Mismo criterio que `APPROVED`/`ACTIVE` en `0034`: la
-- base guarda ASCII (las siembras pasan por `execute_sql`, que no admite
-- `\encoding`) y la capa de datos traduce al literal de la spec.
--
-- ⚠ **`country` Y `zone` SON DOS COLUMNAS, Y ES UNA DECISIÓN SOBRE UNA
-- CONTRADICCIÓN DE LA SPEC.** El formulario de edición (§4) pide un `País`
-- ISO 3166-1, pero los «Datos de ejemplo» (§3) pintan `País: Europa` -un
-- continente-. Son dos filtros distintos, igual que en `SearchCriteria`
-- (`search.ts`): `zone` ⊂ los siete continentes de `organizations_continent_chk`
-- y `country` ISO alfa-2. La tarjeta pinta el país si lo hay y, si no, la zona.
-- «Ver resultados» precarga los dos en SRCH-01.
--
-- ⚠ **UN WATCHER PERTENECE A LA ORGANIZACIÓN, NO AL MIEMBRO.** El límite de 50
-- ACTIVE es «por organización» (`watcher-lifecycle`) y la spec de pantalla
-- habla de «Mis watchers» sin distinguir quién los creó. Los ve y los gestiona
-- cualquier miembro ACTIVO de la organización; `created_by` guarda quién lo creó
-- pero no da ningún permiso.
--
-- LO QUE ESTA MIGRACIÓN NO HACE, A PROPÓSITO:
--   · **La evaluación contra el stream `stock.updated` (Kafka):** no existe
--     ninguna cola ni ningún proceso que reaccione a una publicación de stock.
--     Nada dispara un watcher; un TRIGGERED de la base viene de una siembra o de
--     un proceso futuro que escriba `triggered_*`.
--   · **El email de aviso (canal `email_channel`) y el límite de 5 notificaciones
--     por usuario y día** (`watcher-notification-throttle`): no hay proveedor de
--     correo (mismo hueco que `0034` y EML-07/EML-08, F-100) ni notificaciones que
--     limitar. La columna existe para que la pantalla pueda pintar el icono.
--   · **La creación desde VERA / SRCH-01 / SRCH-02** ni el badge de disparados
--     en el nav `Comprando`: son de otras pantallas.
--   · **Enganchar `watchers_evaluate_expirations()` a un job.**
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La tabla
-- -----------------------------------------------------------------------------
create table public.watchers (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  created_by            uuid references public.members (id) on delete set null,
  -- Los dos únicos campos obligatorios (spec §7): referencia y cantidad mínima.
  part_number           text not null,
  min_quantity          integer not null,
  brand                 text,
  zone                  text,
  country               text,
  email_channel         boolean not null default false,
  status                text not null default 'ACTIVE',
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '30 days'),
  -- Se rellenan SOLO al pasar a TRIGGERED («Stock detectado el [fecha] —
  -- [distribuidor] · [cantidad] u · [país]», spec §3).
  triggered_at          timestamptz,
  triggered_distributor text,
  triggered_quantity    integer,
  triggered_country     text,

  constraint watchers_status_chk check (status in
    ('ACTIVE', 'PAUSED', 'TRIGGERED', 'PENDIENTE RENOVACION', 'EXPIRED')),
  constraint watchers_part_number_chk check (char_length(btrim(part_number)) >= 2),
  constraint watchers_min_quantity_chk check (min_quantity > 0),
  constraint watchers_zone_chk check (zone is null or zone in ('AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA')),
  constraint watchers_country_chk check (country is null or country ~ '^[A-Z]{2}$'),
  constraint watchers_triggered_country_chk check (triggered_country is null or triggered_country ~ '^[A-Z]{2}$'),
  constraint watchers_triggered_chk check (
    (status = 'TRIGGERED') = (triggered_at is not null)
  )
);

create index watchers_org_idx on public.watchers (org_id, created_at desc);

comment on table public.watchers is
  'SRCH-03: vigilancia de stock por organizacion. La spec fija 30 dias de vida, renovacion explicita y 50 ACTIVE por organizacion. No hay nada que dispare un watcher todavia (sin stream stock.updated): un TRIGGERED viene de una siembra.';

-- -----------------------------------------------------------------------------
-- 2 · Disparadores
-- -----------------------------------------------------------------------------

-- 2.1 · Al nacer, el cliente no decide ni el estado ni la fecha de expiración:
-- se fuerzan aquí, como `0029` hace con el autor del foro. La política de
-- INSERT mira lo mismo por otro camino.
create or replace function app.init_watcher()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then
    -- service_role / postgres (siembras, procesos): se respeta lo escrito.
    return new;
  end if;
  new.part_number           := btrim(new.part_number);
  new.status                := 'ACTIVE';
  new.created_at            := now();
  new.expires_at            := now() + interval '30 days';
  new.triggered_at          := null;
  new.triggered_distributor := null;
  new.triggered_quantity    := null;
  new.triggered_country     := null;
  return new;
end;
$$;

create trigger watchers_init
  before insert on public.watchers
  for each row execute function app.init_watcher();

-- 2.2 · El límite de 50 ACTIVE por organización (`watcher-lifecycle`). Cuenta
-- los ACTIVE VIGENTES (no vencidos: un ACTIVE con `expires_at` pasado ya es
-- PENDIENTE RENOVACION a ojos del usuario). Se dispara al entrar en ACTIVE:
-- crear, reactivar y renovar. El bloqueo consultivo por organización evita que
-- dos altas simultáneas se cuelen las dos en el hueco 50.
create or replace function app.check_watcher_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_active integer;
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and old.expires_at > now() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('watchers:' || new.org_id::text));

  select count(*) into v_active
    from public.watchers
   where org_id = new.org_id
     and status = 'ACTIVE'
     and expires_at > now()
     and id <> new.id;

  if v_active >= 50 then
    raise exception 'Limite de 50 watchers activos por organizacion alcanzado (watcher-lifecycle).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger watchers_limit
  before insert or update of status, expires_at on public.watchers
  for each row execute function app.check_watcher_limit();

-- -----------------------------------------------------------------------------
-- 3 · El estado EFECTIVO, en un solo sitio, y la vista
-- -----------------------------------------------------------------------------
-- La vista y las acciones de la sección 5 tienen que decidir lo mismo sobre «qué
-- es este watcher AHORA». Una copia en cada sitio acabaría discrepando.
create or replace function app.watcher_effective_status(p_status text, p_expires_at timestamptz)
returns text
language sql
stable
as $$
  select case
    when p_status in ('ACTIVE', 'PAUSED', 'PENDIENTE RENOVACION') and p_expires_at <= now()
      then case when now() < p_expires_at + interval '3 days'
                then 'PENDIENTE RENOVACION' else 'EXPIRED' end
    else p_status
  end;
$$;

comment on function app.watcher_effective_status(text, timestamptz) is
  'watcher-lifecycle: ACTIVE/PAUSED vencidos son PENDIENTE RENOVACION durante 3 dias (supuesto, ver cabecera de 0035) y despues EXPIRED, sin esperar a que nada escriba la columna.';

create view public.watcher_list
with (security_invoker = true) as
  select
    w.id,
    w.org_id,
    w.part_number,
    w.min_quantity,
    w.brand,
    w.zone,
    w.country,
    w.email_channel,
    w.status                                          as stored_status,
    app.watcher_effective_status(w.status, w.expires_at) as status,
    w.created_at,
    w.expires_at,
    -- Solo tiene sentido en ACTIVE y PAUSED (spec §3). Un watcher pausado NO
    -- detiene el reloj (spec §7): el tiempo pausado descuenta igualmente.
    case
      when app.watcher_effective_status(w.status, w.expires_at) in ('ACTIVE', 'PAUSED')
        then ceil(extract(epoch from (w.expires_at - now())) / 86400)::integer
      else null
    end                                               as days_remaining,
    -- `Expira en: N días` de la tarjeta PENDIENTE RENOVACION.
    case
      when app.watcher_effective_status(w.status, w.expires_at) = 'PENDIENTE RENOVACION'
        then ceil(extract(epoch from (w.expires_at + interval '3 days' - now())) / 86400)::integer
      else null
    end                                               as renewal_days_left,
    w.triggered_at,
    w.triggered_distributor,
    w.triggered_quantity,
    w.triggered_country
  from public.watchers w;

comment on view public.watcher_list is
  'SRCH-03: lista de la pantalla. status es el EFECTIVO (app.watcher_effective_status): un ACTIVE o PAUSED vencido se ve como PENDIENTE RENOVACION durante 3 dias y luego EXPIRED aunque nadie haya escrito la columna (no hay cron). stored_status es lo que dice la tabla. days_remaining solo en ACTIVE/PAUSED vigentes; renewal_days_left solo en PENDIENTE RENOVACION.';

-- -----------------------------------------------------------------------------
-- 4 · RLS: los ve y los gestiona su organización
-- -----------------------------------------------------------------------------
alter table public.watchers enable row level security;

create policy watchers_select_org on public.watchers
  for select to authenticated
  using (app.is_active_member() and org_id = app.current_org_id());

create policy watchers_insert_org on public.watchers
  for insert to authenticated
  with check (app.is_active_member()
              and org_id = app.current_org_id()
              and created_by = auth.uid());

-- «Acción irreversible — no hay papelera ni recuperación» (spec §6).
create policy watchers_delete_org on public.watchers
  for delete to authenticated
  using (app.is_active_member() and org_id = app.current_org_id());

-- ⚠ NI UPDATE para `authenticated`: cambiar de estado, editar y renovar pasan
-- por las funciones de abajo, que validan la transición. Un UPDATE directo
-- podría poner TRIGGERED o saltarse los 30 días.

-- -----------------------------------------------------------------------------
-- 5 · Las acciones de la pantalla
-- -----------------------------------------------------------------------------

-- Ayudante: el watcher, bloqueado, y comprobado que es de mi organización. Un
-- id ajeno y un id inexistente dan el MISMO error, para no enseñar qué ids
-- existen en otras organizaciones.
create or replace function app.watcher_lock_own(p_id uuid)
returns public.watchers
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  w public.watchers;
begin
  if not app.is_active_member() then
    raise exception 'Solo un miembro activo gestiona watchers.';
  end if;
  select * into w from public.watchers
   where id = p_id and org_id = app.current_org_id()
   for update;
  if not found then
    raise exception 'El watcher % no existe.', p_id;
  end if;
  return w;
end;
$$;

revoke execute on function app.watcher_lock_own(uuid) from public, anon, authenticated;

-- Pausar / Reactivar. Solo se pausa un ACTIVE vigente y solo se reactiva un
-- PAUSED vigente: uno vencido es PENDIENTE RENOVACION y se renueva, no se
-- reactiva. El reloj NO se toca (spec §7).
create or replace function public.watcher_set_paused(p_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  w public.watchers;
  v_eff text;
begin
  w := app.watcher_lock_own(p_id);

  v_eff := app.watcher_effective_status(w.status, w.expires_at);

  if p_paused then
    if v_eff <> 'ACTIVE' then
      raise exception 'Solo se pausa un watcher activo (estado actual: %).', v_eff;
    end if;
    update public.watchers set status = 'PAUSED' where id = p_id;
  else
    if v_eff <> 'PAUSED' then
      raise exception 'Solo se reactiva un watcher pausado (estado actual: %).', v_eff;
    end if;
    update public.watchers set status = 'ACTIVE' where id = p_id;
  end if;
end;
$$;

-- Editar (spec §4). Referencia y cantidad obligatorias; marca, país y canal
-- email opcionales. Solo ACTIVE o PAUSED vigentes.
create or replace function public.watcher_update(
  p_id           uuid,
  p_part_number  text,
  p_min_quantity integer,
  p_brand        text,
  p_country      text,
  p_email_channel boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  w public.watchers;
  v_ref   text := btrim(coalesce(p_part_number, ''));
  v_brand text := nullif(btrim(coalesce(p_brand, '')), '');
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
begin
  w := app.watcher_lock_own(p_id);

  if app.watcher_effective_status(w.status, w.expires_at) not in ('ACTIVE', 'PAUSED') then
    raise exception 'Solo se edita un watcher activo o pausado (estado actual: %).',
      app.watcher_effective_status(w.status, w.expires_at);
  end if;
  if char_length(v_ref) < 2 then
    raise exception 'La referencia necesita al menos 2 caracteres.';
  end if;
  if p_min_quantity is null or p_min_quantity <= 0 then
    raise exception 'La cantidad minima tiene que ser un entero positivo.';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'El pais tiene que ser un codigo ISO 3166-1 de dos letras.';
  end if;

  update public.watchers
     set part_number   = v_ref,
         min_quantity  = p_min_quantity,
         brand         = v_brand,
         country       = v_country,
         email_channel = coalesce(p_email_channel, false)
   where id = p_id;
end;
$$;

-- «Mantener activo 30 días más»: vuelve a ACTIVE con el contador reiniciado
-- (`watcher-lifecycle`). Solo desde PENDIENTE RENOVACION, guardado o efectivo.
create or replace function public.watcher_renew(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  w public.watchers;
begin
  w := app.watcher_lock_own(p_id);

  if app.watcher_effective_status(w.status, w.expires_at) <> 'PENDIENTE RENOVACION' then
    raise exception 'Solo se renueva un watcher pendiente de renovacion (estado actual: %).',
      app.watcher_effective_status(w.status, w.expires_at);
  end if;

  update public.watchers
     set status = 'ACTIVE', expires_at = now() + interval '30 days'
   where id = p_id;
end;
$$;

-- «Dejar que expire»: PENDIENTE RENOVACION -> EXPIRED.
create or replace function public.watcher_let_expire(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  w public.watchers;
begin
  w := app.watcher_lock_own(p_id);

  if app.watcher_effective_status(w.status, w.expires_at) <> 'PENDIENTE RENOVACION' then
    raise exception 'Solo expira un watcher pendiente de renovacion (estado actual: %).',
      app.watcher_effective_status(w.status, w.expires_at);
  end if;

  update public.watchers set status = 'EXPIRED' where id = p_id;
end;
$$;

-- Escribe en la columna lo que la vista ya muestra. Sin enganchar a ningún job.
create or replace function app.watchers_evaluate_expirations()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  update public.watchers
     set status = app.watcher_effective_status(status, expires_at)
   where status in ('ACTIVE', 'PAUSED', 'PENDIENTE RENOVACION')
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function app.watchers_evaluate_expirations() is
  'watcher-lifecycle: escribe en la columna el estado efectivo (ACTIVE/PAUSED vencidos -> PENDIENTE RENOVACION, y EXPIRED pasada la ventana). La vista watcher_list ya lo muestra sin esto; sin enganchar a pg_cron todavia (ver la cabecera de 0035).';

revoke execute on function app.watchers_evaluate_expirations() from public, anon, authenticated;

comment on function public.watcher_set_paused(uuid, boolean) is
  'SRCH-03: Pausar / Reactivar. No toca expires_at: el tiempo pausado descuenta (spec §7).';
comment on function public.watcher_update(uuid, text, integer, text, text, boolean) is
  'SRCH-03: formulario Editar watcher (spec §4).';
comment on function public.watcher_renew(uuid) is
  'SRCH-03: Mantener activo 30 dias mas. Vuelve a ACTIVE con expires_at = now() + 30 dias; el limite de 50 se comprueba en watchers_limit.';
comment on function public.watcher_let_expire(uuid) is
  'SRCH-03: Dejar que expire. PENDIENTE RENOVACION -> EXPIRED.';

-- -----------------------------------------------------------------------------
-- 6 · GRANTs, y `anon` fuera (F-146: la plataforma regala EXECUTE a `anon` en
-- cada función nueva; `revoke ... from public` no lo quita)
-- -----------------------------------------------------------------------------
revoke execute on function public.watcher_set_paused(uuid, boolean) from public, anon;
revoke execute on function public.watcher_update(uuid, text, integer, text, text, boolean) from public, anon;
revoke execute on function public.watcher_renew(uuid)      from public, anon;
revoke execute on function public.watcher_let_expire(uuid) from public, anon;
grant  execute on function public.watcher_set_paused(uuid, boolean) to authenticated;
grant  execute on function public.watcher_update(uuid, text, integer, text, text, boolean) to authenticated;
grant  execute on function public.watcher_renew(uuid)      to authenticated;
grant  execute on function public.watcher_let_expire(uuid) to authenticated;

revoke execute on function app.watcher_effective_status(text, timestamptz) from public, anon;
grant  execute on function app.watcher_effective_status(text, timestamptz) to authenticated;
revoke execute on function app.init_watcher()        from public, anon, authenticated;
revoke execute on function app.check_watcher_limit() from public, anon, authenticated;

grant select, insert, delete on public.watchers     to authenticated;
grant select, insert, update, delete on public.watchers to service_role;
grant select                 on public.watcher_list to authenticated, service_role;

revoke all on public.watchers     from anon;
revoke all on public.watcher_list from anon;

-- ⚠ Supabase concede por defecto UPDATE (y en la vista, escritura) a `authenticated`
-- sobre cada tabla nueva de `public`, igual que regala EXECUTE en las funciones
-- (F-146). Sin UPDATE policy la RLS ya lo cortaba, pero un privilegio que solo
-- protege una politica es una segunda cerradura menos. Se quita a mano: el
-- Postgres desechable no lo enseña porque `00_auth_stub.sql` solo copia las
-- DEFAULT PRIVILEGES de funciones.
revoke update on public.watchers from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.watcher_list from authenticated;
revoke truncate, references, trigger on public.watchers from authenticated;
