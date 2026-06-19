# Inventory Management Specification

## Purpose
Permitir a cada miembro de Bearingworld.io publicar y mantener actualizado su
catálogo de stock en cualquier formato, con mapeo automático de columnas por IA,
control granular de visibilidad por organización e indicadores de frescura de
datos, convirtiéndose en el motor de utilidad de la plataforma.

---

## ADDED Requirements

---

### Requirement: canonical-schema
El sistema SHALL almacenar cada línea de inventario con el esquema canónico definido,
siendo obligatorios los campos `part_number`, `brand`, `quantity`,
`location_country` y `product_family`, y SHALL inferir automáticamente
`product_family` mediante el motor IA si el distribuidor no lo incluye en su archivo.
[Origen: Módulo 02 v1.3, sección 3.1; QA-INV-06 cerrada]

#### Scenario: inferencia automática de product_family
- GIVEN un archivo de stock subido que no incluye la columna `product_family`
- WHEN el motor IA procesa el archivo
- THEN el sistema infiere `product_family` a partir de `part_number` y `brand`
  para cada línea
- AND las líneas donde no sea posible inferirla quedan marcadas como error

#### Scenario: unit_price cifrado E2EE
- GIVEN un archivo de stock que incluye la columna `unit_price`
- WHEN el sistema procesa la línea
- THEN el valor queda cifrado E2EE antes de almacenarse
- AND nunca se indexa en texto plano ni es accesible para el servidor

---

### Requirement: inventory-upload-channels
El sistema SHALL soportar en V1 dos canales de subida de inventario: CAN-01
(subida manual en browser, archivos hasta 50 MB en formato .csv, .xlsx, .xls,
.tsv, .txt) y CAN-02 (email automático con adjunto a dirección única por miembro
con whitelist de remitentes), y SHALL exponer además una API directa CAN-04
(REST con autenticación Bearer JWT o API Key).
[Origen: Módulo 02 v1.3, sección 4.1 y QA-INV-02 cerrada]

#### Scenario: subida manual CAN-01 con archivo válido
- GIVEN un miembro en INV-01 que arrastra un archivo .csv de 50 MB o menos
- WHEN el archivo es recibido por el Ingestion Service
- THEN el sistema extrae las primeras 10 filas y las envía al AI CSV Mapper
- AND presenta la pantalla INV-02 con el mapeo propuesto en menos de 15 segundos

#### Scenario: archivo supera límite de tamaño CAN-01
- GIVEN un miembro que intenta subir un archivo mayor de 50 MB
- WHEN el sistema detecta el tamaño
- THEN rechaza el archivo antes de procesarlo
- AND muestra un mensaje con instrucción de comprimir o dividir el archivo

#### Scenario: email automático CAN-02 desde remitente autorizado
- GIVEN un email con archivo adjunto enviado a la dirección de ingestión del miembro
  desde un remitente en su whitelist
- WHEN el Ingestion Service recibe el email
- THEN procesa el adjunto automáticamente sin intervención humana
- AND completa la importación en menos de 2 minutos desde la recepción

#### Scenario: email CAN-02 desde remitente no autorizado
- GIVEN un email enviado a la dirección de ingestión desde un remitente fuera
  de la whitelist
- WHEN el sistema lo recibe
- THEN lo rechaza silenciosamente sin procesar el adjunto
- AND registra el intento en el log de seguridad

#### Scenario: rate limiting API CAN-04
- GIVEN una organización que supera 100 peticiones por minuto a la API de inventario
- WHEN se recibe la petición que excede el límite
- THEN el servidor responde HTTP 429
- AND las subidas masivas deben usar `POST /api/inventory/sync`
  (límite de 50.000 líneas por llamada)

---

### Requirement: ai-column-mapping
El sistema SHALL mapear automáticamente las columnas de cualquier archivo al
esquema canónico mediante el AI CSV Mapper, presentando la propuesta con nivel
de confianza por columna antes de procesar el archivo completo, y SHALL permitir
al miembro guardar el mapeo como perfil reutilizable.
[Origen: Módulo 02 v1.3, sección 5; RNG-INV-03]

#### Scenario: mapeo propuesto con alta confianza
- GIVEN un archivo con estructura reconocible subido vía CAN-01
- WHEN el AI CSV Mapper analiza la muestra de 10 filas
- THEN presenta en INV-02 una tabla con la propuesta de mapeo columna a columna
- AND cada fila muestra el nombre original, el campo canónico propuesto,
  un ejemplo de valor y el porcentaje de confianza con código de color
  (verde >85%, amarillo 60–85%, rojo <60%)
