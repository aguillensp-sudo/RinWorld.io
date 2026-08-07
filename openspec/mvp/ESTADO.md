# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero, aprendida a base de golpes (F-012).** Cita, no parafrasea. Los
> valores de estado, los nombres de columna y las asignaciones de modelo se copian del spec
> cerrado o del plan **con el puntero al lado**. Un enum o un nombre de campo sin puntero se
> considera no verificado: tres paráfrasis mal hechas llegaron a un DDL a punto de escribirse.
>
> **Y su corolario, del día 3 (F-024).** El aviso que este fichero traía sobre el precio de
> INV-01 apuntaba a una pantalla que **no tiene columna de precio**. No hizo daño porque era
> conservador, pero es el mismo mecanismo: una nota de relevo describiendo un spec que nadie
> volvió a abrir. Si una advertencia de aquí no lleva puntero, se comprueba antes de actuar.

**Día 3 de 15 · cerrado 7-ago-2026 · Estado: VERDE**

---

## Dónde estamos

Los dos entregables del día 3 están y la puerta de salida está pasada. Hoy fue **el primer día
del Coder**, así que además entraron en vigor las reglas de autoría y de métricas.

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Catálogo de demo, 200+ líneas curadas | **Coder** | **215 líneas al primer intento, 30/30 asertos, cero correcciones.** Ver F-022 |
| INV-01 · Panel de Inventario, a mano | **Claude Code** | **Hecho.** Es la pantalla de referencia contra la que se compara el arnés desde el día 5 |
| Seis organizaciones (decisión del PO) | Claude Code | Sembradas en `supabase/seed/demo_orgs.sql` con UUID fijos |

**Puerta de salida del día 3: PASADA.** *"INV-01 renderiza el inventario real de la base de
datos, con sus tests en verde, y las dos organizaciones tienen catálogo con solape deliberado."*
Es `app/e2e/inventory.spec.ts`, contra el Supabase real — no una comprobación a ojo.

| Verificación | Estado |
|---|---|
| `bash supabase/tests/run.sh` | **65/65** — 35 de esquema + 30 del catálogo. Los cuenta el runner, ya no se cuentan a mano (venía diciendo 34 y eran 35) |
| `cd app && npm run typecheck` | limpio |
| `cd app && npm test` | **95/95** |
| `cd app && npm run check:palette` | cobertura completa de las 6 pantallas claras |
| `cd app && npx playwright test` | **19/19**, tres corridas seguidas sin flakiness |

---

## Lo que hay que saber del catálogo

