"""Pruebas de las piezas puras del Test-runner. Sin red y sin coste.

Sin npm tampoco, salvo `test_toolchain`, que arranca `npm --version` a proposito:
"sin npm" era justo el agujero por el que se colo el fallo del dia 5.

La mitad de estas pruebas no comprueban que el check **cace** un fallo: comprueban
que **no rechace output correcto**. Es la leccion de F-003, donde el criterio C3
tal como estaba redactado habria dado rojo a un `#ef4444` que era exactamente el
color que tocaba. Un check injusto es peor que no tener check: envenena la metrica
de intentos hasta verde, que es la que decide si el arnes es viable (`Plan §11`).

Uso:  python -m harness.tests.test_checks
"""
import datetime
import json
import pathlib
import sys

from ..core import metrics, parse, pricing
from ..graph.checks import check_idiomatic, check_palette, read_tokens
from ..graph.nodes.coder import build_messages, build_system
from ..graph.nodes.test_runner import (
    _check_c1, _check_c2, _finish, resolve, run_cmd, strip_ansi,
)

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOKENS = read_tokens(
    (ROOT / "app" / "src" / "styles" / "tokens.css").read_text(encoding="utf-8"))
DEPS = {"react", "react-dom", "@supabase/supabase-js"}

fallos = []


def check(nombre, condicion, detalle=""):
    if condicion:
        print(f"  ok   {nombre}")
    else:
        print(f"  FALLA {nombre}  {detalle}")
        fallos.append(nombre)


# ---------------------------------------------------------------- C3 · paleta

def test_palette():
    print("\nC3 · paleta")

    bueno = {"a.module.css": ".x { color: var(--bw-steel-mist); }"}
    check("no rechaza CSS que solo usa tokens", check_palette(bueno, TOKENS)["ok"])

    # F-003 en una linea: el valor es correcto, la forma no. El detalle tiene que
    # decir QUE token usar, porque ese detalle es el feedback del reintento.
    r = check_palette({"a.module.css": ".x { color: #6B7A99; }"}, TOKENS)
    check("caza un hex aunque el valor sea el bueno", not r["ok"])
    check("y dice que token usar en su lugar", "--bw-steel-mist" in r["detail"],
          r["detail"])

    r = check_palette({"a.module.css": ".x { color: #123456; }"}, TOKENS)
    check("caza un hex inventado", not r["ok"])
    check("y dice que no esta en tokens.css", "no esta en tokens.css" in r["detail"])

    r = check_palette({"a.tsx": "const s = { color: 'rgba(1,2,3,.5)' };"}, TOKENS)
    check("caza rgba() en un .tsx", not r["ok"])

    # Un hex dentro de un comentario no es un color aplicado. Rechazarlo seria
    # exactamente el falso rojo que F-003 nos costo un dia entender.
    r = check_palette({"a.module.css": "/* antes era #6B7A99 */\n.x { color: var(--bw-ink); }"},
                      TOKENS)
    check("ignora un hex dentro de un comentario", r["ok"], r["detail"])

    r = check_palette({"README.md": "el azul es #2563EB"}, TOKENS)
    check("no mira ficheros que no son codigo", r["ok"])


# ------------------------------------------------------------ C4 · idiomatico

OUTPUTS = ["app/src/screens/messages/ThreadList.tsx"]


