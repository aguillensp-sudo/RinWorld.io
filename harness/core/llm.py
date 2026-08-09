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
import time
import urllib.error
import urllib.request

MODEL = os.environ.get("HARNESS_CODER_MODEL", "deepseek-v4-flash")
BASE = os.environ.get("HARNESS_CODER_BASE", "https://api.deepseek.com")
DEFAULT_MAX_TOKENS = int(os.environ.get("DS_MAX_TOKENS", "65536"))
TRUNCATION_RETRIES = 3


class LLMError(RuntimeError):
    pass


def new_acc() -> dict:
    return {"tokens_in": 0, "tokens_out": 0, "cache_hit": 0, "cache_miss": 0, "calls": 0}


def accumulate(usage: dict, acc: dict) -> dict:
    """Suma el usage de varias llamadas. Ver F-005: si hubo reintento por truncado,
    el coste del intento es el de TODAS las llamadas."""
    prompt = usage.get("prompt_tokens", 0)
    hit = usage.get("prompt_cache_hit_tokens") or 0
    acc["tokens_in"] += prompt
    acc["tokens_out"] += usage.get("completion_tokens", 0)
    acc["cache_hit"] += hit
    acc["cache_miss"] += usage.get("prompt_cache_miss_tokens", prompt - hit)
    acc["calls"] += 1
    return acc


def call(messages: list, max_tokens: int) -> tuple:
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise LLMError("DEEPSEEK_API_KEY no esta en el entorno.")
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
        raise LLMError(f"HTTP {e.code} {e.read().decode()[:500]}") from e
    return data, time.time() - t0


def complete(messages: list, max_tokens: int = None, on_truncation=None) -> dict:
    """Una respuesta completa del modelo, reintentando si se trunca (F-005).

    Devuelve el bloque con todo lo que el grafo necesita para decidir y para
    facturar: contenido, razonamiento, acumulador de usage, segundos y en que
    presupuestos se trunco.
    """
    maxtok = max_tokens or DEFAULT_MAX_TOKENS
    acc = new_acc()
    secs_total = 0.0
    truncations = []
    content = reasoning = ""
    finish = None

    for _ in range(TRUNCATION_RETRIES):
        data, secs = call(messages, maxtok)
        secs_total += secs
        choice = data["choices"][0]
        content = choice["message"]["content"] or ""
        reasoning = choice["message"].get("reasoning_content") or ""
        finish = choice.get("finish_reason")
        accumulate(data.get("usage", {}), acc)

        if finish != "length":
            break
        truncations.append(maxtok)
        maxtok *= 2
        if on_truncation:
            on_truncation(maxtok)

    return {
        "content": content, "reasoning": reasoning, "finish_reason": finish,
        "acc": acc, "seconds": round(secs_total, 1), "truncated_at": truncations,
    }
