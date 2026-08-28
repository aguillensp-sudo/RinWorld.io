"""Tabla de precios para el coste de orquestacion -- el nodo que `pricing.py` no
cubre. Ese modulo tarifa al Coder (DeepSeek); este tarifa las sesiones de Claude
Code que disenan el esquema, escriben el cifrado y revisan cada entrega, que la
Tabla 5 del plan (v2.3) dice sin rodeos que **no estan instrumentadas en ninguna
parte** -- corregirlo es la primera tarea que el propio plan se pone.

Mismo patron que `pricing.py`: fecha de vigencia, aviso de caducidad, y el
instrumento falla ruidosamente ante un modelo sin tarifa conocida en vez de
fingir un coste (F-010).

**Esto es un precio-sombra, no una factura.** El proyecto paga Claude Code por
suscripcion (Max/Pro), no por token: no hay coste marginal real por sesion.
Lo que este modulo calcula es "cuanto costaria facturado por token, a la
tarifa publicada de la API" -- la unica cifra que permite comparar el coste de
orquestar una tarea con el coste de generarla (`harness/core/pricing.py`),
igual de instrumentado.

Fuente: https://platform.claude.com/docs/en/about-claude/pricing, comprobada
el 28-ago-2026. USD por millon de tokens; los tres multiplicadores de cache
(1.25x / 2x / 0.1x sobre el input base) ya vienen aplicados en la tabla, no se
recalculan por formula -- es la tarifa publicada, no una derivacion que se
pueda desviar de ella con el tiempo.
"""
import datetime
import sys

PRICE_TABLE_DATE = "2026-08-28"
STALE_AFTER_DAYS = 90

PRICES = {
    "claude-opus-5": {
        "input": 5.0, "cache_write_5m": 6.25, "cache_write_1h": 10.0,
        "cache_read": 0.50, "output": 25.0,
    },
    "claude-sonnet-5": {
        "input": 2.0, "cache_write_5m": 2.50, "cache_write_1h": 4.0,
        "cache_read": 0.20, "output": 10.0,
    },
    # Fast mode (investigacion): solo Opus 5 / Opus 4.8, mismo cache, input y
    # output a tarifa distinta. Se activa por sesion con `/fast`, asi que se
    # elige por `usage.speed == "fast"` en tiempo de calculo, no por el nombre
    # del modelo que llega en la transcripcion.
    "claude-opus-5:fast": {
        "input": 10.0, "cache_write_5m": 6.25, "cache_write_1h": 10.0,
        "cache_read": 0.50, "output": 50.0,
    },
}

# Mensajes sinteticos que aparecen en las transcripciones sin representar una
# llamada facturable -- limite de sesion alcanzado, "no response requested".
# Van siempre a cero tokens; se excluyen por NOMBRE, no por valor, para que un
# cero de verdad en un modelo facturable no se confunda con esto.
MODELOS_NO_FACTURABLES = {"<synthetic>"}

# inference_geo == "us" en Claude 4.6+: 1.1x sobre las cinco categorias.
# Ninguna transcripcion de este repo lo ha usado hasta hoy (todas "not_available"
# o None), pero el multiplicador esta aqui para no fingir 1.0x el dia que se use.
DATA_RESIDENCY_MULTIPLIER = 1.1

WEB_SEARCH_USD_PER_1000 = 10.0  # aparte de los tokens; el resto de herramientas
                                # server-side (web fetch, code execution con
                                # busqueda) no llevan coste propio (ver la pagina
                                # de precios, seccion "Feature-specific pricing").


class PriceTableError(RuntimeError):
    """Version orquestacion de F-010. Se lanza en vez de registrar un coste falso."""


def _tarifa(model: str, speed: str | None) -> dict:
    key = f"{model}:fast" if speed == "fast" else model
    if key not in PRICES:
        raise PriceTableError(
            f"Modelo sin tarifa conocida: {model!r} (speed={speed!r}). Anade su "
            f"fila a PRICES en orchestration_pricing.py con el precio publicado "
            f"en platform.claude.com/docs/en/about-claude/pricing antes de seguir "
            f"-- no se calcula un coste con una tarifa que no se ha mirado."
        )
    return PRICES[key]


def cost_usd(model: str, usage: dict) -> float:
    """Coste-sombra de un turno, a partir del `usage` tal como lo devuelve la
    API de Anthropic: input base, cache de escritura partido en 5m/1h, cache de
    lectura, output, mas busqueda web si la hubo."""
    if model in MODELOS_NO_FACTURABLES:
        return 0.0

    tarifa = _tarifa(model, usage.get("speed"))
    cache = usage.get("cache_creation") or {}
    coste = (
        usage.get("input_tokens", 0) / 1e6 * tarifa["input"]
        + cache.get("ephemeral_5m_input_tokens", 0) / 1e6 * tarifa["cache_write_5m"]
        + cache.get("ephemeral_1h_input_tokens", 0) / 1e6 * tarifa["cache_write_1h"]
        + usage.get("cache_read_input_tokens", 0) / 1e6 * tarifa["cache_read"]
        + usage.get("output_tokens", 0) / 1e6 * tarifa["output"]
    )

    busquedas = (usage.get("server_tool_use") or {}).get("web_search_requests", 0)
    coste += busquedas / 1000 * WEB_SEARCH_USD_PER_1000

    if usage.get("inference_geo") == "us":
        coste *= DATA_RESIDENCY_MULTIPLIER

    return coste


def check_prices() -> str | None:
    """Avisa si la tabla lleva mucho sin revisarse. No bloquea -- una tabla
    vieja puede seguir siendo la vigente (mismo razonamiento que `pricing.py`)."""
    dias = (datetime.date.today() - datetime.date.fromisoformat(PRICE_TABLE_DATE)).days
    if dias > STALE_AFTER_DAYS:
        aviso = (
            f"AVISO: la tabla de precios de orquestacion es del {PRICE_TABLE_DATE}, "
            f"hace {dias} dias (> {STALE_AFTER_DAYS}). Verifica la tarifa vigente en "
            f"platform.claude.com/docs/en/about-claude/pricing antes de fiarte del "
            f"coste-sombra que calcule esta corrida."
        )
        print(aviso, file=sys.stderr)
        return aviso
    return None
