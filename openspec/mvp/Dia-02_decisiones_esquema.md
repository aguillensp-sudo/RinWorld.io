# Día 2 · Las tres decisiones antes del DDL

> **PROPUESTA — pendiente de aprobación del PO.** No se escribe una línea de DDL hasta que
> esté aprobada. El día 2 es el más irreversible del sprint: el esquema lo lee todo lo que
> viene después y cambiarlo el día 8 es migración más reescritura.

Fuentes consultadas, en orden de autoridad: `openspec/specs/*` (9 capabilities **cerradas**,
read-only por `CLAUDE.md` §1.3) → `Plan_MVP_Bearingworld_v1.0.md` → `ESTADO.md`.

**Hallazgo previo:** `ESTADO.md` describe las tres decisiones de forma que **contradice los
specs cerrados en dos puntos**. Están marcados ⚠ abajo y son las preguntas de la puerta.

---

## 1 · Frontera de cifrado

La regla no es "catálogo en claro, negociación cifrada". Es **por columna, en las dos
tablas** — y el catálogo también tiene una columna cifrada.

### 1.1 Líneas de inventario (`inventory_lines`)

| Columna | Tratamiento | Fuente |
|---|---|---|
| `part_number`, `brand`, `quantity`, `location_country`, `product_family` | **claro + indexado** (obligatorias) | `inventory-management` · canonical-schema |
| `status` (PUBLISHED/DRAFT/ARCHIVED), `updated_at`, `org_id` | **claro** (frescura, RLS, agregados) | INV-01 · PANEL-01 |
| `unit_price` | ⚠ **`bytea` E2EE** — "nunca se indexa en texto plano ni es accesible para el servidor" | `inventory-management` · scenario *unit_price cifrado E2EE* |

⚠ **Esto es lo que `ESTADO.md` se salta.** Si el DDL de hoy sigue la simplificación
"lo cifrado es la negociación, no el catálogo", `unit_price` acaba en claro en la tabla de
inventario — y eso es exactamente el fallo del día 11 que `ESTADO.md` describe: abrir el panel
de vista-servidor delante del socio y ver texto plano donde debía haber cifrado.

**Nota:** `quantity` va **en claro en el inventario** (es obligatoria y buscable) y **cifrada
en las tarjetas** de consulta y oferta. Mismo nombre, tratamiento opuesto. Es la trampa más
fácil de pisar en el DDL y en el prompt del Coder del día 3.

### 1.2 Elementos del hilo (`thread_items` — mensajes, consultas y ofertas)

`e2ee-content-encryption` obliga a cifrar **todo el contenido** de cualquier elemento, y
`RNG-MSG-02` añade la restricción dura: **ninguna transición de estado del hilo puede
requerir descifrar**. Eso decide sola la frontera.

| Claro (metadato) | Cifrado (`bytea`) |
|---|---|
| `id`, `thread_id`, `sender_org_id`, `item_type`, `created_at` | texto del mensaje libre |
| `part_number`, `brand` (heredados, no editables) | `quantity` (consulta y oferta) |
| `estado_oferta`, `estado_consulta` | `unit_price`, `currency` |
| `responds_to_item_id`, `superseded_by_item_id` | `lead_time_days` |
| | `shipping_cost`, `shipping_cost_currency` |
| | `valid_until`, `notes` |

Cifrados según la lista literal de `RNG-VND-01` (`Rinworld_spec_VND-01.md:146`), más
`shipping_cost_currency` que aparece en `offer-card` pero no en esa lista — se cifra por
coherencia: la divisa del transporte junto al importe cifrado no aporta nada al servidor.

`part_number` y `brand` **en claro** es obligatorio, no una concesión: VND-01 muestra la
columna Referencia sin descifrar, y VERA notifica "organización y referencia sin revelar la
cantidad" (`vera-drafting-assistance`).

`valid_until` cifrado implica que **el servidor no puede caducar ofertas**. Coherente con el
spec: el aviso "Esta oferta ha expirado" se muestra *en local* y el receptor puede aceptarla
igualmente — la fecha es orientativa, no contractual en V1.

**Verificación de la frontera (test del día 2):** los 4 contadores de PANEL-01 y todas las
columnas de VND-01 tienen que calcularse con `SELECT` sin una sola clave. Si alguno necesita
descifrar, la frontera está mal (`RNG-PANEL-01`, `RNG-VND-01`).

---

## 2 · Catálogo buscable vs. negociación cifrada

