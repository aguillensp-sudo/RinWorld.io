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
import datetime
import json
import os
import pathlib
import sys
import threading
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
                   csv_path: pathlib.Path = CSV, write_csv: bool = True,
                   corrida: str = None) -> list:
    """Un JSON y una fila de CSV **por intento** (`CLAUDE.md` §6). La fila se
    deriva del JSON: F-010, para que la copia a mano no pueda divergir."""
    escalado = state.get("verdict") == "escalado"
    filas = []
    for i, rec in enumerate(state.get("metrics") or [], 1):
        # Solo el ultimo intento puede ser el que escalo.
        rec["escalated_to_human"] = escalado and i == len(state["metrics"])
        rec["corrida"] = corrida or "-"      # F-129, y al JSON antes que al CSV
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


def _pid_vivo(pid: int) -> bool:
    """¿Sigue existiendo ese proceso? En Windows **no vale `os.kill(pid, 0)`**:
    Python lo traduce a `TerminateProcess`, o sea que preguntar si esta vivo lo
    mataria. Se abre un handle y se mira su codigo de salida."""
    if os.name != "nt":
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True        # existe, es de otro usuario
        return True

    import ctypes
    PROCESS_QUERY_LIMITED_INFORMATION, STILL_ACTIVE = 0x1000, 259
    k32 = ctypes.windll.kernel32
    h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        return False
    try:
        code = ctypes.c_ulong()
        if not k32.GetExitCodeProcess(h, ctypes.byref(code)):
            return False
        return code.value == STILL_ACTIVE
    finally:
        k32.CloseHandle(h)


# -----------------------------------------------------------------------------
# ⚠ F-124 · el cerrojo tiene que saber cuando su dueño ya no esta.
#
# `soltar_cerrojo()` vive en un `finally`, y un `finally` protege de una
# excepcion — **no de un `SIGKILL`**. Y el plazo de pared que F-122 puso por
# fuera mata justamente asi (`timeout --signal=KILL`). O sea que los dos
# arreglos se peleaban: **el plazo garantizaba que el cerrojo se quedara puesto**,
# y la corrida siguiente no arrancaba hasta que alguien borrara un fichero a
# mano. Un cerrojo que hay que limpiar a mano acaba borrandose por costumbre, y
# el dia que se borre con la otra corrida viva vuelve F-121.
#
# Pasó el 29-ago con SRCH-01, a la primera que el plazo hizo su trabajo.
#
# Un cerrojo cuyo dueño ya no existe no protege de nada: se caduca solo, se dice
# en voz alta, y se sigue.
# -----------------------------------------------------------------------------
def tomar_cerrojo() -> None:
    if CERROJO.exists():
        try:
            quien = CERROJO.read_text(encoding="utf-8").strip()
        except OSError:
            quien = "(ilegible)"

        pid = None
        if quien.startswith("pid "):
            trozo = quien.split(None, 2)[1] if len(quien.split()) > 1 else ""
            pid = int(trozo) if trozo.isdigit() else None

        if pid is not None and not _pid_vivo(pid):
            print(f"  ⚠ cerrojo caducado, su dueño ya no existe: {quien}\n"
                  f"    Lo mas probable es que la corrida muriera por el plazo de "
                  f"pared (F-122 mata con KILL y eso no deja limpiar). Sigo. F-124.",
                  file=sys.stderr)
            CERROJO.unlink(missing_ok=True)
        else:
            print("HAY OTRA CORRIDA EN CURSO y comparte `app/src` con esta:\n"
                  f"  {quien}\n"
                  "Dos corridas a la vez se pisan el artefacto y las dos escriben "
                  "numeros que no miden nada (F-121). Espera a que acabe.",
                  file=sys.stderr)
            raise SystemExit(3)

    CERROJO.write_text(
        f"pid {os.getpid()} · {time.strftime('%Y-%m-%d %H:%M:%S')} · "
        f"{' '.join(sys.argv[1:])}\n", encoding="utf-8")


def soltar_cerrojo() -> None:
    try:
        CERROJO.unlink()
    except OSError:
        pass


