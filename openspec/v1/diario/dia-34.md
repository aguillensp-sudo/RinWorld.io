# Día 34 · 8-oct-2026

D2 del microplan: cliente y pantalla de la 0055.

- `createOffer()` y `markOutOfStock()` en `thread-detail.ts`; `OfferCounterForm` reutilizado (título, botón y referencia configurables).
- Tarjeta de consulta recibida y Pendiente: «Responder con oferta» y «Sin stock». Pie del hilo: «Crear oferta» (oferta directa). Retirada `CREATE_OFFER_DISABLED_REASON`.
- Fallo propio: «Crear oferta» se pintaba apagado (CSS `cursor: not-allowed`) aunque estaba activo. Arreglado en `29c1774`.
- Malentendido resuelto: «Aceptada» es el estado de la oferta; `ACUERDO ALCANZADO` es el del hilo y solo sale sin nada Pendiente (`derive_thread_state`, 0007). El hilo de demo `…0001` tenía una oferta Pendiente de siembra. Comprobado por SQL.
- Pruebas del PO: casos 1 a 4 OK (consulta con oferta, Sin stock, oferta directa, negativos). No las midió este agente.
- Sin hacer: tests unitarios de `createOffer`/`markOutOfStock`; mirar la CI tras el push.
