# VERA Agent Specification

## Purpose
Ofrecer a los miembros de Bearingworld.io una interfaz conversacional primaria
— VERA — que conoce y opera todos los sistemas de la plataforma en lenguaje
natural, ejecuta acciones con los permisos del usuario autenticado, y respeta
en todo momento los límites no negociables de privacidad E2EE, confirmación
explícita para acciones irreversibles y ausencia de decisión comercial
autónoma.

---

## ADDED Requirements

---

### Requirement: agent-identity
El sistema SHALL presentar el agente con el nombre fijo VERA, tono profesional
y directo, y SHALL adaptar automáticamente el idioma de sus respuestas al
idioma configurado en el perfil del usuario entre los 9 idiomas soportados
(ES, EN, DE, IT, FR, PL, PT, RU, JA).
[Origen: Módulo 00 v1.1, sección 3.1]

#### Scenario: idioma adaptado al perfil del usuario
- GIVEN un usuario con el idioma de perfil configurado en alemán
- WHEN interactúa con VERA en cualquier pantalla de la plataforma
- THEN todas las respuestas de VERA aparecen en alemán
- AND el nombre "VERA" permanece invariable independientemente del idioma

#### Scenario: tono consistente en toda la plataforma
- GIVEN cualquier interacción del usuario con VERA
- WHEN VERA responde
- THEN el tono es profesional y directo, sin lenguaje florido ni
  artificios de asistente de soporte genérico

---

### Requirement: non-negotiable-limits
El sistema SHALL impedir que VERA ejecute acciones irreversibles sin
confirmación explícita, acceda a contenido cifrado E2EE de terceros, tome
decisiones comerciales en nombre del usuario, ejecute acciones fuera del
ámbito de la plataforma, o confirme disponibilidad de stock sin consultar
el índice en tiempo real.
[Origen: Módulo 00 v1.1, sección 3.3]

#### Scenario: acceso denegado a contenido cifrado ajeno
- GIVEN un usuario que pregunta a VERA por el precio que cotizó otro
  miembro en una negociación ajena
- WHEN VERA procesa la pregunta
- THEN responde que ese dato está cifrado de extremo a extremo y que
  solo las partes de esa negociación pueden verlo
- AND no intenta inferir ni aproximar ningún valor

#### Scenario: ninguna decisión comercial autónoma
- GIVEN un usuario que pide a VERA que decida si aceptar una oferta recibida
- WHEN VERA procesa la instrucción
- THEN presenta la información disponible para ayudar a decidir
- AND no acepta, rechaza ni modifica la oferta sin que el usuario
  ejecute la acción explícitamente

#### Scenario: disponibilidad de stock siempre verificada en tiempo real
- GIVEN un usuario que pregunta a VERA por la disponibilidad de una referencia
- WHEN VERA responde
- THEN consulta el índice de búsqueda en tiempo real antes de responder
- AND nunca da por buena información de disponibilidad basada solo en
  memoria de conversación previa

#### Scenario: acción fuera de ámbito de la plataforma
- GIVEN un usuario que pide a VERA enviar un email a un contacto externo
  o interactuar con un sistema ajeno a la plataforma
- WHEN VERA procesa la instrucción
- THEN explica con claridad que esa acción está fuera de su ámbito
- AND ofrece la alternativa más cercana disponible dentro de la plataforma

---

### Requirement: irreversible-action-confirmation
El sistema SHALL aplicar el protocolo de confirmación de seis pasos para
toda acción clasificada como irreversible: describir el efecto en lenguaje
claro, indicar explícitamente que no es reversible, mostrar el impacto
cuantificado cuando sea posible, presentar un botón de confirmación con
texto específico (nunca "Aceptar" genérico), ejecutar solo tras confirmación
explícita, y confirmar el resultado tras la ejecución.
[Origen: Módulo 00 v1.1, sección 6.2]

