"""Coste de orquestacion: parsea las transcripciones de Claude Code de este repo
-- todos los worktrees vivos, via `git worktree list`, no un directorio supuesto
-- y calcula el coste-sombra con la tarifa publicada (`orchestration_pricing.py`).

Es la pieza que `F-113`/ESTADO-V1.md §3 pedia: un numero por sesion comparable al
que ya existe para el Coder en `harness-metrics.csv`, para poder decir "orquestar
esta pieza costo tanto" en vez de "no se mide en ninguna parte".

Una fila por (sesion, modelo): una sesion que cambia de modelo a mitad -Sonnet a
Opus, o entra y sale de `/fast`- produce mas de una fila, para no promediar dos
tarifas distintas en una sola cifra. `sesion` es el UUID de la transcripcion
-globalmente unico, no colisiona entre worktrees.

⚠ `fecha` es el dia del PRIMER turno de la sesion, no cada dia que abarco. Una
sesion larga que sigue abierta dias despues de empezar -pasa en este mismo
repo- concentra todo su coste en el dia de arranque en el desglose "por dia".
Para una serie diaria fiable hay que bajar a granularidad de turno, no de
sesion; esta version mide por sesion porque es lo que hace falta hoy para
comparar "cuanto costo orquestar X" con lo que ya existe para el Coder, no
para trazar una curva de gasto diario.

Uso:
    python -m harness.core.orchestration_metrics
    python -m harness.core.orchestration_metrics --repo /otra/ruta --out otro.csv
"""
import argparse
import csv
import json
import pathlib
import subprocess
import sys
from collections import defaultdict

from . import orchestration_pricing as pricing

COLUMNS = [
    "fecha", "sesion", "worktree", "modelo",
    "tokens_in", "tokens_out", "cache_write_5m", "cache_write_1h", "cache_read",
    "coste_usd_sombra", "turnos", "price_table_date",
]

# La regla con la que Claude Code nombra `~/.claude/projects/<...>` a partir de
# una ruta de repo: cada caracter de `:\/.` se convierte en `-`. Verificada el
# 28-ago-2026 contra los cuatro directorios reales de este repo (main + 3
# worktrees), no supuesta de la documentacion -- no hay documentacion de esto.
_SANITIZE_TABLE = str.maketrans({c: "-" for c in ":\\/."})


def _sanitize(path: str) -> str:
    return path.translate(_SANITIZE_TABLE)


def worktree_paths(repo_path: pathlib.Path) -> list:
    """Las rutas de todos los worktrees vivos de este repo, via `git worktree
    list` -- no un prefijo adivinado, la lista real de git (F-108: un worktree
    de una rama antigua parece el repo bueno y no lo es; aqui el riesgo es
    contrario y mas barato -- olvidar uno y subcontar, no confundirlo con el
    bueno -- pero la fuente de verdad es la misma)."""
    out = subprocess.run(
        ["git", "-C", str(repo_path), "worktree", "list", "--porcelain"],
        capture_output=True, text=True, check=True,
    ).stdout
    return [line[len("worktree "):] for line in out.splitlines()
            if line.startswith("worktree ")]


def transcript_dirs(repo_path: pathlib.Path) -> dict:
    """{directorio_de_transcripciones: ruta_del_worktree} para cada worktree
    vivo que tenga sesiones de Claude Code registradas. Los que no tienen
    ninguna (p.ej. la raiz del repo, si nunca se lanzo Code ahi directamente)
    se omiten en silencio: no es un error, es que no hay nada que sumar."""
    projects = pathlib.Path.home() / ".claude" / "projects"
    out = {}
    for wt in worktree_paths(repo_path):
        d = projects / _sanitize(wt)
        if d.is_dir() and any(d.glob("*.jsonl")):
            out[d] = wt
    return out


def iter_session_usage(jsonl_path: pathlib.Path):
    """Por linea con uso de modelo real: (modelo, usage, timestamp ISO)."""
    with jsonl_path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = obj.get("message")
            if not isinstance(msg, dict):
                continue
            usage, model = msg.get("usage"), msg.get("model")
            if not isinstance(usage, dict) or not model:
                continue
            if model in pricing.MODELOS_NO_FACTURABLES:
                continue
            yield model, usage, obj.get("timestamp")


