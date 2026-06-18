**BEARINGWORLD.IO**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 08 — FORO DE LA COMUNIDAD**

**Construido sobre Módulo 00 y Módulo 04**

Versión 1.1 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento especifica el Foro de la Comunidad de Bearingworld.io: un espacio público de discusión entre miembros de la plataforma, organizado en categorías temáticas, sin relación directa con inventario, búsqueda o negociación. Es la primera funcionalidad puramente social de la plataforma — no cifrada (a diferencia del Módulo 04), no privada entre dos partes, sino visible para toda la comunidad de miembros.

Este módulo cubre: la estructura de categorías, la creación y respuesta de hilos, el sistema de reacciones simples, la identidad con la que se publica, las reglas de autorregulación sin moderador humano en V1, y la capa conversacional de VERA en este contexto.

## **1.1 Objetivos funcionales**

* Ofrecer un espacio de discusión pública entre miembros, organizado en categorías temáticas relevantes para el sector de distribución de rodamientos y transmisión de potencia.
* Permitir crear hilos de discusión, responder a hilos existentes, y reaccionar a publicaciones con un sistema simple de votos/reacciones.
* Mantener la identidad de organización (no de persona individual) como la unidad pública de publicación, coherente con el resto de la plataforma (Directorio, Mensajería).
* Funcionar en V1 con autorregulación entre miembros, sin un moderador humano dedicado ni herramientas de moderación activa por parte del Operador de Plataforma.

## **1.2 Fuera de alcance en este módulo**

* Cualquier dato comercial sensible (precios, cantidades negociadas, condiciones de una oferta) — el foro es un espacio de conversación general, no un canal de negociación. Las negociaciones siguen ocurriendo exclusivamente en la mensajería E2EE del Módulo 04.
* Moderación activa por parte del Operador de Plataforma, herramientas de denuncia con flujo de revisión, o sanciones automáticas — quedan fuera de V1 y se evaluarán según el comportamiento real de la comunidad tras el lanzamiento (sección 9).
* Mensajería privada entre miembros — sigue siendo responsabilidad exclusiva del Módulo 04.

|  |
| --- |
| **ℹ️ EL FORO NO ES UN ESPACIO CIFRADO**  A diferencia de prácticamente todo el resto de la plataforma, el contenido del Foro es texto plano, visible para todos los miembros, almacenado y leíble por el servidor. No aplican aquí los invariantes de privacidad E2EE de los Módulos 01, 02 y 04 — el foro es, por diseño, un espacio público dentro de la comunidad de miembros (no público sin cuenta, ver sección 3.1). Esta distinción debe quedar clara para los miembros: nada de lo escrito en el foro tiene ninguna garantía de confidencialidad, y así debe comunicarse en la propia interfaz. |

# **2. Actores del Módulo**

| **Actor** | **Acciones permitidas en este módulo** |
| --- | --- |
| Miembro activo (cualquier usuario de una organización ACTIVE) | Leer cualquier categoría y cualquier hilo, crear nuevos hilos, responder a hilos existentes, reaccionar a publicaciones, editar o eliminar sus propias publicaciones. |
| VERA | Ayudar a redactar una publicación a partir de lenguaje natural (mostrando siempre el resultado para confirmación antes de publicar), notificar de respuestas a hilos propios, resumir un hilo largo a petición explícita del usuario. |
| Sistema (Forum Service) | Almacenar categorías, hilos, publicaciones y reacciones; aplicar el requisito de cuenta activa para leer y escribir; calcular el recuento de reacciones por publicación. |

# **3. Acceso y Estructura del Foro**

## **3.1 Acceso — requiere cuenta activa**

El Foro no es accesible públicamente sin cuenta. Tanto la lectura como la escritura requieren que el usuario haya iniciado sesión con una cuenta de una organización en estado ACTIVE (Módulo 01). Una organización SUSPENDED (Módulo 07, por falta de pago) pierde acceso al foro igual que al resto de la plataforma.

## **3.2 Categorías**

