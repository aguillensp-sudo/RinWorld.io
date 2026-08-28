"""Corrida en seco del grafo. **Cero llamadas al modelo, cero coste.**

Verifica lo unico que hay que verificar el dia 4: que el ciclo cierra, que el tope
de 3 corta, que el escalado se marca y que el CSV sale generado desde el JSON. La
primera llamada real es MSG-01 el dia 5 (`Plan §3`).

Se sustituyen las dos fronteras caras — el modelo y el subproceso de npm — y **no
se toca el resto del grafo**: las aristas, el contador de intentos, el acumulador
de metricas y la escritura del CSV son los de verdad. Sustituir el grafo entero
por un simulacro no probaria nada.

Tres escenarios, que son los tres caminos del diagrama de §1:

  A · artefacto bueno            -> VERDE en el intento 1
  B · malo y luego bueno         -> ROJO -> reintento -> VERDE en el 2
  C · siempre malo               -> ESCALADO en el 3, y ni uno mas

**B-007 (F-042, 12-ago):** hasta hoy los tres escenarios de arriba eran TODO lo
que hacia `--seco`, y corrian contra un fixture propio sin mirar la tarea real
que se le paso por linea de comandos — `run_dry(task)` recibia `task` y lo
ignoraba. Eso prueba el grafo (sigue probandolo, es valido) pero no prueba nada
de una tarea nueva: un `data_layer` inexistente o un `component_api` sin cubrir
un output pasaban el seco igual y reventaban con el modelo ya pagado. Ahora,
cuando se recibe una tarea real, `validar_tarea()` corre primero contra ella y
para en seco si algo falta — es el minimo que F-042 dejo escrito: los ficheros de
`inputs` y de `acceptance` existen, `outputs` no esta vacio, `component_api`
cubre cada `.tsx` de `outputs`.

Uso:  python -m harness.tests.dry_run
"""
import json
import pathlib
import sys
import tempfile

from ..core import metrics
from ..graph.nodes.test_runner import test_runner_node
from ..graph.run import build_graph, record_metrics
from ..graph.state import MAX_ATTEMPTS

ROOT = pathlib.Path(__file__).resolve().parents[2]

BUENO_TSX = """import styles from './ThreadList.module.css';

export interface Thread {
  id: string;
  counterparty: string;
  country: string;
}

export function ThreadList({ threads }: { threads: Thread[] }) {
  return (
    <ul className={styles.list}>
      {threads.map((t) => (
        <li key={t.id}>{t.counterparty}</li>
      ))}
    </ul>
  );
}
"""

BUENO_CSS = """.list {
  color: var(--bw-deep-steel);
  background: var(--bw-cold-white);
}
"""

# Los cuatro fallos que el nodo tiene que cazar, uno de cada familia: color
# literal (C3), `any` y props sin tipar (C4), y un fichero no declarado (C4).
MALO_TSX = """import styles from './ThreadList.module.css';
import dayjs from 'dayjs';

export function ThreadList({ threads }: any) {
  return <ul className={styles.list} style={{ color: '#2563EB' }}>{threads}</ul>;
}

export function Badge(props) {
  return <span>{props.x}</span>;
}
"""

MALO_CSS = """.list {
  color: #6B7A99;
  background: rgba(0, 0, 0, 0.1);
}
"""

TAREA = {
    "task_id": "SECO-1",
    "screen": "MSG-01",
    "goal": "corrida en seco del grafo",
    "outputs": [
        "app/src/screens/messages/ThreadList.tsx",
        "app/src/screens/messages/ThreadList.module.css",
    ],
    "acceptance": {"unit": ["app/src/screens/inventory/InventoryTable.test.tsx"]},
    "out_of_scope": [],
    "constraints": [],
}


def artefacto(bueno: bool) -> dict:
    base = {
        "app/src/screens/messages/ThreadList.tsx": BUENO_TSX if bueno else MALO_TSX,
        "app/src/screens/messages/ThreadList.module.css": BUENO_CSS if bueno else MALO_CSS,
    }
    if not bueno:
        base["app/src/shell/AppShell.tsx"] = "// el Coder no escribe aqui"
    return base


def coder_falso(guion: list):
    """Sustituye al modelo. Ni escribe ficheros al repo ni gasta un token, pero
    devuelve exactamente la forma que devuelve el nodo de verdad."""
    def nodo(state):
        attempt = state.get("attempt", 0) + 1
        bueno = guion[min(attempt - 1, len(guion) - 1)]
        rec = metrics.build_record(
            task_id=state["task"]["task_id"], screen=state["task"]["screen"],
            model="mock-sin-coste", attempt=attempt,
            acc={"tokens_in": 1000, "tokens_out": 500, "cache_hit": 0,
                 "cache_miss": 1000, "calls": 1},
            seconds=0.0, finish_reason="stop", truncated_at=[],
            files=list(artefacto(bueno)),
        )
        print(f"[intento {attempt}] coder simulado -> artefacto "
              f"{'bueno' if bueno else 'malo'}")
        return {"attempt": attempt, "files": artefacto(bueno),
                "metrics": (state.get("metrics") or []) + [rec],
                "verdict": "en_curso"}
    return nodo


def runner_falso(cmd, cwd):
    """Sustituye al subproceso de npm. C1 y C2 en verde siempre: lo que se prueba
    hoy es el ciclo, no la suite de la app — esa ya corre en CI."""
    return 0, f"(seco) {' '.join(cmd)}"


