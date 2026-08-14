-- =============================================================================
-- Re-anclaje de la frescura del catálogo de demo · día 12
-- =============================================================================
-- `Plan §5`, día 12: *"Curación del catálogo hacia el guion"*.
--
-- EL PROBLEMA, MEDIDO Y NO SUPUESTO (F-094). El catálogo se sembró el 7-ago con
-- fechas RELATIVAS —`now() - interval 'N days'`, que fue la decisión correcta— y
-- desde entonces no se ha vuelto a sembrar. La base no envejece la siembra: la
-- envejece el calendario. El 14-ago, 220 de las 221 líneas ya pasaban de 7 días
-- y las 14 de `6205-2RS` también, la más fresca por 8. `ResultsTable.tsx:168`
-- pinta en naranja todo lo que pase de 7, así que la columna Antigüedad de
-- SRCH-01 —la pantalla núcleo— saldría ENTERA en naranja delante del socio, y un
-- indicador que marca el 100% de las filas no indica nada.
--
-- El guion lo diseñó al revés (`guion-demo-y-siembra.md` §2.1): *"al menos dos
-- líneas con más de 7 días, y una de más de 30"*. Naranja como EXCEPCIÓN.
--
-- QUÉ HACE. Desplaza `last_upload_at` de todas las líneas por un delta CONSTANTE,
-- el que devuelve la línea más reciente a `now()`. Un desplazamiento constante
-- conserva la distribución relativa entera: la de 34 días de diseño sigue a 34,
-- el orden entre líneas no cambia y la de más de 30 —la que pinta en rojo— sigue
-- estando. No reescribe datos: los mueve en bloque.
--
-- POR QUÉ NO SE RE-SIEMBRA. Las tarjetas CONSULTA de los días 10 y 11 apuntan a
-- `inventory_lines.id` concretos; borrar y volver a insertar las dejaría
-- huérfanas y se llevaría por delante la demostración de "Consultar
-- Seleccionados". Decidido con el PO el 14-ago.
--
-- CUÁNDO SE CORRE. Antes de cada ensayo de `Plan §10` y antes de la reunión del
-- 20-ago. Es idempotente dentro del mismo día: si el desfase es menor de 12
-- horas no toca nada.
--
-- SE VERIFICA A SÍ MISMO, Y ESO NO ES CELO. Un script de curación que no
-- comprueba su resultado es exactamente F-089 otra vez —afirmar un estado de la
-- base sin consultarlo—. Si tras el desplazamiento la distribución no cumple el
-- guion, esto FALLA en voz alta en vez de dejar la demo rota y callada. El caso
-- concreto que atrapa: alguien sube una línea nueva justo antes de correrlo, el
-- delta sale ~0, el desplazamiento no ocurre y sin esta comprobación el script
-- diría "hecho" sin haber hecho nada.
--
-- No lleva metacomandos de psql a propósito: así corre tal cual por `psql`, por
-- el editor SQL de Supabase y por `execute_sql` del MCP.
-- =============================================================================

do $$
declare
  delta      interval;
  movidas    integer;
  total      integer;
  frescas    integer;
  ref_frescas integer;
  ref_viejas  integer;
  viejas30   integer;
begin
  select now() - max(last_upload_at) into delta from public.inventory_lines;

  if delta is null then
    raise exception 'RE-ANCLAJE ABORTADO · no hay ni una línea en inventory_lines. ¿Base equivocada?';
  end if;

  if delta >= interval '12 hours' then
    update public.inventory_lines
       set last_upload_at = last_upload_at + delta;
    get diagnostics movidas = row_count;
    raise notice 'RE-ANCLADO · % líneas desplazadas +% (la más reciente vuelve a now())', movidas, delta;
  else
    raise notice 'SIN CAMBIOS · el catálogo ya estaba anclado (desfase de solo %)', delta;
  end if;

  -- ---------------------------------------------------------------------------
  -- Verificación · los umbrales salen de `guion-demo-y-siembra.md` §2.1 y de la
  -- distribución que el propio `catalog_demo.sql` diseña (153 de 215 por debajo
  -- de 7 días, 9 de la referencia por debajo, 9 del catálogo por encima de 30).
  -- Se piden con margen: son un suelo, no una copia exacta del artefacto.
  -- ---------------------------------------------------------------------------
  select count(*),
         count(*) filter (where last_upload_at >= now() - interval '7 days')
    into total, frescas
    from public.inventory_lines;

  select count(*) filter (where last_upload_at >= now() - interval '7 days'),
         count(*) filter (where last_upload_at <  now() - interval '7 days')
    into ref_frescas, ref_viejas
    from public.inventory_lines
   where part_number = '6205-2RS';

  select count(*) into viejas30
    from public.inventory_lines
   where last_upload_at < now() - interval '30 days';

  if frescas * 100 < total * 60 then
    raise exception 'RE-ANCLAJE FALLIDO · solo % de % líneas bajan de 7 días (hace falta 60%%). La columna Antigüedad seguiría casi toda en naranja.', frescas, total;
  end if;

  if ref_frescas < 6 then
    raise exception 'RE-ANCLAJE FALLIDO · solo % líneas de 6205-2RS bajan de 7 días (hacen falta 6). Es la tabla que ve el socio en el paso 1 del guion.', ref_frescas;
  end if;

  if ref_viejas < 2 then
    raise exception 'RE-ANCLAJE FALLIDO · % líneas de 6205-2RS por encima de 7 días (hacen falta 2). Sin ninguna en naranja, el indicador tampoco se ve.', ref_viejas;
  end if;

  if viejas30 < 1 then
    raise exception 'RE-ANCLAJE FALLIDO · ninguna línea pasa de 30 días. El rojo de antigüedad no aparecería en toda la demo.';
  end if;

  raise notice 'VERIFICADO · % de % líneas frescas · 6205-2RS: % frescas y % en naranja · % en rojo',
    frescas, total, ref_frescas, ref_viejas, viejas30;
end $$;