#### Scenario: protocolo completo en acción irreversible
- GIVEN un usuario que pide a VERA "elimina mis líneas de inventario archivadas"
- WHEN VERA clasifica la intención como ACCIÓN IRREVERSIBLE
- THEN describe el efecto ("Esto eliminará 340 líneas de inventario
  archivadas de tu cuenta")
- AND indica explícitamente que la acción no se puede deshacer
- AND muestra el impacto cuantificado (340 líneas / 12 referencias /
  última actualización hace 45 días)
- AND presenta un botón con texto específico ("Sí, eliminar 340 líneas")
  junto con una opción de cancelar
- AND solo ejecuta la eliminación tras la confirmación explícita del usuario
- AND tras ejecutar, confirma el resultado con la cifra final actualizada

#### Scenario: acción reversible no requiere el protocolo completo
- GIVEN un usuario que pide a VERA marcar un watcher como pausado
  (acción reversible)
- WHEN VERA clasifica la intención como ACCIÓN REVERSIBLE
- THEN aplica una confirmación ligera, sin requerir el protocolo de
  seis pasos reservado para acciones irreversibles

---

### Requirement: ambiguity-handling
El sistema SHALL identificar un máximo de 3 interpretaciones posibles ante
un mensaje ambiguo y presentarlas como opciones, formulando una única
pregunta de clarificación por turno, sin ejecutar ninguna interpretación
de la que VERA no esté segura.
[Origen: Módulo 00 v1.1, sección 6.3]

#### Scenario: clarificación sobre objeto ambiguo
- GIVEN un usuario que escribe "actualiza los datos" sin especificar
  a qué se refiere
- WHEN VERA no puede determinar la intención con suficiente confianza
- THEN formula una única pregunta de clarificación pidiendo la
  información mínima necesaria, con un ejemplo del formato esperado
- AND no ejecuta ninguna acción hasta recibir la aclaración

#### Scenario: máximo de tres interpretaciones presentadas
- GIVEN un mensaje ambiguo que admite más de tres lecturas posibles
- WHEN VERA presenta las interpretaciones como opciones
- THEN nunca presenta más de 3 opciones simultáneamente

#### Scenario: nunca preguntas en cadena
- GIVEN una situación que requeriría aclarar dos aspectos distintos
  de la misma instrucción
- WHEN VERA pide clarificación
- THEN formula una sola pregunta por turno, no varias preguntas
  encadenadas en el mismo mensaje

---

### Requirement: session-context-layer
El sistema SHALL mantener el historial completo de la conversación activa
como contexto de sesión (Capa 1), purgándolo automáticamente a las 24 horas
desde el inicio de sesión o al cerrar sesión si ocurre antes, sin ofrecer
ninguna opción de persistencia de este historial entre sesiones.
[Origen: Módulo 00 v1.1, sección 5.1]

#### Scenario: purga automática a las 24 horas
- GIVEN una sesión activa iniciada hace 24 horas exactas
- WHEN el sistema evalúa el TTL del contexto de sesión
- THEN el historial completo de esa sesión se purga automáticamente
- AND ninguna acción del usuario puede recuperar ese historial purgado

#### Scenario: purga al cerrar sesión
- GIVEN un usuario que cierra sesión voluntariamente antes de las 24 horas
- WHEN se ejecuta el logout
- THEN el contexto de sesión se purga inmediatamente, sin esperar
  al cumplimiento del TTL

---

### Requirement: profile-context-layer
El sistema SHALL mantener un contexto de perfil persistente (Capa 2) con
las preferencias aprendidas del usuario y un historial de actividad
resumido (no el detalle cifrado), accesible y editable por el usuario
desde Ajustes → Asistente VERA.
[Origen: Módulo 00 v1.1, sección 5.1]

#### Scenario: persistencia de preferencias entre sesiones
- GIVEN un usuario con preferencias aprendidas (regiones, marcas
  habituales) de sesiones anteriores
- WHEN inicia una nueva sesión
- THEN VERA dispone de esas preferencias sin necesidad de que el
  usuario las repita

#### Scenario: el contexto de perfil nunca incluye detalle cifrado
- GIVEN el historial de actividad resumido almacenado en el contexto
  de perfil
- WHEN se audita su contenido
- THEN no contiene ningún dato comercial cifrado (precios, cantidades
  negociadas), únicamente metadatos de comportamiento

---

### Requirement: realtime-platform-state-layer
El sistema SHALL consultar el estado de la plataforma (inventario,
mensajes, watchers, suscripción) en tiempo real mediante herramientas
invocables (Capa 3) en el momento de cada respuesta, sin memorizar ni
cachear ese estado entre interacciones.
[Origen: Módulo 00 v1.1, sección 5.1]

#### Scenario: consulta en tiempo real, no memorizada
- GIVEN un usuario que pregunta dos veces en la misma sesión por su
  número de líneas de inventario, con cambios entre ambas preguntas
- WHEN VERA responde a cada pregunta
- THEN invoca la herramienta correspondiente en cada ocasión
- AND la segunda respuesta refleja el cambio ocurrido, no un valor
  memorizado de la primera consulta

---

### Requirement: intent-classification
El sistema SHALL clasificar toda instrucción del usuario en una de las
categorías CONSULTA, ACCIÓN REVERSIBLE, ACCIÓN IRREVERSIBLE, NAVEGACIÓN
o AMBIGUA, aplicando el comportamiento correspondiente a cada categoría
antes de ejecutar cualquier acción.
[Origen: Módulo 00 v1.1, sección 6.1]

#### Scenario: clasificación como navegación
- GIVEN un usuario que escribe "llévame a mi inventario"
- WHEN VERA clasifica la intención
- THEN la categoriza como NAVEGACIÓN y navega directamente a la
  pantalla correspondiente sin solicitar confirmación

#### Scenario: clasificación como consulta
- GIVEN un usuario que pregunta "¿cuántos hilos tengo abiertos?"
- WHEN VERA clasifica la intención
- THEN la categoriza como CONSULTA y responde con el dato solicitado
  sin ejecutar ninguna acción que modifique el estado del sistema

---

### Requirement: cross-capability-integration
El sistema SHALL exponer las operaciones de búsqueda, gestión de
inventario, watchers, mensajería (solo metadatos y redacción en claro),
billing (solo consultas informativas), foro y onboarding como herramientas
invocables por VERA, actuando siempre con los permisos del usuario
autenticado sin posibilidad de escalar privilegios.
[Origen: Módulo 00 v1.1, secciones 3.2 y 8; Módulos 01, 02, 03, 04, 07, 08]

#### Scenario: VERA opera con los permisos del usuario autenticado
- GIVEN un usuario con rol Editor (no Administrador) en su organización
- WHEN pide a VERA ejecutar una acción reservada al rol Administrador
- THEN VERA respeta la restricción de permisos del usuario
- AND no ejecuta la acción ni la eluda de ninguna forma

#### Scenario: integración con billing solo informativa
- GIVEN un Administrador que pregunta a VERA por la fecha de vencimiento
  de su suscripción
- WHEN VERA responde
- THEN consulta el estado real de billing y devuelve la fecha exacta
- AND no ejecuta ninguna acción de confirmación de pago ni de cambio
  de estado de la suscripción

---

### Requirement: action-audit-logging
El sistema SHALL registrar en el log de auditoría toda acción ejecutada
por VERA en nombre de un usuario, anotando explícitamente que fue
"ejecutado vía agente conversacional".
[Origen: Módulo 00 v1.1, sección 3.2; Tech Stack v1.1, sección Observability]

#### Scenario: registro de acción ejecutada por VERA
- GIVEN un usuario que ejecuta una acción a través de VERA (por ejemplo,
  crear un watcher)
- WHEN la acción se completa
- THEN el log de auditoría registra la acción con la nota
  "ejecutado vía agente conversacional"
- AND el registro es indistinguible en estructura del de una acción
  ejecutada directamente desde la UI, salvo por esa nota de origen

---

## Out of Scope
- Interfaz de voz (diferida a V2, QA-A00-02 cerrada).
- Modo proactivo iniciado por VERA sin acción del usuario (diferido a V2,
  QA-A00-05 cerrada) — en V1, VERA es estrictamente reactiva.
- Acceso a contenido E2EE cifrado de mensajes o tarjetas ajenas a la
  sesión activa del usuario.
- Resumen de conversaciones cifradas de messaging-and-negotiation
  (diferido a V2, QA-MSG-04 cerrada).
- Traducción de mensajes entre idiomas (eliminada de la plataforma).
- Propuesta de cifras de precio por iniciativa propia.
- **Layout de interfaz de tres zonas (Zona A/B/C, posición en pantalla,
  comportamiento en mobile)** — Módulo 00 v1.1, sección 4. Es una decisión
  de arquitectura de interfaz transversal a toda la plataforma, no
  comportamiento de esta capability ni de ninguna otra en particular.
  Queda fuera de este spec; ver Open Questions.
- **Implicaciones técnicas de implementación** (latencia objetivo,
  streaming, seguridad de sesión del agente, sincronización de estado)
  — Módulo 00 v1.1, sección 9. El propio documento de origen las
  describe como puntos de atención para la fase de diseño técnico, no
  como requirements de comportamiento. Corresponden a design.md, fuera
  del alcance del agente SDD.

---

## Cross-Capability References
- Todas las capabilities del proyecto exponen herramientas invocables
  por VERA: `e2ee-key-management`, `organization-onboarding`,
  `inventory-management`, `conversational-search`,
  `messaging-and-negotiation`, `billing-subscription`,
  `organization-directory`, `community-forum`.
- `messaging-and-negotiation` — VERA opera ahí exclusivamente sobre
  metadatos y contenido en claro que el propio usuario redacta, nunca
  sobre contenido cifrado ajeno (límite compartido entre ambos specs).
- `community-forum` — VERA puede resumir hilos largos en esa capability
  porque su contenido no está cifrado, a diferencia de
  messaging-and-negotiation.

---

## Open Questions
- ¿Dónde debe documentarse la sección 4 del Módulo 00 (layout de
  interfaz de tres zonas)? No es comportamiento de ninguna capability
  de negocio — es una decisión de arquitectura de interfaz transversal.
  Candidato propuesto: una entrada en `openspec/product-decisions.md`
  o un documento de arquitectura de interfaz aparte, fuera de la
  estructura `specs/` de OpenSpec. Pendiente de que el Product Owner
  decida su ubicación definitiva. No bloqueante para el cierre de
  esta capability.