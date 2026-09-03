-- =============================================================================
-- 0020 · thread_items.quantity (ADR-002 D-3)
-- =============================================================================
-- Fuente de verdad: docs/ADR-002_Ambito_de_visibilidad_por_usuario.md §3 D-3,
-- §5 (impacto en el esquema, fila `thread_items` + columna `quantity`).
--
-- Hoy la cantidad de una CONSULTA solo vive dentro de `content_ciphertext`
-- (comentario de 0003:119-121: "la cantidad de la consulta... TODAS las
-- cifras de la oferta"). D-3 la saca a metadato en claro: el ADMIN de la
-- organizacion la ve sin ser destinatario criptografico (D-2) y VERA puede
-- responder sobre ella (D-6) -- "no es lo mismo preguntar 15 unidades del
-- 6205 que preguntar por 20.000".
--
-- ALCANCE DE HOY, A PROPOSITO: solo `create_inquiry` (CONSULTA). `OFERTA`
-- tambien tiene una cantidad de negocio (ver `OfferContent.quantity` en
-- app/src/lib/thread-detail.ts) y en algun momento querra la misma columna,
-- pero `create_thread_item` y `counter_offer` no la conocen todavia -- exigir
-- la columna para OFERTA hoy les rompería el INSERT. Por eso `quantity` no
-- entra en `thread_items_shape_chk` como obligatoria para CONSULTA ni para
-- OFERTA: solo se prohibe expresamente en MENSAJE, igual que el resto de
-- metadatos de tarjeta. `create_inquiry` es la unica pieza declarada en el
-- relevo de hoy (ESTADO-V1.md §3.3); dejar OFERTA sin tocar es del mismo
-- tamaño exacto de lo pedido, ni mas ni menos.
-- =============================================================================

alter table public.thread_items
  add column quantity integer;

alter table public.thread_items
  add constraint thread_items_quantity_chk check (quantity is null or quantity >= 0);

comment on column public.thread_items.quantity is
  'ADR-002 D-3: cantidad en claro (antes solo vivia en content_ciphertext). Hoy solo la rellena create_inquiry (CONSULTA); OFERTA sigue pendiente -- ver 0020.';

-- Extiende la forma por tipo (0003) para que MENSAJE la siga prohibiendo,
-- igual que el resto de metadatos de tarjeta. CONSULTA y OFERTA quedan sin
-- restriccion sobre esta columna a proposito: solo CONSULTA la rellena hoy.
alter table public.thread_items drop constraint thread_items_shape_chk;
alter table public.thread_items add constraint thread_items_shape_chk check (
  case item_type
    when 'MENSAJE' then
      part_number is null and brand is null and inventory_line_id is null
      and estado_consulta is null and estado_oferta is null
      and responds_to_item_id is null and superseded_by_item_id is null
      and quantity is null
    when 'CONSULTA' then
      part_number is not null and brand is not null
      and estado_consulta is not null and estado_oferta is null
      and responds_to_item_id is null and superseded_by_item_id is null
    when 'OFERTA' then
      part_number is not null and brand is not null
      and estado_oferta is not null and estado_consulta is null
      and inventory_line_id is null
    else false
  end
);

-- -----------------------------------------------------------------------------
-- create_inquiry (0014) · nuevo parametro con default, no rompe al llamador
-- que todavia no lo manda -- guarda NULL, exactamente el estado de hoy.
--
-- `create or replace function` NO sustituye la version de 4 parametros: para
-- Postgres es una firma distinta (una tupla de tipos distinta), asi que sin
-- el `drop` de abajo se quedarian las DOS a la vez -- y una llamada con solo
-- los 4 parametros de siempre pasaria a ser ambigua ("function is not
-- unique") en vez de resolver al default nuevo.
-- -----------------------------------------------------------------------------
drop function if exists public.create_inquiry(uuid, text, text, jsonb);

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

  if exists (
    select 1 from public.thread_items
     where item_type = 'CONSULTA'
       and inventory_line_id = linea.id
       and sender_org_id = app.current_org_id()
  ) then
    raise exception 'Ya has consultado esta referencia con este distribuidor.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'La cantidad de la consulta no puede ser negativa.';
  end if;

  t_low  := least(app.current_org_id(), linea.org_id);
  t_high := greatest(app.current_org_id(), linea.org_id);

  select id into t_id from public.threads
   where org_low_id = t_low and org_high_id = t_high;

  if t_id is null then
    insert into public.threads (org_low_id, org_high_id, created_by_org_id)
    values (t_low, t_high, app.current_org_id())
    on conflict (org_low_id, org_high_id) do nothing
    returning id into t_id;

    if t_id is null then
      select id into t_id from public.threads
       where org_low_id = t_low and org_high_id = t_high;
    end if;
  end if;

  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, inventory_line_id, estado_consulta, quantity,
     content_ciphertext, content_iv)
  values
    (t_id, app.current_org_id(), auth.uid(), 'CONSULTA',
     linea.part_number, linea.brand, linea.id, 'Pendiente', p_quantity,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'))
  returning id into nuevo;

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

revoke execute on function public.create_inquiry(uuid, text, text, jsonb, integer) from public;
grant  execute on function public.create_inquiry(uuid, text, text, jsonb, integer) to authenticated;

comment on function public.create_inquiry(uuid, text, text, jsonb, integer) is
  'GAP-004: encuentra o crea el hilo con el distribuidor de la linea y deposita la tarjeta de CONSULTA y sus claves, en una transaccion. part_number/brand/organizacion salen de inventory_lines, nunca del parametro. p_quantity (ADR-002 D-3, 0020) es la cantidad en claro; default null para no romper a un llamador que aun no la mande. security invoker: no concede ningun permiso que RLS no diera ya.';
