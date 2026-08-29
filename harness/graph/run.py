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
import os
import pathlib
import sys
import time

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
#
# -----------------------------------------------------------------------------
# ⚠ Y `line_buffering=True`, que es F-120 y es el mismo patron una vez mas.
#
# Python bloquea la salida en bloques de 8 KB cuando stdout NO es una consola, y
# una corrida del arnes SIEMPRE se lanza redirigida a un fichero. Resultado: los
# `print` de progreso —incluido el aviso de reintento que F-119 acababa de
# añadir para que un corte se viera en el momento— **se quedan en el buffer**. Si
# el proceso se mata, el buffer se pierde entero.
#
# El 29-ago costo una noche: `SRCH-01` estuvo NUEVE HORAS con el log a cero
# bytes. Cero bytes se leyo como "no ha hecho nada", y lo que significaba era
# "no ha llenado 8 KB". Que ademas estuviera colgada fue casualidad: el log
# habria estado igual de vacio corriendo perfectamente.
#
# Es exactamente el patron de F-028..F-032 otra vez —**el veredicto sobrevive y
# la razon no**— pero por un camino nuevo: aqui no se pierde por una excepcion,
# se pierde por no haberse escrito todavia. Una señal de vida que solo aparece
# cuando el proceso termina bien no es una señal de vida.
# -----------------------------------------------------------------------------
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

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


# -----------------------------------------------------------------------------
# F-121 · DOS CORRIDAS A LA VEZ SOBRE EL MISMO ARBOL, y ninguna de las dos lo sabe.
#
# El 29-ago se midieron tres tareas dos veces en paralelo sin querer. Un script
# de tanda se quedo huerfano —matar el proceso que lanza la corrida NO mata al
# `python` que corre el grafo, y matar ese `python` deja al bucle de `bash`
# seguir con la tarea siguiente— y se lanzo otra tanda encima. Durante 17
# minutos las dos hicieron `git checkout -- app/src` y `git clean` mientras la
# otra tenia al Coder escribiendo justo ahi, y las dos volcaron en el mismo
# directorio de corrida.
#
# **Ninguna de las dos dio error.** Salieron veredictos, filas de CSV y commits
# con toda la pinta de ser una medicion, y solo se descubrio reconstruyendo la
# secuencia por las marcas de tiempo de los commits. Es la peor forma del fallo
# que persigue todo este arnes: no un rojo mal atribuido, sino un numero entero
# que no mide lo que dice.
#
# El cerrojo va AQUI y no en el script de tanda: quien no puede coexistir es el
# grafo, porque el artefacto vive en un `app/src` unico. Un guardia en el script
# solo protege de los scripts que se acuerden de llamarlo.
# -----------------------------------------------------------------------------
CERROJO = ROOT / "harness" / ".corrida-en-curso"


def tomar_cerrojo() -> None:
    if CERROJO.exists():
        try:
            quien = CERROJO.read_text(encoding="utf-8").strip()
        except OSError:
            quien = "(ilegible)"
        print("HAY OTRA CORRIDA EN CURSO y comparte `app/src` con esta:\n"
              f"  {quien}\n"
              "Dos corridas a la vez se pisan el artefacto y las dos escriben "
              "numeros que no miden nada (F-121). Si estas seguro de que aquella "
              "murio, borra:\n"
              f"  {CERROJO.relative_to(ROOT)}", file=sys.stderr)
        raise SystemExit(3)
    CERROJO.write_text(
        f"pid {os.getpid()} · {time.strftime('%Y-%m-%d %H:%M:%S')} · "
        f"{' '.join(sys.argv[1:])}\n", encoding="utf-8")


def soltar_cerrojo() -> None:
    try:
        CERROJO.unlink()
    except OSError:
        pass


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
    tomar_cerrojo()             # F-121, y antes de la primera llamada pagada

    try:
        app = build_graph()
        final = app.invoke({"task": task, "attempt": 0, "metrics": []},
                           {"recursion_limit": MAX_ATTEMPTS * 4})
    finally:
        # En `finally` a proposito: si la corrida revienta —y F-119 es justo eso,
        # un `ConnectionResetError` que se llevo una tarea entera— el cerrojo no
        # puede quedarse puesto bloqueando a la siguiente.
        soltar_cerrojo()

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
