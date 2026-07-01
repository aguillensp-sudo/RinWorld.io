# Spec de Pantalla — `SRCH-03` · Gestión de Watchers

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | SRCH-03 |
| Nombre | Gestión de Watchers |
| Módulo | 03 — Búsqueda Conversacional y Descubrimiento |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 4.3 · Módulo 03 v1.6 §§ 6, 7 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Comprando**
- Panel de contenido: fondo Cold White `#F1F3F6`

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 03 · Búsqueda Conversacional
```

### Título de la pantalla
```
Mis watchers
```

### Subtítulo
```
Los watchers te avisan cuando aparece stock de una referencia que buscas. Cada watcher está activo durante 30 días y puedes renovarlo.
```

---

### Componentes presentes

**Contador de watchers activos**

Badge brass: `X / 50 watchers activos`

**Filtros rápidos (chips en fila)**

- `Todos` (activo por defecto)
- `Activos`
- `Pausados`
- `Disparados`
- `Pendientes de renovación`
- `Expirados`

**Lista de watchers**

Una tarjeta por watcher. Elementos de cada tarjeta:

| Elemento | Descripción |
|---|---|
| Referencia | IBM Plex Mono · 13px · obligatoria |
| Condiciones adicionales | Cantidad mínima (obligatoria) · Marca (opcional) · País (opcional) |
| Estado | Badge de color: ACTIVE (verde) · PAUSED (gris) · TRIGGERED (azul) · PENDIENTE RENOVACIÓN (naranja) · EXPIRED (rojo) |
| Fecha de creación | Steel Mist · 12px |
| Días restantes | Visible solo en estado ACTIVE y PAUSED. En naranja si < 5 días |
| Canal de notificación | Iconos: 🔔 In-app (siempre activo) · ✉ Email (si configurado) |
| Acciones | `Pausar` / `Reactivar` · `Editar` · `Eliminar` |

**Tarjeta en estado PENDIENTE DE RENOVACIÓN:**
- Borde izquierdo naranja brass
- Dos botones prominentes: `Mantener activo 30 días más` (primario) · `Dejar que expire` (texto plano)

**Tarjeta en estado TRIGGERED:**
- Borde izquierdo azul
- Texto informativo: `Stock detectado el [fecha] — [nombre del distribuidor] · [cantidad] u · [país]`
- Botón: `Ver resultados` → redirige a SRCH-01 con los filtros del watcher precargados

---

### Datos de ejemplo

```
Watchers: 4 / 50 activos
Filtro: Todos

Watcher 1 — 6308-ZZ
  Cantidad mín: 100 u · Marca: cualquiera · País: Europa
  Estado: ACTIVE [verde]
  Creado: Hace 3 días · 27 días restantes
  Canales: In-app · Email

Watcher 2 — NU2210-E-TVP2
  Cantidad mín: 50 u · Marca: FAG · País: cualquiera
  Estado: TRIGGERED [azul]
  Stock detectado: Hace 2 horas — Schaeffler Iberia SL · 120 u · ES
  Botón: [Ver resultados]

Watcher 3 — 22316-E
  Cantidad mín: 20 u · Marca: cualquiera · País: cualquiera
  Estado: PENDIENTE RENOVACIÓN [naranja]
  Expira en: 2 días
  Botones: [Mantener activo 30 días más] [Dejar que expire]

Watcher 4 — 7210-BECBP
  Cantidad mín: 10 u · Marca: SKF · País: ES
  Estado: PAUSED [gris]
  Creado: Hace 18 días · 12 días restantes (pausado)
```

---

## 4. Formulario — Editar watcher

Al pulsar `Editar` en una tarjeta se abre un panel inline de edición:

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Referencia | text | S | `Ej: 6308-ZZ` | `Código exacto del rodamiento` | Mín 2 caracteres |
| 2 | Cantidad mínima | number | S | `Ej: 100` | `Unidades mínimas para que se dispare` | Entero positivo |
| 3 | Marca | text / select | N | `Cualquier marca` | `Opcional — deja vacío para cualquier fabricante` | — |
| 4 | País | select | N | `Cualquier país` | `Opcional — deja vacío para cualquier origen` | Lista ISO 3166-1 |
| 5 | Canal email | checkbox | N | — | `Recibirás también una notificación por email` | — |

**Botón:** `Guardar cambios` · Botón texto plano: `Cancelar`

---

## 5. Panel VERA

**Estado:** Activa — modo gestión de watchers.

**Subtítulo del panel:** `Agente de búsqueda`

**Conversación tipo:**

> **VERA dice (al cargar):**
> Tienes 4 watchers activos. El watcher de NU2210-E-TVP2 se ha disparado — Schaeffler Iberia tiene 120 unidades de FAG en stock. ¿Quieres ver los resultados o enviarles una consulta directamente?
>
> **Usuario dice:**
> Renueva el watcher de 22316-E
>
> **VERA responde:**
> Watcher de 22316-E renovado por 30 días más. Te avisaré cuando haya stock disponible con al menos 20 unidades.

---

## 6. Estados especiales

**Sin watchers (primer acceso):**
- Mensaje centrado: `Todavía no tienes ningún watcher activo.`
- Texto explicativo: `Crea un watcher desde la búsqueda cuando no encuentres stock de una referencia — te avisaremos cuando aparezca.`
- VERA sugiere: `¿Quieres que te ayude a crear tu primer watcher?`

**Límite de 50 watchers activos alcanzado:**
- Badge en rojo: `50 / 50 watchers activos`
- Al intentar crear uno nuevo desde SRCH-01 o SRCH-02: VERA informa del límite y ofrece gestionar los existentes.

**Eliminación de watcher:**
- Modal de confirmación: `¿Eliminar el watcher de [referencia]? Esta acción no se puede deshacer.`
- Botón: `Eliminar` (primario) + `Cancelar`
- Acción irreversible — no hay papelera ni recuperación.

**Watcher disparado (TRIGGERED) — notificación in-app:**
- Badge rojo en el ítem de nav `Comprando`: recuento de watchers disparados pendientes de ver
- VERA envía mensaje proactivo en el chat con el resumen del disparo

---

## 7. Notas y excepciones al sistema base

- Referencia y cantidad son los **dos únicos campos obligatorios** para crear un watcher (v1.1). Marca y país siguen siendo opcionales.
- El sistema evalúa cada watcher activo contra el stream de eventos `stock.updated` en menos de 5 segundos desde que el distribuidor publica.
- Por defecto, un watcher disparado **no vuelve a notificar** aunque la condición siga cumpliéndose — es una notificación de un solo disparo.
- El canal in-app siempre está activo y no es configurable. El canal email es opcional y se activa por watcher.
- El límite de notificaciones de watchers disparados es de 5 por usuario y día natural — a partir de la sexta se agrupan en un resumen.
- Un watcher pausado no pierde su contador de días — el tiempo transcurrido mientras está pausado descuenta igualmente hacia la expiración.

---

## 8. Prioridad de construcción

- [x] **Alta** — funcionalidad diferencial de la plataforma para compradores.

---

*Spec SRCH-03 · v1.0 · Bearingworld.io · Junio 2026*
