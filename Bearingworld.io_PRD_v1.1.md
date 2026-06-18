**BEARINGWORLD.IO**

**LA PLATAFORMA**

**PRODUCT REQUIREMENTS DOCUMENT**

**v1.1 — ACTUALIZADO TRAS EL FUNCIONAL COMPLETO**

Versión 1.1 · Junio 2026 · CONFIDENCIAL

# Nota de Revisión v1.1

Este PRD se actualiza tras completar la especificación funcional de los ocho módulos de Bearingworld.io (Módulos 00 a 08) y el Tech Stack v1.1. El v1.0 describía la visión y posicionamiento inicial del producto; varias decisiones tomadas durante el desarrollo del funcional difieren de lo descrito originalmente, especialmente en monetización, reputación, y logística. Este documento incorpora esos cambios mientras conserva la visión estratégica central, que permanece intacta: zero-knowledge architecture como diferenciador irreplicable frente a BearingNet.

|  |
| --- |
| **📋 RESUMEN DE CAMBIOS RESPECTO A v1.0**  Seis cambios sustanciales: (1) el sistema de reputación basado en Zero-Knowledge Proofs queda descartado, sustituido por un sistema de Favoritos simple y manual; (2) la calculadora de logística pasa de un sistema automático de tarifas y landed cost a un campo simple de coste de transporte dentro de cada oferta, con un análisis más amplio diferido a V2; (3) la plataforma no integra ninguna pasarela de pago (ni Stripe ni equivalente) — ni para las suscripciones de los miembros ni, por supuesto, para transacciones entre ellos; el cobro de la suscripción anual se gestiona por transferencia bancaria con confirmación manual del Operador de Plataforma; (4) el periodo de prueba gratuito se fija en 3 meses, no 6; (5) se añade un Foro de la Comunidad como nueva funcionalidad social pública entre miembros; (6) se añade un Directorio de Organizaciones (estilo páginas amarillas) con datos de contacto público de cada miembro. |

# 1. Executive Summary

Este documento define los requisitos de producto para Bearingworld.io, un marketplace global de nueva generación para distribuidores de rodamientos y transmisión de potencia. La plataforma está diseñada para competir directamente con BearingNet — el incumbente actual del mercado — y desplazarlo, abordando sus debilidades estructurales fundamentales: una experiencia de usuario anticuada, un modelo de visibilidad binario, garantías de privacidad nulas para los datos comerciales, ausencia de inteligencia artificial, y un flujo de trabajo que obliga a los usuarios a abandonar la plataforma hacia el email para completar cualquier transacción relevante.

La idea estratégica central es esta: BearingNet funciona hoy como un directorio sofisticado. Los distribuidores lo usan para identificar quién tiene stock, y después abandonan inmediatamente la plataforma para negociar por email. Esto significa que la plataforma captura el paso menos valioso de la cadena de la transacción, y ninguno de su valor comercial. Nuestra plataforma está diseñada para capturar todo el flujo de trabajo — búsqueda, negociación, y gestión de relaciones — sin obligar nunca al usuario a salir.

El diferenciador más potente es una arquitectura de conocimiento cero (zero-knowledge): una plataforma donde ni siquiera los operadores pueden acceder a los datos comerciales (precios, historial de negociación, patrones de compra) intercambiados entre miembros. No es una promesa de política interna. Es una garantía matemática impuesta por el cifrado de extremo a extremo. Ningún competidor — incluido BearingNet — puede replicar esto sobre su infraestructura actual sin una reconstrucción completa.

# 2. Contexto de Mercado

## 2.1 Incumbente actual — BearingNet

BearingNet Limited (constituida en 1995, Much Hadham, Reino Unido) es la plataforma global dominante para distribuidores de rodamientos, con más de 2.000 miembros de pago en más de 80 países, 18,6 millones de líneas de inventario, y aproximadamente 145.000 búsquedas diarias. Según datos públicos y los precios de suscripción conocidos, los ingresos anuales se estiman entre £2,5–2,75 millones, con márgenes netos del 70–80%, lo que refleja una operación ligera con personal mínimo e infraestructura totalmente amortizada.

