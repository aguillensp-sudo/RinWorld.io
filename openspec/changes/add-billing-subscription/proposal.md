# Proposal — billing-subscription

## Capability ID
billing-subscription

## Spec type
Lite

## Problem statement
Bearingworld.io no procesa pagos de ningún tipo. Esta capability define el ciclo
de vida de la suscripción anual de cada organización: periodo de prueba de 90 días,
ciclos anuales calculados desde el último pago confirmado, avisos automáticos de
vencimiento, suspensión sin periodo de gracia, reactivación manual por el Operador
de Plataforma y gestión del borrado de organizaciones con suspensión prolongada.

## Scope

### In scope
- Periodo de prueba de 90 días desde aprobación de la organización (Módulo 01),
  sin obligación de pago ni acción requerida.
- Ciclos anuales de 365 días desde la fecha del último pago confirmado por el
  Operador de Plataforma.
- Aviso de vencimiento próximo: 15 días antes, una vez por ciclo — email al
  Administrador de Organización (con datos bancarios, canal exclusivo) y alerta
  en ADMIN-02.
- Suspensión automática sin periodo de gracia al alcanzar la fecha de vencimiento
  sin pago confirmado: bloqueo de acceso, datos conservados íntegros, inventario
  retirado de búsquedas.
- Reactivación inmediata tras confirmación manual del pago por el operador desde
  ADMIN-02: nuevo vencimiento calculado a 365 días desde la fecha del pago.
- Panel ADMIN-02: tabla de estado de cobro de todas las organizaciones, cola de
  próximos vencimientos, formulario "Marcar pago recibido", sección de candidatas
  a borrado (6 meses continuados en SUSPENDED).
- Borrado de datos tras suspensión prolongada: siempre manual, con doble
  confirmación explícita del operador, nunca automático.
- Precio único para todas las organizaciones en V1, sin tiers ni planes
  diferenciados (referencia €700–750/año, Tech Stack v1.1).

### Out of scope
- Cualquier pasarela de pago, integración con Stripe o procesamiento de
  tarjetas/cuentas bancarias de clientes (RNG-BILL-01, principio permanente).
- Pagos entre miembros por transacciones comerciales (RNG-MSG-08, Módulo 04).
- Gestión contable o fiscal interna de Bearingworld.io.
- Planes de pago fraccionado o descuentos automáticos (fuera de V1).

## Source documents
- Módulo 07 — Suscripción y Billing v1.1 (documento principal)
- Inventario Maestro de Pantallas v1.1 — ADMIN-02
- Módulo 01 v1.5, sección 4 (máquina de estados ACTIVE/SUSPENDED)
- PRD v1.1, sección 5 (modelo de monetización)

## Key design constraints
- Los datos bancarios se comunican exclusivamente por email — nunca se muestran
  en ninguna pantalla, banner ni componente de la plataforma (QA-BILL-01 cerrada).
- La suspensión es automática e inmediata al vencimiento — sin excepción ni
  mecanismo de extensión manual (QA-BILL-03 cerrada, RNG-BILL-09).
- El borrado nunca es automático — siempre bajo supervisión y doble confirmación
  manual del Operador de Plataforma (QA-BILL-02 cerrada).

## Open questions at proposal stage
- Ninguna. Todas las decisiones del módulo están cerradas en v1.1.