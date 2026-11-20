# Messaging and Negotiation Specification

## Purpose
Convertir el descubrimiento de stock en contacto comercial real entre dos
organizaciones, mediante un hilo de conversación cifrado de extremo a extremo
que combina mensajes libres, tarjetas de consulta y tarjetas de oferta, donde
ni el servidor ni VERA pueden leer el contenido ni las cifras comerciales en
ningún momento.

---
## Requirements

---

### Requirement: single-thread-model
El sistema SHALL mantener un único hilo de conversación por par de organizaciones,
capaz de contener mensajes libres, tarjetas de consulta y tarjetas de oferta, y SHALL
reutilizar el hilo existente ante cualquier vía de contacto hacia una organización con
la que ya existe conversación, sin crear nunca un segundo hilo. Los mensajes libres se
muestran en la pestaña Mensajes; las consultas y las ofertas, en las tablas Soy cliente
y Soy proveedor.
[Origen: Módulo 04 v1.5, sección 4.1; RNG-MSG-06; CA-MSG-01, CA-MSG-02;
`docs/Cambios_Frontend_Hilos.md`; DECISIONES-V1, 14-nov-2026]

#### Scenario: reutilización de hilo existente
- GIVEN dos organizaciones con un hilo ya existente entre ellas
- WHEN cualquiera de las dos inicia contacto de nuevo por cualquier vía
  (Contactar, Consultar, oferta directa)
- THEN el sistema reutiliza el hilo existente
- AND no aparece un segundo hilo distinto entre esas mismas dos organizaciones
  en CONVERSACIÓN

#### Scenario: cada tipo de elemento en su sitio
- GIVEN un hilo con mensajes libres, consultas y ofertas
- WHEN un miembro abre el hilo
- THEN los mensajes libres aparecen en la pestaña Mensajes, del más reciente al más antiguo
- AND las consultas y las ofertas aparecen en Soy cliente o Soy proveedor, según el papel
  del miembro en cada referencia
- AND ninguna consulta ni oferta aparece a la vez en las dos tablas

#### Scenario: agrupación de consultas en lote al mismo distribuidor
- GIVEN un comprador que ejecuta "Consultar Seleccionados" sobre varias líneas
  del mismo distribuidor
- WHEN el sistema procesa el envío
- THEN todas las tarjetas de consulta resultantes se añaden al único hilo
  existente con ese distribuidor
- AND nunca se crea un hilo separado por referencia

### Requirement: e2ee-content-encryption
El sistema SHALL cifrar de extremo a extremo todo el contenido de cualquier
elemento del hilo (texto de mensaje libre, cantidad de tarjeta de consulta,
todas las cifras de tarjeta de oferta) usando las claves X25519 del miembro,
de forma que el servidor únicamente almacene y reenvíe ciphertext, sin que
ninguna transición de estado del hilo requiera descifrar contenido.
[Origen: Módulo 04 v1.5, sección 1; RNG-MSG-01, RNG-MSG-02; CA-MSG-11]

#### Scenario: inspección de servidor no revela contenido
- GIVEN cualquier elemento almacenado en el hilo
- WHEN se inspecciona directamente la base de datos del servidor
- THEN no es posible reconstruir el texto plano de un mensaje libre,
  la cantidad de una tarjeta de consulta, ni ninguna cifra de una
  tarjeta de oferta

#### Scenario: contenido cifrado sin passphrase activa
- GIVEN un usuario autenticado cuya passphrase no está activa en la sesión actual
- WHEN visualiza MSG-01 o MSG-02
- THEN ve el indicador "Contenido cifrado — introduce tu frase de seguridad
  para ver" en lugar del contenido real

---

### Requirement: inquiry-card
El sistema SHALL ofrecer la tarjeta de consulta como vía de contacto desde
resultados de búsqueda, con cantidad obligatoria y comentario de texto libre
opcional (máximo 300 caracteres), bloqueando el envío de una segunda consulta
sobre la misma línea de inventario por el mismo comprador.
[Origen: Módulo 04 v1.5, secciones 5.2, 5.3, 5.4; RNG-MSG-04, RNG-MSG-05;
CA-MSG-03, CA-MSG-04, CA-MSG-05]

