# Spec de Pantalla — `ADMIN-02` · Panel de Gestión de Cobros

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | ADMIN-02 |
| Nombre | Panel de Gestión de Cobros |
| Módulo | 07 — Suscripción y Billing |
| Referencia funcional | Inventario Maestro v1.1 § 6.1 · Módulo 07 v1.1 § 6.2 · spec billing-subscription: collections-panel, deletion-after-prolonged-suspension, manual-payment-confirmation |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- **Actor:** Operador de Plataforma — acceso exclusivo, igual que ADMIN-01.
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible desde el panel de administración del Operador

---

## 3. Panel de contenido

### Eyebrow
```
Operador de Plataforma · Módulo 07
```

### Título de la pantalla
```
Gestión de cobros
```

### Subtítulo
```
Suscripciones anuales de todas las organizaciones miembro. Sin pasarela de pago — cobro por transferencia bancaria confirmada manualmente.
```

---

### Componentes presentes

**Filtros rápidos (chips en fila)**

- `Todos` (activo por defecto)
- `Próximos a vencer` — organizaciones ACTIVE con vencimiento en los próximos 15 días
- `Suspendidos` — organizaciones en estado SUSPENDED
- `Candidatas a borrado` — organizaciones con 6+ meses continuados en SUSPENDED
- `En periodo de prueba` — organizaciones ACTIVE dentro de sus primeros 90 días

**Tabla principal de organizaciones**

Columnas en orden fijo. Ordenación por defecto: días restantes ascendente (las más próximas a vencer o ya vencidas aparecen primero).

| Nº | Columna | Tipo | Notas |
|----|---|---|---|
| 1 | Nombre | Inter 500 · 13px · enlace a panel lateral de detalle | — |
| 2 | País | Badge ISO · IBM Plex Mono | Código ISO 2 letras |
| 3 | Estado | Badge de color | ACTIVE (verde) · SUSPENDED (naranja) · EN PRUEBA (azul) · CANDIDATA A BORRADO (rojo) |
| 4 | Último pago | IBM Plex Mono · 11px | Fecha del pago confirmado más reciente. `—` si no hay ninguno (en prueba o nunca pagó) |
| 5 | Vencimiento | IBM Plex Mono · 11px · rojo si ya vencido · naranja si < 15 días | Fecha calculada: fin del periodo de prueba (primer ciclo) o último pago + 365 días |
| 6 | Días restantes | Número · rojo si negativo · naranja si < 15 | Días hasta el vencimiento. Negativo si ya venció |
| 7 | Acciones | Botones inline | `Marcar pago recibido` (siempre visible para ACTIVE y EN PRUEBA) · `Reactivar` (solo SUSPENDED) · `Iniciar borrado` (solo CANDIDATA A BORRADO) |

**Sección "Candidatas a borrado" (aparece cuando hay organizaciones en ese estado)**

Bloque separado visualmente con borde rojo, justo encima de la tabla o filtrable desde el chip. Muestra las organizaciones con 6+ meses en SUSPENDED con:
- Nombre · País · Fecha de suspensión · Meses en SUSPENDED · Botón `Iniciar borrado`

El botón `Iniciar borrado` **requiere doble confirmación explícita** — modal con texto: `¿Iniciar borrado de [nombre]? Esta acción eliminará permanentemente todos los datos de la organización. Es irreversible.` + checkbox de confirmación + botón `Confirmar borrado`.

---

### Modal "Marcar pago recibido"

Se abre al pulsar el botón correspondiente en la tabla o en el panel lateral de detalle.

| Nº | Campo | Tipo | Oblig. | Default | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Fecha del pago | date picker | S | Hoy (editable) | `Fecha en que se recibió la transferencia` | Fecha pasada o presente · no futura |
| 2 | Nota interna | textarea | N | — | `Máx 300 caracteres · ej: referencia de transferencia, banco emisor` | Máx 300 chars |

**Botón:** `Confirmar pago recibido` → transiciona la organización a ACTIVE + recalcula vencimiento a fecha de pago + 365 días
**Botón texto plano:** `Cancelar`

---

### Panel lateral de detalle de organización (al hacer clic en una fila)

- Datos de la organización: nombre · país · email de contacto · fecha de incorporación
- Estado actual + fecha de inicio del estado actual
- Fecha de fin del periodo de prueba
- Historial completo de pagos confirmados: fecha de pago · operador que lo registró · nota interna
- Historial de cambios de estado: timestamp + operador
- Acciones contextuales: `Marcar pago recibido` · `Suspender manualmente` (si ACTIVE) · `Reactivar` (si SUSPENDED) · `Iniciar borrado` (si CANDIDATA A BORRADO)

