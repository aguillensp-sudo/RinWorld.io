-- =============================================================================
-- 0019 · Lista de hilos: ambito de visibilidad por organizacion y por elemento
-- =============================================================================
-- Fuente de verdad: docs/ADR-002_Ambito_de_visibilidad_por_usuario.md §3 (D-1,
-- D-2, D-7, D-8) y §5, filas "Lista de hilos" y `thread_items_select_
-- participant`.
--
-- Lo que trae esta migracion:
--
--  1. `organizations.visibility_scope_enabled` (D-7): el interruptor por
--     organizacion, apagado por defecto -- "todos ven todo" sigue siendo el
--     comportamiento hasta que el ADMIN de esa organizacion lo enciende. NO
--     esta en el §5 de ADR-002 -- ese cuadro lista los siete objetos que el
--     ADR ya tenia identificados el 25-ago, y este interruptor es un octavo
--     que faltaba: sin el, `visibility_scope` (0018) habria quedado
--     encendido para el 100% de las organizaciones el dia que esta
--     migracion tocara `threads_select_participant`, que es exactamente lo
--     que D-7 prohibe. Ver adenda del 3-sep-2026 en el propio ADR.
--
--  2. `threads_select_participant` reescrita (D-1/D-8): con el ambito
--     encendido, un miembro OWN ve un hilo si tiene AL MENOS UN elemento con
--     clave envuelta en el (D-1); un miembro ORG_METADATA ve todos los
--     hilos de su organizacion sin ser destinatario de ninguna clave (D-2).
--     Con el ambito apagado, sigue el criterio de hoy (pertenencia a la
--     organizacion), sin excepcion.
--
--  3. `thread_items_select_participant` reescrita con el MISMO criterio pero
--     a nivel de ELEMENTO, no de hilo -- necesario para que el invariante
--     V-6 se sostenga: si solo se acotara la lista de hilos, un OWN podria
--     seguir leyendo los elementos de un companero de organizacion
--     consultando `thread_items` directamente en cuanto el hilo (compartido
--     entre conversaciones independientes, ADR-002 §6) apareciera en su
--     lista por tener UN elemento propio.
--
-- Lo que esta migracion NO toca, a proposito: `app.can_access_thread()`
-- sigue gobernando el INSERT (`thread_items_insert_own`) y
-- `thread_public_keys()` (0012). Acotar esa funcion por ambito romperia el
-- primer mensaje de una conversacion nueva dentro de un hilo compartido
-- (ADR-002 §6): quien escribe por primera vez todavia no tiene ninguna
-- clave envuelta, y exigirsela para poder ESCRIBIR seria circular.
-- `thread_public_keys(t_id)` (a quien envolver una CEK nueva) y
-- `create_inquiry` (reparto de destinatarios) son las otras dos filas rojas
-- de ADR-002 §5 -- quedan para la siguiente pieza, no esta.
-- =============================================================================

alter table public.organizations
  add column visibility_scope_enabled boolean not null default false;

comment on column public.organizations.visibility_scope_enabled is
  'ADR-002 D-7: interruptor del ambito de visibilidad por usuario, apagado por defecto (todos los miembros ven todo hasta que el ADMIN de la organizacion lo activa). No es uno de los siete objetos de ADR-002 §5 -- ver adenda del 3-sep-2026 en el propio ADR.';

-- El ADMIN de la propia organizacion lo activa: organizations_update_
-- visibility_admin (0002) ya cubre esta fila -- `id = current_org_id() and
-- is_org_admin()`, sin restriccion de columna. Solo falta NO bloquearla en
-- el guard: se extiende la lista de columnas de operador, no se reduce.
create or replace function app.guard_organization_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;
  if new.name   is distinct from old.name
  or new.legal_name is distinct from old.legal_name
  or new.country is distinct from old.country
  or new.continent is distinct from old.continent
  or new.status is distinct from old.status
  or new.favorite_count is distinct from old.favorite_count then
    raise exception 'Desde el cliente solo se cambia inventory_visibility_mode y visibility_scope_enabled; el resto es del operador o derivado';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- app.caller_bypasses_visibility_scope() -- true si NO hace falta comprobar
-- clave envuelta: o bien la organizacion del que llama no encendio el
-- ambito (D-7), o bien el que llama es ORG_METADATA (D-2, hoy soldado al
-- rol ADMIN, 0018). En cualquiera de los dos casos ve el plano completo.
-- -----------------------------------------------------------------------------
create or replace function app.caller_bypasses_visibility_scope()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    not coalesce(
      (select o.visibility_scope_enabled from public.organizations o
        where o.id = app.current_org_id()), false)
    or (select m.visibility_scope from public.members m
         where m.id = auth.uid()) = 'ORG_METADATA';
$$;

revoke execute on function app.caller_bypasses_visibility_scope() from public;
grant  execute on function app.caller_bypasses_visibility_scope() to authenticated;

-- -----------------------------------------------------------------------------
-- threads_select_participant (ADR-002 §5, "Lista de hilos") -- deja de ser
-- consulta directa a `threads` por pertenencia a la organizacion; se deriva
-- de `thread_item_keys` cuando el ambito esta encendido (D-1), en la
-- direccion que filtra primero (indice `thread_item_keys_recipient_item_idx`
-- de 0017: `recipient_member_id, item_id`).
-- -----------------------------------------------------------------------------
alter policy threads_select_participant on public.threads
  using (
    app.current_org_id() in (org_low_id, org_high_id)
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

-- -----------------------------------------------------------------------------
-- thread_items_select_participant -- mismo criterio, a nivel de ELEMENTO:
-- D-1 dice "el ambito es por ELEMENTO, no por hilo".
-- -----------------------------------------------------------------------------
alter policy thread_items_select_participant on public.thread_items
  using (
    app.can_access_thread(thread_id)
    and (
      app.caller_bypasses_visibility_scope()
      or exists (
        select 1 from public.thread_item_keys tik
        where tik.item_id = thread_items.id
          and tik.recipient_member_id = auth.uid()
      )
    )
  );
