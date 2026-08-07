"""
Día 3 · nodo Coder — siembra del catálogo de demo.

Genera `supabase/seed/catalog_demo.sql`: 200+ líneas de inventario diseñadas hacia
atrás desde el guion de demo (Plan §8), repartidas entre las seis organizaciones
que el PO aprobó el 7-ago-2026.

Todavía SIN LangGraph, igual que SP-1: el grafo es del día 4. Aquí se mide el
modelo, no la orquestación.

Uso:
    python run_coder.py <n_intento> [ruta_feedback.txt]

Escribe:
    ../../supabase/seed/catalog_demo.sql   ← el artefacto, tal cual sale
    metrics/attempt_<n>.json               ← usage, timing, coste, cache

Lo que este runner corrige respecto a `spikes/SP-1/run_deepseek.py`, que son tres
hallazgos abiertos del registro:

  F-005 · `max_tokens` alto por defecto y **reintento automático** si
          `finish_reason == 'length'`. En SP-1 un truncado se cobró $0.0049 y no
          dejó artefacto.
  F-010 · si la tabla de precios está a cero o ausente, **peta**. No vuelve a
          escribirse `cost_usd: 0.0` en un JSON como si fuera un coste real. Y el
          JSON incluye ya la fila lista para el CSV, para que la copia a mano no
          pueda divergir del número de máquina.
  F-011 · `cache_hit_pct` y `cost_usd_cold_equivalent` son campos propios, no una
          nota al pie. Un coste con cache alto no se extrapola nunca.
"""
import os, sys, re, json, time, pathlib, urllib.request, urllib.error

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parents[1]
METRICS = HERE / "metrics"
OUT_DIR = ROOT / "supabase" / "seed"
METRICS.mkdir(exist_ok=True)

GUION = ROOT / "openspec" / "mvp" / "guion-demo-y-siembra.md"

MODEL = "deepseek-v4-flash"
BASE = "https://api.deepseek.com"
OUT_FILE = "catalog_demo.sql"

# Precio por millón de tokens (USD) — deepseek-v4-flash, ago 2026.
PRICE_IN_HIT = float(os.environ.get("DS_PRICE_IN_HIT", "0.0028"))
PRICE_IN_MISS = float(os.environ.get("DS_PRICE_IN_MISS", "0.14"))
PRICE_OUT = float(os.environ.get("DS_PRICE_OUT", "0.28"))


