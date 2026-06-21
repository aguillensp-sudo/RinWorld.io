# Proposal — messaging-and-negotiation

## Capability ID
messaging-and-negotiation

## Spec type
FULL

## Problem statement
Bearingworld.io captura el flujo completo de la transacción comercial — desde la
consulta de disponibilidad hasta el acuerdo de precio — dentro de la plataforma,
sin obligar al usuario a salir al email. Esta capability define el modelo de hilo
único de conversación E2EE entre dos organizaciones, con tres tipos de elemento
(mensaje libre, tarjeta de consulta y tarjeta de oferta), la máquina de estados
del hilo, el marcado persistente de líneas consultadas, y la ficha pública de
organización como punto de entrada neutral al contacto.

## Scope

### In scope
- Modelo de hilo único por par de organizaciones (RNG-MSG-06): una conversación
  contiene mensajes libres, tarjetas de consulta y tarjetas de oferta mezclados
  cronológicamente.
- Tres vías de entrada al contacto: Contactar (hilo libre, sin requisitos),
  Consultar (tarjeta de consulta, cantidad obligatoria), y tarjeta de oferta
  directa desde un hilo existente.
- Cifrado E2EE de todo el contenido: mensajes libres, cantidades de consulta
  y todas las cifras de la tarjeta de oferta — el servidor almacena y reenvía
  ciphertext, nunca texto plano.
- Estructura de la tarjeta de oferta: part_number, brand, unit_price, quantity,
  currency, lead_time_days, shipping_cost, shipping_cost_currency, valid_until, notes.
- Máquina de estados del hilo: ABIERTO, CON CONSULTA PENDIENTE, CON OFERTA
  PENDIENTE, ACUERDO ALCANZADO, CERRADO SIN ACUERDO. Todas las transiciones
  calculadas solo con metadatos, sin descifrar contenido.
- Marcado persistente de líneas consultadas por comprador: se resetea tras
  reemplazo total de inventario del distribuidor.
- Contraoferta: marca la oferta anterior como "superada" sin eliminarla.
- Reversión de ACUERDO ALCANZADO: siempre posible, sin restricciones,
  sin valor contractual (QA-MSG-03 cerrada).
- Ficha pública de organización MSG-04: datos generales, contacto público,
  indicador de favoritos, botón "Contactar", enlace a inventario publicado.
- Directorio de Organizaciones MSG-05: tabla de todas las organizaciones ACTIVE,
  filtrable por nombre y país, accesible desde el menú principal.
- Límite de 25 hilos nuevos por organización y día (QA-MSG-01 cerrada).
- VERA como asistente de redacción y rellenado de formularios sobre contenido
  en claro, antes de cifrar — nunca propone cifras, nunca cifra ni envía sin
  confirmación explícita del usuario.
- Comportamiento de VERA ante contenido cifrado: solo opera sobre metadatos
  (quién, cuándo, tipo de elemento, estado del hilo).

### Out of scope
- Procesamiento de pagos de ningún tipo — ni entre miembros ni de ninguna
  otra naturaleza (RNG-MSG-08, principio permanente de la plataforma).
- Resumen de conversación por IA sobre contenido descifrado (diferido a V2,
  QA-MSG-04 cerrada).
- Traducción de mensajes entre idiomas (eliminada de la plataforma, QA-MSG-05).
- Calculadora de logística / landed cost automático (Módulo 05 diferido a V2).
- Mensajería de grupo o hilos con más de dos organizaciones (fuera de V1).

## Source documents
- Módulo 04 — Mensajería E2EE v1.5 (documento principal)
- Inventario Maestro de Pantallas v1.1 — MSG-01 a MSG-05
- ADR-001 — E2EE Key Backup (claves X25519 usadas para cifrado de mensajes)
- Módulo 03 v1.6, sección 4.2 (boundary con conversational-search)

## Key design constraints
- El servidor nunca descifra contenido — todas las transiciones de estado del
  hilo se calculan exclusivamente con metadatos (RNG-MSG-02).
- VERA no puede leer el contenido de ningún mensaje ni tarjeta cifrada ajena
  a la sesión activa del usuario (RNG-MSG-01).
- El cifrado usa las claves X25519 generadas en e2ee-key-management: sin claves
  activas no hay mensajería posible.
- Coste de transporte: campo simple introducido manualmente, sin cálculo
  automático (reducción de alcance del Módulo 05).

## Open questions at proposal stage
- Ninguna. Todas las decisiones del módulo están cerradas en v1.5.