El contenido del foro se organiza en categorías temáticas fijas, definidas por el equipo de producto y no creables por los propios miembros en V1. Cada hilo pertenece a exactamente una categoría.

| **Categoría propuesta** | **Propósito** |
| --- | --- |
| General | Conversación abierta del sector, presentaciones, noticias relevantes para la comunidad. |
| Referencias técnicas | Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias. |
| Logística y aduanas | Experiencias e intercambio de información sobre transporte, aranceles, incoterms — complementario, no sustituto, de la Calculadora del Módulo 05. |
| Plataforma y soporte | Preguntas sobre el funcionamiento de Bearingworld.io, sugerencias de mejora, problemas técnicos. |

|  |
| --- |
| **💡 LISTA DE CATEGORÍAS — AJUSTABLE SIN DESARROLLO**  La lista de categorías debe almacenarse como datos de configuración (tabla en base de datos), no como valores fijos en el código, de forma que el equipo de producto pueda añadir, renombrar o archivar categorías sin requerir un despliegue. NOTA v1.1 (QA-FORO-01 cerrada): la lista propuesta arriba queda confirmada como definitiva para el lanzamiento. El mecanismo de gestión sin despliegue ya cubre la necesidad de añadir categorías nuevas en el futuro sin que esto requiera una revisión de este documento. |

## **3.3 Identidad de publicación**

Toda publicación en el foro muestra como autor a la organización, no a la persona individual que escribió — coherente con el resto de la plataforma, donde la identidad pública siempre ha sido la organización (Directorio, ficha pública, resultados de búsqueda). Internamente, el sistema registra qué usuario concreto de la organización escribió cada publicación (a efectos de edición y borrado, sección 5.3), pero esa información no se muestra a otros miembros.

# **4. Hilos y Publicaciones**

## **4.1 Pantalla FORO-01 — Lista de categorías**

**Descripción**

Pantalla de entrada al foro, accesible desde el menú principal — al mismo nivel que Búsqueda, Alertas y el Directorio de Organizaciones.

| **Elemento** | **Comportamiento** |
| --- | --- |
| Tarjetas de categoría | Una por categoría activa (sección 3.2). Muestra: nombre, descripción breve, número de hilos, número total de publicaciones, fecha de la última actividad. |
| Hilos recientes (vista global) | Sección opcional en la parte superior con los hilos más recientes de cualquier categoría, para facilitar el descubrimiento sin tener que entrar categoría por categoría. |

## **4.2 Pantalla FORO-02 — Lista de hilos de una categoría**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Lista de hilos | Por cada hilo: título, organización que lo creó, número de respuestas, número total de reacciones acumuladas en el hilo, fecha del último mensaje. |
| Ordenación por defecto | Por actividad reciente descendente (el hilo con la respuesta más reciente aparece primero) — patrón estándar de foros. |
| Botón "Crear hilo" | Abre el formulario de nuevo hilo (sección 4.4) dentro de esta categoría. |
| Buscador dentro de la categoría | Campo de texto libre que filtra los hilos por coincidencia en el título. |

## **4.3 Pantalla FORO-03 — Vista de un hilo**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Publicación inicial | Título del hilo, organización autora, contenido, fecha, reacciones (sección 4.5). |
| Respuestas | Listadas cronológicamente debajo de la publicación inicial. Cada una con organización autora, contenido, fecha, reacciones. |
| Campo de respuesta | Caja de texto al final del hilo. VERA puede ayudar a redactar si se le pide (sección 7), siempre mostrando el resultado para confirmación antes de publicar. |
| Acciones sobre publicaciones propias | Editar (abre el contenido en el mismo campo para modificarlo) y Eliminar (ACCIÓN IRREVERSIBLE según el Módulo 00 — pide confirmación explícita), disponibles únicamente sobre publicaciones propias del usuario o de su organización. |

