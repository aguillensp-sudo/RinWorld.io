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
import os
import pathlib
import re
import shutil
import subprocess

from ..checks import check_idiomatic, check_palette, read_tokens
from ..state import MAX_ATTEMPTS, HarnessState

ROOT = pathlib.Path(__file__).resolve().parents[3]
APP = ROOT / "app"

# ⚠ EL BYTE ESC ES OPCIONAL EN ESTE PATRON, Y ESA ES LA GRACIA (F-068).
#
# La salida de vitest llegaba aqui con el ESC (0x1B) ya perdido por el camino y
# el resto de la secuencia intacto: `[36m`, `[39m`, `[1m`, `[0m`... Un
# `re.sub(r'\x1b\[[0-9;]*m', ...)` de manual NO limpia eso, porque lo que queda
# no es una secuencia de escape: es texto. Medido el 12-ago sobre la corrida de
# VND-01: **72 secuencias en el feedback del intento 1 y 70 en el del 2**, todas
# sin ESC.
#
# Y no es cosmetico. En el intento 3 el Coder recibio ese texto, se lo creyo, y
# escribio literalmente:
#
#   import type { SentOffer, SortColumn, SortDirection, [1m, [0m } from '...';
#
# El fichero dejo de parsear. **El intento 3 salio PEOR que el 1** —que solo
# tenia tres errores de tipo— y la corrida escalo con un error de sintaxis que no
# habia escrito nadie. Es el segundo mecanismo que invalidaba las medidas, junto
# con F-064.
_ANSI = re.compile(r"\x1b?\[[0-9;]*m")


def strip_ansi(text: str) -> str:
    """Quita los codigos de color, con o sin su ESC delante."""
    return _ANSI.sub("", text or "")


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
        # `text=True` a secas decodifica con la codificacion de la consola —
        # cp1252 en este Windows— y la salida de vitest lleva UTF-8 (los ticks,
        # las cajas, los nombres con diacriticos de la siembra). El hilo lector de
        # `subprocess` revienta con UnicodeDecodeError, la salida se pierde entera
        # y el check queda ROJO **sin detalle**: el feedback que vuelve al Coder es
        # una cabecera vacia. Tercera variante del mismo fallo en un dia — el
        # veredicto sobrevive y la razon no.
        # `NO_COLOR` y `FORCE_COLOR=0` apagan el color EN ORIGEN, que es donde hay
        # que apagarlo: limpiar despues es un parche que depende de acertar con el
        # patron, y ya se fallo una vez (F-068). Los dos porque no hay uno solo
        # que respeten todos: `NO_COLOR` es la convencion (no-color.org) y vitest
        # y tsc miran `FORCE_COLOR`. `strip_ansi` de abajo se queda igualmente
        # como red: `npx` no propaga el entorno a todo lo que arranca.
        env = {**os.environ, "NO_COLOR": "1", "FORCE_COLOR": "0"}
        p = subprocess.run([resolve(cmd[0]), *cmd[1:]], cwd=cwd,
                           capture_output=True, text=True,
                           encoding="utf-8", errors="replace",
                           timeout=900, shell=False, env=env)
    except FileNotFoundError as e:
        return 127, f"no se pudo ejecutar {' '.join(cmd)}: {e}"
    except subprocess.TimeoutExpired:
        return 124, f"timeout ejecutando {' '.join(cmd)}"
    return p.returncode, strip_ansi((p.stdout or "") + (p.stderr or ""))


def _tail(text: str, lines: int = 40) -> str:
    """Salida cruda, recortada. Recortar por el final es lo correcto: el error de
    tsc y el resumen de vitest van abajo."""
    return "\n".join((text or "").strip().split("\n")[-lines:])


# -----------------------------------------------------------------------------
# F-114 · el recorte de 40 lineas decide CUAL de los fallos ve el Coder, y con
# mas de dos elige por posicion en el fichero, no por importancia.
#
# El docstring de `_tail` justifica recortar por el final diciendo que "el
# resumen de vitest va abajo". **Para tsc es cierto; para vitest es falso:**
# abajo va el ULTIMO fallo, no el resumen. En la remedicion del 28-ago eso costo
# dos tareas del corpus enteras —evidencia recuperada de las transcripciones,
# porque los JSON por intento se perdieron (F-115):
#
#   SRCH-01, intento 3 · **13 fallos**. El Coder vio el [12/13] y el [13/13], que
#   son los dos sintomas mas aguas abajo (`sendInquiries` llamado **0** veces, no
#   2). Los once que explican por que nunca llego a llamarse no salieron del
#   recorte en ninguno de los tres intentos.
#   MSG-01, intento 3 · **6 fallos**. Los tres que dominan el recorte —[4/6],
#   [5/6], [6/6]— son el bloque rotulado `Realtime — FUERA del contrato del
#   arnes`. Lo ultimo que se le pidio arreglar es lo unico que su tarea no le
#   manda construir (F-116).
#
# Y esto contesta la pregunta que abrio F-112. PANEL-01 y VND-01 fallaban por UN
# test, que cabe entero en 40 lineas, y con el bucle arreglado convergieron;
# SRCH-01 y MSG-01 fallaban por seis y por trece. **La discrepancia no estaba en
# el modelo: estaba en cuanto le contabamos.** Un feedback que depende del numero
# de fallos no mide al Coder, mide el tamaño de la salida.
#
# El inventario va DELANTE del recorte y no lo sustituye: el detalle del ultimo
# fallo sigue sirviendo; lo que faltaba era saber que no era el unico.
# -----------------------------------------------------------------------------
_FAIL = re.compile(r"^\s*FAIL\s+(\S.*)$", re.M)
_ERROR_TSC = re.compile(r"^\s*(\S+\(\d+,\d+\): error TS\d+: .*)$", re.M)
_CONTADOR = re.compile(r"\[(\d+)/(\d+)\]")


