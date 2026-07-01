# Spec de Pantalla — `SRCH-02` · Panel Consolidado de Búsqueda por Lotes

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | SRCH-02 |
| Nombre | Panel Consolidado de Búsqueda por Lotes |
| Módulo | 03 — Búsqueda Conversacional y Descubrimiento |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 4.2 · Módulo 03 v1.6 § 4.4 |

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
Búsqueda por lotes
```

### Subtítulo
```
Consulta hasta 50 referencias a la vez. Pega la lista desde tu ERP, Excel o cualquier formato de texto.
```

---

### Componentes presentes

**Área de entrada de referencias (textarea)**

- Placeholder: `Pega aquí tu lista de referencias — una por línea, separadas por comas o tabulaciones`
- Tolerante a formato: una por línea · separadas por comas · separadas por tabulaciones · pegado desde Excel
- Límite: 50 referencias por consulta
- Contador visible bajo el textarea: `X / 50 referencias`
- Botón primario: `Buscar`

**Aviso cuando la lista supera 50 referencias:**
- Bloque brass informativo: `Tu lista tiene X referencias. Procesaremos las primeras 50. ¿Quieres continuar con el resto en una segunda tanda?`
- Botón: `Continuar con las primeras 50` (primario) + `Dividir en tandas` (texto plano)

**Panel de resultados por referencia**

Una tarjeta colapsable por referencia procesada:

- **Cabecera de la tarjeta:** Referencia (IBM Plex Mono) + número de distribuidores con stock + cantidad máxima disponible + país con mayor stock
- **Al expandir:** tabla de resultados idéntica a SRCH-01 (mismas columnas, mismo comportamiento de ordenación por cabecera y por VERA, checkbox, botón `Consultar`, botón `Contactar`)
- **Primera tarjeta:** expandida por defecto · el resto colapsadas

**Metabarra global (encima de todas las tarjetas):**
- `X referencias · Y con stock · Z sin resultados`
- Botón primario: `Exportar resumen` — genera CSV/PDF con: referencia · número de distribuidores · cantidad máxima · país
- Botón primario: `Crear watchers para referencias sin stock` — acción en lote, requiere confirmación de VERA antes de ejecutar

---

### Datos de ejemplo

```
Lista pegada:
  6205-2RS
  NU2210-E-TVP2
  22316-E
  6308-ZZ
  7210-BECBP

Meta global: 5 referencias · 4 con stock · 1 sin resultados

Tarjeta 1 — 6205-2RS [EXPANDIDA]
  Distribuidores: 5 · Máx: 1.200 u (NSK, DE)
  Tabla igual que SRCH-01 con las 5 filas del ejemplo de SRCH-01

Tarjeta 2 — NU2210-E-TVP2 [COLAPSADA]
  Distribuidores: 3 · Máx: 450 u (FAG, ES)

Tarjeta 3 — 22316-E [COLAPSADA]
  Distribuidores: 2 · Máx: 75 u (FAG, ES)

Tarjeta 4 — 6308-ZZ [COLAPSADA]
  Sin resultados — botón "Crear watcher" inline

Tarjeta 5 — 7210-BECBP [COLAPSADA]
  Distribuidores: 1 · Máx: 45 u (SKF, ES)
```

---

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Lista de referencias | textarea | S | `Pega aquí tu lista de referencias...` | `Máx 50 referencias por tanda` | Tolerante a cualquier formato de separación · máx 50 ítems por consulta |

**Botón:** `Buscar`

---

## 5. Panel VERA

**Estado:** Activa — modo búsqueda por lotes.

**Subtítulo del panel:** `Agente de búsqueda`

**Conversación tipo:**

> **VERA dice (al cargar resultados):**
> He procesado 5 referencias. 4 tienen stock disponible. La referencia 6308-ZZ no tiene resultados — ¿quieres que cree un watcher para avisarte cuando aparezca stock?
>
> **Usuario dice:**
> Sí, crea el watcher para la 6308-ZZ
>
> **VERA responde:**
> ¿Con qué cantidad mínima quieres que te avise? Referencia ya la tenemos — solo necesito el umbral de cantidad.

**Confirmación antes de crear watchers en lote:**

> **VERA dice:**
> Voy a crear 1 watcher para la referencia 6308-ZZ, con cantidad mínima [X] unidades. ¿Confirmas?

---

## 6. Estados especiales

**Lista vacía (sin input):**
- Textarea vacío con placeholder
- Botón `Buscar` deshabilitado

**Procesando (< 5 segundos para 50 referencias):**
- Spinner en el área de resultados
- Contador de progreso: `Buscando referencia 12 de 50...`
- VERA muestra progreso en el chat

**Todas las referencias sin stock:**
- Metabarra: `5 referencias · 0 con stock · 5 sin resultados`
- VERA ofrece crear watchers para todas: `Ninguna referencia tiene stock disponible. ¿Creo watchers para las 5?`

**Exportación completada:**
- Descarga automática del CSV/PDF
- VERA confirma: `Resumen exportado con X referencias.`

---

## 7. Notas y excepciones al sistema base

- El tiempo total de respuesta para 50 referencias no supera los 5 segundos (búsquedas en paralelo server-side).
- Las tarjetas de referencia dentro de SRCH-02 reutilizan exactamente la misma tabla que SRCH-01 — mismas columnas, mismas columnas ordenables (Marca, Cantidad, Plazo, País, Antigüedad, Favoritos), mismo comportamiento de toggle asc/desc/default por cabecera.
- VERA siempre pide confirmación explícita antes de crear watchers en lote.
- Si la lista supera 50 referencias, el sistema procesa las primeras 50 y ofrece continuar con el resto en una segunda tanda — nunca trunca silenciosamente.

---

## 8. Prioridad de construcción

- [x] **Alta** — herramienta principal para compradores con listas de compras recurrentes.

---

*Spec SRCH-02 · v1.1 · Bearingworld.io · Junio 2026*