def test_idiomatic():
    print("\nC4 · React idiomatico")

    bueno = {OUTPUTS[0]: (
        "import { useState } from 'react';\n"
        "import styles from './ThreadList.module.css';\n"
        "export interface Props { threads: string[] }\n"
        "export function ThreadList({ threads }: Props) { return <ul/>; }\n"
    )}
    r = check_idiomatic(bueno, OUTPUTS, DEPS)
    check("no rechaza un componente bien escrito", r["ok"], r["detail"])

    r = check_idiomatic({OUTPUTS[0]: "export function X({a}: any) {}"}, OUTPUTS, DEPS)
    check("caza el tipo any", not r["ok"])

    r = check_idiomatic({OUTPUTS[0]: "const x = <div dangerouslySetInnerHTML={h}/>;"},
                        OUTPUTS, DEPS)
    check("caza dangerouslySetInnerHTML", not r["ok"])

    r = check_idiomatic({OUTPUTS[0]: "import dayjs from 'dayjs';"}, OUTPUTS, DEPS)
    check("caza una dependencia nueva", not r["ok"])
    check("y la nombra", "dayjs" in r["detail"], r["detail"])

    r = check_idiomatic({OUTPUTS[0]: "import { createClient } from '@supabase/supabase-js';"},
                        OUTPUTS, DEPS)
    check("no confunde un paquete con arroba ya instalado", r["ok"], r["detail"])

    # F-025: el shell tiene contrato propio desde el dia 2. Si el Coder lo toca,
    # es rojo aqui — no se descubre en la revision visual tres pantallas despues.
    r = check_idiomatic({"app/src/shell/AppShell.tsx": "x"}, OUTPUTS, DEPS)
    check("caza un fichero fuera de los declarados", not r["ok"])
    check("y explica que el shell no se toca", "no declarado" in r["detail"])

    r = check_idiomatic({OUTPUTS[0]: "export function Badge(props) { return null; }"},
                        OUTPUTS, DEPS)
    check("caza props sin tipar", not r["ok"], r["detail"])

    # El falso rojo del dia 5, y el que mas caro sale: un valor por defecto con
    # parentesis cortaba la captura de parametros antes de la anotacion de tipo.
    # `ThreadList` estaba tipado y C4 lo suspendio en los tres intentos.
    con_defecto = {OUTPUTS[0]: (
        "export interface Props { threads: string[]; now?: Date }\n"
        "export function ThreadList({\n"
        "  threads,\n"
        "  now = new Date(),\n"
        "}: Props) { return <ul/>; }\n"
    )}
    r = check_idiomatic(con_defecto, OUTPUTS, DEPS)
    check("no suspende un componente tipado con defecto entre parentesis",
          r["ok"], r["detail"])

    r = check_idiomatic({OUTPUTS[0]: "const Row = ({ id = f() }) => null;"}, OUTPUTS, DEPS)
    check("y sigue cazando el mismo caso sin tipar", not r["ok"], r["detail"])

    # `const X = (algo)` no es un componente: sin `=>` detras no se juzga.
    r = check_idiomatic({OUTPUTS[0]: "const Total = (a + b);"}, OUTPUTS, DEPS)
    check("no confunde un parentesis cualquiera con un componente", r["ok"], r["detail"])


# -------------------------------------------------------- coste y fila del CSV

