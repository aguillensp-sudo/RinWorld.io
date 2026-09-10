-- =============================================================================
-- 0025 · F-155 · `otra` se resolvia contra una politica de SELECT circular
-- =============================================================================
-- Encontrado corriendo `supabase/tests/run.sh` DESPUES de escribir `0024`: el
-- bloque "4 · c2 asume: responde" de `01_schema_smoke.sql` -que ya existia,
-- sin tocar- empezo a fallar con el error nuevo de F-154 ("miembro ajeno a
-- las dos organizaciones") acusando a `a1` y `a2` -que SI son de Alpha, una
-- de las dos organizaciones del hilo-. La causa no esta en `0024`: esta en
-- un `SELECT` que `create_thread_item` y `counter_offer` ya tenian desde
-- `0023`, y que `0024` fue el primero en depender de que devolviera algo
-- correcto.
--
-- -----------------------------------------------------------------------------
-- EL BUG, PRECISO
-- -----------------------------------------------------------------------------
-- Las dos funciones calculan la organizacion de enfrente asi:
--
--   select case when t.org_low_id = app.current_org_id() then t.org_high_id
--               else t.org_low_id end
--     into otra
--     from public.threads t where t.id = p_thread_id;
--
-- Es un `SELECT` normal dentro de una funcion `security invoker` -- corre
-- con los privilegios de quien llama, y por tanto bajo RLS de `threads`.
-- Y la politica de SELECT de `threads`, desde `0019` (visibility scope),
-- exige TENER YA una clave envuelta en algun elemento del hilo (o bypassear
-- el ambito):
--
--   ... AND (app.caller_bypasses_visibility_scope()
--            OR EXISTS (select 1 from thread_item_keys tik
--                         join thread_items ti on ti.id = tik.item_id
--                        where ti.thread_id = threads.id
--                          and tik.recipient_member_id = auth.uid()))
--
-- Quien escribe su PRIMER elemento en un hilo con el ambito encendido -y no
-- es ADMIN- no tiene ninguna clave todavia. El `SELECT` de `otra` devuelve
-- CERO FILAS, y `select ... into` deja la variable en `NULL` **sin lanzar
-- ningun error**. `guard_cek_recipients` recibia entonces `p_org_otra =
-- NULL`.
--
-- -----------------------------------------------------------------------------
-- POR QUE NO SE VEIA ANTES DE 0024
-- -----------------------------------------------------------------------------
-- V-1 (0023) solo usa `p_org_propia`, nunca `p_org_otra` -- inmune. V-2 usa
-- `org_id in (p_org_propia, p_org_otra)`: con `p_org_otra` NULL, esa
-- condicion sigue siendo verdadera para quien coincide con `p_org_propia`
-- (el termino NULL del OR simplemente no añade nada), asi que el ADMIN de
-- MI organizacion se seguia exigiendo bien. Lo que se perdia en silencio
-- era exigir tambien al ADMIN de la OTRA organizacion -y como los tests
-- existentes siempre lo incluian en `p_keys` de todas formas, nadie lo
-- notó-. Es exactamente la clase de hueco que la regla 2 de `ESTADO-V1.md`
-- describe: "comprobar el continente no es comprobar el contenido" -- el
-- guardia decia que si comprobaba las dos organizaciones, y solo comprobaba
-- una y media.
--
-- Es la MISMA familia de bug que F-148 (0023 §4bis): una politica de SELECT
-- que depende de `thread_item_keys` vuelve invisible una fila para quien
-- todavia no tiene clave, y algo que necesitaba leerla para escribir se
-- rompe. F-148 lo resolvio para el propio `INSERT` (con `RETURNING`) y para
-- encontrar-o-crear el hilo (`app.resolve_thread`). Este `SELECT` de `otra`
-- quedo fuera de esa ronda porque hasta ahora nada dependia de que
-- acertara.
--
-- -----------------------------------------------------------------------------
-- EL ARREGLO -- MISMO PATRON QUE `app.resolve_thread` Y `app.can_access_thread`
-- -----------------------------------------------------------------------------
-- Una funcion `security definer` que hace la MISMA consulta pero sin pasar
-- por RLS -- el mismo cinturon que ya llevan las otras dos. No relaja
-- ninguna politica: el hilo YA se sabe accesible (`can_access_thread` lo
-- comprobo antes en las dos funciones que llaman aqui), asi que leer su
-- `org_low_id`/`org_high_id` no filtra nada que la politica no fuera a
-- dejar ver de todas formas -- lo unico que cambia es CUANDO se le permite
-- verlo.
-- =============================================================================

create or replace function app.thread_counterpart(p_thread_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when t.org_low_id = app.current_org_id() then t.org_high_id
              else t.org_low_id end
    from public.threads t where t.id = p_thread_id;
$$;

revoke execute on function app.thread_counterpart(uuid) from public, anon;
grant  execute on function app.thread_counterpart(uuid) to authenticated;

comment on function app.thread_counterpart(uuid) is
  'F-155: la organizacion de enfrente de un hilo, para quien participa en el. security definer a proposito -- el SELECT invoker equivalente cae bajo la politica de threads_select_participant (0019), que exige ya tener una clave envuelta en el hilo, y quien escribe su PRIMER elemento en un hilo con el ambito encendido todavia no la tiene. Mismo patron que app.resolve_thread (0023 §4bis) y app.can_access_thread (0003).';

-- -----------------------------------------------------------------------------
-- create_thread_item y counter_offer pasan a usar el helper. Nada mas
-- cambia -- ni una linea de logica de negocio, ni los mensajes de error.
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

  otra := app.thread_counterpart(p_thread_id);   -- F-155

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

  otra := app.thread_counterpart(anterior.thread_id);   -- F-155

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
