**BEARINGWORLD.IO**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 03 — BÚSQUEDA CONVERSACIONAL Y DESCUBRIMIENTO**

**Construido sobre Módulo 00 — Arquitectura de Interacción IA v1.1**

Versión 1.6 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento especifica el módulo de Búsqueda Conversacional y Descubrimiento de Bearingworld.io. Es el módulo donde la propuesta de valor de la plataforma se materializa con mayor claridad: sustituir el formulario de búsqueda manual de BearingNet — una referencia, una consulta, un resultado a la vez — por una conversación natural con VERA capaz de procesar consultas individuales, listas completas y condiciones de vigilancia continua.

Este módulo cubre: la búsqueda de una sola referencia, la búsqueda por lotes (múltiples referencias en una sola consulta), el aprendizaje de preferencias del usuario, los watchers (alertas de condición continua) con su expiración gestionada, el sistema de favoritos como único indicador social de un distribuidor, y la presentación de resultados tanto en Zona A (UI visual) como en las respuestas de VERA. Los flujos de contacto (Consultar / Contactar) que se inician desde un resultado de búsqueda se especifican en detalle en el Módulo 04, con el que este módulo se integra estrechamente.

## **1.1 Objetivos funcionales**

* Permitir búsquedas en lenguaje natural de una o varias referencias simultáneamente.
* Aplicar automáticamente las preferencias aprendidas del usuario (región, marcas, reputación mínima) sin que tenga que repetirlas en cada búsqueda.
* Mostrar resultados respetando estrictamente las reglas de visibilidad configuradas por cada distribuidor (Módulo 02), ordenados por cantidad disponible.
* Mostrar el indicador de antigüedad de cada línea de resultado (Módulo 02 v1.2) y, si existe, el indicador de favoritos del distribuidor (sección 4.4).
* Permitir al usuario crear watchers — condiciones de vigilancia continua sobre el mercado que generan alertas cuando se cumplen, con expiración gestionada a los 30 días.
* Ofrecer consultas de mercado agregadas: disponibilidad total, número de distribuidores con stock, tendencias — diferidas hasta que exista histórico suficiente (sección 7).

## **1.2 Fuera de alcance en este módulo**

* El contenido y ciclo de vida de las tarjetas de Consulta y de Oferta, la mensajería E2EE, y la ficha de organización (Módulo 04).
* Cálculo de coste de aterrizaje / logística (Módulo 05).
* Visualización y gestión del propio inventario (Módulo 02).
* Selección o contacto automático hacia "mejores distribuidores" en resultados por lote — eliminado de la plataforma (sección 5.3).

|  |
| --- |
| **ℹ️ DOCUMENTO FUNDACIONAL**  Este módulo se rige por los principios del Módulo 00 — Arquitectura de Interacción IA v1.1. La búsqueda es, con diferencia, el caso de uso donde VERA aporta más valor: lo que en BearingNet son 20 formularios secuenciales, aquí es una frase. Toda esta especificación está escrita con la conversación como vía principal y la UI visual (Zona A) como representación de resultados. |

# **2. Actores del Módulo**

| **Actor** | **Acciones permitidas en este módulo** |
| --- | --- |
| Miembro activo (cualquier rol) | Ejecutar búsquedas, ver resultados según las reglas de visibilidad que le aplican, crear y gestionar sus propios watchers, marcar/desmarcar distribuidores como favoritos, consultar estadísticas de mercado cuando estén disponibles. |
| VERA | Interpretar la consulta en lenguaje natural, aplicar el perfil de preferencias del usuario, ejecutar la búsqueda contra el índice, presentar resultados y gestionar watchers según instrucción del usuario. |
| Sistema (Search Service + Typesense) | Ejecutar la consulta indexada, aplicar el filtro de visibilidad en el servidor antes de devolver resultados (RNG-INV-02 del Módulo 02), evaluar watchers contra eventos de stock.updated, gestionar la expiración de watchers a 30 días, mantener el recuento de favoritos por organización. |

# **3. Modelo de Búsqueda**

## **3.1 Tipos de consulta**

VERA clasifica toda consulta de búsqueda en uno de cuatro tipos. La clasificación determina cómo se procesa la consulta y cómo se presentan los resultados.

| **Tipo** | **Descripción** | **Ejemplo** | **Procesamiento** |
| --- | --- | --- | --- |
| **Referencia única** | El usuario busca una sola referencia, con o sin filtros adicionales. | Busca 6205 2RS FAG en España, mínimo 100 unidades | Una llamada al Search Service. Resultado: lista de líneas que cumplen los criterios, ordenadas por cantidad disponible. |
| **Búsqueda por lote** | El usuario pega o dicta una lista de referencias (típicamente entre 2 y 50) para buscar todas a la vez. | Necesito disponibilidad de varias referencias a la vez | VERA extrae cada referencia de la lista, ejecuta las búsquedas en paralelo, y consolida los resultados en un panel único por referencia. |
| **Consulta de mercado** | El usuario pregunta por información agregada, no por una línea concreta para comprar. | Cuántos distribuidores tienen stock de NSK en Italia ahora mismo | Diferido — ver sección 7. En V1, VERA explica que esta capacidad no está disponible todavía. |
| **Watcher (vigilancia continua)** | El usuario define una condición que debe vigilarse de forma continua, no una búsqueda puntual. | Avísame cuando haya más de 500 unidades de 6205 2RS disponibles en Alemania | VERA no ejecuta una búsqueda inmediata (o la ejecuta solo para confirmar el estado actual) y registra la condición como un watcher persistente — ver sección 6. Si el usuario no menciona una referencia concreta, VERA pregunta por ella antes de crear el watcher (RNG-SRCH-11): la referencia es obligatoria. |

## **3.2 Extracción de entidades de la consulta**

VERA extrae de la consulta en lenguaje natural los siguientes campos estructurados, que se traducen en filtros sobre el esquema canónico definido en el Módulo 02:

| **Entidad extraída** | **Campo del esquema canónico** | **Ejemplo de extracción** |
| --- | --- | --- |
| Referencia / part number | part\_number | Cualquier código de referencia que el usuario mencione se normaliza a mayúsculas sin espacios redundantes. |
| Marca | brand | El nombre de fabricante mencionado se normaliza contra el catálogo de fabricantes conocido. |
| Cantidad mínima | quantity (≥) | Expresiones como "al menos", "más de" o un número seguido de "unidades" se traducen a quantity ≥ N. |
| País / región | location\_country | Países concretos o regiones (Europa se expande a la lista de países UE+EFTA+UK) se traducen a uno o varios location\_country. |
| Plazo de entrega | lead\_time\_days | Expresiones como "entrega inmediata" se traducen a lead\_time\_days = 0; "que pueda llegar en una semana" a lead\_time\_days ≤ 7. |
| Precio (si visible) | unit\_price (cifrado E2EE — ver nota) | Si el usuario pide ordenar por precio y tiene visibilidad de algún precio compartido (por negociación previa, Módulo 04), se usa para ordenar. Ver nota de privacidad en 3.3. |

|  |
| --- |
| **🔒 PRIVACIDAD DEL PRECIO EN BÚSQUEDA**  El campo unit\_price, si el distribuidor lo incluyó en su subida de inventario, está cifrado E2EE (Módulo 02 v1.2). El Search Service NO puede usarlo como criterio de ordenación o filtro en texto plano, porque no puede leerlo. Si un usuario pide ordenar por precio, VERA responde con honestidad: ese dato no está indexado para ordenación porque es información cifrada que solo el usuario y el distribuidor que la compartió pueden ver. En V1, la única alternativa de ordenación disponible es cantidad disponible — la calculadora de landed cost (Módulo 05 v2.0) queda reducida a un campo simple dentro de la tarjeta de oferta del Módulo 04, sin cálculo automático ni integración con el motor de búsqueda. Esta limitación es una consecuencia directa del invariante de privacidad del Módulo 00 — el agente no tiene acceso a datos cifrados. |

## **3.3 product\_family — campo informativo, no usado en filtros (QA-SRCH-01 cerrada)**

El campo product\_family (Módulo 02 v1.2) se muestra en los resultados de búsqueda como información de contexto sobre cada línea, pero no se utiliza en V1 como criterio de filtro ni de búsqueda. Una consulta que mencione una familia de producto sin referencia exacta ("busco rodamientos de rodillos cónicos de cualquier marca") no constituye en V1 un caso de búsqueda soportado — VERA puede responder explicando que, de momento, la búsqueda funciona mejor con una referencia o marca concreta, y que la familia de producto es un dato orientativo que se muestra junto a cada resultado.

# **4. Búsqueda de Referencia Única**

## **4.1 Flujo conversacional FL-SRCH-01**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Busco 6205 2RS FAG, al menos 200 unidades | VERA clasifica: BÚSQUEDA — referencia única. Extrae part\_number, brand y quantity≥200. |
| 2 | VERA | Indicador de progreso "Buscando..." (menos de 1,5s) | POST /api/search con los filtros extraídos + perfil de preferencias del usuario (Capa 2 del Módulo 00) aplicado automáticamente. El Search Service filtra por visibilidad antes de devolver resultados. |
| 3 | VERA | Confirma cuántos distribuidores cumplen los criterios y que muestra los resultados ordenados por cantidad disponible. | Zona A renderiza SRCH-01 (ver sección 4.2) con los resultados. |
| 4 | Usuario | Solo los que tengan entrega inmediata | VERA clasifica: BÚSQUEDA (refinamiento de la consulta anterior — mantiene el contexto de sesión). |
| 5 | VERA | Confirma cuántos de los resultados anteriores cumplen también el nuevo filtro y actualiza la lista. | Refinamiento aplicado sobre el resultado anterior, sin re-ejecutar toda la búsqueda desde cero si es posible. |

## **4.2 Pantalla SRCH-01 — Panel de resultados de búsqueda**

**Descripción**

Renderizado en Zona A cuando VERA ejecuta una búsqueda de referencia única. Es la vista principal de descubrimiento de la plataforma.

