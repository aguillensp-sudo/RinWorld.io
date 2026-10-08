-- =============================================================================
-- 0055 · La oferta se puede crear (MSG-03, F-099), la consulta se responde, y
--        `thread_items` deja de aceptar escrituras que se saltan la máquina de
--        estados (F-243, F-244, F-245)
-- =============================================================================
-- Sprint de demo (`openspec/v1/plan-demo-h5.md`, D1). Cinco piezas, una transacción:
--
-- 1. `estado_consulta` admite «Sin stock» (MSG-03 §3.1: PENDIENTE · RESPONDIDA ·
--    SIN STOCK). El CHECK de `0003` solo tenía `Pendiente` y `Respondida con oferta`.
--
-- 2. Los destinatarios de la CEK son los miembros ACTIVE (F-243). `thread_public_keys`
--    y `org_public_keys` devolvían a todos los miembros —también `REGISTERED`,
--    `CANCELLED` o `PENDING_REVIEW`, con la clave a NULL si no la tenían— y el cliente
--    se niega a enviar si a uno le falta (`0012` §3): una sola invitación sin activar
--    bloqueaba TODOS los envíos de y hacia su empresa (JULSA, 8-oct-2026). Desde `0039`
--    un miembro que no es ACTIVE no puede leer nada, así que envolverle la CEK no le
--    daba nada. **Lo que se conserva de `0012` §3:** un miembro ACTIVE sin clave sigue
--    saliendo, con la clave a NULL, y el cliente sigue negándose: ese fallo se ve.
--    `app.guard_cek_recipients` (V-2) exige el ADMIN solo si es ACTIVE; si no, una ADMIN
--    `REGISTERED` con clave sería obligatoria y ningún cliente podría incluirla.
--    **Consecuencia aceptada:** quien se activa después no lee lo que llegó antes.
--
-- 3. `public.create_offer` (F-099): la oferta que responde a una consulta —que pasa a
--    «Respondida con oferta» en la misma transacción (F-244)— o la oferta directa en un
--    hilo. Mismo procedimiento que `counter_offer` (`0021`/`0025`): destinatarios ya
--    calculados por el cliente, guardia del reparto, id antes de insertar (F-148).
--
-- 4. `estado_consulta` solo lo mueve quien RECIBIÓ la consulta, una vez y desde
--    `Pendiente` (F-245). «Respondida con oferta» exige una oferta que la responda.
--
-- 5. Integridad frente a escrituras directas (F-245). `authenticated` conserva
--    `INSERT`/`UPDATE` sobre la tabla (`0003`, y `F-192` sigue abierto), y las guardias
--    de la oferta solo miraban los cambios de estado. Desde aquí: toda OFERTA y toda
--    CONSULTA nacen `Pendiente`, y lo escrito —contenido cifrado, autoría, tipo,
--    referencia, cantidad, a qué responde— no se reescribe.
--
-- La siembra y el operador no pasan por las guardias nuevas: mismo criterio que
-- `app.guard_offer_decider` (`current_user` es `service_role`/`postgres`, o no hay
-- sesión). Por eso las guardias son `security invoker`: en una `definer`,
-- `current_user` sería su dueño y la excepción se activaría siempre.
--
-- **Por qué el texto de las guardias no nombra ninguna tabla:** el ancla de `F-155`
-- del banco lee el cuerpo de cada función `invoker`. Lo que necesita leer la tabla va
-- por `app.inquiry_has_offer`, que es `definer`.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · «Sin stock»
-- -----------------------------------------------------------------------------
alter table public.thread_items drop constraint thread_items_estado_consulta_chk;
alter table public.thread_items add constraint thread_items_estado_consulta_chk
  check (estado_consulta is null
         or estado_consulta in ('Pendiente', 'Respondida con oferta', 'Sin stock'));


-- -----------------------------------------------------------------------------
-- 2 · Destinatarios: solo miembros ACTIVE (F-243)
-- -----------------------------------------------------------------------------
-- Texto de producción (`pg_get_functiondef`, 8-oct-2026) con UNA línea nueva en cada
-- función, marcada. `create or replace` conserva dueño y permisos.

