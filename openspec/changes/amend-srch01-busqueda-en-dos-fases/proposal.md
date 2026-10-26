# Change: amend-srch01-busqueda-en-dos-fases

**Estado:** propuesto, sin archivar. `openspec/specs/` no se edita (CLAUDE.md §1.3); este change es el contrato nuevo.
Fuente funcional: `openspec/v1/SRCH-01_cambios.md` (PO, 25-oct-2026), con las cuatro precisiones que el PO aceptó el mismo día
(`DECISIONES-V1.md`, fila del 25-oct-2026).

## Por qué

La búsqueda de referencias es el activo principal de Bearingworld.io, y hoy casa mal: `search.ts` hace
`ilike('part_number', '%ref%')` sobre el texto tal como lo subió cada distribuidor y devuelve una sola tabla de líneas.
`F-254` lo midió: «6204» trae 74 líneas de 15 designaciones distintas mezcladas, y `6205-2RS` no encuentra `6205 2RS`.
El PO ha estudiado cómo lo resuelve el competidor y ha definido el motor nuevo en `SRCH-01_cambios.md`.

## Qué cambia

- **Normalización de la referencia.** Para comparar se quitan espacios, guiones, puntos, barras y cualquier carácter que no sea
  una letra o un número, tanto en lo que escribe el usuario como en lo publicado. La clave se guarda en una columna generada
  (`inventory_lines.part_key`).
- **Coincidencia.** Por defecto la referencia **empieza por** lo buscado. Con la casilla CHK («contiene») marcada, la referencia
  **contiene** lo buscado. CHK está desmarcada por defecto.
- **Búsqueda en tres fases:**
  - **A:** lista previa de referencias distintas, una por clave, con su número de ofertas.
  - **B:** el usuario elige una o varias de esa lista.
  - **C:** tabla de ofertas de las elegidas, mezcladas, de la más reciente a la más antigua.
- **Sin coincidencia.** La búsqueda se recorta por el final hasta encontrar algo (caso 1.3). Si no aparece nada, avisa
  «No hay coincidencias» y ofrece crear un watcher (caso 1.4).
- **Formulario.**
  - **REF** es obligatorio, lleva lupa y comparte línea con la casilla *Filtros* y con los chips.
  - Con *Filtros* marcada aparece una segunda línea con CHK, MAR (marca), CAN (cantidad ≥), INC (incluir), EXC (excluir)
    y ARE (zona).
  - Desaparece el filtro de plazo.
- **Zona por defecto.** El chip de zona arranca con el continente de la organización del usuario. Solo si lo quita
  aparecen resultados de fuera.
- **Paginación.** La lista previa se pagina (4 columnas × 15 filas, lectura normal). La tabla de ofertas se pagina en el servidor
  (50 filas por página). Desaparece el tope de 200 filas y su aviso.
- **VERA.** `buscar_en_catalogo` ejecuta la fase A y devuelve las referencias distintas con su número de ofertas, nunca líneas
  mezcladas de varias designaciones. Pierde `plazo_maximo_dias`.

## Qué no cambia

- **Visibilidad:** RLS, `app.visible_inventory_owner_ids()`, solo `PUBLISHED` y nunca el inventario propio.
- **La tabla de ofertas:** columnas y su orden, Consultar, Contactar, Consultar seleccionados, Favoritos y antigüedad.
- **El dato:** `part_number` se sigue guardando y mostrando tal como lo publicó el distribuidor.
- **Sin precio:** la búsqueda sigue sin mostrar precio.

## Qué sustituye

- Escenario 1 de `single-reference-search`, en lo que dice de «ordenados por cantidad disponible descendente»: ya lo había
  sustituido la decisión del 16-oct-2026 (antigüedad), y aquí se escribe.
- `DECISIONES-V1.md` del 16-oct-2026, en lo que dice de «la base corta las 200 filas por ese mismo orden»: deja de haber corte,
  porque se pagina.
- `F-254`: se cierra en lo que toca a coincidencia y agrupado.

## Fuera de este change

- **Equivalencias de sufijos entre fabricantes** (`2RS` / `DDU` / `LLU`, `E` / `E1`), la otra mitad de `F-254`. El PO no las
  ha definido; queda como hallazgo nuevo.
- **SRCH-02 (lotes).** Sigue con una tarjeta por referencia. Solo cambia que compara por clave normalizada (ver la pregunta
  abierta 1 en `design.md`).
- **Crear watchers.** Sigue NO_IMPLEMENTADO (`trazabilidad.csv`). El botón del caso 1.4 sale deshabilitado, como el de la
  metabarra hoy.
- **El HTML aprobado de SRCH-01.** No se edita (§1.3). Si el PO quiere prototipo nuevo, va como HTML aparte.