**Elementos de la pantalla**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Cabecera de búsqueda | Muestra la consulta interpretada en forma de chips editables (referencia, marca, cantidad mínima, filtros activos). El usuario puede eliminar o modificar un chip directamente desde la UI, lo cual re-ejecuta la búsqueda y VERA confirma el cambio en el chat. |
| Contador de resultados | Número de distribuidores encontrados, actualizado en tiempo real con cada refinamiento. |
| Tabla de resultados | Columnas en este orden fijo (RNG-SRCH-10): Referencia, Marca, Cantidad disponible, Plazo (lead time), Empresa (nombre del distribuidor, enlace a su ficha — Módulo 04), País (con bandera). A continuación, columnas adicionales: Antigüedad del dato (indicador del Módulo 02 v1.3), Favoritos (sección 4.4), Acciones. |
| Ordenación por defecto | Cantidad disponible descendente. V1 no utiliza ningún sistema de reputación calculada para ordenar — el campo de favoritos (sección 4.4) es puramente informativo y no afecta al orden. El usuario puede cambiar la ordenación con los headers de columna o pidiéndoselo a VERA. |
| Indicador de antigüedad por línea | Icono y tooltip según las reglas del Módulo 02 v1.3: sin indicador (menos de 7 días), ámbar (7-30 días, datos posiblemente desactualizados), rojo (más de 30 días, verificar disponibilidad). Nunca oculta ni penaliza el resultado, solo informa. |
| Checkbox de selección múltiple (NUEVO v1.5) | Una casilla por fila. Permite marcar varias líneas de resultados, de uno o varios distribuidores distintos, antes de lanzar una acción en lote (ver fila siguiente). |
| Botón "Consultar Seleccionados" (NUEVO v1.5) | Visible en la parte superior derecha de la tabla, habilitado solo cuando hay al menos una fila marcada con el checkbox anterior. Envía una tarjeta de consulta (Módulo 04, FL-MSG-01) a cada distribuidor de las líneas seleccionadas, sin abrir ningún hilo ni ventana en pantalla — el usuario permanece en SRCH-01. Los hilos correspondientes se crean (o reutilizan, si ya existían) en segundo plano y quedan disponibles después en MSG-01. Si varias líneas seleccionadas pertenecen al mismo distribuidor, todas sus consultas se añaden al mismo hilo único con esa organización (coherente con RNG-MSG-06 del Módulo 04 — un único hilo por par de organizaciones, nunca uno por referencia). |
| Acciones por fila — "Consultar" | Abre la tarjeta de consulta del Módulo 04 (FL-MSG-01): el comprador indica la cantidad que desea consultar (obligatoria) y un comentario opcional. Si la línea ya fue consultada anteriormente por este comprador (marcado persistente, Módulo 04 sección 5.4), el botón aparece deshabilitado con el texto "Ya has consultado esta referencia con este distribuidor", y la fila se muestra visualmente marcada/sombreada de forma permanente. Cumple la misma función que el checkbox + "Consultar Seleccionados" para una sola línea, pero se usa típicamente cuando el comprador ya sabe que quiere más detalle sobre esa referencia concreta. |
| Acciones por fila — "Contactar" | Junto al botón "Consultar". Abre un hilo de conversación libre con el distribuidor (Módulo 04, vía "Contactar"), sin requisitos de cantidad ni referencia — para cualquier comunicación que no sea una consulta de disponibilidad. Es también la vía para abrir un hilo directo con una organización y preguntar por una o varias referencias en lenguaje libre, sin pasar por una tarjeta de consulta estructurada. |
| Botón "Crear watcher con estos criterios" | Disponible siempre. Convierte los filtros actuales de la búsqueda en un watcher persistente (sección 6). Útil cuando la búsqueda actual no tiene resultados suficientes pero el usuario quiere ser avisado cuando aparezcan. |
| Filtros laterales | Panel colapsable con los mismos filtros disponibles por chat: país/región, marca, cantidad mínima, lead time. (No incluye familia de producto ni reputación — ver secciones 3.3 y 4.4.) Cualquier cambio aquí se refleja también en el chat: VERA confirma el filtro aplicado. |

## **4.3 Sin resultados — comportamiento de VERA**

Cuando una búsqueda no devuelve resultados, VERA no se limita a informar de la ausencia — ofrece alternativas activas, alineado con el rol de copiloto experto definido en el Módulo 00.

| **Situación** | **Respuesta de VERA** |
| --- | --- |
| Sin resultados con los filtros actuales, pero existen resultados sin alguno de los filtros | VERA informa que no hay stock con los filtros exactos, pero presenta las alternativas disponibles: misma referencia en otros países con entrega inmediata, o en el país pedido pero con lead time de unos días. Pregunta al usuario si quiere ver alguna de esas opciones. |
| Sin resultados en absoluto para la referencia exacta | VERA indica que no encuentra esa referencia exacta en el índice, sugiere que el formato pueda ser distinto al habitual, y ofrece dos caminos: buscar variantes similares, o crear un watcher para esa referencia exacta por si aparece en el futuro. |

## **4.4 Favoritos — único indicador social de un distribuidor**

Bearingworld.io no calcula ninguna puntuación de reputación algorítmica en V1. El único indicador social visible sobre un distribuidor es el sistema de favoritos: cualquier miembro puede marcar a otra organización como favorita desde su ficha (Módulo 04, MSG-04) o desde un resultado de búsqueda. El indicador que se muestra en SRCH-01 es el recuento total de cuántos miembros distintos han marcado a esa organización como favorita.

| **Aspecto** | **Definición** |
| --- | --- |
| Origen del dato | Exclusivamente manual: un miembro marca a otra organización como favorita o deja de hacerlo. No interviene IA, algoritmo, ni eventos de actividad (número de referencias publicadas, acuerdos alcanzados, volumen, etc.). |
| Cálculo | Recuento simple: número de organizaciones distintas que tienen marcada como favorita a la organización mostrada en la fila. |
| Visualización en SRCH-01 | Columna o icono con el número, ej. "★ 4". Sin tooltip de cálculo complejo — es simplemente "4 miembros la tienen marcada como favorita". |
| Efecto en la ordenación | Ninguno. No es un criterio de ordenación ni de filtro en V1 (sección 4.2). Es información de contexto para que el usuario decida con su propio criterio. |
| Dónde se marca | Desde la ficha de organización (Módulo 04, MSG-04) — acción simple, reversible, sin confirmación adicional más allá de la propia acción del usuario. |

|  |
| --- |
| **📌 ESTE SISTEMA SUSTITUYE AL "MÓDULO 06 — REPUTACIÓN ZKP" DE LA HOJA DE RUTA ORIGINAL**  La hoja de ruta inicial del proyecto reservaba un módulo independiente de Reputación basado en pruebas de conocimiento cero (Zero-Knowledge Proofs / ZK-SNARKs, descrito en el Tech Stack v1.0 con snarkjs y el circuito Groth16), pensado para verificar criptográficamente hechos de una transacción — finalización, tiempo de respuesta, confirmación del comprador — sin revelar precio ni cantidad. Esa pieza queda formalmente descartada y no se desarrolla. El sistema de Favoritos descrito en esta sección es su sustituto completo y definitivo: cubre la única necesidad real identificada (un indicador social mínimo sobre un distribuidor) con una solución deliberadamente simple, manual y sin ningún componente criptográfico ni de IA. El Tech Stack ha sido actualizado a v1.1 para eliminar el Reputation Service y el bloque ZK-SNARK de la arquitectura. |

# **5. Búsqueda por Lotes (Batch Search)**

## **5.1 Descripción**

La búsqueda por lotes es uno de los diferenciadores más directos frente a BearingNet, donde una lista de 20 referencias requiere 20 formularios independientes. En Bearingworld.io, el usuario pega o dicta la lista completa en una sola interacción con VERA.

