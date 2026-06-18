**BEARINGWORLD.IO**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 04 — MENSAJERÍA E2EE, CONSULTAS Y NEGOCIACIÓN**

**Construido sobre Módulos 00, 01, 02 y 03**

Versión 1.5 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento especifica el módulo de Mensajería Cifrada de Extremo a Extremo (E2EE), Consultas y Negociación de Bearingworld.io. Es el módulo donde el descubrimiento (Módulo 03) se convierte en contacto humano real entre dos organizaciones: desde una pregunta simple de disponibilidad hasta una oferta formal de precio. Todo el contenido de estas conversaciones está cifrado de extremo a extremo usando las claves X25519 generadas durante el onboarding (Módulo 01); ni el servidor ni VERA pueden leer el contenido de los mensajes ni de ninguna tarjeta estructurada (consulta u oferta).

Este módulo cubre: el modelo de hilo único de conversación, que puede contener tres tipos de contenido — mensajes libres, tarjetas de consulta y tarjetas de oferta —; los tres flujos de entrada al contacto (Contactar, Consultar y la ficha de organización); el cifrado E2EE de cada elemento del hilo; el ciclo de vida del hilo y de cada tarjeta; el marcado persistente de líneas ya consultadas; la ficha pública de organización como directorio mínimo de miembros; y la capa conversacional de VERA, que ayuda a redactar y a rellenar formularios pero nunca decide ni conoce cifras comerciales por sí misma.

## **1.1 Objetivos funcionales**

* Ofrecer tres formas de iniciar contacto con una organización, según la intención del usuario: un mensaje libre sin estructura ni requisitos (Contactar), una solicitud de disponibilidad sobre una línea concreta con cantidad obligatoria (Consultar), y una propuesta formal de precio y condiciones (tarjeta de oferta), todas dentro de un único hilo de conversación por par de organizaciones y referencia.
* Garantizar que el contenido de cada mensaje y cada tarjeta está cifrado de extremo a extremo con las claves X25519 del Módulo 01: el servidor almacena y reenvía ciphertext, nunca texto plano, ni siquiera para las cifras de una oferta.
* Marcar de forma persistente, por línea de inventario, que un comprador ya ha enviado una consulta sobre ella, bloqueando nuevas consultas sobre esa misma línea.
* Ofrecer una ficha pública de organización con datos generales del miembro (nombre, país, antigüedad en la plataforma) y un acceso directo a "Contactar", como punto de entrada neutral al contacto que no depende de haber buscado nada antes.
* Dar a VERA visibilidad sobre los metadatos de la conversación (quién, cuándo, qué tipo de tarjeta, estado del hilo) sin darle acceso al contenido cifrado, permitiéndole ayudar a redactar y a rellenar formularios — pero siempre mostrando el resultado al usuario para confirmación antes de cifrar y enviar.

## **1.2 Fuera de alcance en este módulo**

* Cálculo automático de coste de aterrizaje / landed cost, perfiles de tarifas de flete, calculadora de aranceles (Módulo 05) — diferido a V2. En V1, este módulo solo incorpora un campo simple de coste de transporte introducido manualmente dentro de la tarjeta de oferta (sección 6.2), sin ningún cálculo asociado.
* Sistema de favoritos y su visualización agregada en resultados de búsqueda (Módulo 03, sección de reputación/favoritos) — este módulo puede generar el contexto desde el que un usuario decide marcar a alguien como favorito, pero la mecánica de favoritos se especifica en el Módulo 03.
* Selección o contacto automático de "mejores distribuidores" en búsquedas por lote — eliminado de la plataforma; diferido sin definir a V2 (Módulo 03, sección 5).

|  |
| --- |
| **🔒 PRINCIPIO RECTOR: E2EE REAL, Y NINGÚN PAGO PASA POR LA PLATAFORMA**  Dos invariantes gobiernan este módulo de forma permanente, no solo para V1. Primero, el cifrado E2EE: cada mensaje, tarjeta de consulta y tarjeta de oferta se cifra en el dispositivo del emisor con la clave pública X25519 del receptor y solo puede descifrarse con la clave privada del receptor. El servidor almacena y reenvía ciphertext sin poder leerlo — esto incluye explícitamente cualquier cifra de precio o cantidad. Segundo, y como declaración de principio de la plataforma (no una limitación temporal de V1): Bearingworld.io no procesa pagos ni gestiona transacciones financieras en ninguna versión. La plataforma facilita el contacto y la negociación; el acuerdo comercial y su ejecución (pago, envío, factura) ocurren siempre fuera de la plataforma, entre las dos organizaciones. Esta segunda declaración debe revisarse también en el PRD y en el Tech Stack para asegurar coherencia (no hay Billing Service de transacciones entre miembros — el Billing Service del Tech Stack se refiere exclusivamente a las suscripciones de los miembros a la plataforma, no a pagos entre ellos). |

# **2. Actores del Módulo**

| **Actor** | **Acciones permitidas en este módulo** |
| --- | --- |
| Miembro iniciador | Iniciar contacto con otra organización por cualquiera de las tres vías (sección 4), enviar mensajes libres, enviar tarjetas de consulta y de oferta, responder a las recibidas, gestionar el ciclo de vida del hilo. |
| Miembro receptor | Recibir y descifrar mensajes y tarjetas, responder con mensajes libres, con tarjetas de oferta (en respuesta a una consulta) o de contraoferta, aceptar/rechazar ofertas, gestionar el ciclo de vida del hilo. |
| VERA | Ayudar a redactar mensajes libres y a rellenar formularios de tarjetas de consulta y de oferta a partir de lenguaje natural — siempre mostrando el resultado al usuario para confirmación antes de cifrar y enviar. Notificar de nueva actividad y resumir el estado de los hilos (metadatos únicamente). VERA no decide cifras ni envía nada sin confirmación explícita del usuario. |
| Sistema (Messaging Service) | Almacenar y reenviar ciphertext, gestionar el ciclo de vida del hilo y de cada tarjeta (metadatos), mantener el marcado persistente de líneas consultadas, servir los datos públicos de la ficha de organización, aplicar límites de tasa para prevenir spam de contacto masivo. |

# **3. Arquitectura de Cifrado E2EE**

## **3.1 Componentes reutilizados del Módulo 01**

