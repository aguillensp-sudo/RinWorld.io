-- =============================================================================
-- Semilla de demo · el foro de la comunidad (FORO-01)
-- =============================================================================
-- Ocho hilos y veinte publicaciones repartidos por las cuatro categorías, con
-- las dos organizaciones que tienen cuenta como autoras. Sin esto, FORO-01 se
-- demuestra con cuatro tarjetas a cero y la sección de hilos recientes oculta,
-- que es justo el estado que la spec llama *"foro recién lanzado"* y el único
-- que no hace falta enseñar en una demo.
--
-- **Las cuatro categorías NO están aquí: vienen en `0029`.** Son producto, no
-- datos de demo. Este fichero solo escribe encima de ellas.
--
-- ⚠ **RE-ANCLA EL RELOJ cada vez que se corre**, como
-- `demo_registration_requests.sql`: las fechas son relativas a `now()` y una
-- siembra vieja deja "última actividad hace 40 días" en las cuatro tarjetas.
-- Volver a pasarlo devuelve la actividad a horas y días. Es el remedio de
-- `F-094`, que costó una demo con toda la columna de antigüedad en naranja.
--
-- ⚠ ENCODING: hay diacríticos por todas partes. Ver `F-019`.
-- =============================================================================

\set ON_ERROR_STOP on
\encoding UTF8

\set orgA '''a1000000-0000-4000-8000-000000000001'''
\set orgB '''b2000000-0000-4000-8000-000000000002'''
\set memA '''a1000000-0000-4000-8000-00000000000a'''
\set memB '''b2000000-0000-4000-8000-00000000000b'''

-- -----------------------------------------------------------------------------
-- 1 · Los hilos
-- -----------------------------------------------------------------------------
-- `last_post_at` se pone aquí a mano y luego lo recalcula el bloque 3 desde las
-- publicaciones: así el valor sembrado no puede discrepar de sus mensajes, que
-- es exactamente el tipo de incoherencia que una demo enseña en pantalla.
insert into public.forum_threads (id, category_id, title, author_member_id, author_org_id, created_at, last_post_at)
values
  ('44440000-0000-4000-8000-00000000c001', (select id from public.forum_categories where slug = 'general'),
   'Bienvenidos al foro de Bearingworld.io', :memA, :orgA, now() - interval '30 days', now() - interval '30 days'),

  ('44440000-0000-4000-8000-00000000c002', (select id from public.forum_categories where slug = 'general'),
   'Presentación: Nordwälz Lager, distribución en DACH', :memB, :orgB, now() - interval '12 days', now() - interval '12 days'),

  ('44440000-0000-4000-8000-00000000c003', (select id from public.forum_categories where slug = 'referencias-tecnicas'),
   'Equivalencia FAG 6205-2RS ↔ NSK: ¿alguien la ha montado?', :memB, :orgB, now() - interval '9 days', now() - interval '9 days'),

  ('44440000-0000-4000-8000-00000000c004', (select id from public.forum_categories where slug = 'referencias-tecnicas'),
   'Juego interno C3 frente a CN en aplicaciones con eje caliente', :memA, :orgA, now() - interval '4 days', now() - interval '4 days'),

  ('44440000-0000-4000-8000-00000000c005', (select id from public.forum_categories where slug = 'logistica-y-aduanas'),
   '¿Alguien tiene experiencia con aranceles a Marruecos?', :memA, :orgA, now() - interval '3 days', now() - interval '3 days'),

  ('44440000-0000-4000-8000-00000000c006', (select id from public.forum_categories where slug = 'logistica-y-aduanas'),
   'Incoterms: DAP o DDP para envíos a Turquía', :memB, :orgB, now() - interval '2 days', now() - interval '2 days'),

  ('44440000-0000-4000-8000-00000000c007', (select id from public.forum_categories where slug = 'plataforma-y-soporte'),
   '¿Cómo se recupera la frase de respaldo si cambio de portátil?', :memB, :orgB, now() - interval '6 days', now() - interval '6 days'),

  ('44440000-0000-4000-8000-00000000c008', (select id from public.forum_categories where slug = 'plataforma-y-soporte'),
   'Sugerencia: exportar los resultados de búsqueda a CSV', :memA, :orgA, now() - interval '5 days', now() - interval '5 days')

on conflict (id) do update
   set created_at   = excluded.created_at,
       last_post_at = excluded.last_post_at;

-- -----------------------------------------------------------------------------
-- 2 · Las publicaciones
-- -----------------------------------------------------------------------------
-- Se borran y se reponen en vez de `on conflict`: son el contenido, y repetir la
-- siembra tiene que dejar el foro como estaba, no acumular copias. El borrado va
-- acotado a los ocho hilos de demo por su id -- nunca `delete from forum_posts`
-- a secas, que es como se pierde lo que escriba alguien probando.
delete from public.forum_posts
 where thread_id in ('44440000-0000-4000-8000-00000000c001','44440000-0000-4000-8000-00000000c002',
                     '44440000-0000-4000-8000-00000000c003','44440000-0000-4000-8000-00000000c004',
                     '44440000-0000-4000-8000-00000000c005','44440000-0000-4000-8000-00000000c006',
                     '44440000-0000-4000-8000-00000000c007','44440000-0000-4000-8000-00000000c008');

