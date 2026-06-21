# Organization Directory Specification

## Purpose
Ofrecer a cualquier miembro de Bearingworld.io un listado abierto y filtrable
de todas las organizaciones activas de la plataforma, junto con la ficha
pública de cada una, funcionando como las "páginas amarillas" del sector
— un punto de descubrimiento y contacto directo independiente de tener
o no coincidencia de inventario en una búsqueda concreta.

---

## ADDED Requirements

---

### Requirement: directory-table
El sistema SHALL presentar en MSG-05 una tabla con una fila por cada
organización en estado ACTIVE, mostrando las columnas Nombre (enlace
a su ficha MSG-04), País, Teléfono de contacto público, Email de
contacto público y Favoritos (recuento), accesible desde el menú
principal al mismo nivel que Búsqueda y Alertas.
[Origen: Módulo 04 v1.5, sección 8.5.1]

#### Scenario: carga del directorio sin filtros
- GIVEN un miembro autenticado que accede a MSG-05 desde el menú principal
- WHEN la pantalla carga
- THEN se muestra una fila por cada organización en estado ACTIVE
- AND las columnas visibles son exactamente: Nombre, País, Teléfono de
  contacto público, Email de contacto público, Favoritos
- AND la dirección postal completa no aparece en esta tabla

#### Scenario: organizaciones no ACTIVE excluidas
- GIVEN organizaciones en estado SUSPENDED o PENDING_REVIEW
- WHEN se carga la tabla del directorio
- THEN ninguna de ellas aparece como fila en MSG-05

#### Scenario: navegación a la ficha desde el nombre
- GIVEN un miembro visualizando la tabla del directorio
- WHEN pulsa el nombre de una organización
- THEN se abre la ficha pública de esa organización (MSG-04)

---

### Requirement: directory-filtering
El sistema SHALL permitir filtrar la tabla del directorio por país
(valores ISO 3166-1) y por búsqueda de coincidencia parcial en el
nombre de la organización, de forma combinable entre ambos filtros.
[Origen: Módulo 04 v1.5, sección 8.5.1]

#### Scenario: filtro combinado de país y nombre
- GIVEN un miembro que aplica un filtro de país y, simultáneamente,
  introduce texto en el buscador de nombre
- WHEN ambos filtros están activos
- THEN la tabla muestra únicamente las organizaciones ACTIVE que
  cumplen ambos criterios a la vez

#### Scenario: filtro solo por país
- GIVEN un miembro que selecciona un país sin introducir texto de nombre
- WHEN se aplica el filtro
- THEN la tabla muestra todas las organizaciones ACTIVE con sede en
  ese país, sin restricción adicional

---

### Requirement: directory-sorting
El sistema SHALL ordenar la tabla del directorio alfabéticamente por
nombre de organización por defecto, permitiendo al usuario reordenar
por cualquier columna mediante los headers de la tabla.
[Origen: Módulo 04 v1.5, sección 8.5.1]

#### Scenario: orden alfabético por defecto
- GIVEN el directorio cargado sin que el usuario haya modificado el orden
- WHEN se visualiza la tabla
- THEN las organizaciones aparecen ordenadas alfabéticamente por nombre

#### Scenario: reordenación por columna
- GIVEN un miembro que pulsa el header de la columna Favoritos
- WHEN se aplica el nuevo criterio de orden
- THEN la tabla se reordena por esa columna
- AND el usuario puede volver a pulsar para invertir el sentido del orden

---

### Requirement: directory-access-from-vera
El sistema SHALL permitir acceder al directorio y a fichas concretas
mediante instrucciones en lenguaje natural a VERA, aplicando los filtros
correspondientes sobre MSG-05 y ofreciendo abrir directamente la ficha
cuando una búsqueda por nombre devuelve un resultado único.
[Origen: Módulo 04 v1.5, sección 8.5.1]

#### Scenario: filtro por país vía VERA
- GIVEN un usuario que pide a VERA "muéstrame las organizaciones de Polonia"
- WHEN VERA interpreta la instrucción
- THEN aplica el filtro de país correspondiente sobre MSG-05
- AND presenta la tabla filtrada al usuario

