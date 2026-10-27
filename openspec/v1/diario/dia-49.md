# Día 49 · 27-oct-2026

- **Change `amend-srch01-busqueda-en-dos-fases`, cierre de pendientes:** 0.3, 6.2, 6.3 y 6.4 hechas (queda 6.1, unitarios, sin tocar).
- **`F-254` cerrado** en lo que toca a coincidencia y agrupado (punto 1, construido el 25-oct y verificado con Sonnet 5 real el 26-oct). El punto 2 (equivalencias de sufijos entre fabricantes: 2RS/DDU/LLU, 2Z/ZZ, jaulas FAG) pasa a **`F-281`**, abierto a la espera de las definiciones del PO.
- **e2e nuevos en `search.spec.ts`:** «Contiene» (con y sin), claves sueltas con vuelta a la lista conservando la selección, y paginación de la tabla de ofertas. La paginación de la lista previa no tiene e2e: la siembra no llega a 60 claves (con `6204` solo hay una clave; el test usa el prefijo `6`). Corrida local contra `bearingworld-e2e`: `search` + `batch-search` 26/26. La CI de `mvp/bootstrap` no tenía nada en curso.
- **Matriz de los escenarios nuevos:** `trazabilidad.csv` rechaza filas de escenarios que no estén en `openspec/specs/` (de solo lectura), así que los 24 del delta se anotan en `changes/amend-srch01-busqueda-en-dos-fases/matriz.md` (23 CUBIERTO, 1 PARCIAL) y pasan al CSV al archivar el change.
- El fichero sin seguir `openspec/v1/comportamiento_VERA_Oct26.md` está vacío (0 bytes); no se ha tocado ni comiteado.