La plataforma opera con un modelo de suscripción pura (sin comisión por transacción), cobrando aproximadamente entre £1.100–1.400 por miembro al año. Todos los miembros pagan el mismo precio independientemente de su tamaño o nivel de actividad. No existen cuentas de nivel gratuito.

## 2.2 Estructura del mercado

El sector global de distribución de rodamientos se caracteriza por tres rasgos que definen la estrategia de producto:

* Es pequeño y cerrado. A pesar de operar en más de 80 países, la comunidad de distribuidores serios es muy unida. La mayoría de los participantes se conocen desde hace décadas. La confianza es personal, no institucional.
* Es comercialmente reservado. El precio se considera el activo competitivo más sensible. Los distribuidores no compartirán precios en ningún entorno donde un competidor pueda observarlos — independientemente de cualquier promesa de política por parte del operador de la plataforma.
* Está operativamente fragmentado. Cada distribuidor usa un ERP diferente, convenciones de nomenclatura distintas, y arreglos logísticos propios. No existe una capa de datos estándar en todo el sector.

## 2.3 La debilidad central de BearingNet

El fallo fundamental de BearingNet es arquitectónico, no cosmético. La plataforma es un servidor centralizado que ve todos los datos. Los distribuidores lo saben. Como resultado, la plataforma se usa solo para la acción más segura — comprobar quién tiene stock — y toda la actividad comercial migra inmediatamente al email privado. La plataforma nunca ha intentado resolver esto porque hacerlo requeriría reconstruir toda su infraestructura.

Esto crea una brecha permanente y explotable: una plataforma construida sobre arquitectura zero-knowledge desde el primer día puede ofrecer una garantía que BearingNet estructuralmente no puede igualar, nunca.

# 3. Posicionamiento Estratégico

## 3.1 Propuesta de valor central

Por primera vez, una plataforma de distribución de rodamientos donde el operador no sabe nada de lo que los miembros hacen dentro de ella. No porque prometamos no mirar — porque es matemáticamente imposible para nosotros mirar.

## 3.2 Ventajas competitivas

| **Funcionalidad** | **Descripción** | **Ventaja competitiva** |
| --- | --- | --- |
| Arquitectura zero-knowledge | Cifrado de extremo a extremo para todos los datos comerciales. Precios, negociaciones e historial de transacciones se cifran en el dispositivo del miembro antes de la transmisión. El servidor solo almacena texto cifrado. | No puede ser replicado por BearingNet sin una reconstrucción completa de infraestructura y la pérdida de todo su histórico. |
| Búsqueda conversacional con IA | Interfaz en lenguaje natural que sustituye la búsqueda basada en formularios. Los miembros escriben o pegan consultas y reciben resultados filtrados al instante, aprendiendo preferencias personales con el tiempo. | BearingNet no tiene capacidad de IA. Sin evidencia de ninguna inversión planificada. |
| Control de visibilidad granular | Los miembros definen exactamente qué otros miembros pueden ver qué partes de su inventario. Whitelists, blacklists, y acuerdos bilaterales sustituyen el modelo binario actual. | BearingNet no ofrece control de visibilidad. Se es visible para todos o invisible para todos. |
| Ingesta inteligente de stock | Importación de CSV/Excel con IA que mapea automáticamente cualquier estructura de columnas al esquema de la plataforma. Sin plantilla requerida. | BearingNet exige un formato CSV estricto. Cualquier desviación causa fallo de importación. |
| Mensajería instantánea integrada | Mensajería 1 a 1 cifrada de extremo a extremo entre miembros, ancladas contextualmente a referencias y consultas concretas, con tarjetas de consulta y de oferta estructuradas. | BearingNet no tiene mensajería. Toda la negociación ocurre fuera de la plataforma por email. |
| Directorio de Organizaciones (NUEVO v1.1) | Listado público de todos los miembros, filtrable por nombre y país, con datos de contacto directo (teléfono, email) — estilo "páginas amarillas" del sector. | BearingNet sí tiene un listado de miembros equivalente; nuestra versión añade datos de contacto completos y filtros más ricos. |
| Foro de la Comunidad (NUEVO v1.1) | Espacio público de discusión entre miembros, organizado en categorías temáticas, con autorregulación entre la propia comunidad. | BearingNet no tiene ningún espacio de conversación pública entre sus miembros. |
| Precio competitivo | Precio de suscripción único, significativamente por debajo de BearingNet, con más funcionalidad. | Los precios de BearingNet no se han reestructurado en años, a pesar de la ausencia de inversión real en producto. |