## **4.4 Flujo conversacional FL-FORO-01 — Crear un hilo**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Quiero abrir un hilo en Logística y aduanas preguntando si alguien tiene experiencia con aranceles a Marruecos | VERA clasifica: ACCIÓN REVERSIBLE — crear un hilo público no tiene coste ni efecto irreversible relevante, pero es contenido visible para toda la comunidad. |
| 2 | VERA | Propone un título breve y un cuerpo de mensaje a partir de la instrucción del usuario, y los muestra para revisión antes de publicar. | El usuario ve el borrador completo (título + cuerpo) antes de confirmar — VERA nunca publica directamente. |
| 3 | Usuario | Confirma (o edita y luego confirma). | El hilo se crea en la categoría indicada, visible inmediatamente para todos los miembros. |

## **4.5 Reacciones**

Cada publicación (la inicial de un hilo, o cualquier respuesta) admite una reacción simple de tipo "me gusta" por parte de cada miembro. Un miembro puede reaccionar o quitar su reacción en cualquier momento; no hay distintos tipos de reacción en V1 (solo presencia/ausencia de "me gusta").

| **Aspecto** | **Definición** |
| --- | --- |
| Quién reacciona | El usuario individual reacciona (no la organización) — a diferencia de la autoría de publicaciones, que es siempre a nivel de organización. Si dos usuarios de la misma organización reaccionan a la misma publicación, cuentan como dos reacciones distintas. |
| Visualización | Contador junto a cada publicación, ej. "👍 7". Sin lista pública de quién ha reaccionado en V1. |
| Efecto | Puramente informativo y de cohesión social. No afecta a la ordenación de hilos, no genera ranking de publicaciones ni de organizaciones, y no se cruza con el sistema de Favoritos del Módulo 03 — son mecanismos independientes. |

# **5. Autorregulación — Sin Moderador Humano en V1**

## **5.1 Modelo de moderación**

En V1, el foro no cuenta con un Operador de Plataforma moderando activamente el contenido, ni con un flujo de denuncias gestionado por humanos. El control de calidad de la conversación se confía a la propia comunidad: la identidad de organización (sección 3.3) y la naturaleza profesional y de nicho del sector (PRD, sección 2.2: "comunidad pequeña y cerrada, la mayoría se conocen desde hace décadas") actúan como el principal mecanismo de autorregulación — escribir algo inapropiado con tu nombre de empresa visible ante el resto del sector tiene un coste reputacional natural.

## **5.2 Lo que sí existe en V1**

* Edición y eliminación de las propias publicaciones (sección 4.3), que permite a cualquier miembro corregir o retirar algo que haya escrito.
* Términos de uso aceptados durante el registro (Módulo 01, FRO) que ya cubren el comportamiento general en la plataforma, incluido el foro.

## **5.3 Lo que explícitamente no existe en V1**

* Ningún botón de "denunciar" publicación.
* Ningún panel de moderación para el Operador de Plataforma sobre contenido del foro.
* Ninguna capacidad de banear, silenciar, o restringir a una organización específicamente en el foro (la suspensión global por falta de pago, Módulo 07, es la única forma de perder acceso, y no es específica del foro).

|  |
| --- |
| **⚠️ RIESGO ACEPTADO PARA V1**  La ausencia de moderación es una decisión de producto deliberada para mantener el lanzamiento simple, no una garantía de que nunca habrá problemas. Si tras el lanzamiento se observan patrones de abuso, spam, o contenido inapropiado, esto debe revisarse como prioridad — añadir como mínimo una vía de denuncia y un mecanismo de moderación por el Operador de Plataforma sería el primer paso natural en una v1.1 de este módulo. |

## **5.4 Criterio de revisión para añadir moderación (NUEVO v1.1 — QA-FORO-03 cerrada)**

