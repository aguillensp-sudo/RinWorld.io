# Diseño: amend-msg-hilos-pestanas-y-etiqueta

Estado de la base comprobado el 15-nov-2026 por el MCP (`pg_policies`, `pg_trigger`, `pg_proc`,
`information_schema.column_privileges`), no contra los `.sql`.

## 1. Etiqueta de referencia en `MENSAJE` (migración `0080`)

### 1.1 Lo que hay hoy

- `thread_items_shape_chk` (`0020`): un `MENSAJE` lleva `part_number` y `brand` a `NULL`.
- `app.guard_thread_item_integrity()` (trigger `BEFORE INSERT OR UPDATE`): en un `UPDATE` hecho por
  `authenticated`, `part_number` y `brand` son de solo lectura para **todos** los tipos. Este trigger es el que
  impide que el autor cambie la etiqueta, y no aparecía en la proposal.
- La app crea los mensajes con la RPC `create_thread_item` (0012 §5: el elemento y sus claves en la misma
  transacción), que no aceptaba referencia. `0081` le añade `p_part_number` y `p_brand` con `default null`.
- `authenticated` tiene `INSERT` y `UPDATE` sobre todas las columnas, y la política `thread_items_update_participant`
  deja actualizar a cualquiera de las dos partes. Cambiar la etiqueta es un `update` directo, sin RPC.

### 1.2 Decisión: se reutilizan `part_number` y `brand`

La etiqueta de un `MENSAJE` va en las mismas columnas en las que va la referencia de `CONSULTA` y `OFERTA`, y no en
columnas nuevas. Así:
- la búsqueda del hilo (§5) es una sola consulta sobre `(part_number, brand)` para los tres tipos;
- `reference()` de `negotiation-tables.ts` ya sabe pintarla;
- no hace falta un segundo índice ni una segunda regla de normalización.

### 1.3 La migración

1. **`thread_items_shape_chk`, rama `MENSAJE`:** `part_number` y `brand` van los dos o ninguno
   (`(part_number is null) = (brand is null)`). El resto de la rama no cambia: `inventory_line_id`, estados,
   `responds_to_item_id`, `superseded_by_item_id` y `quantity` siguen a `NULL`.
2. **Trigger nuevo `app.validate_message_tag()`** (`BEFORE INSERT OR UPDATE OF part_number, brand`, solo si
   `item_type = 'MENSAJE'` y la etiqueta no es `NULL`): exige que exista una `CONSULTA` u `OFERTA` del mismo
   `thread_id` con ese `(part_number, brand)` exacto. Si no existe, lanza
   «La etiqueta de un mensaje tiene que ser una referencia de este hilo.». Es `security definer`, como
   `validate_thread_item`, para que vea todo el hilo.
3. **`app.guard_thread_item_integrity()`:** en un `UPDATE` de un `MENSAJE`, `part_number` y `brand` dejan de ser de
   solo lectura **solo si** `new.sender_org_id = app.current_org_id()`. Para otra organización, y para `CONSULTA` y
   `OFERTA`, sigue igual. El resto de columnas del mensaje (texto cifrado, autoría, fecha) siguen sin poder cambiarse.
4. **Sin backfill.** Los mensajes que ya existen quedan con la etiqueta a `NULL`, es decir, conversación general.

La regla «la etiqueta la cambia la organización emisora» se aplica en el trigger, no en una política nueva: la
política de `UPDATE` ya existe y la usan los cambios de estado de las otras dos partes.

**Por qué no hace falta el estado del hilo:** cambiar la etiqueta no es un movimiento del hilo. `sync_thread_state` y
`touch_thread_last_item` no deben reaccionar. El primero se dispara en cualquier `UPDATE`: hay que comprobar que, con
un `MENSAJE`, no cambia `threads.state` ni `last_item_at` (test de esquema, §8).

### 1.4 Etiqueta y búsqueda: comparación exacta

La etiqueta se elige en un selector y no se escribe, así que siempre coincide carácter a carácter con la de la
consulta o la oferta. No hace falta `part_key` (`0073`). La búsqueda del hilo (§5) compara en el navegador, sin
mayúsculas y sin separadores, igual que la búsqueda de catálogo.

## 2. Una fila por negociación

Todo se calcula en el navegador, en `lib/negotiation-tables.ts`, sobre lo que ya devuelve `fetchThreadItems`. El
componente no calcula nada, igual que ahora.

### 2.1 Cadena

Una **cadena** es una consulta con las ofertas que la responden, o una oferta directa (sin consulta), más todas sus
contraofertas. Se arma siguiendo `responds_to_item_id` y `superseded_by_item_id` desde el elemento raíz:
- **raíz `CONSULTA`:** quien la envía es el **cliente**;
- **raíz `OFERTA`** (oferta directa, sin `responds_to_item_id`): quien la envía es el **proveedor**.

