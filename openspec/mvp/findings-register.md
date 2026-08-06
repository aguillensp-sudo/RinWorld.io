# Findings Register — MVP Bearingworld.io

Registro de hallazgos del MVP. Clasificación: `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`.

| ID | Fecha | Origen | Síntoma | Clasificación | Capability | Acción en V1 | Estado |
|---|---|---|---|---|---|---|---|
| F-001 | 2026-08-05 | SP-1 / arranque | El plan asumía GLM-5.2 vía DeepInfra. z.ai (directo) se probó pero sin saldo; se cambió a **DeepSeek oficial `deepseek-v4-flash`** por coste. La clave vivía en una variable mal nombrada (`DEEPINFRA_API_KEY` contenía una clave de z.ai). | `INFRA` | harness / stack | PO confirmó el cambio (5-ago). **Hecho:** CLAUDE.md + Plan MVP + Día-01 + Status + Stack Tech v1.2 (.docx) actualizados; clave ya en `DEEPSEEK_API_KEY`; var muerta `DEEPINFRA_API_KEY` borrada. | Cerrado |
| F-002 | 2026-08-05 | SP-1 | `deepseek-v4-flash` convierte el HTML aprobado de INV-01 a React con calidad utilizable: **C1 (compila) pass, C4 (idiomático) pass**, C2 (render) fuerte; artefacto válido al primer intento del modelo. Coste $0.003581 — pero **por un componente y con 99,6% de cache hit**, no por pantalla en frío (ver F-011). | `MODEL` | conversational-search / inventory (Coder) | DeepSeek entra al camino crítico como nodo Coder. | Cerrado — PASA 5/5 (C2 y C5 confirmados por PO) |
| F-003 | 2026-08-05 | SP-1 (C3) | El componente usa bien **todos los tokens definidos**; los grises "inventados" (`#e5e7eb`, `#f3f4f6`, `#374151`, `#4b5563`) rellenan **neutros que el design system aún no define** (bordes, divisores, texto secundario, hover). Único desvío real de un token existente: `#ef4444` en vez de `#dc2626`. C3 = pass con matiz. | `HARNESS` | design-system | Definir en design-system.md los tokens neutros que faltan y publicarlos como **variables CSS** para que el Coder use `var(--token)`; añadir en el Test-runner un check que rechace hex fuera de paleta (habría cazado el `#ef4444`). | Abierto |
| F-004 | 2026-08-05 | Bloque 1 | `generate_screen.py` traía valores de shell equivocados: nav bar `46px` (real **72px**, era la altura del logo) y color brand/nav `#111827`/`#1B2537` (real **`#07111F`**). | `DESIGN` | design-system | Corregido en `design-system.md`. El generador de un solo agente queda superado; la fuente de verdad es design-system.md. | Cerrado |
| F-005 | 2026-08-05 | SP-1 (arnés) | `max_tokens=8192` truncó la salida de un modelo de razonamiento (`finish_reason: length`), sin artefacto. Corregido a 65536. Coste desperdiciado ≈ $0.0049. | `HARNESS` | harness | Fijar `max_tokens` alto por defecto para modelos de razonamiento; detectar `finish_reason==length` y reintentar con más presupuesto automáticamente. | Cerrado |
| F-006 | 2026-08-05 | SP-3 | Supabase Realtime **propaga entre dos sesiones**: 20/20 inserts sin pérdida, latencia 85–598 ms (<1 s), y la suscripción **se reconecta sola** tras cortar el socket. Proyecto `troxminloxkjwihwfevs` (eu-west-1). | `INFRA` | messaging / realtime | Realtime entra como pilar de "dos usuarios interactuando" — sin plan B de polling. | Cerrado — PASA |
| F-007 | 2026-08-05 | SP-3 | El cliente supabase-js con `eventsPerSecond` por defecto (10) **descartó 6/20** mensajes en ráfaga; subiéndolo a 50 → 20/20. Es throttle del cliente, no límite de infra. | `INFRA` | messaging / realtime | En la app, configurar `realtime.params.eventsPerSecond` según el volumen esperado por hilo; no dejar el default. | Cerrado |
| F-008 | 2026-08-05 | SP-2 | El navegador **cifra nativamente extremo a extremo**: `X25519` disponible vía WebCrypto (lo que exige ADR-001), acuerdo ECDH correcto (ambas partes derivan la misma clave AES-256-GCM) y la otra parte descifra la oferta. Resultado **contrario** al que anticipaba el plan (esperaba fallback a P-256). Verificado en Chromium 148 (runtime Electron del navegador). | `SPEC-GAP` | crypto / messaging (E2EE) | Evidencia para **GAP-001**: la balanza se inclina a **WebCrypto nativo (sin `libsodium.js`)** en V1. Antes de retirar el fallback, confirmar soporte X25519 en Safari/Firefox y navegadores objetivo; mantener **ECDH P-256** como plan B mientras tanto. | Abierto — informa GAP-001 |
| F-009 | 2026-08-06 | SP-1 (proceso) | El commit `0623451` lleva `Co-Authored-By: Claude Opus 4.8` sobre código que generó el Coder (`InventoryTable.tsx`, `InventoryTable.module.css`). **No se corrige el trailer:** el commit ya está en `origin/mvp/bootstrap` (exigiría reescritura + force-push) y además **mezcla** salida del Coder con código a mano (`run_deepseek.py`, scaffold Vite, registros), así que ningún trailer único sería correcto — cambiaría un error por otro. La autoría real del artefacto queda trazada por `files` en `metrics/attempt_1.json` y por la columna `ficheros` del CSV. | `HARNESS` | proceso / instrumentación | Regla añadida a `CLAUDE.md` §1.6: trailer `Co-Authored-By: deepseek-v4-flash <coder@harness.local>` en commits de código del Coder, y **nunca** mezclar código del Coder con código a mano en el mismo commit. A partir del día 2 se cumple sin excepción. | Cerrado — `0623451` queda mal atribuido a propósito y documentado aquí |
| F-010 | 2026-08-06 | SP-1 (arnés) | `metrics/attempt_1.json` registró `cost_usd: 0.0` mientras el CSV registraba `0.003581`. El valor correcto es **0.003581** (recomputado con la fórmula y la tabla de precios de `run_deepseek.py`: 18688 hit + 79 miss + 12563 out). Es decir: el artefacto **generado por máquina** era el equivocado y el corregido a mano era el CSV — la asimetría peligrosa, porque el JSON es lo que leerá cualquier agregación futura. Causa del `0.0` no recuperable de git (el spike es un solo commit). | `HARNESS` | harness / instrumentación | JSON corregido a `0.003581` con `cost_usd_source` explicando la recomputación. En el arnés del día 4: el nodo debe **fallar ruidosamente** si la tabla de precios está a cero o ausente, en vez de escribir `0.0`; y el CSV debe generarse *desde* el JSON, no en paralelo a mano. | Abierto |
| F-011 | 2026-08-06 | SP-1 (coste) | El $0.003581 de SP-1 se logró con **99,58% de cache hit** (18688/18767) porque el system prompt se reusó del intento truncado. **No es el coste por pantalla en frío.** Con los mismos tokens y 0% cache: ~$0.006145 (×1,7). Y el prompt de SP-1 sólo pedía *un componente*, no una pantalla completa — el coste real por pantalla del día 3 en adelante será mayor por ambos lados. | `HARNESS` | instrumentación / plan de coste | Anotado en `harness-metrics.csv` y en el JSON. Para extrapolar a V1 usar la cifra en frío, nunca la cacheada. Desde el día 4, registrar `cache_hit_pct` como columna propia del CSV en vez de como nota. | Abierto |

