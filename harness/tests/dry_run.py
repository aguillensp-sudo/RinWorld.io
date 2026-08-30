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
import re
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
        # F-134 · no es una lista de rutas: son los tests del e2e que la tarea
        # declara imposibles para el Coder. Se valida su FORMA, y con dureza: una
        # exclusion sin motivo escrito es una exclusion que nadie podra revisar
        # dentro de un mes, y entonces vuelve a ser el hueco de F-070.
        if clave == "e2e_fuera_de_contrato":
            for i, d in enumerate(valor or []):
                if not isinstance(d, dict) or not d.get("test"):
                    problemas.append(
                        f"acceptance.e2e_fuera_de_contrato[{i}]: hace falta "
                        f"`test` con un trozo del titulo del test que se excusa")
                elif not d.get("motivo"):
                    problemas.append(
                        f"acceptance.e2e_fuera_de_contrato[{i}] ({d['test']!r}): "
                        f"falta `motivo`. Excusar un fallo sin decir por que es "
                        f"abrir el hueco de F-070 y no dejar rastro de quien lo "
                        f"abrio")
            continue
        for ruta in (valor if isinstance(valor, list) else [valor]):
            if ruta and not (ROOT / ruta).exists():
                problemas.append(f"acceptance.{clave}: no existe {ruta!r}")

    return problemas


# -----------------------------------------------------------------------------
# EL GUARDIA · lo que el contrato BUSCA contra lo que la tarea DECLARA.
#
# En tres dias, CINCO veces el contrato de aceptacion exigio algo que la tarea no
# decia, y cada una costo una corrida entera en descubrirse:
#
#   F-116 · C2 puntuaba tests que el propio fichero rotulaba fuera de contrato
#   F-118 · `App.tsx` pasaba una prop que el `component_api` no declaraba
#   F-123 · la tarea decia ">=2 filas, nunca una" y el contrato exigia una
#   F-125 · el e2e buscaba `name: 'Añadir filtro'` y la tarea declaraba `+ Filtro`
#   F-126 · el contrato llama a `sendInquiries` y la tarea no enseña su modulo
#
# No es mala suerte: **la tarea y el contrato se escriben una vez y el repo sigue
# andando**, y nadie los vuelve a cruzar. Esto los cruza, y corre en `--seco`, o
# sea antes del primer token.
#
# ⚠ Lo que este guardia NO puede hacer: F-123 era una CONTRADICCION semantica
# -"nunca con una" contra "se habilita con una"- y ninguna regla mecanica la
# caza. Se cazan las otras cuatro familias, que son de omision.
# -----------------------------------------------------------------------------
_ESPIA = re.compile(r"""\bconst\s+(\w+)\s*=\s*vi\.fn\b""")
_ASERTADO = re.compile(r"""\bexpect\(\s*(\w+)\s*\)""")
_NOMBRE = re.compile(
    r"""(?:getBy|findBy|queryBy|getAllBy|findAllBy)(?:Role\([^)]*?name:\s*|"""
    r"""LabelText\(|Label\()\s*['"]([^'"]+)['"]""")

# ⚠ Y lo mismo buscado con una EXPRESION REGULAR, que es el segundo agujero del
# guardia y F-130. `_NOMBRE` exige comillas, asi que
# `getByRole('button', { name: /Ir al Directorio/ })` y
# `getByText(/fuera del MVP/i)` -las dos mitades de F-128- le pasaban por
# delante sin que las viera. Es el mismo patron que F-127 por tercera vez: el
# guardia siempre acaba siendo una muesca mas estrecho que el contrato.
_NOMBRE_REGEX = re.compile(
    r"""(?:getBy|findBy|queryBy|getAllBy|findAllBy)(?:Role\([^)]*?name:\s*|"""
    r"""Text\(|LabelText\(|Label\()\s*/([^/\n]+)/[gimsuy]*""")

# Solo se acepta el cuerpo de la regex si es TEXTO LLANO. `/Ir al Directorio/`
# lo es; `/^\d+ (resultados?)$/` no, y de ahi no se puede sacar un nombre que
# comparar contra la tarea sin inventarselo. Un guardia que grita en falso se
# desactiva en una semana (F-003), asi que lo que no se entiende se calla.
_TEXTO_LLANO = re.compile(r"^[\w ÁÉÍÓÚÜÑáéíóúüñÀ-ÿ'’·.,!?¿¡:-]+$")

