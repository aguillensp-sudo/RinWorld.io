# Community Forum Specification

## Purpose
Ofrecer a los miembros de Bearingworld.io un espacio de discusión pública
no cifrada, organizado en categorías temáticas del sector, donde la
identidad de publicación es siempre la organización y la moderación en V1
es deliberadamente inexistente, sustituida por autorregulación entre
miembros y un criterio cuantitativo de revisión futura.

---

## ADDED Requirements

---

### Requirement: active-account-access
El sistema SHALL requerir una sesión autenticada de un usuario de una
organización en estado ACTIVE tanto para leer como para escribir en
cualquier categoría, hilo o publicación del foro, sin ofrecer ningún
modo de acceso público sin cuenta.
[Origen: Módulo 08 v1.1, sección 3.1; RNG-FORO-01, RNG-FORO-02;
CA-FORO-01, CA-FORO-02]

#### Scenario: acceso sin sesión bloqueado
- GIVEN un visitante sin sesión activa
- WHEN intenta acceder a cualquier categoría, hilo o publicación del foro
- THEN el sistema lo redirige a login
- AND no muestra ningún contenido del foro sin autenticación

#### Scenario: organización suspendida pierde acceso
- GIVEN un usuario de una organización en estado SUSPENDED
- WHEN intenta acceder al foro
- THEN ve la pantalla de suspensión en lugar del contenido del foro
- AND el contenido previamente publicado por esa organización permanece
  visible para el resto de miembros

---

### Requirement: category-structure
El sistema SHALL organizar el contenido del foro en categorías temáticas
fijas almacenadas como datos de configuración (no como valores fijos en
el código), gestionables por el equipo de producto sin despliegue, donde
cada hilo pertenece a exactamente una categoría.
[Origen: Módulo 08 v1.1, sección 3.2; RNG-FORO-04]

#### Scenario: categorías de lanzamiento
- GIVEN el foro recién lanzado
- WHEN un miembro accede a FORO-01
- THEN ve las cuatro categorías de lanzamiento: General, Referencias
  técnicas, Logística y aduanas, Plataforma y soporte
- AND cada una muestra nombre, descripción, número de hilos, número
  de publicaciones y fecha de última actividad

#### Scenario: añadir categoría sin despliegue
- GIVEN el equipo de producto que decide añadir una nueva categoría
- WHEN la crea desde la configuración correspondiente
- THEN la nueva categoría aparece en FORO-01 sin requerir ningún
  despliegue de código

---

### Requirement: thread-and-reply-creation
El sistema SHALL permitir a cualquier miembro con cuenta activa crear
hilos (título y cuerpo) dentro de una categoría y responder a hilos
existentes, mostrando siempre la identidad de la organización autora,
nunca la de la persona individual que escribió.
[Origen: Módulo 08 v1.1, secciones 3.3, 4.2, 4.3; RNG-FORO-03; CA-FORO-03]

#### Scenario: creación de hilo
- GIVEN un miembro en FORO-02 que pulsa "Crear hilo"
- WHEN completa título y cuerpo y confirma
- THEN el hilo se crea en esa categoría, visible inmediatamente para
  todos los miembros
- AND se muestra como autor el nombre de la organización del miembro,
  nunca su nombre individual

#### Scenario: respuesta a hilo existente
- GIVEN un miembro visualizando un hilo en FORO-03
- WHEN escribe contenido en el campo de respuesta y confirma
- THEN la respuesta se añade cronológicamente al final del hilo
- AND se muestra con la organización autora, nunca con la persona
  individual

#### Scenario: identidad interna registrada pero no visible
- GIVEN cualquier publicación creada en el foro
- WHEN el sistema almacena el registro de autoría
- THEN guarda internamente qué usuario concreto escribió la publicación
  (a efectos de edición y borrado)
- AND esa información de persona individual nunca se muestra a otros
  miembros

---

### Requirement: reactions
El sistema SHALL permitir a cada usuario individual reaccionar o quitar
su reacción de tipo "me gusta" en cualquier publicación, contabilizando
cada reacción a nivel de usuario (no de organización), sin que las
reacciones afecten a ninguna ordenación, ranking ni al sistema de
Favoritos de conversational-search.
[Origen: Módulo 08 v1.1, sección 4.5; RNG-FORO-07; CA-FORO-05]