#### Scenario: envío de consulta con cantidad
- GIVEN un comprador que pulsa "Consultar" en una línea no consultada previamente
- WHEN introduce una cantidad y confirma el envío
- THEN el sistema cifra la tarjeta de consulta y la añade al hilo con ese
  distribuidor (creándolo si no existe)
- AND marca la línea como consultada de forma persistente para ese comprador
- AND el hilo transiciona a CON CONSULTA PENDIENTE si no había ya una oferta
  pendiente

#### Scenario: intento de envío sin cantidad
- GIVEN un comprador en el formulario de tarjeta de consulta
- WHEN intenta confirmar el envío sin haber introducido una cantidad
- THEN el sistema bloquea el envío
- AND muestra "Indica la cantidad que quieres consultar"

#### Scenario: bloqueo de segunda consulta sobre la misma línea
- GIVEN una línea de inventario ya marcada como consultada por un comprador
- WHEN ese mismo comprador visualiza la línea en SRCH-01
- THEN el botón "Consultar" aparece deshabilitado con el texto
  "Ya has consultado esta referencia con este distribuidor"
- AND la fila se muestra visualmente marcada/sombreada de forma persistente
  entre sesiones

#### Scenario: reseteo de marcado tras reemplazo total de inventario
- GIVEN una línea previamente marcada como consultada que es sustituida por
  una nueva línea (nuevo ID interno) tras un reemplazo total de inventario
  del distribuidor
- WHEN el comprador visualiza la referencia tras el reemplazo
- THEN la nueva línea aparece como no consultada
- AND el botón "Consultar" está disponible de nuevo, independientemente
  de que part_number, brand y cantidad coincidan con la línea anterior

---

### Requirement: offer-card
El sistema SHALL ofrecer la tarjeta de oferta con los campos part_number,
brand (heredados del contexto del hilo o de la consulta a la que responde,
no editables salvo cambio explícito de referencia), unit_price, currency
y quantity como obligatorios, y lead_time_days, shipping_cost,
shipping_cost_currency, valid_until y notes (máximo 500 caracteres) como
opcionales, con un campo estado_oferta que toma los valores Pendiente,
Aceptada, Rechazada o Superada por contraoferta, mostrando el coste de
transporte como línea separada del total solo cuando se ha informado.
[Origen: Módulo 04 v1.5, secciones 6.1, 6.2 y 6.4; CA-MSG-06, CA-MSG-08B]

#### Scenario: oferta como respuesta a una consulta
- GIVEN una tarjeta de consulta pendiente de respuesta
- WHEN el distribuidor crea una tarjeta de oferta de respuesta
- THEN part_number, brand y quantity se pre-rellenan heredados de la consulta
- AND quantity permanece editable, permitiendo ofertar una cantidad distinta
- AND la tarjeta de consulta transiciona su estado a "Respondida con oferta"
- AND la nueva tarjeta de oferta nace con estado_oferta=Pendiente

#### Scenario: oferta directa sin consulta previa
- GIVEN un hilo ya existente entre dos organizaciones
- WHEN cualquiera de las dos partes pulsa "Crear oferta" sin que exista
  una consulta previa pendiente
- THEN el sistema permite crear la tarjeta de oferta directamente
- AND requiere como mínimo part_number, brand, unit_price, currency y quantity

#### Scenario: aceptación de oferta
- GIVEN una tarjeta de oferta con estado_oferta=Pendiente, recibida y visible
  para el receptor
- WHEN el receptor pulsa "Aceptar oferta"
- THEN estado_oferta transiciona a Aceptada

#### Scenario: rechazo de oferta
- GIVEN una tarjeta de oferta con estado_oferta=Pendiente, recibida y visible
  para el receptor
- WHEN el receptor pulsa "Rechazar oferta"
- THEN estado_oferta transiciona a Rechazada