# ⚠ Los roles que NO salen gratis del HTML. `button`, `heading`, `listitem`,
# `table`, `checkbox`... los da el elemento y el Coder los acierta sin que nadie
# se los diga. Estos hay que **escribirlos** con un `role=`, y si la tarea no lo
# pide, el Coder pinta un `<p>` con el mensaje correcto y el test no lo encuentra.
#
# El guardia nacio sin esto y se le escapo a la primera: `Messages.test.tsx`
# hace `findByRole('alert')` SIN `name`, asi que el patron de nombres accesibles
# ni lo miraba. Es el sexto caso del mismo patron -- y el primero que se le cuela
# al propio guardia.
_ROLES_QUE_HAY_QUE_PONER = {
    "alert", "alertdialog", "status", "progressbar", "dialog", "tablist",
    "tab", "tabpanel", "tooltip", "log", "marquee", "timer", "region",
}

# ⚠ Y LA OTRA MITAD, QUE ES F-131: los roles que el elemento da GRATIS y que un
# `role=` encima **BORRA**. El comentario de arriba dice que `listitem` «lo da el
# elemento y el Coder lo acierta sin que nadie se lo diga», y eso es falso en
# cuanto el Coder escribe un `role` encima: un rol explicito no se SUMA al
# implicito, lo SUSTITUYE. En la corrida 08 el Coder hizo la fila pulsable con
# `<li role="button">` —la lista se pintaba perfecta— y se llevo NUEVE pruebas de
# 34 por delante: ocho por `Unable to find role="listitem"` y una novena por
# `Found multiple elements with the role "button"`, porque el `<li>` pisado pasa
# a ser un segundo boton con el mismo nombre accesible que el de dentro.
#
# No entra aqui cualquier rol implicito. Entran los **estructurales**: los que
# viven en un contenedor al que se le puede atornillar interactividad encima
# —una fila, una celda, una cabecera de columna—. `button`, `textbox`, `link` o
# `checkbox` no entran: nadie escribe `role="button"` sobre un `<button>`, y
# meterlos convertiria esto en un aviso en las seis tareas, o sea en ruido.
# Medido antes de encenderlo: con esta lista salta en 5 sitios de 6 tareas
# —`listitem` en MSG-01, `row`/`columnheader` en SRCH-01, `table`/`columnheader`
# en VND-01—; con todos los implicitos serian 17. La proporcion es la de F-130 y
# la decision la misma: **aviso, no error.**
_ROLES_ESTRUCTURALES = {
    "listitem", "list", "row", "rowgroup", "table", "grid", "cell",
    "gridcell", "columnheader", "rowheader", "article",
}
_ROL = re.compile(
    r"""(?:getBy|findBy|queryBy|getAllBy|findAllBy)Role\(\s*['"](\w+)['"]""")


def _pide_el_contrato(rutas: list) -> tuple:
    """Lo que el Coder TIENE que llamar, y con que nombre se le busca en pantalla.

    ⚠ La primera mitad no son "los modulos que el test importa", y la diferencia
    importa: `Messages.test.tsx` mockea `lib/realtime` **solo para que no se abra
    un websocket de verdad**, y de ahi no se sigue que el Coder deba usarlo. Lo
    que si obliga es un espia sobre el que se ASERTA: si el contrato dice
    `expect(sendInquiries).toHaveBeenCalledWith(...)`, la pantalla tiene que
    llamar a `sendInquiries`, y entonces la tarea esta obligada a nombrarlo."""
    exigidos, nombres, roles, porregex = set(), set(), set(), set()
    for ruta in rutas:
        f = ROOT / ruta
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        exigidos |= set(_ESPIA.findall(txt)) & set(_ASERTADO.findall(txt))
        nombres |= set(_NOMBRE.findall(txt))
        # F-130 · y los buscados por regex, siempre que sean texto llano.
        porregex |= {n.strip() for n in _NOMBRE_REGEX.findall(txt)
                     if _TEXTO_LLANO.match(n.strip())}
        # ⚠ Sin filtrar. Antes de F-131 aqui se intersecaba ya con
        # `_ROLES_QUE_HAY_QUE_PONER` y el resto se tiraba en el sitio donde
        # todavia se sabia que existia; los estructurales se perdian aqui, tres
        # lineas antes de que nadie pudiera preguntar por ellos. Filtra quien
        # decide, no quien lee.
        roles |= set(_ROL.findall(txt))
    return exigidos, nombres, roles, porregex


