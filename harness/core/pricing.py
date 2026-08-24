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

F-010, UNA VUELTA MAS ARRIBA (25-ago) · este modulo se escribio para que no se
pudiera registrar un coste falso, y trece dias registro uno: los 0.0028/0.14/0.28
de aqui abajo eran la tarifa del viejo `deepseek-chat`, no la de
`deepseek-v4-flash` que de verdad se estaba pagando. `check_prices()` comprobaba
que el precio fuera > 0, no que fuera EL VIGENTE — un precio equivocado pero
positivo pasa esa guardia igual que uno correcto. Las 30 filas del MVP,
recalculadas con la tarifa real, pasan de 0.41 USD registrados a 1.88 USD (x4.58).
`PRICE_TABLE_DATE` y el aviso de `check_prices()` no evitan que esto vuelva a
pasar: avisan cuando la tabla lleva demasiado sin revisarse, que es lo maximo que
puede hacer un modulo que no sabe ir el solo a mirar el precio de mercado.
"""
import datetime
import os
import sys

# Precio por millon de tokens (USD) — deepseek-v4-flash, hora punta.
# Valle (no usado por defecto: es la cifra optimista): 0.007 / 0.22 / 0.66.
# Punta es la conservadora y la que se usa como defecto porque el arnes no sabe
# a que hora se ejecutara.
PRICE_IN_HIT = float(os.environ.get("DS_PRICE_IN_HIT", "0.014"))
PRICE_IN_MISS = float(os.environ.get("DS_PRICE_IN_MISS", "0.44"))
PRICE_OUT = float(os.environ.get("DS_PRICE_OUT", "1.32"))

# Fecha en que se verifico esta tabla contra la tarifa publicada. No hay forma
# de que el codigo sepa si deepseek la ha cambiado desde entonces — solo de
# avisar cuando lleva mucho sin mirarse (ver F-010 arriba).
PRICE_TABLE_DATE = "2026-08-25"
STALE_AFTER_DAYS = 90


class PriceTableError(RuntimeError):
    """F-010. Se lanza en vez de escribir un coste falso."""


def check_prices() -> str | None:
    """F-010. Mejor no arrancar que registrar un coste que no es coste.

    Esto sigue sin poder detectar un precio EQUIVOCADO (ese es el fallo de arriba
    del docstring): solo detecta ausente o a cero. Lo unico que se añade aqui es
    la caducidad — que la tabla lleve mas de `STALE_AFTER_DAYS` sin revisarse—, y
    esa SI se puede detectar sin saber cual es el precio correcto. Por eso AVISA
    en vez de fallar: una tabla vieja puede seguir siendo la vigente, y bloquear
    la corrida por precaucion seria el mismo error al reves.
    """
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

    dias = (datetime.date.today() - datetime.date.fromisoformat(PRICE_TABLE_DATE)).days
    if dias > STALE_AFTER_DAYS:
        aviso = (
            f"AVISO (F-010): la tabla de precios es del {PRICE_TABLE_DATE}, hace "
            f"{dias} dias (> {STALE_AFTER_DAYS}). Verifica la tarifa vigente de "
            f"deepseek-v4-flash antes de fiarte del coste que registre esta corrida."
        )
        print(aviso, file=sys.stderr)
        return aviso
    return None


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
    return {"in_hit": PRICE_IN_HIT, "in_miss": PRICE_IN_MISS, "out": PRICE_OUT,
            "date": PRICE_TABLE_DATE}


def check_prices_or_exit() -> None:
    """Para los puntos de entrada de linea de comandos, que prefieren un mensaje
    limpio a una traza."""
    try:
        check_prices()
    except PriceTableError as e:
        sys.exit(str(e))