insert into public.forum_posts (thread_id, author_member_id, author_org_id, body, created_at) values
  ('44440000-0000-4000-8000-00000000c001', :memA, :orgA, 'Abrimos este espacio para hablar de lo que no cabe en una negociación: equivalencias, transporte, dudas de la plataforma. Lo de aquí es público.', now() - interval '30 days'),
  ('44440000-0000-4000-8000-00000000c001', :memB, :orgB, 'Apuntados. Buena idea separar esto de la mensajería.', now() - interval '29 days'),
  ('44440000-0000-4000-8000-00000000c001', :memA, :orgA, 'Cualquier sugerencia de categoría, por aquí.', now() - interval '21 days'),

  ('44440000-0000-4000-8000-00000000c002', :memB, :orgB, 'Buenas. Nordwälz Lager, con almacén en Stuttgart y reparto propio en Alemania, Austria y Suiza. Trabajamos sobre todo rígidos de bolas y rodillos cónicos.', now() - interval '12 days'),
  ('44440000-0000-4000-8000-00000000c002', :memA, :orgA, 'Bienvenidos. Nosotros cubrimos Península y Canarias.', now() - interval '11 days'),

  ('44440000-0000-4000-8000-00000000c003', :memB, :orgB, '¿Alguien ha sustituido un FAG 6205-2RS por el NSK equivalente en una bomba con carga axial ligera? Las cotas cuadran, me preocupa el sellado.', now() - interval '9 days'),
  ('44440000-0000-4000-8000-00000000c003', :memA, :orgA, 'Montado en dos bombas el año pasado. Sin incidencias, pero con grasa de la misma familia: mezclarlas fue lo único que nos dio guerra.', now() - interval '8 days'),
  ('44440000-0000-4000-8000-00000000c003', :memB, :orgB, 'Gracias, eso es justo lo que necesitaba saber.', now() - interval '7 days'),
  ('44440000-0000-4000-8000-00000000c003', :memA, :orgA, 'Si lo montas, cuenta qué tal.', now() - interval '5 days'),

  ('44440000-0000-4000-8000-00000000c004', :memA, :orgA, 'Con eje trabajando por encima de 70 °C, ¿estáis pidiendo C3 por defecto o solo cuando lo especifica el cliente?', now() - interval '4 days'),
  ('44440000-0000-4000-8000-00000000c004', :memB, :orgB, 'Por defecto C3 en todo lo que va a motor eléctrico. Nos ha ahorrado devoluciones.', now() - interval '3 days'),
  ('44440000-0000-4000-8000-00000000c004', :memA, :orgA, 'Tomo nota.', now() - interval '5 hours'),

  ('44440000-0000-4000-8000-00000000c005', :memA, :orgA, 'Primer envío a Casablanca y el despacho se nos ha ido a nueve días. ¿Es lo normal o hicimos algo mal con la documentación?', now() - interval '3 days'),
  ('44440000-0000-4000-8000-00000000c005', :memB, :orgB, 'Nueve días es mucho. Suele ir por el certificado de origen: si no va con el EUR.1 desde el principio, se para.', now() - interval '2 days'),
  ('44440000-0000-4000-8000-00000000c005', :memA, :orgA, 'Era eso. Gracias.', now() - interval '2 hours'),

  ('44440000-0000-4000-8000-00000000c006', :memB, :orgB, 'Para Turquía estamos ofreciendo DAP y que el cliente despache. ¿Alguien cotiza DDP allí?', now() - interval '2 days'),
  ('44440000-0000-4000-8000-00000000c006', :memA, :orgA, 'DDP solo con cliente conocido. Los recargos cambian demasiado.', now() - interval '1 day'),

  ('44440000-0000-4000-8000-00000000c007', :memB, :orgB, 'Si cambio de portátil y no tengo la frase apuntada, ¿hay alguna forma de recuperar los mensajes antiguos?', now() - interval '6 days'),
  ('44440000-0000-4000-8000-00000000c007', :memA, :orgA, 'Por lo que entiendo, no: la plataforma no puede leerlos. Por eso insisten tanto con la frase de respaldo.', now() - interval '6 days' + interval '3 hours'),

  ('44440000-0000-4000-8000-00000000c008', :memA, :orgA, 'Sería útil poder bajar la tabla de resultados a CSV para pasarla a compras.', now() - interval '5 days');

-- -----------------------------------------------------------------------------
-- 3 · El reloj de cada hilo, recalculado desde sus mensajes
-- -----------------------------------------------------------------------------
update public.forum_threads t
   set last_post_at = greatest(t.created_at, coalesce(p.ultimo, t.created_at))
  from (select thread_id, max(created_at) as ultimo
          from public.forum_posts group by thread_id) p
 where p.thread_id = t.id;

-- -----------------------------------------------------------------------------
-- 4 · Comprobación
-- -----------------------------------------------------------------------------
-- El fichero se verifica a sí mismo, como el resto de la siembra: si alguna
-- tarjeta sale vacía o no hay actividad reciente, FORO-01 no enseña lo que su
-- spec dice que enseña.
do $$
declare
  vacias  int;
  reciente interval;
begin
  select count(*) into vacias
    from public.forum_category_stats where thread_count = 0;

  assert vacias = 0,
    format('Las cuatro categorias tienen que tener hilos y %s se han quedado vacias', vacias);

  select now() - max(last_post_at) into reciente from public.forum_threads;
  assert reciente < interval '12 hours',
    format('La seccion de hilos recientes necesita actividad de hoy y lo mas nuevo es de hace %s', reciente);

  raise notice 'OK · foro sembrado: cuatro categorias con hilos y actividad de hace menos de 12 horas';
end
$$;

select c.name,
       s.thread_count as hilos,
       s.post_count   as publicaciones,
       date_trunc('hour', now() - s.last_activity_at) as ultima_actividad
  from public.forum_category_stats s
  join public.forum_categories c on c.id = s.id
 order by s.position;
