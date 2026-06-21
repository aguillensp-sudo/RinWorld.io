# Proposal — community-forum

## Capability ID
community-forum

## Spec type
Lite

## Problem statement
Los miembros de Bearingworld.io necesitan un espacio de discusión pública entre
ellos sobre temas del sector — equivalencias técnicas, logística, noticias,
sugerencias sobre la plataforma — que no sea una negociación privada. Esta
capability define el Foro de la Comunidad: categorías temáticas fijas, hilos
y respuestas, reacciones simples, identidad de publicación a nivel de organización,
y autorregulación sin moderador humano en V1.

## Scope

### In scope
- Acceso restringido a miembros con cuenta activa (estado ACTIVE): tanto
  lectura como escritura requieren sesión autenticada.
- Cuatro categorías de lanzamiento: General, Referencias técnicas, Logística
  y aduanas, Plataforma y soporte. Gestionables sin despliegue (datos de
  configuración, no valores hardcoded).
- Creación de hilos: título y cuerpo; pertenecen a exactamente una categoría.
- Respuestas a hilos existentes.
- Reacciones simples por usuario (no por organización), puramente informativas,
  sin efecto en ordenación ni en el sistema de Favoritos del Módulo 03.
- Identidad de publicación: siempre la organización, nunca la persona individual.
- Edición y eliminación de las propias publicaciones (único mecanismo de control
  de contenido disponible en V1).
- Límite de frecuencia anti-spam: 10 publicaciones (hilos + respuestas) por
  organización y hora (QA-FORO-02 cerrada).
- Criterio de revisión para añadir moderación: >5% de publicaciones eliminadas
  en 30 días, o 3+ quejas de soporte en el mismo periodo (QA-FORO-03 cerrada).
- Notificaciones: respuesta a hilo propio (in-app + email opcional), reacción
  a publicación propia (solo in-app), actividad en hilos seguidos (configurable).
- VERA en el foro: ayuda a redactar publicaciones (mostrando resultado para
  confirmación), resume hilos largos a petición explícita (el contenido del foro
  es texto plano, no aplica la restricción E2EE del Módulo 04), notifica
  actividad nueva.
- Contenido del foro: texto plano, visible para todos los miembros,
  almacenado y leíble por el servidor — sin garantía de confidencialidad.

### Out of scope
- Moderación activa, herramientas de denuncia o panel de moderación para el
  Operador de Plataforma (fuera de V1 — evaluable según comportamiento real).
- Mensajería privada entre miembros (capability messaging-and-negotiation).
- Cualquier dato comercial sensible (precios, cantidades negociadas, ofertas)
  — el foro es espacio de conversación general, no canal de negociación.
- Creación de categorías por los propios miembros (solo equipo de producto).
- Foro público sin cuenta (acceso exclusivo a miembros ACTIVE).

## Source documents
- Módulo 08 — Foro de la Comunidad v1.1 (documento principal)
- Inventario Maestro de Pantallas v1.1 — FORO-01, FORO-02, FORO-03
- Módulo 00 — Arquitectura IA v1.1, sección capa conversacional
- Módulo 07 v1.1 (suspensión bloquea acceso al foro igual que al resto)

## Key design constraints
- El contenido del foro NO está cifrado E2EE — es texto plano deliberadamente
  público dentro de la comunidad. Debe comunicarse claramente al usuario en la
  propia interfaz.
- La ausencia de moderación es una decisión de producto deliberada para V1,
  no una garantía de ausencia de problemas — el criterio de revisión cuantitativo
  (sección 5.4 del módulo) es el mecanismo de control.

## Open questions at proposal stage
- Ninguna. Todas las decisiones del módulo están cerradas en v1.1.