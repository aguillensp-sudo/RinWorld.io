-- =============================================================================
-- 0071 · Privilegios mínimos en `public` (F-192)
-- =============================================================================
-- Propuesta preparada el 14-oct-2026 en `supabase/propuestas/F-192/` (allí era 0065; está en git) y
-- revisada otra vez contra el catálogo de producción el 20-oct-2026, antes de aplicarla. Aprobada
-- por el PO el 20-oct-2026 junto con F-275 y F-272. Lo que cambió desde el 14-oct, y va aquí:
--   · Producción es Postgres 17, que tiene un octavo privilegio de tabla, `MAINTAIN` (VACUUM,
--     ANALYZE, REINDEX…): las DEFAULT PRIVILEGES lo dan a `anon` y `authenticated` y la propuesta
--     no lo quitaba (el banco es Postgres 16 y no lo conoce). Se quita con SQL dinámico, solo
--     donde exista.
--   · Tres funciones de `public` se ejecutaban por `anon` a través de PUBLIC (`=X` en `proacl`):
--     `billing_confirm_payment`, `billing_suspend_organization` y `forum_rate_limit_status`.
--     Las dos de billing exigen Operador de Plataforma dentro, y la tercera no devuelve nada sin
--     sesión, pero la regla es que ninguna función de `public` la ejecuta `anon`.
--   · Las tablas nuevas desde el 14-oct (`key_recovery_attempts`, `vera_usage`) ya nacieron
--     cerradas a mano; `0070` deja el SELECT de `forum_posts`/`forum_threads` por columna.
--
-- QUÉ HACE. Supabase concede ALL a `anon` y `authenticated` sobre cada tabla nueva de `public`
-- (DEFAULT PRIVILEGES). Hasta aquí solo protegía la RLS. Esto deja cada rol con lo que sus
-- políticas usan y nada más.
--
-- POR QUÉ NO CAMBIA LO QUE LA APP PUEDE HACER (catálogo de producción, 20-oct-2026):
--   1. Ninguna política de `public` se aplica a `anon` ni a `public`: todo lo de `anon` en tablas
--      ya lo negaba la RLS. Se quita entero.
--   2. Para `authenticated`, se quita solo el verbo que ninguna política suya usa. Sin política, la
--      RLS ya lo niega: el privilegio está muerto.
--   3. Los triggers que escriben en OTRA tabla son SECURITY DEFINER (`sync_favorite_count`,
--      `touch_forum_thread`, `init_billing_account`, `log_registration_request_state`,
--      `sync_thread_state`, `touch_thread_last_item`): no dependen de los privilegios del que llama.
--   4. Las seis vistas son `security_invoker=true` y la app solo las lee.
--   5. TRUNCATE, REFERENCES, TRIGGER y MAINTAIN no los usa nadie desde el cliente, y TRUNCATE es el
--      único verbo que la RLS no filtra.
--   6. Las dos secuencias (`*_events_id_seq`) solo las usan triggers DEFINER.
--   `service_role` no se toca: las Edge Functions lo necesitan entero.
--
-- LO QUE SÍ CAMBIA: una tabla NUEVA ya no nace abierta. Su migración tiene que conceder a
-- `authenticated` lo que sus políticas usan, como se hizo a mano en `0035`. Si se olvida, el cliente
-- recibe `permission denied` (falla cerrado) y lo caza la suite e2e; y
-- `06_privilegios_asserts.sql` caza el caso contrario.
--
-- Las columnas: `members` lleva concesiones POR COLUMNA (SELECT sin `encrypted_key_blob`/`key_iv`/
-- `key_verifier`, UPDATE solo de `public_key`), y desde `0070` también `forum_posts`/`forum_threads`
-- (SELECT sin `author_member_id`). No se tocan: aquí solo se revocan verbos que no las tienen.
--
-- Escrito por Claude Code.
-- =============================================================================

-- 1 · anon: nada en ninguna tabla, vista ni secuencia de public.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon, authenticated;

-- 2 · authenticated: fuera los verbos que nadie usa, en todo.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- MAINTAIN solo existe desde Postgres 17 (producción); en el banco (16) la sintaxis no se reconoce.
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end
$$;

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

-- [select (por columnas), insert] Foro: los mensajes no se editan ni se borran.
revoke update, delete on public.forum_posts   from authenticated;
revoke update, delete on public.forum_threads from authenticated;

-- [select (por columnas), update (public_key)] Nadie se da de alta ni se borra desde el cliente:
-- eso va por RPC SECURITY DEFINER o por Edge Function.
revoke insert, delete on public.members from authenticated;

-- [select, update]
revoke insert, delete on public.organizations         from authenticated;
revoke insert, delete on public.registration_requests from authenticated;

-- [select, insert] Las claves envueltas no se reescriben.
revoke update, delete on public.thread_item_keys from authenticated;

-- [select, insert, update] Los hilos y sus elementos no se borran.
revoke delete on public.thread_items from authenticated;
revoke delete on public.threads      from authenticated;

-- Sin cambios porque ya eran mínimas: inventory_lines e inventory_exclusions (política ALL),
-- watchers, forum_reactions, ingest_*, inventory_import_profiles, member_invitations,
-- organization_internal, access_tokens, key_recovery_attempts, vera_usage y las vistas
-- forum_post_detail, forum_thread_list, member_invitation_list y watcher_list.

-- 4 · Ninguna función de public la ejecuta anon (las tres que quedaban abiertas por PUBLIC).
revoke execute on function public.billing_confirm_payment(uuid, date, text) from public, anon;
revoke execute on function public.billing_suspend_organization(uuid)        from public, anon;
revoke execute on function public.forum_rate_limit_status()                 from public, anon;
grant  execute on function public.billing_confirm_payment(uuid, date, text) to authenticated, service_role;
grant  execute on function public.billing_suspend_organization(uuid)        to authenticated, service_role;
grant  execute on function public.forum_rate_limit_status()                 to authenticated, service_role;

-- 5 · Las tablas nuevas ya no nacen abiertas.
--     Solo se pueden cambiar las del rol que ejecuta las migraciones (postgres); las de
--     `supabase_admin` no son nuestras y no crean tablas de la app.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
