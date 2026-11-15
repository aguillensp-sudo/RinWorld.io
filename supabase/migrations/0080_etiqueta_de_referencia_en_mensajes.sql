-- =============================================================================
-- 0080 · Etiqueta de referencia en los mensajes
-- =============================================================================
-- Change `amend-msg-hilos-pestanas-y-etiqueta` (DECISIONES-V1, 14-nov-2026), `design.md` §1.
--
-- Un MENSAJE puede llevar como etiqueta una referencia (part_number + brand) de las que hay
-- en las consultas u ofertas de su hilo, o ninguna (conversación general). Va en claro, en
-- las mismas columnas que la referencia de una tarjeta; el texto sigue cifrado.
--
-- Tres piezas:
--   1. `thread_items_shape_chk`: un MENSAJE lleva part_number y brand los dos o ninguno. El
--      resto de su forma (0020) no cambia.
--   2. `app.validate_message_tag()`: la etiqueta tiene que ser una referencia de una CONSULTA
--      u OFERTA del mismo hilo, con comparación exacta (se elige en un selector, no se
--      escribe). Vale para todos, también para `postgres`: una siembra con una etiqueta que
--      no está en el hilo pintaría un mensaje sobre algo que no se negocia ahí.
--   3. `app.guard_thread_item_integrity()` (0055): la etiqueta de un MENSAJE deja de ser de
--      solo lectura, pero solo para la organización que lo envió. Para la otra parte, y para
--      la referencia de CONSULTA y OFERTA, todo sigue igual.
--
-- Sin backfill: los mensajes que ya existen quedan sin etiqueta, es decir, conversación
-- general.
--
-- Cambiar la etiqueta no mueve el hilo: `sync_thread_state` deriva el estado de consultas y
-- ofertas, y `touch_thread_last_item` solo actúa en INSERT. Lo comprueba
-- `supabase/tests/12_etiqueta_mensaje.sql`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Forma por tipo: un MENSAJE puede llevar etiqueta
-- -----------------------------------------------------------------------------
alter table public.thread_items drop constraint thread_items_shape_chk;
alter table public.thread_items add constraint thread_items_shape_chk check (
  case item_type
    when 'MENSAJE' then
      (part_number is null) = (brand is null)
      and inventory_line_id is null
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

comment on column public.thread_items.part_number is
  'Referencia de la tarjeta (CONSULTA, OFERTA) o etiqueta del MENSAJE (0080): una referencia de una consulta u oferta del mismo hilo, o NULL = conversación general.';

-- -----------------------------------------------------------------------------
-- 2 · La etiqueta tiene que ser una referencia del hilo
-- -----------------------------------------------------------------------------
-- `security definer` como `validate_thread_item`: tiene que ver todas las tarjetas del hilo,
-- y solo devuelve si existe una con esa referencia, sin contenido.
create or replace function app.validate_message_tag()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.item_type <> 'MENSAJE' or new.part_number is null then
    return new;
  end if;

  if not exists (
    select 1 from public.thread_items c
     where c.thread_id = new.thread_id
       and c.item_type in ('CONSULTA', 'OFERTA')
       and c.part_number = new.part_number
       and c.brand = new.brand
  ) then
    raise exception
      'La etiqueta de un mensaje tiene que ser una referencia de este hilo: % · % no está en ninguna consulta ni oferta del hilo %.',
      new.part_number, new.brand, new.thread_id;
  end if;

  return new;
end;
$function$;

revoke execute on function app.validate_message_tag() from public, anon, authenticated;

create trigger thread_items_validate_message_tag
  before insert or update of part_number, brand on public.thread_items
  for each row execute function app.validate_message_tag();

-- -----------------------------------------------------------------------------
-- 3 · La etiqueta la cambia quien envió el mensaje
-- -----------------------------------------------------------------------------
-- Igual que 0055 salvo el bloque marcado. Fuera de la lista de lo inmutable, como allí:
-- `estado_oferta` y `estado_consulta` (sus guardias), `estado_changed_at`
-- (`touch_item_estado`), `superseded_by_item_id` (`counter_offer`) e `inventory_line_id`
-- (`on delete set null`).
create or replace function app.guard_thread_item_integrity()
  returns trigger
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.item_type = 'OFERTA'
       and (new.estado_oferta is distinct from 'Pendiente' or new.superseded_by_item_id is not null) then
      raise exception
        'Una oferta nace Pendiente (offer-card): aceptarla, rechazarla o superarla es cosa de quien la recibe, despues.';
    end if;

    if new.item_type = 'CONSULTA' and new.estado_consulta is distinct from 'Pendiente' then
      raise exception
        'Una consulta nace Pendiente (inquiry-card): responderla es cosa de quien la recibe, despues.';
    end if;

    return new;
  end if;

  -- 0080 · la etiqueta de un MENSAJE: solo la organización emisora puede cambiarla.
  if old.item_type = 'MENSAJE'
     and (new.part_number, new.brand) is distinct from (old.part_number, old.brand)
     and app.current_org_id() is distinct from old.sender_org_id then
    raise exception
      'La etiqueta de un mensaje solo la cambia la organizacion que lo envio (%).', old.sender_org_id;
  end if;

  if (new.id, new.thread_id, new.sender_org_id, new.sender_member_id, new.item_type,
      new.created_at, new.responds_to_item_id, new.quantity,
      new.content_ciphertext, new.content_iv)
     is distinct from
     (old.id, old.thread_id, old.sender_org_id, old.sender_member_id, old.item_type,
      old.created_at, old.responds_to_item_id, old.quantity,
      old.content_ciphertext, old.content_iv)
     or (old.item_type <> 'MENSAJE'
         and (new.part_number, new.brand) is distinct from (old.part_number, old.brand)) then
    raise exception
      'Lo escrito en un hilo no se reescribe: contenido cifrado, autoria, tipo, referencia, cantidad y a que responde son de solo lectura. Lo que cambia es el estado.';
  end if;

  return new;
end;
$function$;
