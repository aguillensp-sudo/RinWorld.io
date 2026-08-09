# Día 4 · Las decisiones del arnés antes de escribir el grafo

> **Por qué existe este fichero.** El día 4 es uno de los tres días de decisiones
> irreversibles del plan (`CLAUDE.md`, ritual de cierre §3). Lo que se decida aquí lo
> hereda **cada pantalla del día 5 al 15**: si el Test-runner juzga mal, la métrica del
> objetivo 4 mide el arnés equivocado y no hay forma de rehacerla a posteriori.
>
> **Regla de F-012 aplicada a este fichero:** todo valor, nombre de criterio y umbral va
> con su puntero. Lo que no lleva puntero es una decisión nueva y se marca como tal.

**Estado: BORRADOR — pendiente de la puerta de revisión del PO.** No se escribe ni una
línea de `harness/graph/` hasta que las seis decisiones de abajo estén aprobadas.

---

## 0 · Qué se construye hoy, y qué no

`Plan §3` (fila del día 4): *"**Arnés v0:** grafo LangGraph de 2 nodos — Coder +
Test-runner"*, ejecuta Claude Code. `Plan §6`: *"En el MVP: Coder + Test-runner. Fuera del
MVP: Planner, Evaluator, Reviewer y Escalation"*.

Hoy **no** se produce ninguna pantalla. La primera salida del arnés es **MSG-01 el día 5**
(`Plan §3`), y la razón está escrita ahí: *"la primera salida del Coder debe ser una
pantalla representativa pero no crítica"*. Hoy el entregable es el grafo y su primera
tarea escrita en el formato fijo, corriendo en seco.

**El riesgo del día, citado del cierre de ayer** (`ESTADO.md` §Riesgo): *"no es el grafo:
es repetir a mano lo que `run_coder.py` ya resuelve"*. Ese fichero implementa F-005, F-010
y F-011. La decisión 2 de abajo existe únicamente para que eso no pase.

---

## 1 · Decisión · La forma del grafo

Dos nodos, un ciclo, tres salidas. Nada más.

```
                    ┌──────────────────────────────┐
   tarea (JSON) ──> │  coder                       │
                    │  DeepSeek-V4-Flash           │
                    │  escribe los ficheros        │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │  test_runner                 │
                    │  ejecuta C1..C4 en subproceso│
                    └──────────────┬───────────────┘
                                   ↓
                            ¿todo verde?
                    ┌──────────────┼───────────────┐
                   sí             no            no, y ya van 3
                    ↓              ↓                    ↓
                 VERDE      vuelta a `coder`        ESCALADO
             (para C5 del PO)  con feedback       (para el humano)
```

**El estado del grafo** (`TypedDict`, campos fijos desde hoy porque el CSV depende de
ellos):

| Campo | Qué es |
|---|---|
| `task` | la tarea, tal cual se leyó del JSON de `harness/tasks/` |
| `attempt` | entero, empieza en 1. **Cada valor es una fila propia del CSV** (`CLAUDE.md` §6) |
| `files` | `{nombre: contenido}` que devolvió el Coder en el último intento |
| `checks` | resultado por criterio: `{id, ok, detail}` — nunca un booleano suelto |
| `feedback` | el texto que se le devuelve al Coder. Se construye **solo** desde `checks` |
| `metrics` | acumulador de usage/coste por intento, formato de `run_coder.py` |
| `verdict` | `verde` · `escalado` · `en_curso` |

**Decisión nueva · el tope de reintentos es 3, y el tercero escala.** No hay nodo
Escalation (`Plan §6`), así que "escalar" es: parar, escribir el estado completo en
`metrics/`, marcar `escalado_a_humano = si` en el CSV, y salir con código distinto de cero
para que quien lo lance lo vea. `Plan §11` pide exactamente ese dato — *"porcentaje de
tareas que requieren intervención humana"* — y con reintentos infinitos no existiría.

