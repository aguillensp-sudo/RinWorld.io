# Proposal — e2ee-key-management

## Capability ID
e2ee-key-management

## Spec type
FULL

## Problem statement
Bearingworld.io cifra de extremo a extremo todas las negociaciones comerciales entre miembros
(precios, cantidades, condiciones). El fundamento matemático de esa garantía es el par de
claves X25519 de cada miembro. Esta capability define el ciclo de vida completo de esas
claves: generación, custodia local, backup cifrado en plataforma, recuperación en nuevo
dispositivo y rotación de passphrase. Sin este contrato cerrado, ninguna otra capability
que dependa de E2EE (mensajería, negociación) puede escribirse de forma no ambigua.

## Scope

### In scope
- Generación del par de claves X25519 en el navegador del usuario (nunca en servidor).
- Establecimiento y validación de la backup passphrase (política de entropía, unicidad
  respecto a contraseña de login).
- Derivación de la wrapping key con Argon2id y cifrado AES-256-GCM de la clave privada.
- Almacenamiento del blob cifrado en S3/R2 (servidor ciego — sin acceso a la passphrase).
- Almacenamiento de la clave privada en IndexedDB del navegador.
- Registro de la clave pública en servidor.
- Recuperación de clave en nuevo dispositivo mediante backup passphrase.
- Rotación de backup passphrase (re-cifrado de la clave privada con nueva wrapping key).
- Comportamiento ante fallos de red durante la subida del blob (reintentos, estado de error).
- Invariante de privacidad: el servidor nunca recibe la clave privada ni la passphrase
  en ningún flujo, en ninguna circunstancia.

### Out of scope
- Selección del adaptador Signal Protocol (ADR-002, pendiente — GAP-001).
- Backup opcional en iCloud/Google Drive (Opción B del ADR-001 — diferido a V2,
  QA-04 del Módulo 01 cerrada).
- Cifrado de mensajes y tarjetas de oferta/consulta (capability messaging-and-negotiation).
- UI de onboarding que envuelve estos flujos (capability organization-onboarding).
- Revocación de clave al eliminar un usuario de una organización (fuera de V1).

## Source documents
- ADR-001 — E2EE Key Backup Strategy (decisión ACCEPTED, junio 2026)
- Tech Stack & AI Cost Estimation v1.1 — sección E2EE / Zero-Knowledge Core
- Módulo 01 — Onboarding v1.5 — FL-03 (generación), FL-05 (recuperación), FL-06 (rotación)
- Inventario Maestro de Pantallas v1.1 — REG-05, REG-06, REG-07

## Key design constraints
- Toda operación criptográfica ocurre en un Web Worker para no bloquear el hilo principal.
- Argon2id params actuales: m=65536, t=3, p=4 (revisables cada 12 meses — GAP-003).
- La política de entropía mínima de passphrase (zxcvbn score ≥ 3) está recomendada en
  ADR-001 pero no decidida formalmente — anotada como GAP-002, no bloqueante.
- Auditoría criptográfica independiente obligatoria antes del lanzamiento GA
  (Tech Stack v1.1, sección Observability · Security · DevOps).

## Open questions at proposal stage
- GAP-001: ADR-002 pendiente (selección de adaptador Signal Protocol). No bloqueante
  para esta capability — no afecta a requisitos de comportamiento observable.
- GAP-002: ¿zxcvbn score ≥ 3 como mínimo obligatorio o recomendado? Decisión
  pendiente de Product Owner + CTO.
- GAP-003: Parámetros Argon2id sujetos a revisión periódica. El spec debe redactarse
  de forma que no requiera reescritura al actualizar los parámetros.

## Estimated requirements (orientativo, pre-spec)
~12–16 requirements SHALL/MUST distribuidos en cuatro grupos:
generación de claves · backup y almacenamiento · recuperación · rotación de passphrase.
Más ~8–10 escenarios GIVEN/WHEN/THEN cubriendo flujo nominal y casos de error principales.