def _declarado(nombre: str, tarea: str) -> bool:
    """Un nombre cuenta como declarado si esta entero, o si lo esta la PLANTILLA
    de la que sale: la tarea dice `Quitar filtro <etiqueta>` y el contrato busca
    `Quitar filtro Marca`. Se recorta por palabras y nunca por debajo de dos, que
    es donde un prefijo dejaria de significar nada."""
    palabras = nombre.split()
    for corte in range(len(palabras), 1, -1):
        if " ".join(palabras[:corte]) in tarea:
            return True
    return nombre in tarea


def cruzar_con_el_contrato(task: dict) -> tuple:
    """Devuelve (errores, avisos).

    **Errores** salen solo de los contratos de UNIDAD, que ejercitan unicamente
    los componentes del Coder: si ahi se busca algo que la tarea no declara, el
    Coder no tiene forma de acertar y la corrida esta perdida antes de empezar.

    **Avisos** salen del e2e, que atraviesa la aplicacion entera: ahi un nombre
    sin declarar puede ser del shell -`'Comprando'` lo es- y no del Coder. Se
    dicen, no se bloquean: un guardia que bloquea por algo que no es del Coder se
    desactiva a la semana."""
    # ⚠ Contra TODO LO QUE EL CODER RECIBE, no solo contra el JSON de la tarea.
    # La spec y el HTML aprobado son inputs suyos y llevan los literales visibles;
    # la capa de datos lleva los nombres de funcion. Mirar solo el JSON daba
    # cuatro falsos positivos de seis en SRCH-01 -'Seleccionar todos',
    # 'Reintentar'... estaban en la spec-, y un guardia que grita en falso mas de
    # lo que acierta se desactiva en una semana.
    piezas = [json.dumps(task, ensure_ascii=False)]
    for clave, valor in (task.get("inputs") or {}).items():
        if clave.startswith("_") or clave == "design_system":
            continue
        for ruta in (valor if isinstance(valor, list) else [valor]):
            f = ROOT / str(ruta)
            if f.is_file():
                piezas.append(f.read_text(encoding="utf-8", errors="replace"))
    declarado = "\n".join(piezas)
    acc = task.get("acceptance") or {}
    errores, avisos = [], []

    exig_u, nombres_u, roles_u, regex_u = _pide_el_contrato(acc.get("unit") or [])
    # ⚠ AVISO Y NO ERROR, y la razon es una medida, no una preferencia: `VND-01`
    # tampoco declara `role="alert"` y **sale VERDE** — el Coder lo eligio solo,
    # porque para un mensaje de error es lo idiomatico. En `MSG-01` no lo eligio
    # y le costo la corrida. O sea: es una omision real que a veces se sobrevive,
    # y bloquear por ella pararia una tarea que demostrablemente funciona. El
    # guardia lo dice antes de gastar, que es su trabajo; decidir es de quien lee.
    for r in sorted(roles_u & _ROLES_QUE_HAY_QUE_PONER):
        if f'role="{r}"' not in declarado and f"`{r}`" not in declarado:
            avisos.append(
                f"el contrato de unidad busca `getByRole({r!r})` y la tarea no pide "
                f"ese rol: `{r}` NO sale gratis del HTML, hay que escribir "
                f"`role=\"{r}\"`. Sin decirlo el Coder puede pintar el mensaje "
                f"correcto en un elemento que el test no encuentra — le paso a "
                f"MSG-01; VND-01 lo acerto solo")
    # ⚠ F-131 · y el simetrico: los roles que NO hay que escribir, pero que hay
    # que NO PISAR. El bucle de arriba pregunta «¿la tarea pide este rol?»; este
    # pregunta «¿la tarea dice que este rol tiene que sobrevivir?», y son cosas
    # distintas. El guardia de ayer solo sabia hacer la primera, y por eso
    # descartaba `listitem` —«lo da el elemento»— justo en la corrida donde el
    # Coder se lo cargo. Cuarta vez que este guardia es una muesca mas estrecho
    # que el contrato (F-127, F-130, F-131): cada version cubre las formas de
    # aserto que habia delante, no las que hay.
    for r in sorted(roles_u & _ROLES_ESTRUCTURALES):
        if f'role="{r}"' not in declarado and f"`{r}`" not in declarado:
            avisos.append(
                f"el contrato de unidad consulta el rol `{r}`, que el elemento da "
                f"GRATIS, y la tarea no dice en ningun sitio que haya que "
                f"CONSERVARLO. Un `role=` explicito no se suma al implicito: lo "
                f"SUSTITUYE, y en cuanto el Coder hace pulsable ese contenedor con "
                f"un `role` encima, el rol `{r}` desaparece con la pantalla pintada "
                f"correctamente (F-131). El patron es un boton DENTRO, no un `role` "
                f"encima. Declaralo antes de pagar la corrida")
    # ⚠ F-130 · los buscados por REGEX van a AVISO y no a error, y otra vez es una
    # medida y no una preferencia. Al encenderlo salieron siete nombres nuevos en
    # tareas MEDIDAS: `'22316-E'` en VND-01 y `'afina'`, `'te avisaremos'` y
    # `'caduca en 30 dias'` en SRCH-01 — y las dos han salido VERDES con esos
    # nombres sin declarar. No son nombres que el Coder invente: son fragmentos de
    # frase, o datos del fixture, buscados con un `/trozo/i` que casa DENTRO de un
    # texto mas largo. Un literal entrecomillado dice "esto se llama asi"; una
    # regex parcial dice "esto aparece por aqui", y no es lo mismo.
    #
    # De los siete, uno era de verdad —`'fuera del MVP'`, la segunda mitad de
    # F-128— y ese es el que justifica que el guardia mire aqui. Bloquear con esta
    # precision pararia tres tareas que funcionan para cazar una que no; decirlo
    # antes de gastar cuesta cero y lo lee quien decide.
    for n in sorted(regex_u - nombres_u):
        if not _declarado(n, declarado):
            avisos.append(
                f"el contrato de unidad busca {n!r} con una EXPRESION REGULAR y la "
                f"tarea no lo declara. Puede ser un fragmento de frase o un dato "
                f"del fixture —y entonces no es cosa del Coder—, o puede ser un "
                f"literal que hay que pintar y nadie ha pedido (F-128, F-130). "
                f"Miralo antes de pagar la corrida")
    for x in sorted(exig_u):
        if x not in declarado:
            errores.append(
                f"el contrato de unidad ASERTA sobre `{x}`, o sea que la pantalla "
                f"tiene que llamarlo, y la tarea no lo nombra. F-057: pedir que se "
                f"llame a algo sin enseñarlo no es una prueba del Coder, es una "
                f"adivinanza (F-126)")
    for n in sorted(nombres_u):
        if not _declarado(n, declarado):
            errores.append(
                f"el contrato de unidad busca el nombre accesible {n!r} y la tarea "
                f"no lo declara: el Coder elegira otro, legitimamente (F-125)")

    exig_e, nombres_e, _roles_e, regex_e = _pide_el_contrato(acc.get("e2e") or [])
    nombres_e = nombres_e | regex_e      # el e2e ya va entero a avisos
    for x in sorted(exig_e - exig_u):
        if x not in declarado:
            avisos.append(f"el e2e aserta sobre `{x}`, sin declarar")
    for n in sorted(nombres_e - nombres_u):
        if not _declarado(n, declarado):
            avisos.append(f"el e2e busca {n!r}, sin declarar "
                          f"(¿es del shell, como 'Comprando'?)")

    # ⚠ F-134 · las exclusiones del e2e se dicen EN ALTO antes de gastar, siempre.
    # Son lo unico de la tarea que hace a C2 mas indulgente, asi que nunca pueden
    # estar solo en el JSON: quien paga la corrida las lee primero y decide si
    # siguen valiendo. Que caduquen sin que nadie mire es como esto se pudre.
    for d in (acc.get("e2e_fuera_de_contrato") or []):
        if isinstance(d, dict) and d.get("test"):
            avisos.append(
                f"C2 NO le apuntara al Coder el fallo e2e {d['test']!r} — la tarea "
                f"lo excusa: {d.get('motivo') or '(sin motivo)'}. La suite se "
                f"correra entera igual. Si esto ya no es cierto, quitalo (F-134)")
    return errores, avisos


def run_dry(task=None) -> int:
    if task is not None:
        problemas = validar_tarea(task)
        errores, avisos = cruzar_con_el_contrato(task)
        problemas += errores
        if problemas:
            print(f"TAREA INVALIDA ({task.get('task_id', '?')}): "
                  f"{len(problemas)} problema(s)\n")
            for p in problemas:
                print(f"  - {p}")
            print("\nNo se ha llamado al grafo. Corrige la tarea antes de gastar "
                  "un token.")
            return 1
        for a in avisos:
            print(f"  aviso: {a}")
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
