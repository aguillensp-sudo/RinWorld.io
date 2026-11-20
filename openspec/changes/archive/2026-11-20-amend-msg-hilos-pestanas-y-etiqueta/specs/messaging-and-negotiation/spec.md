## MODIFIED Requirements

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

## ADDED Requirements

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