def scan(repo_path: pathlib.Path) -> list:
    """Una fila por (sesion, modelo) encontrada. No escribe nada -- eso es
    `write_csv`, para que `scan()` se pueda probar sin tocar disco."""
    filas = []
    for tdir, worktree in transcript_dirs(repo_path).items():
        for jf in sorted(tdir.glob("*.jsonl")):
            por_modelo = defaultdict(lambda: {
                "tokens_in": 0, "tokens_out": 0, "cache_write_5m": 0,
                "cache_write_1h": 0, "cache_read": 0, "coste": 0.0,
                "turnos": 0, "fecha_min": None,
            })
            for model, usage, ts in iter_session_usage(jf):
                acc = por_modelo[model]
                cache = usage.get("cache_creation") or {}
                acc["tokens_in"] += usage.get("input_tokens", 0)
                acc["tokens_out"] += usage.get("output_tokens", 0)
                acc["cache_write_5m"] += cache.get("ephemeral_5m_input_tokens", 0)
                acc["cache_write_1h"] += cache.get("ephemeral_1h_input_tokens", 0)
                acc["cache_read"] += usage.get("cache_read_input_tokens", 0)
                acc["coste"] += pricing.cost_usd(model, usage)
                acc["turnos"] += 1
                fecha = (ts or "")[:10]
                if fecha and (acc["fecha_min"] is None or fecha < acc["fecha_min"]):
                    acc["fecha_min"] = fecha

            for model, acc in por_modelo.items():
                if acc["turnos"] == 0:
                    continue
                filas.append({
                    "fecha": acc["fecha_min"] or "?",
                    "sesion": jf.stem,
                    "worktree": worktree,
                    "modelo": model,
                    "tokens_in": acc["tokens_in"],
                    "tokens_out": acc["tokens_out"],
                    "cache_write_5m": acc["cache_write_5m"],
                    "cache_write_1h": acc["cache_write_1h"],
                    "cache_read": acc["cache_read"],
                    "coste_usd_sombra": round(acc["coste"], 6),
                    "turnos": acc["turnos"],
                    "price_table_date": pricing.PRICE_TABLE_DATE,
                })
    return sorted(filas, key=lambda r: (r["fecha"], r["sesion"], r["modelo"]))


def write_csv(rows: list, csv_path: pathlib.Path) -> None:
    """Reescribe el fichero entero cada vez, a diferencia de `metrics.append_csv`.
    No hay un `--seco` que corra dos veces la misma corrida: cada ejecucion relee
    TODAS las transcripciones vivas, asi que anadir en vez de reescribir
    duplicaria cada sesion en cada pasada."""
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(COLUMNS)
        for r in rows:
            row = [r[c] for c in COLUMNS]
            for i, v in enumerate(row):
                if "," in str(v):
                    raise ValueError(
                        f"CLAUDE.md §6: ningun valor del CSV lleva coma, y "
                        f"`{COLUMNS[i]}` lleva una: {v!r}."
                    )
            w.writerow(row)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".", help="raiz del repo, o cualquier worktree suyo")
    ap.add_argument("--out", default="openspec/mvp/orchestration-metrics.csv",
                    help="ruta de salida, relativa a la raiz del repo si no es absoluta")
    args = ap.parse_args(argv)

    pricing.check_prices()  # avisa, no bloquea -- mismo criterio que pricing.py

    repo_path = pathlib.Path(args.repo).resolve()
    toplevel = pathlib.Path(subprocess.run(
        ["git", "-C", str(repo_path), "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True,
    ).stdout.strip())

    rows = scan(repo_path)
    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = toplevel / out_path
    write_csv(rows, out_path)

    sesiones = {r["sesion"] for r in rows}
    total = sum(r["coste_usd_sombra"] for r in rows)
    por_dia = defaultdict(float)
    for r in rows:
        por_dia[r["fecha"]] += r["coste_usd_sombra"]

    print(f"{len(rows)} filas ({len(sesiones)} sesiones, "
          f"{len(transcript_dirs(repo_path))} worktrees con transcripciones) -> {out_path}")
    print(f"Coste-sombra total (tarifa API, NO lo que se paga bajo suscripcion): "
          f"${total:,.2f}")
    print("(el desglose por dia agrupa por el PRIMER turno de cada sesion -- una "
          "sesion larga que sigue abierta dias despues concentra su coste en el "
          "dia que empezo, ver docstring del modulo)")
    for fecha in sorted(por_dia):
        print(f"  {fecha}: ${por_dia[fecha]:,.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
