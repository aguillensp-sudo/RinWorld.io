**BEARINGNET COMPETITOR**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 02 — GESTIÓN DE INVENTARIO**

Versión 1.3 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento describe con detalle funcional completo el módulo de Gestión de Inventario de la plataforma Bearingworld.io. Cubre la subida de stock en cualquier formato, el procesamiento inteligente por IA, las reglas de visibilidad granular por miembro, el indicador de frescura de datos, y la gestión del ciclo de vida del inventario publicado.

Este módulo es el combustible de la plataforma. Sin inventario publicado no existe utilidad para los compradores. Su diseño impacta directamente sobre la tasa de activación, la densidad de red y la frecuencia de uso diario. La ventaja competitiva frente a Bearingworld.io se materializa aquí en tres ejes: formato libre (sin plantilla rígida), actualización automática (sin intervención manual) y control granular de visibilidad (sin el modelo binario del competidor).

## **1.1 Objetivos funcionales**

* Permitir a cada miembro publicar y mantener actualizado su catálogo de stock en la plataforma.
* Aceptar subidas en cualquier formato de hoja de cálculo o CSV, sin plantilla previa obligatoria.
* Mapear automáticamente con IA las columnas del archivo del miembro al esquema interno de la plataforma.
* Soportar cuatro canales de actualización: subida manual, adjunto por email, carpeta monitorizada y API directa.
* Mostrar indicadores de frescura de datos y marcar visualmente el stock desactualizado.
* Implementar control de visibilidad de inventario: visible para todos los miembros, o visibilidad restringida con exclusión por nombre y/o geografía.
* Gestionar el ciclo de vida del inventario: borrador, publicado, archivado y eliminado.

|  |
| --- |
| **ℹ️ DOCUMENTO FUNDACIONAL**  Este módulo se rige por los principios del Módulo 00 — Arquitectura de Interacción IA v1.1. VERA es la interfaz primaria de la plataforma. Todas las operaciones de inventario especificadas en este documento son accesibles tanto desde la UI visual como desde el chat conversacional con VERA. |

## **1.2 Fuera de alcance en este módulo**

* Búsqueda y consulta de inventario ajeno (Módulo 03).
* Mensajería y negociación sobre líneas de stock (Módulo 04).
* Cálculo de precio de aterrizaje / logistics calculator (Módulo 05).
* Sistema de reputación y confirmación de transacciones (Módulo 06).

# **2. Actores del Módulo**

| **Actor** | **Acciones permitidas en este módulo** |
| --- | --- |
| Miembro activo (cualquier rol) | Subir, editar y eliminar su propio inventario. Configurar reglas de visibilidad. Ver el inventario propio y su estado. |
| Administrador de Organización | Todo lo anterior más: gestionar los perfiles de subida de todos los usuarios de su organización. Ver el inventario agregado de la organización. |
| Sistema (automatización) | Procesar subidas por email y carpeta monitorizada. Ejecutar el mapeo de columnas por IA. Marcar frescura. Enviar notificaciones de stock desactualizado. |
| Operador de Plataforma | Acceso de solo lectura al inventario publicado para resolución de incidencias. No puede modificar inventario de miembros. |

# **3. Modelo de Datos del Inventario**

## **3.1 Esquema canónico de una línea de stock**

Cada línea de inventario en la plataforma se almacena con los siguientes campos. Este es el esquema al que el motor de mapeo IA convierte cualquier formato de entrada.

| **Campo** | **Tipo** | **Oblig.** | **Descripción y reglas de validación** |
| --- | --- | --- | --- |
| part\_number | String (max 100) | Sí | Referencia del fabricante. Normalizada a mayúsculas sin espacios extra. Es la clave principal de búsqueda. |
| brand | String (max 80) | Sí | Fabricante o marca. Se normaliza contra el catálogo interno (SKF, FAG, NSK, NTN, Timken, INA, Koyo, etc.). Si no coincide, se acepta el valor libre y se marca como "marca no catalogada". |
| quantity | Integer ≥ 0 | Sí | Unidades disponibles. 0 es válido (se publica como "disponible bajo consulta"). Valores negativos son rechazados. |
| unit\_price | Decimal (2 dec) | No | Precio unitario en la divisa declarada. El distribuidor puede incluirlo en la subida de inventario o introducirlo directamente durante la negociación — ambas vías coexisten. Si se incluye, queda cifrado E2EE (nunca indexado en texto plano ni visible para el servidor). |
| currency | ISO 4217 (3 chars) | Cond. | Obligatorio si se incluye unit\_price. Ej: EUR, USD, GBP. |
| product\_family | String (max 80) | Sí | Familia de producto a la que pertenece la referencia. Ejemplos: Rodamientos de bolas / Rodamientos de rodillos cónicos / Rodamientos de rodillos cilíndricos / Rodamientos de agujas / Rodamientos oscilantes de bolas / Correas / Cadenas / Retenes / Juntas. Se infiere automáticamente del part\_number y la marca mediante el motor IA si el distribuidor no la incluye en su archivo. Es el campo base para las reglas de visibilidad por categoría (sección 6). Sin este campo, las reglas de visibilidad por familia no pueden aplicarse. |
| location\_country | ISO 3166-1 alpha-2 | Sí | País donde se encuentra físicamente el stock. Ej: ES, DE, US. Crítico para el filtro de búsqueda por proximidad. |
| location\_city | String (max 80) | No | Ciudad o región. Mejora la relevancia de búsqueda geográfica. |
| min\_order\_qty | Integer ≥ 1 | No | Cantidad mínima de pedido. Default: 1. |
| lead\_time\_days | Integer ≥ 0 | No | Plazo de entrega en días hábiles. 0 = disponible para envío inmediato. |
| notes | String (max 500) | No | Notas libres visibles al comprador (ej: "último lote", "packaging original"). No se cifra — es visible a los miembros autorizados. |
| member\_ref | String (max 100) | No | Referencia interna del vendedor. Solo visible para el propio miembro. No indexada en búsqueda pública. |
| uploaded\_at | Timestamp UTC | Auto | Fecha/hora de la última subida del archivo. Generado por el sistema. |
| published\_at | Timestamp UTC | Auto | Fecha/hora en que la línea pasó a estado PUBLISHED. Generado por el sistema. |
| expires\_at | Timestamp UTC | No | Si se define, la línea pasa automáticamente a estado ARCHIVED en esa fecha. |

## **3.2 Estados de una línea de inventario**

| **Estado** | **Descripción** | **Transiciones** |
| --- | --- | --- |
| **DRAFT** | La línea ha sido subida pero no publicada. Solo visible para el propio miembro. | → PUBLISHED (publicación manual o automática tras validación) |
| **PUBLISHED** | La línea es visible para otros miembros según las reglas de visibilidad configuradas. A partir de los 7 días sin nueva subida del distribuidor, se añade un indicador visual de antigüedad — pero la línea permanece PUBLISHED sin cambio de estado formal. | → ARCHIVED (solo por acción manual del miembro o del administrador de la organización) |
| **PUBLISHED (con indicador de antigüedad)** | La línea sigue publicada y visible para los compradores. Cuando la última subida supera los 7 días, se añade un indicador visual de datos posiblemente desactualizados. El stock NUNCA se retira ni archiva automáticamente por antigüedad — esa decisión es exclusivamente del distribuidor. | → ARCHIVED (solo por acción manual del miembro) / → PUBLISHED fresco (al recibir nueva subida) |
| **ARCHIVED** | Retirada del índice de búsqueda. Solo visible para el propio miembro en su historial. | → PUBLISHED (restauración manual) |
| **DELETED** | Eliminada por el miembro. Marcada como borrada en base de datos (soft delete). No recuperable desde la UI. | Estado terminal. Se purga de la base de datos tras 90 días. |

