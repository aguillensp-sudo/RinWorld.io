-- =============================================================================
-- 0070 · El uuid de la persona autora del foro deja de leerse por la API (F-272)
-- =============================================================================
-- `community-forum/thread-and-reply-creation#3`: la base guarda qué usuario escribió cada
-- publicación, y esa información de persona «nunca se muestra a otros miembros». Las vistas del
-- foro no la exponen, pero `forum_posts` y `forum_threads` daban SELECT de tabla entera a
-- `authenticated` (0029) y `*_select_member` deja leerlas a cualquier miembro activo: otra
-- organización leía `author_member_id` por la API. No se resolvía a una persona (`members` no se
-- lee fuera de la propia organización), pero correlacionaba las publicaciones de una misma persona.
--
-- Arreglo (propuesto en F-272, aprobado por el PO el 20-oct-2026 junto con F-275 y F-192): el
-- SELECT de esas dos tablas pasa a ser por columna, sin `author_member_id`.
--   · El cliente nunca la pide (`forum.parciales.test.ts` lo fija).
--   · El INSERT no depende de ella: la política `*_insert_member` la comprueba en su `with check`,
--     y las expresiones de una política no piden privilegio de columna a quien inserta.
--   · Las vistas (`security_invoker`) no la seleccionan.
--   · `service_role` y los triggers `SECURITY DEFINER` (`touch_forum_thread`) no se tocan.
--
-- Con SELECT de tabla, los de columna no restringen nada: primero se quita el de tabla.
-- Escrito por Claude Code.
-- =============================================================================

revoke select on public.forum_posts   from authenticated;
revoke select on public.forum_threads from authenticated;

grant select (id, thread_id, author_org_id, body, created_at)
  on public.forum_posts to authenticated;
grant select (id, category_id, title, author_org_id, created_at, last_post_at)
  on public.forum_threads to authenticated;
