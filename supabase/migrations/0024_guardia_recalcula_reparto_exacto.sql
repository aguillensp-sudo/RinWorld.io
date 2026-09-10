-- =============================================================================
-- 0024 · El guardia recalcula el conjunto EXACTO, no solo que no falte nadie
-- =============================================================================
-- Fuente de verdad: 0023 §4, el propio comentario que dejo el hueco escrito --
--   "No impide que un cliente envuelva de mas hacia la CONTRAPARTE. [...]
--    comprobarlo exigiria recalcular el conjunto entero en cada escritura.
--    Queda declarado, no tapado."
-- Y ESTADO-V1.md §5 (Dia 11, 10-sep-2026): item del backlog, "sin decidir, sin
-- prisa" hasta hoy, que el PO decide ejecutar el Dia 12.
--
-- -----------------------------------------------------------------------------
-- EL HUECO, PRECISO
-- -----------------------------------------------------------------------------
-- `app.guard_cek_recipients` (0023) comprueba dos cosas sobre `p_keys`:
--
--   V-1 · nadie de MI organizacion que no sea yo ni ADMIN (con el ambito
--        encendido).
--   V-2 · que no FALTE ningun ADMIN con clave publicada de las dos
--        organizaciones.
--
-- Ninguna de las dos mira si SOBRA gente del lado de la CONTRAPARTE. Con una
-- conversacion ya asumida (Q-1, "asumir es responder"), el conjunto correcto
-- del lado de enfrente se cierra a sus ADMIN + quien ya escribio -- pero nada
-- impedia que un cliente manipulado pidiera `org_public_keys` de esa
-- organizacion (que da TODOS sus miembros, buzon abierto del primer
-- contacto) y envolviera tambien para ellos aunque la conversacion ya
-- estuviera cerrada a menos gente. Es dar acceso a TU PROPIO contenido a mas
-- gente de la otra empresa de la que toca -- no robar el de nadie -- pero
-- rompe el ambito que esa organizacion configuro para si misma.
--
-- -----------------------------------------------------------------------------
-- Y UN SEGUNDO HUECO, NO DECLARADO EN NINGUN SITIO, ENCONTRADO AL DISEÑAR EL
-- ARREGLO DEL PRIMERO (F-154)
-- -----------------------------------------------------------------------------
-- Ni V-1 ni V-2 comprueban que cada `member_id` de `p_keys` pertenezca a
-- ALGUNA de las dos organizaciones del intercambio (`p_org_propia`,
-- `p_org_otra`). V-1 solo mira intrusos DENTRO de mi organizacion; V-2 solo
-- mira que no falte un ADMIN. Como `org_public_keys` es de acceso libre para
-- CUALQUIER organizacion (asi tiene que ser: es como se arranca el primer
-- contacto con un distribuidor nuevo), un cliente manipulado podia pedir las
-- claves de una TERCERA organizacion -ajena por completo a este hilo- y
-- envolver tambien para ella. Nada en el guardia lo habria parado.
--
-- -----------------------------------------------------------------------------
-- EL ARREGLO, ADITIVO -- V-1 y V-2 NO CAMBIAN NI UNA LINEA
-- -----------------------------------------------------------------------------
-- Dos comprobaciones nuevas, las dos DESPUES de V-1 y V-2 (que siguen
-- disparando primero, igual que hoy -- ningun aserto existente de
-- `01_schema_smoke.sql` las alcanza con una violacion real, se comprobo
-- antes de escribir esto):
--
--   NUEVA · ajenos    · ningun `member_id` de `p_keys` puede ser de una
--                        organizacion distinta de `p_org_propia`/`p_org_otra`
--                        (F-154). Aplica siempre, en las tres vias de
--                        escritura.
--   NUEVA · excedente · con un hilo YA EXISTENTE (`p_thread_id` no nulo), el
--                        conjunto de `p_keys` tiene que ser subconjunto de lo
--                        que `thread_public_keys(p_thread_id)` devuelve AHORA
--                        MISMO -- la misma funcion que ya es la fuente de
--                        verdad para el cliente (0023 §2). No se reimplementa
--                        la logica de destinatarios una segunda vez: se
--                        reutiliza la que ya existe y ya esta probada.
--
-- Por que `excedente` no aplica a `create_inquiry` (`p_thread_id` NULL, no
-- existe hilo todavia): en el primer contacto el lado receptor YA es "todos"
-- -regla 3 de Q-1, el buzon abierto- asi que no hay exceso posible que
-- comprobar ahi. La comprobacion de `ajenos` (aplica siempre) mas la V-1 que
-- ya existia bastan para acotar el lado propio; el receptor no tiene techo
-- que perforar.
--
-- Coste: una llamada mas a `thread_public_keys` por escritura sobre un hilo
-- existente -- la misma query que el cliente ya corrio para construir
-- `p_keys`, ahora tambien del lado del servidor. Organizaciones de tamaño de
-- demo (varios, no miles): coste despreciable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La firma cambia (nuevo p_thread_id) -- create or replace no basta,
-- hace falta borrar la firma vieja de tres parametros primero.
-- -----------------------------------------------------------------------------
drop function if exists app.guard_cek_recipients(uuid, uuid, jsonb);

