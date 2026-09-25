# Día 23 de V1

**Día 23 de V1 · 24-sep-2026 · Estado: CERRADO A MEDIAS — código en `mvp/bootstrap`, C5 del PO PENDIENTE.**
Fecha de máquina al escribir: `2026-09-24`, 07:07 UTC (`date -u`). Sesión de un solo objetivo:
la séptima pantalla, con cronómetro (arrancado a las 05:54:35 UTC).

> **EL DÍA EN SIETE LÍNEAS.**
>
> 1. **`SRCH-03` · Gestión de Watchers, construida: VERDE en 2 intentos** (corrida 03,
>    `corrida-03`), **0 líneas tocadas a mano de 1 279**, 8 ficheros sin tocar de 8. Artefacto
>    del Coder en `ccbf187`. **Falta la C5 del PO** — sin ella no cuenta como aceptada.
> 2. **Precondiciones, escritas a mano antes de la tarea:** `0035` (tabla `watchers`, vista
>    `watcher_list` con el estado EFECTIVO, límite de 50, RLS, cuatro acciones), su siembra
>    (`demo_watchers.sql`), la capa de datos `watchers.ts` (23 pruebas), el wiring (`Mis
>    watchers` desde `Comprando`) y el contrato (52 pruebas de unidad + 7 e2e). **`0035`
>    aplicada en las dos bases y releída del catálogo.**
> 3. **Tres corridas, una válida.** La 01 salió inválida por MI entorno (worktree sin
>    `app/.env`, `F-193`) y la 02 escaló por dos defectos de MI contrato (`F-194`) y un
>    residuo del foro (`F-195`). Las dos se conservan como evidencia y **no cuentan para la
>    cifra 2**. Coste total del generador con las tres: 0,318 $; de la válida, 0,085 $.
> 4. **Hallazgo de seguridad, dicho en voz alta: `F-192`.** En producción `authenticated`
>    tiene `UPDATE` en 17 de las 19 tablas y `anon` tiene ALL en 8 tablas antiguas. Las 19
>    tienen RLS, así que hoy protege solo la RLS; y los asertos de privilegios del banco de
>    esquema pasan porque el banco es más estricto que la plataforma. **Es del PO.**
> 5. **Docker Desktop no arranca (`F-191`)** y lo dejé peor de lo que estaba al relanzarlo a
>    la fuerza. `0035` se validó en PGlite (Postgres 18 en WASM) con tres mutaciones
>    deliberadas detectadas. **Hace falta reiniciar el PC.**
> 6. **La restricción de scroll propio, escrita por primera vez en la tarea, la cumplió el
>    Coder sin intervención (`F-198`).** n = 1, con la instrucción puesta: prueba que lo hace
>    si se le pide, no que lo haga solo.
> 7. **Tres contradicciones de la spec resueltas por mí y pendientes del PO (`F-196`):** el
>    contador `4 / 50` del ejemplo (es `1 / 50`), `País: Europa` frente a un `País` ISO, y un
>    plazo de renovación de 3 días que la spec no da.
---
**Día 23 de V1, segunda parte · 24-sep-2026 · Estado: CERRADO — dos pantallas más en producción, TRES C5 del PO PENDIENTES.**
Fecha de máquina al escribir: `2026-09-24`, ~10:55 UTC (`date -u`). El PO pidió seguir en la
misma sesión, elegir libremente dos pantallas y **dejar para la siguiente sesión la revisión de
`SRCH-03` y de todo lo demás** («no he podido mirar SRCH-03 ni revisar nada»). Docker, resuelto por él.

