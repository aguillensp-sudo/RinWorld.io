# Bearingworld.io — Plantilla de Spec de Pantalla
**Para uso del Product Owner · Duplicar una vez por pantalla**

---

## SISTEMA BASE — No necesitas especificar esto (ya está fijo)

### Estructura y colores

| Elemento | Valor |
|---|---|
| Brand bar | Deep Steel Dark `#111827` · 24px · Inter 400 · 10px · uppercase · letter-spacing 0.08em · no interactiva |
| Nav bar | Deep Steel `#1B2537` · 46px · siempre visible |
| Sidebar | Deep Steel `#1B2537` · **oculta por defecto** · se abre con hamburguesa · overlay (no empuja el layout) · 200ms ease |
| Panel contenido | Blanco `#FFFFFF` · ~55% del viewport · se expande cuando VERA colapsa |
| Panel VERA | Warm Cream `#FAF8F4` · ~33% inicial · arrastrable · colapsable a 32px · expandible hasta 50% |
| Acción primaria | Calibration Blue `#2563EB` |
| Acento confianza | Brass `#B8924A` (favoritos, logo, avatar, bordes VERA) |
| Texto secundario / bordes | Steel Mist `#6B7A99` |

### Tipografía global

| Elemento | Valor |
|---|---|
| Títulos de pantalla | Montserrat 700 · 28px · letter-spacing 0.5px |
| Subtítulos / módulos / eyebrow | Montserrat 600 · 14px · uppercase · letter-spacing 1.5px |
| Texto UI / cuerpo | Inter 400 · 16px |
| Labels de campo | Inter 500 · **12px** · letter-spacing 0.01em |
| Inputs / selects / textareas | Inter 400 · **13px** |
| Field hints | IBM Plex Mono 500 · **10px** · uppercase · letter-spacing 0.04em · Steel Mist |
| Referencias y códigos | IBM Plex Mono 400/500 · 14–15px |
| Texto secundario / meta | Inter 400 · 12–13px |
| Timestamps | Inter 400 · 12px |
| Brand bar | Inter 400 · 10px · uppercase · letter-spacing 0.08em |

### Sistema de botones

| Tipo | Estilo |
|---|---|
| Primario | Fondo `#2563EB` · texto blanco · border-radius 3px · 14px · font-weight 600 · letter-spacing 0.02em |
| Primario deshabilitado | Mismo azul · opacidad 35% · cursor `not-allowed` |
| Google SSO | Fondo blanco · borde 1px `#dadce0` · texto `#1B2537` · icono Google a color · solo en pantallas de autenticación |

**No existen botones secundarios.**

### Componentes de formulario — estándar

| Componente | Especificación |
|---|---|
| `field-input` / `field-select` | `padding: 10px 12px` · `border: 1px solid var(--border)` · `border-radius: 3px` · `font-size: 13px` · focus: borde azul + box-shadow azul suave |
| `field-label` | Inter 500 · 12px · letter-spacing 0.01em · incluye `*` en brass para campos obligatorios |
| `field-hint` | IBM Plex Mono 500 · 10px · uppercase · Steel Mist · aparece bajo el campo |
| `sensitive-tag` | IBM Plex Mono 500 · 9px · uppercase · fondo rojo suave · texto error · aparece inline en el label (ej: "DATO INTERNO") |
| `tags-input` | Borde 1px · min-height 40px · tags con fondo brass-soft · IBM Plex Mono · border-radius 2px |
| `file-upload` | Borde discontinuo 1px · fondo cream · icono cuadrado 36px · título 13px + hint mono · hover: borde brass |
| `radio-option` | Borde 1px · padding 12px 14px · border-radius 3px · label 13px font-weight 500 + descripción IBM Plex Mono 11px · estado checked: borde azul + fondo azul suave |
| `checkbox-field` | Borde 1px · padding 14px · fondo cream · border-radius 3px · marker 16px · estado checked: fondo azul suave + borde azul + checkmark blanco |
| `pw-strength` | 4 barras · height 3px · border-radius 1px · activo: brass · fuerte: verde éxito |
| `or-divider` | IBM Plex Mono 11px · uppercase · letter-spacing 0.18em · líneas laterales 1px |
| `role-notice` / bloque brass | Border-left 3px brass · fondo brass-soft · icono inline · font-size 12px · Steel Mist |
| `section-divider` | Línea 1px + label centrado · Inter 500 · 13px · Steel Mist |

### Paleta completa

