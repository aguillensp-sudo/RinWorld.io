"""
Bearingworld.io — Screen HTML Generator (LangGraph)

Two-agent pipeline:
  Agent 1 (Builder): reads spec + shell + design rules → generates HTML
  Agent 2 (Reviewer): compares HTML vs spec → approves or returns feedback

Usage:
  python generate_screen.py path/to/spec.md [--output path/to/output.html] [--max-attempts 3]
"""

import os
import re
import sys
import argparse
from typing import Annotated
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

os.environ.setdefault("LANGSMITH_TRACING", "true")
os.environ.setdefault("LANGSMITH_PROJECT", "bearingworld-screen-generator")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APPROVED_DIR = os.path.join(SCRIPT_DIR, "..", "specs y html aprobados")
SHELL_HTML_PATH = os.path.join(APPROVED_DIR, "bearingworld_app_shell.html")

MAX_ATTEMPTS_DEFAULT = 3
MODEL = "claude-sonnet-4-6"

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class GraphState(TypedDict):
    spec_content: str
    shell_html: str
    design_rules: str
    generated_html: str
    review_feedback: str
    approved: bool
    attempt: int
    max_attempts: int
    output_path: str

# ---------------------------------------------------------------------------
# Design rules (embedded from handoff + SKILL + sistema base)
# ---------------------------------------------------------------------------

DESIGN_RULES = """
## REGLAS OBLIGATORIAS DEL DESIGN SYSTEM — Bearingworld.io

### Layout
- Shell completo: brand bar (24px #111827) + nav bar (46px #1B2537) + sidebar overlay + contenido (67%) + VERA (33%)
- Sin shell SOLO: REG-00 y REG-00-WAIT (fondo Deep Steel + tarjeta blanca + VERA)
- Sidebar: overlay puro, no empuja el layout
- VERA: arrastrable por borde izquierdo · colapsable a 32px · expandible hasta 50%
- Shell position:fixed; inset:0 para fullscreen

### Formularios
- El bloque de formulario llena su panel del 67% (max-width 900px, padding 48px)
- Los campos se ensanchan para aprovechar el ancho — NO columna estrecha centrada
- Longitud máxima de campos: con atributo maxlength, no con width visual
- Grid proporcional: campos cortos en pares (CP+País 2.5fr/1fr) · campos largos en span 2
- Todos los datos de ejemplo van en placeholder, NUNCA en value

### Componentes CSS
- Labels: font-size:12px; font-weight:500; letter-spacing:0.01em
- Inputs: padding:10px 12px; border:1px solid; border-radius:3px; font-size:13px
- Input focus: border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,0.08)
- Placeholder color: #9BA4B0
- Input text color: #1B2537
- Field hints: IBM Plex Mono 10px uppercase letter-spacing:0.04em color:#6B7A99
- Sensitive tag: IBM Plex Mono 9px bg:rgba(220,38,38,0.06) color:#dc2626 uppercase
- Tags: bg:rgba(184,146,74,0.08) border:rgba(184,146,74,0.28) IBM Plex Mono 12px
- Radio option: border:1px solid; border-radius:3px; padding:12px 14px
- Radio checked: border-color:#2563EB; background:rgba(37,99,235,0.08)
- Checkbox field: border:1px solid; border-radius:3px; padding:14px; background:#FAF8F4
- Role notice: border-left:3px solid #B8924A; background:rgba(184,146,74,0.08)
- Buttons primary: background:#2563EB; border-radius:3px; font-size:14px; font-weight:600
- Button disabled: background:rgba(37,99,235,0.32); cursor:not-allowed
- Section divider: IBM Plex Mono 10px uppercase letter-spacing:0.06em

### VERA
- Header: bearing SVG (brass) + "VERA" (Montserrat 700 15px) + subtítulo contextual + punto verde #16a34a
- Burbujas VERA: fondo blanco · border-left:2px solid #B8924A
- Burbujas usuario: fondo #1B2537 · texto #dde2ea
- Resize handle: position:absolute; left:0; top:0; bottom:0; width:5px; cursor:col-resize

### Tipografía
- Títulos: Montserrat 700 28px letter-spacing:0.5px
- Eyebrow/módulo: Montserrat 600 14px uppercase letter-spacing:1.5px
- Body: Inter 400 16px
- Labels: Inter 500 12px
- Inputs: Inter 400 13px
- Field hints: IBM Plex Mono 500 10px uppercase
- Brand bar: Inter 400 10px uppercase letter-spacing:0.08em

### Paleta
- Deep Steel Dark: #111827 (brand bar)
- Deep Steel: #1B2537 (nav, sidebar, ink)
- Warm Cream: #FAF8F4 (VERA bg)
- Cold White: #F1F3F6 (content bg alternativo)
- Brass: #B8924A (acentos confianza)
- Calibration Blue: #2563EB (acción primaria)
- Steel Mist: #6B7A99 (texto secundario)
"""

