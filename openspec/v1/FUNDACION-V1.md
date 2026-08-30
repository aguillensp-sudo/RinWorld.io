# Fundación V1 — qué es, y qué hay de ella HOY

**30-ago-2026 · fecha leída de la máquina (`date -u`) · comprobado contra
`supabase/migrations/*.sql`, `supabase/functions/`, `.github/workflows/ci.yml`, el árbol
del repo en `mvp/bootstrap` **y la base de datos de verdad** (`information_schema` de
`troxminloxkjwihwfevs`, por el MCP) — no contra otro documento.**

> **Y las migraciones tampoco son la base.** Lo del esquema se comprobó dos veces: en los
> `.sql` y luego en `information_schema` del proyecto real. Coinciden — `visibility_scope`
> 0, `thread_items.quantity` 0, los cuatro campos de respaldo 4 de 4, índices GIN 2 —,
> pero eso hay que **verlo**, no suponerlo: un fichero de migración dice lo que alguien
> escribió, no lo que se aplicó.

> **Por qué existe este fichero.** `ESTADO-V1.md` §2 lleva cuatro días diciendo
> *«Fundación V1 (entornos, ADR-002, índice, residencia) — ⚪ No empezada»*, y hoy dice
> además *«comprobado hoy contra el directorio»*. **Comprobar un hito de esquema contra un
> `ls` no comprueba nada:** al mirarlo contra las migraciones resulta que **uno de los seis
> entregables está entero desde el día 1** y otro está a medias. Es la regla 2 del relevo
> por tercera vez (`F-108`, `F-129`, esta): un estado se comprueba contra el código.
>
> **Qué NO es este fichero.** No es el plan —el plan es
> `Bearingworld_Plan_V1_hasta_produccion_v2.3.docx` §Hitos, y de ahí sale la lista de
> abajo, citada, no parafraseada—. No es un relevo: no se sobrescribe a diario. Es la
> lista de la compra del hito, con lo que ya está en casa marcado.

---

## La cita, para no parafrasear el alcance

Plan V1 v2.3, tabla de hitos, corriente **A**, semanas 3–5:

> «Fundación: tres entornos como código, despliegue sin interrupción, aislamiento de la
> base de demostración, los cuatro campos del respaldo de clave en la primera migración,
> índice de búsqueda, residencia europea del agente. Y ADR-002: las dos columnas nuevas,
> el cambio en el conjunto de destinatarios de la clave, y la derivación de la lista de
> conversaciones»

Plazo: **3 semanas, comprimible a 1,5** — «la infraestructura se solapa con el diseño de
la fábrica».

---

## 1 · Los seis entregables de infraestructura

| # | Entregable | Estado | Verificado contra |
|---|---|---|---|
| **1** | **Tres entornos como código** | 🔴 **No empezado** | No hay `terraform/`, `infra/` ni `pulumi/` en el árbol. `.github/workflows/ci.yml` tiene cuatro *jobs* y **ni un `environment:`**: no hay separación declarada entre desarrollo, ensayo y producción |
| **2** | **Despliegue sin interrupción** | 🔴 **No empezado** | No hay nada de despliegue en `ci.yml`. Y es peor que «falta»: `CLAUDE.md` §10.2 deja escrito que **las Edge Functions no se despliegan con el push a git y la app tampoco llega sola a Vercel** (`F-091`, `F-072`). Hoy el despliegue es manual, así que no hay una interrupción que quitar: hay un paso humano que automatizar primero |
| **3** | **Aislamiento de la base de demostración** | 🟡 **A medias, y la mitad que hay es la de reponer** | `supabase/migrations/0015_demo_reset_helpers.sql` existe desde el día 13 del MVP y hace el **reseteo** —dos funciones que re-anclan la frescura de la siembra—. Lo que NO hay es el **aislamiento**: la demo vive en el mismo proyecto `troxminloxkjwihwfevs` que todo lo demás. Resetear no es aislar |
| **4** | **Los cuatro campos del respaldo de clave en la primera migración** | ✅ **HECHO, y desde el día 1** | `0001_organizations_and_members.sql:78-81`: `encrypted_key_blob`, `key_iv`, `argon2_salt`, `kdf_params`. **Y con más de lo que el hito pedía:** `members_key_iv_len_chk` (IV de 12 bytes), `members_salt_len_chk` (salt de 32) y `members_backup_all_or_none_chk`, que impone que estén **los cuatro o ninguno**. El comentario del fichero lo llama `schema-desde-dia-uno · server-blind-storage` |
| **5** | **Índice de búsqueda** | 🟡 **A medias, y falta saber cuál pedía el hito** | Hay dos índices trigrama GIN, con `pg_trgm` habilitado en `0001:23`: `organizations_name_trgm` (`0001:50`) e `inventory_lines` sobre `part_number` (`0002:123`). Lo que **no** hay es el índice que ADR-002 §5 pide para derivar la lista de hilos. ⚠ **El plan dice «índice de búsqueda» en singular y no dice cuál**, así que este 🟡 es tanto de código como de alcance |
| **6** | **Residencia europea del agente** | 🔴 **No empezado, y hoy va en la dirección contraria** | `supabase/functions/vera/index.ts:1` importa `npm:@anthropic-ai/sdk` y la línea 184 construye el cliente **sin `baseURL`**: sale contra `api.anthropic.com`. Cero apariciones de `vertex`, `europe`, `eu-west` o `region` en toda la carpeta de funciones. Y `index.ts:28` fija `MODELO = 'claude-sonnet-4-6'` |