| Nombre | Hex | Uso |
|---|---|---|
| Deep Steel Dark | `#111827` | Brand bar |
| Deep Steel | `#1B2537` | Nav · sidebar · burbujas usuario VERA |
| Blanco | `#FFFFFF` | Panel contenido · inputs · burbujas VERA |
| Warm Cream | `#FAF8F4` | Panel VERA · fondo file-upload · checkbox |
| Cold White | `#F1F3F6` | Chips · cabecera tabla |
| Calibration Blue | `#2563EB` | Acción primaria · foco · links |
| Blue soft | `rgba(37,99,235,0.08)` | Focus shadow · checked backgrounds |
| Brass | `#B8924A` | Logo · favoritos · avatar · acentos |
| Brass soft | `rgba(184,146,74,0.08)` | Fondo tags · file-upload hover · role-notice |
| Steel Mist | `#6B7A99` | Texto secundario · placeholders · hints |
| Verde éxito | `#16a34a` | Punto estado VERA · confirmaciones · pw fuerte |
| Error | `#dc2626` | Sensitive-tag · validaciones |
| Naranja aviso | `#d97706` | Datos obsoletos |

### Anchura máxima de formularios

**520px** — los formularios y sus campos nunca se estiran al 100% del panel. Esta restricción es obligatoria en todas las pantallas.

---

## PLANTILLA — Copiar y rellenar por pantalla

---

# Spec de Pantalla — `[CÓDIGO]` · [Nombre de la pantalla]

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | ej. REG-01, SRCH-01, MSG-03 |
| Nombre | Nombre legible de la pantalla |
| Módulo | Módulo funcional de origen (01 Onboarding, 02 Inventario…) |
| Referencia funcional | Sección del módulo donde está especificada |

---

## 2. Layout

**Variante de layout:**
- [ ] Shell completo — brand bar + nav bar + sidebar overlay + contenido + VERA (todas las pantallas salvo REG-00 y REG-00-WAIT)
- [ ] Sin shell — exclusivo REG-00 y REG-00-WAIT: fondo Deep Steel + tarjeta blanca 520px + VERA
- [ ] Sin VERA — shell completo pero sin panel VERA
- [ ] Excepción: ______________________________

**Notas de layout:**

---

## 3. Panel de contenido

### Eyebrow (si aplica)
*(Montserrat 600 · 14px · uppercase · brass o steel mist. Ej: "Módulo 01 · Onboarding")*

### Título de la pantalla
*(Montserrat 700 · 28px · letter-spacing 0.5px)*

```
[Título aquí]
```

### Subtítulo o descripción breve
*(Inter 400 · 16px · Steel Mist)*

---

### Componentes presentes

**Chips / filtros activos**
- [ ] Sí — ¿cuáles aparecen por defecto?:
- [ ] No aplica

**Tabla de datos**
- [ ] Sí
  - Columnas (en orden):
  - ¿Tiene checkbox de selección?: [ ] Sí / [ ] No
  - Acción(es) por fila:
- [ ] No aplica

**Formulario**
*(Ver sección 4 para el detalle de campos)*
- [ ] Sí — nombre del formulario:
- [ ] No aplica

**Tarjetas / cards**
- [ ] Sí — qué muestra cada tarjeta:
- [ ] No aplica

**Métricas / panel de estadísticas**
- [ ] Sí — qué métricas:
- [ ] No aplica

**Botones de acción principales**
- [ ] Sí — cuáles:
- [ ] No aplica

**Indicador de estado / pantalla de espera**
- [ ] Sí — mensaje que muestra:
- [ ] No aplica

**Otro elemento no listado:**

---

### Datos de ejemplo

```
[Pega aquí ejemplos reales del dominio: 
part numbers, nombres de empresa, países, fechas, cantidades, etc.]
```

---

## 4. Formulario — detalle de campos
*(Solo si hay formulario. Una fila por campo.)*

| Nº | Nombre del campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | | text / email / password / select / checkbox / file / tags / radio | S/N | | | |

**Botón de envío:** *(texto del botón)*

**Secciones dentro del formulario:**
- [ ] No, es un formulario único
- [ ] Sí — secciones:

---

## 5. Panel VERA

**Estado:**
- [ ] Con conversación en curso
- [ ] Vacío / primer acceso
- [ ] VERA inactiva / oculta

**Subtítulo del panel VERA en esta pantalla:**

**Conversación tipo:**

> **VERA dice:**
> 
> **Usuario dice:**
> 
> **VERA responde:**

---

## 6. Estados especiales

**Estado vacío:** 
**Estado de carga:**
**Estado de error:**
**Estado de éxito:**

---

## 7. Notas y excepciones al sistema base

- 

---

## 8. Prioridad de construcción

- [ ] Alta
- [ ] Media
- [ ] Baja

---

*Sistema base v1.2 · Bearingworld.io · Junio 2026*
