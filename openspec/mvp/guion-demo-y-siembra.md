# Guion de demo y siembra del catálogo

> **CONFIRMADO POR EL PO el 7-ago-2026.** Las dos decisiones abiertas quedan cerradas:
> referencia de la demo **`6205-2RS`** y **seis organizaciones** distribuidoras. Este documento
> pasa de propuesta a entrada del prompt del Coder.
>
> Plan §8 es explícito: las 200 líneas se diseñan **hacia atrás desde el guion de demo**, no al
> revés. "200 líneas curadas rinden más que 2.000 aleatorias." Este documento fija primero qué
> se busca y luego qué hay que sembrar para que esa búsqueda luzca. Es la entrada del prompt del
> Coder del día 3, y sobrevive al día 3: la demo es de los días 11, 13 y 15.

---

## 1 · La búsqueda de la demo

Decisión del PO (7-ago): se busca por **referencia, marca, cantidad y zona**, y los resultados
**se ordenan y se filtran**.

Eso encaja con `single-reference-search`, que fija los cuatro chips editables: **marca, país,
cantidad mínima y plazo**. La referencia no es un chip: es la consulta.

**El momento a provocar, en dos pasos:**

| Paso | Lo que dice el socio | Lo que hace el sistema |
|---|---|---|
| 1 | *"Necesito 500 unidades de 6205-2RS en Europa"* | VERA interpreta y llena tres chips: referencia `6205-2RS`, cantidad mínima `500`, zona `Europa`. Resultados ordenados por cantidad descendente (orden por defecto del spec) |
| 2 | *"solo SKF, y que el plazo no pase de una semana"* | Refina sin repetir lo anterior: añade chip marca `SKF` y chip plazo `≤ 7 días`. `single-reference-search` · escenario "refinamiento en sesión activa" |
| 3 | clic en cabecera **Plazo** | Reordena ascendente. Es lo que exige `Rinworld_spec_SRCH-01.md` línea 83 |

**Referencia confirmada por el PO: `6205-2RS`.** Es el rodamiento rígido de bolas más común del
mercado, así que un catálogo con muchas líneas de esa referencia es verosímil, y ya es la que
sembramos el día 2.

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

## 3 · Cuántas organizaciones — decisión cerrada: seis

**El problema.** SRCH-01 tiene una columna **Empresa** que el spec marca como *obligatoria*
(línea 179: "fue el error del prototipo HTML v1"). Con solo dos organizaciones, el comprador ve
**una sola empresa** en toda la tabla de resultados. La pantalla núcleo de un marketplace
enseñando un único proveedor no cuenta la historia.

**Aprobado por el PO el 7-ago-2026.** Seis organizaciones distribuidoras, de las cuales **solo
dos tienen cuenta**. Sembradas en `supabase/seed/demo_orgs.sql` con estos UUID fijos, que son
los que el catálogo y sus tests referencian literalmente:

| Organización | UUID | País | Cont. | Cuenta | Papel en la demo |
|---|---|---|---|---|---|
| Rodamientos Ibéricos | `a1000000-…-0001` | ES | EU | ✔ `alpha@` | **El comprador.** Es quien busca |
| Nordwälz Lager | `b2000000-…-0002` | DE | EU | ✔ `beta@` | **El vendedor con quien se negocia en vivo.** Tiene la línea más atractiva de la referencia |
| Cuscinetti Padana | `c3000000-…-0003` | IT | EU | — | Catálogo, sin usuarios |
| Łożyska Wschód | `d4000000-…-0004` | PL | EU | — | Catálogo, sin usuarios |
| Roulements Rhône | `e5000000-…-0005` | FR | EU | — | Catálogo, sin usuarios |
| Anadolu Rulman | `f6000000-…-0006` | TR | **AS** | — | Catálogo, sin usuarios · **fuera de Europa**, para que el chip de zona corte |

Las cuatro sin cuenta son organizaciones del directorio con stock publicado y **cero miembros**:
el esquema lo permite (`members` apunta a `organizations`, no al revés) y la RLS funciona igual —
ni `inventory_select_cross_org` ni `can_view_inventory_of()` miran si hay miembros. No hace falta
inventar usuarios ni contraseñas que nadie va a usar.

**Turquía va en `continent = 'AS'`, y es deliberado.** `organizations_continent_chk` admite
AF/AN/AS/EU/NA/OC/SA y Turquía está a caballo; se sigue el geoscheme de la ONU, que la sitúa en
Asia Occidental. La consecuencia es la que la demo necesita: el chip de zona "Europa" filtra por
`continent = 'EU'` y Anadolu Rulman desaparece en cuanto se aplica.

**Los nombres llevan diacríticos, y hubo que arreglarlos (F-019).** `dev_accounts.sql` creó las
dos primeras en ASCII — "Rodamientos Ibericos", "Nordwaelz Lager" — y `name` es exactamente lo que
pinta la columna Empresa de SRCH-01 y la barra de marca del shell. Corregido en base, en el seed,
en `.env.example` y en los dos tests que fijaban el nombre.

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

## 5 · Resultado de la corrida — 7-ago-2026

**El Coder pasó al primer intento: 27/27 asertos, cero correcciones al artefacto.**
Detalle y cifras en F-022. Los asertos viven en `supabase/tests/03_catalog_asserts.sql` y
`04_catalog_idempotent.sql`, se ejecutan con `bash supabase/tests/run.sh` (fase 2) y se
escribieron **antes** de mirar el artefacto.

