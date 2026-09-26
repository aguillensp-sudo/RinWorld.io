# Findings Register — MVP Bearingworld.io

> Índice. El detalle completo de cada hallazgo está en `findings/F-NNN.md`. Nuevo hallazgo: añade su fila aquí y crea su fichero.

Registro de hallazgos del MVP. Clasificación: `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`.

| ID | Fecha | Clasificación | Título | Estado |
|---|---|---|---|---|
| [F-043b](findings/F-043b.md) | 2026-08-10 | `SPEC-GAP` | `RETIRADA` sí tiene una fuente aprobada, y no es el `Plan §7`: es VND-01. | Cerrado |
| [F-001](findings/F-001.md) | 2026-08-05 | `INFRA` | DeepSeek oficial `deepseek-v4-flash` | Cerrado |
| [F-002](findings/F-002.md) | 2026-08-05 | `MODEL` | C1 (compila) pass, C4 (idiomático) pass | Cerrado |
| [F-003](findings/F-003.md) | 2026-08-05 | `HARNESS` | Corregido el 7-ago tras revisar los HTML aprobados: el diagnóstico original era erróneo en dos puntos y el Coder salió mejor parado de lo q... | Cerrado |
| [F-004](findings/F-004.md) | 2026-08-05 | `DESIGN` | 72px | Cerrado |
| [F-005](findings/F-005.md) | 2026-08-05 | `HARNESS` | `max_tokens=8192` truncó la salida de un modelo de razonamiento (`finish_reason: length`), sin artefacto. | Cerrado |
| [F-006](findings/F-006.md) | 2026-08-05 | `INFRA` | propaga entre dos sesiones | Cerrado |
| [F-007](findings/F-007.md) | 2026-08-05 | `INFRA` | descartó 6/20 | Cerrado |
| [F-008](findings/F-008.md) | 2026-08-05 | `SPEC-GAP` | cifra nativamente extremo a extremo | Abierto |
| [F-009](findings/F-009.md) | 2026-08-06 | `HARNESS` | No se corrige el trailer: | Cerrado |
| [F-010](findings/F-010.md) | 2026-08-06 | `HARNESS` | 0.003581 | Cerrado |
| [F-011](findings/F-011.md) | 2026-08-06 | `HARNESS` | 99,58% de cache hit | Cerrado |
| [F-012](findings/F-012.md) | 2026-08-06 | `HARNESS` | parafraseó mal dos capabilities cerradas | Cerrado |
| [F-013](findings/F-013.md) | 2026-08-06 | `INFRA` | 500 `unexpected_failure` · "Database error querying schema" | Cerrado |
| [F-014](findings/F-014.md) | 2026-08-06 | `HARNESS` | NULL siempre | Cerrado |
| [F-015](findings/F-015.md) | 2026-08-06 | `HARNESS` | Un `test.skip` condicional reportó verde sin probar nada. | Cerrado |
| [F-016](findings/F-016.md) | 2026-08-06 | `DESIGN` | No hay HTML aprobado de la pantalla de inicio de sesión. | Abierto |
| [F-017](findings/F-017.md) | 2026-08-06 | `DESIGN` | ninguna consulta por rol es unívoca | Cerrado |
| [F-018](findings/F-018.md) | 2026-08-07 | `SPEC-GAP` | SRCH-01 exigía dos cosas que el esquema del día 2 no tenía. | Cerrado |
| [F-019](findings/F-019.md) | 2026-08-07 | `DESIGN` | Las dos organizaciones nacieron con el nombre mal escrito, y ese nombre es contenido de demo. | Cerrado |
| [F-020](findings/F-020.md) | 2026-08-07 | `INFRA` | La migración 0005 rompió el login, y el mensaje de error lo tapó. | Cerrado |
| [F-021](findings/F-021.md) | 2026-08-07 | `HARNESS` | Las migraciones 0005 y 0006 añaden la misma columna dos veces y el registro cuenta una historia que los ficheros no contienen. | Cerrado |
| [F-022](findings/F-022.md) | 2026-08-07 | `MODEL` | El Coder pasa una tarea de datos al primer intento, y deja la primera cifra de coste en frío del proyecto. | Cerrado |
| [F-023](findings/F-023.md) | 2026-08-07 | `DESIGN` | El diseño aprobado de INV-01 promete cuatro cosas que el MVP no tiene, y una es un agujero del propio diseño. | Abierto |
| [F-024](findings/F-024.md) | 2026-08-07 | `HARNESS` | Dos trampas para el Test-runner del día 5, las dos de la misma familia que F-003: comparar contra el mock en vez de contra el spec. | Cerrado |
| [F-025](findings/F-025.md) | 2026-08-07 | `DESIGN` | El HTML de cada pantalla lleva un shell distinto del shell base aprobado, y eso va a romper el criterio C2 del arnés desde el día 5. | Cerrado |
| [F-026](findings/F-026.md) | 2026-08-09 | `HARNESS` | El chip decía `Desactualizados (3)` sobre una tabla con dos filas en naranja: la misma regla del spec implementada dos veces, con dos borde... | Cerrado |
| [F-027](findings/F-027.md) | 2026-08-09 | `SPEC-GAP` | La spec de MSG-01 promete dos cosas que el esquema no puede sostener, y una de ellas se contradice consigo misma dos secciones más abajo. | Abierto |
| [F-028](findings/F-028.md) | 2026-08-10 | `HARNESS` | `npm` no se podía ejecutar, y los checks lo reportaron como si el Coder hubiera fallado. | Cerrado |
| [F-029](findings/F-029.md) | 2026-08-10 | `HARNESS` | C4 suspendió tres veces un componente correctamente tipado. | Cerrado |
| [F-030](findings/F-030.md) | 2026-08-10 | `HARNESS` | La tarea declaraba `data_layer` y el prompt no lo entregaba. | Cerrado |
| [F-031](findings/F-031.md) | 2026-08-10 | `HARNESS` | C2 no se había ejecutado ni una vez en todo el proyecto. | Cerrado |
| [F-032](findings/F-032.md) | 2026-08-10 | `HARNESS` | La salida de los checks se perdía por decodificarse en cp1252. | Cerrado |
| [F-033](findings/F-033.md) | 2026-08-10 | `HARNESS` | El CSV no distingue un check en ROJO de un check INEJECUTABLE | Cerrado el 12-ago: tercer estado por che |
| [F-034](findings/F-034.md) | 2026-08-10 | `SPEC-GAP` | Al formato congelado el día 4 le faltaba un campo, y se vio en su primer uso real. | Cerrado |
| [F-035](findings/F-035.md) | 2026-08-10 | `DESIGN` | El panel de contenido salió sin padding | Cerrado |
| [F-036](findings/F-036.md) | 2026-08-10 | `MODEL` | El dato del día sobre el Coder, y no es el que se esperaba medir. | Abierto |
| [F-037](findings/F-037.md) | 2026-08-10 | `INFRA` | Por qué la CI llevaba roja desde el día 2, y no era nada de lo que se sospechaba. | Cerrado |
| [F-038](findings/F-038.md) | 2026-08-10 | `INFRA` | La contraseña de la cuenta de pruebas ha estado descargable en texto plano desde un repositorio público. | Cerrado |
| [F-039](findings/F-039.md) | 2026-08-10 | `SPEC-GAP` | Dos specs cerradas dicen cosas distintas sobre cuándo se habilita "Consultar seleccionados", y no es un matiz de redacción. | Abierto |
| [F-040](findings/F-040.md) | 2026-08-10 | `SPEC-GAP` | Una advertencia del fichero de relevo no sobrevivió a comprobarla, y es justo para eso que existe la regla. | Cerrado |
| [F-041](findings/F-041.md) | 2026-08-10 | `DESIGN` | El HTML aprobado de SRCH-01 titula la pantalla "Mis consultas"; su spec la titula "Resultados de búsqueda". | Cerrado |
| [F-042](findings/F-042.md) | 2026-08-10 | `HARNESS` | La corrida en seco ignora la tarea que se le pasa. | Cerrado |
| [F-043](findings/F-043.md) | 2026-08-10 | `SPEC-GAP` | La máquina de estados que el `Plan §7` dibuja no es la del spec cerrado ni la del DDL desplegado, y el trabajo del día se llama literalment... | Abierto |
| [F-044](findings/F-044.md) | 2026-08-10 | `SPEC-GAP` | Nadie escribe `threads.state`, y MSG-01 lleva desde ayer pintando badges de esa columna. | Cerrado |
| [F-045](findings/F-045.md) | 2026-08-10 | `SPEC-GAP` | Cuatro specs aprobadas dicen que `CERRADO SIN ACUERDO` es irreversible, y ninguna contempla reabrir el hilo escribiendo. | Cerrado |
| [F-046](findings/F-046.md) | 2026-08-10 | `HARNESS` | El escalado reventó al imprimir su propia razón, y la razón se perdió. | Cerrado |
| [F-047](findings/F-047.md) | 2026-08-10 | `HARNESS` | La corrida escaló 3/3 y lo que suspendió fue el contrato de aceptación, no el artefacto. | Cerrado |
| [F-048](findings/F-048.md) | 2026-08-10 | `HARNESS` | La convención ASCII del JSON de tarea se filtró a literales que ve el usuario. | Cerrado |
| [F-049](findings/F-049.md) | 2026-08-10 | `HARNESS` | Un test de aceptación exigía un control que el `component_api` no daba con qué implementar. | Cerrado |
| [F-050](findings/F-050.md) | 2026-08-10 | `INFRA` | Detrás de F-037 había una segunda causa: a la clave le sobraba un `;`. | Cerrado |
| [F-051](findings/F-051.md) | 2026-08-10 | `SPEC-GAP` | Una organización podía aceptar su propia oferta. | Cerrado |
| [F-052](findings/F-052.md) | 2026-08-11 | `INFRA` | Una suite que no arranca deja de cubrirse a sí misma, y acumula defectos propios que solo aparecen el día que vuelve a correr. | Cerrado |
| [F-053](findings/F-053.md) | 2026-08-11 | `INFRA` | Quinta vez que el veredicto sobrevive y la razón no, y esta en el trabajo de esquema. | Cerrado |
| [F-054](findings/F-054.md) | 2026-08-11 | `INFRA` | La ruta de despliegue que este registro le dio al PO no existe. | Cerrado |
| [F-055](findings/F-055.md) | 2026-08-11 | `INFRA` | Las dos migraciones que cerraban dos agujeros vivos no las prueba nada. | Cerrado |
| [F-056](findings/F-056.md) | 2026-08-11 | `INFRA` | La guardia que cerraba F-051 se desactivaba a sí misma, y estuvo así en producción. | Cerrado |
| [F-057](findings/F-057.md) | 2026-08-11 | `HARNESS` | El arnés solo sabía enseñar UNA capa de datos, y MSG-02 importa de tres. | Cerrado |
| [F-058](findings/F-058.md) | 2026-08-11 | `HARNESS` | Nueve asertos del contrato de MSG-02 pasaban en VERDE contra un componente que no pintaba nada. | Cerrado |
| [F-059](findings/F-059.md) | 2026-08-11 | `MODEL` | Tercera pantalla seguida que escala 3/3, y por tercera vez el modelo tuvo la salida exacta de `tsc` delante en dos reintentos sin resolverl... | Cerrado |
| [F-060](findings/F-060.md) | 2026-08-11 | `HARNESS` | Quinta repetición de F-046, esta vez de mi propia mano: la escalada volvió a no verse en el código de salida. | Cerrado |
| [F-061](findings/F-061.md) | 2026-08-11 | `INFRA` | La publicación `supabase_realtime` estaba VACÍA, y SP-3 la dio por buena el día 1. | Cerrado |
| [F-062](findings/F-062.md) | 2026-08-11 | `INFRA` | 0011 funcionaba contra el remoto y reventaba la CI. | Cerrado |
| [F-063](findings/F-063.md) | 2026-08-11 | `HARNESS` | Construir una pantalla por el arnés deja DOS commits rojos en la CI, y los dos son rojos por diseño. | Cerrado |
| [F-064](findings/F-064.md) | 2026-08-11 | `HARNESS` | ⚠ EL REINTENTO DEL ARNÉS NO LE ENSEÑA AL CODER EL CÓDIGO QUE ESCRIBIÓ, y eso invalida tres días de conclusiones sobre el modelo. | CERRADO el 12-ago-2026 a las 10:12 en `e |
| [F-065](findings/F-065.md) | 2026-08-12 | `SPEC-GAP` | ⚠ `Dia-08_decisiones_e2ee.md` AFIRMABA CON LA PALABRA "COMPROBADO" ALGO QUE NO ERA CIERTO, y detrás de esa afirmación iba una migración inn... | Cerrado el 12-ago: 0012 escrita sin colu |
| [F-066](findings/F-066.md) | 2026-08-12 | `HARNESS` | Un aserto negativo del e2e que NUNCA pudo casar, y llevaba un día en verde diciendo que medía la frontera del cifrado. | Cerrado el 12-ago |
| [F-067](findings/F-067.md) | 2026-08-12 | `SPEC-GAP` | Divergencia deliberada de ADR-001, registrada y no escondida: | Abierto |
| [F-068](findings/F-068.md) | 2026-08-12 | `HARNESS` | ⚠ EL ARNÉS LE MANDA AL CODER LOS CÓDIGOS DE COLOR DE LA TERMINAL COMO TEXTO, y el intento 3 pegó dos dentro de un `import`. | Cerrado |
| [F-069](findings/F-069.md) | 2026-08-12 | `HARNESS` | El único defecto real del intento 1 lo causó mi tarea: le di el `style_reference` equivocado. | Cerrado |
| [F-070](findings/F-070.md) | 2026-08-12 | `HARNESS` | ⚠ LOS CUATRO CHECKS DEL ARNÉS NO VEN EL E2E, así que un artefacto puede salir 4/4 VERDE y romper la suite entera. | Cerrado |
| [F-071](findings/F-071.md) | 2026-08-12 | `INFRA` | La orden que le di al PO —"añade `SUPABASE_SERVICE_KEY` como secret de GitHub"— no habría servido de nada, y por dos motivos independientes. | Cerrado |
| [F-072](findings/F-072.md) | 2026-08-12 | `INFRA` | El primer despliegue a Vercel falló, y la simulación que escribí para que no fallara no podía haberlo cazado. | Cerrado |
| [F-073](findings/F-073.md) | 2026-08-12 | `INFRA` | La CLI de Supabase está logueada en la cuenta equivocada, y la respuesta del PO daba por hecho que no. | Cerrado |
| [F-074](findings/F-074.md) | 2026-08-12 | `HARNESS` | Tres asertos negativos de MI PROPIO contrato pasaban contra un fichero vacío | Cerrado |
| [F-075](findings/F-075.md) | 2026-08-12 | `MODEL` | EL RIESGO #1 DEL PROYECTO, OBSERVADO. | Cerrado |
| [F-076](findings/F-076.md) | 2026-08-12 | `HARNESS` | Los tests de unidad no vieron que la aplicación real había cambiado de comportamiento; el e2e sí. | Cerrado |
| [F-077](findings/F-077.md) | 2026-08-13 | `HARNESS` | Cuatro selectores del contrato de aceptación se corrigieron DESPUÉS de ver el artefacto, y eso contamina la medida. | Cerrado |
| [F-078](findings/F-078.md) | 2026-08-13 | `HARNESS` | ESTA ENTRADA SE ESCRIBIÓ MAL Y SE CORRIGE ENTERA. | Cerrado |
| [F-079](findings/F-079.md) | 2026-08-13 | `MODEL` | EL ÚNICO DEFECTO REAL DEL ARTEFACTO, y era un bucle infinito de consultas. | Cerrado |
| [F-080](findings/F-080.md) | 2026-08-13 | `HARNESS` | Un aserto de aislamiento demasiado ancho prohibía el producto. | Cerrado |
| [F-081](findings/F-081.md) | 2026-08-13 | `HARNESS` | Escribí en el relevo, como 🔴 dirigido al PO, que la `DEEPSEEK_API_KEY` estaba rotada. Me lo inventé. | CERRADO el 17-ago por el PO: no hubo nin |
| [F-082](findings/F-082.md) | 2026-08-13 | `MODEL` | `ON CONFLICT DO NOTHING` no evita que un trigger `BEFORE INSERT` se dispare. | Cerrado |
| [F-083](findings/F-083.md) | 2026-08-13 | `MODEL` | `sendInquiries` envolvía la CEK solo para el distribuidor, nunca para quien escribía. | Cerrado |
| [F-084](findings/F-084.md) | 2026-08-13 | `INFRA` | 🔴 **Las tres variables de entorno de *Production* en Vercel valían literalmente `"n"`, puestas así desde el 12-ago. | Cerrado |
| [F-085](findings/F-085.md) | 2026-08-13 | `HARNESS` | `ESTADO.md` afirmó durante dos días seguidos que el día 11 (`Plan §3`) era la reunión con el socio, sin comprobarlo contra `Plan §10`. | Cerrado |
| [F-086](findings/F-086.md) | 2026-08-14 | `DESIGN` | El tooltip nativo de un botón deshabilitado no se ve en Chromium, y el texto de repuesto es invisible para quien no usa lector de pantalla. | Cerrado |
| [F-087](findings/F-087.md) | 2026-08-14 | `SPEC-GAP` | Una selección mixta (filas nuevas + ya consultadas) no avisa de cuántas se omitieron. | Cerrado |
| [F-088](findings/F-088.md) | 2026-08-14 | `DESIGN` | La tabla de resultados de SRCH-01 no tiene scroll vertical en ningún punto de la cadena de contenedores — el contenido que no cabe en el al... | Cerrado |
| [F-089](findings/F-089.md) | 2026-08-14 | `HARNESS` | `ESTADO.md` describió un estado de la base que la base real no tiene, y nadie lo comprobó con SQL antes de escribirlo. | Cerrado |
| [F-090](findings/F-090.md) | 2026-08-14 | `SPEC-GAP` | VERA no tiene ninguna herramienta que lea el contenido de un hilo, y al preguntarle algo sobre el hilo abierto no dice que no puede — lo ma... | Cerrado |
| [F-091](findings/F-091.md) | 2026-08-14 | `HARNESS` | `ESTADO.md` marcó el panel de vista-servidor como "CERRADO" el 13-ago sin que el commit hubiera llegado nunca a la URL de Vercel que Álvaro... | Cerrado |
| [F-092](findings/F-092.md) | 2026-08-14 | `HARNESS` | `ESTADO.md` citaba `Plan §3` para el trabajo de los días 10 y 11, y `Plan §3` es Sprint 1 (días 1-5) | Cerrado |
| [F-093](findings/F-093.md) | 2026-08-14 | `DESIGN` | MSG-01 tenía el mismo defecto de recorte que SRCH-01, y no se vio porque la lista de hilos todavía es corta. | Cerrado |
| [F-094](findings/F-094.md) | 2026-08-14 | `HARNESS` | El catálogo de demo envejece solo, y el aserto que debía vigilarlo solo miraba un lado. | Cerrado |
| [F-095](findings/F-095.md) | 2026-08-14 | `HARNESS` | `ESTADO.md` volvió a describir un estado de la base que la base no tiene —tercera vez (F-012, F-089)— pero esta vez la causa es mecánica y ... | Cerrado |
| [F-096](findings/F-096.md) | 2026-08-16 | `HARNESS` | La suite e2e repone la siembra de demo al ARRANCAR y no al terminar, así que se va dejando la base rota — y la rotura concreta es que MSG-0... | Cerrado |
| [F-097](findings/F-097.md) | 2026-08-16 | `SPEC-GAP` | conteste bien y sea mentira | Cerrado |
| [F-098](findings/F-098.md) | 2026-08-16 | `INFRA` | El entorno de demo se queda sin aislar: demo y pruebas siguen compartiendo `troxminloxkjwihwfevs`. | Abierto |
| [F-099](findings/F-099.md) | 2026-08-16 | `SPEC-GAP` | La aplicación no tiene ninguna forma de ORIGINAR una oferta. Solo existe la contraoferta, que exige una oferta anterior — así que un vended... | Abierto |
| [F-100](findings/F-100.md) | 2026-08-16 | `DESIGN` | Los botones `Consultar` y `Contactar` de cada fila de SRCH-01 están habilitados y no hacen NADA — clic y silencio— y como el botón masivo e... | Cerrado |
| [F-101](findings/F-101.md) | 2026-08-16 | `SPEC-GAP` | VERA es de un solo turno: nunca recibe la pregunta anterior, así que cualquier refinamiento se ejecuta como búsqueda nueva y devuelve el ca... | Mitigado |
| [F-102](findings/F-102.md) | 2026-08-16 | `SPEC-GAP` | `listar_mis_hilos` no dice QUIÉN envió el último elemento, y VERA rellena el hueco: afirma que el usuario tiene que responder una consulta ... | Cerrado |
| [F-103](findings/F-103.md) | 2026-08-16 | `MODEL` | VERA contesta en el idioma de quien pregunta, contra lo que dice su propio prompt, y al hacerlo traduce los valores de enum del estado del ... | Cerrado |
| [F-104](findings/F-104.md) | 2026-08-16 | `DESIGN` | VERA responde con markdown y el panel lo pinta en crudo: el usuario ve los asteriscos y las tablas convertidas en una tira de pipes. | Cerrado |
| [F-105](findings/F-105.md) | 2026-08-16 | `MODEL` | VERA no inventa, pero SÍ oculta: ve 13 filas, enseña 8 y descarta 5 bajo un criterio propio que no declara — y las descartadas son las de m... | Cerrado con reserva |
| [F-106](findings/F-106.md) | 2026-08-16 | `SPEC-GAP` | (a) | Cerrado |
| [F-107](findings/F-107.md) | 2026-08-16 | `HARNESS` | 12 | Cerrado |
| [F-108](findings/F-108.md) | 2026-08-16 | `INFRA` | El worktree de la sesión se creó desde `main`, que va 8 commits por detrás, así que no contenía NADA del MVP: ni `app/`, ni `supabase/`, ni... | Cerrado |
| [F-109](findings/F-109.md) | 2026-08-17 | `INFRA` | `npm run demo:reset` llevaba dos jornadas devolviendo verde sin haber ejecutado nunca la línea que estaba rota, y habría reventado la mañan... | Cerrado y verificado ejecutándolo: `221 |
| [F-110](findings/F-110.md) | 2026-08-17 | `HARNESS` | Las dieciséis preguntas del guion existían solo como cita desde el día 13, y `F-105` seguía sin verse actuar. | Cerrado |
| [F-111](findings/F-111.md) | 2026-08-17 | `MODEL` | VERA se niega a dar un dato que sí tiene, y justifica la negativa con una afirmación FALSA sobre la arquitectura del propio producto. | Cerrado |
| [F-112](findings/F-112.md) | 2026-08-28 | ~~`MODEL`~~ → `HARNESS` | El bucle arreglado (B-008/B-009) resuelve unas tareas y no otras, y las que no resuelve fallan EXACTAMENTE igual que antes del arreglo. | Cerrado |
| [F-113](findings/F-113.md) | 2026-08-28 | `HARNESS` | `inputs.decisions` no llega nunca al prompt del Coder. | Cerrado |
| [F-114](findings/F-114.md) | 2026-08-28 | `HARNESS` | El feedback que vuelve al Coder es el recorte de las últimas 40 líneas, así que cuando hay más de dos fallos el arnés elige cuál le enseña ... | Cerrado |
| [F-115](findings/F-115.md) | 2026-08-28 | `HARNESS` | Una corrida puede borrar su propia evidencia sin que nadie se entere, y la del 28-ago lo hizo. | Cerrado |
| [F-116](findings/F-116.md) | 2026-08-28 | `HARNESS` | C2 puntúa tests que el propio contrato marca como fuera del alcance de la tarea. | Cerrado |
| [F-117](findings/F-117.md) | 2026-08-28 | `HARNESS` | C4 lee `!important` como si fuera un `import`, y le imputa al Coder una dependencia inventada. | Cerrado |
| [F-118](findings/F-118.md) | 2026-08-28 | `HARNESS` | `SRCH-01` no puede compilar: la tarea le prohíbe lo que el repo le exige. | Cerrado el 29-ago-2026 en `1183a38`, y e |
| [F-119](findings/F-119.md) | 2026-08-28 | `HARNESS` | Una corrida puede morir o colgarse sin dejar ni una fila, y tarda horas en notarse. | Cerrado a medias |
| [F-120](findings/F-120.md) | 2026-08-29 | `HARNESS` | La señal de vida no llegaba al log: se quedaba en el buffer. | Cerrado |
| [F-121](findings/F-121.md) | 2026-08-29 | `HARNESS` | Dos corridas midieron a la vez sobre el mismo `app/src`, y ninguna de las dos se enteró. | Cerrado |
| [F-122](findings/F-122.md) | 2026-08-29 | `HARNESS` | Un timeout dentro del proceso no protege de un proceso bloqueado. | Cerrado |
| [F-123](findings/F-123.md) | 2026-08-29 | `HARNESS` | La tarea de SRCH-01 le prohíbe al Coder, por escrito, lo que su contrato de aceptación le exige. | Cerrado |
| [F-124](findings/F-124.md) | 2026-08-29 | `HARNESS` | El cerrojo de `F-121` y el plazo de `F-122` se peleaban: el plazo garantizaba que el cerrojo se quedara puesto. | Cerrado |
| [F-125](findings/F-125.md) | 2026-08-29 | `HARNESS` | El e2e de `SRCH-01` busca un nombre accesible que la tarea no declara. | Cerrado |
| [F-126](findings/F-126.md) | 2026-08-29 | `HARNESS` | CORREGIDO AL VERIFICARLO: la primera redacción de esta fila era falsa en dos tercios. | Cerrado |
| [F-127](findings/F-127.md) | 2026-08-29 | `HARNESS` | El contrato de `MSG-01` busca el aviso de error por su ROL y la tarea no lo pide. | Cerrado |
| [F-128](findings/F-128.md) | 2026-08-29 | `HARNESS` | El contrato exige que el aviso de error enseñe el error DE VERDAD, y nadie se lo pide al Coder. | Cerrado |
| [F-129](findings/F-129.md) | 2026-08-30 | `HARNESS` | Una decisión viva del relevo afirma una marca que no existe en ningún sitio. | Cerrado |
| [F-130](findings/F-130.md) | 2026-08-30 | `HARNESS` | El guardia solo lee literales entrecomillados, y el contrato busca la mitad de las cosas con expresiones regulares. | Cerrado |
| [F-131](findings/F-131.md) | 2026-08-30 | `HARNESS` | La tarea le enseña al Coder qué roles ESCRIBIR y no le dice ninguno que no deba PISAR — y ha pisado el que sostiene siete asertos. | Cerrado |
| [F-132](findings/F-132.md) | 2026-08-30 | `PROCESO` | «Fundación V1 · no empezada» era falso, y el entregable que sí está hecho es el caro. | Cerrado con documento; el hito sigue abi |
| [F-133](findings/F-133.md) | 2026-08-30 | `PROCESO` | Un ref de organización usado como ref de proyecto, en la sección que existe para que nadie adivine refs. | Cerrado |
| [F-134](findings/F-134.md) | 2026-08-30 | `HARNESS` | `MSG-01` no puede sacar 4/4 por construcción, y el arnés lo apunta como fallo del artefacto. | Abierto |
| [F-135](findings/F-135.md) | 2026-08-30 | `TEST` | Dos tests e2e de `MSG-02` pasan sin que `MSG-02` llegue a abrirse. | Cerrado |
| [F-136](findings/F-136.md) | 2026-08-30 | `HARNESS` | Las tres corridas de la primera medida con `n>1` del proyecto no dejaron ni un log, y el hueco de `.gitignore` para versionarlos se había a... | Cerrado |
| [F-137](findings/F-137.md) | 2026-08-31 | `HARNESS` | Un `TS2375` que no protegía nada. | Cerrado |
| [F-138](findings/F-138.md) | 2026-08-31 | `HARNESS` | Un `data-testid` que solo existía por costumbre, nunca por contrato. | Cerrado |
| [F-139](findings/F-139.md) | 2026-08-31 | `HARNESS` | `Nuevo contacto: 9 de 9` no era del modelo — era la misma clase que `F-138`, con una vuelta de tuerca. | Cerrado |
| [F-140](findings/F-140.md) | 2026-09-01 | `HARNESS` | El propio arreglo de `F-139` rompió el guardia que prueba `F-128`, y las tres CI siguientes salieron rojas sin que nadie lo notara hasta ce... | Cerrado |
| [F-141](findings/F-141.md) | 2026-09-01 | `HARNESS` | El estado vacío nunca declaró su FORMA, solo su contenido — y a la sexta corrida le tocó la forma equivocada. | Cerrado |
| [F-142](findings/F-142.md) | 2026-09-01 | `HARNESS` | `_nota_accesibilidad` de `PANEL-01` describe un contrato de aceptación que ya no existe — lleva desactualizada desde `F-077` (13-ago). | Cerrado |
| [F-143](findings/F-143.md) | 2026-09-03 | `HARNESS` | Dos corridas seguidas, el mismo `TS2322` en el mismo objeto: el diccionario tono→clase se declara sin el `\/ undefined` que el proyecto exi... | Cerrado |
| [F-144](findings/F-144.md) | 2026-09-03 | `HARNESS` | El mismo literal `fuera del MVP` hace falta en DOS sitios independientes, y solo estaba declarado en uno. | Cerrado |
| [F-145](findings/F-145.md) | 2026-09-04 | `HARNESS` | Un `aria-label` correcto rompe el aserto que busca el botón por su número, y la tarea no decía que el número tenía que ser el nombre accesi... | Cerrado |
| [F-146](findings/F-146.md) | 2026-09-04 | `INFRA` | `revoke execute … from public` no le quita nada a `anon`, y llevaba así desde `0012`. | Cerrado |
| [F-147](findings/F-147.md) | 2026-09-04 | `HARNESS` | La frase del estado vacío tiene que vivir en UN solo nodo, y la tarea declaraba el botón y el motivo pero nunca la frase. | Cerrado |
| [F-148](findings/F-148.md) | 2026-09-04 | `INFRA` | Desde `0019` (3-sep), encender el interruptor de D-7 dejaba a esa organización sin poder escribir NADA: ni un mensaje, ni una consulta, ni ... | Cerrado |
| [F-149](findings/F-149.md) | 2026-09-05 | `INFRA` | Un dato escrito y confirmado dos veces desapareció solo, y la causa no era la aplicación: era esta misma sesión. | Cerrado |
| [F-150](findings/F-150.md) | 2026-09-06 | `INFRA` | F-091 y F-072 quedaron "cerrados" en su día con un parche de proceso, no de causa: el despliegue seguía siendo manual, así que el mismo hue... | Cerrado |
| [F-151](findings/F-151.md) | 2026-09-07 | `INFRA` | Tres tokens de Vercel seguidos fallaron con variantes del mismo error (`"User not found"`, luego `"Not able to load user... 404"`), y la ca... | Cerrado |
| [F-152](findings/F-152.md) | 2026-09-10 | `MODEL` | **`18b`-`18e` salieron verdes al primer intento, igual que las cinco de la 17. | Cerrado |
| [F-153](findings/F-153.md) | 2026-09-10 | `INFRA` | Tres causas encadenadas, ninguna visible desde el dashboard. | Cerrado |
| [F-154](findings/F-154.md) | 2026-09-10 | `INFRA` | Ni V-1 ni V-2 de `app.guard_cek_recipients` (`0023`) comprobaban que cada `member_id` de `p_keys` perteneciera a ALGUNA de las dos organiza... | Cerrado |
| [F-155](findings/F-155.md) | 2026-09-10 | `INFRA` | `create_thread_item` y `counter_offer` calculaban la organización de enfrente (`otra`) con un `SELECT` normal sobre `threads`, sujeto a RLS... | Cerrado |
| [F-156](findings/F-156.md) | 2026-09-10 | `INFRA` | El guardia "ya has consultado esta referencia con este distribuidor" de `create_inquiry` (0014/0023) se saltaba en silencio para cualquier ... | Cerrado |
| [F-157](findings/F-157.md) | 2026-09-11 | `HARNESS` | El medidor del coste de orquestación BORRA su propia historia cada vez que se usa. | Cerrado |
| [F-158](findings/F-158.md) | 2026-09-11 | `DESIGN` | La spec aprobada de `ADMIN-01` se contradice a sí misma en el umbral de un indicador de color. | Cerrado el 17-sep |
| [F-159](findings/F-159.md) | 2026-09-11 | `HARNESS` | Un test de e2e que puede fallar sin que haya ningún defecto, y falla justo cuando la máquina va lenta. | Cerrado |
| [F-160](findings/F-160.md) | 2026-09-11 | `HARNESS` | `--seco` escalaba en FALSO sobre las seis tareas del corpus, `DIR-01` incluida, sin que ninguna tuviera nada que ver con un escalado real. | Cerrado |
| [F-161](findings/F-161.md) | 2026-09-13 | `HARNESS` | `DIR-01` escaló al humano al tercer intento, y el veredicto no depende del artefacto que generó el Coder. | Cerrado |
| [F-162](findings/F-162.md) | 2026-09-13 | `HARNESS` | `ADMIN-01` escaló al humano al tercer intento, y las tres fallas propias del artefacto -las que `F-161`/`FORO-01` no explica- eran del prop... | Cerrado |
| [F-163](findings/F-163.md) | 2026-09-14 | `HARNESS` | `orchestration_pricing.py` llevaba dos días sin tarifa para `claude-haiku-4-5-20251001`, y la fila que alguien le añadió sin pedirlo -rever... | Cerrado |
| [F-164](findings/F-164.md) | 2026-09-17 | `PROCESO` | El push del cierre del Día 16 no disparó CI porque su propio mensaje nombraba el marcador de salto. | Cerrado |
| [F-165](findings/F-165.md) | 2026-09-17 | `INFRA` | Playwright revienta en CI desde que existe el e2e de `ADMIN-01` (11-sep, `2932e1a`): `ci.yml` nunca le pasó `E2E_OPERATOR_EMAIL`/`E2E_OPERA... | Cerrado |
| [F-166](findings/F-166.md) | 2026-09-17 | `HARNESS` | El e2e declarado de `ADMIN-01` no se había ejecutado NUNCA —ni en la corrida del arnés ni en CI— y el arnés lo contó como verde. | Cerrado |
| [F-167](findings/F-167.md) | 2026-09-17 | `INFRA` | Con los cuatro jobs de prueba en verde, el despliegue falló igual: `supabase functions deploy vera` devolvió `401 Unauthorized` con el toke... | Desacoplado y verificado: en el run `352 |
| [F-168](findings/F-168.md) | 2026-09-17 | `INFRA` | La app de producción (`rin-world-io.vercel.app`) no arranca, y lleva así desde el 8-sep. | Cerrado el 17-sep |
| [F-169](findings/F-169.md) | 2026-09-17 | `PROCESO` | La revisión C5 de `ADMIN-01` dejó descuadrada la siembra de la base de producción, y el e2e local lo cazó como 3 de 4 en rojo. | Cerrado el 17-sep |
| [F-170](findings/F-170.md) | 2026-09-17 | `SPEC-GAP` | `F-158` no era un caso aislado: once contradicciones más de la misma clase | Cerrado el 17-sep, las once: `INVT-01` |
| [F-171](findings/F-171.md) | 2026-09-17 | `INFRA` | El paso «Producción sirve la app» puede dar verde contra el despliegue ANTERIOR. | Abierto |
| [F-172](findings/F-172.md) | 2026-09-18 | `DESIGN` | ningún | Cerrado en DIR-01 y FORO-02 |
| [F-173](findings/F-173.md) | 2026-09-18 | `HARNESS` | el límite no limitaba a nadie | Cerrado el mismo día, antes de aplicar a |
| [F-174](findings/F-174.md) | 2026-09-18 | `HARNESS` | `ForumThread. | Cerrado el mismo día |
| [F-175](findings/F-175.md) | 2026-09-18 | `HARNESS` | El commit se dejó SIN `[skip ci]` en un momento en que el repo ya tenía `ForumThread. | Cerrado sin acción -el rojo era exacto y |
| [F-176](findings/F-176.md) | 2026-09-18 | `HARNESS` | no generó ningún run de CI | Cerrado sin acción correctiva sobre el c |
| [F-177](findings/F-177.md) | 2026-09-18 | `INFRA` | `authenticated` -y en varias tablas, hasta `anon`- tiene INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN de sobra en CASI TODA ta... | Cerrado como comprobación, no como parch |
| [F-178](findings/F-178.md) | 2026-09-18 | `HARNESS` | 2 reacciones en vez de 1 | Cerrado el mismo día: dato restaurado, C |
| [F-179](findings/F-179.md) | 2026-09-19 | `SPEC-GAP` | sombrea otra fila | Cerrado el 19-sep |
| [F-180](findings/F-180.md) | 2026-09-19 | `SPEC-GAP` | seis | Cerrado el 19-sep |
| [F-181](findings/F-181.md) | 2026-09-20 | `HARNESS` | escapa las comillas | Cerrado el 20-sep |
| [F-182](findings/F-182.md) | 2026-09-20 | `HARNESS` | que no capturaba nadie | Cerrado el 20-sep, antes de la primera c |
| [F-183](findings/F-183.md) | 2026-09-20 | `HARNESS` | Los ocho fallos eran del contrato de aceptación, no del artefacto. | Cerrado el 20-sep |
| [F-184](findings/F-184.md) | 2026-09-20 | `HARNESS` | 36 de las 49 líneas del recorte que vuelve al Coder eran avisos de Node | Cerrado el 21-sep-2026 |
| [F-185](findings/F-185.md) | 2026-09-20 | `MODEL` | La API pública de Atria no sostiene, de forma fiable, una respuesta del tamaño de una pantalla entera. | Cerrado como decisión: `CLAUDE |
| [F-186](findings/F-186.md) | 2026-09-21 | `DESIGN` | (1) dos «x» | Cerrado el 21-sep-2026; confirmado por e |
| [F-187](findings/F-187.md) | 2026-09-21 | `PROCESO` | El Día 20 de `ESTADO-V1.md` afirmaba que `F-161`/`F-162` «fijaron que una escalada cuenta sea cual sea la causa». Es al revés para la cifra... | Cerrado el 21-sep-2026 |
| [F-188](findings/F-188.md) | 2026-09-21 | `PROCESO` | `entornos.md` dice que el desarrollo local «comparte el proyecto de staging (`bearingworld-e2e`)»; con el `app/.env` actual, `npm run dev` ... | Cerrado como decisión |
| [F-189](findings/F-189.md) | 2026-09-22 | `DESIGN` | Confirmado, en un navegador real (no jsdom, que no calcula layout). | Cerrado el 22-sep-2026, confirmado por e |
| [F-190](findings/F-190.md) | 2026-09-22 | `DESIGN` | Confirmado por el PO: ninguna de las dos tiene scroll propio. | Cerrado el 22-sep-2026, confirmación del |
| [F-191](findings/F-191.md) | 2026-09-24 | `ENTORNO` | Consecuencia: el banco de esquema oficial no se pudo correr hoy | Cerrado el 24-sep-2026 por el PO |
| [F-192](findings/F-192.md) | 2026-09-24 | `SEGURIDAD` | Supabase concede ALL sobre cada tabla nueva de `public` a `anon`, `authenticated` y `service_role` por DEFAULT PRIVILEGES, y `00_auth_stub.... | CERRADO, riesgo aceptado (se reabre antes de datos reales) |
| [F-193](findings/F-193.md) | 2026-09-24 | `HARNESS` | Fallo del entorno, no del artefacto. | Cerrado |
| [F-194](findings/F-194.md) | 2026-09-24 | `CONTRATO` | defectos de mi contrato | Cerrado el 24-sep-2026 |
| [F-195](findings/F-195.md) | 2026-09-24 | `DATOS` | Producción tenía una reacción DESPLAZADA respecto a la siembra: la de `c003` post 2 estaba en `c004` post 2 (5 reacciones en total, la últi... | Residuo cerrado; `F-178` |
| [F-196](findings/F-196.md) | 2026-09-24 | `SPEC` | Tres contradicciones de la spec resueltas por mí, para que el PO las confirme o cambie | CERRADO, aceptado por el PO |
| [F-197](findings/F-197.md) | 2026-09-24 | `MEDIDA` | `orchestration_metrics` solo escanea los worktrees de este repo y no la habría visto | Cerrado para esta cifra, abierto como hu |
| [F-198](findings/F-198.md) | 2026-09-24 | `HARNESS` | El Coder la cumplió sin intervención | Cerrado |
| [F-199](findings/F-199.md) | 2026-09-24 | `HARNESS` | El shell de la herramienta de comandos se come una capa de barras invertidas dentro de un heredoc, incluso entrecomillado (`<<'EOF'`). | Cerrado el 24-sep-2026 |
| [F-200](findings/F-200.md) | 2026-09-24 | `CONTRATO` | Ninguna de las tres escaladas fue del Coder salvo un tramo: | Cerrado |
| [F-201](findings/F-201.md) | 2026-09-24 | `UI` | no se han tocado | CERRADO sin acción |
| [F-202](findings/F-202.md) | 2026-09-24 | `SPEC` | La spec de INV-07 promete lo que el modelo de datos no expresa: | CERRADO sin acción |
| [F-203](findings/F-203.md) | 2026-09-24 | `SPEC` | no agrupa cuatro cifras | Cerrado como decisión, reversible |
| [F-204](findings/F-204.md) | 2026-09-24 | `SPEC` | `Crear watchers para referencias sin stock` | CERRADO sin acción |
| [F-205](findings/F-205.md) | 2026-09-24 | `MEDIDA` | Las cifras 7 y 8 de las dos pantallas NO son limpias y no se van a poder limpiar | Cerrado como límite conocido: la serie d |
| [F-206](findings/F-206.md) | 2026-09-24 | `UI` | (1) Real, de diseño: |  |
| [F-207](findings/F-207.md) | 2026-09-24 | `DOC` | El relevo decía algo falso sobre `INV-07`: | Cerrado |
| [F-208](findings/F-208.md) | 2026-09-24 | `DATOS` | No encuentra por cuatro causas de datos y una de código: |  |
| [F-209](findings/F-209.md) | 2026-09-24 | `DESIGN` | Lo que recordaba es el diseño aprobado (`INV-07 · VIS v1.0.html`), no la pantalla construida: | Cerrado; el PO lo confirmó el 25-sep |
| [F-210](findings/F-210.md) | 2026-09-24 | `DESIGN` | Comparación medida en el navegador, elemento por elemento, contra `INV-07 · VIS v1.0.html` | Cerrado; el PO lo confirmó el 25-sep |

---

## Cierres del 12-ago (tarde), tras las respuestas del PO

| Hallazgo | Cómo queda |
|---|---|
| **F-064** | **CERRADO CON DATO, no con hipótesis.** Se arregló el bucle (B-008) y se relanzó **VND-01** —misma tarea, mismo contrato, mismo repo, único cambio el bucle—. Bucle roto: **escalado 3/3, $0,026346**. Bucle arreglado: **VERDE en 2, $0,017783, cero líneas de revisión a mano**. Y el mecanismo se ve en los tokens: el reintento pasó de **39.163** tokens de salida a **14.361**, porque con su propio código delante el modelo hace una corrección dirigida en vez de regenerar los cuatro ficheros. Resolvió el defecto exacto que no resolvió en tres intentos por la mañana. **Lo que NO se cierra: las cuatro corridas anteriores siguen sin valer como dato sobre el modelo.** |
| **F-068** | **Cerrado (B-009).** Color apagado en origen (`NO_COLOR=1`, `FORCE_COLOR=0`) más `strip_ansi` en la frontera, con el ESC opcional en el patrón — que era lo que se colaba. Verificado en la corrida siguiente: **0 secuencias**, frente a 72. |
| **F-054** | **Cerrado. La CLI es la ruta oficial y el repo la fuente de verdad.** Y sin renombrar nada: medido contra un Postgres desechable, la CLI 2.109 parsea `0001`…`0012` como versiones y **aplica las doce desde cero**. Renombrar habría roto **76 punteros** del tipo `0003:269`. El registro del remoto se alineó a `0001`…`0012`. **Falta una orden del PO: `supabase link`**, que pide la contraseña de la base. |
| **F-063** | **Cerrado.** Convención en `CLAUDE.md` §1.6: los commits previsiblemente rojos del arnés llevan `[skip ci]` con el motivo en el cuerpo; la CI entera va en el de la revisión. **Un artefacto verde no lo lleva** — salvo LOGIN-01, que era verde para el arnés y rojo para la CI (F-070), y lo dice en su commit. |
| **F-016** | **Cerrado.** LOGIN-01 tiene spec propia (`LOGIN-01_spec.md`, marcada como no cerrada), contrato de 17 asertos verificado en rojo total, y pantalla construida por el Coder **verde al primer intento**. |
| **F-038** | **Reabierto y vuelto a cerrar el mismo día**, por F-070. La mitigación seguía escrita y un `disabled` de más la desactivaba. Ahora hay un aserto que lo fija. |
| **F-033** | **Cerrado, y con las dos mitades que pidió el PO.** (1) **Tercer estado por check** — `verde` / `rojo` / `inejecutable`, con columna propia `checks_inejecutables` en el CSV y mención aparte en `resultado`. **No se deduce del código de salida**, y ese fue el hallazgo al implementarlo: `corrida-01` salía con **127** pero `corrida-02` con **1** —vitest arrancó, dijo *"No test files found"* y devolvió 1, indistinguible de un test que falla—. Cada check lo declara donde sabe que no miró; el código de salida es solo la red. **Las 27 filas históricas se han rellenado derivando el valor de los JSON guardados, no de mi suposición sobre el orden: 7 de 27 tenían algún check ciego.** (2) **La métrica del objetivo 4 cambia**: ver abajo. |

### ⚠ El cambio de métrica del objetivo 4 (decisión del PO, 12-ago)

**«Intentos hasta verde» deja de ser la cifra con la que se decide si el arnés sirve en V1.**
No porque esté mal medida ahora, sino porque **es frágil por construcción**: mide el bucle
tanto como al modelo, y el bucle estuvo roto tres días sin que nadie lo notara (F-064) más
otro día con la entrada corrompida (F-068). De las 24 filas de intento sobre pantallas, solo
**3** las produjo un instrumento que hoy creemos sano.

**Pasan a ser la cifra dos medidas que han sobrevivido a los cuatro problemas**, porque no
dependen ni del bucle ni de la rúbrica:

- **líneas tocadas en la revisión a mano sobre líneas del artefacto**, y
- **ficheros que salen sin tocar**.

Viven en `openspec/mvp/harness-review.csv`, una fila por corrida, **derivada de git** —
`commit_artefacto` y `commit_revision` están en cada fila, así que cualquiera puede
recomputarla. Lo que ya hay, con las siete corridas del MVP:

| Corrida | Líneas | Revisión | Sin tocar |
|---|---|---|---|
| MSG-01 · corrida 3 | 695 | +171 / −145 | 0 de 4 |
| SRCH-01 · corrida 1 | 1076 | *(sustituida por la 2, sin revisar)* | — |
| SRCH-01 · corrida 2 | 1089 | +64 / −13 | 3 de 6 |
| MSG-02 | 1294 | +68 / −55 | 6 de 8 |
| VND-01 · bucle roto | 652 | +39 / −4 | 2 de 4 |
| **VND-01 · bucle arreglado** | **629** | **+0 / −0** | **4 de 4** |
| LOGIN-01 | 241 | +8 / −2 | 1 de 2 |

**La tendencia se lee sola, y es lo que "intentos hasta verde" no dejaba ver:** de tocar los
cuatro ficheros en MSG-01 a no tocar ninguno en VND-01 con el bucle arreglado. **El CSV de
intentos sigue existiendo** —el coste, los tokens y el caché se miden ahí y son fiables—;
lo que deja de hacer es responder solo a la pregunta del objetivo 4.

---

## Notas de la puerta de decisión — SP-1 (pendiente cierre por PO)

**Rúbrica (≥3 de 5 para aprobar):**

| # | Criterio | Veredicto |
|---|---|---|
| C1 | Compila (`tsc --noEmit`) | ✅ **pass** (exit 0, sin errores) |
| C2 | Renderiza reconocible vs HTML aprobado | ✅ **pass** — PO 5-ago: "es idéntico, no hay duda" |
| C3 | Usa tokens, no valores inventados | ✅ **pass con matiz** — usa bien todos los tokens definidos; los "inventados" rellenan neutros que el sistema aún no define. Único desvío real: `#ef4444` vs `#dc2626` (ver F-003) |
| C4 | React idiomático (props tipadas, sin `dangerouslySetInnerHTML`) | ✅ **pass** |
| C5 | ¿Lo mantendrías? | ✅ **pass** — PO 5-ago: sí |

**Puerta SUPERADA: 5 de 5.** DeepSeek-V4-Flash entra al camino crítico como nodo Coder. Los
matices (definir tokens neutros y corregir el rojo) están en F-003, no cambian el aprobado.
Aviso de alcance: el spike generó **solo** el componente `InventoryTable` (la tabla), no la
pantalla INV-01 completa — eso es del día 3 en adelante.

---

## Puerta de decisión del día — los tres spikes

| Spike | Pregunta | Resultado | Consecuencia |
|---|---|---|---|
| **SP-1** · Coder | ¿DeepSeek-V4-Flash convierte HTML aprobado a React? | ✅ **PASA 5/5** | DeepSeek al camino crítico como nodo Coder |
| **SP-3** · Realtime | ¿Propaga Supabase entre dos sesiones? | ✅ **PASA** (20/20, <1 s, reconecta solo) | Tiempo real, sin plan B de polling |
| **SP-2** · WebCrypto | ¿Cifra el navegador nativamente? | ✅ **PASA con X25519** (mejor que lo esperado) | Alineado con ADR-001; informa GAP-001 hacia WebCrypto nativo |

**Los tres pasan.** El plan de 15 días sigue tal cual; el día 2 arranca con esquema Supabase y
scaffold React. Único hallazgo que cambia una decisión de spec: SP-2 inclina GAP-001 hacia
WebCrypto nativo (F-008), pendiente de confirmar X25519 en Safari/Firefox antes de retirar el
fallback P-256.
| [F-211](findings/F-211.md) | 2026-09-25 | `SPEC` | `Contactar` sin hilo previo no se puede construir con el esquema actual | ABIERTO |
| [F-212](findings/F-212.md) | 2026-09-25 | `SPEC` | La spec y el HTML aprobado prometen un correo que el proyecto no puede enviar | ABIERTO |
| [F-213](findings/F-213.md) | 2026-09-25 | `DESIGN` | No existe `Ajustes` | ABIERTO, menor |
| [F-214](findings/F-214.md) | 2026-09-25 | `SEGURIDAD` | Revocar un usuario no le impide iniciar sesión, solo le deja sin datos | CERRADO 26-sep: `session.ts` + Edge Function `ban-revoked-member`; ban real probado (`User is banned`) |
| [F-215](findings/F-215.md) | 2026-09-25 | `INFRA` | Dos trampas del banco de esquema que costaron una vuelta cada una | Cerrado, sin acción |
| [F-216](findings/F-216.md) | 2026-09-25 | `HARNESS` | Mi tarea no decía lo que el contrato exige (`string \| undefined` de un módulo CSS, `F-143`) | Cerrado para `INVT-01` |
