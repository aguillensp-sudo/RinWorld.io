# Organization Onboarding Specification

## Purpose
Garantizar que solo organizaciones verificadas del sector de distribución de
rodamientos accedan a Bearingworld.io, mediante un proceso de registro controlado
por el Operador de Plataforma, que culmina con la organización activa, su
administrador autenticado y sus claves E2EE generadas.

---

## ADDED Requirements

---

### Requirement: dual-entry-routes
El sistema SHALL soportar dos rutas de entrada al registro: Ruta 00.1 para usuarios
invitados con token (aprobación automática) y Ruta 00.2 para usuarios desconocidos
vía Formulario de Solicitud de Registro (aprobación manual por operador), convergiendo
ambas en el FRO una vez autorizado el acceso.
[Origen: Módulo 01 v1.5, secciones 3.2.2 y 3.2.3]

#### Scenario: ruta 00.1 — invitado con token válido
- GIVEN un visitante anónimo que accede mediante un enlace de invitación con token válido
- WHEN el sistema valida el token
- THEN el estado del miembro se asigna automáticamente a INVITED_APPROVED
- AND el usuario es redirigido directamente al FRO sin pasar por el FSR ni por revisión
  del operador

#### Scenario: ruta 00.2 — usuario desconocido
- GIVEN un visitante anónimo que pulsa "Solicitud de Registro" sin token de invitación
- WHEN completa y envía el FSR
- THEN el sistema registra la solicitud con estado PENDING_REVIEW
- AND la solicitud aparece en la cola de ADMIN-01 para revisión del operador

---

### Requirement: operator-approval
El sistema SHALL requerir aprobación manual y explícita del Operador de Plataforma
para toda solicitud proveniente de la Ruta 00.2, sin ningún mecanismo automático
de activación, y SHALL registrar la identidad del operador y el timestamp de cada
decisión en el log de auditoría.
[Origen: Módulo 01 v1.5, sección 3.2B y principio rector FL-00]

#### Scenario: aprobación por operador
- GIVEN una solicitud en estado PENDING_REVIEW en ADMIN-01
- WHEN el operador pulsa "Aprobar"
- THEN el estado transiciona a INVITED_APPROVED
- AND el sistema envía EML-07 al solicitante con enlace al FRO
- AND la decisión queda registrada con el ID del operador y timestamp

#### Scenario: rechazo por operador
- GIVEN una solicitud en estado PENDING_REVIEW
- WHEN el operador introduce un motivo y confirma el rechazo
- THEN el estado transiciona a REJECTED
- AND el sistema envía EML-08 al solicitante con el motivo
- AND la decisión queda registrada con el ID del operador y timestamp

#### Scenario: reversión de rechazo a revisión
- GIVEN una solicitud en estado REJECTED
- WHEN el operador revierte la decisión manualmente
- THEN el estado transiciona a PENDING_REVIEW
- AND la solicitud reaparece en la cola de ADMIN-01

#### Scenario: timeout de solicitud sin revisar
- GIVEN una solicitud en estado PENDING_REVIEW
- WHEN transcurren 30 días sin que el operador tome ninguna decisión
- THEN el sistema transiciona el estado a CANCELLED automáticamente
- AND el solicitante recibe notificación de cancelación por timeout

---

### Requirement: unified-registration-form
El sistema SHALL presentar al usuario autorizado un formulario unificado (FRO) que
recoja en una única pantalla los datos de la organización y del usuario administrador,
con los campos obligatorios definidos en el Inventario de Pantallas v1.1, incluyendo
NIF/CIF, dirección, código postal, email de contacto público y teléfono de contacto
público.
[Origen: Módulo 01 v1.5, sección 3.2.5; Inventario de Pantallas v1.1, sección 2.4]

#### Scenario: envío exitoso del FRO
- GIVEN un usuario en estado INVITED_APPROVED que completa todos los campos
  obligatorios del FRO
- WHEN pulsa "Crear mi cuenta"
- THEN el sistema crea la organización y el usuario administrador en base de datos
- AND el estado transiciona a REGISTERED
- AND el usuario es redirigido al flujo de generación de claves E2EE (capability
  e2ee-key-management, FL-03)