#### Scenario: contraoferta marca la anterior como superada
- GIVEN una tarjeta de oferta con estado_oferta=Pendiente
- WHEN el receptor responde con una contraoferta en lugar de aceptar o rechazar
- THEN estado_oferta de la oferta anterior transiciona a Superada por contraoferta,
  sin eliminarse del historial
- AND la nueva tarjeta de oferta nace con estado_oferta=Pendiente

#### Scenario: coste de transporte informado
- GIVEN una tarjeta de oferta donde quien la emite introduce un valor
  en shipping_cost
- WHEN se renderiza la tarjeta
- THEN se muestra una línea separada del total de producto con el importe
  y su divisa (shipping_cost_currency, por defecto la misma que currency)

#### Scenario: coste de transporte no informado
- GIVEN una tarjeta de oferta donde shipping_cost no recibió valor
- WHEN se renderiza la tarjeta
- THEN no aparece ninguna línea de coste de transporte
- AND no se muestra un importe "0" engañoso

#### Scenario: oferta con fecha de validez expirada
- GIVEN una tarjeta de oferta con valid_until informado, ya pasada,
  y estado_oferta=Pendiente
- WHEN el receptor visualiza la tarjeta
- THEN se muestra el aviso "Esta oferta ha expirado" de forma local
- AND el receptor puede aceptarla igualmente — la fecha es orientativa,
  no contractual en V1

---

### Requirement: thread-lifecycle
El sistema SHALL gestionar el ciclo de vida del hilo con los estados ABIERTO,
CON CONSULTA PENDIENTE, CON OFERTA PENDIENTE, ACUERDO ALCANZADO y CERRADO
SIN ACUERDO, calculando toda transición exclusivamente a partir de metadatos
de tipo de elemento y estado de tarjeta, sin requerir descifrado de contenido.
[Origen: Módulo 04 v1.5, sección 7; RNG-MSG-02]

#### Scenario: transición a CON OFERTA PENDIENTE
- GIVEN un hilo en estado ABIERTO o CON CONSULTA PENDIENTE
- WHEN se envía una tarjeta de oferta con estado_oferta=Pendiente
- THEN el hilo transiciona a CON OFERTA PENDIENTE

#### Scenario: aceptación de oferta
- GIVEN una tarjeta de oferta pendiente recibida
- WHEN el receptor pulsa "Aceptar oferta"
- THEN el hilo transiciona a ACUERDO ALCANZADO

#### Scenario: rechazo de oferta — el hilo vuelve a su estado previo
- GIVEN un hilo en estado CON OFERTA PENDIENTE
- WHEN el receptor rechaza la oferta (estado_oferta transiciona a Rechazada)
- THEN si la oferta no respondía a ninguna consulta pendiente, el hilo
  transiciona a ABIERTO
- AND si existe otra tarjeta de consulta en el mismo hilo aún pendiente
  de respuesta, el hilo transiciona a CON CONSULTA PENDIENTE en su lugar

#### Scenario: contraoferta marca la anterior como superada
- GIVEN una tarjeta de oferta pendiente
- WHEN el receptor responde con una contraoferta en lugar de aceptar o rechazar
- THEN la oferta anterior se marca como "Superada por contraoferta"
  en el historial visual, sin eliminarse
- AND la nueva tarjeta de oferta queda pendiente
- AND el hilo permanece en CON OFERTA PENDIENTE, ahora referido a la
  nueva oferta

#### Scenario: reversión de acuerdo alcanzado
- GIVEN un hilo en estado ACUERDO ALCANZADO
- WHEN cualquiera de las dos partes solicita revertir el acuerdo
- THEN el hilo transiciona de vuelta a ABIERTO
- AND la reversión está siempre disponible, sin restricciones ni periodo
  de gracia, y sin valor contractual

#### Scenario: cierre sin acuerdo no afecta al marcado de consulta
- GIVEN un hilo que transiciona manualmente a CERRADO SIN ACUERDO
- WHEN se evalúa el estado de las líneas previamente consultadas en ese hilo
- THEN el marcado de "línea consultada" permanece sin cambios,
  independiente del estado del hilo

