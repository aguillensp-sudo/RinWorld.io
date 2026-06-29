# Spec de Pantalla — `MSG-03` · Tarjetas de Consulta y Oferta

> **Nota:** MSG-03 no es una pantalla independiente — es un **componente visual** que se renderiza dentro de MSG-02. Los formularios de creación de consulta y oferta también se abren como panels o modales dentro de MSG-02. Se documenta como spec propio por la complejidad de sus campos y sus reglas de negocio.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | MSG-03 |
| Nombre | Tarjetas de Consulta y Oferta (componente dentro de MSG-02) |
| Módulo | 04 — Mensajería E2EE, Consultas y Negociación |
| Referencia funcional | Inventario Maestro v1.1 §§ 5.3, 5.4 · Módulo 04 v1.5 §§ 5, 6 · spec messaging-and-negotiation: inquiry-card, offer-card, e2ee-content-encryption |

---

## 2. Layout

**Variante:** Componente renderizado dentro de MSG-02 — no tiene shell propio.

El formulario de creación se abre como panel lateral o modal dentro de MSG-02, sin salir de la pantalla del hilo.

---

## 3. Tarjeta de Consulta

### 3.1 Diseño visual de la tarjeta (en el historial de MSG-02)

La tarjeta de consulta se distingue del mensaje libre por un diseño de tarjeta estructurada:

- **Cabecera de la tarjeta:** badge `CONSULTA` (azul) + referencia del rodamiento en IBM Plex Mono · 13px
- **Organización autora** (nombre completo, clickable → navega directamente a la ficha de esa organización en DIR-02) + timestamp
- **Contenido (cifrado E2EE — visible solo con passphrase activa):**
  - Referencia: `part_number · brand` (IBM Plex Mono)
  - País del distribuidor consultado: badge ISO
  - Cantidad solicitada: número destacado
  - Nota opcional: texto libre en cursiva · Steel Mist
- **Estado de la tarjeta:** badge de color
  - `PENDIENTE` — naranja — sin respuesta
  - `RESPONDIDA` — verde — se ha enviado una oferta en respuesta
  - `SIN STOCK` — Steel Mist — el distribuidor comunicó que no tiene
- **Acciones (solo para el receptor distribuidor):** `Responder con oferta` · `Comunicar sin stock`

### 3.2 Formulario de creación de tarjeta de consulta

Se abre automáticamente cuando el usuario pulsa `Consultar` en SRCH-01 o `Crear consulta` dentro del hilo.

| Nº | Campo | Tipo | Oblig. | Valor | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Referencia (part_number) | text · solo lectura | S | Heredado del contexto de SRCH-01 | `Heredado de la búsqueda · no editable` | — |
| 2 | Marca (brand) | text · solo lectura | S | Heredado del contexto | `Heredado de la búsqueda · no editable` | — |
| 3 | País del distribuidor (location_country) | text · solo lectura | S | Heredado del contexto | `País de stock del distribuidor · no editable` | — |
| 4 | Cantidad solicitada (quantity) | integer | S | — | `Número de unidades que necesitas` | Entero positivo · campo obligatorio · el botón de envío permanece deshabilitado sin este campo |
| 5 | Notas adicionales | textarea | N | — | `Máx 300 caracteres · condiciones, plazos, preguntas adicionales` | Máx 300 caracteres |

**Botón:** `Enviar consulta` (cifra el contenido antes de enviar)
**Botón texto plano:** `Cancelar`

**Bloqueo por duplicado:** Si el mismo comprador ya envió una consulta sobre esta misma línea de inventario y está pendiente de respuesta, el botón de envío se bloquea con el aviso: `Ya tienes una consulta pendiente para esta referencia con este distribuidor.`

---

## 4. Tarjeta de Oferta

### 4.1 Diseño visual de la tarjeta (en el historial de MSG-02)

- **Cabecera:** badge `OFERTA` (verde) + referencia en IBM Plex Mono · 13px
- **Organización autora** (nombre completo, clickable → navega directamente a la ficha de esa organización en DIR-02) + timestamp
- **Contenido (cifrado E2EE — visible solo con passphrase activa):**
  - Referencia: `part_number · brand` (IBM Plex Mono)
  - Precio unitario: número destacado + divisa (ej. `2,10 EUR`)
  - Cantidad: número
  - Plazo de entrega: `X días` (si informado)
  - Coste de transporte: `X,XX EUR` (si informado) — si no informado, la línea no aparece
  - Válida hasta: fecha (si informada) — aviso visual si ha expirado
  - Notas: texto libre en cursiva · Steel Mist
- **Estado de la tarjeta:** badge de color
  - `PENDIENTE` — naranja — sin aceptar ni rechazar
  - `ACEPTADA` — verde
  - `RECHAZADA` — rojo
  - `EXPIRADA` — Steel Mist — válida hasta pasada (el receptor puede aceptarla igualmente — es orientativa en V1)
- **Acciones (solo para el receptor comprador):**
  - `Aceptar oferta` → estado hilo ACUERDO ALCANZADO
  - `Rechazar` → estado de la tarjeta RECHAZADA (el hilo sigue abierto)
  - `Contra-ofertar` → abre nuevo formulario de oferta con los campos pre-rellenos

