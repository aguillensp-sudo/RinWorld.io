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

    # ⚠ CUARTA DESVIACION DEL FORMATO CONGELADO DEL DIA 4, y va anotada como las
    # otras tres (`component_api` el dia 5, literales verbatim y estado accesible
    # el dia 6): **`approved_html` pasa a ser OPCIONAL**.
    #
    # Existe por LOGIN-01 (F-016). Es la novena pantalla, la que nadie planifico,
    # y **no tiene mock**: no esta entre los 32 HTML aprobados porque nadie la
    # diseño nunca. Con el campo obligatorio, `_read` reventaba antes de llamar al
    # modelo.
    #
    # Lo que NO se hace es apuntar a un HTML de otra pantalla para rellenar el
    # hueco. Seria darle una referencia visual de algo que no es esto, y el
    # resultado se parece a lo que le enseñaste: F-041 al reves. Cuando no hay
    # mock, manda la spec y punto — que es lo que manda siempre (F-041), solo que
    # aqui sin nada al lado que la contradiga.
    ruta_html = inputs.get("approved_html")
    approved = _read(ruta_html) if ruta_html else ""

    # La capa de datos que la tarea declara. **Iba en el JSON y no llegaba al
    # prompt**, y ese es el bug del dia 5: la tarea decia "el Coder los importa,
    # no los reescribe" hablando de unos tipos que el Coder no veia por ninguna
    # parte. Reinvento `ThreadSummary` entera, con los cinco estados en
    # `CON_OFERTA_PENDIENTE` en vez de los literales del esquema y un mapa de
    # alias para tapar su propia invencion. Pedir que se importe un fichero sin
    # ensenarlo no es una prueba del Coder: es una adivinanza.
    # Acepta una ruta o VARIAS. MSG-02 (dia 7) es la primera pantalla que importa
    # de tres modulos —`thread-detail`, `offers` y `threads`—, y con el campo
    # limitado a una cadena el prompt se habria llevado el `repr()` de la lista y
    # `_read` habria reventado. Es el bug del dia 5 otra vez, en su version
    # plural: **una capa declarada y no ensenada no es una prueba del Coder, es
    # una adivinanza** — y aqui las reglas que no puede reinventar (quien decide
    # una oferta, el formato del timestamp) viven justo en los dos modulos que se
    # habrian quedado fuera.
    rutas_capa = inputs.get("data_layer") or []
    if isinstance(rutas_capa, str):
        rutas_capa = [rutas_capa]

    capa = ""
    if rutas_capa:
        bloques = "\n\n".join(f"`{r}`:\n\n```ts\n{_read(r)}\n```" for r in rutas_capa)
        capa = f"""## CAPA DE DATOS — YA ESCRITA, SE IMPORTA TAL CUAL

{', '.join(f'`{r}`' for r in rutas_capa)} ya existe(n) en el repo. Sus tipos y su
logica pura son la verdad: se importan. **Declarar un tipo paralelo o reescribir
estas funciones es un fallo del intento**, aunque el resultado parezca equivalente.

{bloques}

"""

    # La firma publica de cada componente. Va aparte de `outputs` porque los tests
    # de aceptacion fijan nombres de prop y el Coder no los ve nunca: sin esto
    # tiene que adivinarlos, y adivinar mal suspende C1 sin medir nada. Es la
    # desviacion del dia 5 sobre el formato congelado (Dia-04 §5).
    api = "\n".join(
        f"  - `{ruta}`\n    {firma}"
        for ruta, firma in (task.get("component_api") or {}).items()
        if not ruta.startswith("_"))
    api = f"""## API PUBLICA DE CADA COMPONENTE — CONTRATO, NO SUGERENCIA

Los tests que te evaluan los escribe otro y **no los vas a ver**. Por eso las firmas
van aqui: **los nombres de prop son obligatorios**, no orientativos. Un componente que
haga lo correcto con otro nombre de prop no pasa.

{api}

""" if api else ""

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

