-- =============================================================================
-- Para añadir a `supabase/tests/00_auth_stub.sql`, justo después de la DEFAULT
-- PRIVILEGE de funciones (F-146). PROPUESTA de F-192, va junto con 0065.
-- =============================================================================
-- Lo mismo que F-146 hizo con las funciones, ahora con las tablas: Supabase
-- concede ALL a `anon`, `authenticated` y `service_role` sobre cada tabla y
-- secuencia nueva de `public` (comprobado en `pg_default_acl` de producción el
-- 14-oct-2026: `arwdDxtm` en tablas, `rwU` en secuencias). Sin esto el banco
-- es más ESTRICTO que la plataforma y los asertos de privilegios de
-- 01_schema_smoke.sql pasan en local siendo falsos en producción (F-192).
--
-- ⚠ No se puede añadir sin 0065: con esto solo, los asertos de 0028, 0034 y
-- 0035 fallan — que es justo lo que F-192 midió.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select, update on sequences to anon, authenticated, service_role;