---

## Notas de la puerta de decisión — SP-1 (pendiente cierre por PO)

**Rúbrica (≥3 de 5 para aprobar):**

| # | Criterio | Veredicto |
|---|---|---|
| C1 | Compila (`tsc --noEmit`) | ✅ **pass** (exit 0, sin errores) |
| C2 | Renderiza reconocible vs HTML aprobado | ✅ **pass** — PO 5-ago: "es idéntico, no hay duda" |
| C3 | Usa tokens, no valores inventados | ✅ **pass con matiz** — usa bien todos los tokens definidos; los "inventados" rellenan neutros que el sistema aún no define. Único desvío real: `#ef4444` vs `#dc2626` (ver F-003) |
| C4 | React idiomático (props tipadas, sin `dangerouslySetInnerHTML`) | ✅ **pass** |
| C5 | ¿Lo mantendrías? | ✅ **pass** — PO 5-ago: sí |

**Puerta SUPERADA: 5 de 5.** DeepSeek-V4-Flash entra al camino crítico como nodo Coder. Los
matices (definir tokens neutros y corregir el rojo) están en F-003, no cambian el aprobado.
Aviso de alcance: el spike generó **solo** el componente `InventoryTable` (la tabla), no la
pantalla INV-01 completa — eso es del día 3 en adelante.

---

## Puerta de decisión del día — los tres spikes

| Spike | Pregunta | Resultado | Consecuencia |
|---|---|---|---|
| **SP-1** · Coder | ¿DeepSeek-V4-Flash convierte HTML aprobado a React? | ✅ **PASA 5/5** | DeepSeek al camino crítico como nodo Coder |
| **SP-3** · Realtime | ¿Propaga Supabase entre dos sesiones? | ✅ **PASA** (20/20, <1 s, reconecta solo) | Tiempo real, sin plan B de polling |
| **SP-2** · WebCrypto | ¿Cifra el navegador nativamente? | ✅ **PASA con X25519** (mejor que lo esperado) | Alineado con ADR-001; informa GAP-001 hacia WebCrypto nativo |

**Los tres pasan.** El plan de 15 días sigue tal cual; el día 2 arranca con esquema Supabase y
scaffold React. Único hallazgo que cambia una decisión de spec: SP-2 inclina GAP-001 hacia
WebCrypto nativo (F-008), pendiente de confirmar X25519 en Safari/Firefox antes de retirar el
fallback P-256.
