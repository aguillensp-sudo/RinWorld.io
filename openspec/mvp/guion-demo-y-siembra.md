# Guion de demo y siembra del catálogo

> **Propuesta — pendiente de confirmación del PO.** El Coder no siembra hasta que esté cerrada.
>
> Plan §8 es explícito: las 200 líneas se diseñan **hacia atrás desde el guion de demo**, no al
> revés. "200 líneas curadas rinden más que 2.000 aleatorias." Este documento fija primero qué
> se busca y luego qué hay que sembrar para que esa búsqueda luzca. Es la entrada del prompt del
> Coder del día 3, y sobrevive al día 3: la demo es de los días 11, 13 y 15.

---

## 1 · La búsqueda de la demo

Decisión del PO (6-ago): se busca por **referencia, marca, cantidad y zona**, y los resultados
**se ordenan y se filtran**.

Eso encaja con `single-reference-search`, que fija los cuatro chips editables: **marca, país,
cantidad mínima y plazo**. La referencia no es un chip: es la consulta.

**El momento a provocar, en dos pasos:**

| Paso | Lo que dice el socio | Lo que hace el sistema |
|---|---|---|
| 1 | *"Necesito 500 unidades de 6205-2RS en Europa"* | VERA interpreta y llena tres chips: referencia `6205-2RS`, cantidad mínima `500`, zona `Europa`. Resultados ordenados por cantidad descendente (orden por defecto del spec) |
| 2 | *"solo SKF, y que el plazo no pase de una semana"* | Refina sin repetir lo anterior: añade chip marca `SKF` y chip plazo `≤ 7 días`. `single-reference-search` · escenario "refinamiento en sesión activa" |
| 3 | clic en cabecera **Plazo** | Reordena ascendente. Es lo que exige `Rinworld_spec_SRCH-01.md` línea 83 |

**Referencia elegida: `6205-2RS`.** Es el rodamiento rígido de bolas más común del mercado, así
que un catálogo con muchas líneas de esa referencia es verosímil, y ya es la que sembramos el
día 2. Si prefieres otra, es cambiar un valor en este documento.

> **Lo que NO se puede pedir en la demo, y conviene saberlo antes de la reunión:** ordenar o
> filtrar **por precio**. `unit_price` va cifrado extremo a extremo, también en la línea de
> inventario, y no se indexa. Está en el *Out of Scope* de `conversational-search`. No es una
> carencia que disimular: **es el argumento**. Si el socio pregunta por qué no se puede ordenar
> por precio, la respuesta es que el servidor no puede leerlo — que es exactamente lo que se le
> está vendiendo.

---

## 2 · Lo que el catálogo tiene que contener para que eso luzca

Los cuatro puntos de Plan §8, aterrizados:

### 2.1 La referencia de la demo, engineered

**8–10 líneas de `6205-2RS`** repartidas entre las organizaciones distribuidoras, diseñadas para
que la tabla enseñe todos sus comportamientos:

| Lo que tiene que verse | Cómo se siembra |
|---|---|
| Cantidad en verde vs. Steel Mist | Líneas **por encima y por debajo de 500** unidades. La columna 4 pinta verde si ≥ cantidad mínima |
| El chip de plazo sirviendo para algo | Plazos de **2 a 21 días**, con al menos tres por debajo de 7 y varios por encima |
| Antigüedad en naranja | Al menos dos líneas con `last_upload_at` de **más de 7 días**, y una de más de 30 |
| El filtro de marca cortando | La referencia en **SKF, FAG y NSK**, para que "solo SKF" reduzca visiblemente |
| La zona cortando | Líneas en **ES, DE, PL, IT, FR** y **una fuera de Europa** (TR o MA), para que el chip de zona se note |
| La columna Empresa con sentido | Ver §3: hace falta más de un proveedor |

### 2.2 El resto, como ruido verosímil

Hasta 200+ líneas. Fabricantes y nomenclatura reales:

- **Marcas:** SKF, FAG, NSK, NTN, INA, Timken, Koyo, ZKL, NKE.
- **Familias y nomenclatura:** rígidos de bolas `60xx`/`62xx`/`63xx` con sufijos `-2RS`/`-ZZ`/`-C3`;
  rodillos cónicos `302xx`/`320xx`; rodillos cilíndricos `NU2xxx`/`NJ3xxx`; a rótula `222xx`;
  axiales `511xx`.
- **`product_family`** coherente con la referencia — es obligatoria y el motor IA la inferiría
  de `part_number` + `brand` (`canonical-schema`), así que el Coder debe rellenarla, no dejarla
  en blanco.
