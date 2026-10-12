-- =============================================================================
-- 0060 · F-249 · la segunda consulta sobre la misma línea se bloquea SOLO si la primera sigue pendiente
-- =============================================================================
-- Decisión del PO, 12-oct-2026: se sigue la `MSG-03` aprobada (§3.2 y §6: «Si ya existe una consulta
-- PENDIENTE para la misma línea con el mismo distribuidor»), no la lectura de `0003`, que bloqueaba
-- para siempre con el índice `thread_items_one_inquiry_per_line_uniq`.
--
-- Qué cambia:
--   1. El índice único pasa a ser parcial: `estado_consulta = 'Pendiente'`. Tras una respuesta
--      (`Respondida con oferta`) o un `Sin stock` el comprador puede volver a consultar la línea.
--   2. `app.org_already_inquired` (0026) se sustituye por `app.org_has_pending_inquiry`: mismo patrón
--      (`security definer`, un booleano, ninguna fila) y el nombre dice lo que hace. Sigue siendo
--      `security definer` por F-156: un EDITOR sin clave en la consulta previa no la ve bajo RLS y el
--      guardia se saltaría en silencio.
--   3. `create_inquiry` usa el helper nuevo y el mensaje de la spec. Nada más cambia.
--
-- El índice es la guardia de verdad (dos envíos a la vez no pasan los dos); el helper existe para dar
-- el mensaje de la spec en vez de la violación cruda del índice.
--
-- Es aditiva para el cliente que hay desplegado: relaja un bloqueo, no añade ninguno, y el cliente
-- actual sigue descartando por su cuenta las filas ya consultadas.
-- =============================================================================

drop index if exists public.thread_items_one_inquiry_per_line_uniq;

create unique index thread_items_one_pending_inquiry_per_line_uniq
  on public.thread_items (inventory_line_id, sender_org_id)
  where item_type = 'CONSULTA' and estado_consulta = 'Pendiente' and inventory_line_id is not null;

create or replace function app.org_has_pending_inquiry(p_line uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.thread_items
     where item_type = 'CONSULTA'
       and estado_consulta = 'Pendiente'
       and inventory_line_id = p_line
       and sender_org_id = p_org
  );
$$;

revoke execute on function app.org_has_pending_inquiry(uuid, uuid) from public, anon;
grant  execute on function app.org_has_pending_inquiry(uuid, uuid) to authenticated;

comment on function app.org_has_pending_inquiry(uuid, uuid) is
  'F-249 (0060, sustituye a org_already_inquired de F-156): si mi organizacion tiene una consulta PENDIENTE sobre esta linea, para el guardia de create_inquiry. security definer a proposito, por la razon de F-156: bajo thread_items_select_participant (0019) un EDITOR sin clave envuelta en la consulta previa no la veria y el guardia se saltaria en silencio. Devuelve un booleano, nunca una fila de thread_items.';

create or replace function public.create_inquiry(
  p_line_id    uuid,
  p_ciphertext text,
  p_iv         text,
  p_keys       jsonb,
  p_quantity   integer default null
)
returns table (thread_id uuid, item_id uuid)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  linea  record;
  t_low  uuid;
  t_high uuid;
  t_id   uuid;
  nuevo  uuid;
begin
  select id, org_id, part_number, brand into linea
    from public.inventory_lines
   where id = p_line_id and status = 'PUBLISHED';

  if not found then
    raise exception 'Esta línea de inventario ya no está publicada o no existe.';
  end if;

  if linea.org_id = app.current_org_id() then
    raise exception 'No puedes consultar tu propio inventario.';
  end if;

  if app.org_has_pending_inquiry(linea.id, app.current_org_id()) then   -- F-249
    raise exception 'Ya tienes una consulta pendiente para esta referencia con este distribuidor.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'La cantidad de la consulta no puede ser negativa.';
  end if;

  -- p_thread_id NULL a proposito: el hilo todavia no existe en este punto
  -- (se resuelve DESPUES, con app.resolve_thread). Sin cambios desde 0024.
  perform app.guard_cek_recipients(app.current_org_id(), linea.org_id, p_keys, null);

  t_low  := least(app.current_org_id(), linea.org_id);
  t_high := greatest(app.current_org_id(), linea.org_id);

  -- Buscar-o-crear el hilo fuera de la politica de lectura (F-148, 0023 §4bis).
  t_id := app.resolve_thread(t_low, t_high);

  nuevo := gen_random_uuid();

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, inventory_line_id, estado_consulta, quantity,
     content_ciphertext, content_iv)
  values
    (nuevo, t_id, app.current_org_id(), auth.uid(), 'CONSULTA',
     linea.part_number, linea.brand, linea.id, 'Pendiente', p_quantity,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'));

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nuevo,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  return query select t_id, nuevo;
end;
$$;

revoke execute on function public.create_inquiry(uuid, text, text, jsonb, integer) from public, anon;
grant  execute on function public.create_inquiry(uuid, text, text, jsonb, integer) to authenticated, service_role;

-- Nadie más lo llama (comprobado en el repo antes de escribir esta migración).
drop function app.org_already_inquired(uuid, uuid);
