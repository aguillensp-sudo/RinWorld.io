-- =============================================================================
-- 0054 · Se eliminan las firmas viejas de store_key_backup y replace_key_backup (F-242)
-- =============================================================================
-- `0053` añadió las firmas con verificador y dejó vivas las de cinco argumentos para no romper
-- a un cliente que aún no se hubiera actualizado. Con el cliente nuevo desplegado, las viejas
-- sobran —y son justo las que crean o sustituyen un backup SIN verificador—: después de esta
-- migración todo backup nuevo lo lleva, y solo quedan sin él los anteriores a `0053`.
-- Se aplica a producción DESPUÉS de desplegar el cliente (F-242).
-- =============================================================================

drop function if exists public.store_key_backup(bytea, bytea, bytea, bytea, jsonb);
drop function if exists public.replace_key_backup(bytea, bytea, bytea, bytea, jsonb);
