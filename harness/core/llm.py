"""Cliente del modelo y contabilidad de tokens.

Extraido de `harness/dia-03-catalogo/run_coder.py` (lineas 197-237 y 258-283) sin
cambiar la logica. Sigue siendo `urllib` a proposito: una dependencia menos que
instalar en la maquina que corre el arnes, y el endpoint es compatible OpenAI.

  F-005 · `max_tokens` alto por defecto y reintento automatico ante
          `finish_reason == 'length'`, doblando el presupuesto. El coste del
          intento suma **todas** las llamadas que hicieron falta, no solo la
          ultima: en SP-1 un truncado se cobro $0.0049 y no dejo artefacto.

**El reintento por truncado NO es un intento del modelo.** Es un bug de arnes, y
asi esta registrado en la primera fila de `harness-metrics.csv`. Quien cuenta
intentos es el grafo, no este modulo.
"""
import json
import os
import socket
import time
import urllib.error
import urllib.request

MODEL = os.environ.get("HARNESS_CODER_MODEL", "deepseek-v4-flash")
BASE = os.environ.get("HARNESS_CODER_BASE", "https://api.deepseek.com")
DEFAULT_MAX_TOKENS = int(os.environ.get("DS_MAX_TOKENS", "65536"))
TRUNCATION_RETRIES = 3

# -----------------------------------------------------------------------------
# Un segundo proveedor sin tocar el primero (experimento de dos brazos, 19-sep).
#
# `MODEL` y `BASE` ya se podian cambiar por entorno; la clave y el techo de salida
# no. Estas dos variables son las que faltaban, y **sin definirlas el arnes hace
# exactamente lo mismo que antes**: misma clave, mismo cuerpo de peticion, mismo
# doblado de F-005. Lo prueba `test_segundo_proveedor_no_toca_el_primero`.
#
#   HARNESS_CODER_KEY_ENV · el NOMBRE de la variable que guarda la clave, nunca la
#       clave (CLAUDE.md §1.1). Por defecto `DEEPSEEK_API_KEY`.
#   HARNESS_CODER_MAX_TOKENS_CAP · el techo de `max_tokens` que acepta el
#       proveedor; 0 = sin techo. Atria rechaza por encima de 65536
#       (api.atria-asi.ai/docs) y F-005 dobla el presupuesto en cada truncado: sin
#       techo, el reintento del truncado seria un HTTP 400 y el intento se perderia
#       por un error del arnes, no del modelo.
# -----------------------------------------------------------------------------
KEY_ENV = os.environ.get("HARNESS_CODER_KEY_ENV", "DEEPSEEK_API_KEY")
MAX_TOKENS_CAP = int(os.environ.get("HARNESS_CODER_MAX_TOKENS_CAP", "0"))

# -----------------------------------------------------------------------------
# HARNESS_CODER_STREAM · pedir la respuesta por trozos (20-sep, y lo pidio una
# corrida muerta, no una preferencia).
#
# Las dos corridas de Atria del 20-sep murieron con **HTTP 502
# `upstream_unavailable`** a los 5m17s y 5m40s, mientras la sonda -una respuesta
# corta- contestaba en 5 s. No es un fallo transitorio: es que su pasarela no
# aguanta una peticion SIN streaming tanto rato. Subir el timeout no arregla
# nada, porque quien corta es el otro extremo.
#
# Con `stream`, los bytes salen desde el primer token y la conexion nunca esta
# en silencio. Lo que NO cambia: ni el prompt, ni `max_tokens`, ni la
# temperatura, ni lo que el grafo recibe — esta funcion devuelve exactamente la
# misma forma de respuesta, reensamblada. Es como llegan los bytes, no que se
# pide.
#
# `stream_options.include_usage` es obligatorio para nosotros: sin `usage` no
# hay tokens, y sin tokens no hay coste. Si el proveedor no lo manda, esto FALLA
# en vez de registrar ceros (F-010).
# -----------------------------------------------------------------------------
STREAM = os.environ.get("HARNESS_CODER_STREAM", "") == "1"


class LLMError(RuntimeError):
    pass


class StreamCortado(LLMError):
    """El otro extremo cerro a media generacion: ni `[DONE]` ni `usage`.

    Es un CORTE DE CONEXION con otra forma, asi que entra donde F-119 puso los
    cortes: no gasta intento del modelo y se reintenta con espera creciente. La
    diferencia con un HTTP 502 es real —alli el servidor CONTESTA que no puede;
    aqui acepta, empieza a contestar y se queda a medias— y la consecuencia es
    la contraria: reintentar esto si puede cambiar el resultado.

    ⚠ Lo que se pierde y no se puede recuperar: los tokens que el proveedor ya
    genero antes del corte. No vienen en ningun `usage`, asi que no se registran
    y la cuota los ha pagado igual. Queda dicho aqui porque el CSV no puede."""


def new_acc() -> dict:
    return {"tokens_in": 0, "tokens_out": 0, "cache_hit": 0, "cache_miss": 0, "calls": 0}


