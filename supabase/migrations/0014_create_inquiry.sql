-- =============================================================================
-- 0014 · Consultar: la pública del primer contacto, y el hilo + tarjeta atómicos
-- =============================================================================
-- Fuente de verdad: openspec/specs/conversational-search/spec.md · results-row-actions
--                   openspec/specs/messaging-and-negotiation/spec.md · inquiry-card
--                   Plan §3, fila del día 10 — GAP-004, "Consultar Seleccionados"
--
-- EL LÍMITE DE GAP-004, APLICADO AQUÍ.
--
-- `gaps-register.md` GAP-004 cierra el reparto: "la selección y el disparo de
-- la acción pertenecen a conversational-search; la gestión del hilo, tarjeta
-- de consulta y cifrado E2EE pertenecen a messaging-and-negotiation". Esta
-- función es esa segunda mitad. SRCH-01 (`app/src/screens/search`) nunca
-- inserta en `threads` ni en `thread_items` directamente: llama a esto una vez
-- por línea seleccionada, y no sabe ni necesita saber si el hilo ya existía.
--
-- POR QUÉ EL HILO SE BUSCA-O-CREA DENTRO, Y NO EN UNA FUNCIÓN APARTE.
--
-- `single-thread-model` (0003) ya impone un único hilo por par de
-- organizaciones con el índice único `threads_pair_uniq`; lo único que hace
-- falta encima es "encontrar o crear" sin reventar contra ese índice.
-- Separarlo en su propia función (`find_or_create_thread`) habría añadido una
-- llamada de red por línea sin necesidad: se busca primero (barato, sin
-- disparar ningún trigger) y solo se inserta si de verdad no existía, así que
-- la segunda, tercera... línea del mismo distribuidor en la misma tanda de
-- "Consultar Seleccionados" encuentra el hilo que la primera acaba de crear,
-- con una sola llamada por línea y sin que el cliente tenga que recordar qué
-- hilo ya pidió. Ver más abajo por qué el orden búsqueda-antes-que-inserción
-- no es solo estilo.
--
-- POR QUÉ NO ES "IRREPARABLE" SI EL HILO QUEDA VACÍO.
--
-- A diferencia de `create_thread_item` (0012 §5) y `counter_offer` (0013), un
-- hilo sin elementos no es corrupción: es un hilo vacío, un estado ya
-- contemplado (`previewLabel` → "Sin actividad"). Por eso el `insert` del hilo
-- y el de la tarjeta pueden convivir en la misma función sin que fallar el
-- segundo deje nada irrecuperable — simplemente queda un hilo sin ese
-- elemento, y la siguiente línea de ese mismo distribuidor (o un reintento)
-- lo encuentra y sigue.
--
-- QUÉ DERIVA DE LA LÍNEA Y NO DEL PARÁMETRO.
--
-- `part_number`, `brand` y la organización distribuidora salen de
-- `inventory_lines`, nunca de lo que mande el cliente: mismo criterio que
-- `counter_offer` heredando de la oferta anterior. Comprobar la línea de paso
-- reintroduce la comprobación de `fetchResults` (`status = 'PUBLISHED'`) del
-- lado servidor, que RLS ya impone para líneas ajenas pero no está de más
-- decir con un mensaje propio en vez de dejar que RLS la esconda como "no
-- encontrada".
--
-- -----------------------------------------------------------------------------
-- 1 · La pública del distribuidor, ANTES de que exista ningún hilo
--
-- El cliente cifra ANTES de llamar a `create_inquiry`: el ciphertext y las CEK
-- envueltas son parámetros de entrada, no algo que la función calcule. Para
-- envolver la CEK hace falta la pública X25519 de cada miembro del
-- distribuidor, y `thread_public_keys` (0012) exige un hilo que en el primer
-- contacto **todavía no existe** — es la mitad del problema que 0012 no tenía
-- que resolver porque el día 8 no había "primer contacto", solo hilos ya
-- sembrados.
--
-- Mismo criterio de superficie mínima que 0012: tres columnas y ninguna fila
-- de `members` entera. La condición de acceso no es "participo en un hilo con
-- esa organización" —eso es justo lo que no hay— sino la misma que ya deja ver
-- la organización en SRCH-01: `organizations_select_approved` (0001:202),
-- `status = 'APPROVED' or id = app.current_org_id()`. Si SRCH-01 ya enseña el
-- inventario de esa organización, enseñar la clave pública de sus miembros no
-- abre nada nuevo — es el mismo dato un paso más abajo.
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
     and (o.status = 'APPROVED' or o.id = app.current_org_id());
