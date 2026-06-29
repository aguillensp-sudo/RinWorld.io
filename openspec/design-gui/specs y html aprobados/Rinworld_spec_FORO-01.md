# Spec de Pantalla — `FORO-01` · Lista de Categorías del Foro

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | FORO-01 |
| Nombre | Lista de Categorías del Foro |
| Módulo | 08 — Foro de la Comunidad |
| Referencia funcional | Módulo 08 v1.1 § 4.1 · RNG-FORO-01 · RNG-FORO-04 · CA-FORO-01 · CA-FORO-02 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Foros**
- Panel de contenido: fondo Cold White `#F1F3F6`
- El contenido del foro llena el panel del 67%

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 08 · Foro de la Comunidad
```

### Título de la pantalla
```
Foro de la Comunidad
```

### Subtítulo
```
Un espacio de discusión pública entre miembros. El contenido del foro no está cifrado — es visible para toda la comunidad.
```

---

### Aviso de confidencialidad (bloque informativo permanente)

Bloque brass con icono de información — siempre visible en la parte superior del foro:

> El contenido publicado en el Foro es texto plano, visible para todos los miembros de Bearingworld.io. **Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.** Para conversaciones privadas, usa la mensajería cifrada.

---

### Componentes presentes

**Sección de hilos recientes (parte superior)**

Lista horizontal o vertical con los últimos 5 hilos con actividad reciente de cualquier categoría. Por cada hilo: título (enlace) · categoría badge · organización autora · tiempo desde el último mensaje.

Esta sección es opcional y se oculta si no hay actividad reciente (foro recién lanzado).

**Grid de tarjetas de categoría (parte principal)**

Una tarjeta por categoría activa. Las cuatro categorías de lanzamiento:

| Categoría | Descripción |
|---|---|
| General | Conversación abierta del sector, presentaciones, noticias relevantes para la comunidad. |
| Referencias técnicas | Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias. |
| Logística y aduanas | Experiencias e intercambio de información sobre transporte, aranceles, incoterms. |
| Plataforma y soporte | Preguntas sobre el funcionamiento de Bearingworld.io, sugerencias de mejora, problemas técnicos. |

Cada tarjeta muestra:
- Nombre de la categoría (Inter 500 · 15px · ink)
- Descripción breve (Inter 400 · 13px · Steel Mist)
- Contador de hilos: `X hilos`
- Contador de publicaciones: `Y publicaciones`
- Última actividad: `Última actividad hace Z` (Steel Mist · IBM Plex Mono · 11px · uppercase)

Al hacer clic en una tarjeta → redirige a FORO-02 (lista de hilos de esa categoría).

---

### Datos de ejemplo

```
Hilos recientes:
  ¿Alguien tiene experiencia con aranceles a Marruecos?  · Logística y aduanas  · Rodamientos del Sur SL · hace 2h
  Equivalencia FAG 6205-2RS ↔ NSK  · Referencias técnicas  · SKF Nordic AB · hace 5h
  Bienvenidos al foro de Bearingworld.io  · General  · Bearingworld.io · hace 3 días

Categorías:
  General           · 12 hilos · 47 publicaciones · Última actividad hace 2 días
  Referencias técnicas · 8 hilos  · 31 publicaciones · Última actividad hace 5 horas
  Logística y aduanas  · 5 hilos  · 18 publicaciones · Última actividad hace 2 horas
  Plataforma y soporte · 3 hilos  · 9 publicaciones  · Última actividad hace 3 días
```

---

## 4. Formulario

No aplica. FORO-01 es una pantalla de solo lectura y navegación.

---

## 5. Panel VERA

**Estado:** Activa — modo foro.

**Subtítulo del panel:** `Agente del foro`

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Aquí puedes participar en la conversación de la comunidad. Recuerda que todo lo que escribas en el foro es visible para todos los miembros — no aplican las garantías de privacidad de la mensajería.
>
> **Usuario dice:**
> ¿Tengo respuestas nuevas en el foro?
>
> **VERA responde:**
> Tienes 2 hilos propios con respuestas nuevas y 1 hilo que sigues con actividad reciente. ¿Quieres que te lleve a alguno?

---

## 6. Estados especiales

**Estado vacío (foro recién lanzado):**
- La sección de hilos recientes no se muestra
- Las tarjetas de categoría muestran `0 hilos · 0 publicaciones`
- VERA sugiere: `El foro acaba de abrirse. ¿Quieres ser el primero en abrir un hilo?`

**Organización SUSPENDED intentando acceder (RNG-FORO-02):**
- Nunca llega a FORO-01 — redirigida a la pantalla de suspensión del Módulo 07

**Usuario sin sesión (RNG-FORO-01):**
- Nunca llega a FORO-01 — redirigido a login

---

## 7. Notas y excepciones al sistema base

- El aviso de confidencialidad es un componente permanente y obligatorio en todas las pantallas del Módulo 08 (FORO-01, FORO-02, FORO-03). No es opcional ni ocultable por el usuario.
- Las categorías son datos de configuración — no valores fijos en el código. El equipo de producto puede añadir, renombrar o archivar categorías sin despliegue. La pantalla refleja siempre las categorías activas en ese momento.
- Las tarjetas de categoría se ordenan por el criterio que defina el equipo de producto desde configuración — en el lanzamiento, por orden fijo definido manualmente.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec FORO-01 · v1.0 · Bearingworld.io · Junio 2026*