**Por qué 3 y no 2 ni 5.** `Plan §11`: *"si la media [de intentos hasta verde] es 1,5 el
arnés es viable; si es 4, el cuello de botella es la spec, no el modelo"*. Un tope de 3
deja ver la diferencia entre esos dos mundos y corta antes de que el coste de los
reintentos se coma la cifra por pantalla. Los dos datos que hay hasta hoy son de 1 intento
(F-022 y F-002), así que 3 es holgado.

---

## 2 · Decisión · `run_coder.py` no se reescribe: se parte en módulos

Esto es la mitigación literal del riesgo del día. `harness/dia-03-catalogo/run_coder.py`
(líneas 51-63, 227-237, 289-322) trae los tres hallazgos ya implementados y probados
contra una corrida real. Se extrae **sin cambiar la lógica**:

```
harness/
├── dia-03-catalogo/          ← se queda intacto. Es la evidencia de F-022
├── core/
│   ├── llm.py                ← call() + accumulate()   (de run_coder.py:197-237)
│   ├── pricing.py            ← check_prices() + fórmula (F-010, run_coder.py:51-63,291-293)
│   ├── parse.py              ← parse_files()            (run_coder.py:217-224)
│   └── metrics.py            ← el JSON por intento + la fila del CSV (F-010/F-011)
├── graph/
│   ├── state.py              ← el TypedDict de §1
│   ├── nodes/coder.py        ← §3
│   ├── nodes/test_runner.py  ← §4
│   └── run.py                ← compila el grafo y lo lanza con una tarea
└── tasks/
    └── MSG-01.json           ← la primera tarea, en el formato fijo de §5
```

**Tres cosas que se conservan tal cual y no se rediscuten:**

1. **F-005** — `max_tokens` 65536 por defecto y reintento automático ante
   `finish_reason == 'length'`, **doblando el presupuesto**, con el coste de *todas* las
   llamadas sumado al intento (`run_coder.py:263-283`). Un truncado no deja artefacto pero
   sí factura: en SP-1 se cobró $0.0049 por nada.
   **Matiz importante:** el reintento por truncado **no consume intento del modelo** — es
   bug de arnés, y así está registrado en la primera fila de `harness-metrics.csv`.
2. **F-010** — peta si la tabla de precios está a cero, y la fila del CSV se **genera
   desde** el JSON. Hoy se cierra del todo: `metrics.py` escribe el CSV, y nadie vuelve a
   copiar a mano. Es el hallazgo donde el fichero de máquina fue el que mintió.
3. **F-011** — `cache_hit_pct` y `cost_usd_cold_equivalent` como campos propios. La cifra
   que se extrapola a V1 es la fría, siempre.

**Deuda que se salda hoy, no mañana:** F-010 y F-011 están **Abiertos** en
`findings-register.md`. Con `core/metrics.py` en su sitio pasan a Cerrados, y se promueven
a `harness-backlog.md` como B-001 y B-002 — el fichero lleva desde el día 1 diciendo que
se llena *"desde el día 4"*.

---

## 3 · Decisión · El nodo Coder

**Modelo `deepseek-v4-flash`** (`CLAUDE.md` §3, F-001), temperatura 0, mismo endpoint.

**El prompt se arma con el patrón de F-022, que es lo que hizo que el catálogo saliera al
primer intento — y no fue suerte.** Los cuatro elementos, generalizados de datos a
pantalla:

| En F-022 (catálogo) | Aquí (pantalla React) |
|---|---|
| Vocabulario cerrado de `product_family` | **Lista literal de tokens CSS permitidos**, de `app/src/styles/tokens.css`. Nada de "usa los tokens del sistema" |
| UUID literales en el prompt | **Las props y los tipos exactos**, copiados de la fuente, no descritos |
| Forma exacta de la sentencia con un ejemplo de dos filas | **`InventoryTable.tsx` como ejemplo**: es la pantalla de referencia a mano del día 3 y enseña la forma de la casa |
| Prohibición explícita de fechas literales | **Prohibiciones explícitas:** nada de hex, nada de `dangerouslySetInnerHTML`, nada de dependencias nuevas, nada de tocar el shell |