Este módulo no introduce un nuevo sistema criptográfico. Reutiliza íntegramente la infraestructura de claves generada durante el onboarding (Módulo 01, FL-02):

| **Componente** | **Origen (Módulo 01)** | **Uso en este módulo** |
| --- | --- | --- |
| Par de claves X25519 | Generado en el dispositivo del usuario durante FL-02, clave privada cifrada localmente con Argon2id + AES-256-GCM derivada de la passphrase. | La clave pública del receptor se usa para envolver la clave de sesión de cada elemento del hilo (mensaje, tarjeta de consulta, tarjeta de oferta). La clave privada del receptor (descifrada localmente con su passphrase) se usa para leer lo recibido. |
| Directorio de claves públicas | Las claves públicas de cada miembro se publican en el directorio de la plataforma tras el registro (FL-02). | Al iniciar contacto con un miembro por primera vez (por cualquiera de las tres vías de la sección 4), el cliente del iniciador obtiene la clave pública del receptor desde este directorio. |
| Passphrase de cifrado | Establecida por el usuario en FL-02, nunca enviada al servidor, deriva la clave que protege la clave privada. | Necesaria para descifrar lo recibido. Si el usuario no ha introducido su passphrase en la sesión actual (Módulo 01, modelo de sesión), se le solicita antes de mostrar el contenido de un hilo. |

## **3.2 Modelo de cifrado por elemento del hilo**

Cada elemento del hilo — un mensaje de texto libre, una tarjeta de consulta o una tarjeta de oferta — se cifra individualmente siguiendo el mismo esquema de cifrado híbrido:

1. El cliente del emisor genera una clave simétrica aleatoria de un solo uso (clave de sesión del elemento).
2. El contenido (texto libre, o la estructura JSON de una tarjeta de consulta u oferta — secciones 5 y 6) se cifra con AES-256-GCM usando esa clave de sesión.
3. La clave de sesión se cifra con la clave pública X25519 del receptor (envoltorio asimétrico).
4. El cliente envía al servidor: el ciphertext + la clave de sesión envuelta + metadatos en claro (remitente, destinatario, timestamp, ID de hilo, tipo de elemento: mensaje / tarjeta de consulta / tarjeta de oferta / mensaje de sistema).
5. El servidor almacena y reenvía este paquete sin poder descifrar ninguna parte del contenido.
6. El cliente del receptor descifra la clave de sesión con su clave privada X25519, y con ella descifra el contenido.

## **3.3 Qué es metadato (visible al servidor y a VERA) y qué es contenido (solo E2EE)**

| **Dato** | **Clasificación** | **Accesible por VERA / servidor** |
| --- | --- | --- |
| Texto de un mensaje libre | Contenido | NO — cifrado E2EE |
| Cantidad y comentario de una tarjeta de consulta | Contenido | NO — cifrado E2EE, igual que cualquier otro elemento del hilo |
| Cifras de una tarjeta de oferta (unit\_price, quantity, currency, condiciones) | Contenido | NO — cifrado E2EE |
| Remitente y receptor de cada elemento | Metadato | SÍ |
| Timestamp de envío/recepción/lectura | Metadato | SÍ |
| ID del hilo y referencia (part\_number) sobre la que se abrió, si la hay | Metadato | SÍ |
| Tipo de elemento (mensaje libre / tarjeta de consulta / tarjeta de oferta / mensaje de sistema) | Metadato | SÍ — el tipo es visible, el contenido no |
| Estado del hilo y de cada tarjeta (sección 7) | Metadato | SÍ — se calcula sin leer contenido, igual que en v1.0 |
| Marcado de "línea ya consultada" (sección 5.4) | Metadato (asociado a la línea de inventario, no al contenido de la consulta) | SÍ |

# **4. Modelo de Hilo Único y Vías de Entrada al Contacto**

## **4.1 Un hilo, tres tipos de elemento**

A diferencia de la v1.0 de este módulo, no existen tipos de hilo separados. Existe un único tipo de hilo de conversación entre dos organizaciones, que puede contener — mezclados cronológicamente, igual que cualquier chat — tres tipos de elemento:

| **Tipo de elemento** | **Contenido cifrado** | **Cuándo se usa** |
| --- | --- | --- |
| **Mensaje libre** | Texto sin estructura. | Conversación abierta sin relación necesaria con una referencia concreta — presentaciones, preguntas generales, seguimiento de una negociación ya en curso, etc. |
| **Tarjeta de consulta** | Cantidad solicitada (obligatoria) + comentario en texto libre (opcional). | El comprador quiere saber si un distribuidor puede atender una cantidad concreta de una referencia que ha visto en resultados de búsqueda (Módulo 03). Es el contenido que genera el botón "Consultar". |
| **Tarjeta de oferta** | unit\_price, quantity, currency, lead\_time\_days, valid\_until, notes (sección 6.2). | Respuesta natural del distribuidor a una tarjeta de consulta, o propuesta directa de cualquiera de las dos partes en cualquier momento del hilo. Incluye precio — es el único tipo de elemento con cifras comerciales. |

Un mismo hilo entre dos organizaciones puede empezar como un mensaje libre, contener después una tarjeta de consulta sobre una referencia, recibir una tarjeta de oferta como respuesta, una contraoferta, y volver a mensajes libres — todo en la misma conversación. El "estado del hilo" (sección 7) refleja el estado más avanzado entre sus tarjetas de consulta/oferta, no el tipo de su primer elemento.

## **4.2 Las tres vías de entrada al contacto**

| **Vía** | **Punto de entrada** | **Requisitos** | **Genera** |
| --- | --- | --- | --- |
| **Contactar** | Botón "Contactar" junto a cada resultado en SRCH-01/SRCH-02 (Módulo 03), o desde la ficha pública de organización (sección 8). | Ninguno — ni referencia ni cantidad obligatorias. | Abre (o reutiliza, si ya existe) el hilo con esa organización, con un mensaje libre como primer elemento. El contexto de origen (referencia, si venía de un resultado de búsqueda) se guarda como metadato informativo del hilo, sin afectar a su estado. |
| **Consultar** | Botón "Consultar" junto a cada resultado en SRCH-01 (Módulo 03). | Cantidad obligatoria (comentario opcional). Bloqueado si la línea ya está marcada como consultada (sección 5.4). | Abre (o reutiliza) el hilo con esa organización y añade una tarjeta de consulta asociada a esa línea/referencia. Marca la línea como consultada de forma persistente. |
| **Tarjeta de oferta directa** | Dentro de un hilo ya existente, botón "Crear oferta" (sección 6). | unit\_price, quantity, currency obligatorios. | Añade una tarjeta de oferta al hilo existente. No es una "vía de entrada" en sentido estricto — requiere que el hilo ya exista — pero se incluye aquí para completar el panorama de qué puede contener un hilo. |