---

---

### Requirement: thread-rate-limiting
El sistema SHALL limitar a 25 los hilos nuevos que una organización puede
iniciar por día natural, sin que este límite afecte al envío de elementos
en hilos ya existentes.
[Origen: Módulo 04 v1.5, sección 10; RNG-MSG-09]

#### Scenario: límite diario de hilos nuevos alcanzado
- GIVEN una organización que ya ha iniciado 25 hilos nuevos en el día natural
- WHEN intenta iniciar un hilo número 26 con una organización distinta
- THEN el sistema bloquea la creación del hilo nuevo
- AND el envío de elementos en cualquiera de sus 25 hilos ya existentes
  no se ve afectado

---

### Requirement: vera-drafting-assistance
El sistema SHALL permitir a VERA ayudar a redactar mensajes libres y rellenar
formularios de tarjeta de consulta u oferta a partir de lenguaje natural,
mostrando siempre el resultado en claro para confirmación del usuario antes
de cifrar, sin que VERA pueda proponer cifras de precio no proporcionadas
explícitamente por el usuario ni acceder al contenido cifrado de elementos
ajenos a la redacción activa.
[Origen: Módulo 04 v1.5, sección 9; RNG-MSG-03]

#### Scenario: VERA rellena tarjeta de consulta desde lenguaje natural
- GIVEN un usuario que pide a VERA "consulta a este distribuidor si tiene
  300 unidades"
- WHEN VERA interpreta la instrucción
- THEN rellena el formulario de tarjeta de consulta con quantity=300
- AND lo muestra para confirmación del usuario antes de cifrar y enviar

#### Scenario: VERA rellena tarjeta de oferta con cifras explícitas del usuario
- GIVEN un usuario que pide a VERA "ofrécele 2,10€ por unidad para 500 piezas
  con entrega en dos semanas"
- WHEN VERA interpreta la instrucción
- THEN rellena el formulario de oferta con esos valores exactos
- AND lo muestra para revisión y confirmación
- AND VERA nunca añade ni sugiere una cifra de precio que el usuario
  no haya proporcionado explícitamente

#### Scenario: notificación de VERA basada solo en metadatos
- GIVEN una nueva tarjeta de consulta recibida en cualquier hilo del usuario
- WHEN VERA genera la notificación
- THEN comunica organización y referencia sin revelar la cantidad
  ni ningún contenido cifrado
- AND el usuario debe abrir la tarjeta para ver el contenido descifrado

---

### Requirement: thread-access-routing
El sistema SHALL llevar a CONVERSACIÓN (la lista de hilos) cuando se entra en Hilos desde
el menú o desde el cajón Hilos del Panel, y SHALL abrir directamente el hilo con la
empresa correspondiente cuando se entra desde una acción sobre esa empresa.
[Origen: `docs/Cambios_Frontend_Hilos.md`, «Acceso a Hilos»]

#### Scenario: entrada a la lista
- GIVEN un miembro autenticado
- WHEN pulsa Hilos en el menú o el cajón Hilos del Panel
- THEN se muestra CONVERSACIÓN con la lista de sus hilos

#### Scenario: entrada al hilo de una empresa
- GIVEN un miembro con un hilo existente con la empresa X
- WHEN pulsa Ver hilo o Ver acuerdo en Vendiendo, Contactar en Comprando, o Contactar en la
  ficha de X en Empresas (pulsar X en el Directorio abre su ficha; PO, 20-nov-2026)
- THEN se abre el hilo con X en la pestaña Mensajes, sin pasar por CONVERSACIÓN
- AND desde Vendiendo y Comprando, ya filtrada por la referencia de esa fila, que es la
  etiqueta de lo que escriba (PO, 20-nov-2026)

#### Scenario: Contactar sin hilo previo
- GIVEN un miembro sin hilo con la empresa X
- WHEN pulsa Contactar en una línea de X en Comprando
- THEN se abre la ficha de X con el cuadro «Primer mensaje», y ese primer mensaje sale
  etiquetado con la referencia de la línea (PO, 20-nov-2026, `0083`)