create or replace function public.thread_public_keys(t_id uuid)
  returns table(member_id uuid, org_id uuid, public_key bytea)
  language sql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
  with hilo as (
    select t.org_low_id, t.org_high_id
      from public.threads t
     where t.id = t_id
       and app.can_access_thread(t_id)
  ),
  yo as (select auth.uid() as id, app.current_org_id() as org),
  otra as (
    select case when (select org from yo) = h.org_low_id
                then h.org_high_id else h.org_low_id end as org
      from hilo h
  ),
  mios as (
    select ti.sender_member_id, ti.sender_org_id
      from public.thread_items ti
      join public.thread_item_keys k
        on k.item_id = ti.id and k.recipient_member_id = (select id from yo)
     where ti.thread_id = t_id
  ),
  participa_otra as (
    select distinct m.sender_member_id as id
      from mios m
     where m.sender_org_id = (select org from otra)
       and m.sender_member_id is not null
  ),
  destinatarios as (
    select mm.id
      from public.members mm, yo
     where mm.org_id = yo.org
       and (not app.org_scope_on(yo.org)
            or mm.id = yo.id
            or mm.visibility_scope = 'ORG_METADATA')
    union
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
     and m.state = 'ACTIVE'                                    -- 0055 · F-243
     and exists (select 1 from hilo)
   order by m.org_id, m.id;
$function$;

create or replace function public.org_public_keys(p_org_id uuid)
  returns table(member_id uuid, public_key bytea)
  language sql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
  select m.id, m.public_key
    from public.members m
    join public.organizations o on o.id = m.org_id
   where m.org_id = p_org_id
     and m.state = 'ACTIVE'                                    -- 0055 · F-243
     and (o.status = 'APPROVED' or o.id = app.current_org_id())
     and (
       p_org_id is distinct from app.current_org_id()
       or not app.org_scope_on(p_org_id)
       or m.id = auth.uid()
       or m.visibility_scope = 'ORG_METADATA'
     );
$function$;

-- La guardia, igual que en producción salvo V-2: el ADMIN obligatorio es el ACTIVE.
create or replace function app.guard_cek_recipients(p_org_propia uuid, p_org_otra uuid, p_keys jsonb, p_thread_id uuid default null::uuid)
  returns void
  language plpgsql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
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

  -- V-2 (0023), con el ADMIN ACTIVE desde 0055 (F-243): thread_public_keys y
  -- org_public_keys ya no devuelven a nadie que no lo sea.
  select string_agg(m.id::text, ', ') into faltan
    from public.members m
   where m.org_id in (p_org_propia, p_org_otra)
     and m.visibility_scope = 'ORG_METADATA'
     and m.state = 'ACTIVE'
     and m.public_key is not null
     and m.id::text not in (select k->>'member_id' from jsonb_array_elements(p_keys) k);

  if faltan is not null then
    raise exception
      'ADR-002 D-2 (adenda del 4-sep-2026) y V-2: el ADMIN de cada organizacion recibe copia de todos los elementos, y falta la de (%). Vuelve a pedir los destinatarios en vez de componer la lista a mano.',
      faltan;
  end if;

  -- F-154 · ningun destinatario ajeno a las dos organizaciones del intercambio.
  -- Aplica siempre, con o sin hilo.
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

  -- 0023 §4, backlog cerrado el 10-sep-2026 · con hilo existente, el reparto no
  -- puede tener MAS gente de la que thread_public_keys devuelve ahora mismo.
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
$function$;


-- -----------------------------------------------------------------------------
-- 3 · create_offer (F-099, F-244)
-- -----------------------------------------------------------------------------
-- Dos formas, decididas por `p_inquiry_id`:
--
--   · Respuesta a una consulta (`p_inquiry_id` dado). Solo la organización que la
--     RECIBIÓ, y solo si sigue `Pendiente`. Referencia y marca se heredan de la
--     consulta, no llegan por parámetro (igual que `counter_offer`). La consulta pasa
--     a «Respondida con oferta» en la misma transacción: sin eso, `derive_thread_state`
--     (que mira la consulta pendiente ANTES que el acuerdo) dejaría el hilo en
--     `CON CONSULTA PENDIENTE` aunque la oferta se acepte (F-244).
--   · Oferta directa (`p_inquiry_id` NULL). Cualquiera de las dos partes, dentro de un
--     hilo en el que participa; referencia y marca, obligatorias.
--
-- `security invoker`, como `counter_offer`: la inserción va bajo RLS
-- (`thread_items_insert_own` exige miembro ACTIVE, emisor = quien llama). Lo que lee
-- bajo RLS es la consulta, `for update`, y si no la ve FALLA con error en vez de
-- decidir en silencio — por eso entra en la superficie auditada de `F-155`.
create or replace function public.create_offer(
  p_thread_id   uuid,
  p_inquiry_id  uuid,
  p_part_number text,
  p_brand       text,
  p_ciphertext  text,
  p_iv          text,
  p_keys        jsonb,
  p_quantity    integer default null
)
  returns uuid
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
declare
  consulta public.thread_items%rowtype;
  hilo     uuid;
  ref      text;
  marca    text;
  otra     uuid;
  nueva    uuid;
begin
  if p_inquiry_id is not null then
    select * into consulta
      from public.thread_items
     where id = p_inquiry_id
       for update;

    if not found then
      raise exception 'La consulta que respondes no existe o no es visible.';
    end if;

    if consulta.item_type <> 'CONSULTA' then
      raise exception 'Solo se responde con oferta a una tarjeta de consulta (inquiry-card).';
    end if;

    if consulta.estado_consulta <> 'Pendiente' then
      raise exception
        'La consulta ya no esta Pendiente (estado actual: %). Para ofrecer otra cosa, haz una oferta directa en el hilo.',
        consulta.estado_consulta;
    end if;

    if consulta.sender_org_id = app.current_org_id() then
      raise exception
        'Una consulta la responde quien la recibe (inquiry-card): no puedes responder con oferta a tu propia consulta.';
    end if;

    if p_thread_id is not null and p_thread_id is distinct from consulta.thread_id then
      raise exception 'La consulta no pertenece a ese hilo.';
    end if;

    hilo  := consulta.thread_id;
    ref   := consulta.part_number;
    marca := consulta.brand;
  else
    if p_thread_id is null then
      raise exception 'Una oferta directa necesita el hilo en el que se hace.';
    end if;

    if not app.can_access_thread(p_thread_id) then
      raise exception 'El hilo no existe o tu organizacion no participa en el.';
    end if;

    ref   := nullif(btrim(p_part_number), '');
    marca := nullif(btrim(p_brand), '');

    if ref is null or marca is null then
      raise exception 'Una oferta directa necesita referencia y marca.';
    end if;

    if length(ref) > 100 or length(marca) > 100 then
      raise exception 'Referencia y marca no pueden pasar de 100 caracteres.';
    end if;

    hilo := p_thread_id;
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'La cantidad de la oferta no puede ser negativa.';
  end if;

  otra := app.thread_counterpart(hilo);   -- F-155

  perform app.guard_cek_recipients(app.current_org_id(), otra, p_keys, hilo);

  nueva := gen_random_uuid();      -- F-148, 0023 §4bis

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, estado_oferta, responds_to_item_id, quantity,
     content_ciphertext, content_iv)
  values
    (nueva, hilo, app.current_org_id(), auth.uid(), 'OFERTA',
     ref, marca, 'Pendiente', p_inquiry_id, p_quantity,
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'));

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nueva,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  -- Después de insertar la oferta: la guardia de la consulta (§4) exige que exista.
  if p_inquiry_id is not null then
    update public.thread_items
       set estado_consulta = 'Respondida con oferta'
     where id = p_inquiry_id;
  end if;

  return nueva;
end;
$function$;

revoke execute on function public.create_offer(uuid, uuid, text, text, text, text, jsonb, integer) from public, anon;
grant  execute on function public.create_offer(uuid, uuid, text, text, text, text, jsonb, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- 4 · La consulta la decide quien la recibe (F-245)
-- -----------------------------------------------------------------------------
-- Lectura sin RLS para la guardia de abajo, que es `invoker`. Solo dice si existe una
-- oferta que responda a esa consulta: no devuelve contenido.
create or replace function app.inquiry_has_offer(p_inquiry_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.thread_items o
     where o.item_type = 'OFERTA'
       and o.responds_to_item_id = p_inquiry_id
  );
$function$;

revoke execute on function app.inquiry_has_offer(uuid) from public, anon;
grant  execute on function app.inquiry_has_offer(uuid) to authenticated;

create or replace function app.guard_inquiry_decider()
  returns trigger
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
begin
  -- La siembra y el operador entran por aqui (mismo criterio que guard_offer_decider).
  if current_user in ('service_role','postgres') or auth.uid() is null then
    return new;
  end if;

  if old.item_type <> 'CONSULTA'
     or new.estado_consulta is not distinct from old.estado_consulta then
    return new;
  end if;

  if old.estado_consulta <> 'Pendiente' then
    raise exception
      'estado_consulta "%" es terminal (inquiry-card): una consulta se responde una vez.',
      old.estado_consulta;
  end if;

  if app.current_org_id() = old.sender_org_id then
    raise exception
      'Una consulta la decide quien la recibe (inquiry-card). La organizacion % la envio: no puede marcarla respondida ni sin stock.',
      old.sender_org_id;
  end if;

  if new.estado_consulta = 'Respondida con oferta' and not app.inquiry_has_offer(old.id) then
    raise exception
      'Una consulta pasa a "Respondida con oferta" cuando hay una oferta que la responde: usa create_offer.';
  end if;

  return new;
end;
$function$;

create trigger thread_items_guard_inquiry
  before update on public.thread_items
  for each row execute function app.guard_inquiry_decider();


-- -----------------------------------------------------------------------------
-- 5 · Lo escrito no se reescribe, y todo nace Pendiente (F-245)
-- -----------------------------------------------------------------------------
-- Fuera de la lista de lo inmutable, a propósito: `estado_oferta` y `estado_consulta`
-- (los vigilan sus guardias), `estado_changed_at` (lo pone `touch_item_estado`),
-- `superseded_by_item_id` (lo escribe `counter_offer`) e `inventory_line_id` (su clave
-- ajena es `on delete set null`).
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

  if (new.id, new.thread_id, new.sender_org_id, new.sender_member_id, new.item_type,
      new.created_at, new.part_number, new.brand, new.responds_to_item_id, new.quantity,
      new.content_ciphertext, new.content_iv)
     is distinct from
     (old.id, old.thread_id, old.sender_org_id, old.sender_member_id, old.item_type,
      old.created_at, old.part_number, old.brand, old.responds_to_item_id, old.quantity,
      old.content_ciphertext, old.content_iv) then
    raise exception
      'Lo escrito en un hilo no se reescribe: contenido cifrado, autoria, tipo, referencia, cantidad y a que responde son de solo lectura. Lo que cambia es el estado.';
  end if;

  return new;
end;
$function$;

create trigger thread_items_guard_integrity
  before insert or update on public.thread_items
  for each row execute function app.guard_thread_item_integrity();
