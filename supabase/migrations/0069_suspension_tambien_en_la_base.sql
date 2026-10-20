-- =============================================================================
-- 0069 · La suspensión de una organización se aplica también en la base (F-275)
-- =============================================================================
-- Hasta aquí, `organizations.status = 'SUSPENDED'` solo lo miraban el cliente (la pantalla de
-- suspensión, `Suspended.tsx`) y el `!inner` con `organizations` de la búsqueda. Comprobado contra
-- el catálogo de producción el 20-oct-2026:
--
--   1. `app.visible_inventory_owner_ids()` (0064) no mira `organizations.status`: fuera de la
--      búsqueda (API directa, `fetchOrgLines` en el selector del hilo) el inventario PUBLISHED de
--      una suspendida se lee.
--   2. `app.is_active_member()` y `app.is_org_admin()` solo miran `members.state`: un miembro de
--      una suspendida conserva por la API todo lo que la RLS da a un miembro activo.
--   3. Las vistas del foro (`security_invoker`) cruzan con `organizations` por `LEFT JOIN`: lo
--      publicado por una suspendida sigue visible, como pide `community-forum/active-account-access#2`,
--      pero sin nombre ni país de la organización autora, que la spec pide «siempre».
--
-- Arreglo, aprobado por el PO el 20-oct-2026 junto con F-272 y F-192:
--
--   1. El inventario ajeno solo se ve de organizaciones `APPROVED` (la propia sigue entrando, pero
--      `inventory_select_cross_org` ya la excluye y `inventory_select_own` pide miembro activo).
--   2. «Miembro activo» y «administrador» exigen además la organización `APPROVED`. Como TODA la
--      RLS de `public` pasa por estas dos funciones, un miembro de una suspendida se queda sin
--      leer ni escribir nada de la plataforma por la API. Lo que la pantalla de suspensión necesita
--      sigue abierto: la propia fila de `members` (`id = auth.uid()`) y la propia organización
--      (`id = app.current_org_id()`), que no pasan por estas funciones.
--   3. El nombre y el país de la organización autora del foro salen de `app.forum_author_org()`,
--      `SECURITY DEFINER`: solo para un miembro activo y solo de organizaciones que han publicado en
--      el foro (no es un directorio de suspendidas).
--
-- NO se borra ni se toca ningún dato (`automatic-suspension#3`): al reactivar (`billing_confirm_payment`
-- devuelve `APPROVED`) todo vuelve tal cual, porque solo cambian las funciones que lo filtran.
-- El Operador de Plataforma no tiene fila en `members`: no le afecta. Las funciones de billing
-- (`billing_suspend_organization`, `billing_confirm_payment`) son `SECURITY DEFINER` y no pasan por aquí.
--
-- Escrito por Claude Code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · El inventario de una organización no APPROVED no lo ve nadie de fuera
-- -----------------------------------------------------------------------------
create or replace function app.visible_inventory_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select o.id, o.country, o.continent
      from public.organizations o
     where o.id = app.current_org_id()
  )
  select o.id
    from public.organizations o
    cross join viewer v
   where o.id = v.id
      or (o.status = 'APPROVED'
          and (o.inventory_visibility_mode = 'VISIBLE_TODOS'
               or not exists (
                 select 1
                   from public.inventory_exclusions e
                  where e.owner_org_id = o.id
                    and (e.excluded_org_id = v.id
                      or e.excluded_country = v.country
                      or e.excluded_continent = v.continent)
               )));
$$;

-- La versión por fila (0002) ya no la usa ninguna política (0064), pero el banco la compara con la de
-- conjunto para cada espectador: se le da la misma regla, para que las dos sigan diciendo lo mismo.
create or replace function app.can_view_inventory_of(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select o.id, o.country, o.continent
    from public.organizations o
    where o.id = app.current_org_id()
  )
  select
    case
      when (select id from viewer) is null then false
      when owner = (select id from viewer) then true
      when (select status from public.organizations where id = owner) is distinct from 'APPROVED' then false
      when (select inventory_visibility_mode from public.organizations where id = owner)
           = 'VISIBLE_TODOS' then true
      else not exists (
        select 1
        from public.inventory_exclusions e, viewer v
        where e.owner_org_id = owner
          and (
            e.excluded_org_id    = v.id
         or e.excluded_country   = v.country
         or e.excluded_continent = v.continent
          )
      )
    end;
$$;

-- -----------------------------------------------------------------------------
-- 2 · Miembro activo y administrador, solo de una organización APPROVED
-- -----------------------------------------------------------------------------
create or replace function app.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.members m
      join public.organizations o on o.id = m.org_id
     where m.id = auth.uid() and m.state = 'ACTIVE' and o.status = 'APPROVED'
  );
$$;

create or replace function app.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.members m
      join public.organizations o on o.id = m.org_id
     where m.id = auth.uid() and m.state = 'ACTIVE' and m.role = 'ADMIN' and o.status = 'APPROVED'
  );
$$;

-- `create or replace` conserva los privilegios; se repiten para que el fichero diga lo que hay (F-146).
revoke execute on function app.visible_inventory_owner_ids() from public, anon;
revoke execute on function app.is_active_member()            from public, anon;
revoke execute on function app.is_org_admin()                from public, anon;
grant  execute on function app.visible_inventory_owner_ids() to authenticated;
grant  execute on function app.is_active_member()            to authenticated;
grant  execute on function app.is_org_admin()                to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · El foro enseña siempre la organización autora, también si está suspendida
-- -----------------------------------------------------------------------------
create or replace function app.forum_author_org(p_org_id uuid)
returns table (name text, country text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.name::text, o.country::text
    from public.organizations o
   where o.id = p_org_id
     and app.is_active_member()
     and (exists (select 1 from public.forum_threads t where t.author_org_id = o.id)
       or exists (select 1 from public.forum_posts   p where p.author_org_id = o.id));
$$;

revoke execute on function app.forum_author_org(uuid) from public, anon;
grant  execute on function app.forum_author_org(uuid) to authenticated;

-- Mismas columnas, en el mismo orden; `forum_thread_list` gana dos al final (la categoría), para que
-- «Hilos recientes» lea de aquí y no cruce él mismo con `organizations` (F-275, punto 3).
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
         count(r.member_id)                       as reaction_count,
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
         a.name                                         as author_org_name,
         a.country                                      as author_org_country,
         p.body,
         p.created_at,
         count(r.member_id)                              as reaction_count,
         coalesce(bool_or(r.member_id = auth.uid()), false) as reacted_by_me
    from public.forum_posts     p
    left join lateral app.forum_author_org(p.author_org_id) a on true
    left join public.forum_reactions r on r.post_id = p.id
   group by p.id, p.thread_id, p.author_org_id, a.name, a.country, p.body, p.created_at;

comment on view public.forum_thread_list is
  'FORO-02 y «Hilos recientes»: hilos con respuestas (publicaciones menos la inicial), reacciones totales del hilo y su categoría. La organización autora sale de app.forum_author_org (también si está suspendida, F-275). security_invoker: respeta la RLS de quien consulta.';
comment on view public.forum_post_detail is
  'FORO-03: cada publicacion de un hilo con su organizacion autora (app.forum_author_org, también si está suspendida, F-275), pais, reacciones DE ESA publicacion y si quien consulta ya reacciono. security_invoker: respeta la RLS de quien consulta.';
