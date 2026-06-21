# Billing and Subscription Specification

## Purpose
Gestionar el ciclo de vida de la suscripción anual de cada organización
miembro de Bearingworld.io de forma íntegramente manual — sin pasarela
de pago ni procesamiento de tarjetas — mediante transferencia bancaria
confirmada por el Operador de Plataforma, con periodo de prueba inicial,
avisos de vencimiento, suspensión automática sin periodo de gracia y
borrado de datos siempre bajo supervisión humana.

---

## ADDED Requirements

---

### Requirement: trial-period
El sistema SHALL conceder automáticamente a toda organización aprobada
(estado ACTIVE) un periodo de prueba de 90 días naturales desde la fecha
de aprobación, sin requerir ninguna acción de pago ni mostrar ningún
bloqueo durante ese periodo.
[Origen: Módulo 07 v1.1, sección 1.1; RNG-BILL-02; CA-BILL-01]

#### Scenario: acceso pleno durante el periodo de prueba
- GIVEN una organización recién aprobada por el Operador de Plataforma
- WHEN cualquier usuario de esa organización accede a la plataforma
  dentro de los primeros 90 días
- THEN tiene acceso completo a todas las funcionalidades
- AND no se le presenta ningún requerimiento de pago ni bloqueo

---

### Requirement: annual-billing-cycle
El sistema SHALL calcular la fecha de vencimiento de cada organización
como 365 días desde la fecha del último pago confirmado por el operador
(o desde el fin del periodo de prueba para el primer ciclo), recalculando
esa fecha cada vez que se confirma un nuevo pago.
[Origen: Módulo 07 v1.1, sección 1.1; RNG-BILL-03; CA-BILL-05]

#### Scenario: cálculo del primer vencimiento
- GIVEN una organización que completa sus 90 días de periodo de prueba
  sin haber realizado ningún pago
- WHEN el sistema calcula su fecha de vencimiento
- THEN la fecha de vencimiento es el día 90 desde la aprobación
  (fin del periodo de prueba), no una fecha posterior

#### Scenario: recálculo tras pago confirmado
- GIVEN una organización con un pago confirmado por el operador con
  fecha indicada
- WHEN el sistema recalcula el ciclo
- THEN la nueva fecha de vencimiento es exactamente 365 días después
  de la fecha de pago indicada, no desde la fecha de vencimiento
  teórica anterior

---

### Requirement: expiration-warning
El sistema SHALL enviar un aviso de vencimiento próximo exactamente 15 días
antes de la fecha de vencimiento, una única vez por ciclo, simultáneamente
por email al Administrador de Organización (incluyendo los datos bancarios
para la transferencia) y como alerta en el panel ADMIN-02 del operador.
[Origen: Módulo 07 v1.1, sección 4; RNG-BILL-04; CA-BILL-02]

#### Scenario: aviso disparado a 15 días del vencimiento
- GIVEN una organización cuya fecha de vencimiento está a 15 días exactos
- WHEN el sistema evalúa los vencimientos del día
- THEN envía el email con los datos bancarios al Administrador de Organización
- AND añade la organización a la cola de avisos enviados en ADMIN-02
- AND no vuelve a enviar este aviso de nuevo en el mismo ciclo

#### Scenario: datos bancarios exclusivos del canal email
- GIVEN el aviso de vencimiento enviado a un Administrador de Organización
- WHEN el Administrador busca los datos bancarios en cualquier pantalla
  de la plataforma
- THEN no los encuentra en ningún banner, pantalla o componente visible
- AND los datos bancarios existen únicamente en el contenido del email

---

### Requirement: automatic-suspension
El sistema SHALL transicionar automáticamente a estado SUSPENDED a toda
organización cuya fecha de vencimiento se alcanza sin un pago confirmado
por el operador, sin ningún periodo de gracia ni mecanismo de extensión
manual, conservando íntegramente todos sus datos.
[Origen: Módulo 07 v1.1, sección 5.1; RNG-BILL-05, RNG-BILL-07, RNG-BILL-09;
CA-BILL-03, CA-BILL-04]

#### Scenario: suspensión automática al vencimiento
- GIVEN una organización que alcanza su fecha de vencimiento sin pago
  confirmado
- WHEN el sistema evalúa los vencimientos del día
- THEN la organización transiciona automáticamente a SUSPENDED
- AND la transición ocurre sin intervención humana y sin margen de gracia

#### Scenario: efecto de la suspensión sobre usuarios y visibilidad
- GIVEN una organización en estado SUSPENDED
- WHEN cualquier usuario de esa organización inicia sesión
- THEN ve la pantalla de suspensión en lugar del dashboard
- AND su inventario deja de aparecer en los resultados de búsqueda
  de otros miembros

#### Scenario: datos conservados durante la suspensión
- GIVEN una organización recién suspendida por falta de pago
- WHEN se audita el estado de sus datos
- THEN su inventario, claves E2EE, mensajería y favoritos permanecen
  íntegros y sin purgar

#### Scenario: ausencia absoluta de extensión manual
- GIVEN un operador que considera justificado dar más tiempo a una
  organización concreta antes de su vencimiento
- WHEN busca un mecanismo para extender manualmente el plazo
- THEN el sistema no ofrece ninguna acción de extensión o prórroga
- AND todas las organizaciones se rigen por el mismo cálculo automático
  de fechas sin excepción

---

### Requirement: manual-payment-confirmation
El sistema SHALL permitir exclusivamente al Operador de Plataforma marcar
un pago como recibido desde ADMIN-02, mediante un formulario con fecha de
pago (por defecto la fecha actual, editable) y nota interna opcional, lo
que reactiva inmediatamente la organización si estaba suspendida y
recalcula su vencimiento.
[Origen: Módulo 07 v1.1, sección 6.2; RNG-BILL-06; CA-BILL-05, CA-BILL-06]

