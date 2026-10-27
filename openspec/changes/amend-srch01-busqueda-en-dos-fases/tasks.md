# Tareas: amend-srch01-busqueda-en-dos-fases

## 0. Decisiones y documentos
- [x] 0.1 Fila en `DECISIONES-V1.md` (25-oct-2026) con las cuatro precisiones aceptadas por el PO.
- [x] 0.2 El PO responde las dos preguntas de `design.md` §6 (25-oct-2026): SRCH-02 por clave exacta; la celda muestra la clave.
- [x] 0.3 `F-254` cerrado en lo que toca a coincidencia y agrupado (27-oct-2026); equivalencias de sufijos en `F-281`.

## 1. Base de datos
- [x] 1.1 `0073_clave_normalizada_de_referencia.sql`: columna generada `part_key` y los dos índices parciales.
      Probada en el banco (`supabase/tests/10_clave_normalizada.sql`). Aplicada el 25-oct-2026 en `bearingworld-e2e` y en
      producción por el MCP.
- [x] 1.2 Comprobado contra el catálogo el 25-oct-2026, en e2e y producción: 0 descuadres, 0 claves vacías, `authenticated` lee
      la columna y `anon` no, columna `ALWAYS` y los dos índices presentes. En producción, 6.677 referencias publicadas quedan
      en 6.666 claves.
- [x] 1.2b **Decidido por el PO el 25-oct-2026: la barra entre dos dígitos se conserva.**
      `0074_clave_conserva_barra_de_diametro.sql`, con sus casos en `10_clave_normalizada.sql`. Aplicada el 25-oct-2026 en
      e2e y en producción. Comprobado en producción: 0 descuadres; 6.677 referencias publicadas quedan en 6.669 claves; los tres
      pares tienen claves distintas (`630/82RS` frente a `63082RS`, `320/28X` frente a `32028X`, `320/32X` frente a `32032X`), y
      ninguna clave con barra funde dos referencias. Contexto: la barra de diámetro (`630/8`, `320/28X`, `239/500`) no es un carácter ajeno. Hoy funde
      `630/8-2RS` con `6308-2RS`, `320/28X` con `32028X` y `320/32X` con `32032X`, que son rodamientos distintos (10
      referencias con barra de diámetro, 3 en choque). Propuesta: conservar la `/` cuando va entre dos dígitos, con
      `alter column … set expression` en una migración nueva.
- [x] 1.2d **Decidido por el PO el 25-oct-2026: el punto y la coma entre dos dígitos también se conservan** (la coma pasa a
      punto). `0075_clave_conserva_decimal.sql`, con sus casos en `10_clave_normalizada.sql`. Aplicada el 25-oct-2026 en e2e y
      en producción. Comprobado en producción: 0 descuadres, las mismas 6.669 claves, y `FRM12.5/140`, `FRM4.85/180` y
      `DH515.207` conservan su decimal sin fundirse con nada. Las barras de diámetro siguen intactas.
- [x] 1.2c Comprobar contra el catálogo que `authenticated` puede leer `part_key` (`0071`).
- [x] 1.3 `0076_busqueda_en_dos_fases.sql`: `search_part_keys` y `search_offers` (`security invoker`, visibilidad de `0064`,
      grants de `0071`). Escrita y en verde en el banco (`11_busqueda_dos_fases.sql`, como miembro y bajo RLS); añadida a la
      superficie auditada de F-155 en `01_schema_smoke.sql`. Aplicada el 25-oct-2026 en e2e y en producción, y comprobada
      como ALPHA: `6204` da 14 claves y 63 ofertas (la primera, `62042RS`, con 11); `6204-2RSXYZ9` recorta a `62042RS`; ofertas
      por fecha descendente; ninguna línea propia; `anon` no ejecuta.
- [x] 1.4 Medido el 25-oct-2026 en producción, con las RPC como ALPHA bajo RLS: la primera llamada en frío, 377 ms; después,
      entre 16 y 76 ms (lista previa por prefijo o «contiene», recorte largo, un solo carácter con filtros, ofertas de todas,
      ofertas por claves, página 20). Todo por debajo de 1,5 s. Medir con `explain analyze` en el banco, bajo RLS y con la siembra de demo: prefijo, contiene, recorte del caso 1.3
      y «todas» (< 1,5 s; ver `F-253`).

