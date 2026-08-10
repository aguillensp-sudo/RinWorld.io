# Corrida 2 de MSG-01 · 10-ago-2026 · C1 miró de verdad, C2 todavía no

`VEREDICTO: ESCALADO en 3 intento(s)` · **$0.034824** · 14,9 min · cache 0% →
91,83% → 97,0%. `C1 ROJO · C2 ROJO · C3 verde · C4 verde` en los tres.

**Es la primera corrida en la que un check ejecuta algo.** C1 corrió `tsc` y
devolvió errores reales; C3 y C4 salieron verdes de verdad, no por casualidad.

## Lo que cambió al entregarle `data_layer` en el prompt

Comparado con `../corrida-01-checks-ciegos/`, el mismo modelo con el mismo tope de
intentos:

| | corrida 1 | corrida 2 |
|---|---|---|
| Tipos | `Thread` propio, todo opcional, `[key: string]: unknown` | importa `ThreadSummary` y `ThreadState` de `lib/threads` |
| Estados | `CON_OFERTA_PENDIENTE` + mapa de alias | los cinco literales del esquema, con sus espacios |
| Datos | ninguno: `Messages` no sabía que `fetchThreadPage` existía | `fetchThreadPage`, `pageCount`, carga con bandera de cancelación |
| C4 | falso rojo | verde |

No era el modelo: era el prompt. Queda escrito porque es el dato que más pesa
para decidir si el arnés es viable en V1.

## Los dos rojos de C1, y no son iguales

1. **`MessagesProps` recibe `orgId: string`, no `profile: MemberProfile`.** El
   contrato de aceptación exige `profile`, y **el Coder no puede verlo** (regla de
   integridad: nunca ve los tests que lo evalúan). La tarea tampoco se lo dice: el
   formato congelado el día 4 no tiene ningún campo para el API público del
   componente, y el `style_reference` que se le da es `InventoryTable.tsx`, que es
   presentacional. Con esos insumos, `orgId` es la lectura razonable.
   **Es inadivinable, y por tanto no mide al Coder.**
2. **`Record<ThreadState, string>` poblado con `styles.*`** →
   `string | undefined` bajo `noUncheckedIndexedAccess`. Este sí es suyo: no
   compila, `tsc` lo señala con línea y columna, y lo tuvo en el feedback de los
   intentos 2 y 3 sin corregirlo.

## Y C2 seguía sin ejecutarse — cuarto bug del arnés

Las rutas de aceptación se le pasaban a vitest tal como vienen de la tarea
(`app/src/...`) con el proceso arrancando en `app/`: *"No test files found"*, exit
1, registrado como C2 ROJO. La rama del e2e hacía `relative_to("app")` desde el
día 4; la de unidad, no. **C2 no se ha ejecutado ni una vez en todo el proyecto.**

Arreglado, con guardia propia en `test_checks` que comprueba que las rutas que
salen hacia vitest y hacia Playwright existen desde `app/`.