El papel se fija en la raíz y no cambia durante la cadena: una contraoferta del cliente es una `OFERTA` enviada por
el cliente, pero la cadena sigue siendo suya como cliente.

### 2.2 Fila

- Clave de la fila: `(part_number, brand, papel del miembro)`. La misma referencia puede salir en las dos tablas si
  las dos empresas se la compran entre sí; nunca sale dos veces en la misma tabla.
- Si una referencia tiene varias cadenas con el mismo papel (por ejemplo, una aceptada en octubre y otra consulta
  nueva en noviembre), la fila muestra **la cadena con el último movimiento**. Las anteriores no se pierden: siguen en
  Mensajes al buscar esa referencia (§5).
- Las cifras de la fila son las del **último elemento** de la cadena: la última oferta o, si no hay oferta, la
  consulta (solo Cantidad).
- **Fecha:** el último movimiento de la cadena, `max(created_at, estado_changed_at)` de sus elementos, con formato
  `12 nov 2026`. Sustituye la fecha relativa de hoy (`relativeTime`).

### 2.3 Estado y acciones

El estado se deduce del último elemento de la cadena, de quién lo envió y del papel del miembro:

| Último elemento | Soy cliente | Soy proveedor |
|---|---|---|
| `CONSULTA` · Pendiente | ESPERANDO OFERTA | POR RESPONDER → Responder con oferta · Sin stock |
| `CONSULTA` · Sin stock | SIN STOCK | SIN STOCK |
| `OFERTA` del proveedor · Pendiente | POR DECIDIR → Aceptar · Contra-ofertar · Rechazar | ESPERANDO AL CLIENTE |
| `OFERTA` del cliente · Pendiente | CONTRAOFERTA ENVIADA | CONTRAOFERTA RECIBIDA → Aceptar · Contra-ofertar · Rechazar |
| `OFERTA` Pendiente con `valid_until` pasado | EXPIRADA → Aceptar igualmente · Rechazar, si la recibe el cliente | EXPIRADA → Aceptar igualmente · Rechazar, si es una contraoferta del cliente |
| `OFERTA` · Aceptada | ACEPTADA | ACEPTADA |
| `OFERTA` · Rechazada | RECHAZADA | RECHAZADA |

- Las acciones de oferta siguen saliendo de `offerActions` (F-051, F-056): esta tabla solo decide **qué se pinta**,
  no qué es legal. Las de consulta, como hoy (`0055`: solo el receptor, una vez).
- **Expirada:** se aplica la regla de MSG-03 §4.1, que este change no sustituye. Expirar cambia `Aceptar` por
  `Aceptar igualmente` y quita `Contra-ofertar`, pero no quita `Rechazar`. Vale para quien recibe la oferta, sea
  cliente o proveedor: una contraoferta del cliente que expira sigue pudiéndose aceptar.
- `Superada por contraoferta` nunca es el último elemento de una cadena, así que deja de verse como estado.
- **Cómo se arma la cadena** (comprobado en `create_offer` y `counter_offer`, 15-nov-2026): la oferta que responde a
  una consulta lleva `responds_to_item_id` = la consulta; la contraoferta hereda ese mismo `responds_to_item_id`, y la
  oferta anterior pasa a apuntarle con `superseded_by_item_id`. Se agrupa por esas dos relaciones.
- Código: `app/src/lib/negotiation-rows.ts`. Es un módulo aparte de `negotiation-tables.ts`, que sigue sirviendo a las
  tablas de hoy hasta que la pantalla nueva las sustituya (tarea 2.9).
- Sin contenido descifrado no se puede saber si ha expirado. La fila no se da por expirada y las cifras salen como
  `Cifrado`, como hoy.

### 2.4 Notas

`content.comment` (consulta) o las notas de la oferta se muestran en el `title` de la fila y en un tooltip accesible
por teclado. No hay columna Notas.

## 3. Filtros y orden

- En el navegador, sobre las filas ya calculadas (§2). Precio, cantidad, plazo, transporte y validez van cifrados: la
  base no puede filtrarlos y no debe verlos (proposal, «Qué no cambia»).
- Cada filtro es un predicado sobre el **valor numérico o la fecha** de la fila, no sobre el texto formateado. Las
  filas pasan a llevar los dos valores: el de pintar (`2,10 EUR`) y el de filtrar y ordenar (`2.10`).
- Una celda `Cifrado` o `—` no cumple ningún filtro de rango sobre esa columna.
- Precio: se filtra el número sin convertir la moneda. Si en la tabla hay más de una moneda, el filtro de Precio
  muestra una lista para elegirla.
