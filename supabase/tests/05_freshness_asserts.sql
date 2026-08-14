-- =============================================================================
-- Asertos de FRESCURA del catálogo · día 12
-- =============================================================================
-- El contrato que faltaba, y su ausencia es el hallazgo (F-094).
--
-- `03_catalog_asserts.sql` ya comprobaba la frescura, pero SOLO POR ABAJO:
-- *"al menos dos líneas de la referencia con más de 7 días"* y *"al menos una
-- del catálogo con más de 30"*. Los dos son suelos, y un suelo lo pasa también
-- el caso contrario al que el guion pide: con las 14 líneas de `6205-2RS`
-- pasadas de 7 días, ese aserto sigue verde y la columna Antigüedad de SRCH-01
-- sale entera en naranja. Es exactamente lo que la base tenía el 14-ago, siete
-- días después de sembrarla, sin que nada fallara.
--
-- `guion-demo-y-siembra.md` §2.1 pide naranja como EXCEPCIÓN —*"al menos dos
-- líneas con más de 7 días, y una de más de 30"*, sobre un catálogo por lo demás
-- fresco—. Eso es un intervalo, no un mínimo, y aquí se escribe entero.
--
-- Los umbrales son suelos con margen sobre lo que el artefacto diseña de verdad
-- (153 de 215 por debajo de 7 días · 9 de las 12 de la referencia por debajo ·
-- 3 por encima · 9 del catálogo por encima de 30), no una copia de esas cifras:
-- el catálogo puede crecer sin que este fichero haya que retocarlo.
-- =============================================================================

\set ON_ERROR_STOP on

\echo '--- frescura: el naranja tiene que ser la excepción, no la regla ---'

do $$
declare total integer; frescas integer;
begin
  select count(*), count(*) filter (where last_upload_at >= now() - interval '7 days')
    into total, frescas from public.inventory_lines;
  perform public.assert_that(frescas * 100 >= total * 60,
    'al menos el 60% del catálogo baja de 7 días — el indicador de antigüedad distingue algo',
    frescas || ' frescas de ' || total);
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and last_upload_at >= now() - interval '7 days';
  perform public.assert_that(n >= 6,
    'al menos seis líneas de 6205-2RS bajan de 7 días — es la tabla del paso 1 del guion',
    'hay ' || n);
end $$;

-- El otro lado del intervalo. Duplica a propósito lo que ya mira `03`: los dos
-- asertos juntos son el contrato, y separados cada uno lo pasa una avería
-- distinta.
do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines
   where part_number = '6205-2RS' and last_upload_at < now() - interval '7 days';
  perform public.assert_that(n >= 2,
    'y al menos dos de la referencia SÍ pasan de 7 días — sin naranja tampoco se ve el indicador',
    'hay ' || n);
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines
   where last_upload_at < now() - interval '30 days';
  perform public.assert_that(n >= 1,
    'y al menos una del catálogo pasa de 30 días — el rojo de antigüedad existe',
    'hay ' || n);
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.inventory_lines where last_upload_at > now();
  perform public.assert_that(n = 0,
    'ninguna línea se subió en el futuro — el re-anclaje no puede pasarse de rosca',
    'en el futuro: ' || n);
end $$;

\echo 'FRESCURA VERDE'