# 4. Arquitectura Zero-Knowledge

## 4.1 El problema

En cualquier plataforma centralizada, el operador puede leer todos los datos almacenados en el servidor. Una promesa de política de confidencialidad no es exigible ni verificable. Los distribuidores de rodamientos — que han operado en una cultura de privacidad comercial extrema durante décadas — no confiarán en una promesa de política. Requieren una garantía técnica.

La garantía debe ser: es imposible para la plataforma, sus ingenieros, sus inversores, o cualquier parte con acceso al servidor (incluidas las fuerzas del orden con una orden judicial) leer los datos comerciales intercambiados entre miembros.

## 4.2 La solución — Cifrado de Extremo a Extremo (E2EE)

El cifrado de extremo a extremo garantiza que los datos se cifran en el dispositivo del emisor antes de salir, usando la clave pública del receptor. El servidor actúa solo como repetidor. Almacena y reenvía texto cifrado que no tiene medios criptográficos para leer.

Esta es la misma arquitectura usada por Signal y WhatsApp para sus mensajes. Aplicada a una plataforma comercial, significa:

* Un precio cotizado en la plataforma se cifra en el navegador del comprador antes de la transmisión.
* Lo que llega al servidor son datos matemáticamente aleatorios sin la clave privada del receptor.
* El navegador del receptor lo descifra localmente. Ningún tercero — incluido el operador de la plataforma — tiene jamás acceso al texto en claro.
* Los datos históricos de transacciones almacenados en el servidor son permanentemente ilegibles para cualquiera que no sean las partes originales.

La base criptográfica recomendada es el Protocolo Signal (de código abierto, auditado formalmente, ampliamente desplegado), adaptado para datos comerciales estructurados en lugar de mensajería de texto libre.

## 4.3 Sistema de reputación — Favoritos (REVISADO v1.1)

La v1.0 de este documento proponía un sistema de reputación basado en Pruebas de Conocimiento Cero (Zero-Knowledge Proofs, ZKP), que permitiría verificar criptográficamente que una transacción se completó, en qué plazo, y con confirmación del comprador, sin revelar el precio. Tras el desarrollo del funcional (Módulo 03), esta aproximación queda descartada.

El motivo: la complejidad de implementación (circuitos de prueba ZK-SNARK, tiempos de generación de prueba en dispositivos móviles, mantenimiento de un componente criptográfico dedicado) no se justificaba frente a la necesidad real identificada, que es mucho más simple: un indicador social mínimo sobre la confianza que otros miembros depositan en un distribuidor. La solución adoptada es el sistema de Favoritos: cualquier miembro puede marcar a otra organización como favorita, de forma manual y explícita, y el indicador visible es un simple recuento de cuántos miembros distintos lo han hecho. Sin IA, sin algoritmo, sin componente criptográfico — y sin exponer en ningún momento información comercial.

## 4.4 Alcance de la arquitectura zero-knowledge