#### Scenario: reaccionar y quitar reacción
- GIVEN un miembro visualizando una publicación sin haber reaccionado
- WHEN pulsa el botón de reacción
- THEN el contador se incrementa inmediatamente
- AND si vuelve a pulsarlo, su reacción se retira y el contador
  decrementa de inmediato

#### Scenario: reacciones independientes por organización
- GIVEN dos usuarios de la misma organización que reaccionan a la
  misma publicación
- WHEN se contabilizan las reacciones
- THEN cuentan como dos reacciones distintas, no como una

#### Scenario: reacciones sin efecto en ordenación
- GIVEN un hilo con un alto número de reacciones acumuladas
- WHEN se calcula el orden de los hilos en FORO-02
- THEN las reacciones no influyen en absoluto en esa ordenación
- AND tampoco afectan al sistema de Favoritos de conversational-search,
  que es un mecanismo independiente

---

### Requirement: own-content-editing
El sistema SHALL permitir editar o eliminar una publicación únicamente
al usuario que la escribió o a cualquier usuario de su misma organización,
tratando la eliminación como acción irreversible que requiere confirmación
explícita.
[Origen: Módulo 08 v1.1, sección 4.3; CA-FORO-06]

#### Scenario: edición de publicación propia
- GIVEN un usuario visualizando una publicación de su propia organización
- WHEN pulsa "Editar" y modifica el contenido
- THEN el cambio se refleja inmediatamente para todos los miembros

#### Scenario: eliminación requiere confirmación explícita
- GIVEN un usuario que pulsa "Eliminar" sobre una publicación de su
  organización
- WHEN el sistema procesa la acción
- THEN solicita confirmación explícita antes de eliminar
- AND tras confirmar, la eliminación es irreversible

#### Scenario: terceros no pueden editar ni eliminar
- GIVEN un usuario de una organización distinta a la autora de una
  publicación
- WHEN visualiza esa publicación
- THEN no ve ninguna opción de editar ni eliminar sobre ella

---

### Requirement: no-active-moderation
El sistema SHALL operar en V1 sin ningún mecanismo de moderación activa
por parte del Operador de Plataforma ni flujo de denuncias, dejando la
edición y eliminación de las propias publicaciones como único control
de contenido disponible.
[Origen: Módulo 08 v1.1, sección 5.1; RNG-FORO-05; CA-FORO-07]

#### Scenario: ausencia de herramientas de moderación
- GIVEN cualquier usuario o el Operador de Plataforma
- WHEN busca un botón de denuncia o un panel de moderación sobre el
  contenido del foro
- THEN no existe ningún elemento de este tipo en la interfaz en V1

---

### Requirement: spam-rate-limiting
El sistema SHALL limitar a 10 las publicaciones (hilos y respuestas
sumados) que una organización puede crear por hora natural, bloqueando
nuevas publicaciones hasta transcurrida esa hora con un mensaje
explicativo, sin afectar a la capacidad de lectura del foro.
[Origen: Módulo 08 v1.1, sección 8; RNG-FORO-06 (sección 8); CA-FORO-08]

#### Scenario: límite horario alcanzado
- GIVEN una organización que ya ha realizado 10 publicaciones (hilos
  más respuestas) en la última hora
- WHEN intenta crear una publicación número 11
- THEN el sistema bloquea la publicación
- AND muestra un mensaje explicativo indicando que debe esperar

#### Scenario: lectura no afectada por el límite
- GIVEN una organización que ha alcanzado el límite de publicación horario
- WHEN cualquier usuario de esa organización navega por el foro
- THEN puede leer cualquier categoría, hilo y publicación con normalidad

---

### Requirement: moderation-review-trigger
El sistema SHALL permitir observar, sin instrumentación adicional, dos
señales que determinan si debe priorizarse el diseño de moderación activa
en una futura revisión: porcentaje de publicaciones eliminadas por sus
propios autores en 30 días naturales, y número de quejas de soporte
recibidas sobre contenido del foro en el mismo periodo.
[Origen: Módulo 08 v1.1, sección 5.4; QA-FORO-03 cerrada]

