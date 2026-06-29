# Spec de Pantalla — `ADMIN-01` · Panel de Aprobación del Operador

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | ADMIN-01 |
| Nombre | Panel de Aprobación del Operador |
| Módulo | 01 — Onboarding, Registro y Claves E2EE |
| Referencia funcional | Inventario Maestro v1.1 § 2.3 · Módulo 01 v1.5 §§ 3.2B, 3.2.3 · spec organization-onboarding: operator-approval |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- **Actor:** Operador de Plataforma — rol distinto al de miembro distribuidor. Accede con credenciales propias.
- Ítem activo en nav: ninguno de los ítems estándar — el Operador tiene su propia vista de navegación.
- Panel de contenido: fondo Cold White `#F1F3F6`
- Accesible exclusivamente desde el panel de administración del Operador

---

## 3. Panel de contenido

### Eyebrow
```
Operador de Plataforma · Módulo 01
```

### Título de la pantalla
```
Cola de solicitudes de registro
```

### Subtítulo
```
Solicitudes de organizaciones que han completado el FSR y esperan aprobación manual. Ordenadas de más antigua a más reciente.
```

---

### Componentes presentes

**Filtros rápidos (chips en fila)**

- `Pendientes` (activo por defecto) — estado PENDING_REVIEW
- `Aprobadas` — estado INVITED_APPROVED
- `Rechazadas` — estado REJECTED
- `Canceladas` — estado CANCELLED (timeout de 30 días sin decisión)
- `Todas`

**Tabla de solicitudes**

Columnas en orden fijo:

| Nº | Columna | Tipo | Notas |
|----|---|---|---|
| 1 | Nombre de la organización | Inter 500 · 13px | Enlace que abre el panel lateral de detalle |
| 2 | País | Badge ISO · IBM Plex Mono | Código ISO 2 letras |
| 3 | Email del solicitante | Inter 400 · 13px | Email introducido en el FSR |
| 4 | Teléfono | Inter 400 · 13px | Teléfono del FSR (puede estar vacío) |
| 5 | Sitio web | Enlace externo · 12px | URL del FSR (puede estar vacío) |
| 6 | Fecha de solicitud | IBM Plex Mono · 11px | Timestamp de envío del FSR |
| 7 | Antigüedad en cola | IBM Plex Mono · 11px · naranja si > 24h | Tiempo transcurrido desde el envío. En naranja si > 24h, en rojo si > 48h |
| 8 | Estado | Badge de color | PENDING\_REVIEW (naranja) · INVITED\_APPROVED (verde) · REJECTED (rojo) · CANCELLED (gris) |

**Ordenación por defecto:** antigüedad descendente (la solicitud más antigua arriba).

**Panel lateral de detalle (al hacer clic en una fila)**

Se despliega a la derecha del área de contenido, sin salir de la pantalla. Muestra:

- Todos los datos del FSR: nombre empresa · país · email · teléfono · sitio web
- Nombre y apellidos del solicitante
- Fecha y hora exacta del envío
- Historial de cambios de estado (con timestamp y operador que tomó la decisión)

**Acciones disponibles desde el panel lateral (solo para solicitudes PENDING_REVIEW):**

- **Botón primario:** `Aprobar` → transiciona a INVITED_APPROVED + envía email EML-07 al solicitante con enlace al FRO + registra ID del operador y timestamp
- **Botón secundario (texto plano):** `Rechazar` → abre campo de motivo obligatorio. Al confirmar: transiciona a REJECTED + envía email EML-08 con el motivo + registra decisión.

**Para solicitudes REJECTED (reversión manual):**
- **Botón texto plano:** `Volver a revisión` → transiciona a PENDING_REVIEW · la solicitud reaparece en la cola

---

### Datos de ejemplo

