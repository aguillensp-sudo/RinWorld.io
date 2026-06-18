**BEARINGNET COMPETITOR**

**PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 00 — ARQUITECTURA DE INTERACCIÓN IA**

**DOCUMENTO FUNDACIONAL · Aplica a todos los módulos**

Versión 1.1 · Junio 2026 · CONFIDENCIAL

# 1. Por Qué Existe Este Documento

Los módulos 01 y 02 de esta especificación funcional fueron redactados con un modelo de interacción implícito: el usuario navega por pantallas, rellena formularios y pulsa botones. La inteligencia artificial aparecía en esos módulos como una herramienta puntual — el motor de mapeo de columnas CSV, la búsqueda conversacional prevista para el Módulo 03 — pero no como la capa de interacción principal.

Durante el proceso de especificación funcional se tomó una decisión estratégica de mayor calado: la plataforma no es una aplicación web con un chatbot. Es un agente conversacional con una interfaz visual de apoyo. Esta decisión invierte la jerarquía de interacción y tiene consecuencias sobre todos los módulos.

Este documento — Módulo 00 — define las reglas del juego que gobiernan esa arquitectura. Es un documento fundacional: todo módulo funcional posterior se escribe asumiendo los principios aquí definidos. Los Módulos 01 y 02 ya escritos serán revisados para incorporar la capa conversacional según este marco.

|  |
| --- |
| **🎯 LA APUESTA ESTRATÉGICA**  Ninguna plataforma B2B vertical de nicho ha implementado todavía un agente conversacional como interfaz primaria. BearingNet opera con una UX de 2005. Esta arquitectura no es solo una mejora de experiencia de usuario — es la decisión que hace que la plataforma sea imposible de copiar a corto plazo sin reconstruir desde cero. |

# 2. El Modelo Mental de la Interfaz

## 2.1 La jerarquía invertida

En una aplicación web clásica, el usuario navega por pantallas y el chat (si existe) es un asistente secundario que aparece como un widget en una esquina. En esta plataforma la relación es la inversa:

| **Dimensión** | **Modelo clásico (BearingNet y equivalentes)** | **Nuestro modelo** |
| --- | --- | --- |
| Interfaz primaria | Pantallas, formularios, menús de navegación. | El agente conversacional — siempre visible, siempre activo. |
| Interfaz secundaria | No existe alternativa conversacional. | La UI visual — representa el estado actual y permite interacción directa cuando es más eficiente que el chat. |
| Cómo se inicia una acción | El usuario busca la opción en el menú, navega a la pantalla correcta, rellena el formulario. | El usuario describe lo que quiere en lenguaje natural. El agente navega, rellena y ejecuta. |
| Para quién está optimizado | Para usuarios que aprenden la estructura de la aplicación. | Para usuarios que saben lo que quieren pero no necesariamente dónde está en la interfaz. |
| Curva de aprendizaje | Alta. El usuario debe aprender la lógica de navegación de la app. | Mínima. El usuario habla como hablaría con un colega experto. |

## 2.2 La analogía correcta

La analogía más precisa no es "una app con un chatbot". Es la relación entre un piloto y el copiloto en una cabina. El piloto (el usuario) decide adónde ir y da las instrucciones. El copiloto (el agente IA) conoce todos los sistemas, ejecuta los procedimientos, anticipa las necesidades y avisa de los problemas — pero el mando final siempre es del piloto.

Otra analogía válida para el contexto del sector: es como tener un empleado muy experimentado sentado al lado que conoce toda la plataforma, toda tu actividad histórica, el mercado en tiempo real, y que nunca se cansa de responder preguntas ni de ejecutar tareas repetitivas.

## 2.3 Coexistencia de las dos capas

Las dos capas de interacción coexisten en todo momento. No son excluyentes. El usuario puede:

* Usar exclusivamente el chat para toda su actividad en la plataforma.
* Usar exclusivamente la UI visual clásica, ignorando el chat por completo.
* Alternar libremente entre ambas. Una acción iniciada en el chat puede completarse en la UI. Una acción iniciada en la UI puede continuarse en el chat.

La plataforma no fuerza el uso del chat. Pero lo diseña para que sea la vía más rápida y natural para la mayoría de las acciones.

# 3. El Agente — Identidad, Rol y Límites

## 3.1 Identidad del agente

El agente tiene nombre, tono y personalidad consistentes en toda la plataforma. No es un chatbot genérico ni un asistente de soporte. Es un experto en distribución de rodamientos y transmisión de potencia que además conoce perfectamente los sistemas de la plataforma.