# **4. Canales de Subida de Inventario**

## **4.1 Visión general de los canales**

| **ID Canal** | **Nombre** | **Disponible en** | **Nivel de automatización** |
| --- | --- | --- | --- |
| CAN-01 | Subida manual en browser | Web, Mobile | Manual. El usuario selecciona o arrastra el archivo. |
| CAN-02 | Email con adjunto | Cualquier cliente de email | Automático tras configuración inicial. Sin intervención posterior. |
| CAN-03 — V2 | Carpeta monitorizada | Diferido a V2. En V1 los distribuidores usan CAN-01 (subida manual) y CAN-02 (email automático), que cubren el 95% de los casos de uso del lanzamiento. | — |
| CAN-04 | API directa (REST/Webhook) | ERP, sistemas internos del miembro | Automático. El ERP del miembro empuja los datos directamente. |

## **4.2 CAN-01 — Subida manual en browser**

### **4.2.1 Pantalla INV-01 — Panel de inventario**

**Descripción**

Pantalla principal de gestión de inventario del miembro. Accesible desde el menú principal → "Mi Inventario". Muestra el estado global del inventario publicado y el acceso a todas las funciones del módulo.

**Elementos de la pantalla**

| **Zona** | **Contenido** |
| --- | --- |
| Resumen estadístico (top) | 4 tarjetas: Total líneas publicadas / Líneas desactualizadas (con alerta si >0) / Última actualización (timestamp) / Visitas recibidas al inventario (últimos 30 días). |
| Zona de subida (drag & drop) | Área rectangular con icono y texto: "Arrastra aquí tu archivo de stock o haz clic para seleccionar". Acepta: .csv, .xlsx, .xls, .tsv, .txt (delimitado). Tamaño máximo: 50 MB. Si se supera, mensaje de error con instrucción de comprimir o dividir. |
| Botón "Subir archivo" | Alternativa al drag & drop. Abre el selector de archivos del sistema operativo. |
| Tabla de inventario actual | Lista paginada (50 líneas/página) con columnas: part\_number, brand, quantity, location\_country, estado, uploaded\_at. Ordenable por cualquier columna. Buscador en tiempo real dentro del propio inventario del miembro. |
| Filtros rápidos | Botones de filtro: Todos / Publicados / Desactualizados / Archivados. El filtro Desactualizados incluye un indicador de recuento para llamar la atención. |
| Acciones por línea | Editar (abre modal de edición individual), Archivar, Eliminar. Selección múltiple para acciones en lote. |
| Botón "Configurar visibilidad" | Abre el panel FL-VIS (flujo de configuración de visibilidad, sección 6 de este documento). |
| Botón "Configurar actualización automática" | Abre el panel de configuración de canales CAN-02, CAN-03 y CAN-04. |

### **4.2.2 Pantalla INV-02 — Procesamiento y mapeo de columnas**

**Descripción**

Pantalla que aparece tras seleccionar un archivo para subida. El sistema analiza el archivo y presenta el resultado del mapeo de columnas para confirmación del miembro antes de procesar las líneas.

**Flujo de procesamiento**

1. El archivo es enviado al Ingestion Service vía POST /api/inventory/upload.
2. El servicio extrae las primeras 10 filas como muestra y las envía al AI CSV Mapper.
3. El AI Mapper devuelve una propuesta de mapeo: { columna\_original → campo\_canónico, confianza% }.
4. Se presenta la pantalla INV-02 al usuario con la propuesta de mapeo.
5. El usuario confirma, ajusta o rechaza el mapeo propuesto.
6. Si el mapeo se guarda como "perfil de subida", se aplica automáticamente en futuras subidas del mismo miembro.

**Elementos de la pantalla INV-02**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Tabla de mapeo propuesto | 2 columnas: "Tu columna" (nombre original del archivo) y "Campo en plataforma" (campo canónico propuesto). Cada fila incluye: ejemplo de valor del archivo, confianza del mapeo en % con color (verde >85%, amarillo 60-85%, rojo <60%). Las filas con baja confianza (<60%) se destacan en amarillo para revisión. |
| Selector de campo por fila | Dropdown editable en la columna "Campo en plataforma". Si el usuario no está de acuerdo con la propuesta de IA, puede seleccionar el campo correcto manualmente. |
| Columnas no mapeadas | Si el archivo tiene columnas que el sistema no reconoce ni puede mapear, se muestran en una sección separada "Columnas ignoradas". El usuario puede forzar el mapeo manualmente o confirmar que son irrelevantes. |
| Opción "Guardar como perfil" | Checkbox + campo de nombre. Ej: "Perfil SAP Business One". ACLARACIÓN: un "perfil" es una plantilla reutilizable del mapeo de columnas que el usuario acaba de confirmar (qué columna del archivo corresponde a qué campo canónico). Al guardarlo, la próxima vez que el mismo miembro suba un archivo con una estructura de columnas similar, el sistema aplica automáticamente ese mismo mapeo sin pedir confirmación de nuevo — útil para quien sube su stock de forma recurrente desde el mismo ERP o la misma plantilla de Excel. |
| Vista previa de datos | Tabla con un ejemplo de las primeras 10 líneas del archivo ya transformadas al esquema canónico — nunca el archivo completo, independientemente de cuántas líneas tenga (ver nota siguiente). Permite detectar errores de mapeo antes de procesar el archivo completo. |
| Contador de líneas | "X líneas detectadas en el archivo. Y líneas válidas para importar. Z líneas con errores (ver detalle)." |
| Botón "Confirmar e importar" | Procesa el archivo completo con el mapeo confirmado. Deshabilitado si hay columnas obligatorias sin mapear (part\_number, brand, quantity, location\_country). |
| Botón "Cancelar" | Descarta la subida sin procesar ninguna línea. |

### **4.2.3 Pantalla INV-03 — Resultado de la importación**

**Descripción**

Pantalla de resumen tras completar el procesamiento. Se muestra tanto para subidas manuales como para subidas automáticas (el resultado de las automáticas se notifica también por email y en el panel de notificaciones).

