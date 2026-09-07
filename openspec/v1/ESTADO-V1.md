# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap`; si te lanzan en un worktree `claude/…`, **opera sobre esa ruta con paths
absolutos.**

> ⚠ **Esa línea se gana su sitio: NO la reescribas al sobrescribir este fichero, ni siquiera
> para «mejorarla».** Ha pasado **cuatro veces** (`F-108` las tres primeras). La cuarta fue el
> 25-ago y la causó este documento: alguien cambió la instrucción —*«opera sobre esa ruta»*—
> por una comprobación —*«comprueba que tiene harness/»*—, y el agente detectó el problema y
> se quedó parado sin saber qué hacer. **Una instrucción resuelve; una comprobación solo
> avisa.**
>
> **Y la otra mitad, que nunca se arregló:** el 25-ago `git worktree list` mostraba **tres
> worktrees prunables** anclados a `43bb222`, viviendo en `openspec/mvp/.claude/worktrees/`.
> Que `.gitignore` los ignore desde el día 15 no impide que se creen. Dos cosas:
> **`git worktree prune`** limpia los registros muertos, y **lanzar Code desde la raíz del
> repo y no desde `openspec/mvp/`** parece cortar la causa — hipótesis por confirmar, porque
> es ahí donde aparecen.
>
> **30-ago, comprobado: `git worktree prune` NO los quita.** Los tres siguen ahí y sus
> directorios existen, así que no hay ningún registro muerto que limpiar — `prune --dry-run`
> no dice nada. Haría falta `git worktree remove`, y uno de los tres es la sesión desde la
> que se escribe esto. La primera mitad de la receta era falsa; la segunda sigue sin probar.
>
> **1-sep, 3-sep y 4-sep, comprobado tres veces más, mismo resultado:** los mismos cuatro
> prunables de siempre (`bearing-io-mvp-estado-f2911a`, `bearing-mvp-bootstrap-3bc0fc`,
> `dia-14-correcciones-mvp-8160b9`, `dia-4-f131-pending-003608`), todos anclados a `43bb222`
> —anterior a todo el trabajo de V1—, más la raíz al día (hoy en `71b803b`). Cuatro jornadas
> seguidas sin que cambie ni uno. **La hipótesis de lanzar desde la raíz sigue sin probarse.**
>
> **Y la SEGUNDA copia de este fichero en la raíz del repo, hallada el 3-sep: resuelta el
> 4-sep-2026.** Se comparó con la trackeada antes de tocarla: era la versión de ayer **menos**
> los párrafos que hablaban de sí misma, o sea que no tenía ni una línea propia. **Borrada**,
> con copia de seguridad fuera del repo. **Y NO se ha metido en `.gitignore`, a propósito:**
> ignorarla la haría invisible en `git status`, y fue justamente aparecer como `??` lo que
> hizo que alguien la descubriera. Si alguna herramienta la recrea, se quiere ver.

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.**

> **Qué es este fichero.** El relevo diario de V1. Se sobrescribe al cierre de cada día
> operativo. Lo primero que lee cualquier sesión nueva, humana o agente.
>
> **Lo permanente NO vive aquí:** el plan está en `openspec/v1/`, las decisiones de
> arquitectura en `docs/ADR-*.md`, el acta del MVP en `openspec/mvp/CIERRE-MVP.md`, y el
> histórico en git y en `findings-register.md`.

---

## ⚠ Las cinco reglas de este fichero

Salen de errores cometidos, no de teoría. Cada una tiene su cadáver detrás.

**1 · Cita, no parafrasees.** Los valores de estado y las asignaciones de modelo se copian
del documento cerrado **con el puntero al lado** (`F-012`).

**2 · Un estado que este fichero afirme se comprueba EL DÍA que se escribe, contra el
código o contra la base — no contra otro documento.** El 25-ago se descubrió que tres
documentos llevaban **diez días** diciendo que `B-008`, `B-009` y `B-010` estaban
pendientes cuando se habían cerrado el 12-ago. **Y el 30-ago mordió dos veces más:** la §4
afirmaba como decisión cerrada que las filas inválidas de `F-121` «se marcan, no se
borran», y **no se habían marcado** (`F-129`); y la §2 daba la Fundación V1 por «no
empezada» **comprobándolo contra un `ls`**, cuando uno de sus seis entregables está entero
desde la primera migración (`F-132`). **Comprobar el continente no es comprobar el
contenido. Ningún documento es fuente de verdad sobre el código. Este tampoco.**

> **Y el 4-sep la regla se ganó una hermana, `F-146`:** comprobar el CÓDIGO tampoco basta
> cuando la plataforma añade cosas por su cuenta. Las migraciones decían `revoke execute …
> from public` desde `0001` y lo que la base tenía puesto era otra cosa. **Lo que se afirme
> sobre privilegios, RLS o permisos se comprueba contra `pg_proc` / `pg_policies` / `pg_
> default_acl`, no contra el `.sql` que se escribió.**

**3 · La fecha se lee de la máquina, nunca de memoria.** El día 14 del MVP se fechó a sí
mismo un día por delante y esa hora de diferencia es exactamente lo que ocultó `F-109`
durante dos jornadas. El 25-ago volvió a pasar por el otro lado: tres documentos se
fecharon tres días atrás. **`date -u` antes de escribir la cabecera.**

**4 · Este fichero se cierra CUANDO SE ACABA, no cuando parece que se acaba.** El día 3 se
cerró a las 12:33 y el trabajo siguió hasta las 13:45. **Y el día 4 lo repitió, con la
regla ya escrita delante:** se cerró a las 11:22 y siguió hasta las 12:31, con nueve
commits más y seis hallazgos nuevos. Escribir la regla no la cumple.

**5 · Una evidencia que solo existe si alguien se acuerda de producirla no es evidencia:
es suerte.** El 30-ago se abrió un hueco en `.gitignore` para versionar los logs de
corrida, con el argumento de que eran la evidencia de la primera medida con `n>1` del
proyecto. **Las tres corridas de esa medida no dejaron ni un log**, porque `run.py` no lo
escribía: lo escribía quien lanzaba, redirigiendo, y quien lanzó puso un `| tail -45`
delante (`F-136`). La regla protegía un fichero que nadie garantizaba que existiera.
**Antes de confiar en una evidencia, mira quién la produce y qué pasa si ese alguien se
distrae.**

---

**Día 9 de V1 · 6-sep-2026 · Estado: EN CURSO**

