-- =============================================================================
-- Asertos del catálogo de demo · día 3
-- =============================================================================
-- Escritos a mano, no por el Coder: `CLAUDE.md` §3 — "el Coder nunca escribe los
-- tests que lo evalúan". Los criterios salen literalmente de
-- `openspec/mvp/guion-demo-y-siembra.md` §4 ("cómo se comprueba que el catálogo
-- vale") y §2 (lo que el catálogo tiene que contener), y se escribieron ANTES de
-- mirar el artefacto.
--
-- Lo que NO se comprueba aquí y conviene tener claro: que el catálogo sea bonito o
-- verosímil para un experto en rodamientos. Eso lo juzga el PO. Esto comprueba que
-- la demo del guion funciona sobre estos datos.
-- =============================================================================

\set ON_ERROR_STOP on

\echo '--- volumen y reparto ---'

do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines;
  perform public.assert_that(n > 200, 'más de 200 líneas de inventario', 'hay ' || n);
end $$;

do $$
declare faltan text;
begin
  select string_agg(o.name, ', ') into faltan
  from public.organizations o
  where not exists (select 1 from public.inventory_lines l where l.org_id = o.id);
  perform public.assert_that(faltan is null,
    'las seis organizaciones tienen líneas', 'sin inventario: ' || coalesce(faltan, ''));
end $$;

-- El grueso del catálogo va en las cuatro sin cuenta: Alpha y Beta ya traían tres
-- líneas cada una de `dev_accounts.sql` y son las de la sesión, no las del volumen.
do $$
declare propias integer; ajenas integer;
begin
  select count(*) into propias from public.inventory_lines
   where org_id in ('a1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002');
  select count(*) into ajenas from public.inventory_lines
   where org_id not in ('a1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002');
  perform public.assert_that(ajenas > propias,
    'las cuatro sin cuenta llevan el grueso del catálogo',
    'con cuenta: ' || propias || ' · sin cuenta: ' || ajenas);
end $$;

\echo '--- la frontera de cifrado ---'

-- El aserto más importante del fichero. Sembrar un precio en claro es el fallo
-- que arruinaría la demo del día 11: lo que se está vendiendo es que el servidor
-- no puede leerlo.
do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines
   where unit_price_ciphertext is not null or unit_price_iv is not null;
  perform public.assert_that(n = 0,
    'ninguna línea trae precio, ni cifrado ni en claro', 'con precio: ' || n);
end $$;

\echo '--- vocabulario y coherencia ---'

do $$
declare rogue text;
begin
  select string_agg(distinct product_family, ' | ') into rogue
    from public.inventory_lines
   where product_family not in (
     'Rodamiento rigido de bolas', 'Rodamiento de rodillos conicos',
     'Rodamiento de rodillos cilindricos', 'Rodamiento de rodillos a rotula',
     'Rodamiento axial de bolas');
  perform public.assert_that(rogue is null,
    'product_family sale del vocabulario cerrado', 'fuera de vocabulario: ' || coalesce(rogue, ''));
end $$;

-- La familia la inferiría el motor IA de `part_number` + `brand`
-- (`canonical-schema`). Si el catálogo la pone incoherente, cualquier filtro por
-- familia miente. Se comprueba sobre los prefijos que el prompt fijó.
do $$
declare malas text;
begin
  select string_agg(part_number || ' -> ' || product_family, ' | ') into malas
  from (
    select distinct part_number, product_family
    from public.inventory_lines
    where (part_number ~ '^6[0-9]{3}'      and product_family <> 'Rodamiento rigido de bolas')
       or (part_number ~ '^3[02][0-9]{3}'  and product_family <> 'Rodamiento de rodillos conicos')
       or (part_number ~ '^N[UJ]'          and product_family <> 'Rodamiento de rodillos cilindricos')
       or (part_number ~ '^222[0-9]{2}'    and product_family <> 'Rodamiento de rodillos a rotula')
       or (part_number ~ '^511[0-9]{2}'    and product_family <> 'Rodamiento axial de bolas')
  ) t;
  perform public.assert_that(malas is null,
    'la familia es coherente con la referencia', coalesce(malas, ''));
end $$;

\echo '--- rangos ---'

do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines where quantity < 5 or quantity > 4000;
  perform public.assert_that(n = 0, 'cantidades entre 5 y 4000', 'fuera de rango: ' || n);

  select count(*) into n from public.inventory_lines
   where lead_time_days is null or lead_time_days < 1 or lead_time_days > 30;
  perform public.assert_that(n = 0,
    'lead_time_days entre 1 y 30 y nunca nulo — es columna ordenable de SRCH-01',
    'fuera de rango o nulo: ' || n);
end $$;

-- Las fechas tienen que ser relativas a `now()`, no literales: la demo es de los
-- días 11, 13 y 15, y el coloreado de antigüedad (naranja a 7 días, rojo a 30)
-- tiene que seguir siendo verdad entonces. Un `last_upload_at` en el futuro o de
-- hace años delata una fecha escrita a mano.
do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines
   where last_upload_at > now() or last_upload_at < now() - interval '120 days';
  perform public.assert_that(n = 0,
    'last_upload_at es relativo a now() y cae en una ventana verosímil',
    'fuera de ventana: ' || n);
end $$;

\echo '--- estados: INV-01 tiene que poder enseñar los cuatro ---'

do $$
declare n integer; pct numeric;
begin
  select count(*) into n from public.inventory_lines where status = 'DELETED';
  perform public.assert_that(n >= 1,
    'hay al menos una línea DELETED — el cuarto estado que el HTML de INV-01 no pinta', 'hay ' || n);

  select count(*) into n from public.inventory_lines where status = 'DRAFT';
  perform public.assert_that(n >= 1, 'hay líneas DRAFT', 'hay ' || n);

  select count(*) into n from public.inventory_lines where status = 'ARCHIVED';
  perform public.assert_that(n >= 1, 'hay líneas ARCHIVED', 'hay ' || n);

  select round(100.0 * count(*) filter (where status = 'PUBLISHED') / count(*), 1)
    into pct from public.inventory_lines;
  perform public.assert_that(pct between 80 and 96,
    'en torno al 90% está PUBLISHED', pct || '%');
end $$;

\echo '--- solape entre organizaciones (§2.3) ---'

-- Sin solape, cualquier búsqueda que el socio improvise en la reunión devuelve una
-- sola fila de una sola empresa, y la columna Empresa deja de contar la historia.
do $$
declare n integer;
begin
  select count(*) into n from (
    select part_number
      from public.inventory_lines
     where status = 'PUBLISHED'
     group by part_number
    having count(distinct org_id) >= 2
  ) t;
  perform public.assert_that(n >= 25,
    'al menos 25 referencias están en dos o más organizaciones', 'hay ' || n);
end $$;

\echo '--- la referencia de la demo: 6205-2RS ---'

do $$
declare n integer; marcas text; paises text;
begin
  select count(*) into n from public.inventory_lines where part_number = '6205-2RS';
  perform public.assert_that(n between 8 and 14, 'entre 8 y 14 líneas de 6205-2RS', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and quantity >= 500;
  perform public.assert_that(n >= 2,
    'hay líneas de la referencia por encima de 500 unidades — la columna las pinta en verde', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and quantity < 500;
  perform public.assert_that(n >= 2,
    'y también por debajo de 500, para que el contraste se vea', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and lead_time_days <= 7;
  perform public.assert_that(n >= 3,
    'al menos tres líneas de la referencia con plazo <= 7 días — el chip de plazo del paso 2', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and lead_time_days > 7;
  perform public.assert_that(n >= 2,
    'y varias por encima de 7, para que ese chip corte algo', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and last_upload_at < now() - interval '7 days';
  perform public.assert_that(n >= 2,
    'al menos dos líneas de la referencia con más de 7 días — antigüedad en naranja', 'hay ' || n);

  select count(*) into n from public.inventory_lines
   where last_upload_at < now() - interval '30 days';
  perform public.assert_that(n >= 1,
    'y al menos una línea del catálogo con más de 30 días — antigüedad en rojo', 'hay ' || n);

  select string_agg(distinct brand, ',' order by brand) into marcas
    from public.inventory_lines where part_number = '6205-2RS';
  perform public.assert_that(
    marcas like '%SKF%' and marcas like '%FAG%' and marcas like '%NSK%',
    'la referencia está en SKF, FAG y NSK — el filtro de marca tiene que cortar', marcas);

  select string_agg(distinct location_country, ',' order by location_country) into paises
    from public.inventory_lines where part_number = '6205-2RS';
  perform public.assert_that(
    paises like '%ES%' and paises like '%DE%' and paises like '%IT%'
    and paises like '%PL%' and paises like '%FR%',
    'la referencia está en los cinco países europeos del guion', paises);
end $$;

-- El chip de zona sólo corta si hay stock fuera de Europa que quitar, y eso
-- depende de que Anadolu Rulman esté en continent='AS' (decisión del guion §3).
do $$
declare n integer;
begin
  select count(*) into n
    from public.inventory_lines l
    join public.organizations o on o.id = l.org_id
   where l.part_number = '6205-2RS' and o.continent <> 'EU';
  perform public.assert_that(n >= 1,
    'hay al menos una línea de la referencia fuera de Europa — si no, el chip de zona no corta nada',
    'hay ' || n);
end $$;

\echo '--- el guion de la demo, paso a paso ---'

-- PASO 1: "Necesito 500 unidades de 6205-2RS en Europa", visto por Alpha, que es
-- el comprador. Se excluye su propio inventario porque buscar en un marketplace es
-- buscar oferta ajena — es lo que hace `inventory_select_cross_org` con
-- `org_id <> app.current_org_id()`.
--
-- Criterio del guion §4: >= 5 filas de >= 3 empresas distintas.
do $$
declare filas integer; empresas integer;
begin
  select count(*), count(distinct l.org_id) into filas, empresas
    from public.inventory_lines l
    join public.organizations o on o.id = l.org_id
   where l.part_number = '6205-2RS'
     and l.status = 'PUBLISHED'
     and l.quantity >= 500
     and o.continent = 'EU'
     and l.org_id <> 'a1000000-0000-4000-8000-000000000001';
  perform public.assert_that(filas >= 5,
    'paso 1 del guion devuelve 5 filas o más', 'devuelve ' || filas);
  perform public.assert_that(empresas >= 3,
    'paso 1 del guion devuelve 3 empresas o más — la columna Empresa de SRCH-01',
    'devuelve ' || empresas);
end $$;

-- PASO 2: "solo SKF, y que el plazo no pase de una semana". Refina: tiene que
-- reducir y NO quedarse vacío. Un refinamiento que vacía la tabla delante del
-- socio es peor que no ofrecerlo.
do $$
declare antes integer; despues integer;
begin
  select count(*) into antes
    from public.inventory_lines l join public.organizations o on o.id = l.org_id
   where l.part_number = '6205-2RS' and l.status = 'PUBLISHED' and l.quantity >= 500
     and o.continent = 'EU' and l.org_id <> 'a1000000-0000-4000-8000-000000000001';
  select count(*) into despues
    from public.inventory_lines l join public.organizations o on o.id = l.org_id
   where l.part_number = '6205-2RS' and l.status = 'PUBLISHED' and l.quantity >= 500
     and o.continent = 'EU' and l.org_id <> 'a1000000-0000-4000-8000-000000000001'
     and l.brand = 'SKF' and l.lead_time_days <= 7;
  perform public.assert_that(despues >= 1,
    'paso 2 del guion no vacía la tabla', 'quedan ' || despues);
  perform public.assert_that(despues < antes,
    'paso 2 del guion reduce de verdad', antes || ' -> ' || despues);
end $$;

-- PASO 3: clic en la cabecera Plazo reordena. Sólo se nota si hay más de un valor
-- distinto de plazo entre los resultados; con todos iguales, ordenar no hace nada
-- visible y el socio no ve la función.
do $$
declare distintos integer;
begin
  select count(distinct l.lead_time_days) into distintos
    from public.inventory_lines l join public.organizations o on o.id = l.org_id
   where l.part_number = '6205-2RS' and l.status = 'PUBLISHED'
     and o.continent = 'EU' and l.org_id <> 'a1000000-0000-4000-8000-000000000001';
  perform public.assert_that(distintos >= 3,
    'paso 3: hay al menos 3 plazos distintos, así que ordenar por Plazo se ve',
    'distintos: ' || distintos);
end $$;

-- Deja el recuento apuntado para la prueba de idempotencia: `run.sh` vuelve a
-- pasar la siembra después de este fichero y `04_catalog_idempotent.sql` compara.
-- Va en una tabla real y no en una temporal porque cada fichero se ejecuta en su
-- propia sesión de psql.
create table public._catalog_baseline as
  select count(*) as lineas from public.inventory_lines;

\echo ''
\echo 'CATALOGO VERDE'
