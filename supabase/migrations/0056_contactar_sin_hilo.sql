-- =============================================================================
-- 0056 · Contactar sin hilo previo (F-211): `open_thread`
-- =============================================================================
-- DIR-02 pide que `Contactar` «inicie o reutilice el hilo único con esa organización
-- sin requerir cantidad ni referencia». Hasta hoy el único camino que creaba un hilo
-- era `create_inquiry` (0014), que exige una línea publicada: con un hilo previo el
-- botón lo abría; sin él, quedaba apagado (F-211).
--
-- `open_thread` es el mismo patrón que `create_inquiry` sin la línea: valida el reparto de
-- la CEK con `app.guard_cek_recipients`, busca-o-crea el hilo con `app.resolve_thread` (fuera
-- de la política de lectura, F-148) y deja un primer MENSAJE cifrado con sus claves, todo en
-- la misma transacción. No devuelve la fila del hilo: un hilo sin elementos legibles es
-- invisible incluso para quien lo acaba de crear (0023 §4bis), así que devuelve solo el id.
--
-- Quién puede: lo que ya dicen las políticas de `thread_items` (miembro ACTIVE de su
-- organización; la inserción la valida `thread_items_insert_own`). La función es de quien
-- llama (no `security definer`), igual que `create_inquiry` y `create_thread_item`.
--
-- Lo que NO hace, y es deliberado: no manda correo ni aviso (no hay notificaciones); no
-- crea más que el mensaje (ni consulta ni oferta); y si el hilo ya existía, deja el mensaje
-- en él: el cliente abre el existente sin llamar a esto, pero la base no lo prohíbe.
-- =============================================================================

create or replace function public.open_thread(
  p_org_id     uuid,
  p_ciphertext text,
  p_iv         text,
  p_keys       jsonb
)
  returns uuid
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
declare
  t_low  uuid;
  t_high uuid;
  t_id   uuid;
  nuevo  uuid;
begin
  if p_org_id is null then
    raise exception 'Falta la organización con la que contactar.';
  end if;

  if p_org_id = app.current_org_id() then
    raise exception 'No puedes abrir un hilo con tu propia organización.';
  end if;

  if not exists (
    select 1 from public.organizations o
     where o.id = p_org_id and o.status = 'APPROVED'
  ) then
    raise exception 'Esa organización no existe o no está disponible.';
  end if;

  if coalesce(jsonb_array_length(p_keys), 0) = 0 then
    raise exception
      'Un elemento sin ninguna CEK envuelta seria ilegible para siempre, incluido para quien lo escribe.';
  end if;

  -- p_thread_id NULL a proposito: el hilo puede no existir todavia (mismo caso que
  -- `create_inquiry`); se resuelve DESPUES, con app.resolve_thread.
  perform app.guard_cek_recipients(app.current_org_id(), p_org_id, p_keys, null);

  t_low  := least(app.current_org_id(), p_org_id);
  t_high := greatest(app.current_org_id(), p_org_id);

  t_id := app.resolve_thread(t_low, t_high);

  nuevo := gen_random_uuid();      -- F-148, 0023 §4bis

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     content_ciphertext, content_iv)
  values
    (nuevo, t_id, app.current_org_id(), auth.uid(), 'MENSAJE',
     decode(p_ciphertext, 'hex'), decode(p_iv, 'hex'));

  insert into public.thread_item_keys
    (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
  select nuevo,
         (k->>'member_id')::uuid,
         decode(k->>'wrapped_cek', 'hex'),
         decode(k->>'wrap_iv', 'hex'),
         decode(k->>'ephemeral_pubkey', 'hex')
    from jsonb_array_elements(p_keys) k;

  return t_id;
end;
$function$;

-- Privilegios explicitos (F-146): la plataforma da EXECUTE a anon/authenticated por
-- DEFAULT PRIVILEGES y `revoke ... from public` no lo quita.
revoke execute on function public.open_thread(uuid, text, text, jsonb) from public, anon;
grant  execute on function public.open_thread(uuid, text, text, jsonb) to authenticated;

comment on function public.open_thread(uuid, text, text, jsonb) is
  'F-211: Contactar sin hilo previo. Busca-o-crea el hilo con otra organizacion y deja un primer MENSAJE cifrado con sus claves, en una transaccion. Devuelve el id del hilo.';
