# Spec de Pantalla — `FORO-03` · Vista de un Hilo

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | FORO-03 |
| Nombre | Vista de un Hilo |
| Módulo | 08 — Foro de la Comunidad |
| Referencia funcional | Módulo 08 v1.1 §§ 4.3, 4.4, 4.5 · RNG-FORO-03 · RNG-FORO-05 · RNG-FORO-06 · RNG-FORO-07 · CA-FORO-03 a CA-FORO-07 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Foros**
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde FORO-02 al hacer clic en el título de un hilo

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 08 · Foro de la Comunidad
```

### Breadcrumb de navegación
```
Foros › [Nombre de categoría] › [Título del hilo truncado]
```
IBM Plex Mono · 11px · uppercase · Steel Mist. "Foros" enlaza a FORO-01 · "[Nombre de categoría]" enlaza a FORO-02.

### Título de la pantalla
```
[Título completo del hilo]
```

---

### Aviso de confidencialidad

Mismo bloque brass permanente que en FORO-01 y FORO-02 — visible en todas las pantallas del Módulo 08.

---

### Componentes presentes

**Publicación inicial del hilo**

| Elemento | Descripción |
|---|---|
| Organización autora | Inter 500 · 13px · ink + badge de país (ISO 2 letras · IBM Plex Mono) |
| Timestamp de creación | IBM Plex Mono · 11px · uppercase · Steel Mist |
| Contenido | Inter 400 · 15px · ink · line-height 1.65 |
| Reacciones | Botón `👍 X` — el usuario puede pulsar para reaccionar o quitar su reacción · contador actualiza inmediatamente (CA-FORO-05) |
| Acciones (solo propias) | `Editar` · `Eliminar` — visibles únicamente si la publicación pertenece a la organización del usuario (CA-FORO-06) |

**Lista de respuestas**

Listadas cronológicamente debajo de la publicación inicial. Cada respuesta con los mismos elementos que la publicación inicial: organización autora · timestamp · contenido · reacciones · acciones propias.

**Contador de respuestas** sobre la lista: `X respuestas`

**Campo de respuesta (al pie del hilo)**

- Textarea: `Escribe tu respuesta...`
- Texto secundario bajo el textarea: `Tu respuesta será visible para todos los miembros con la identidad de tu organización.`
- VERA puede ayudar a redactar si el usuario lo pide desde el panel (sección 5)
- Botón primario: `Publicar respuesta`
- El botón está deshabilitado mientras el textarea está vacío

---

### Formulario de nueva respuesta — detalle de campos

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Cuerpo de la respuesta | textarea | S | `Escribe tu respuesta...` | `Visible para todos los miembros con la identidad de tu organización` | Mín 1 carácter · máx 10.000 caracteres |

**Botón:** `Publicar respuesta`

---

### Flujo de creación de hilo (FL-FORO-01)

Cuando el usuario llega a esta pantalla desde el botón `Crear hilo` de FORO-02, la pantalla se muestra en **modo creación** con los campos de título y cuerpo vacíos:

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Título del hilo | text | S | `Escribe un título claro y descriptivo` | `Mín 5 / máx 150 caracteres` | Mín 5 · máx 150 |
| 2 | Cuerpo del hilo | textarea | S | `Desarrolla tu pregunta o tema aquí...` | `Mín 10 / máx 10.000 caracteres · visible para todos los miembros` | Mín 10 · máx 10.000 |

**Botón:** `Publicar hilo`

Si VERA ha propuesto el título y cuerpo (flujo conversacional), los campos aparecen **pre-rellenos con el borrador de VERA** para que el usuario revise y edite antes de publicar. El hilo nunca se publica sin confirmación explícita del usuario (CA-FORO-04).

---

### Datos de ejemplo (hilo existente)

```
Breadcrumb: Foros › Referencias técnicas › Equivalencia FAG 6205-2RS ↔ NSK

Título: Equivalencia FAG 6205-2RS ↔ NSK

Publicación inicial:
  SKF Nordic AB · SE · hace 5h
  "Hola a todos. Tenemos un cliente que pide específicamente NSK pero solo tenemos el 6205-2RS de FAG en stock.
  ¿Alguien sabe el código NSK equivalente? Gracias de antemano."
  👍 5  [Editar] [Eliminar] ← solo visible para SKF Nordic AB

