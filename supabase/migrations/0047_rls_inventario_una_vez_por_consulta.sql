-- =============================================================================
-- 0047 · Las políticas de `inventory_lines` evalúan sus funciones UNA vez por
--        consulta, no una vez por fila (F-234)
-- =============================================================================
-- `INV-01` dejó de cargar el inventario de Rodamientos Ibéricos tras la
-- importación real del PO del 6-oct (18 302 líneas): la API tardaba 6–11 s y a
-- veces devolvía 500 por el `statement_timeout` de 8 s de `authenticated`.
--
-- `app.current_org_id()` y `app.is_active_member()` son `STABLE` y `SECURITY
-- DEFINER`, y una `SECURITY DEFINER` no se inlina: escritas a pelo en la
-- política, Postgres las llama por cada fila. Envueltas en `(select …)` pasan a
-- ser un *InitPlan*: se evalúan una vez y el resultado se reutiliza. Medido en
-- producción como `authenticated` (transacción deshecha), 18 303 filas:
-- 494 ms → 33 ms.
--
-- **No cambia la semántica.** Una función `STABLE` devuelve lo mismo dentro de
-- una sentencia; llamarla una vez o 18 303 da el mismo resultado.
-- `app.can_view_inventory_of(org_id)` depende de la fila y se queda como está.
--
-- Mismo texto que `0002` (`inventory_select_cross_org`, `inventory_write_own`)
-- y `0039` (`inventory_select_own`); solo cambian los envoltorios.
-- =============================================================================

alter policy inventory_select_own on public.inventory_lines
  using (org_id = (select app.current_org_id()) and (select app.is_active_member()));

alter policy inventory_select_cross_org on public.inventory_lines
  using (
    status = 'PUBLISHED'
    and org_id <> (select app.current_org_id())
    and (select app.is_active_member())
    and app.can_view_inventory_of(org_id)
  );

alter policy inventory_write_own on public.inventory_lines
  using (org_id = (select app.current_org_id()) and (select app.is_active_member()))
  with check (org_id = (select app.current_org_id()) and (select app.is_active_member()));