| **Tipo de dato** | **Visibilidad para la plataforma** |
| --- | --- |
| Precios negociados | Nunca visibles. E2EE, el servidor solo ve texto cifrado. |
| Mensajes 1 a 1 entre miembros | Nunca visibles. E2EE idéntico a los precios. |
| Cantidades ofrecidas en una negociación concreta | Nunca visibles. Parte del payload de negociación cifrado. |
| Listados públicos de inventario (disponibilidad de stock) | Visibles para los miembros permitidos según las reglas de visibilidad. No visibles para la plataforma como necesidad estructural para la búsqueda. |
| Datos de contacto público de la organización (NUEVO v1.1) | Visibles para todos los miembros sin restricción — el Directorio de Organizaciones es deliberadamente abierto, no cifrado. Es información comercial pública por decisión de la organización, no un dato de negociación. |
| Marcado de favorito (sustituye al ZKP, NUEVO v1.1) | Visible como recuento agregado. Es un dato puramente manual y social, sin relación con ninguna cifra comercial. |

## 4.5 Cómo explicar esto a un distribuidor

El argumento comercial en lenguaje sencillo: los precios que se intercambian en esta plataforma funcionan como un sobre sellado. Se sella en el propio ordenador antes de enviarlo. Nosotros solo transportamos el sobre. Ni nuestros ingenieros, ni un hacker, ni nadie con una orden judicial pueden abrirlo — porque no tenemos la llave. Solo la tiene el destinatario. Si nos hackean mañana o nos adquiere un competidor, el historial de precios sigue siendo invisible. No hay nada que robar porque nunca lo tuvimos.

## 4.6 Limitaciones conocidas

* Compromiso del endpoint: si el dispositivo de un miembro está infectado con malware, los datos pueden capturarse antes del cifrado. Es un problema de seguridad del dispositivo, no de la plataforma — idéntico al riesgo con WhatsApp.
* Confirmación de transacción: para generar datos de favoritos basados en interacción real, los compradores deben confirmar voluntariamente. (NOTA v1.1: ya no aplica al sistema de reputación, que es puramente manual — esta limitación queda como referencia histórica de la versión ZKP descartada.)
* Inferencia de precios en mercados poco profundos: si solo dos distribuidores tienen stock de una referencia rara, la parte que no oferta puede inferir un rango de precio incluso sin ver la cifra exacta. Es un problema de estructura de mercado, no un fallo de la plataforma.

# 5. Especificación de Funcionalidades

## 5.1 Búsqueda conversacional con IA

Sustituye el paradigma de búsqueda basado en formularios por una interfaz conversacional con IA. El miembro escribe o pega una consulta en lenguaje natural — una referencia única, una lista, o un requisito complejo — y recibe resultados filtrados y personalizados al instante.

* Consulta de referencia única: devuelve todo el stock disponible que coincide con esa referencia, filtrado por las preferencias guardadas del miembro, sin necesidad de ninguna entrada adicional.
* Consulta por lotes: el miembro pega una lista de referencias y el sistema las procesa todas en paralelo, devolviendo un panel consolidado de disponibilidad para cada línea.
* Aprendizaje de preferencias: el sistema observa elecciones de filtro recurrentes y las aplica automáticamente sin que se le pida.
* Watchers (alertas de condición continua): el miembro fija una instrucción permanente y el sistema vigila y avisa cuando se cumple la condición.

Diferenciador clave: BearingNet exige completar un formulario manual por cada consulta individual. Una lista de 20 referencias requiere 20 envíos de formulario distintos. La interfaz conversacional reduce esto a una sola interacción.

## 5.2 Control de visibilidad granular

Cada miembro controla exactamente quién puede ver su inventario, a nivel de miembro, categoría, o referencia individual. El valor por defecto es visible para todos, pero cualquier miembro puede modificarlo a cualquier nivel de granularidad.

* Público: visible para todos los miembros de la plataforma (valor por defecto).
* Whitelist: visible solo para miembros explícitamente aprobados.
* Blacklist: visible para todos los miembros excepto los explícitamente bloqueados.
* Bilateral: dos miembros acuerdan mutuamente visibilidad reciproca completa, formalizada con un solo clic.

