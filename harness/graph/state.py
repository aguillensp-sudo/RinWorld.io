"""El estado del grafo. Campos congelados el dia 4 (`Dia-04_decisiones_arnes.md` §1).

Estan congelados porque el CSV de metricas se deriva de aqui y porque el formato
de tarea es el borrador del contrato Planner->Coder de V1 (`Plan §6`): si el
estado cambia a mitad del MVP, las 10-15 tareas dejan de ser un corpus comparable.
"""
from typing import Any, Literal, TypedDict

Verdict = Literal["en_curso", "verde", "escalado"]

#: Tope de intentos del modelo antes de escalar al humano. No hay nodo Escalation
#: en el MVP (`Plan §6`), asi que "escalar" es parar y decirlo.
#: Por que 3: `Plan §11` dice que con media 1,5 el arnes es viable y con 4 el cuello
#: de botella es la spec. Un tope de 3 deja ver la diferencia y corta antes de que
#: los reintentos se coman la cifra de coste por pantalla.
MAX_ATTEMPTS = 3


class Check(TypedDict):
    """Nunca un booleano suelto: el `detail` es lo que vuelve al Coder como
    feedback, y tiene que ser salida cruda (compilador, test, token infractor)."""
    id: str          # C1 · C2 · C3 · C4
    ok: bool
    detail: str


class HarnessState(TypedDict, total=False):
    task: dict[str, Any]        # tal cual se leyo de harness/tasks/<X>.json
    attempt: int                # empieza en 1; cada valor es una fila del CSV
    files: dict[str, str]       # {ruta: contenido} del ultimo intento del Coder
    checks: list[Check]
    feedback: str               # construido SOLO desde checks
    metrics: list[dict]         # un registro por intento
    verdict: Verdict