> **LA SEGUNDA PARTE EN SEIS LÍNEAS.**
>
> 1. **`INV-07` · Visibilidad del Inventario, construida y desplegada: VERDE en 2 intentos**
>    (`corrida-04`), 943 líneas, **0 tocadas**, 4 ficheros sin tocar de 4. **Sin migración**:
>    el esquema existe desde `0002`. Artefacto en `3415b2f`.
> 2. **`SRCH-02` · Búsqueda por Lotes, construida y desplegada: VERDE AL PRIMER INTENTO**
>    (`corrida-01`), 732 líneas, **0 tocadas**, 4 ficheros de 4. Sin migración ni consulta
>    nueva (reutiliza `fetchResults` y `ResultsTable`). Artefacto en `d29d791`.
> 3. **`INV-07` costó cuatro corridas y NINGUNA de las tres escaladas fue mérito del Coder
>    perdido**: una regex de scroll rota por el shell (`F-199`), una ambigüedad de mi
>    contrato y un e2e frágil (`F-200`), y un error de tipos real en un intento. Las tres
>    quedan como evidencia y **no cuentan para la cifra 2**.
> 4. **`F-199`, nuevo y de proceso: el shell de la herramienta de comandos se come una capa
>    de barras invertidas dentro de un heredoc, incluso entrecomillado.** Todo fichero con
>    regex o escapes se crea con el editor de ficheros. Está en §8.
> 5. **Las cifras 7 y 8 de estas dos pantallas NO son limpias** (`F-205`): comparten sesión
>    con el cierre de `SRCH-03`. Coste-sombra de la sesión entera: **60,86 $** (23,53 $ al
>    cerrar `SRCH-03`, +37,33 $ desde entonces). Solo `SRCH-03` es un punto válido.
> 6. **Pendiente, dicho en voz alta: la C5 de `SRCH-03`, `INV-07` y `SRCH-02`, más `F-192`
>    y `F-196`.** El PO no ha mirado nada de esta sesión. Nada de lo de abajo cuenta como
>    aceptado hasta que lo haga.


---

## Lo comprobado el 24-sep y las cifras (antes en §1 de ESTADO-V1)