Diferenciador clave: BearingNet es binario — un miembro lista públicamente o no lista en absoluto. El control granular desbloquea inventario que hoy es invisible para el mercado.

## 5.3 Ingesta inteligente de stock

Los miembros suben su inventario en cualquier formato — CSV, Excel, o cualquier archivo de texto delimitado — sin necesidad de ajustarse a una plantilla de la plataforma. Una capa de mapeo con IA interpreta automáticamente la estructura de columnas del archivo subido y la mapea al esquema de la plataforma.

* Canales de subida: arrastrar y soltar en el navegador, adjunto de email a una dirección dedicada del miembro, y subida programada.
* Mapeo con IA: cuando se detecta una estructura de columnas desconocida, la IA presenta una vista previa del mapeo al miembro antes de importar.
* Indicador de frescura de datos: todas las líneas de inventario muestran una marca de tiempo de última actualización. Los datos antiguos se señalan visualmente, sin penalizar ni retirar el stock — es puramente informativo (Módulo 02 v1.2).

## 5.4 Mensajería instantánea cifrada de extremo a extremo

Mensajería 1 a 1 entre cualquier par de miembros, completamente cifrada de extremo a extremo usando el Protocolo Signal. En la versión final del funcional (Módulo 04), este flujo se estructura en torno a un único hilo de conversación por par de organizaciones, que puede contener tres tipos de elemento: mensajes libres, tarjetas de consulta (cantidad solicitada) y tarjetas de oferta (precio y condiciones).

* Iniciado desde búsqueda: el botón "Consultar" en un resultado abre una tarjeta de consulta pre-cargada con la referencia; el botón "Contactar" abre un hilo libre sin requisitos.
* Historial de mensajes completo almacenado cifrado en el servidor. La plataforma no puede leerlo; el miembro puede buscar y revisar su propio historial en cualquier momento con su clave privada.

Diferenciador clave: BearingNet no tiene ninguna capacidad de mensajería. Toda la negociación comercial ocurre fuera de la plataforma por email. La mensajería cifrada integrada elimina la última razón para abandonar la plataforma durante una transacción.

## 5.5 Coste de transporte en la oferta (REVISADO v1.1)

La v1.0 de este documento proponía una calculadora de logística completa: perfiles de tarifas de flete por distribuidor, una base de datos de pesos de referencia precargada desde catálogos de fabricantes, y un cálculo automático de landed cost (coste de producto + flete) mostrado en cada oferta visible de la plataforma, permitiendo ordenar resultados por coste total en lugar de solo por precio de producto.

Tras el desarrollo del funcional (Módulo 05), se decide reducir drásticamente el alcance para V1: construir una calculadora de logística verdaderamente útil requiere un análisis de mercado más amplio que el equipo de producto prefiere completar antes de comprometerse a una implementación específica. En su lugar, V1 incorpora únicamente un campo simple de coste de transporte (con su divisa) dentro de la tarjeta de oferta del Módulo 04, introducido manualmente por quien hace la oferta, sin ningún cálculo automático asociado. El diseño completo de una calculadora de landed cost queda diferido a una V2, con el trabajo conceptual ya hecho preservado como referencia (Módulo 05 v2.0, sección 5).

## 5.6 Directorio de Organizaciones (NUEVO v1.1)

Listado completo de organizaciones miembro, accesible desde el menú principal de la plataforma, equivalente funcional al listado de miembros que ya existe en BearingNet, pero ampliado. Cada organización aporta, de forma obligatoria desde el registro, un email y un teléfono de contacto público — distintos de las credenciales de acceso del administrador — visibles para todos los miembros sin restricción, junto con su país, dirección y código postal.