|  |
| --- |
| **💡 UN SOLO HILO POR PAR DE ORGANIZACIONES**  Independientemente de cuántas referencias distintas se hayan consultado u ofertado entre dos organizaciones, existe un único hilo de conversación entre ellas. Cada tarjeta de consulta o de oferta dentro del hilo lleva su propio metadato de referencia (part\_number) para que tanto los usuarios como VERA puedan identificar de qué línea se trataba cada una, pero no se crean hilos nuevos por cada referencia. Esto simplifica la lista de conversaciones (MSG-01) y refleja cómo funciona en la práctica una relación comercial entre dos distribuidores: un canal de comunicación continuo, con distintos asuntos tratados dentro. |

# **5. Tarjeta de Consulta y Marcado de Líneas Consultadas**

## **5.1 Propósito**

La tarjeta de consulta formaliza la pregunta más habitual del sector: "¿puedes atender esta cantidad de esta referencia?" sin llegar todavía a hablar de precio. Sustituye al antiguo botón "Contactar" de la v1.0 de SRCH-01 para el caso de uso de descubrimiento — el botón "Contactar" ahora se reserva para contacto libre sin relación con una línea concreta (sección 4.2).

## **5.2 Estructura de una tarjeta de consulta**

| **Campo** | **Tipo** | **Obligatorio** | **Descripción** |
| --- | --- | --- | --- |
| part\_number, brand, location\_country del distribuidor | String (heredados del contexto) | Sí | Identifican inequívocamente la línea de inventario sobre la que se consulta (Módulo 02 v1.2). No editables. |
| quantity | Integer | Sí | Cantidad que el comprador desea consultar. El botón "Consultar" no permite el envío sin este campo — si el usuario llegó desde una búsqueda donde ya especificó una cantidad mínima a VERA, ese valor se pre-rellena, pero sigue siendo editable y obligatorio. |
| notes | Texto libre (max 300 car.) | No | Comentario opcional del comprador, ej. "¿Podríais hacer envío parcial si no tenéis las 500 de golpe?" |

## **5.3 Flujo conversacional FL-MSG-01 — Enviar una consulta desde SRCH-01**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Pulsa "Consultar" en la fila de un distribuidor para 6205 2RS FAG. | Sistema comprueba si esa línea ya está marcada como consultada por este comprador (sección 5.4). Si lo está, el botón aparece deshabilitado y no se llega a este turno — ver 5.4. |
| 2 | Sistema | Abre el formulario de tarjeta de consulta con part\_number/brand/distribuidor pre-cargados, campo de cantidad vacío (o pre-cargado si el usuario ya mencionó una cantidad en su búsqueda con VERA) y campo de comentario opcional. | — |
| 3a | Usuario | Introduce la cantidad (y opcionalmente un comentario) y confirma envío. | Si el campo de cantidad está vacío, el sistema no permite confirmar — mensaje: "Indica la cantidad que quieres consultar." |
| 3b | Usuario | Pide a VERA: "Consulta a este distribuidor si tiene 300 unidades". | VERA rellena el formulario con quantity=300 y lo muestra para confirmación — igual que en cualquier otro caso, VERA nunca envía sin que el usuario vea y confirme el formulario final. |
| 4 | Sistema | Cifra la tarjeta de consulta (sección 3.2) y la añade al hilo con esa organización (lo crea si no existe). Marca la línea como consultada (sección 5.4). Notifica al receptor. | El hilo pasa a estado CON CONSULTA PENDIENTE si no tenía ya una tarjeta de oferta pendiente (sección 7). |

## **5.4 Marcado persistente de líneas consultadas**

Cada línea de inventario (identificada por su ID interno en el Módulo 02, no solo por part\_number+brand+distribuidor) puede estar, para un comprador concreto, en uno de dos estados respecto a las consultas: sin consultar, o consultada.

| **Regla** | **Detalle** |
| --- | --- |
| Persistencia | El marcado "consultada por este comprador" se guarda en base de datos, asociado al par (línea de inventario, organización compradora). No es un estado de sesión ni de navegador — persiste entre sesiones, dispositivos y reinicios. |
| Visualización | En SRCH-01 (Módulo 03), una línea ya consultada por el comprador actual se muestra visualmente marcada/sombreada, y el botón "Consultar" aparece deshabilitado con un texto explicativo: "Ya has consultado esta referencia con este distribuidor." |
| Bloqueo | No se permite enviar una segunda tarjeta de consulta sobre la misma línea de inventario al mismo comprador. El botón "Consultar" queda deshabilitado para esa línea de forma permanente, salvo lo indicado en la fila siguiente. |
| Efecto del reemplazo total (Módulo 02 v1.2) | Cuando el distribuidor sube una nueva versión de su inventario, la política de reemplazo total del Módulo 02 v1.2 sustituye las líneas existentes por líneas nuevas (nuevos IDs internos), aunque part\_number, brand y cantidad coincidan con los anteriores. A efectos de este módulo, una línea nueva es una línea nueva: el marcado de "consultada" NO se traslada automáticamente. Una línea recién publicada tras un reemplazo aparece como no consultada, incluso si su predecesora (misma referencia, mismo distribuidor) sí lo estaba. |
| Alcance del bloqueo | El bloqueo es por línea de inventario, no por par "referencia + distribuidor" de forma abstracta. Esto significa que tras cada actualización de inventario del distribuidor, el comprador puede volver a consultar esa referencia si lo desea — se considera una simplificación deliberada frente a la complejidad de rastrear identidad de referencia a través de reemplazos sucesivos. |

