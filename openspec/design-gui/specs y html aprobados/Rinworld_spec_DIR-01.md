# Spec de Pantalla — `DIR-01` · Directorio de Organizaciones

> **Nota de codificación:** Esta pantalla corresponde a `MSG-05` en el Inventario Maestro de Pantallas v1.1. Se usa el código `DIR-01` en los specs de diseño para evitar confusión con las pantallas de mensajería MSG-01 a MSG-04.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | DIR-01 (= MSG-05) |
| Nombre | Directorio de Organizaciones |
| Módulo | 05 — Directorio (capability organization-directory) |
| Referencia funcional | Inventario Maestro v1.1 § 5.6 · Módulo 04 v1.5 § 8.5.1 · spec organization-directory: directory-table, directory-filtering, directory-sorting, directory-access-from-vera |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Empresas**
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde el menú principal al mismo nivel que Búsqueda y Foros

---

## 3. Panel de contenido

### Eyebrow
```
Directorio de Organizaciones
```

### Título de la pantalla
```
Empresas
```

### Subtítulo
```
Todas las organizaciones activas en Bearingworld.io. Los datos de contacto son públicos para todos los miembros.
```

---

### Componentes presentes

**Barra de filtros (encima de la tabla)**

Dos controles en línea, combinables entre sí:

| Control | Tipo | Placeholder | Field hint |
|---|---|---|---|
| Filtro por país | select | `Todos los países` | Lista ISO 3166-1 |
| Búsqueda por nombre | text input | `Buscar organización...` | Búsqueda server-side al pulsar Enter o icono lupa. Coincidencia parcial en el nombre. |

Botón texto plano: `Limpiar filtros` — visible solo cuando hay algún filtro activo.

**Tabla de resultados**

Columnas en orden fijo:

| Nº | Columna | Tipo | Notas |
|----|---|---|---|
| 1 | Nombre | Enlace · Inter 500 · 13px | Enlace a DIR-02 (ficha pública MSG-04). Reordenable. Orden por defecto: alfabético ascendente |
| 2 | País | Badge monoespaciado · IBM Plex Mono · 11px | Código ISO 2 letras. Reordenable |
| 3 | Teléfono | Inter 400 · 13px | Teléfono de contacto público. No reordenable |
| 4 | Email | Inter 400 · 13px | Email de contacto público. No reordenable |
| 5 | Favoritos | Brass · ★ + recuento | Reordenable |

**Nota sobre la columna Dirección:** eliminada en v1.1 — no aporta valor en formato tabla compacta. La dirección completa sigue visible en la ficha individual DIR-02.

**Ordenación:** Al pulsar cualquier cabecera reordenable, la tabla se ordena por esa columna. Al volver a pulsarla, invierte el sentido. La dirección del orden se indica con un icono de flecha en la cabecera activa.

**Paginación** bajo la tabla: 50 organizaciones por página, navegación numérica. Server-side.

**Solo se muestran organizaciones en estado ACTIVE** — las SUSPENDED o PENDING_REVIEW no aparecen en ningún caso.

---

### Datos de ejemplo

```
Filtros: ninguno activo
Orden: Nombre A→Z (por defecto)

Tabla (5 primeras filas de ejemplo):
  Acme Bearings Ltd          · UK · +44 20 7946 0123 · info@acmebearings.co.uk · ★ 3
  Distribuciones Ruiz SL     · ES · +34 963 456 789  · info@distribucionesruiz.es · ★ 12
  NSK Europe Ltd             · DE · +49 211 5288 0   · contact@nskeurope.de      · ★ 21
  NTN-SNR Roulements         · FR · +33 4 50 65 72 72· contact@ntn-snr.fr        · ★ 8
  Rodamientos del Sur SL     · ES · +34 954 123 456  · info@rodamientosdelsur.es · ★ 5
```

---

## 4. Formulario

No aplica. DIR-01 es una pantalla de navegación y consulta, no de entrada de datos.

Los filtros (país + nombre) no constituyen formulario — son controles de filtrado en tiempo real / server-side.

---

## 5. Panel VERA

**Estado:** Activa — modo directorio.

**Subtítulo del panel:** `Agente del directorio`

**Conversación tipo:**

> **VERA dice (mensaje inicial):**
> Aquí puedes encontrar todas las organizaciones activas en Bearingworld.io. Puedes filtrar por país o buscar por nombre, o pedirme a mí directamente que te encuentre una empresa concreta.
>
> **Usuario dice:**
> Muéstrame las organizaciones de Polonia
>
> **VERA responde:**
> Filtrando por Polonia — aquí tienes las organizaciones activas con sede en PL.
> [Aplica automáticamente el filtro de país = PL sobre la tabla]
>
> **Usuario dice:**
> Busca la ficha de NSK Europe
>
> **VERA responde:**
> He encontrado NSK Europe Ltd (DE). ¿Quieres que abra su ficha directamente?

---

## 6. Estados especiales

**Sin resultados para los filtros aplicados:**
- Tabla vacía con mensaje: `No hemos encontrado organizaciones que coincidan con los filtros aplicados.`
- Botón: `Limpiar filtros`
- VERA ofrece: `¿Quieres que pruebe con un país o nombre diferente?`

**Búsqueda por nombre vía VERA con resultado único:**
- VERA ofrece directamente abrir la ficha (DIR-02) sin pasar por la tabla

**Directorio vacío (sin organizaciones ACTIVE):**
- Solo posible en entornos de prueba — no aplica en producción

---

## 7. Notas y excepciones al sistema base

- Los datos de contacto (email y teléfono) son **visibles para todos los miembros sin restricción**, independientemente de la configuración de visibilidad de inventario de cada organización. Las reglas de exclusión de inventario no afectan en ningún caso al directorio.
- La columna **Dirección** fue eliminada de la tabla en v1.1 del Inventario de Pantallas — no debe añadirse aquí. Sigue visible en DIR-02 (ficha individual).
- Ítem activo en nav: **Empresas** — este es el nombre visible en el menú, aunque el código de pantalla sea DIR-01/MSG-05.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec DIR-01 · v1.0 · Bearingworld.io · Junio 2026*