## 2. Lógica (`app/src/lib/part-search.ts`)
Hecho el 25-oct-2026 en un módulo propio, `part-search.ts`, y no dentro de `search.ts`: `access-request.ts` (de donde sale
la lista de países de ARE) ya importa de `search.ts`, y meterlo ahí crearía un import circular. Convive con `SearchCriteria`
y `fetchResults`, que usan hoy 37 ficheros (pantalla, VERA, lotes, watchers); lo viejo se borra cuando los bloques 3 a 5 lo
dejen sin uso. Tests: `part-search.test.ts` (50). Typecheck y Vitest enteros en verde.
- [x] 2.1 `normalizeRef()`, con test de paridad que lee la tabla de casos de `supabase/tests/10_clave_normalizada.sql`.
- [x] 2.2 `PartSearchCriteria` (`ref`, `contains`, `brand`, `minQuantity`, `include`, `exclude`, `area`; sin plazo), con
      `activePartChips` y `withoutPartChip`. El chip de REF no se puede quitar. `areaOptions()`: los continentes primero y
      después los 194 países de REG-00.
- [x] 2.3 Zona por defecto: `initialPartCriteria(orgContinent)`. La sesión trae ahora `orgContinent` (`session.ts`, opcional:
      sin él, «Cualquiera»).
- [x] 2.4 `fetchPartKeys()` y `fetchOffers()` con paginación (60 claves, 50 ofertas). `fetchResults()` sigue para quien aún la
      use.

## 3. Pantalla SRCH-01
Hecho el 25-oct-2026 como pantalla nueva, `PartSearch.tsx`, que sustituye a `SearchResults.tsx` en la ruta de Comprando
(`App.tsx`). `SearchResults.tsx` y sus tests de contrato se quedan sin tocar hasta que VERA, los lotes y los watchers dejen
el modelo viejo; entonces se borran. Mientras, VERA pasa por `fromLegacyCriteria` / `toLegacyCriteria`. Tests:
`PartSearch.test.tsx` (21). Typecheck, paleta, Vitest entero y build en verde. **Sin verificar en navegador.**
- [x] 3.1 Formulario en dos líneas (`PartSearchForm.tsx`): REF con el `SearchField` estándar, *Filtros* y chips en la
      primera; con *Filtros*, «Contiene», Marca, Cantidad ≥, Incluir, Excluir y Zona (continentes y después países).
- [x] 3.2 `PartKeyGrid.tsx`: 4 columnas que se leen por filas, `Pager.tsx`, selección que se conserva entre páginas, y las
      tres acciones.
- [x] 3.3 Avisos del caso 1.3 y del caso 1.4 (watcher deshabilitado y «Buscar en todas las zonas»).
- [x] 3.4 Tabla de ofertas con paginación de servidor, aviso de orden por página, metabarra «X ofertas de k referencias» y
      vuelta a la lista previa con la selección.
- [x] 3.5 Sin tope de 200: la pantalla nueva no lo tiene.
- [x] 3.6 **Antes de empujar:** los e2e de Comprando reescritos para las dos fases (26-oct-2026). Ayudantes comunes en
      `e2e/fixtures.ts` (`abrirComprando`, `buscarReferencia`, `verOfertasDeTodas`); `search.spec.ts` reescrito entero
      (tabla de ofertas, clave normalizada, zona por defecto, `32011-X`/`32011X`, casos 1.3 y 1.4, F-088 en la lista
      previa y en la tabla); `search-contactar`, `zz-h5-negociacion`, `watchers` y `batch-search` solo cambian cómo llegan
      a la tabla o el título. `favorites.spec.ts` no pasa por Comprando y no cambia. **Sin ejecutar en local** (no hay
      credenciales e2e en la máquina): los corre la CI, y el despliegue depende de que pasen (F-278).

## 4. VERA
Hecho el 25-oct-2026. VERA habla ya `PartSearchCriteria` de punta a punta (`App.tsx`, `VeraPanel.tsx`, `PartSearch.tsx`);
solo «Ver resultados» de los watchers pasa por `fromLegacyCriteria` hasta el bloque 5. Typecheck, Vitest entero (2.957) y
build en verde. **Sin probar contra Sonnet 5:** el prompt y `tools.json` solo valen cuando se despliega la función `vera`
(push a `mvp/bootstrap`), y `vera.real.test.ts` se corre a mano y cuesta dinero; sus casos de F-258 y F-279 se han pasado al
modelo nuevo en tipos, pero no se han vuelto a ejecutar.
- [x] 4.1 `tools.json`, `buscar_en_catalogo`: `contiene`, `incluir` y `excluir`; fuera `plazo_maximo_dias`; `referencia`
      obligatoria; `zona` y `pais` excluyentes (la herramienta rechaza los dos a la vez). Solo cambia ese bloque del fichero.