Este fichero se abrió hoy leyendo el cierre del Día 8 (`591ea20`), con tres puntos en su
§3 — todos decisión del PO, no trabajo empezado. El PO decidió **no** replicar la serie
17 y seguir con **el resto de Fundación V1: entregables 1, 2, 3 y 6**, dejando el 5
(pregunta de alcance sin contestar) tal cual.

**El entregable 2 (despliegue continuo) quedó hecho entero.** Tres agentes de
exploración en paralelo confirmaron que `ci.yml` era CI pura —cuatro *jobs*, cero
despliegue— y que el despliegue real eran dos sistemas manuales, exactamente la causa
que `F-091`/`F-072` documentaron en su día con un parche de proceso, no de raíz. Nuevo
*job* `deploy`, disparado solo en push a `mvp/bootstrap` tras el verde de los otros
cuatro: despliega la app a Vercel y la función `vera` a Supabase, con dos secretos de
GitHub nuevos y separados del login roto de `F-073`. Las migraciones siguen a mano por
el MCP, a propósito — automatizarlas no es lo que ninguno de los dos hallazgos pedía.
**Verificación honesta:** el YAML es válido, pero no puede probarse de extremo a extremo
hasta que el PO añada `VERCEL_TOKEN` y `SUPABASE_ACCESS_TOKEN` como secretos del
repositorio — no se declara "verificado en producción" sin haberlo visto correr.
Documentado en `findings-register.md` (`F-150`) y `CLAUDE.md` §10.2.

**El entregable 1 (tres entornos como código) quedó a medias, con el reparto que
tenía sentido dado lo que pasó con el 3 (ver abajo).** `entornos.md` (nuevo) documenta
por qué "como código" en este *stack* (Vercel+Supabase, ninguno nativo de IaC) se
concreta en `environment:` de GitHub más este documento como fuente de verdad — no un
módulo de Terraform, decisión de alcance explícita como la del entregable 5.
`producción` ya es real (`environment: production` en el *job* `deploy`); `ensayo` queda
🔴 porque depende del entregable 3, y `desarrollo` sigue siendo lo de siempre.

**El entregable 3 (aislamiento de demo/e2e) se intentó y se topó con un muro real, no
previsto en el plan de la mañana.** El PO decidió ir por proyecto Supabase separado, con
coste confirmado en $0/mes (`get_cost`) antes de crear nada. `create_project` falló: la
cuenta ya tiene **2 proyectos Free activos** en la misma org —`troxminloxkjwihwfevs`
(este) y **`motioniq-rag`, un proyecto ajeno a este repo**— y Supabase bloquea un
tercero. Intenté la vía reversible primero: `pause_project` sobre `motioniq-rag` falló
("ya está hibernando, contacta con soporte"). El PO autorizó explícitamente borrarlo,
pero **el MCP de Supabase no tiene ninguna herramienta de borrado de proyectos** —solo
`pause_project`/`restore_project`/`create_project`—, así que ni con permiso puedo
ejecutarlo desde aquí. Queda en manos del PO: borrarlo él mismo desde el dashboard
cuando tenga acceso, o cambiar a la otra opción que ya estaba sobre la mesa desde
`F-098` (hilos propios para el e2e, sin proyecto nuevo). **Ningún dato ni fichero se
tocó** — la única acción real fue la creación fallida (sin efecto) y el intento de
pausa fallido (sin efecto).

**El entregable 6 (residencia europea) quedó con el código preparado pero SIN aplicar
al fichero real.** Búsqueda web confirmó que Vertex AI ofrece hoy un *endpoint
multi-región UE* para Claude (GA mayo-2026) con Sonnet 5 disponible — la decisión de §4
es viable. El PO confirmó que el proyecto GCP no existe todavía, así que `vera/index.ts`
—que hoy funciona— no se toca sin poder probarlo contra credenciales reales: el
runbook completo, con el diff de código listo para aplicar, vive en
`vera-vertex-eu-migracion.md`.