- **Cantidades** entre 5 y 4.000, con distribución realista (muchas líneas pequeñas, pocas
  grandes). **Plazos** entre 1 y 30 días.
- **`unit_price` va NULL.** Está cifrado y no hay claves reales hasta el día 8. Sembrarlo en
  claro sería precisamente el fallo del día 11.

### 2.3 Solape deliberado

**Al menos 25 referencias presentes en dos o más organizaciones**, para que cualquier búsqueda
que se le ocurra al socio en la reunión cruce y devuelva varias empresas. Si solo la referencia
del guion tiene solape, cualquier improvisación deja la tabla en una sola fila.

### 2.4 Reparto por estado

El catálogo es de demo, pero INV-01 tiene que poder enseñar sus cuatro estados: ~90%
`PUBLISHED`, algunas `DRAFT` y `ARCHIVED`, y **al menos una `DELETED`** — el cuarto estado que
el HTML aprobado de INV-01 no pinta y que hay que decidir cómo se muestra.

---

## 3 · Una decisión que la demo pide: cuántas organizaciones

**El problema.** SRCH-01 tiene una columna **Empresa** que el spec marca como *obligatoria*
(línea 179: "fue el error del prototipo HTML v1"). Con solo dos organizaciones, el comprador ve
**una sola empresa** en toda la tabla de resultados. La pantalla núcleo de un marketplace
enseñando un único proveedor no cuenta la historia.

**Propuesta.** Seis organizaciones distribuidoras, de las cuales **solo dos tienen cuenta**:

| Organización | País | Cuenta | Papel en la demo |
|---|---|---|---|
| Rodamientos Ibéricos | ES | ✔ `alpha@` | **El comprador.** Es quien busca |
| Nordwälz Lager | DE | ✔ `beta@` | **El vendedor con quien se negocia en vivo.** Tiene la línea más atractiva de la referencia |
| Cuscinetti Padana | IT | — | Catálogo, sin usuarios |
| Łożyska Wschód | PL | — | Catálogo, sin usuarios |
| Roulements Rhône | FR | — | Catálogo, sin usuarios |
| Anadolu Rulman | TR | — | Catálogo, sin usuarios · **fuera de la UE**, para que el chip de zona corte |

Las cuatro sin cuenta son organizaciones del directorio con stock publicado y **cero miembros**:
el esquema lo permite (`members` apunta a `organizations`, no al revés) y la RLS funciona igual.
No hace falta inventar usuarios ni contraseñas que nadie va a usar.

**Un detalle de SRCH-01 que esto destapa.** Alpha es distribuidora además de compradora, así que
su propio inventario aparecería en sus resultados de búsqueda. La política
`inventory_select_cross_org` ya lleva `org_id <> app.current_org_id()`, así que la consulta de
SRCH-01 puede excluir el inventario propio sin tocar el esquema. Hay que decidirlo explícitamente
el día 6: buscar en un marketplace es buscar **oferta ajena**.

---

## 4 · Cómo se ejecuta el día 3

1. **El Coder genera el catálogo** con este documento en el prompt. Sale como un `.sql` o `.csv`
   de siembra, sin tocar nada más.
2. **Commit del artefacto tal como sale**, con
   `Co-Authored-By: deepseek-v4-flash <coder@harness.local>` (`CLAUDE.md` §1.6).
3. **Las correcciones a mano, en un commit aparte.** El diff del segundo mide cuánto hubo que
   arreglar — es el objetivo 4 del MVP, no burocracia.
4. **Una fila en `harness-metrics.csv` por intento**, con `ficheros`, y `coste_usd` cuadrado
   contra el JSON de `metrics/` (F-010). Si el cache hit es alto, se declara (F-011).
5. **El Coder no escribe los tests que validan su catálogo** (`CLAUDE.md` §3).

**Cómo se comprueba que el catálogo vale**, y esto sí lo escribe Claude Code:

- Las 200+ líneas insertan sin violar ninguna restricción del esquema.
- La consulta del paso 1 del guion devuelve **≥ 5 filas de ≥ 3 empresas distintas**.
- El refinamiento del paso 2 la reduce sin dejarla vacía.
- Hay líneas por encima y por debajo de 500 unidades, y con antigüedad > 7 días.
- `product_family` no es nula en ninguna línea.
- `unit_price_ciphertext` es nulo en **todas**.

---

*Redactado el 6-ago-2026 · pendiente de confirmación del PO*
