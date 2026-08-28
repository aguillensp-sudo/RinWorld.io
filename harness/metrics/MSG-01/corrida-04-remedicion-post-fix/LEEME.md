# Corrida 4 de MSG-01 · 28-ago-2026 · la remedición con el bucle arreglado

`VEREDICTO: ESCALADO en 3 intento(s)` · **$0.157538** · 12,9 min · cache 0% →
76,39% → 73,95%. `C1 ROJO · C2 ROJO · C3 verde · C4 verde` en los tres intentos.

La otra mitad de `F-112`, junto con la corrida 4 de `SRCH-01`.

## Qué hay aquí y qué no

**No están los `attempt_N.json`** — se perdieron al descartar el working tree
(`F-115`). `salida-recuperada.txt` viene de la transcripción de Claude Code. Los
`attempt_*.json` de las corridas 1, 2 y 3 sí están, cada una en su carpeta:
esta tarea usa subcarpetas por corrida desde el día 4, y es la única que lo hace.

## Los dos fallos, y son de distinta clase

**C1** · cinco errores de `tsc`, todos el mismo:

```
src/screens/messages/ThreadList.tsx(7,3): error TS2322:
  Type 'string | undefined' is not assignable to type 'string'.
```

Es `Record<StateTone, string>` poblado con `styles.*` bajo
`noUncheckedIndexedAccess`. **Es exactamente el defecto que ya dejó sin cerrar la
corrida 3 del 10-ago**, anotado en su LEEME como *"eso sí es una medida del
modelo"*. Sigue siéndolo.

**C2** · seis tests rojos. Los tres últimos —`[4/6]`, `[5/6]`, `[6/6]`, que son
los que dominan el recorte de 40 líneas y por tanto casi todo lo que el Coder
lee— son este bloque:

```
FAIL src/screens/messages/Messages.test.tsx >
     MSG-01 · pantalla > Realtime — FUERA del contrato del arnés >
     se suscribe a los cambios de hilos al montar
```

Lo último que se le pide arreglar es lo único que su tarea no le manda
construir. `MSG-01.json` no menciona realtime ni suscripciones en ninguna parte;
el propio fichero de tests rotula el bloque *"FUERA del contrato del arnés"*, y
C2 corre el fichero entero y lo puntúa igual. Cinco tests entre los dos bloques
así rotulados. `F-116`.

Es `F-058` por el reverso: aquello eran asertos que pasaban en verde sin medir
nada; estos solo pueden salir en rojo haga lo que haga el Coder.

## Lo que hay que separar al leer esta corrida

`C1` mide al modelo. `C2` no midió nada: puntuó tests que su contrato excluye,
con un feedback recortado que además los ponía delante. **Esta corrida no dice
que MSG-01 sea difícil.** Dice que se midió mal.
