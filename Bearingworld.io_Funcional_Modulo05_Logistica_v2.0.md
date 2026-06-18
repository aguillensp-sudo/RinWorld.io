**BEARINGWORLD.IO**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 05 — CALCULADORA LOGÍSTICA Y COSTE DE TRANSPORTE**

**v2.0 — ALCANCE REDUCIDO PARA V1**

Versión 2.0 · Junio 2026 · CONFIDENCIAL

# 1. Propósito y Alcance del Módulo

Este documento es una revisión completa del Módulo 05 (anteriormente "Calculadora Logística y Landed Cost", v1.1). Tras evaluar con detenimiento las versiones anteriores —que contemplaban perfiles logísticos por distribuidor, una calculadora de aranceles aproximada por familia de producto, y un cálculo automático de landed cost integrado en la búsqueda— se ha decidido reducir drásticamente el alcance de V1: el equipo de producto necesita un análisis mucho más amplio antes de construir una funcionalidad de cálculo logístico que sea verdaderamente útil para el sector, y prefiere no lanzar una versión a medias de algo complejo.

En su lugar, V1 incorpora un único elemento, deliberadamente simple: un campo de coste de transporte dentro de la tarjeta de oferta del Módulo 04, que quien hace la oferta puede rellenar manualmente, junto con su divisa. No hay cálculo, no hay tarifas configurables, no hay aranceles, y no hay integración con el motor de búsqueda. Este documento existe para dejar constancia clara de esa decisión, especificar el campo mínimo que sí se construye en V1, y mantener registrado en detalle todo lo que se difiere a V2 para cuando se retome el análisis más amplio.

## 1.1 Objetivo funcional de V1

* Permitir que quien emite una tarjeta de oferta (Módulo 04, sección 6.2) indique, si lo desea, un coste de transporte estimado y la divisa en la que lo expresa.
* Mostrar ese dato al receptor de la oferta como información adicional dentro de la propia tarjeta, sin ningún desglose ni cálculo añadido por la plataforma.

## 1.2 Explícitamente fuera de alcance en V1 — diferido a V2

* Perfiles logísticos configurables por distribuidor (tarifas por destino, modelo FLAT/PER\_UNIT/PER\_KG).
* Calculadora de aranceles aproximada por familia de producto y par de países.
* Cálculo automático de landed cost combinando precio + transporte + arancel.
* Ordenación de resultados de búsqueda (Módulo 03) por coste logístico estimado — en V1 no existe ninguna alternativa de ordenación al precio cifrado más allá de cantidad disponible (Módulo 03 v1.5, RNG-SRCH-02).
* Cualquier capacidad conversacional de VERA relacionada con configuración de tarifas o estimaciones logísticas (las menciones de ejemplo en el Módulo 00 sobre "actualiza mis tarifas de flete" quedan sin desarrollar hasta V2).

|  |
| --- |
| **🔄 CAMBIO DE ALCANCE — DECISIÓN DE PRODUCTO**  Las versiones v1.0 y v1.1 de este módulo (disponibles como referencia histórica) especificaban una calculadora de landed cost completa. Tras revisión, se ha decidido que esa funcionalidad requiere un análisis mucho más amplio —de mercado, de viabilidad de mantenimiento de una tabla de aranceles, y de qué nivel de precisión es realmente útil para un distribuidor del sector— antes de comprometerse a construirla. En lugar de lanzar una versión a medias, V1 se limita a un campo simple de coste de transporte dentro de la oferta, y toda la funcionalidad de cálculo queda diferida a un V2 que se diseñará con ese análisis ya hecho. |

# 2. Especificación del Campo de Coste de Transporte (V1)

## 2.1 Ubicación

El campo no vive en este módulo como pantalla propia — vive dentro de la tarjeta de oferta especificada en el Módulo 04 v1.4, sección 6.2. Este documento referencia esa especificación como fuente de verdad y añade aquí el detalle conceptual y las reglas de negocio asociadas, evitando definirlo dos veces de forma divergente.

## 2.2 Campos exactos (definidos en Módulo 04 v1.4, sección 6.2)

| **Campo** | **Tipo** | **Obligatorio** | **Descripción** |
| --- | --- | --- | --- |
| shipping\_cost | Decimal (2 dec) | No | Coste de transporte estimado, introducido manualmente por quien emite la oferta. Sin cálculo automático ni validación de razonabilidad — el sistema confía en el criterio del oferente. |
| shipping\_cost\_currency | ISO 4217 | No (obligatorio si shipping\_cost tiene valor) | Divisa del coste de transporte. Por defecto, coincide con la divisa de la oferta (currency), pero el campo es editable si el oferente cotizó el transporte en una divisa distinta — por ejemplo, una oferta en EUR con un transporte cotizado por un courier en USD. |

## 2.3 Comportamiento

* Si shipping\_cost no se informa, la tarjeta de oferta no muestra ninguna línea de coste de transporte — nunca se muestra un valor de cero implícito.
* Si shipping\_cost se informa sin cambiar shipping\_cost\_currency, se asume la misma divisa que la oferta.
* El receptor de la oferta ve el coste de transporte como un dato informativo más, igual que lead\_time\_days o notes — no hay ninguna acción específica asociada a este campo (no se puede "aceptar" el coste de transporte por separado del resto de la oferta).
* Al hacer una contraoferta (Módulo 04, FL-MSG-02), el campo de coste de transporte no se hereda automáticamente de la oferta anterior — quien contraoferta puede indicar uno nuevo si lo desea, ya que las condiciones de transporte pueden cambiar entre una propuesta y otra.

