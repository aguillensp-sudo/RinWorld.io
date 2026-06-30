# Spec de Pantalla — `VND-01` · Mis Ofertas (vista del vendedor)

> **Nota sobre el prototipo HTML:** El fichero `VND-01 · VND v1.0.html` muestra columnas de precio, cantidad, plazo y transporte con datos de ejemplo. Esas columnas son **ficticias en el prototipo** — sirven para visualizar el layout pero **no serán implementadas** en V1. Esta spec documenta el comportamiento real a construir.

> **Decisión de producto (Junio 2026):** Opción B — VND-01 muestra exclusivamente metadatos. Los campos cifrados E2EE (precio, cantidad, plazo, transporte) solo son visibles dentro del hilo correspondiente en MSG-02. Esta decisión preserva la invariante RNG-MSG-01 del Módulo 04 v1.5 sin requerir descifrado client-side en esta pantalla.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | VND-01 |
| Nombre | Mis Ofertas — Vista agregada del vendedor |
| Módulo | 04 — Mensajería E2EE, Consultas y Negociación (vista de metadatos) |
| Referencia funcional | Módulo 04 v1.5 §§ 6, 7, 3.3 · spec messaging-and-negotiation: offer-card |
| Nav activo | Vendiendo |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Vendiendo**
- Panel de contenido: fondo Cold White `#F1F3F6`

---

## 3. Panel de contenido

### Eyebrow
```
Vendiendo · VND-01
```

### Título de la pantalla
```
Mis ofertas
```

### Subtítulo
```
Resumen de las ofertas enviadas a compradores. Para ver precio y condiciones de una oferta, abre el hilo correspondiente.
```

---

## 4. Barra de búsqueda

Un campo de texto sobre la tabla.

| Atributo | Valor |
|---|---|
| Placeholder | `Buscar por referencia u organización…` |
| Filtra en tiempo real | Sí — sobre Referencia y Organización |
| Botón limpiar | Aparece (×) cuando hay texto; al pulsar, limpia y restaura la tabla completa |
| Conteo de resultados | Texto a la derecha: `N ofertas` — se actualiza con el filtro |

---

## 5. Tabla de Mis Ofertas

### 5.1 Columnas

| Nº | Columna | Contenido | Clasificación E2EE | Ordenable |
|----|---|---|---|---|
| 1 | **Referencia** | `part_number · brand` en IBM Plex Mono | Metadato | Sí |
| 2 | **Organización** | Nombre del comprador, enlace → DIR-02 | Metadato | Sí |
| 3 | **Estado** | Badge de estado de la oferta (ver 5.2) | Metadato | Sí |
| 4 | **Fecha** | Timestamp de envío de la oferta — `DD Mmm YYYY` | Metadato | Sí (orden por defecto: DESC) |
| 5 | **Acciones** | Botones contextuales (ver 5.3) | — | **No** |

> **Por qué no hay columnas de precio, cantidad, plazo ni transporte:** estos campos forman parte del **contenido cifrado E2EE** de la tarjeta de oferta (RNG-MSG-01, Módulo 04 v1.5 § 3.3). El servidor no los almacena en texto plano y VND-01 es una vista servida desde metadatos del Messaging Service. Para ver esos campos, el usuario debe abrir el hilo en MSG-02 e introducir su passphrase si no está en sesión.

### 5.2 Estados de la oferta (badge)

| Estado | Color | Descripción |
|---|---|---|
| `PENDIENTE` | Naranja | La oferta está en espera de respuesta del comprador |
| `ACEPTADA` | Verde | El comprador ha aceptado la oferta |
| `RECHAZADA` | Rojo | El comprador ha rechazado la oferta |
| `EXPIRADA` | Steel Mist (gris) | La fecha `valid_until` ha pasado y la oferta sigue pendiente |

Fuente de estados: metadatos del Messaging Service — calculados sin descifrar contenido (sección 7 del Módulo 04 v1.5).

### 5.3 Acciones por estado

| Estado | Acciones disponibles |
|---|---|
| PENDIENTE | `Ver hilo` (→ MSG-02) · `Retirar oferta` |
| ACEPTADA | `Ver acuerdo` (→ MSG-02) |
| RECHAZADA | `Ver hilo` (→ MSG-02) |
| EXPIRADA | `Renovar` (abre el formulario de nueva oferta en MSG-02, pre-cargado con misma referencia y organización) |

### 5.4 Ordenación