def test_metrics():
    print("\nCoste y CSV")

    # La aritmetica de F-011 con los numeros reales de SP-1, que estan en el CSV:
    # 18688 hit + 79 miss + 12563 out -> 0.003581, y en frio 0.006145. SP-1 se
    # pago con la tabla vieja (deepseek-chat), asi que la prueba fija esa tabla a
    # proposito en vez de heredar los defectos del modulo — si no, cada vez que
    # se actualice la tarifa vigente esta prueba historica se rompe sin motivo.
    old = (pricing.PRICE_IN_HIT, pricing.PRICE_IN_MISS, pricing.PRICE_OUT)
    pricing.PRICE_IN_HIT, pricing.PRICE_IN_MISS, pricing.PRICE_OUT = 0.0028, 0.14, 0.28
    try:
        real = pricing.cost_usd(18688, 79, 12563)
        frio = pricing.cost_usd_cold(18767, 12563)
    finally:
        pricing.PRICE_IN_HIT, pricing.PRICE_IN_MISS, pricing.PRICE_OUT = old
    check("reproduce el coste real de SP-1 con la tabla de entonces",
          round(real, 6) == 0.003581, round(real, 6))
    check("reproduce el equivalente en frio de SP-1 con la tabla de entonces",
          round(frio, 6) == 0.006145, round(frio, 6))
    check("y el cache hit del 99.58%", pricing.cache_hit_pct(18688, 18767) == 99.58)

    acc = {"tokens_in": 100, "tokens_out": 50, "cache_hit": 0, "cache_miss": 100,
           "calls": 1}
    rec = metrics.build_record(
        task_id="T", screen="MSG-01", model="m", attempt=1, acc=acc, seconds=60.0,
        finish_reason="stop", truncated_at=[], files=["b.tsx", "a.tsx"])
    check("el JSON trae cache_hit_pct como campo propio", "cache_hit_pct" in rec)
    check("y el equivalente en frio", "cost_usd_cold_equivalent" in rec)
    check("los ficheros van ordenados", rec["files"] == ["a.tsx", "b.tsx"])

    fila = metrics.csv_row(rec, "PASA")
    check("la fila tiene tantas columnas como la cabecera",
          len(fila) == len(metrics.COLUMNS), f"{len(fila)} vs {len(metrics.COLUMNS)}")
    check("el coste de la fila sale del JSON, no se recalcula",
          fila[metrics.COLUMNS.index("coste_usd")] == f"{rec['cost_usd']:.6f}")
    check("los ficheros multiples van con ';'",
          fila[metrics.COLUMNS.index("ficheros")] == "a.tsx;b.tsx")

    # CLAUDE.md §6: ningun valor lleva coma. Una coma colada rompe tambien las
    # tres filas historicas, asi que se peta al escribir, no al leer.
    rec_malo = dict(rec, task="tarea, con coma")
    try:
        metrics._assert_no_commas(metrics.csv_row(rec_malo, "PASA"))
        check("peta si un valor lleva coma", False, "no peto")
    except metrics.CsvContractError:
        check("peta si un valor lleva coma", True)


def test_pricing_guard():
    print("\nF-010 · guardia de la tabla de precios")
    original = pricing.PRICE_OUT
    pricing.PRICE_OUT = 0.0
    try:
        pricing.check_prices()
        check("peta si un precio esta a cero", False, "no peto")
    except pricing.PriceTableError as e:
        check("peta si un precio esta a cero", True)
        check("y nombra el hallazgo", "F-010" in str(e))
    finally:
        pricing.PRICE_OUT = original


def test_pricing_date_guard():
    print("\nF-010 (una vuelta mas arriba) · caducidad de la tabla de precios")
    original = pricing.PRICE_TABLE_DATE
    try:
        pricing.PRICE_TABLE_DATE = str(
            datetime.date.today() - datetime.timedelta(days=100))
        aviso = pricing.check_prices()
        check("avisa (no peta) con una tabla de 100 dias", aviso is not None)
        check("el aviso nombra el hallazgo", bool(aviso) and "F-010" in aviso)

        pricing.PRICE_TABLE_DATE = str(
            datetime.date.today() - datetime.timedelta(days=10))
        check("no avisa con una tabla de 10 dias",
              pricing.check_prices() is None)
    finally:
        pricing.PRICE_TABLE_DATE = original


def test_parse():
    print("\nParseo de la respuesta del modelo")
    texto = ("bla\n===FILE: a.tsx===\n```tsx\nconst a = 1;\n```\n===ENDFILE===\n"
             "===FILE: b.css===\n.x{}\n===ENDFILE===")
    files = parse.parse_files(texto)
    check("saca los dos ficheros", sorted(files) == ["a.tsx", "b.css"])
    check("y quita la valla de markdown", files["a.tsx"] == "const a = 1;",
          repr(files["a.tsx"]))
    check("sin bloques, diccionario vacio", parse.parse_files("nada") == {})


