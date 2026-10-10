-- =============================================================================
-- 0059 · `demo_reanchor_freshness()` solo mueve el catálogo de las SEIS organizaciones de demo
-- =============================================================================
-- La función de `0015` ancla a `max(last_upload_at)` de TODA la tabla y desplaza TODAS las líneas.
-- Valía cuando solo existía la siembra. Con empresas reales dadas de alta (D4: Rey Transmisiones subió
-- 29 líneas el 10-oct) falla de dos formas:
--
--   · el ancla es la línea de hoy de la empresa real → desfase ~0 → no mueve nada → la verificación
--     (60 % de líneas de menos de 7 días) lanza y la frescura del catálogo de demo no se puede reponer;
--   · y si el desfase no fuera ~0, desplazaría también las fechas de las líneas reales.
--
-- Las COMPROBACIONES cuentan solo las líneas PUBLISHED, que son las únicas que SRCH-01 enseña: contar también
-- las DELETED / ARCHIVED / DRAFT (el 10-oct, 34 de 221) hundía el 60 % sin que ningún usuario las viera. El
-- desplazamiento sí mueve las de las seis organizaciones sea cual sea su estado, para que no se descuadren.
--
-- Ahora el ancla, el desplazamiento y las comprobaciones se limitan a las seis organizaciones de
-- `supabase/seed/demo_orgs.sql`. Todo lo demás es idéntico a `0015`: mismos umbrales, mismas
-- excepciones, mismo retorno. En una base que solo tenga la siembra se comporta exactamente igual.
-- =============================================================================

create or replace function public.demo_reanchor_freshness()
returns jsonb
language plpgsql
as $$
declare
  -- Las seis de `demo_orgs.sql`. UUID fijos de la siembra.
  v_demo      constant uuid[] := array[
    'a1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000004',
    'e5000000-0000-4000-8000-000000000005', 'f6000000-0000-4000-8000-000000000006'
  ]::uuid[];
  delta       interval;
  movidas     integer := 0;
  total       integer;
  frescas     integer;
  ref_frescas integer;
  ref_viejas  integer;
  viejas30    integer;
begin
  select now() - max(last_upload_at) into delta
    from public.inventory_lines
   where org_id = any (v_demo);

  if delta is null then
    raise exception 'RE-ANCLAJE ABORTADO · no hay ni una línea de las seis organizaciones de demo en inventory_lines. ¿Base equivocada?';
  end if;

  -- Idempotente dentro del mismo día: por debajo de 12 horas no toca nada.
  if delta >= interval '12 hours' then
    update public.inventory_lines
       set last_upload_at = last_upload_at + delta
     where org_id = any (v_demo);
    get diagnostics movidas = row_count;
  end if;

  select count(*),
         count(*) filter (where last_upload_at >= now() - interval '7 days')
    into total, frescas
    from public.inventory_lines
   where org_id = any (v_demo)
     and status = 'PUBLISHED';

  select count(*) filter (where last_upload_at >= now() - interval '7 days'),
         count(*) filter (where last_upload_at <  now() - interval '7 days')
    into ref_frescas, ref_viejas
    from public.inventory_lines
   where part_number = '6205-2RS'
     and org_id = any (v_demo)
     and status = 'PUBLISHED';

  select count(*) into viejas30
    from public.inventory_lines
   where last_upload_at < now() - interval '30 days'
     and org_id = any (v_demo)
     and status = 'PUBLISHED';

  if frescas * 100 < total * 60 then
    raise exception 'RE-ANCLAJE FALLIDO · solo % de % líneas bajan de 7 días (hace falta 60%%). La columna Antigüedad seguiría casi toda en naranja.', frescas, total
      using errcode = 'P0001';
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
  'Re-ancla last_upload_at del catálogo de las SEIS organizaciones de demo y verifica el guion (F-094); no toca las líneas de empresas reales (0059). Lanza si no cumple. Solo service_role.';

-- `create or replace` conserva los privilegios, pero se reafirman por si alguien la recrea (F-146).
revoke all on function public.demo_reanchor_freshness() from public, anon, authenticated;
grant execute on function public.demo_reanchor_freshness() to service_role;