| **Elemento** | **Comportamiento** |
| --- | --- |
| Resumen de importación | Tarjetas: Líneas importadas correctamente (verde) / Líneas actualizadas (azul) / Líneas con errores (rojo, si hay) / Líneas duplicadas ignoradas (gris). Estos recuentos son siempre totales agregados (números), nunca un listado línea por línea de las líneas correctas — con archivos de miles de líneas, mostrar cada una individualmente no es operativo (ver nota siguiente). |
| Muestra de ejemplo (NUEVO v1.3) | Tabla con las primeras 10 líneas importadas correctamente, etiquetada explícitamente como "Ejemplo de 10 líneas de Z importadas" — nunca se intenta renderizar el listado completo en pantalla, independientemente del volumen del archivo (puede haber miles de líneas). Su único propósito es que el miembro confirme visualmente que la importación tiene sentido. |
| Panel de errores | Si hay líneas con error, tabla expandible: fila del archivo original, columna problemática, tipo de error (ej: Cantidad no puede ser negativa, País inválido). El miembro puede descargar el archivo de errores en CSV para corregir y re-subir. |
| Estado del inventario actualizado | Confirmación de que el inventario publicado ha sido actualizado. Timestamp de la actualización. El indicador de desactualización se reinicia para todas las líneas actualizadas. |
| Botón "Ver inventario" | Navega a INV-01 con el filtro "Publicados" activo. |
| Botón "Subir correcciones" | Solo visible si hay errores. Abre directamente el selector de archivo para subir el CSV de correcciones. |

|  |
| --- |
| **💡 POLÍTICA DE ACTUALIZACIÓN — REEMPLAZO TOTAL**  El archivo que sube el distribuidor SE CONSIDERA su stock completo en ese momento. El sistema hace: (1) ACTUALIZAR las líneas ya publicadas que aparecen en el nuevo archivo, (2) INSERTAR las líneas nuevas que no existían, (3) ELIMINAR las líneas que estaban publicadas pero NO aparecen en el nuevo archivo. Esto garantiza que el inventario publicado refleja exactamente lo que el distribuidor quiere publicar, sin acumulación de datos obsoletos. Modo alternativo: el perfil de subida tiene una opción "Modo acumulativo" (no borrar ausentes) para distribuidores que suben actualizaciones parciales. El modo por defecto es REEMPLAZO TOTAL. |

## **4.3 CAN-02 — Subida automática por email**

### **4.3.1 Descripción del canal**

Cada miembro tiene asignada una dirección de email única en la plataforma con el formato: stock+[member\_id]@ingest.bearingworld.io. El miembro configura su sistema o ERP para enviar un email con el archivo de stock adjunto a esa dirección. La plataforma lo procesa automáticamente sin intervención humana.

### **4.3.2 Pantalla INV-04 — Configuración del canal email**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Dirección de email asignada | Mostrada en texto grande y copiable. Botón "Copiar". Formato: stock+[uuid\_corto]@ingest.bearingworld.io. |
| Whitelist de remitentes | Lista de emails autorizados a enviar stock. Por defecto: solo el email del administrador. El miembro puede añadir otros (ej: el email del ERP corporativo, el email del responsable de almacén). Emails no en la whitelist son rechazados silenciosamente y registrados en el log de seguridad. |
| Perfil de mapeo por defecto | Selector del perfil de columnas a aplicar automáticamente. Si el archivo recibido no coincide con ningún perfil guardado, el sistema intenta mapeo automático y notifica al miembro para revisión antes de publicar. |
| Comportamiento ante errores | Radio: (a) Publicar las líneas válidas e ignorar las erróneas, notificando por email / (b) No publicar nada si hay cualquier error, notificar para revisión manual. Default: opción (a). |
| Último procesamiento | Timestamp del último email procesado, número de líneas importadas, estado (OK / Con errores). |
| Botón "Enviar email de prueba" | Genera un email de instrucciones con la dirección de ingestión y un archivo de ejemplo, enviado al email del administrador. |

|  |
| --- |
| **⚠ SEGURIDAD DEL CANAL EMAIL**  La dirección de ingestión es secreta: solo debe conocerla el miembro y sus sistemas autorizados. Si se sospecha que ha sido comprometida (spam, inyección de datos), el miembro puede regenerar una nueva dirección desde este panel. La dirección antigua queda invalidada inmediatamente. POST /api/inventory/email-channel/rotate. |

## **4.4 CAN-03 — Carpeta monitorizada (Desktop Agent)**

### **4.4.1 Descripción del canal**

La plataforma ofrece un agente de escritorio ligero (Electron / Node.js daemon) que monitoriza una carpeta local o de red. Cuando detecta un archivo nuevo o modificado con extensión compatible (.csv, .xlsx, .xls, .tsv), lo sube automáticamente a la plataforma.

### **4.4.2 Pantalla INV-05 — Configuración de carpeta monitorizada**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Estado del agente | Indicador: Activo / Inactivo / No instalado. Si no está instalado, muestra botón de descarga del instalador (Windows / macOS / Linux) con instrucciones de instalación de un paso. |
| Ruta monitorizada | Campo de texto editable con el path de la carpeta. En desktop, botón "Explorar" para seleccionar con el explorador del sistema. Puede ser una ruta de red (UNC path en Windows, mount point en macOS/Linux). |
| Patrón de nombre de archivo | Filtro opcional. Ej: "stock\_\*.csv" para procesar solo archivos que empiecen por "stock\_". Default: cualquier archivo compatible. |
| Frecuencia de chequeo | Radio: En tiempo real (inotify/FSEvents, recomendado) / Cada 5 min / Cada 15 min / Cada hora. En tiempo real es el default si el sistema operativo lo soporta. |
| Perfil de mapeo por defecto | Igual que CAN-02. |
| Comportamiento ante duplicados | Radio: Ignorar si el contenido es idéntico al último archivo procesado (hash MD5 igual) / Procesar siempre. Default: ignorar duplicados. |
| Log de actividad | Tabla con las últimas 20 subidas procesadas: timestamp, nombre de archivo, líneas procesadas, estado. |

## **4.5 CAN-04 — API directa (REST y Webhook)**

### **4.5.1 Descripción del canal**

Para miembros con ERP o sistemas propios, la plataforma expone endpoints REST que permiten actualizar el inventario programáticamente. Este canal es el de mayor fidelidad y menor latencia.

| **Endpoint** | **Método** | **Descripción** |
| --- | --- | --- |
| POST /api/inventory/lines | POST | Crea o actualiza una o más líneas de stock. Acepta JSON array. Máximo 1.000 líneas por petición. Autenticación: Bearer JWT o API Key de miembro. |
| DELETE /api/inventory/lines | DELETE | Elimina líneas específicas por part\_number + brand. Acepta JSON array de identificadores. |
| GET /api/inventory/lines | GET | Devuelve el inventario propio del miembro autenticado. Parámetros: page, limit, status, updated\_since. |
| POST /api/inventory/sync | POST | Sincronización completa: reemplaza todo el inventario del miembro con el payload recibido. Líneas no presentes en el payload quedan ARCHIVED. Límite: 50.000 líneas por llamada. |
| POST /api/inventory/webhook/test | POST | Permite al miembro enviar un payload de prueba y ver el resultado del procesamiento sin modificar el inventario publicado. |

**Gestión de API Keys**

Las API Keys se generan y revocan desde INV-06 (panel de API). Cada key tiene: nombre descriptivo, permisos (read / write / sync), fecha de creación, último uso y opción de revocación inmediata. Límite: 5 keys activas por organización. Las keys se muestran solo en el momento de creación; no son recuperables después (el miembro debe revocar y crear una nueva si la pierde).

# **5. Motor de Mapeo IA de Columnas**

## **5.1 Descripción general**