**El paso 1 del guion, ejecutado como Alpha y a través de RLS** (no como `postgres`): 10 filas de
6 empresas; el chip de zona quita Anadolu Rulman y quedan 9 de 5; el paso 2 ("solo SKF, plazo
≤ 7") las reduce a 3 sin vaciar la tabla. La línea más atractiva — 1250 u en 2 días — es de
Nordwälz Lager, el vendedor con quien se negocia en vivo.

| | |
|---|---|
| Remoto | **221 líneas** (215 del catálogo + 6 de `dev_accounts.sql`), **0 con precio** |
| Referencias | 72 distintas · **49 con solape** entre organizaciones |
| Estados | 196 PUBLISHED · 11 DRAFT · 7 ARCHIVED · **1 DELETED** |
| Reparto | Padana/Wschód/Rhône 52 c/u · Anadolu 32 · Beta 15 · Alpha 12 |

**Primera cifra de coste en frío del proyecto: $0.012928 con 0% de cache hit** (4986 in / 43679
out, 243 s). Es 3,5× la de SP-1, **y es la que sirve para extrapolar a V1**: la de SP-1 llevaba
99,58% de cache y nunca lo fue (F-011).

**Por qué salió al primer intento, y no fue suerte** (F-022): vocabulario cerrado de
`product_family`, UUID literales en el prompt, forma exacta de la sentencia con un ejemplo de dos
filas, y prohibición explícita de fechas literales. Los cuatro son huecos por los que se habría
colado un error silencioso. **Patrón a reusar en el arnés del día 4.**

---

## Lo que hay que saber de INV-01

**Está en `app/src/screens/inventory/`** y `InventoryTable.tsx` va aparte a propósito: es la
contrapartida directa del que generó el Coder en SP-1 (`openspec/mvp/spikes/SP-1/src/`). Mismo
componente, misma fuente de verdad, uno a mano y otro del arnés — es el objetivo 4 del MVP.

**Cuelga del ítem de nav "Vendiendo", no de "Inventario".** Lo dice su spec §2 literalmente, no es
lo que uno supondría leyendo los ocho nombres, y `App.tsx` enruta por ahí. El ítem activo pasó a
estar **controlado desde `App`**: el ítem y la pantalla que se pinta son el mismo dato, y con el
estado dentro del shell habría dos verdades sobre dónde estás.

**Cuatro cosas que el diseño aprobado promete y el MVP no tiene** (F-023). La pantalla las pinta
con su estado real, y hay 6 tests que fallan si alguna vuelve a fingir:

| El HTML aprobado | Aquí |
|---|---|
| Badge verde "Activo" / "Siempre disponible" | **"Fuera del MVP"** — INV-02/03/04 e INV-07 están en Plan §9 "Fuera" |
| Dropzone que abre un selector de archivos | Inerte: no es botón, no acepta drop |
| `ingest-a3f7k9@ingest.bearingworld.io` | Un guion. Una dirección falsa es una a la que alguien manda su inventario de verdad |
| **892** visitas en 30 días | Un guion. No hay tabla de visitas en el esquema |

El motivo es `CLAUDE.md` §7: si el riesgo #1 es VERA afirmando con aplomo algo que no sabe, la
interfaz no puede hacer lo mismo — y en la interfaz engaña más, porque parece verificable.

**⚠ El test que ningún test de unidad puede hacer.** `inventory_lines` tiene **dos** políticas de
lectura permisivas que **se suman**: el inventario propio en cualquier estado
(`inventory_select_own`) y el `PUBLISHED` de las demás (`inventory_select_cross_org`). Sin el
`.eq('org_id', …)` explícito de `fetchPage`, "Mi inventario" mostraría también las 196 líneas del
catálogo ajeno — sin error, sin aviso y con toda la pinta de funcionar. Los 95 tests de unidad
mockean `fetchPage`, así que ese fallo los pasaría todos. **RLS protege de leer lo que no toca; no
elige por ti qué quieres leer.** Vale para toda pantalla nueva.

---

## Hoy toca — Día 4 (8-ago-2026)

Según el Plan maestro, el día 4 es **el arnés**: `harness/` con el grafo LangGraph de dos nodos
(Coder + Test-runner). Es uno de los tres días de decisiones irreversibles, así que toca escribir
`openspec/mvp/Dia-04_*.md` con el detalle **antes** de construir (`CLAUDE.md`, ritual de cierre
§3).

**Lo que el día 3 deja hecho, y conviene no rehacer:**

1. **`harness/dia-03-catalogo/run_coder.py` ya implementa tres hallazgos del backlog.** F-005
   (reintento automático ante `finish_reason == 'length'`, doblando presupuesto, y el coste del
   intento suma **todas** las llamadas), F-010 (peta si la tabla de precios está a cero, y genera
   la fila del CSV desde el JSON para que la copia a mano no pueda divergir) y F-011
   (`cache_hit_pct` y `cost_usd_cold_equivalent` como campos propios). El grafo hereda eso.
2. **El patrón de prompt que hizo que el Coder acertara al primer intento** está en F-022.
3. **El check de paleta del Test-runner se valida contra §1.1 + §1.4 + §1.5** de
   `design-system.md`, nunca contra §1.1 a secas. Tal como F-003 lo pedía, rechazaría output
   correcto — y C3 puertea cada pantalla del arnés desde el día 5.
4. **El check de formato compara contra la función de formato, no contra la cifra del mock**
   (F-024). El pie del HTML aprobado dice "1.247 líneas" y el español correcto es "1247": el CLDR
   de `es` no agrupa cuatro cifras. Tercera vez que el mock aprobado no es la fuente de verdad en
   un detalle (F-003, F-019, F-024).

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Demo | Referencia **`6205-2RS`** y **seis organizaciones** distribuidoras, solo dos con cuenta. Confirmado por el PO el 7-ago. | `guion-demo-y-siembra.md` §1 y §3 |
| Turquía | `continent = 'AS'`, geoscheme de la ONU, para que el chip de zona "Europa" corte. | `guion-demo-y-siembra.md` §3 |
| Estados de oferta | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. La última es **terminal** y la contraoferta es **fila nueva**. | `messaging-and-negotiation` · offer-card |
| Frontera de cifrado | Por columna, en las dos tablas. `unit_price` cifrado **también en la línea de inventario**. Pero ojo: **INV-01 no tiene columna de precio**, así que ahí no aplica. | `Dia-02_decisiones_esquema.md` §1 · F-024 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. Se ve al abrir la negociación. | `conversational-search` · Out of Scope |
| Eliminar una línea | **Borrado lógico** a `status = 'DELETED'`. La fila sobrevive porque puede estar referenciada por una tarjeta de consulta de un hilo abierto. | F-023 |
| Embeds de PostgREST | **Siempre con la clave ajena nombrada** (`organizations!members_org_id_fkey`). Sin eso, cualquier tabla nueva que apunte al mismo destino rompe la consulta. | F-020 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan. | `CLAUDE.md` §3 |
| Alcance | 8 pantallas, y el **app shell es una de ellas**. SRCH-01 es la núcleo y no se recorta. **Hechas: shell, INV-01.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Ninguno bloquea el día 4.**

1. 🟠 **Secrets de GitHub Actions.** Ahora sí importa de verdad, y no es burocracia: **la
   migración 0005 rompió el login y estuvo roto varias horas** porque el trabajo de e2e no puede
   cazarlo sin credenciales (F-020, mismo agujero que F-015). Hacen falta `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `E2E_ALPHA_EMAIL/PASSWORD/ORG`, `E2E_BETA_EMAIL/PASSWORD/ORG`.
   **Y los dos `_ORG` llevan el valor viejo en ASCII**: son `Rodamientos Ibéricos` y
   `Nordwälz Lager`, con diacríticos (F-019).
2. 🟠 **Diseño de la pantalla de login** (F-016). No existe entre los 32 HTML aprobados y
   **tampoco está entre las 8 pantallas del alcance**: es una novena que nadie planificó, y es la
   primera que ve el socio. Hoy va andamiaje hecho con los tokens.
3. **¿Qué hace INV-01 con una línea eliminada?** (F-023 d). Ahora desaparece del panel y no hay
   forma de verla ni de restaurarla, porque los cuatro chips son de "orden fijo" por spec y añadir
   un quinto sería tocar un contrato aprobado. Para V1: o quinto chip "Eliminados" con restaurar,
   o eliminar es definitivo desde la interfaz. **En el MVP no urge.**
4. **¿Debe verse la paginación de INV-01 en la demo?** Alpha tiene 12 líneas de catálogo + 3 de
   siembra, así que su panel cabe en una página y **la paginación no se va a ver**. Fue decisión
   del guion (dar el grueso a las cuatro sin cuenta). Si quieres que se vea, Alpha necesita más de
   50 líneas: son cinco minutos.
5. **La fidelidad visual de INV-01 no se ha revisado a ojo.** Los 19 e2e y los 95 de unidad
   comprueban estructura, literales, columnas, umbrales de color y comportamiento, y la paleta
   está verificada por script — pero nadie ha mirado la pantalla. Es la primera que sale del
   scaffold, así que merece un repaso tuyo: `npm run dev`, entrar con `alpha@` y pulsar
   "Vendiendo".
6. **`auth_leaked_password_protection`** está desactivado en Auth (comprobación contra
   HaveIBeenPwned). Es configuración del proyecto, no del esquema. ¿Se activa?
7. **Realtime** sigue sin habilitar en `threads` y `thread_items`. El Plan §3 nombra tablas
   `messages`/`offers` que **no existen** — el esquema del día 2 las llama de otra forma. No urge
   hasta el día 7.

---

## Riesgo con la vista más corta

**El día 4 es de decisiones irreversibles y arranca sin bloqueos**, que es la mejor noticia del
cierre. El riesgo del día no es el grafo: es **repetir a mano lo que `run_coder.py` ya resuelve** y
perder por el camino los tres hallazgos que implementa.

**Día 7 · MSG-02** sigue siendo el riesgo estructural: la pantalla más compleja del MVP, con
margen para comerse dos días. Si el día 7 no está, se simplifica el hilo. A favor:
`thread-lifecycle` ya está en el DDL, así que el día 7 no paga migración.

**Y un riesgo de proceso que hoy se cobró su primera víctima.** Una migración aplicada sin volver a
correr el e2e de la app dejó el login roto varias horas, y el smoke del esquema pasó 35/35 mientras
lo estaba — porque prueba la base, no PostgREST. **Toda migración que añada una clave ajena hacia
una tabla ya embebida obliga a correr el e2e de la app, no solo el del esquema.**

---

*Cerrado el 7-ago-2026 · Claude Code (Opus 5)*