---

### Datos de ejemplo

```
Filtro activo: Todos
Orden: días restantes ascendente

Fila 1: Distribuciones Ruiz SL     · ES · SUSPENDED · —           · 15 Feb 2026 · -133 días [rojo]   · [Reactivar]
Fila 2: Nordic Bearings AB         · SE · ACTIVE    · 30 Jun 2025 · 30 Jun 2026 · 2 días [naranja]   · [Marcar pago recibido]
Fila 3: Rodamientos del Sur SL     · ES · EN PRUEBA · —           · 27 Sep 2026 · 91 días [azul]     · [Marcar pago recibido]
Fila 4: NSK Europe Ltd             · DE · ACTIVE    · 1 Mar 2026  · 1 Mar 2027  · 246 días [verde]   · [Marcar pago recibido]
Fila 5: Timken Europe GmbH         · DE · CANDIDATA · —           · 28 Dic 2025 · -182 días [rojo]   · [Iniciar borrado]

Sección "Candidatas a borrado":
  Timken Europe GmbH · DE · Suspendida desde: 28 Dic 2025 · 6 meses en SUSPENDED · [Iniciar borrado]
```

---

## 4. Formulario

Ver sección 3 — Modal "Marcar pago recibido" (detalle de campos).

---

## 5. Panel VERA

**Estado:** Activa — modo gestión de cobros.

**Subtítulo del panel:** `Asistente del operador`

**Conversación tipo:**

> **VERA dice (al cargar):**
> Hay 2 organizaciones con vencimiento en los próximos 15 días: Nordic Bearings AB (2 días) y Acme Bearings Ltd (8 días). También hay 1 candidata a borrado: Timken Europe GmbH lleva 6 meses suspendida.
>
> **Usuario dice:**
> ¿Cuándo se suspendió Distribuciones Ruiz?
>
> **VERA responde:**
> Distribuciones Ruiz SL fue suspendida el 15 de febrero de 2026 — lleva 133 días en SUSPENDED. Todavía no alcanza los 6 meses para ser candidata a borrado.

---

## 6. Estados especiales

**Sin organizaciones próximas a vencer:**
- Filtro `Próximos a vencer` muestra: `No hay organizaciones con vencimiento en los próximos 15 días.`
- VERA: `Todo en orden — ningún vencimiento próximo.`

**Pago confirmado:**
- La organización pasa a ACTIVE inmediatamente (si estaba SUSPENDED)
- Su vencimiento se recalcula a fecha de pago + 365 días
- La fila desaparece del filtro `Suspendidos` y de `Próximos a vencer`
- VERA confirma: `Pago de Nordic Bearings AB confirmado. Nuevo vencimiento: 28 Jun 2027.`

**Borrado iniciado:**
- Modal de doble confirmación con checkbox
- Tras confirmar: todos los datos de la organización se eliminan permanentemente
- VERA: `Borrado de Timken Europe GmbH iniciado. Esta acción es irreversible.`

**Aviso automático de vencimiento próximo (15 días antes):**
- El sistema envía email al Administrador de Organización con datos bancarios para la transferencia
- La organización aparece resaltada en el filtro `Próximos a vencer`
- El aviso se envía una única vez por ciclo

---

## 7. Notas y excepciones al sistema base

- **Sin pasarela de pago** en ningún caso — el cobro es exclusivamente por transferencia bancaria confirmada manualmente por el Operador. Ningún formulario de esta pantalla procesa datos de tarjeta ni redirige a sistemas de pago.
- La **fecha de pago es editable** en el modal — puede ser diferente a "hoy" si el operador registra el pago con retraso respecto a cuando se recibió la transferencia.
- El **borrado nunca es automático** — siempre requiere doble confirmación explícita del Operador incluso para CANDIDATAS A BORRADO.
- La columna **Días restantes negativos** significa que la organización ya debería estar pagando o suspendida — valores negativos son posibles si el operador no ha procesado la suspensión todavía.
- El **periodo de prueba** (90 días) no requiere ninguna acción del operador — el sistema lo gestiona automáticamente desde la fecha de aprobación.
- Esta pantalla es **exclusiva del Operador de Plataforma** — ningún miembro distribuidor tiene acceso ni visibilidad.
- Cada acción queda registrada con el **ID del operador y timestamp** en el log de auditoría.

---

## 8. Prioridad de construcción

- [x] **Alta** — sin esta pantalla el operador no puede gestionar el ciclo de vida de las suscripciones.

---

*Spec ADMIN-02 · v1.0 · Bearingworld.io · Junio 2026*
