# Proposal — conversational-search

## Capability ID
conversational-search

## Spec type
Lite

## Problem statement
El descubrimiento de stock es la función de mayor uso diario de la plataforma.
Esta capability define cómo los miembros encuentran referencias de rodamientos
en el inventario publicado de otros distribuidores: mediante búsqueda conversacional
con VERA (referencia única y lotes hasta 50 referencias), con filtros refinables,
indicadores de frescura, sistema de favoritos manual, watchers persistentes con
evaluación en tiempo real, y las acciones de fila "Consultar" / "Contactar" /
"Consultar Seleccionados" que conectan con la capability messaging-and-negotiation.

## Scope

### In scope
- Búsqueda de referencia única (FL-SRCH-01): interpretación en lenguaje natural
  por VERA, chips editables, filtros por marca, país, cantidad mínima y lead time.
- Ordenación por defecto: cantidad disponible descendente. Sin reputación calculada.
- Tabla de resultados SRCH-01 con orden fijo de columnas (RNG-SRCH-10).
- Indicadores de frescura por línea (heredados de inventory-management).
- Comportamiento de VERA ante ausencia de resultados: alternativas activas.
- Acción "Consultar" por fila con marcado persistente de línea ya consultada.
- Acción "Contactar" por fila (hilo libre, siempre disponible).
- Checkbox de selección múltiple y botón "Consultar Seleccionados" en SRCH-01.
- Búsqueda por lotes FL-SRCH-02: hasta 50 referencias, ejecución en paralelo,
  panel consolidado SRCH-02, exportación CSV/PDF.
- Watchers FL-SRCH-03: evaluación en tiempo real contra stream stock.updated,
  expiración a 30 días con renovación explícita, límite 50 por organización,
  campos obligatorios part_number y quantity.
- Límite de 5 notificaciones de watchers por usuario y día natural con agrupación.
- Sistema de favoritos: indicador manual por organización, puramente informativo,
  sin efecto en ordenación.
- Aprendizaje de preferencias de búsqueda (países, marcas): solo metadatos de
  comportamiento, nunca datos comerciales cifrados.
- Filtro de visibilidad server-side: el Search Service aplica las reglas de
  exclusión de inventory-management antes de devolver resultados.
- Consultas de mercado agregadas: diferidas a 90 días post-lanzamiento.

### Out of scope
- Publicación o gestión del inventario propio
  (capability inventory-management).
- Apertura y gestión de hilos de mensajería y tarjetas de consulta
  (capability messaging-and-negotiation — boundary en "Consultar" / "Contactar").
- Directorio de Organizaciones como funcionalidad de búsqueda por nombre/país
  (capability organization-directory).
- Ordenación por precio o coste logístico (unit_price cifrado E2EE,
  no indexable; landed cost diferido a V2 — Módulo 05 v2.0).
- Modo TIERED de visibilidad (diferido a V2).

## Source documents
- Módulo 03 — Búsqueda Conversacional v1.6 (documento principal)
- Inventario Maestro de Pantallas v1.1 — SRCH-01, SRCH-02, SRCH-03
- Módulo 04 — Mensajería v1.5, RNG-MSG-06 (un único hilo por par de organizaciones)
- Módulo 00 — Arquitectura IA v1.1 (rol de VERA como copiloto)

## Key design constraints
- El campo unit_price cifrado E2EE no es indexable ni usable como filtro
  o criterio de ordenación (RNG-SRCH-02).
- El campo product_family es informativo, no usado en filtros en V1 (QA-SRCH-01).
- Los favoritos son exclusivamente manuales — ningún algoritmo ni evento
  puede generarlos o modificarlos (RNG-SRCH-08).
- El aprendizaje de preferencias nunca incluye datos comerciales cifrados
  (RNG-SRCH-09).
- "Consultar Seleccionados" agrupa las consultas al mismo distribuidor en su
  único hilo existente — nunca crea un hilo por referencia (RNG-MSG-06).

## Open questions at proposal stage
- GAP-004 (ya registrado): boundary exacto entre esta capability y
  messaging-and-negotiation en el flujo de "Consultar Seleccionados".
  ¿La acción de envío de la tarjeta de consulta pertenece al dominio de
  búsqueda o al de mensajería? No bloqueante — se resolverá al escribir
  ambos specs y se documentará la frontera en Cross-Capability References.