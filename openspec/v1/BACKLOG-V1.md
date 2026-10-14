# Backlog de V1

Lo que está **abierto pero sin fecha y sin dueño de esta semana**: deuda de producto, riesgos aceptados y trabajo que espera a un disparador. **No se lee al arrancar**; `ESTADO-V1.md` solo lleva lo que se está haciendo o bloqueando ahora. Creado el 14-oct-2026 (PO) para aligerar el relevo.

Cada fila dice **qué es**, **qué la activa** (el disparador) y **dónde está el detalle**. Cuando una se activa, vuelve al relevo; cuando se cierra, se borra de aquí y queda en su hallazgo o en `DECISIONES-V1.md`.

| Qué | Disparador | Detalle |
|---|---|---|
| **Riesgo aceptado: privilegios por defecto anchos** (`anon`, `authenticated` y `service_role` reciben `ALL` sobre cada tabla nueva de `public`) | **Se reabre antes de datos reales o de abrir el registro a terceros** | `F-192` (PO, 25-sep) |
| **Salida abrupta del ADMIN**: la recomendación de tener más de un ADMIN no llega a la interfaz | Producto lo prioriza; antes de abrir el registro a terceros | `docs/ADR-002_Ambito_de_visibilidad_por_usuario.md` §10 (Q-1) |
| **VERA no prepara contraofertas ni la respuesta a una consulta concreta, ni nada desde `Comprando`**: solo consulta nueva y oferta directa, con un hilo abierto | Producto lo pide | `DECISIONES-V1.md` (VERA prepara, no envía), `F-249` |
| **`REG-01` aceptada sin logo, sin Google y sin VERA** (sin sesión, `F-223`) | Cuando haya proveedor de identidad y almacenamiento | `F-226` |
| **No existe `Ajustes`**: `Configuración` abre `INVT-01` directamente | Producto | `F-213` |
| **Una cuenta baneada no se puede reinvitar con el mismo correo**; `contact@nortexsys.com` (`CANCELLED` en JULSA) sigue ocupando ese correo | Al diseñar la reinvitación | — |
| **RPC `search_catalog` para la búsqueda cruzada** (entregable 5 de Fundación). `0064` ya bajó la búsqueda de 3,1 s a 45 ms con el catálogo de hoy; con 1M de líneas la política sigue recorriendo la tabla (0,5–2,2 s) y la RPC con índice parcial la dejaría en 50–200 ms. Cambia el cliente y el total pasa a «más de 10.000» | Un catálogo real que pase de ~100.000 líneas, o una prueba de carga | `findings/F-253.md` |
| **Cifras 7 y 8 del umbral de fábrica**: solo `SRCH-03` tiene medida limpia | Una sesión propia por pantalla | `F-205`, `UMBRAL-FABRICA-V1.md` |
| **Vercel en plan gratuito** | Antes de tráfico real o de una demo con cliente | — |
| **VERA sin límite de preguntas por usuario y hora, y sin registro de `usage` por pregunta** (el tope de tamaño por petición sí está) | Antes de abrir el registro a terceros | `F-256` |
| **VERA sin registro de auditoría de sus acciones** (`action-audit-logging`) | Antes de la primera herramienta de VERA que escriba en la base | `F-257` |
| **VERA sin preferencias persistentes** (`profile-context-layer`, «Ajustes → Asistente VERA») | Producto lo prioriza | `F-257` |
| **`navegar` solo lleva a cinco pantallas**: ampliarlo a Empresas y Foros está propuesto (enum de `tools.json`, `SCREENS`, el mensaje de error y la frase del prompt) | El PO decide | `F-255` |

## Decididas y cerradas el 14-oct-2026 (no hay nada que hacer)

- **`Suspender manualmente` no pide confirmación**: se respeta la spec cerrada.
- **Los cobros y la frescura de la demo envejecen con el calendario**: se re-anclan a mano antes de cada demo con `reanchor_freshness.sql` / `demo_reanchor_freshness()`; ver `openspec/mvp/guion-demo-y-siembra.md` §6.