El principio de los cuatro es el mismo: **cada uno tapa un hueco por el que se colaría un
error silencioso.** Un error ruidoso lo caza C1; el silencioso llega a la demo.

**Qué lee el Coder** (y qué no):

- **Sí:** el spec de la pantalla, su HTML aprobado, `design-system.md` §1.1/§1.4/§1.5 y
  §6.4, y `InventoryTable.tsx` como referencia de estilo.
- **No:** los tests. **Regla de integridad innegociable** (`Plan §6`, `CLAUDE.md` §3): *"el
  Coder nunca escribe los tests que lo evalúan"*, y tampoco los ve — si los ve, escribe
  para el test, que es la misma degradación por otra puerta.

**Formato de salida:** el bloque `===FILE: nombre===` / `===ENDFILE===` de
`run_coder.py:185-190`, ya probado dos veces. Sin novedad.

---

## 4 · Decisión · El nodo Test-runner — y aquí está lo que hay que revisar de verdad

El Test-runner **no es un LLM**. Ejecuta procesos y lee códigos de salida. Esto es
deliberado y es la lección de `generate_screen.py` citada en `Plan §6`: *"un LLM revisaba
la salida de otro LLM sin verdad de referencia"*. El modelo del nodo Test-runner que
`CLAUDE.md` §3 asigna a DeepSeek queda **sin usar en el MVP**; si algún día hace falta
juicio, se decidirá con datos.

La rúbrica es la de SP-1 (`findings-register.md` §Notas de la puerta), cinco criterios.
**Cuatro son automáticos; C5 es del PO y no lo puede dar una máquina.**

| # | Criterio | Cómo se comprueba | Duro / blando |
|---|---|---|---|
| C1 | Compila | `npm run typecheck` (exit 0) + `npm test` | **Duro** |
| C2 | Renderiza reconocible vs HTML aprobado | Tests de unidad + e2e escritos **antes** por Claude Code | **Duro** |
| C3 | Usa tokens, no valores inventados | Check de paleta sobre los ficheros del Coder | **Duro** |
| C4 | React idiomático | Reglas mecánicas: sin `dangerouslySetInnerHTML`, sin `any`, props tipadas, sin dependencias nuevas | **Duro** |
| C5 | ¿Lo mantendrías? | **El PO, a mano.** El grafo llega hasta C4 | Fuera del grafo |

**Las cuatro trampas ya conocidas, y cómo las esquiva cada check.** Son las cuatro veces
que el mock aprobado no fue la fuente de verdad — F-003, F-019, F-024, F-025 — y las
cuatro apuntan al mismo sitio: **el spec cerrado manda, el mock es un mock.**

1. **C3 se valida contra §1.1 + §1.4 + §1.5 de `design-system.md`, nunca contra §1.1 a
   secas** (F-003). Tal como estaba redactada la acción original, el check habría
   **rechazado output correcto**: el `#ef4444` de SP-1 no era un desvío, es
   `.age.danger` del HTML aprobado, un rol distinto del `#DC2626` de error.
   Y va con la lista de deriva permitida de `app/scripts/check-palette.mjs:33-38` — que es
   el check *complementario*, no este: aquel comprueba que el sistema de diseño esté
   completo, este comprueba el output del Coder. Aquel tiene que estar verde para que este
   sea justo, y lo está desde ayer (cobertura completa de las 6 pantallas claras).
