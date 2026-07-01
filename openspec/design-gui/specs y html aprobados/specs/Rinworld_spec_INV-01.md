# Spec de Pantalla — `INV-01` · Panel de Inventario

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-01 |
| Nombre | Panel de Inventario |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.1 · Módulo 02 v1.3 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Vendiendo**
- Panel de contenido: fondo Cold White `#F1F3F6`
- El formulario/panel llena el 67% disponible (max-width 900px, padding 48px)

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Mi inventario
```

### Subtítulo
```
Gestiona y publica tu stock de rodamientos. Los distribuidores verificados podrán consultarlo en tiempo real.
```

---

### Componentes presentes

**Tarjetas de resumen estadístico (4 tarjetas en fila)**

| Tarjeta | Valor ejemplo | Descripción |
|---|---|---|
| Líneas publicadas | 1.247 | Total de líneas activas en el inventario |
| Líneas desactualizadas | 34 | Líneas sin actualizar en más de 7 días |
| Última actualización | Hace 2 días | Fecha y hora relativa de la última subida |
| Visitas recibidas | 892 | Visitas al inventario en los últimos 30 días |

Las tarjetas con valor crítico (líneas desactualizadas > 0) muestran el número en naranja aviso `#d97706`.

**Sección "Canales de actualización"**

Dos tarjetas lado a lado, cada una representa un canal independiente de carga de inventario:

*Tarjeta izquierda — Subida manual* (icono brass · badge "Siempre disponible"):
- Mini-dropzone embebida con texto `Arrastra tu archivo aquí` / `o haz clic para seleccionar`
- Field hint: `CSV · XLSX · XLS · TSV · TXT · máx. 50 MB`
- Al hacer clic o soltar archivo válido: estado de carga "Analizando archivo…" → redirige a INV-02
- Archivo inválido: error inline dentro de la mini-dropzone

*Tarjeta derecha — Canal email* (icono azul · badge "Activo"):
- Dirección de ingestión única de la organización en campo de solo lectura + botón `Copiar`
- Enlace `Gestionar canal →` → navega a INV-04
- El ERP o sistema externo envía el adjunto a esa dirección; se procesa automáticamente sin intervención

*Fila de visibilidad* (debajo de las tarjetas, ancho completo):
- Icono ojo + "Visibilidad del inventario: Visible para todos los miembros verificados"
- Enlace `Configurar →` → navega a INV-07

**Filtros rápidos (chips en fila)**

Orden fijo:
- `Todos` (activo por defecto)
- `Publicados`
- `Desactualizados`
- `Archivados`

Solo uno activo a la vez. El chip activo muestra fondo azul suave + borde azul.

**Tabla de inventario actual**

Columnas en orden fijo inamovible:

| Nº | Columna | Tipo | Notas |
|----|---|---|---|
| 1 | Referencia | IBM Plex Mono · 12px | Código exacto del rodamiento (part_number) |
| 2 | Marca | Badge gris oscuro | Nombre del fabricante (brand) |
| 3 | Cantidad | Número | Unidades disponibles (quantity) |
| 4 | País | Badge monoespaciado | Código ISO 2 letras (location_country) |
| 5 | Estado | Badge de color | PUBLISHED (verde) · DRAFT (gris) · ARCHIVED (naranja) |
| 6 | Antigüedad | Texto Steel Mist | Días desde uploaded_at. En naranja si > 7 días, rojo si > 30 días |
| 7 | Acciones | Iconos | Archivar · Eliminar |

**Paginación** bajo la tabla: 50 líneas por página, navegación numérica.

**Barra de acciones sobre la tabla:**
- Input de búsqueda: `Buscar por referencia o marca...` — búsqueda server-side, se ejecuta al pulsar **Enter** o el icono de lupa. No es live search (evita peticiones al servidor en cada tecla dado el volumen potencial de hasta 500.000 líneas).
- Botón primario: `Subir nuevo inventario` → mismo comportamiento que zona drag & drop

---

### Datos de ejemplo

```
Tarjetas:
  Líneas publicadas: 1.247
  Desactualizadas: 34
  Última actualización: Hace 2 días
  Visitas (30d): 892

Filtro activo: Todos

Tabla (primeras 5 filas):
  6205-2RS/C3    · SKF    · 850   · ES · PUBLISHED · Hace 2 días
  NU2210-E-TVP2  · FAG    · 120   · ES · PUBLISHED · Hace 9 días [naranja]
   7210-BECBP     · SKF    · 0     · ES · ARCHIVED  · Hace 45 días [rojo]
   6305-ZZ        · NSK    · 340   · ES · PUBLISHED · Hace 2 días
  22316-E        · FAG    · 75    · ES · DRAFT      · Hace 1 día
```

---

## 4. Formulario

No aplica. INV-01 es un panel de visualización y gestión — sin formulario de entrada propio. Las acciones (subida de archivo, filtrado, búsqueda) no constituyen formulario.

---

## 5. Panel VERA

**Estado:** Activa — modo gestión de inventario.

**Subtítulo del panel:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Tu inventario tiene 34 líneas sin actualizar desde hace más de 7 días. Los compradores verán un indicador de aviso en esas referencias. ¿Quieres que te muestre cuáles son?
>
> **Usuario dice:**
> Sí, muéstrame las desactualizadas
>
> **VERA responde:**
> Aquí tienes las referencias con más de 7 días sin actualizar. Las más críticas llevan más de 30 días. Te recomiendo subir un nuevo archivo de inventario para resetear los indicadores.
> [Highlights: NU2210-E-TVP2 · FAG · 9 días / 22316-E1 · FAG · 35 días]

---

## 6. Estados especiales

**Inventario vacío (primer acceso o sin líneas publicadas):**
- Tabla vacía con mensaje centrado: `Todavía no tienes ninguna línea de inventario publicada.`
- Zona de subida prominente con instrucciones de primer uso
- VERA en modo onboarding: explica cómo subir el primer archivo

**Estado de carga (tabla cargando):**
- Spinner en la zona de tabla
- Tarjetas de resumen visibles pero con skeleton loaders en los números

**Filtro "Desactualizados" activo:**
- Solo se muestran líneas con antigüedad > 7 días
- Contador en el chip: `Desactualizados (34)`
- VERA ofrece en el chat: `¿Quieres subir un archivo nuevo para actualizar todas estas líneas a la vez?`

**Error de subida (archivo rechazado):**
- Inline en la zona drag & drop: `Formato no admitido. Sube un archivo CSV, XLSX, XLS, TSV o TXT de máximo 50 MB.`

---

## 7. Notas y excepciones al sistema base

- La columna `condition` (estado del rodamiento) fue eliminada del esquema canónico en v1.1 — no debe aparecer en la tabla ni en ningún formulario relacionado.
- Las tarjetas de estadísticas son de solo lectura — ninguna es clickable ni redirige a otra pantalla.
- El botón `Subir nuevo inventario` y la zona drag & drop tienen el mismo comportamiento: ambos redirigen a INV-02 tras seleccionar un archivo válido.
- La paginación es server-side — no se carga el inventario completo en memoria.

---

## 8. Prioridad de construcción

- [x] **Alta** — pantalla principal de la propuesta de valor para distribuidores vendiendo.

---

*Spec INV-01 · v1.0 · Bearingworld.io · Junio 2026*
