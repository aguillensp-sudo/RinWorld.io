-- =============================================================================
-- 0033 · Foro: detalle de publicaciones de un hilo (FORO-03)
-- =============================================================================
--
-- Capa de datos de FORO-03 (Vista de un Hilo), escrita a mano ANTES de la
-- tarea, mismo patrón que `0030` para FORO-02 (`UMBRAL-FABRICA-V1.md` §7).
--
-- QUÉ PINTA LA PANTALLA POR PUBLICACIÓN (spec §3): organización autora + país,
-- timestamp, contenido, y un botón `👍 X` que el propio usuario puede pulsar
-- para reaccionar o quitar su reacción -- el contador es el de ESA
-- publicación, no el total del hilo como en `forum_thread_list` (FORO-02).
-- Hace falta saber, además, si QUIEN CONSULTA ya reaccionó, para pintar el
-- botón en su estado -- eso solo lo puede calcular una vista `security_invoker`
-- que mire `auth.uid()`, nunca el cliente.
--
-- LO QUE ESTA VISTA NO CUBRE, a propósito: `Editar`/`Eliminar` (spec §3, §6).
-- `0029` no tiene ninguna política de `UPDATE` ni `DELETE` en `forum_posts` --
-- "más fácil añadirlas el día que se decida que retirar las que se hayan
-- puesto de más" (comentario original de `0029`). Esa decisión no se toma
-- aquí: la pantalla pinta esos dos controles apagados, con su motivo, solo en
-- las publicaciones de la propia organización (igual que "Crear hilo" en
-- FORO-02).
-- =============================================================================

create view public.forum_post_detail
with (security_invoker = true) as
  select p.id,
         p.thread_id,
         p.author_org_id,
         o.name                                        as author_org_name,
         o.country                                      as author_org_country,
         p.body,
         p.created_at,
         count(r.member_id)                              as reaction_count,
         coalesce(bool_or(r.member_id = auth.uid()), false) as reacted_by_me
    from public.forum_posts     p
    left join public.organizations   o on o.id = p.author_org_id
    left join public.forum_reactions r on r.post_id = p.id
   group by p.id, p.thread_id, p.author_org_id, o.name, o.country, p.body, p.created_at;

comment on view public.forum_post_detail is
  'FORO-03: cada publicacion de un hilo con su organizacion autora, pais, reacciones DE ESA publicacion (no del hilo) y si quien consulta ya reacciono. security_invoker: respeta la RLS de quien consulta, como forum_thread_list.';

revoke all on public.forum_post_detail from anon, authenticated;
grant select on public.forum_post_detail to authenticated, service_role;
