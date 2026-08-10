"""Nodo Coder. `deepseek-v4-flash` (`CLAUDE.md` §3, F-001), temperatura 0.

**El prompt se arma con el patron de F-022**, que es lo que hizo que el catalogo
saliera al primer intento — y no fue suerte. Los cuatro elementos, generalizados
de datos a pantalla:

  vocabulario cerrado de product_family -> lista literal de tokens permitidos
  UUID literales                        -> props y tipos copiados, no descritos
  ejemplo de dos filas                  -> InventoryTable.tsx como referencia
  prohibicion de fechas literales       -> prohibiciones explicitas

El principio de los cuatro es el mismo: **cada uno tapa un hueco por el que se
colaria un error silencioso.** El ruidoso lo caza C1; el silencioso llega a la demo.

**El Coder no ve los tests.** No solo no los escribe (`Plan §6`, `CLAUDE.md` §3):
si los ve, escribe para el test, que es la misma degradacion por otra puerta.
"""
import pathlib

from ...core import llm, metrics, parse
from ..state import HarnessState

ROOT = pathlib.Path(__file__).resolve().parents[3]


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def build_system(task: dict) -> str:
    inputs = task["inputs"]
    tokens_css = _read(inputs["tokens"])
    reference = _read(inputs["style_reference"])
    spec = _read(inputs["spec"])
    approved = _read(inputs["approved_html"])

    # La capa de datos que la tarea declara. **Iba en el JSON y no llegaba al
    # prompt**, y ese es el bug del dia 5: la tarea decia "el Coder los importa,
    # no los reescribe" hablando de unos tipos que el Coder no veia por ninguna
    # parte. Reinvento `ThreadSummary` entera, con los cinco estados en
    # `CON_OFERTA_PENDIENTE` en vez de los literales del esquema y un mapa de
    # alias para tapar su propia invencion. Pedir que se importe un fichero sin
    # ensenarlo no es una prueba del Coder: es una adivinanza.
    capa = ""
    if inputs.get("data_layer"):
        capa = f"""## CAPA DE DATOS — YA ESCRITA, SE IMPORTA TAL CUAL

`{inputs['data_layer']}` ya existe en el repo. Sus tipos y su logica pura son la
verdad: se importan. **Declarar un tipo paralelo o reescribir estas funciones es un
fallo del intento**, aunque el resultado parezca equivalente.

```ts
{_read(inputs['data_layer'])}
```

"""

    fuera = "\n".join(f"  - {x}" for x in task.get("out_of_scope", []))
    prohibiciones = "\n".join(f"  - {x}" for x in task.get("constraints", []))
    salidas = "\n".join(f"  - {x}" for x in task["outputs"])

    return f"""Eres el nodo Coder de un arnes de implementacion. Conviertes una pantalla
aprobada de Bearingworld.io en React + TypeScript + CSS Modules.

TAREA: {task['goal']}

## FICHEROS QUE DEBES PRODUCIR (exactamente estos, ni uno mas)

{salidas}

Escribir cualquier otro fichero es un fallo del intento. En particular **no toques el
shell de la aplicacion**: tiene su propio contrato y sus propios tests desde el dia 2.

## VOCABULARIO CERRADO DE COLOR

Todo color sale de una de estas variables CSS. **Ningun hex, ningun rgb(), nunca**,
ni siquiera si el valor es correcto: se escribe `var(--bw-…)`. Si crees que falta un
token, usa el mas cercano y dilo en un comentario; no inventes un valor.

{tokens_css}

## REFERENCIA DE ESTILO DE LA CASA

Asi se escribe un componente en este repo. Copia la forma: tipos de props declarados
arriba, CSS Modules, sin logica de datos dentro del componente de presentacion.

```tsx
{reference}
```

{capa}## PROHIBICIONES EXPLICITAS

{prohibiciones}

## LO QUE EL MOCK PROMETE Y EL MVP NO TIENE

El HTML aprobado es un mock: ensena funciones que no existen. **No las reproduzcas
como si funcionaran.** Un badge verde sobre algo que no hace nada es el riesgo #1 del
proyecto llevado a la interfaz, y ahi engana mas porque parece verificable.

{fuera or "  - (nada declarado para esta pantalla)"}

## SPEC CERRADA — MANDA ESTA, NO EL MOCK

{spec}

## HTML APROBADO — REFERENCIA VISUAL

{approved}

## FORMATO DE SALIDA (obligatorio, sin una palabra fuera de los bloques)

Un bloque por fichero, con la ruta tal como aparece en la lista de arriba:

===FILE: ruta/del/fichero.tsx===
<contenido completo del fichero>
===ENDFILE===
"""


def coder_node(state: HarnessState) -> dict:
    """Llama al modelo, escribe los ficheros y deja el registro del intento."""
    task = state["task"]
    attempt = state.get("attempt", 0) + 1

    user = ("Produce los ficheros ahora. SOLO los bloques FILE, sin explicaciones "
            "ni resumen.")
    if state.get("feedback"):
        user += ("\n\n## RESULTADO DEL INTENTO ANTERIOR (corrigelo todo)\n"
                 "Esto es salida cruda de las comprobaciones, no una explicacion:\n\n"
                 + state["feedback"])

    messages = [
        {"role": "system", "content": build_system(task)},
        {"role": "user", "content": user},
    ]

    def on_truncation(nuevo):
        print(f"  TRUNCADO (finish_reason=length). Reintento con max_tokens={nuevo} (F-005)")

    print(f"[intento {attempt}] llamando a {llm.MODEL} ...")
    out = llm.complete(messages, on_truncation=on_truncation)
    files = parse.parse_files(out["content"])

    for name, code in files.items():
        dest = ROOT / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(code + "\n", encoding="utf-8")

    rec = metrics.build_record(
        task_id=task["task_id"], screen=task["screen"], model=llm.MODEL,
        attempt=attempt, acc=out["acc"], seconds=out["seconds"],
        finish_reason=out["finish_reason"], truncated_at=out["truncated_at"],
        files=list(files),
    )

    print(f"  ficheros: {sorted(files) or 'NINGUNO'}")
    print(f"  tokens in/out: {rec['tokens_in']}/{rec['tokens_out']}   "
          f"cache: {rec['cache_hit_pct']}% hit")
    print(f"  coste real: ${rec['cost_usd']:.6f}   en frio: "
          f"${rec['cost_usd_cold_equivalent']:.6f}")

    return {
        "attempt": attempt,
        "files": files,
        "metrics": state.get("metrics", []) + [rec],
        "verdict": "en_curso",
    }
