-- =============================================================================
-- 0074 · La clave normalizada conserva la barra entre dos dígitos
-- =============================================================================
-- Corrige `0073`. Decidido por el PO el 25-oct-2026 (`DECISIONES-V1.md`), tras comprobar
-- `0073` contra el catálogo de producción.
--
-- QUÉ FALLABA. `0073` quitaba toda barra, pero en `630/8`, `320/28X` o `239/500` la cifra de
-- detrás es el diámetro interior: no es un carácter ajeno a la referencia. Producción tenía
-- 10 referencias publicadas con barra de diámetro, y tres fundidas con un rodamiento
-- distinto: `630/8-2RS` (8 mm) con `6308-2RS` (40 mm), `320/28X` con `32028X` y `320/32X`
-- con `32032X`.
--
-- LA REGLA NUEVA, en dos pasos y en este orden:
--   1. se quita todo lo que no sea letra, número o barra;
--   2. se quita la barra que no tenga un dígito a cada lado.
-- El orden importa: `320 / 28X` primero queda `320/28X` y la barra sobrevive. Al revés, el
-- espacio la habría dejado sin dígito al lado y se habría ido.
--   `320/28X`     → `320/28X`      (diámetro: se conserva)
--   `630/8-2RS`   → `630/82RS`
--   `6205-2RS/C3` → `62052RSC3`    (separador de sufijo: se quita)
--   `NU2224.ECJ/C3` → `NU2224ECJC3`
-- La misma regla vive en `normalizeRef()` (`app/src/lib/search.ts`), como dice `0073`.
--
-- POR QUÉ SE BORRA Y SE VUELVE A CREAR LA COLUMNA, y no `alter column … set expression`:
-- `set expression` es de Postgres 17. Producción y e2e lo son, pero el banco de
-- `supabase/tests/run.sh` es Postgres 16 y la migración tiene que pasar en los tres. Nada
-- depende todavía de `part_key` (ni vistas ni funciones), así que borrarla solo se lleva
-- sus dos índices, que se vuelven a crear aquí igual que en `0073`. Reescribe la tabla
-- igual que `0073`: segundos con el volumen actual.
-- =============================================================================

alter table public.inventory_lines drop column part_key;

alter table public.inventory_lines
  add column part_key text
  generated always as (
    upper(regexp_replace(
      regexp_replace(part_number, '[^A-Za-z0-9/]', '', 'g'),
      '(?<![0-9])/|/(?![0-9])', '', 'g'))
  ) stored;

comment on column public.inventory_lines.part_key is
  'part_number en mayúsculas, solo letras, números y la barra entre dos dígitos (diámetro: 320/28X); la búsqueda compara por aquí (0073, 0074, F-254).';

create index inventory_lines_part_key_prefix
  on public.inventory_lines (part_key text_pattern_ops)
  where status = 'PUBLISHED';

create index inventory_lines_part_key_trgm
  on public.inventory_lines using gin (part_key extensions.gin_trgm_ops)
  where status = 'PUBLISHED';