def test_toolchain():
    """La unica prueba de este fichero que arranca un proceso, y esta aqui porque
    su ausencia costo la corrida del dia 5: `npm` en Windows es `npm.CMD`,
    `subprocess` con `shell=False` no aplica PATHEXT y los tres intentos se
    pagaron con C1 y C2 en rojo sin haber ejecutado un solo test."""
    print("\nCadena de herramientas de C1 y C2")

    check("resuelve npm a un ejecutable real", resolve("npm") != "npm", resolve("npm"))
    check("y deja en paz lo que no encuentra",
          resolve("estonoexiste-bw") == "estonoexiste-bw")

    code, out = run_cmd(["npm", "--version"], ROOT)
    check("npm --version corre desde el Test-runner", code == 0, out.strip()[:80])

    code, _ = run_cmd(["npx", "--version"], ROOT)
    check("npx --version tambien", code == 0)

    # La salida de vitest lleva ticks y diacriticos. Decodificada con cp1252, el
    # hilo lector de subprocess revienta, la salida se pierde y C2 queda ROJO sin
    # detalle: el feedback que vuelve al Coder es una cabecera vacia.
    code, out = run_cmd(["node", "-e", "console.log('\\u2713 Nordw\\u00e4lz L\\u0142')"], ROOT)
    check("la salida en UTF-8 sobrevive", code == 0 and "Nordwälz" in out, repr(out))


def test_c2_paths():
    """Las rutas que C2 le pasa a vitest y a Playwright existen desde `app/`.

    Segunda vez en el mismo dia que un check se reporta ROJO sin haberse
    ejecutado: la tarea declara los tests con ruta de repo (`app/src/...`) y los
    dos procesos arrancan con `cwd=app/`, asi que vitest respondia "No test files
    found" y salia con 1. La rama del e2e lo hacia bien desde el dia 4 y la de
    unidad no, de modo que C2 no se habia ejecutado nunca.

    ⚠ **Los dos procesos ya no quieren lo mismo, y esta prueba llevaba desde el
    12-ago exigiendoselo a los dos.** `D-09-03(a)`, decidido por el PO ese dia,
    manda que Playwright corra la suite e2e ENTERA y sin rutas: LOGIN-01 salio
    4/4 verde colgando la suite completa porque su tarea no declaraba e2e y esa
    rama no se ejecutaba (F-070). El bucle de aqui pedia rutas a los dos, asi que
    esta prueba fallaba **siempre** desde el mismo dia de la decision — no se
    actualizo con ella, y una suite con un rojo fijo no avisa del siguiente.
    Ahora cada proceso se comprueba contra lo que se decidio para el: vitest con
    las rutas declaradas, Playwright sin ninguna."""
    print("\nC2 · las rutas llegan bien a los dos procesos")

    task = json.loads((ROOT / "harness" / "tasks" / "MSG-01.json").read_text(encoding="utf-8"))
    vistos = []

    def espia(cmd, cwd):
        vistos.append((cmd, cwd))
        return 0, ""

    _check_c2(task, espia)
    check("C2 lanza los dos procesos", len(vistos) == 2, vistos)

    por_programa = {cmd[1]: (cmd, cwd) for cmd, cwd in vistos}

    cmd, cwd = por_programa["vitest"]
    rutas = [a for a in cmd if a.endswith((".ts", ".tsx"))]
    check("`vitest` recibe las rutas declaradas y no cero",
          len(rutas) == len(task["acceptance"]["unit"]), cmd)
    for r in rutas:
        check(f"{r} existe desde {cwd.name}", (cwd / r).exists(), str(cwd / r))

    # La otra mitad de F-070: que nadie devuelva el e2e a correr por rutas.
    cmd, _ = por_programa["playwright"]
    check("⚠ `playwright` NO recibe rutas: corre la suite entera (D-09-03(a))",
          not [a for a in cmd if a.endswith((".ts", ".tsx"))], cmd)


