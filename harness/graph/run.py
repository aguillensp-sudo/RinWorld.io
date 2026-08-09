"""Arnes v0 — el grafo de dos nodos (`Plan §3`, dia 4).

    tarea -> coder -> test_runner -> ¿verde?
                        ^               |- si  -> VERDE  (queda C5, que lo da el PO)
                        |               |- no  -> vuelta a coder con feedback
                        +---------------+- no, y ya van 3 -> ESCALADO

**Escalar es parar y decirlo**, porque no hay nodo Escalation en el MVP (`Plan §6`):
se escribe el estado, se marca `escalado_a_humano = si` en el CSV y se sale con
codigo distinto de cero. `Plan §11` pide justamente ese dato — *"porcentaje de
tareas que requieren intervencion humana"* — y con reintentos infinitos no existiria.

Uso:
    python -m harness.graph.run harness/tasks/MSG-01.json
    python -m harness.graph.run harness/tasks/MSG-01.json --seco   # sin gastar tokens
"""
import argparse
import json
import pathlib
import sys

from langgraph.graph import END, StateGraph

from ..core import metrics, pricing
from .nodes.coder import coder_node
from .nodes.test_runner import test_runner_node
from .state import MAX_ATTEMPTS, HarnessState

ROOT = pathlib.Path(__file__).resolve().parents[2]
CSV = ROOT / "openspec" / "mvp" / "harness-metrics.csv"


def decide(state: HarnessState) -> str:
    """Solo lee el veredicto. Quien lo decide es el Test-runner: una funcion de
    enrutado no puede escribir en el estado, y el escalado tiene que quedar
    escrito porque de ahi sale la columna `escalado_a_humano` del CSV."""
    return {"verde": "verde", "escalado": "escalado"}.get(
        state.get("verdict"), "reintentar")


def build_graph(coder=coder_node, test_runner=test_runner_node):
    g = StateGraph(HarnessState)
    g.add_node("coder", coder)
    g.add_node("test_runner", test_runner)
    g.set_entry_point("coder")
    g.add_edge("coder", "test_runner")
    g.add_conditional_edges(
        "test_runner", decide,
        {"verde": END, "escalado": END, "reintentar": "coder"},
    )
    return g.compile()


def record_metrics(state: HarnessState, task: dict, metrics_dir: pathlib.Path,
                   csv_path: pathlib.Path = CSV, write_csv: bool = True) -> list:
    """Un JSON y una fila de CSV **por intento** (`CLAUDE.md` §6). La fila se
    deriva del JSON: F-010, para que la copia a mano no pueda divergir."""
    escalado = state.get("verdict") == "escalado"
    filas = []
    for i, rec in enumerate(state.get("metrics") or [], 1):
        # Solo el ultimo intento puede ser el que escalo.
        rec["escalated_to_human"] = escalado and i == len(state["metrics"])
        metrics.write_record(metrics_dir, rec)
        resultado = metrics.resultado_from_checks(
            rec.get("checks") or [], rec["escalated_to_human"])
        if write_csv:
            filas.append(metrics.append_csv(csv_path, rec, resultado))
    return filas


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task", help="ruta al JSON de la tarea")
    ap.add_argument("--seco", action="store_true",
                    help="corrida en seco: Coder y checks simulados, cero coste")
    args = ap.parse_args(argv)

    pricing.check_prices_or_exit()  # F-010, antes de nada

    task = json.loads(pathlib.Path(args.task).read_text(encoding="utf-8"))
    if args.seco:
        from ..tests.dry_run import run_dry
        return run_dry(task)

    app = build_graph()
    final = app.invoke({"task": task, "attempt": 0, "metrics": []},
                       {"recursion_limit": MAX_ATTEMPTS * 4})

    metrics_dir = ROOT / "harness" / "metrics" / task["task_id"]
    for fila in record_metrics(final, task, metrics_dir):
        print("  CSV: " + fila)

    veredicto = final.get("verdict")
    print(f"\nVEREDICTO: {veredicto.upper()} en {final.get('attempt')} intento(s)")
    if veredicto == "verde":
        print("Quedan C5 (¿lo mantendrias?) y la revision del PO: no los da el grafo.")
        return 0
    print("ESCALADO al humano. Ultimo feedback:\n" + (final.get("feedback") or ""))
    return 2


if __name__ == "__main__":
    sys.exit(main())