- AND las columnas no mapeadas aparecen en sección separada "Columnas ignoradas"

#### Scenario: perfil de mapeo guardado y aplicado automáticamente
- GIVEN un miembro que guarda el mapeo confirmado como perfil con nombre
- WHEN el mismo miembro sube un archivo con estructura de columnas similar en
  una sesión posterior
- THEN el sistema aplica el perfil automáticamente sin pedir confirmación de mapeo

#### Scenario: columnas obligatorias sin mapear bloquean importación
- GIVEN un miembro en INV-02 con alguna de las columnas obligatorias
  (`part_number`, `brand`, `quantity`, `location_country`) sin mapear
- WHEN intenta pulsar "Confirmar e importar"
- THEN el botón permanece deshabilitado
- AND el sistema indica qué columnas obligatorias faltan por mapear

---

### Requirement: update-policy
El sistema SHALL aplicar REEMPLAZO TOTAL como política de actualización por
defecto: el archivo subido representa el stock completo del miembro, actualizando
las líneas existentes, insertando las nuevas y eliminando las ausentes, y SHALL
ofrecer modo acumulativo configurable por perfil de subida para distribuidores
que envían actualizaciones parciales.
[Origen: Módulo 02 v1.3, RNG-INV-04]

#### Scenario: reemplazo total por defecto
- GIVEN un miembro con 1.000 líneas publicadas que sube un nuevo archivo
  con 800 líneas
- WHEN el sistema procesa el archivo en modo REEMPLAZO TOTAL
- THEN actualiza las líneas coincidentes
- AND inserta las líneas nuevas
- AND elimina las 200 líneas que no aparecen en el nuevo archivo
- AND el inventario publicado refleja exactamente las 800 líneas del archivo

#### Scenario: modo acumulativo configurado en perfil
- GIVEN un miembro que tiene configurado el modo acumulativo en su perfil de subida
- WHEN sube un archivo parcial con 200 líneas
- THEN el sistema actualiza e inserta esas 200 líneas
- AND NO elimina ninguna línea existente que no aparezca en el archivo

---

### Requirement: inventory-line-lifecycle
El sistema SHALL gestionar el ciclo de vida de cada línea de inventario con los
estados DRAFT, PUBLISHED, ARCHIVED y DELETED, sin realizar ninguna transición
automática por antigüedad — toda decisión de archivar o eliminar es exclusiva
del distribuidor.
[Origen: Módulo 02 v1.3, sección 3.2 y QA-INV-03 cerrada]

#### Scenario: publicación tras importación exitosa
- GIVEN un archivo procesado sin errores en columnas obligatorias
- WHEN el miembro confirma la importación en INV-02
- THEN todas las líneas válidas transicionan de DRAFT a PUBLISHED

#### Scenario: archivo con errores parciales
- GIVEN un archivo que contiene líneas con errores (cantidad negativa, país inválido)
- WHEN el sistema procesa el archivo
- THEN las líneas válidas se publican
- AND las líneas con error se muestran en un panel expandible con fila, columna
  y tipo de error
- AND el miembro puede descargar el CSV de errores para corregir y re-subir

#### Scenario: límite de líneas alcanzado
- GIVEN una organización que intenta subir un archivo que llevaría su inventario
  por encima de 500.000 líneas publicadas
- WHEN el sistema detecta el límite
- THEN bloquea la subida
- AND notifica al administrador indicando que debe archivar o eliminar stock
  antes de continuar

---

### Requirement: visibility-control
El sistema SHALL implementar dos modos de visibilidad aplicados a todo el
inventario de la organización: VISIBLE PARA TODOS LOS MIEMBROS (por defecto)
y VISIBILIDAD RESTRINGIDA con lista de exclusión por nombre de organización
y/o por geografía (continente → país), con efecto inmediato al modificar
la configuración.
[Origen: Módulo 02 v1.3, sección 6; QA-INV-05 cerrada]

#### Scenario: exclusión por nombre de organización
- GIVEN un miembro en INV-07 con modo VISIBILIDAD RESTRINGIDA activo
- WHEN busca una organización por nombre parcial y la añade a la lista de exclusión
- THEN esa organización deja de ver el inventario del miembro en su próxima búsqueda
- AND el efecto es inmediato