VERIFICATION_PROTOCOL = """
## PROTOCOLO DE VERIFICACIÓN PRE-ENTREGA

Antes de dar por terminado el HTML, verificar en este orden:

1. SHELL COMPLETO — CSS+HTML+JS copiados íntegros del shell base. Brand bar + nav + contenido + VERA llenan 100% viewport.
2. VERA ARRASTRABLE — resize handle (position:absolute; left:0) funciona. Toggle funciona. Shell usa position:fixed; inset:0.
3. PROPORCIONES — contenido 67% (flex:1) + VERA 33% (width:33%; flex-shrink:0). Sin grises sobrantes.
4. PLACEHOLDERS — datos de ejemplo en placeholder, nunca en value. Solo excepción: campos pre-rellenos desde FSR.
5. GRID PROPORCIONAL — campos largos (>=100 chars) en span 2. Pares cortos con proporciones 2.5fr/1fr.
6. TEXTOS LITERALES — copiar exactamente los textos del spec. Cero paráfrasis.
7. ORDEN DE CAMPOS — seguir el número de fila de la tabla del spec sin reordenar.
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def get_llm() -> ChatAnthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY no está configurada.")
        print("Configúrala con: set ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)
    return ChatAnthropic(model=MODEL, max_tokens=16000, temperature=0)

# ---------------------------------------------------------------------------
# Node 1: Builder
# ---------------------------------------------------------------------------

def build_html(state: GraphState) -> GraphState:
    llm = get_llm()
    attempt = state["attempt"]
    feedback = state.get("review_feedback", "")

    print(f"\n{'='*60}")
    print(f"  BUILDER — Intento {attempt}")
    print(f"{'='*60}")

    feedback_block = ""
    if feedback:
        feedback_block = f"""

## FEEDBACK DEL REVIEWER (corregir estos problemas):
{feedback}
"""

    system_prompt = f"""Eres el agente Builder de Bearingworld.io. Tu trabajo es generar un archivo HTML
completo y autónomo para una pantalla de la aplicación.

REGLAS ABSOLUTAS:
- El HTML debe ser un archivo completo que se abra en un navegador y se vea exactamente como la spec describe.
- DEBES copiar íntegro el shell HTML base (brand bar, nav bar, sidebar, VERA) incluyendo todo su CSS y JS.
- El contenido de la pantalla va dentro del panel de contenido (.bwcnt).
- Sigue las reglas del design system al pie de la letra.
- Los datos de ejemplo van en placeholder, NUNCA en value.
- Copia los textos del spec literalmente, sin parafrasear.

{DESIGN_RULES}

{VERIFICATION_PROTOCOL}

## SHELL HTML BASE (copiar íntegro, reemplazando solo el contenido del panel .bwcnt):
```html
{state['shell_html']}
```
{feedback_block}"""

    user_prompt = f"""Genera el HTML completo para esta pantalla. Spec:

{state['spec_content']}

Produce SOLO el HTML completo, sin explicaciones ni comentarios fuera del código."""

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    html = response.content
    if "```html" in html:
        html = html.split("```html", 1)[1]
        html = html.rsplit("```", 1)[0]
    html = html.strip()

    print(f"  HTML generado: {len(html)} caracteres")

    return {**state, "generated_html": html}

# ---------------------------------------------------------------------------
# Node 2: Reviewer
# ---------------------------------------------------------------------------

def review_html(state: GraphState) -> GraphState:
    llm = get_llm()

    print(f"\n{'='*60}")
    print(f"  REVIEWER — Evaluando intento {state['attempt']}")
    print(f"{'='*60}")

    system_prompt = f"""Eres el agente Reviewer de Bearingworld.io. Tu trabajo es comparar un HTML generado
contra la spec original y el protocolo de verificación.

Evalúa CADA punto del protocolo:
{VERIFICATION_PROTOCOL}

