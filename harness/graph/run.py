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

# -----------------------------------------------------------------------------
# La consola de Windows es cp1252 y el feedback lleva caracteres que no estan en
# esa tabla. En la corrida 1 de SRCH-01 el escalado reviento aqui —`★`, U+2605,
# de la columna de favoritos— **justo al imprimir la razon del escalado**: el
# proceso murio con UnicodeEncodeError, el veredicto se supo y el motivo hubo que
# reproducirlo a mano corriendo los checks otra vez.
#
# Es el mismo hallazgo que 42e3e8c por el otro lado: aquel era el DECODE de la
# salida de los checks, este es el ENCODE de lo que imprimimos. Y es otra vez el
# patron de F-028..F-032: **el veredicto sobrevive y la razon no**. Con `replace`,
# un caracter fuera de tabla sale como '?' y no se lleva por delante el informe.
# Ver F-046.
# -----------------------------------------------------------------------------
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")

from langgraph.graph import END, StateGraph

from ..core import metrics, pricing
from .nodes.coder import coder_node
from .nodes.test_runner import check_toolchain_or_exit, test_runner_node
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


# -----------------------------------------------------------------------------
# F-115 · una corrida puede borrar su propia evidencia sin que nadie se entere.
#
# El 28-ago se remidieron tres tareas con el bucle arreglado. Se comitearon las
# nueve filas del CSV (`f60a163`) y **nada mas**: los `attempt_N.json` viven bajo
# `harness/metrics/`, o sea DENTRO del working tree, y el descarte del codigo
# generado —decision del PO, correcta en si misma— se los llevo por delante. De
# la unica corrida que motivo F-112 quedo una columna que dice `rojo: C1;C2` y
# ni una linea de por que.
#
# El diagnostico de F-112 se pudo hacer el 28-ago porque la salida seguia en las
# transcripciones de Claude Code. **Eso es suerte, no diseño**: el arnes lo
# imprime, no lo guarda, y ese rastro no esta en el repo.
#
# Y hay una segunda mitad, la que casi manda el diagnostico al lado contrario:
# los JSON se escriben PLANOS, `attempt_1..3.json` por tarea, asi que una corrida
# pisa a la anterior — pero solo hasta donde llegue. `VND-01/attempt_3.json` es
# de una corrida del 12-ago que escalo; la del mismo dia que paso 4/4 en el
# intento 2 sobrescribio el 1 y el 2 y dejo el 3 viejo ahi, con su fecha de
# fichero actualizada por git y con toda la pinta de ser el ultimo intento de la
# ultima corrida. `harness/metrics/MSG-01/` ya usaba subcarpetas por corrida
# —`corrida-01-checks-ciegos`, `-02-c2-ciego`, `-03-la-buena`— desde el dia 4.
# La solucion estaba escrita en el propio directorio y nunca se generalizo.
# -----------------------------------------------------------------------------
def _avisar_de_los_artefactos(metrics_dir: pathlib.Path, intentos: int,
                              previos: list, usa_corrida: bool) -> None:
    escritos = [metrics_dir / f"attempt_{i}.json" for i in range(1, intentos + 1)]
    print("\nArtefactos de esta corrida:")
    for p in escritos:
        print(f"  {p.relative_to(ROOT)}")
    print("  ⚠ Junto con las filas del CSV son la UNICA evidencia de lo que "
          "paso. Comitealos ANTES de descartar el working tree (F-115).")

    huerfanos = [p for p in previos if p not in escritos]
    if huerfanos:
        print("\n  ⚠ Y estos son de una corrida ANTERIOR, no de esta:")
        for p in huerfanos:
            print(f"      {p.relative_to(ROOT)}")
        print("      Quien los lea mañana los leera como si fueran de hoy.")
    if not usa_corrida:
        print("\n  (Con `--corrida NOMBRE` cada corrida escribe en su propia "
              "subcarpeta y deja de pisar a la de al lado.)")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task", help="ruta al JSON de la tarea")
    ap.add_argument("--seco", action="store_true",
                    help="corrida en seco: Coder y checks simulados, cero coste")
    ap.add_argument("--corrida", metavar="NOMBRE", default=None,
                    help="subcarpeta bajo harness/metrics/<tarea>/ para los JSON "
                         "de esta corrida. Sin esto se escriben planos y una "
                         "corrida pisa a la anterior (F-115)")
    args = ap.parse_args(argv)

    pricing.check_prices_or_exit()  # F-010, antes de nada

    task = json.loads(pathlib.Path(args.task).read_text(encoding="utf-8"))
    if args.seco:
        from ..tests.dry_run import run_dry
        return run_dry(task)

    check_toolchain_or_exit()  # dia 5: y esto tambien, antes de gastar

    app = build_graph()
    final = app.invoke({"task": task, "attempt": 0, "metrics": []},
                       {"recursion_limit": MAX_ATTEMPTS * 4})

    metrics_dir = ROOT / "harness" / "metrics" / task["task_id"]
    if args.corrida:
        metrics_dir = metrics_dir / args.corrida
    previos = sorted(metrics_dir.glob("attempt_*.json")) if metrics_dir.is_dir() else []

    for fila in record_metrics(final, task, metrics_dir):
        print("  CSV: " + fila)

    _avisar_de_los_artefactos(metrics_dir, final.get("attempt") or 0, previos,
                              usa_corrida=bool(args.corrida))

    veredicto = final.get("verdict")
    print(f"\nVEREDICTO: {veredicto.upper()} en {final.get('attempt')} intento(s)")
    if veredicto == "verde":
        print("Quedan C5 (¿lo mantendrias?) y la revision del PO: no los da el grafo.")
        return 0
    print("ESCALADO al humano. Ultimo feedback:\n" + (final.get("feedback") or ""))
    return 2


if __name__ == "__main__":
    sys.exit(main())