def test_prompt_inputs():
    """Todo input declarado en la tarea tiene que llegar al prompt.

    El dia 5, `data_layer` estaba en el JSON de la tarea con una nota que decia
    *"el Coder los importa, no los reescribe"* — y `build_system` no lo leia. El
    Coder reinvento `ThreadSummary` entera porque nunca la vio. Un input declarado
    y no entregado es una adivinanza disfrazada de contrato, y ninguno de los
    cuatro checks lo puede detectar: castigan al Coder por no usar lo que no
    recibio."""
    print("\nEl prompt entrega todos los inputs declarados")

    task = json.loads((ROOT / "harness" / "tasks" / "MSG-01.json").read_text(encoding="utf-8"))
    system = build_system(task)

    for clave, valor in task["inputs"].items():
        if clave.startswith("_") or not isinstance(valor, str):
            continue
        firma = (ROOT / valor).read_text(encoding="utf-8").strip()[:200]
        check(f"el prompt lleva `{clave}`", firma in system, valor)

    # Y el API publico, que es la desviacion del dia 5 sobre el formato: si se
    # declara y no se entrega, el Coder vuelve a adivinar los nombres de prop.
    for ruta, firma in (task.get("component_api") or {}).items():
        if ruta.startswith("_"):
            continue
        check(f"el prompt lleva el API de {pathlib.PurePosixPath(ruta).name}",
              firma in system, ruta)


def test_ansi_no_llega_al_modelo():
    """F-068 · ni un codigo de color en lo que se le manda al Coder.

    ⚠ **El caso que importa es el de EN MEDIO: la secuencia SIN su ESC delante.**
    La salida de vitest llegaba con el byte 0x1B ya perdido y el resto intacto
    —`[36m`, `[1m`, `[0m`—, asi que un patron `\\x1b\\[[0-9;]*m` de manual la
    dejaba pasar entera. Medido: 72 secuencias en el feedback del intento 1 de
    VND-01 y 70 en el del 2.

    Y no era cosmetico. El intento 3 escribio `import type { SentOffer, [1m, [0m
    } from '...'` y el fichero dejo de parsear: **el intento 3 salio peor que el
    1**, que solo tenia errores de tipo.

    La tercera comprobacion es la que hace que esta prueba valga: **un texto
    normal no se toca**. Un limpiador que se coma corchetes legitimos romperia
    los mensajes de `tsc`, que van llenos de `Type '...'` y de indices."""
    print("\nF-068 · el feedback no lleva codigos de color")

    con_esc = "\x1b[36mFAIL\x1b[39m src/App.tsx"
    sin_esc = "[36mFAIL[39m src/App.tsx"          # el caso real, y el que se colaba
    limpio = "src/App.tsx(1,53): error TS1003: Identifier expected."

    check("limpia la secuencia con ESC", strip_ansi(con_esc) == "FAIL src/App.tsx",
          strip_ansi(con_esc))
    check("⚠ limpia la secuencia SIN ESC, que es la que llegaba de verdad",
          strip_ansi(sin_esc) == "FAIL src/App.tsx", strip_ansi(sin_esc))
    check("no toca un texto sin color", strip_ansi(limpio) == limpio, strip_ansi(limpio))

    # El caso exacto que rompio VND-01, de punta a punta.
    roto = "import type { SentOffer, SortColumn, [1m, [0m } from './x';"
    check("el import de VND-01 sale sin los codigos",
          "[1m" not in strip_ansi(roto) and "[0m" not in strip_ansi(roto))

    # Y la frontera: `_finish` es lo ultimo antes del modelo.
    salida = _finish({"attempt": 1},
                     [{"id": "C1", "ok": False, "detail": sin_esc}])
    check("y el feedback que sale del nodo tampoco los lleva",
          "[36m" not in salida["feedback"] and "[39m" not in salida["feedback"],
          salida["feedback"])


