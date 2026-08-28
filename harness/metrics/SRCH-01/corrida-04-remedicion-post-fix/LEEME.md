# Corrida 4 de SRCH-01 · 28-ago-2026 · la remedición con el bucle arreglado

`VEREDICTO: ESCALADO en 3 intento(s)` · **$0.155261** · 12,0 min · cache 0% →
77,63% → 78,64%. `C1 ROJO · C2 ROJO · C3 verde · C4 verde` en los tres intentos.

Es la corrida que abrió `F-112`: con el bucle arreglado (`B-008`/`B-009`),
`PANEL-01` pasó a verde y esta repitió el fallo exacto de antes del arreglo.

## Qué hay aquí y qué no

**No están los `attempt_N.json`.** Se escribieron —`run.py` los deja bajo
`harness/metrics/SRCH-01/`— y desaparecieron al descartar el working tree con el
código generado. Se comitearon las nueve filas del CSV y nada más (`f60a163`).
`F-115`.

`salida-recuperada.txt` es lo que el arnés imprimió por consola, rescatado de la
transcripción de Claude Code el mismo día. Sobrevivió por suerte, no por diseño.
Los `attempt_*.json` que hay en la carpeta de al lado **son del 11-ago**, de otra
corrida.

## Lo que dice, y por qué contesta a `F-112`

El intento 3 escaló con **13 tests en rojo**. El feedback que llegó al Coder era
el recorte de las últimas 40 líneas, o sea `[12/13]` y `[13/13]`:

```
FAIL src/screens/search/SearchResults.test.tsx > SRCH-01 · Consultar
     seleccionados > dos clics seguidos no mandan dos tandas
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```

**Cero veces, no dos.** No es que faltara el guardia contra el doble envío: es
que `sendInquiries` no llegaba a llamarse nunca, y la causa estaba en los once
fallos que el recorte no enseñaba. En tres intentos y $0,155 el Coder no vio ni
una vez el fallo que tenía que arreglar.

Compárese con `PANEL-01` y `VND-01`, las dos que sí convergieron: fallaban por
**un** test, que cabe entero en 40 líneas.

La discrepancia de `F-112` no estaba en el modelo. Estaba en cuánto se le
contaba. Arreglado en `F-114`: el inventario completo de fallos va delante del
recorte.