## **5.2 Flujo conversacional FL-SRCH-02**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Necesito disponibilidad de estas referencias: (lista de 6 códigos) | VERA clasifica: BÚSQUEDA POR LOTES. Extrae cada referencia de la lista (una por línea, separadas por comas o tabulaciones — VERA es tolerante al formato). |
| 2 | VERA | Informa que va a buscar disponibilidad de las referencias, con indicador de progreso por referencia. | Search Service ejecuta las búsquedas en paralelo, cada una con el perfil de preferencias del usuario aplicado. |
| 3 | VERA | Resume cuántas referencias del lote tienen stock con los filtros habituales del usuario y cuáles no. | Zona A renderiza SRCH-02 (sección 5.3) con el panel consolidado. |
| 4 | Usuario | Para la referencia sin resultados, búscala en cualquier país | VERA clasifica: BÚSQUEDA (refinamiento de una línea específica del lote). |
| 5 | VERA | Informa los nuevos resultados encontrados al ampliar el filtro geográfico. | Refinamiento aislado a una fila del panel consolidado. |

## **5.3 Pantalla SRCH-02 — Panel consolidado de búsqueda por lotes**

**Elementos de la pantalla**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Vista de tarjetas por referencia | Cada referencia del lote es una tarjeta colapsable. Cabecera de la tarjeta: part\_number, número de distribuidores encontrados (badge verde si hay resultados, badge gris si no hay resultados), y la mejor cantidad disponible encontrada (mayor cantidad entre los resultados de esa referencia) como dato resumen — sin que esto implique ninguna selección de "mejor distribuidor". |
| Expansión de tarjeta | Al expandir, muestra la misma tabla de resultados que SRCH-01 (sección 4.2) para esa referencia concreta, incluidos los botones "Consultar" y "Contactar" por fila, con el mismo comportamiento de marcado persistente. |
| Resumen global | Cabecera del panel con el recuento: cuántas referencias del lote tienen stock disponible y el número total de distribuidores involucrados (algunos pueden repetirse entre referencias). |
| Botón "Exportar resumen" | Genera un CSV o PDF con el resumen del lote: referencia, número de distribuidores, cantidad máxima disponible, país. Útil para el usuario que necesita pasar esta información a un cliente interno. |
| Botón "Crear watchers para las referencias sin stock" | Acción en lote: convierte automáticamente cada referencia sin resultados en un watcher con los criterios de la búsqueda original. VERA confirma antes de ejecutar (ACCIÓN REVERSIBLE según Módulo 00), indicando cuántos watchers se crearán y con qué criterios. |

|  |
| --- |
| **⚠️ ELIMINADO — CONTACTO AUTOMÁTICO A "MEJORES DISTRIBUIDORES" (QA-SRCH-03 cerrada)**  La v1.0 de este módulo incluía un botón "Contactar a los mejores de cada referencia" que abría automáticamente un hilo con el distribuidor mejor clasificado de cada tarjeta. Este botón se elimina por completo: Bearingworld.io no clasifica distribuidores como "mejores" bajo ningún criterio (ni cantidad, ni antigüedad, ni favoritos — sección 4.4). En V1, el usuario revisa el panel consolidado y decide manualmente, fila por fila, sobre qué referencias y con qué distribuidores quiere usar "Consultar" o "Contactar" (sección 4.2), o bien selecciona varias filas con el checkbox y usa "Consultar Seleccionados" (NUEVO v1.5, sección 4.2) — heredado aquí automáticamente porque la tarjeta expandida reutiliza la misma tabla que SRCH-01. |

## **5.4 Reglas de negocio — búsqueda por lotes**

* RN-SRCH.1: El límite de referencias por consulta de lote es 50. Si el usuario pega una lista mayor, VERA informa cuántas referencias tiene la lista, procesa las primeras 50 y ofrece continuar con el resto en una segunda tanda.
* RN-SRCH.2: Las búsquedas del lote se ejecutan en paralelo en el Search Service, no secuencialmente. El tiempo total no debe ser proporcional al número de referencias.
* RN-SRCH.3: VERA reconoce listas en distintos formatos de entrada: una referencia por línea, separadas por comas, separadas por tabulaciones (pegado desde Excel), o incluso mencionadas dentro de una frase. No requiere un formato estructurado.
* RN-SRCH.4: Si una "referencia" extraída de la lista no parece un part\_number válido, VERA la excluye silenciosamente del lote y, solo si el resultado final tiene discrepancias notables, informa cuántas referencias procesó frente al total de líneas recibidas.

# **6. Watchers — Vigilancia Continua del Mercado**

## **6.1 Descripción y motivación**

Un watcher es una condición sobre el estado del mercado que el usuario define una vez y que el sistema vigila de forma continua, generando una alerta cuando la condición se cumple. Es el mecanismo que convierte la búsqueda de algo puntual en algo persistente — el usuario no tiene que repetir la misma búsqueda cada día por si acaso.

## **6.2 Estructura de un watcher**

| **Campo** | **Descripción** |
| --- | --- |
| Condición | part\_number (NUEVO v1.6 — obligatorio), quantity (umbral mínimo, obligatorio), brand (opcional), location\_country (opcional). Referencia y Cantidad son los dos únicos campos obligatorios para poder crear un watcher (RNG-SRCH-11) — sin al menos esos dos datos, la condición no tiene suficiente especificidad para ser útil. |
| Frecuencia de evaluación | En tiempo real — el watcher se evalúa contra cada evento stock.updated del Kafka topic (Tech Stack v1.0). No es un job programado periódico; la alerta se dispara en el momento en que la condición pasa a ser verdadera. |
| Canal de notificación | In-app (notificación + mensaje de VERA en próximo login) y email. Configurable por el usuario por watcher o globalmente en Ajustes → Notificaciones. |
| Estado | ACTIVE (vigilando) / PAUSED (el usuario lo pausó temporalmente) / TRIGGERED (se cumplió y ya se notificó) / EXPIRED (alcanzó la fecha de expiración sin renovarse — sección 6.4) / PENDIENTE DE RENOVACIÓN (en su 30º día, esperando respuesta del usuario — sección 6.4). |
| Re-disparo | Por defecto, un watcher TRIGGERED no vuelve a notificar aunque la condición siga cumpliéndose (evita saturar al usuario). El usuario puede configurar un watcher como "recurrente" para que vuelva a ACTIVE automáticamente tras notificar. |

