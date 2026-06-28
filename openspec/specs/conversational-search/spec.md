# Conversational Search Specification

## Purpose
Permitir a los miembros de Bearingworld.io descubrir stock de rodamientos en el
inventario publicado de otros distribuidores mediante búsqueda conversacional con
VERA, con vigilancia continua del mercado vía watchers y acciones directas de
consulta o contacto hacia el distribuidor desde los resultados.

---

## ADDED Requirements

---

### Requirement: single-reference-search
El sistema SHALL interpretar búsquedas de referencia única en lenguaje natural
vía VERA, aplicar filtros por marca, país, cantidad mínima y lead time como chips
editables, ejecutar la consulta contra el índice de inventario con filtro de
visibilidad server-side, y devolver resultados en menos de 1,5 segundos ordenados
por cantidad disponible descendente.
[Origen: Módulo 03 v1.6, secciones 3 y 4.2; RNG-SRCH-01, RNG-SRCH-02, RNG-SRCH-04]

#### Scenario: búsqueda exitosa con resultados
- GIVEN un miembro autenticado que escribe una referencia en lenguaje natural
  en el chat de VERA
- WHEN VERA interpreta la consulta y ejecuta la búsqueda
- THEN los resultados aparecen en SRCH-01 en menos de 1,5 segundos
- AND las columnas aparecen en orden fijo: Referencia, Marca, Cantidad disponible,
  Plazo, Empresa, País, Antigüedad (días transcurridos desde la última actualización
  del inventario por el distribuidor), Favoritos, Acciones
- AND la columna País muestra el nombre completo del país en el idioma de sesión
  del usuario (nunca código ISO)
- AND los resultados están ordenados por cantidad disponible descendente
- AND ninguna línea de un distribuidor que ha excluido al usuario aparece
  en los resultados

#### Scenario: refinamiento en sesión activa
- GIVEN un miembro que ha ejecutado una búsqueda y SRCH-01 está visible
- WHEN modifica un chip de filtro directamente en la UI o pide a VERA
  un refinamiento
- THEN el sistema actualiza los resultados manteniendo el contexto de la sesión
- AND el usuario no necesita repetir los filtros anteriores

#### Scenario: búsqueda sin resultados
- GIVEN una búsqueda que no devuelve ninguna línea con los filtros actuales
- WHEN VERA presenta el resultado
- THEN ofrece al menos una alternativa activa: ampliar región, relajar filtros,
  o crear un watcher con los criterios actuales
- AND nunca responde solo con la ausencia de resultados sin alternativa

---

### Requirement: results-row-actions
El sistema SHALL ofrecer en cada fila de resultados las acciones "Consultar"
y "Contactar", con "Consultar" deshabilitado y la fila visualmente diferenciada
cuando esa línea ya ha sido consultada anteriormente por el comprador, y SHALL
habilitar la acción en lote "Consultar Seleccionados" cuando hay al menos dos
filas marcadas con el checkbox de selección múltiple.
[Origen: Módulo 03 v1.6, sección 4.2; CA-SRCH-05, CA-SRCH-06, CA-SRCH-07]

#### Scenario: consultar línea no consultada previamente
- GIVEN un miembro en SRCH-01 con una fila no marcada como consultada
- WHEN pulsa "Consultar"
- THEN se abre la tarjeta de consulta de messaging-and-negotiation (FL-MSG-01)
  con la referencia y distribuidor pre-cargados

#### Scenario: consultar línea ya consultada
- GIVEN un miembro en SRCH-01 con una fila ya marcada como consultada
  por ese comprador
- WHEN visualiza la fila
- THEN el botón "Consultar" aparece deshabilitado con texto explicativo
- AND la fila se muestra visualmente diferenciada de forma permanente

#### Scenario: contactar distribuidor (hilo libre)
- GIVEN un miembro en SRCH-01 que pulsa "Contactar" en cualquier fila
- WHEN ejecuta la acción
- THEN se abre un hilo de conversación libre con ese distribuidor en
  messaging-and-negotiation
- AND la acción está siempre disponible independientemente del estado
  de consulta de la fila

#### Scenario: consultar seleccionados en lote
- GIVEN un miembro en SRCH-01 que ha marcado al menos dos filas de uno
  o varios distribuidores con el checkbox de selección múltiple
- WHEN pulsa "Consultar Seleccionados"
- THEN el sistema envía una tarjeta de consulta a cada distribuidor de las
  líneas seleccionadas sin abrir ningún hilo en pantalla