El detalle del Día 8 completo (D-7/D-8 con el cliente real, serie 17, el guardia
decidido que no) vive en `git show 591ea20:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-06` |
| Rama real de trabajo vs. `main` | `git branch -a -vv`, `git log --oneline` de las dos | `main` congelada en `43bb222` (4-ago); todo el trabajo de V1 vive en `mvp/bootstrap` (`591ea20`, hoy). Decide la rama de disparo de la CD |
| `ci.yml` antes de tocarlo: ¿algún paso de despliegue? | Lectura completa + agente de exploración | Cuatro *jobs*, cero `deploy`, cero `environment:`. Confirmado también por `grep` sin resultados |
| Causa exacta de `F-091`/`F-072` | `CLAUDE.md` §10.2, `despliegue.md`, `findings-register.md` | Despliegue manual en dos sistemas (Vercel CLI, Supabase por MCP/CLI), ninguno disparado por push |
| `ci.yml` tras añadir el *job* `deploy` | `python -c "import yaml; yaml.safe_load(...)"` dos veces (antes y después de `environment: production`) | YAML válido las dos veces, cinco *jobs* (`schema`, `app`, `e2e`, `arnes`, `deploy`), `needs`/`if`/`environment` con los valores esperados |
| Si `vercel`/`supabase` CLI son dependencias declaradas | `app/package.json` | Ninguna de las dos — igual que el resto del proyecto, se invocan con `npx`, sin pin de versión nuevo que el proyecto no tuviera ya |
| Org de Supabase para el proyecto nuevo | `list_organizations` (MCP) | Una sola: `ujatcozvbspkycepemfq`, la misma del proyecto principal |
| Coste de un proyecto Supabase nuevo en esa org | `get_cost` (MCP) | `$0/mes` — mostrado al PO antes de pedir confirmación, no asumido |
| Creación real del proyecto `bearingworld-e2e` | `confirm_cost` + `create_project` (MCP), con el visto bueno explícito del PO sobre el número real | **Falló**: `BadRequestException`, límite de 2 proyectos Free activos ya alcanzado |
| Qué proyectos existen de verdad en la org | `list_projects` (MCP) | Tres: `autonomos-ia-mvp` (`INACTIVE`), `troxminloxkjwihwfevs`/`MVP_RinWorld.io` (`ACTIVE_HEALTHY`, este repo), `motioniq-rag` (`ACTIVE_HEALTHY`, **ajeno a este repo**) |
| Si se puede pausar `motioniq-rag` para liberar el cupo (vía reversible, intentada antes que borrar) | `pause_project` (MCP) | Falló: `"Cannot pause project while it is currently hibernating. Please reach out to support."` |
| Si se puede borrar `motioniq-rag` con el permiso explícito del PO | Búsqueda del MCP de Supabase por una herramienta de borrado | **No existe ninguna** — el servidor MCP solo expone `pause_project`/`restore_project`/`create_project` para el ciclo de vida de un proyecto. Ninguna acción posible desde aquí, con o sin permiso |
| Disponibilidad real de Claude en Vertex AI, región UE (para el entregable 6) | Búsqueda web, no memoria | Confirmado: *multi-region endpoint* UE para Claude en Vertex AI, GA mayo-2026, retención cero de datos; Sonnet 5 disponible ahí. Fuente primaria a re-confirmar en el momento de ejecutar la migración: `platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai` |
| `vera/index.ts` real, línea a línea, antes de escribir el runbook | Lectura completa del fichero | Confirma `MODELO = 'claude-sonnet-4-6'` (línea 28), cliente Anthropic sin `baseURL` (línea 184), única env var `ANTHROPIC_API_KEY` (línea 166) |
| **7-sep, tras borrar el PO `motioniq-rag`:** ¿queda sitio de verdad? | `list_projects` (MCP), de nuevo | Solo dos: `autonomos-ia-mvp` (`INACTIVE`) y `troxminloxkjwihwfevs` (`ACTIVE_HEALTHY`, este repo). `motioniq-rag` ya no aparece |
| Creación real del proyecto `bearingworld-e2e`, segundo intento | `get_cost` (`$0/mes`, mostrado de nuevo) → `confirm_cost` → `create_project` (MCP) | **Esta vez sí**: `ogdhyzgjjbbikjbkhxmu`, `bearingworld-e2e`, eu-west-1, `ACTIVE_HEALTHY` |
| Las 23 migraciones (`0001`-`0023`) aplicadas al proyecto nuevo, en orden | Subagente dedicado: `apply_migration` una a una, luego `list_migrations` + `information_schema` + recuento de filas | Las 23 registradas, ninguna falló. Tablas núcleo presentes con RLS activo. `members.visibility_scope`, `organizations.visibility_scope_enabled` (`boolean default false`), `thread_items.quantity` — las tres columnas confirmadas. Cero filas de datos, como se esperaba de un proyecto recién creado |
| Cuentas ALPHA/BETA/EDITOR en el proyecto nuevo | Admin API de Supabase (nunca SQL directo — `F-013`), verificado con **login real** contra `/auth/v1/token`, no solo con la fila existiendo | Los tres, `HTTP 200` con token de acceso |
| Organizaciones, miembros, catálogo (221 líneas) y los cinco hilos congelados | `execute_sql` (MCP) para orgs/miembros/catálogo, script de reseteo para los hilos (con el mismo `VITE_DEMO_KEY_SEED` — mismos UUID de miembro, mismo cifrado pre-derivado) | Seis organizaciones, ALPHA/BETA `ADMIN`, EDITOR `EDITOR`/`OWN` como segundo miembro de Nordwälz. `visibility_scope_enabled` dejado en `false` en las dos, a propósito — la suite existente nunca se probó con D-7 encendido. Los cinco estados presentes |
| Que el proyecto nuevo sirve de verdad, no solo que las filas existen | **Suite Playwright real** (`npx playwright test`) corrida contra `bearingworld-e2e`, antes de tocar `ci.yml` | **53 de 53 en verde**, sin huecos que rellenar más allá del catálogo (ya incluido arriba) |
| `app/.env`: variable `SUPABASE_E2E_SERVICE_KEY` duplicada (un bloque con el valor real, otro documental con el mismo nombre en blanco) | El subagente lo detectó al cargarla con `dotenv` normal — se queda con la ÚLTIMA aparición, la vacía | Corregido: bloque duplicado borrado, un único bloque `SUPABASE_E2E_*` en `app/.env`. Los dos scripts nuevos igualmente parsean "última NO vacía", por si vuelve a pasar |
| *Rama del PO*: los tres secretos de GitHub para el *job* `e2e` | `SUPABASE_E2E_URL`/`SUPABASE_E2E_PUBLISHABLE_KEY` puestos por Claude (`gh secret set`, valores públicos); `SUPABASE_E2E_SERVICE_KEY` puesto por el PO desde el dashboard, tras instrucciones paso a paso | `gh secret list` confirma los tres presentes |
| `ci.yml`, *job* `e2e` tras apuntarlo al proyecto aislado | `python -c "import yaml; ..."` sobre el fichero final | YAML válido, `environment: staging`, las tres variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY`) leyendo de `secrets.SUPABASE_E2E_*` |
| **El *job* `e2e` contra `bearingworld-e2e`, en CI real (no local)** | `gh run view 34094524208 --json jobs`, push de `8618b81` | ✅ **verde** — `schema`, `app`, `arnes` y `e2e` (Playwright) los cuatro en éxito. Confirma que el proyecto aislado funciona desde GitHub Actions, no solo desde la corrida local del subagente |
| El *job* `deploy` nuevo, primera corrida real | Mismo run | 🔴 **Falla, y por lo ya anotado en §5**: `VERCEL_TOKEN` llega vacío (`"You defined --token, but it's missing a value"`) — el secreto todavía no existe. Ningún otro fallo detrás; en cuanto el PO ponga los dos secretos, se reintenta con un push |
| El secreto de Supabase para CI, con el nombre que de verdad se creó | `gh secret list` tras el aviso del PO | Se llamaba `SUPABASE_TOKEN`, no `SUPABASE_ACCESS_TOKEN` (GitHub no deja renombrar). Corregido en `ci.yml`: la variable de entorno sigue llamándose `SUPABASE_ACCESS_TOKEN` (lo exige la CLI), pero lee de `secrets.SUPABASE_TOKEN` |
| *Job* `deploy`, segunda corrida real (`gh run` `34100098869`) | `gh run view --json jobs` + `--log-failed` | `e2e` sigue verde. `deploy` falla en el paso de Vercel: `Error: User not found` — el token SÍ llega, pero Vercel no lo reconoce. VERA (paso de Supabase) no llegó a correr, el de Vercel va primero y para el *job* |
| Token de Vercel nuevo (`NEW_VERCEL_TOKEN`, otro secreto, el PO no sobrescribió el viejo) + `--scope` explícito del equipo (`team_DxbnTcPjK55GRxmJiMm4YUsp`, sacado de `app/.vercel/project.json`) | `gh run` `34112072918` y `34112474936` | Mismo error, con más detalle en la segunda: `"Not able to load user because of unexpected error: User not found. (404)"` — falla en el primer paso de reconocer el token, antes incluso de mirar equipos |
| Causa real, confirmada por el PO, no adivinada | Pregunta directa: ¿qué equipos ve en el selector de vercel.com, y aparece `bearingworld` ahí? | **Solo ve un equipo ("Nortxsys" o similar), y `bearingworld` no está.** La cuenta de Vercel actual del PO no es la que administra el proyecto real — documentado como `F-151`. Ni un cuarto token ni la conexión directa GitHub↔Vercel (que el PO también probó, y da el mismo síntoma: solo ofrece repos de Nortxsys) lo arreglan; hace falta recuperar acceso a la cuenta/equipo correcto |
| Descartado: que el mismo problema afectara a Supabase (`F-073` de nuevo) | El PO comprobó `supabase.com/dashboard` a petición mía: `MVP_RinWorld.io`, `bearingworld-e2e` y `autonomos-ia-mvp`, los tres bajo `aguillensp-sudo` | **La cuenta de Supabase SÍ es la correcta** — el 403 de VERA no era de cuenta. Descartado también que fuera el tipo de clave (proyecto vs. cuenta): el PO confirmó que ya generaba un token de cuenta con permisos completos |
| VERA (Supabase) tras regenerar el token de cuenta | `gh run` `34115410971`, *job* `deploy` | ✅ **Verde.** El paso de VERA se completó solo — el 403 anterior era el token viejo guardado en el secreto, no un problema de tipo ni de cuenta. Entregable 2 queda medio cerrado: VERA automatizado y verificado, Vercel sigue en `F-151` |
| Vercel, cuarto intento (mismo push que confirmó VERA) | Mismo run, log del paso "App a Vercel" | Idéntico: `Error: Not able to load user... User not found (404)`. Cuatro tokens distintos, mismo síntoma — confirma que `F-151` es de acceso de cuenta, no de ningún token concreto |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-144` | ✅ ver cierres anteriores en `git show 7abbc33` |
| **`F-145` los botones de página se buscan por su número y un `aria-label` lo sustituye** | ✅ **4-sep · `71b803b`** |
| **`F-146` `revoke … from public` no le quita nada a `anon`** | ✅ **4-sep · `bf2f285`**, `0022`, aplicada y verificada en la base real |
| **`F-147` la frase del estado vacío tiene que ir en UN solo nodo** | ✅ **4-sep · `1c43957`** |
| **`F-148` con el ámbito encendido no se podía escribir nada** | ✅ **4-sep · `0023`**, aplicada y verificada contra el esquema; **5-sep, verificada contra el CLIENTE REAL** (D-7 en `Nordwälz Lager`, las tres vías de escritura) |
| `MSG-01` a 4/4 sin reintentos | 🟢 **9 de 11 sobre el mismo corpus, con `n=5` la 17 salió 5/5** — serie 15 (n=3): 3/3; serie 16, réplica (n=3): 1/3; serie 17 (n=5, con `F-147` y `noUnusedLocals` puestos): **5/5**. Con más tiradas el marcador deja de oscilar tanto — un solo dato de `n=5`, no una prueba |
| Medición del corpus de `MSG-01` con `F-145` ya puesto | ✅ **4-sep · series 15 y 16**, seis corridas. La 15 no encontró nada; **la 16 encontró `F-147`** |
| **`F-147` la frase del estado vacío tiene que ir en UN solo nodo** | ✅ **4-sep · `1c43957`** — **remedido 5-sep, serie 17 (n=5): sin recurrencia en las cinco** |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5) | ✅ **1-sep · `087962b`** |
| `visibility_scope` (D-4) · `organizations.visibility_scope_enabled` (D-7) · Lista de hilos · `thread_items_select_participant` | ✅ **1-sep y 3-sep · `f5ea8fc`, `804dfe9`** |
| `D-3` (`thread_items.quantity`) | ✅ **COMPLETO** — `CONSULTA` el 3-sep (`0020`), **`OFERTA` el 4-sep (`0021`, `ce78a72`→`098ba19`)** |
| **`thread_public_keys(t_id)`** (reparto de destinatarios) | ✅ **4-sep · `0023`**, aplicada y verificada |
| **`create_inquiry`** (reparto de destinatarios de la CEK) | ✅ **4-sep · `0023`**, con guardia en la base (`app.guard_cek_recipients`) |
| **`F-148` · escribir con el ámbito encendido era imposible desde `0019`** | ✅ **4-sep · `0023`** — tres piezas, sin relajar ninguna política de lectura |
| Entregable 2 · despliegue continuo | 🟡 **7-sep, mitad verificada** — VERA (Supabase) verde en CI real; Vercel bloqueado por acceso de cuenta, `F-151` |
| Entregable 1 · tres entornos como código | ✅ **HECHO — 7-sep** — `entornos.md`, producción y ensayo/staging reales, los dos con `environment:` de GitHub |
| Entregable 3 · aislamiento de demo/e2e | ✅ **HECHO — 7-sep** — el PO borró `motioniq-rag`; `bearingworld-e2e` creado, sembrado y probado (53/53 Playwright) antes de conectar CI. Cierra `F-149` de raíz, no solo la regla de proceso |
| Entregable 6 · residencia europea (VERA) | 🟡 **6-sep, runbook listo** — `vera-vertex-eu-migracion.md`, sin aplicar al código real; falta el proyecto GCP |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

