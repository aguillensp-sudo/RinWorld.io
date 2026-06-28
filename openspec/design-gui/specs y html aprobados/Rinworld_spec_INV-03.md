# Spec de Pantalla — `INV-03` · Resultado de la Importación

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-03 |
| Nombre | Resultado de la Importación |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.3 · Módulo 02 v1.3 § 3.3 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Inventario**
- Pantalla de solo lectura — resumen del procesamiento tras confirmar en INV-02

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla

Varía según el resultado:

- **Sin errores:** `Importación completada`
- **Con errores parciales:** `Importación completada con advertencias`
- **Fallo total:** `La importación no ha podido completarse`

### Componentes presentes

**Bloque de resumen estadístico del procesamiento**

| Métrica | Valor ejemplo |
|---|---|
| Líneas procesadas | 1.247 |
| Líneas publicadas | 1.213 |
| Líneas con error | 34 |
| Líneas eliminadas (modo reemplazo total) | 127 |
| Tiempo de procesamiento | 4,2 segundos |

**Muestra de líneas importadas (SIEMPRE solo 10 primeras)**

Tabla de solo lectura con las primeras 10 líneas importadas correctamente. Etiqueta explícita encima de la tabla:
`Mostrando las primeras 10 líneas importadas como muestra — el inventario completo ya está publicado.`

Columnas: Referencia · Marca · Cantidad · País · Estado

**Panel de errores (condicional — solo si hay líneas con error)**

Colapsado por defecto. Cabecera: `34 líneas no importadas — ver detalle ▸`

Al expandir, tabla con:
- Fila del archivo
- Columna con error
- Tipo de error (`Cantidad negativa` · `País inválido` · `Referencia vacía`...)
- Valor recibido

Botón al pie del panel: `Descargar CSV de errores` — genera un CSV con las líneas fallidas para que el usuario las corrija y re-suba.

**Botones de acción:**
- `Volver al panel de inventario` (primario) → redirige a INV-01
- `Subir correcciones` (texto plano, solo si hay errores) → vuelve a INV-01 con la zona drag & drop destacada

---

### Datos de ejemplo

```
Resultado: Importación completada con advertencias
Procesadas: 1.247
Publicadas: 1.213
Errores: 34
Eliminadas: 127
Tiempo: 4,2s

Muestra (10 primeras líneas):
  6205-2RS/C3    · SKF · 850 · ES · PUBLISHED
  NU2210-E-TVP2  · FAG · 120 · ES · PUBLISHED
  6305-ZZ        · NSK · 340 · ES · PUBLISHED
  22316-E        · FAG · 75  · ES · PUBLISHED
  6206-2RS       · SKF · 200 · ES · PUBLISHED
  7210-BECBP     · SKF · 45  · ES · PUBLISHED
  23026-E1       · FAG · 12  · ES · PUBLISHED
  NU318-E-M1     · FAG · 8   · ES · PUBLISHED
  6004-RSH       · SKF · 560 · ES · PUBLISHED
  7311-BECBP     · SKF · 33  · ES · PUBLISHED
```

---

## 4. Formulario

No aplica — pantalla de solo lectura.

---

## 5. Panel VERA

**Estado:** Activa — modo resumen post-importación.

**Subtítulo del panel:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice (al cargar):**
> La importación ha ido bien en general. Se han publicado 1.213 líneas. Las 34 líneas con error no se han importado — descarga el CSV para ver qué ha fallado y re-súbelas corregidas.
>
> **Usuario dice:**
> ¿Cuál es el error más común?
>
> **VERA responde:**
> La mayoría de errores son de cantidad negativa (28 líneas) y 6 con código de país inválido. Descarga el CSV, corrige esas columnas y vuelve a subir solo las líneas fallidas en modo acumulativo.

---

## 6. Estados especiales

**Sin errores:**
- No se muestra el panel de errores
- Título: `Importación completada`
- VERA celebra: `Todo perfecto — 1.247 líneas publicadas correctamente.`

**Fallo total (0 líneas importadas):**
- Título: `La importación no ha podido completarse`
- Bloque de error prominente con motivo del fallo
- Sin muestra de líneas
- Solo botón `Volver al panel de inventario`

---

## 7. Notas y excepciones al sistema base

- La muestra de 10 líneas es SIEMPRE fija — nunca se intenta renderizar el inventario completo en esta pantalla, independientemente del volumen del archivo.
- Las líneas eliminadas solo se muestran si la política fue "Reemplazo total" — en modo acumulativo esta métrica no aparece.

---

## 8. Prioridad de construcción

- [x] **Alta**

---

*Spec INV-03 · v1.0 · Bearingworld.io · Junio 2026*

---
---