def accumulate(usage: dict, acc: dict) -> dict:
    """Suma el usage de varias llamadas. Ver F-005: si hubo reintento por truncado,
    el coste del intento es el de TODAS las llamadas."""
    prompt = usage.get("prompt_tokens", 0)
    if "prompt_cache_hit_tokens" in usage:
        hit = usage.get("prompt_cache_hit_tokens") or 0
    else:
        # El cache hit tiene dos formas. DeepSeek lo da en la raiz (arriba); la
        # forma estandar de OpenAI, en `prompt_tokens_details.cached_tokens`. Sin
        # esta rama, un proveedor con cache la veria entera como miss: coste
        # inflado y un `cache_hit_pct` de 0 que no es un dato, es una ceguera.
        hit = (usage.get("prompt_tokens_details") or {}).get("cached_tokens") or 0
    acc["tokens_in"] += prompt
    acc["tokens_out"] += usage.get("completion_tokens", 0)
    acc["cache_hit"] += hit
    acc["cache_miss"] += usage.get("prompt_cache_miss_tokens", prompt - hit)
    acc["calls"] += 1
    return acc


# -----------------------------------------------------------------------------
# F-119 · un fallo de transporte NO es un intento del modelo, y una corrida
# colgada no puede ser indistinguible de una lenta.
#
# El 28-ago la remedicion perdio DOS de las cuatro tareas sin dejar ni una fila:
#
#   MSG-01 · `ConnectionResetError [WinError 10054]` en el intento 1. El grafo
#     murio con la excepcion y se llevo la corrida entera: cero metricas de algo
#     que ya se habia pagado a medias.
#   VND-01 · **tres horas** colgada en la primera llamada, con el log a cero
#     bytes. El `timeout` estaba en 1800 s POR LLAMADA, asi que media hora de
#     silencio era comportamiento nominal y no habia forma de distinguirla de
#     una respuesta lenta sin mirar el reloj.
#
# El criterio es el que ya fijo F-005 para el truncado y aqui faltaba: lo que
# falla por debajo del modelo no gasta intento. Un corte de conexion se
# reintenta con espera creciente; lo que el servidor conteste —un HTTP 4xx, una
# clave mala— no, porque reintentar eso es gastar sin cambiar nada.
#
# El timeout baja de 1800 a 300 s. Una respuesta del Coder tardo como mucho 6,4
# minutos de intento COMPLETO (PANEL-01, 28-ago) y eso incluye los checks; cinco
# minutos de silencio en una sola llamada ya es un cuelgue, no una espera.
# -----------------------------------------------------------------------------
TIMEOUT = int(os.environ.get("HARNESS_CODER_TIMEOUT", "300"))
TRANSPORT_RETRIES = 3
TRANSPORT_BACKOFF = (5, 20, 60)


def _es_de_transporte(e: Exception) -> bool:
    """Se cayo la conexion, no contesto el servidor. `HTTPError` NO entra: eso
    es una respuesta, y una respuesta no se reintenta a ciegas."""
    if isinstance(e, StreamCortado):
        return True
    return isinstance(e, (urllib.error.URLError, TimeoutError, ConnectionError,
                          socket.timeout, OSError)) and not isinstance(
                              e, urllib.error.HTTPError)


def _reensamblar(respuesta) -> dict:
    """Los trozos de un `stream` SSE, con la forma de una respuesta normal.

    Devuelve lo mismo que devolveria la llamada sin streaming, para que ni
    `complete()` ni el grafo sepan por que via llegaron los bytes."""
    contenido, razonamiento, finish, usage, modelo = [], [], None, None, MODEL
    completo = False
    for cruda in respuesta:
        linea = cruda.decode("utf-8", "replace").strip()
        if not linea.startswith("data:"):
            continue
        dato = linea[5:].strip()
        if dato == "[DONE]":
            completo = True
            break
        try:
            trozo = json.loads(dato)
        except json.JSONDecodeError as e:
            raise LLMError(f"trozo de stream ilegible: {dato[:200]}") from e
        if trozo.get("error"):
            # Un error a mitad del stream llega con HTTP 200 ya enviado.
            raise LLMError(f"error dentro del stream: {json.dumps(trozo['error'])[:300]}")
        modelo = trozo.get("model") or modelo
        if trozo.get("usage"):
            usage = trozo["usage"]
        for choice in trozo.get("choices") or []:
            delta = choice.get("delta") or {}
            if delta.get("content"):
                contenido.append(delta["content"])
            if delta.get("reasoning_content"):
                razonamiento.append(delta["reasoning_content"])
            if choice.get("finish_reason"):
                finish = choice["finish_reason"]
    if usage is None:
        # F-010 · sin `usage` no hay tokens, y sin tokens el coste seria inventado.
        #
        # ⚠ Pero PRIMERO hay que decir cual de las dos cosas paso, porque el
        # arreglo no es el mismo y el primer mensaje que escribi acusaba a la
        # equivocada: sin `[DONE]` el stream se CORTO -el otro extremo cerro a
        # media generacion- y con `[DONE]` el proveedor si ignora
        # `include_usage`. Un diagnostico equivocado en el log le cuesta una hora
        # a quien lo lea.
        escritos = sum(len(t) for t in contenido)
        if not completo:
            raise StreamCortado(
                f"el stream se CORTO a media respuesta: ni `[DONE]` ni `usage` "
                f"despues de {escritos} caracteres"
                + (f" (finish_reason={finish!r})" if finish else " (sin finish_reason)")
                + ". No es que falte el usage: es que el otro extremo cerro. Lo que "
                  "haya llegado no se puede dar por respuesta ni cobrar (F-010).")
        raise LLMError(
            f"el stream termino en `[DONE]` pero sin `usage` tras {escritos} "
            f"caracteres: el proveedor ignora `stream_options.include_usage`. Sin "
            f"tokens no se puede registrar el coste y registrar cero seria mentir "
            f"(F-010). Corre este brazo sin `HARNESS_CODER_STREAM`.")
    return {
        "model": modelo,
        "choices": [{
            "message": {"content": "".join(contenido),
                        "reasoning_content": "".join(razonamiento)},
            "finish_reason": finish,
        }],
        "usage": usage,
    }