|  |
| --- |
| **ℹ️ POR QUÉ EL MARCADO NO SOBREVIVE AL REEMPLAZO**  Se valoró que el sistema identificara "misma referencia + mismo distribuidor" a través de reemplazos sucesivos para mantener el bloqueo, pero se descarta para V1 por la complejidad añadida: requeriría una identidad estable de "línea lógica" independiente del ID de fila, con sus propias reglas de qué cambios (cantidad, precio si lo hubiera, condiciones) rompen o no esa identidad. La simplificación elegida — el marcado vive con el ID de línea, y el reemplazo total genera líneas nuevas — es coherente con el resto del Módulo 02 v1.2, donde el reemplazo total ya se trata como "borrar todo, insertar de nuevo" sin intentar diffs inteligentes. |

# **6. Tarjeta de Oferta**

## **6.1 Propósito y relación con la tarjeta de consulta**

La tarjeta de oferta es el único elemento del hilo que contiene cifras de precio. El flujo natural en el sector es: el comprador envía una tarjeta de consulta (sección 5) indicando cantidad; el distribuidor, al verla, entiende qué referencia y qué cantidad se está consultando y responde con una tarjeta de oferta que incluye precio y condiciones. La tarjeta de oferta también puede enviarse directamente, sin una consulta previa, si cualquiera de las dos partes lo considera oportuno dentro de un hilo ya existente.

## **6.2 Estructura de una tarjeta de oferta**

| **Campo** | **Tipo** | **Obligatorio** | **Descripción** |
| --- | --- | --- | --- |
| part\_number, brand | String | Sí | Heredados del contexto del hilo o de la tarjeta de consulta a la que responde, si aplica. No editables salvo que el usuario cambie explícitamente de referencia dentro de la misma conversación. |
| unit\_price | Decimal (2 dec) | Sí | Precio unitario propuesto. Cifra cifrada E2EE — coherente con la decisión QA-INV-01 del Módulo 02 v1.2: el precio se introduce aquí, durante la negociación. |
| currency | ISO 4217 | Sí | Divisa de la oferta. Por defecto, la divisa del distribuidor si la referencia proviene de su inventario. |
| quantity | Integer | Sí | Cantidad propuesta. Si la oferta responde a una tarjeta de consulta, se pre-rellena con la cantidad de esa consulta, pero es editable — el distribuidor puede ofertar una cantidad distinta. |
| lead\_time\_days | Integer | No | Plazo de entrega propuesto, si difiere del indicado en el inventario original. |
| shipping\_cost | Decimal (2 dec) | No | NUEVO v1.4. Coste de transporte estimado por quien emite la oferta. Es un valor introducido manualmente — no hay ningún cálculo de landed cost, aranceles ni tarifas automáticas en V1 (ver Módulo 05 v2.0, alcance reducido). Cifra cifrada E2EE, igual que el resto de la tarjeta. |
| shipping\_cost\_currency | ISO 4217 | No (obligatorio si shipping\_cost tiene valor) | NUEVO v1.4. Divisa del coste de transporte. Por defecto, coincide con currency (la divisa de la oferta), pero el usuario puede cambiarla si el coste de transporte se ha cotizado en una divisa distinta. |
| valid\_until | Fecha | No | Fecha límite de validez de la oferta. Si se omite, la oferta no expira automáticamente. |
| notes | Texto libre (max 500 car.) | No | Condiciones adicionales en lenguaje natural: incoterm propuesto, forma de pago, etc. |

|  |
| --- |
| **🚚 COSTE DE TRANSPORTE — CAMPO SIMPLE, SIN CÁLCULO (NUEVO v1.4)**  A diferencia de lo que contemplaba el Módulo 05 en versiones anteriores (perfiles logísticos, calculadora de aranceles, landed cost automático), en V1 el coste de transporte es simplemente un número que quien hace la oferta escribe a mano dentro de la propia tarjeta, junto con su divisa (por defecto la misma de la oferta, editable). El receptor de la oferta lo ve como un dato más, sin ningún desglose ni cálculo añadido por la plataforma. El Módulo 05 v2.0 desarrolla con más profundidad este campo y aplaza a V2 cualquier automatización (tarifas por destino, aranceles, landed cost calculado). |

## **6.3 Flujo conversacional FL-MSG-02 — Responder a una consulta con una oferta**

| **Turno** | **Actor** | **Acción** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Distribuidor | Ve la tarjeta de consulta recibida (referencia y cantidad descifradas localmente). Pulsa "Responder con oferta". | El formulario de tarjeta de oferta se abre pre-cargado con part\_number, brand y quantity de la consulta — el distribuidor completa unit\_price, currency y, si quiere, ajusta quantity, lead\_time\_days, valid\_until, notes. |
| 2 | Distribuidor | Confirma y envía. | El cliente serializa la tarjeta como JSON, la cifra (sección 3.2) y la envía con metadato tipo=tarjeta\_oferta, estado\_oferta=pendiente. La tarjeta de consulta original queda marcada como "respondida" (metadato). |
| 3 | VERA (lado del comprador) | Notifica: "Has recibido una oferta de [Organización] para [referencia] — ábrela para ver los detalles." | Notificación basada en metadato, sin conocer el contenido. |
| 4 | Comprador | Abre la oferta (requiere passphrase si no está en sesión). Ve la tarjeta renderizada con los valores descifrados. | — |
| 5a | Comprador | Pulsa "Aceptar oferta". | Mensaje de sistema cifrado de confirmación + metadato tipo=sistema/aceptación. El hilo pasa a ACUERDO ALCANZADO (sección 7). |
| 5b | Comprador | Pulsa "Rechazar oferta". | Metadato tipo=sistema/rechazo. El hilo vuelve al estado que tuviera antes de esta oferta (sección 7). |
| 5c | Comprador | Pulsa "Hacer contraoferta". | Se repite el flujo desde el paso 1 con el Comprador como emisor de una nueva tarjeta de oferta. La anterior queda marcada como superada (metadato), sin eliminarse del historial. |

## **6.4 Pantalla MSG-03 — Componente "Tarjeta de oferta" y "Tarjeta de consulta"**

**Descripción**

Ambas tarjetas se renderizan en el historial del hilo (MSG-02) con componentes visuales propios, diferenciados del texto libre.

