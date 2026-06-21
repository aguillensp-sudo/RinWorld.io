# Arquitectura de Interfaz — Layout de Tres Zonas

Documento de arquitectura transversal. Aplica a toda la plataforma Bearingworld.io,
no es comportamiento de ninguna capability de negocio en particular.

Origen: Módulo 00 — Arquitectura de Interacción IA v1.1, secciones 4 y 9.
Extraído durante la escritura del delta spec de la capability `vera-agent`
(subfase C, junio 2026), al identificarse que estas secciones especifican
diseño de interfaz y puntos de atención técnica transversal, no comportamiento
verificable de una capability concreta.

---

## 1. Modelo mental — jerarquía invertida

La interfaz de Bearingworld.io invierte la jerarquía habitual de una aplicación
web: el agente conversacional VERA es la interfaz primaria, siempre visible y
siempre activa. La UI visual clásica (pantallas, formularios, menús) es la
interfaz secundaria — representa el estado actual y permite interacción directa
cuando es más eficiente que el chat.

Ambas capas coexisten sin exclusión: el usuario puede operar exclusivamente
por chat, exclusivamente por UI visual, o alternar libremente entre ambas en
cualquier momento, incluso a media acción.

---

## 2. Las tres zonas del layout

Esta estructura es consistente en todas las pantallas del sistema, con la
excepción de las pantallas de onboarding (capability `organization-onboarding`),
donde el agente ocupa un rol más guiado y más espacio en pantalla.

| Zona | Posición | Descripción |
|---|---|---|
| **Zona A — Panel de contexto (UI visual)** | Izquierda o centro, 60–70% del ancho | Representación visual del estado actual: resultados de búsqueda, tabla de inventario, hilo de mensajes, configuración de visibilidad, etc. Responde tanto a navegación directa del usuario como a comandos del agente. Cuando VERA ejecuta una acción, el resultado aparece aquí. |
| **Zona B — Agente conversacional** | Derecha, 30–40% del ancho. Siempre visible en desktop. | Panel de VERA. Contiene el historial de la conversación activa y el campo de entrada de texto. Nunca se oculta ni minimiza en desktop. En mobile ocupa pantalla completa con botón de toggle hacia la UI visual. |
| **Zona C — Barra de navegación** | Superior o lateral izquierdo, compacta | Navegación principal: Mi Inventario, Buscar, Mensajes, Alertas, Ajustes. Acceso rápido para usuarios que prefieren navegación clásica. Siempre visible en desktop; colapsa en menú hamburguesa en mobile. |

### 2.1 Detalle del panel del agente (Zona B)

| Elemento | Descripción |
|---|---|
| Campo de entrada | Textarea expandible en la parte inferior del panel. Placeholder contextual según la pantalla activa (ej. en búsqueda: "¿Qué referencia buscas?"). |
| Historial de la sesión | Burbujas de chat estándar — usuario a la derecha, VERA a la izquierda. Persiste mientras la pestaña está abierta (ver Capa 1 de memoria en `vera-agent`). |
| Acciones sugeridas | 2–3 botones de acción rápida bajo cada respuesta que desemboca en una acción posible, para reducir fricción de escritura en las acciones más comunes. |
| Indicador de estado | Punto de color junto al nombre del agente: verde (activo, responde en <2s), amarillo (procesando), gris (sin conexión). Indicador de progreso textual durante acciones complejas ("Buscando en el índice..."). |
| Contexto activo | Línea pequeña sobre el campo de entrada mostrando qué contexto detecta el agente en ese momento (ej. "Contexto: búsqueda de 6205 2RS"). |
| Botón de nueva conversación | Reinicia el historial visible de la sesión. No borra la memoria de perfil de largo plazo (Capa 2 de `vera-agent`). |

### 2.2 Comportamiento en mobile

En dispositivos móviles no hay espacio para mantener Zona A y Zona B visibles
simultáneamente:

- Por defecto, la pantalla muestra la Zona A (UI visual) al navegar a
  cualquier sección.
- Un botón flotante persistente en la esquina inferior derecha (icono del
  agente) abre la Zona B en overlay de pantalla completa.
- Cuando el agente ejecuta una acción con resultado visual, ofrece el botón
  "Ver resultados" que lleva a la Zona A con el resultado ya cargado.
- Las notificaciones push del agente en mobile son concisas: máximo 2 líneas,
  con deep link a la acción relevante.

---

## 3. Implicaciones técnicas para la fase de definición técnica

Esta sección no anticipa decisiones de implementación — marca los puntos de
atención que la arquitectura conversacional introduce, a considerar en la
fase de diseño técnico (`design.md`, fuera del alcance del agente SDD).

| Área | Punto de atención |
|---|---|
| Modelo de IA del agente | Cada acción posible de VERA debe implementarse como herramienta invocable (function calling / tool use). El diseño de estas herramientas es el núcleo de la implementación del agente. |
| Latencia | VERA debe responder en menos de 2 segundos para mantener sensación de conversación natural. Consultas complejas deben mostrar feedback inmediato mientras se procesa la respuesta completa. |
| Streaming de respuestas | Las respuestas deben renderizarse en streaming (token a token) para percepción de respuesta inmediata. |
| Seguridad del agente | VERA actúa con los permisos del usuario autenticado, nunca con permisos de sistema. No puede escalar privilegios (ver requirement `action-audit-logging` en `vera-agent`). |
| Contexto de ventana | El contexto de sesión (Capa 1) ocupa tokens del context window. La purga automática a 24h mitiga el riesgo de saturación; la implementación debe gestionar truncado o summarización de forma transparente para el usuario si fuera necesario. |
| Sincronización con Zona A | Cuando VERA ejecuta una acción que modifica el estado de la plataforma, la Zona A debe actualizarse en tiempo real sin recargar la página — requiere arquitectura de estado reactivo en frontend (contexto compartido entre panel del agente y UI visual). |
| Modelo y costes | Claude (Anthropic) como modelo base — decisión cerrada (QA-A00-06). Claude Sonnet como modelo principal para equilibrio coste/capacidad; Claude Opus para tareas de alta complejidad si se requiere. Presupuesto de referencia ~€29/miembro/año, a recalcular en fase de Definición Técnica con precios actuales de la API. |

---

## 4. Métricas de éxito de la capa conversacional

Métricas a medir desde el lanzamiento para evaluar si la arquitectura
conversacional cumple su propósito. No son requirements de comportamiento,
son objetivos de producto post-lanzamiento.

| Métrica | Objetivo V1 (primeros 90 días) |
|---|---|
| Tasa de adopción del agente (% sesiones con ≥1 mensaje a VERA) | > 60% |
| Tasa de resolución directa (% mensajes resueltos sin navegación manual) | > 70% |
| Tasa de confirmación correcta (acciones irreversibles confirmadas vs. canceladas) | 80–95% |
| Tiempo medio de respuesta (latencia hasta primera palabra, streaming) | < 1,5 segundos |
| Tasa de clarificación (% mensajes clasificados como AMBIGUA) | < 15% |
| NPS de la experiencia conversacional | > 40 |

---

## Referencias cruzadas

- `vera-agent` (capability) — define el comportamiento conversacional de VERA
  que se renderiza dentro de la Zona B descrita en este documento.
- `ADR-001-e2ee-key-backup.md` — decisión de arquitectura criptográfica,
  de naturaleza distinta a este documento (decisión con alternativas
  descartadas vs. especificación de diseño de interfaz ya cerrada).