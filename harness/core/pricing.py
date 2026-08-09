"""Tabla de precios y calculo de coste.

Extraido de `harness/dia-03-catalogo/run_coder.py` (lineas 45-63 y 291-293) sin
cambiar la logica. Aqui se cierran dos hallazgos:

  F-010 · si la tabla de precios esta a cero o ausente, **peta**. Un `cost_usd: 0.0`
          en un JSON no se distingue de una llamada gratis y contamina toda
          agregacion posterior. Paso de verdad: el JSON de maquina registro 0.0
          mientras el CSV a mano tenia el valor bueno.
  F-011 · dos cifras siempre: la real de la corrida y la equivalente en frio. Un
          coste con cache alto no se extrapola nunca a coste por pantalla (el de
          SP-1 llevaba 99,58% de cache y se tomo por representativo).
"""
import os
import sys

# Precio por millon de tokens (USD) — deepseek-v4-flash, ago 2026.
PRICE_IN_HIT = float(os.environ.get("DS_PRICE_IN_HIT", "0.0028"))
PRICE_IN_MISS = float(os.environ.get("DS_PRICE_IN_MISS", "0.14"))
PRICE_OUT = float(os.environ.get("DS_PRICE_OUT", "0.28"))


class PriceTableError(RuntimeError):
    """F-010. Se lanza en vez de escribir un coste falso."""


def check_prices() -> None:
    """F-010. Mejor no arrancar que registrar un coste que no es coste."""
    for name, value in (
        ("DS_PRICE_IN_HIT", PRICE_IN_HIT),
        ("DS_PRICE_IN_MISS", PRICE_IN_MISS),
        ("DS_PRICE_OUT", PRICE_OUT),
    ):
        if value <= 0:
            raise PriceTableError(
                f"ERROR (F-010): {name} = {value}. La tabla de precios no puede estar "
                f"a cero: el coste registrado seria falso. Corrige la variable y repite."
            )


def cost_usd(cache_hit: int, cache_miss: int, tokens_out: int) -> float:
    """Coste real de la corrida, con el cache que de verdad hubo."""
    return (
        cache_hit / 1e6 * PRICE_IN_HIT
        + cache_miss / 1e6 * PRICE_IN_MISS
        + tokens_out / 1e6 * PRICE_OUT
    )


def cost_usd_cold(tokens_in: int, tokens_out: int) -> float:
    """F-011. La cifra extrapolable a V1: todo el input a precio de miss."""
    return tokens_in / 1e6 * PRICE_IN_MISS + tokens_out / 1e6 * PRICE_OUT


def cache_hit_pct(cache_hit: int, tokens_in: int) -> float:
    return round(cache_hit / tokens_in * 100, 2) if tokens_in else 0.0


def table() -> dict:
    return {"in_hit": PRICE_IN_HIT, "in_miss": PRICE_IN_MISS, "out": PRICE_OUT}


def check_prices_or_exit() -> None:
    """Para los puntos de entrada de linea de comandos, que prefieren un mensaje
    limpio a una traza."""
    try:
        check_prices()
    except PriceTableError as e:
        sys.exit(str(e))
