-- =============================================================================
-- Idempotencia de la siembra del catálogo
-- =============================================================================
-- `run.sh` ejecuta `seed/catalog_demo.sql` una segunda vez justo antes de este
-- fichero. Aquí se comprueba que no pasó nada.
--
-- Por qué merece un aserto propio: el artefacto lleva un guardián
-- `where not exists (select 1 from inventory_lines where org_id = 'f6…')` y de él
-- depende que nadie pueda duplicar el catálogo entero volviendo a pasar la
-- siembra. Si el guardián estuviera mal, el fichero seguiría siendo SQL válido y
-- el fallo sólo aparecería como recuentos raros en la demo.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
declare antes integer; ahora integer;
begin
  select lineas into antes from public._catalog_baseline;
  select count(*) into ahora from public.inventory_lines;
  perform public.assert_that(ahora = antes,
    'pasar la siembra dos veces no cambia nada — el guardián where-not-exists funciona',
    antes || ' -> ' || ahora);
end $$;

drop table public._catalog_baseline;

\echo ''
\echo 'CATALOGO IDEMPOTENTE'