### 4.2 Formulario de creación de tarjeta de oferta

Se abre al pulsar `Crear oferta` dentro de MSG-02 o `Responder con oferta` en una tarjeta de consulta.

| Nº | Campo | Tipo | Oblig. | Placeholder / Default | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Referencia (part_number) | text | S | Heredado de la consulta si aplica · editable si es oferta directa | `Código de rodamiento` | Mín 2 chars |
| 2 | Marca (brand) | text | S | Heredado de la consulta si aplica · editable | `Fabricante` | Mín 2 chars |
| 3 | Precio unitario (unit_price) | decimal (2 dec) | S | — | `Precio por unidad · cifrado E2EE` | Decimal positivo · nunca pre-relleno por VERA |
| 4 | Divisa (currency) | select ISO 4217 | S | Divisa por defecto de la organización | `ISO 4217` | — |
| 5 | Cantidad (quantity) | integer | S | Pre-relleno desde la consulta si aplica · editable | `Unidades disponibles` | Entero positivo |
| 6 | Plazo de entrega (lead_time_days) | integer | N | — | `Días desde confirmación del pedido` | Entero positivo |
| 7 | Coste de transporte (shipping_cost) | decimal (2 dec) | N | — | `Sin cálculo automático — introduce manualmente` | Decimal positivo. Si tiene valor, el campo shipping_cost_currency es obligatorio |
| 8 | Divisa del transporte (shipping_cost_currency) | select ISO 4217 | N (oblig. si campo 7 tiene valor) | Igual a currency · editable | — | — |
| 9 | Válida hasta (valid_until) | date picker | N | — | `Si no se informa, la oferta no expira automáticamente` | Fecha futura |
| 10 | Notas (notes) | textarea | N | — | `Máx 500 caracteres · incoterm, forma de pago, condiciones adicionales` | Máx 500 chars |

**Botón:** `Enviar oferta` (cifra todo el contenido antes de enviar)
**Botón texto plano:** `Cancelar`

---

## 5. Panel VERA

**Estado:** Activo en el contexto de MSG-02 — asiste la redacción de consultas y ofertas.

**Conversación tipo (tarjeta de consulta):**

> **Usuario dice:**
> Consulta a este distribuidor si tiene 300 unidades
>
> **VERA responde:**
> Voy a rellenar el formulario de consulta con 300 unidades. El resto de campos vienen del contexto de búsqueda. Revísalo antes de enviar.
> [Pre-rellena quantity=300 en el formulario · muestra para confirmación]

**Conversación tipo (tarjeta de oferta):**

> **Usuario dice:**
> Ofrécele 2,10€ por unidad para 500 piezas con entrega en dos semanas
>
> **VERA responde:**
> Propongo esta oferta — revísala antes de cifrar y enviar:
> · Precio: 2,10 EUR/unidad
> · Cantidad: 500
> · Plazo: 14 días
> ¿La enviamos tal cual?

**VERA nunca:**
- Propone ni sugiere una cifra de precio que el usuario no haya proporcionado explícitamente
- Accede al contenido cifrado de elementos ya enviados o recibidos en el hilo

---

## 6. Estados especiales

**Coste de transporte no informado:**
- La línea de shipping_cost no aparece en la tarjeta renderizada
- No se muestra `0` ni `—` — simplemente la línea no existe

**Oferta con valid_until expirada:**
- Badge `EXPIRADA` · Steel Mist
- Aviso: `Esta oferta ha expirado. Puedes aceptarla igualmente — la fecha es orientativa.`
- El receptor puede aceptarla: la fecha de validez no es contractual en V1

**Consulta duplicada bloqueada:**
- Si ya existe una consulta PENDIENTE para la misma línea con el mismo distribuidor
- Botón `Enviar consulta` deshabilitado + mensaje: `Ya tienes una consulta pendiente para esta referencia con este distribuidor.`

---

## 7. Notas y excepciones al sistema base

- **Todo el contenido de ambas tarjetas está cifrado E2EE** — el usuario lo ve en claro en su dispositivo, pero el servidor solo almacena ciphertext. Los campos `unit_price`, `quantity`, `notes` y todos los demás campos de contenido son ilegibles para el servidor.
- Los campos `part_number`, `brand` y `location_country` de la tarjeta de consulta son **heredados del contexto de SRCH-01** y no editables — provienen del resultado de búsqueda en el que el usuario pulsó `Consultar`.
- El campo `unit_price` **nunca es pre-rellenado por VERA** — es el único campo que requiere intervención manual explícita del usuario en todos los casos.
- La tarjeta de oferta puede enviarse **directamente sin estar respondiendo a ninguna consulta** (`Crear oferta` en MSG-02) — en ese caso, los campos `part_number` y `brand` son editables manualmente.
- `CERRADO SIN ACUERDO` en el hilo es el único **estado irreversible** — todos los demás admiten transición.

---

## 8. Prioridad de construcción

- [x] **Alta** — corazón de la propuesta de valor diferencial de la plataforma.

---

*Spec MSG-03 · v1.1 · Bearingworld.io · Junio 2026*