Para evitar que la decisión de "cuándo añadir moderación" quede indefinida, se fija un criterio cuantitativo simple de revisión, ajustable si la experiencia real lo justifica: si en cualquier periodo de 30 días naturales se eliminan (por los propios autores, sección 5.2) más del 5% de las publicaciones totales del foro, o si el Operador de Plataforma recibe, por cualquier canal de soporte ajeno al foro (email, etc.), 3 o más quejas independientes sobre el contenido del foro en ese mismo periodo, se considera que el umbral de autorregulación ha quedado superado y debe priorizarse el diseño de un mecanismo de moderación (denuncia + panel del operador) para la siguiente revisión de este módulo. Este criterio es deliberadamente simple y de bajo coste de seguimiento — no requiere ninguna instrumentación nueva, ya que ambos datos (publicaciones eliminadas, quejas recibidas) son observables con los medios ya existentes.

# **6. Notificaciones**

| **Evento** | **Notificación** |
| --- | --- |
| Respuesta a un hilo propio (que el usuario creó) | Notificación in-app + opción de email (configurable en Ajustes → Notificaciones) informando de la nueva respuesta, con enlace directo al hilo. |
| Reacción a una publicación propia | Solo notificación in-app, sin email — para no generar ruido excesivo por un evento de bajo impacto. |
| Respuesta a un hilo en el que el usuario ha participado (sin ser el creador) | Misma notificación que la primera fila, si el usuario ha activado "Seguir hilos en los que participo" en Ajustes → Notificaciones (activado por defecto). |

# **7. Capa Conversacional VERA en este Módulo**

| **Situación** | **Comportamiento de VERA** |
| --- | --- |
| "Abre un hilo en [categoría] sobre [tema]" | Flujo FL-FORO-01 (sección 4.4) — VERA propone título y cuerpo, el usuario confirma antes de publicar. |
| "Ayúdame a responder a este hilo" | VERA propone un texto de respuesta a partir de lo que el usuario le indique, mostrado en el campo de respuesta para revisión y edición antes de publicar. |
| "Resume este hilo, es muy largo" | VERA puede generar un resumen del contenido del hilo — a diferencia de la mensajería E2EE del Módulo 04 (donde esta misma función quedó diferida a V2 por ser contenido cifrado), aquí el contenido del foro es texto plano y no cifrado, por lo que no aplica la misma restricción de privacidad. Es una acción explícita del usuario, no proactiva. |
| "¿Tengo respuestas nuevas en el foro?" | VERA responde con un resumen de actividad: número de hilos propios con respuestas nuevas, número de hilos seguidos con actividad nueva. |

# **8. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-FORO-01 | El acceso de lectura y escritura al foro requiere una sesión autenticada de un usuario de una organización en estado ACTIVE. No existe ningún modo de acceso público sin cuenta. | **CRÍTICA** |
| RNG-FORO-02 | Una organización en estado SUSPENDED (Módulo 07) pierde acceso al foro de la misma forma que al resto de la plataforma. Su contenido previamente publicado permanece visible para el resto de miembros. | **ALTA** |
| RNG-FORO-03 | Toda publicación se muestra con la identidad de la organización, nunca con el nombre de la persona individual que la escribió. | **ALTA** |
| RNG-FORO-04 | Las categorías son datos de configuración gestionables sin despliegue, no valores fijos en el código. Solo el equipo de producto puede crear, renombrar o archivar categorías en V1 — los miembros no pueden crear categorías propias. | MEDIA |
| RNG-FORO-05 | No existe en V1 ningún mecanismo de moderación activa por el Operador de Plataforma ni flujo de denuncias. La edición y eliminación de las propias publicaciones es el único control disponible para un miembro sobre su propio contenido. | **ALTA** |
| RNG-FORO-06 (NUEVO v1.1) | Límite de frecuencia de publicación, como medida de sentido común frente al spam ante la ausencia de moderación activa: máximo 10 publicaciones (hilos + respuestas, sumados) por organización y hora. Al alcanzarlo, el sistema impide nuevas publicaciones hasta pasada esa hora, mostrando un mensaje explicativo, sin que esto bloquee la lectura ni ninguna otra funcionalidad de la plataforma. Valor configurable a nivel de plataforma (no hardcoded), ajustable tras observar el uso real (QA-FORO-02 cerrada). | MEDIA |
| RNG-FORO-06 | El contenido del foro no está cifrado E2EE. Es texto plano, almacenado y legible por el servidor, visible para todos los miembros con cuenta activa. | **CRÍTICA** |
| RNG-FORO-07 | Las reacciones son individuales por usuario, no por organización, y no afectan a ningún ranking, ordenación, ni al sistema de Favoritos del Módulo 03. | MEDIA |

