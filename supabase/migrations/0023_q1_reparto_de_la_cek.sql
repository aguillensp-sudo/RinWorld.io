-- =============================================================================
-- 0023 · El reparto de la CEK, con Q-1 ya decidida (ADR-002 §10)
-- =============================================================================
-- Fuente de verdad: docs/ADR-002_Ambito_de_visibilidad_por_usuario.md §10 Q-1
--                   (decision del PO, 4-sep-2026), D-1, D-2 (adenda), D-7, D-8
--                   y §5, las dos ultimas filas que quedaban.
--
-- LA REGLA, EN UNA FRASE. Cada elemento se envuelve para la union de:
--
--   1. quien PARTICIPA en la conversacion,
--   2. el ADMIN (`visibility_scope = 'ORG_METADATA'`) de las DOS organizaciones,
--      participe o no -- D-2 adenda, "el administrador siempre debe ver todo",
--   3. y **solo en el primer elemento ENTRANTE de una conversacion**, todos los
--      miembros de la organizacion que lo recibe: sin eso no lo puede leer nadie
--      alli y nadie puede asumirlo.
--
-- Y con el ambito APAGADO (D-7, que es el estado de las seis organizaciones hoy)
-- no cambia nada de nada: todos los miembros de las dos organizaciones, como
-- desde 0012. Esta migracion no se nota hasta que alguien enciende el
-- interruptor.
--
-- -----------------------------------------------------------------------------
-- QUE SIGNIFICA "PARTICIPA", Y POR QUE NO ES "TIENE CLAVE EN EL HILO"
-- -----------------------------------------------------------------------------
-- La definicion natural -"los que ya tienen una clave envuelta en este hilo"-
-- **se rompe sola**, y conviene dejar escrito el contraejemplo porque es el que
-- decidio el codigo de abajo:
--
--   Juan (Alpha) consulta a Nordwalz, que tiene el ambito encendido. Por la
--   regla 3, la consulta se envuelve para los CINCO miembros de Nordwalz. Ana la
--   asume y responde. Hasta aqui bien. Pero cuando Juan escribe otra vez, "los
--   que tienen clave en el hilo" vuelven a ser los cinco -- porque la consulta
--   inicial se la envolvieron a todos-, y el mensaje se re-difunde a la
--   organizacion entera. La asuncion no habria servido de nada.
--
-- Asi que participar es **haber escrito**: `thread_items.sender_member_id`. Que
-- es exactamente lo que dijo el PO al cerrar Q-1 -"que la propia organizacion
-- decida quien responde, y a partir de ahi el contenido es del editor que la
-- asumio"-. Asumir no es una accion con boton: es responder.
--
-- Y "mi conversacion" son los elementos del hilo que YO puedo descifrar, que es
-- justo lo que `thread_item_keys` sabe decir. Un hilo comparte tabla entre
-- conversaciones independientes (ADR-002 §6), y esta es la unica forma de
-- separarlas sin un ancla de conversacion en el esquema -- que no existe: un
-- MENSAJE no puede llevar `responds_to_item_id` (`thread_items_shape_chk`,
-- 0003:148).
--
-- -----------------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE
-- -----------------------------------------------------------------------------
--  · **No toca `app.can_access_thread()`**, que sigue gobernando el INSERT. Lo
--    dijo 0019 y sigue valiendo: exigir clave envuelta para poder ESCRIBIR seria
--    circular en el primer mensaje de una conversacion nueva.
--  · **No retira ninguna clave ya envuelta.** No puede: `thread_item_keys` solo
--    tiene politicas de SELECT e INSERT (0003:351, 0003:356). Quien recibio la
--    consulta entrante la seguira viendo, y eso esta decidido y escrito en §10.
--  · **No impide que un cliente envuelva de mas hacia la CONTRAPARTE.** El
--    guardia de abajo cubre los dos invariantes que el ADR afirma -V-1 en el
--    lado del emisor y V-2 invertido en las dos organizaciones-; un cliente
--    manipulado podria pedir `org_public_keys` de la contraparte y envolver para
--    mas gente de la que toca alli. Es dar acceso a TU propio contenido a mas
--    gente de la otra empresa, no robar el de nadie, y comprobarlo exigiria
--    recalcular el conjunto entero en cada escritura. Queda declarado, no
--    tapado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Dos ayudas pequeñas, para que las tres funciones digan lo mismo
-- -----------------------------------------------------------------------------
create or replace function app.org_scope_on(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select o.visibility_scope_enabled
                     from public.organizations o where o.id = p_org), false);