# -----------------------------------------------------------------------------
# ⚠ F-122 · EL PLAZO DE PARED, Y POR QUE TIENE QUE VIVIR AQUI DENTRO.
#
# Tres plazos se han intentado ya y los dos primeros no sirven:
#
#   1. `urlopen(timeout=300)` (F-119) acota cada OPERACION de socket, no la
#      llamada entera. Un extremo que ni cierra ni envia deja la llamada colgada
#      indefinidamente sin que el timeout llegue a dispararse nunca. El 29-ago
#      `SRCH-01` estuvo NUEVE HORAS parada con este codigo puesto: 2,3 segundos
#      de CPU en nueve horas, o sea bloqueada en E/S, no trabajando.
#
#   2. `timeout --signal=KILL 25m` por fuera, en el script de tanda. Dos defectos
#      medidos la primera vez que hizo su trabajo: **disparo tarde** —25 min
#      configurados, 34m45s reales, porque el `timeout` de coreutils bajo Git
#      Bash no entrega la señal a un proceso nativo de Windows hasta que este
#      sale de una llamada bloqueante—, y **matar con KILL se llevo por delante
#      los intentos ya medidos**, porque `record_metrics()` corria al final del
#      grafo. `SRCH-01` perdio los intentos 1 y 2, completos y PAGADOS, por morir
#      en el 3. Cambio un cuelgue por una perdida total de datos.
#
#   3. Este. Un hilo de este mismo proceso. **Y funciona justamente porque el
#      cuelgue es de E/S:** Python suelta el GIL mientras espera en el socket,
#      asi que el hilo del reloj corre aunque el principal lleve nueve horas
#      parado. No hay señal que entregar ni proceso ajeno al que llegar.
#
# El plazo va POR PASO del grafo —una llamada al modelo, o una tanda de checks—
# y no por corrida entera: lo que se persigue es un paso que no vuelve, y un
# presupuesto total castigaria a una corrida lenta pero viva. La llamada mas
# larga medida son **781 s** (`SRCH-01`, remedicion 04, intento 1), asi que 1200
# deja un 54 % de margen sobre lo peor visto.
#
# Al vencer no se lanza una excepcion: no hay a quien lanzarsela. El hilo
# principal esta bloqueado en el socket y no la recogeria. Se vuelca lo medido,
# se suelta el cerrojo —F-124: un `finally` no corre con `os._exit`, igual que no
# corre con SIGKILL, asi que se suelta A MANO aqui— y se sale.
# -----------------------------------------------------------------------------
PLAZO_POR_PASO = 1200

#: Salida del proceso cuando el reloj de pared corta la corrida. Ni 0 (verde),
#: ni 2 (escalado), ni 3 (cerrojo): quien lea el codigo tiene que poder
#: distinguir "el Coder no lo consiguio" de "el arnes se colgo y lo cortamos".
SALIDA_POR_PLAZO = 4


def _corto(p: pathlib.Path) -> str:
    """La ruta relativa al repo si esta dentro, y la entera si no. Las pruebas
    vuelcan en un temporal, y que un `print` de progreso pete por eso seria el
    arnes rompiendose por decir donde escribio."""
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


