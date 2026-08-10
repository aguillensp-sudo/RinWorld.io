# Corrida 1 de MSG-01 · 10-ago-2026 · los checks no miraron

**Esta corrida no mide al Coder. Mide tres bugs del arnés.** Se archiva entera —
métricas y artefacto— porque el gasto fue real y porque el artefacto es la mejor
evidencia que hay de qué produce un modelo con un prompt incompleto.

`VEREDICTO: ESCALADO en 3 intento(s)` · **$0.034548** · 12,7 min · cache 0% →
98,09% → 99,67%.

## Qué dijeron los checks y qué era verdad

| Check | Dijo | Era |
|---|---|---|
| C1 | ROJO | **no se ejecutó.** `npm` en Windows es `npm.CMD` y `subprocess` con `shell=False` no aplica PATHEXT → `WinError 2` |
| C2 | ROJO | ídem: ni vitest ni Playwright arrancaron |
| C3 | verde | verde de verdad |
| C4 | ROJO | **falso rojo.** La captura de parámetros con `[^)]*` se cortaba en el `)` de `now = new Date()` y dejaba fuera `}: ThreadListProps)` |

El feedback que volvió al Coder en los tres intentos fue *"no se pudo ejecutar
npm"*. El bucle de reintentos no podía converger: nadie le dijo qué estaba mal.

## El tercer bug, que explica el artefacto entero

`build_system` leía `spec`, `approved_html`, `tokens` y `style_reference` — y
**no `data_layer`**. La tarea declara `app/src/lib/threads.ts` desde el día 4 con
la nota *"el Coder los importa, no los reescribe"*, hablando de unos tipos que el
Coder nunca vio.

Con eso, lo que hay en `artefacto-intento-3/` deja de ser una alucinación y pasa a
ser la única salida posible: un `Thread` propio con todos los campos opcionales y
`[key: string]: unknown`, los cinco estados como `CON_OFERTA_PENDIENTE` en vez de
los literales del esquema, un mapa de alias para tapar su propia invención, y un
`Messages` que no llama a `fetchThreadPage` porque no sabía que existiera.

**Y ninguno de los cuatro checks puede ver esto.** Castigan al Coder por no usar lo
que no recibió. Si esta corrida se hubiera dado por buena como dato, "intentos
hasta verde" habría contado un fallo del arnés como calidad del modelo.

Arreglado en `6756c7f` y `35df8fb`. `test_checks` pasa de 34 a 44, con un guardia
genérico: todo input declarado en la tarea tiene que aparecer en el prompt.

## Las tres filas del CSV se quedan

Están en `openspec/mvp/harness-metrics.csv` con fecha 10-ago y su `resultado` dice
`FALLA (verde: C3 / rojo: C1;C2;C4)` y `ESCALADO` en la tercera. **Se leen mal a
propósito y por eso está escrito aquí:** parecen decir "el Coder falló tres veces"
y lo que pasó es que el arnés no miró. Borrarlas sería peor —el gasto existió—,
pero tomarlas por una medición del modelo es un error.

De ahí sale un hallazgo que no es de hoy: **el CSV no tiene forma de distinguir un
check en rojo de un check inejecutable.** F-015 zanjó que un check que no se puede
ejecutar cuenta como rojo, y eso sigue siendo correcto para decidir; pero para
*medir* son cosas distintas, y el objetivo 4 vive de esa medición.