$$;

revoke execute on function app.org_scope_on(uuid) from public, anon;
grant  execute on function app.org_scope_on(uuid) to authenticated;

-- Los ADMIN de una organizacion, que por D-2 (adenda) reciben copia SIEMPRE.
-- Se usa `visibility_scope` y no `role` a proposito: D-4 dice que el ambito es
-- columna propia justamente para que el dia que se desacoplen del rol esto no
-- haya que reescribirlo.
create or replace function app.org_admins(p_org uuid)
returns table (id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id from public.members m
   where m.org_id = p_org and m.visibility_scope = 'ORG_METADATA';
$$;

revoke execute on function app.org_admins(uuid) from public, anon;
grant  execute on function app.org_admins(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · thread_public_keys · a quien envolver un elemento NUEVO de este hilo
--
-- Sustituye al de 0012, cuyo comentario decia -y era verdad entonces- que "los
-- dos lados del hilo significa literalmente todos los miembros de las dos
-- organizaciones". Ya no: eso es solo el caso del ambito apagado.
--
-- La firma NO cambia, y es deliberado: `fetchThreadRecipients(threadId)`
-- (app/src/lib/keys.ts:163) sigue llamando igual y el cliente no se entera. Lo
-- que cambia es a quien devuelve.
--
-- Sigue devolviendo la fila de quien NO tiene clave publicada, con `public_key`
-- a NULL -- 0012 §3: si se filtrara, el emisor envolveria para menos gente de la
-- que debe, el insert funcionaria, y la otra parte veria "contenido cifrado"
-- para siempre sin saber por que. El hueco se pinta, no se esconde.
-- -----------------------------------------------------------------------------
create or replace function public.thread_public_keys(t_id uuid)
returns table (member_id uuid, org_id uuid, public_key bytea)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with hilo as (
    select t.org_low_id, t.org_high_id
      from public.threads t
     where t.id = t_id
       -- La puerta, la misma de 0012: si quien llama no participa, cero filas.
       -- No se levanta excepcion -- decir "ese hilo existe pero no es tuyo" ya
       -- seria filtrar.
       and app.can_access_thread(t_id)
  ),
  yo as (select auth.uid() as id, app.current_org_id() as org),
  otra as (
    select case when (select org from yo) = h.org_low_id
                then h.org_high_id else h.org_low_id end as org
      from hilo h
  ),
  -- Mi conversacion: los elementos de este hilo que YO puedo descifrar.
  mios as (
    select ti.sender_member_id, ti.sender_org_id
      from public.thread_items ti
      join public.thread_item_keys k
        on k.item_id = ti.id and k.recipient_member_id = (select id from yo)
     where ti.thread_id = t_id
  ),
  -- Quien ha ESCRITO en ella desde la otra organizacion. Ver la cabecera: es
  -- escribir, no tener clave, y el contraejemplo de Ana explica por que.
  participa_otra as (
    select distinct m.sender_member_id as id
      from mios m
     where m.sender_org_id = (select org from otra)
       and m.sender_member_id is not null
  ),
  destinatarios as (
    -- MI LADO. Con el ambito apagado, todos (0012). Encendido: yo -sin mi copia
    -- no podria releer lo que acabo de escribir, 0003:263- y los ADMIN (D-2).
    select mm.id
      from public.members mm, yo
     where mm.org_id = yo.org
       and (not app.org_scope_on(yo.org)
            or mm.id = yo.id
            or mm.visibility_scope = 'ORG_METADATA')

    union

    -- EL LADO DE ENFRENTE. Con SU ambito apagado, todos. Encendido: sus ADMIN,
    -- quien ya haya escrito en mi conversacion, y -si no ha escrito nadie- todos,
    -- porque entonces esto es un elemento ENTRANTE para ellos y aplica la regla 3
    -- de Q-1.
    select mm.id
      from public.members mm, otra
     where mm.org_id = otra.org
       and (not app.org_scope_on(otra.org)
            or mm.visibility_scope = 'ORG_METADATA'
            or mm.id in (select id from participa_otra)
            or not exists (select 1 from participa_otra))
  )
  select m.id, m.org_id, m.public_key
    from public.members m
   where m.id in (select id from destinatarios)
     -- Sin esto, un llamador que no participa en el hilo se llevaria a los
     -- miembros de su propia organizacion: `yo` no depende de `hilo`.
     and exists (select 1 from hilo)
   order by m.org_id, m.id;
$$;

revoke execute on function public.thread_public_keys(uuid) from public, anon;
grant  execute on function public.thread_public_keys(uuid) to authenticated, service_role;

comment on function public.thread_public_keys(uuid) is
  'A quien envolver la CEK de un elemento nuevo de este hilo (ADR-002 §10 Q-1, 0023). Con el ambito apagado: todos los miembros de las dos organizaciones, como en 0012. Encendido: quien llama, los ADMIN de las dos organizaciones, y de la contraparte quien ya haya escrito en esta conversacion -o todos, si no ha escrito nadie todavia, porque entonces es un elemento entrante-. Tres columnas y nunca la fila de members. Sin filas si quien llama no participa en el hilo.';

-- -----------------------------------------------------------------------------
-- 3 · org_public_keys · el primer contacto (0014 §1)
--
-- La contraparte NO se toca: sigue devolviendo todos sus miembros, y eso ES la
-- regla 3 de Q-1 -- el buzon abierto. Lo que cambia es cuando preguntas por TU
-- PROPIA organizacion, que es como el cliente consigue su propia copia
-- (`sendInquiries` llama dos veces, thread-detail.ts:738-743): con el ambito
-- encendido, tus companeros EDITOR dejan de recibirla.
-- -----------------------------------------------------------------------------
create or replace function public.org_public_keys(p_org_id uuid)
returns table (member_id uuid, public_key bytea)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.public_key
    from public.members m
    join public.organizations o on o.id = m.org_id
   where m.org_id = p_org_id
     and (o.status = 'APPROVED' or o.id = app.current_org_id())
     and (
       -- Otra organizacion: todos. Es el buzon abierto de Q-1.
       p_org_id is distinct from app.current_org_id()
       -- La mia, con el ambito apagado: todos, como siempre.
       or not app.org_scope_on(p_org_id)
       -- La mia, encendido: yo y los ADMIN.
       or m.id = auth.uid()
       or m.visibility_scope = 'ORG_METADATA'
     );
$$;

revoke execute on function public.org_public_keys(uuid) from public, anon;
grant  execute on function public.org_public_keys(uuid) to authenticated, service_role;

comment on function public.org_public_keys(uuid) is
  'Claves publicas X25519 para envolver la CEK del primer contacto, antes de que exista hilo (0014 §1). De OTRA organizacion devuelve todos sus miembros -el buzon abierto de ADR-002 §10 Q-1-; de la propia, con el ambito encendido, solo a quien llama y a los ADMIN (0023). Dos columnas y nunca la fila de members entera.';

-- -----------------------------------------------------------------------------
-- 4 · El guardia · los dos invariantes que el ADR afirma, comprobados en la base
--
-- `security invoker` en las tres funciones de escritura significa que el reparto
-- lo decide el CLIENTE: la base recibe claves ya envueltas y no puede
-- recalcularlas -- envolver exige la privada, que nunca llega aqui. Lo que si
-- puede es NEGARSE a guardar un reparto que viole el ADR, y eso es esto.
--
-- Comprueba dos cosas, ni una mas:
--
--   V-1 (precisado en §4) · con el ambito encendido, ningun miembro de la
--        organizacion de quien escribe que no sea el mismo ni un ADMIN.
--   V-2 (INVERTIDO el 4-sep) · todos los ADMIN **con clave publicada** de las dos
--        organizaciones tienen que estar. Lo de "con clave publicada" no es una
--        rebaja: sin `public_key` el cliente no puede envolver para el, y exigirlo
--        dejaria a la organizacion sin poder escribir hasta que su ADMIN entre una
--        vez. El hueco se pinta -- el cliente ya avisa de quien no ha publicado
--        clave (thread-detail.ts:746-753) y se niega a enviar.
-- -----------------------------------------------------------------------------
create or replace function app.guard_cek_recipients(
  p_org_propia uuid,
  p_org_otra   uuid,
  p_keys       jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  intruso text;
  faltan  text;
begin
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
end;
$$;

revoke execute on function app.guard_cek_recipients(uuid, uuid, jsonb) from public, anon;
grant  execute on function app.guard_cek_recipients(uuid, uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 4bis · EL `RETURNING` DEJA DE EXISTIR EN LAS TRES, Y NO ES ESTILO (F-148)
-- -----------------------------------------------------------------------------
-- Encontrado escribiendo los asertos de Q-1, con el ambito encendido en las dos
-- organizaciones: `create_thread_item` moria con
--
--     new row violates row-level security policy for table "thread_items"
--
-- aunque las cuatro condiciones de `thread_items_insert_own` se cumplian -- se
-- comprobaron una a una desde la sesion del que escribe, con asertos, antes de
-- acusar a nadie.
--
-- LA CAUSA ES EL `RETURNING`. `insert ... returning id` exige tambien la
-- politica de SELECT sobre la fila que devuelve, y desde `0019` esa politica
-- pide, con el ambito encendido, que quien lee TENGA UNA CLAVE ENVUELTA en ese
-- elemento. En ese instante no la tiene: las claves se insertan en la sentencia
-- SIGUIENTE, porque `item_keys_insert_sender` (0003:356) exige que el elemento
-- ya exista. La funcion se pedia a si misma una fila que su propio diseño hace
-- invisible hasta la linea de abajo.
--
-- SIN ESTO, ENCENDER EL INTERRUPTOR DE D-7 ROMPE LA ESCRITURA ENTERA: ni un
-- mensaje, ni una consulta, ni una contraoferta. Lo introdujo `0019` el 3-sep y
-- no se vio porque ninguna organizacion lo tenia encendido -- las seis siguen a
-- `false` hoy. Es F-132 otra vez: comprobar el continente no es comprobar el
-- contenido.
--
-- La salida es no pedir la fila: el id se genera ANTES (`gen_random_uuid()`) y
-- se inserta explicito. Cero `RETURNING`, cero dependencia de la politica de
-- lectura para poder escribir. No se toca `0019`: su politica dice lo que tiene
-- que decir, y relajarla para que quepa un `RETURNING` seria abrir la lectura
-- para arreglar una escritura.
--
-- El hilo tiene el mismo problema por el mismo motivo -- `threads_select_
-- participant` tambien deriva de `thread_item_keys` desde 0019, asi que un hilo
-- recien creado es invisible para su creador hasta que tenga un elemento con
-- clave. Y ahi no basta con generar el id: `create_inquiry` necesita ademas
-- BUSCAR si el par ya tiene hilo, y esa busqueda tambien pasa por la politica.
-- Por eso existe la funcion de abajo, unica concesion de `security definer` de
-- esta migracion, y viene con el cinturon puesto: comprueba a mano lo que la
-- politica comprobaria.
create or replace function app.resolve_thread(p_low uuid, p_high uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $FN$
declare
  t_id uuid;
begin
  -- El cinturon. `security definer` salta RLS, asi que lo que RLS diria se dice
  -- aqui: quien llama tiene que ser miembro activo y su organizacion, una de las
  -- dos del par. Misma condicion que `threads_insert_participant` (0003).
  if not app.is_active_member() then
    raise exception 'Solo un miembro activo puede abrir un hilo.';
  end if;
  if app.current_org_id() not in (p_low, p_high) then
    raise exception 'No puedes abrir un hilo entre organizaciones ajenas.';
  end if;

  select id into t_id from public.threads
   where org_low_id = p_low and org_high_id = p_high;

  if t_id is null then
    -- El `insert` sigue disparando `app.check_thread_rate_limit` (0003): esta
    -- funcion salta la POLITICA, no los triggers. El limite de 25 hilos nuevos
    -- por dia se sigue contando igual.
    insert into public.threads (org_low_id, org_high_id, created_by_org_id)
    values (p_low, p_high, app.current_org_id())
    on conflict (org_low_id, org_high_id) do nothing
    returning id into t_id;

    -- La carrera de dos transacciones creando el mismo par, igual que en 0014.
    if t_id is null then
      select id into t_id from public.threads
       where org_low_id = p_low and org_high_id = p_high;
    end if;
  end if;

  return t_id;
end;
$FN$;

revoke execute on function app.resolve_thread(uuid, uuid) from public, anon;
grant  execute on function app.resolve_thread(uuid, uuid) to authenticated;

-- Y LA SEGUNDA MITAD DE F-148, que aparecio en cuanto la primera dejo de tapar
-- la vista: quitado el `RETURNING`, el elemento se inserta y lo siguiente que
-- revienta es el deposito de las claves.
--
--   new row violates row-level security policy for table "thread_item_keys"
--
-- `item_keys_insert_sender` (0003:356) comprueba el permiso con una subconsulta
-- **sobre `thread_items`**, y esa subconsulta pasa por RLS como quien llama. Con
-- el ambito encendido, el elemento recien insertado es invisible para su propio
-- autor hasta que tenga una clave envuelta... que es justo la fila que se esta
-- intentando insertar. Huevo y gallina, y el mismo origen que la primera mitad:
-- una politica de LECTURA que se volvio derivada en `0019` y de la que colgaban
-- dos caminos de ESCRITURA que nadie volvio a mirar.
--
-- Se arregla como el resto del esquema resuelve esto desde `0003`: la condicion
-- se mete en una funcion `security definer` -`app.can_access_thread` es
-- exactamente eso- y la politica la llama. **No se relaja ni un aposito de lo
-- que la politica exige**: mismas tres condiciones, mismo orden, misma
-- semantica. Lo unico que cambia es que la comprobacion deja de mirarse en el
-- espejo de RLS.
create or replace function app.is_item_sender(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.thread_items i
     where i.id = p_item
       and i.sender_member_id = auth.uid()
       and app.can_access_thread(i.thread_id)
  );
$$;

revoke execute on function app.is_item_sender(uuid) from public, anon;
grant  execute on function app.is_item_sender(uuid) to authenticated;

alter policy item_keys_insert_sender on public.thread_item_keys
  with check (app.is_active_member() and app.is_item_sender(item_id));

-- -----------------------------------------------------------------------------
-- 5 · Las tres vias de escritura llaman al guardia
--
-- Se reescriben enteras -- `create or replace` necesita el cuerpo completo-, y
-- lo unico que cambia en cada una es la llamada nueva. Se conservan literales
-- los mensajes de error de 0012/0013/0020 para no romper ningun aserto que los
-- busque.
-- -----------------------------------------------------------------------------

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

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys);

  -- El id ANTES de insertar, y sin `returning` (F-148, §4bis).
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

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys);

  nueva := gen_random_uuid();      -- F-148, §4bis

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

  -- ADR-002 §5, la fila que faltaba: el reparto de destinatarios deja de ser
  -- "todos los miembros". Aqui el conjunto correcto lo devuelve
  -- `org_public_keys` (todos los del distribuidor -- buzon abierto de Q-1 --,
  -- y de la propia organizacion solo quien escribe y sus ADMIN); esto comprueba
  -- que lo que llega es eso y no otra cosa.
  perform app.guard_cek_recipients(app.current_org_id(), linea.org_id, p_keys);

  t_low  := least(app.current_org_id(), linea.org_id);
  t_high := greatest(app.current_org_id(), linea.org_id);

  -- Buscar-o-crear el hilo fuera de la politica de lectura (F-148, §4bis): el
  -- `select` de antes iba bajo RLS y, con el ambito encendido, un hilo sin
  -- elementos legibles es invisible incluso para quien lo acaba de crear.
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
grant  execute on function public.create_inquiry(uuid, text, text, jsonb, integer) to authenticated;