**Tabla del 24-sep-2026, Día 23 — lo comprobado HOY:**

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-24`, 07:07 UTC al escribir; cronómetro desde 05:54:35 |
| Que `0035` está en las dos bases | `list_migrations` antes, y `execute_sql` después contra `pg_proc`/`has_table_privilege`/`has_function_privilege` (F-146: catálogo, no `.sql`) | En `troxminloxkjwihwfevs` y `ogdhyzgjjbbikjbkhxmu`: `anon` nada; `authenticated` solo `select, insert, delete` en `watchers`, solo `select` en `watcher_list`, `execute` en las cuatro acciones y en `watcher_effective_status`, nada en `init_watcher`/`check_watcher_limit`/`watcher_lock_own`/`watchers_evaluate_expirations`. **Salió `UPDATE` de `authenticated` por defecto y se revocó** (`F-192`) |
| Que el esquema aguanta | `supabase/tests/run.sh` **NO se pudo correr** (`F-191`). PGlite (Postgres 18 WASM) con 35 migraciones y `01_schema_smoke.sql`, más tres mutaciones de `0035` | Smoke verde; **las tres mutaciones (límite 51, vencimiento apagado, `select` sin filtro de organización) hacen fallar el banco**. **No es el Postgres de CI (16) ni el de las bases (17)**: la CI corre el `run.sh` real al empujar |
| Que la siembra reproduce los ejemplos de la spec | Vista `watcher_list` en las dos bases tras `demo_watchers.sql` | `6308-ZZ` 27 días, `7210-BECBP` 12 días pausado, `22316-E` PENDIENTE con «expira en 2», `NU2210-E-TVP2` TRIGGERED, `6205-2RS` EXPIRED; BETA con 2 ACTIVE |
| Que la app sigue entera | `npx vitest run` y `npx tsc --noEmit` | **1 033 pasan**, 23 saltados; typecheck limpio |
| Que el arnés valida la tarea | `python -m harness.graph.run harness/tasks/SRCH-03.json --seco` | Primero **10 problemas** (nombres accesibles que el contrato busca y la tarea no declaraba, `F-125`); corregidos, «todo verde, cero coste» |
| La corrida 03 | `harness/metrics/SRCH-03/corrida-03/`, `git show --numstat ccbf187` | VERDE en 2 intentos; intento 1 con C1 y C2 rojos; **1 279 líneas, 8 ficheros, 0 tocados**; 0,0851 $ |
| Que las corridas 01 y 02 no miden al Coder | Feedback crudo de C2 en su log | 01: `locator.fill: waiting for getByLabel('Correo electrónico')` en `auth.setup.ts` (sin `.env`). 02: tres fallos del foro, uno de anclaje en paralelo y uno de localizador ambiguo |
| El estado del foro en producción | SQL: reacciones por post de `c001`/`c003`/`c004` | Una reacción de `c003` post 2 estaba en `c004` post 2; repuesta con la sentencia de `demo_forum.sql`: **5 reacciones**, distribución de la siembra |
| Que producción tiene RLS en todo | SQL sobre `pg_class.relrowsecurity` | 19 tablas, **19 con RLS**, ninguna sin ella |
| Cifra 7 | `python -m harness.core.orchestration_metrics` con `c11dd857….jsonl` copiado al directorio del worktree (`F-197`) | **23,53 $** de coste-sombra, `claude-sonnet-5`, hasta la corrida 03 |
| Que `npm run dev`/e2e apuntan a producción | `app/.env`, solo el ref | `troxminloxkjwihwfevs` (`F-188`, decidido): **los e2e de hoy escribieron en producción** (solo pausar/reactivar, con `finally`) |
| **Que el resultado visual de `SRCH-03` es bueno** | **No lo he verificado yo**: solo tests y e2e | **C5 del PO PENDIENTE** |
| La CI y el despliegue | `gh run view 35968038084` job a job; descarga de `/assets/index-DE2H8RwC.js` y `index-DVsylPPU.css` y `grep` | Los **seis jobs** en verde (incluido `Esquema` con `run.sh` en Postgres 16, que cierra lo que `F-191` dejó sin verificar para `0035`); el bundle lleva `Mis watchers`, `watcher_list` y el `.screen` con `overflow-y:auto` |

**Las ocho cifras de la séptima pantalla:**

| # | Cifra | `SRCH-03` | Nota |
|---|---|---|---|
| 1 | Pantallas aceptadas | **pendiente de C5** | Construida y verde |
| 2 | Corridas sin escalada | **Sí** (la 03) | Las 01 y 02 escalaron por entorno y contrato: no cuentan (`UMBRAL` §5.3) |
| 3 | Verde al primer intento | **No** | Intento 1 rojo en C1 y C2 |
| 4 | Corrección humana | **0 %** (0 de 1 279) | |
| 5 | Ficheros sin tocar | **8 de 8** | |
| 6 | Coste del generador | **0,085 $** (0,318 $ con las dos inválidas) | Dentro del tope de 0,25 $ solo la válida: **con las repeticiones lo supera** |
| 7 | Coste de orquestación | **23,53 $** | Incluye ~35 minutos de Docker (`F-191`) y la sesión entera hasta la corrida; **primera cifra 7 medida en sesión propia** |
| 8 | Tiempo de reloj | **1 h 10 min hasta «lista para C5»** (05:54→07:04 UTC), ~35 min de ellos en `F-191` | **Sin cerrar: falta la C5**; el reloj se para mientras espera al PO |

**Tabla del 24-sep-2026, segunda parte — lo comprobado HOY:**

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-24`, 10:47 UTC cuando `SRCH-02` quedó lista; ~10:55 al escribir |
| Que Docker ya funciona | `docker version` | Servidor `29.6.1` (el PO lo resolvió; `F-191` cerrado por él) |
| Que `INV-07` no necesita migración | `supabase/migrations/0002_inventory.sql` (columna `inventory_visibility_mode`, tabla `inventory_exclusions`, políticas `exclusions_select_own`/`exclusions_write_admin`) | Existe todo lo que la pantalla lee y escribe; **la tarea no toca el esquema** |
| Que `SRCH-02` no necesita consulta nueva | Lectura de `fetchResults` y `ResultsTable` | Se reutilizan tal cual; `batch.ts` solo orquesta con concurrencia 5 |
| La capa de datos de las dos | `npx vitest run` | `visibility.ts` 10 pruebas, `batch.ts` 23 |
| Que el arnés valida las dos tareas | `python -m harness.graph.run … --seco` | `INV-07`: primero 2 problemas (`approved_html` con nombre equivocado y un nombre accesible sin declarar, `F-125`); `SRCH-02`: verde a la primera |
| Las corridas | `harness/metrics/INV-07/corrida-01..04/`, `harness/metrics/SRCH-02/corrida-01/`, `git show --numstat` | `INV-07`: 01, 02 y 03 ESCALADAS por causas que no son el artefacto (`F-199`, `F-200`), **04 VERDE en 2**, 943 líneas; `SRCH-02`: **VERDE en 1**, 732 líneas |
| Que el artefacto de `INV-07` era bueno ya en la 01 | Restaurado desde `attempt_3.json` y corrido contra el contrato corregido; y el del intento 1 de la 03 contra `visibility.spec.ts` aislado | 40 de 40 pruebas de unidad; 6 de 6 e2e |
| Que la app sigue entera | `npx vitest run` y `npx tsc --noEmit` en cada cambio | **1 083** pasan tras `INV-07`, **1 143** tras `SRCH-02`, 23 saltados; typecheck limpio |
| Que la base no se movió con los e2e | SQL por el MCP, al cerrar | 0 exclusiones, 0 organizaciones en modo restringido, 3 pagos, 5 reacciones, 7 watchers (los cinco estados de ALPHA); **la siembra** |
| La CI y el despliegue | `gh run view` job a job sobre `0539cd7` (`35988617659`) y `9979a86` (`35989285281`); descarga de los dos bundles y `grep` | Los **seis jobs** en verde en los dos, incluidos los despliegues; producción sirve `Visibilidad del inventario`, `inventory_exclusions`, `Exclusión por geografía`, `Búsqueda por lotes`, `Resultados por referencia` y `resumen-busqueda-por-lotes`, y **cinco** bloques `._screen_…{…overflow-y:auto}` en el CSS |
| **Que las tres pantallas se ven bien** | **No lo he verificado yo**: solo tests y e2e | **C5 del PO PENDIENTE para `SRCH-03`, `INV-07` y `SRCH-02`** |

