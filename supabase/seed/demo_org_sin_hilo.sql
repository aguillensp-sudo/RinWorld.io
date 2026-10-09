-- =============================================================================
-- Siembra · una empresa de demo SIN HILO con nadie (F-211)
-- =============================================================================
-- `Contactar` sin hilo previo abre el cuadro «Primer mensaje», y con las seis de
-- `demo_orgs.sql` no se podía ver: Alpha tiene hilo con todas. Esta no tiene hilo con
-- ninguna cuenta de prueba, ni inventario, ni miembros; solo existe en el directorio.
--
-- **Va aparte de `demo_orgs.sql` a propósito:** el banco del catálogo (`run.sh`) aplica ese
-- fichero y exige que TODAS sus organizaciones tengan líneas de inventario. Esta no las
-- tiene, y no debe tenerlas (con inventario aparecería en la búsqueda y dejaría de ser un caso
-- limpio de «Contactar» sin hilo).
--
-- Se aplica a mano al proyecto que haga falta (producción y `bearingworld-e2e`, 9-oct-2026).
-- Idempotente.
--
-- ⚠ Se ensucia al usarla: contactarla crea un hilo real y esa empresa deja de servir. Para repetir
-- el caso, borrar el hilo creado:
--   delete from public.threads where org_low_id = 'a9000000-0000-4000-8000-000000000009'
--      or org_high_id = 'a9000000-0000-4000-8000-000000000009';
-- ⚠ ENCODING: lleva diacríticos; ver F-019 sobre el `\encoding`.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

insert into public.organizations
  (id, name, legal_name, country, continent, status, contact_phone, contact_email, address, city, postal_code)
values
  ('a9000000-0000-4000-8000-000000000009', 'Suministros Industriales Levante', 'Suministros Industriales Levante S.L.',
   'ES', 'EU', 'APPROVED', '+34 963 555 120', 'info@sumlevante.es', 'Polígono El Oliveral, nave 12', 'Valencia', '46394')
on conflict (id) do nothing;
