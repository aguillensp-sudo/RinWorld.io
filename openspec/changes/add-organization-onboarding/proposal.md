# Proposal — organization-onboarding

## Capability ID
organization-onboarding

## Spec type
Lite

## Problem statement
Bearingworld.io es una red cerrada de distribuidores verificados. Esta capability
define el ciclo de vida completo de una organización desde que solicita acceso hasta
que tiene un miembro activo con claves E2EE generadas y perfil de organización
publicado — incluyendo la aprobación manual del Operador de Plataforma, el registro
unificado de organización y administrador, la invitación de usuarios adicionales y
la revocación de acceso.

## Scope

### In scope
- Dos rutas de entrada al registro: Ruta 00.1 (invitado con token, aprobación
  automática) y Ruta 00.2 (desconocido vía FSR, aprobación manual por operador).
- Formulario de Solicitud de Registro (FSR) y flujo de revisión por el operador
  (FL-00), incluyendo aprobación, rechazo, reversión y timeout de 30 días.
- Formulario de Registro de Organización y Administrador (FRO) unificado con todos
  sus campos obligatorios (incluyendo NIF/CIF, dirección, email y teléfono de
  contacto público).
- Máquina de estados del objeto Member:
  PENDING_REVIEW → INVITED_APPROVED → REGISTERED → KEY_ACTIVE → ACTIVE → SUSPENDED.
- Invitación de usuarios adicionales (FL-04): límite de 5 usuarios por organización,
  token de 7 días, rol Editor asignado automáticamente.
- Revocación de acceso de un usuario: clave privada se mantiene, acceso se elimina.
- Google SSO como método de login alternativo (con passphrase E2EE independiente).
- Emails transaccionales del módulo: EML-07, EML-08, EML-OP-01, EML-OP-02.
- Configuración inicial del perfil de organización: logo, países de operación,
  marcas principales, visibilidad de inventario por defecto.

### Out of scope
- Generación, backup, recuperación y rotación de claves E2EE
  (capability e2ee-key-management — ya cerrada).
- Gestión de suscripción y facturación (capability billing-subscription).
- Procesos de baja o eliminación de cuenta (fuera de V1).
- Cambio de rol de usuario (no existe mecanismo en V1 — RN-01.8).

## Source documents
- Módulo 01 — Onboarding v1.5 (documento principal)
- Inventario Maestro de Pantallas v1.1 — REG-00, REG-01, REG-09, INVT-01, ADMIN-01
- Módulo 04 — Mensajería v1.5, sección 8.5 (campos obligatorios para el Directorio)

## Key design constraints
- La activación de una organización es SIEMPRE un acto humano y manual. No existe
  ningún mecanismo automático que active una cuenta sin intervención del operador
  (principio rector FL-00).
- El rol del primer usuario (Administrador) y de todos los adicionales (Editor) se
  asigna automáticamente — no hay selector de rol en ningún formulario (RN-01.8).
- El NIF/CIF es obligatorio pero no se valida su formato en V1 (varía por país).
- La revocación de un usuario mantiene su clave privada intacta — su historial
  cifrado no se destruye (QA-05 cerrada).

## Open questions at proposal stage
- Ninguna. Todas las decisiones de este módulo están cerradas en v1.5.