- Todas las columnas menos **Acciones** son ordenables pulsando la cabecera.
- Orden por defecto: **Fecha descendente** (oferta más reciente primero).
- Al pulsar una cabecera ya activa, invierte el sentido. Indicador visual (↑ / ↓) en la cabecera activa.

### 5.5 Estado vacío

Si no hay ofertas que mostrar (sin ofertas enviadas, o búsqueda sin resultados):

```
[Icono bandeja vacía]
No tienes ofertas enviadas aún.
```

Si hay búsqueda activa sin resultados:
```
No hay ofertas que coincidan con la búsqueda.
```

---

## 6. Panel VERA

**Estado:** Activa — modo resumen de ofertas.

**Subtítulo del panel:** `Agente de búsqueda`

VERA tiene visibilidad sobre los **metadatos** de todas las ofertas listadas — referencia, organización, estado, fecha — pero no sobre su contenido cifrado (precio, cantidad, condiciones).

**Capacidades de VERA en esta pantalla:**

| Acción | Comportamiento |
|---|---|
| Filtrar por estado | "Muéstrame solo las PENDIENTES" → aplica filtro de estado sobre la tabla |
| Buscar por organización | "¿Tengo alguna oferta para NSK Europe?" → filtra la tabla por organización |
| Resumir estado global | "¿Cuántas ofertas tengo pendientes?" → VERA responde con recuento de metadatos |
| Ordenar | "Ordénalas por organización" → aplica ordenación |
| Navegar al hilo | "Abre el hilo con Distribuciones Álvarez" → navega a MSG-02 |

**Lo que VERA no puede hacer en VND-01:**
- Informar del precio o condiciones de ninguna oferta (contenido E2EE inaccesible)
- Resumir o comparar precios entre ofertas

---

## 7. Reglas de negocio

| ID | Regla |
|---|---|
| RNG-VND-01 | VND-01 muestra únicamente metadatos de las tarjetas de oferta enviadas por la organización activa. Ningún campo de contenido E2EE (unit_price, quantity, currency, lead_time_days, shipping_cost, valid_until, notes) es devuelto ni mostrado en esta vista. |
| RNG-VND-02 | Solo se muestran ofertas en las que la organización activa es la **emisora** (vendedor). Las ofertas recibidas como comprador no aparecen en esta vista. |
| RNG-VND-03 | El botón "Renovar" (estado EXPIRADA) navega a MSG-02 con el formulario de nueva oferta pre-cargado con la misma referencia y organización. No crea automáticamente una nueva oferta. |
| RNG-VND-04 | El botón "Retirar oferta" (estado PENDIENTE) requiere confirmación del usuario — VERA clasifica esta acción como REVERSIBLE con confirmación ligera (no es una acción de alto impacto, ya que el acuerdo no tiene valor contractual en la plataforma). |

---

## 8. API / Datos (orientación para implementación)

VND-01 consume un endpoint de metadatos del Messaging Service que devuelve, para la organización autenticada como emisora:

```
GET /api/offers/sent
Response: [
  {
    offer_id: string,
    thread_id: string,
    part_number: string,        // metadato — no cifrado
    brand: string,              // metadato — no cifrado
    counterpart_org_name: string, // metadato — no cifrado
    counterpart_org_id: string,
    offer_status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'EXPIRADA',
    sent_at: ISO8601 timestamp
    // unit_price, quantity, etc. NO se devuelven en este endpoint
  }
]
```

---

## 9. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-VND-01 | La tabla muestra solo las columnas Referencia, Organización, Estado, Fecha y Acciones — sin precio, cantidad, plazo ni transporte en ningún caso. |
| CA-VND-02 | El campo de búsqueda filtra en tiempo real por Referencia y por Organización. |
| CA-VND-03 | El orden por defecto es Fecha descendente (oferta más reciente en primera posición). |
| CA-VND-04 | Todas las columnas excepto Acciones son ordenables por clic en cabecera, con indicador visual. |
| CA-VND-05 | El botón "Ver hilo" / "Ver acuerdo" navega correctamente a MSG-02 con el hilo correspondiente cargado. |
| CA-VND-06 | Un usuario sin passphrase activa en sesión puede ver VND-01 y sus metadatos — la passphrase solo se solicita al abrir el hilo en MSG-02. |
| CA-VND-07 | VERA puede filtrar, ordenar, buscar y resumir sobre los metadatos de la tabla, pero no puede informar de precio ni condiciones de ninguna oferta. |

---

## 10. Prioridad de construcción

- [ ] **Media** — depende de MSG-01 y MSG-02

---

*Spec VND-01 · v1.0 · Bearingworld.io · Junio 2026*