def call(messages: list, max_tokens: int, aviso=None) -> tuple:
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        raise LLMError(f"{KEY_ENV} no esta en el entorno.")
    peticion = {
        "model": MODEL, "messages": messages,
        "max_tokens": max_tokens, "temperature": 0,
    }
    if STREAM:
        peticion["stream"] = True
        peticion["stream_options"] = {"include_usage": True}
    body = json.dumps(peticion).encode()
    req = urllib.request.Request(
        BASE + "/chat/completions", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})

    t0 = time.time()
    for vuelta in range(TRANSPORT_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                datos = _reensamblar(r) if STREAM else json.load(r)
                return datos, time.time() - t0
        except urllib.error.HTTPError as e:
            raise LLMError(f"HTTP {e.code} {e.read().decode()[:500]}") from e
        except Exception as e:                                  # noqa: BLE001
            if not _es_de_transporte(e) or vuelta == TRANSPORT_RETRIES - 1:
                raise LLMError(
                    f"transporte: {type(e).__name__}: {e}. "
                    f"{vuelta + 1} intento(s) de conexion, ninguno llego") from e
            espera = TRANSPORT_BACKOFF[vuelta]
            if aviso:
                aviso(f"  ⚠ {type(e).__name__}: {e}. No es un intento del modelo "
                      f"(F-119): reintento en {espera}s")
            time.sleep(espera)
    raise LLMError("transporte: bucle de reintentos agotado sin respuesta")


def complete(messages: list, max_tokens: int = None, on_truncation=None,
             aviso=None) -> dict:
    """Una respuesta completa del modelo, reintentando si se trunca (F-005).

    Devuelve el bloque con todo lo que el grafo necesita para decidir y para
    facturar: contenido, razonamiento, acumulador de usage, segundos y en que
    presupuestos se trunco.
    """
    maxtok = max_tokens or DEFAULT_MAX_TOKENS
    if MAX_TOKENS_CAP:
        maxtok = min(maxtok, MAX_TOKENS_CAP)
    acc = new_acc()
    secs_total = 0.0
    truncations = []
    content = reasoning = ""
    finish = None

    for _ in range(TRUNCATION_RETRIES):
        data, secs = call(messages, maxtok, aviso=aviso)
        secs_total += secs
        # Un 200 con una forma que no es la esperada moria aqui con un `KeyError:
        # choices` y una traza sin el cuerpo: el veredicto sobrevivia y la razon
        # no, otra vez. Con dos proveedores la forma deja de ser una certeza, asi
        # que se dice QUE llego. El camino de DeepSeek no lo pisa nunca.
        if not (data.get("choices") or []):
            raise LLMError(
                f"respuesta sin `choices` de {MODEL}: {json.dumps(data)[:500]}")
        choice = data["choices"][0]
        content = choice["message"]["content"] or ""
        reasoning = choice["message"].get("reasoning_content") or ""
        finish = choice.get("finish_reason")
        accumulate(data.get("usage", {}), acc)

        if finish != "length":
            break
        truncations.append(maxtok)
        siguiente = min(maxtok * 2, MAX_TOKENS_CAP) if MAX_TOKENS_CAP else maxtok * 2
        if siguiente == maxtok:
            # Ya en el techo del proveedor. La misma peticion, a temperatura 0 y
            # con el mismo presupuesto, se trunca en el mismo sitio: repetirla es
            # pagar dos veces el mismo truncado. Se entrega lo que hay y el
            # registro lo dice (`truncated_at`, `finish_reason`).
            if aviso:
                aviso(f"  TRUNCADO en el techo del proveedor (max_tokens={maxtok}): "
                      f"no se reintenta, pedir lo mismo no cambia nada (F-005)")
            break
        maxtok = siguiente
        if on_truncation:
            on_truncation(maxtok)

    return {
        "content": content, "reasoning": reasoning, "finish_reason": finish,
        "acc": acc, "seconds": round(secs_total, 1), "truncated_at": truncations,
    }
