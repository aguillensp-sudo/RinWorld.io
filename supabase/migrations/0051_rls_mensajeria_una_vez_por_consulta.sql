-- =============================================================================
-- 0051 · Las políticas de `threads`, `thread_items` y `thread_item_keys`
--        evalúan sus funciones de sesión UNA vez por consulta (F-234)
-- =============================================================================
-- Misma causa y mismo arreglo que `0047` (inventario): `app.current_org_id()`,
-- `app.is_active_member()` y `app.caller_bypasses_visibility_scope()` son `STABLE` y
-- `SECURITY DEFINER`, y una `SECURITY DEFINER` no se inlina. Escritas a pelo en la
-- política, Postgres las llama por cada fila; envueltas en `(select …)` son un
-- *InitPlan* que se evalúa una vez. Lo mismo vale para `auth.uid()`.
--
-- Son las tres tablas de la auditoría de `F-234` (7-oct-2026) que crecen con el uso: cada
-- mensaje, consulta y oferta es una fila en `thread_items` y una por destinatario en
-- `thread_item_keys`, y `threads_select_participant` y `thread_items_select_participant`
-- llevan además un `EXISTS` sobre `thread_item_keys`.
--
-- **No cambia la semántica.** Una función `STABLE` devuelve lo mismo dentro de una
-- sentencia: llamarla una vez o N veces da el mismo resultado. Se conservan roles, comando
-- y permisividad (`alter policy` no los toca). Lo que depende de la fila
-- (`app.can_access_thread(thread_id)`, `app.is_item_sender(item_id)`) se queda como estaba.
--
-- **No se ha medido la ganancia en estas tablas**: no hay volumen para que duela (en
-- `inventory_lines`, 18 303 filas, fue de 494 ms a 33 ms). Lo medido aquí es que el
-- comportamiento no cambia: el banco de esquema entero y un chequeo del catálogo.
-- Texto de las políticas: `0003`/`0012`/`0017`/`0020`… tal como están en `pg_policies`.
-- =============================================================================

-- threads
alter policy threads_insert_participant on public.threads
  with check (
    (select app.is_active_member())
    and created_by_org_id = (select app.current_org_id())
    and ((select app.current_org_id()) = org_low_id or (select app.current_org_id()) = org_high_id)
  );

alter policy threads_select_participant on public.threads
  using (
    (select app.is_active_member())
    and ((select app.current_org_id()) = org_low_id or (select app.current_org_id()) = org_high_id)
    and (
      (select app.caller_bypasses_visibility_scope())
      or exists (
        select 1
          from public.thread_item_keys tik
          join public.thread_items ti on ti.id = tik.item_id
         where ti.thread_id = threads.id
           and tik.recipient_member_id = (select auth.uid())
      )
    )
  );

alter policy threads_update_participant on public.threads
  using (
    ((select app.current_org_id()) = org_low_id or (select app.current_org_id()) = org_high_id)
    and (select app.is_active_member())
  )
  with check (
    (select app.current_org_id()) = org_low_id or (select app.current_org_id()) = org_high_id
  );

-- thread_items
alter policy thread_items_insert_own on public.thread_items
  with check (
    (select app.is_active_member())
    and sender_member_id = (select auth.uid())
    and sender_org_id = (select app.current_org_id())
    and app.can_access_thread(thread_id)
  );

alter policy thread_items_select_participant on public.thread_items
  using (
    (select app.is_active_member())
    and app.can_access_thread(thread_id)
    and (
      (select app.caller_bypasses_visibility_scope())
      or exists (
        select 1
          from public.thread_item_keys tik
         where tik.item_id = thread_items.id
           and tik.recipient_member_id = (select auth.uid())
      )
    )
  );

alter policy thread_items_update_participant on public.thread_items
  using (app.can_access_thread(thread_id) and (select app.is_active_member()))
  with check (app.can_access_thread(thread_id));

-- thread_item_keys
alter policy item_keys_insert_sender on public.thread_item_keys
  with check ((select app.is_active_member()) and app.is_item_sender(item_id));

alter policy item_keys_select_own on public.thread_item_keys
  using (recipient_member_id = (select auth.uid()) and (select app.is_active_member()));
