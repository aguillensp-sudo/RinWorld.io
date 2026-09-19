-- =============================================================================
-- Semilla de demo · el estado de cobros de ADMIN-02
-- =============================================================================
-- Da a la pantalla los cuatro estados de la spec §3 con datos reales: sin esto
-- las seis organizaciones de la demo estan todas EN PRUEBA y los chips
-- `Proximos a vencer`, `Suspendidos` y `Candidatas a borrado` salen vacios.
--
--   Cuscinetti Padana (c3...)   ACTIVE        vence en 10 dias   (naranja; entra en `Proximos a vencer`)
--   Roulements Rhone  (e5...)   ACTIVE        vence en 246 dias
--   Distribuciones Ruiz SL      SUSPENDED     hace 133 dias      (nueva, ver abajo)
--   Timken Europe GmbH          CANDIDATA     hace 190 dias      (nueva, ver abajo)
--   Las otras cuatro            EN PRUEBA      (no se tocan mas que para reponerlas)
--
-- ⚠ **LAS DOS SUSPENDIDAS SON ORGANIZACIONES NUEVAS, NO LAS SEIS DE SIEMPRE.**
-- Suspender una de las seis las sacaria de directorio y busqueda
-- (`organizations_select_approved`: `status = 'APPROVED'`), y los e2e de DIR-01 y
-- SRCH-01 cuentan las seis. Una organizacion SUSPENDED nueva no la ve ningun
-- miembro, asi que no descuadra nada de lo que ya esta construido.
--
-- ⚠ **RE-ANCLA EL RELOJ Y REPONE EL ESTADO CADA VEZ QUE SE CORRE.** Las fechas son
-- relativas a hoy, asi que una siembra de hace dos semanas deja a Cuscinetti fuera
-- de `Proximos a vencer` (10 dias de margen) y a Ruiz a punto de ser candidata
-- (`suspended_since` de hace 133 dias; a los 6 meses, ~184, cambia de chip). Y borra
-- TODOS los pagos y eventos de estas ocho organizaciones antes de reponerlos: un
-- ensayo con `Marcar pago recibido` deja pagos que ningun DELETE del cliente puede
-- quitar (`0034` solo da INSERT a `service_role`), y esta siembra corre como
-- `postgres`. `billing_payments` no tiene otra via de limpieza: por eso los e2e de
-- ADMIN-02 son de solo lectura.
--
-- Idempotente. Se ejecuta DESPUES de `demo_orgs.sql`. Necesita una cuenta en
-- `platform_operators` (quien firma los pagos): si no hay ninguna, para con un
-- mensaje en vez de inventarla, mismo criterio que `demo_registration_requests.sql`.
-- Sin caracteres fuera de ASCII en los datos, para poder pasarla tambien por
-- `execute_sql` (que no admite `\encoding`).
-- =============================================================================

do $$
declare
  v_op      uuid;
  c_ruiz    constant uuid := 'a7000000-0000-4000-8000-000000000007';
  c_timken  constant uuid := 'a8000000-0000-4000-8000-000000000008';
  c_cuscin  constant uuid := 'c3000000-0000-4000-8000-000000000003';
  c_rhone   constant uuid := 'e5000000-0000-4000-8000-000000000005';
  v_todas   constant uuid[] := array[
    'a1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000004',
    'e5000000-0000-4000-8000-000000000005', 'f6000000-0000-4000-8000-000000000006',
    'a7000000-0000-4000-8000-000000000007', 'a8000000-0000-4000-8000-000000000008'
  ]::uuid[];
begin
  select id into v_op from public.platform_operators order by created_at limit 1;
  if v_op is null then
    raise exception 'No hay ningun Operador en platform_operators: dar de alta uno es crear credenciales y lo decide el PO. Sin el, no hay quien firme los pagos de la siembra.';
  end if;

  -- 1 · Las dos suspendidas: organizaciones nuevas, con la antiguedad que da el vencimiento del ejemplo
  --     (vencimiento = created_at + 90 dias = hoy - 133 y hoy - 190).
  insert into public.organizations (id, name, legal_name, country, continent, status, created_at) values
    (c_ruiz,   'Distribuciones Ruiz SL', 'Distribuciones Ruiz S.L.', 'ES', 'EU', 'SUSPENDED', now() - interval '223 days'),
    (c_timken, 'Timken Europe GmbH',     'Timken Europe GmbH',       'DE', 'EU', 'SUSPENDED', now() - interval '280 days')
  on conflict (id) do update
    set status = 'SUSPENDED', created_at = excluded.created_at;

  -- 2 · Limpiar el estado de cobros de las ocho, sin dejar restos de un ensayo
  delete from public.billing_payments      where org_id = any (v_todas);
  delete from public.billing_status_events where org_id = any (v_todas);

  update public.organizations set status = 'APPROVED'
   where id = any (v_todas) and id not in (c_ruiz, c_timken) and status <> 'APPROVED';

  update public.billing_accounts set suspended_since = null where org_id = any (v_todas);
  update public.billing_accounts set suspended_since = now() - interval '133 days' where org_id = c_ruiz;
  update public.billing_accounts set suspended_since = now() - interval '190 days' where org_id = c_timken;

  -- 3 · Los pagos. Cuscinetti tiene dos (historial de mas de uno); ninguno de las
  --     otras cuatro en prueba ni de las dos suspendidas (nunca pagaron: `Ultimo pago` = —).
  insert into public.billing_payments (org_id, payment_date, note, recorded_by) values
    (c_cuscin, current_date - 720, 'Demo: transferencia del primer ciclo', v_op),
    (c_cuscin, current_date - 355, 'Demo: transferencia del segundo ciclo', v_op),
    (c_rhone,  current_date - 119, 'Demo: transferencia del primer ciclo', v_op);

  -- 4 · El historial de estados de las dos suspendidas: automatico (changed_by null),
  --     que es como se suspende una organizacion que vence sin pagar (RNG-BILL-05).
  insert into public.billing_status_events (org_id, from_status, to_status, changed_by, created_at) values
    (c_ruiz,   'APPROVED', 'SUSPENDED', null, now() - interval '133 days'),
    (c_timken, 'APPROVED', 'SUSPENDED', null, now() - interval '190 days');
end
$$;

-- Comprobacion: los cuatro estados tienen que aparecer, y ninguno mas.
select name, country, billing_state, last_payment_date, current_period_ends_at, days_remaining
  from public.billing_org_status
 order by days_remaining, name;