**Tarjeta de consulta — elementos**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Cabecera | Referencia y marca, icono distintivo de "Consulta". |
| Cantidad consultada | Valor destacado, descifrado localmente. |
| Comentario | Si se incluyó, se muestra debajo. |
| Estado | Chip: Pendiente de respuesta / Respondida con oferta — refleja si existe ya una tarjeta de oferta posterior en el hilo asociada a esta consulta. |
| Botón "Responder con oferta" (solo para el receptor, mientras pendiente) | Abre el flujo FL-MSG-02. |

**Tarjeta de oferta — elementos**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Cabecera | Referencia y marca, icono distintivo de "Oferta". |
| Bloque de precio y cantidad | unit\_price × quantity, con el total calculado automáticamente — el cálculo ocurre localmente sobre los valores descifrados, nunca en el servidor. |
| Coste de transporte (NUEVO v1.4) | Si shipping\_cost tiene valor, se muestra como una línea adicional separada del total de producto: importe + su divisa (shipping\_cost\_currency). Si no se indicó, esta línea no aparece — no se muestra un "0" engañoso. |
| Condiciones | lead\_time\_days, valid\_until y notes, si se proporcionaron. |
| Estado | Chip: Pendiente / Aceptada / Rechazada / Superada por contraoferta. |
| Botones de acción (solo en oferta recibida y pendiente) | Aceptar oferta / Rechazar oferta / Hacer contraoferta. |
| Aviso de expiración | Si valid\_until ha pasado y la oferta sigue pendiente, se muestra "Esta oferta ha expirado" — aviso visual local, no bloquea la posibilidad de aceptarla igualmente (la fecha es orientativa, no contractual en V1). |

# **7. Ciclo de Vida del Hilo de Conversación**

## **7.1 Estados**

| **Estado** | **Descripción** | **Transiciones** |
| --- | --- | --- |
| **ABIERTO** | Estado inicial o por defecto. El hilo existe (al menos un mensaje libre o una tarjeta resuelta) y no hay ninguna tarjeta de consulta ni de oferta pendiente actualmente. | → CON CONSULTA PENDIENTE (al enviarse una tarjeta de consulta) / → CON OFERTA PENDIENTE (al enviarse una tarjeta de oferta directamente) / → CERRADO SIN ACUERDO (manual) |
| **CON CONSULTA PENDIENTE** | Existe al menos una tarjeta de consulta cuyo estado es "pendiente de respuesta". | → CON OFERTA PENDIENTE (al responder con una tarjeta de oferta) / → ABIERTO (si el receptor responde con un mensaje libre sin tarjeta de oferta, p.ej. "no tengo esa cantidad disponible" — la consulta queda marcada como "respondida sin oferta") / → CERRADO SIN ACUERDO (manual) |
| **CON OFERTA PENDIENTE** | Existe una tarjeta de oferta cuyo estado\_oferta es "pendiente". | → ACUERDO ALCANZADO (al aceptar) / → ABIERTO o CON CONSULTA PENDIENTE, según corresponda (al rechazar) / → CON OFERTA PENDIENTE (al hacer contraoferta — la nueva oferta sustituye a la anterior como "pendiente") / → CERRADO SIN ACUERDO (manual) |
| **ACUERDO ALCANZADO** | Una oferta ha sido aceptada por ambas partes. | → ABIERTO (reversión manual, sin restricciones — sección 7.2) / → CERRADO (manual) |
| **CERRADO SIN ACUERDO** | Cualquiera de las partes ha cerrado el hilo sin llegar a un acuerdo. | Estado final. El hilo permanece visible en el historial pero no admite nuevos elementos salvo que una de las partes lo reabra explícitamente (→ ABIERTO). |

## **7.2 Reversión de "Acuerdo Alcanzado"**

A diferencia de la v1.0, la transición ACUERDO ALCANZADO → ABIERTO es siempre posible, por cualquiera de las dos partes, sin restricciones ni período de gracia. Esto refleja que "acuerdo alcanzado" en Bearingworld.io no tiene valor contractual ni legal por sí mismo — es una anotación de buena fe entre las partes sobre el estado de su negociación, no un contrato. Si alguna de las partes considera que el acuerdo anotado ya no refleja la realidad (cambio de condiciones, error al marcarlo, etc.), puede revertirlo libremente. VERA, al ejecutar esta reversión a petición del usuario, la trata como ACCIÓN REVERSIBLE con confirmación ligera (Módulo 00) — no como una acción de alto impacto, precisamente porque no tiene consecuencias contractuales.

## **7.3 Cierre sin acuerdo**

Cualquiera de las dos partes puede cerrar el hilo (salvo en ACUERDO ALCANZADO, donde primero habría que revertir a ABIERTO) mediante la acción "Cerrar sin acuerdo". VERA clasifica esta acción como REVERSIBLE (el hilo puede reabrirse) pero pide confirmación igualmente, ya que tiene efecto visible para la otra parte (mensaje de sistema "El otro participante ha cerrado esta conversación").

* Si el hilo tenía una tarjeta de consulta o de oferta pendiente al cerrarse, esa tarjeta queda marcada como "no resuelta" en el historial.
* El cierre sin acuerdo no tiene ningún efecto sobre el marcado de "línea consultada" (sección 5.4) — ese marcado es independiente del estado del hilo.

# **8. Ficha Pública de Organización**

## **8.1 Propósito**

La ficha de organización es el punto de entrada "neutral" al contacto: permite a un miembro consultar los datos generales de otra organización y, desde ahí, iniciar un hilo mediante la vía "Contactar" (sección 4.2), sin que esto dependa de haber realizado una búsqueda previa. Resuelve la pregunta de cómo abrir una conversación que no tiene relación con ninguna referencia concreta — por ejemplo, una organización que quiere presentarse a otra antes de empezar a operar con ella.

## **8.2 Acceso a la ficha**

* Desde un resultado de búsqueda (SRCH-01/SRCH-02, Módulo 03): el nombre de la organización es un enlace que abre su ficha.
* Desde un hilo existente (MSG-02): el nombre de la organización contraparte, en la cabecera del hilo, es un enlace que abre su ficha.
* Desde el Directorio de Organizaciones (sección 8.5, NUEVO v1.2): cualquier fila del directorio enlaza a la ficha completa de esa organización.

## **8.3 Pantalla MSG-04 — Ficha de organización**

**Descripción**

Renderizado en Zona A. Vista de solo lectura de los datos públicos de una organización miembro.

