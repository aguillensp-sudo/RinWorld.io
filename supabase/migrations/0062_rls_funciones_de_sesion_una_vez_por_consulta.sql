-- =============================================================================
-- 0062 · Las 31 políticas que quedaban evalúan sus funciones de sesión UNA vez por
--        consulta (F-234, cierre)
-- =============================================================================
-- Misma causa y mismo arreglo que `0047` (inventario) y `0051` (mensajería):
-- `app.current_org_id()`, `app.is_active_member()`, `app.is_org_admin()`,
-- `app.is_platform_operator()` y `auth.uid()` son `STABLE`, y las de `app` además
-- `SECURITY DEFINER`, que Postgres no inlina. A pelo en la política se llaman por cada
-- fila; envueltas en `(select …)` son un *InitPlan* que se evalúa una vez.
--
-- Son las 31 de la auditoría de `F-234` (7-oct-2026, 39 políticas menos las 8 de `0051`),
-- contadas otra vez contra `pg_policies` de producción el 14-oct-2026: 31 en 18 tablas.
-- Texto de partida: el de `pg_policies`, tal cual.
--
-- **No cambia la semántica.** Una función `STABLE` devuelve lo mismo dentro de una
-- sentencia. `alter policy` conserva roles, comando y permisividad. Lo que depende de la
-- fila (`app.can_view_inventory_of(org_id)`…) no se tocó: aquí no hay ninguno.
--
-- **No se ha medido la ganancia**: no hay volumen para que duela. Lo medido es que no
-- cambia lo que ve nadie: el banco de esquema entero y el chequeo nuevo del catálogo, que
-- además cierra la puerta a futuras políticas con una función de sesión a pelo.
-- =============================================================================

-- billing_* (solo el Operador de Plataforma)
alter policy billing_accounts_select_operator on public.billing_accounts
  using ((select app.is_platform_operator()));
alter policy billing_payments_select_operator on public.billing_payments
  using ((select app.is_platform_operator()));
alter policy billing_status_events_select_operator on public.billing_status_events
  using ((select app.is_platform_operator()));

-- favorite_distributors
alter policy favorites_delete_own on public.favorite_distributors
  using (member_id = (select auth.uid()));
alter policy favorites_insert_own on public.favorite_distributors
  with check ((member_id = (select auth.uid())) and (select app.is_active_member()));
alter policy favorites_select_own on public.favorite_distributors
  using ((member_id = (select auth.uid())) and (select app.is_active_member()));

-- forum_*
alter policy forum_categories_select_member on public.forum_categories
  using ((select app.is_active_member()));
alter policy forum_posts_insert_member on public.forum_posts
  with check ((select app.is_active_member()) and (author_member_id = (select auth.uid())) and (author_org_id = (select app.current_org_id())));
alter policy forum_posts_select_member on public.forum_posts
  using ((select app.is_active_member()));
alter policy forum_reactions_delete_own on public.forum_reactions
  using (member_id = (select auth.uid()));
alter policy forum_reactions_insert_own on public.forum_reactions
  with check ((select app.is_active_member()) and (member_id = (select auth.uid())));
alter policy forum_reactions_select_member on public.forum_reactions
  using ((select app.is_active_member()));
alter policy forum_threads_insert_member on public.forum_threads
  with check ((select app.is_active_member()) and (author_member_id = (select auth.uid())) and (author_org_id = (select app.current_org_id())));
alter policy forum_threads_select_member on public.forum_threads
  using ((select app.is_active_member()));

-- inventory_exclusions · inventory_import_profiles
alter policy exclusions_select_own on public.inventory_exclusions
  using ((owner_org_id = (select app.current_org_id())) and (select app.is_active_member()));
alter policy exclusions_write_admin on public.inventory_exclusions
  using ((owner_org_id = (select app.current_org_id())) and (select app.is_org_admin()))
  with check ((owner_org_id = (select app.current_org_id())) and (select app.is_org_admin()));
alter policy inventory_import_profiles_select_own on public.inventory_import_profiles
  using ((org_id = (select app.current_org_id())) and (select app.is_active_member()));

-- member_invitations · members · organization_internal · organizations
alter policy member_invitations_select_admin on public.member_invitations
  using ((org_id = (select app.current_org_id())) and (select app.is_org_admin()));
alter policy members_select_own_org on public.members
  using ((id = (select auth.uid())) or ((org_id = (select app.current_org_id())) and (select app.is_active_member())));
alter policy members_update_self on public.members
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
alter policy organization_internal_select_admin on public.organization_internal
  using ((org_id = (select app.current_org_id())) and (select app.is_org_admin()));
alter policy organizations_select_approved on public.organizations
  using ((status = 'APPROVED'::text) or (id = (select app.current_org_id())));
alter policy organizations_select_operator on public.organizations
  using ((select app.is_platform_operator()));
alter policy organizations_update_visibility_admin on public.organizations
  using ((id = (select app.current_org_id())) and (select app.is_org_admin()))
  with check ((id = (select app.current_org_id())) and (select app.is_org_admin()));

-- platform_operators · registration_* (solo el Operador de Plataforma)
alter policy platform_operators_select_operator on public.platform_operators
  using ((select app.is_platform_operator()));
alter policy registration_request_events_select_operator on public.registration_request_events
  using ((select app.is_platform_operator()));
alter policy registration_requests_select_operator on public.registration_requests
  using ((select app.is_platform_operator()));
alter policy registration_requests_update_operator on public.registration_requests
  using ((select app.is_platform_operator()))
  with check ((select app.is_platform_operator()));

-- watchers
alter policy watchers_delete_org on public.watchers
  using ((select app.is_active_member()) and (org_id = (select app.current_org_id())));
alter policy watchers_insert_org on public.watchers
  with check ((select app.is_active_member()) and (org_id = (select app.current_org_id())) and (created_by = (select auth.uid())));
alter policy watchers_select_org on public.watchers
  using ((select app.is_active_member()) and (org_id = (select app.current_org_id())));