El AI CSV Mapper es el componente que permite a cualquier miembro subir su inventario en su propio formato, sin necesidad de adaptarse a una plantilla. Es uno de los diferenciadores clave frente a Bearingworld.io, que requiere un formato CSV específico y rechaza cualquier desviación.

## **5.2 Funcionamiento del mapeo**

| **Paso** | **Descripción técnica** | **Resultado visible al usuario** |
| --- | --- | --- |
| 1. Extracción de muestra | El Ingestion Service extrae la cabecera del archivo más las primeras 10 filas de datos como muestra representativa. | — |
| 2. Llamada al AI Mapper | Se envía al modelo (GPT-4o) un prompt con: (a) el esquema canónico de la plataforma con descripciones de cada campo, (b) la muestra del archivo, (c) ejemplos de mapeos anteriores exitosos del mismo miembro (si existen). Se solicita un JSON de mapeo con confianza por campo. | — |
| 3. Respuesta del modelo | El modelo devuelve: { "part\_number": {"from": "Ref\_prod", "confidence": 0.97}, "quantity": {"from": "Uds\_disp", "confidence": 0.91}, ... } | — |
| 4. Presentación para confirmación | Se muestra la pantalla INV-02 con el mapeo propuesto, campos de baja confianza destacados y vista previa de datos transformados. | Tabla de mapeo con indicadores de confianza. |
| 5. Aprendizaje del perfil | Una vez confirmado el mapeo (con o sin correcciones manuales), se guarda como perfil de subida del miembro. Las correcciones manuales se incluyen como "ejemplos negativos" en el prompt de futuras llamadas al mismo miembro. | El miembro ve "Perfil guardado: [nombre]". |

## **5.3 Campos de difícil mapeo automático — reglas específicas**

| **Campo canónico** | **Problema frecuente** | **Regla de resolución** |
| --- | --- | --- |
| product\_family | El distribuidor puede no incluir este campo en su archivo. El nombre puede venir como "Deep groove ball bearings", "Rodamientos bolas", "6000 series", o simplemente no existir. | El motor IA infiere la familia a partir del part\_number y la marca consultando el catálogo interno de fabricantes. Si la inferencia es inequívoca (ej: part\_number 6205 → Rodamientos de bolas radiales), se aplica automáticamente sin pedir confirmación. Si es ambigua, se propone al usuario con la justificación. |
| currency | Puede estar en la misma columna que el precio ("100 EUR"), en columna separada, o ausente. | Si está en la misma columna que el precio, el mapper separa el valor numérico de la divisa. Si no está y hay precio, se asume la divisa de la sede del miembro (registrada en el perfil de organización) con aviso. |
| location\_country | Puede estar como nombre completo ("Germany", "Alemania"), ISO 2 ("DE"), ISO 3 ("DEU"), o ausente. | Normalización a ISO 3166-1 alpha-2 con diccionario multilingüe. Si está ausente, se usa el país de sede del miembro con aviso visible en la vista previa. |
| brand | Variaciones de nombre: "F.A.G.", "FAG Bearings", "fag", "Schaeffler FAG"... | Normalización contra catálogo de fabricantes conocidos (insensible a mayúsculas, puntos y variantes comunes). Si no coincide, se acepta el valor libre y se guarda en el catálogo como "alias no confirmado" para revisión futura. |

## **5.4 Comportamiento ante archivos problemáticos**

| **Situación** | **Comportamiento del sistema** |
| --- | --- |
| Archivo sin cabecera (solo datos) | El mapper intenta inferir los campos por el contenido. Si la confianza global es <50%, solicita al usuario que confirme la primera fila como cabecera o que identifique los campos manualmente. |
| Archivo con múltiples hojas (Excel) | Se muestra un selector de hoja antes del mapeo. Por defecto se propone la primera hoja no vacía. |
| Archivo con filas en blanco o separadores | Las filas completamente vacías se ignoran. Las filas con solo separadores (líneas de grupo, totales) son detectadas y excluidas automáticamente. |
| Archivo con más de 100.000 líneas | Se procesa en chunks de 10.000 líneas. La UI muestra una barra de progreso. Si el procesamiento supera 5 minutos, se convierte en tarea asíncrona con notificación por email al completar. |
| Encoding no UTF-8 | El sistema detecta automáticamente el encoding (UTF-8, Latin-1, Windows-1252, etc.) y convierte a UTF-8 antes del procesamiento. |
| Archivo corrupto o ilegible | Se muestra un mensaje de error específico y se invita a exportar de nuevo desde el sistema origen. |

# **6. Sistema de Visibilidad de Inventario**

## **6.1 Descripción del sistema (REVISADO v1.3)**

El sistema de visibilidad es uno de los diferenciadores fundamentales frente a BearingNet, que solo ofrece un modelo binario (visible para todos / no visible). Tras revisión, se simplifica el modelo de V1 a dos modos claros, aplicados siempre al inventario completo de la organización — sin granularidad por categoría ni por referencia individual, que se considera innecesaria para el caso de uso real y añade complejidad de configuración sin un beneficio claro.

|  |
| --- |
| **🔄 CAMBIO DE MODELO (v1.3) — DE 5 MODOS A 2, SIN GRANULARIDAD POR CATEGORÍA**  Las versiones anteriores de este módulo especificaban cinco modos de visibilidad (Público, Whitelist, Blacklist, Bilateral, Tiered) aplicables a tres niveles de granularidad (organización, categoría, referencia individual), con un flujo completo de acuerdos bilaterales (FL-BIL). Tras revisión de producto, se simplifica radicalmente: solo dos modos, aplicados siempre a todo el inventario de la organización de una vez. Whitelist desaparece como modo independiente (su caso de uso queda cubierto por el nuevo modo de Visibilidad Restringida, ver 6.2). Bilateral se descarta por completo — no se consideró suficientemente necesario ni bien definido para justificar su complejidad. Tiered se mantiene diferido a V2, sin cambios respecto a la decisión anterior. |

## **6.2 Modos de visibilidad (V1)**

| **Modo** | **Descripción** | **Caso de uso típico** |
| --- | --- | --- |
| **VISIBLE PARA TODOS LOS MIEMBROS** | Visible para todos los miembros activos de la plataforma. Es el modo por defecto al publicar inventario. | Stock genérico de alta rotación que el miembro quiere que encuentre cualquier comprador. |
| **VISIBILIDAD RESTRINGIDA** | Visible para todos los miembros EXCEPTO los excluidos explícitamente por el propietario del inventario. La lista de exclusión se construye combinando dos mecanismos (sección 6.3): búsqueda y exclusión de organizaciones por nombre parcial, y/o exclusión de zonas geográficas completas (continente → país). | Ocultar el inventario a uno o varios competidores directos conocidos, o a una región completa, sin dejar de ser visible para el resto del mercado. |
| **TIERED — DIFERIDO A V2** | Modo de visibilidad con niveles de información diferenciados por grupo de miembros. Diferido a V2 por complejidad de implementación. Se especificará en el funcional de V2. | — |

## **6.3 Construcción de la lista de exclusión (Visibilidad Restringida)**

Cuando el miembro elige "Visibilidad restringida", configura una única lista de organizaciones excluidas para todo su inventario, combinando dos mecanismos complementarios:

| **Mecanismo** | **Comportamiento** |
| --- | --- |
| Búsqueda y exclusión por nombre | Campo de búsqueda con coincidencia parcial sobre el nombre de organización. El sistema devuelve todas las coincidencias en una tabla, y el miembro selecciona cuáles añadir a la lista de exclusión, una o varias a la vez. |
| Exclusión por geografía (continente → país) | El miembro selecciona primero un continente; el sistema añade automáticamente a la lista de exclusión todas las organizaciones con sede en ese continente. Alternativamente, el miembro puede refinar a un país concreto dentro de ese continente, excluyendo solo las organizaciones de ese país en lugar del continente completo. |
| Lista de exclusión resultante | Ambos mecanismos alimentan la misma lista — son combinables: el miembro puede excluir, por ejemplo, todo un continente y además, por nombre, una organización concreta de otro continente que no quedaría cubierta por la exclusión geográfica. |
| Edición de la lista | La lista de exclusión es siempre editable: el miembro puede quitar una organización o una zona geográfica de la exclusión en cualquier momento, recuperando su visibilidad de forma inmediata. |

## **6.4 Pantalla INV-07 — Configuración de visibilidad**

**Descripción**

Panel de gestión de la visibilidad del inventario. Accesible desde el botón "Configurar visibilidad" en INV-01. Aplica siempre al inventario completo de la organización — no existe configuración por categoría ni por referencia individual en V1.

| **Elemento** | **Comportamiento** |
| --- | --- |
| Selector de modo | Visible para todos los miembros / Visibilidad restringida. Cambiar de "Restringida" a "Visible para todos" no borra la lista de exclusión guardada — queda inactiva, por si el miembro vuelve a activar el modo restringido más adelante. |
| Buscador de organizaciones a excluir | Solo visible si el modo es "Visibilidad restringida". Campo de texto con coincidencia parcial; resultados en tabla con checkbox de selección. |
| Selector de continente / país a excluir | Solo visible si el modo es "Visibilidad restringida". Selector en dos pasos: continente, y opcionalmente país dentro de ese continente. |
| Tabla de la lista de exclusión actual | Muestra todas las organizaciones actualmente excluidas, indicando si llegaron por nombre o por geografía, con botón de quitar por fila. |
| Botón "Simular visibilidad" | Permite al miembro seleccionar otro miembro concreto y comprobar si su inventario sería visible para esa organización con la configuración actual. Herramienta de depuración y auditoría. |

# **7. Sistema de Frescura de Datos (Data Freshness)**

## **7.1 Descripción y motivación**

Uno de los problemas más citados por los usuarios de Bearingworld.io es el stock fantasma: referencias que aparecen disponibles en la búsqueda pero que en realidad fueron vendidas semanas antes. El distribuidor que llama para preguntar pierde tiempo. El que tiene el stock y no lo actualiza pierde credibilidad. La plataforma resuelve esto con un sistema de frescura visible y activo.

## **7.2 Reglas de frescura**

El stock de un distribuidor NUNCA se archiva ni retira automáticamente por antigüedad. La decisión de retirar inventario es exclusivamente del distribuidor. El sistema muestra indicadores informativos de antigüedad a los compradores para que gestionen sus expectativas, pero no toma acciones punitivas sobre el inventario publicado.

| **Antigüedad desde última subida** | **Indicador visual para el comprador** | **Indicador para el distribuidor (panel propio)** | **Acción automática del sistema** |
| --- | --- | --- | --- |
| < 7 días | Sin indicador. Timestamp de actualización visible. | Sin alerta. | Ninguna. |
| 7–30 días | [object Object] "Datos de hace X días — confirmar disponibilidad antes de contactar." | Aviso suave en el panel: "Tu inventario tiene X días. Los compradores ven una advertencia." | Email informativo NOT-INV-03 al distribuidor (una sola vez al llegar a 7 días). |
| > 30 días | [object Object] "Stock posiblemente desactualizado — verificar disponibilidad." | Aviso destacado en el panel con timestamp exacto de la última subida. | Email recordatorio NOT-INV-04 al distribuidor (una sola vez al llegar a 30 días). Sin más acciones automáticas. |
| Cualquier antigüedad — acción del distribuidor | — | El distribuidor puede retirar manualmente cualquier línea o todo su inventario en cualquier momento desde el panel o por chat con VERA. | Ninguna acción automática adicional. El inventario permanece publicado hasta que el distribuidor decida retirarlo. |

|  |
| --- |
| **💡 CONFIGURACIÓN DEL UMBRAL DE FRESCURA**  Los umbrales de 7 y 14 días son los valores por defecto de la plataforma. El miembro puede ajustar su propio umbral de aviso en Ajustes → Inventario → Alertas de frescura (rango permitido: 3 a 30 días). El umbral de auto-archivo (30 días) no es configurable por el miembro en V1 — es una política de plataforma para garantizar la calidad del índice de búsqueda. |

## **7.3 Visualización de frescura en resultados de búsqueda**

La frescura no es solo visible para el propietario del inventario. Los miembros que buscan stock también ven el indicador junto a cada resultado (ver Módulo 03). Esto les permite priorizar contactar con distribuidores que tienen datos actualizados, y gestionar sus expectativas cuando los datos son antiguos.

# **8. Operaciones sobre Líneas de Inventario**

## **8.1 Edición individual de línea (INV-08)**

El miembro puede editar cualquier campo de una línea publicada individualmente, sin necesidad de re-subir el archivo completo. Accesible desde la tabla en INV-01 → botón "Editar" en cada línea.

| **Campo** | **Editable** | **Notas** |
| --- | --- | --- |
| quantity | Sí | Edición directa. Se actualiza el timestamp de uploaded\_at. |
| unit\_price | Sí | Solo si el precio es visible en la plataforma. El nuevo valor se cifra E2EE antes de guardarse. |
| lead\_time\_days | Sí | Input numérico. |
| notes | Sí | Textarea. Máx 500 chars. |
| expires\_at | Sí | Date picker. Se puede eliminar la fecha de expiración. |
| part\_number | No | La referencia es la clave del registro. Para cambiarla, eliminar la línea y crear una nueva. |
| brand | No | Igual que part\_number. |
| location\_country | Sí | Dropdown ISO. Cambiar el país de stock puede afectar a los resultados de búsqueda activos de otros miembros (watchers). El sistema evalúa y dispara alertas afectadas. |

## **8.2 Operaciones en lote**

| **Operación** | **Descripción** | **Confirmación requerida** |
| --- | --- | --- |
| Archivar selección | Mueve las líneas seleccionadas a estado ARCHIVED. Desaparecen del índice de búsqueda. | Sí — modal de confirmación con recuento. |
| Restaurar selección | Devuelve líneas ARCHIVED a PUBLISHED. | No — acción reversible. |
| Eliminar selección | Elimina permanentemente (soft delete). Irreversible desde UI. | Sí — modal con texto de confirmación: el usuario debe escribir "ELIMINAR" para confirmar. |
| Cambiar visibilidad en lote | Aplica un modo de visibilidad a todas las líneas seleccionadas. | Sí — modal con resumen del cambio. |
| Exportar selección | Descarga las líneas seleccionadas en formato CSV con el esquema canónico de la plataforma. | No. |

