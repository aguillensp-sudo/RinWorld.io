\encoding UTF8
-- ---------------------------------------------------------------------------
-- Siembra de hilos de demo · MSG-01 · Lista de Hilos · MSG-02 · Vista de un Hilo
--
-- ⚠ FICHERO GENERADO. No se edita a mano: se regenera con
--
--     VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs
--
-- porque el contenido va CIFRADO y a mano no se puede escribir. Los datos viven
-- en `supabase/seed/demo-content.mjs`, que comparte con el reseteo de fixture
-- del e2e. Los metadatos (tipo, referencia, marca, estados, fechas) sí se leen
-- aquí: van en claro en `thread_items` desde 0003 y son lo que MSG-01 pinta en
-- la vista previa.
--
-- ── QUÉ CAMBIÓ EL DÍA 8 (D-08-01, opción (a)) ──────────────────────────────
--
-- Hasta entonces esta siembra decía *"EL CONTENIDO CIFRADO ES RELLENO A
-- PROPÓSITO"*. Con la rebanada E2EE los cinco hilos habrían enseñado
-- `Contenido cifrado — introduce tu frase de seguridad para ver` en cada
-- elemento, el día 11, delante del socio.
--
-- Ahora el contenido es real. **El servidor sigue sin poder leerlo**: lo único
-- que se relaja es de dónde sale la clave. Quien tenga la semilla tiene todas
-- las privadas de la demo — NO es ADR-001 y no debe existir en V1 (F-067).
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1 · Las claves públicas de las dos cuentas
--
-- Sin esto, la contraparte no tiene con qué envolver una CEK y no puede
-- escribirle a nadie: el envío de MSG-02 se niega y dice de quién falta la
-- clave (0012 §3). La app las vuelve a publicar en cada arranque de sesión
-- (`keys.ts`); aquí se ponen para que la siembra se pueda abrir desde el primer
-- minuto, sin depender de que alguien haya entrado antes.
-- ---------------------------------------------------------------------------
update public.members set public_key = decode('88b183ffcecdc62459d8d3a7eee52bfd1b60ba9d70ec01344321d5068df5fd10', 'hex')
 where id = 'a1000000-0000-4000-8000-00000000000a';

update public.members set public_key = decode('53fbfb6d93ddf061137daed03ea41ce187839fc6a803a34686bbbfe1d004761b', 'hex')
 where id = 'b2000000-0000-4000-8000-00000000000b';