| | |
|---|---|
| Filas | **215** · 72 referencias distintas · 49 con solape entre organizaciones |
| Reparto | Padana/Wschód/Rhône 52 cada una · Anadolu 32 · Beta 15 · Alpha 12 |
| Estados | 196 PUBLISHED · 11 DRAFT · 7 ARCHIVED · **1 DELETED** |
| Precio | NULL en las 215 |
| Coste | **$0.012928 · 0% cache hit** — la primera cifra en frío del proyecto |

**El paso 1 del guion, ejecutado como Alpha a través de RLS** (no como `postgres`), devuelve
10 filas de 6 empresas; el chip de zona quita Anadolu Rulman y quedan 9 de 5. El paso 2
("solo SKF, plazo ≤ 7") las reduce a 3 sin vaciar la tabla. La línea más atractiva —
1250 unidades en 2 días — es de Nordwälz Lager, que es el vendedor con quien se negocia
en vivo: el catálogo cuenta la historia que tenía que contar.

**Confirmado en vivo el detalle de §3:** el inventario propio de Alpha aparece en sus propios
resultados (2 filas de las 10). La consulta de SRCH-01 tiene que excluirlo el día 6 —
`inventory_select_cross_org` ya lleva `org_id <> app.current_org_id()`, así que es cuestión de
usarlo, no de tocar el esquema.

---

---

## 6 · Curación del día 12 — el catálogo envejece solo

**El catálogo no se degrada por uso: se degrada por calendario, y eso no lo veía nadie.**

Las fechas se siembran relativas (`now() - interval 'N days'`), que sigue siendo la decisión
correcta. Pero la base se sembró el **7-ago** y no se ha vuelto a sembrar. Medido con SQL el
14-ago: **220 de las 221 líneas pasaban ya de 7 días**, y las 14 de `6205-2RS` también — la más
fresca por 8 días. Como SRCH-01 pinta en naranja todo lo que pase de 7, el 20-ago la columna
Antigüedad habría salido **entera en naranja**, que es justo lo contrario de lo que pide §2.1:
naranja como excepción, con una sola línea en rojo.

Los asertos del día 3 no lo cazaron porque estaban escritos **solo por abajo** (*"al menos dos
líneas con más de 7 días"*), y un suelo lo cumple también el caso contrario al deseado. Ver F-094.

**Cómo se cura, y cuándo hay que correrlo:**

```bash
npm run demo:reset
```

Desde `app/`. **Sustituye desde el día 13 al `psql -f seed/reanchor_freshness.sql` que decía
aquí**, y el motivo no es comodidad: *no hay `psql` en la máquina de desarrollo* —es el mismo
hueco por el que `e2e/fixture.setup.ts` repone la siembra por `supabase-js` y no por SQL—, así
que el comando documentado no se podía ejecutar tal cual. El `.sql` sigue existiendo y sigue
valiendo por el editor de Supabase o por el MCP; lo que hace ahora es llamar a
`public.demo_reanchor_freshness()`, que es donde vive el algoritmo desde `0015`.

Desplaza `last_upload_at` de todas las líneas por un delta constante, el que devuelve la más
reciente a `now()`. Conserva la distribución entera —el orden entre líneas, la de 34 días a 34,
la de más de 30 que pinta en rojo— y **se verifica a sí mismo**: si el resultado no cumple el
guion, falla en voz alta en vez de dejar la demo rota y callada.

**Y hace además lo que el re-anclaje solo no hacía: repone los cinco hilos congelados.** El
día 13 se midió que la suite e2e deja la base sucia al terminar —el hilo de Anadolu reabierto,
MSG-01 con cuatro estados en vez de cinco (**F-096**)—, así que el reseteo comprueba también
que están los cinco estados, con un elemento cada uno, antes de decir que ha terminado.

> **Córrelo antes de cada ensayo de `Plan §10` y otra vez el 20-ago por la mañana.** Es
> idempotente dentro del mismo día. No hace falta re-sembrar el catálogo — y además no conviene:
> las tarjetas `CONSULTA` de los días 10 y 11 apuntan a `inventory_lines.id` concretos.
>
> ⚠ **Y no corras la suite e2e mientras dure un ensayo.** Desde el día 13 la suite repone la
> siembra al terminar además de al empezar, así que ya no deja la base rota — pero si corre **a
> la vez** que el ensayo, se lo lleva por delante igual. Demo y pruebas comparten base y así se
> quedan hasta V1 (**F-098**).

**El contrato nuevo** vive en `supabase/tests/05_freshness_asserts.sql`, y `run.sh` lo prueba en
las dos direcciones: envejece el catálogo 9 días, comprueba que los asertos **fallan** así,
re-ancla y comprueba que pasan.

Estado tras la curación del 14-ago, contra `troxminloxkjwihwfevs`: **159 de 221 líneas frescas ·
11 de las 14 de `6205-2RS` frescas · 3 en naranja · 9 en rojo · 0 en el futuro.**

---

*Redactado el 7-ago-2026 (día 3) · **confirmado por el PO el 7-ago-2026**: `6205-2RS` y seis
organizaciones · §6 añadida el 14-ago-2026 (día 12), curación hacia el guion*