#### Scenario: acceso directo a ficha con resultado único
- GIVEN un usuario que pide a VERA "busca la ficha de Acme Bearings"
- WHEN la búsqueda por nombre devuelve exactamente un resultado
- THEN VERA ofrece abrir directamente la ficha pública (MSG-04)
  de esa organización

---

### Requirement: organization-public-profile
El sistema SHALL presentar en MSG-04 los datos generales de la
organización (nombre, país, dirección, código postal, fecha de
incorporación), sus datos de contacto público, un indicador de
favoritos, y un botón "Contactar" que inicia o reutiliza el hilo
único con esa organización sin requerir cantidad ni referencia.
[Origen: Módulo 04 v1.5, secciones 8.3 y Inventario de Pantallas v1.1,
sección 5.5]

#### Scenario: visualización de ficha completa
- GIVEN un miembro que accede a la ficha pública de una organización
- WHEN la pantalla MSG-04 carga
- THEN muestra nombre, país, dirección completa, código postal y
  fecha de incorporación
- AND muestra email y teléfono de contacto público
- AND muestra el recuento de favoritos de esa organización

#### Scenario: contacto libre desde la ficha
- GIVEN un miembro en la ficha pública de una organización con la
  que no tiene hilo previo
- WHEN pulsa "Contactar"
- THEN se crea un hilo nuevo con esa organización
- AND no se requiere introducir cantidad ni referencia

#### Scenario: reutilización de hilo existente desde la ficha
- GIVEN un miembro en la ficha pública de una organización con la
  que ya existe un hilo
- WHEN pulsa "Contactar"
- THEN el sistema reutiliza el hilo existente en lugar de crear uno nuevo

---

### Requirement: open-public-contact-data
El sistema SHALL mostrar los datos de contacto público (email, teléfono)
de toda organización ACTIVE a cualquier miembro de la plataforma sin
restricciones de visibilidad ni reglas de exclusión, independientemente
de la configuración de visibilidad de inventario de esa organización.
[Origen: Módulo 04 v1.5, sección 8.5; nota "Directorio abierto —
páginas amarillas del sector"]

#### Scenario: contacto público visible pese a inventario restringido
- GIVEN una organización con su inventario configurado en modo
  VISIBILIDAD RESTRINGIDA hacia un miembro concreto
- WHEN ese miembro consulta la ficha pública de la organización
- THEN ve igualmente sus datos de contacto público (email y teléfono)
  sin ninguna restricción
- AND las reglas de exclusión de inventario no afectan en ningún caso
  a los datos de contacto público

---

## Out of Scope
- Dirección postal en la tabla MSG-05 (eliminada en v1.5 — no aporta
  valor en formato tabla compacta; sigue visible en MSG-04).
- Reglas de visibilidad o whitelist sobre el directorio o la ficha
  pública (las reglas de visibilidad de inventory-management aplican
  solo al inventario, nunca a los datos de organización).
- Creación o edición de datos de organización desde este módulo
  (capability organization-onboarding).
- Organizaciones en estado SUSPENDED o PENDING_REVIEW no aparecen
  en el directorio.
- Gestión del hilo, tarjetas y cifrado tras pulsar "Contactar"
  (capability messaging-and-negotiation).

---

## Cross-Capability References
- `organization-onboarding` — los datos de contacto público mostrados
  en MSG-04 y MSG-05 se originan y editan en el FRO de esa capability
  (Ajustes → Datos de la organización).
- `messaging-and-negotiation` — el botón "Contactar" de este módulo
  invoca la creación o reutilización del hilo único gestionado por
  esa capability; esta capability es responsable solo del punto de
  entrada, no del hilo en sí.
- `conversational-search` — el indicador de favoritos mostrado en
  el directorio y en la ficha pública proviene del sistema de
  Favoritos de esa capability.

---

## Open Questions
- Ninguna. Todas las decisiones están cerradas en v1.5.