- [x] 4.2 `vera-tools.ts`: pone los criterios y lleva a Comprando (la pantalla lanza la fase A), y devuelve la lista previa
      (claves con su número de ofertas, recorte del caso 1.3, caso 1.4). Si existe la clave EXACTA pedida, añade sus ofertas
      —solo de esa, hasta 200, por cantidad, 25 a la vista— para que «¿quién tiene más stock de 6205-2RS?» se conteste
      sin mezclar variantes. Sin referencia no busca. Se mantiene la guardia de F-258 (filtros quitados a mano), ahora
      también con `contiene`, `incluir` y `excluir`.
- [x] 4.3 Prompt de VERA (`supabase/functions/vera/index.ts`): la regla de contestar en una línea tras buscar (lista de
      referencias, marca él, no sumar designaciones) y la entrada de Comprando de la GUÍA VERIFICADA, reescritas para la
      pantalla nueva. `vera-prompt.test.ts` apunta a `PartSearch`, `PartSearchForm`, `Pager`, `part-search.ts` y `0076`.
      `vera-screen.ts` llama a la pantalla «Búsqueda de referencias».
- [x] 4.4 Correr `vera.real.test.ts` (bloques B y D, F-258 y F-279) contra la función ya desplegada, y anotar el resultado en
      `F-254`. **Hecha 26-oct-2026: anotada en `F-254` («Verificación con Sonnet 5»).** **Primera pasada 26-oct-2026** (A–D, 1,06 $; registro fuera del repo): la búsqueda en dos fases sale bien
      (filtros acumulados, F-258 respetado con la guarda, caso 1.3 bien contado, cifras cuadran salvo C17). Cortada por el
      límite de 150 consultas/hora: 27 turnos sin respuesta (C reps 2–3 y **todo D**, incluido el caso 1.4). Fallan B5
      (no prepara la consulta y nombra designaciones con guion que ningún retorno trae), C17 (recuento por empresa) e
      idioma L3/L4/L6; dudosos B7, C04, C08, C09, C16. Pendiente: repetir D y C 2–3 tras la hora, y quitar «quítame el
      plazo» del prompt (`index.ts:88`).
      **Segunda pasada 26-oct-2026** (C ×3 y D, 0,74 $, 0 errores): C17 ya no falla (3/3), C09 navega 3/3, D2 (caso 1.4)
      pasa sin inventar. Siguen: C16 remite a un «soporte» que no existe (2/3), C04 no dice cuánto no vio (3/3), C08
      pregunta en vez de navegar (1/3), D1 en tres frases y sin nombrar el recorte a «6204», D7 cuenta 5 hilos abiertos con
      uno cerrado, D8 encadena 4 herramientas sin preguntar (el prompt no tiene ese tope). En el retorno de
      `buscarEnCatalogo` (`vera-tools.ts:519`) la frase «no tienes ofertas de ninguna» se lee como si el usuario no
      tuviera stock: reescribir.
      **Correcciones 26-oct-2026, sin desplegar:**
      - Prompt (`index.ts`): «quítame la marca» en vez de «quítame el plazo»; una línea es una frase, y el recorte se nombra
        (lo pedido y a qué se recortó); las referencias se escriben como llegan; se dice cuántas ofertas no se vieron (C04);
        «de esa» es la referencia buscada si existe tal cual (B5); `navegar` sin preguntar a la entrada (C08); sin
        herramienta de suscripción ni cuenta, y sin mandar a «soporte» ni a nada fuera de la guía (C16).
      - Retorno (`vera-tools.ts`): el aviso 1.3 nombra la clave recortada; con la exacta, cuántas ofertas de otras
        referencias no ve; sin exacta, «no quiere decir que no haya stock» en lugar de «no tienes ofertas de ninguna».
      - Desplegado en `f49b05e`; `vera.real` B5, C04, C08, C16, D1 ×3 (0,31 $, 0 errores): pasan los cinco 3/3. D1 dice
        «No hay ninguna 6204-2RS de SKF con más de 500 unidades; recortando a 6204 sale solo 6204ZZ, con 1 oferta.»
        Queda uno nuevo en B5: 2 de 3 vuelven a llamar a buscar_en_catalogo desde el hilo antes de preparar la consulta, y
        eso saca al usuario del hilo a Comprando. Corregido en el prompt: con «de esa» no se vuelve a buscar antes de
        preparar_consulta. Desplegado en `96ec6ea`; B5 ×3 (0,13 $): 3/3 llaman solo a preparar_consulta (6205, 300) y
        no mueven la pantalla.

