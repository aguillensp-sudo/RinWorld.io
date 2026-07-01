# Spec de Pantalla — `PANEL-01` · Mi Panel (dashboard de inicio)

> **Origen:** `Rinworld_dashboard.docx` (instrucción funcional del Product Owner, Junio 2026).

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | PANEL-01 |
| Nombre | Mi Panel — Dashboard de inicio |
| Módulo | Transversal — punto de entrada tras login |
| Referencia funcional | `Rinworld_dashboard.docx` |
| Nav activo | Panel |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Panel**
- Panel de contenido: fondo Cold White `#F1F3F6`

---

## 3. Panel de contenido

### Eyebrow
```
Panel · PANEL-01
```

### Título de la pantalla
```
Mi Panel
```

### Subtítulo
```
Bienvenido, {nombre_usuario}. Hoy es {día_semana} {DD/MM/AAAA}.
```
- `{nombre_usuario}`: nombre del usuario autenticado.
- `{día_semana}` y fecha: calculados en cliente a partir de la fecha del sistema, en español (ej. `martes 30/06/2026`).

---

## 4. Cajas de resumen (grid de tarjetas)

Grid responsive de tarjetas (2 columnas en desktop, 1 en mobile). Cada tarjeta es clicable en su totalidad (cursor pointer, hover con leve elevación).

### 4.1 Resumen de Ofertas

| Atributo | Valor |
|---|---|
| Icono | `ti-tag` |
| Título | `Ofertas` |
| Número grande | Count de ofertas con `offer_status = PENDIENTE` emitidas por la organización (mismo criterio que VND-01, RNG-VND-02) |
| Etiqueta bajo el número | `pendientes de respuesta` |
| Línea de detalle | `Más reciente: {referencia} · {organización} ({fecha})` — de la oferta PENDIENTE con `sent_at` más reciente |
| Click → | Navega a **VND-01** (Vendiendo) |

### 4.2 Resumen de Consultas

| Atributo | Valor |
|---|---|
| Icono | `ti-search` |
| Título | `Consultas` |
| Número grande | Count de consultas enviadas a proveedores (acción "Consultar" / "Consultar seleccionados" en SRCH-01) que aún no tienen respuesta registrada |
| Etiqueta bajo el número | `sin respuesta` |
| Línea de detalle | `Última consulta: {referencia} · {organización}` — de la consulta más reciente sin respuesta |
| Click → | Navega a **SRCH-01** (Comprando) |

### 4.3 Resumen de Inventario

| Atributo | Valor |
|---|---|
| Icono | `ti-package` |
| Título | `Inventario` |
| Línea 1 | `{N} líneas publicadas` — mismo dato que INV-01 § "Líneas publicadas" |
| Línea 2 | `Última publicación: {fecha}` |
| Línea 3 | `{N} visitas (30d)` — mismo dato que INV-01 § "Visitas recibidas" |
| Click → | Navega a **INV-01** (Inventario) |

### 4.4 Hilos

| Atributo | Valor |
|---|---|
| Icono | `ti-messages` |
| Título | `Hilos` |
| Número grande | Count de hilos con al menos un mensaje no leído (mismo criterio de "no leído" que MSG-01) |
| Etiqueta bajo el número | `con mensajes sin leer` |
| Línea de detalle | `Más reciente: {organización} — {estatus del hilo}` — del hilo no leído más reciente |
| Click → | Navega a **MSG-01** (Hilos) |

### 4.5 Cajas adicionales

Implementadas junto con las 4 obligatorias, según autorización explícita del origen funcional para añadir cajas sin aprobación previa:

| Caja | Contenido | Click → |
|---|---|---|
| Cierres del mes | Nº de ofertas ACEPTADAS + consultas resueltas en los últimos 30 días | VND-01 |
| Favoritos recibidos | Nº de veces que la organización fue añadida a favoritos por otros miembros durante el mes | DIR-01/DIR-02 (perfil propio) |

> Estado: **CERRADO** — GAP-007 resuelto, cajas implementadas en el HTML. Pendiente de confirmación del PO sobre la fuente de datos definitiva de "favoritos recibidos" (hoy no existe endpoint específico).

---

## 5. Panel VERA

**Estado:** Activa — modo resumen general.

**Subtítulo del panel:** `Agente de búsqueda`

**Capacidades de VERA en esta pantalla:**

| Acción | Comportamiento |
|---|---|
| Resumir estado global | "¿Cómo va todo?" → VERA responde con un resumen combinando las 4 métricas del panel |
| Navegar por voz/texto | "Llévame a mis ofertas pendientes" → navega a VND-01 |
| Detalle de una métrica | "¿Qué consultas tengo sin respuesta?" → navega a SRCH-01 con filtro aplicado si aplica |

---

## 6. Reglas de negocio

| ID | Regla |
|---|---|
| RNG-PANEL-01 | Todos los contadores de las 4 cajas obligatorias son metadatos — ninguno requiere descifrado E2EE (mismo principio que VND-01 RNG-VND-01). |
| RNG-PANEL-02 | Las 4 cajas son siempre visibles, incluso en valor 0 (ej. "0 pendientes de respuesta"), para reforzar que el dato está actualizado y no ausente. |
| RNG-PANEL-03 | El click en cualquier punto de la tarjeta (no solo el número) dispara la navegación. |

---

## 7. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-PANEL-01 | El subtítulo muestra el nombre del usuario autenticado y la fecha actual del sistema en formato `día_semana DD/MM/AAAA`. |
| CA-PANEL-02 | La caja Ofertas muestra el nº de ofertas PENDIENTES emitidas por la organización y navega a VND-01 al pulsarla. |
| CA-PANEL-03 | La caja Consultas muestra el nº de consultas sin respuesta y navega a SRCH-01 al pulsarla. |
| CA-PANEL-04 | La caja Inventario muestra líneas publicadas, fecha de última publicación y visitas (30d), y navega a INV-01 al pulsarla. |
| CA-PANEL-05 | La caja Hilos muestra el nº de hilos con mensajes no leídos y navega a MSG-01 al pulsarla. |
| CA-PANEL-06 | La pantalla es accesible desde el ítem "Panel" del nav bar y de la sidebar. |

---

## 8. Gaps detectados

| ID | Gap |
|---|---|
| GAP-007 | Cajas adicionales de § 4.5 (cierres del mes, favoritos recibidos) implementadas en el prototipo HTML. "Favoritos recibidos" no tiene endpoint de backend definido todavía — pendiente de confirmación del PO sobre su fuente de datos real. |

---

## 9. Prioridad de construcción

- [ ] **Alta** — es el punto de entrada tras login; depende de VND-01, SRCH-01, INV-01 y MSG-01 ya existentes (solo lectura de sus metadatos).

---

*Spec PANEL-01 · v1.0 · Bearingworld.io · Junio 2026*