def _inventario(out: str, maximo: int = 30) -> str:
    """La lista COMPLETA de lo que fallo, para ir delante del recorte.

    Devuelve cadena vacia si no reconoce ningun fallo: entonces el recorte a
    secas es lo unico que hay y no se le añade una cabecera que mienta.
    """
    texto = out or ""
    fallos = []
    for patron in (_FAIL, _ERROR_TSC):
        for m in patron.finditer(texto):
            linea = m.group(1).strip()
            if linea not in fallos:
                fallos.append(linea)
    if not fallos:
        return ""

    # vitest numera cada fallo `[n/m]`, y `m` es el total: mejor fuente que
    # nuestras cabeceras, porque no depende de que sepamos reconocerlas todas.
    totales = [int(m.group(2)) for m in _CONTADOR.finditer(texto)]
    total = max(totales + [len(fallos)])

    cuerpo = "\n".join("  - " + f for f in fallos[:maximo])
    if len(fallos) > maximo:
        cuerpo += f"\n  - ...y {len(fallos) - maximo} mas"
    return (f"{total} fallo(s) en total, no solo el ultimo. Lista completa:\n"
            f"{cuerpo}\n\n--- ultimas lineas de la salida ---")


def _detalle(cabecera: str, out: str) -> str:
    """Cabecera, inventario completo y recorte, en ese orden: primero QUE fallo,
    despues el detalle de lo ultimo. F-114."""
    return "\n".join(p for p in (cabecera, _inventario(out), _tail(out)) if p)


def _dependencies() -> set:
    pkg = json.loads((APP / "package.json").read_text(encoding="utf-8"))
    return set(pkg.get("dependencies", {})) | set(pkg.get("devDependencies", {}))


# -----------------------------------------------------------------------------
# F-033 · el tercer estado de un check
#
# ⚠ `rojo` E `inejecutable` SE REGISTRABAN IGUAL, Y NO SON LO MISMO.
#
#   rojo         = el check MIRO el artefacto y dijo que no. Dato sobre el modelo.
#   inejecutable = el check NO LLEGO A MIRAR. No dice nada del modelo.
#
# F-015 zanjo que un check que no se puede ejecutar cuenta como ROJO, y **para
# decidir sigue siendo correcto**: una corrida asi no se da por buena. Para MEDIR
# son cosas distintas, y el objetivo 4 vive de esa medicion.
#
# La prueba de que hacia falta esta en el CSV: las tres filas de
# `MSG-01/corrida-01-checks-ciegos` dicen `FALLA 1/4 (rojo: C1;C2;C4)` con `npm`
# fuera del PATH — el arnes no evaluo nada y se pago la llamada igual—, y se leen
# exactamente igual que un fallo de tipos del artefacto.
#
# ⚠ Y NO SE PUEDE DEDUCIR DEL CODIGO DE SALIDA, que era la tentacion. Comprobado
# sobre las corridas guardadas: `corrida-01` sale con **127** (comando no
# encontrado) pero `corrida-02` sale con **1** — vitest arranco, dijo "No test
# files found" y devolvio 1, indistinguible de "los tests fallaron". Por eso cada
# check lo DECLARA en el sitio donde sabe que no miro, y el codigo de salida es
# solo la red de seguridad.
# -----------------------------------------------------------------------------
VERDE, ROJO, INEJECUTABLE = "verde", "rojo", "inejecutable"

# 127 = comando no encontrado · 124 = timeout. En los dos casos no hubo proceso
# que mirara nada.
_SIN_PROCESO = (127, 124)


def _no_miro(code: int, out: str) -> bool:
    """Si el proceso arranco pero no llego a evaluar el artefacto."""
    return code in _SIN_PROCESO or "No test files found" in (out or "")


def _rojo(check_id: str, detail: str, code: int = 0, out: str = "") -> dict:
    estado = INEJECUTABLE if _no_miro(code, out) else ROJO
    return {"id": check_id, "ok": False, "estado": estado, "detail": detail}


