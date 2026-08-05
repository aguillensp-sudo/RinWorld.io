# Findings Register — MVP Bearingworld.io

Registro de hallazgos del MVP. Clasificación: `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`.

| ID | Fecha | Origen | Síntoma | Clasificación | Capability | Acción en V1 | Estado |
|---|---|---|---|---|---|---|---|
| F-001 | 2026-08-05 | SP-1 / arranque | El plan asumía GLM-5.2 vía DeepInfra. z.ai (directo) se probó pero sin saldo; se cambió a **DeepSeek oficial `deepseek-v4-flash`** por coste. La clave vive en una variable mal nombrada (`DEEPINFRA_API_KEY` contenía una clave de z.ai). | `INFRA` | harness / stack | PO confirmó el cambio (5-ago). **Hecho:** CLAUDE.md + Plan MVP + Día-01 actualizados; clave ya en `DEEPSEEK_API_KEY`. **Pendiente:** Status y Stack Tech v1.2 (.docx), y borrar la var muerta `DEEPINFRA_API_KEY` (acción PO). | En curso |
| F-002 | 2026-08-05 | SP-1 | `deepseek-v4-flash` convierte el HTML aprobado de INV-01 a React con calidad utilizable: **C1 (compila) pass, C4 (idiomático) pass**, C2 (render) fuerte; artefacto válido al primer intento del modelo. Coste ≈ $0.0036/pantalla. | `MODEL` | conversational-search / inventory (Coder) | Si el PO valida C2+C5, DeepSeek entra al camino crítico como nodo Coder. | Abierto — pendiente puerta de decisión (C2, C5) |
| F-003 | 2026-08-05 | SP-1 (C3) | El componente usa bien los tokens de acento pero **inventa colores fuera de paleta**: grises `#e5e7eb`, `#f3f4f6`, `#f8f9fb`, `#374151`, `#4b5563` y rojos/verdes `#ef4444`, `#15803d`, `#b45309` (en vez de `#dc2626`/`#16a34a` del sistema). C3 no pasa estrictamente. | `HARNESS` | design-system | Publicar los tokens como **variables CSS** en design-system.md (§6 Traducción a React) para que el Coder referencie `var(--token)` y no literales; añadir en el Test-runner un check que rechace hex fuera de paleta. | Abierto |
| F-004 | 2026-08-05 | Bloque 1 | `generate_screen.py` traía valores de shell equivocados: nav bar `46px` (real **72px**, era la altura del logo) y color brand/nav `#111827`/`#1B2537` (real **`#07111F`**). | `DESIGN` | design-system | Corregido en `design-system.md`. El generador de un solo agente queda superado; la fuente de verdad es design-system.md. | Cerrado |
| F-005 | 2026-08-05 | SP-1 (arnés) | `max_tokens=8192` truncó la salida de un modelo de razonamiento (`finish_reason: length`), sin artefacto. Corregido a 65536. Coste desperdiciado ≈ $0.0049. | `HARNESS` | harness | Fijar `max_tokens` alto por defecto para modelos de razonamiento; detectar `finish_reason==length` y reintentar con más presupuesto automáticamente. | Cerrado |
| F-006 | 2026-08-05 | SP-3 | Supabase Realtime **propaga entre dos sesiones**: 20/20 inserts sin pérdida, latencia 85–598 ms (<1 s), y la suscripción **se reconecta sola** tras cortar el socket. Proyecto `troxminloxkjwihwfevs` (eu-west-1). | `INFRA` | messaging / realtime | Realtime entra como pilar de "dos usuarios interactuando" — sin plan B de polling. | Cerrado — PASA |
| F-007 | 2026-08-05 | SP-3 | El cliente supabase-js con `eventsPerSecond` por defecto (10) **descartó 6/20** mensajes en ráfaga; subiéndolo a 50 → 20/20. Es throttle del cliente, no límite de infra. | `INFRA` | messaging / realtime | En la app, configurar `realtime.params.eventsPerSecond` según el volumen esperado por hilo; no dejar el default. | Cerrado |

---

## Notas de la puerta de decisión — SP-1 (pendiente cierre por PO)

**Rúbrica (≥3 de 5 para aprobar):**

| # | Criterio | Veredicto |
|---|---|---|
| C1 | Compila (`tsc --noEmit`) | ✅ **pass** (exit 0, sin errores) |
| C2 | Renderiza reconocible vs HTML aprobado | ✅ **pass** — PO 5-ago: "es idéntico, no hay duda" |
| C3 | Usa tokens, no valores inventados | ⚠️ **parcial** (ver F-003) |
| C4 | React idiomático (props tipadas, sin `dangerouslySetInnerHTML`) | ✅ **pass** |
| C5 | ¿Lo mantendrías? | ⏳ **juicio del PO (pesa más)** — pendiente |

**Puerta SUPERADA: 3 de 5 (C1, C2, C4).** DeepSeek-V4-Flash entra al camino crítico como
nodo Coder. C3 es parcial (mitigación en F-003) y C5 queda como matiz del PO; ninguno cambia
el aprobado. Aviso de alcance: el spike generó **solo** el componente `InventoryTable` (la
tabla), no la pantalla INV-01 completa — eso es del día 3 en adelante.
