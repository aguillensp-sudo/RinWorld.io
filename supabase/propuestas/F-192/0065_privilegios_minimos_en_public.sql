-- =============================================================================
-- 0065 · Privilegios mínimos en `public` (F-192) — PROPUESTA, NO APLICADA
-- =============================================================================
-- ⚠ Este fichero NO está en `supabase/migrations/` a propósito. F-192 es un
-- riesgo aceptado por el PO (25-sep-2026) que se reabre «antes de datos reales
-- o de abrir el registro a terceros». Cuando llegue ese disparador: se renumera
-- con el siguiente número libre, se mueve a `migrations/` junto con el cambio del
-- stub (`stub_privilegios_de_tablas.sql`) y el aserto `06_privilegios_asserts.sql`,
-- se aplica por el MCP a `bearingworld-e2e` primero y a producción después.
-- Pasos en `README.md`.
--
-- QUÉ HACE. Supabase concede ALL a `anon` y `authenticated` sobre cada tabla
-- nueva de `public` (DEFAULT PRIVILEGES). Hoy solo protege la RLS. Esto deja
-- cada rol con lo que sus políticas usan y nada más.
--
-- POR QUÉ NO CAMBIA LO QUE LA APP PUEDE HACER (comprobado contra el catálogo de
-- producción el 14-oct-2026, `pg_policies`, `pg_trigger`, `pg_class.reloptions`):
--   1. Ninguna política de `public` se aplica a `anon` ni a `public`: todo lo de
--      `anon` en tablas ya lo niega la RLS. Se quita entero.
--   2. Para `authenticated`, se quita solo el verbo que ninguna política suya
--      usa. Sin política, la RLS ya lo niega: el privilegio está muerto.
--   3. Todos los triggers que escriben en OTRA tabla son SECURITY DEFINER
--      (`sync_favorite_count`, `touch_forum_thread`, `init_billing_account`,
--      `log_registration_request_state`, `sync_thread_state`,
--      `touch_thread_last_item`): no dependen de los privilegios del que llama.
--   4. Las seis vistas son `security_invoker=true` y la app solo las lee.
--   5. TRUNCATE, REFERENCES y TRIGGER no los usa nadie desde el cliente, y
--      TRUNCATE es el único verbo que la RLS no filtra.
--   6. Las dos secuencias (`*_events_id_seq`) solo las usan triggers DEFINER.
--   `service_role` no se toca: las Edge Functions lo necesitan entero.
--
-- LO QUE SÍ CAMBIA: una tabla NUEVA ya no nace abierta. Su migración tiene que
-- conceder a `authenticated` lo que sus políticas usan, como se hizo a mano en
-- `0035`. Si se olvida, el cliente recibe `permission denied` (falla cerrado) y
-- lo caza la suite e2e; y `06_privilegios_asserts.sql` caza el caso contrario.
--
-- Las columnas: `members` lleva concesiones POR COLUMNA (SELECT sin
-- `encrypted_key_blob`/`key_iv`/`key_verifier`, UPDATE solo de `public_key`) y
-- no se tocan. Revocar un verbo a nivel de tabla quita también sus concesiones
-- por columna, así que en `members` solo se revocan verbos que no las tienen.
-- =============================================================================

-- 1 · anon: nada en ninguna tabla, vista ni secuencia de public.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon, authenticated;

-- 2 · authenticated: fuera los tres verbos que nadie usa, en todo.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 3 · authenticated: fuera los verbos sin política, tabla a tabla.
--     Entre corchetes, lo que queda (= las políticas de cada tabla).

-- [select] Solo lectura: cobros, categorías del foro, operadores, historial.
revoke insert, update, delete on public.billing_accounts            from authenticated;
revoke insert, update, delete on public.billing_payments            from authenticated;
revoke insert, update, delete on public.billing_status_events       from authenticated;
revoke insert, update, delete on public.forum_categories            from authenticated;
revoke insert, update, delete on public.platform_operators          from authenticated;
revoke insert, update, delete on public.registration_request_events from authenticated;

-- [select] Vistas (security_invoker): la app solo las lee.
revoke insert, update, delete on public.billing_org_status          from authenticated;
revoke insert, update, delete on public.forum_category_stats        from authenticated;

-- [select, insert, delete]
revoke update on public.favorite_distributors from authenticated;

-- [select, insert] Foro: los mensajes no se editan ni se borran.
revoke update, delete on public.forum_posts   from authenticated;
revoke update, delete on public.forum_threads from authenticated;

-- [select (por columnas), update (public_key)] Nadie se da de alta ni se borra
-- desde el cliente: eso va por RPC SECURITY DEFINER o por Edge Function.
revoke insert, delete on public.members from authenticated;

-- [select, update]
revoke insert, delete on public.organizations         from authenticated;
revoke insert, delete on public.registration_requests from authenticated;

-- [select, insert] Las claves envueltas no se reescriben.
revoke update, delete on public.thread_item_keys from authenticated;

-- [select, insert, update] Los hilos y sus elementos no se borran.
revoke delete on public.thread_items from authenticated;
revoke delete on public.threads      from authenticated;

-- Sin cambios porque ya eran mínimas: inventory_lines e inventory_exclusions
-- (política ALL), watchers, forum_reactions, ingest_*, inventory_import_profiles,
-- member_invitations, organization_internal, access_tokens,
-- key_recovery_attempts y las vistas forum_post_detail, forum_thread_list,
-- member_invitation_list y watcher_list.

-- 4 · Las tablas nuevas ya no nacen abiertas.
--     Solo se pueden cambiar las del rol que ejecuta las migraciones (postgres);
--     las de `supabase_admin` no son nuestras y no crean tablas de la app.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