def check_prices() -> None:
    """F-010. Un coste de 0.0 escrito en un JSON contamina toda agregación
    posterior y no se distingue de una llamada gratis. Mejor no arrancar."""
    for name, value in (
        ("DS_PRICE_IN_HIT", PRICE_IN_HIT),
        ("DS_PRICE_IN_MISS", PRICE_IN_MISS),
        ("DS_PRICE_OUT", PRICE_OUT),
    ):
        if value <= 0:
            sys.exit(
                f"ERROR (F-010): {name} = {value}. La tabla de precios no puede estar "
                f"a cero: el coste registrado seria falso. Corrige la variable y repite."
            )


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def build_system() -> str:
    return f"""Eres el nodo Coder de un arnes de implementacion. Hoy no escribes React:
escribes SQL de siembra para Postgres 17 (Supabase).

TAREA: generar el catalogo de demo de Bearingworld.io — **MAS DE 200 lineas** de
inventario repartidas entre seis organizaciones distribuidoras, disenadas hacia atras
desde el guion de demo que tienes mas abajo.

## ESQUEMA · public.inventory_lines (lo unico que insertas)

Columnas que DEBES rellenar, y solo estas:

  org_id            uuid  NOT NULL  -> una de las seis de la tabla de abajo
  part_number       text  NOT NULL  -> referencia del rodamiento
  brand             text  NOT NULL  -> fabricante
  quantity          integer NOT NULL, check (quantity >= 0)
  location_country  text  NOT NULL, check (location_country ~ '^[A-Z]{{2}}$')  -> ISO-3166-1 alpha-2
  product_family    text  NOT NULL  -> del vocabulario cerrado de abajo
  status            text  NOT NULL, check (status in ('DRAFT','PUBLISHED','ARCHIVED','DELETED'))
  lead_time_days    integer, check (lead_time_days is null or lead_time_days >= 0)
  last_upload_at    timestamptz NOT NULL

Columnas que NO mencionas jamas: `id` (tiene default), `created_at`, `updated_at`,
`freshness_notified_7d_at`, `freshness_notified_30d_at`, y sobre todo
`unit_price_ciphertext` / `unit_price_iv` — el precio va cifrado extremo a extremo y
todavia no hay claves. Dejarlas fuera es lo correcto: quedan NULL.

## LAS SEIS ORGANIZACIONES (UUID literales, no los cambies ni los inventes)

  a1000000-0000-4000-8000-000000000001  Rodamientos Ibericos  ES  (tiene cuenta; es el COMPRADOR de la demo)
  b2000000-0000-4000-8000-000000000002  Nordwalz Lager        DE  (tiene cuenta; es el VENDEDOR de la demo)
  c3000000-0000-4000-8000-000000000003  Cuscinetti Padana     IT
  d4000000-0000-4000-8000-000000000004  Lozyska Wschod        PL
  e5000000-0000-4000-8000-000000000005  Roulements Rhone      FR
  f6000000-0000-4000-8000-000000000006  Anadolu Rulman        TR  (fuera de Europa)

`location_country` es donde esta el stock y NO tiene que coincidir siempre con el
pais de la organizacion: una distribuidora puede tener almacen en otro pais. Usa
esa libertad con moderacion y siempre con paises verosimiles para cada una.

## VOCABULARIO CERRADO de product_family (copia estas cadenas EXACTAS)

  'Rodamiento rigido de bolas'
  'Rodamiento de rodillos conicos'
  'Rodamiento de rodillos cilindricos'
  'Rodamiento de rodillos a rotula'
  'Rodamiento axial de bolas'

Tiene que ser coherente con la referencia: `6205-2RS` es rigido de bolas, `30205` es
conico, `NU2210` es cilindrico, `22210` es a rotula, `51106` es axial.

## MARCAS Y NOMENCLATURA (fabricantes y referencias reales del sector)

  Marcas: SKF, FAG, NSK, NTN, INA, Timken, Koyo, ZKL, NKE.
  Familias: rigidos de bolas 60xx / 62xx / 63xx con sufijos -2RS, -ZZ, -C3;
            rodillos conicos 302xx / 320xx; cilindricos NU2xxx / NJ3xxx;
            a rotula 222xx; axiales 511xx.

## LO QUE EL CATALOGO TIENE QUE CUMPLIR (se va a comprobar con tests)

1. **Mas de 200 filas** en total.
2. **La referencia de la demo `6205-2RS`: entre 8 y 12 filas**, repartidas entre
   varias organizaciones, y disenadas para que la tabla de resultados ensene todo:
   - cantidades **por encima y por debajo de 500** unidades;
   - `lead_time_days` **de 2 a 21**, con al menos tres por debajo de 7 y varios por
     encima;
   - al menos **dos filas con `last_upload_at` de mas de 7 dias** y **una de mas de 30**;
   - la referencia presente en **SKF, FAG y NSK** como minimo;
   - stock en **ES, DE, PL, IT y FR**, y **al menos una fila en TR** (Anadolu Rulman).
3. **Al menos 25 referencias distintas presentes en dos o mas organizaciones**, para
   que cualquier busqueda improvisada en la reunion cruce y devuelva varias empresas.
4. **Reparto por estado:** ~90% 'PUBLISHED', unas cuantas 'DRAFT' y 'ARCHIVED', y
   **al menos una 'DELETED'**.
5. Cantidades entre 5 y 4000, con distribucion realista: muchas lineas pequenas,
   pocas muy grandes. `lead_time_days` entre 1 y 30, nunca NULL.
6. Las seis organizaciones tienen lineas. Las cuatro sin cuenta llevan el grueso del
   catalogo; Rodamientos Ibericos y Nordwalz Lager ya tienen 3 lineas cada una de
   antes, asi que anadeles menos.

## FECHAS: RELATIVAS, NUNCA LITERALES

`last_upload_at` se escribe SIEMPRE como `now() - interval 'N days'`. Nunca una fecha
literal tipo '2026-07-20': el coloreado de antiguedad de la pantalla (naranja a los 7
dias, rojo a los 30) tiene que seguir siendo verdad cuando esto se ejecute en la demo,
que es semanas despues. La mayoria de las lineas deben ser recientes (0-6 dias) y una
minoria antiguas.

## FORMA EXACTA DE LA SENTENCIA

Un solo `insert`, con TODAS las filas en un unico `values`, y el guardian de
idempotencia al final tal cual:

```sql
insert into public.inventory_lines
  (org_id, part_number, brand, quantity, location_country, product_family, status, lead_time_days, last_upload_at)
select * from (values
  ('c3000000-0000-4000-8000-000000000003'::uuid, '6205-2RS', 'SKF', 620, 'IT', 'Rodamiento rigido de bolas', 'PUBLISHED', 4, now() - interval '2 days'),
  ('d4000000-0000-4000-8000-000000000004'::uuid, '6206-ZZ',  'FAG', 145, 'PL', 'Rodamiento rigido de bolas', 'PUBLISHED', 9, now() - interval '11 days')
  -- ... y asi hasta pasar de 200
) as v
where not exists (
  select 1 from public.inventory_lines
   where org_id = 'f6000000-0000-4000-8000-000000000006'
);
```

Detalles que importan:
- El `::uuid` va en la **primera fila** del `values` (Postgres infiere el tipo de
  columna de ahi). Ponerlo tambien en las demas es inofensivo y mas legible: hazlo.
- Ninguna cadena lleva comilla simple dentro. Nada de acentos ni caracteres no ASCII
  en ningun literal.
- El guardian `where not exists` va **una sola vez, al final**, y con ese UUID: hace
  el fichero repetible sin duplicar.
- Sin `on conflict`, sin transaccion explicita, sin metacomandos de psql, sin `delete`.

## FORMATO DE SALIDA (obligatorio, sin una palabra fuera del bloque)

===FILE: {OUT_FILE}===
<el fichero .sql completo, empezando por un comentario de cabecera de 3-4 lineas que
diga que es, de que documento sale y que el precio va NULL a proposito>
===ENDFILE===

## GUION DE DEMO (de aqui sale el diseno del catalogo — leelo entero)

{read(GUION)}"""