#### Scenario: exclusión por geografía
- GIVEN un miembro en INV-07 que selecciona un continente para excluir
- WHEN confirma la exclusión
- THEN todas las organizaciones con sede en ese continente se añaden a la lista
  de exclusión
- AND el miembro puede refinar a un país concreto dentro del continente

#### Scenario: cambio de modo restringido a visible para todos
- GIVEN un miembro que cambia el modo de VISIBILIDAD RESTRINGIDA a VISIBLE
  PARA TODOS
- WHEN confirma el cambio
- THEN la lista de exclusión queda inactiva pero no se borra
- AND si el miembro reactiva el modo restringido, la lista previa se recupera


---

### Requirement: data-freshness
El sistema SHALL mostrar indicadores informativos de antigüedad en el inventario
publicado a los 7 y 30 días desde la última subida, enviando emails NOT-INV-03
y NOT-INV-04 al distribuidor en esos umbrales (una sola vez por umbral),
sin archivar ni retirar ninguna línea de forma automática.
[Origen: Módulo 02 v1.3, sección 7; QA-INV-03 cerrada]

#### Scenario: indicador de antigüedad a 7 días
- GIVEN una línea publicada cuya última subida supera los 7 días
- WHEN otro miembro la visualiza en los resultados de búsqueda
- THEN aparece un indicador ámbar con texto "Datos de hace X días —
  confirmar disponibilidad antes de contactar"
- AND el sistema envía NOT-INV-03 al distribuidor una única vez al alcanzar
  el umbral de 7 días

#### Scenario: indicador de antigüedad a 30 días
- GIVEN una línea publicada cuya última subida supera los 30 días
- WHEN otro miembro la visualiza en resultados de búsqueda
- THEN el indicador muestra "Stock posiblemente desactualizado —
  verificar disponibilidad"
- AND el sistema envía NOT-INV-04 al distribuidor una única vez al alcanzar
  el umbral de 30 días
- AND la línea permanece PUBLISHED sin ninguna acción automática adicional

---

### Requirement: raw-file-retention
El sistema SHALL almacenar los archivos raw recibidos (antes de procesamiento)
en S3/R2 durante 30 días para auditoría y soporte, purgarlos automáticamente
tras ese período, y SHALL rotar la dirección de ingestión de email del miembro
bajo demanda invalidando inmediatamente la anterior.
[Origen: Módulo 02 v1.3, RNG-INV-08; sección 4.3]

#### Scenario: retención y purga de archivo raw
- GIVEN un archivo procesado por cualquier canal
- WHEN han transcurrido 30 días desde su recepción
- THEN el sistema lo purga automáticamente de S3/R2
- AND el inventario publicado derivado de ese archivo no se ve afectado

#### Scenario: rotación de dirección de ingestión email
- GIVEN un miembro que sospecha que su dirección de ingestión ha sido comprometida
- WHEN solicita la rotación desde INV-04
- THEN el sistema genera una nueva dirección única
- AND la dirección anterior queda invalidada inmediatamente

---

## Out of Scope
- Búsqueda y consulta del inventario de otros miembros
  (capability conversational-search).
- Mensajería y negociación sobre líneas de stock
  (capability messaging-and-negotiation).
- Modo de visibilidad TIERED (diferido a V2).
- Desktop agent CAN-03 / carpeta monitorizada (diferido a V2).
- Sistema de reputación y confirmación de transacciones (Módulo 06, fuera de V1).
- Logistics calculator / precio de aterrizaje (Módulo 05, fuera de V1).
- Herramienta "Simular visibilidad" (botón INV-07): descartada en fase de
  análisis técnico — sin utilidad funcional identificada. El funcional de origen
  (Módulo 02 v1.3, sección 6.4) la documenta pero queda superada por esta
  decisión de producto tomada durante la escritura del spec.

---

## Cross-Capability References
- `organization-onboarding` — solo organizaciones en estado ACTIVE pueden
  publicar inventario.
- `conversational-search` — el índice de búsqueda consume el inventario
  en estado PUBLISHED generado por esta capability, incluyendo los indicadores
  de frescura y las reglas de visibilidad.
- `messaging-and-negotiation` — las tarjetas de consulta se originan desde
  líneas de inventario PUBLISHED; el campo `unit_price` cifrado E2EE fluye
  hacia la negociación.

---

## Open Questions
- Ninguna. Todas las decisiones del módulo están cerradas en v1.3.