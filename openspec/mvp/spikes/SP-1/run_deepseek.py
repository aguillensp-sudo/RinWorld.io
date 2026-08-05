"""
SP-1 · Llamada directa a DeepSeek (deepseek-v4-flash) para convertir el HTML
aprobado de INV-01 en un componente React `InventoryTable.tsx`.

NO usa LangGraph: hoy se mide el modelo, no el grafo. Lee la clave de os.environ.
Uso:
    python run_deepseek.py <n_intento> [ruta_feedback.txt]

Escribe:
    src/InventoryTable.tsx
    src/InventoryTable.module.css
    metrics/attempt_<n>.json   (usage, timing, coste)
"""
import os, sys, re, json, time, pathlib, urllib.request, urllib.error

HERE = pathlib.Path(__file__).parent
SRC = HERE / "src"
METRICS = HERE / "metrics"
SRC.mkdir(exist_ok=True)
METRICS.mkdir(exist_ok=True)

APPROVED = pathlib.Path(
    r"C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\openspec\design-gui\specs y html aprobados"
)
HTML_PATH = APPROVED / "INV-01 \u00b7 INV v1.0.html"
SPEC_PATH = APPROVED / "specs" / "Rinworld_spec_INV-01.md"
DS_PATH = pathlib.Path(
    r"C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\openspec\architecture\design-system.md"
)

MODEL = "deepseek-v4-flash"
BASE = "https://api.deepseek.com"
# Precio por millon de tokens (USD) — DeepSeek deepseek-v4-flash (ago 2026)
PRICE_IN_HIT = float(os.environ.get("DS_PRICE_IN_HIT", "0.0028"))
PRICE_IN_MISS = float(os.environ.get("DS_PRICE_IN_MISS", "0.14"))
PRICE_OUT = float(os.environ.get("DS_PRICE_OUT", "0.28"))


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def build_system() -> str:
    return f"""Eres el nodo Coder de un arnes de implementacion. Conviertes una pantalla
HTML ya aprobada en un componente React 18 + TypeScript, fiel al diseno.

TAREA: producir UNICAMENTE el componente de la TABLA DE INVENTARIO de la pantalla
INV-01: `InventoryTable`. No generes el app shell (brand bar, nav, sidebar, VERA);
solo la tabla de inventario actual con su cabecera de columnas, filas, badges de
estado, coloreado de antiguedad y la celda de acciones.

REGLAS ABSOLUTAS:
- React 18 + TypeScript. SIN dependencias mas alla de react.
- Los datos entran EXCLUSIVAMENTE por props tipadas. Exporta una interface para la
  fila (p.ej. `InventoryRow`) y otra para las props del componente. Nada de datos
  hardcodeados dentro del componente.
- Estilos en CSS Modules: un fichero aparte `InventoryTable.module.css`. El componente
  hace `import styles from './InventoryTable.module.css'`.
- Usa los colores EXACTOS del design system (hex de la tabla de tokens). No inventes
  literales de color nuevos.
- React idiomatico: nada de `dangerouslySetInnerHTML`, nada de manipular el DOM a mano,
  props tipadas, keys correctas en listas.
- Columnas en orden fijo: Referencia, Marca, Cantidad, Pais, Estado, Antiguedad, Acciones.
- Estado: PUBLISHED verde, DRAFT gris, ARCHIVED naranja. Antiguedad: naranja si >7 dias,
  rojo si >30 dias. Referencia en fuente monoespaciada.

FORMATO DE SALIDA (obligatorio, sin texto fuera de los bloques):
===FILE: InventoryTable.tsx===
<codigo tsx completo>
===ENDFILE===
===FILE: InventoryTable.module.css===
<codigo css completo>
===ENDFILE===

## DESIGN SYSTEM (fuente de tokens)
{read(DS_PATH)}

## SPEC DE LA PANTALLA INV-01
{read(SPEC_PATH)}

## HTML APROBADO (referencia visual de verdad — reproduce fielmente la tabla)
```html
{read(HTML_PATH)}
```"""