| **Atributo** | **Definición** |
| --- | --- |
| Nombre | VERA. Nombre femenino derivado del latín verus (verdadero, auténtico). Funciona sin ambigüedad en todos los idiomas de la plataforma (ES, EN, DE, IT, FR, PL, PT, RU, JA), es corto, y su significado conecta directamente con la propuesta de valor de transparencia y privacidad de la plataforma. DECISIÓN CERRADA. |
| Tono | Profesional y directo. Sin artificios. El usuario tipo tiene 30-60 años, background técnico-comercial, y no tiene paciencia para respuestas largas o floridas. El agente habla como un colega competente, no como un asistente de soporte corporativo. |
| Idioma | Se adapta automáticamente al idioma del perfil del usuario. Soporta los 9 idiomas de la plataforma (ES, EN, DE, IT, FR, PL, PT, RU, JA). Dentro de una misma sesión, si el usuario cambia de idioma, el agente cambia también. |
| Voz | V1: solo texto. La interfaz de voz — especialmente relevante para usuarios en almacén con manos ocupadas — se difiere a V2. DECISIÓN CERRADA. |
| Avatar | Icono vectorial minimalista. No una foto realista ni un personaje animado. Consistente con el lenguaje visual de la plataforma. |

## 3.2 Qué puede hacer el agente

El agente puede ejecutar cualquier acción disponible en la plataforma que el usuario autenticado tenga permiso de realizar. No existe un subconjunto reducido de funciones "para el chat" — la cobertura es total.

| **Categoría** | **Ejemplos de instrucciones que el agente entiende y ejecuta** |
| --- | --- |
| Búsqueda e inventario ajeno | "Busca 6205 2RS FAG, mínimo 200 unidades, en Europa" "¿Quién tiene stock de 22316 en España ahora mismo?" "Muéstrame los 5 mejores proveedores de este rodamiento por reputación" |
| Gestión de mi inventario | "Actualiza el stock de la referencia 6305 a 450 unidades" "Oculta todo mi inventario a la empresa Rodamientos García" "¿Cuándo fue la última vez que actualicé mi stock?" "Archiva todas las líneas que llevan más de 60 días sin movimiento" |
| Mensajería y negociación | "Manda un mensaje a Juan de SKF Nordic sobre la referencia 6206" "¿Tengo alguna negociación abierta pendiente de respuesta?" "Muéstrame el historial de conversaciones con Bearing House GmbH" |
| Perfil y configuración | "Añade Francia y Bélgica a mis países de operación" "Cambia la visibilidad por defecto de mi inventario a solo miembros verificados" "Invita a maria@empresa.com como usuario de mi organización" |
| Alertas y watchers | "Avísame cuando haya más de 500 unidades de 6205 2RS disponibles en Alemania" "¿Qué alertas tengo activas ahora mismo?" "Elimina el watcher del rodamiento 6305" |
| Consultas de mercado | "¿Cuántos miembros tienen stock de 22316 ahora mismo?" "¿Cuál es el distribuidor más activo en Polonia este mes?" "¿Ha subido el stock disponible de rodamientos de bolas en los últimos 7 días?" |
| Onboarding y ayuda | "¿Cómo subo mi inventario desde Excel?" "Explícame cómo funciona la visibilidad bilateral" "¿Qué es la passphrase de backup y por qué la necesito?" |
| Logística | "¿Cuánto me costaría recibir 100 unidades de 6205 desde Alemania?" "Actualiza mis tarifas de flete para envíos a México" |

## 3.3 Qué NO puede hacer el agente — límites no negociables

| **Límite** | **Razón** | **Comportamiento del agente** |
| --- | --- | --- |
| Ejecutar acciones irreversibles sin confirmación explícita | Eliminar inventario, revocar accesos, cancelar suscripción son acciones que no deben ejecutarse por un malentendido en el chat. | El agente describe lo que va a hacer, muestra el impacto y pide confirmación explícita ("¿Confirmas que quieres eliminar estas 340 líneas? Esta acción no se puede deshacer.") antes de ejecutar. |
| Acceder a datos cifrados E2EE de terceros | La arquitectura zero-knowledge garantiza que nadie — incluyendo el agente — puede leer el contenido cifrado de negociaciones ajenas. | Si el usuario pregunta por el precio que cotizó otro miembro, el agente responde: "Ese dato está cifrado de extremo a extremo. Solo tú y tu contraparte podéis verlo." |
| Tomar decisiones comerciales por el usuario | El agente no hace ofertas, no acepta precios, no firma acuerdos en nombre del usuario. | El agente presenta opciones, calcula, compara y recomienda — pero la decisión comercial siempre es del usuario. |
| Ejecutar acciones fuera del ámbito de la plataforma | El agente no puede enviar emails externos, acceder a sistemas del usuario, ni interactuar con webs o APIs de terceros. | Si el usuario pide algo fuera de scope, el agente lo explica con claridad y ofrece la alternativa más cercana dentro de la plataforma. |
| Inventar datos o confirmar disponibilidad sin consultar el índice en tiempo real | El agente no puede dar por bueno stock que no ha verificado en el índice actual. | Todas las respuestas sobre disponibilidad de stock se obtienen en tiempo real del índice de búsqueda, nunca de la memoria del modelo. |

