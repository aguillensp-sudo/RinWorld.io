# Messaging and Negotiation Specification

## Purpose
Convertir el descubrimiento de stock en contacto comercial real entre dos
organizaciones, mediante un hilo de conversación cifrado de extremo a extremo
que combina mensajes libres, tarjetas de consulta y tarjetas de oferta, donde
ni el servidor ni VERA pueden leer el contenido ni las cifras comerciales en
ningún momento.

---

## ADDED Requirements

---

### Requirement: single-thread-model
El sistema SHALL mantener un único hilo de conversación por par de organizaciones,
capaz de contener mensajes libres, tarjetas de consulta y tarjetas de oferta
mezclados cronológicamente, y SHALL reutilizar el hilo existente ante cualquier
vía de contacto hacia una organización con la que ya existe conversación,
sin crear nunca un segundo hilo.
[Origen: Módulo 04 v1.5, sección 4.1; RNG-MSG-06; CA-MSG-01, CA-MSG-02]

#### Scenario: reutilización de hilo existente
- GIVEN dos organizaciones con un hilo ya existente entre ellas
- WHEN cualquiera de las dos inicia contacto de nuevo por cualquier vía
  (Contactar, Consultar, oferta directa)
- THEN el sistema reutiliza el hilo existente
- AND no aparece un segundo hilo distinto entre esas mismas dos organizaciones
  en MSG-01

#### Scenario: mezcla cronológica de tipos de elemento
- GIVEN un hilo activo entre dos organizaciones
- WHEN se añaden elementos de distinto tipo en momentos distintos
  (mensaje libre, tarjeta de consulta, tarjeta de oferta)
- THEN todos aparecen en el historial en estricto orden cronológico
- AND no existe restricción de orden entre tipos de elemento,
  salvo las transiciones de estado del hilo

#### Scenario: agrupación de consultas en lote al mismo distribuidor
- GIVEN un comprador que ejecuta "Consultar Seleccionados" sobre varias líneas
  del mismo distribuidor
- WHEN el sistema procesa el envío
- THEN todas las tarjetas de consulta resultantes se añaden al único hilo
  existente con ese distribuidor
- AND nunca se crea un hilo separado por referencia

---

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