Filosofía de producto: Bearingworld.io no obliga a que todo el contacto entre miembros pase por su mensajería cifrada. Si dos organizaciones, tras descubrirse en el directorio o en resultados de búsqueda, prefieren llamarse por teléfono o escribirse a un email comercial directo, la plataforma no lo impide ni lo penaliza.

## 5.7 Foro de la Comunidad (NUEVO v1.1)

Espacio público de discusión entre miembros, organizado en categorías temáticas (general, referencias técnicas, logística y aduanas, plataforma y soporte), accesible desde el menú principal tras iniciar sesión. A diferencia de la mensajería 1 a 1, el contenido del foro no está cifrado — es un espacio social abierto a toda la comunidad de miembros, no privado entre dos partes.

En V1, el foro funciona con autorregulación entre miembros: la identidad de organización visible en cada publicación, y la naturaleza pequeña y de confianza del sector, actúan como el principal mecanismo de control de calidad, sin un moderador humano dedicado por parte del Operador de Plataforma. Se ha fijado un criterio cuantitativo simple para decidir cuándo añadir moderación activa en el futuro, si el comportamiento real de la comunidad lo justifica (Módulo 08 v1.1, sección 5.4).

# 6. Comparativa Competitiva

| **Capacidad** | **BearingNet vs. Nuestra Plataforma** |
| --- | --- |
| Garantía de privacidad de precios | BearingNet: solo promesa de política (el servidor lee todos los datos). Nosotros: garantía matemática (E2EE, el servidor no puede leer). |
| Interfaz de búsqueda | BearingNet: formulario manual, una referencia a la vez. Nosotros: conversacional con IA, consultas por lotes, aprendizaje de preferencias. |
| Control de visibilidad de inventario | BearingNet: binario (público o no listado). Nosotros: granular por miembro, por categoría, acuerdos bilaterales. |
| Frescura de los datos de stock | BearingNet: subida manual de CSV, sin indicador de frescura. Nosotros: subida mapeada con IA, sincronización por email/carpeta, marca de tiempo de frescura. |
| Comunicación dentro de la plataforma | BearingNet: ninguna — toda la negociación por email externo. Nosotros: mensajería 1 a 1 cifrada E2EE, con tarjetas de consulta y oferta contextuales a la referencia. |
| Coste de transporte (REVISADO v1.1) | BearingNet: ninguno — cálculo manual externo. Nosotros: campo simple dentro de la oferta en V1; cálculo automático completo diferido a V2 tras un análisis más amplio. |
| Sistema de reputación (REVISADO v1.1) | BearingNet: ninguno. Nosotros: sistema de Favoritos manual y transparente — sin verificación criptográfica, sin algoritmo, sin exposición de datos comerciales. |
| Directorio de miembros (REVISADO v1.1) | BearingNet: listado básico de miembros. Nosotros: Directorio de Organizaciones con datos de contacto público completos y filtros por nombre/país. |
| Espacio de comunidad (NUEVO v1.1) | BearingNet: ninguno. Nosotros: Foro de la Comunidad con categorías temáticas y autorregulación. |
| Capacidades de IA | BearingNet: ninguna. Nosotros: búsqueda, mapeo de ingesta, aprendizaje de preferencias. |
| Modelo de cobro de suscripción (REVISADO v1.1) | BearingNet: cobro recurrente estándar. Nosotros: precio único, sin pasarela de pago — transferencia bancaria con confirmación manual del operador; ninguna versión de la plataforma procesa pagos, ni entre miembros ni para su propia suscripción. |

# 7. Estrategia de Salida al Mercado

## 7.1 Audiencia objetivo

Todos los miembros actuales de BearingNet (aproximadamente 2.000 distribuidores en más de 80 países) son el objetivo primario. Los objetivos secundarios incluyen distribuidores de rodamientos activos que actualmente no están en BearingNet.

## 7.2 Fases de lanzamiento