# 3. Reglas de Negocio del Módulo (V1)

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-LOG-01 | El coste de transporte (shipping\_cost) es un dato introducido manualmente, sin ningún cálculo, validación de mercado, ni verificación de razonabilidad por parte de la plataforma. | **ALTA** |
| RNG-LOG-02 | El coste de transporte y su divisa están cifrados E2EE dentro de la tarjeta de oferta, con las mismas garantías de privacidad que el resto de sus campos (Módulo 04, RNG-MSG-01). | **CRÍTICA** |
| RNG-LOG-03 | No existe en V1 ninguna funcionalidad de cálculo de landed cost, perfiles logísticos, ni calculadora de aranceles. Cualquier referencia a estas capacidades en documentos anteriores (PRD v1.0, Tech Stack v1.0/v1.1, Módulo 00) debe entenderse como diferida a V2. | **ALTA** |

# 4. Criterios de Aceptación

* CA-LOG-01: Una tarjeta de oferta con shipping\_cost informado muestra el importe y su divisa como línea separada del total de producto (ya validado como CA-MSG-08B en el Módulo 04 v1.4).
* CA-LOG-02: Una tarjeta de oferta sin shipping\_cost informado no muestra ninguna línea de coste de transporte.
* CA-LOG-03: El campo shipping\_cost\_currency, si no se modifica explícitamente, toma por defecto el mismo valor que currency en el momento de crear la oferta.

# 5. Registro Detallado de lo Diferido a V2

Esta sección preserva, a modo de registro para el análisis futuro, el contenido conceptual de las versiones v1.0/v1.1 de este módulo, de forma que el trabajo ya hecho no se pierda cuando se retome el diseño de V2.

| **Elemento diferido** | **Resumen de lo ya diseñado en v1.0/v1.1** |
| --- | --- |
| Perfiles logísticos por distribuidor | Cada organización podía definir uno o varios perfiles de tarifa (nombre, países de destino, modelo de coste FLAT o PER\_UNIT — PER\_KG ya había sido descartado en v1.1 por falta de un campo de peso en el Módulo 02 —, valor, días de tránsito estimados, incoterm de referencia). |
| Validador de solapamiento entre perfiles | Un mismo país de destino no podía estar cubierto por dos perfiles activos del mismo distribuidor a la vez. |
| Calculadora de aranceles aproximada | Tabla de referencia por product\_family y par de países origen/destino, mantenida por el equipo de producto, con valores marcados explícitamente como estimación, nunca como cifra oficial. |
| Cálculo de landed cost completo | Suma de unit\_price × quantity (introducido manualmente por el comprador, nunca leído automáticamente del Módulo 04 por motivos de privacidad E2EE) + coste de transporte del perfil + arancel estimado + seguro opcional. |
| Ordenación de búsqueda por coste logístico | En el Módulo 03, alternativa de ordenación al precio cifrado, calculada solo sobre transporte + arancel (sin componente de producto), con las líneas sin perfil logístico agrupadas al final sin penalización. |
| Preguntas abiertas ya identificadas para retomar | QA-LOG-02 (quién mantiene la tabla de aranceles y con qué frecuencia), QA-LOG-03 (perfil "por defecto" para destinos no cubiertos explícitamente), QA-LOG-04 (si la comparación de destinos merece pantalla propia o solo capacidad conversacional de VERA). |

|  |
| --- |
| **📌 ESTE REGISTRO NO ES UNA ESPECIFICACIÓN VIGENTE**  El contenido de esta sección 5 es histórico y de referencia, no una especificación a implementar. Cuando se retome el análisis de V2, debe revisarse desde cero a la luz de lo que se aprenda observando cómo los distribuidores usan realmente el campo simple de coste de transporte de V1 — es posible que el diseño final de V2 termine siendo distinto de lo que aquí se preserva. |

# 6. Historial de Versiones

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Especificaba perfiles logísticos por distribuidor, cálculo de landed cost a partir de unit\_price introducido manualmente, calculadora de aranceles por product\_family, y ordenación de búsqueda por coste logístico. |
| 1.1 | Junio 2026 | Equipo de Producto | QA-LOG-01 cerrada: modelo PER\_KG diferido a V2 — V1 solo FLAT y PER\_UNIT. Actualizadas referencias cruzadas. |
| 2.0 | Junio 2026 | Equipo de Producto | Reducción completa de alcance para V1: se elimina toda la funcionalidad de cálculo (perfiles logísticos, calculadora de aranceles, landed cost automático, ordenación de búsqueda por coste logístico), diferida íntegramente a V2 a la espera de un análisis más amplio. V1 se limita a un campo simple de coste de transporte (shipping\_cost) y su divisa (shipping\_cost\_currency) dentro de la tarjeta de oferta, especificado realmente en el Módulo 04 v1.4 y referenciado aquí. El contenido de v1.0/v1.1 se preserva en la sección 5 como registro para el futuro análisis de V2. Actualizadas en consecuencia las referencias cruzadas en el Módulo 03 (v1.5) y el Módulo 04 (v1.4), que ya no mencionan landed cost como alternativa de ordenación o cálculo automático. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.1 | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.4 | Módulo 02 — Gestión de Inventario v1.2 | Módulo 03 — Búsqueda Conversacional v1.5 | Módulo 04 — Mensajería E2EE v1.4 (sección 6.2, especificación real del campo) |