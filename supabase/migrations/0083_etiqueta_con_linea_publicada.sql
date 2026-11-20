-- =============================================================================
-- 0083 · Etiquetar un mensaje con una línea publicada de la otra empresa
-- =============================================================================
-- Decisión del PO del 20-nov-2026 (`DECISIONES-V1.md`): `Contactar` desde Comprando abre el hilo con la
-- etiqueta de la línea marcada, también cuando esa referencia todavía no tiene consulta ni oferta en el
-- hilo, y también en el primer mensaje cuando no hay hilo. Amplía la regla de `0080`.
--
-- Una etiqueta vale si la referencia (part_number y marca exactos):
--   a) está en una CONSULTA u OFERTA del hilo (0080), o
--   b) ya etiqueta otro MENSAJE del hilo, para que la otra parte pueda contestar con la misma aunque la
--      línea deje de estar publicada, o
--   c) es una línea PUBLICADA de la otra empresa del hilo (la de enfrente de quien envía).
-- La propia empresa no etiqueta con su inventario: la regla es la del PO, «una línea publicada de la
-- otra empresa». Lo que no cambia: los dos campos o ninguno (`thread_items_shape_chk`) y que la etiqueta
-- no se cambia desde la app.
--
-- `open_thread` (0056) acepta la etiqueta del primer mensaje, `default null`, como `create_thread_item`
-- en `0081`. Se borra la firma de cuatro argumentos para que quede una sola.
--
-- Pruebas: `supabase/tests/14_etiqueta_linea_publicada.sql` (y `12_etiqueta_mensaje.sql` sigue en verde).
-- Escrita a mano por Claude Code.
-- =============================================================================

create or replace function app.validate_message_tag()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare
  otra uuid;
begin
  if new.item_type <> 'MENSAJE' or new.part_number is null then
    return new;
  end if;

  -- a) y b): la referencia ya está en el hilo, en una consulta, una oferta u otro mensaje.
  if exists (
    select 1 from public.thread_items c
     where c.thread_id = new.thread_id
       and c.id is distinct from new.id
       and c.part_number = new.part_number
       and c.brand = new.brand
  ) then
    return new;
  end if;

  -- c): una línea publicada de la otra empresa del hilo.
  select case when t.org_low_id = new.sender_org_id then t.org_high_id else t.org_low_id end
    into otra
    from public.threads t
   where t.id = new.thread_id;

  if exists (
    select 1 from public.inventory_lines l
     where l.org_id = otra
       and l.status = 'PUBLISHED'
       and l.part_number = new.part_number
       and l.brand = new.brand
  ) then
    return new;
  end if;

  raise exception
    'La etiqueta de un mensaje tiene que ser una referencia de este hilo o una línea publicada de la otra empresa: % · % no es ninguna de las dos (hilo %).',
    new.part_number, new.brand, new.thread_id;
end;
$function$;

revoke execute on function app.validate_message_tag() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- open_thread con etiqueta en el primer mensaje. Igual que 0056 salvo los dos parámetros nuevos.
-- -----------------------------------------------------------------------------
drop function if exists public.open_thread(uuid, text, text, jsonb);

create function public.open_thread(
  p_org_id      uuid,
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
  t_low  uuid;
  t_high uuid;
  t_id   uuid;
  nuevo  uuid;
begin
  if p_org_id is null then
    raise exception 'Falta la organización con la que contactar.';
  end if;

  if p_org_id = app.current_org_id() then
    raise exception 'No puedes abrir un hilo con tu propia organización.';
  end if;

  if not exists (
    select 1 from public.organizations o
     where o.id = p_org_id and o.status = 'APPROVED'
  ) then
    raise exception 'Esa organización no existe o no está disponible.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  perform app.guard_cek_recipients(app.current_org_id(), p_org_id, p_keys, null);

  t_low  := least(app.current_org_id(), p_org_id);
  t_high := greatest(app.current_org_id(), p_org_id);

  t_id := app.resolve_thread(t_low, t_high);

  nuevo := gen_random_uuid();      -- F-148, 0023 §4bis

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     content_ciphertext, content_iv, part_number, brand)
  values
    (nuevo, t_id, app.current_org_id(), auth.uid(), 'MENSAJE',
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'), p_part_number, p_brand);

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nuevo,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  return t_id;
end;
$function$;

revoke execute on function public.open_thread(uuid, text, text, jsonb, text, text) from public, anon;
grant  execute on function public.open_thread(uuid, text, text, jsonb, text, text) to authenticated;