## **6.3 Flujo conversacional FL-SRCH-03 — Crear un watcher**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Avísame cuando haya más de 500 unidades de 6205 2RS disponibles en Alemania | VERA clasifica: intención de WATCHER. La expresión "avísame cuando" es el disparador de clasificación, no una búsqueda puntual. La referencia (6205 2RS) y la cantidad (500) están presentes — condición mínima cumplida (RNG-SRCH-11). |
| 1B (caso alternativo) | Usuario | Avísame cuando haya stock disponible en Alemania (sin mencionar referencia) | VERA no puede crear el watcher sin una referencia. Pregunta: "¿Para qué referencia quieres que te avise? La cantidad mínima y el resto de filtros son opcionales, pero necesito al menos eso." No se crea ningún watcher hasta que el usuario responde con una referencia. |
| 2 | VERA | Confirma que va a vigilar el mercado con esos criterios, da contexto del estado actual, indica que el watcher tendrá una vigencia de 30 días con posibilidad de renovación, y pide confirmación. | VERA ejecuta una consulta de estado actual para dar contexto antes de confirmar (ACCIÓN REVERSIBLE — confirmación ligera según Módulo 00). |
| 3 | Usuario | Sí | Watcher creado en estado ACTIVE, con fecha de expiración a 30 días desde su creación. Registrado en el servicio de alertas, suscrito a eventos stock.updated filtrados según la condición. |
| 4 | VERA | Confirma la creación, explica cómo se notificará (in-app y email) y cómo gestionar watchers en el futuro, y menciona que en 30 días se le pedirá confirmar si quiere mantenerlo activo. | — |

## **6.4 Expiración y renovación a los 30 días**

Para evitar la acumulación indefinida de watchers olvidados, todo watcher en estado ACTIVE (o PAUSED) tiene una vigencia de 30 días desde su creación o desde su última renovación.

| **Momento** | **Comportamiento del sistema** |
| --- | --- |
| Día 30 desde creación/renovación, sin haberse disparado (TRIGGERED) | El watcher pasa a PENDIENTE DE RENOVACIÓN. El sistema notifica al usuario (in-app y email): "Tu alerta [descripción en lenguaje natural] lleva 30 días activa. ¿Quieres mantenerla?" con opciones [Mantener activa] / [Dejar que expire]. |
| Respuesta afirmativa ("Mantener activa") | El watcher vuelve a ACTIVE y su contador de 30 días se reinicia desde ese momento. |
| Respuesta negativa, o ausencia de respuesta | El watcher pasa a EXPIRED. Deja de evaluarse contra eventos de stock.updated. Permanece visible en SRCH-03 (sección 6.5) en la sección de expirados, donde el usuario puede reactivarlo manualmente en cualquier momento (lo que equivale a crearlo de nuevo con la misma condición, reiniciando el contador de 30 días). |
| Watchers TRIGGERED | No entran en este ciclo de expiración por los 30 días — un watcher TRIGGERED ya cumplió su función. Si es recurrente y vuelve a ACTIVE tras notificar, su contador de 30 días se reinicia en ese momento, como cualquier otro watcher ACTIVE. |

## **6.5 Pantalla SRCH-03 — Gestión de watchers**

**Descripción**

Accesible desde el menú principal — Alertas — o pidiéndole a VERA que muestre las alertas activas.

| **Elemento** | **Comportamiento** |
| --- | --- |
| Lista de watchers | Tarjetas con: descripción en lenguaje natural de la condición (generada automáticamente a partir de los filtros, no el JSON crudo), estado (badge de color: verde ACTIVE, gris PAUSED, azul TRIGGERED, ámbar PENDIENTE DE RENOVACIÓN, rojo EXPIRED), fecha de creación, fecha de expiración prevista (para ACTIVE y PAUSED), fecha de último chequeo. |
| Acciones por watcher | Pausar/Reactivar, Editar condición (reabre el flujo conversacional con los valores actuales pre-cargados, sin afectar al contador de 30 días salvo que el usuario confirme cambios — en cuyo caso se reinicia), Eliminar (ACCIÓN IRREVERSIBLE — confirmación explícita según Módulo 00). |
| Watchers PENDIENTE DE RENOVACIÓN | Se muestran destacados arriba de la lista, con los botones [Mantener activa] / [Dejar que expire] directamente accesibles (sección 6.4). |
| Watchers TRIGGERED | Se muestran destacados con la información del momento en que se disparó: qué distribuidor cumplió la condición, cuándo, y accesos directos a "Ver resultado" (abre SRCH-01 con esa referencia) y "Consultar"/"Contactar" (Módulo 04). |
| Watchers EXPIRED | Sección separada, colapsada por defecto. Cada uno con un botón "Reactivar" que lo recrea con la misma condición y reinicia el contador de 30 días. |
| Límite de watchers activos | 50 watchers ACTIVE por organización en V1. Si se alcanza el límite, VERA informa al intentar crear uno nuevo y ofrece gestionar los existentes antes de crear el nuevo. |

## **6.6 Notificación de watcher disparado y límite diario**

| **Canal** | **Contenido** |
| --- | --- |
| VERA (próximo login o sesión activa) | Mensaje proactivo dentro del marco de notificaciones definidas — es una notificación de un watcher que el propio usuario configuró explícitamente, no un mensaje no solicitado, por lo que no contradice el Módulo 00. Informa qué condición se cumplió, qué distribuidor la cumplió y con qué cantidad, y ofrece ver el resultado o iniciar "Consultar"/"Contactar" directamente. |
| Email | Asunto: alerta de Bearingworld.io activada para la referencia correspondiente. Contenido: descripción de la condición, distribuidor y cantidad que la cumplió, timestamp, enlace directo a la plataforma. |
| In-app (badge de notificaciones) | Contador en el icono de Alertas. Al hacer clic, abre SRCH-03 con el watcher disparado destacado. |

