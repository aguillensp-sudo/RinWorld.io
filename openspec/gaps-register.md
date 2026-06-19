# Registro Maestro de Gaps — Bearingworld.io

Documento transversal a todas las capabilities. Actualizado a medida que se detectan o cierran gaps durante la fase de análisis técnico.

| ID | Gap | Origen | Capability(es) afectada(s) | Tipo | Estado |
|---|---|---|---|---|---|
| GAP-001 | ADR-002 pendiente: selección del adaptador Signal Protocol (`libsodium.js` vs. `@privacyresearch/libsignal-protocol-typescript`). Decisión técnica de implementación; no afecta a requisitos de comportamiento observable. | ADR-001, sección 10 | e2ee-key-management, messaging-and-negotiation | NO BLOQUEANTE | ABIERTO |
| GAP-002 | Política de fortaleza de passphrase: ¿se impone entropía mínima (zxcvbn score ≥ 3) o se deja libre al miembro? El ADR recomienda imponer pero no lo decide formalmente. | ADR-001, sección 10 | e2ee-key-management | NO BLOQUEANTE | ABIERTO |
| GAP-003 | Parámetros Argon2id sujetos a revisión cada 12 meses o cuando cambie el hardware. Los parámetros actuales (m=65536, t=3, p=4) están basados en benchmarks de junio 2026. El requisito deberá ser revisable sin reescribir el spec. | ADR-001, sección 10 | e2ee-key-management | NO BLOQUEANTE | ABIERTO |
| GAP-004 | Boundary exacto entre `conversational-search` y `messaging-and-negotiation` en el flujo de tarjeta de consulta. ¿La acción "Consultar Seleccionados" pertenece al dominio de búsqueda o al de mensajería? | Módulo 03 v1.6 + Módulo 04 v1.5, Inventario de Pantallas v1.1 | conversational-search, messaging-and-negotiation | NO BLOQUEANTE | CERRADO — Junio 2026 / Product Owner / Resolución: la selección y el disparo de la acción pertenecen a conversational-search; la gestión del hilo, tarjeta de consulta y cifrado E2EE pertenecen a messaging-and-negotiation. |

---

## Entradas cerradas

_Ninguna por ahora._