class RelojDePared:
    """El plazo de un paso del grafo, contado en un hilo aparte de este proceso.

    `arrancar()` es idempotente y REARMA: cada paso empieza con el contador a
    cero. `parar()` al terminar, para que el hilo no sobreviva a la corrida."""

    def __init__(self, segundos: int, al_vencer):
        self.segundos = segundos
        self.al_vencer = al_vencer
        self._timer = None
        self._paso = "(sin arrancar)"
        self._desde = time.time()
        self._venciendo = threading.Lock()

    def arrancar(self, paso: str) -> None:
        if not self.segundos:
            return
        self.parar()
        self._paso, self._desde = paso, time.time()
        self._timer = threading.Timer(self.segundos, self._vencer)
        self._timer.daemon = True
        self._timer.start()

    def parar(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _vencer(self) -> None:
        # Sin `return` posible: quien entra aqui no sale del proceso.
        self._venciendo.acquire()
        esperado = time.time() - self._desde
        print(f"\n⚠ PLAZO DE PARED VENCIDO (F-122): «{self._paso}» lleva "
              f"{esperado / 60:.1f} min y el plazo son {self.segundos / 60:.1f}. "
              f"Corto la corrida.", file=sys.stderr)
        try:
            self.al_vencer(self._paso, esperado)
        except BaseException as e:                       # noqa: BLE001
            # Que el volcado reviente no puede impedir que el proceso muera: si
            # no sale, el cuelgue sigue ahi y esto no ha arreglado nada.
            print(f"  ⚠ y el volcado de lo medido fallo: {e!r}", file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(SALIDA_POR_PLAZO)


class Volcado:
    """Escribe el JSON de cada intento EN CUANTO termina, no al final del grafo.

    Esta es la segunda mitad de F-122 y es la que de verdad dolio: un intento
    completo y pagado que muere sin dejar rastro porque `record_metrics()`
    corria despues de `app.invoke()`. Un intento esta terminado cuando el
    Test-runner le ha metido sus `checks` — antes de eso el registro existe pero
    aun no dice nada de si paso.

    El CSV NO se escribe al vuelo en el camino feliz: `escalado_a_humano` solo se
    sabe al acabar, y una fila del CSV no se reescribe («el CSV historico no se
    recalcula», 25-ago). El JSON si, porque es la evidencia y se puede corregir
    en sitio. Si la corrida muere por plazo, entonces si se escriben las filas de
    los intentos completos: ninguno de ellos escalo —la corrida ni llego a
    decidirlo— y perderlas es exactamente el fallo que se esta arreglando."""

    def __init__(self, metrics_dir: pathlib.Path, task: dict,
                 csv_path: pathlib.Path = CSV, corrida: str = None):
        self.metrics_dir, self.task, self.csv_path = metrics_dir, task, csv_path
        self.corrida = corrida or "-"
        self._en_disco = set()

    @staticmethod
    def completos(state: dict) -> list:
        return [r for r in (state.get("metrics") or []) if r.get("checks")]

    def al_vuelo(self, state: dict) -> None:
        for rec in self.completos(state):
            if rec["attempt"] in self._en_disco:
                continue
            rec["corrida"] = self.corrida          # F-129
            ruta = metrics.write_record(self.metrics_dir, rec)
            self._en_disco.add(rec["attempt"])
            print(f"  · intento {rec['attempt']} ya en disco: "
                  f"{_corto(ruta)} (F-122)")

    def cerrar_por_plazo(self, state: dict, paso: str, esperado: float) -> None:
        completos = self.completos(state)
        self.al_vuelo(state)

        for rec in completos:
            rec["escalated_to_human"] = False
            rec["corrida"] = self.corrida
            resultado = metrics.resultado_from_checks(rec["checks"], False)
            # La marca va en la columna de texto libre y no en una columna nueva:
            # nadie que agregue el CSV puede confundir estas filas con una
            # medicion terminada, y las historicas no se tocan.
            fila = metrics.append_csv(
                self.csv_path, rec,
                resultado + " · CORRIDA CORTADA POR PLAZO DE PARED (F-122)")
            print("  CSV: " + fila)

        # ⚠ El intento en vuelo NO lleva fila. Se pago y no se midio, y sus
        # columnas de tokens y coste no se pueden rellenar sin inventarlas — que
        # es literalmente F-010, el hallazgo donde el fichero de maquina mintio
        # con un `cost_usd: 0.0`. Se deja dicho aparte, con su motivo.
        aviso = self.metrics_dir / "ABORTADA-POR-PLAZO.txt"
        en_vuelo = len(state.get("metrics") or []) - len(completos)
        try:
            self.metrics_dir.mkdir(parents=True, exist_ok=True)
            aviso.write_text(
                f"Corrida cortada por el plazo de pared (F-122).\n\n"
                f"  tarea         {self.task['task_id']}\n"
                f"  cuando        {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"  paso colgado  {paso}\n"
                f"  llevaba       {esperado / 60:.1f} min\n"
                f"  intentos completos volcados   {len(completos)}\n"
                f"  intentos pagados SIN MEDIR    {en_vuelo}\n\n"
                f"Los completos tienen su JSON y su fila de CSV, marcada.\n"
                f"El que estaba en vuelo no lleva fila a proposito: se pago y no\n"
                f"se supo cuanto, y rellenar sus columnas con ceros seria mentir\n"
                f"en el fichero de maquina (F-010).\n", encoding="utf-8")
            print(f"  · motivo escrito en {_corto(aviso)}")
        except OSError as e:
            print(f"  ⚠ no se pudo escribir {aviso}: {e!r}", file=sys.stderr)

        print(f"\nCORRIDA CORTADA POR PLAZO: {len(completos)} intento(s) "
              f"salvados, {en_vuelo} pagado(s) sin medir.", file=sys.stderr)


def _proximo_paso(state: dict) -> str:
    """Que va a hacer el grafo a continuacion, para que el reloj lo diga al
    vencer. Se deduce del estado: un registro sin `checks` es un intento cuyo
    Coder ya volvio y al que le faltan los checks."""
    registros = state.get("metrics") or []
    if registros and not registros[-1].get("checks"):
        return f"intento {registros[-1]['attempt']} · checks del Test-runner"
    return f"intento {len(registros) + 1} · llamada al modelo"


# -----------------------------------------------------------------------------
# F-115 · EL LOG LO ESCRIBE LA CORRIDA, NO QUIEN LA LANZA
#
# La cabecera de este fichero dice, treinta lineas mas arriba, que «una corrida
# del arnes SIEMPRE se lanza redirigida a un fichero». **Era un supuesto, y el
# 30-ago se cayo:** las tres corridas de MSG-01 con las que se hizo la primera
# medida con n>1 del proyecto se lanzaron con un `| tail -45` por delante, y de
# las tres no quedo un solo log. Los JSON guardaron los checks, el coste y el
# artefacto (`B-010`); el ORDEN y los TIEMPOS —los avisos de reintento de F-119,
# los del reloj de pared de F-122, en que momento se volco cada intento— no los
# tiene nadie.
#
# Y ese mismo dia se habia abierto un hueco en `.gitignore` para que estos logs
# se versionaran, con el argumento de que eran la evidencia de esa medida. La
# regla estaba bien y la evidencia se perdio igual, **porque dependia de como se
# invocara**. Una evidencia que solo existe si el operador se acuerda de
# redirigir no es evidencia: es suerte.
#
# Asi que la corrida escribe su propio log, en la carpeta donde ya viven sus
# JSON, y lo que haga quien lanza deja de importar.
#
#   · APPEND, no truncado. Relanzar una corrida con el mismo nombre no puede
#     borrar la evidencia de la anterior: eso es literalmente F-115.
#   · Flush en cada escritura. El reloj de pared sale por `os._exit` (F-122),
#     que no ejecuta cierres ni vacia buffers: lo que no este en disco cuando
#     corte, no existe. Es F-120 otra vez, y por el mismo sitio.
#   · Se abre DESPUES de decidir el directorio y ANTES del cerrojo, o sea antes
#     de la primera llamada pagada.
#   · `--seco` no pasa por aqui, y esta bien: cero coste, cero evidencia que
#     guardar.
class _Tee:
    """Escribe en el flujo de siempre y ademas en el log. No sustituye a
    redirigir: si quien lanza redirige, la salida sale por los dos sitios."""

    def __init__(self, flujo, fichero):
        self._flujo, self._fichero = flujo, fichero

    def write(self, texto):
        n = self._flujo.write(texto)
        try:
            self._fichero.write(texto)
            self._fichero.flush()
        except Exception:
            pass        # un log que falla no puede tumbar una corrida pagada
        return n

    def flush(self):
        self._flujo.flush()
        try:
            self._fichero.flush()
        except Exception:
            pass

    def cerrar(self):
        """Devuelve el flujo original y suelta el fichero. En una corrida de
        verdad no hace falta —el proceso acaba y el sistema cierra—, pero sin
        esto una prueba no puede borrar su directorio temporal en Windows, y una
        pieza que no se puede probar acaba sin probar."""
        try:
            self._fichero.close()
        except Exception:
            pass
        return self._flujo

    def __getattr__(self, nombre):
        return getattr(self._flujo, nombre)


def cerrar_log():
    """Deshace lo que hizo `abrir_log`. Idempotente."""
    for nombre in ("stdout", "stderr"):
        flujo = getattr(sys, nombre)
        if isinstance(flujo, _Tee):
            setattr(sys, nombre, flujo.cerrar())


def abrir_log(metrics_dir: pathlib.Path, task_id: str, argv=None) -> pathlib.Path:
    try:
        metrics_dir.mkdir(parents=True, exist_ok=True)
        destino = metrics_dir / f"{task_id}.log"
        fichero = destino.open("a", encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"⚠ no se pudo abrir el log de la corrida: {e!r}. Sigue sin el, "
              f"pero esta corrida no dejara rastro de su orden ni de sus tiempos "
              f"(F-115).", file=sys.stderr)
        return None
    sys.stdout = _Tee(sys.stdout, fichero)
    sys.stderr = _Tee(sys.stderr, fichero)
    print(f"\n{'=' * 78}\n· corrida arrancada {datetime.datetime.now():%Y-%m-%d %H:%M:%S} "
          f"· {' '.join(argv or sys.argv[1:])}\n{'=' * 78}")
    # `_corto` y no `relative_to` a secas: su docstring ya avisa de por que —una
    # prueba vuelca en un temporal— y reventar una corrida PAGADA al decir donde
    # escribe seria el arnes rompiendose por hablar.
    print(f"Log de esta corrida: {_corto(destino)} (F-115). Lo escribe ella, no "
          f"quien la lanza.")
    return destino


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task", help="ruta al JSON de la tarea")
    ap.add_argument("--seco", action="store_true",
                    help="corrida en seco: Coder y checks simulados, cero coste")
    ap.add_argument("--corrida", metavar="NOMBRE", default=None,
                    help="subcarpeta bajo harness/metrics/<tarea>/ para los JSON "
                         "de esta corrida. Sin esto se escriben planos y una "
                         "corrida pisa a la anterior (F-115)")
    ap.add_argument("--plazo", type=int, default=PLAZO_POR_PASO, metavar="SEGUNDOS",
                    help=f"plazo de pared por paso del grafo (F-122). Por defecto "
                         f"{PLAZO_POR_PASO}s; la llamada mas larga medida son 781s. "
                         f"0 lo desactiva, y entonces un cuelgue no tiene limite")
    args = ap.parse_args(argv)

    pricing.check_prices_or_exit()  # F-010, antes de nada

    task = json.loads(pathlib.Path(args.task).read_text(encoding="utf-8"))
    if args.seco:
        from ..tests.dry_run import run_dry
        return run_dry(task)

    check_toolchain_or_exit()  # dia 5: y esto tambien, antes de gastar

    # El directorio se decide ANTES de arrancar el grafo y no despues: el reloj
    # de pared tiene que saber donde volcar sin que nadie se lo pase (F-122).
    metrics_dir = ROOT / "harness" / "metrics" / task["task_id"]
    if args.corrida:
        metrics_dir = metrics_dir / args.corrida
    previos = sorted(metrics_dir.glob("attempt_*.json")) if metrics_dir.is_dir() else []

    abrir_log(metrics_dir, task["task_id"], argv)   # F-115, y antes de gastar

    tomar_cerrojo()             # F-121, y antes de la primera llamada pagada

    volcado = Volcado(metrics_dir, task, corrida=args.corrida)
    final = {"task": task, "attempt": 0, "metrics": []}

    def al_vencer(paso, esperado):
        # ⚠ El orden importa: primero se suelta el cerrojo. Si el volcado se
        # atasca —el CSV en un disco que no responde es el mismo tipo de cuelgue
        # que nos ha traido aqui—, al menos la corrida siguiente puede arrancar.
        soltar_cerrojo()
        volcado.cerrar_por_plazo(final, paso, esperado)

    reloj = RelojDePared(args.plazo, al_vencer)
    if args.plazo:
        print(f"Plazo de pared: {args.plazo}s por paso del grafo (F-122).")
    else:
        print("⚠ SIN plazo de pared (--plazo 0): un cuelgue no tiene limite (F-122).")

    try:
        app = build_graph()
        reloj.arrancar(_proximo_paso(final))
        # `stream` y no `invoke` **por una sola razon**: `invoke` no devuelve nada
        # hasta el final, asi que no hay ningun momento en el que volcar un
        # intento terminado ni en el que rearmar el reloj. Con `values` el grafo
        # emite el estado entero tras cada paso y las dos cosas caben.
        for estado in app.stream({"task": task, "attempt": 0, "metrics": []},
                                 {"recursion_limit": MAX_ATTEMPTS * 4},
                                 stream_mode="values"):
            final = estado
            volcado.al_vuelo(final)
            reloj.arrancar(_proximo_paso(final))
    finally:
        reloj.parar()
        # En `finally` a proposito: si la corrida revienta —y F-119 es justo eso,
        # un `ConnectionResetError` que se llevo una tarea entera— el cerrojo no
        # puede quedarse puesto bloqueando a la siguiente.
        soltar_cerrojo()

    for fila in record_metrics(final, task, metrics_dir,
                               corrida=args.corrida):
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