#### Scenario: el menú
- GIVEN un miembro autenticado
- THEN el ítem de navegación se llama Hilos

### Requirement: thread-role-tabs
El sistema SHALL presentar el hilo de una empresa en tres pestañas, de izquierda a
derecha: Mensajes, Soy cliente y Soy proveedor. Soy cliente SHALL contener las ofertas
que la otra empresa ha hecho al miembro, y las consultas del miembro todavía sin oferta o
marcadas sin stock; Soy proveedor, las ofertas que el miembro ha hecho a la otra empresa,
y las consultas que esta le ha hecho y aún no ha respondido. Cada negociación SHALL
aparecer en una sola de las dos tablas.
[Origen: `docs/Cambios_Frontend_Hilos.md`, §2.1 y «Acuerdos»]

#### Scenario: oferta recibida
- GIVEN la organización B ha enviado una oferta de `6205-2RS · SKF` a la organización A
- WHEN un miembro de A abre el hilo con B
- THEN la oferta aparece en Soy cliente
- AND no aparece en Soy proveedor

#### Scenario: oferta enviada
- GIVEN la organización A ha enviado una oferta de `6205-2RS · SKF` a la organización B
- WHEN un miembro de A abre el hilo con B
- THEN la oferta aparece en Soy proveedor
- AND no aparece en Soy cliente

#### Scenario: mensajes, el más reciente arriba
- GIVEN un hilo con varios mensajes
- WHEN un miembro abre la pestaña Mensajes
- THEN el mensaje más reciente aparece el primero
- AND el campo de escribir está encima de los mensajes

### Requirement: negotiation-tables-by-role
El sistema SHALL pintar Soy cliente y Soy proveedor con las mismas columnas, en este
orden: Referencia + Marca, Cantidad, Precio, Estado, Fecha, Plazo, Transporte, Válida
hasta, Acciones. No SHALL haber columnas Organización ni País. Cada tabla SHALL tener una
fila por referencia (part_number + brand) con la última versión de la negociación; una
contraoferta actualiza la fila y no crea otra.
[Origen: `docs/Cambios_Frontend_Hilos.md`, §2.1 y «Configuración de las tablas»]

#### Scenario: consulta recibida sin responder
- GIVEN B ha enviado a A una consulta de `6205-2RS · SKF` y A no ha respondido
- WHEN un miembro de A abre Soy proveedor
- THEN hay una fila de esa referencia con Cantidad, Estado POR RESPONDER y Fecha
- AND Precio, Plazo, Transporte y Válida hasta salen vacíos
- AND las acciones son Responder con oferta y Sin stock

#### Scenario: consulta respondida
- GIVEN la fila del escenario anterior
- WHEN A responde con una oferta
- THEN la misma fila se llena con las cifras de la oferta de A
- AND el estado pasa a ESPERANDO AL CLIENTE
- AND no aparece una segunda fila de esa referencia

#### Scenario: consulta enviada sin respuesta
- GIVEN A ha enviado a B una consulta que B no ha respondido
- WHEN un miembro de A abre Soy cliente
- THEN hay una fila de esa referencia con estado ESPERANDO OFERTA y sin acciones

#### Scenario: sin stock
- GIVEN B ha marcado como Sin stock la consulta que le envió A
- WHEN un miembro de A abre Soy cliente
- THEN la fila de esa referencia tiene estado SIN STOCK y sin acciones

#### Scenario: contraoferta del cliente
- GIVEN A tiene en Soy cliente una oferta de B por decidir
- WHEN A contraoferta
- THEN en Soy cliente de A la fila muestra las cifras de A con estado CONTRAOFERTA ENVIADA
- AND en Soy proveedor de B la misma fila muestra esas cifras con estado
  CONTRAOFERTA RECIBIDA y las acciones Aceptar, Contra-ofertar y Rechazar

#### Scenario: estados y acciones por papel
- GIVEN una fila de Soy cliente
- THEN su estado es uno de: Esperando oferta, Por decidir, Contraoferta enviada, Aceptada,
  Rechazada, Expirada, Sin stock
