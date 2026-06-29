# Spec de Pantalla — `FORO-02` · Lista de Hilos de una Categoría

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | FORO-02 |
| Nombre | Lista de Hilos de una Categoría |
| Módulo | 08 — Foro de la Comunidad |
| Referencia funcional | Módulo 08 v1.1 § 4.2 · RNG-FORO-01 · RNG-FORO-03 · RNG-FORO-06 · CA-FORO-01 · CA-FORO-03 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Foros**
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde FORO-01 al hacer clic en una tarjeta de categoría

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 08 · Foro de la Comunidad
```

### Breadcrumb de navegación
```
Foros › [Nombre de la categoría]
```
IBM Plex Mono · 11px · uppercase · Steel Mist. "Foros" es enlace a FORO-01.

### Título de la pantalla
```
[Nombre de la categoría]
```
Ej: `Referencias técnicas`

### Subtítulo
```
[Descripción de la categoría]
```
Ej: `Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias.`

---

### Aviso de confidencialidad

Mismo bloque brass permanente que en FORO-01 — visible en todas las pantallas del Módulo 08.

---

### Componentes presentes

**Barra de acciones (encima de la lista)**

- Input de búsqueda: `Buscar en esta categoría...` — filtra hilos por coincidencia en el título al pulsar Enter o el icono de lupa (búsqueda server-side, no live search)
- Botón primario: `Crear hilo` → abre el flujo FL-FORO-01 (VERA asiste la redacción o el usuario escribe directamente)

**Lista de hilos**

Una fila por hilo, ordenada por actividad reciente descendente (el hilo con la respuesta más reciente aparece primero):

| Elemento | Descripción |
|---|---|
| Título del hilo | Inter 500 · 14px · ink · enlace a FORO-03 |
| Organización autora | Inter 400 · 12px · Steel Mist |
| Badge de categoría | IBM Plex Mono · 10px · uppercase · solo visible si se llega desde hilos recientes de FORO-01 |
| Contador de respuestas | `X respuestas` · Steel Mist · 12px |
| Contador de reacciones | `👍 Y` · Steel Mist · 12px |
| Tiempo del último mensaje | Relativo · IBM Plex Mono · 11px · Steel Mist · ej. `hace 2h` |

**Paginación** bajo la lista: 20 hilos por página, navegación numérica. Server-side.

---

### Datos de ejemplo

```
Categoría: Referencias técnicas
Descripción: Dudas y discusión sobre equivalencias entre marcas, especificaciones técnicas, sustitución de referencias.

Hilos (4):
  Equivalencia FAG 6205-2RS ↔ NSK           · SKF Nordic AB          · 3 respuestas · 👍 5 · hace 5h
  ¿Alguien sabe el equivalente NSK de 22316-E?  · Rodamientos del Sur SL  · 1 respuesta  · 👍 2 · hace 1 día
  Diferencia entre 6205-2RS y 6205-2RS/C3    · NTN-SNR Roulements     · 7 respuestas · 👍 12 · hace 2 días
  Sustitución NU2210-E por alternativa        · Timken Europe GmbH     · 0 respuestas · 👍 0 · hace 3 días
```

---

## 4. Formulario

No aplica como formulario propio — el formulario de creación de hilo se gestiona en el flujo FL-FORO-01 (ver sección de estados especiales y FORO-03).

---

## 5. Panel VERA

**Estado:** Activa — modo foro, categoría activa.

**Subtítulo del panel:** `Agente del foro`

**Conversación tipo:**

> **VERA dice (al entrar en la categoría):**
> Estás en Referencias técnicas. Hay 4 hilos activos. ¿Quieres abrir uno nuevo o buscar algo concreto?
>
> **Usuario dice:**
> Quiero abrir un hilo preguntando por el equivalente de 6308-ZZ en NSK
>
> **VERA responde:**
> Perfecto. Te propongo este título y cuerpo — revísalos antes de publicar:
>
> **Título:** ¿Equivalente NSK del rodamiento 6308-ZZ?
> **Cuerpo:** Hola a todos. Estoy buscando el equivalente NSK del 6308-ZZ para un cliente que necesita esa marca específicamente. ¿Alguien lo sabe o tiene experiencia con esta sustitución? Gracias.
>
> ¿Lo publicamos tal cual o quieres modificar algo?

---

## 6. Estados especiales

**Categoría vacía (sin hilos):**
- Mensaje centrado: `Todavía no hay hilos en esta categoría. ¡Sé el primero en abrir uno!`
- Botón `Crear hilo` prominente
- VERA sugiere: `Esta categoría acaba de abrirse. ¿Quieres crear el primer hilo?`

**Búsqueda sin resultados:**
- Mensaje: `No hemos encontrado hilos que coincidan con "[texto buscado]".`
- Botón texto plano: `Limpiar búsqueda`

**Límite de publicación alcanzado (RNG-FORO-06):**
- Al pulsar `Crear hilo`: el botón no abre el formulario
- Mensaje inline: `Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás crear un nuevo hilo en [X minutos].`
- La lectura y navegación no se ven afectadas

---

## 7. Notas y excepciones al sistema base

- El aviso de confidencialidad es permanente en todas las pantallas del Módulo 08.
- La búsqueda dentro de la categoría es **solo por título de hilo** — no busca en el contenido de las respuestas.
- La ordenación es **siempre por actividad reciente** (respuesta más reciente primero) — no hay opción de cambiar el orden en V1. Las reacciones no influyen en la ordenación (RNG-FORO-07).
- El badge de categoría en cada fila solo es visible cuando el usuario llega desde la sección "hilos recientes" de FORO-01 (donde se mezclan hilos de todas las categorías). Dentro de FORO-02 (una sola categoría), el badge no aporta información y no se muestra.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec FORO-02 · v1.0 · Bearingworld.io · Junio 2026*