# 4. Posición en Pantalla y Layout

## 4.1 Descripción del layout principal

La interfaz de la plataforma se estructura en tres zonas permanentes. Esta estructura es consistente en todas las pantallas del sistema, a excepción de las pantallas de onboarding (donde el agente tiene un rol más guiado y ocupa más espacio).

| **Zona** | **Posición** | **Descripción** |
| --- | --- | --- |
| **Zona A — Panel de contexto (UI visual)** | Izquierda o centro, 60-70% del ancho | La representación visual del estado actual: resultados de búsqueda, tabla de inventario, hilo de mensajes, configuración de visibilidad, etc. Esta zona responde tanto a la navegación directa del usuario como a los comandos del agente. Cuando el agente ejecuta una acción, el resultado aparece aquí. |
| **Zona B — Agente conversacional** | Derecha, 30-40% del ancho. Siempre visible. | El panel del agente. Contiene el historial de la conversación de la sesión actual y el campo de entrada de texto. Nunca se oculta ni minimiza (en desktop). En mobile ocupa el full screen con un botón de toggle para ver la UI visual. |
| **Zona C — Barra de navegación** | Superior o lateral izquierdo, compacto | Navegación principal: Mi Inventario, Buscar, Mensajes, Alertas, Ajustes. Acceso rápido para usuarios que prefieren la navegación clásica. En desktop siempre visible; en mobile colapsa en un menú hamburguesa. |

## 4.2 El panel del agente — detalle

| **Elemento** | **Descripción** |
| --- | --- |
| Campo de entrada | Textarea expandible en la parte inferior del panel. Acepta texto libre. Placeholder contextual que cambia según la pantalla activa: en búsqueda "¿Qué referencia buscas?", en inventario "¿Qué quieres hacer con tu stock?", en mensajes "¿A quién quieres escribir?". |
| Historial de la sesión | Burbuja de chat estándar. Mensajes del usuario a la derecha, respuestas del agente a la izquierda. El historial de la sesión actual persiste mientras la pestaña del navegador está abierta. Al cerrar sesión o al día siguiente, se inicia una nueva conversación (sin historial previo visible, aunque el agente mantiene memoria de contexto — ver sección 5). |
| Acciones sugeridas | Bajo cada respuesta del agente que desemboca en una acción, aparecen 2-3 botones de acción rápida para las opciones más probables. Ejemplo: tras buscar un rodamiento, el agente muestra los resultados y sugiere botones: "Ver los 5 primeros", "Filtrar por Europa", "Crear watcher para esta referencia". Reducen la necesidad de escribir para las acciones más comunes. |
| Indicador de estado | Punto de color junto al nombre del agente: verde (activo, responde en <2s), amarillo (procesando), gris (sin conexión). Cuando el agente está ejecutando una acción compleja, muestra un indicador de progreso textual: "Buscando en el índice...", "Aplicando filtros...", "Guardando cambios...". |
| Contexto activo | Una línea pequeña sobre el campo de entrada que muestra el contexto actual detectado por el agente: "Contexto: búsqueda de 6205 2RS" o "Contexto: inventario — 3.420 líneas publicadas". Ayuda al usuario a entender qué sabe el agente en este momento. |
| Botón de nueva conversación | Icono discreto en la esquina del panel. Reinicia el historial visible de la sesión. No borra la memoria de largo plazo del agente (ver sección 5). |

## 4.3 Comportamiento en mobile

En dispositivos móviles el espacio no permite mantener las dos zonas visibles simultáneamente. El comportamiento es el siguiente:

* Por defecto, la pantalla muestra la Zona A (UI visual) al navegar a cualquier sección.
* Un botón flotante persistente en la esquina inferior derecha (icono del agente) abre la Zona B en fullscreen overlay.
* Cuando el agente ejecuta una acción que produce un resultado visual (una búsqueda, una lista de inventario), ofrece el botón "Ver resultados" que lleva al usuario a la Zona A con el resultado ya cargado.
* Las notificaciones push del agente en mobile son concisas: máximo 2 líneas, con deep link a la acción relevante.

# 5. Modelo de Contexto y Memoria del Agente

## 5.1 Las tres capas de contexto

El agente opera con tres capas de contexto superpuestas, con diferente alcance temporal y diferente tipo de información. Entender estas capas es fundamental para diseñar los flujos conversacionales de cada módulo.