def call(messages, max_tokens):
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        sys.exit("ERROR: DEEPSEEK_API_KEY no esta en el entorno.")
    body = json.dumps({
        "model": MODEL, "messages": messages,
        "max_tokens": max_tokens, "temperature": 0,
    }).encode()
    req = urllib.request.Request(
        BASE + "/chat/completions", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=1800) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {e.read().decode()[:500]}")
    return data, time.time() - t0


def parse_files(text):
    out = {}
    for m in re.finditer(r"===FILE:\s*(.+?)===\s*(.*?)\s*===ENDFILE===", text, re.S):
        code = m.group(2).strip()
        code = re.sub(r"^```[a-zA-Z]*\n", "", code)
        code = re.sub(r"\n```$", "", code)
        out[m.group(1).strip()] = code
    return out


def accumulate(usage, acc):
    """Suma el usage de varias llamadas: si hubo reintento por truncado, el coste
    del intento es el de TODAS las llamadas que hicieron falta, no el de la ultima.
    Fue justamente lo que se perdio de vista en SP-1 (F-005)."""
    acc["tokens_in"] += usage.get("prompt_tokens", 0)
    acc["tokens_out"] += usage.get("completion_tokens", 0)
    hit = usage.get("prompt_cache_hit_tokens") or 0
    acc["cache_hit"] += hit
    acc["cache_miss"] += usage.get("prompt_cache_miss_tokens", usage.get("prompt_tokens", 0) - hit)
    acc["calls"] += 1
    return acc