{api}
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

{f'''## HTML APROBADO — REFERENCIA VISUAL

{approved}
''' if approved else '''## NO HAY HTML APROBADO PARA ESTA PANTALLA

Y no es un olvido: esta pantalla no se diseño nunca. **Manda la spec de arriba, y la
referencia de estilo es el componente de la casa que tienes mas arriba.** No copies el
aspecto de otra pantalla del producto que no sea esa referencia: lo que hay que respetar
son los tokens y la forma de escribir componentes, no el layout de una pantalla distinta.
'''}
## FORMATO DE SALIDA (obligatorio, sin una palabra fuera de los bloques)

Un bloque por fichero, con la ruta tal como aparece en la lista de arriba:

===FILE: ruta/del/fichero.tsx===
<contenido completo del fichero>
===ENDFILE===
"""


def build_messages(task: dict, files: dict, feedback: str) -> list:
    """Los mensajes de una vuelta. **Puro y aparte de `coder_node` a proposito**:
    lo que hay que poder probar sin gastar es COMO se arma el reintento, y eso
    era justamente lo que nadie miraba (F-064).

    ⚠ EL TURNO DE ASISTENTE ES F-064 ENTERO, Y FALTABA.

    Hasta el 12-ago el reintento se armaba con dos mensajes —la tarea, IDENTICA a
    la del intento 1, y la salida cruda de los checks— **sin un turno de asistente
    con el artefacto anterior**. O sea que al modelo se le mandaba
    `ThreadHistory.tsx(136,61): error TS2375: …` **sobre un fichero que no estaba
    viendo**, y se le pedia regenerar los ocho desde cero. Que reprodujera el
    mismo error no era ignorar a `tsc`: era volver a tirar el dado con una nota de
    como salio la vez anterior.

    **El dato ya viajaba por el grafo.** `HarnessState.files` esta declarado como
    "{ruta: contenido} del ultimo intento del Coder" y `coder_node` lo devuelve en
    cada vuelta. No faltaba informacion: faltaba usarla. Tres conclusiones sobre
    el modelo se midieron sin esto — F-036, la corrida 2 de SRCH-01 y la mitad de
    F-059.

    Se reconstruye en el MISMO formato `===FILE:===` que se le exige de salida, y
    a proposito: asi el turno anterior es indistinguible de una respuesta suya,
    que es lo que era.

    **En el intento 1 no hay turno de asistente y no puede haberlo**: el primer
    intento tiene que seguir siendo una pagina en blanco, o deja de medir lo que
    dice medir."""
    user = ("Produce los ficheros ahora. SOLO los bloques FILE, sin explicaciones "
            "ni resumen.")
    if feedback:
        user += ("\n\n## RESULTADO DE TU INTENTO ANTERIOR (corrigelo todo)\n"
                 "Esto es salida cruda de las comprobaciones sobre los ficheros que "
                 "acabas de escribir, no una explicacion. **Los numeros de linea son "
                 "de ESOS ficheros**, que tienes arriba:\n\n" + feedback)

    messages = [{"role": "system", "content": build_system(task)}]

    if files:
        messages.append({
            "role": "assistant",
            "content": "\n".join(
                f"===FILE: {ruta}===\n{codigo}\n===ENDFILE==="
                for ruta, codigo in sorted(files.items())),
        })

    messages.append({"role": "user", "content": user})
    return messages


def coder_node(state: HarnessState) -> dict:
    """Llama al modelo, escribe los ficheros y deja el registro del intento."""
    task = state["task"]
    attempt = state.get("attempt", 0) + 1

    messages = build_messages(task, state.get("files") or {}, state.get("feedback") or "")

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
        # B-010: el contenido, no solo las rutas. Sin esto, el artefacto de los
        # intentos 1 y 2 se pierde y solo sobrevive en disco el del ultimo — que
        # es el peor de los tres cuando la corrida escala.
        sources=files,
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
