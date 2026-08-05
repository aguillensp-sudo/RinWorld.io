# Findings Register — MVP Bearingworld.io

Registro de hallazgos del MVP. Clasificación: `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`.

| ID | Fecha | Origen | Síntoma | Clasificación | Capability | Acción en V1 | Estado |
|---|---|---|---|---|---|---|---|
| F-001 | 2026-08-05 | SP-1 / arranque | El plan asumía GLM-5.2 vía DeepInfra. z.ai (directo) se probó pero sin saldo; se cambió a **DeepSeek oficial `deepseek-v4-flash`** por coste. La clave vive en una variable mal nombrada (`DEEPINFRA_API_KEY` contenía una clave de z.ai). | `INFRA` | harness / stack | PO confirmó el cambio (5-ago). **Hecho:** CLAUDE.md + Plan MVP + Día-01 actualizados; clave ya en `DEEPSEEK_API_KEY`. **Pendiente:** Status y Stack Tech v1.2 (.docx), y borrar la var muerta `DEEPINFRA_API_KEY` (acción PO). | En curso |
| F-002 | 2026-08-05 | SP-1 | `deepseek-v4-flash` convierte el HTML aprobado de INV-01 a React con calidad utilizable: **C1 (compila) pass, C4 (idiomático) pass**, C2 (render) fuerte; artefacto válido al primer intento del modelo. Coste ≈ $0.0036/pantalla. | `MODEL` | conversational-search / inventory (Coder) | Si el PO valida C2+C5, DeepSeek entra al camino crítico como nodo Coder. | Abierto — pendiente puerta de decisión (C2, C5) |
| F-003 | 2026-08-05 | SP-1 (C3) | El componente usa bien **todos los tokens definidos**; los grises "inventados" (`#e5e7eb`, `#f3f4f6`, `#374151`, `#4b5563`) rellenan **neutros que el design system aún no define** (bordes, divisores, texto secundario, hover). Único desvío real de un token existente: `#ef4444` en vez de `#dc2626`. C3 = pass con matiz. | `HARNESS` | design-system | Definir en design-system.md los tokens neutros que faltan y publicarlos como **variables CSS** para que el Coder use `var(--token)`; añadir en el Test-runner un check que rechace hex fuera de paleta (habría cazado el `#ef4444`). | Abierto |
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
| C3 | Usa tokens, no valores inventados | ✅ **pass con matiz** — usa bien todos los tokens definidos; los "inventados" rellenan neutros que el sistema aún no define. Único desvío real: `#ef4444` vs `#dc2626` (ver F-003) |
| C4 | React idiomático (props tipadas, sin `dangerouslySetInnerHTML`) | ✅ **pass** |
| C5 | ¿Lo mantendrías? | ✅ **pass** — PO 5-ago: sí |

**Puerta SUPERADA: 5 de 5.** DeepSeek-V4-Flash entra al camino crítico como nodo Coder. Los
matices (definir tokens neutros y corregir el rojo) están en F-003, no cambian el aprobado.
Aviso de alcance: el spike generó **solo** el componente `InventoryTable` (la tabla), no la
pantalla INV-01 completa — eso es del día 3 en adelante.