#### Scenario: reactivación inmediata tras confirmar pago
- GIVEN una organización en estado SUSPENDED
- WHEN el operador confirma "Marcar pago recibido" con una fecha de pago
- THEN la organización transiciona inmediatamente a ACTIVE
- AND su fecha de vencimiento se recalcula a 365 días desde la fecha
  de pago indicada

#### Scenario: historial de pagos visible en ficha de organización
- GIVEN una organización con uno o más pagos confirmados previamente
- WHEN el operador abre su ficha desde ADMIN-02
- THEN ve cada pago con su fecha, el operador que lo registró y su nota
  interna asociada

---

### Requirement: collections-panel
El sistema SHALL presentar en ADMIN-02 una tabla de todas las organizaciones
en estado ACTIVE o SUSPENDED con nombre, fecha de último pago, fecha de
vencimiento, días restantes y estado, ordenada por días restantes ascendente
por defecto, con filtro por estado (Próximos a vencer, Suspendidos,
Candidatas a borrado, Todos).
[Origen: Módulo 07 v1.1, sección 6.2; Inventario de Pantallas v1.1]

#### Scenario: orden por defecto prioriza vencimientos próximos
- GIVEN el panel ADMIN-02 cargado sin filtros aplicados
- WHEN el operador visualiza la tabla
- THEN las organizaciones más próximas a vencer (o ya vencidas, con
  días restantes negativos) aparecen primero

#### Scenario: filtro por candidatas a borrado
- GIVEN el operador que selecciona el filtro "Candidatas a borrado"
- WHEN se aplica el filtro
- THEN la tabla muestra únicamente organizaciones con 6+ meses continuados
  en SUSPENDED

---

### Requirement: deletion-after-prolonged-suspension
El sistema SHALL marcar como candidata a borrado a toda organización con
6 meses continuados en estado SUSPENDED, sin ejecutar nunca el borrado
de forma automática, requiriendo siempre doble confirmación explícita
del Operador de Plataforma para ejecutarlo.
[Origen: Módulo 07 v1.1, sección 5.3; RNG-BILL-08; CA-BILL-08]

#### Scenario: marcado automático como candidata, sin acción adicional
- GIVEN una organización que alcanza 6 meses continuados en SUSPENDED
- WHEN el sistema evalúa el tiempo transcurrido
- THEN la organización aparece en la sección "Candidatas a borrado" de ADMIN-02
- AND no se envía ninguna notificación adicional al cliente en ese momento

#### Scenario: borrado con doble confirmación
- GIVEN una organización candidata a borrado
- WHEN el operador pulsa "Iniciar borrado"
- THEN el sistema exige una primera confirmación de intención y una
  segunda confirmación explícita y definitiva
- AND solo tras ambas confirmaciones elimina inventario, perfil, claves
  E2EE y la parte correspondiente del historial de mensajería
- AND el borrado no puede revertirse tras la segunda confirmación

#### Scenario: pago recibido antes del borrado cancela la candidatura
- GIVEN una organización marcada como candidata a borrado que aún
  no ha sido borrada
- WHEN el operador confirma un pago recibido para esa organización
- THEN se reactiva con normalidad y desaparece de la sección
  "Candidatas a borrado"
- AND si vuelve a suspenderse en el futuro, el contador de 6 meses
  se reinicia desde cero

---

### Requirement: vera-billing-boundaries
El sistema SHALL permitir a VERA responder consultas informativas de
solo lectura sobre el estado de billing (fecha de vencimiento propia,
procedimiento de pago, organizaciones próximas a vencer para el operador),
y SHALL impedir que VERA ejecute directamente cualquier acción de
confirmación de pago, dirigiendo siempre al operador hacia ADMIN-02.
[Origen: Módulo 07 v1.1, sección 7; CA-BILL-07]

#### Scenario: consulta informativa de vencimiento propio
- GIVEN un Administrador de Organización que pregunta a VERA cuándo
  vence su suscripción
- WHEN VERA responde
- THEN indica la fecha de vencimiento y los días restantes consultando
  el estado real de la organización
- AND no ejecuta ninguna acción sobre el sistema de billing

#### Scenario: VERA nunca confirma pagos directamente
- GIVEN un operador que pide a VERA "marca como pagada la organización X"
- WHEN VERA procesa la instrucción
- THEN no ejecuta la confirmación de pago por sí misma
- AND dirige al operador hacia el botón "Marcar pago recibido" en ADMIN-02

---

## Out of Scope
- Cualquier pasarela de pago, integración con Stripe o procesamiento de
  tarjetas/cuentas bancarias de clientes (RNG-BILL-01, principio permanente).
- Pagos entre miembros por transacciones comerciales (RNG-MSG-08, Módulo 04).
- Gestión contable o fiscal interna de Bearingworld.io.
- Planes de pago fraccionado, descuentos automáticos o tiers de precio
  diferenciados (fuera de V1).
- Extensión manual del periodo de prueba o de la fecha de vencimiento
  (descartada explícitamente, RNG-BILL-09).

---

## Cross-Capability References
- `organization-onboarding` — el periodo de prueba se activa al completarse
  la aprobación gestionada por esa capability; la transición ACTIVE ↔
  SUSPENDED por impago es gestionada exclusivamente por esta capability.
- `conversational-search` — una organización SUSPENDED deja de aparecer
  en los resultados de búsqueda de otros miembros.
- `vera-agent` — VERA opera en este módulo en modo estrictamente informativo,
  sin ejecutar ninguna acción de confirmación de pago.

---

## Open Questions
- Ninguna. Todas las decisiones del módulo están cerradas en v1.1.