|  |
| --- |
| **🔔 LÍMITE DE NOTIFICACIONES — 5 POR DÍA Y POR USUARIO (QA-SRCH-04 cerrada)**  Un mismo usuario no recibe más de 5 notificaciones de watchers disparados en un mismo día natural, independientemente de cuántos de sus watchers se disparen ese día. Si se supera el límite, las notificaciones adicionales del día no se envían individualmente; en su lugar, al alcanzar la sexta activación del día, el sistema agrupa el resto en una única notificación de resumen ("Hoy se han disparado N alertas más — revísalas en tu panel de Alertas"). Esto se aplica de forma independiente al comportamiento normal de "TRIGGERED no vuelve a notificar" (sección 6.2): ese mecanismo evita repetir el aviso del mismo watcher; este límite acota cuántos avisos distintos puede recibir el usuario en un día, relevante sobre todo para watchers recurrentes o eventos de mercado que disparan muchos watchers a la vez. |

# **7. Consultas de Mercado Agregadas — Diferidas (QA-SRCH-02 cerrada)**

Las consultas de mercado agregadas (conteos, comparaciones temporales, rankings de actividad) descritas conceptualmente en la sección 3.1 quedan diferidas, como mínimo, a los 90 días posteriores al lanzamiento de la plataforma. La razón es doble: estas consultas requieren un volumen mínimo de actividad para ser útiles, y las comparaciones temporales requieren snapshots históricos del índice que no existen al lanzamiento.

En V1, si un usuario formula una consulta de este tipo (p.ej. "¿cuántos distribuidores tienen stock de NSK en Italia?"), VERA explica que esta capacidad estará disponible más adelante, una vez la plataforma tenga suficiente actividad acumulada, y redirige hacia una búsqueda concreta equivalente si es posible (p.ej. ejecutar la búsqueda de NSK en Italia y mostrar el número de resultados, que es un caso particular simple que el Search Service sí puede responder sin necesitar histórico).

|  |
| --- |
| **💡 DISTINCIÓN — CONTEOS SIMPLES VS. CONSULTAS CON HISTÓRICO**  No todas las "consultas de mercado" requieren histórico. Un conteo simple sobre el estado actual del índice (cuántos distribuidores tienen X ahora) es técnicamente una búsqueda normal con agregación, y el Search Service puede responderla desde el lanzamiento. Lo que se difiere a 90 días son específicamente las consultas que requieren comparación temporal (variación en el tiempo) o rankings de actividad acumulada (más activo "este mes"), que sí dependen de snapshots históricos. VERA puede, por tanto, responder conteos simples desde V1 si la pregunta se formula o reformula en esos términos, aunque la funcionalidad de "consultas de mercado" como categoría propia de la sección 3.1 se presente como diferida. |

# **8. Aprendizaje de Preferencias de Búsqueda**

## **8.1 Relación con el Módulo 00 — Capa 2 (Contexto de perfil)**

Este apartado especifica en detalle, para el dominio de la búsqueda, el funcionamiento de la Capa 2 (Contexto de perfil) definida de forma general en el Módulo 00 sección 5. Las preferencias de búsqueda son el ejemplo más claro y de mayor impacto de esta capa.

## **8.2 Preferencias que el sistema aprende**

| **Preferencia** | **Cómo se detecta** | **Cómo se aplica** |
| --- | --- | --- |
| Regiones preferidas | El sistema registra qué location\_country aparece más frecuentemente en las búsquedas del usuario y en sus contactos efectivos (Módulo 04). Tras un mínimo de 5 búsquedas con un patrón consistente (más del 70% de las búsquedas incluyen el mismo país o región), se considera una preferencia. | Cuando el usuario no especifica país en una nueva búsqueda, VERA aplica automáticamente las regiones preferidas como filtro por defecto, indicando que está buscando en las regiones habituales del usuario y ofreciendo ampliar a todo el mercado si lo desea. |
| Marcas habituales | Frecuencia de la marca en búsquedas y en el propio inventario del usuario. | No se aplica como filtro automático, pero VERA puede priorizar visualmente esas marcas en los resultados si la consulta no especifica marca, indicando que ha ordenado primero las marcas habituales del usuario (siempre dentro de la ordenación principal por cantidad, sección 4.2). |
| Distribuidores favoritos (sección 4.4) | Marcado manual y explícito por el usuario — no es un patrón "aprendido" sino una preferencia declarada. | Cuando un distribuidor marcado como favorito por el usuario aparece en resultados de búsqueda, VERA puede destacarlo de forma puramente informativa (p.ej. "Este es uno de tus distribuidores favoritos"), sin que ello afecte a su posición en la ordenación. |

## **8.3 Transparencia y control — Ajustes → Asistente VERA**

Conforme a la decisión QA-A00-04 del Módulo 00 v1.1 (preferencias visibles y editables), el usuario tiene acceso a un panel donde ve exactamente qué ha aprendido VERA sobre sus hábitos de búsqueda.

| **Elemento del panel** | **Contenido** |
| --- | --- |
| Regiones preferidas detectadas | Lista de países/regiones con un indicador de confianza (alta confianza / detectado recientemente, aún ajustando). Botón para añadir, eliminar o fijar manualmente (evitando que el sistema lo cambie automáticamente). |
| Marcas habituales | Lista de marcas detectadas. El usuario puede marcar cualquiera como "irrelevante" para que VERA deje de priorizarla. |
| Mis favoritos | Lista de organizaciones marcadas como favoritas por el usuario (sección 4.4), con opción de desmarcar directamente desde aquí, además de desde la ficha de organización (Módulo 04). |
| Botón "Reiniciar aprendizaje" | ACCIÓN IRREVERSIBLE (Módulo 00): elimina las preferencias aprendidas (regiones, marcas). No afecta a los favoritos, que son una decisión explícita del usuario, no un aprendizaje del sistema. Requiere confirmación explícita. |

