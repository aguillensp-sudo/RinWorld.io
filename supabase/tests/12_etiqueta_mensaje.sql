-- =============================================================================
-- 12 · Etiqueta de referencia en los mensajes (`0080`)
-- =============================================================================
-- Change `amend-msg-hilos-pestanas-y-etiqueta`, requirement `message-reference-tag`
-- y `design.md` §1 y §8.
--
-- Se prueba como un miembro de verdad (rol `authenticated`, RLS encendida), no como
-- `postgres`: las guardias del hilo dejan pasar al superusuario a propósito, así que un
-- aserto hecho como `postgres` no comprobaría la regla del emisor.
-- Fixture propia (prefijo `12a`/`12b`/`12c`) dentro de una transacción que se deshace.
--
--   X · empresa A del hilo T · envía la consulta 6205-2RS · SKF y los mensajes
--   Y · empresa B del hilo T · la otra parte
--   Z · solo tiene hilo con X (T2), con 6206-ZZ · FAG: esa referencia NO es de T
--
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  x uuid := '12a00000-0000-4000-8000-000000000001';
  y uuid := '12a00000-0000-4000-8000-000000000002';
  z uuid := '12a00000-0000-4000-8000-000000000003';
  mx uuid := '12b00000-0000-4000-8000-000000000001';
  my uuid := '12b00000-0000-4000-8000-000000000002';
begin
  insert into public.organizations (id, name, country, continent, status) values
    (x, 'Doce X', 'ES', 'EU', 'APPROVED'),
    (y, 'Doce Y', 'DE', 'EU', 'APPROVED'),
    (z, 'Doce Z', 'FR', 'EU', 'APPROVED');

  insert into auth.users (id, email) values (mx, 'x@doce.test'), (my, 'y@doce.test');
  insert into public.members (id, org_id, email, role, state) values
    (mx, x, 'x@doce.test', 'EDITOR', 'PENDING_REVIEW'),
    (my, y, 'y@doce.test', 'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex')
   where id in (mx, my);

  -- T: X–Y. T2: X–Z. Orden canónico low < high (los ids ya van en orden).
  insert into public.threads (id, org_low_id, org_high_id, created_by_org_id) values
    ('12c00000-0000-4000-8000-000000000001', x, y, x),
    ('12c00000-0000-4000-8000-000000000002', x, z, x);

  insert into public.thread_items
    (id, thread_id, sender_org_id, sender_member_id, item_type,
     part_number, brand, estado_consulta, content_ciphertext, content_iv) values
    ('12d00000-0000-4000-8000-000000000001', '12c00000-0000-4000-8000-000000000001',
     x, mx, 'CONSULTA', '6205-2RS', 'SKF', 'Pendiente',
     decode(repeat('aa', 64), 'hex'), decode(repeat('04', 12), 'hex')),
    ('12d00000-0000-4000-8000-000000000002', '12c00000-0000-4000-8000-000000000002',
     x, mx, 'CONSULTA', '6206-ZZ', 'FAG', 'Pendiente',
     decode(repeat('aa', 64), 'hex'), decode(repeat('04', 12), 'hex'));
end
$$;

-- Actúa como el miembro indicado, con RLS. Se vuelve a `postgres` con `reset role`.
create function public.t12_como(p_member uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_member::text, true);
  execute 'set local role authenticated';
end;
$$;

-- La sentencia tiene que fallar; si pasa, el test falla con `p_que`.
create function public.t12_falla(p_sql text, p_que text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK · rechazado: % (%)', p_que, sqlerrm;
    return;
  end;
  raise exception 'DEBIA FALLAR y paso: %', p_que;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1 · Un mensaje con una referencia del hilo se guarda
-- -----------------------------------------------------------------------------
select public.t12_como('12b00000-0000-4000-8000-000000000001');

insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type,
   part_number, brand, content_ciphertext, content_iv)
values
  ('12d00000-0000-4000-8000-000000000010', '12c00000-0000-4000-8000-000000000001',
   '12a00000-0000-4000-8000-000000000001', '12b00000-0000-4000-8000-000000000001', 'MENSAJE',
   '6205-2RS', 'SKF', decode(repeat('bb', 48), 'hex'), decode(repeat('05', 12), 'hex'));