**Buscable entre organizaciones** (índices reales): `part_number`, `brand`, `quantity`,
`location_country`, `product_family`, `status`, `updated_at`. Sin esto SRCH-01 no encuentra
nada el día 6.

**Consecuencia que hay que aceptar hoy:** con `unit_price` cifrado, **SRCH-01 no puede
ordenar ni filtrar por precio, nunca.** No es una limitación del MVP — `conversational-search`
ya lo tiene en *Out of Scope*: "Ordenación por precio (`unit_price` cifrado E2EE, no indexable
server-side)". El precio se ve al abrir la negociación, no en la parrilla de resultados.

**INV-07 · visibilidad.** Dos modos por organización (`VISIBLE_TODOS` por defecto,
`RESTRINGIDA`) más lista de exclusión por nombre de organización y/o geografía. En el MVP va
**en el esquema y en la RLS, sin UI** — pero con dos detalles que no son opcionales porque
cambian el DDL:

- Al pasar de `RESTRINGIDA` a `VISIBLE_TODOS` la lista **queda inactiva pero no se borra**, y
  se recupera al reactivar → la exclusión es una **tabla propia** (`inventory_exclusions`) con
  el modo en la organización, no un array que se vacía.
- Efecto **inmediato**: la exclusión se evalúa en la política RLS de lectura, no en un job.

---

## 3 · Máquina de estados de la oferta ⚠ CONFLICTO

`ESTADO.md` propone:

```
BORRADOR → ENVIADA → {CONTRAOFERTADA → ENVIADA | ACEPTADA | RECHAZADA | RETIRADA}
```

El spec **cerrado** (`messaging-and-negotiation` · `offer-card`) dice otra cosa:

```
estado_oferta ∈ {Pendiente, Aceptada, Rechazada, Superada por contraoferta}
```

Cuatro diferencias, y ninguna es cosmética:

| # | `ESTADO.md` | Spec cerrado |
|---|---|---|
| 1 | `BORRADOR` | No existe. La oferta **nace** `Pendiente` al enviarse; el borrador no se persiste |
| 2 | `ENVIADA` | Se llama `Pendiente` |
| 3 | `CONTRAOFERTADA → ENVIADA` (la fila vuelve a estado anterior) | `Superada por contraoferta` es **terminal**. La contraoferta es una **fila nueva** que nace `Pendiente`, "sin eliminarse del historial" |
| 4 | `RETIRADA` | No existe. No hay escenario de retirada |

La diferencia 3 es la grave: el ciclo de `ESTADO.md` implica que la misma fila se reutiliza, y
eso **destruye el historial** que el spec exige conservar. Un `CHECK` construido sobre la
versión de `ESTADO.md` no sería un error de estilo: contradiría una capability cerrada.

### Y falta una máquina entera

`ESTADO.md` no menciona `thread-lifecycle`, que es **igual de irreversible** y vive en el
mismo DDL:

```
ABIERTO · CON CONSULTA PENDIENTE · CON OFERTA PENDIENTE · ACUERDO ALCANZADO · CERRADO SIN ACUERDO
```

Con dos reglas que condicionan las columnas: toda transición se calcula **solo con
metadatos** (`RNG-MSG-02`), y el rechazo devuelve el hilo a `ABIERTO` **o** a
`CON CONSULTA PENDIENTE` según si queda otra consulta pendiente en el hilo — lo que obliga a
que "¿hay otra consulta pendiente?" sea consultable sin descifrar.

Hay además un tercer estado de tarjeta: la **consulta** (`pendiente` →
`Respondida con oferta`), con la regla de una sola consulta por línea de inventario y
comprador, y el marcado de "línea consultada" **persistente e independiente del estado del
hilo** (no se resetea al cerrar el hilo; sí al reemplazar la línea por otra con nuevo id
tras un reemplazo total).

---

## Lo que se escribe en cuanto esto se apruebe

1. `organizations`, `members`, auth de dos organizaciones + RLS por `org_id`.
2. `inventory_lines` con la frontera de §1.1 e índices de §2.
3. `inventory_visibility_mode` + `inventory_exclusions` + política RLS de lectura cruzada.
4. `threads`, `thread_items` con la frontera de §1.2.
5. Los tres `CHECK` de estado + la máquina del hilo, en la versión que se apruebe en §3.

**Puerta de salida del día 2** (sin cambios): dos navegadores, dos cuentas, cada una entra y
ve su propia sesión. CI en verde.

---

*Propuesta redactada el 6-ago-2026 · pendiente de aprobación del PO*