- AND solo con Por decidir tiene acciones: Aceptar, Contra-ofertar y Rechazar
- AND si la oferta ha expirado, la acción es Aceptar igualmente
- GIVEN una fila de Soy proveedor
- THEN su estado es uno de: Por responder, Esperando al cliente, Contraoferta recibida,
  Aceptada, Rechazada, Expirada, Sin stock
- AND solo tiene acciones con Por responder (Responder con oferta, Sin stock) y con
  Contraoferta recibida (Aceptar, Contra-ofertar, Rechazar)

#### Scenario: notas al pasar el ratón
- GIVEN una fila cuya oferta lleva notas (incoterm, forma de pago…)
- WHEN el miembro pasa el ratón por la fila
- THEN se muestran las notas
- AND no hay columna Notas

#### Scenario: filtros combinables
- GIVEN una tabla con varias filas
- WHEN el miembro filtra Referencia por texto, Estado por lista, Cantidad, Precio, Plazo o
  Transporte por desde/hasta, y Fecha o Válida hasta por rango, en cualquier combinación
- THEN la tabla muestra solo las filas que cumplen todos los filtros
- AND Acciones no tiene filtro
- AND el filtrado de los campos cifrados se hace en el navegador sobre lo descifrado

#### Scenario: orden
- GIVEN una tabla recién abierta
- THEN las filas van de la de último movimiento más reciente a la más antigua
- AND la Fecha se muestra como `12 nov 2026`
- AND pulsar la cabecera de una columna reordena por esa columna

### Requirement: message-reference-tag
El sistema SHALL permitir que cada mensaje libre lleve como etiqueta una referencia
(part_number + brand) que exista en una consulta, una oferta u otro mensaje del mismo hilo, o
que sea una línea publicada de la otra empresa del hilo (PO, 20-nov-2026, `0083`), o ninguna
si es conversación general. La etiqueta SHALL ir en claro, como en consultas y
ofertas; el texto del mensaje SHALL seguir cifrado.
[Origen: `docs/Cambios_Frontend_Hilos.md`, «Etiqueta de referencia en los mensajes»]

#### Scenario: la etiqueta es la referencia buscada
- GIVEN un miembro en la pestaña Mensajes de un hilo con las referencias
  `6205-2RS · SKF` y `6206-ZZ · FAG`
- WHEN ha elegido `6206-ZZ · FAG` en el buscador y escribe un mensaje
- THEN el mensaje se envía etiquetado `6206-ZZ · FAG`
- AND sin ninguna referencia buscada, el mensaje se envía como conversación general
- AND no hay un selector «Sobre:» aparte: lo quitó el PO el 17-nov-2026 porque duplicaba el
  buscador
- AND el texto de ayuda del campo dice cuál de los dos casos es: «Escribe sobre 6206-ZZ · FAG:
  el mensaje irá etiquetado con esta referencia» o «Inicia una conversación nueva, sin
  referencia (para escribir sobre una, búscala arriba)» (PO, 18-nov-2026)

#### Scenario: escribir desde una fila
- GIVEN un miembro en Soy cliente o Soy proveedor
- WHEN pulsa la Referencia de una fila
- THEN se abre la pestaña Mensajes filtrada por esa referencia, y lo que escriba la lleva

#### Scenario: qué referencias valen como etiqueta
- GIVEN un mensaje etiquetado con una referencia que no está en ninguna consulta, oferta ni
  mensaje de ese hilo, y que no es una línea publicada de la otra empresa (una del propio
  inventario, una en borrador, la misma referencia con otra marca)
- WHEN se intenta guardar
- THEN la base lo rechaza
- AND una línea publicada de la otra empresa sí vale, y la otra parte puede contestar con la
  misma etiqueta aunque la línea deje de estar publicada