El PO pidió explícitamente **no** replicar la serie 17 hoy y seguir con el resto de
Fundación V1. Con 1, 2 y 3 ya hechos (7-sep), lo que queda abierto para el Día 10:

1. **Entregable 2, pendiente de dos secretos del PO para su primera corrida real:**
   `VERCEL_TOKEN` (vercel.com/account/tokens) y `SUPABASE_ACCESS_TOKEN`
   (supabase.com/dashboard/account/tokens, org `ujatcozvbspkycepemfq`) como secretos de
   GitHub — el PO los añade él mismo, nunca pegados en el chat. El *job* `deploy` está
   escrito y validado (YAML), pero nunca ha corrido de verdad.
2. **Entregable 6, con el proyecto GCP todavía por crear.** El runbook
   (`vera-vertex-eu-migracion.md`) está listo; en cuanto exista el proyecto GCP, aplicar
   el diff de código ahí descrito, siguiendo el orden de corte de su §4.
3. **Decisión del PO: ¿réplica de la serie 17?** Sigue sin decidirse, solo aplazada.
   Mismo `n=5`, mismo corpus de `MSG-01` (sin tocar desde el 5-sep). Implica gasto real
   (~$0,34) — no se lanza sin que lo digas.
4. **Del backlog de `§5`, sin decidir:** si el guardia de `0023` aprende a recalcular el
   reparto ENTERO de claves en cada escritura. Ninguna prisa: está declarado, no tapado.