def test_reintento_ensena_el_artefacto():
    """F-064 · el reintento tiene que enseñarle al Coder el codigo que escribio.

    Hasta el 12-ago el reintento se armaba con DOS mensajes —la tarea, identica a
    la del intento 1, y la salida cruda de los checks— **sin un turno de asistente
    con el artefacto anterior**. Al modelo se le mandaba
    `ThreadHistory.tsx(136,61): error TS2375` sobre un fichero que no estaba
    viendo, y se le pedia regenerar los ocho desde cero.

    Tres conclusiones sobre el modelo se midieron asi: F-036, la corrida 2 de
    SRCH-01 y la mitad de F-059.

    Las dos comprobaciones van juntas a proposito: **en el intento 1 NO puede
    haber turno de asistente**. Si lo hubiera, el primer intento dejaria de ser
    una pagina en blanco y la corrida no mediria lo que dice medir."""
    print("\nF-064 · el reintento lleva el artefacto anterior")

    task = json.loads((ROOT / "harness" / "tasks" / "MSG-01.json").read_text(encoding="utf-8"))
    anterior = {"app/src/screens/messages/ThreadList.tsx": "export function X() { return null; }"}

    primero = build_messages(task, files={}, feedback="")
    check("el intento 1 va sin turno de asistente",
          [m["role"] for m in primero] == ["system", "user"],
          str([m["role"] for m in primero]))

    reintento = build_messages(task, files=anterior, feedback="### C1 ROJO\nerror TS2322")
    roles = [m["role"] for m in reintento]
    check("⚠ el reintento SI lo lleva", roles == ["system", "assistant", "user"], str(roles))

    asistente = next(m["content"] for m in reintento if m["role"] == "assistant")
    check("y lleva el contenido del fichero, no solo su ruta",
          "export function X()" in asistente)
    check("en el mismo formato ===FILE:=== que se le exige de salida",
          "===FILE: app/src/screens/messages/ThreadList.tsx===" in asistente
          and "===ENDFILE===" in asistente)

    usuario = next(m["content"] for m in reintento if m["role"] == "user")
    check("y el feedback sigue yendo crudo en el turno de usuario",
          "error TS2322" in usuario)


def test_metricas_guardan_el_artefacto():
    """B-010 · el JSON del intento guarda el CONTENIDO, no solo las rutas.

    Sin esto solo sobrevive en disco el artefacto del ultimo intento, que en una
    corrida escalada es el peor de los tres. El 12-ago costo no poder leer el
    intento 1 de VND-01 despues de haberlo pagado — y era el unico que el bucle
    roto no distorsionaba."""
    print("\nB-010 · el JSON del intento guarda el artefacto")

    acc = {"tokens_in": 100, "tokens_out": 50, "cache_hit": 0, "cache_miss": 100, "calls": 1}
    rec = metrics.build_record(
        task_id="T", screen="T", model="m", attempt=1, acc=acc, seconds=1.0,
        finish_reason="stop", truncated_at=None,
        files=["a.tsx"], sources={"a.tsx": "contenido real"})

    check("`files` sigue siendo la lista de rutas (es lo que va al CSV)",
          rec["files"] == ["a.tsx"], str(rec["files"]))
    check("⚠ y `sources` lleva el contenido",
          rec["sources"] == {"a.tsx": "contenido real"}, str(rec.get("sources")))


