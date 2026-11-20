-- =============================================================================
-- 14 · Etiquetar un mensaje con una línea publicada de la otra empresa (`0083`)
-- =============================================================================
-- Decisión del PO del 20-nov-2026 (`DECISIONES-V1.md`): `Contactar` desde Comprando abre el hilo
-- etiquetado con la referencia de la línea marcada, aunque esa referencia todavía no esté en ninguna
-- consulta ni oferta del hilo. Amplía la regla de `0080` (`12_etiqueta_mensaje.sql`).
--
-- Una etiqueta vale si la referencia (part_number y marca exactos):
--   a) está en una CONSULTA u OFERTA del hilo (0080), o
--   b) ya etiqueta otro MENSAJE del hilo (para poder contestar con la misma), o
--   c) es una línea PUBLICADA de la otra empresa del hilo.
-- Y `open_thread` acepta la etiqueta en el primer mensaje, con la misma regla.
--
-- Como un miembro de verdad (rol `authenticated`, RLS encendida). Fixture `14a`-`14e`, en una
-- transacción que se deshace.
--
--   X · quien contacta (mx)          Y · la otra empresa del hilo T (my)
--   Z · sin hilo con X todavía (mz)
--
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  x uuid := '14a00000-0000-4000-8000-000000000001';
  y uuid := '14a00000-0000-4000-8000-000000000002';
  z uuid := '14a00000-0000-4000-8000-000000000003';
  mx uuid := '14b00000-0000-4000-8000-000000000001';
  my uuid := '14b00000-0000-4000-8000-000000000002';
  mz uuid := '14b00000-0000-4000-8000-000000000003';
begin
  insert into public.organizations (id, name, country, continent, status) values
    (x, 'Catorce X', 'ES', 'EU', 'APPROVED'),
    (y, 'Catorce Y', 'DE', 'EU', 'APPROVED'),
    (z, 'Catorce Z', 'FR', 'EU', 'APPROVED');

  insert into auth.users (id, email) values (mx, 'x@catorce.test'), (my, 'y@catorce.test'), (mz, 'z@catorce.test');
  insert into public.members (id, org_id, email, role, state) values
    (mx, x, 'x@catorce.test', 'EDITOR', 'PENDING_REVIEW'),
    (my, y, 'y@catorce.test', 'EDITOR', 'PENDING_REVIEW'),
    (mz, z, 'z@catorce.test', 'EDITOR', 'PENDING_REVIEW');
  update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex')
   where id in (mx, my, mz);

  -- Hilo T entre X e Y, sin ningún elemento con referencia.
  insert into public.threads (id, org_low_id, org_high_id, created_by_org_id) values
    ('14c00000-0000-4000-8000-000000000001', x, y, x);

  -- Inventario: de Y, una publicada y una en borrador; de X (la propia), una publicada; de Z, una publicada.
  insert into public.inventory_lines (id, org_id, part_number, brand, quantity, status, location_country)
  values
    ('14e00000-0000-4000-8000-000000000001', y, '6205-2RS', 'SKF', 100, 'PUBLISHED', 'DE'),
    ('14e00000-0000-4000-8000-000000000002', y, '6310', 'FAG', 10, 'DRAFT', 'DE'),
    ('14e00000-0000-4000-8000-000000000003', x, '22208', 'SKF', 5, 'PUBLISHED', 'ES'),
    ('14e00000-0000-4000-8000-000000000004', z, '7205B', 'NSK', 40, 'PUBLISHED', 'FR');
end
$$;

create function public.t14_como(p_member uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_member::text, true);
  execute 'set local role authenticated';
end;
$$;

create function public.t14_falla(p_sql text, p_que text) returns void language plpgsql as $$
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

-- Una CEK envuelta (de mentira) para cada miembro indicado.
create function public.t14_claves(variadic p_miembros uuid[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
           'member_id', m, 'wrapped_cek', repeat('cd', 40), 'wrap_iv', repeat('2b', 12),
           'ephemeral_pubkey', repeat('ef', 32)))
    from unnest(p_miembros) m;
$$;

-- Un MENSAJE etiquetado en T, como `create_thread_item` (0081) lo deja.
create function public.t14_mensaje(p_member uuid, p_org uuid, p_part text, p_brand text) returns void
  language sql as $$
  insert into public.thread_items
    (thread_id, sender_org_id, sender_member_id, item_type, part_number, brand, content_ciphertext, content_iv)
  values ('14c00000-0000-4000-8000-000000000001', p_org, p_member, 'MENSAJE', p_part, p_brand,
          decode(repeat('bb', 48), 'hex'), decode(repeat('05', 12), 'hex'));
$$;

-- -----------------------------------------------------------------------------
-- 1 · Una línea publicada de la otra empresa sirve de etiqueta, aunque no esté en el hilo
-- -----------------------------------------------------------------------------
select public.t14_como('14b00000-0000-4000-8000-000000000001');
select public.t14_mensaje('14b00000-0000-4000-8000-000000000001', '14a00000-0000-4000-8000-000000000001',
                          '6205-2RS', 'SKF');
do $$ begin raise notice 'OK · X etiqueta con 6205-2RS · SKF, publicada por Y, sin consulta ni oferta en el hilo'; end $$;