-- Y uno sin etiqueta (conversación general), como hasta ahora.
insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type, content_ciphertext, content_iv)
values
  ('12d00000-0000-4000-8000-000000000011', '12c00000-0000-4000-8000-000000000001',
   '12a00000-0000-4000-8000-000000000001', '12b00000-0000-4000-8000-000000000001', 'MENSAJE',
   decode(repeat('bb', 48), 'hex'), decode(repeat('05', 12), 'hex'));

do $$ begin raise notice 'OK · mensaje etiquetado y mensaje general guardados'; end $$;

-- -----------------------------------------------------------------------------
-- 2 · Lo que no es una referencia del hilo, no entra
-- -----------------------------------------------------------------------------
select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', '6206-ZZ', 'FAG',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'etiqueta de otro hilo (6206-ZZ · FAG está en T2, no en T)');

select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', '6205-2RS', 'FAG',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'referencia del hilo con otra marca (6205-2RS · FAG)');

select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', '6205-2rs', 'SKF',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'comparación exacta: 6205-2rs no es 6205-2RS (la etiqueta se elige, no se escribe)');

select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', '6205-2RS',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'solo part_number, sin marca');

select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, brand, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', 'SKF',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'solo marca, sin part_number');

-- El resto de la forma de un MENSAJE no se relaja.
select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, quantity,
     content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', '6205-2RS', 'SKF', 5,
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'mensaje etiquetado con cantidad (sigue siendo metadato de tarjeta)');

-- -----------------------------------------------------------------------------
-- 3 · El emisor cambia la etiqueta; el estado del hilo no se mueve
-- -----------------------------------------------------------------------------
reset role;
create temp table t12_antes as
  select state, last_item_at from public.threads where id = '12c00000-0000-4000-8000-000000000001';

select public.t12_como('12b00000-0000-4000-8000-000000000001');

update public.thread_items set part_number = null, brand = null
 where id = '12d00000-0000-4000-8000-000000000010';
update public.thread_items set part_number = '6205-2RS', brand = 'SKF'
 where id = '12d00000-0000-4000-8000-000000000011';

reset role;
do $$
declare n int;
begin
  select count(*) into n from public.thread_items
   where (id = '12d00000-0000-4000-8000-000000000010' and part_number is null and brand is null)
      or (id = '12d00000-0000-4000-8000-000000000011' and part_number = '6205-2RS' and brand = 'SKF');
  assert n = 2, 'el emisor no pudo cambiar la etiqueta de sus mensajes';
  raise notice 'OK · el emisor quita y pone la etiqueta';

  select count(*) into n
    from public.threads t, t12_antes a
   where t.id = '12c00000-0000-4000-8000-000000000001'
     and t.state is not distinct from a.state
     and t.last_item_at is not distinct from a.last_item_at;
  assert n = 1, 'cambiar la etiqueta movió el estado o last_item_at del hilo';
  raise notice 'OK · cambiar la etiqueta no mueve el hilo';
end
$$;

select public.t12_como('12b00000-0000-4000-8000-000000000001');

select public.t12_falla($q$
  update public.thread_items set part_number = '6206-ZZ', brand = 'FAG'
   where id = '12d00000-0000-4000-8000-000000000011'$q$,
  'el emisor reetiqueta con una referencia de otro hilo');

-- -----------------------------------------------------------------------------
-- 4 · Lo demás sigue sin reescribirse
-- -----------------------------------------------------------------------------
select public.t12_falla($q$
  update public.thread_items set content_ciphertext = decode(repeat('cc', 48), 'hex')
   where id = '12d00000-0000-4000-8000-000000000011'$q$,
  'el emisor cambia el texto cifrado de su mensaje');

select public.t12_falla($q$
  update public.thread_items set part_number = '6205-ZZ'
   where id = '12d00000-0000-4000-8000-000000000001'$q$,
  'el emisor cambia la referencia de su CONSULTA');

-- -----------------------------------------------------------------------------
-- 5 · La otra organización no toca la etiqueta
-- -----------------------------------------------------------------------------
reset role;
select public.t12_como('12b00000-0000-4000-8000-000000000002');

select public.t12_falla($q$
  update public.thread_items set part_number = null, brand = null
   where id = '12d00000-0000-4000-8000-000000000011'$q$,
  'la otra organización quita la etiqueta de un mensaje ajeno');