def main():
    check_prices()
    attempt = sys.argv[1] if len(sys.argv) > 1 else "1"
    feedback = ""
    if len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
        feedback = read(pathlib.Path(sys.argv[2]))

    user = ("Genera el fichero de siembra ahora. Produce SOLO el bloque FILE, sin "
            "explicaciones ni resumen. Cuenta las filas antes de terminar: tienen que "
            "pasar de 200.")
    if feedback:
        user += f"\n\n## ERRORES DEL INTENTO ANTERIOR (corrigelos todos):\n{feedback}"

    messages = [
        {"role": "system", "content": build_system()},
        {"role": "user", "content": user},
    ]

    maxtok = int(os.environ.get("DS_MAX_TOKENS", "65536"))
    acc = {"tokens_in": 0, "tokens_out": 0, "cache_hit": 0, "cache_miss": 0, "calls": 0}
    secs_total = 0.0
    truncations = []

    # F-005: reintento automatico ante finish_reason == 'length', doblando el
    # presupuesto. Un truncado no deja artefacto pero si factura.
    for _ in range(3):
        print(f"[intento {attempt}] llamando a {MODEL} (max_tokens={maxtok}) ...")
        data, secs = call(messages, maxtok)
        secs_total += secs
        choice = data["choices"][0]
        content = choice["message"]["content"] or ""
        reasoning = choice["message"].get("reasoning_content") or ""
        finish = choice.get("finish_reason")
        accumulate(data.get("usage", {}), acc)

        (METRICS / f"attempt_{attempt}_raw.txt").write_text(
            f"finish_reason={finish}\n\n=== reasoning_content ===\n{reasoning}\n\n"
            f"=== content ===\n{content}", encoding="utf-8")

        if finish != "length":
            break
        truncations.append(maxtok)
        maxtok *= 2
        print(f"  TRUNCADO (finish_reason=length). Reintentando con max_tokens={maxtok} (F-005)")

    files = parse_files(content)
    for fname, code in files.items():
        (OUT_DIR / fname).write_text(code + "\n", encoding="utf-8")

    tin, tout = acc["tokens_in"], acc["tokens_out"]
    hit, miss = acc["cache_hit"], acc["cache_miss"]
    cost = hit / 1e6 * PRICE_IN_HIT + miss / 1e6 * PRICE_IN_MISS + tout / 1e6 * PRICE_OUT
    cold = tin / 1e6 * PRICE_IN_MISS + tout / 1e6 * PRICE_OUT
    hit_pct = round(hit / tin * 100, 2) if tin else 0.0

    rows = 0
    if files:
        sql = next(iter(files.values()))
        rows = len(re.findall(r"^\s*\('[0-9a-f]{8}-", sql, re.M))

    rec = {
        "attempt": attempt, "task": "SIEMBRA-1", "screen": "catalogo-demo",
        "model": MODEL, "finish_reason": finish, "api_calls": acc["calls"],
        "truncated_at": truncations,
        "tokens_in": tin, "tokens_out": tout,
        "cache_hit": hit, "cache_miss": miss,
        "cache_hit_pct": hit_pct,                     # F-011: campo propio
        "seconds": round(secs_total, 1),
        "cost_usd": round(cost, 6),
        "cost_usd_cold_equivalent": round(cold, 6),   # F-011: la cifra extrapolable
        "price_table": {"in_hit": PRICE_IN_HIT, "in_miss": PRICE_IN_MISS, "out": PRICE_OUT},
        "files": list(files.keys()),
        "rows_generated": rows,
        # F-010: la fila del CSV se genera aqui, para que la copia a mano no pueda
        # divergir del numero de maquina. Separador coma, como el fichero; los
        # valores multiples van con ';' (convencion de CLAUDE.md §6, para que el CSV
        # se parsee sin comillas). Falta la ultima columna, `resultado`: es el
        # veredicto de la revision, no salida del modelo, y la pone quien revisa.
        "csv_row_sin_resultado": ",".join([
            time.strftime("%Y-%m-%d"), "SIEMBRA-1", "catalogo-demo", MODEL,
            str(tin), str(tout), f"{cost:.6f}", attempt,
            f"{secs_total / 60:.1f}", ";".join(files.keys()) or "-",
        ]),
    }
    (METRICS / f"attempt_{attempt}.json").write_text(
        json.dumps(rec, indent=2), encoding="utf-8")

    print(f"  finish_reason: {finish}   llamadas: {acc['calls']}")
    print(f"  ficheros: {list(files.keys())}   filas detectadas: {rows}")
    print(f"  tokens in/out: {tin}/{tout}   cache: {hit_pct}% hit")
    print(f"  segundos: {secs_total:.1f}")
    print(f"  coste real: ${cost:.6f}   equivalente en frio: ${cold:.6f}")
    if not files:
        print("  AVISO: no se parsearon ficheros. Primeros 400 chars:")
        print(content[:400])


if __name__ == "__main__":
    main()