**Las cifras de las dos pantallas nuevas** (las 7 y 8 NO son limpias, `F-205`):

| # | Cifra | `INV-07` | `SRCH-02` |
|---|---|---|---|
| 1 | Aceptada | **pendiente de C5** | **pendiente de C5** |
| 2 | Corrida sin escalada | **Sí** (la 04; 01–03 no cuentan) | **Sí** |
| 3 | Verde al primer intento | **No** (intento 1 rojo en C2) | **Sí** |
| 4 | Corrección humana | **0 %** (0 de 943) | **0 %** (0 de 732) |
| 5 | Ficheros sin tocar | **4 de 4** | **4 de 4** |
| 6 | Coste del generador | **0,076 $** (0,622 $ con las tres inválidas) | **0,043 $** |
| 7 | Orquestación | sin medida limpia (sesión compartida) | sin medida limpia |
| 8 | Reloj | ~50 min hasta «lista» (09:51→10:40, con cuatro corridas) | ~7 min más (10:47) |


---

## Corriente B, 20–24-sep (antes en §2 de ESTADO-V1)

**24-sep-2026, segunda parte: `INV-07` y `SRCH-02` construidas y desplegadas.** Las dos sin migración. `INV-07` se abre desde INV-01 (botón `Visibilidad`) y `SRCH-02` desde SRCH-01 (botón `Búsqueda por lotes`); ambas con su estado en `App.tsx` (`visibilityOpen`, `batchOpen`), que se limpia al cambiar de ítem de nav. **`INV-07`:** el modo se guarda con `Guardar configuración`, las exclusiones se escriben al momento, solo el ADMIN escribe (un EDITOR ve un aviso y controles deshabilitados). **`SRCH-02`:** hasta 50 referencias, tarjetas colapsables con la tabla de `SRCH-01`, exportación a **CSV** (no PDF); **`Crear watchers` (en lote e inline) queda deshabilitado** hasta que VERA confirme (`F-204`).

**24-sep-2026: `SRCH-03` construida.** Precondiciones a mano (`0035`, siembra, `watchers.ts`, wiring, contrato), corrida 03 VERDE en 2 intentos, 1 279 líneas sin una tocada, y las ocho cifras arriba (§1). **Es la primera pantalla con el scroll propio escrito en la tarea, y el Coder lo cumplió** (`F-198`). Entrada: botón `Mis watchers` en SRCH-01 (`App.tsx` mantiene `watchersOpen`, que se limpia al cambiar de ítem de nav). **Sin crear watchers desde la pantalla** (spec §6: se crean desde SRCH-01/02 o por VERA, que no existen), **sin evaluación contra `stock.updated`, sin email, sin badge en el nav**: `0035` lo dice en su cabecera.

**22-sep-2026: `SRCH-03` · Gestión de Watchers elegida como séptima pantalla**, delegado
por el PO a esta sesión. Razonamiento completo (módulo sin tocar por la corriente B, forma
conocida y coste medio, por qué no `INV-07`) en `UMBRAL-FABRICA-V1.md` §8. **No construida
hoy, a propósito:** el relevo del Día 21 pide una sesión nueva por pantalla y cronómetro
para que las cifras 7 y 8 tengan veredicto, y construirla en esta sesión habría repetido el
mismo defecto de medición.

