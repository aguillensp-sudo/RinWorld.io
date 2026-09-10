-- =============================================================================
-- 0026 · F-156 · el guardia "ya has consultado" se saltaba en silencio
-- =============================================================================
-- Encontrado auditando `app/src/lib/` con la pregunta que dejo abierta F-155
-- (ESTADO-V1.md, Dia 12, §3/§6): "hay OTROS SELECT bajo RLS que asuman que
-- quien llama ya tiene una clave envuelta, ademas de los dos que 0025
-- corrigio?" -- si. Verificado contra un Postgres desechable ANTES de
-- escribir esta migracion, no razonado: con el ambito de Alpha encendido, a1
-- (ADMIN) consulta una linea de Beta; desde la sesion de a3 (EDITOR de
-- Alpha, no ha escrito nada, sin clave envuelta en ese item), el EXISTS que
-- `create_inquiry` usa para bloquear duplicados devuelve `false` -- la fila
-- existe de verdad (confirmado sin RLS, como postgres), pero a3 no la ve.
--
-- -----------------------------------------------------------------------------
-- EL BUG, PRECISO
-- -----------------------------------------------------------------------------
-- `create_inquiry` (0014, reescrita en 0023) comprueba duplicados asi:
--
--   if exists (
--     select 1 from public.thread_items
--      where item_type = 'CONSULTA'
--        and inventory_line_id = linea.id
--        and sender_org_id = app.current_org_id()
--   ) then raise exception 'Ya has consultado esta referencia con este distribuidor.';
--
-- Es un SELECT normal dentro de una funcion `security invoker`, y por tanto
-- bajo `thread_items_select_participant` (0019): con el ambito encendido, esa
-- politica exige tener una clave envuelta EN ESE ELEMENTO CONCRETO (o ser
-- ORG_METADATA). El filtro es `sender_org_id = app.current_org_id()` --
-- pregunta por la ORGANIZACION, no por el miembro-- pero la politica que
-- decide que fila es visible mira al MIEMBRO que llama, no a su organizacion.
--
-- Y `org_public_keys` (0023 §3), con el ambito encendido, envuelve la CEK del
-- lado propio SOLO para quien escribe y sus ADMIN -- "tus companeros EDITOR
-- dejan de recibirla", dice su propio comentario. O sea: el EDITOR que NO
-- mando la consulta original nunca tiene clave en ese item, y el EXISTS que
-- deberia bloquearle una segunda consulta al mismo distribuidor le devuelve
-- CERO FILAS sin ningun error -- exactamente la forma de F-148/F-155, pero
-- aqui el resultado no es un escritor bloqueado: es un invariante que se
-- salta. `create_inquiry` deja pasar una CONSULTA duplicada a la misma linea
-- y al mismo distribuidor, violando lo que su propio mensaje de error dice
-- que impide.
--
-- -----------------------------------------------------------------------------
-- POR QUE NO SE VEIA
-- -----------------------------------------------------------------------------
-- El unico test existente de este guardia (01_schema_smoke.sql, bloque
-- "create_inquiry (0014)") prueba la segunda consulta con el MISMO miembro
-- que hizo la primera, y ademas corre ANTES de que el ambito de Alpha se
-- encienda mas adelante en el fichero (linea ~1433). Las dos condiciones que
-- hacen falta para que el hueco se manifieste -- ambito encendido Y un
-- miembro DISTINTO del que escribio/es ADMIN -- nunca coincidieron en ningun
-- aserto.
--
-- -----------------------------------------------------------------------------
-- EL ARREGLO -- MISMO PATRON QUE `app.thread_counterpart`, `app.resolve_thread`
-- Y `app.is_item_sender`
-- -----------------------------------------------------------------------------
-- Una funcion `security definer` que hace la MISMA consulta sin pasar por
-- RLS. No relaja ninguna politica de lectura: lo que se comprueba es "ha
-- consultado MI ORGANIZACION esta linea", un hecho agregado a nivel de
-- organizacion que ningun miembro de ella podria usar para ver contenido
-- ajeno -- devuelve un booleano, nunca una fila de `thread_items`. Lo unico
-- que cambia es CUANDO se le permite comprobarlo.
-- =============================================================================

create or replace function app.org_already_inquired(p_line uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.thread_items
     where item_type = 'CONSULTA'
       and inventory_line_id = p_line
       and sender_org_id = p_org
  );
$$;

revoke execute on function app.org_already_inquired(uuid, uuid) from public, anon;
grant  execute on function app.org_already_inquired(uuid, uuid) to authenticated;

comment on function app.org_already_inquired(uuid, uuid) is
  'F-156: si mi organizacion ya consulto esta linea de inventario, para el guardia de create_inquiry (0014/0023). security definer a proposito -- el EXISTS invoker equivalente cae bajo thread_items_select_participant (0019), que exige ya tener una clave envuelta en el elemento concreto, y con el ambito encendido org_public_keys solo envuelve para quien escribe y los ADMIN (0023 §3): cualquier otro EDITOR de la organizacion no veia la consulta anterior y el guardia se saltaba en silencio. Devuelve un booleano, nunca una fila de thread_items -- no abre lectura, cierra el hueco.';

-- -----------------------------------------------------------------------------
-- create_inquiry pasa a usar el helper. Nada mas cambia -- ni el mensaje de
-- error, ni el orden de las comprobaciones, ni el resto de la logica.
-- -----------------------------------------------------------------------------
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

  if app.org_already_inquired(linea.id, app.current_org_id()) then   -- F-156
    raise exception 'Ya has consultado esta referencia con este distribuidor.';
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
