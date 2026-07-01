

# Spec de Pantalla — `INV-07` · Configuración de Visibilidad del Inventario

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-07 |
| Nombre | Configuración de Visibilidad del Inventario |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.6 · Módulo 02 v1.3 § 6 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Inventario**
- Accesible desde INV-01 → botón "Visibilidad" o desde Configuración → Inventario → Visibilidad

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Visibilidad del inventario
```

### Subtítulo
```
Controla quién puede ver tu stock en Bearingworld.io. El modo se aplica a todo tu inventario de forma inmediata.
```

---

### Componentes presentes

**Selector de modo de visibilidad (radio group con descripción)**

Dos opciones:

- **Visible para todos los miembros** *(default)*
  - desc: `Cualquier distribuidor verificado en la plataforma puede consultar tu stock`
  - Al seleccionar: la lista de exclusión queda inactiva pero no se borra

- **Visibilidad restringida**
  - desc: `Solo miembros no excluidos explícitamente pueden ver tu inventario`
  - Al seleccionar: activa el panel de lista de exclusión

**Panel de lista de exclusión** (visible solo en modo "Visibilidad restringida")

Dos subsecciones:

*Exclusión por organización:*
- Input de búsqueda: `Buscar organización por nombre...` — autocompletado contra el directorio
- Lista de organizaciones excluidas (tags eliminables)
- Field hint: `EFECTO INMEDIATO AL AÑADIR`

*Exclusión por geografía:*
- Select de continente (Europa · Asia · América del Norte · América del Sur · África · Oceanía)
- Al seleccionar continente: opción de refinar a país concreto mediante select secundario
- Lista de exclusiones geográficas activas (tags eliminables)
- Field hint: `EXCLUYE TODAS LAS ORGANIZACIONES CON SEDE EN ESA GEOGRAFÍA`

**Bloque informativo brass:**
> Los cambios en la visibilidad tienen **efecto inmediato** — las organizaciones excluidas dejarán de ver tu stock en su próxima búsqueda.

**Botón de acción:** `Guardar configuración` (primario)

---

### Datos de ejemplo

```
Modo: Visibilidad restringida (seleccionado)

Exclusión por organización:
  [Rodamientos Express SL ×] [Nordic Bearings AB ×]

Exclusión por geografía:
  [Asia ×] [Rusia ×]
```

---

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Modo de visibilidad | radio | S | — | — | Default: Visible para todos |
| 2 | Excluir organización | tags (búsqueda) | N | `Buscar organización...` | `Efecto inmediato al añadir` | Solo disponible en modo restringido |
| 3 | Excluir por continente | select | N | `Selecciona un continente` | `Excluye todas las organizaciones de esa geografía` | Solo disponible en modo restringido |
| 4 | Refinar por país | select | N | `Todos los países del continente` | — | Solo visible tras seleccionar continente |

**Botón:** `Guardar configuración`

---

## 5. Panel VERA

**Subtítulo:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice:**
> Ahora mismo tu inventario es visible para todos los miembros verificados. Si quieres limitarlo, cambia a "Visibilidad restringida" y añade las organizaciones o regiones que quieres excluir.
>
> **Usuario dice:**
> ¿Puedo excluir a toda Asia menos Japón?
>
> **VERA responde:**
> Sí. Primero añade "Asia" en exclusiones geográficas y luego, dentro del mismo continente, selecciona todos los países excepto Japón. Cada exclusión geográfica tiene efecto inmediato.

---

## 6. Estados especiales

**Cambio de modo restringido a "Visible para todos":**
- La lista de exclusión se desactiva visualmente (gris, no editable)
- Brass notice: `Tu lista de exclusión se conserva — si vuelves al modo restringido, se reactivará automáticamente.`
- VERA confirma: `Ahora todos los distribuidores verificados pueden ver tu stock.`

**Guardado con éxito:**
- Banner verde temporal: `Configuración guardada. Los cambios tienen efecto inmediato.`
- VERA confirma en el chat

---

## 7. Notas y excepciones al sistema base

- El modo de visibilidad TIERED está diferido a V2 — no aparece como opción en esta pantalla.
- La herramienta "Simular visibilidad" fue descartada en fase de análisis técnico — no se incluye en esta pantalla.
- Existen dos modos de visibilidad: **VISIBLE PARA TODOS** y **VISIBILIDAD RESTRINGIDA**.
- En modo **VISIBLE PARA TODOS**, cualquier empresa o sede puede ver el inventario. No aplica ninguna excepción.
- En modo **VISIBILIDAD RESTRINGIDA**, se activa la lista de exclusión configurada.
- Al cambiar de RESTRINGIDA a **VISIBLE PARA TODOS**, la lista de exclusión se conserva en segundo plano (no se borra), pero queda completamente inactiva.
- Si el usuario vuelve a RESTRINGIDA, la lista previa se reactiva automáticamente sin necesidad de reconfigurar.
- Para levantar restricciones el usuario tiene dos opciones: eliminar empresas/sedes concretas de la lista, o cambiar directamente a VISIBLE PARA TODOS.
- No existe granularidad por línea de inventario — la visibilidad aplica siempre a todo el inventario de la organización.

---

## 8. Prioridad de construcción

- [x] **Alta** — funcionalidad core de privacidad comercial.

---

*Spec INV-07 · v1.0 · Bearingworld.io · Junio 2026*