2. **C2 se evalúa sobre el PANEL DE CONTENIDO, no sobre el shell** (F-025, y es lo más
   importante de esta lista). El HTML de cada pantalla lleva un shell que **ha derivado**
   del shell base aprobado: en INV-01 hay cinco diferencias en el armazón, y una de ellas
   es que el HTML **contradice a su propio spec** sobre qué ítem de nav va activo. El shell
   tiene contrato, implementación y tests propios desde el día 2. Juzgarlo otra vez en cada
   pantalla solo produce falsos rojos.
3. **Los checks de formato comparan contra la función de formato, nunca contra la cifra del
   mock** (F-024). El pie del HTML aprobado dice "1.247 líneas"; `toLocaleString('es-ES')`
   da "1247", y el correcto es "1247" — el CLDR de `es` no agrupa cuatro cifras.
4. **Ningún check se salta en silencio** (F-015, y ocurrió **dos veces**). Un `skip`
   condicional reportó *"2 passed"* habiendo ejecutado cero tests de la puerta. Aquí:
   **cualquier check que no pueda ejecutarse cuenta como ROJO**, nunca como ausente, y el
   `detail` dice por qué. Se lee el número de checks *ejecutados*, no el de verdes.

**Quién escribe los tests de C2, y cuándo.** Los escribe **Claude Code, antes de que el
Coder vea la tarea** — es la cadena de `Plan §6`: *"Test de aceptación Playwright ←──
contrato, escrito ANTES del código"*. Van al repo en un commit propio, separado del
artefacto del Coder (`CLAUDE.md` §1.6, F-009).

**El feedback que vuelve al Coder es el `detail` de los checks rojos, y solo eso.** No un
resumen redactado por Claude Code: si lo redacta un humano o un modelo, se está inyectando
la solución y el intento 2 ya no mide al Coder. Salida de compilador, salida de test,
nombre del token infractor.

**⚠ Lo que ningún check automático de este nodo puede ver.** `ESTADO.md` §INV-01 lo dejó
por escrito ayer: `inventory_lines` tiene dos políticas de lectura permisivas que **se
suman**, y sin el `.eq('org_id', …)` explícito una pantalla mostraría el catálogo ajeno
*sin error y con toda la pinta de funcionar*. Los 98 tests de unidad mockean `fetchPage`,
así que ese fallo los pasa todos. **Toda pantalla del arnés que lea datos de otra
organización necesita un e2e contra el Supabase real en su C2**, escrito a mano. Vale
desde MSG-01.

---

## 5 · Decisión · El formato de la tarea

`Plan §6`: *"En el MVP, la tarea la escribe Claude Code a mano en un formato fijo — que
además es el borrador del contrato Planner→Coder de V1. Al final de los 15 días tendrás
10-15 tareas reales en ese formato: el mejor material posible para diseñar el Planner."*

Por eso el formato se congela hoy: si cambia a mitad del MVP, las 10-15 tareas no son un
corpus comparable. JSON en `harness/tasks/<PANTALLA>.json`:

```json
{
  "task_id": "MSG-01",
  "screen": "MSG-01",
  "goal": "una frase",
  "inputs": {
    "spec": "openspec/specs/…",
    "approved_html": "openspec/design-gui/specs y html aprobados/MSG-01 · MSG v1.0.html",
    "design_system": ["§1.1", "§1.4", "§1.5", "§6.4"],
    "style_reference": "app/src/screens/inventory/InventoryTable.tsx"
  },
  "outputs": ["app/src/screens/messages/MessageList.tsx", "…"],
  "acceptance": { "unit": "…", "e2e": "…" },
  "out_of_scope": ["lo que el mock promete y el MVP no tiene"],
  "constraints": ["sin dependencias nuevas", "sin hex", "no tocar el shell"]
}
```

**`out_of_scope` es un campo de primera clase, no un comentario.** F-023 encontró **cuatro**
cosas que el diseño aprobado de INV-01 promete y el MVP no tiene, más un badge verde
"Activo" sobre funciones que no existen. Si el Coder recibe el HTML sin esa lista,
reproduce la mentira fielmente — y en la interfaz engaña más que en el chat, porque parece
verificable (`CLAUDE.md` §7).

