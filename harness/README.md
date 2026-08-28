# `harness/` — el arnés del MVP

Grafo LangGraph de **dos nodos**: Coder + Test-runner. Ni uno más. Planner, Evaluator,
Reviewer y Escalation quedan fuera del MVP (`Plan §6`) porque sus umbrales se calibran
con datos de fallo reales, que es justo lo que estos 15 días van a generar.

Las decisiones y su porqué están en
[`openspec/mvp/Dia-04_decisiones_arnes.md`](../openspec/mvp/Dia-04_decisiones_arnes.md).
Aquí solo va cómo se usa.

```
harness/
├── dia-03-catalogo/   ← la corrida del día 3, intacta. Es la evidencia de F-022
├── core/              ← extraído de run_coder.py sin cambiar lógica
│   ├── llm.py         ← cliente + contabilidad de tokens (F-005)
│   ├── pricing.py     ← tabla de precios y coste (F-010, F-011)
│   ├── parse.py       ← ===FILE:=== / ===ENDFILE===
│   └── metrics.py     ← el JSON del intento, y el CSV derivado de él
├── graph/
│   ├── state.py       ← estado y MAX_ATTEMPTS
│   ├── checks.py      ← C3 (paleta) y C4 (idiomático), puros
│   ├── nodes/         ← coder.py · test_runner.py
│   └── run.py         ← compila el grafo y lo lanza
├── tasks/             ← una tarea por pantalla, formato congelado
└── tests/             ← dry_run.py · test_checks.py
```

## Correr

```bash
python -m harness.graph.run harness/tasks/MSG-01.json
```

Antes de gastar un token, en seco — Coder y npm simulados, cero coste:

```bash
python -m harness.graph.run harness/tasks/MSG-01.json --seco
```

`--seco` valida primero **la tarea que recibió**, no un fixture propio (`B-007`,
`F-042`): que los ficheros de `inputs` y de `acceptance` existan en el repo, que
`outputs` no esté vacío y que `component_api` cubra cada `.tsx` de `outputs`. Si
algo falta, para ahí — código 1, cero llamadas al grafo — antes de que una tarea
mal formada revienta con el modelo ya pagado. Solo si la tarea es válida sigue con
los tres escenarios de siempre (ciclo, tope de intentos, CSV).

Y las piezas puras, que no tocan ni red ni npm:

```bash
python -m harness.tests.test_checks
```

## Lo que hay que saber antes de tocar nada

**El ciclo.** `coder → test_runner → ¿verde?`. Verde sale; rojo vuelve al Coder con el
feedback; al **tercer** intento escala al humano, marca `escalado_a_humano = si` en el CSV
y sale con código 2. No hay nodo Escalation, así que escalar es parar y decirlo — y ese
dato es el que `Plan §11` pide medir.

**El veredicto lo escribe el Test-runner, no la arista.** Una función de enrutado de
LangGraph decide por dónde salir pero no toca el estado; si el escalado viviera solo en la
arista, el estado final diría `en_curso` y el CSV se quedaría sin la marca.

**El Coder no ve los tests.** No solo no los escribe (`CLAUDE.md` §3, regla innegociable):
si los ve, escribe para el test. Los tests de aceptación los escribe Claude Code **antes**,
en un commit propio (`CLAUDE.md` §1.6).

**El Test-runner no lleva LLM.** Ejecuta procesos y lee códigos de salida. Es la lección de
`generate_screen.py` en `Plan §6`: un LLM revisando la salida de otro LLM sin verdad de
referencia. El modelo que `CLAUDE.md` §3 asigna a este nodo queda sin usar, a propósito.

**El feedback al Coder es salida cruda.** Compilador, test, nombre del token infractor.
Nada redactado: un feedback redactado inyecta la solución y el intento 2 deja de medir al
Coder.

**Un check que no puede ejecutarse es rojo** (F-015, que ya dio dos verdes falsos), y
**C3 se valida contra §1.1 + §1.4 + §1.5** del sistema de diseño, nunca contra §1.1 a secas
(F-003, que ya rechazó output correcto una vez).

**C5 no está aquí.** "¿Lo mantendrías?" lo contesta el PO. El grafo llega a C4.

## Variables de entorno

`DEEPSEEK_API_KEY` es obligatoria. `DS_PRICE_IN_HIT` · `DS_PRICE_IN_MISS` · `DS_PRICE_OUT`
tienen valor por defecto de agosto de 2026 y **el arnés no arranca si alguna está a cero**
(F-010). Ninguna clave en ningún fichero, nunca (`CLAUDE.md` §1.1).

---

## Los dos registros de medida, y cuál responde a qué (F-033, 12-ago)

| Fichero | Una fila por | Responde a |
|---|---|---|
| `openspec/mvp/harness-metrics.csv` | **intento** | coste, tokens, caché, minutos, y **qué checks miraron y cuáles no** |
| `openspec/mvp/harness-review.csv` | **corrida** | **la métrica del objetivo 4**: líneas tocadas en la revisión a mano sobre líneas del artefacto, y ficheros sin tocar |

**«Intentos hasta verde» ya no es la cifra con la que se decide si el arnés sirve en V1.**
No porque estuviera mal medida, sino porque **es frágil por construcción**: mide el bucle
tanto como al modelo, y el bucle estuvo roto tres días sin que nadie lo notara (F-064) más
otro con la entrada corrompida por códigos de color (F-068). De las 24 filas de intento
sobre pantallas, solo **3** las produjo un instrumento que hoy creemos sano.

Las dos medidas de `harness-review.csv` **han sobrevivido a los cuatro problemas** porque no
dependen ni del bucle ni de la rúbrica. Y cada fila lleva `commit_artefacto` y
`commit_revision`: **se recomputan desde git**, no hay que fiarse de que alguien las tecleara
bien.

### El tercer estado de un check

`verde` · `rojo` (miró el artefacto y dijo que no) · `inejecutable` (**no llegó a mirar**).

Para **decidir** los dos últimos son fallo, y eso no ha cambiado (F-015): una corrida con un
check ciego no se da por buena. Para **medir** son cosas distintas, y solo `rojo` dice algo
del modelo.

⚠ **No se deduce del código de salida.** Comprobado sobre las corridas guardadas:
`MSG-01/corrida-01` salía con **127** (comando no encontrado) pero `corrida-02` con **1** —
vitest arrancó, dijo *"No test files found"* y devolvió 1, **indistinguible de un test que
falla de verdad**. Cada check lo declara en el sitio donde sabe que no miró; el código de
salida es solo la red de seguridad.