def test_estado_de_check():
    """F-033 · `rojo` e `inejecutable` dejan de ser la misma casilla.

    Los dos casos de abajo son REALES y estan guardados en
    `harness/metrics/MSG-01/`. En el CSV del dia 5 se escribieron identicos:

      corrida-01 · `npm run typecheck (exit 127)` — npm fuera del PATH
      corrida-02 · `vitest (exit 1)` + "No test files found" — rutas sin rebajar

    En ninguno de los dos el arnes miro el artefacto, y los dos se leian como
    "el Coder fallo". El tercero es un fallo de verdad y tiene que seguir
    contando como tal.

    ⚠ El de en medio es el que justifica que esto no se deduzca del codigo de
    salida: sale con **1**, igual que un test que falla de verdad."""
    print("\nF-033 · rojo e inejecutable no son lo mismo")

    def runner_fijo(code, out):
        return lambda cmd, cwd: (code, out)

    c1 = _check_c1(runner_fijo(127, "'npm' no se reconoce como un comando"))
    check("npm fuera del PATH -> INEJECUTABLE", c1["estado"] == "inejecutable", c1["estado"])
    check("y sigue contando como fallo para decidir (F-015)", c1["ok"] is False)

    task = {"acceptance": {"unit": ["app/src/screens/messages/ThreadList.test.tsx"]}}
    c2 = _check_c2(task, runner_fijo(1, "No test files found, exiting with code 1"))
    check("⚠ 'No test files found' con exit 1 -> INEJECUTABLE",
          c2["estado"] == "inejecutable", c2["estado"])

    c2b = _check_c2(task, runner_fijo(1, "FAIL  Thread.test.tsx > expected 2 to be 3"))
    check("un test que falla de verdad -> ROJO", c2b["estado"] == "rojo", c2b["estado"])

    sin_contrato = _check_c2({"acceptance": {}}, runner_fijo(0, ""))
    check("una tarea sin tests declarados -> INEJECUTABLE",
          sin_contrato["estado"] == "inejecutable", sin_contrato["estado"])

    c1v = _check_c1(runner_fijo(0, "ok"))
    check("y lo verde sigue siendo verde", c1v["estado"] == "verde" and c1v["ok"])

    # La columna del CSV y el texto de `resultado`, que es lo que alguien lee.
    checks = [
        {"id": "C1", "ok": False, "estado": "inejecutable", "detail": "exit 127"},
        {"id": "C2", "ok": False, "estado": "rojo", "detail": "falla de verdad"},
        {"id": "C3", "ok": True, "estado": "verde", "detail": ""},
    ]
    check("la columna nueva lista los ciegos",
          metrics.inexecutables(checks) == ["C1"], str(metrics.inexecutables(checks)))

    texto = metrics.resultado_from_checks(checks, escalated=False)
    check("y `resultado` los nombra APARTE de los rojos",
          "INEJECUTABLE: C1" in texto and "rojo: C2" in texto, texto)
    check("un check ciego no se cuenta como rojo del modelo",
          "rojo: C1" not in texto, texto)

    check("`checks_inejecutables` es columna propia del CSV",
          "checks_inejecutables" in metrics.COLUMNS and
          metrics.COLUMNS.index("checks_inejecutables") < metrics.COLUMNS.index("resultado"))