- AND el usuario permanece en SRCH-01
- AND las filas de un mismo distribuidor se agrupan en su único hilo existente
  con esa organización (nunca un hilo por referencia)

---

### Requirement: batch-search
El sistema SHALL ejecutar búsquedas de hasta 50 referencias en paralelo,
interpretando listas en cualquier formato (una por línea, comas, tabulaciones,
pegado desde Excel) y presentando el resultado en el panel consolidado SRCH-02
con una tarjeta colapsable por referencia, exportable en CSV o PDF.
[Origen: Módulo 03 v1.6, sección 5; RN-SRCH.1 a RN-SRCH.4]

#### Scenario: lote en formato mixto
- GIVEN un miembro que pega una lista de referencias en distintos formatos
  mezclados (comas, tabulaciones, saltos de línea)
- WHEN VERA procesa la lista
- THEN interpreta correctamente todas las referencias sin requerir reformateo
- AND el tiempo total de respuesta para 50 referencias no supera los 5 segundos

#### Scenario: lote superior a 50 referencias
- GIVEN un miembro que pega una lista con más de 50 referencias
- WHEN VERA detecta el tamaño
- THEN informa cuántas referencias tiene la lista
- AND procesa las primeras 50
- AND ofrece continuar con el resto en una segunda tanda

#### Scenario: exportación del resumen de lote
- GIVEN un miembro en SRCH-02 con resultados de lote cargados
- WHEN pulsa "Exportar resumen"
- THEN el sistema genera un CSV o PDF con: referencia, número de distribuidores,
  cantidad máxima disponible y país

#### Scenario: crear watchers en lote para referencias sin stock
- GIVEN un miembro en SRCH-02 con referencias sin resultados
- WHEN pulsa "Crear watchers para referencias sin stock"
- THEN VERA confirma cuántos watchers se crearán y con qué criterios
  antes de ejecutar
- AND solo crea los watchers tras confirmación explícita del miembro

---

### Requirement: watcher-lifecycle
El sistema SHALL implementar watchers con evaluación en tiempo real contra el
stream de eventos `stock.updated` (Kafka), con los estados ACTIVE, PAUSED,
TRIGGERED, PENDIENTE DE RENOVACIÓN y EXPIRED, expiración a 30 días con
renovación explícita, y un límite de 50 watchers ACTIVE por organización.
[Origen: Módulo 03 v1.6, sección 6; RNG-SRCH-06, RNG-SRCH-07]

#### Scenario: creación de watcher con campos mínimos
- GIVEN un miembro que expresa intención de vigilancia en lenguaje natural
  con al menos una referencia y una cantidad umbral
- WHEN VERA confirma y el miembro aprueba
- THEN el watcher se crea en estado ACTIVE con fecha de expiración a 30 días
- AND se evalúa contra el siguiente evento stock.updated relevante
  en menos de 5 segundos desde que se publica

#### Scenario: intento de crear watcher sin referencia
- GIVEN un miembro que expresa intención de vigilancia sin mencionar referencia
- WHEN VERA interpreta la intención
- THEN VERA solicita la referencia antes de crear el watcher
- AND no crea ningún watcher hasta recibir al menos part_number y quantity

#### Scenario: watcher disparado
- GIVEN un watcher ACTIVE cuya condición pasa a ser verdadera
- WHEN el sistema detecta el evento stock.updated correspondiente
- THEN el watcher transiciona a TRIGGERED
- AND notifica al miembro vía in-app y email con el distribuidor,
  cantidad y timestamp
- AND por defecto no vuelve a notificar aunque la condición siga cumpliéndose

#### Scenario: expiración y renovación a los 30 días
- GIVEN un watcher ACTIVE que llega a su día 30 sin haberse disparado
- WHEN el sistema evalúa la expiración
- THEN el watcher transiciona a PENDIENTE DE RENOVACIÓN
- AND notifica al miembro con las opciones [Mantener activa] / [Dejar que expire]
- AND si el miembro confirma mantenimiento: vuelve a ACTIVE con contador reiniciado
- AND si el miembro declina o no responde: transiciona a EXPIRED

#### Scenario: límite de watchers activos alcanzado
- GIVEN una organización con 50 watchers en estado ACTIVE
- WHEN un miembro intenta crear un watcher adicional
- THEN VERA informa del límite alcanzado
- AND ofrece gestionar los watchers existentes antes de crear el nuevo

---