# **9. Criterios de Aceptación por Flujo**

* CA-FORO-01: Un usuario sin sesión activa no puede leer ni escribir ninguna categoría, hilo o publicación del foro — se le redirige a login.
* CA-FORO-02: Un usuario de una organización SUSPENDED no puede acceder al foro, viendo en su lugar la pantalla de suspensión del Módulo 07.
* CA-FORO-03: Toda publicación visible en FORO-02 y FORO-03 muestra el nombre de la organización autora, nunca el nombre de la persona que escribió.
* CA-FORO-04: Crear un hilo mediante VERA (FL-FORO-01) no publica nada hasta que el usuario confirma explícitamente el título y cuerpo propuestos.
* CA-FORO-05: Un usuario puede reaccionar y quitar su reacción de cualquier publicación, y el contador se actualiza inmediatamente.
* CA-FORO-06: Editar o eliminar una publicación solo está disponible para el usuario que la escribió (o cualquier usuario de su misma organización), nunca para terceros.
* CA-FORO-07: No existe ningún botón de denuncia ni panel de moderación visible para el Operador de Plataforma sobre el contenido del foro en V1.
* CA-FORO-08 (NUEVO v1.1): Una organización que alcanza 10 publicaciones (hilos + respuestas) en una hora no puede publicar una undécima hasta que transcurra esa hora, y ve un mensaje explicativo. La lectura del foro no se ve afectada por este límite.

# **10. Preguntas Abiertas y Decisiones Pendientes**

| **ID** | **Pregunta** | **Propietario** | **Límite** |
| --- | --- | --- | --- |
| QA-FORO-01 ✅ | Lista definitiva de categorías para el lanzamiento. | — | CERRADA — la lista propuesta (sección 3.2) queda confirmada; nuevas categorías se añaden sin despliegue (RNG-FORO-04) |
| QA-FORO-02 ✅ | Límite de frecuencia de publicación anti-spam. | — | CERRADA — 10 publicaciones por organización y hora (RNG-FORO-06, CA-FORO-08) |
| QA-FORO-03 ✅ | Criterio para decidir cuándo añadir moderación. | — | CERRADA — revisión obligatoria si >5% de publicaciones eliminadas en 30 días, o 3+ quejas independientes por soporte en el mismo periodo (sección 5.4) |

# **11. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Especifica el Foro de la Comunidad: acceso exclusivo tras login, categorías temáticas configurables, creación de hilos y respuestas, reacciones simples por usuario, identidad de publicación a nivel de organización, autorregulación sin moderador humano en V1, y capa conversacional de VERA para redactar y resumir contenido no cifrado. |
| 1.1 | Junio 2026 | Equipo de Producto | Cierre de las tres preguntas abiertas: (1) QA-FORO-01 — confirmada como definitiva la lista de categorías propuesta, con la vía de gestión sin despliegue ya prevista para añadir nuevas. (2) QA-FORO-02 — nueva regla RNG-FORO-06: límite de 10 publicaciones por organización y hora como medida de sentido común contra el spam, sin necesidad de moderación activa. (3) QA-FORO-03 — nueva sección 5.4 con un criterio cuantitativo de revisión: más del 5% de publicaciones eliminadas en 30 días, o 3 o más quejas independientes por soporte en el mismo periodo, obliga a priorizar el diseño de moderación en una futura revisión. Añadido CA-FORO-08. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.4 | Módulo 03 — Búsqueda Conversacional v1.4 (sistema de Favoritos, independiente de las reacciones de este módulo) | Módulo 04 — Mensajería E2EE v1.3 | Módulo 07 — Suscripción y Billing v1.0 |