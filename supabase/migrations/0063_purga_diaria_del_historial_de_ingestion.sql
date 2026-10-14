-- =============================================================================
-- 0063 · La purga del historial de ingestión por correo, programada (INV-04 fase 4)
-- =============================================================================
-- `public.purge_ingest_events(90)` (0057) existe desde la fase 1 pero nadie la ejecutaba:
-- producción no tenía `pg_cron`. Esta migración lo activa y programa la purga cada noche
-- a las 03:17 UTC (una hora sin tráfico y fuera del minuto 0, que es cuando todo el mundo
-- programa lo suyo).
--
-- Solo purga el HISTORIAL (`ingest_events`, 90 días). El correo crudo está en S3 y lo borra la
-- regla de ciclo de vida del bucket a los 30 días (`inv04-politicas-aws.md`), no esta función.
--
-- **Condicional a propósito:** el banco de esquema corre en un `postgres:16-alpine` desnudo, sin
-- `pg_cron`. Allí la migración avisa y no hace nada; en Supabase, donde la extensión existe,
-- la crea y programa el trabajo. El trabajo corre como el rol que lo programa, dueño de la
-- función, así que no necesita `service_role`.
--
-- Idempotente: `cron.schedule` con el mismo nombre sustituye el trabajo anterior.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '0063: pg_cron no esta disponible en esta base; la purga no se programa (esperado en el banco de esquema)';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-ingest-events', '17 3 * * *', 'select public.purge_ingest_events(90)');
end
$$;