**22-sep-2026, segunda parte del día: `F-189` confirmado por el PO en su localhost, y
`F-190` — el PO encontró el MISMO fallo de scroll en `DIR-01` y `ADMIN-01`.** Con eso, **las
seis pantallas que ha construido la corriente B hasta hoy han tenido, en algún momento, el
mismo fallo de scroll dentro de `.bwcnt`** (`DIR-01`/`F-190`, `ADMIN-01`/`F-190`,
`FORO-01`/`F-189`, `FORO-02`/`F-186`, `FORO-03`/`F-186`, `ADMIN-02`/`F-189`), todas
arregladas hoy y desplegadas. Deja de ser una sospecha puntual: **es un hueco sistemático
de la tarea que recibe el Coder**, y §3.3 lo deja como pendiente explícito para la próxima
tarea que se escriba.

**`ADMIN-02` corrió, y es la sexta.** Artefacto del Coder en `993db73`, sin una sola
corrección a mano; contrato de aceptación corregido en `ab27b0f`; CI entera verde y
desplegada. **Veredicto del arnés: ESCALADO 3/4** — y ese número no dice lo que parece,
porque los ocho e2e que fallaron eran del contrato (`F-183`) y el intento 1, pasado por la
batería corregida, sale verde entero. Ver el bloque del Día 20.

**La remedición a seis, HECHA el 21-sep: «Funciona con supervisión» — escenario base, 21 semanas, corriente B con dos agentes** (el mismo veredicto del H1). Fallan la cifra 3 (1 de 6) y la 5 (`FORO-02`, 0 de 2 ficheros sin tocar); las cifras 1, 2, 4 y 6 cumplen; **las 7 y 8 no tienen veredicto** (no hay medida limpia ni reloj). Detalle, fuentes y errata en `openspec/v1/remedicion-seis-pantallas.md`.

> **Depende de tres decisiones del PO del 21-sep, y la primera es la que manda:** las escaladas de `FORO-03` (`F-174`) y `ADMIN-02` (`F-183`) **no cuentan** para la cifra 2. Contadas como las cuenta el arnés serían dos, y la regla de `UMBRAL` §4 diría «No rinde». Las otras dos: la cifra 3 queda en 1 de 6 (no importa la lectura, falla en ambas) y `F-172` cuenta como corrección de C5 en `FORO-02`.

**Las otras cinco:** el H1 (`DIR-01`, `ADMIN-01`, `FORO-01`) cerrado el Día 16 con C5 del
PO y sin correcciones; `FORO-02` y `FORO-03` con C5 dado el 21-sep (reparos en `F-186`, arreglados).

**C5 pendientes: NINGUNA.** El PO dio el 21-sep-2026, en `npm run dev` contra la base de producción y sin pulsar ninguna acción de escritura: `ADMIN-02` («aprobada total»), `FORO-02` y `FORO-03` (aprobadas; los dos reparos que puso salieron en `F-186` y están arreglados, y el PO confirmó el arreglo en su localhost el mismo 21-sep).


---

## Cierres y adendas del 24 y 25-sep (antes al pie de ESTADO-V1)

*Cierre del Día 23 · 24-sep-2026 · `2026-09-24` 07:1x UTC (`date -u`) · `SRCH-03` construida y VERDE (corrida 03, 2 intentos, 0 líneas tocadas de 1 279), `0035` en las dos bases y releída del catálogo, **C5 del PO PENDIENTE** — sin ella ni la cifra 1 ni la 8 se cierran · tres hallazgos abiertos para el PO (`F-192` privilegios anchos en producción, `F-196` tres decisiones de spec, `F-178` foro sin teardown) y uno de máquina (`F-191`, Docker: reiniciar el PC) · **CI del commit de cierre (`gh run` `35968038084` sobre `86083bd`): los seis jobs en verde**, incluido `Esquema` —el `run.sh` real en Postgres 16, que es la primera vez que ve `0035` (`F-191`)— y los dos despliegues; **producción sirve `SRCH-03` por contenido, no por `HTTP 200`** (`Mis watchers` y `watcher_list` en `/assets/index-DE2H8RwC.js`, y `._screen_4d4hn_10{…flex:1;min-height:0;…overflow-y:auto}` en `/assets/index-DVsylPPU.css`) · Dirección Técnica, Nortex Systems*