5. **Nuevo, del 7-sep:** el proyecto aislado (`bearingworld-e2e`) hoy solo tiene la
   siembra base. Falta decidir si el catálogo completo de 200+ líneas del proyecto
   principal (el que ve un socio real en la demo de venta) también se replica aquí, o si
   los 221 renglones que ya trajo el entregable 3 (mismos que `SRCH-01`/`INV-01`
   necesitan para pasar) bastan para lo que este proyecto tiene que hacer.

Fuera de sesión, siguen sin moverse: `F-073` (re-loguear la CLI de Supabase), la
pregunta de alcance del entregable 5 (`FUNDACION-V1.md`), y los worktrees (§5) —
ninguno bloquea trabajo de ingeniería.

### Lo que se cerró hoy (Día 9, 6/7-sep) — resumen; el detalle vive en el `git log` de hoy

- **Entregable 2 (despliegue continuo): hecho.** *Job* `deploy` en `ci.yml`, cierra la
  causa raíz de `F-091`/`F-072` (`F-150`). Sin probar de extremo a extremo (punto 1).
- **Entregable 1 (tres entornos): hecho.** `entornos.md`, producción y staging reales.
- **Entregable 3 (aislamiento demo/e2e): hecho, con prueba real.** `motioniq-rag`
  borrado por el PO, `bearingworld-e2e` creado, sembrado, probado con Playwright
  (53/53) ANTES de conectar CI, y CI ya apuntando ahí. `F-149` cerrado de raíz.
- **Entregable 6 (residencia UE): runbook listo, código sin aplicar.**
  `vera-vertex-eu-migracion.md`.

### Lo que se cerró el Día 8 — el detalle vive en `git show 591ea20`

> ~~1. Encender el interruptor de D-7 en una organización de prueba y usar la aplicación de
> verdad.~~ **Hecho 5-sep-2026, y cerrado del todo.** D-7 encendido en `Nordwälz Lager`,
> las tres vías de escritura de `0023` probadas con el cliente real como ADMIN (§1) **y
> luego como EDITOR de verdad** (punto 3 de esta lista, ya hecho también) — la rama de
> `caller_bypasses_visibility_scope()` que ninguna prueba anterior tocó, incluido el
> hallazgo original de `F-148`, queda ejercitada y en verde.
>
> ~~2. Lo que `F-148` deja abierto: si queda algún OTRO camino de escritura que dependa de
> una política de lectura.~~ **Hecho 5-sep-2026.** `inventory_lines`, `favorite_distributors`
> y las dos funciones de demo revisadas — ninguna tiene el hueco de `F-148`. Y salió un
> CUARTO camino que no estaba en la lista original: `acceptOffer`/`rejectOffer` en
> `offers.ts`, con la misma forma (`update().select()`) pero sin el mismo riesgo, porque
> actúa sobre una fila YA visible, no una recién creada. Razonado y probado con el cliente
> real (§1).
>
> ~~3. Opcional y barato: meter `noUnusedLocals` en los `constraints` de la tarea.~~
> **Hecho 5-sep-2026**, `a385eba`. `test_checks` en verde.
>
> ~~4. Vercel sigue sin redesplegar, con DOS cambios de cliente pendientes.~~ **Hecho
> 5-sep-2026.** `vercel --prod` desde `app/`, alias `https://bearingworld.vercel.app` en
> `HTTP 200`, bundle servido confirmado con `p_quantity` dentro (§1).

1. ~~Serie 17, con `F-147` puesto, y la pregunta de `n=3`.~~ **Decidido 5-sep-2026, PO:
   subir las tiradas por serie.** A partir de la 17, una serie mide con **`n=5`**, no
   `n=3` — ver la fila de §4. **Corrida y terminada: `17a`-`17e`, las CINCO en VERDE al
   primer intento** — la primera serie 5/5 del proyecto (la 15 fue 3/3 y no sobrevivió a
   la réplica, serie 16: 1/3). $0,336154 en total, sin ningún hueco nuevo. Ver §1 para el
   detalle fila a fila.
2. ~~Decidir si el guardia de `cruzar_con_el_contrato` aprende a mirar nombres
   accesibles (`F-145`).~~ **Decidido 5-sep-2026: NO, y no por ruido — por algo peor: la
   corrección obvia no funciona.** Medido antes de escribir nada (§1): el `name: '2'` que
   se le escapó a `F-145` SÍ lo parsea el guardia (`'2' in nombres_u` es `True`) — lo que
   falla es `_declarado()`, cuyo último recurso es `nombre in tarea`, una subcadena SIN
   borde de palabra sobre un blob de 73 KB donde el carácter `'2'` aparece **468 veces**
   por casualidad (fechas, `F-125`, `0012:185`...). Probé el arreglo obvio —exigir borde
   de palabra para nombres de 1-2 caracteres o puramente numéricos— contra las seis
   tareas: **cero avisos nuevos en las seis**, incluida `MSG-01`. No porque el arreglo no
   sirva en general, sino porque el propio `component_api` de `MSG-01`, AL EXPLICAR
   `F-145`, cita el HTML de ejemplo `<button aria-label="Pagina 2">2</button>` — y ese
   `>2<` respeta el borde de palabra igual de bien que un `2` de verdad. **El guardia no
   necesita aprender a mirar nombres accesibles: necesitaría aprender a distinguir una
   declaración de un ejemplo ilustrativo dentro de la misma prosa**, que es un problema
   mucho más caro y con su propio riesgo de huecos nuevos. No se escribe.
3. ~~Añadir un miembro EDITOR real a una organización de prueba, para probar la rama de
   `caller_bypasses_visibility_scope()` que ningún ADMIN ejercita.~~ **Hecho 5-sep-2026**,
   con permiso explícito del PO. Cuenta creada por el Admin API de Supabase (no por SQL
   directo sobre `auth.users` — la lección de `F-013`), `members` la asignó sola a
   `role='EDITOR'`/`visibility_scope='OWN'` (segundo miembro de la organización, trigger
   de `0001`/`0018`), y el llavero se publicó solo al iniciar sesión, sin tocar nada a
   mano (§1). **D-8 confirmado con el cliente real por primera vez:** el EDITOR vio
   «0 hilos» con la organización ya teniendo una conversación activa. Escribió una
   `CONSULTA` de verdad (`create_inquiry`, no-ADMIN, D-7 encendido) y a partir de ahí vio
   «1 hilo» — la rama que exige clave ya envuelta, verde con el cliente real. Por el
   camino salió `F-149` (§1): probar a mano contra el proyecto compartido mientras se
   sigue haciendo `git push` dispara CI → Playwright, que resetea la siembra debajo de
   la prueba en curso — no un bug, una regla de proceso nueva.