def _check_c1(runner) -> dict:
    code, out = runner(["npm", "run", "typecheck"], APP)
    if code != 0:
        return _rojo("C1", _detalle(f"npm run typecheck (exit {code})", out), code, out)
    # `test:arnes`, no `test`: la suite entera MENOS los
    # `*.fuera-de-contrato.test.*` (`vitest.config.arnes.ts`). Son tests
    # obligatorios del producto que ninguna tarea del corpus le pide al Coder
    # —Realtime, el cableado entre pantallas—, y hasta el 28-ago se le puntuaban:
    # tres de los seis rojos de MSG-01 en la corrida de ese dia, y encima los que
    # dominaban el recorte del feedback. F-116 / B-011, opcion (b) del PO.
    #
    # ⚠ Lo que NO cambia es por que C1 corre la suite entera y no solo la
    # pantalla: eso es F-070, y sigue en pie. Se quita lo que nadie encargo, no
    # lo de al lado.
    code, out = runner(["npm", "run", "test:arnes"], APP)
    if code != 0:
        return _rojo("C1", _detalle(f"npm run test:arnes (exit {code})", out), code, out)
    return {"id": "C1", "ok": True, "estado": VERDE,
            "detail": "typecheck limpio y suite de unidad en verde"}


def _check_c2(task, runner) -> dict:
    """Los tests de aceptacion. F-015: si la tarea no declara ninguno, es ROJO —
    una pantalla sin contrato ejecutable no puede darse por buena."""
    acceptance = task.get("acceptance") or {}
    unit = acceptance.get("unit") or []
    e2e = acceptance.get("e2e") or []
    if not unit and not e2e:
        # INEJECUTABLE, no rojo: sin contrato declarado no hay nada que mirar. Se
        # sigue tratando como fallo para decidir (F-015); lo que cambia es que la
        # medicion ya no lo confunde con un artefacto malo.
        return {"id": "C2", "ok": False, "estado": INEJECUTABLE, "detail":
                "la tarea no declara tests de aceptacion. F-015: un check que no se "
                "puede ejecutar es rojo, no ausente"}

    faltan = [p for p in list(unit) + list(e2e) if not (ROOT / p).exists()]
    if faltan:
        return {"id": "C2", "ok": False, "estado": INEJECUTABLE, "detail":
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
            return _rojo("C2", _detalle(f"vitest de aceptacion (exit {code})", out), code, out)
        partes.append(f"unidad {len(unit)} fichero(s)")
    # D-09-03 (a), decidido por el PO el 12-ago: **C2 corre SIEMPRE la suite e2e
    # ENTERA**, declare la tarea ficheros o no.
    #
    # F-070 nacio justo de lo contrario. LOGIN-01 salio 4/4 VERDE y estaba
    # colgando la suite completa: su tarea no declaraba ningun e2e, asi que esta
    # rama no corria y los cuatro checks daban por buena una pantalla que rompia
    # otras. Un "verde 4/4" que no mira lo de al lado no es verde: es un hueco
    # con forma de verde.
    #
    # Los ficheros que la tarea declare ya van DENTRO de la suite, asi que no se
    # corren aparte —seria pagar dos veces por lo mismo—. Lo que se pierde es
    # atribucion: el fallo dice "la suite" y no "tu fichero". Lo que se gana es
    # que deje de existir un modo de pasar sin haber mirado.
    #
    # El coste son minutos de CPU por intento. El del hueco fue una contrasena en
    # un artefacto descargable (F-038 + F-070).
    code, out = runner(["npx", "playwright", "test"], APP)
    if code != 0:
        return _rojo("C2", _detalle(f"suite e2e COMPLETA (exit {code})", out), code, out)
    partes.append("suite e2e completa" + (f" (cubre los {len(e2e)} declarados)" if e2e else ""))

    return {"id": "C2", "ok": True, "estado": VERDE,
            "detail": "aceptacion en verde: " + " + ".join(partes)}


def test_runner_node(state: HarnessState, runner=run_cmd) -> dict:
    task = state["task"]
    files = state.get("files") or {}

    if not files:
        # INEJECUTABLE: no hay artefacto que mirar, asi que ninguno de los cuatro
        # llego a evaluar nada. Que la causa sea del modelo o del arnes -F-005, el
        # truncado por `max_tokens`- es otra pregunta, y este campo no la responde:
        # `estado` dice si el check MIRO, no de quien fue la culpa.
        checks = [{"id": "C0", "ok": False, "estado": INEJECUTABLE, "detail":
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
    # `check_palette` y `check_idiomatic` son puros sobre los ficheros: si hay
    # artefacto, miran. Se les pone el estado aqui para no repetirlo en cada uno.
    for c in checks:
        c.setdefault("estado", VERDE if c["ok"] else ROJO)

    rojos = [c for c in checks if not c["ok"]]
    for c in checks:
        print(f"  {c['id']}: {c['estado'].upper() if not c['ok'] else 'verde'}")

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
    #
    # `strip_ansi` otra vez aqui, y no es redundante: esto es LO QUE SALE HACIA EL
    # MODELO, asi que la garantia se cierra en la frontera, no en cada productor.
    # `run_cmd` ya limpia lo suyo, pero un check nuevo que traiga texto de otro
    # sitio no tendria que acordarse de nada (F-068).
    feedback = strip_ansi(
        "\n\n".join(f"### {c['id']} ROJO\n{c['detail']}" for c in rojos))

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