Respuestas (3):
  Respuesta 1 · Rodamientos del Sur SL · ES · hace 4h
  "El equivalente NSK es el 6205DDU. Intercambiable directamente."
  👍 3

  Respuesta 2 · NSK Europe Ltd · DE · hace 3h
  "Confirmo lo que dice Rodamientos del Sur. 6205DDU es la referencia correcta."
  👍 7

  Respuesta 3 · Timken Europe GmbH · DE · hace 1h
  "También podéis usar el 6205LLB si necesitáis el cierre tipo LLB (más hermético)."
  👍 2

Campo de respuesta: [vacío]
```

---

## 4. Formulario

Ver sección 3 — detalle de campos de respuesta y de creación de hilo nuevo.

---

## 5. Panel VERA

**Estado:** Activa — modo foro, hilo activo.

**Subtítulo del panel:** `Agente del foro`

**Conversación tipo (hilo existente):**

> **VERA dice (al entrar en el hilo):**
> Estás en un hilo sobre equivalencias de la referencia 6205-2RS. Hay 3 respuestas. ¿Quieres que te ayude a redactar una respuesta o que te resuma el hilo?
>
> **Usuario dice:**
> Resume el hilo, es muy largo
>
> **VERA responde:**
> Resumen: SKF Nordic AB pregunta por el equivalente NSK del FAG 6205-2RS. Los miembros coinciden en que el equivalente directo es el NSK 6205DDU. Timken apunta también el 6205LLB como alternativa con mayor hermeticidad.

**Conversación tipo (creación de hilo):**

> **Usuario dice:**
> Ayúdame a responder a este hilo
>
> **VERA responde:**
> ¿Qué quieres aportar? Cuéntame y te preparo un borrador para que lo revises antes de publicar.

---

## 6. Estados especiales

**Modo creación de hilo (llegando desde FORO-02 → Crear hilo):**
- El título de la pantalla muestra: `Nuevo hilo en [Nombre de categoría]`
- Los campos de título y cuerpo están vacíos (o pre-rellenos por VERA si viene del flujo conversacional)
- Botón: `Publicar hilo` (deshabilitado hasta que ambos campos tienen contenido mínimo)
- Botón texto plano: `Cancelar` → vuelve a FORO-02 sin publicar nada

**Edición de publicación propia:**
- Al pulsar `Editar`: el contenido de esa publicación se abre en un textarea en línea
- Botón: `Guardar cambios` · Botón texto plano: `Cancelar`
- El cambio se refleja inmediatamente para todos los miembros al guardar

**Eliminación de publicación propia:**
- Modal de confirmación: `¿Eliminar esta publicación? Esta acción es irreversible.`
- Botón: `Eliminar` (primario) + `Cancelar`
- Tras confirmar: la publicación desaparece permanentemente del hilo

**Límite de publicación alcanzado (RNG-FORO-06):**
- Al pulsar `Publicar respuesta` o `Publicar hilo`: botón bloqueado
- Mensaje inline: `Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás publicar en [X minutos].`
- La lectura y las reacciones no se ven afectadas

**Hilo sin respuestas:**
- Tras la publicación inicial: texto centrado `Todavía no hay respuestas. Sé el primero en responder.`
- VERA sugiere: `¿Quieres ayuda para redactar una respuesta?`

---

## 7. Notas y excepciones al sistema base

- El aviso de confidencialidad es **permanente en todas las pantallas del Módulo 08**. En FORO-03 es especialmente importante porque el usuario está a punto de publicar contenido.
- Los botones `Editar` y `Eliminar` **solo son visibles** para publicaciones de la propia organización del usuario. Para publicaciones de terceros no existe ninguna acción disponible (CA-FORO-06). No hay moderación activa ni botón de denuncia (RNG-FORO-05, CA-FORO-07).
- La autoría de cada publicación muestra el **nombre de la organización**, nunca el nombre de la persona individual que escribió (RNG-FORO-03, CA-FORO-03). Internamente el sistema registra qué usuario concreto publicó, pero esta información no es visible para otros miembros.
- Las reacciones son **individuales por usuario**, no por organización (RNG-FORO-07). Dos usuarios de la misma organización pueden reaccionar a la misma publicación y cuentan como dos reacciones distintas.
- Las reacciones **no afectan a ninguna ordenación ni ranking** — son puramente informativas.
- El resumen de VERA en hilos del foro es posible porque el contenido **no está cifrado** — a diferencia de la mensajería E2EE del Módulo 04 donde esta misma función está diferida a V2.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec FORO-03 · v1.0 · Bearingworld.io · Junio 2026*
