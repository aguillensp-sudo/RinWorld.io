# Proposal — vera-agent

## Capability ID
vera-agent

## Spec type
Lite

## Problem statement
VERA es la interfaz primaria de Bearingworld.io — un agente conversacional que
conoce todos los sistemas de la plataforma, ejecuta operaciones en nombre del
usuario y mantiene contexto de sesión, pero nunca accede a contenido E2EE cifrado
ajeno ni decide sin confirmación explícita. Esta capability define los principios
de identidad, las tres capas de memoria, el protocolo de confirmación de acciones
y los límites estrictos de lo que VERA puede y no puede hacer.

## Scope

### In scope
- Identidad del agente: nombre VERA, tono profesional y directo, adaptación
  automática al idioma del perfil del usuario (9 idiomas: ES, EN, DE, IT, FR,
  PL, PT, RU, JA).
- Modelo de interacción: jerarquía invertida — VERA como interfaz primaria,
  UI visual como interfaz secundaria. Coexistencia sin exclusión.
- Tres capas de memoria:
  Capa 1 (historial de sesión): contexto de la conversación activa,
  purga automática a 24 horas.
  Capa 2 (preferencias aprendidas): países habituales, marcas frecuentes,
  favoritos — visible y editable por el usuario en Ajustes → Asistente VERA.
  Capa 3 (estado de la plataforma): inventario, mensajes, watchers, suscripción
  — consultado en tiempo real vía herramientas, no memorizado.
- Clasificación de intenciones: CONSULTA, ACCIÓN REVERSIBLE, ACCIÓN IRREVERSIBLE.
- Protocolo de confirmación: confirmación ligera para acciones reversibles,
  confirmación explícita con descripción completa para acciones irreversibles.
- Modo reactivo en V1: VERA solo responde a mensajes iniciados por el usuario.
  Las notificaciones proactivas usan el canal estándar de la plataforma.
- Integración con todas las capabilities: búsqueda, inventario, watchers,
  mensajería (metadatos y redacción en claro), billing (consultas informativas),
  foro (redacción y resumen de contenido no cifrado), onboarding (guía lateral).
- Latencia objetivo: primera respuesta en menos de 1,5 segundos (streaming).
- Acciones del agente registradas en log de auditoría con nota
  "ejecutado vía agente conversacional".
- El agente actúa con los permisos del usuario autenticado, nunca puede
  escalar privilegios.

### Out of scope
- Interfaz de voz (diferida a V2, QA-A00-02 cerrada).
- Modo proactivo iniciado por VERA sin acción del usuario (diferido a V2,
  QA-A00-05 cerrada).
- Acceso a contenido E2EE cifrado de mensajes o tarjetas ajenas a la sesión
  activa del usuario.
- Resumen de conversaciones cifradas (diferido a V2, QA-MSG-04 cerrada).
- Traducción de mensajes entre idiomas (eliminada de la plataforma).
- Propuesta de cifras de precio por iniciativa propia.

## Source documents
- Módulo 00 — Arquitectura de Interacción IA v1.1 (documento principal)
- Tech Stack & AI Cost v1.1 — sección modelo Claude / Anthropic
- Módulo 04 v1.5, sección 9 (límites de VERA en mensajería)
- Módulos 01, 02, 03, 07, 08 — secciones de capa conversacional VERA

## Key design constraints
- Modelo de IA: Claude (Anthropic), Claude Sonnet como modelo principal
  (QA-A00-06 cerrada). Costes a recalcular con precios Anthropic en fase
  de definición técnica.
- Cada operación ejecutable por VERA debe implementarse como herramienta
  invocable (function calling / tool use) — el diseño de estas herramientas
  es el núcleo de la implementación del agente.
- La purga de historial a 24h gestiona el riesgo de saturación del context
  window sin necesidad de summarización explícita en V1.

## Open questions at proposal stage
- Ninguna. Todas las decisiones del módulo están cerradas en v1.1.