- Orden por defecto: Fecha descendente. Al pulsar una cabecera se ordena por esa columna, ascendente y descendente
  alternativamente. Empate: Fecha descendente.
- Los filtros se guardan en el estado del componente, no en la URL: la URL no lleva datos de negociación.

## 4. Pantalla del hilo

- `Thread.tsx` pasa a tener cabecera (como hoy) + pestañas + buscador abajo (§5). `ThreadHistory`, `InquiriesTable`
  y `OffersTable` se sustituyen por `MessagesTab` y por un único `NegotiationTable`, que recibe el papel.
- **Ruta:** `/hilos/:threadId` abre Mensajes. La pestaña va en `?tab=cliente|proveedor`, para que el botón Atrás
  funcione y para que un acceso pueda abrir otra pestaña más adelante (pendiente de VERA, proposal).
- **Accesos** (Vendiendo, Comprando, Empresas): ya navegan a `/hilos/:threadId` o crean el hilo y navegan. Se
  comprueba cada uno y ninguno pone `tab`.
- **Mensajes:** el campo de escribir y el selector «Sobre:» arriba, y los mensajes debajo, del más reciente al más
  antiguo. El orden de hoy (ascendente con scroll al final) se invierte.
- **Escribir desde una fila:** al pulsar la Referencia de una fila se va a Mensajes con «Sobre:» ya elegido. No se
  añade ninguna acción a la columna Acciones.

### 4.1 «Ver lo que ve el servidor»

Se queda en la pestaña Mensajes, encima de la lista, y enseña **todos** los `thread_items` del hilo en bruto
(mensajes, consultas y ofertas): `item_type`, `part_number`, `brand`, estados, fechas y el texto cifrado tal como lo
guarda la base. Es la prueba E2EE de todo el hilo, así que no se reparte entre pestañas.

## 5. Búsqueda en el hilo

- Las opciones salen de los `(part_number, brand)` distintos de las `CONSULTA` y `OFERTA` del hilo, ya cargados.
  Casa por subcadena, sin mayúsculas y sin separadores: `6205` encuentra `6205-2RS · SKF` y `6205-ZZ · SKF`.
- Al elegir una opción se va a Mensajes con el filtro puesto. Se ven los mensajes con esa etiqueta y, mezclados por
  fecha, las consultas y ofertas de esa referencia (de todas las cadenas, también las antiguas), en una línea
  compacta: «Consulta · 500 ud.», «Oferta · 2,10 EUR · 500 ud.», «Contraoferta · …», con su estado.
- El filtro va en `?ref=` (la referencia está en claro y no es dato de negociación). La ✕ lo quita.
- Con el filtro puesto, «Sobre:» sale con esa referencia elegida.

## 6. VERA

Fuera de este change (proposal). Lo único que se comprueba aquí: las herramientas de VERA que leen el hilo siguen
devolviendo lo mismo con mensajes etiquetados. Si alguna filtra `MENSAJE` suponiendo `part_number is null`, se
corrige en este change.

## 7. Realtime

`realtime.ts` ya escucha `event: '*'` en `thread_items` del hilo, así que un cambio de etiqueta llega a la otra parte
sin tocar nada. Se refresca igual que un mensaje nuevo.

## 8. Tests

- **Esquema** (`supabase/tests`):
  - `MENSAJE` con referencia del hilo: se guarda.
  - `MENSAJE` con referencia que no está en el hilo, o con solo `part_number`: lo rechaza.
  - El emisor cambia la etiqueta (a otra del hilo o a `NULL`): se guarda.
  - La otra organización cambia la etiqueta: lo rechaza.
  - Cambiar el texto cifrado de un mensaje: sigue rechazado.
  - Cambiar `part_number` de una `CONSULTA` u `OFERTA`: sigue rechazado.
  - Cambiar la etiqueta no mueve `threads.state` ni `last_item_at`.
- **Unitarios** (`negotiation-tables.test.ts`): un caso por fila de la tabla de §2.3, en los dos papeles; la oferta
  directa; la misma referencia en las dos tablas; dos cadenas de la misma referencia; filtros con celdas `Cifrado`.
- **e2e** (Playwright): un escenario por requirement nuevo de la spec, con las cuentas Alpha y Beta.
- Los tests los escribe el Planner, no el Coder (CLAUDE.md §3).

## 9. Reparto (CLAUDE.md §3)

- **A mano (Claude):** migración `0080`, tests de esquema, `negotiation-tables.ts` (cadenas, estados y filtros) y
  sus unitarios. Es donde un fallo es silencioso: una fila con el estado equivocado no da error.
- **Coder:** `NegotiationTable`, `MessagesTab`, el selector «Sobre:», el buscador y el cambio de `Thread.tsx`. Pintan
  lo que les dan las funciones de arriba.
