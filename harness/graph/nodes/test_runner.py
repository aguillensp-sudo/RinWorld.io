"""Nodo Test-runner. **No lleva LLM, y eso es la decision, no un atajo.**

`Plan §6` sobre por que fallo `generate_screen.py`: *"un LLM revisaba la salida de
otro LLM sin verdad de referencia"*. Aqui se ejecutan procesos y se leen codigos de
salida. El modelo que `CLAUDE.md` §3 asigna al nodo Test-runner queda sin usar en el
MVP; si algun dia hace falta juicio, se decidira con datos de fallo delante.

La rubrica es la de SP-1 (`findings-register.md`, notas de la puerta). Cuatro
criterios automaticos; **C5 ("¿lo mantendrias?") es del PO y no lo da una maquina**.

  C1  compila            npm run typecheck + npm test (la suite entera: la pantalla
                         nueva tampoco puede romper las 98 que ya estaban)
  C2  renderiza          los tests de aceptacion, escritos ANTES por Claude Code
  C3  tokens             checks.check_palette
  C4  React idiomatico   checks.check_idiomatic

Cuatro reglas que vienen de sangre derramada:

  F-015 · **un check que no se puede ejecutar es ROJO, nunca ausente.** Un `skip`
          condicional reporto "2 passed" habiendo ejecutado cero tests de la puerta,
          y paso dos veces. Se lee el numero de checks ejecutados, no el de verdes.
  F-025 · **C2 se evalua sobre el PANEL DE CONTENIDO, no sobre el shell.** El HTML de
          cada pantalla lleva un shell que ha derivado del shell base aprobado — en
          INV-01 hay cinco diferencias, y una es que el HTML contradice a su propio
          spec. Juzgar el shell en cada pantalla solo produce falsos rojos. Por eso
          C2 son los tests de aceptacion de la tarea, no una comparacion con el mock.
  F-024 · los checks de formato comparan contra la **funcion de formato**, nunca
          contra la cifra del mock. Vive en los tests de aceptacion, que los escribe
          Claude Code sabiendo esto.
  F-003 · C3 contra §1.1 + §1.4 + §1.5, nunca §1.1 a secas. Ver `checks.py`.

**El feedback que vuelve al Coder es el `detail` de los checks rojos, y solo eso.**
Nada redactado por un humano ni por otro modelo: si se redacta, se inyecta la
solucion y el intento 2 deja de medir al Coder.
"""
import json
import pathlib
import shutil
import subprocess

from ..checks import check_idiomatic, check_palette, read_tokens
from ..state import MAX_ATTEMPTS, HarnessState

ROOT = pathlib.Path(__file__).resolve().parents[3]
APP = ROOT / "app"


def resolve(program: str) -> str:
    """La ruta real del ejecutable, o el nombre tal cual si no aparece.

    **En Windows `npm` es `npm.CMD`, y `subprocess` con `shell=False` no aplica
    PATHEXT**: la llamada muere con `WinError 2` antes de arrancar nada. El dia 5
    eso reporto C1 y C2 en ROJO en los tres intentos de MSG-01 sin haber ejecutado
    ni un test, y el feedback que volvio al Coder fue *"no se pudo ejecutar npm"* —
    ruido puro, tres veces pagado. La regla de F-015 (un check que no se puede
    ejecutar es rojo) hizo justo lo que debia; el fallo era que no se podia
    ejecutar. `shell=True` lo arreglaria tambien, y no se usa: mete la linea por
    un interprete de comandos y las rutas con espacios -`C:\\Program Files`- dejan
    de ser un argumento."""
    return shutil.which(program) or program


def check_toolchain_or_exit() -> None:
    """Antes de llamar al Coder: que las herramientas de C1 y C2 existan.

    Sin `npm` y `npx` los cuatro checks son inejecutables, asi que la corrida solo
    puede acabar escalando — pero **despues** de pagar los tres intentos. Es lo
    que paso el dia 5 con MSG-01: $0.0345 y tres artefactos evaluados a ciegas.
    Misma idea que `pricing.check_prices_or_exit()`: lo que hace inutil la corrida
    entera se comprueba antes de gastar, no al llegar al primer check."""
    faltan = [p for p in ("npm", "npx") if not shutil.which(p)]
    if faltan:
        raise SystemExit(
            "No estan en el PATH: " + ", ".join(faltan) + ".\n"
            "C1 y C2 no se podrian ejecutar y la corrida acabaria escalando sin "
            "haber probado nada. Se para antes de llamar al Coder.")


def run_cmd(cmd: list, cwd: pathlib.Path) -> tuple:
    """(codigo, salida). Se inyecta en `test_runner_node` para poder correr el
    grafo en seco sin arrancar npm."""
    try:
        p = subprocess.run([resolve(cmd[0]), *cmd[1:]], cwd=cwd,
                           capture_output=True, text=True,
                           timeout=900, shell=False)
    except FileNotFoundError as e:
        return 127, f"no se pudo ejecutar {' '.join(cmd)}: {e}"
    except subprocess.TimeoutExpired:
        return 124, f"timeout ejecutando {' '.join(cmd)}"
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def _tail(text: str, lines: int = 40) -> str:
    """Salida cruda, recortada. Recortar por el final es lo correcto: el error de
    tsc y el resumen de vitest van abajo."""
    return "\n".join((text or "").strip().split("\n")[-lines:])


