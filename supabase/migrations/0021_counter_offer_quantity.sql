-- =============================================================================
-- 0021 · quantity en OFERTA (ADR-002 D-3, la mitad que 0020 dejo a proposito)
-- =============================================================================
-- Fuente de verdad: docs/ADR-002_Ambito_de_visibilidad_por_usuario.md §3 D-3 y
--                   §5 (fila `thread_items`), y ESTADO-V1.md §3.4 del 3-sep-2026.
--
-- 0020 saco `quantity` a metadato en claro y la conecto SOLO en `create_inquiry`
-- (CONSULTA). Su propia cabecera dejo escrito por que: "`create_thread_item` y
-- `counter_offer` no la conocen todavia -- exigir la columna para OFERTA hoy les
-- rompería el INSERT". Esta migracion cierra esa mitad.
--
-- -----------------------------------------------------------------------------
-- 1 · POR QUE SOLO SE TOCA `counter_offer`, Y NO `create_thread_item`
-- -----------------------------------------------------------------------------
-- El relevo hablaba de "las dos vias de OFERTA". Comprobado contra el codigo
-- antes de escribir nada, son una:
--
--   · `create_thread_item` (0012:185) RECHAZA `item_type = 'OFERTA'` con una
--     excepcion explicita -- "OFERTA es MSG-03", fuera del MVP. Lo unico que
--     crea es `MENSAJE`, y un MENSAJE tiene `quantity is null` OBLIGATORIO por
--     `thread_items_shape_chk` (0020:45). Anadirle un `p_quantity` seria un
--     parametro que la funcion tendria que rechazar siempre. No se toca.
--
--   · `counter_offer` (0013) es hoy la UNICA funcion que inserta una fila
--     `OFERTA`. Es la que lo necesita, y es la que cambia aqui.
--
-- Queda dicho para que nadie busque manana el cambio de `create_thread_item`:
-- no falta, es que no lo lleva. La oferta directa sin oferta anterior (MSG-03)
-- sigue sin funcion que la cree -- cuando exista, nace con `p_quantity`.
--
-- -----------------------------------------------------------------------------
-- 2 · POR QUE `quantity` NO SE HEREDA DE LA OFERTA ANTERIOR
-- -----------------------------------------------------------------------------
-- `counter_offer` hereda `part_number`, `brand` y `responds_to_item_id` de la
-- oferta anterior (0013:101-105), y la tentacion es heredar tambien la cantidad
-- cuando el llamador no la mande. **Se decide que no, y es lo contrario de un
-- descuido.**
--
-- `part_number` y `brand` se heredan porque `offer-card` dice que NO son
-- editables sin un cambio explicito de referencia: heredarlos es copiar un dato
-- que no puede haber cambiado. La cantidad si puede: contraofertar 300 unidades
-- sobre una oferta de 500 es exactamente el caso de uso, y esa cifra vive
-- cifrada en `OfferContent.quantity` (app/src/lib/thread-detail.ts), donde este
-- lado no la puede leer.
--
-- O sea que heredar significaria: si un llamador viejo no manda `p_quantity`,
-- escribir en el plano EN CLARO una cantidad que el ciphertext puede desmentir.
-- Un ADMIN leyendo D-2 veria 500 donde la oferta dice 300, sin nada que avisara.
-- Es F-010 con otra ropa -- el fichero de maquina que decia `cost_usd: 0.0`
-- porque rellenar un hueco con algo parecido salia mas barato que dejarlo
-- vacio. **NULL dice "no se sabe"; 500 dice una mentira comprobable.**
--
-- Por eso `default null` sin herencia: el llamador de ayer sigue funcionando y
-- guarda NULL, igual que hace `create_inquiry` desde 0020.
--
-- -----------------------------------------------------------------------------
-- 3 · POR QUE `thread_items_shape_chk` NO PASA A EXIGIRLA EN `OFERTA`
-- -----------------------------------------------------------------------------
-- Mismo motivo que en 0020, y ahora con datos: las filas `OFERTA` que ya existen
-- --las de la siembra de demostracion y las del historial de pruebas-- tienen
-- `quantity` a NULL, y no hay forma de rellenarlas sin descifrar su contenido,
-- que es justamente lo que este lado no puede hacer. Un `check` que exigiera la
-- columna no dejaria aplicar la migracion. La columna queda nullable y quien la
-- lee tiene que saber que un NULL significa "esta oferta es anterior a D-3".
-- =============================================================================