-- ---------------------------------------------------------------------------
-- 2 · Los cinco hilos, uno por estado del CHECK de `thread-lifecycle`
-- ---------------------------------------------------------------------------
insert into public.threads (id, org_low_id, org_high_id, created_by_org_id, state, last_item_at)
values
  -- Alpha ↔ Nordwälz Lager · el vendedor con quien se negocia en vivo en la demo
  ('11111111-0000-4000-8000-000000000001'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'CON OFERTA PENDIENTE', now() - interval '2 hours'),
  -- Alpha ↔ Cuscinetti Padana
  ('11111111-0000-4000-8000-000000000002'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'c3000000-0000-4000-8000-000000000003'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'CON CONSULTA PENDIENTE', now() - interval '5 hours'),
  -- Alpha ↔ Łożyska Wschód
  ('11111111-0000-4000-8000-000000000003'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'd4000000-0000-4000-8000-000000000004'::uuid,
   'd4000000-0000-4000-8000-000000000004'::uuid, 'ABIERTO', now() - interval '1 day'),
  -- Alpha ↔ Roulements Rhône
  ('11111111-0000-4000-8000-000000000004'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'e5000000-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'ACUERDO ALCANZADO', now() - interval '3 days'),
  -- Alpha ↔ Anadolu Rulman · el hilo cerrado de D-07-01
  ('11111111-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'f6000000-0000-4000-8000-000000000006'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'CERRADO SIN ACUERDO', now() - interval '7 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3 · El elemento de cada hilo, con contenido cifrado de verdad
--
-- ⚠ SE BORRA ANTES DE INSERTAR, y el borrado está acotado a estos cinco hilos.
-- Las instalaciones que corrieron la siembra anterior tienen los elementos de
-- relleno con ids aleatorios, así que un `on conflict (id)` no los alcanzaría y
-- quedarían los dos juegos —el viejo opaco y el nuevo legible— en el mismo
-- historial. Las filas de `thread_item_keys` se van solas por
-- `on delete cascade` (0003:270).
-- ---------------------------------------------------------------------------
delete from public.thread_items
 where thread_id in (
   '11111111-0000-4000-8000-000000000001'::uuid,
   '11111111-0000-4000-8000-000000000002'::uuid,
   '11111111-0000-4000-8000-000000000003'::uuid,
   '11111111-0000-4000-8000-000000000004'::uuid,
   '11111111-0000-4000-8000-000000000005'::uuid
 );

insert into public.thread_items
  (id, thread_id, sender_org_id, sender_member_id, item_type, created_at,
   part_number, brand, estado_consulta, estado_oferta,
   content_ciphertext, content_iv)
values
  ('12111111-0000-4000-8000-000000000001'::uuid, '11111111-0000-4000-8000-000000000001'::uuid,
   'b2000000-0000-4000-8000-000000000002'::uuid, 'b2000000-0000-4000-8000-00000000000b'::uuid,
   'OFERTA', now() - interval '2 hours',
   '6205-2RS', 'NSK', null, 'Pendiente',
   decode('2ceb89a2657b461be131f6d7bf9597576773f357cf514e9534091285f05edce24f5db5fcdc9e57fec2e20a505c0793f6b3054221e00ae621711c1a6f4a3e6c11939472196947b9f604cb49b9452c8e9a31b8e58c8c91820b03becbe9d9d1ae81e7e9b56c577eef3b5ab0e60c4492028f18e73bdb517d0981244d1435297b2d318de2d999f69b670666f03cd708626553dd668d3e7eec75b022a843dd9637204a5c180e83b58754b3ea8383f2eb473ffc2734aec14ce7de8ae40adeab91428875f518ca2b6610ea67959f19a6c7402e519e338c506d50d0f77dbfa96613a6e79395c3e7d61b65c42de559a250eeedf427fa95f4594771395d479e495ce8b53ce0a6a40c7eaf', 'hex'), decode('a3e441f7ad59372910f96dfd', 'hex')),
  ('12111111-0000-4000-8000-000000000002'::uuid, '11111111-0000-4000-8000-000000000002'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'CONSULTA', now() - interval '5 hours',
   'NU2210-E-TVP2', 'INA', 'Pendiente', null,
   decode('02f5226bcf32b351d34bebcf23138100cd22aebe00e2660eff5b35d9fdb3da49eef85a9bb903fe72623f80c1729e5ff09c3a45a86b25b2de6ea8224299a1760b0bbdfdc4e9dd53486664947d5825bb4ebb7ddfba9533aa82b33a6d9e819fc168d1c48e134361c654517cf5de836ca7e473fcb4a3f33bbaad81e5c0bfdee7cee041aef8301c', 'hex'), decode('96b2dfebd19b25e0d0f318da', 'hex')),
  ('12111111-0000-4000-8000-000000000003'::uuid, '11111111-0000-4000-8000-000000000003'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '24 hours',
   null, null, null, null,
   decode('b57f8be354cd32998bf85632b236a9f9527be5388725f3b861d488b8dab61a93cbc2b5662ec5f28283546fb0db43c33ed5164ce58f2510efb178b7a6ae9058371a0700b7ff0f8514ea4a8a6d05c4f203e9bbb113e5cceb91f882795c22b9f873ab1d3368699eca41562113085d11bd97e2071e0c7188eca2f45524bcdc23494f27ca85', 'hex'), decode('8c58eb8976081c9aec6bd314', 'hex')),
  ('12111111-0000-4000-8000-000000000004'::uuid, '11111111-0000-4000-8000-000000000004'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'OFERTA', now() - interval '72 hours',
   '22316-E', 'Timken', null, 'Aceptada',
   decode('b21d979795fd230b4d778aa13321c7c104c2210957dd4bcf133ed42fac197f5422656b58f18fd4748f503b08a2bb5ce46b714f20c6b6c83e2514d521f0d48b94a1ab87d35e700e5c840ff24b87c128101cf1516228b45da3259802904275cab5625c2eec64e703779d9d82b72fdf80ccfdc8a109ffdd666cdbe1054bd30d06fdd9ba6e47ebcc514a990796bf55ae848f05e52c04899d12002b5c09195a1579964e8d2ddf41d49c106c1ee6785d30ac74528c7baf23f719dbd692ad38a3ba365246d51ad2dc53cdea', 'hex'), decode('fb5295269f6003e49643b06a', 'hex')),
  ('12111111-0000-4000-8000-000000000005'::uuid, '11111111-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '168 hours',
   null, null, null, null,
   decode('3616e59b3e862a09a0f7e45734e860718030f83291e0062aae2e4e5d25b69b61da6b605a22cd611f4fdd315d74af5d3aef74cdf80ca83a3cd9c6421e6cde78fc5645e1a6f5fa8ef63c758ce0d50edb41fb8df8133274df3df5bb29177189cbdcc389e49e4de651147585b21885b8f768eefeecabc4bb11acd5384a331b2aeca60507ff660ad98eb70b26ef', 'hex'), decode('35b5d0806c632ad608239d54', 'hex'));

-- ---------------------------------------------------------------------------
-- 4 · La CEK de cada elemento, envuelta una vez por miembro que debe leerla
--
-- Los cuatro hilos con organizaciones sin cuenta llevan UNA sola fila: esas
-- cuatro no tienen miembros en el MVP, así que no hay a quién envolvérsela.
-- El hilo de Nordwälz lleva dos, una por cada parte.
-- ---------------------------------------------------------------------------
insert into public.thread_item_keys
  (item_id, recipient_member_id, wrapped_cek, wrap_iv, ephemeral_pubkey)
values
  ('12111111-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('8940a5915b9a9736d52e0f87c77cbefc5513f54472283e3ed331663158ff4a11c3a3ce6332a7db04606956bd954b1bb3', 'hex'), decode('07495780eb16c2a9022626df', 'hex'),
   decode('1d43e31ead4ca7c57110878b95bf32b5c3e990a587cfbd1603a2b73a9e669a78', 'hex')),
  ('12111111-0000-4000-8000-000000000001'::uuid, 'b2000000-0000-4000-8000-00000000000b'::uuid,
   decode('1e762afd7e90dc50abc22c6a78e822f8ae14c12fe88ee1f3689436caf7d5138de44393d4c17f16b364b3b35f48abc4c3', 'hex'), decode('32037f68b07085c4ffe2bf92', 'hex'),
   decode('322fab2f0f63f9c9d5ea30603d9a14443c228843ae2b2ced65c6aefeaa691f73', 'hex')),
  ('12111111-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('26e935805d0b36ad4a08bb00d6090829d21173146a7132b8c2518b5b5e69ec515906edc6f7b525170d296475a959e6fb', 'hex'), decode('4cfe19b07dd9ffa265dd0f27', 'hex'),
   decode('6487721cfc920c902f62662c84e32efa80983850d136a92ab613158f693ed361', 'hex')),
  ('12111111-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('bfa3c4508661fdb7001393d2d9ac35406edf1ef1f56f8731db1b87b54605a3caf836dfcd54d4e71aadb67c72e0ad9ba9', 'hex'), decode('70ea18afd22c9d1ac5048779', 'hex'),
   decode('197d03e4ace4cd5cf37132f8a3a1fcbeb2ebe964865eb715b2f6b666d970a37f', 'hex')),
  ('12111111-0000-4000-8000-000000000004'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('efffabf47c17d293473aa7f92bfd470a1b45bbd4160e63f1863c683adb9b6db3ae98742b877b41033e21676d5b70a326', 'hex'), decode('401791a50d73807033a4dbff', 'hex'),
   decode('b20b4ab23f99be173110d24df58146c7a0aa68dc855d27bb65735a7b13721d13', 'hex')),
  ('12111111-0000-4000-8000-000000000005'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('aa1801e221974570c38d86b838c389edbab08742fe719f677d5887a461b9a57176015116b5ea672a97fbbc17e818262a', 'hex'), decode('f3918aa21f6ceea687cd7840', 'hex'),
   decode('371611742a4a40f140e5be4ab641a5ba41ad6fd7adca33312375e266130b7300', 'hex'))
on conflict (item_id, recipient_member_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5 · Devolver el hilo de Anadolu a CERRADO SIN ACUERDO
--
-- ⚠ ESTO NO ES REDUNDANTE Y CUESTA UN ESTADO DE LA DEMO SI SE QUITA.
--
-- El `insert` de arriba dispara `app.sync_thread_state`, y desde 0009 **un
-- elemento nuevo reabre un hilo cerrado** (D-07-01, F-045): el hilo saldría de
-- aquí en ABIERTO, y MSG-01 dejaría de tener sus cinco estados — que es la razón
-- entera por la que hay cinco hilos y no uno.
--
-- El `update` pasa porque la siembra corre como `postgres`, y
-- `app.guard_thread_state` (0007:241) exime a `service_role` y `postgres`. Desde
-- el cliente esto no se podría hacer, y así debe ser.
-- ---------------------------------------------------------------------------
update public.threads set state = 'CERRADO SIN ACUERDO'
 where id = '11111111-0000-4000-8000-000000000005';
