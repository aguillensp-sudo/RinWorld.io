# Matriz de los escenarios nuevos · amend-srch01-busqueda-en-dos-fases

27-oct-2026. `trazabilidad.csv` solo admite filas de escenarios que estén en `openspec/specs/` (`problemas()` rechaza «fila de un
escenario que ya no está en la spec»), y esa carpeta es de solo lectura. Los 24 escenarios de este delta
(`specs/conversational-search/spec.md`) no están ahí hasta que el change se archive, así que su matriz vive aquí.
**Al archivar, estas filas pasan a `trazabilidad.csv`** con `leer_csv`/`escribir_csv` (sin `;` en las notas).

Los escenarios viejos que el delta modifica (`single-reference-search#1–#3`, `results-row-actions`, `favorites-system#1`) ya están
re-apuntados en el CSV (tarea 5.3).

Rutas: `ps` = `app/src/screens/search/PartSearch.test.tsx` · `lib` = `app/src/lib/part-search.test.ts` ·
`e2e` = `app/e2e/search.spec.ts` · `sql10` = `supabase/tests/10_clave_normalizada.sql` · `sql11` = `supabase/tests/11_busqueda_dos_fases.sql`.

| Requisito | Escenario | Estado | Prueba |
|---|---|---|---|
| single-reference-search | empieza por (por defecto) | CUBIERTO | lib «Contiene desmarcada por defecto»; sql11 (prefijo); e2e «Contiene… sin él, solo por el principio» |
| single-reference-search | contiene | CUBIERTO | lib «llama a search_part_keys con REF tal cual, contiene…»; e2e «Contiene casa en cualquier parte de la clave» |
| single-reference-search | casos 1.1 y 1.2 | CUBIERTO | ps «busca con la zona por defecto y pinta las claves»; e2e «la lista previa enseña la clave normalizada» |
| single-reference-search | coincidencia parcial (1.3) | CUBIERTO | ps «caso 1.3»; lib «caso 1.3»; sql11; e2e «caso 1.3» |
| single-reference-search | sin coincidencias (1.4) | CUBIERTO | ps «caso 1.4»; lib «caso 1.4»; e2e «caso 1.4» |
| single-reference-search | la referencia es obligatoria | CUBIERTO | lib «REF es obligatoria»; ps «vacía, o vacía al normalizar, no lanza la búsqueda» |
| single-reference-search | filtros antes de contar | CUBIERTO | sql11 (totales con filtros, bajo RLS); ps «los filtros de la segunda línea viajan al buscar» |
| single-reference-search | zona por defecto | CUBIERTO | lib «arranca en el continente»; ps «enseña desde el principio el chip de zona»; e2e «la zona por defecto (Europa) deja fuera a la distribuidora turca» |
| single-reference-search | búsqueda desde VERA | CUBIERTO | ps «lo que busca VERA se adopta y lanza la fase A»; `vera.real` (F-254, 26-oct, a mano) |
| single-reference-search | refinamiento en sesión activa | CUBIERTO | ps «quitar un chip después de buscar relanza la búsqueda»; `PartSearch.parciales.test.tsx` |
| reference-normalization | grafías distintas de la misma referencia | CUBIERTO | sql10 + lib «lee la tabla de casos del test SQL» (paridad); e2e «funde 32011-X con 32011X» |
| reference-normalization | barra de diámetro | CUBIERTO | sql10 (`630/82RS` frente a `63082RS`), misma paridad en lib |
| reference-normalization | decimal entre dígitos | CUBIERTO | sql10 (`FRM12.5/140`), misma paridad en lib |
| reference-normalization | clave con sufijo distinto | CUBIERTO | sql10; ps «pinta las claves en el orden de la RPC». **No dice que 2RS y DDU sean equivalentes: eso es `F-281`** |
| preliminary-list | orden y lectura | CUBIERTO | ps «pinta las claves en el orden de la RPC»; sql11 (orden) |
| preliminary-list | paginación de la lista previa | PARCIAL | ps «pagina la lista previa» (unidad). **Sin e2e: la siembra no llega a 60 claves** |
| preliminary-list | seleccionar las de esta página | CUBIERTO | ps «Seleccionar las de esta página marca todas»; e2e «se pueden elegir claves sueltas» (sueltas) |
| preliminary-list | ver ofertas de todas | CUBIERTO | ps «Ver ofertas de todas manda la cadena con la que se encontró»; lib «todas»; e2e (`verOfertasDeTodas`) |
| offers-list | ofertas de varias claves | CUBIERTO | lib «por claves: manda p_keys»; ps «las marcadas a mano»; e2e «claves sueltas… de 2 referencias» |
| offers-list | muchas ofertas | CUBIERTO | ps «pagina las ofertas en el servidor y avisa…»; e2e «la tabla de ofertas se pagina» |
| offers-list | volver a la lista previa | CUBIERTO | ps «volver a la lista previa conserva las casillas»; e2e (casillas marcadas al volver) |
| search-form | estado inicial | CUBIERTO | ps «no busca nada hasta que se escribe una referencia» |
| search-form | mostrar y ocultar filtros | CUBIERTO | ps «la segunda línea está oculta y aparece con Filtros» |
| search-form | desplegable de zona | CUBIERTO | lib «primero los continentes y después los países»; e2e (opción «Cualquiera») |

Resumen: 23 CUBIERTO, 1 PARCIAL (paginación de la lista previa solo en unidad), 0 SIN_PRUEBA.
No se han cotejado los nombres de las pruebas con `problemas()` (no son filas del CSV todavía): al archivar, esa comprobación
dirá si alguno ha cambiado.
