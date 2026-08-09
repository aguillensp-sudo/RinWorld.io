"""Metricas por intento: el JSON de maquina y la fila del CSV que sale de el.

Extraido de `harness/dia-03-catalogo/run_coder.py` (lineas 300-325), y aqui se
cierra del todo lo que alli quedaba a medias:

  F-010 · el CSV se **genera desde** el JSON. En el dia 3 el JSON ya traia el
          campo `csv_row_sin_resultado`, pero la copia al CSV seguia siendo a
          mano. Desde hoy la escribe este modulo y la divergencia deja de ser
          posible. Es el hallazgo donde el fichero de maquina fue el que mintio
          (`cost_usd: 0.0`) y el corregido a mano el que acerto: la asimetria
          peligrosa, porque el JSON es lo que leera cualquier agregacion futura.
  F-011 · `cache_hit_pct` y `cost_usd_cold_equivalent` son campos propios del
          JSON **y columna propia del CSV**, no una nota al pie.

Convencion del CSV (`CLAUDE.md` §6): **ningun valor lleva coma** — los multiples
van con `;` — para que el fichero se parsee sin comillas. Se comprueba al
escribir, porque una coma colada rompe las tres filas historicas tambien.
"""
import csv
import io
import json
import pathlib
import time

from . import pricing

# Orden congelado. `resultado` va **ultima** a proposito: es la unica columna de
# texto libre y una columna libre en medio del fichero es una trampa para el
# siguiente que lo parsee. Las dos nuevas (F-011 y Plan §11) entran antes de ella.
COLUMNS = [
    "fecha", "tarea", "pantalla", "modelo",
    "tokens_in", "tokens_out", "coste_usd",
    "intentos", "minutos", "ficheros",
    "cache_hit_pct", "escalado_a_humano", "resultado",
]


class CsvContractError(RuntimeError):
    """La cabecera del CSV no es la esperada, o un valor lleva coma."""


def build_record(*, task_id, screen, model, attempt, acc, seconds, finish_reason,
                 truncated_at, files, checks=None, escalated=False, extra=None) -> dict:
    """El JSON del intento. Es la fuente de verdad del coste; el CSV se deriva."""
    pricing.check_prices()  # F-010: antes de calcular nada, no despues

    tin, tout = acc["tokens_in"], acc["tokens_out"]
    hit, miss = acc["cache_hit"], acc["cache_miss"]

    rec = {
        "attempt": attempt,
        "task": task_id,
        "screen": screen,
        "model": model,
        "finish_reason": finish_reason,
        "api_calls": acc["calls"],
        "truncated_at": truncated_at,
        "tokens_in": tin,
        "tokens_out": tout,
        "cache_hit": hit,
        "cache_miss": miss,
        "cache_hit_pct": pricing.cache_hit_pct(hit, tin),      # F-011: campo propio
        "seconds": seconds,
        "cost_usd": round(pricing.cost_usd(hit, miss, tout), 6),
        "cost_usd_cold_equivalent": round(pricing.cost_usd_cold(tin, tout), 6),  # F-011
        "price_table": pricing.table(),
        "files": sorted(files),
        "checks": checks or [],
        "escalated_to_human": bool(escalated),
    }
    if extra:
        rec.update(extra)
    return rec


def write_record(metrics_dir: pathlib.Path, rec: dict) -> pathlib.Path:
    metrics_dir.mkdir(parents=True, exist_ok=True)
    path = metrics_dir / f"attempt_{rec['attempt']}.json"
    path.write_text(json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def csv_row(rec: dict, resultado: str, fecha: str = None) -> list:
    """La fila, derivada del JSON. Ningun numero se vuelve a teclear."""
    return [
        fecha or time.strftime("%Y-%m-%d"),
        rec["task"],
        rec["screen"],
        rec["model"],
        str(rec["tokens_in"]),
        str(rec["tokens_out"]),
        f"{rec['cost_usd']:.6f}",
        str(rec["attempt"]),
        f"{rec['seconds'] / 60:.1f}",
        ";".join(rec["files"]) or "-",
        f"{rec['cache_hit_pct']:.2f}",
        "si" if rec["escalated_to_human"] else "no",
        resultado,
    ]


def _assert_no_commas(row: list) -> None:
    for i, value in enumerate(row):
        if "," in str(value):
            raise CsvContractError(
                f"CLAUDE.md §6: ningun valor del CSV lleva coma, y `{COLUMNS[i]}` "
                f"lleva una: {value!r}. Usa ';' para valores multiples."
            )


def append_csv(csv_path: pathlib.Path, rec: dict, resultado: str,
               fecha: str = None) -> str:
    """Anade la fila del intento. Comprueba la cabecera antes de escribir: si el
    contrato del fichero ha cambiado, mejor petar que anadir una fila torcida."""
    existing = csv_path.read_text(encoding="utf-8").splitlines()
    if not existing:
        raise CsvContractError(f"{csv_path} esta vacio; deberia tener cabecera.")
    header = existing[0].split(",")
    if header != COLUMNS:
        raise CsvContractError(
            f"Cabecera inesperada en {csv_path}.\n  esperada: {COLUMNS}\n  "
            f"encontrada: {header}"
        )

    row = csv_row(rec, resultado, fecha)
    _assert_no_commas(row)

    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n").writerow(row)
    line = buf.getvalue()

    with csv_path.open("a", encoding="utf-8", newline="") as fh:
        fh.write(line)
    return line.rstrip("\n")


def resultado_from_checks(checks: list, escalated: bool) -> str:
    """El texto de la columna `resultado`, construido desde los checks. Sin coma,
    por contrato del fichero."""
    verdes = [c["id"] for c in checks if c["ok"]]
    rojos = [c["id"] for c in checks if not c["ok"]]
    cabeza = "ESCALADO" if escalated else ("PASA" if not rojos else "FALLA")
    detalle = f"verde: {';'.join(verdes) or '-'} / rojo: {';'.join(rojos) or '-'}"
    return f"{cabeza} {len(verdes)}/{len(checks)} ({detalle}). C5 lo da el PO"