| **Fase** | **Descripción** |
| --- | --- |
| Fase 1 — Datos y MVP (meses 1–6) | Construir y validar el MVP con las funcionalidades diferenciadoras centrales: búsqueda con IA, mensajería E2EE, visibilidad granular, e ingesta inteligente de stock. Preparar la base de contactos de miembros de BearingNet. |
| Fase 2 — Lanzamiento suave (meses 4–9) | Contacto con los primeros 200–300 miembros objetivo con una oferta de prueba gratuita de 3 meses (REVISADO v1.1 — antes 6 meses, ahora coherente con el Módulo 07 v1.1). Objetivo: alcanzar densidad de red mínima viable. |
| Fase 3 — Monetización (meses 9+) | Activar el cobro de suscripción al precio objetivo, gestionado por transferencia bancaria con confirmación manual del operador (REVISADO v1.1 — sin pasarela de pago). La garantía de privacidad E2EE y las capacidades de IA son el argumento de conversión principal. |
| Fase 4 — Escala (meses 12+) | Expandir el foco geográfico, añadir capacidad de IA de referencias cruzadas, y desarrollar un nivel de inteligencia de mercado para suscriptores premium. El análisis ampliado de la calculadora de logística (V2) se evalúa en esta fase. |

## 7.3 Estrategia de precios

Precio único para todos los miembros (sin tiers ni planes diferenciados), fijado tras el análisis de coste de IA (Tech Stack v1.1): se recomienda un precio de lanzamiento entre €700–750/año, lo que representa un ahorro de aproximadamente el 40% frente al incumbente, preservando un margen bruto saludable después de IA e infraestructura.

# 8. Modelo de Ingresos y Proyecciones Financieras

| **Escenario** | **Miembros × Precio = Ingreso Anual** |
| --- | --- |
| Conservador (año 1) | 300 miembros × €850 = €255.000 |
| Caso base (año 2) | 700 miembros × €850 = €595.000 |
| Crecimiento (año 3) | 1.200 miembros × €900 = €1.080.000 |
| Maduro (año 4–5) | 2.000 miembros × €950 = €1.900.000 |

Los costes de infraestructura a escala se estiman entre €80.000–120.000 al año (hosting en la nube, CDN, auditoría de seguridad). Con una estructura de equipo ligera, los márgenes netos en madurez se proyectan entre el 65–75%, consistentes con el benchmark de BearingNet. NOTA v1.1: estas proyecciones no incluyen ningún coste de procesamiento de pagos, ya que la plataforma no integra ninguna pasarela — el cobro se gestiona por transferencia bancaria, sin comisión de procesador.

# 9. Riesgos y Mitigaciones

| **Riesgo** | **Descripción** | **Mitigación** |
| --- | --- | --- |
| Dependencia del efecto de red | El valor de la plataforma depende de la densidad de miembros. Por debajo de una masa crítica, los resultados de búsqueda son demasiado escasos para ser útiles. | Periodo de prueba gratuito agresivo (3 meses). Priorizar clústeres geográficos — sembrar una o dos regiones densamente antes de expandir globalmente. |
| Respuesta de precios de BearingNet | El incumbente puede recortar precios agresivamente en respuesta a la entrada competitiva. | El precio no es el diferenciador principal. La arquitectura E2EE no puede igualarse con recortes de precio. Posicionarse en capacidad y confianza, no en precio. |
| Complejidad técnica del E2EE | El cifrado de extremo a extremo añade complejidad de implementación significativa, especialmente la gestión de claves para clientes web. | Usar librerías de código abierto del Protocolo Signal. Revisión criptográfica especializada. Construir sobre implementaciones ya probadas. |
| Inercia de los miembros | Los distribuidores pueden ser reacios a migrar desde una plataforma que han usado durante años. | Onboarding sin friccion: importación CSV compatible con el formato de BearingNet. Herramienta de migración de lista de contactos. Coste de cambio cero durante el periodo de prueba. |
| Legal / protección de datos | El uso de datos de contacto de miembros de BearingNet para difusión debe cumplir con el RGPD y los Términos de Servicio de BearingNet. | Obtener revisión legal de la estrategia de difusión antes del lanzamiento. Muchos contactos de miembros están disponibles de forma independiente en directorios públicos y LinkedIn. |
| Cobro manual sin pasarela (NUEVO v1.1) | El cobro por transferencia bancaria con confirmación manual del operador introduce una dependencia operativa humana — un error o retraso del operador puede causar suspensiones o reactivaciones incorrectas. | Panel dedicado de gestión de cobros (ADMIN-02, Módulo 07 v1.1) con alertas automáticas de vencimiento próximo, para minimizar la dependencia de que el operador recuerde fechas manualmente. |
| Foro sin moderación (NUEVO v1.1) | La ausencia de moderación activa en el Foro de la Comunidad podría permitir abuso o spam no controlado. | Criterio cuantitativo de revisión fijado de antemano (Módulo 08 v1.1, sección 5.4): más del 5% de publicaciones eliminadas en 30 días, o 3+ quejas de soporte en el mismo periodo, obliga a priorizar el diseño de moderación. |