```
Filtro activo: Pendientes (3 solicitudes)
Orden: más antigua primero

Fila 1: Distribuciones Álvarez SL · ES · jalvarez@distribalvarez.com · +34 91 234 56 78 · — · Hace 52 horas [rojo] · PENDING_REVIEW
Fila 2: Nordic Bearings AB       · SE · info@nordicbearings.se      · +46 8 123 456   · https://nordicbearings.se · Hace 18 horas [naranja] · PENDING_REVIEW
Fila 3: Roulements France SAS    · FR · contact@roulementsfrance.fr · +33 1 23 45 67 · https://roulementsfrance.fr · Hace 3 horas · PENDING_REVIEW

Panel lateral abierto → Fila 1:
  Nombre empresa: Distribuciones Álvarez SL
  País: España (ES)
  Email: jalvarez@distribalvarez.com
  Nombre solicitante: Juan Álvarez García
  Teléfono: +34 91 234 56 78
  Sitio web: —
  Enviado: 28 Jun 2026 · 08:14
  Historial: [PENDING_REVIEW] 28 Jun 2026 08:14 — Envío FSR

  [Aprobar]  [Rechazar]
```

---

## 4. Formulario — campo de motivo de rechazo

Se muestra inline en el panel lateral al pulsar `Rechazar`:

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Motivo del rechazo | textarea | S | `Explica el motivo del rechazo — se enviará al solicitante` | `Este texto se incluirá en el email de rechazo (EML-08)` | Mín 10 / máx 500 caracteres |

**Botón:** `Confirmar rechazo` (primario) · `Cancelar` (texto plano)

---

## 5. Panel VERA

**Estado:** Activa — modo administración de solicitudes.

**Subtítulo del panel:** `Asistente del operador`

**Conversación tipo:**

> **VERA dice (al cargar):**
> Tienes 3 solicitudes pendientes. La más antigua lleva 52 horas en cola — Distribuciones Álvarez SL (ES). ¿Quieres que te lleve a esa solicitud?
>
> **Usuario dice:**
> ¿Cuántas solicitudes llevan más de 24 horas?
>
> **VERA responde:**
> Dos: Distribuciones Álvarez SL (52h) y Nordic Bearings AB (18h). La tercera, Roulements France, lleva solo 3 horas.

---

## 6. Estados especiales

**Cola vacía (ninguna solicitud pendiente):**
- Mensaje centrado: `No hay solicitudes pendientes de revisión.`
- VERA: `Todo al día — la cola está vacía.`

**Timeout automático (30 días sin decisión):**
- El sistema transiciona automáticamente a CANCELLED
- La solicitud desaparece del filtro `Pendientes` y aparece en `Canceladas`
- El solicitante recibe notificación de cancelación por timeout

**Aprobación ejecutada:**
- La fila desaparece del filtro `Pendientes`
- Badge cambia a INVITED_APPROVED (verde)
- VERA confirma: `Distribuciones Álvarez SL aprobada. Email enviado al solicitante.`

**Rechazo ejecutado:**
- La fila desaparece del filtro `Pendientes`
- Badge cambia a REJECTED (rojo)
- VERA confirma: `Solicitud rechazada. Email enviado con el motivo indicado.`

---

## 7. Notas y excepciones al sistema base

- Esta pantalla es **exclusiva del Operador de Plataforma** — los usuarios distribuidores no tienen acceso ni visibilidad de ella.
- Cada decisión (aprobación o rechazo) queda registrada con el **ID del operador y timestamp** en el log de auditoría — obligatorio por diseño.
- El campo de motivo de rechazo es **obligatorio y se envía al solicitante** en el email EML-08 — no es un campo interno.
- VERA en esta pantalla opera sobre **metadatos de las solicitudes** (nombre, país, antigüedad) — nunca sobre datos sensibles del solicitante.
- El ítem activo del nav puede ser diferente al de los usuarios distribuidores — el Operador de Plataforma tiene su propio acceso restringido.

---

## 8. Prioridad de construcción

- [x] **Alta** — sin esta pantalla no es posible activar ninguna organización en la plataforma.

---

*Spec ADMIN-01 · v1.0 · Bearingworld.io · Junio 2026*
