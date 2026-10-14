-- =============================================================================
-- 0064 · La visibilidad del inventario ajeno se calcula UNA vez por consulta (F-253)
-- =============================================================================
-- `inventory_select_cross_org` llamaba a `app.can_view_inventory_of(org_id)` por cada fila
-- de `inventory_lines`. Es `SECURITY DEFINER` y no se inlina, así que costaba ~115 µs por
-- fila ajena. Medido en producción el 14-oct-2026 con 23.966 líneas PUBLISHED: una búsqueda
-- cruzada (`ref ilike '%6205%'`, `order by quantity desc limit 50`) tarda 3,1 s con el rol
-- `authenticated`, y el tope de sus consultas es de 8 s: un segundo catálogo del tamaño del
-- de JULSA las pasaría a error 500. Medido en local con 1 millón de líneas: ~115 s.
--
-- Arreglo: `app.visible_inventory_owner_ids()` devuelve el conjunto de organizaciones cuyo
-- inventario ve el espectador, en una sola pasada sobre `organizations`, y la política
-- pregunta `org_id in (select …)`: un *semi-join* con ese conjunto, calculado una vez.
-- Medido en local con 1 millón de líneas: de ~115 s a 0,5–2,2 s. Sigue siendo un recorrido
-- de la tabla (escala en lineal); lo que lo baja a milisegundos es una RPC de búsqueda, que
-- queda en `BACKLOG-V1.md` con su disparador.
--
-- **No cambia la semántica.** Las reglas son las de `app.can_view_inventory_of` (0002):
-- sin organización del espectador, nadie; la propia, sí; `VISIBLE_TODOS`, sí; en otro caso,
-- sí salvo que haya una exclusión por organización, país o continente del espectador. El banco
-- de esquema compara las dos para todos los espectadores de una fixture que cubre cada rama.
-- `app.can_view_inventory_of` se queda, sin uso en políticas.
-- =============================================================================

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
      or o.inventory_visibility_mode = 'VISIBLE_TODOS'
      or not exists (
        select 1
          from public.inventory_exclusions e
         where e.owner_org_id = o.id
           and (e.excluded_org_id = v.id
             or e.excluded_country = v.country
             or e.excluded_continent = v.continent)
      );
$$;

-- F-146: los privilegios por defecto de Supabase se lo darían a `anon`; se revoca explícitamente.
revoke execute on function app.visible_inventory_owner_ids() from public, anon;
grant  execute on function app.visible_inventory_owner_ids() to authenticated;

alter policy inventory_select_cross_org on public.inventory_lines
  using (
    status = 'PUBLISHED'
    and org_id <> (select app.current_org_id())
    and (select app.is_active_member())
    and org_id in (select app.visible_inventory_owner_ids())
  );