> ⚠ **El punto 6, dicho con precisión, porque es fácil pasarse de frenada.** `ESTADO-V1.md`
> §4 tiene como decisión viva *«VERA en producción: **Sonnet 5** vía Vertex AI europeo»*.
> Eso es una decisión **de V1**, y lo que hay desplegado es **código del MVP**: no es que
> una decisión cerrada esté incumplida, es que **nadie ha hecho todavía la migración, y
> este entregable ES esa migración**. Lo que sí conviene tener escrito es que son **dos**
> cambios y no uno —el proveedor (`api.anthropic.com` → Vertex UE) y el modelo
> (`claude-sonnet-4-6` → Sonnet 5)—, y que el primero es el que tiene consecuencias
> legales.

---

## 2 · ADR-002, entregable por entregable

El plan pide tres cosas de ADR-002. El ADR mismo, en su §5, las desglosa en siete objetos.
**Ninguno de los siete está tocado.** Comprobado uno por uno:

| Objeto de `ADR-002` §5 | Cambio que pide | Estado | Verificado contra |
|---|---|---|---|
| `thread_items` | **+ columna `quantity`** (D-3) | 🔴 | `grep -rn quantity supabase/migrations/` solo la encuentra en `inventory_lines` (`0002:77`). En `thread_items`, no existe |
| `members` | **+ columna `visibility_scope`** con check y trigger (D-4) | 🔴 | `grep -rn visibility_scope supabase/ app/src` → **cero apariciones en todo el repo** |
| `thread_public_keys(t_id)` | Deja de devolver todos los miembros; devuelve el conjunto de D-1 | 🔴 | `0012:92-95` sigue diciendo, en su propio comentario, que *«los dos lados del hilo significa literalmente todos los miembros de las dos organizaciones»* |
| `thread_items_select_participant` | Pasa a considerar el ámbito | 🔴 | `0003:329` sigue siendo `app.can_access_thread(thread_id)`, sin ámbito |
| Lista de hilos | Deja de ser consulta directa a `threads`; se deriva de `thread_item_keys` | 🔴 | `0003:312-314`: la política sigue siendo `app.current_org_id() in (org_low_id, org_high_id)` — **cualquier miembro de la organización ve cualquier hilo de la organización**, que es exactamente lo que ADR-002 viene a quitar |
| `create_inquiry` | El conjunto de destinatarios de la CEK deja de ser «todos los miembros» | 🔴 | `0014_create_inquiry.sql:187` sigue insertando en `thread_item_keys` con el reparto viejo |
| Índices | Nuevo índice para la derivación de la lista, en la dirección que filtra primero | 🔴 | No existe; es el mismo hueco que el 🟡 del entregable 5 |

---

## 3 · Lo que esto cambia del relevo

1. **«No empezada» era falso por un entregable de seis, y el que está hecho es el
   caro.** Los cuatro campos del respaldo de clave están **desde `0001`**, con tres
   restricciones que el hito ni pedía. Quien planifique las 3 semanas del hito debería
   descontarlo.
2. **Y era optimista en el 6.** «No empezada» suena a folio en blanco; en residencia hay
   código desplegado que llama a un proveedor fuera de la UE, y eso no es un folio en
   blanco: es un cambio con una fecha límite implícita que nadie ha puesto.
3. **El orden barato, si se quiere empezar por algo hoy:** el índice de la derivación de
   la lista (entregable 5 + última fila de ADR-002 §5) es **una migración** y desbloquea
   la mitad de ADR-002. `visibility_scope` es la siguiente y es la que cambia el
   comportamiento visible.
4. **Lo que este fichero NO sabe:** cuál es exactamente «el índice de búsqueda» del plan
   —el plan lo dice en singular y no lo nombra—, y si «aislamiento de la base de
   demostración» significa proyecto Supabase aparte o esquema aparte. Las dos son
   preguntas de alcance, no de código, y las contesta el PO.

---

*Comprobado el 30-ago-2026 contra `mvp/bootstrap` a la altura de `2c55b93`. Cada fila de
las dos tablas lleva su fichero y su línea: si alguna deja de ser cierta, se ve abriendo
el fichero, no discutiendo el documento.*
