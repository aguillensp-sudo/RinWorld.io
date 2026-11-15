# Tareas: amend-msg-hilos-pestanas-y-etiqueta

Reparto según `design.md` §9 y CLAUDE.md §3. El Coder nunca escribe los tests que lo evalúan.

## 0. Decisiones y documentos
- [x] 0.1 Acuerdos del PO en `docs/Cambios_Frontend_Hilos.md` y fila en `DECISIONES-V1.md` (14-nov-2026).
- [x] 0.2 Menú y accesos resueltos por el PO (15-nov-2026, proposal).
- [x] 0.3 `design.md` escrito (15-nov-2026).
- [ ] 0.4 Qué pestaña abre VERA al preparar una consulta u oferta en el hilo. **Pendiente del PO; no bloquea nada de
      lo de abajo** (la ruta ya admite `?tab=`, `design.md` §4).

## 1. Base de datos (a mano)
- [x] 1.1 `supabase/tests/12_etiqueta_mensaje.sql`: los casos de `design.md` §8 más cinco de forma (otro hilo, otra
      marca, mayúsculas, solo una de las dos columnas, etiqueta con cantidad) y la siembra con etiqueta inventada.
      Comprobado en rojo antes de la migración (15-nov-2026): lo rechazaba `thread_items_shape_chk`.
- [x] 1.2 `0080_etiqueta_de_referencia_en_mensajes.sql`:
      `thread_items_shape_chk` (rama `MENSAJE`: los dos o ninguno), trigger `app.validate_message_tag()` y excepción en
      `app.guard_thread_item_integrity()` solo para la organización emisora de un `MENSAJE`.
- [x] 1.3 Verde en el banco (`run.sh` completo, 15-nov-2026: esquema, privilegios, catálogo y frescura). No entra en la
      superficie auditada de F-155: `validate_message_tag` es `security definer`, y esa superficie es la de las
      funciones `invoker`.
- [x] 1.4 Aplicada por el MCP en `bearingworld-e2e` y en producción (15-nov-2026).
- [x] 1.5 Comprobado contra el catálogo en los dos entornos (15-nov-2026): `0080` es la última migración, constraint
      nueva, trigger `BEFORE INSERT OR UPDATE OF part_number, brand`, función `security definer` sin `EXECUTE` para
      `anon`, guardia con el bloque de `0080`. Ningún mensaje lleva etiqueta (producción, 0 de 5; e2e, 0 de 2).

- [x] 1.6 `0081_create_thread_item_con_etiqueta.sql`: la RPC con la que la app envía mensajes acepta la etiqueta
      (`p_part_number`, `p_brand`, `default null`). Casos en `12_etiqueta_mensaje.sql` §7, rojo y después verde.
      Aplicada en e2e y producción el 15-nov-2026; en el catálogo de los dos queda una sola firma, de siete
      argumentos, `invoker`, con `EXECUTE` para `authenticated` y no para `anon`.

## 2. Lógica (`app/src/lib/negotiation-tables.ts`, a mano)
- [ ] 2.1 Unitarios en rojo (`negotiation-tables.test.ts`), los de `design.md` §8.
- [ ] 2.2 Cadenas (`design.md` §2.1): raíz, papel y último elemento.
- [ ] 2.3 Filas por `(part_number, brand, papel)`, con la cadena del último movimiento (§2.2).
- [ ] 2.4 Estado y acciones según la tabla de §2.3, con las acciones sacadas de `offerActions`.
- [ ] 2.5 Valores para pintar y valores para filtrar y ordenar; fecha `12 nov 2026` (§3).
- [ ] 2.6 Filtros combinables y orden (§3), como funciones puras que reciben las filas.
- [ ] 2.7 Referencias del hilo para «Sobre:» y para el buscador, con la coincidencia de §5.
- [ ] 2.8 Escritura de la etiqueta: insertar `MENSAJE` con `part_number`/`brand` y cambiarla después (en
      `thread-detail.ts`, junto al envío de mensajes de hoy).
- [ ] 2.9 Retirar `inquiryRows`, `offerRows` y los textos de las tablas de MSG-03 v1.2 cuando nada los use.

## 3. Contrato de aceptación (a mano, antes del Coder)
- [ ] 3.1 `app/e2e/thread-tabs.spec.ts`: un escenario por requirement nuevo de la spec (accesos, pestañas, tablas por
      papel, etiqueta, búsqueda), con Alpha y Beta. Commit en rojo con `[skip ci]` (CLAUDE.md §1.6).
- [ ] 3.2 Ajustar `messages.spec.ts`: lo que hoy prueba las dos tablas y el historial ascendente pasa a lo nuevo o se
      borra. Comprobar que `fixture.setup.ts` siembra lo que necesitan los escenarios (consulta sin responder, oferta
      directa, contraoferta, sin stock, una referencia en las dos tablas).

## 4. Pantalla (Coder, por el arnés)
- [ ] 4.1 `Thread.tsx` con pestañas, `?tab=` y `?ref=` (`design.md` §4).
- [ ] 4.2 `MessagesTab`: campo de escribir y «Sobre:» arriba, lista descendente, etiqueta en cada mensaje y cambio de
      etiqueta para el emisor, «Ver lo que ve el servidor» (§4.1) y vista filtrada por referencia (§5).
- [ ] 4.3 `NegotiationTable` (una para los dos papeles): columnas, notas en tooltip, filtros por cabecera, orden, y
      pulsar la Referencia lleva a Mensajes con «Sobre:» elegido.
- [ ] 4.4 Buscador abajo, en las tres pestañas, con lista de coincidencias y aviso sin coincidencias.
- [ ] 4.5 Retirar `ThreadHistory`, `InquiriesTable` y `OffersTable`.
- [ ] 4.6 Cada corrida, fila en `harness-metrics.csv` (CLAUDE.md §6). Artefacto del Coder y revisión a mano en
      commits separados.

## 5. Accesos y VERA (a mano)
- [ ] 5.1 Comprobar que Vendiendo (Ver hilo, Ver acuerdo), Comprando (Contactar), Empresas (tarjeta, Contactar),
      Panel (cajón Hilos) y el menú llevan a donde dice la spec, sin `tab`.
- [ ] 5.2 Revisar las herramientas de VERA que leen el hilo con mensajes etiquetados (`design.md` §6). Si alguna supone
      `part_number is null` en un `MENSAJE`, corregirla aquí.

## 6. Cierre
- [ ] 6.1 CI en verde en el commit de la revisión a mano.
- [ ] 6.2 Desplegado y comprobado en la URL por contenido (F-168), con Alpha y Beta: una negociación de cada tipo y
      un mensaje etiquetado y reetiquetado.
- [ ] 6.3 Archivar el change en `openspec/specs/` cuando el PO lo dé por bueno.
