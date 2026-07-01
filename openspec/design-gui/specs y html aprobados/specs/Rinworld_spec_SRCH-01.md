# Spec de Pantalla — `SRCH-01` · Panel de Resultados de Búsqueda

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | SRCH-01 |
| Nombre | Panel de Resultados de Búsqueda |
| Módulo | 03 — Búsqueda Conversacional y Descubrimiento |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 4.1 · Módulo 03 v1.6 §§ 3, 4.2, 4.4 |

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
Resultados de búsqueda
```

---

### Componentes presentes

**Chips de filtro activos**

Generados por VERA a partir de la consulta en lenguaje natural. Editables directamente en la UI — cualquier cambio se refleja en el chat de VERA y actualiza los resultados.

| Chip | Ejemplo |
|---|---|
| Ref | 6205-2RS |
| Marca | SKF |
| Qty mín | 500 u |
| Zona / País | Europa · España |
| Lead time máx | 7 días |

Chip adicional siempre visible al final: `+ Filtro` (borde discontinuo) para añadir filtros manualmente.

**Metabarra de resultados**

Justo bajo los chips. Muestra de izquierda a derecha:
- Contador: `X resultados · Y con stock ≥ [qty mín]`
- Enlace texto: `Seleccionar todos` / `Deseleccionar todos`
- Botón primario deshabilitado por defecto: `Consultar seleccionados` — se habilita con ≥ 1 checkbox marcado
- Botón primario: `Crear watcher con estos criterios`

**Tabla de resultados**

Columnas en **orden fijo inamovible** (v1.1). No reordenables por el usuario:

| Nº | Columna | Tipo de dato | Notas |
|----|---|---|---|
| 1 | ☐ | Checkbox | Selección múltiple. accent-color azul `#2563EB` |
| 2 | Referencia | IBM Plex Mono · 12px | Código exacto tal como lo publica el distribuidor |
| 3 | Marca | Badge gris oscuro | SKF, FAG, NSK... |
| 4 | Cantidad | Número · verde si ≥ qty mín, Steel Mist si < qty mín | Unidades disponibles |
| 5 | Plazo | Texto Steel Mist | `X días` |
| 6 | Empresa | Inter 500 · 13px | Nombre de la organización distribuidora |
| 7 | País | Badge | Nombre completo del país en el idioma de sesión del usuario: España, Alemania, France... |
| 8 | Antigüedad | Texto Steel Mist · 11px | Días desde la última actualización del inventario por el distribuidor. En naranja si > 7 días (`desactualizado`) |
| 9 | Favoritos | Brass · ★ + recuento | Solo modificable por acción explícita del usuario. Nunca automático |
| 10 | Acciones | Dos botones | `Consultar` · `Contactar` |

**Ordenación:**

- **Por defecto:** cantidad disponible descendente.
- **Columnas ordenables por el usuario** (clic en cabecera): Marca, Cantidad, Plazo, País, Antigüedad, Favoritos.
- **Columnas no ordenables:** Checkbox, Referencia, Empresa, Acciones.
- **Comportamiento del toggle:** primer clic → ascendente, segundo clic → descendente, tercer clic → restaura orden por defecto. Indicador visual en la cabecera activa (↑ / ↓).
- **VERA puede reordenar la tabla** a través de instrucción en lenguaje natural (ej: "ordena por plazo de menor a mayor"). La tabla se reordena visualmente de inmediato. VERA confirma la acción en el chat.

**Filtro de visibilidad:** aplicado server-side. Filas de distribuidores que han excluido al usuario no aparecen en ningún caso.

**Estado de fila ya consultada:**
- Botón `Consultar` deshabilitado (azul al 35% + cursor `not-allowed`)
- Fila con fondo diferenciado: `rgba(37,99,235,0.04)` permanente
- Botón `Contactar` siempre disponible sin excepción

**Panel de filtros laterales colapsable** (izquierda del panel, antes de la tabla)
- Espejo de los chips: País/región · Marca · Cantidad mín. · Lead time
- Cualquier cambio se refleja en chips y en el chat de VERA
- Colapsado por defecto

---

### Datos de ejemplo

