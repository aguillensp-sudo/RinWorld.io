-- =============================================================================
-- 0081 · `create_thread_item` acepta la etiqueta de referencia del mensaje
-- =============================================================================
-- Change `amend-msg-hilos-pestanas-y-etiqueta`, `design.md` §1. Complementa `0080`.
--
-- La app envía los mensajes por `create_thread_item` (0012 §5: el elemento y sus claves en
-- la misma transacción), no con un `insert` directo. Sin esto, `0080` permitía la etiqueta
-- en la base pero ningún mensaje podía nacer con ella.
--
-- Dos parámetros nuevos al final, con `default null`: la llamada de cinco argumentos de
-- hoy sigue resolviendo y guarda conversación general, exactamente lo de antes.
-- La validación de la etiqueta no se repite aquí: la hace `app.validate_message_tag()`
-- (0080) en el `insert`, para esta vía y para cualquier otra.
--
-- Mismo cuerpo que `0025` salvo las dos columnas del `insert`. Sigue siendo
-- `security invoker`: está en la superficie auditada de F-155 (`01_schema_smoke.sql`), y
-- lo que lee lo lee por `app.thread_counterpart` y `app.guard_cek_recipients`, como antes.
--
-- `drop` de la firma de cinco: `create or replace` con otra lista de tipos crea una
-- función distinta, y con las dos a la vez la llamada de cinco sería ambigua (mismo caso
-- que 0020 con `create_inquiry`).
-- =============================================================================

drop function if exists public.create_thread_item(uuid, text, text, text, jsonb);

create function public.create_thread_item(
  p_thread_id   uuid,
  p_item_type   text,
  p_ciphertext  text,
  p_iv          text,
  p_keys        jsonb,
  p_part_number text default null,
  p_brand       text default null
)
  returns uuid
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
declare
  nuevo uuid;
  otra  uuid;
begin
  if p_item_type is distinct from 'MENSAJE' then
    raise exception
      'create_thread_item solo crea MENSAJE en el MVP (D-08-02). CONSULTA llega con el envio de SRCH-01 y OFERTA es MSG-03.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  otra := app.thread_counterpart(p_thread_id);   -- F-155

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys, p_thread_id);

  -- El id ANTES de insertar, y sin `returning` (F-148, 0023 §4bis).
  nuevo := gen_random_uuid();

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv,
     part_number, brand)
  values
    (nuevo, p_thread_id, app.current_org_id(), auth.uid(), p_item_type,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'),
     p_part_number, p_brand);

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nuevo,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  return nuevo;
end;
$function$;

revoke execute on function public.create_thread_item(uuid, text, text, text, jsonb, text, text) from public, anon;
grant  execute on function public.create_thread_item(uuid, text, text, text, jsonb, text, text) to authenticated;
