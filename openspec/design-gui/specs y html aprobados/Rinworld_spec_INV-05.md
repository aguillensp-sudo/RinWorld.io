


---
---

# Spec de Pantalla — `INV-05` · Perfiles de Mapeo Guardados

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-05 |
| Nombre | Perfiles de Mapeo Guardados |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.5 · Módulo 02 v1.3 § 5 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Inventario**
- Accesible desde Configuración → Inventario → Perfiles de mapeo

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Perfiles de mapeo de columnas
```

### Subtítulo
```
Cuando subes un archivo con una estructura conocida, el perfil se aplica automáticamente y no es necesario el paso de confirmación.
```

---

### Componentes presentes

**Lista de perfiles guardados**

Una tarjeta por perfil:

| Elemento | Descripción |
|---|---|
| Nombre del perfil | Inter 500 · 14px |
| Mapeo resumen | IBM Plex Mono · 11px · muestra las 4 columnas obligatorias mapeadas |
| Fecha de creación | Steel Mist · 12px |
| Última vez usado | Steel Mist · 12px |
| Acciones | `Editar nombre` · `Eliminar` |

**Estado vacío (sin perfiles):**
- Mensaje: `Todavía no tienes perfiles de mapeo guardados.`
- Texto explicativo: `Cuando subas un archivo y guardes el mapeo como perfil, aparecerá aquí para uso futuro.`

---

### Datos de ejemplo

```
Perfil 1: "Formato Excel mensual"
  Mapeo: Ref. → part_number · Fabricante → brand · Uds. → quantity · País → location_country
  Creado: 15 jun 2026
  Último uso: Hace 2 días

Perfil 2: "Export ERP Navision"
  Mapeo: ITEM_CODE → part_number · VENDOR → brand · QTY_ON_HAND → quantity · COUNTRY → location_country
  Creado: 3 jun 2026
  Último uso: Hace 9 días
```

---

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint |
|----|---|---|---|---|---|
| 1 | Nombre del perfil (al editar) | text | S | `Ej: Formato Excel mensual` | `Mín 3 / máx 50 caracteres` |

---

## 5. Panel VERA

**Subtítulo:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice:**
> Tienes 2 perfiles guardados. Cuando subas un archivo, comparo su estructura con estos perfiles — si hay coincidencia, aplico el mapeo automáticamente y te llevo directamente al resultado.

---

## 6. Estados especiales

**Eliminación de perfil:**
- Modal de confirmación: `¿Eliminar el perfil "[nombre]"? Esta acción no se puede deshacer.`
- Botón: `Eliminar` (primario) + `Cancelar`

---

## 7. Prioridad de construcción

- [ ] **Baja** — funcionalidad de conveniencia.

---

*Spec INV-05 · v1.0 · Bearingworld.io · Junio 2026*

---
---

<!--
## ⚠️ ANÁLISIS DE INCONSISTENCIA — Junio 2026

### Problema detectado
Este spec usa el código INV-05 para "Perfiles de Mapeo Guardados", pero en el
Inventario Maestro de Pantallas v1.1 (§ 3.5) el código INV-05 está asignado a
una pantalla completamente distinta: **"Configuración de Carpeta Monitorizada"**
(agente de escritorio CAN-03 que monitoriza una carpeta local y sube archivos automáticamente).

### INV-05 real (Carpeta Monitorizada) está diferido a V2
El spec funcional de inventory-management (`spec.md`) lo declara explícitamente
en Out of Scope: *"Desktop agent CAN-03 / carpeta monitorizada (diferido a V2)."*
El código INV-05 queda por tanto reservado para V2 y no se construye en V1.

### ¿Tiene necesidad real la funcionalidad "Perfiles de Mapeo Guardados"?
Sí. El spec funcional (`ai-column-mapping`) exige explícitamente que el sistema
permita guardar mapeos como perfiles reutilizables. Hay un campo "Guardar como
perfil" en INV-02 y un selector "Perfil de mapeo por defecto" en INV-04.
Sin embargo, el Inventario Maestro no asignó pantalla propia para gestionar esos
perfiles, lo que sugiere que se contempló como funcionalidad integrada dentro
de INV-04 (Configuración del Canal Email), no como pantalla independiente.

### Decisión de producto
- Este spec (INV-05 = Perfiles de Mapeo) queda **retirado** por código incorrecto.
- La gestión de perfiles se integra como sección dentro de INV-04 en V1.
- Si en el futuro se decide darle pantalla propia, se le asignará el código
  INV-06 (libre) y se actualizará el Inventario Maestro.
- El código INV-05 permanece reservado para "Configuración de Carpeta Monitorizada" (V2).
-->