# **9. Notificaciones del Módulo**

| **ID** | **Trigger** | **Canal** | **Receptor** | **Contenido** |
| --- | --- | --- | --- | --- |
| NOT-INV-01 | Importación completada (cualquier canal) | In-app + Email | Miembro propietario | Resumen: X líneas importadas, Y actualizadas, Z errores. Enlace a INV-03. |
| NOT-INV-02 | Importación con errores críticos (0 líneas importadas) | In-app + Email (urgente) | Miembro propietario + Admin org. | "Tu última subida de inventario falló completamente." Detalle del error. Enlace a reintentar. |
| NOT-INV-03 | Stock supera 7 días sin nueva subida | Email | Miembro propietario | Aviso informativo (una sola vez): "Tu inventario tiene más de 7 días sin actualizar. Los compradores pueden ver un indicador de datos posiblemente desactualizados. Tu stock sigue publicado y visible — no hay ninguna acción automática. Actualiza cuando lo consideres oportuno." |
| NOT-INV-04 | Stock supera 30 días sin nueva subida | Email | Miembro propietario | Recordatorio informativo: "Tu inventario lleva más de 30 días sin actualizar. Los compradores ven un aviso de posible desactualización. No hay ninguna acción automática pendiente — tu stock sigue publicado y visible. Si quieres actualizarlo, puedes hacerlo cuando quieras." Enlace a subida de inventario. |
| NOT-INV-05 — ELIMINADA | Esta notificación existía asociada al mecanismo de auto-archivo, que ha sido eliminado en v1.2. El stock nunca se archiva automáticamente. Sustituida por NOT-INV-04 (email recordatorio a los 30 días, informativo, sin amenaza de acción automática). | — | — | — |

# **10. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-INV-01 | El campo unit\_price, si se incluye en una subida, NUNCA se indexa en texto plano en Typesense. Se almacena cifrado E2EE. Solo es visible en el contexto de una negociación activa entre las dos partes. | **CRÍTICA** |
| RNG-INV-02 | Las reglas de visibilidad se evalúan en el servidor (Inventory Service) antes de devolver cualquier resultado. El cliente nunca recibe datos a los que no tiene permiso de ver, ni siquiera para filtrarlos en frontend. | **CRÍTICA** |
| RNG-INV-03 | El sistema de mapeo IA nunca aplica un mapeo automáticamente la primera vez que ve una estructura de columnas desconocida. Siempre pide confirmación al miembro. A partir de la segunda subida con la misma estructura (perfil guardado), sí aplica automáticamente. | **ALTA** |
| RNG-INV-04 | El modo de actualización por defecto es REEMPLAZO TOTAL: el archivo subido representa el stock completo del distribuidor. El sistema actualiza las líneas existentes, inserta las nuevas y ELIMINA las que no aparecen en el archivo. El modo alternativo (acumulativo — solo insertar/actualizar sin borrar) es configurable en el perfil de subida para distribuidores que envían actualizaciones parciales. El modo por defecto no puede cambiarse a nivel de plataforma. | **ALTA** |
| RNG-INV-05 | El límite máximo de líneas de inventario por organización en V1 es de 500.000 líneas. Por encima, el sistema notifica al administrador y bloquea nuevas subidas hasta que se archive o elimine stock. | **ALTA** |
| RNG-INV-06 | Todos los accesos a la API de inventario (CAN-04) están limitados a 100 peticiones por minuto por organización. Subidas masivas deben usar el endpoint /api/inventory/sync. | MEDIA |
| RNG-INV-07 | El botón "Simular visibilidad" (INV-07) no registra ningún evento ni notifica al miembro objetivo que su perfil de visibilidad ha sido consultado. Es una herramienta de auditoría interna. | MEDIA |
| RNG-INV-08 | Los archivos subidos (raw, antes de procesamiento) se almacenan en S3/R2 durante 30 días para auditoría y soporte. Después se purgan automáticamente. | MEDIA |

# **11. Criterios de Aceptación por Flujo**

## **Subida de inventario (CAN-01 a CAN-04)**

* CA-INV-01: Un archivo CSV con 10.000 líneas y estructura desconocida se procesa y presenta el mapeo propuesto en menos de 15 segundos.
* CA-INV-02: El mapeo propuesto por IA tiene una tasa de acierto ≥ 90% en un set de prueba de 20 archivos reales de distribuidores.
* CA-INV-03: Una subida por email es procesada en menos de 2 minutos desde la recepción del mensaje.
* CA-INV-04: Un archivo con encoding Latin-1 se procesa correctamente sin caracteres corruptos.
* CA-INV-05: Un archivo de 100.000 líneas completa la importación con barra de progreso funcional y notificación por email al finalizar.

## **Visibilidad**

* CA-VIS-01: Una organización en modo "Visibilidad restringida" no aparece en los resultados de búsqueda de un miembro incluido en su lista de exclusión (verificable en Módulo 03).
* CA-VIS-02: La herramienta "Simular visibilidad" muestra exactamente las mismas líneas que vería el miembro objetivo al buscar.
* CA-VIS-03: Excluir una organización por nombre o por geografía (continente/país) surte efecto inmediato — el miembro excluido deja de ver el inventario en su próxima búsqueda.
* CA-VIS-04: Quitar una organización o una zona geográfica de la lista de exclusión restaura su visibilidad de forma inmediata.

## **Frescura de datos**

* CA-FRE-01: Una línea cuya última subida supera los 7 días muestra el indicador de antigüedad (icono ámbar + texto informativo) en los resultados de búsqueda de otros miembros. La línea permanece en estado PUBLISHED — no cambia de estado, no desaparece de búsquedas. El distribuidor recibe el email NOT-INV-03 una única vez al superar ese umbral.
* CA-FRE-02: Una re-subida del inventario elimina el indicador de antigüedad para todas las líneas actualizadas (o nuevas). Las líneas que no aparecen en el nuevo archivo se eliminan (política de reemplazo total).
* CA-FRE-03: El indicador de antigüedad es visible en los resultados de búsqueda del Módulo 03 — siempre informativo, nunca bloqueante. El comprador ve el stock independientemente de su antigüedad.

# **12. Capa Conversacional — VERA en la Gestión de Inventario**

De acuerdo con el Módulo 00 (Arquitectura de Interacción IA v1.1), VERA es la interfaz primaria de Bearingworld.io. Esta sección especifica cómo se integra VERA en cada uno de los flujos del módulo de Gestión de Inventario, tanto como asistente proactivo como canal alternativo para ejecutar operaciones sin tocar la UI visual.

|  |
| --- |
| **ℹ️ REFERENCIA**  Este apartado implementa las directrices del Módulo 00 sección 8.2 (Cambios en Módulo 02 — Gestión de Inventario). Toda decisión sobre tono, límites y comportamiento de VERA se rige por el Módulo 00 v1.1. |

## **12.1 Operaciones de inventario accesibles por chat**

El usuario puede ejecutar cualquier operación del módulo mediante instrucciones en lenguaje natural a VERA. La tabla siguiente muestra las instrucciones tipo, la clasificación de intención según el Módulo 00 y el comportamiento esperado.