**Elementos de la pantalla**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Datos generales | Nombre de la organización, país (location\_country principal), dirección, código postal, fecha de incorporación a la plataforma (antigüedad), idioma(s) declarado(s) si el Módulo 01 los recoge. |
| Datos de contacto público (NUEVO v1.2) | Email de contacto público y teléfono de contacto público (prefijo de país + número), introducidos y validados en el registro (Módulo 01 v1.3, REG-01) y mantenidos en Ajustes → Datos de la organización. Visibles para todos los miembros sin restricción — vía de contacto directo independiente de la mensajería E2EE de este módulo. |
| Indicador de favoritos | Si el sistema de favoritos del Módulo 03 está activo, muestra cuántos miembros han marcado a esta organización como favorita — informativo, sin ranking ni cálculo algorítmico (Módulo 03, sección de favoritos). |
| Botón "Contactar" | Inicia o reabre el hilo único con esta organización mediante la vía "Contactar" (sección 4.2) — sin requisitos de cantidad ni referencia. |
| Resumen de inventario público | Opcional: enlace a los resultados de búsqueda filtrados por esta organización (Módulo 03), para que el usuario pueda ver qué tiene publicado antes de decidir si contacta. |

## **8.4 Flujo conversacional FL-MSG-03 — Contacto libre desde la ficha**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Abre la ficha de "Acme Bearings GmbH" (desde un resultado de búsqueda o desde un hilo previo) y pulsa "Contactar". | VERA clasifica: ACCIÓN REVERSIBLE — abrir o reutilizar un hilo no tiene coste ni efecto irreversible por sí mismo. |
| 2 | VERA | "Voy a abrir una conversación con Acme Bearings GmbH. ¿Quieres incluir un mensaje inicial o lo escribes tú?" | Si ya existe un hilo con esa organización, se reutiliza (sección 4.1) en lugar de crear uno nuevo — VERA lo indica: "Ya tienes una conversación abierta con ellos, la continuamos." |
| 3 | Usuario | Escribe o dicta un mensaje libre. | El cliente cifra el mensaje libre y lo envía como nuevo elemento del hilo (existente o recién creado). |

## **8.5 Directorio de Organizaciones — pantalla MSG-05 (NUEVO v1.2)**

El Directorio de Organizaciones es una sección de navegación accesible directamente desde el menú principal de la plataforma — al mismo nivel que Búsqueda o Alertas, no solo mediante enlaces contextuales. Es el equivalente funcional al listado de miembros de BearingNet (PRD, sección 2.3): una tabla de todas las organizaciones activas en la plataforma, filtrable, que cualquier miembro puede consultar para descubrir quién opera en el sector, independientemente de si tiene o no inventario coincidente con una búsqueda concreta.

### **8.5.1 Pantalla MSG-05 — Tabla del directorio**

**Elementos de la pantalla**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Tabla de organizaciones | Una fila por organización activa (Módulo 01, estado ACTIVE). Columnas: Nombre de la organización (enlace a su ficha MSG-04), País, Teléfono de contacto público, Email de contacto público, Favoritos (recuento, sección de favoritos del Módulo 03). La dirección postal completa NO se muestra en esta tabla (NUEVO v1.5) — no aporta valor en formato tabla compacta; sigue visible en la ficha de organización (MSG-04). |
| Filtro por país | Selector o campo de texto sobre location\_country — el mismo conjunto de valores ISO 3166-1 usado en el resto de la plataforma (Módulo 02). Permite ver de un vistazo qué organizaciones operan en un país concreto. |
| Filtro/búsqueda por nombre | Campo de texto libre que filtra la tabla por coincidencia parcial en el nombre de la organización. Combinable con el filtro de país. |
| Ordenación | Por defecto, alfabético por nombre de organización. El usuario puede ordenar por cualquier columna (incluido favoritos) con los headers de columna. |
| Acceso desde VERA | El usuario puede pedir a VERA, por ejemplo, "muéstrame las organizaciones de Polonia" o "busca la ficha de Acme Bearings" — VERA aplica el filtro correspondiente sobre MSG-05 y, si la búsqueda por nombre devuelve un resultado único, puede ofrecer abrir directamente su ficha (MSG-04). |

|  |
| --- |
| **📇 DIRECTORIO ABIERTO — "PÁGINAS AMARILLAS" DEL SECTOR**  El Directorio de Organizaciones y los datos de contacto público (teléfono, email) que muestra son visibles para todos los miembros de la plataforma, sin restricciones de visibilidad ni reglas de whitelist/blacklist (que en el Módulo 02 aplican al inventario, no a los datos de la organización en sí). La intención de producto es deliberada: Bearingworld.io no busca forzar todo el contacto a través de su mensajería E2EE. Si dos organizaciones, tras verse en el directorio o en resultados de búsqueda, prefieren llamarse por teléfono o escribirse a un email comercial directamente, la plataforma no lo impide ni lo penaliza — es el mismo espíritu del directorio de miembros que ya existe en BearingNet, mejorado con datos de contacto más completos y con filtros. |

# **9. Capa Conversacional VERA en este Módulo**

Esta sección detalla cómo VERA participa en cada vía de contacto, respetando en todo momento el invariante de privacidad: VERA opera sobre metadatos y sobre el texto o formulario en claro que el propio usuario está redactando (antes de cifrar), nunca sobre contenido cifrado ajeno, y nunca decide ni propone cifras sin que el usuario las haya proporcionado explícitamente.

## **9.1 Notificaciones y resúmenes basados en metadatos**

| **Situación** | **Comportamiento de VERA** |
| --- | --- |
| Nuevo mensaje libre recibido | VERA notifica: "Tienes un nuevo mensaje de [Organización]." No describe el contenido. |
| Nueva tarjeta de consulta recibida | VERA notifica: "Has recibido una consulta de [Organización] sobre [referencia] — ábrela para ver la cantidad solicitada." |
| Nueva tarjeta de oferta recibida | VERA notifica: "Has recibido una oferta de [Organización] para [referencia] — ábrela para ver los detalles." |
| "¿Tengo algo pendiente en mensajería?" | VERA responde por metadatos: número de hilos con elementos no leídos, número de consultas pendientes de respuesta, número de ofertas pendientes de respuesta, y cuáles llevan más tiempo sin actividad — todo calculable sin descifrar nada. |