*Cierre del Día 23, segunda parte · 24-sep-2026 · `2026-09-24` ~10:55 UTC (`date -u`) · `INV-07` (VERDE en 2, 943 líneas) y `SRCH-02` (VERDE en 1, 732 líneas) construidas y desplegadas, **0 líneas tocadas a mano en las dos**, sin migraciones · **CI de `0539cd7`, `9979a86` y del propio commit de cierre `80792d9` (`35990089287`): los seis jobs en verde en las tres**, producción sirve las dos por contenido · **TRES C5 del PO PENDIENTES** (`SRCH-03`, `INV-07`, `SRCH-02`) y todo lo demás que no ha podido revisar · `F-199` a `F-205` nuevos; abiertos para el PO `F-192`, `F-196`, `F-201`, `F-202`, `F-204` y `F-178` · servidores parados, junctions quitados, la base en su siembra · Dirección Técnica, Nortex Systems*

> **Adenda del 24-sep-2026, tras la revisión del PO en pantalla (`F-206`, `F-207`).** Revisó `SRCH-03`, `INV-07` y `SRCH-02`: **«las dos primeras perfectas en todo»** (`SRCH-03` y `SRCH-02`: **C5 dadas**, en el orden en que se le dieron las tres) y dos comentarios sobre la última, `INV-07`, **que sigue con la C5 pendiente hasta que vuelva a mirarla**. (1) Las sugerencias del autocompletado parecían etiquetas ya incluidas: **rehechas como desplegable** (`d02f3fb`) — **y el PO pidió revertirlo por ser un cambio estético que no había pedido: revertido, el frontend de `INV-07` vuelve a ser el del Coder tal cual, 0 líneas tocadas** (`F-206`). Después dijo que «no encuentra organizaciones»: **`F-208`**, causa real una `Ł` sin normalizar (arreglada en la capa de datos) y el resto son datos (organizaciones de la spec inexistentes en la demo, suspendidas ocultas por la RLS, la propia excluida). (2) «Guardar no guarda»: **no se reproduce** con un e2e completo contra la base; se endurecen `saveVisibilityMode` y `removeExclusion` para no dar por guardada una escritura filtrada por la RLS. **Y se corrige aquí una frase falsa de este relevo** (`F-207`): con la lista vacía el modo restringido NO oculta el stock.

> **Segunda adenda del 24-sep-2026 (`F-209`, `F-210`): la comparación de `INV-07` contra el diseño aprobado, medida.** El PO señaló que la pantalla no coincidía con lo que recordaba: filtros `Asia`/`Rusia`, continente y país en una fila, tamaños de letra distintos, un botón que cambiaba de tamaño al guardar y desplegables de países «muy restringidos». **Era el diseño aprobado, y tenía razón en casi todo:** medido en el navegador contra `INV-07 · VIS v1.0.html`, el botón se encogía a 20 px al guardar (fallo real del artefacto), la letra del botón era de 16 px (diseño: 14), los desplegables solo ofrecían países con organizaciones y faltaban los títulos de las tarjetas. **Arreglado a mano (+76/−28 líneas, 8 %) y verificado con las mismas medidas.** Lo que NO se ha tocado: la cabecera, que sigue los tokens de la app como `FORO-01` y `SRCH-03`. **Lección de proceso:** el arnés no mide tamaño (`C3` solo mira color) y las 40 pruebas pasaban con un botón roto; una comprobación tipográfica contra el HTML aprobado debería entrar en el contrato de cada pantalla.

> **Adenda del 25-sep-2026, `2026-09-25` ~09:40 UTC (`date -u`): las TRES C5 recibidas.** El PO probó en su localhost, con ALPHA, `SRCH-03`, `INV-07` y `SRCH-02` ya desplegadas y con las correcciones de `F-209`/`F-210`: **«todo perfecto»**. **`SRCH-03`, `INV-07` y `SRCH-02` quedan ACEPTADAS** (cifra 1: 9 de 24 construidas y aceptadas por la corriente B, más las 6 remedidas). Cierran `F-206` a `F-210`. **Y una limpieza al cerrar:** la revisión dejó en producción a ALPHA en **modo restringido con cuatro exclusiones** (Asia, Turquía, una organización y Venezuela), que ocultaba su stock a esa organización; **restaurada la siembra** (modo abierto, solo `Asia` y `Rusia`, `demo_exclusions.sql`). Lo que queda para la próxima sesión está en §3: nada de esta sesión espera ya al PO salvo las decisiones de producto.