-- -----------------------------------------------------------------------------
-- 2 · Lo que no es una línea publicada de la otra empresa, no
-- -----------------------------------------------------------------------------
select public.t14_falla($q$ select public.t14_mensaje('14b00000-0000-4000-8000-000000000001',
  '14a00000-0000-4000-8000-000000000001', '6310', 'FAG') $q$,
  'una línea de Y en borrador (DRAFT) no es etiqueta');
select public.t14_falla($q$ select public.t14_mensaje('14b00000-0000-4000-8000-000000000001',
  '14a00000-0000-4000-8000-000000000001', '22208', 'SKF') $q$,
  'una línea publicada de la PROPIA empresa no es etiqueta (la regla es la otra empresa)');
select public.t14_falla($q$ select public.t14_mensaje('14b00000-0000-4000-8000-000000000001',
  '14a00000-0000-4000-8000-000000000001', '7205B', 'NSK') $q$,
  'una línea de Z, que no es de este hilo, no es etiqueta');
select public.t14_falla($q$ select public.t14_mensaje('14b00000-0000-4000-8000-000000000001',
  '14a00000-0000-4000-8000-000000000001', '6205-2RS', 'FAG') $q$,
  'la referencia publicada con otra marca no es etiqueta');

-- -----------------------------------------------------------------------------
-- 3 · La otra empresa contesta con la misma etiqueta (ya etiqueta un mensaje del hilo)
-- -----------------------------------------------------------------------------
reset role;
-- Y despublica la línea: la contestación tiene que valer igual, por el mensaje que ya la lleva.
update public.inventory_lines set status = 'ARCHIVED' where id = '14e00000-0000-4000-8000-000000000001';
select public.t14_como('14b00000-0000-4000-8000-000000000002');
select public.t14_mensaje('14b00000-0000-4000-8000-000000000002', '14a00000-0000-4000-8000-000000000002',
                          '6205-2RS', 'SKF');
do $$ begin raise notice 'OK · Y contesta etiquetado con 6205-2RS · SKF: la etiqueta ya estaba en el hilo'; end $$;

-- -----------------------------------------------------------------------------
-- 4 · open_thread: el primer mensaje sale etiquetado con una línea publicada de la otra empresa
-- -----------------------------------------------------------------------------
reset role;
create table public.t14_resultado (hilo uuid);
grant all on public.t14_resultado to authenticated;

select public.t14_como('14b00000-0000-4000-8000-000000000001');

select public.t14_falla($q$ select public.open_thread('14a00000-0000-4000-8000-000000000003', repeat('ab', 48),
  repeat('1a', 12), public.t14_claves('14b00000-0000-4000-8000-000000000001', '14b00000-0000-4000-8000-000000000003'),
  '6205-2RS', 'SKF') $q$,
  'open_thread con una etiqueta que no es línea publicada de Z');
select public.t14_falla($q$ select public.open_thread('14a00000-0000-4000-8000-000000000003', repeat('ab', 48),
  repeat('1a', 12), public.t14_claves('14b00000-0000-4000-8000-000000000001', '14b00000-0000-4000-8000-000000000003'),
  '7205B', null) $q$,
  'open_thread con referencia y sin marca (los dos o ninguno)');

insert into public.t14_resultado
  select public.open_thread('14a00000-0000-4000-8000-000000000003', repeat('ab', 48), repeat('1a', 12),
    public.t14_claves('14b00000-0000-4000-8000-000000000001', '14b00000-0000-4000-8000-000000000003'),
    '7205B', 'NSK');

reset role;

do $$
declare
  h uuid;
  r record;
begin
  select hilo into strict h from public.t14_resultado;
  select item_type, part_number, brand into strict r from public.thread_items where thread_id = h;
  assert r.item_type = 'MENSAJE' and r.part_number = '7205B' and r.brand = 'NSK',
    format('el primer mensaje tendria que ir etiquetado 7205B · NSK: %s %s %s', r.item_type, r.part_number, r.brand);
  raise notice 'OK · open_thread deja el primer mensaje etiquetado con la línea publicada de Z';
end
$$;

-- Sin etiqueta sigue funcionando como antes (conversación general).
select public.t14_como('14b00000-0000-4000-8000-000000000001');
select public.open_thread('14a00000-0000-4000-8000-000000000003', repeat('ab', 48), repeat('1a', 12),
  public.t14_claves('14b00000-0000-4000-8000-000000000001', '14b00000-0000-4000-8000-000000000003'));
reset role;

do $$
begin
  assert (select count(*) from public.thread_items i join public.t14_resultado r on r.hilo = i.thread_id
           where i.part_number is null) = 1,
    'open_thread sin etiqueta deja un mensaje general en el mismo hilo';
  assert not has_function_privilege('anon', 'public.open_thread(uuid,text,text,jsonb,text,text)', 'execute'),
    'anon no ejecuta open_thread';
  assert has_function_privilege('authenticated', 'public.open_thread(uuid,text,text,jsonb,text,text)', 'execute'),
    'authenticated ejecuta open_thread';
  assert (select count(*) from pg_proc where proname = 'open_thread') = 1, 'queda una sola firma de open_thread';
  raise notice 'OK · open_thread sin etiqueta como antes; una sola firma; privilegios';
end
$$;

rollback;
