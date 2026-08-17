-- =============================================================================
-- 0016 · El re-anclaje necesita un WHERE · día 15
-- =============================================================================
-- CORRIGE UN DEFECTO LATENTE DE `0015`, y latente es la palabra exacta: la
-- función existe desde el día 13 y **su rama de escritura no se había ejecutado
-- ni una sola vez** por el camino por el que la llama `npm run demo:reset`.
--
-- LO QUE PASÓ, MEDIDO (F-109). Hoy, primer `demo:reset` del día 15:
--
--     RESETEO FALLIDO en «re-anclando la frescura» · UPDATE requires a WHERE clause
--
-- El `update` de `demo_reanchor_freshness()` no lleva `where`. La sesión con la
-- que PostgREST atiende el RPC tiene `sql_safe_updates` activo, y Postgres
-- rechaza cualquier `update` sin cláusula de filtro. Comprobado por descarte y
-- no supuesto: un `update` **con** filtro sobre `inventory_lines`, por el mismo
-- cliente y la misma clave de servicio, pasa sin problema.
--
-- POR QUÉ NO SALTÓ ANTES, Y ES LA PARTE QUE IMPORTA. La escritura está detrás de
-- una guarda de idempotencia: `if delta >= interval '12 hours'`. El único
-- re-anclaje que ha movido filas de verdad fue el del 16-ago a las 09:38 UTC, y
-- ese se corrió como **SQL suelto**, no por RPC — por ahí no hay `safeupdate`.
--
-- Y entonces el calendario tapó el resto: **los días 13 y 14 se trabajaron el
-- mismo 16-ago, y sus dos commits de cierre están a 64 minutos uno del otro**
-- (`e5f8192` a las 16:00, `4debf14` a las 17:04). Todos los `demo:reset` de esos
-- dos días cayeron dentro de la ventana de 12 horas, se saltaron el `update` y
-- devolvieron `movidas: 0` y verde. La función llevaba dos jornadas diciendo que
-- sí sin llegar nunca a la línea que falla. Hoy, 25 horas después, la guarda se
-- abre por primera vez y la línea se ejecuta por primera vez.
--
-- Y HABRÍA REVENTADO EL 20-AGO. `guion-demo-y-siembra.md` §6 manda correr el
-- reseteo la mañana de la reunión. Con cuatro días de desfase la guarda se abre
-- sí o sí, y el fallo habría aparecido por primera vez media hora antes de
-- enseñarle la plataforma al socio, con el catálogo entero en naranja.
--
-- ES `F-097` OTRA VEZ, Y CONVIENE DECIRLO: *"una instrucción que no se ha
-- ejecutado nunca es una hipótesis, no un procedimiento"*. Aquí no era una
-- instrucción en un documento, era una rama de código con guarda temporal: el
-- reloj decidía si el procedimiento se ejecutaba, y durante dos días decidió que
-- no. Una rama que solo corre cada 12 horas necesita haberse visto correr una
-- vez, igual que `F-105` necesita verse recortar.
--
-- EL ARREGLO. `where last_upload_at is not null`. No es un `where true` de
-- trámite para callar a la guarda: `last_upload_at` es `not null` desde
-- `0002_inventory.sql:96`, así que el filtro **describe exactamente** la
-- condición bajo la que la suma tiene sentido —una fila sin fecha no se puede
-- desplazar, `null + interval` es `null`— y de paso alcanza a las 221 filas, que
-- es lo que el algoritmo necesita para conservar la distribución.
--
-- El resto de la función se copia **carácter por carácter** de `0015`. Este
-- fichero cambia una línea; si cambiara alguna más, el diff dejaría de ser la
-- medida del arreglo.
-- =============================================================================

create or replace function public.demo_reanchor_freshness()
returns jsonb
language plpgsql
as $$
declare
  delta       interval;
  movidas     integer := 0;
  total       integer;
  frescas     integer;
  ref_frescas integer;
  ref_viejas  integer;
  viejas30    integer;
begin
  select now() - max(last_upload_at) into delta from public.inventory_lines;

  if delta is null then
    raise exception 'RE-ANCLAJE ABORTADO · no hay ni una línea en inventory_lines. ¿Base equivocada?';
  end if;

  -- Idempotente dentro del mismo día: por debajo de 12 horas no toca nada.
  if delta >= interval '12 hours' then
    -- ⚠ EL `where` NO ES DECORATIVO (F-109). Sin él, `sql_safe_updates` rechaza
    -- la sentencia cuando la llamada entra por PostgREST. Ver la cabecera.
    update public.inventory_lines
       set last_upload_at = last_upload_at + delta
     where last_upload_at is not null;
    get diagnostics movidas = row_count;
  end if;

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

  return jsonb_build_object(
    'movidas',     movidas,
    'desfase',     delta::text,
    'total',       total,
    'frescas',     frescas,
    'ref_frescas', ref_frescas,
    'ref_viejas',  ref_viejas,
    'viejas30',    viejas30
  );
end $$;

comment on function public.demo_reanchor_freshness() is
  'Re-ancla last_upload_at del catálogo de demo y verifica el guion (F-094). Lanza si no cumple. Solo service_role. El where del update es obligatorio: F-109.';

-- `create or replace` conserva los privilegios de `0015`, pero se repiten porque
-- un `grant` que solo existe en la migración de hace tres días es un grant que
-- nadie encuentra cuando lo busca.
revoke all on function public.demo_reanchor_freshness() from public;
revoke all on function public.demo_reanchor_freshness() from anon, authenticated;
grant execute on function public.demo_reanchor_freshness() to service_role;
