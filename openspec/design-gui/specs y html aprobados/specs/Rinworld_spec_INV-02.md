# Spec de Pantalla — `INV-02` · Procesamiento y Mapeo de Columnas

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-02 |
| Nombre | Procesamiento y Mapeo de Columnas |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.2 · Módulo 02 v1.3 §§ 3.2, 5 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Vendiendo**
- Esta pantalla aparece tras seleccionar un archivo en INV-01 (drag & drop o selector)
- El usuario no puede acceder a INV-02 directamente desde la nav — solo desde INV-01

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Confirma el mapeo de columnas
```

### Subtítulo
```
Hemos analizado tu archivo. Revisa cómo se mapean tus columnas a los campos de la plataforma antes de importar.
```

---

### Componentes presentes

**Bloque informativo del archivo subido**

| Campo | Valor ejemplo |
|---|---|
| Nombre del archivo | `inventario_junio_2026.xlsx` |
| Filas detectadas | 1.247 filas |
| Columnas detectadas | 6 columnas |
| Muestra analizada | Primeras 10 filas |

**Tabla de mapeo de columnas**

Una fila por columna detectada en el archivo. Columnas de la tabla:

| Columna tabla | Descripción |
|---|---|
| Columna en tu archivo | Nombre exacto de la cabecera del archivo subido |
| Ejemplo de valor | Primer valor no vacío encontrado en esa columna |
| Campo en plataforma | Dropdown editable — el usuario confirma o corrige el mapeo propuesto por IA |
| Confianza | Badge de color con porcentaje: verde >85% · amarillo 60–85% · rojo <60% |

**Opciones del dropdown "Campo en plataforma":**
- `part_number` — Referencia del rodamiento *(obligatorio)*
- `brand` — Marca / Fabricante *(obligatorio)*
- `quantity` — Cantidad disponible *(obligatorio)*
- `location_country` — País de stock *(obligatorio)*
- `price` — Precio (opcional, cifrado E2EE)
- `lead_time_days` — Plazo de entrega en días (opcional)
- `notes` — Notas adicionales (opcional)
- `— Ignorar esta columna —` — La columna no se importa

**Sección "Columnas ignoradas"**
Columnas del archivo que el sistema no ha podido mapear con ningún campo canónico. El usuario puede asignarlas manualmente o confirmar que son irrelevantes.

**Checkbox "Guardar como perfil de mapeo"**
- Label: `Guardar este mapeo como perfil para futuros archivos con esta estructura`
- Input de texto inline (visible solo si checkbox marcado): `Nombre del perfil`
- Field hint: `Próximas subidas con estructura similar se mapearán automáticamente`

**Selector de política de actualización**

Radio group (dos opciones):
- `Reemplazo total` *(seleccionado por defecto)* — desc: `El archivo sustituye completamente el inventario publicado`
- `Acumulativo` — desc: `El archivo añade o actualiza líneas sin eliminar las existentes`

**Botón de acción:** `Confirmar e importar`
- Deshabilitado si alguna de las 4 columnas obligatorias no está mapeada
- Al confirmarse: redirige a INV-03

**Botón secundario (texto plano):** `Cancelar y volver al inventario` → redirige a INV-01

---

### Datos de ejemplo

```
Archivo: inventario_junio_2026.xlsx · 1.247 filas · 6 columnas

Mapeo propuesto por IA:
  "Ref."        → part_number      · Ej: 6205-2RS/C3   · Confianza: 97% [verde]
  "Fabricante"  → brand            · Ej: SKF            · Confianza: 91% [verde]
  "Uds."        → quantity         · Ej: 850            · Confianza: 88% [verde]
  "País"        → location_country · Ej: ES             · Confianza: 85% [verde]
  "PVP"         → price            · Ej: 4.20           · Confianza: 72% [amarillo]
  "Obs."        → — Ignorar —      · Ej: Stock almacén  · Confianza: 12% [rojo]

Columnas ignoradas: ninguna
Guardar como perfil: desmarcado
Política: Reemplazo total (default)
```

---

## 4. Formulario — detalle de campos

| Nº | Campo | Tipo | Oblig. | Placeholder / Opciones | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Campo en plataforma (×N columnas) | select | S (para oblig.) | Ver opciones arriba | — | Las 4 columnas obligatorias deben estar mapeadas para habilitar el botón |
| 2 | Guardar como perfil | checkbox | N | — | — | — |
| 3 | Nombre del perfil | text | S (si checkbox marcado) | `Ej: Formato Excel mensual` | `Mín 3 / máx 50 caracteres` | Solo visible si checkbox marcado |
| 4 | Política de actualización | radio | S | Reemplazo total / Acumulativo | — | Default: Reemplazo total |

**Botón:** `Confirmar e importar`

---

## 5. Panel VERA

**Estado:** Activa — modo asistencia de mapeo.

**Subtítulo del panel:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice (al cargar la pantalla):**
> He analizado tu archivo y he propuesto el mapeo de columnas. La columna "Obs." no la he podido identificar — puedes ignorarla si no contiene datos relevantes. Las 4 columnas obligatorias están correctamente mapeadas.
>
> **Usuario dice:**
> ¿Qué pasa si elijo reemplazo total?
>
> **VERA responde:**
> Con reemplazo total, tu inventario publicado quedará exactamente como el archivo que acabas de subir: se actualizan las referencias existentes, se añaden las nuevas y se eliminan las que ya no estén en el archivo. Si solo quieres añadir o actualizar sin borrar nada, elige "Acumulativo".

---

## 6. Estados especiales

**Columna obligatoria sin mapear:**
- Botón `Confirmar e importar` deshabilitado con tooltip: `Debes mapear las columnas: [lista]`
- La fila de la columna sin mapear muestra borde izquierdo rojo

**Perfil de mapeo detectado automáticamente:**
- Banner brass sobre la tabla: `Hemos aplicado automáticamente el perfil "[nombre]". Revisa que todo sea correcto.`
- VERA informa en el chat

**Archivo con estructura desconocida (confianza baja generalizada):**
- VERA advierte: `No he podido identificar la mayoría de columnas. Revisa el mapeo manualmente antes de continuar.`
- Ninguna columna se mapea automáticamente (todos los dropdowns en `— Ignorar —`)

---

## 7. Notas y excepciones al sistema base

- La columna `condition` no existe en la lista de opciones del dropdown — fue eliminada del esquema canónico en v1.1.
- El perfil de mapeo guardado se aplica automáticamente en subidas futuras con estructura similar — el usuario llega directamente a INV-03 sin pasar por INV-02.
- Si el archivo supera el límite de líneas que llevaría el inventario por encima de 500.000, el botón se bloquea y se muestra un aviso antes del mapeo.

---

## 8. Prioridad de construcción

- [x] **Alta** — paso crítico del flujo de importación de inventario.

---

*Spec INV-02 · v1.0 · Bearingworld.io · Junio 2026*