**Los seis puntos del Día 7 quedaron completos, y el PO pidió el ritual de cierre
entero** — corrido de verdad, no dado por hecho: §1 con las comprobaciones de cierre,
§2 revisado, §6 con lo que sigue sin saberse, hallazgos y métricas volcados, commit y
push. El Día 9 empezó en el punto 1 de esa lista y terminó bloqueado en el entregable 3
— ver §3 de arriba para el punto exacto donde retoma el Día 10.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **Las series de medición pasan de `n=3` a `n=5`** | 5-sep-2026, PO. La serie 16 (réplica exacta de la 15) dio 1 de 3 donde la 15 dio 3 de 3 sobre el MISMO corpus: con tres tiradas el marcador mide tanto el corpus como la suerte. A partir de la serie 17, cinco tiradas por serie. **Primer resultado: la 17 dio 5/5** — ni prueba ni refuta la apuesta por sí solo, pero es el mejor marcador visto hasta hoy | `remedicion-17{a..e}-msg-n5`, $0,336154 |
| **ADR-002** | Ámbito de visibilidad por usuario. Diez decisiones, seis invariantes, ocho objetos de esquema — **seis hechos, dos bloqueados por Q-1** | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **Q-1 · CERRADA: buzón abierto + el ADMIN recibe copia de todo** | 4-sep-2026, PO. El elemento entrante llega a **todos** los miembros de la receptora; asume quien responde, sin acción de reparto; y el ADMIN de las dos organizaciones es destinatario criptográfico permanente | `ADR-002` §10 Q-1, D-2 (adenda) |
| **V-2 queda INVERTIDO y V-1/V-6 precisados** | 4-sep-2026, consecuencia directa de Q-1. El ADMIN pasa de «nunca recibe copia por ser ADMIN» a «recibe copia de todo». La promesa interna deja de ser «el compañero no puede verlo» y pasa a «solo tu ADMIN puede» | `ADR-002` §4, §1 (matiz) |
| **`quantity` NO se hereda de la oferta anterior** | 4-sep-2026. Copiar la cantidad vieja escribiría en claro una cifra que el ciphertext puede desmentir. `NULL` dice «no se sabe» | `0021` §2 |
| **D-7 se implementa con interruptor, no se difiere** | 3-sep-2026, PO. `organizations.visibility_scope_enabled`, apagado por defecto | `0019`, adenda en `ADR-002` D-7 |
| **Lo que se afirme sobre privilegios se comprueba contra el catálogo, no contra el `.sql`** | 4-sep-2026, `F-146`. La plataforma añade concesiones que ninguna migración escribió | `0022`, regla 2 de este fichero |
| **El banco de pruebas tiene que ser tan permisivo como producción, no más estricto** | 4-sep-2026, `F-146`. Un local más estricto esconde agujeros reales en vez de cazarlos | `00_auth_stub.sql` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa» | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. Confirmado viable el 6-sep (Vertex ofrece *endpoint* multi-región UE para Claude, GA mayo-2026). Runbook listo (`vera-vertex-eu-migracion.md`), código sin aplicar — falta el proyecto GCP, sin fecha | Plan §4.2, `FUNDACION-V1.md` §1 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código. **Hoy se usó dos veces** (Q-1 y `F-146`) | Plan, Anexo B |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió | 25-ago · `F-129` |
| **El guardia AVISA, no bloquea** | Vale para roles, literales y roles estructurales. Es una **medida**, no una preferencia | `F-127`, `F-130`, `F-131` |
| **`C2` corre SIEMPRE la suite e2e ENTERA** | `D-09-03 (a)`, 12-ago | `test_runner.py` |
| **Un verde con excusas se MARCA en el CSV** | 30-ago | `F-134` |
| **Los logs de corrida se versionan, y los escribe la corrida** | 30-ago | `F-115`, `F-136` |
| **El corpus NO se toca a mitad de serie** | 4-sep-2026. `F-145` se declaró después de `14c`: cambiarlo antes habría hecho que las tres corridas midieran corpus distintos | serie 14 |
| **Un artefacto crudo del Coder no se commitea sobre una pantalla ya revisada** | Aplicado tres veces más hoy | `CLAUDE.md` §1.6 |
| **Lo que el contrato exige, la tarea lo dice** | **Quince veces en ocho días.** La vía ha sido siempre la misma: declararlo en `component_api`, sin tocar ni un aserto | `F-116`…`F-145` |
| **El 57 a 1 se acepta, sin acción** | 1-sep-2026, PO | `F-113` |
| **El guardia NO aprende a mirar nombres accesibles (`F-145`)** | 5-sep-2026. Medido antes de escribir: el arreglo obvio (borde de palabra para nombres cortos) da CERO avisos nuevos en las seis tareas, porque el propio `component_api` de `MSG-01` cita HTML de ejemplo que reintroduce el mismo falso negativo. El problema no es el guardia, es distinguir una declaración de un ejemplo en la misma prosa | §1, §3 |
| **La CD dispara sobre `mvp/bootstrap`, no `main`** | 6-sep-2026, PO. `main` lleva desde el 4-ago sin moverse; fusionarla es un cambio de flujo aparte, no de CI | `ci.yml`, `entornos.md` |
| **El aislamiento de demo/e2e va por proyecto Supabase separado** | 6-sep-2026, PO — dirección confirmada dos veces (antes y después de ver el coste real, $0/mes). Bloqueado en la ejecución por un límite de cuenta ajeno al repo, no por la decisión en sí | `FUNDACION-V1.md` entregable 3 |
| **Ante una acción irreversible, se prueba primero la reversible** | 6-sep-2026, aplicado sin que hiciera falta pedirlo: se intentó `pause_project` sobre `motioniq-rag` antes de considerar borrarlo, aunque el PO ya había autorizado el borrado directo | Esta sesión |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **El riesgo de la salida abrupta ya no se pierde, se CONCENTRA en el ADMIN.** Con Q-1 cerrada, la consecuencia 7.1 desaparece porque el ADMIN conserva copia de todo — y por eso el día que el ADMIN se vaya de golpe o pierda su frase, la organización pierde lo único que quedaba. La recomendación (más de un ADMIN) **tiene que llegar a la interfaz**, no quedarse en el ADR | Producto, cuando se diseñe el alta de miembros |
| 🟠 | **La residencia sigue siendo el entregable con reloj, pero ya con runbook.** `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com` — el diff de código y los pasos de GCP están en `vera-vertex-eu-migracion.md`, sin fecha puesta porque falta el proyecto GCP | Álvaro: crear el proyecto GCP |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando. **Nota 6-sep:** el *job* `deploy` nuevo usa un `SUPABASE_ACCESS_TOKEN` de CI aparte, así que no hereda este bloqueo | Álvaro: re-loguear y `link` |
| 🟠 | **`F-151`: el paso de Vercel del *job* `deploy` está bloqueado por acceso de cuenta, no por configuración.** Cuatro tokens seguidos fallaron con variantes de `"User not found"`. Causa confirmada por el PO: su cuenta de Vercel hoy solo ve el equipo "Nortxsys", y `bearingworld` no está ahí. La conexión directa GitHub↔Vercel choca con lo mismo. **El paso de VERA (Supabase) ya NO tiene este problema — resuelto y verde en CI real el 7-sep** (era el token viejo en el secreto, no la cuenta ni el tipo de clave); solo queda Vercel | Álvaro: recuperar acceso a la cuenta/equipo correcto de Vercel (probar "Continue with GitHub" con `aguillensp-sudo`), o que quien lo administre le invite |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: seis** (raíz + cinco), **la composición cambió por primera vez** — desapareció uno, aparecieron dos de sesiones nuevas. Quinta comprobación seguida sin que la hipótesis de lanzar desde la raíz se pruebe | Fuera de sesión, desde la raíz |
| 🟡 | **Un cliente manipulado puede envolver de más hacia la CONTRAPARTE.** El guardia cubre V-1 en el lado del emisor y V-2 en las dos organizaciones, no el conjunto entero: comprobarlo exigiría recalcular el reparto en cada escritura. Declarado en `0023`, no tapado | Sin decidir |
| 🟡 | **El guardia no ve los nombres accesibles** (`F-145`). Cazó catorce huecos de la familia y este se le escapó entero. **Decidido 5-sep-2026: se queda así** — el arreglo obvio no funciona (§1, §4) | Aceptado, no se escribe |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| ⚪ | ~~`quantity` en `OFERTA`~~ | **Resuelto 4-sep-2026: `0021`, aplicada y verificada** |
| ⚪ | ~~Copia sin trackear de este fichero en la raíz~~ | **Resuelto 4-sep-2026: borrada, y NO ignorada a propósito** |
| ⚪ | ~~`anon` podía ejecutar cinco funciones de `public`~~ | **Resuelto 4-sep-2026: `0022`, con ancla negativa** |
| ⚪ | ~~`0023` no lo ha probado ningún cliente~~ | **Resuelto 5-sep-2026: probado con el cliente real, D-7 encendido en `Nordwälz Lager`, las tres vías de escritura — como ADMIN y como EDITOR real** |
| ⚪ | ~~Vercel no redesplegó, DOS cambios de cliente pendientes~~ | **Resuelto 5-sep-2026: `vercel --prod`, bundle en producción confirmado con `p_quantity`** |
| ⚪ | ~~Entregable 3 bloqueado: cupo de proyectos Free de Supabase agotado por `motioniq-rag`, ajeno a este repo~~ | **Resuelto 7-sep-2026: el PO lo borró desde el dashboard** (`pause_project` había fallado antes, ya hibernando). `bearingworld-e2e` creado, sembrado y probado (53/53 Playwright) — ver §1, §2 |
| ⚪ | ~~D-8 (un EDITOR no ve nada de sus compañeros) sin probar con el cliente real~~ | **Resuelto 5-sep-2026: EDITOR real, «0 hilos» con la organización ya en conversación activa** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- ~~Si el 3 de 3 de la serie 15 se sostiene.~~ **Contestado el mismo día: no.** La réplica
  exacta dio 1 de 3. Lo que queda abierto es lo de detrás: **cuántas tiradas hacen falta para
  que este marcador signifique algo**. Con `n=3`, seis corridas dieron 4 de 6, oscilando
  entre 0 y 3 sin que el corpus cambiara. **La serie 17, primera con `n=5`, dio 5 de 5** —
  un único dato no decide si `n=5` basta, pero es la serie más limpia del proyecto hasta
  hoy. Haría falta una réplica de la 17 (misma `n=5`, mismo corpus) para saber si esta vez
  sí se sostiene, igual que se hizo con la 15 y la 16.