def test_runner_seco(state):
    return test_runner_node(state, runner=runner_falso)


def escenario(nombre, guion, esperado_verdicto, esperado_intentos, csv_tmp):
    print(f"\n=== {nombre} ===")
    app = build_graph(coder=coder_falso(guion), test_runner=test_runner_seco)
    final = app.invoke({"task": TAREA, "attempt": 0, "metrics": []},
                       {"recursion_limit": MAX_ATTEMPTS * 4})

    with tempfile.TemporaryDirectory() as tmp:
        filas = record_metrics(final, TAREA, pathlib.Path(tmp), csv_tmp)

    assert final["verdict"] == esperado_verdicto, \
        f"veredicto {final['verdict']!r}, esperaba {esperado_verdicto!r}"
    assert final["attempt"] == esperado_intentos, \
        f"{final['attempt']} intentos, esperaba {esperado_intentos}"
    assert len(filas) == esperado_intentos, \
        f"{len(filas)} filas de CSV, esperaba una por intento ({esperado_intentos})"

    escalados = [f for f in filas if ",si," in f]
    if esperado_verdicto == "escalado":
        assert len(escalados) == 1, "el escalado se marca en una fila y solo una"
    else:
        assert not escalados, "no deberia haber ninguna fila marcada como escalada"

    print(f"  veredicto {final['verdict']} en {final['attempt']} intento(s), "
          f"{len(filas)} fila(s) de CSV")
    for f in filas:
        print("  CSV: " + f[:150])
    return final


def validar_tarea(task: dict) -> list:
    """Los cuatro chequeos que F-042 dejo escritos como el minimo, sin gastar un
    token: los ficheros de `inputs` y de `acceptance` existen en el repo,
    `outputs` no esta vacio, `component_api` cubre cada `.tsx` de `outputs`.
    Devuelve la lista de problemas -vacia si la tarea esta bien formada."""
    problemas = []

    for clave, valor in task.get("inputs", {}).items():
        if clave.startswith("_") or clave == "design_system":
            continue  # notas y secciones de spec (p.ej. "§1.1"), no rutas
        for ruta in (valor if isinstance(valor, list) else [valor]):
            if ruta and not (ROOT / ruta).exists():
                problemas.append(f"inputs.{clave}: no existe {ruta!r}")

    outputs = task.get("outputs") or []
    if not outputs:
        problemas.append("outputs: vacio")

    api = {k for k in (task.get("component_api") or {}) if not k.startswith("_")}
    for ruta in outputs:
        if ruta.endswith(".tsx") and ruta not in api:
            problemas.append(f"component_api: falta la firma de {ruta!r}")

    for clave, valor in task.get("acceptance", {}).items():
        if clave.startswith("_"):
            continue
        for ruta in (valor if isinstance(valor, list) else [valor]):
            if ruta and not (ROOT / ruta).exists():
                problemas.append(f"acceptance.{clave}: no existe {ruta!r}")

    return problemas


def run_dry(task=None) -> int:
    if task is not None:
        problemas = validar_tarea(task)
        if problemas:
            print(f"TAREA INVALIDA ({task.get('task_id', '?')}): "
                  f"{len(problemas)} problema(s)\n")
            for p in problemas:
                print(f"  - {p}")
            print("\nNo se ha llamado al grafo. Corrige la tarea antes de gastar "
                  "un token.")
            return 1
        n_outputs = len(task.get("outputs") or [])
        print(f"[{task.get('task_id', '?')}] tarea valida: "
              f"{len(task.get('inputs', {}))} inputs, {n_outputs} outputs, "
              f"component_api cubre cada .tsx, ficheros de aceptacion en su sitio.")

    csv_tmp = pathlib.Path(tempfile.mkdtemp()) / "harness-metrics.csv"
    csv_tmp.write_text(",".join(metrics.COLUMNS) + "\n", encoding="utf-8")

    escenario("A · artefacto bueno al primer intento", [True], "verde", 1, csv_tmp)
    escenario("B · malo y luego bueno", [False, True], "verde", 2, csv_tmp)
    final = escenario("C · siempre malo -> escalado", [False], "escalado",
                      MAX_ATTEMPTS, csv_tmp)

    # El feedback del escalado tiene que ser salida cruda de los checks, no prosa.
    fb = final["feedback"]
    for esperado in ("C3 ROJO", "C4 ROJO", "#2563eb", "any", "AppShell.tsx"):
        assert esperado.lower() in fb.lower(), f"falta {esperado!r} en el feedback"
    print("\n  el feedback del reintento lleva los detalles crudos de C3 y C4")

    # Y la cabecera del CSV real tiene que ser la que este modulo espera (F-010:
    # si el contrato del fichero cambia, mejor petar que anadir una fila torcida).
    real = (ROOT / "openspec" / "mvp" / "harness-metrics.csv")
    cabecera = real.read_text(encoding="utf-8").splitlines()[0].split(",")
    assert cabecera == metrics.COLUMNS, \
        f"cabecera del CSV real: {cabecera}\n  esperada: {metrics.COLUMNS}"
    print("  la cabecera de harness-metrics.csv coincide con el contrato")

    print("\nCORRIDA EN SECO: todo verde. Cero llamadas al modelo, cero coste.")
    return 0


if __name__ == "__main__":
    sys.exit(run_dry())