| **Instrucción de ejemplo** | **Intención (Módulo 00)** | **Comportamiento de VERA** |
| --- | --- | --- |
| "¿Cuántas líneas tengo publicadas ahora mismo?" | CONSULTA | VERA consulta en tiempo real el inventario del miembro y responde: "Tienes 3.420 líneas publicadas, 12 marcadas como desactualizadas y 45 archivadas." |
| "¿Cuándo fue la última vez que actualicé mi stock?" | CONSULTA | VERA responde con el timestamp exacto de la última subida y el canal utilizado: "Tu última actualización fue el martes 10 de junio a las 09:14, por subida manual de archivo." |
| "Sube mi inventario" | ACCIÓN REVERSIBLE | VERA abre el selector de archivo en Zona A: "Abre el panel de subida a la izquierda. Puedes arrastrar tu archivo directamente ahí." Si el canal CAN-02 o CAN-03 está configurado, VERA pregunta: "¿Quieres subirlo manualmente o prefieres que lo procese desde tu carpeta monitorizada?" |
| "Actualiza el stock de 6305-2Z SKF a 150 unidades" | ACCIÓN REVERSIBLE | VERA localiza la referencia, confirma: "Actualizo 6305-2Z SKF de 200 a 150 unidades. ¿Confirmas?" [botón Sí / Cancelar]. Tras confirmación: ejecuta UPSERT y confirma el cambio. |
| "Archiva todas las líneas con más de 60 días sin movimiento" | ACCIÓN IRREVERSIBLE | VERA calcula el impacto: "Esto archivará 87 líneas (última actualización hace más de 60 días). Seguirán en tu historial pero dejarán de aparecer en búsquedas. ¿Confirmas? [botón: Sí, archivar 87 líneas] [Cancelar]". Solo ejecuta tras confirmación explícita. |
| "No quiero que Distribuciones García vea mi inventario" | ACCIÓN REVERSIBLE | VERA identifica al miembro: "Activo visibilidad restringida y añado a Distribuciones García S.L. a tu lista de exclusión. El resto de miembros seguirá viendo tu inventario con normalidad. ¿Confirmas?" |
| "¿Quién puede ver mi inventario ahora mismo?" | CONSULTA | VERA evalúa la configuración de visibilidad activa y responde: "Tu inventario es visible para todos los miembros excepto Distribuciones García S.L., que tienes en tu lista de exclusión." |
| "Configura la carpeta C:\ERP\stock\_export como carpeta monitorizada" | ACCIÓN REVERSIBLE | VERA detecta que el Desktop Agent no está instalado si es el caso: "Para monitorizar una carpeta necesitas instalar el agente de escritorio de Bearingworld.io. Te muestro las instrucciones." Zona A muestra INV-05. |
| "Elimina todas mis líneas archivadas" | ACCIÓN IRREVERSIBLE | VERA aplica el protocolo completo: impacto cuantificado, advertencia de irreversibilidad, botón con texto específico "Eliminar X líneas archivadas". Sin esta confirmación explícita, no ejecuta. |

## **12.2 VERA como asistente durante la subida de inventario**

El proceso de mapeo de columnas (INV-02) es el momento donde más valor aporta VERA durante el flujo de subida. El usuario puede consultar dudas en tiempo real mientras revisa el mapeo propuesto en Zona A.

| **Situación durante INV-02** | **Comportamiento de VERA** |
| --- | --- |
| El usuario ve una columna mapeada con baja confianza (<60%) y no entiende por qué | VERA explica: "Tu columna Uds\_disp tiene baja confianza porque el nombre no es estándar. El sistema propone mapearla a Cantidad. Si ese es el campo correcto, confírmalo y lo recordaré para el próximo archivo." |
| El usuario no sabe a qué familia pertenece una referencia | VERA explica: "Si tu archivo no tiene una columna de familia de producto, no te preocupes — lo infiero automáticamente del código de referencia y la marca. Solo revisa que el resultado sea correcto en la vista previa." |
| El usuario quiere ignorar una columna que el sistema ha mapeado | VERA acepta: "Sin problema. Excluyo la columna Precio\_coste del mapeo. Ese dato no se publicará." Actualiza el mapeo en Zona A. |
| El archivo tiene 0 líneas válidas tras el mapeo | VERA alerta proactivamente: "Atención — con el mapeo actual no hay ninguna línea válida para importar. Probablemente los campos obligatorios (Referencia, Marca, Cantidad, País) no están correctamente mapeados. ¿Quieres que te ayude a identificarlos?" |
| El usuario quiere guardar el perfil pero no sabe cómo nombrarlo | VERA sugiere: "Podrías llamarlo por tu sistema ERP o por el tipo de archivo. Por ejemplo: SAP\_Export, Stock\_Semanal, o el nombre de tu proveedor de datos." |

## **12.3 VERA y las notificaciones de frescura de datos**

En v1.1, las notificaciones de stock desactualizado se gestionaban exclusivamente por email (NOT-INV-03, NOT-INV-04, NOT-INV-05). Con la integración de VERA, se añade una capa conversacional proactiva en el momento del login.

| **Trigger** | **Mensaje proactivo de VERA al iniciar sesión** |
| --- | --- |
| Inventario con indicador de antigüedad (7-30 días) | VERA muestra un mensaje informativo al iniciar sesión: "Tu inventario lleva X días sin actualizar. Los compradores pueden ver un indicador de datos posiblemente desactualizados — tu stock sigue completamente visible y activo. ¿Quieres subir un archivo actualizado?" Botones: [Subir ahora] [Más tarde] |
| Inventario con indicador de antigüedad avanzada (>30 días) | VERA mantiene tono informativo sin urgencia artificial: "Tu inventario lleva más de 30 días sin actualizar. Los compradores ven un aviso de posible desactualización, pero tu stock sigue publicado y visible. Cuando quieras actualizarlo, aquí estoy." Botones: [Subir inventario] [Configurar subida automática] |
| El usuario pregunta directamente sobre su estado de frescura | VERA consulta en tiempo real: "Tu inventario está FRESH — última actualización hace 3 días. Ninguna línea tiene advertencia de datos desactualizados." |

|  |
| --- |
| **💡 CONSISTENCIA CON MÓDULO 00**  Los mensajes proactivos de VERA al login sobre frescura de inventario son una excepción controlada al principio del Módulo 00 que establece que VERA no opera en modo proactivo en V1 fuera de notificaciones definidas. Estos mensajes ESTÁN dentro del marco de notificaciones definidas del módulo (NOT-INV-03 a NOT-INV-05) — simplemente se añade el canal conversacional como complemento al email. No son mensajes iniciados por VERA de forma autónoma. |

## **12.4 VERA en la configuración de visibilidad**

La configuración de visibilidad (INV-07) es una de las funciones más complejas de la plataforma para un usuario no técnico. VERA tiene un rol especialmente relevante aquí: traducir las intenciones comerciales del usuario a reglas técnicas de visibilidad.