# **9. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-SRCH-01 | Toda búsqueda, sin excepción, pasa por el filtro de visibilidad del servidor (RNG-INV-02 del Módulo 02) antes de devolver resultados. VERA nunca recibe ni puede mostrar una línea de inventario a la que el usuario no tiene acceso por las reglas de visibilidad del distribuidor. | **CRÍTICA** |
| RNG-SRCH-02 | El campo unit\_price cifrado E2EE no puede usarse como criterio de filtro ni de ordenación por el Search Service, porque el servidor no puede leerlo. En V1, la única alternativa de ordenación disponible es cantidad disponible — no existe ordenación por coste logístico en V1 (Módulo 05 v2.0, alcance reducido). | **CRÍTICA** |
| RNG-SRCH-03 | El indicador de antigüedad de cada línea (Módulo 02 v1.2) es siempre informativo. Ninguna línea se oculta, penaliza en el ranking, ni se excluye de resultados por su antigüedad. | **ALTA** |
| RNG-SRCH-04 | La ordenación por defecto de resultados es cantidad disponible descendente. Ningún sistema de reputación calculada ni el contador de favoritos (sección 4.4) afecta a la ordenación en V1. | **ALTA** |
| RNG-SRCH-05 | El campo product\_family se muestra como información de contexto pero no se utiliza como criterio de filtro ni de búsqueda en V1 (sección 3.3). | MEDIA |
| RNG-SRCH-06 | Los watchers se evalúan en tiempo real contra el stream de eventos stock.updated (Kafka) y expiran a los 30 días desde su creación o última renovación si no se confirma su mantenimiento (sección 6.4). | **ALTA** |
| RNG-SRCH-07 | Límite de 50 referencias por búsqueda en lote, 50 watchers ACTIVE por organización, y 5 notificaciones de watchers disparados por usuario y día natural (sección 6.6). Todos configurables a nivel de plataforma (no hardcoded). | MEDIA |
| RNG-SRCH-08 | El sistema de favoritos (sección 4.4) es exclusivamente manual: ningún algoritmo, IA, ni evento de actividad (acuerdos alcanzados, volumen, antigüedad) puede generar, modificar o eliminar una marca de favorito. Solo la acción explícita del usuario. | **CRÍTICA** |
| RNG-SRCH-09 | El aprendizaje de preferencias (Capa 2) nunca incluye datos comerciales cifrados (precios, cantidades negociadas, contenido de mensajes). Solo metadatos de comportamiento de búsqueda: países, marcas, y la lista explícita de favoritos. | **CRÍTICA** |
| RNG-SRCH-10 (NUEVO v1.6) | Toda tabla de resultados de búsqueda, sin excepción (SRCH-01 y el panel expandido de cada referencia en SRCH-02), muestra las columnas en este orden fijo: Referencia, Marca, Cantidad disponible, Plazo, Empresa, País. Las columnas adicionales (Antigüedad del dato, Favoritos, Acciones) se muestran siempre después de estas seis, nunca antes ni intercaladas. | **ALTA** |
| RNG-SRCH-11 (NUEVO v1.6) | Un watcher requiere, como mínimo, los campos Referencia y Cantidad (umbral) para poder crearse. Todos los demás campos de la condición (marca, país, lead time) son opcionales. | **ALTA** |

# **10. Criterios de Aceptación por Flujo**

## **Búsqueda de referencia única (FL-SRCH-01)**

* CA-SRCH-01: Una búsqueda de referencia única con filtros simples devuelve resultados en menos de 1,5 segundos (incluyendo el filtro de visibilidad del servidor), ordenados por cantidad disponible descendente.
* CA-SRCH-02: Un refinamiento sobre una búsqueda previa (en la misma sesión) mantiene el contexto sin que el usuario tenga que repetir los filtros anteriores.
* CA-SRCH-03: Ninguna línea de un distribuidor que ha excluido al usuario (blacklist o whitelist no incluido) aparece en los resultados, verificable contra la herramienta "Simular visibilidad" del Módulo 02.
* CA-SRCH-04: Una búsqueda sin resultados ofrece al menos una alternativa activa (ampliar región, o crear watcher), nunca solo la ausencia de resultados.

## **Acciones de fila — Consultar / Contactar (sección 4.2)**

* CA-SRCH-05: El botón "Consultar" de una línea no marcada como consultada abre la tarjeta de consulta del Módulo 04 (FL-MSG-01).
* CA-SRCH-06: El botón "Consultar" de una línea ya marcada como consultada por el comprador actual aparece deshabilitado, con el texto explicativo correspondiente, y la fila se muestra visualmente diferenciada (marcada/sombreada).
* CA-SRCH-07: El botón "Contactar" de cualquier línea abre un hilo de conversación libre con el distribuidor (Módulo 04), independientemente de si la línea está marcada como consultada o no.

## **Favoritos (sección 4.4)**

* CA-SRCH-08: El indicador de favoritos en SRCH-01 muestra el recuento de organizaciones que tienen marcada como favorita a esa fila, y este valor no influye en la ordenación de resultados.

## **Búsqueda por lotes (FL-SRCH-02)**

* CA-SRCH-09: Una lista de 20 referencias pegada desde Excel (separadas por tabulaciones o saltos de línea) se interpreta correctamente sin que el usuario tenga que reformatearla.
* CA-SRCH-10: El tiempo de respuesta de un lote de 50 referencias no supera los 5 segundos (procesamiento en paralelo, no secuencial).
* CA-SRCH-11: El panel SRCH-02 no contiene ningún botón de contacto automático en lote — cada fila de cada tarjeta expuesta tiene sus propios botones "Consultar"/"Contactar" individuales.

## **Watchers (FL-SRCH-03)**

* CA-SRCH-12: Un watcher creado se evalúa contra el siguiente evento stock.updated relevante en menos de 5 segundos desde que se publica.
* CA-SRCH-13: Un watcher ACTIVE que alcanza 30 días sin dispararse pasa a PENDIENTE DE RENOVACIÓN y genera la notificación correspondiente.
* CA-SRCH-14: Una respuesta afirmativa a la renovación devuelve el watcher a ACTIVE y reinicia su contador de 30 días; una respuesta negativa o la ausencia de respuesta lo pasa a EXPIRED.
* CA-SRCH-15: Un usuario no recibe más de 5 notificaciones de watchers disparados en un mismo día natural; las activaciones adicionales se agrupan en una notificación de resumen.

