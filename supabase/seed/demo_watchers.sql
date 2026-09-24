-- =============================================================================
-- Semilla de demo · los watchers de SRCH-03
-- =============================================================================
-- Da a la pantalla los cinco estados de la spec §3 con datos reales. Los cuatro
-- primeros son los «Datos de ejemplo» de la spec; el quinto (EXPIRED) es mio, para
-- que el chip `Expirados` no salga vacio.
--
--   Rodamientos Ibericos (a1...)      -- la cuenta compradora de los e2e (ALPHA)
--     6308-ZZ         ACTIVE                creado hace 3 dias, 27 restantes, Europa, email
--     NU2210-E-TVP2   TRIGGERED             Schaeffler Iberia SL - 120 u - ES, hace 2 horas
--     22316-E         PENDIENTE RENOVACION  vencio ayer: le quedan 2 dias de ventana
--     7210-BECBP      PAUSED                creado hace 18 dias, 12 restantes
--     6205-2RS        EXPIRED               vencio hace 10 dias
--   Nordwaelz Lager (b2...)           -- la otra cuenta: prueba el aislamiento por RLS
--     NJ2310-E        ACTIVE
--     32008-X         ACTIVE
--
-- ⚠ **EL CONTADOR DE LA SPEC NO SE PUEDE REPRODUCIR.** El ejemplo de la spec §3
-- dice `4 / 50 watchers activos` con cuatro watchers en cuatro estados distintos,
-- y solo uno esta ACTIVE. Con esta siembra el contador dice `1 / 50`, que es lo que
-- `watcher-lifecycle` manda (el limite cuenta ACTIVE). Es la misma errata del mock
-- de siempre (F-024).
--
-- ⚠ **RE-ANCLA EL RELOJ Y REPONE EL ESTADO CADA VEZ QUE SE CORRE.** Las fechas son
-- relativas a hoy: 22316-E solo es PENDIENTE RENOVACION durante 3 dias desde su
-- vencimiento y luego la vista lo ve EXPIRED, asi que una siembra vieja deja el
-- chip `Pendientes de renovacion` vacio. Borra TODOS los watchers de estas dos
-- organizaciones antes de reponerlos -tambien los que un ensayo haya dejado-.
--
-- Idempotente. Se ejecuta DESPUES de `demo_orgs.sql`. Sin caracteres fuera de
-- ASCII en los datos, para poder pasarla tambien por `execute_sql` (que no admite
-- `\encoding`).
-- =============================================================================

do $$
declare
  c_alpha constant uuid := 'a1000000-0000-4000-8000-000000000001';
  c_beta  constant uuid := 'b2000000-0000-4000-8000-000000000002';
begin
  if (select count(*) from public.organizations where id in (c_alpha, c_beta)) <> 2 then
    raise exception 'Faltan las organizaciones de demo: corre antes supabase/seed/demo_orgs.sql';
  end if;

  delete from public.watchers where org_id in (c_alpha, c_beta);

  insert into public.watchers
    (id, org_id, part_number, min_quantity, brand, zone, country, email_channel,
     status, created_at, expires_at, triggered_at, triggered_distributor, triggered_quantity, triggered_country)
  values
    ('d1350000-0000-4000-8000-000000000001', c_alpha, '6308-ZZ', 100, null, 'EU', null, true,
     'ACTIVE', now() - interval '3 days', now() + interval '27 days', null, null, null, null),

    ('d1350000-0000-4000-8000-000000000002', c_alpha, 'NU2210-E-TVP2', 50, 'FAG', null, null, false,
     'TRIGGERED', now() - interval '10 days', now() + interval '20 days',
     now() - interval '2 hours', 'Schaeffler Iberia SL', 120, 'ES'),

    ('d1350000-0000-4000-8000-000000000003', c_alpha, '22316-E', 20, null, null, null, false,
     'PENDIENTE RENOVACION', now() - interval '31 days', now() - interval '1 day', null, null, null, null),

    ('d1350000-0000-4000-8000-000000000004', c_alpha, '7210-BECBP', 10, 'SKF', null, 'ES', false,
     'PAUSED', now() - interval '18 days', now() + interval '12 days', null, null, null, null),

    ('d1350000-0000-4000-8000-000000000005', c_alpha, '6205-2RS', 200, null, null, null, false,
     'EXPIRED', now() - interval '40 days', now() - interval '10 days', null, null, null, null),

    ('d2350000-0000-4000-8000-000000000001', c_beta, 'NJ2310-E', 30, null, null, 'DE', false,
     'ACTIVE', now() - interval '5 days', now() + interval '25 days', null, null, null, null),

    ('d2350000-0000-4000-8000-000000000002', c_beta, '32008-X', 15, 'TIMKEN', 'EU', null, true,
     'ACTIVE', now() - interval '1 day', now() + interval '29 days', null, null, null, null);
end
$$;