def _dependencies() -> set:
    pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
    return set(pkg.get("dependencies", {})) | set(pkg.get("devDependencies", {}))


def _check_c1(runner) -> dict:
    code, out = runner(["npm", "run", "typecheck"], APP)
    if code != 0:
        return {"id": "C1", "ok": False, "detail": f"npm run typecheck (exit {code})\n{_tail(out)}"}
    code, out = runner(["npm", "test"], APP)
    if code != 0:
        return {"id": "C1", "ok": False, "detail": f"npm test (exit {code})\n{_tail(out)}"}
    return {"id": "C1", "ok": True, "detail": "typecheck limpio y suite de unidad en verde"}


def _check_c2(task, runner) -> dict:
    """Los tests de aceptacion. F-015: si la tarea no declara ninguno, es ROJO —
    una pantalla sin contrato ejecutable no puede darse por buena."""
    acceptance = task.get("acceptance") or {}
    unit = acceptance.get("unit") or []
    e2e = acceptance.get("e2e") or []
    if not unit and not e2e:
        return {"id": "C2", "ok": False, "detail":
                "la tarea no declara tests de aceptacion. F-015: un check que no se "
                "puede ejecutar es rojo, no ausente"}

    faltan = [p for p in list(unit) + list(e2e) if not (ROOT / p).exists()]
    if faltan:
        return {"id": "C2", "ok": False, "detail":
                "tests de aceptacion declarados que no existen en el repo: "
                + "; ".join(faltan) + ". Los escribe Claude Code ANTES del Coder "
                "(Plan §6)"}

    # Las rutas de la tarea son del repo y los dos procesos arrancan en `app/`:
    # se rebajan igual para vitest que para Playwright. Sin esto vitest responde
    # "No test files found" y sale con 1, que se registra como C2 ROJO — otro
    # check inejecutable disfrazado de fallo del Coder, como el WinError 2 del
    # `npm`. La rama del e2e lo hacia bien desde el dia 4 y la de unidad no, asi
    # que C2 no se habia ejecutado nunca.
    rel = lambda rutas: [str(pathlib.Path(p).relative_to("app")) for p in rutas]

    partes = []
    if unit:
        code, out = runner(["npx", "vitest", "run", *rel(unit)], APP)
        if code != 0:
            return {"id": "C2", "ok": False,
                    "detail": f"vitest de aceptacion (exit {code})\n{_tail(out)}"}
        partes.append(f"unidad {len(unit)} fichero(s)")
    if e2e:
        code, out = runner(["npx", "playwright", "test", *rel(e2e)], APP)
        if code != 0:
            return {"id": "C2", "ok": False,
                    "detail": f"playwright de aceptacion (exit {code})\n{_tail(out)}"}
        partes.append(f"e2e {len(e2e)} fichero(s)")
    return {"id": "C2", "ok": True, "detail": "aceptacion en verde: " + " + ".join(partes)}


def test_runner_node(state: HarnessState, runner=run_cmd) -> dict:
    task = state["task"]
    files = state.get("files") or {}

    if not files:
        checks = [{"id": "C0", "ok": False, "detail":
                   "el Coder no devolvio ningun fichero parseable. Revisa el formato "
                   "===FILE: ruta=== / ===ENDFILE==="}]
        return _finish(state, checks)

    tokens = read_tokens((APP / "src" / "styles" / "tokens.css").read_text(encoding="utf-8"))

    checks = [
        _check_c1(runner),
        _check_c2(task, runner),
        check_palette(files, tokens),
        check_idiomatic(files, task["outputs"], _dependencies()),
    ]
    return _finish(state, checks)


def _finish(state: HarnessState, checks: list) -> dict:
    rojos = [c for c in checks if not c["ok"]]
    for c in checks:
        print(f"  {c['id']}: {'verde' if c['ok'] else 'ROJO'}")

    # El veredicto lo escribe este nodo, no la arista: una funcion de enrutado de
    # LangGraph decide por donde salir pero no toca el estado, y si el escalado
    # vive solo en la arista, el estado final dice "en_curso" y el CSV se queda
    # sin la marca. Es exactamente el dato que pide `Plan §11`.
    if not rojos:
        verdict = "verde"
    elif state.get("attempt", 0) >= MAX_ATTEMPTS:
        verdict = "escalado"
    else:
        verdict = "en_curso"

    # El feedback es el `detail` crudo de los rojos. Nada mas.
    feedback = "\n\n".join(f"### {c['id']} ROJO\n{c['detail']}" for c in rojos)

    # El registro del intento se devuelve explicitamente, no se muta en el estado:
    # confiar en que el grafo comparte el objeto es la clase de suposicion que se
    # rompe sola al cambiar de version de LangGraph.
    historico = list(state.get("metrics") or [])
    if historico:
        historico[-1] = {**historico[-1], "checks": checks}

    return {
        "checks": checks,
        "feedback": feedback,
        "metrics": historico,
        "verdict": verdict,
    }