def test_el_feedback_no_esconde_fallos():
    """F-114 · el Coder tiene que enterarse de CUANTOS fallos hay, no solo del ultimo.

    Es la respuesta a F-112, y hasta el 28-ago se leia como un limite del modelo:
    el bucle arreglado (B-008/B-009) sacaba adelante PANEL-01 y VND-01 y no
    SRCH-01 ni MSG-01. La diferencia no estaba en las pantallas — estaba en el
    numero de fallos:

      PANEL-01 · 1 test rojo  -> cabe entero en las 40 lineas -> converge
      VND-01   · 1 de 27      -> cabe entero                  -> converge
      MSG-01   · 6 rojos      -> el recorte solo enseña [4/6], [5/6] y [6/6]
      SRCH-01  · 13 rojos     -> el recorte solo enseña [12/13] y [13/13]

    En SRCH-01 los dos que se veian decian `sendInquiries` llamado **0** veces:
    sintomas de algo que reventaba once fallos mas arriba y que el Coder no vio
    en ninguno de los tres intentos. Un canal de feedback cuyo contenido depende
    del tamaño de la salida no mide al modelo.

    Los dos bloques de abajo son la salida REAL de esa corrida, recuperada de las
    transcripciones porque los JSON por intento se perdieron (F-115)."""
    print("\nF-114 · el feedback lleva el inventario, no solo el recorte")

    def runner_fijo(code, out):
        return lambda cmd, cwd: (code, out)

    # 13 fallos, y las cabeceras de los 11 primeros lejos del final.
    relleno = "\n".join(f"    linea de ruido {i}" for i in range(60))
    vitest = "\n".join([
        " FAIL  src/screens/search/SearchResults.test.tsx > SRCH-01 · carga de datos > busca con mi organizacion",
        relleno,
        " FAIL  src/screens/search/SearchResults.test.tsx > SRCH-01 · Consultar seleccionados > la seleccion se limpia despues de enviar",
        "⎯⎯⎯[12/13]⎯",
        " FAIL  src/screens/search/SearchResults.test.tsx > SRCH-01 · Consultar seleccionados > dos clics seguidos no mandan dos tandas",
        'AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times',
        "⎯⎯⎯[13/13]⎯",
    ])
    task = {"acceptance": {"unit": ["app/src/screens/messages/ThreadList.test.tsx"]}}
    c2 = _check_c2(task, runner_fijo(1, vitest))
    d = c2["detail"]

    check("dice cuantos fallos hay en total", "13 fallo(s) en total" in d, d[:120])
    check("⚠ y nombra el primero, que el recorte de 40 lineas se comia",
          "SRCH-01 · carga de datos" in d)
    check("sin perder el ultimo, que es el que trae el detalle",
          "dos clics seguidos no mandan dos tandas" in d)
    check("ni el detalle en si", "but got 0 times" in d)

    # tsc: el recorte SI funcionaba aqui, y el inventario no puede estropearlo.
    tsc = "\n".join([
        "src/screens/messages/ThreadList.tsx(7,3): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
        relleno,
        "src/screens/messages/ThreadList.tsx(11,3): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
    ])
    c1 = _check_c1(runner_fijo(2, tsc))
    check("con tsc lista los errores de los dos extremos",
          "ThreadList.tsx(7,3)" in c1["detail"] and "ThreadList.tsx(11,3)" in c1["detail"])

    # Y la salida que no reconoce: recorte a secas, sin cabecera que mienta.
    c1x = _check_c1(runner_fijo(2, "algo peto y no se parece a nada conocido"))
    check("una salida irreconocible no se adorna con un inventario vacio",
          "fallo(s) en total" not in c1x["detail"], c1x["detail"])
    check("y el recorte sigue estando", "algo peto" in c1x["detail"])


def main() -> int:
    # ⚠ SIN ESTO, LA SUITE MUERE AL REDIRIGIR SU SALIDA EN WINDOWS, y muere en
    # mitad de una prueba: Python usa la codificacion de la consola —cp1252 aqui—
    # y el primer nombre de prueba con un caracter fuera de ese rango levanta
    # `UnicodeEncodeError`. Lo que se ve entonces es una suite que **se corta sin
    # decir por que**, con las pruebas anteriores en verde y ninguna señal de que
    # falten las siguientes. Es la tercera variante del mismo fallo del proyecto
    # (F-019 en la siembra, F-037 en la clave de Supabase): el veredicto sobrevive
    # y la razon no.
    #
    # En CI no pasaba —Linux va en UTF-8— asi que solo rompia en la maquina donde
    # se desarrolla, que es la peor forma de romper.
    for flujo in (sys.stdout, sys.stderr):
        if hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8", errors="replace")

    test_palette()
    test_idiomatic()
    test_metrics()
    test_pricing_guard()
    test_pricing_date_guard()
    test_parse()
    test_toolchain()
    test_c2_paths()
    test_prompt_inputs()
    test_ansi_no_llega_al_modelo()
    test_reintento_ensena_el_artefacto()
    test_metricas_guardan_el_artefacto()
    test_estado_de_check()
    test_el_feedback_no_esconde_fallos()
    print()
    if fallos:
        print(f"FALLAN {len(fallos)}: {', '.join(fallos)}")
        return 1
    print("Todas en verde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
