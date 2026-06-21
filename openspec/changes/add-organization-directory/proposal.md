# Proposal — organization-directory

## Capability ID
organization-directory

## Spec type
Lite

## Problem statement
Los miembros necesitan descubrir qué organizaciones operan en la plataforma
independientemente de si tienen inventario coincidente con una búsqueda concreta.
Esta capability define el Directorio de Organizaciones (MSG-05): una tabla de
todas las organizaciones activas, filtrable por nombre y país, con acceso directo
a la ficha pública de cada organización y a su botón de contacto — el equivalente
funcional a las "páginas amarillas" del sector.

## Scope

### In scope
- Pantalla MSG-05: tabla de todas las organizaciones en estado ACTIVE, accesible
  desde el menú principal al mismo nivel que Búsqueda y Alertas.
- Columnas visibles: Nombre (enlace a MSG-04), País, Teléfono de contacto público,
  Email de contacto público, Favoritos (recuento).
- Filtro por país (ISO 3166-1) y búsqueda por nombre (coincidencia parcial),
  combinables.
- Ordenación por defecto alfabética por nombre; ordenable por cualquier columna.
- Acceso desde VERA: el usuario puede pedir "muéstrame las organizaciones de X país"
  o "busca la ficha de Y empresa".
- Pantalla MSG-04 (ficha pública de organización): nombre, país, dirección,
  código postal, antigüedad en la plataforma, email y teléfono de contacto público,
  indicador de favoritos, botón "Contactar", enlace al inventario publicado.
- Datos de contacto público visibles para todos los miembros sin restricción
  (principio "páginas amarillas abierto").

### Out of scope
- Dirección postal en la tabla MSG-05 (eliminada en v1.5 — no aporta valor
  en formato tabla compacta; sigue visible en MSG-04).
- Reglas de visibilidad o whitelist sobre el directorio (las reglas de visibilidad
  del Módulo 02 aplican solo al inventario, no a los datos de organización).
- Creación o edición de datos de organización desde este módulo
  (capability organization-onboarding).
- Organizaciones en estado SUSPENDED o PENDING no aparecen en el directorio.

## Source documents
- Módulo 04 — Mensajería E2EE v1.5, sección 8.5 (documento principal)
- Inventario Maestro de Pantallas v1.1 — MSG-04, MSG-05
- Módulo 01 v1.5 — campos de contacto público del FRO (RN-01.7)

## Key design constraints
- Los datos de contacto público (email, teléfono) son campos obligatorios
  del FRO (Módulo 01 v1.5, RN-01.7) — todos los miembros ACTIVE los tienen.
- El directorio es de solo lectura desde esta capability; los datos se
  originan y editan en organization-onboarding (Ajustes → Datos de la organización).

## Open questions at proposal stage
- Ninguna. Todas las decisiones están cerradas en v1.5.