| **Capa** | **Nombre** | **Alcance** | **Contenido** | **Dónde se almacena** |
| --- | --- | --- | --- | --- |
| **Capa 1** | Contexto de sesión | Activo mientras la pestaña está abierta. Se purga automáticamente a las 24 horas del inicio de sesión, o al cerrar sesión si antes. No hay opción de persistencia entre sesiones. | El historial completo de la conversación activa: mensajes, pantallas visitadas, búsquedas y acciones de la sesión. La purga a 24h es intencional: mantener el historial de sesión indefinidamente no aporta valor operativo significativo (el agente tiene la Capa 2 para personalización) y añade complejidad de almacenamiento y privacidad innecesaria. | Memoria del modelo (context window) + buffer en Redis con TTL de 24h. Se descarta al expirar el TTL o al hacer logout. |
| **Capa 2** | Contexto de perfil | Permanente. Se construye y actualiza con cada sesión. | Preferencias aprendidas del usuario: regiones preferidas, marcas habituales, umbrales de reputación, contrapartes frecuentes, patrones de búsqueda. Historial de actividad resumido (no el detalle cifrado). | Base de datos del servidor. Modelo de preferencias por usuario. |
| **Capa 3** | Contexto de plataforma | Actualizado en tiempo real. | Estado actual del mercado: stock disponible, miembros activos, tendencias de disponibilidad. Estado de la cuenta del usuario: su inventario, sus alertas activas, sus negociaciones abiertas. | Índice de búsqueda (Typesense) y base de datos operacional. El agente consulta en tiempo real. |

## 5.2 Cómo el agente construye respuestas

Cada vez que el usuario envía un mensaje, el agente combina las tres capas para generar una respuesta contextualizada:

1. Lee el mensaje del usuario en el contexto de la conversación activa (Capa 1).
2. Consulta el perfil del usuario para personalizar la respuesta (Capa 2): si el usuario siempre busca en Europa, aplica ese filtro sin que se lo pidan.
3. Si la respuesta requiere datos en tiempo real (stock, disponibilidad, estado de negociaciones), consulta la plataforma (Capa 3) antes de responder.
4. Genera la respuesta y, si la acción implica cambios en el sistema, ejecuta la acción y actualiza la UI visual (Zona A) simultáneamente.

## 5.3 Qué recuerda el agente entre sesiones

| **Recuerda** | **No recuerda** |
| --- | --- |
| Las preferencias de búsqueda aprendidas (regiones, marcas, umbrales de reputación). | El contenido exacto de conversaciones anteriores (el historial de sesión no persiste). |
| Las contrapartes con las que el usuario interactúa frecuentemente. | El contenido de negociaciones cifradas (imposible por arquitectura E2EE). |
| Los patrones de subida de inventario (perfiles de mapeo de columnas). | Instrucciones específicas dadas en sesiones anteriores que no hayan sido guardadas como preferencia. |
| El estado actual del inventario del usuario y sus alertas activas. | Nada que el usuario no haya interactuado en la plataforma — el agente no aprende de fuentes externas. |

## 5.4 Privacidad del modelo de contexto

El modelo de preferencias del usuario (Capa 2) se almacena en la base de datos del servidor, pero no contiene datos comerciales sensibles. Contiene metadatos de comportamiento (frecuencia de búsqueda por región, marcas consultadas) sin precios, cantidades negociadas ni contenido de mensajes. Esta distinción es fundamental para mantener la garantía zero-knowledge: el agente puede ser inteligente y personalizado sin comprometer la privacidad comercial.

|  |
| --- |
| **🔒 INVARIANTE DE PRIVACIDAD DEL AGENTE**  El agente NUNCA tiene acceso al contenido cifrado E2EE: precios negociados, cantidades en negociaciones activas, historial de mensajes entre miembros. Si un usuario pregunta "¿A qué precio me vendieron las últimas unidades de 6205?", el agente debe responder que ese dato está cifrado y solo es accesible desde el historial de mensajes del propio usuario en su dispositivo. Esta restricción es arquitectónica, no política. |

# 6. Patrones de Interacción — Los Verbos del Agente

## 6.1 Clasificación de intenciones

El agente clasifica cada mensaje del usuario en una de seis categorías de intención. Esta clasificación determina el tipo de respuesta y si se requiere confirmación antes de actuar.