#### Scenario: pre-relleno desde FSR en ruta 00.2
- GIVEN un usuario de la Ruta 00.2 que accede al FRO tras aprobación del operador
- WHEN se carga el formulario
- THEN los campos coincidentes con el FSR (nombre empresa, país, teléfono, web)
  aparecen pre-rellenados y son editables

#### Scenario: NIF/CIF obligatorio sin validación de formato
- GIVEN un usuario completando el FRO
- WHEN intenta enviar el formulario sin introducir el NIF/CIF
- THEN el sistema bloquea el envío e indica el campo como requerido
- AND no aplica ninguna validación de formato sobre el valor introducido

---

### Requirement: role-auto-assignment
El sistema SHALL asignar automáticamente el rol de Administrador al primer usuario
que completa el FRO de una organización, y el rol de Editor a todos los usuarios
adicionales, sin que exista ningún selector de rol en ningún formulario de registro
o invitación.
[Origen: Módulo 01 v1.5, RN-01.8]

#### Scenario: asignación de rol al primer usuario
- GIVEN un usuario que completa el FRO como primer miembro de una organización nueva
- WHEN el sistema crea el registro de usuario
- THEN el rol queda fijado como Administrador sin ninguna elección del usuario

#### Scenario: asignación de rol a usuario adicional
- GIVEN un usuario que completa el FRU (formulario de usuario adicional) tras invitación
- WHEN el sistema crea el registro de usuario
- THEN el rol queda fijado como Editor sin ninguna elección del usuario

---

### Requirement: member-state-machine
El sistema SHALL implementar la máquina de estados del objeto Member con las
transiciones: PENDING_REVIEW → INVITED_APPROVED → REGISTERED → KEY_ACTIVE → ACTIVE,
y las transiciones laterales ACTIVE ↔ SUSPENDED y PENDING_REVIEW → REJECTED /
CANCELLED, siendo REJECTED, CANCELLED y ACTIVE (sin impago) los únicos estados
que no transicionan automáticamente.
[Origen: Módulo 01 v1.5, sección 4]

#### Scenario: transición a KEY_ACTIVE
- GIVEN un miembro en estado REGISTERED que completa exitosamente FL-03
- WHEN el sistema confirma el backup de clave almacenado en servidor
- THEN el estado transiciona automáticamente a KEY_ACTIVE

#### Scenario: transición a ACTIVE
- GIVEN un miembro en estado KEY_ACTIVE que completa la configuración inicial
- WHEN finaliza la Fase D del onboarding
- THEN el estado transiciona automáticamente a ACTIVE
- AND el miembro tiene acceso pleno a todas las funcionalidades de la plataforma

#### Scenario: suspensión por operador
- GIVEN un miembro en estado ACTIVE
- WHEN el operador ejecuta la suspensión manualmente
- THEN el estado transiciona a SUSPENDED
- AND el miembro pierde acceso a todas las funcionalidades de la plataforma

---

### Requirement: google-sso
El sistema SHALL ofrecer Google SSO como método de autenticación alternativo al
email+contraseña, manteniendo en ambos casos la obligatoriedad de configurar una
backup passphrase E2EE independiente del método de login, y SHALL detectar un email
ya registrado vía formulario clásico para ofrecer vinculación en lugar de crear
una cuenta duplicada.
[Origen: Módulo 01 v1.5, RN-01.5 y RN-01.6]

#### Scenario: registro con Google SSO
- GIVEN un visitante que elige "Continuar con Google" en el FRO
- WHEN Google autentica la identidad correctamente
- THEN el sistema crea la cuenta sin contraseña propia de la plataforma
- AND redirige al flujo de backup passphrase E2EE antes de continuar

#### Scenario: email ya registrado intenta SSO
- GIVEN un usuario con cuenta existente vía email+contraseña
- WHEN intenta registrarse con Google SSO usando el mismo email
- THEN el sistema detecta el email duplicado
- AND ofrece vincular el acceso con Google en lugar de crear una cuenta nueva