create function app.guard_cek_recipients(
  p_org_propia uuid,
  p_org_otra   uuid,
  p_keys       jsonb,
  p_thread_id  uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  intruso   text;
  faltan    text;
  ajenos    text;
  excedente text;
begin
  -- V-1, sin tocar (0023).
  if app.org_scope_on(p_org_propia) then
    select string_agg(m.id::text, ', ') into intruso
      from public.members m
     where m.org_id = p_org_propia
       and m.visibility_scope <> 'ORG_METADATA'
       and m.id is distinct from auth.uid()
       and m.id::text in (select k->>'member_id' from jsonb_array_elements(p_keys) k);

    if intruso is not null then
      raise exception
        'ADR-002 V-1: con el ambito de visibilidad encendido, la CEK no se envuelve para companeros que no participan (%). Vuelve a pedir los destinatarios: thread_public_keys / org_public_keys ya devuelven el conjunto correcto.',
        intruso;
    end if;
  end if;

  -- V-2, sin tocar (0023).
  select string_agg(m.id::text, ', ') into faltan
    from public.members m
   where m.org_id in (p_org_propia, p_org_otra)
     and m.visibility_scope = 'ORG_METADATA'
     and m.public_key is not null
     and m.id::text not in (select k->>'member_id' from jsonb_array_elements(p_keys) k);

  if faltan is not null then
    raise exception
      'ADR-002 D-2 (adenda del 4-sep-2026) y V-2: el ADMIN de cada organizacion recibe copia de todos los elementos, y falta la de (%). Vuelve a pedir los destinatarios en vez de componer la lista a mano.',
      faltan;
  end if;

  -- NUEVA · F-154 · ningun destinatario ajeno a las dos organizaciones del
  -- intercambio. Aplica siempre, con o sin hilo.
  select string_agg(k->>'member_id', ', ') into ajenos
    from jsonb_array_elements(p_keys) k
   where (k->>'member_id')::uuid not in (
     select m.id from public.members m where m.org_id in (p_org_propia, p_org_otra)
   );

  if ajenos is not null then
    raise exception
      'F-154: la CEK se envuelve solo para miembros de las dos organizaciones de este intercambio (%), ninguna otra. Vuelve a pedir los destinatarios.',
      ajenos;
  end if;

  -- NUEVA · 0023 §4, backlog cerrado el 10-sep-2026 · con hilo existente, el
  -- reparto no puede tener MAS gente de la que thread_public_keys devuelve
  -- ahora mismo -- ni aunque V-1/V-2/ajenos ya hayan pasado.
  if p_thread_id is not null then
    select string_agg(k->>'member_id', ', ') into excedente
      from jsonb_array_elements(p_keys) k
     where (k->>'member_id')::uuid not in (
       select tpk.member_id from public.thread_public_keys(p_thread_id) tpk
     );

    if excedente is not null then
      raise exception
        'ADR-002 §10 Q-1 (0023 §4, backlog cerrado 10-sep-2026): el reparto de esta conversacion no puede incluir a mas gente de la que thread_public_keys devuelve ahora mismo (%). Vuelve a pedir los destinatarios.',
        excedente;
    end if;
  end if;
end;
$$;

revoke execute on function app.guard_cek_recipients(uuid, uuid, jsonb, uuid) from public, anon;
grant  execute on function app.guard_cek_recipients(uuid, uuid, jsonb, uuid) to authenticated;

comment on function app.guard_cek_recipients(uuid, uuid, jsonb, uuid) is
  'Los cuatro invariantes del reparto de la CEK, comprobados en la base (ADR-002 §10 Q-1). V-1: nadie de mi organizacion que no sea yo ni ADMIN. V-2: no falta ningun ADMIN con clave publicada. F-154: nadie ajeno a las dos organizaciones del intercambio. 0023 §4 (backlog, cerrado 10-sep-2026): con hilo existente (p_thread_id), el conjunto entero es subconjunto exacto de thread_public_keys(p_thread_id) -- no solo "no falta el ADMIN", tambien "no sobra nadie". p_thread_id NULL en el primer contacto (create_inquiry): el lado receptor ya es "todos" (regla 3), no hay exceso que comprobar.';

-- -----------------------------------------------------------------------------
-- 2 · Las tres vias de escritura pasan el thread_id que ya tienen a mano
-- -----------------------------------------------------------------------------

-- create_thread_item YA recibe p_thread_id como parametro -- solo se
-- reenvia. Cuerpo identico a 0023 salvo esa linea.
create or replace function public.create_thread_item(
  p_thread_id  uuid,
  p_item_type  text,
  p_ciphertext text,
  p_iv         text,
  p_keys       jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
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

  select case when t.org_low_id = app.current_org_id() then t.org_high_id
              else t.org_low_id end
    into otra
    from public.threads t where t.id = p_thread_id;

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys, p_thread_id);

  -- El id ANTES de insertar, y sin `returning` (F-148, 0023 §4bis).
  nuevo := gen_random_uuid();

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
  values
    (nuevo, p_thread_id, app.current_org_id(), auth.uid(), p_item_type,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'));

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
$$;

revoke execute on function public.create_thread_item(uuid, text, text, text, jsonb) from public, anon;
grant  execute on function public.create_thread_item(uuid, text, text, text, jsonb) to authenticated;

-- counter_offer YA resuelve `anterior.thread_id` antes de llamar al guardia
-- -- solo se le pasa.
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
  otra     uuid;
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

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'La cantidad de la contraoferta no puede ser negativa.';
  end if;

  select case when t.org_low_id = app.current_org_id() then t.org_high_id
              else t.org_low_id end
    into otra
    from public.threads t where t.id = anterior.thread_id;

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys, anterior.thread_id);

  nueva := gen_random_uuid();      -- F-148, 0023 §4bis

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, estado_oferta, responds_to_item_id, quantity,
     content_ciphertext, content_iv)
  values
    (nueva, anterior.thread_id, app.current_org_id(), auth.uid(), 'OFERTA',
     anterior.part_number, anterior.brand, 'Pendiente', anterior.responds_to_item_id,
     p_quantity,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'));

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

revoke execute on function public.counter_offer(uuid, text, text, jsonb, integer) from public, anon;
grant  execute on function public.counter_offer(uuid, text, text, jsonb, integer) to authenticated;

-- create_inquiry pasa NULL a proposito: el hilo todavia no existe en este
-- punto (se resuelve DESPUES, con app.resolve_thread). Ver la cabecera:
-- ningun exceso que comprobar en el primer contacto, `ajenos` ya cubre lo
-- que hace falta cubrir aqui.
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

  perform app.guard_cek_recipients(app.current_org_id(), linea.org_id, p_keys, null);

  t_low  := least(app.current_org_id(), linea.org_id);
  t_high := greatest(app.current_org_id(), linea.org_id);

  -- Buscar-o-crear el hilo fuera de la politica de lectura (F-148, 0023
  -- §4bis): el `select` de antes iba bajo RLS y, con el ambito encendido, un
  -- hilo sin elementos legibles es invisible incluso para quien lo acaba de
  -- crear.
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
