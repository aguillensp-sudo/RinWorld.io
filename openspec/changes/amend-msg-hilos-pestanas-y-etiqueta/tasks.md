# Tareas: amend-msg-hilos-pestanas-y-etiqueta

Reparto según `design.md` §9 y CLAUDE.md §3. El Coder nunca escribe los tests que lo evalúan.

## 0. Decisiones y documentos
- [x] 0.1 Acuerdos del PO en `docs/Cambios_Frontend_Hilos.md` y fila en `DECISIONES-V1.md` (14-nov-2026).
- [x] 0.2 Menú y accesos resueltos por el PO (15-nov-2026, proposal).
- [x] 0.3 `design.md` escrito (15-nov-2026).
- [x] 0.4 Qué pestaña abre VERA al preparar una consulta u oferta en el hilo: **Mensajes** (PO, 18-nov-2026,
      `DECISIONES-V1.md`). Sin prop de pestaña: `Thread` vuelve a Mensajes cuando llega un borrador (tarea 5.2).

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

## 2. Lógica (`app/src/lib/negotiation-rows.ts`, a mano)
Módulo aparte de `negotiation-tables.ts`, que sigue sirviendo a las tablas de hoy hasta 2.9 (`design.md` §2.3).
- [x] 2.1 Unitarios (`negotiation-rows.test.ts`, 37 casos), escritos antes que el código (15-nov-2026). No se corrieron
      en rojo por separado: el módulo no existía.
- [x] 2.2 Cadenas (`design.md` §2.1): raíz, papel y último elemento, agrupando por `responds_to_item_id` y
      `superseded_by_item_id`.
- [x] 2.3 Filas por `(part_number, brand, papel)`, con la cadena del último movimiento (§2.2).
- [x] 2.4 Estado y acciones según la tabla de §2.3, con las acciones sacadas de `offerActions`.
- [x] 2.5 Valores para pintar y valores para filtrar y ordenar; fecha `12 nov 2026` (§3). `ThreadItem` lleva
      `estadoChangedAt` y `fetchThreadItems` trae `estado_changed_at`.
- [x] 2.6 Filtros combinables y orden (§3), como funciones puras que reciben las filas.
- [x] 2.7 Referencias del hilo para «Sobre:» y para el buscador, con la coincidencia de §5, y la línea de tiempo de
      Mensajes (`messageTimeline`).
- [x] 2.8 Escritura de la etiqueta en `thread-detail.ts`: `sendMessage(threadId, text, tag)` (por `0081`) y
      `retagMessage(itemId, tag)`.
- [x] 2.9 Retirar `inquiryRows`, `offerRows` y los textos de las tablas de MSG-03 v1.2 (18-nov-2026, después de 5.2):
      fuera `negotiation-tables.ts` y su test. Lo que seguía vivo (textos de los botones, `Cifrado`, `—`, el motivo
      de la contraoferta apagada, `BadgeTone`, `quantityLabel`, `moneyLabel`) pasa a `negotiation-rows.ts`, con sus
      pruebas de formato. Vendiendo (`SentOffers*`) no lo usaba. La matriz re-apunta `e2ee-content-encryption#2` y
      `offer-card#6`-`#8` a las pruebas nuevas.

## 3. Contrato de aceptación (a mano, antes del Coder)
- [x] 3.1 `app/e2e/thread-tabs.spec.ts` (15-nov-2026): 17 escenarios con Alpha y Beta, uno o más por requirement
      (accesos, pestañas, tablas por papel, filtro y orden, etiqueta, búsqueda, vista del servidor). Fija los
      selectores que la pantalla tiene que dar (cabecera del fichero). Añade por clave de servicio una segunda
      referencia al hilo Alpha–Nordwälz y la quita al acabar.
- [x] 3.2 `messages.spec.ts`: la oferta se lee en Soy cliente y el panel del servidor pasa a `thread-tabs.spec.ts`.
      `zz-h5-negociacion.spec.ts`: cada paso en su pestaña, con los estados nuevos. La siembra no cambia.
- [x] 3.3 Rojo comprobado contra `bearingworld-e2e` con la pantalla de hoy: 16 de los 17 de `thread-tabs.spec.ts` y los 2
      adaptados de `messages.spec.ts` fallan porque no hay pestañas, tabla nueva ni buscador; el del menú y los que no dependen de la
      pantalla nueva siguen verdes. Una primera corrida tardó 3,3 h (equipo suspendido) y caducó la sesión guardada:
      se repitió y se descartó. `zz-h5-negociacion.spec.ts` no se corrió en local: escribe en el hilo y tarda ~4 min.