| **Intención del usuario** | **VERA traduce a regla técnica** |
| --- | --- |
| "No quiero que mi competidor directo Rodamientos López me vea" | Activa visibilidad restringida y añade Rodamientos López S.L. a la lista de exclusión de organización. El resto de miembros siguen viendo tu inventario. |
| "Quiero excluir a todos los distribuidores de Asia" | Activa visibilidad restringida y añade el continente Asia a la lista de exclusión — todas las organizaciones con sede en Asia quedan excluidas automáticamente. |
| "¿Quién puede ver mi inventario ahora mismo?" | VERA ejecuta la herramienta de simulación de visibilidad y devuelve el resultado en lenguaje natural: "Todos los miembros excepto los 2 que tienes en tu lista de exclusión." |
| "Quiero volver a la configuración por defecto" | VERA confirma: "Esto desactivará la visibilidad restringida y pondrá todo tu inventario como Visible para todos los miembros. Tu lista de exclusión actual quedará guardada pero inactiva. ¿Confirmas?" |

## **12.5 Flujos conversacionales tipo — Inventario**

### **Subida de inventario desde cero (usuario nuevo)**

| **Turno** | **Actor** | **Mensaje** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | Usuario | Quiero subir mi stock | VERA clasifica: ACCIÓN REVERSIBLE (subida de archivo). |
| 2 | VERA | "Perfecto. Puedes hacerlo de tres formas: subiendo el archivo ahora, enviándolo por email a tu dirección de ingestión, o configurando una carpeta que se sincronice automáticamente. ¿Cuál prefieres?" | Botones de opción rápida: [Subir archivo] [Ver dirección email] [Configurar carpeta] |
| 3 | Usuario | Subir archivo | Zona A muestra INV-01 con la zona drag & drop activa. |
| 4 | VERA | "Panel listo. Arrastra tu archivo de stock a la zona de la izquierda o usa el botón de selección. Acepto CSV, Excel y cualquier formato de texto delimitado." | El foco visual se desplaza a la Zona A. |
| 5 | [Usuario sube archivo] | — | El sistema procesa el archivo y muestra INV-02 en Zona A con el mapeo propuesto. |
| 6 | VERA | "He analizado tu archivo. Zona A muestra el mapeo de columnas propuesto. Detecté 3.420 líneas válidas. La confianza del mapeo es alta en todos los campos — solo la columna Plazo\_entrega tiene confianza media (72%). ¿Le echamos un vistazo juntos?" | Zona A tiene el foco en la fila de baja confianza. |
| 7 | Usuario | ¿Qué pasa con Plazo\_entrega? | VERA explica que esa columna parece corresponder a lead\_time\_days (días de entrega) y muestra los valores de ejemplo detectados en el archivo para que el usuario confirme. |
| 8 | Usuario | Sí, son los días de entrega | VERA actualiza el mapeo: "Entendido — mapeo Plazo\_entrega → lead\_time\_days. ¿Confirmo la importación?" |
| 9 | Usuario | Sí | Sistema procesa las 3.420 líneas. Zona A muestra INV-03 con el resumen. |
| 10 | VERA | "Listo. 3.420 líneas publicadas en tu inventario. Guardé el perfil de mapeo para la próxima vez. ¿Quieres configurar la actualización automática para no tener que repetir esto cada semana?" | Botones: [Configurar email automático] [Configurar carpeta] [Más tarde] |

# **13. Registro de Decisiones — Preguntas Cerradas**

Todas las preguntas abiertas del Módulo 02 han sido resueltas. Este registro documenta las decisiones para trazabilidad.

| **ID** | **Decisión tomada** | **Estado** |
| --- | --- | --- |
| **QA-INV-01 ✅** | unit\_price es campo OPCIONAL en la subida de inventario. El distribuidor puede incluirlo si quiere. También puede introducirse durante la negociación. Ambas vías coexisten. Si se sube en el archivo, queda cifrado E2EE. | CERRADA |
| **QA-INV-02 ✅** | Desktop agent (CAN-03) diferido a V2. En V1: CAN-01 (subida manual) y CAN-02 (email automático). Simplifica el lanzamiento sin impacto significativo en la experiencia de los primeros miembros. | CERRADA |
| **QA-INV-03 ✅** | Sin auto-archivo. El stock permanece publicado indefinidamente hasta que el distribuidor decida retirarlo. El sistema solo muestra indicadores informativos de antigüedad a compradores y al propio distribuidor. Ninguna acción automática sobre el inventario. | CERRADA |
| **QA-INV-04 ✅** | Descartada para V1. Caso límite de gestión avanzada que no impacta en el lanzamiento. | CERRADA |
| **QA-INV-05 ✅** | Modo TIERED diferido a V2. En V1 los modos de visibilidad son: VISIBLE PARA TODOS LOS MIEMBROS y VISIBILIDAD RESTRINGIDA (con exclusión por nombre y/o geografía). WHITELIST y BILATERAL quedan descartados de V1 (v1.3). TIERED se especificará en el funcional de V2. | CERRADA |
| **QA-INV-06 NUEVA ✅** | Campo product\_family añadido al esquema canónico como campo obligatorio. Es el campo que habilita las reglas de visibilidad por familia de producto. Se infiere automáticamente por el motor IA si el distribuidor no lo incluye en su archivo. | CERRADA |

# **14. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Cubre todos los canales de subida, motor IA, visibilidad granular y sistema de frescura. |
| 1.1 | Junio 2026 | Equipo de Producto | Actualización de identidad a Bearingworld.io. Añadida sección 12 completa de capa conversacional VERA. |
| 1.2 | Junio 2026 | Equipo de Producto | Revisión completa según comentarios de producto: (1) Añadido campo product\_family al esquema canónico — base de las reglas de visibilidad por familia. (2) Eliminado campo condition — no es práctica estándar del sector. (3) Política de actualización cambiada a REEMPLAZO TOTAL por defecto. (4) Eliminado mecanismo de auto-archivo — el stock nunca se retira automáticamente por antigüedad. (5) Indicadores de frescura redefinidos como puramente informativos, sin penalización. (6) Modo TIERED diferido a V2. (7) CAN-03 (desktop agent) diferido a V2. (8) Mensajes de VERA sobre frescura redefinidos con tono informativo sin urgencia artificial. (9) Todas las preguntas abiertas cerradas. |
| 1.3 | Junio 2026 | Equipo de Producto | Cierre de comentarios de revisión del Inventario de Pantallas: (1) Rediseño completo del sistema de visibilidad (sección 6): de cinco modos (Público/Whitelist/Blacklist/Bilateral/Tiered) a dos (Visible para todos los miembros / Visibilidad restringida), aplicados siempre al inventario completo de la organización sin granularidad por categoría ni referencia. Bilateral descartado por completo; Whitelist absorbido conceptualmente por el nuevo modo restringido; Tiered se mantiene diferido a V2. La lista de exclusión del modo restringido se construye combinando búsqueda por nombre y exclusión por continente/país. (2) Corregidos tres residuos del campo condition (tabla INV-01, edición de línea INV-08, ejemplo conversacional) que debían haberse eliminado en v1.2 pero no se limpiaron del todo. (3) Traducida la terminología STALE a "desactualizado" en las cinco menciones que quedaban en inglés. (4) Aclarado el significado de "Guardar como perfil" en INV-02. (5) INV-03 ahora muestra explícitamente solo un ejemplo de 10 líneas, nunca el listado completo, independientemente del volumen del archivo importado. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.0 | ADR-001 E2EE Key Backup | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.2 |