-- `create or replace` NO sustituye la firma de 4 parametros: para Postgres es
-- otra funcion, y las dos convivirian dejando ambigua la llamada de siempre
-- ("function is not unique"). Mismo paso que 0020:68 con `create_inquiry`.
drop function if exists public.counter_offer(uuid, text, text, jsonb);

create or replace function public.counter_offer(
  p_old_item_id uuid,
  p_ciphertext  text,
  p_iv          text,
  p_keys        jsonb,
  p_quantity    integer default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  anterior public.thread_items%rowtype;
  nueva    uuid;
begin
  select * into anterior
    from public.thread_items
   where id = p_old_item_id
     for update;

  if not found then
    raise exception 'La oferta sobre la que se contraoferta no existe o no es visible.';
  end if;

  if anterior.item_type <> 'OFERTA' then
    raise exception 'Solo se puede contraofertar sobre una tarjeta de oferta (offer-card).';
  end if;

  if anterior.estado_oferta <> 'Pendiente' then
    raise exception
      'La oferta ya no esta Pendiente (estado actual: %). No se puede contraofertar sobre un estado terminal.',
      anterior.estado_oferta;
  end if;

  if anterior.sender_org_id = app.current_org_id() then
    raise exception
      'Una oferta la decide quien la recibe (offer-card): no puedes contraofertar tu propia oferta.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  -- Mismo guardia que `create_inquiry` (0020:116). `thread_items_quantity_chk`
  -- ya lo impediria, pero con el mensaje generico de una violacion de check: el
  -- socio de enfrente merece leer que la cantidad no puede ser negativa, no un
  -- nombre de restriccion.
  if p_quantity is not null and p_quantity < 0 then
    raise exception 'La cantidad de la contraoferta no puede ser negativa.';
  end if;

  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, estado_oferta, responds_to_item_id, quantity,
     content_ciphertext, content_iv)
  values
    (anterior.thread_id, app.current_org_id(), auth.uid(), 'OFERTA',
     anterior.part_number, anterior.brand, 'Pendiente', anterior.responds_to_item_id,
     p_quantity,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'))
  returning id into nueva;

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nueva,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  update public.thread_items
     set estado_oferta = 'Superada por contraoferta',
         superseded_by_item_id = nueva
   where id = anterior.id;

  return nueva;
end;
$$;

revoke execute on function public.counter_offer(uuid, text, text, jsonb, integer) from public;
grant  execute on function public.counter_offer(uuid, text, text, jsonb, integer) to authenticated;

comment on function public.counter_offer(uuid, text, text, jsonb, integer) is
  'Contraoferta: crea una OFERTA nueva Pendiente y marca la anterior como Superada por contraoferta, en una transaccion. security invoker: no concede ningun permiso que RLS no diera ya. Solo el receptor de la oferta Pendiente puede llamarla. p_quantity (ADR-002 D-3, 0021) es la cantidad en claro; default null y SIN heredar de la oferta anterior -- una contraoferta puede cambiar la cantidad, y copiar la vieja escribiria en claro una cifra que el ciphertext desmiente.';

comment on column public.thread_items.quantity is
  'ADR-002 D-3: cantidad en claro (antes solo vivia en content_ciphertext). La rellenan create_inquiry (CONSULTA, 0020) y counter_offer (OFERTA, 0021). NULL en las filas anteriores a D-3 y en las que llegan de un llamador que todavia no la manda: no se infiere de nada.';