### Requirement: watcher-notification-throttle
El sistema SHALL limitar a 5 las notificaciones de watchers disparados por usuario
y día natural, agrupando las activaciones adicionales en una única notificación
de resumen a partir de la sexta.
[Origen: Módulo 03 v1.6, sección 6.6; QA-SRCH-04 cerrada; RNG-SRCH-07]

#### Scenario: límite diario de notificaciones alcanzado
- GIVEN un usuario que ya ha recibido 5 notificaciones de watchers en un día natural
- WHEN se dispara un sexto watcher ese mismo día
- THEN el sistema no envía notificación individual para ese watcher
- AND agrupa ese y los siguientes del día en una notificación de resumen
  indicando cuántas alertas adicionales han ocurrido

---

### Requirement: favorites-system
El sistema SHALL mantener un indicador de favoritos por organización-distribuidora
en los resultados de búsqueda, exclusivamente manual, puramente informativo, sin
efecto en la ordenación de resultados ni influenciable por ningún algoritmo o
evento de actividad.
[Origen: Módulo 03 v1.6, sección 4.4; RNG-SRCH-08]

#### Scenario: marcar favorito
- GIVEN un miembro en SRCH-01 que pulsa el indicador de favoritos de una fila
- WHEN ejecuta la acción
- THEN la organización distribuidora queda marcada como favorita
- AND el recuento de favoritos en esa fila se incrementa
- AND la posición de esa fila en los resultados no cambia

#### Scenario: inmutabilidad de favoritos por algoritmo
- GIVEN cualquier evento de actividad en la plataforma (acuerdo alcanzado,
  volumen de transacciones, antigüedad del miembro)
- WHEN el sistema procesa el evento
- THEN ningún favorito es creado, modificado ni eliminado automáticamente
- AND solo la acción explícita del usuario puede modificar su lista de favoritos

---

### Requirement: preference-learning
El sistema SHALL aprender las preferencias de búsqueda del miembro (países
habituales y marcas frecuentes) a partir de metadatos de comportamiento,
sin incluir en ningún caso datos comerciales cifrados, y SHALL permitir al
miembro revisar, editar y reiniciar su perfil de preferencias desde
Ajustes → Asistente VERA.
[Origen: Módulo 03 v1.6, sección 8; RNG-SRCH-09]

#### Scenario: visualización y edición de preferencias
- GIVEN un miembro que accede a Ajustes → Asistente VERA
- WHEN visualiza su perfil de preferencias
- THEN puede ver y editar regiones preferidas, marcas habituales y lista
  de favoritos

#### Scenario: reinicio de aprendizaje
- GIVEN un miembro que pulsa "Reiniciar aprendizaje"
- WHEN confirma la acción explícitamente
- THEN el sistema elimina las regiones y marcas aprendidas
- AND la lista de favoritos NO se ve afectada

---

## Out of Scope
- Publicación o gestión del inventario propio
  (capability inventory-management).
- Apertura, gestión y cifrado de hilos de mensajería y tarjetas de consulta
  (capability messaging-and-negotiation — boundary en "Consultar"/"Contactar").
- Directorio de Organizaciones con búsqueda por nombre/país
  (capability organization-directory).
- Ordenación por precio (unit_price cifrado E2EE, no indexable server-side).
- Ordenación por coste logístico / landed cost (diferido a V2 — Módulo 05 v2.0).
- Consultas de mercado agregadas con histórico
  (diferidas a 90 días post-lanzamiento).
- Modo TIERED de visibilidad (diferido a V2).

---

## Cross-Capability References
- `inventory-management` — el índice de búsqueda consume el inventario PUBLISHED
  de esta capability, incluyendo indicadores de frescura y reglas de visibilidad
  aplicadas server-side antes de devolver resultados.
- `messaging-and-negotiation` — las acciones "Consultar", "Contactar" y
  "Consultar Seleccionados" invocan esta capability. El boundary es:
  esta capability ejecuta la selección y dispara la acción; messaging-and-negotiation
  gestiona la tarjeta de consulta, el hilo y el cifrado E2EE del contenido.
  (Resolución de GAP-004.)
- `organization-onboarding` — solo miembros en estado ACTIVE pueden ejecutar
  búsquedas y crear watchers.

---

## Open Questions
- GAP-004: CERRADO por este spec. El boundary entre conversational-search y
  messaging-and-negotiation en "Consultar Seleccionados" queda definido en
  Cross-Capability References: la selección y el disparo de la acción pertenecen
  a esta capability; la gestión del hilo, tarjeta y cifrado pertenecen a
  messaging-and-negotiation.