| **Categoría** | **Descripción** | **¿Requiere confirmación?** | **Ejemplos** |
| --- | --- | --- | --- |
| **CONSULTA** | El usuario pide información. No se modifica ningún dato. | No. Respuesta directa. | ¿Quién tiene stock de 6205? / ¿Cuándo actualicé mi inventario? / ¿Qué es un acuerdo bilateral? |
| **BÚSQUEDA** | El usuario quiere encontrar stock o miembros. Se ejecuta una consulta al índice. | No. Los resultados se muestran en Zona A. | Busca 22316 en Alemania. / Encuentra distribuidores de NSK en Francia con reputación >4. |
| **ACCIÓN REVERSIBLE** | El usuario quiere ejecutar un cambio que se puede deshacer. | Confirmación ligera — el agente describe la acción y el usuario confirma con "sí" o con un botón. | Actualiza el stock de 6305 a 200 unidades. / Activa el watcher para 6205 en España. |
| **ACCIÓN IRREVERSIBLE** | El usuario quiere ejecutar un cambio permanente o de alto impacto. | Confirmación explícita obligatoria — el agente detalla el impacto completo y pide confirmación textual o botón dedicado. | Elimina todas mis líneas archivadas. / Revoca el acceso de este usuario. |
| **NAVEGACIÓN** | El usuario quiere ir a una sección o pantalla específica. | No. El agente navega directamente. | Llévame a mi inventario. / Abre mis mensajes con Bearing House. / Quiero configurar mi visibilidad. |
| **AMBIGUA** | El agente no puede determinar la intención con suficiente confianza. | El agente pide clarificación con una pregunta concreta y opciones cuando sea posible. | Cambia esto. / Actualiza los datos. / Manda un mensaje. |

## 6.2 Protocolo de confirmación para acciones irreversibles

Cuando el agente clasifica una intención como ACCIÓN IRREVERSIBLE, sigue este protocolo sin excepciones:

1. El agente describe en lenguaje claro qué va a ocurrir: "Esto eliminará 340 líneas de inventario archivadas de tu cuenta."
2. El agente indica si la acción es reversible o no: "Esta acción no se puede deshacer."
3. El agente muestra el impacto cuantificado cuando sea posible: "Afecta a: 340 líneas / 12 referencias distintas / última actualización hace 45 días."
4. El agente presenta un botón de confirmación con texto específico (no "Aceptar" genérico): "Sí, eliminar 340 líneas" + botón de cancelación.
5. Solo tras la confirmación explícita ejecuta la acción.
6. Tras la ejecución, confirma el resultado: "Hecho. 340 líneas eliminadas. Tu inventario activo tiene ahora 1.280 líneas."

## 6.3 Gestión de ambigüedad

El agente nunca asume ni ejecuta una interpretación de la que no está seguro. Ante mensajes ambiguos:

* Identifica las interpretaciones posibles (máximo 3) y las presenta como opciones.
* Cuando la ambigüedad es sobre un objeto (¿qué referencia?), el agente pide la información mínima necesaria con un ejemplo del formato esperado.
* Cuando la ambigüedad es sobre una acción (¿qué quiere hacer con eso?), el agente presenta las acciones más probables como botones de opción rápida.
* El agente nunca hace preguntas en cadena. Una sola pregunta de clarificación por turno.

## 6.4 Tono y formato de las respuestas del agente

| **Tipo de respuesta** | **Formato** | **Extensión** |
| --- | --- | --- |
| Resultados de búsqueda | Texto breve de introducción + renderizado de resultados en Zona A. El agente no lista resultados dentro del chat — los muestra en la UI visual. | 1-2 líneas en el chat. Los datos en Zona A. |
| Confirmación de acción ejecutada | Texto directo: qué se hizo, cuándo, resultado cuantificado si aplica. | 1-3 líneas máximo. |
| Explicación de concepto o ayuda | Texto estructurado con párrafos cortos. Sin bullet points excesivos. Lenguaje accesible para no técnicos. | Lo necesario. El agente no elabora más de lo que se pregunta. |
| Error o imposibilidad | Explicación honesta de por qué no es posible + alternativa si existe. | 2-4 líneas. Nunca vago ni evasivo. |
| Respuesta a consulta de mercado | Dato directo primero, contexto después si aporta valor. | 1-2 líneas para el dato. 1-2 adicionales para contexto si es relevante. |

# 7. Flujos Conversacionales Tipo — Ejemplos de Referencia

Estos ejemplos son la referencia de comportamiento esperado del agente. Sirven como casos de prueba para QA y como guía para el equipo de desarrollo al implementar los módulos.