- **Cuántos huecos de la familia `F-116`–`F-147` quedan.** Dieciséis en ocho días. La serie
  15 fue la primera desde `F-137` que no encontró ninguno **y la 16, sobre el corpus idéntico,
  encontró uno** — así que «una serie limpia» no significa «corpus completo», significa «esas
  tres tiradas no lo tocaron». `F-145` y `F-147` son además de una clase nueva: el Coder no se
  salta el contrato, **elige entre dos formas que el contrato no distingue**.
- **Desde cuándo `anon` podía ejecutar esas cinco funciones, y si alguien lo hizo.** El
  agujero existía desde `0012` (12-ago). **No se han mirado los logs de PostgREST** para ver
  si hubo llamadas anónimas a `org_public_keys` — se puede, y no se ha hecho hoy.
- ~~Si queda algún otro camino de escritura colgando de una política de lectura.~~
  **Contestado el 5-sep: no en `inventory_lines`, `favorite_distributors` ni en las dos
  funciones de demo — pero sí apareció un cuarto camino no listado, `acceptOffer`/
  `rejectOffer`, con la misma forma que `F-148` y sin el mismo riesgo (§1: actúa sobre una
  fila ya visible, no una recién creada).**
- ~~Si el reparto de `0023` sobrevive al cliente real, en la rama que exige una clave ya
  envuelta (no la del *bypass* de ADMIN).~~ **Contestado el 5-sep, con un EDITOR real
  creado para la ocasión (permiso del PO):** sí. `create_inquiry` desde `editor@
  bearingworld.test` (Nordwälz, D-7 encendido, `role='EDITOR'`) escribió con exactamente
  3 claves — el propio EDITOR y los dos ADMIN, ni uno más — y **D-8 se cumplió con el
  cliente real por primera vez**: «0 hilos» antes de participar. La única sorpresa fue de
  proceso, no de producto: `F-149`, probar en vivo contra el proyecto compartido mientras
  se sigue haciendo `git push` (que dispara CI → Playwright, y esa suite resetea la
  siembra) deja el terreno moviéndose. Repetido sin push de por medio, limpio a la
  primera.