$$;

revoke execute on function public.org_public_keys(uuid) from public;
grant  execute on function public.org_public_keys(uuid) to authenticated, service_role;

comment on function public.org_public_keys(uuid) is
  'Claves publicas X25519 de los miembros de una organizacion APROBADA, para envolver la CEK del primer contacto (antes de que exista un hilo). Devuelve dos columnas y nunca la fila de members entera. Misma condicion que ya deja ver la organizacion en SRCH-01 (organizations_select_approved, 0001).';

-- -----------------------------------------------------------------------------
-- 2 · Escribir el elemento y sus claves, o ninguna de las dos cosas
-- -----------------------------------------------------------------------------

create or replace function public.create_inquiry(
  p_line_id    uuid,
  p_ciphertext text,
  p_iv         text,
  p_keys       jsonb
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

  -- inquiry-card: "bloqueando el envío de una segunda consulta sobre la misma
  -- línea de inventario por el mismo comprador". El índice único
  -- `thread_items_one_inquiry_per_line_uniq` (0003) ya lo impide; esto es el
  -- mismo mensaje que SRCH-01 pinta en pantalla, en vez de dejar subir el
  -- error crudo de una violación de índice.
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

  t_low  := least(app.current_org_id(), linea.org_id);
  t_high := greatest(app.current_org_id(), linea.org_id);

  -- ⚠ SE MIRA ANTES DE INSERTAR, Y NO ES UNA OPTIMIZACIÓN.
  --
  -- `app.check_thread_rate_limit` es un trigger BEFORE INSERT (0003), y un
  -- trigger BEFORE se dispara para la fila candidata ANTES de que Postgres
  -- compruebe el conflicto — con o sin `ON CONFLICT DO NOTHING`. Probado
  -- contra Postgres real: intentar un `insert ... on conflict do nothing`
  -- sobre un par que YA tenía hilo consumía igualmente un hueco del límite
  -- de 25 hilos NUEVOS por día, aunque no se insertara ninguna fila. Con 25
  -- líneas de un mismo distribuidor ya conocido, la vigésima sexta línea
  -- habría fallado por un límite pensado para distribuidores nuevos, no para
  -- líneas nuevas de uno ya conocido. El `select` de aquí evita disparar el
  -- trigger en el caso común (el hilo ya existe); el `insert` de abajo sigue
  -- ahí para el caso real de un distribuidor nuevo, y su reintento de lectura
  -- cubre la carrera de dos transacciones creando el mismo par a la vez.
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
     part_number, brand, inventory_line_id, estado_consulta,
     content_ciphertext, content_iv)
  values
    (t_id, app.current_org_id(), auth.uid(), 'CONSULTA',
     linea.part_number, linea.brand, linea.id, 'Pendiente',
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

revoke execute on function public.create_inquiry(uuid, text, text, jsonb) from public;
grant  execute on function public.create_inquiry(uuid, text, text, jsonb) to authenticated;

comment on function public.create_inquiry(uuid, text, text, jsonb) is
  'GAP-004: encuentra o crea el hilo con el distribuidor de la linea y deposita la tarjeta de CONSULTA y sus claves, en una transaccion. part_number/brand/organizacion salen de inventory_lines, nunca del parametro. security invoker: no concede ningun permiso que RLS no diera ya.';