## **Aprendizaje de preferencias**

* CA-SRCH-16: El panel Ajustes → Asistente VERA muestra al menos las regiones preferidas, marcas habituales y la lista de favoritos, todos editables.
* CA-SRCH-17: "Reiniciar aprendizaje" elimina regiones y marcas aprendidas tras confirmación explícita, sin afectar a la lista de favoritos.

# **11. Preguntas Abiertas y Decisiones Pendientes**

| **ID** | **Pregunta** | **Estado** |
| --- | --- | --- |
| QA-SRCH-01 ✅ | Uso de product\_family en búsquedas. | CERRADA — informativo, no usado en filtros (sección 3.3) |
| QA-SRCH-02 ✅ | Consultas de mercado agregadas con histórico. | CERRADA — diferidas a 90 días post-lanzamiento (sección 7) |
| QA-SRCH-03 ✅ | Criterio de "mejores distribuidores" para contacto en lote. | CERRADA — sin criterio de "mejor"; botón de contacto automático eliminado; selección manual fila a fila en V1 (sección 5.3) |
| QA-SRCH-04 ✅ | Límite de frecuencia de notificaciones de watchers. | CERRADA — 5 por usuario y día natural, con agrupación en resumen a partir de la sexta (sección 6.6) |
| QA-SRCH-05 ✅ | Búsqueda de organizaciones por nombre/país para acceder a su ficha. | CERRADA — nuevo Directorio de Organizaciones (MSG-05), accesible desde el menú principal, con filtros por nombre y país y acceso también vía VERA (Módulo 04 v1.2, sección 8.5) |

# **12. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Cubre búsqueda de referencia única, búsqueda por lotes, watchers, consultas de mercado y aprendizaje de preferencias. |
| 1.1 | Junio 2026 | Equipo de Producto | Revisión completa: (1) Ordenación por defecto cambiada a cantidad disponible descendente; eliminada la reputación calculada como criterio de orden. (2) Nueva sección de Favoritos (4.4) como único indicador social, exclusivamente manual, puramente informativo. (3) product\_family confirmado como campo informativo, no usado en filtros (QA-SRCH-01). (4) Botón "Contactar" dividido en "Consultar" (tarjeta de consulta, Módulo 04, con marcado persistente de línea consultada) y "Contactar" (hilo libre). (5) Consultas de mercado agregadas diferidas a 90 días post-lanzamiento (QA-SRCH-02). (6) Eliminado el botón de contacto automático a "mejores distribuidores" en búsqueda por lote — selección manual fila a fila (QA-SRCH-03). (7) Watchers: expiración y renovación a los 30 días (sección 6.4). (8) Límite de notificaciones de watchers: 5 por usuario y día natural (QA-SRCH-04). (9) Sección 8 actualizada para reflejar favoritos como preferencia explícita, no aprendida. |
| 1.2 | Junio 2026 | Equipo de Producto | Sin cambios de contenido funcional propio. Actualización de referencias cruzadas: (1) QA-SRCH-05 cerrada — el acceso a fichas de organización por nombre/país queda cubierto por el nuevo Directorio de Organizaciones (MSG-05, Módulo 04 v1.2, sección 8.5), accesible desde el menú principal y también desde VERA. (2) Referencias al Módulo 01 actualizadas a v1.3 y al Módulo 04 a v1.2 en la sección de documentos de referencia. |
| 1.3 | Junio 2026 | Equipo de Producto | Sin cambios de contenido funcional propio. Actualización de referencias cruzadas a Módulo 01 v1.4 (que añade dirección y código postal al esquema de organización, visibles en la ficha y en el Directorio del Módulo 04) y a Módulo 04 v1.3. |
| 1.4 | Junio 2026 | Equipo de Producto | Añadida nota de cierre formal en la sección de Favoritos (4.4): el Módulo 06 — Reputación ZKP de la hoja de ruta original queda descartado y sustituido íntegramente por este sistema de Favoritos. Sin cambios funcionales adicionales. Actualizada la referencia al Tech Stack a v1.1 (eliminación del Reputation Service / ZK-SNARK). |
| 1.5 | Junio 2026 | Equipo de Producto | Eliminadas las referencias a "ordenar por landed cost" como alternativa al precio cifrado (sección 3.2 y RNG-SRCH-02), tras la reducción de alcance del Módulo 05 a v2.0: ya no existe cálculo de landed cost ni ordenación por coste logístico en V1. En V1, la única alternativa de ordenación al precio cifrado es cantidad disponible. Actualizada la referencia cruzada al Módulo 04 a v1.4 y al Módulo 05 a v2.0. |
| 1.6 | Junio 2026 | Equipo de Producto | Cierre de comentarios de revisión del Inventario de Pantallas: (1) Nueva regla RNG-SRCH-10 — orden fijo de columnas en toda tabla de resultados (SRCH-01 y panel expandido de SRCH-02): Referencia, Marca, Cantidad, Plazo, Empresa, País, seguidas de Antigüedad, Favoritos y Acciones. (2) Nuevo checkbox de selección múltiple y botón "Consultar Seleccionados" en SRCH-01 (heredado por SRCH-02): permite lanzar consultas a varios distribuidores sin abrir hilos en pantalla, respetando RNG-MSG-06 del Módulo 04 (un único hilo por par de organizaciones). (3) Nueva regla RNG-SRCH-11: el watcher requiere Referencia y Cantidad como mínimo para poder crearse — antes solo Cantidad era obligatoria. Corregidos los ejemplos de FL-SRCH-03 y de clasificación de intención que no mencionaban referencia. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.1 | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.5 | Módulo 02 — Gestión de Inventario v1.3 | Módulo 04 — Mensajería E2EE, Consultas y Negociación v1.4 | Módulo 05 — Calculadora Logística v2.0 |