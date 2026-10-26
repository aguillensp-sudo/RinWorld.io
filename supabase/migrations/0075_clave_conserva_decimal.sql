-- =============================================================================
-- 0075 · La clave normalizada conserva también el decimal entre dos dígitos
-- =============================================================================
-- Amplía `0074`. Decidido por el PO el 25-oct-2026 (`DECISIONES-V1.md`): el punto y la coma
-- entre dos números se tratan igual que la barra y se conservan.
--
-- QUÉ FALLABA. `0074` quitaba siempre el punto, y `FRM-12.5/140` quedaba en `FRM125/140`:
-- 12,5 y 125 no son la misma medida. Producción tenía tres referencias publicadas con un
-- punto entre dígitos (`FRM-12.5/140`, `FRM-4.85/180`, `DH-515.207`); ninguna chocaba todavía,
-- pero la siguiente que se suba podría.
--
-- LA REGLA, en tres pasos y en este orden:
--   1. se quita todo lo que no sea letra, número, barra, punto o coma;
--   2. se quita la barra, el punto o la coma que no tenga un dígito a cada lado;
--   3. la coma que queda (siempre entre dígitos) pasa a punto. Así `12,5` y `12.5` dan la
--      misma clave, que es lo que significan.
--   `FRM-12.5/140`  → `FRM12.5/140`
--   `FRM 12,5/140`  → `FRM12.5/140`
--   `320/28X`       → `320/28X`      (como en `0074`)
--   `NU2224.ECJ/C3` → `NU2224ECJC3`  (el punto no está entre dígitos: se quita)
--   `6205-2RS/C3`   → `62052RSC3`
-- Lo que queda fuera, y se acepta: quien escriba `6204.2RS` no encuentra `62042RS`.
-- La misma regla vive en `normalizeRef()` (`app/src/lib/search.ts`), como dice `0073`.
--
-- SE BORRA Y SE VUELVE A CREAR LA COLUMNA por lo mismo que en `0074`: el banco de
-- `supabase/tests/run.sh` es Postgres 16 y no tiene `set expression`. Nada depende todavía de
-- `part_key`.
-- =============================================================================

alter table public.inventory_lines drop column part_key;

alter table public.inventory_lines
  add column part_key text
  generated always as (
    upper(translate(
      regexp_replace(
        regexp_replace(part_number, '[^A-Za-z0-9/.,]', '', 'g'),
        '(?<![0-9])[/.,]|[/.,](?![0-9])', '', 'g'),
      ',', '.'))
  ) stored;

comment on column public.inventory_lines.part_key is
  'part_number en mayúsculas, solo letras, números y la barra o el decimal entre dos dígitos (320/28X, 12.5); la búsqueda compara por aquí (0073-0075, F-254).';

create index inventory_lines_part_key_prefix
  on public.inventory_lines (part_key text_pattern_ops)
  where status = 'PUBLISHED';

create index inventory_lines_part_key_trgm
  on public.inventory_lines using gin (part_key extensions.gin_trgm_ops)
  where status = 'PUBLISHED';
