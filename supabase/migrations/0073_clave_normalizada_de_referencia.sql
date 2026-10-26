-- =============================================================================
-- 0073 · Clave normalizada de la referencia (búsqueda en dos fases de SRCH-01)
-- =============================================================================
-- Contrato: `openspec/changes/amend-srch01-busqueda-en-dos-fases/` (requirement
-- `reference-normalization`), decidido por el PO el 25-oct-2026 (`DECISIONES-V1.md`).
-- Cierra la mitad de `F-254` que toca a la coincidencia.
--
-- QUÉ HACE. Añade `inventory_lines.part_key`: el `part_number` en mayúsculas y sin ningún
-- carácter que no sea letra o número. `NU 2224 ECJ/C3`, `NU-2224-ECJC3` y `nu2224.ecj c3`
-- quedan las tres como `NU2224ECJC3`. La búsqueda compara por esta clave; la tabla de
-- ofertas sigue enseñando `part_number` tal como lo escribió el distribuidor.
--
-- POR QUÉ UNA COLUMNA GENERADA y no normalizar al importar: así no hay que tocar ninguna
-- de las tres vías de alta (importación, correo de `0061`, alta a mano), cubre las líneas
-- que ya existen y nadie puede escribir una clave que no case con su referencia. `upper`
-- y `regexp_replace` son `immutable`, que es lo que exige `generated always`.
--
-- LA MISMA REGLA VIVE EN `normalizeRef()` (`app/src/lib/search.ts`) para lo que escribe el
-- usuario. Si se cambia aquí, se cambia allí: el test de paridad lo vigila.
--
-- LOS ÍNDICES son parciales a `PUBLISHED` porque la búsqueda nunca mira otro estado:
--   · btree con `text_pattern_ops` → «empieza por» (`part_key like 'NU214%'`), que con
--     la intercalación por defecto no puede usar un btree normal;
--   · GIN trigrama → «contiene» (`part_key like '%NU214%'`). Por debajo de tres
--     caracteres el trigrama no ayuda y el plan barre la parte publicada; se acepta.
--
-- PRIVILEGIOS: `inventory_lines` conserva sus privilegios de tabla (`0071`, «ya eran
-- mínimas»), así que `authenticated` lee la columna nueva sin grant aparte. Nadie puede
-- escribirla: es generada.
--
-- COSTE: añadir una columna `stored` reescribe la tabla. Con el volumen actual son
-- segundos; aun así, se aplica fuera de una demo.
-- =============================================================================

alter table public.inventory_lines
  add column part_key text
  generated always as (upper(regexp_replace(part_number, '[^A-Za-z0-9]', '', 'g'))) stored;

comment on column public.inventory_lines.part_key is
  'part_number en mayúsculas y solo con letras y números; la búsqueda compara por aquí (0073, F-254).';

create index inventory_lines_part_key_prefix
  on public.inventory_lines (part_key text_pattern_ops)
  where status = 'PUBLISHED';

create index inventory_lines_part_key_trgm
  on public.inventory_lines using gin (part_key extensions.gin_trgm_ops)
  where status = 'PUBLISHED';