#### Scenario: etiqueta visible
- GIVEN un mensaje etiquetado `6205-2RS · SKF`
- THEN el mensaje muestra la etiqueta
- AND la pantalla no ofrece cambiarla después (PO, 18-nov-2026: el desplegable «no sirve
  para nada»). La base sigue dejando que solo la organización que lo envió la cambie (0080),
  pero ninguna pantalla lo usa

#### Scenario: mensajes anteriores
- GIVEN los mensajes que existían antes de este cambio
- THEN no llevan etiqueta y cuentan como conversación general

### Requirement: thread-reference-search
El sistema SHALL ofrecer, arriba de la pestaña Mensajes y encima del campo de escribir
(PO, 17-nov-2026: antes iba abajo y en las tres pestañas), un campo de búsqueda con lupa y el texto de ayuda «Busca una referencia dentro de este hilo sobre la
que quieras recuperar el contenido de la conversación». La búsqueda SHALL casar con las
referencias del hilo (las de sus consultas, ofertas y mensajes etiquetados), no con el texto de
los mensajes.
[Origen: `docs/Cambios_Frontend_Hilos.md`, §2.2 y «Búsqueda (Campo &1)»]

#### Scenario: lista de coincidencias
- GIVEN un hilo con `6205-2RS · SKF`, `6205-2RS · FAG` y `6205-ZZ · SKF`
- WHEN el miembro escribe `6205`
- THEN se despliega la lista de las tres, cada una con su marca
- AND solo se puede elegir una

#### Scenario: elegir una referencia
- GIVEN la lista del escenario anterior
- WHEN el miembro elige `6205-2RS · SKF`
- THEN, sin pulsar ningún botón más, se ven solo los mensajes etiquetados con esa referencia y sus consultas y ofertas,
  del más reciente al más antiguo
- AND arriba aparece «Referencia: 6205-2RS · SKF ✕»
- AND los mensajes de conversación general no aparecen

#### Scenario: quitar el filtro
- GIVEN la pestaña Mensajes filtrada por una referencia
- WHEN el miembro pulsa la ✕
- THEN se vuelve a ver la conversación completa
- AND lo que escriba a partir de ahí es conversación general

#### Scenario: sin coincidencias
- GIVEN un hilo sin ninguna referencia que case con `NU214`
- WHEN el miembro escribe `NU214`
- THEN debajo del buscador aparece «No hay ninguna referencia que coincida con «NU214» en
  este hilo»

## Out of Scope
- Procesamiento de pagos de ningún tipo, entre miembros o de cualquier otra
  naturaleza (RNG-MSG-08, principio permanente de la plataforma).
- Resumen de conversación por IA sobre contenido descifrado
  (diferido a V2, QA-MSG-04 cerrada).
- Traducción de mensajes o tarjetas entre idiomas (eliminada de la plataforma,
  QA-MSG-05 cerrada).
- Calculadora de logística / landed cost automático (Módulo 05 v2.0,
  diferido a V2).
- Mensajería de grupo o hilos con más de dos organizaciones (fuera de V1).
- Concepto de "mejores distribuidores" o contacto automático en lote
  (eliminado, decisión QA-SRCH-03 del Módulo 03).

---

## Cross-Capability References
- `e2ee-key-management` — el cifrado de todo el contenido de este módulo
  depende de las claves X25519 generadas y custodiadas por esa capability.
- `conversational-search` — las acciones "Consultar", "Contactar" y
  "Consultar Seleccionados" se originan en esa capability; esta capability
  gestiona el hilo, la tarjeta y el cifrado resultante (boundary GAP-004,
  cerrado).
- `inventory-management` — el campo unit_price cifrado E2EE fluye desde
  esa capability hacia la tarjeta de oferta de este módulo.
- `vera-agent` — VERA actúa en este módulo exclusivamente sobre metadatos
  y sobre contenido en claro que el propio usuario está redactando, nunca
  sobre contenido cifrado ajeno.
- `organization-directory` — el Directorio de Organizaciones (MSG-05)
  especificado en este módulo es consumido también como capability propia
  (organization-directory) en el árbol de capabilities del proyecto.

---

## Open Questions
- Ninguna. Todas las decisiones del módulo están cerradas en v1.5.