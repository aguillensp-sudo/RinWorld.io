\encoding UTF8
-- ---------------------------------------------------------------------------
-- Siembra de hilos de demo · MSG-01 · Lista de Hilos · MSG-02 · Vista de un Hilo
--
-- ⚠ FICHERO GENERADO. No se edita a mano: se regenera con
--
--     VITE_DEMO_KEY_SEED=... node supabase/seed/generate-demo-content.mjs
--
-- porque el contenido va CIFRADO y a mano no se puede escribir. Los metadatos
-- (tipo, referencia, marca, estados, fechas) sí se leen aquí: van en claro en
-- `thread_items` desde 0003 y son lo que MSG-01 pinta en la vista previa.
--
-- ── QUÉ CAMBIÓ EL DÍA 8 (D-08-01, opción (a)) ──────────────────────────────
--
-- Hasta ayer esta siembra decía *"EL CONTENIDO CIFRADO ES RELLENO A PROPÓSITO"*
-- y llevaba `decode('a1b2c3d4e5f6','hex')` en los cinco elementos. Daba igual
-- mientras MSG-01 nunca descifrara. Con la rebanada E2EE dejó de dar igual: los
-- cinco hilos de la demo habrían enseñado `Contenido cifrado — introduce tu
-- frase de seguridad para ver` en cada elemento, el día 11, delante del socio.
--
-- Ahora el contenido es real y se abre con las claves deterministas de la demo.
-- **El servidor sigue sin poder leerlo**: lo único que se relaja es de dónde
-- sale la clave, no quién puede descifrar. Quien tenga la semilla tiene todas
-- las privadas de la demo — vale para datos inventados y para nada más, NO es
-- ADR-001 y no debe existir en V1.
--
-- Cinco hilos de Rodamientos Ibéricos (Alpha), uno por cada estado del CHECK de
-- `thread-lifecycle`. El orden canónico del par (`org_low_id < org_high_id`) lo
-- impone la base; Alpha es el UUID más bajo de las seis, así que va siempre de
-- `org_low_id`.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1 · Las claves públicas de las dos cuentas
--
-- Sin esto, la contraparte no tiene con qué envolver una CEK y no puede
-- escribirle a nadie: el envío de MSG-02 se niega y dice de quién falta la
-- clave (0012 §3). La app las vuelve a publicar en cada arranque de sesión
-- (`keys.ts`); aquí se ponen para que la siembra de abajo se pueda abrir desde
-- el primer minuto, sin depender de que alguien haya entrado antes.
-- ---------------------------------------------------------------------------
update public.members set public_key = decode('88b183ffcecdc62459d8d3a7eee52bfd1b60ba9d70ec01344321d5068df5fd10', 'hex')
 where id = 'a1000000-0000-4000-8000-00000000000a';

update public.members set public_key = decode('53fbfb6d93ddf061137daed03ea41ce187839fc6a803a34686bbbfe1d004761b', 'hex')
 where id = 'b2000000-0000-4000-8000-00000000000b';