-- Además del rechazo, se comprueba el resultado: un update que no ve la fila no lanza
-- excepción, y el aserto de arriba lo daría por bueno sin que la guardia hubiera actuado.
reset role;
do $$
begin
  assert exists (select 1 from public.thread_items
                  where id = '12d00000-0000-4000-8000-000000000011'
                    and part_number = '6205-2RS' and brand = 'SKF'),
    'la otra organización cambió la etiqueta de un mensaje ajeno';
  raise notice 'OK · la etiqueta de un mensaje ajeno sigue intacta';
end
$$;

-- -----------------------------------------------------------------------------
-- 6 · La regla de «solo referencias del hilo» vale también para la siembra
-- -----------------------------------------------------------------------------
-- Las guardias del emisor dejan pasar a `postgres` (siembra, operador); la validación de la
-- etiqueta no: una siembra con una etiqueta inventada pintaría un mensaje sobre una
-- referencia que no está en el hilo.
select public.t12_falla($q$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, content_ciphertext, content_iv)
  values ('12c00000-0000-4000-8000-000000000001', '12a00000-0000-4000-8000-000000000001',
          '12b00000-0000-4000-8000-000000000001', 'MENSAJE', 'NU214', 'SKF',
          decode('bb','hex'), decode(repeat('05',12),'hex'))$q$,
  'postgres inserta un mensaje con una etiqueta que no es del hilo');

-- -----------------------------------------------------------------------------
-- 7 · `create_thread_item` (0081): la vía por la que la app envía los mensajes
-- -----------------------------------------------------------------------------
create function public.t12_claves() returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('member_id','12b00000-0000-4000-8000-000000000001',
                       'wrapped_cek', repeat('11',48), 'wrap_iv', repeat('07',12),
                       'ephemeral_pubkey', repeat('22',32)),
    jsonb_build_object('member_id','12b00000-0000-4000-8000-000000000002',
                       'wrapped_cek', repeat('33',48), 'wrap_iv', repeat('07',12),
                       'ephemeral_pubkey', repeat('44',32)))
$$;

select public.t12_como('12b00000-0000-4000-8000-000000000001');

do $$
declare etiquetado uuid; general uuid;
begin
  etiquetado := public.create_thread_item(
    '12c00000-0000-4000-8000-000000000001', 'MENSAJE', repeat('ab', 48), repeat('07', 12),
    public.t12_claves(), '6205-2RS', 'SKF');
  -- Con los cinco argumentos de siempre: la llamada que hace hoy la app sigue valiendo.
  general := public.create_thread_item(
    '12c00000-0000-4000-8000-000000000001', 'MENSAJE', repeat('ab', 48), repeat('07', 12),
    public.t12_claves());

  perform set_config('bw.t12_etiquetado', etiquetado::text, true);
  perform set_config('bw.t12_general', general::text, true);
end
$$;

select public.t12_falla($q$
  select public.create_thread_item(
    '12c00000-0000-4000-8000-000000000001', 'MENSAJE', repeat('ab', 48), repeat('07', 12),
    public.t12_claves(), '6206-ZZ', 'FAG')$q$,
  'create_thread_item con una etiqueta de otro hilo');

reset role;
do $$
begin
  assert (select (part_number, brand) = ('6205-2RS', 'SKF') from public.thread_items
           where id = current_setting('bw.t12_etiquetado')::uuid),
    'create_thread_item no guardó la etiqueta';
  assert (select part_number is null and brand is null from public.thread_items
           where id = current_setting('bw.t12_general')::uuid),
    'create_thread_item sin etiqueta tiene que guardar conversación general';
  assert not has_function_privilege('anon',
           'public.create_thread_item(uuid, text, text, text, jsonb, text, text)', 'execute'),
    'anon no puede ejecutar create_thread_item';
  assert has_function_privilege('authenticated',
           'public.create_thread_item(uuid, text, text, text, jsonb, text, text)', 'execute'),
    'authenticated tiene que poder ejecutar create_thread_item';
  assert (select count(*) from pg_proc where proname = 'create_thread_item') = 1,
    'queda más de una create_thread_item: la llamada de cinco argumentos sería ambigua';
  raise notice 'OK · create_thread_item guarda la etiqueta, sigue valiendo sin ella y no la ejecuta anon';
end
$$;

rollback;

\echo 'OK · 12 · etiqueta de referencia en los mensajes'
