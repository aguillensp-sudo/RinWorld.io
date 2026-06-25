# Bearingworld.io — Plantilla de Spec de Pantalla
**Para uso del Product Owner · Duplicar una vez por pantalla**

---

## SISTEMA BASE — No necesitas especificar esto (ya está fijo)

| Elemento | Valor |
|---|---|
| Sidebar | Deep Steel `#1B2537` · **oculta por defecto** (no ocupa espacio en el layout) · se abre mediante botón hamburguesa fijo en la esquina superior izquierda · al abrirse se despliega sobre el contenido (overlay), no empuja el layout |
| Panel contenido | Blanco `#FFFFFF` · **~55% del viewport** (se expande si VERA se oculta, se contrae si VERA se expande) |
| Panel VERA | Warm Cream `#FAF8F4` · **1/3 del viewport** (~33%) · siempre visible salvo excepción · **expansible** (el usuario puede ampliar su ancho) · **ocultable** (el usuario puede colapsarlo a un icono en el borde derecho) |
| Acción primaria | Calibration Blue `#2563EB` |
| Acento confianza | Brass `#B8924A` (favoritos, logo, avatar) |
| Texto secundario / bordes | Steel Mist `#6B7A99` |
| Títulos de pantalla | Barlow Condensed 700 · 30px |
| Texto UI / cuerpo | Inter 400/500 · 15–17px |
| Referencias y códigos | IBM Plex Mono 400/500 · 14–15px |
| Botones | Un único estilo — primario: azul `#2563EB` · texto blanco · border-radius 4px. No existen botones secundarios. |
| Botón deshabilitado | Mismo azul `#2563EB` · opacidad 35% · cursor `not-allowed` · sin cambio de color. |
| Botón Google SSO | **Excepción única** — fondo blanco · borde 1px `#dadce0` · texto `#1B2537` · icono Google a color. Solo en pantallas de autenticación. |
| Chips de filtro | Fondo blanco · borde 0.5px · pill |
| Filas de tabla | Hover azul suave · checkbox accent azul |

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
- [ ] Estándar — sidebar + contenido + VERA (los tres paneles)
- [ ] Sin VERA — sidebar + contenido a pantalla completa
- [ ] Sin sidebar — solo contenido + VERA (ej: pantallas de onboarding)
- [ ] Centrado — pantalla de login, error, pantalla de espera (sin paneles)
- [ ] Excepción: ______________________________

**Notas de layout:**
*(Si hay algo específico sobre proporciones, scroll, pantalla fija, etc.)*

---

## 3. Panel de contenido

### Título de la pantalla
*(El h1 que aparece en la zona de contenido. Si no hay título visible, indicarlo.)*

```
[Título aquí]
```

### Subtítulo o descripción breve
*(Si lo hay, justo debajo del título.)*

---

### Componentes presentes
*(Marca los que aplican. Describe la variante específica de cada uno.)*

**Chips / filtros activos**
- [ ] Sí — ¿cuáles aparecen por defecto?:
- [ ] No aplica

**Tabla de datos**
- [ ] Sí
  - Columnas (en orden): 
  - ¿Tiene checkbox de selección?: [ ] Sí / [ ] No
  - ¿Tiene paginación?: [ ] Sí / [ ] No
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
- [ ] Sí — qué métricas (ej: "Total líneas · Desactualizadas · Última actualización"):
- [ ] No aplica

**Buscador interno**
- [ ] Sí — ¿sobre qué busca?:
- [ ] No aplica

**Mensajes o conversación**
*(Para MSG-01, MSG-02, FORO-03 y similares)*
- [ ] Sí — tipo: [ ] Chat 1-a-1 / [ ] Hilo de foro / [ ] Otro:
- [ ] No aplica

**Botones de acción principales**
*(Los botones que flotan sobre el contenido o van en cabecera, no los de tabla)*
- [ ] Sí — cuáles (ej: "Subir inventario", "Crear hilo"):
- [ ] No aplica

**Indicador de estado / pantalla de espera**
*(Para pantallas como REG-07 o REG-00-WAIT)*
- [ ] Sí — mensaje que muestra:
- [ ] No aplica

**Otro elemento no listado:**

---

### Datos de ejemplo
*(Datos concretos y realistas para poblar el prototipo. Cuantos más detalles, mejor.)*

```
[Pega aquí ejemplos reales del dominio: 
part numbers, nombres de empresa, países, fechas, cantidades, etc.]
```

---

## 4. Formulario — detalle de campos
*(Solo si hay formulario en esta pantalla. Una fila por campo.)*

| Nº | Nombre del campo | Tipo | Obligatorio | Placeholder o ejemplo | Validación visible |
|----|---|---|---|---|---|
| 1 | | text / email / password / select / checkbox / file / textarea | S/N | | |
| 2 | | | | | |
| 3 | | | | | |

**Botón de envío del formulario:**
*(Texto del botón, ej: "Continuar", "Guardar", "Registrar organización")*

**¿Hay secciones dentro del formulario?**
*(Ej: "Sección 1 de 2 — Datos de la organización")*
- [ ] No, es un formulario único
- [ ] Sí — secciones:

---

## 5. Panel VERA

**Estado de VERA en esta pantalla:**
- [ ] Con conversación en curso — ver conversación tipo abajo
- [ ] Vacío / primer acceso — VERA saluda con mensaje de bienvenida
- [ ] VERA inactiva / oculta — esta pantalla no usa VERA
- [ ] VERA mostrando resultado de una acción — describe cuál:

**Conversación tipo** *(si aplica — qué intercambio ilustrativo va en el chat)*

> **Usuario dice:**
> *(escribe aquí el mensaje del usuario)*
>
> **VERA responde:**
> *(escribe aquí la respuesta de VERA, con el tono y contenido apropiados)*

*(Puedes añadir más turnos si la conversación ilustrativa lo requiere)*

---

## 6. Estados especiales

**Estado vacío** *(qué se ve si no hay datos todavía)*
- [ ] No aplica
- [ ] Sí — mensaje / llamada a la acción:

**Estado de carga** *(si hay operación asíncrona visible)*
- [ ] No aplica
- [ ] Sí — qué indicador se muestra:

**Estado de error** *(si hay validación o error recuperable)*
- [ ] No aplica
- [ ] Sí — describe el caso:

**Estado de éxito** *(confirmación tras acción completada)*
- [ ] No aplica
- [ ] Sí — mensaje o cambio visual:

---

## 7. Notas y excepciones al sistema base

*(Todo lo que se desvíe del diseño estándar. Si no hay nada, dejar en blanco.)*

- 
- 

---

## 8. Prioridad de construcción

- [ ] Alta — necesito este prototipo antes de avanzar
- [ ] Media — en el orden normal del inventario
- [ ] Baja — puede esperar a tener las pantallas principales

---

*Plantilla v1.0 · Bearingworld.io · Junio 2026*
