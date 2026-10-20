-- =============================================================================
-- 09 · Dos escenarios SIN_PRUEBA de la matriz que solo la base puede probar
-- =============================================================================
-- `billing-subscription/automatic-suspension#3` (datos conservados al suspender) y
-- `inventory-management/inventory-line-lifecycle#3` (tope de 500.000 líneas PUBLISHED).
-- Se aserta desde la SPEC, no desde el código (como `07`). Fixture propia (prefijo `9a`/`9b`).
-- Corre después de 08, en la misma base: el barrido automático de `billing_evaluate_expirations`
-- toca TODAS las organizaciones vencidas, y las de 01/07/08 nacen hoy, así que no le alcanza a ninguna.
-- Escrito por Claude Code; no es contrato del arnés.
-- =============================================================================

\set ON_ERROR_STOP on

create or replace function public.t9_org(n int) returns uuid language sql immutable as
  $$ select ('9a000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function public.t9_mem(n int) returns uuid language sql immutable as
  $$ select ('9b000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Organizaciones 1 (se suspende a mano), 2 (se suspende sola) y 3 (contraparte), cada una con
-- su ADMIN ACTIVO; 1 y 2 con backup de clave completo (ADR-001). La 4 es la del tope de líneas.
-- El 9 es el Operador de Plataforma.
do $$
begin
  for n in 1..4 loop
    insert into auth.users (id, email) values (public.t9_mem(n), 'n' || n || '@nueve.test');
    insert into public.organizations (id, name, country, continent, status)
    values (public.t9_org(n), 'Nueve ' || n, 'FR', 'EU', 'APPROVED');
    insert into public.members (id, org_id, email, role, state)
    values (public.t9_mem(n), public.t9_org(n), 'n' || n || '@nueve.test', 'EDITOR', 'PENDING_REVIEW');
    update public.members set state = 'ACTIVE', public_key = decode(repeat('ab', 32), 'hex') where id = public.t9_mem(n);
  end loop;
  insert into auth.users (id, email) values (public.t9_mem(9), 'op@nueve.test');
  insert into public.platform_operators (id, full_name) values (public.t9_mem(9), 'Operador nueve');

  update public.members
     set encrypted_key_blob = decode(repeat('c1', 64), 'hex'),
         key_iv             = decode(repeat('c2', 12), 'hex'),
         argon2_salt        = decode(repeat('c3', 32), 'hex'),
         kdf_params         = '{"alg":"argon2id","m":65536,"t":3,"p":1}'::jsonb,
         key_verifier       = decode(repeat('c4', 32), 'hex')
   where id in (public.t9_mem(1), public.t9_mem(2));

  -- Inventario: tres líneas en tres estados para 1 y para 2.
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  select public.t9_org(o), '6204-2RS', 'SKF', 100 * o + i, 'FR', 'RIGIDO_BOLAS', s
    from (values (1), (2)) as orgs(o),
         (values (1, 'PUBLISHED'), (2, 'DRAFT'), (3, 'ARCHIVED')) as l(i, s);

  -- Mensajería: un hilo de cada una con la 3, con un elemento cifrado y su CEK para cada miembro.
  for n in 1..2 loop
    insert into public.threads (id, org_low_id, org_high_id, created_by_org_id)
    values (('9c000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            least(public.t9_org(n), public.t9_org(3)), greatest(public.t9_org(n), public.t9_org(3)), public.t9_org(n));
    insert into public.thread_items
      (id, thread_id, sender_org_id, sender_member_id, item_type, part_number, brand,
       estado_consulta, content_ciphertext, content_iv)
    values (('9d000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            ('9c000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            public.t9_org(n), public.t9_mem(n), 'CONSULTA', '6204-2RS', 'SKF', 'Pendiente',
            decode(repeat('ee', 96), 'hex'), decode(repeat('09', 12), 'hex'));
    insert into public.thread_item_keys (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
    select ('9d000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, m,
           decode(repeat('11', 48), 'hex'), decode(repeat('14', 12), 'hex'), decode(repeat('22', 32), 'hex')
      from unnest(array[public.t9_mem(n), public.t9_mem(3)]) as m;
  end loop;

  -- Favoritos en los dos sentidos: los de 1 y 2 (dados) y los que reciben de la 3.
  insert into public.favorite_distributors (member_id, distributor_org_id) values
    (public.t9_mem(1), public.t9_org(3)), (public.t9_mem(2), public.t9_org(3)),
    (public.t9_mem(3), public.t9_org(1)), (public.t9_mem(3), public.t9_org(2));
end
$$;

-- La huella de TODO lo que la spec dice que se conserva, de una organización: inventario (con su
-- estado), claves (pública y backup), mensajería (hilos, elementos y CEK) y favoritos en los dos
-- sentidos. Devuelve también cuántas filas entran, para que una huella vacía no pase por buena.
create or replace function public.t9_huella(o uuid, out filas int, out huella text)
language sql stable as $$
  with t as (
    select 'inv:' || id || status || quantity || part_number || last_upload_at as x
      from public.inventory_lines where org_id = o
    union all
    select 'mem:' || id || state || role || encode(public_key, 'hex') || encode(encrypted_key_blob, 'hex')
           || encode(key_iv, 'hex') || encode(argon2_salt, 'hex') || kdf_params::text || encode(key_verifier, 'hex')
      from public.members where org_id = o
    union all
    select 'hil:' || id || state from public.threads where o in (org_low_id, org_high_id)
    union all
    select 'ite:' || i.id || coalesce(i.estado_consulta, '') || encode(i.content_ciphertext, 'hex')
      from public.thread_items i join public.threads h on h.id = i.thread_id where o in (h.org_low_id, h.org_high_id)
    union all
    select 'cek:' || k.item_id || k.recipient_member_id || encode(k.wrapped_cek, 'hex')
      from public.thread_item_keys k join public.thread_items i on i.id = k.item_id
      join public.threads h on h.id = i.thread_id where o in (h.org_low_id, h.org_high_id)
    union all
    select 'fav:' || f.member_id || f.distributor_org_id
      from public.favorite_distributors f join public.members m on m.id = f.member_id
     where m.org_id = o or f.distributor_org_id = o
  )
  select count(*)::int, md5(string_agg(x, '|' order by x)) from t;
$$;

-- -----------------------------------------------------------------------------
-- 1 · automatic-suspension#3 · datos conservados durante la suspensión, por las dos vías
-- -----------------------------------------------------------------------------
do $$
declare
  antes1 record; antes2 record; despues1 record; despues2 record; n int;
begin
  select * into antes1 from public.t9_huella(public.t9_org(1));
  select * into antes2 from public.t9_huella(public.t9_org(2));
  -- 3 líneas + 1 miembro + 1 hilo + 1 elemento + 2 CEK + 2 favoritos = 10.
  assert antes1.filas = 10 and antes2.filas = 10, '09 · control positivo: la huella cuenta las 10 filas de cada organización';

  -- Vía manual: el operador suspende la 1 (ADMIN-02).
  perform set_config('request.jwt.claim.sub', public.t9_mem(9)::text, true);
  set local role authenticated;
  perform public.billing_suspend_organization(public.t9_org(1));
  reset role;

  -- Vía automática (RNG-BILL-05): la 2 nació hace 100 días y nunca pagó.
  update public.organizations set created_at = now() - interval '100 days' where id = public.t9_org(2);
  n := app.billing_evaluate_expirations();
  assert n = 1, format('09 · el barrido automático suspende solo la vencida (suspendió %s)', n);

  assert (select status from public.organizations where id = public.t9_org(1)) = 'SUSPENDED', '09 · la 1 queda SUSPENDED';
  assert (select status from public.organizations where id = public.t9_org(2)) = 'SUSPENDED', '09 · la 2 queda SUSPENDED';

  select * into despues1 from public.t9_huella(public.t9_org(1));
  select * into despues2 from public.t9_huella(public.t9_org(2));
  assert despues1 = antes1,
    'automatic-suspension#3: suspender a mano no toca inventario, claves, mensajería ni favoritos';
  assert despues2 = antes2,
    'automatic-suspension#3: la suspensión automática no toca inventario, claves, mensajería ni favoritos';
  raise notice 'OK · automatic-suspension#3: al suspender (a mano y sola) los datos quedan íntegros';
end
$$;

-- -----------------------------------------------------------------------------
-- 2 · inventory-line-lifecycle#3 · el tope de 500.000 líneas PUBLISHED bloquea la subida
-- -----------------------------------------------------------------------------
do $$
declare ok boolean;
begin
  -- Justo en el tope, en una sola sentencia (como una subida): entra.
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  select public.t9_org(4), 'R-' || g, 'FAG', 1, 'FR', 'RIGIDO_BOLAS', 'PUBLISHED' from generate_series(1, 500000) g;
  assert (select count(*) from public.inventory_lines where org_id = public.t9_org(4) and status = 'PUBLISHED') = 500000,
    '09 · control positivo: 500.000 PUBLISHED entran';

  -- Una más: la subida entera se rechaza y no deja nada.
  ok := false;
  begin
    insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
    values (public.t9_org(4), 'R-extra', 'FAG', 1, 'FR', 'RIGIDO_BOLAS', 'PUBLISHED');
  exception when others then
    ok := sqlerrm like 'Límite de inventario alcanzado%Archiva o elimina stock antes de continuar.';
  end;
  assert ok, 'inventory-line-lifecycle#3: la línea 500.001 se bloquea, con el motivo de archivar o eliminar';

  -- Por la otra puerta: publicar un borrador también pasaría del tope.
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  values (public.t9_org(4), 'R-borrador', 'FAG', 1, 'FR', 'RIGIDO_BOLAS', 'DRAFT');
  ok := false;
  begin
    update public.inventory_lines set status = 'PUBLISHED' where org_id = public.t9_org(4) and part_number = 'R-borrador';
  exception when others then
    ok := sqlerrm like 'Límite de inventario alcanzado%';
  end;
  assert ok, 'inventory-line-lifecycle#3: publicar un borrador por encima del tope también se bloquea';
  assert (select count(*) from public.inventory_lines where org_id = public.t9_org(4) and status = 'PUBLISHED') = 500000,
    '09 · tras los dos rechazos siguen 500.000 PUBLISHED';

  -- El tope es por organización: otra no lo nota.
  insert into public.inventory_lines (org_id, part_number, brand, quantity, location_country, product_family, status)
  values (public.t9_org(3), 'R-otra', 'FAG', 1, 'FR', 'RIGIDO_BOLAS', 'PUBLISHED');

  delete from public.inventory_lines where org_id = public.t9_org(4);
  raise notice 'OK · inventory-line-lifecycle#3: el tope de 500.000 PUBLISHED bloquea la subida y la publicación';
end
$$;

-- -----------------------------------------------------------------------------
-- 3 · automatic-suspension#2 y active-account-access#2 · lo que ven LOS DEMÁS de una suspendida
-- -----------------------------------------------------------------------------
-- La 1 sigue SUSPENDED desde el bloque 1 y tiene una línea PUBLISHED. Quien mira es el miembro
-- de la 3 (APPROVED, ACTIVE). La pantalla de suspensión del propio miembro es del cliente
-- (`session.suspension.escenarios.test.ts`); aquí, solo la visibilidad.
do $$
declare
  n int;
begin
  insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id)
  select '9e000000-0000-4000-8000-000000000001', c.id, 'Hilo de una suspendida', public.t9_mem(1), public.t9_org(1)
    from public.forum_categories c order by c.position limit 1;
  insert into public.forum_posts (thread_id, author_member_id, author_org_id, body)
  values ('9e000000-0000-4000-8000-000000000001', public.t9_mem(1), public.t9_org(1), 'Publicado antes de la suspensión');

  perform set_config('request.jwt.claim.sub', public.t9_mem(3)::text, true);
  set local role authenticated;

  -- La búsqueda (`search.ts`) cruza con `organizations` con `!inner`: este es el mismo cruce.
  select count(*) into n
    from public.inventory_lines l join public.organizations o on o.id = l.org_id
   where l.org_id = public.t9_org(1) and l.status = 'PUBLISHED';
  assert n = 0, format('automatic-suspension#2: el inventario de una suspendida no sale en la búsqueda de otros (salen %s)', n);

  -- Control: la línea existe y la RLS de `inventory_lines` sola la deja leer. Lo que la oculta es
  -- `organizations_select_approved` en el cruce, no la política del inventario (F-275).
  select count(*) into n from public.inventory_lines where org_id = public.t9_org(1) and status = 'PUBLISHED';
  assert n = 1, format('09 · control: la línea PUBLISHED de la suspendida existe (%s)', n);

  select count(*) into n from public.forum_posts where author_org_id = public.t9_org(1);
  assert n = 1, format('active-account-access#2: lo publicado por la suspendida sigue visible para los demás (%s)', n);
  select count(*) into n from public.forum_thread_list where author_org_id = public.t9_org(1);
  assert n = 1, format('active-account-access#2: su hilo sigue en la lista del foro (%s)', n);
  select count(*) into n from public.forum_post_detail where author_org_id = public.t9_org(1);
  assert n = 1, format('active-account-access#2: su publicación sigue en el detalle del hilo (%s)', n);

  reset role;
  raise notice 'OK · automatic-suspension#2 y active-account-access#2: inventario fuera de la búsqueda, foro visible';
end
$$;
