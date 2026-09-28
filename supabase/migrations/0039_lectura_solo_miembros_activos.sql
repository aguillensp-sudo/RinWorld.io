-- =============================================================================
-- 0039 · La lectura de los datos de una organización exige ser miembro ACTIVE (F-222)
-- =============================================================================
-- **Lo que se creía y no era cierto.** `0037` y `0038` daban por hecho que «toda la RLS
-- pasa por `app.is_active_member()`», así que un miembro revocado (`CANCELLED`) o aún
-- sin activar (`REGISTERED`) no leería nada. El test de `0037` medía la FUNCIÓN
-- (`not app.is_active_member()`), no la lectura. El 28-sep el PO entró con la cuenta
-- que había creado `FRU` (EDITOR `REGISTERED`) y vio `PANEL-01` con datos reales de su
-- organización. Medido suplantando su sesión: 15 líneas de inventario, 2 exclusiones,
-- 2 miembros, 5 hilos y 5 elementos de hilo.
--
-- **La causa**, leída del catálogo (`pg_policies`, F-146) y no de los `.sql`: siete
-- políticas `SELECT` filtran por organización o por «soy el destinatario» y no llaman a
-- `app.is_active_member()`. Las de ESCRITURA sí exigen `ACTIVE` (`is_org_admin`,
-- `is_active_member`) o son solo sobre la propia fila.
--
-- **Por qué importa más allá de `REGISTERED`.** `user-revocation` deja al revocado con
-- su clave y sus claves envueltas (`thread_item_keys`): con una sesión aún viva —el
-- token de acceso dura hasta una hora y el ban de `F-214` solo impide renovarlo—
-- podía leer y descifrar su historial. `F-214` cerró el login, no la lectura.
--
-- **Qué hace esta migración.** `ALTER POLICY` sobre las siete, sin cambiar sus nombres
-- ni lo que ya filtraban: solo antepone `app.is_active_member()`.
--
-- **La excepción, y es deliberada: la propia fila de `members`.** `session.ts` la lee
-- al entrar para saber quién es el miembro y en qué estado está: un `KEY_ACTIVE` la
-- necesita para ver REG-09, y un `CANCELLED` para que la app le diga *acceso revocado*
-- en vez de un shell vacío. La lectura de las DEMÁS filas de su organización sí exige
-- `ACTIVE`. `organizations` no se toca: su lectura es el directorio público de las
-- organizaciones aprobadas, más la propia.
-- =============================================================================

-- Mi propia fila, siempre; las de mi organización, solo si soy ACTIVE.
alter policy members_select_own_org on public.members
  using (
    id = auth.uid()
    or (org_id = app.current_org_id() and app.is_active_member())
  );

alter policy inventory_select_own on public.inventory_lines
  using (org_id = app.current_org_id() and app.is_active_member());

alter policy exclusions_select_own on public.inventory_exclusions
  using (owner_org_id = app.current_org_id() and app.is_active_member());

alter policy favorites_select_own on public.favorite_distributors
  using (member_id = auth.uid() and app.is_active_member());

alter policy item_keys_select_own on public.thread_item_keys
  using (recipient_member_id = auth.uid() and app.is_active_member());

alter policy threads_select_participant on public.threads
  using (
    app.is_active_member()
    and (app.current_org_id() = org_low_id or app.current_org_id() = org_high_id)
    and (
      app.caller_bypasses_visibility_scope()
      or exists (
        select 1
          from public.thread_item_keys tik
          join public.thread_items ti on ti.id = tik.item_id
         where ti.thread_id = threads.id
           and tik.recipient_member_id = auth.uid()
      )
    )
  );

alter policy thread_items_select_participant on public.thread_items
  using (
    app.is_active_member()
    and app.can_access_thread(thread_id)
    and (
      app.caller_bypasses_visibility_scope()
      or exists (
        select 1
          from public.thread_item_keys tik
         where tik.item_id = thread_items.id
           and tik.recipient_member_id = auth.uid()
      )
    )
  );