## **9.2 Ayuda a la redacción y al rellenado de formularios (siempre sobre el borrador en claro, antes de cifrar)**

| **Situación** | **Comportamiento de VERA** |
| --- | --- |
| "Ayúdame a redactar un mensaje de presentación para Acme Bearings" | VERA propone un texto en el campo de redacción (MSG-02, vía Contactar). El usuario lo ve, edita si quiere, y solo al pulsar enviar el cliente lo cifra. |
| "Consulta a este distribuidor si tiene 300 unidades de 6205 2RS" | VERA rellena el formulario de tarjeta de consulta (sección 5.2) con quantity=300 y lo muestra para confirmación — el usuario revisa y confirma antes de cifrar y enviar (FL-MSG-01, turno 3b). |
| "Ofrécele 2,10€ por unidad para 500 piezas con entrega en dos semanas" (como respuesta a una consulta o como oferta directa) | VERA rellena el formulario de tarjeta de oferta (sección 6.2) con esos valores — proporcionados explícitamente por el usuario en su instrucción — y lo muestra para revisión y confirmación. VERA nunca propone una cifra de precio que el usuario no haya dicho. |

|  |
| --- |
| **🔒 LO QUE VERA NUNCA HACE EN ESTE MÓDULO**  VERA no decide ni sugiere cifras de precio por iniciativa propia. VERA no cifra ni envía ningún mensaje o tarjeta sin que el usuario haya visto el contenido final en claro y confirmado explícitamente. VERA no tiene acceso al contenido de ninguna tarjeta de consulta u oferta salvo las que el propio usuario está redactando en ese momento, antes de cifrar. VERA no resume conversaciones a partir de contenido descifrado (funcionalidad eliminada de V1, diferida a V2 — QA-MSG-04). VERA no traduce mensajes ni tarjetas (sin mecanismo de traducción en la plataforma — QA-MSG-05 cerrada). |

# **10. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-MSG-01 | El servidor nunca almacena ni procesa en texto plano el contenido de ningún elemento del hilo (mensaje libre, tarjeta de consulta, tarjeta de oferta), incluidas las cifras de las tarjetas de oferta y las cantidades de las tarjetas de consulta. | **CRÍTICA** |
| RNG-MSG-02 | Las transiciones de estado del hilo (sección 7) se calculan exclusivamente a partir de metadatos (tipo de elemento, estado\_oferta, estado\_consulta). Ninguna transición de estado requiere que el servidor descifre contenido. | **CRÍTICA** |
| RNG-MSG-03 | VERA nunca envía ni cifra ningún elemento del hilo sin que el usuario haya visto y confirmado su contenido final en claro, incluidos los textos generados por VERA y los formularios de consulta u oferta rellenados por VERA. VERA nunca propone una cifra de precio que el usuario no haya proporcionado explícitamente. | **CRÍTICA** |
| RNG-MSG-04 | El botón "Consultar" no puede pulsarse (o, si se pulsa, no permite confirmar el envío) sin que el campo de cantidad tenga un valor. El botón "Contactar" y la tarjeta de oferta directa no tienen este requisito. | **ALTA** |
| RNG-MSG-05 | El marcado de "línea consultada" (sección 5.4) es persistente en base de datos, por par (línea de inventario, organización compradora), y bloquea el envío de nuevas tarjetas de consulta sobre esa misma línea. No se traslada a líneas nuevas generadas por reemplazo total (Módulo 02 v1.2). | **ALTA** |
| RNG-MSG-06 | Existe un único hilo de conversación por par de organizaciones. Cualquier vía de contacto (sección 4.2) hacia una organización con la que ya existe un hilo reutiliza ese hilo, nunca crea uno nuevo. | **ALTA** |
| RNG-MSG-07 | La transición ACUERDO ALCANZADO → ABIERTO (sección 7.2) está siempre disponible para cualquiera de las dos partes, sin restricciones, condiciones ni período de gracia. | MEDIA |
| RNG-MSG-08 | Bearingworld.io no procesa pagos ni transacciones financieras entre miembros en ninguna versión de la plataforma. Ningún flujo de este módulo puede interpretarse ni evolucionar hacia gestionar dicho pago. | **CRÍTICA** |
| RNG-MSG-09 | Para prevenir spam de contacto masivo, el Messaging Service aplica un límite de tasa de nuevos hilos iniciados por organización: 25 hilos nuevos por organización y día natural como valor de partida (QA-MSG-01 cerrada), configurable a nivel de plataforma (no hardcoded) y revisable tras observar el uso real post-lanzamiento. Superar el límite no bloquea hilos existentes, solo la creación de nuevos. | MEDIA |

# **11. Criterios de Aceptación por Flujo**

## **Modelo de hilo único (sección 4)**

* CA-MSG-01: Iniciar contacto (por cualquier vía) con una organización con la que ya existe un hilo reutiliza ese hilo — no aparecen dos hilos distintos con la misma organización en MSG-01.
* CA-MSG-02: Un hilo puede contener, en el mismo historial y en orden cronológico, mensajes libres, tarjetas de consulta y tarjetas de oferta sin restricción de orden entre ellos (salvo las transiciones de estado de la sección 7).

## **Tarjeta de consulta y marcado (FL-MSG-01)**

* CA-MSG-03: El botón "Consultar" no permite confirmar el envío sin un valor de cantidad. Si VERA rellena el formulario a partir de lenguaje natural, el campo de cantidad llega ya completado.
* CA-MSG-04: Tras enviar una tarjeta de consulta sobre una línea, esa línea aparece marcada/sombreada en SRCH-01 para ese comprador, con el botón "Consultar" deshabilitado, de forma persistente entre sesiones.
* CA-MSG-05: Tras un reemplazo total de inventario del distribuidor (Módulo 02 v1.2), las nuevas líneas resultantes aparecen como no consultadas para todos los compradores, independientemente de su estado de marcado antes del reemplazo.

## **Tarjeta de oferta (FL-MSG-02)**