## 7.1 Búsqueda simple

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Busca 6205 2RS FAG, necesito al menos 300 unidades | El agente clasifica: BÚSQUEDA. Extrae: part\_number=6205 2RS, brand=FAG, min\_qty=300. |
| 2 | Agente | Encontré 8 distribuidores con stock de 6205 2RS FAG en cantidades de 300+ unidades. Los muestro ordenados por reputación. [Resultados en Zona A] | Zona A muestra la tabla de resultados con indicadores de frescura, reputación y países. |
| 3 | Usuario | Solo los de Europa | El agente clasifica: BÚSQUEDA (refinamiento). Aplica filtro location\_country IN [EU]. |
| 4 | Agente | Quedan 5 distribuidores europeos. El que tiene mejor reputación es Bearing House GmbH (Alemania, 4.9/5, stock actualizado hace 2 días). [Resultados actualizados en Zona A] | Zona A actualiza los resultados filtrados. |
| 5 | Usuario | Escríbele a Bearing House | El agente clasifica: ACCIÓN REVERSIBLE. Abre hilo de mensajes E2EE con Bearing House, preloaded con la referencia 6205 2RS FAG. |
| 6 | Agente | Abrí una conversación con Bearing House GmbH sobre la referencia 6205 2RS FAG. Puedes escribir tu mensaje directamente. [Zona A muestra el hilo de mensajes] | El usuario continúa desde la UI de mensajería. |

## 7.2 Actualización de inventario por chat

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Actualiza el stock de 6305 a 150 unidades | Clasifica: ACCIÓN REVERSIBLE. Busca en el inventario del usuario la referencia 6305. |
| 2 | Agente | Encontré 2 líneas con referencia 6305 en tu inventario: 6305-2Z SKF (actualmente 200 uds) y 6305 NR FAG (actualmente 80 uds). ¿A cuál te refieres? | El agente no asume — pide clarificación. Presenta las opciones como botones. |
| 3 | Usuario | La SKF | Clasifica: ACCIÓN REVERSIBLE confirmada con clarificación previa. |
| 4 | Agente | Actualizo 6305-2Z SKF de 200 a 150 unidades. ¿Confirmas? [botón: Sí, actualizar] [botón: Cancelar] | Protocolo de confirmación para acción reversible. |
| 5 | Usuario | Sí | Ejecuta PUT /api/inventory/lines con quantity=150. Actualiza uploaded\_at. |
| 6 | Agente | Hecho. 6305-2Z SKF actualizado a 150 unidades. Inventario al día. | Zona A refleja el cambio en la tabla de inventario. |

## 7.3 Configuración de visibilidad por chat

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Oculta mi inventario a Distribuciones García | Clasifica: ACCIÓN REVERSIBLE. Busca en la base de miembros "Distribuciones García". |
| 2 | Agente | Encontré "Distribuciones García S.L." (España). Añadiré esta empresa a tu lista de exclusión (blacklist). Seguirán viéndote el resto de miembros. ¿Confirmas? [botón: Sí, ocultar] [botón: Cancelar] | Clarifica el impacto antes de actuar. |
| 3 | Usuario | Sí | Ejecuta la regla de blacklist en el Inventory Service. |
| 4 | Agente | Listo. Distribuciones García S.L. ya no puede ver tu inventario. Puedes gestionar todas tus reglas de visibilidad en Ajustes → Visibilidad. | Acción ejecutada. Referencia a la UI para gestión avanzada. |

## 7.4 Onboarding guiado por el agente

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Agente (proactivo) | Bienvenido a [Plataforma]. Soy VERA, tu asistente. Para empezar, necesito que verifiques tu email — te acabo de reenviar el enlace. Cuando lo hayas hecho, vuelve aquí y continuamos. | El agente toma la iniciativa en el onboarding sin esperar a que el usuario pregunte. |
| 2 | Usuario (tras verificar) | Ya verifiqué el email | El agente detecta el estado EMAIL\_VERIFIED en la base de datos. |
| 3 | Agente | Perfecto. Ahora vamos a generar tus claves de privacidad — es lo que garantiza que nadie, ni nosotros, puede leer tus negociaciones. Es un proceso de 2 minutos. ¿Empezamos? | El agente introduce el concepto E2EE en lenguaje llano antes de lanzar el flujo técnico. |
| 4 | Usuario | Sí | El agente navega a REG-05 (pantalla de introducción a claves E2EE) en Zona A. |
| 5 | Agente | [Zona A muestra REG-05] La pantalla de la izquierda te guía paso a paso. Si tienes alguna duda durante el proceso, pregúntame aquí. | El agente no reemplaza la UI del onboarding — la complementa. |

# 8. Implicaciones sobre los Módulos ya Escritos

## 8.1 Cambios en Módulo 01 — Onboarding

El Módulo 01 debe ser revisado para incorporar:

* El agente como guía activo durante todo el proceso de onboarding. En lugar de que el usuario navegue pantallas secuenciales solo, el agente aparece desde el primer momento, explica cada paso y responde dudas en tiempo real.
* Un flujo alternativo 100% conversacional para el onboarding completo: el usuario puede completar el registro respondiendo preguntas del agente en el chat, sin tocar los formularios directamente (el agente los rellena por él).
* Respuestas del agente a las preguntas más frecuentes durante el onboarding: ¿qué es la passphrase de backup?, ¿por qué necesito generar claves?, ¿puedo saltarme este paso?
* Proactividad del agente: si el usuario lleva más de 5 minutos en una pantalla sin avanzar, el agente pregunta si necesita ayuda.

## 8.2 Cambios en Módulo 02 — Gestión de Inventario

El Módulo 02 debe ser revisado para incorporar:

* Todas las operaciones de inventario accesibles por chat (actualizar cantidad, archivar líneas, cambiar visibilidad, configurar canal de subida) según los ejemplos del apartado 7.
* El agente como asistente durante el proceso de mapeo de columnas: si el usuario tiene dudas sobre qué campo corresponde a qué, puede preguntarle al agente en tiempo real mientras revisa el mapeo en Zona A.
* Notificaciones proactivas del agente cuando el inventario entra en estado STALE: en lugar de solo enviar un email, el agente aparece en el panel con un mensaje contextual al hacer login: "Tu inventario lleva 8 días sin actualizar. ¿Quieres subir el archivo ahora o lo programamos?"
* El agente puede ejecutar subidas de inventario: si el usuario dice "sube el inventario de esta semana", el agente abre el selector de archivo o activa el canal correspondiente.

|  |
| --- |
| **📋 PLAN DE REVISIÓN**  Los documentos de Módulo 01 (Onboarding v1.0) y Módulo 02 (Gestión de Inventario v1.0) serán actualizados a v1.1 para incorporar la capa conversacional según este Módulo 00. La revisión se realizará tras completar los módulos restantes (03 a 07) para incorporar todos los cambios en una sola pasada y garantizar consistencia. |

# 9. Implicaciones Técnicas — Notas para la Fase de Definición Técnica

Este apartado no pretende anticipar las decisiones técnicas del módulo de definiciones técnicas correspondiente. Su objetivo es marcar los puntos de atención que la arquitectura conversacional introduce y que deben ser considerados en esa fase.

| **Área** | **Punto de atención** |
| --- | --- |
| Modelo de IA del agente | El agente necesita acceso a herramientas (function calling / tool use) para ejecutar acciones en la plataforma. Cada acción posible del agente (buscar, actualizar inventario, crear watcher, etc.) debe implementarse como una herramienta invocable por el modelo. El diseño de estas herramientas es el núcleo de la implementación del agente. |
| Latencia | El agente debe responder en menos de 2 segundos para mantener la sensación de conversación natural. Las acciones que requieren consultas complejas (búsquedas con múltiples filtros, operaciones sobre inventarios grandes) deben mostrar feedback inmediato ("Buscando...") mientras se procesa la respuesta completa. |
| Streaming de respuestas | Las respuestas del agente deben renderizarse en streaming (token a token) para que el usuario perciba una respuesta inmediata incluso en consultas que tardan 1-2 segundos en completarse. |
| Seguridad del agente | El agente actúa con los permisos del usuario autenticado, no con permisos de sistema. Cada acción ejecutada por el agente se registra en los logs de auditoría con la nota "ejecutado vía agente conversacional". El agente no puede escalar privilegios. |
| Contexto de ventana | El contexto de sesión (Capa 1) ocupa tokens del context window del modelo. Conversaciones muy largas pueden saturar el contexto. La implementación debe gestionar el truncado o la summarización del historial de sesión de forma transparente para el usuario. La purga automática a 24h reduce este riesgo de forma natural. |
| Sincronización con Zona A | Cuando el agente ejecuta una acción que modifica el estado de la plataforma (actualiza inventario, crea una alerta, abre un mensaje), la Zona A debe actualizarse en tiempo real sin recargar la página. Esto requiere una arquitectura de estado reactivo en el frontend (contexto compartido entre el panel del agente y la UI visual). |
| Modelo y costes | El agente usa Claude (Anthropic) como modelo base. DECISIÓN CERRADA (QA-A00-06). La estimación de costes del Tech Stack v1.0 — basada en GPT-4o — debe actualizarse con los precios actuales de la API de Anthropic (Claude Sonnet como modelo principal para equilibrio coste/capacidad; Claude Opus para tareas de alta complejidad si se requiere). El presupuesto de ~€29/miembro/año es una referencia de orden de magnitud que debe recalcularse en la fase de Definición Técnica del agente. |

# 10. Métricas de Éxito de la Capa Conversacional

Estas métricas permiten evaluar si la arquitectura conversacional está cumpliendo su propósito. Deben medirse desde el primer día de lanzamiento.