Además verifica:
- Que TODOS los campos de la spec están presentes en el HTML
- Que el orden de campos coincide con la spec
- Que los textos son literales (no parafraseados)
- Que los placeholders tienen los datos de ejemplo correctos
- Que el shell (brand bar, nav, sidebar, VERA) está completo con su CSS y JS
- Que VERA es arrastrable y colapsable (el JS del resize y toggle está presente)

RESPONDE con este formato exacto:

APROBADO: sí/no

Si no está aprobado:
PROBLEMAS:
1. [problema concreto y cómo corregirlo]
2. [problema concreto y cómo corregirlo]
..."""

    user_prompt = f"""## SPEC ORIGINAL:
{state['spec_content']}

## HTML GENERADO:
{state['generated_html']}

Evalúa el HTML contra la spec y el protocolo."""

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    review = response.content
    approved = bool(re.search(r"aprobado\s*:\s*\*{0,2}s[íi]\*{0,2}", review.lower()))

    if approved:
        print("  RESULTADO: APROBADO")
    else:
        print(f"  RESULTADO: RECHAZADO")
        print(f"  Feedback:\n{review}")

    return {
        **state,
        "approved": approved,
        "review_feedback": review if not approved else "",
        "attempt": state["attempt"] + 1,
    }

# ---------------------------------------------------------------------------
# Node 3: Save
# ---------------------------------------------------------------------------

def save_html(state: GraphState) -> GraphState:
    output_path = state["output_path"]
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(state["generated_html"])
    print(f"\n  HTML guardado en: {output_path}")
    return state

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def should_retry(state: GraphState) -> str:
    if state["approved"]:
        return "save"
    if state["attempt"] >= state["max_attempts"]:
        print(f"\n  Máximo de intentos ({state['max_attempts']}) alcanzado. Guardando última versión.")
        return "save"
    return "retry"

# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    graph = StateGraph(GraphState)

    graph.add_node("builder", build_html)
    graph.add_node("reviewer", review_html)
    graph.add_node("saver", save_html)

    graph.add_edge(START, "builder")
    graph.add_edge("builder", "reviewer")

    graph.add_conditional_edges("reviewer", should_retry, {
        "retry": "builder",
        "save": "saver",
    })

    graph.add_edge("saver", END)

    return graph.compile()

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Bearingworld.io Screen HTML Generator")
    parser.add_argument("spec", help="Ruta al archivo .md de la spec de pantalla")
    parser.add_argument("--output", "-o", help="Ruta de salida del HTML (default: junto a la spec)")
    parser.add_argument("--max-attempts", "-m", type=int, default=MAX_ATTEMPTS_DEFAULT,
                        help=f"Máximo de intentos builder-reviewer (default: {MAX_ATTEMPTS_DEFAULT})")
    args = parser.parse_args()

    if not os.path.exists(args.spec):
        print(f"ERROR: No se encuentra la spec: {args.spec}")
        sys.exit(1)

    spec_content = load_file(args.spec)
    shell_html = load_file(SHELL_HTML_PATH)

    if args.output:
        output_path = args.output
    else:
        base = os.path.splitext(args.spec)[0]
        output_path = base + ".html"

    print(f"""
╔══════════════════════════════════════════════════════════╗
║  BEARINGWORLD.IO — Screen HTML Generator                ║
║  LangGraph · 2 agents (Builder + Reviewer)              ║
╠══════════════════════════════════════════════════════════╣
║  Spec:    {os.path.basename(args.spec):<46} ║
║  Output:  {os.path.basename(output_path):<46} ║
║  Max:     {args.max_attempts} intentos{' '*39} ║
╚══════════════════════════════════════════════════════════╝
""")

    initial_state: GraphState = {
        "spec_content": spec_content,
        "shell_html": shell_html,
        "design_rules": DESIGN_RULES,
        "generated_html": "",
        "review_feedback": "",
        "approved": False,
        "attempt": 1,
        "max_attempts": args.max_attempts,
        "output_path": output_path,
    }

    app = build_graph()
    final_state = app.invoke(initial_state)

    if final_state["approved"]:
        print("\n  RESULTADO FINAL: APROBADO")
    else:
        print("\n  RESULTADO FINAL: guardado con observaciones pendientes")

    print(f"  Archivo: {output_path}")
    print()


if __name__ == "__main__":
    main()
