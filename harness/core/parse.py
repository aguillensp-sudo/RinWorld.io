"""Extraccion de ficheros de la respuesta del modelo.

Extraido de `harness/dia-03-catalogo/run_coder.py` (lineas 217-224). El formato
`===FILE: nombre===` / `===ENDFILE===` lleva dos corridas funcionando (SP-1 e
INV-01/catalogo) y no se toca: cambiarlo invalidaria la comparacion de coste
entre pantallas, que es el objetivo 4 del MVP.
"""
import re

BLOCK = re.compile(r"===FILE:\s*(.+?)===\s*(.*?)\s*===ENDFILE===", re.S)


def parse_files(text: str) -> dict:
    """`{ruta_relativa: contenido}`. Quita la valla de markdown si el modelo la
    mete dentro del bloque, que es lo que hace la mitad de las veces."""
    out = {}
    for m in BLOCK.finditer(text or ""):
        code = m.group(2).strip()
        code = re.sub(r"^```[a-zA-Z]*\n", "", code)
        code = re.sub(r"\n```$", "", code)
        out[m.group(1).strip()] = code
    return out