#### Scenario: umbral de eliminaciones superado
- GIVEN un periodo de 30 días naturales en el que se han eliminado
  más del 5% de las publicaciones totales del foro
- WHEN se revisa este criterio
- THEN se considera superado el umbral de autorregulación
- AND debe priorizarse el diseño de un mecanismo de moderación en
  la siguiente revisión del módulo

#### Scenario: umbral de quejas de soporte superado
- GIVEN un periodo de 30 días naturales en el que el Operador de
  Plataforma recibe 3 o más quejas independientes sobre contenido
  del foro por cualquier canal de soporte ajeno al foro
- WHEN se revisa este criterio
- THEN se considera superado el umbral de autorregulación,
  independientemente del porcentaje de eliminaciones

---

### Requirement: not-e2ee-content
El sistema SHALL almacenar y mostrar todo el contenido del foro como
texto plano legible por el servidor, sin aplicar cifrado E2EE, y SHALL
comunicar esta ausencia de confidencialidad de forma clara en la propia
interfaz del foro.
[Origen: Módulo 08 v1.1, sección 1; nota destacada del documento]

#### Scenario: contenido legible por el servidor
- GIVEN cualquier publicación del foro
- WHEN se inspecciona su almacenamiento en servidor
- THEN el contenido es legible en texto plano, a diferencia de los
  elementos cifrados de messaging-and-negotiation

#### Scenario: aviso de confidencialidad en la interfaz
- GIVEN un miembro accediendo al foro
- WHEN visualiza la interfaz del módulo
- THEN encuentra una comunicación clara de que el contenido del foro
  no tiene ninguna garantía de confidencialidad

---

### Requirement: vera-drafting-and-summary
El sistema SHALL permitir a VERA ayudar a redactar hilos y respuestas a
partir de lenguaje natural, mostrando siempre el resultado para
confirmación antes de publicar, y SHALL permitir resumir un hilo largo
a petición explícita del usuario, dado que el contenido del foro no
está cifrado y no aplica la restricción de privacidad de
messaging-and-negotiation.
[Origen: Módulo 08 v1.1, sección 7; CA-FORO-04]

#### Scenario: creación de hilo asistida por VERA
- GIVEN un usuario que pide a VERA abrir un hilo sobre un tema concreto
  en una categoría
- WHEN VERA propone un título y cuerpo a partir de la instrucción
- THEN el usuario ve el borrador completo antes de publicar
- AND el hilo no se crea hasta que el usuario confirma explícitamente

#### Scenario: resumen de hilo a petición explícita
- GIVEN un usuario que pide a VERA resumir un hilo largo
- WHEN VERA genera el resumen
- THEN lo hace únicamente porque se trata de contenido no cifrado
  del foro, acción que no sería posible sobre un hilo de mensajería
  E2EE
- AND el resumen se genera solo ante petición explícita, nunca
  de forma proactiva

---

## Out of Scope
- Moderación activa, herramientas de denuncia o panel de moderación para
  el Operador de Plataforma (fuera de V1 — evaluable según comportamiento
  real tras lanzamiento, sujeto al criterio de moderation-review-trigger).
- Mensajería privada entre miembros (capability messaging-and-negotiation).
- Cualquier dato comercial sensible (precios, cantidades negociadas,
  ofertas) — el foro es espacio de conversación general, no canal
  de negociación.
- Creación de categorías por los propios miembros (solo equipo de producto).
- Foro público sin cuenta (acceso exclusivo a miembros ACTIVE).

---

## Cross-Capability References
- `organization-onboarding` — solo miembros de organizaciones en estado
  ACTIVE pueden leer o escribir en el foro.
- `billing-subscription` — una organización SUSPENDED por impago pierde
  acceso al foro de la misma forma que al resto de la plataforma.
- `conversational-search` — las reacciones de este módulo son un
  mecanismo independiente del sistema de Favoritos de esa capability;
  no se cruzan ni se influyen mutuamente.
- `vera-agent` — VERA opera en el foro sobre contenido en claro,
  con capacidades (como el resumen de hilos) no disponibles en
  messaging-and-negotiation por la naturaleza no cifrada del contenido.

---

## Open Questions
- Ninguna. Todas las decisiones del módulo están cerradas en v1.1.