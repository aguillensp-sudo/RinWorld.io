\encoding UTF8
-- ---------------------------------------------------------------------------
-- Siembra de hilos de demo · MSG-01 · Lista de Hilos
--
-- Cinco hilos de Rodamientos Ibéricos (Alpha), uno por cada estado del CHECK de
-- `thread-lifecycle`, para que la pantalla se pueda probar contra datos reales y
-- no contra un mock. Sale del guion de demo y de la spec MSG-01 §3.
--
-- POR QUÉ EXISTE ESTE FICHERO: `app/e2e/messages.spec.ts` es el contrato de
-- aceptación de MSG-01 contra el Supabase real, y es lo único que puede cazar un
-- embed mal escrito o una lectura mal filtrada — los tests de unidad mockean la
-- capa de datos y pasarían igual (F-020, y el aviso de RLS de INV-01). Un test de
-- aceptación declarado que no puede ejecutarse cuenta como ROJO (F-015), así que
-- los datos entran antes que el código.
--
-- EL CONTENIDO CIFRADO ES RELLENO A PROPÓSITO. `content_ciphertext` lleva bytes
-- que no descifran a nada, y da igual: MSG-01 **nunca** descifra. La pantalla se
-- construye entera con los metadatos en claro (`item_type`, `part_number`,
-- `brand`, `estado_*`), que es justo lo que la spec §7 exige. Si esta siembra
-- bastara para pintar la pantalla y algún día dejara de bastar, sería la señal de
-- que la frontera E2EE se ha movido.
--
-- El orden canónico del par (`org_low_id < org_high_id`) lo impone la base.
-- Alpha es el UUID más bajo de las seis, así que va siempre de `org_low_id`.
-- ---------------------------------------------------------------------------

insert into public.threads (id, org_low_id, org_high_id, created_by_org_id, state, last_item_at)
select * from (values
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
  -- Alpha ↔ Anadolu Rulman
  ('11111111-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'f6000000-0000-4000-8000-000000000006'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'CERRADO SIN ACUERDO', now() - interval '7 days')
) as v
where not exists (
  select 1 from public.threads
   where org_low_id = 'a1000000-0000-4000-8000-000000000001'
);

-- ---------------------------------------------------------------------------
-- Un elemento por hilo: el último, que es el que MSG-01 pinta en la vista previa.
--
-- `sender_member_id` tiene que pertenecer a `sender_org_id` — lo comprueba el
-- trigger `app.validate_thread_item()`. Solo Alpha y Nordwälz tienen cuenta
-- sembrada, así que los tres hilos con organizaciones sin cuenta llevan a Alpha
-- de emisor. No es una limitación del modelo: es que esas cuatro no tienen
-- usuarios en el MVP, y así está en el guion.
--
-- La forma de cada tipo la impone `thread_items_shape_chk`: MENSAJE va sin
-- metadatos, CONSULTA con referencia + marca + estado_consulta, OFERTA con
-- referencia + marca + estado_oferta y sin línea de inventario.
-- ---------------------------------------------------------------------------

insert into public.thread_items
  (thread_id, sender_org_id, sender_member_id, item_type, created_at,
   part_number, brand, estado_consulta, estado_oferta,
   content_ciphertext, content_iv)
select * from (values
  -- La oferta que Nordwälz tiene sobre la mesa: la referencia de la demo.
  ('11111111-0000-4000-8000-000000000001'::uuid,
   'b2000000-0000-4000-8000-000000000002'::uuid, 'b2000000-0000-4000-8000-00000000000b'::uuid,
   'OFERTA', now() - interval '2 hours',
   '6205-2RS', 'NSK', null, 'Pendiente',
   decode('a1b2c3d4e5f6', 'hex'), decode('000102030405060708090a0b', 'hex')),

  ('11111111-0000-4000-8000-000000000002'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'CONSULTA', now() - interval '5 hours',
   'NU2210-E-TVP2', 'INA', 'Pendiente', null,
   decode('a1b2c3d4e5f6', 'hex'), decode('000102030405060708090a0b', 'hex')),

  ('11111111-0000-4000-8000-000000000003'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '1 day',
   null, null, null, null,
   decode('a1b2c3d4e5f6', 'hex'), decode('000102030405060708090a0b', 'hex')),

  ('11111111-0000-4000-8000-000000000004'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'OFERTA', now() - interval '3 days',
   '22316-E', 'Timken', null, 'Aceptada',
   decode('a1b2c3d4e5f6', 'hex'), decode('000102030405060708090a0b', 'hex')),

  ('11111111-0000-4000-8000-000000000005'::uuid,
   'a1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-00000000000a'::uuid,
   'MENSAJE', now() - interval '7 days',
   null, null, null, null,
   decode('a1b2c3d4e5f6', 'hex'), decode('000102030405060708090a0b', 'hex'))
) as v
where not exists (
  select 1 from public.thread_items
   where thread_id = '11111111-0000-4000-8000-000000000001'
);