-- ---------------------------------------------------------------------------
-- 2 · Los cinco hilos
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
-- No es un capricho: las instalaciones que ya corrieron la siembra anterior
-- tienen los elementos de relleno con ids aleatorios, así que un
-- `on conflict (id)` no los alcanzaría y quedarían los dos juegos — el viejo
-- opaco y el nuevo legible, en el mismo historial. Las filas de
-- `thread_item_keys` se van solas por `on delete cascade` (0003:270).
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
   decode('9e9a9897e452f825e889887f48257b007a23e77775c8f5b273d251f0579192062c14e815365064a7cce47bcea915d46f037e69892ba255839b325ab9506bcc6b8f3fb62beac9ad4a96649502e069bc702d7c010dbba410dbccde758922d1c5d68360c61d92f075515288601f5a3f45655c842a555e2eca882ab352c8adda6d4505abf0714fd4da158943527bc6e6b7b8e3b26633585a056a6c5ac426ba164888fde06106b43d8b3fa5675cc23b1504a2ebb08f21a067638f2f5654e72eaa119e18f23355025628c7306741db53210d510979590d62ea7e91ef32af5970c39d37babe484eed8c993edbaf184e2d11ae4ca6e39bf316efe47a66931b2096466d02e696274ead', 'hex'), decode('d7c94b023766fd20292a4f0c', 'hex')),
  ('12111111-0000-4000-8000-000000000002'::uuid, '11111111-0000-4000-8000-000000000002'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'CONSULTA', now() - interval '5 hours',
   'NU2210-E-TVP2', 'INA', 'Pendiente', null,
   decode('3139524b44460b0905a219596f89dad9bfd514377d2c4b8e85f9177dcc6acc44d3eafb838a75a5d7d108738db2be7b188377ffe9b552893e7b42d7d9de9eb508398870142499df3c3cc088f46a4f2091edaa999a292ddbe20373f22db794e8a009f40a3d91cd99a6f593c32a9819e4819b214359702d7c3ce0ee02dcc3337d249a625248b9', 'hex'), decode('50a1e6896b95ee3e22a20441', 'hex')),
  ('12111111-0000-4000-8000-000000000003'::uuid, '11111111-0000-4000-8000-000000000003'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '1 day',
   null, null, null, null,
   decode('3939e86f0acb5b638974a7299afbd2d398f9c50d2d5f48ed378e36344e444a6ce24f6cb5109d79d9e85859dd2c36d3249018fba2d667b080720ec9d2e6823d9f747f786adaac3f4f3bed19d5e17aceb7445cc4eca03c403993b10653ca8aa68dda7d4a3e3ef36549f6b0d1bdc8911ce26b8801301eb7b3ec23526004ca0d03702affc5', 'hex'), decode('2e855e7aeec13b85cc8f0c13', 'hex')),
  ('12111111-0000-4000-8000-000000000004'::uuid, '11111111-0000-4000-8000-000000000004'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'OFERTA', now() - interval '3 days',
   '22316-E', 'Timken', null, 'Aceptada',
   decode('028a1f06861808db2666e7ddfe944426a66abe9bdac67bb8fb3613b36e8ca26f0a66ffa0348d4e282aa7b5c8de52e8255373d590c1154bb618401033b6d37b145149afe6fc9c42eb94ebd882e10d18ca2e2e2f7e5f640ebab4114d6292d1745d7ad8594db9b8a764a0208d3f0806ffc61dd0a20007597935c75f733d59e3ea04cb4a0e7bbe3883a4019b88c8aca94c1b683f84fec932184e162b770c79d737b76d3bfe28b90c777bc32925dcf11017bad486c3f62287a2301918f9f543d8126d89d56cd245452bce', 'hex'), decode('aab17dfc551254acdd42d8bd', 'hex')),
  ('12111111-0000-4000-8000-000000000005'::uuid, '11111111-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '7 days',
   null, null, null, null,
   decode('36d84f306a8a7e7d43c24409841705a70e2ab15ace7b82ae9debd9c639754f92d036fed12d5c1cd9eb5a5812dad79797db13c314247247bba8e921f7e9fbf91af09fe4235fd7a2d3e4e6824f534c59a12c88f8022df9e2c60cd5c6330742bc62003f44180b563f68c9e7079ad49c33c7c2d8f2bc9d43a0872f0ef6cbf4d2fd4d4132147a1207555e02469c', 'hex'), decode('5e32541da6889aba5201a092', 'hex'));

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
   decode('914f8168748e78df443f000d5300e9f9329df184ee53e5160542eef1b59bb515197137849cce0dbfb49b6b2e4aeb2779', 'hex'), decode('c00c00e0eb7ed380b6f51325', 'hex'),
   decode('81e23b4e2215a0842ed1bb26fb11dc9e666bff612321c2c334812ac124f5396d', 'hex')),
  ('12111111-0000-4000-8000-000000000001'::uuid, 'b2000000-0000-4000-8000-00000000000b'::uuid,
   decode('984125084fd3ef44108efc2a6509d67c4a8c14ed3ca992ffbc44de57f79605e62b6c5c7daf7f1a045fc035e22dc77746', 'hex'), decode('843afefb1295f7dd872c089d', 'hex'),
   decode('d6a87f9c7a400bb6025f52cf5b8de70e64280391de8df99bc546a39d6010e45f', 'hex')),
  ('12111111-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('a1a5029f39c7dcde70b1e2f8fc9df0f56795e3dc7d1d709fb70a2de634a824cb9852dd03881ba07b50ec5286706a1e44', 'hex'), decode('433b07e7cd84e99dc3b75023', 'hex'),
   decode('26ddb3e6e09914d82f91fb56b87b60cfeeb21dd43197d29aea65767ce93b565f', 'hex')),
  ('12111111-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('bbd58af4033143dbe4a4c137b08fdedf0909f57766773ff8b598b6db49e576096934074f835834907338b66fc687267d', 'hex'), decode('5fb535566af64e53ed8cbea5', 'hex'),
   decode('837b933ec99c832f2e69446422cac4b9392d599d43621339e7b37d216f1ea85f', 'hex')),
  ('12111111-0000-4000-8000-000000000004'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('144ad1616ff59f58f01521597dc6f6178dbb560776bca140c99d05713c331acdbccaa1385d44556770c97f3954f1f5f1', 'hex'), decode('ed051916a164a0ed8568bf1f', 'hex'),
   decode('82ae7f687099f2f16524e66dd1dafb1c99d195a06fe4208e6a81319bf3a90422', 'hex')),
  ('12111111-0000-4000-8000-000000000005'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   decode('525bb454166076866ee57466209227274f649ff08f985ec8bf0f13a578495f195c88107a80699474859c554aadf44900', 'hex'), decode('a98e8d4f7ca9117684ad83e3', 'hex'),
   decode('b24dbc19f0322a5f7dbcbb8e1138396effdb85d0e80c90585c160ddff371da19', 'hex'))
on conflict (item_id, recipient_member_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5 · Devolver el hilo de Anadolu a CERRADO SIN ACUERDO
--
-- ⚠ ESTO NO ES REDUNDANTE Y CUESTA UN ESTADO DE LA DEMO SI SE QUITA.
--
-- El `insert` de arriba dispara `app.sync_thread_state`, y desde 0009 **un
-- elemento nuevo reabre un hilo cerrado** (D-07-01, F-045): el hilo 5 saldría
-- de aquí en ABIERTO, y MSG-01 dejaría de tener sus cinco estados — que es la
-- razón entera por la que hay cinco hilos y no uno.
--
-- El `update` pasa porque la siembra corre como `postgres`, y
-- `app.guard_thread_state` (0007:241) exime a `service_role` y `postgres`. Desde
-- el cliente esto no se podría hacer, y así debe ser.
-- ---------------------------------------------------------------------------
update public.threads set state = 'CERRADO SIN ACUERDO'
 where id = '11111111-0000-4000-8000-000000000005';