| **Métrica** | **Descripción** | **Objetivo V1 (primeros 90 días)** |
| --- | --- | --- |
| Tasa de adopción del agente | % de sesiones activas en las que el usuario envía al menos un mensaje al agente. | > 60% de las sesiones. |
| Tasa de resolución directa | % de mensajes al agente que se resuelven sin que el usuario tenga que navegar manualmente a una pantalla para completar la tarea. | > 70% de los mensajes. |
| Tasa de confirmación correcta | % de acciones irreversibles ejecutadas por el agente que el usuario confirma (vs cancela). Una tasa muy alta puede indicar que el agente está proponiendo acciones no deseadas. | Entre 80-95%. Por encima del 95% revisar si el protocolo de confirmación es demasiado permisivo. |
| Tiempo medio de respuesta | Latencia percibida entre el envío del mensaje y la primera palabra de la respuesta del agente (streaming). | < 1,5 segundos. |
| Tasa de clarificación | % de mensajes que el agente clasifica como AMBIGUA y requieren una pregunta de clarificación. | < 15%. Por encima, revisar la calidad de los prompts del agente. |
| NPS de la experiencia conversacional | Encuesta específica: "¿Cómo de útil encontraste el asistente IA?" (escala 1-10). Enviada tras la primera semana de uso. | NPS > 40. |

# 11. Decisiones Tomadas — Registro de Resolución de Preguntas Abiertas

Todas las preguntas abiertas del Módulo 00 han sido resueltas. Este registro documenta las decisiones tomadas para trazabilidad. Ninguna queda pendiente para fases posteriores.

| **ID** | **Decisión tomada** | **Propietario** | **Estado** |
| --- | --- | --- | --- |
| **QA-A00-01 ✅ CERRADA** | Nombre del agente: VERA. Nombre femenino, latín verus (verdadero/auténtico). Funciona en todos los idiomas de la plataforma. Conecta con la propuesta de valor de privacidad y transparencia. Ningún cambio posterior a esta decisión sin aprobación del Product Owner. | Product Owner | CERRADA — Junio 2026 |
| **QA-A00-02 ✅ CERRADA** | Interfaz de voz: diferida a V2. V1 es solo texto. La voz se evaluará en V2 con foco en el caso de uso de almacén (manos ocupadas). | Product Owner + CTO | CERRADA — Junio 2026 |
| **QA-A00-03 ✅ CERRADA** | Historial de sesión (Capa 1): purga automática a las 24 horas. No hay persistencia opcional entre sesiones. Rationale: el valor operativo del historial de sesión más allá de 24h es marginal dado que la Capa 2 (preferencias) cubre la personalización persistente. La purga simplifica la arquitectura y elimina riesgos de privacidad. | CTO + Product Owner | CERRADA — Junio 2026 |
| **QA-A00-04 ✅ CERRADA** | Modelo de preferencias (Capa 2): visible y editable por el usuario. Se implementará un panel en Ajustes → Asistente VERA donde el usuario puede ver qué ha aprendido el agente sobre sus preferencias y modificar o eliminar cualquier entrada. Esto es clave para la confianza del usuario en el sistema. | Product Owner | CERRADA — Junio 2026 |
| **QA-A00-05 ✅ CERRADA** | Modo proactivo del agente: NO en V1. En V1 VERA solo responde a mensajes iniciados por el usuario. Las notificaciones proactivas siguen el canal de notificaciones estándar de la plataforma (NOT-INV-\*, etc.), no el chat. El modo proactivo se evaluará en V2. | Product Owner | CERRADA — Junio 2026 |
| **QA-A00-06 ✅ CERRADA** | Modelo de IA del agente: Claude (Anthropic). Decisión definitiva. Claude Sonnet como modelo principal para el agente conversacional. La elección se basa en capacidad de function calling, calidad de razonamiento en contexto, y alineación con los valores de privacidad del proyecto. Los costes del Tech Stack v1.0 se recalcularán con precios Anthropic en la fase de Definición Técnica. | CTO | CERRADA — Junio 2026 |

# 12. Historial de Versiones

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Documento fundacional creado tras la decisión estratégica de adoptar arquitectura conversacional como capa primaria de interacción. |
| 1.1 | Junio 2026 | Equipo de Producto | Resolución de todas las preguntas abiertas: nombre del agente VERA, voz diferida a V2, historial de sesión con purga a 24h, preferencias visibles y editables, modo proactivo diferido a V2, modelo Claude (Anthropic) como decisión definitiva. Sección 11 convertida de preguntas abiertas a registro de decisiones cerradas. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.0 | ADR-001 E2EE Key Backup | Funcional Módulo 01 Onboarding v1.0 | Funcional Módulo 02 Gestión de Inventario v1.0 |