## 4. Pantalla (Coder, por el arnés: `harness/tasks/MSG-HILO-PESTANAS.json`)
- [x] 4.0 Preparación a mano (16-nov-2026), en el commit del contrato:
      - adenda en `UMBRAL-FABRICA-V1.md` §8, antes de construir;
      - montaje en `Thread.tsx`: pestañas, «Sobre:», formularios de oferta y contraoferta; `sendBlocked` en
        `ThreadComposer`; todos los literales en `TAB_TEXTS`;
      - marcadores de `NegotiationTable`, `MessagesTimeline` y `ThreadSearch` (con su CSS);
      - contrato de unidad (32 pruebas, rojo total) y `Thread.test.tsx` reescrito al montaje nuevo;
      - comprobado contra una implementación de referencia desechable, que no se comitea: 277 de unidad y los tres
        e2e en verde. Al probarla salieron tres errores del contrato, ya corregidos: la tabla vacía tiene que
        pintar sus cabeceras; el e2e contaba las `option` de toda la página y no solo las del buscador; y en
        `zz-h5`, `Crear consulta` está en la pestaña Mensajes.
- [x] 4.1 Corrida del arnés (16-nov-2026, `corrida-01`): VERDE en el intento 2; 0,075 USD (0,058 + 0,017). El intento
      1 cayó en C1 y C2 por el panel del servidor. Artefacto tal cual en `a2990ea`, con el trailer del Coder.
- [x] 4.2 Revisión a mano: 0 líneas tocadas en los seis ficheros (1.187 líneas de artefacto). Fila en
      `harness-review.csv`. C5, pendiente del PO en producción.
- [x] 4.3 C5 del PO (17-nov-2026), a mano: «Sobre:» pasó primero a campo escribible y después se quitó, porque
      duplicaba el buscador (decisión del PO). El buscador sube a su sitio, arriba en Mensajes, y la etiqueta de lo
      que se escribe es la referencia buscada; sin búsqueda, conversación general. Fuera `TagCombobox`,
      `initialTag` y `sendBlocked`.
- [x] 4.4 C5 del PO (18-nov-2026), a mano: fuera el desplegable «Cambiar etiqueta» de cada mensaje propio («no sirve
      para nada al usuario»), con `retagMessage` y sus textos. La base (0080) sigue permitiendo el cambio a la
      organización emisora; no se toca, porque quitarlo sería una migración sin necesidad.
- [x] 4.5 Retirar `ThreadHistory`, `InquiriesTable` y `OffersTable`, con sus tests y CSS (18-nov-2026), y
      `NegotiationTablesCss.test.ts`. `padding.test.ts` mide ahora `MessagesTimeline`. En `NegotiationTable.tsx`
      (artefacto del Coder) cambia 1 línea de import, anotada en `harness-review.csv` como cambio a mano.
- [ ] 4.6 Cada corrida, fila en `harness-metrics.csv` (CLAUDE.md §6). Artefacto del Coder y revisión a mano en
      commits separados.

## 5. Accesos y VERA (a mano)
- [ ] 5.1 Comprobar que Vendiendo (Ver hilo, Ver acuerdo), Comprando (Contactar), Empresas (tarjeta, Contactar),
      Panel (cajón Hilos) y el menú llevan a donde dice la spec, sin `tab`.
- [x] 5.2 Revisar las herramientas de VERA que leen el hilo con mensajes etiquetados (`design.md` §6) (18-nov-2026).
      Ninguna filtra por `part_number is null`; la única que lee el hilo, `listar_mis_hilos`, pintaba un `MENSAJE`
      etiquetado como «MENSAJE sobre 6205-2RS», igual que una consulta u oferta. Ahora dice «etiquetado con …
      (conversación sobre esa referencia, no es consulta ni oferta)», y su descripción en `tools.json` lo repite;
      test con un mensaje etiquetado en `vera-tools.test.ts`. La guía de Hilos del prompt (bloque estático) se
      reescribe con las tres pestañas, la tabla por papel, el buscador y la etiqueta, y `vera-prompt.test.ts` ata
      cada cita a `negotiation-rows.ts`, `NegotiationTable`, `MessagesTimeline` y `Thread`. Decisión 0.4: si el
      usuario está en Soy cliente o Soy proveedor cuando VERA prepara, `Thread` vuelve a Mensajes
      (`Thread.fuera-de-contrato.test.tsx`; rojo comprobado sin el cambio).

## 6. Cierre
- [ ] 6.1 CI en verde en el commit de la revisión a mano.
- [ ] 6.2 Desplegado y comprobado en la URL por contenido (F-168), con Alpha y Beta: una negociación de cada tipo y
      un mensaje etiquetado y reetiquetado.
- [ ] 6.3 Archivar el change en `openspec/specs/` cuando el PO lo dé por bueno.