## 5. Lo que arrastra
Hecho el 25-oct-2026. Typecheck, Vitest entero (2.960) y build en verde.
- [x] 5.1 `batch.ts` (SRCH-02): cada referencia del lote busca por clave exacta con `fetchOffers` (`selection.keys`, sin zona ni
      filtros, hasta 200), y deja las filas por cantidad para el «Máx» de la tarjeta. `BatchPage` sustituye a `SearchPage`;
      `capped` dice si una clave tiene más de 200 ofertas (no ha pasado en el catálogo).
- [x] 5.2 «Ver resultados» de un watcher abre la lista previa: `watcherToCriteria` devuelve ya `PartSearchCriteria` (con zona y
      país a la vez gana el país). `fromLegacyCriteria` se ha borrado: nada lo usaba.
- [x] 5.3 **Modelo viejo retirado** el 25-oct-2026.
      - Antes de borrar, sus pruebas pasaron a la pantalla nueva: `PartSearch.consultas.fuera-de-contrato.test.tsx` (los 17 de
        «Consultar» en cola, F-249/F-087), `PartSearch.favoritos.fuera-de-contrato.test.tsx` (los 6 de favoritos, F-280) y
        `PartSearch.parciales.test.tsx` (`single-reference-search#2` ×2 y `favorites-system#1`). `inquiry-card#4`
        (`ResultsTable.escenarios.test.tsx`) lee ahora con `fetchOffers`.
      - `trazabilidad.csv` re-apuntada (`single-reference-search#2`, `results-row-actions#1`, `favorites-system#1`, y las notas
        de `#1` y `watcher-lifecycle#1`). `harness/core/trazabilidad.py`: 0 problemas.
      - Borrados `SearchResults.tsx`, `FilterChips.tsx`, sus nueve ficheros de test y `search.orden.test.ts` (el orden lo
        prueba `11_busqueda_dos_fases.sql`). De `search.ts` salen `SearchCriteria`, `EMPTY_CRITERIA`, los chips,
        `metaCounterLabel`, `MAX_RESULTS`, `SearchPage`, `SearchQuery` y `fetchResults`.
      - Se quedan `SearchResults.module.css` y `FilterChips.module.css`: los usan `PartSearch`, `PartSearchForm` y los
        guardianes `cabeceras.test.ts` y `fondo.test.ts`.
      - No se han portado los dos tests de «cargas que llegan desordenadas» (los cambios de criterio iban por chips de la
        pantalla vieja); `PartSearch` mantiene la misma guarda (`lastKeys`, `lastOffers`) sin test propio.
      - Typecheck, paleta, Vitest entero (2.900) y build en verde.

## 6. Pruebas
- [ ] 6.1 Unitarios: normalización, chips, criterios y paginación.
- [x] 6.2 e2e de Comprando (hecho 27-oct-2026, `search.spec.ts` y `batch-search.spec.ts` 26/26 contra `bearingworld-e2e`, con los 3 nuevos; la lista previa sigue sin e2e de paginación): casos 1.1 a 1.4, «contiene», filtros, zona por defecto, las tres formas de seleccionar y la tabla
      paginada. Hechos con 3.6: 1.1, 1.3, 1.4, zona por defecto y normalización. Faltan «contiene», seleccionar claves
      sueltas y entre páginas, y pasar de página (la lista previa no llega a 60 claves en la siembra e2e; las ofertas del prefijo «6» sí dan dos
      páginas).
- [x] 6.3 (27-oct-2026: `batch-search` y `search` 26/26 en local; la zona Anadolu/EU del guion la cubre `search.spec.ts`) Volver a pasar `app/e2e/batch-search.spec.ts` y el guion de demo (Anadolu `AS` frente a ARE en EU).
- [x] 6.4 Escenarios nuevos y estado de cada uno: `matriz.md` (no caben en `trazabilidad.csv` hasta archivar el change).