def call(messages, max_tokens=65536):
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        print("ERROR: DEEPSEEK_API_KEY no esta en el entorno."); sys.exit(1)
    body = json.dumps({
        "model": MODEL, "messages": messages,
        "max_tokens": max_tokens, "temperature": 0,
    }).encode()
    req = urllib.request.Request(
        BASE + "/chat/completions", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500]); sys.exit(1)
    return data, time.time() - t0


def parse_files(text):
    out = {}
    for m in re.finditer(r"===FILE:\s*(.+?)===\s*(.*?)\s*===ENDFILE===", text, re.S):
        name = m.group(1).strip()
        code = m.group(2).strip()
        # limpiar fences markdown por si acaso
        code = re.sub(r"^```[a-zA-Z]*\n", "", code)
        code = re.sub(r"\n```$", "", code)
        out[name] = code
    return out


def main():
    attempt = sys.argv[1] if len(sys.argv) > 1 else "1"
    feedback = ""
    if len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
        feedback = read(pathlib.Path(sys.argv[2]))

    user = "Genera el componente ahora. Produce SOLO los dos bloques FILE, sin explicaciones."
    if feedback:
        user += f"\n\n## ERRORES DEL INTENTO ANTERIOR (corrigelos):\n{feedback}"

    messages = [
        {"role": "system", "content": build_system()},
        {"role": "user", "content": user},
    ]
    maxtok = int(os.environ.get("DS_MAX_TOKENS", "65536"))
    print(f"[intento {attempt}] llamando a {MODEL} (max_tokens={maxtok}) ...")
    data, secs = call(messages, max_tokens=maxtok)
    choice = data["choices"][0]
    content = choice["message"]["content"] or ""
    reasoning = choice["message"].get("reasoning_content") or ""
    finish = choice.get("finish_reason")
    usage = data.get("usage", {})

    # guardar respuesta cruda siempre (diagnostico)
    (METRICS / f"attempt_{attempt}_raw.txt").write_text(
        f"finish_reason={finish}\n\n=== reasoning_content ===\n{reasoning}\n\n=== content ===\n{content}",
        encoding="utf-8")

    files = parse_files(content)
    for fname, code in files.items():
        (SRC / fname).write_text(code, encoding="utf-8")

    tin = usage.get("prompt_tokens", 0)
    tout = usage.get("completion_tokens", 0)
    hit = usage.get("prompt_cache_hit_tokens", 0) or 0
    miss = usage.get("prompt_cache_miss_tokens", tin - hit)
    cost = hit / 1e6 * PRICE_IN_HIT + miss / 1e6 * PRICE_IN_MISS + tout / 1e6 * PRICE_OUT
    rec = {
        "attempt": attempt, "model": MODEL, "finish_reason": finish,
        "tokens_in": tin, "tokens_out": tout,
        "cache_hit": usage.get("prompt_cache_hit_tokens"),
        "cache_miss": usage.get("prompt_cache_miss_tokens"),
        "usage_raw": usage, "seconds": round(secs, 1),
        "cost_usd": round(cost, 6), "files": list(files.keys()),
    }
    (METRICS / f"attempt_{attempt}.json").write_text(
        json.dumps(rec, indent=2), encoding="utf-8")

    print(f"  finish_reason: {finish}")
    print(f"  ficheros escritos: {list(files.keys())}")
    print(f"  tokens in/out: {tin}/{tout}   cache_miss:{usage.get('prompt_cache_miss_tokens')}")
    print(f"  segundos: {secs:.1f}   coste_usd(aprox): {cost:.6f}")
    if not files:
        print("  AVISO: no se parsearon ficheros. Primeros 400 chars de la respuesta:")
        print(content[:400])


if __name__ == "__main__":
    main()
