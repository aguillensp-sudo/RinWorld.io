
# Spec de Pantalla — `INV-04` · Configuración del Canal Email

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-04 |
| Nombre | Configuración del Canal Email de Ingestión |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.4 · Módulo 02 v1.3 § 4 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Inventario**
- Accesible desde INV-01 → ajustes de canal de subida, o desde Configuración → Inventario

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Canal de ingestión por email
```

### Subtítulo
```
Envía tu archivo de inventario directamente por email a tu dirección única de ingestión. El sistema lo procesará automáticamente.
```

---

### Componentes presentes

**Bloque de dirección de ingestión**

Muestra la dirección de email única de la organización:

```
ingest-a3f7k9@ingest.bearingworld.io
```

- Campo de solo lectura con botón `Copiar`
- Bloque brass informativo: `Esta dirección acepta archivos CSV, XLSX, XLS, TSV y TXT adjuntos. Tamaño máximo 50 MB.`
- Botón secundario (texto plano): `Rotar dirección` — genera una nueva dirección y anula la anterior inmediatamente

**Modal de confirmación de rotación:**
- Título: `¿Seguro que quieres rotar la dirección?`
- Texto: `La dirección actual quedará anulada de forma inmediata. Cualquier sistema que la use deberá actualizarse.`
- Botón: `Sí, rotar` (primario) + `Cancelar`

**Whitelist de remitentes autorizados**

Lista editable de emails autorizados para enviar archivos a la dirección de ingestión. El email del administrador aparece por defecto y no se puede eliminar.

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| Email del remitente | email | S (mín. 1) | Formato email válido · no puede estar vacía la lista |

Acciones por fila: `Eliminar` (icono papelera) — deshabilitado para el email del administrador.

Botón inline: `+ Añadir remitente` → abre input inline para introducir nuevo email.

Field hint bajo la lista: `EMAILS NO EN WHITELIST SE RECHAZAN SILENCIOSAMENTE`

**Historial de ingestiones (tabla de solo lectura)**

Últimas 10 ingestiones recibidas:

| Columna | Descripción |
|---|---|
| Fecha y hora | Timestamp de recepción |
| Remitente | Email que envió el archivo |
| Archivo | Nombre del archivo adjunto |
| Resultado | Procesado con éxito · Rechazado · Error |
| Filas importadas | Número de líneas publicadas |

---

### Datos de ejemplo

```
Dirección: ingest-a3f7k9@ingest.bearingworld.io

Whitelist:
  juan.martinez@rodamientosdelsur.es [Administrador — no eliminable]
  erp@rodamientosdelsur.es

Historial (últimas 3):
  Hace 2 días  · erp@rodamientosdelsur.es · inventario_jun.xlsx · Procesado · 1.247 filas
  Hace 9 días  · erp@rodamientosdelsur.es · inventario_may.xlsx · Procesado · 1.201 filas
  Hace 16 días · unknown@spam.com         · —                   · Rechazado · —
```

---

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Email del remitente (whitelist) | email | S | `email@empresa.com` | `Emails no en whitelist se rechazan silenciosamente` | Formato email |

---

## 5. Panel VERA

**Subtítulo:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice:**
> Tu dirección de ingestión acepta archivos de inventario enviados por email. Solo los remitentes de tu whitelist pueden usarla — el resto se rechaza sin aviso.
>
> **Usuario dice:**
> ¿Puedo añadir el email de mi ERP?
>
> **VERA responde:**
> Sí, añádelo a la whitelist. Una vez añadido, tu ERP podrá enviar archivos directamente a la dirección de ingestión y se procesarán automáticamente sin intervención manual.

---

## 6. Estados especiales

**Rotación ejecutada:**
- La nueva dirección aparece inmediatamente en el bloque
- VERA confirma: `Dirección rotada. La anterior ya no es válida — actualiza cualquier sistema que la estuviera usando.`

**Ingestión rechazada (remitente no en whitelist):**
- Aparece en el historial como `Rechazado`
- VERA puede notificar si el usuario está en la pantalla

---

## 7. Notas y excepciones al sistema base

- La dirección de ingestión es única por organización, no por usuario.
- La rotación es irreversible e inmediata — la dirección anterior deja de funcionar en el mismo momento.
- Los archivos raw recibidos se almacenan en S3/R2 durante 30 días para auditoría y se purgan automáticamente.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec INV-04 · v1.0 · Bearingworld.io · Junio 2026*

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

- Ítem activo en nav: **Vendiendo**
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
Cuando subes un archivo con una estructura conocida, el perfil se aplica automáticamente y te saltas el paso de confirmación.
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

- Ítem activo en nav: **Vendiendo**
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
- La lista de exclusión se conserva aunque el usuario cambie a "Visible para todos" — al volver a modo restringido, la lista se reactiva automáticamente sin necesidad de reconfigurar.
- No existe granularidad por línea de inventario — la visibilidad aplica siempre a todo el inventario de la organización.

---

## 8. Prioridad de construcción

- [x] **Alta** — funcionalidad core de privacidad comercial.

---

*Spec INV-07 · v1.0 · Bearingworld.io · Junio 2026*