---

## 6 · Decisión · Métricas y trazas

- **Una fila de CSV por intento**, generada desde el JSON (`CLAUDE.md` §6, F-010). Ningún
  valor lleva coma; los múltiples van con `;`.
- **Dos columnas nuevas**, que hoy no existen en `harness-metrics.csv` y `Plan §11` exige:
  `cache_hit_pct` (F-011) y `escalado_a_humano`.

  > **Desviación al implementar, 8-ago.** Este párrafo decía "se añaden al final para no
  > romper las tres filas ya escritas". Al ir a hacerlo: **al final** las deja *después* de
  > `resultado`, que es la única columna de texto libre — y una columna libre en medio del
  > fichero es una trampa para el siguiente que lo parsee, exactamente la fragilidad que la
  > convención de "ningún valor lleva coma" (`CLAUDE.md` §6) existe para evitar. Entran
  > **antes** de `resultado`, y las tres filas históricas se rellenan con su valor real
  > (`0.00` / `99.58` / `0.00`; el de la fila truncada de SP-1 se verificó recomputando su
  > coste, que sale exacto a 0% de cache). Se tocan las tres filas, que es lo que el texto
  > original quería evitar — pero con el dato bueno, no con un hueco.
- **`coste_usd` del CSV y `cost_usd` del JSON tienen que coincidir; si no, gana el JSON
  recomputado** (`CLAUDE.md` §6). Con el CSV generado, esa divergencia deja de ser posible.
- **LangSmith**: trazas de cada nodo (`Plan §3`, ya está en el entorno). `LANGSMITH_API_KEY`
  del entorno, nunca en fichero (`CLAUDE.md` §1.1).

---

## Lo que se escribe en cuanto esto se apruebe

1. `harness/core/` — los cuatro módulos extraídos de `run_coder.py`, sin cambiar lógica.
2. `harness/graph/` — estado, dos nodos, arista condicional, tope 3.
3. `harness/tasks/MSG-01.json` — la primera tarea en el formato congelado.
4. Corrida en seco del grafo (Coder mockeado, `CLAUDE.md` §5) — cero coste, verifica que el
   ciclo, el tope y el CSV funcionan antes de gastar un token.
5. F-010 y F-011 a Cerrados; B-001 y B-002 en `harness-backlog.md`.

**Puerta de salida del día 4 propuesta:** *"El grafo corre de punta a punta con el Coder
mockeado: da verde a la vuelta 1 con un artefacto bueno, rojo→reintento con uno malo, y
escala al tercero. El CSV sale generado desde el JSON, con las dos columnas nuevas."*
Sin llamada real al modelo: la primera es MSG-01, mañana.

---

## Lo que necesito de ti antes de escribir código

| # | Decisión | Mi recomendación |
|---|---|---|
| 1 | **Tope de 3 intentos y luego escalado** (§1) | Sí. Con reintentos infinitos, la métrica de "% que requiere intervención humana" de `Plan §11` no existe |
| 2 | **El Test-runner no lleva LLM** (§4) | Sí. Es la lección de `generate_screen.py` en `Plan §6`. El modelo asignado al nodo queda sin usar, y eso está bien |
| 3 | **C5 se queda fuera del grafo** (§4) | Sí. "¿Lo mantendrías?" no lo contesta una máquina, y es el criterio que más dice |
| 4 | **El feedback al Coder es salida cruda, sin redactar** (§4) | Sí. Un feedback redactado inyecta la solución y el intento 2 deja de medir al Coder |
| 5 | **Congelar hoy el formato de tarea** (§5) | Sí. Es el corpus para diseñar el Planner de V1; si cambia a mitad, no es comparable |

*Borrador del 8-ago-2026 · Claude Code (Opus 5) · pendiente de puerta de revisión*
