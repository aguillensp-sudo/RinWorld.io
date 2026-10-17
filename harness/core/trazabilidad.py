"""Matriz de trazabilidad escenario -> prueba (corriente C, nivel 1).

Los escenarios de `openspec/specs/*/spec.md` son el contrato del producto. Este
modulo los extrae (solo lectura: las specs no se tocan, `CLAUDE.md` §1.3) y los
cruza con `openspec/v1/trazabilidad.csv`, que dice para cada uno que prueba lo
cubre. **El objetivo no es un porcentaje de lineas: es "N de M escenarios con una
prueba que los nombra".**

Id de un escenario: `<capability>/<requirement>#<n>`, con n el orden dentro del
requisito. Se deriva de la spec, asi que no hay que anotarlo en ella.

Estados del CSV (`estado`):
  CUBIERTO   una prueba concreta (`prueba`) ejerce la condicion (el GIVEN entero,
             no solo un parametro que lo imita) y comprueba el resultado del
             escenario, y **corre en CI**. `nivel` es unit | e2e | sql. Una prueba que
             solo corre con llamadas reales a VERA (`VERA_ENSAYO`, `VERA_PROBE`) no
             cuenta aqui: es PARCIAL (CLAUDE.md §5).
  PARCIAL    una prueba cubre parte (la rama feliz, o solo un AND); `nota` dice cual.
  SIN_PRUEBA no se ha encontrado prueba. Es un estado honesto, no un fallo.
  FUERA      el escenario no es verificable por una prueba automatica (depende de un
             tercero, de un humano o de un servicio externo); `nota` dice por que.

Convencion del fichero (`CLAUDE.md` §6): separador `;`, ningun valor lleva `;`.
"""
import csv
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPECS = ROOT / "openspec" / "specs"
CSV_PATH = ROOT / "openspec" / "v1" / "trazabilidad.csv"

COLUMNS = ["id", "capability", "requirement", "escenario", "estado", "nivel", "prueba", "nota"]
ESTADOS = {"CUBIERTO", "PARCIAL", "SIN_PRUEBA", "FUERA"}
NIVELES = {"unit", "e2e", "sql", ""}

_REQ = re.compile(r"^###\s+Requirement:\s*(.+?)\s*$")
_SCN = re.compile(r"^####\s+Scenario:\s*(.+?)\s*$")


def extraer(specs_dir: pathlib.Path = SPECS) -> list:
    """[{id, capability, requirement, escenario}] en el orden de las specs."""
    out = []
    for spec in sorted(specs_dir.glob("*/spec.md")):
        cap = spec.parent.name
        req, n = None, 0
        for linea in spec.read_text(encoding="utf-8").splitlines():
            m = _REQ.match(linea)
            if m:
                req, n = m.group(1), 0
                continue
            m = _SCN.match(linea)
            if m:
                n += 1
                out.append({"id": f"{cap}/{req or '-'}#{n}", "capability": cap,
                            "requirement": req or "-", "escenario": m.group(1)})
    return out


def leer_csv(path: pathlib.Path = CSV_PATH) -> list:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh, delimiter=";"))


def escribir_csv(filas: list, path: pathlib.Path = CSV_PATH) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, delimiter=";", lineterminator="\n")
        w.writeheader()
        for f in filas:
            w.writerow({c: f.get(c, "") for c in COLUMNS})


def esqueleto(escenarios: list, previas: list) -> list:
    """Una fila por escenario. Conserva lo ya clasificado; lo nuevo entra SIN_PRUEBA."""
    por_id = {f["id"]: f for f in previas}
    filas = []
    for e in escenarios:
        f = dict(por_id.get(e["id"], {}))
        f.update(e)
        f.setdefault("estado", "SIN_PRUEBA")
        filas.append(f)
    return filas


def problemas(escenarios: list, filas: list, raiz: pathlib.Path = ROOT) -> list:
    """Lo que esta mal en la matriz. Vacia = consistente."""
    p = []
    ids = [e["id"] for e in escenarios]
    vistos = {}
    for f in filas:
        vistos[f["id"]] = vistos.get(f["id"], 0) + 1
    for i in ids:
        if i not in vistos:
            p.append(f"{i}: escenario sin fila en la matriz")
    for i, n in vistos.items():
        if n > 1:
            p.append(f"{i}: {n} filas")
        if i not in ids:
            p.append(f"{i}: fila de un escenario que ya no esta en la spec")
    for f in filas:
        i, est = f["id"], f.get("estado", "")
        if est not in ESTADOS:
            p.append(f"{i}: estado {est!r} desconocido")
        if f.get("nivel", "") not in NIVELES:
            p.append(f"{i}: nivel {f.get('nivel')!r} desconocido")
        if est in ("CUBIERTO", "PARCIAL"):
            if not f.get("prueba"):
                p.append(f"{i}: {est} sin `prueba`")
            else:
                # `prueba` = `ruta/al/fichero::nombre`; la ruta tiene que existir
                # y el nombre aparecer en el fichero (si no, la evidencia es inventada).
                ruta, _, nombre = f["prueba"].partition("::")
                fich = raiz / ruta
                if not fich.is_file():
                    p.append(f"{i}: la prueba {ruta!r} no existe")
                elif nombre and nombre.lower() not in fich.read_text(
                        encoding="utf-8", errors="ignore").lower():
                    p.append(f"{i}: {nombre!r} no aparece en {ruta}")
            if est == "PARCIAL" and not f.get("nota"):
                p.append(f"{i}: PARCIAL sin `nota` que diga que falta")
        if est == "FUERA" and not f.get("nota"):
            p.append(f"{i}: FUERA sin `nota` que diga por que")
    return p


def resumen(filas: list) -> dict:
    cuenta = {e: 0 for e in sorted(ESTADOS)}
    for f in filas:
        cuenta[f.get("estado", "")] = cuenta.get(f.get("estado", ""), 0) + 1
    por_cap = {}
    for f in filas:
        c = por_cap.setdefault(f["capability"], {e: 0 for e in sorted(ESTADOS)})
        c[f.get("estado", "")] = c.get(f.get("estado", ""), 0) + 1
    return {"total": len(filas), "estados": cuenta, "por_capability": por_cap}


if __name__ == "__main__":  # python -m harness.core.trazabilidad [--regenerar]
    import sys
    esc = extraer()
    if "--regenerar" in sys.argv:
        escribir_csv(esqueleto(esc, leer_csv()))
        print(f"{len(esc)} escenarios -> {CSV_PATH.relative_to(ROOT)}")
    filas = leer_csv()
    r = resumen(filas)
    print(f"total {r['total']}: " + ", ".join(f"{k}={v}" for k, v in r["estados"].items()))
    for c, d in r["por_capability"].items():
        print(f"  {c:30} " + " ".join(f"{k}={v}" for k, v in d.items()))
    pr = problemas(esc, filas)
    for x in pr[:40]:
        print("  PROBLEMA:", x)
    sys.exit(1 if pr else 0)