* CA-MSG-06: Una tarjeta de oferta enviada como respuesta a una tarjeta de consulta hereda part\_number, brand y quantity de la consulta, pre-rellenados pero editables.
* CA-MSG-07: Aceptar una oferta transiciona el hilo a ACUERDO ALCANZADO. Esta transición puede revertirse a ABIERTO en cualquier momento por cualquiera de las dos partes, sin restricciones.
* CA-MSG-08: Hacer una contraoferta marca la oferta anterior como "superada" en el historial visual sin eliminarla.
* CA-MSG-08B (NUEVO v1.4): Una tarjeta de oferta con shipping\_cost informado muestra ese importe y su divisa como línea separada del total de producto. Si no se informó, no aparece ninguna línea de coste de transporte.

## **Ficha de organización (FL-MSG-03)**

* CA-MSG-09: La ficha de organización (MSG-04) es accesible desde el nombre de la organización en SRCH-01/SRCH-02 y desde la cabecera de un hilo existente (MSG-02).
* CA-MSG-10: El botón "Contactar" desde MSG-04 abre o reutiliza el hilo único con esa organización, sin requerir cantidad ni referencia.

## **Cifrado y privacidad**

* CA-MSG-11: Un elemento del hilo interceptado a nivel de servidor (auditoría/inspección de base de datos) no permite reconstruir el texto plano de un mensaje libre, ni la cantidad de una tarjeta de consulta, ni las cifras de una tarjeta de oferta.
* CA-MSG-12: Un usuario sin la passphrase activa en su sesión actual ve el indicador "Contenido cifrado — introduce tu frase de seguridad para ver" en lugar de cualquier contenido, en MSG-01 y MSG-02.

# **12. Preguntas Abiertas y Decisiones Pendientes**

| **ID** | **Pregunta** | **Propietario** | **Límite** |
| --- | --- | --- | --- |
| QA-MSG-01 ✅ | Límite de tasa de nuevos hilos por organización (RNG-MSG-09). | — | CERRADA — 25 hilos/organización/día como valor de partida, ajustable tras observar uso real |
| QA-MSG-02 ✅ | Necesidad de un buscador/directorio de organizaciones más allá de los accesos contextuales (sección 8.2). | — | CERRADA — nuevo Directorio de Organizaciones (MSG-05, sección 8.5) |
| QA-MSG-03 ✅ | Reversión de "Acuerdo Alcanzado": siempre posible, sin restricciones, sin valor contractual (sección 7.2). | — | CERRADA |
| QA-MSG-04 ✅ | Resumir conversación con ayuda de IA sobre contenido descifrado: eliminado de V1, diferido a V2 para análisis legal/privacidad más detallado. | — | CERRADA — DIFERIDA A V2 |
| QA-MSG-05 ✅ | Traducción de mensajes/tarjetas entre idiomas distintos de los participantes: eliminada de la plataforma — sin mecanismo de traducción, cada usuario se comunica en el idioma que decida con su contraparte. | — | CERRADA |

# **13. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Mensajería E2EE entre miembros con tarjetas de oferta para introducir unit\_price durante la negociación. |
| 1.1 | Junio 2026 | Equipo de Producto | Revisión completa: (1) Modelo de hilo único por par de organizaciones, con tres tipos de elemento (mensaje libre, tarjeta de consulta, tarjeta de oferta) en lugar de tipos de hilo separados. (2) Nueva tarjeta de consulta — cantidad obligatoria + comentario opcional — como vía principal de descubrimiento desde SRCH-01, separada del contacto libre. (3) Marcado persistente de líneas consultadas, por línea de inventario y comprador, no trasladable tras reemplazo total. (4) Nueva ficha pública de organización (MSG-04) con acceso a "Contactar" sin requisitos. (5) "No procesamiento de pagos" elevado a declaración de principio permanente de la plataforma (RNG-MSG-08). (6) Reversión de "Acuerdo Alcanzado" sin restricciones (QA-MSG-03 cerrada). (7) "Resumir conversación con IA" eliminado de V1, diferido a V2 (QA-MSG-04). (8) Traducción entre idiomas eliminada de la plataforma (QA-MSG-05 cerrada). (9) Eliminado el concepto de "mejores distribuidores" y el botón de contacto automático en lote — referido al Módulo 03, donde queda sin definir para V2. |
| 1.2 | Junio 2026 | Equipo de Producto | (1) Nuevo Directorio de Organizaciones (MSG-05, sección 8.5), accesible desde el menú principal, con filtros por nombre y país y columnas de dirección, teléfono/email de contacto público y favoritos (QA-MSG-02 cerrada). (2) Ficha de organización (MSG-04) ampliada con los nuevos datos de contacto público (email, teléfono, dirección, código postal), añadidos como campos obligatorios en el Módulo 01 v1.4. (3) Confirmado el carácter de "páginas amarillas" abierto: estos datos de contacto son visibles para todos los miembros sin restricción, como vía de contacto directo independiente de la mensajería E2EE. (4) Límite de tasa de nuevos hilos (RNG-MSG-09) cerrado con valor de partida de 25 hilos/organización/día (QA-MSG-01 cerrada). |
| 1.4 | Junio 2026 | Equipo de Producto | Añadidos a la tarjeta de oferta (sección 6.2) dos campos nuevos y opcionales: shipping\_cost (coste de transporte, numérico) y shipping\_cost\_currency (su divisa, por defecto la misma de la oferta, editable). Es un dato simple introducido manualmente por quien hace la oferta, sin ningún cálculo automático asociado — coherente con la reducción de alcance del Módulo 05 a v2.0 (perfiles logísticos, aranceles y landed cost automático quedan diferidos a V2). Actualizada la sección 1.2 (fuera de alcance) y añadido CA-MSG-08B. |
| 1.5 | Junio 2026 | Equipo de Producto | Cierre de comentarios de revisión del Inventario de Pantallas: eliminada la columna Dirección de la tabla del Directorio de Organizaciones (MSG-05, sección 8.5.1) — no aporta valor en formato tabla compacta; la dirección sigue visible en la ficha de organización (MSG-04). Confirmado y sin cambios el comportamiento de RNG-MSG-06 (un único hilo por par de organizaciones), tras aclaración del concepto: el nuevo flujo de "Consultar Seleccionados" del Módulo 03 v1.6 respeta esta misma regla — varias consultas al mismo distribuidor desde una selección en lote se añaden todas al mismo hilo único, nunca a hilos separados por referencia. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.1 | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.5 | Módulo 02 — Gestión de Inventario v1.3 | Módulo 03 — Búsqueda Conversacional v1.6 | Módulo 05 — Calculadora Logística v2.0 |