- **Cuántos ADMIN va a tener de verdad una organización.** Q-1 hace del ADMIN el único
  depositario de todo lo que sus editores dejen de tener, y las dos organizaciones de e2e
  siguen teniendo **exactamente uno** cada una — `Nordwälz Lager` tiene ahora también un
  EDITOR (de prueba, 5-sep), pero eso no cambia la cuenta de ADMIN. Con un solo ADMIN, la
  consecuencia 7.1 no se ha resuelto: se ha mudado de sitio.
- **Cuántas funciones de `public` van a nacer fuera de nuestras migraciones.** `0022` cierra
  la *default privilege* del rol `postgres`; la de `supabase_admin` sigue abierta y es de la
  plataforma. Si algún día la plataforma crea una función en `public`, nacerá con `anon`.
- **Si `quantity` en `OFERTA` se pinta en alguna pantalla.** La columna existe y la escribe
  `counter_offer`, pero **nadie la lee todavía** — ni MSG-02, ni el plano de metadatos de
  D-2, ni VERA. Es exactamente el estado en el que estuvo `visibility_scope` dos días.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** Sin datos nuevos
  hoy: las tres corridas de la serie 14 no tuvieron ninguna variación ordinaria que explicar.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sin datos nuevos hoy.
- **Qué hay dentro de `motioniq-rag`.** Nunca se miró — ni antes de intentar pausarlo ni
  antes de que el PO autorizara borrarlo. No se ha ejecutado ninguna acción sobre él
  (las dos que se intentaron fallaron sin efecto), pero si en algún momento SÍ se borra,
  conviene mirar primero qué se pierde, aunque el PO ya lo haya autorizado a ciegas.
- **Si "hilos propios de e2e" sale más barato que pagar Supabase Pro para el entregable
  3.** No medido hoy — ni el coste de tocar ~52 tests e2e existentes, ni cuánto durarían
  $25/mes siendo la solución. Es la comparación que le falta a la decisión del PO en §3.
- **Si el id de modelo y la región multi-UE de Vertex AI que cita
  `vera-vertex-eu-migracion.md` (de una búsqueda web del 6-sep) siguen vigentes el día
  que se ejecute la migración.** El propio documento dice que hay que reconfirmarlos
  contra la doc oficial en ese momento — aquí queda constancia de que hoy NO se
  confirmaron contra la consola de GCP, solo contra resultados de búsqueda.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas. **Y comprueba
   el contenido, no el continente** (`F-132`). **Si la afirmación es sobre permisos o
   privilegios, la fuente es el catálogo de la base, no el `.sql`** (`F-146`).
3. **Revisar §2 contra el código**, no contra el §2 de ayer.
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

⚠ **Y el paso cero, que es la regla 4: no cierres hasta que se acabe.** El día 3 se cerró a
las 12:33 y siguió hasta las 13:45. El día 4 se cerró a las 11:22 y siguió hasta las 12:31.
El día 6 lo cumplió dos veces corriendo `test_checks.py` antes de commitear. **El día 7 lo
cumplió tres veces: `test_checks` antes de commitear `F-145`, el ancla negativa de `0022`
antes de darlo por bueno, y la CI job a job antes de escribir esto. Y luego el día siguió
igualmente: la serie 15 entera se corrió DESPUÉS de este cierre y este fichero se reescribió
para meterla. Cerrar no es terminar.**

**El día 8 lo cumplió por el otro lado: no cerró nada hasta que de verdad se acabó.**
Este fichero se marcó explícitamente «EN CURSO, no es el cierre del día» durante horas
mientras quedaban puntos abiertos —la serie 17 corriendo en segundo plano, el EDITOR de
prueba pendiente de permiso—, y solo se corrió el ritual de cierre cuando el PO lo pidió
y no quedaba nada suelto. Comprobado antes de escribir el pie: `git status --short`
limpio, CI job a job en verde sobre el commit final, y el estado de la base
(`visibility_scope_enabled`, el EDITOR y su clave) releído por si algo se había movido
entre medias — no se había movido nada.

⚠ **Y este fichero se escribe en `openspec/v1/ESTADO-V1.md`, no en la raíz del repo.** La
copia de la raíz se borró el 4-sep y **no** está en `.gitignore`: si reaparece, saldrá como
`??` en `git status`, que es como se descubrió. Comprobar `git status --short` después de
escribir, no solo antes.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`docs/ADR-002` §10 (Q-1) ENTERA**, si vas a tocar mensajería o reparto de claves. Sin
   esa decisión no se escribe SQL de reparto de CEK.
3. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado el 6-sep: entregables
   1, 2 y 6 con movimiento; el 3 bloqueado — lee su adenda del 6-sep antes de reintentar
   `create_project`.
4. **`openspec/v1/entornos.md`** (nuevo, 6-sep) si vas a tocar CI/CD o el mapa de entornos.
5. **`openspec/v1/vera-vertex-eu-migracion.md`** (nuevo, 6-sep) antes de tocar `vera/index.ts`
   por el entregable 6 — no reinventar el runbook.
6. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**.
7. **`docs/ADR-001`** si vas a tocar criptografía.
8. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
9. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
10. **`findings-register.md`** nunca de corrido: por identificador. Del Día 9: `F-150`.

---

*Día 8 de V1 · 5-sep-2026, cerrado a las 17:00 UTC a petición del PO, con los seis
puntos del Día 7 hechos y sin nada suelto detrás · fecha leída de la máquina (`date -u`)
dos veces, al abrir y al cerrar · estado verificado contra el proyecto real
`troxminloxkjwihwfevs` (`update organizations`, `thread_items`/`thread_item_keys` tras
cada escritura, `pg_proc`/`0019` para `caller_bypasses_visibility_scope`, un EDITOR real
creado por el Admin API de Supabase y releído al cerrar sin cambios), contra sesiones de
navegador reales como `alpha@`, `beta@` y `editor@bearingworld.test`, contra `gh run
list` para diagnosticar `F-149` y de nuevo job a job sobre el commit final, contra
`python -m harness.tests.test_checks`, contra el bundle servido en
`https://bearingworld.vercel.app` tras `vercel --prod`, y contra la salida real de
**cinco** corridas pagadas de hoy (serie 17, `17a`-`17e`) — no contra otro documento ·
Dirección Técnica, Nortex Systems*