---

### Requirement: additional-user-invitation
El sistema SHALL permitir al Administrador de Organización invitar usuarios
adicionales hasta un máximo de 5 usuarios por organización, con tokens de invitación
válidos durante 7 días, y SHALL impedir invitar emails ya registrados en la plataforma
bajo cualquier organización.
[Origen: Módulo 01 v1.5, sección 3.5 y RN-INV.1 a RN-INV.3]

#### Scenario: invitación enviada correctamente
- GIVEN un Administrador en INVT-01 que introduce un email no registrado en la
  plataforma
- WHEN pulsa "Enviar invitación"
- THEN el sistema envía el email de invitación con token válido por 7 días
- AND la invitación aparece como Pendiente en el panel de INVT-01

#### Scenario: intento de invitar email ya registrado
- GIVEN un Administrador introduciendo un email en el formulario de invitación
- WHEN el email ya existe registrado en la plataforma bajo cualquier organización
- THEN el sistema muestra en tiempo real: "Este usuario ya tiene una cuenta
  en la plataforma"
- AND bloquea el envío de la invitación

#### Scenario: límite de 5 usuarios alcanzado
- GIVEN una organización que ya tiene 5 usuarios activos
- WHEN el Administrador intenta enviar una nueva invitación
- THEN el sistema bloquea la acción e indica que se ha alcanzado el límite
- AND sugiere contactar con soporte para solicitar ampliación

#### Scenario: token de invitación expirado
- GIVEN una invitación enviada hace más de 7 días sin ser aceptada
- WHEN el estado de la invitación es revisado
- THEN el sistema la marca como Expirada
- AND el Administrador puede reenviar la invitación generando un nuevo token

---

### Requirement: user-revocation
El sistema SHALL permitir al Administrador revocar el acceso de un usuario de su
organización, eliminando su capacidad de autenticarse, sin eliminar su clave privada
ni su historial cifrado.
[Origen: Módulo 01 v1.5, QA-05 cerrada; INVT-01]

#### Scenario: revocación de acceso
- GIVEN un Administrador que revoca el acceso de un usuario desde INVT-01
- WHEN confirma la acción
- THEN el usuario pierde inmediatamente la capacidad de iniciar sesión
- AND la clave privada del usuario revocado se mantiene intacta en el servidor
- AND su historial cifrado permanece inaccesible pero no destruido

---

### Requirement: rate-limiting-auth-endpoints
El sistema SHALL aplicar rate limiting a todos los endpoints de autenticación y
registro del módulo, con un máximo de 10 peticiones por minuto por IP como límite
mínimo, con parámetros exactos definidos en la especificación técnica.
[Origen: Módulo 01 v1.5, RNG-03]

#### Scenario: límite de tasa excedido
- GIVEN un cliente que supera 10 peticiones por minuto a un endpoint de autenticación
- WHEN se envía la petición que supera el límite
- THEN el servidor responde con HTTP 429
- AND el cliente recibe información sobre el tiempo de espera antes del siguiente intento

---

## Out of Scope
- Generación, backup, recuperación y rotación de claves E2EE
  (capability e2ee-key-management — cerrada).
- Gestión de suscripción, facturación y suspensión por impago
  (capability billing-subscription).
- Procesos de baja o eliminación de cuenta (fuera de V1).
- Cambio de rol de usuario (no existe mecanismo en V1).

---

## Cross-Capability References
- `e2ee-key-management` — invocada en FL-03 (generación de claves) inmediatamente
  tras el estado REGISTERED, y en FL-05/FL-06 (recuperación y rotación) como
  operaciones disponibles para miembros ACTIVE.
- `billing-subscription` — la transición ACTIVE → SUSPENDED por impago es gestionada
  por esa capability, no por esta.
- `organization-directory` — los campos de contacto público del FRO (email, teléfono,
  dirección) se publican en el directorio gestionado por esa capability.

---

## Open Questions
- Ninguna. Todas las decisiones de este módulo están cerradas en v1.5.