```
Query VERA: "busco 6205 2RS, mínimo 500 unidades, Europa"

Chips: Ref: 6205-2RS · Qty mín: 500 u · Zona: Europa
Meta: 5 resultados · 4 con stock ≥ 500 u

Fila 1: 6205-2RS/C3  · SKF    · 850   · 3d · SKF Nordic AB          · Suecia   · Hoy     · ★12 · [Consultar][Contactar]
Fila 2: 6205-2RS1    · FAG    · 350   · 5d · Schaeffler Iberia SL   · España   · Ayer    · ★8  · [Consultar][Contactar] [qty<mín→gris]
Fila 3: 6205-2RSC3E  · NSK    · 1.200 · 7d · NSK Europe Ltd         · Alemania · Hace 2d · ★21 · [Consultar][Contactar]
Fila 4: 6205LLB/5K   · NTN    · 200   · 2d · NTN-SNR Roulements     · Francia  · Hace 8d · ★5  · [Consultar][Contactar] [qty<mín→gris][antigüedad→naranja]
Fila 5: 6205-2RS-JEM · Timken · 600   · 10d· Timken Europe GmbH     · Alemania · Hace 3d · ★9  · [Consultar deshabilitado—ya consultada][Contactar]
```

---

## 4. Formulario

No aplica — todos los inputs son chips editables o la entrada de texto de VERA.

---

## 5. Panel VERA

**Estado:** Activa con conversación en curso — modo búsqueda.

**Subtítulo del panel:** `Agente de búsqueda`

**Conversación tipo:**

> **Usuario dice:**
> busco 6205 2RS, mínimo 500 unidades, Europa
>
> **VERA responde:**
> Encontré 5 proveedores con stock de 6205-2RS en Europa. Cuatro superan las 500 unidades.
> [Highlights: SKF Nordic AB · Suecia · 3d → 850 u / NSK Europe Ltd · Alemania · 7d → 1.200 u]
>
> **Usuario dice:**
> ¿Alguno en España o Portugal?
>
> **VERA responde:**
> Solo Schaeffler Iberia (España) con 350 unidades — por debajo de tu mínimo. ¿Les incluyo igualmente en la consulta?

**Ordenación por VERA:** cuando el usuario pide ordenar ("ordena por plazo", "muéstrame el de mayor stock primero"), VERA reordena la tabla visualmente y confirma: `Resultados ordenados por [columna] de [menor a mayor / mayor a menor].`

**Ante cero resultados:** VERA nunca responde solo con la ausencia. Ofrece siempre: ampliar región / relajar filtros / crear watcher.

---

## 6. Estados especiales

**Sin resultados:**
- Mensaje centrado: `No hemos encontrado stock con estos filtros.`
- VERA ofrece alternativas en el chat
- Botón `Crear watcher con estos criterios` visible en la metabarra

**Carga** (< 1,5 segundos):
- Spinner en zona de tabla · chips visibles · VERA muestra `Buscando...`

**Error de red:**
- Mensaje: `No se pudieron cargar los resultados. Inténtalo de nuevo.`
- Botón: `Reintentar`

**"Consultar Seleccionados" ejecutado:**
- Usuario permanece en SRCH-01 sin redirección
- Filas consultadas pasan al estado visual de "ya consultada"
- VERA confirma: `Consultas enviadas a X distribuidores. Las respuestas llegarán a tu bandeja de Hilos.`
- Hilos creados/reutilizados en segundo plano. Líneas del mismo distribuidor se agrupan en su único hilo — nunca un hilo por referencia.

---

## 7. Notas y excepciones al sistema base

- Orden de **columnas fijo e inamovible** (posición de las columnas no cambia). Las filas sí son reordenables por el usuario clicando en la cabecera de columna o por instrucción a VERA.
- `Contactar` siempre habilitado en todas las filas sin excepción.
- Favoritos **estrictamente manuales** — ningún evento del sistema los modifica.
- La columna **Empresa** es obligatoria — fue el error del prototipo HTML v1 (omisión corregida en v1.1).

---

## 8. Prioridad de construcción

- [x] **Alta**

---

*Spec SRCH-01 · v1.2 · Bearingworld.io · Junio 2026*