# Apéndice — Perfil Técnico de BearingNet

Compilado de fuentes públicas y análisis de la plataforma, junio 2026. Sin cambios respecto a v1.0.

| **Parámetro** | **Detalle** |
| --- | --- |
| Empresa | BearingNet Limited (Companies House nº 03114053) |
| Constituida | 16 de octubre de 1995 |
| Ubicación | Much Hadham, Hertfordshire, Reino Unido |
| Director | Peter James Annis (fundador, desde 1995) |
| Framework backend | ASP.NET MVC (ecosistema Microsoft .NET) |
| Infraestructura en la nube | Microsoft Azure (rangos IP confirmados en documentación de Webhooks) |
| Analítica | Google Tag Manager (GTM-PFWBRXM) |
| Seguridad | Verificación de firma de webhook HMAC-SHA256 |
| Integraciones | Microsoft Power Automate (conector nativo) |
| Idiomas soportados | 9: inglés, alemán, italiano, español, francés, polaco, portugués, ruso, japonés |
| Miembros | Más de 2.000 miembros de pago, sin nivel gratuito |
| Líneas de inventario | 18,6 millones (15,2M rodamientos, resto retenes/correas/cadenas/piñones) |
| Búsquedas diarias | ~145.000 |
| Ingresos anuales estimados | £2,5–2,75 millones |
| Margen neto estimado | 70–80% |
| Inteligencia artificial | Ninguna detectada |

# Historial de Versiones

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Define la visión y posicionamiento estratégico de la plataforma frente a BearingNet, incluyendo arquitectura zero-knowledge, reputación ZKP, calculadora de logística automática, y modelo de cobro con pasarela de pago. |
| 1.1 | Junio 2026 | Equipo de Producto | Actualización completa tras finalizar la especificación funcional de los Módulos 00–08. Cambios principales: (1) sistema de reputación ZKP descartado y sustituido por Favoritos manual (sección 4.3); (2) calculadora de logística reducida a un campo simple de coste de transporte en V1, análisis completo diferido a V2 (sección 5.5); (3) eliminada toda pasarela de pago — cobro de suscripción por transferencia bancaria con confirmación manual del operador, principio aplicado también a transacciones entre miembros; (4) periodo de prueba gratuito ajustado de 6 a 3 meses; (5) añadido el Directorio de Organizaciones como nueva funcionalidad (sección 5.6); (6) añadido el Foro de la Comunidad como nueva funcionalidad (sección 5.7); (7) comparativa competitiva, riesgos y proyecciones financieras actualizados en consecuencia. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  Tech Stack & AI Cost Estimation v1.1 | ADR-001 — E2EE Key Backup (sin cambios) | Módulos Funcionales 00 a 08 (versiones vigentes según estado de proyecto) |