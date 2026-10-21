-- =============================================================================
-- 0072 · Quién reaccionó en el foro deja de leerse por la API (F-276)
-- =============================================================================
-- Mismo patrón que `F-272` (`0070`), en otra tabla. `forum_reactions` daba SELECT de tabla
-- entera a `authenticated` (0030) y `forum_reactions_select_member` deja leerla a cualquier
-- miembro activo: otra organización leía `member_id`, el uuid de la persona que reaccionó. No
-- se resolvía a una persona (`members` no se lee fuera de la propia organización), pero
-- correlacionaba las reacciones de una misma persona.
--
-- Arreglo (propuesto en F-276, aprobado por el PO el 21-oct-2026 «siguiendo el mismo
-- razonamiento» que F-272): el SELECT de la tabla pasa a ser por columna, SOLO `post_id`.
--   · Los recuentos no cambian: las vistas cuentan filas (`count(r.post_id)`), no personas, y la
--     política de SELECT sigue igual (cualquier miembro activo ve que hay N reacciones).
--   · `reacted_by_me` ya no puede compararse en la vista (`security_invoker`, pedía leer
--     `member_id`): lo da `app.forum_reacted_by_me(post_id)`, `SECURITY DEFINER`, que solo
--     responde por quien llama. No revela nada de otra persona.
--   · Reaccionar no depende de la columna: el INSERT es privilegio de tabla, la firma la pone
--     `app.guard_forum_reactor` y la política la comprueba en su `with check`; las expresiones de
--     una política no piden privilegio de columna a quien consulta.
--   · Quitar la propia reacción tampoco: el cliente borra con `post_id` (que sí se lee) y la
--     política `forum_reactions_delete_own` limita a `member_id = auth.uid()`.
--   · `service_role` no se toca.
--
-- Las tres políticas se reescriben con sus funciones de sesión en `(select …)` (0062): en
-- `bearingworld-e2e` seguían a pelo el 21-oct-2026 (pg_policies), y así las dos bases quedan
-- iguales en esta tabla. Misma semántica.
--
-- Con SELECT de tabla, los de columna no restringen nada: primero se quita el de tabla.
-- Escrito por Claude Code.
-- =============================================================================

create or replace function app.forum_reacted_by_me(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.forum_reactions r
     where r.post_id = p_post_id
       and r.member_id = (select auth.uid())
  );
$$;

comment on function app.forum_reacted_by_me(uuid) is
  'FORO-03 (F-276): si QUIEN LLAMA ha reaccionado a la publicación. SECURITY DEFINER porque authenticated ya no lee forum_reactions.member_id; solo responde por auth.uid(), nunca por otra persona.';

revoke execute on function app.forum_reacted_by_me(uuid) from public, anon;
grant  execute on function app.forum_reacted_by_me(uuid) to authenticated;

-- Mismas columnas, mismos tipos y mismo orden que 0069: solo cambia de dónde salen.
create or replace view public.forum_thread_list
with (security_invoker = true) as
  select t.id,
         t.category_id,
         t.title,
         t.author_org_id,
         a.name                                   as author_org_name,
         t.created_at,
         t.last_post_at,
         greatest(count(distinct p.id) - 1, 0)    as reply_count,
         count(r.post_id)                         as reaction_count,
         c.slug                                   as category_slug,
         c.name                                   as category_name
    from public.forum_threads t
    left join lateral app.forum_author_org(t.author_org_id) a on true
    left join public.forum_categories c on c.id = t.category_id
    left join public.forum_posts     p on p.thread_id = t.id
    left join public.forum_reactions r on r.post_id = p.id
   group by t.id, t.category_id, t.title, t.author_org_id, a.name, t.created_at, t.last_post_at, c.slug, c.name;

create or replace view public.forum_post_detail
with (security_invoker = true) as
  select p.id,
         p.thread_id,
         p.author_org_id,
         a.name                                   as author_org_name,
         a.country                                as author_org_country,
         p.body,
         p.created_at,
         count(r.post_id)                         as reaction_count,
         app.forum_reacted_by_me(p.id)            as reacted_by_me
    from public.forum_posts     p
    left join lateral app.forum_author_org(p.author_org_id) a on true
    left join public.forum_reactions r on r.post_id = p.id
   group by p.id, p.thread_id, p.author_org_id, a.name, a.country, p.body, p.created_at;

alter policy forum_reactions_delete_own on public.forum_reactions
  using (member_id = (select auth.uid()));
alter policy forum_reactions_insert_own on public.forum_reactions
  with check ((select app.is_active_member()) and (member_id = (select auth.uid())));
alter policy forum_reactions_select_member on public.forum_reactions
  using ((select app.is_active_member()));

revoke select on public.forum_reactions from authenticated;
grant  select (post_id) on public.forum_reactions to authenticated;
