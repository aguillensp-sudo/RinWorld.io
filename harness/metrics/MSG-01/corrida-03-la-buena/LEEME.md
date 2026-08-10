# Corrida 3 de MSG-01 · 10-ago-2026 · la única que mide algo

`VEREDICTO: ESCALADO en 3 intento(s)` · **$0.035155** · 13,6 min · cache 0% →
97,95% → 98,61%. `C1 ROJO · C2 ROJO · C3 verde · C4 verde`.

Es la corrida buena, y escaló igual. Las dos cosas son ciertas y conviene no
mezclarlas: **escaló porque el artefacto no compilaba**, no porque el arnés no
mirara. Es el primer escalado del proyecto que significa lo que dice.

## Qué trajo `component_api`

El error de `profile` desapareció. En las corridas 1 y 2, `Messages` recibía
`orgId` porque nadie le había dicho qué firma implementar y los tests que la
fijan no los puede ver. Con la firma declarada, la implementó a la primera.

Queda un único defecto de C1, en cinco líneas: `Record<StateTone, string>`
poblado con `styles.*`, que bajo `noUncheckedIndexedAccess` es
`string | undefined`. Lo tuvo en el feedback de los intentos 2 y 3 y no lo
corrigió — eso sí es una medida del modelo.

## Quinto bug del arnés, encontrado aquí

`subprocess.run(text=True)` decodificaba con cp1252 y la salida de vitest lleva
UTF-8. El hilo lector reventaba, la salida se perdía entera y **C2 quedaba ROJO
sin detalle**: el feedback que volvió al Coder en los tres intentos fue una
cabecera vacía. C2 ejecutó de verdad por primera vez, pero no pudo contarlo.

## Lo que costó terminarla a mano

El artefacto se commiteó tal cual (`a31dfe3`, 695 líneas) y el arreglo va aparte
(`ccdbeed`): **+171 / −145**. Cuatro defectos y una decisión que el Coder no
podía conocer, detallados en el mensaje de ese commit. Lo que no hubo que tocar:
la consulta, la cancelación del efecto, la paginación, la búsqueda con submit,
los cinco literales del esquema, la separación pantalla/presentación y el CSS
entero de la fila.

De los cuatro defectos, **dos eran inalcanzables para él**: `errorMessage` vive
en `lib/session.ts`, que no está entre sus inputs, y el bloque de passphrase lo
prohíbe una decisión viva (F-027) que tampoco recibe. Los otros dos —la fila sin
semántica de lista y el estado vacío en el sitio equivocado— sí son suyos.

## Total del día

Tres corridas, nueve intentos, **$0.104527**. De esos, $0.069372 se fueron en
medir bugs propios. La cifra que vale para V1 no es el coste: es que **cinco de
los seis fallos del día eran del arnés, no del modelo**, y que el artefacto
mejoró en cada corrida sin tocar el modelo ni el tope de intentos — solo
arreglando lo que se le entregaba.
