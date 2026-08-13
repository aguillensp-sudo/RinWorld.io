-- =============================================================================
-- 0013 · Contraoferta: fila nueva y supersesión, en una sola transacción
-- =============================================================================
-- Fuente de verdad: openspec/specs/messaging-and-negotiation/spec.md · offer-card,
--                   escenario "contraoferta marca la anterior como superada"
--                   Plan §3, fila del día 10 — "Contraoferta / modificación de oferta"
--
-- QUÉ HACE Y POR QUÉ NO SON DOS ESCRITURAS DESDE EL NAVEGADOR.
--
-- `offers.ts` lo dejó anotado desde el día 6: la contraoferta no es un cambio de
-- estado, es una fila OFERTA nueva que nace Pendiente, más la anterior movida a
-- "Superada por contraoferta" con `superseded_by_item_id` apuntando a la nueva.
-- `thread_items_superseded_coherent_chk` (0003) obliga a que esas dos cosas sean
-- ciertas a la vez. Si el navegador hiciera el insert y el update por separado,
-- una caída de red entre los dos dejaría una oferta Pendiente sin sustituir y una
-- nueva sin la anterior enlazada — o peor, dos ofertas Pendiente vivas a la vez,
-- que `thread_items_pending_offers_idx` no impide por sí solo. Mismo patrón que
-- `create_thread_item` (0012 §5): una función, una transacción, o las dos cosas o
-- ninguna.
--
-- POR QUÉ NO REUTILIZA `create_thread_item`.
--
-- Esa función crea el elemento y sus claves, pero rechaza explícitamente
-- `item_type = 'OFERTA'` (0012:185) porque el día 8 no había forma de crear una
-- oferta desde ningún sitio. Aquí sí la hay, pero acotada: esta función NO sirve
-- para "Crear oferta" (MSG-03, sigue fuera del MVP) porque exige una oferta
-- Pendiente previa sobre la que responder. Una oferta directa sin consulta ni
-- oferta anterior sigue sin tener función que la cree.
--
-- SEGURIDAD: LAS MISMAS TRES CAPAS QUE EL RESTO DEL ESQUEMA.
--
-- `security invoker`, sin excepción: agrupar dos escrituras no concede ningún
-- permiso que RLS no diera ya. Las comprobaciones explícitas de aquí abajo son
-- redundantes CON LOS TRIGGERS a propósito — mismo criterio que
-- `app.guard_offer_decider` (0008/0010): un mensaje de error legible delante del
-- socio vale más que dejar que la excepción genérica del trigger suba tal cual.
-- Si algún día un trigger cambia y dejara de bloquear algo, la comprobación
-- explícita de aquí lo sigue bloqueando igual.
-- =============================================================================

create or replace function public.counter_offer(
  p_old_item_id uuid,
  p_ciphertext  text,
  p_iv          text,
  p_keys        jsonb
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
  -- `for update` bloquea la fila: dos contraofertas a la vez sobre la misma
  -- oferta Pendiente —dos pestañas, el mismo receptor— no pueden las dos leerla
  -- como Pendiente y las dos escribir encima. La segunda espera, relee ya
  -- Superada y falla con el mensaje de abajo en vez de generar dos "nuevas
  -- ofertas" simultáneas sobre la misma anterior.
  select * into anterior
    from public.thread_items
   where id = p_old_item_id
     for update;

  -- RLS ya filtró: si quien llama no participa en el hilo, `select` no ve la
  -- fila y `into` no la encuentra. No se distingue de "no existe" — mismo
  -- criterio que `thread_public_keys` (0012 §"por qué incluye...") y
  -- `fetchThreadDetail` con `maybeSingle` en el cliente.
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

  -- offer-card: solo el receptor decide, y contraofertar es una decisión. Mismo
  -- criterio que `app.guard_offer_decider`, comprobado aquí con mensaje propio
  -- porque el trigger de la actualización de más abajo dispara sobre la fila
  -- ANTERIOR, no sobre la nueva, y conviene fallar antes de escribir nada.
  if anterior.sender_org_id = app.current_org_id() then
    raise exception
      'Una oferta la decide quien la recibe (offer-card): no puedes contraofertar tu propia oferta.';
  end if;

  -- Mismo caso irreparable que `create_thread_item`: un elemento cifrado sin
  -- ninguna CEK envuelta no lo abre ni quien lo escribió.
  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  -- part_number y brand se HEREDAN de la oferta anterior, no llegan por
  -- parámetro: `offer-card` dice que son "heredados del contexto... no editables
  -- salvo cambio explícito de referencia", y una contraoferta sobre la misma
  -- tarjeta no es ese cambio explícito. `responds_to_item_id` también se
  -- hereda — sigue siendo, en última instancia, respuesta a la misma consulta.
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, estado_oferta, responds_to_item_id,
     content_ciphertext, content_iv)
  values
    (anterior.thread_id, app.current_org_id(), auth.uid(), 'OFERTA',
     anterior.part_number, anterior.brand, 'Pendiente', anterior.responds_to_item_id,
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

  -- La anterior pasa a terminal apuntando a la nueva. Pasa por
  -- `thread_items_update_participant` (RLS), `app.guard_offer_decider` (0008/10,
  -- ya sabemos que no salta: quien llama no es `anterior.sender_org_id`) y
  -- `app.guard_offer_terminal_state` (0003, tampoco salta: Pendiente no es
  -- terminal). Ninguna de las dos comprobaciones de arriba es redundante con
  -- estos triggers en el sentido de sobrar: son la MISMA regla en dos sitios a
  -- propósito, con un mensaje legible antes de intentar escribir.
  update public.thread_items
     set estado_oferta = 'Superada por contraoferta',
         superseded_by_item_id = nueva
   where id = anterior.id;

  return nueva;
end;
$$;

revoke execute on function public.counter_offer(uuid, text, text, jsonb) from public;
grant  execute on function public.counter_offer(uuid, text, text, jsonb) to authenticated;

comment on function public.counter_offer(uuid, text, text, jsonb) is
  'Contraoferta: crea una OFERTA nueva Pendiente y marca la anterior como Superada por contraoferta, en una transaccion. security invoker: no concede ningun permiso que RLS no diera ya. Solo el receptor de la oferta Pendiente puede llamarla.';
