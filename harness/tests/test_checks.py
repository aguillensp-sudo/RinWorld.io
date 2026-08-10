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
import json
import pathlib
import sys

from ..core import metrics, parse, pricing
from ..graph.checks import check_idiomatic, check_palette, read_tokens
from ..graph.nodes.coder import build_system
from ..graph.nodes.test_runner import resolve, run_cmd

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
    # 18688 hit + 79 miss + 12563 out -> 0.003581, y en frio 0.006145.
    real = pricing.cost_usd(18688, 79, 12563)
    frio = pricing.cost_usd_cold(18767, 12563)
    check("reproduce el coste real de SP-1", round(real, 6) == 0.003581, round(real, 6))
    check("reproduce el equivalente en frio de SP-1",
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


def main() -> int:
    test_palette()
    test_idiomatic()
    test_metrics()
    test_pricing_guard()
    test_parse()
    test_toolchain()
    test_prompt_inputs()
    print()
    if fallos:
        print(f"FALLAN {len(fallos)}: {', '.join(fallos)}")
        return 1
    print("Todas en verde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
