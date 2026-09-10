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

**Día 9 de V1 · 6/7-sep-2026 · sin cierre formal.** Se quedó con el `Estado: EN CURSO`
de cuando se escribió: la sesión no corrió el ritual del §7, saltó directa a `F-151` y
ahí se queda hasta hoy. Fundación V1 avanzó en los entregables 1, 2, 3 y 6 — el 1 (tres
entornos como código) y el 3 (aislamiento demo/e2e, `bearingworld-e2e` creado, sembrado
y probado 53/53 antes de conectar CI) quedaron hechos; el 6 (residencia UE) con el
runbook listo, código sin aplicar; el 2 (despliegue continuo) quedó a medias — *job*
`deploy` escrito, VERA (Supabase) verificado en CI real, Vercel bloqueado por `F-151`
(acceso de cuenta, no configuración). El detalle completo vive en
`git show 9d29222:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

**Día 10 de V1 · 8-sep-2026 · Estado: CERRADO.** Sesión de un solo punto: `F-151`
cerrado con cuenta y proyecto de Vercel nuevos (`alvaro-7494` / `rin-world-io`),
verificados en CI real (`gh run` `34219861643`, los cinco *jobs* en verde incluido
`deploy`) y con `curl` (`HTTP 200`). Entregable 2 de Fundación V1 (despliegue continuo)
quedó cerrado del todo. El detalle completo vive en
`git show 522b94a:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

**Día 11 de V1 · 8/10-sep-2026 · Estado: CERRADO.** Cuatro puntos: uno bloqueado en una
revisión externa (entregable 6, GCP listo, Anthropic/Model Garden sin aprobar, `429
RESOURCE_EXHAUSTED`) y tres cerrados del todo — serie 18 de `MSG-01` (5/5 en veredicto,
pero `18a` solo verde al intento 3 tras repetir el mismo error de sintaxis dos veces,
`F-152`, cerrado el Día 12), catálogo de `bearingworld-e2e` sin *gap* con producción
(221 filas / 6 organizaciones en las dos bases), y Vercel Preview deployments
recuperadas con tres causas encadenadas resueltas (`Root Directory`, el *job* `deploy`
de CI, y `git.deploymentEnabled` en vez de `ignoreCommand`, `F-153`). El detalle
completo vive en `git show c395432:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

**Día 12 de V1 · 10-sep-2026 · Estado: CERRADO**

Dos puntos del backlog que el Día 11 dejó "sin decidir, sin prisa" (§3), decididos y
ejecutados los dos hoy a petición del PO; el entregable 6 sigue exactamente donde lo
dejó el Día 11 — se recomprobó, no se dio por hecho.

**Entregable 6: recomprobado, sigue bloqueado, sin movimiento posible desde aquí.**
Llamada real repetida contra `aiplatform.eu.rep.googleapis.com/.../claude-sonnet-5:rawPredict`
en `bearingworld-vera-eu`: mismo `429 RESOURCE_EXHAUSTED`, mensaje idéntico letra por
letra al del cierre del Día 11. Aparte, se confirmó que la CI del commit de cierre del
Día 11 (`c395432`) terminó en verde (`gh run` `34464957453`, 4m12s) — quedaba pendiente
de confirmar anoche.

**Backlog de `0023` §4 (reparto exacto de la CEK hacia la CONTRAPARTE): cerrado en
`0024`, y con un segundo hallazgo encadenado (`F-155`) que `0024` obligó a destapar.**
El guardia (`app.guard_cek_recipients`) solo comprobaba que no faltara nadie (V-2) y que
no sobrara nadie DENTRO de mi propia organización (V-1) — nunca que no sobrara nadie
hacia la CONTRAPARTE, que es justo lo que `0023` §4 dejaba escrito como hueco declarado.
`0024` añade dos comprobaciones aditivas, sin tocar V-1/V-2 ni una línea: **`F-154`**
(nuevo, no estaba declarado en ningún sitio) — ningún destinatario puede ser de una
TERCERA organización ajena al intercambio, algo que ni V-1 ni V-2 miraban nunca; y el
cierre del propio backlog — con hilo ya existente, el reparto tiene que ser subconjunto
EXACTO de lo que `thread_public_keys(thread_id)` devuelve ahora mismo, reutilizando esa
función como fuente de verdad en vez de reimplementar la lógica de destinatarios una
segunda vez. Corriendo `supabase/tests/run.sh` (Docker, Postgres desechable) DESPUÉS de
escribir `0024`, un bloque de prueba ya existente y sin tocar (`01_schema_smoke.sql`,
"c2 asume: responde") empezó a fallar — **no por un bug de `0024`, sino porque `0024` fue
la primera pieza en depender de que `otra` (la organización de enfrente) estuviera bien
calculada.** `create_thread_item`/`counter_offer` la calculaban con un `SELECT` normal
sobre `threads`, sujeto a la política de RLS que desde `0019` exige tener YA una clave
envuelta en el hilo — y quien escribe su primer elemento en un hilo con el ámbito
encendido no la tiene todavía, así que el `SELECT` devolvía cero filas y `otra` quedaba
en `NULL` sin ningún error. Nunca se notó porque ni V-1 ni V-2 (0023) dependían de que
`otra` fuera correcto con la fuerza suficiente para romper un aserto. Es la misma familia
que `F-148`. Cerrado en `0025` con `app.thread_counterpart()`, `security definer`, mismo
patrón que `app.resolve_thread`/`app.can_access_thread`. Detalle en `F-154`/`F-155`
(`findings-register.md`).

**`F-152` (distinguir "verde al primer intento" de "verde tras reintentos" en el CSV del
arnés): cerrado.** Columna nueva `primer_intento_limpio` en `harness-metrics.csv`
(`harness/core/metrics.py`) — `si`/`no` en la fila que llega a `PASA` según si `attempt`
fue 1 o hizo falta reintentar, `-` en cualquier fila que no sea un veredicto verde (mismo
patrón que `corrida`, F-129). Las 143 filas históricas llevan `-`: no se recalculan
aunque el dato de `intentos` ya estuviera, por la misma regla que impidió recalcular el
histórico al añadir `corrida`.

**Verificación de cierre, las dos piezas:** `supabase/tests/run.sh` completo
(`ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`, con dos asertos nuevos para
`F-154` y el backlog de `0023` §4, más el bloque preexistente de Q-1 que `0025` volvió a
dejar en verde) contra un Postgres desechable, no contra producción — `0024` y `0025`
aplicadas después por el MCP a `troxminloxkjwihwfevs` y a `bearingworld-e2e`, con
`pg_proc` releído en producción para confirmar la firma nueva de `guard_cek_recipients`
(4 parámetros, la de 3 ya no existe) y que `app.thread_counterpart` quedó `security
definer`. `python -m harness.tests.test_checks` (exactamente el comando del *job* `arnes`
de CI): 22 en verde. `get_advisors` (seguridad) en `troxminloxkjwihwfevs`: los tres avisos
existentes, ninguno nuevo de `guard_cek_recipients` ni `thread_counterpart` — los dos
viven en `app`, no expuestos por REST.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-10` |
| CI del cierre del Día 11 (`c395432`) | `gh run list --commit c395432` | `success`, `34464957453`, 4m12s |
| Si la aprobación de Anthropic (Model Garden) ha llegado, recomprobado hoy | Llamada real a `aiplatform.eu.rep.googleapis.com/.../claude-sonnet-5:rawPredict` contra `bearingworld-vera-eu`, no el resultado de anoche | `429 RESOURCE_EXHAUSTED`, mismo mensaje letra por letra — sigue bloqueado |
| El hueco declarado en `0023` §4 ("un cliente manipulado puede envolver de más hacia la CONTRAPARTE") | Lectura línea a línea de `app.guard_cek_recipients` antes de escribir SQL nuevo, no de memoria | Confirmado: V-1 solo mira intrusos en mi propia organización, V-2 solo mira que no falte un ADMIN — ninguna de las dos mira exceso hacia la contraparte, ni pertenencia a las dos organizaciones del intercambio (`F-154`, no estaba ni declarado) |
| `0024` (el guardia recalcula el conjunto exacto) contra el esquema real | `supabase/tests/run.sh` (Docker, Postgres desechable) tras escribir la migración, no asumido en verde | Un bloque preexistente y sin tocar ("c2 asume: responde") pasó a fallar — `F-155`, ver más abajo |
| La causa de `F-155` (`otra` en `NULL`) | `raise notice` de depuración contra un Postgres desechable en el punto exacto del fallo: `org_low_id`, `org_high_id`, `current_org_id()`, `otra`, uno a uno | `otra` = `NULL`: el `SELECT` de `create_thread_item`/`counter_offer` cae bajo `threads_select_participant` (0019), que exige ya tener una clave envuelta — y quien escribe su primer elemento no la tiene |
| `0025` (helper `security definer`) contra el esquema real | `supabase/tests/run.sh` completo, de nuevo, con los dos test nuevos de `F-154`/backlog de `0023` §4 añadidos a `01_schema_smoke.sql` | `ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`; los dos test nuevos disparan señalando exactamente al miembro esperado (`b1` en el de tercera organización, `c3` en el de exceso hacia la contraparte) |
| `0024`/`0025` aplicadas a producción y a `bearingworld-e2e` | `pg_proc`/`pg_get_function_identity_arguments` releído después por el MCP, no asumido por el `{"success":true}` de `apply_migration` | `guard_cek_recipients` con 4 parámetros (la firma de 3 ya no existe); `thread_counterpart` presente, `prosecdef=true` — en las dos bases |
| Avisos de seguridad nuevos tras `0024`/`0025` | `get_advisors(type=security)` en `troxminloxkjwihwfevs` | Los tres avisos ya existentes (search_path de dos funciones de demo, `org_public_keys`/`thread_public_keys` ejecutables por `authenticated`, password protection); ninguno nuevo — `guard_cek_recipients`/`thread_counterpart` viven en `app`, no expuestos por REST |
| El *job* `arnes` de CI (`F-152`) | `python -m harness.tests.test_checks`, el comando exacto del *job* | 22 en verde |
| Las 143 filas históricas de `harness-metrics.csv` tras insertar la columna nueva | Script que cuenta comas por fila antes de tocar nada — el contrato exige cero comas por campo | 143 de 143 con el recuento esperado; columna `primer_intento_limpio` insertada con `-` en las 143, sin recalcular ninguna |
| Estado final del repo | `git status --short` | (ver pie) |

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
| `MSG-01` a 4/4 sin reintentos | 🟢 **13 de 16 sobre el mismo corpus, contando solo el primer intento (así mide esta fila)** — serie 15 (n=3): 3/3; serie 16, réplica (n=3): 1/3; serie 17 (n=5): 5/5, las cinco al primer intento; serie 18, réplica de la 17 (n=5): **4 de 5 limpias al primer intento** — `18a` roja en `C1`/`C2` en los intentos 1 y 2, verde recién en el 3 (`F-152`); no cuenta como limpia para esta fila aunque el veredicto final de la corrida sea verde |
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
| Entregable 2 · despliegue continuo | ✅ **HECHO — 8-sep** — VERA y Vercel, los dos verdes en CI real (`gh run` `34219861643`). `F-151` cerrado: cuenta y proyecto de Vercel nuevos, ver §4/§5 |
| Entregable 1 · tres entornos como código | ✅ **HECHO — 7-sep, Preview deployments recuperadas el 10-sep sin duplicar producción** (`F-153`) — `entornos.md`, los tres entornos con `environment:` de GitHub donde aplica |
| Entregable 3 · aislamiento de demo/e2e | ✅ **HECHO — 7-sep** — el PO borró `motioniq-rag`; `bearingworld-e2e` creado, sembrado y probado (53/53 Playwright) antes de conectar CI. Cierra `F-149` de raíz, no solo la regla de proceso |
| Entregable 6 · residencia europea (VERA) | 🟠 **10-sep, infraestructura GCP creada y verificada** (proyecto, facturación, API, cuenta de servicio — §1) — bloqueada en la aprobación de Anthropic (Model Garden), `429 RESOURCE_EXHAUSTED` en cada comprobación, sin fecha. Código (`vera/index.ts`) sin tocar, a propósito |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

Con el entregable 6 bloqueado en una revisión externa y las dos piezas del backlog del
Día 11 cerradas hoy (§1), lo único que queda con movimiento propio es:

1. **Entregable 6: seguir esperando la aprobación de Anthropic (Model Garden), sin ETA
   conocido.** No hay más margen técnico desde este lado — recomprobado hoy, mismo `429`
   letra por letra. Reintentar la llamada de prueba cuando llegue alguna confirmación por
   email, o periódicamente si no llega ninguna. **No tocar `vera/index.ts` hasta que
   responda** (orden de corte del runbook).
2. **`F-155`, el hallazgo que salió al cerrar el backlog de hoy, deja una pregunta
   abierta:** ¿hay OTROS `SELECT` bajo RLS de `threads`/`thread_items` en el código que
   asuman en silencio que quien llama ya tiene una clave envuelta, además de los dos que
   `0025` corrigió? No se ha auditado el resto de `keys.ts`/`thread-detail.ts` con esa
   pregunta concreta — ver §6.

Fuera de sesión, siguen sin moverse: `F-073` (re-loguear la CLI de Supabase) y la
pregunta de alcance del entregable 5 (`FUNDACION-V1.md`) — ninguno bloquea trabajo de
ingeniería.

### Lo que se cerró hoy (Día 12, 10-sep)

- **Entregable 6: recomprobado, sigue bloqueado.** Mismo `429 RESOURCE_EXHAUSTED`, sin
  movimiento posible desde este repo. CI del cierre del Día 11 confirmada en verde.
- **Backlog de `0023` §4 (reparto exacto hacia la CONTRAPARTE): cerrado en `0024`.**
  Nueva comprobación aditiva en `app.guard_cek_recipients`: con hilo existente, el
  reparto tiene que ser subconjunto exacto de `thread_public_keys(thread_id)`.
- **`F-154` (nuevo, no declarado antes): cerrado en `0024`.** Ningún destinatario de la
  CEK puede pertenecer a una tercera organización ajena al intercambio — ni V-1 ni V-2
  de `0023` lo comprobaban nunca.
- **`F-155` (nuevo, descubierto verificando `0024`): cerrado en `0025`.** `otra` (la
  organización de enfrente) se calculaba con un `SELECT` bajo RLS que devolvía `NULL`
  para quien escribe su primer elemento en un hilo con el ámbito encendido — mismo
  patrón que `F-148`. Nuevo helper `app.thread_counterpart()`, `security definer`.
- **`F-152`: cerrado.** Columna `primer_intento_limpio` en `harness-metrics.csv` —
  distingue un veredicto verde limpio de uno rescatado por reintentos, sin recalcular
  las 143 filas históricas.

### Lo que se cerró el Día 11 (10-sep) — resumen; el detalle vive en `git show c395432`

- **Infraestructura GCP del entregable 6, creada y verificada.** Bloqueada en la
  aprobación de Anthropic (Model Garden), sin fecha.
- **Serie 18 (réplica n=5 de la 17): 5/5 en veredicto, con un matiz nuevo — `F-152`**
  (cerrado el Día 12, ver arriba).
- **Catálogo de `bearingworld-e2e`: sin *gap* con producción**, 221 filas / 6
  organizaciones en las dos bases.
- **Vercel Preview deployments: recuperadas, tres causas encadenadas resueltas — `F-153`.**

### Lo que se cerró el Día 10 (8-sep) — resumen; el detalle vive en `git show 522b94a`

- **`F-151` cerrado.** Cuenta y proyecto de Vercel nuevos (`alvaro-7494` / `rin-world-io`),
  `ci.yml` apuntado con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` literales en vez de
  `--scope`, verificado en CI real (`gh run` `34219861643`) y con `curl` (`HTTP 200`).
- **Entregable 2 (despliegue continuo) quedó cerrado del todo.** VERA y Vercel, los dos
  verdes en CI real — nada a medias, a diferencia del cierre del 7-sep.
- **Cuenta vieja de Vercel, dada por perdida sin intentar recuperarla.** El PO tomó
  directamente la tercera vía que el propio `F-151` dejaba escrita — `bearingworld.vercel.app`
  y sus variables de entorno no se recuperaron ni se intentó.

### Lo que se cerró el Día 9 (6/7-sep) — resumen; el detalle vive en `git show 9d29222`

- **Entregable 1 (tres entornos): hecho.** `entornos.md`, producción y staging reales.
- **Entregable 3 (aislamiento demo/e2e): hecho, con prueba real.** `motioniq-rag`
  borrado por el PO, `bearingworld-e2e` creado, sembrado, probado con Playwright
  (53/53) ANTES de conectar CI, y CI ya apuntando ahí. `F-149` cerrado de raíz.
- **Entregable 6 (residencia UE): runbook listo, código sin aplicar.**
  `vera-vertex-eu-migracion.md`.
- **Entregable 2: quedó a medias** — VERA verde en CI real, Vercel bloqueado por
  `F-151`. Cerrado hoy, Día 10 (ver arriba).

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
| **`F-151` se cierra con cuenta y proyecto de Vercel nuevos, no recuperando el acceso viejo** | 8-sep-2026, PO — la tercera vía que el propio hallazgo dejaba escrita, sin intentar antes las otras dos (re-login con `aguillensp-sudo`, o invitación de quien administra el equipo viejo). Coste asumido: se pierden `bearingworld.vercel.app` y las variables de entorno del proyecto viejo | `F-151`, `entornos.md` |
| **Los tokens no se pegan en el chat, el PO los pone él mismo por su terminal** | Ya regía para `SUPABASE_TOKEN` (7-sep); aplicado también hoy a `VERCEL_NEWACCOUNT_TOKEN`. Los IDs de proyecto/organización (`orgId`, `projectId`) NO son secretos y sí se pasan en claro — son identificadores, no credenciales | Esta sesión, `ci.yml` |
| **La cuenta de facturación de GCP pasa de prueba gratuita a pagada** | 10-sep-2026, PO. Necesario para poder solicitar acceso a modelos de terceros (Claude Sonnet 5) en Model Garden — Google no deja comprar esos productos contra crédito de prueba | `vera-vertex-eu-migracion.md` |
| **`git.deploymentEnabled` sustituye a `ignoreCommand` para excluir `mvp/bootstrap` del disparador de Git de Vercel** | 10-sep-2026. `ignoreCommand` no generaba ni "Ready" ni "Ignored" para esa rama tras corregir `Root Directory`; la documentación oficial de Vercel señala `git.deploymentEnabled` como la propiedad pensada para esto, sin gastar cupo de *build* | `F-153`, `entornos.md`, `app/vercel.json` |
| **El guardia de la CEK recalcula el conjunto exacto en vez de solo comprobar "no falta nadie"** | 10-sep-2026, PO — decisión ejecutada el mismo día que se tomó (Día 12). Reutiliza `thread_public_keys` como fuente de verdad en vez de reimplementar la lógica de destinatarios una segunda vez; con hilo existente, `p_keys` tiene que ser subconjunto exacto de lo que esa función devuelve | `0024`, `F-154`, `findings-register.md` |
| **Un `SELECT` bajo RLS que depende de `thread_item_keys` no sirve dentro de una función `security invoker` que un participante SIN clave todavía tiene que poder llamar** | 10-sep-2026, `F-155`. Mismo principio que `F-148` (0023 §4bis): la lectura derivada de si ya tienes clave no puede ser condición para la escritura que te la daría. La solución es siempre un helper `security definer` (`can_access_thread`, `resolve_thread`, y ahora `thread_counterpart`), nunca relajar la política de lectura | `0025`, `F-155` |
| **El CSV histórico del arnés no se recalcula, ni cuando el dato ya estaba** (repetido) | 10-sep-2026, aplicado a `primer_intento_limpio` (F-152) igual que a `corrida` (F-129) — aunque `intentos` ya bastaba para derivarlo en las 143 filas viejas, se escribe `-` y no se reconstruye | `harness/core/metrics.py`, F-129, F-152 |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **El riesgo de la salida abrupta ya no se pierde, se CONCENTRA en el ADMIN.** Con Q-1 cerrada, la consecuencia 7.1 desaparece porque el ADMIN conserva copia de todo — y por eso el día que el ADMIN se vaya de golpe o pierda su frase, la organización pierde lo único que quedaba. La recomendación (más de un ADMIN) **tiene que llegar a la interfaz**, no quedarse en el ADR | Producto, cuando se diseñe el alta de miembros |
| 🟠 | **La residencia sigue siendo el entregable con reloj — la infraestructura GCP ya está, el bloqueo es una revisión externa.** `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com`; el proyecto GCP, la facturación, la API y la cuenta de servicio están creados y verificados (§1), pero el cupo de Vertex AI para Claude Sonnet 5 exige aprobación de Anthropic vía Model Garden — `429 RESOURCE_EXHAUSTED` en cada comprobación de hoy, sin fecha | Anthropic: aprobar la solicitud de Model Garden (fuera del control de este repo) |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando. **Nota 6-sep:** el *job* `deploy` nuevo usa un `SUPABASE_ACCESS_TOKEN` de CI aparte, así que no hereda este bloqueo | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito** (ahora en la cuenta nueva, `alvaro-7494`), que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: cinco** (raíz + cuatro) — bajó de seis, la composición volvió a cambiar. Sexta comprobación seguida sin que la hipótesis de lanzar desde la raíz se pruebe | Fuera de sesión, desde la raíz |
| 🟡 | **El guardia no ve los nombres accesibles** (`F-145`). Cazó catorce huecos de la familia y este se le escapó entero. **Decidido 5-sep-2026: se queda así** — el arreglo obvio no funciona (§1, §4) | Aceptado, no se escribe |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| 🟡 | **`F-155` deja una pregunta sin cerrar: ¿hay OTROS `SELECT` bajo RLS en funciones `security invoker` que asuman en silencio que quien llama ya tiene una clave envuelta?** `0025` corrigió los dos que se encontraron (`otra` en `create_thread_item`/`counter_offer`), pero no se ha auditado el resto de `keys.ts`/`thread-detail.ts` con esa pregunta concreta como criterio | Sin decidir — ver §3 |
| ⚪ | ~~`quantity` en `OFERTA`~~ | **Resuelto 4-sep-2026: `0021`, aplicada y verificada** |
| ⚪ | ~~Copia sin trackear de este fichero en la raíz~~ | **Resuelto 4-sep-2026: borrada, y NO ignorada a propósito** |
| ⚪ | ~~`anon` podía ejecutar cinco funciones de `public`~~ | **Resuelto 4-sep-2026: `0022`, con ancla negativa** |
| ⚪ | ~~`0023` no lo ha probado ningún cliente~~ | **Resuelto 5-sep-2026: probado con el cliente real, D-7 encendido en `Nordwälz Lager`, las tres vías de escritura — como ADMIN y como EDITOR real** |
| ⚪ | ~~Vercel no redesplegó, DOS cambios de cliente pendientes~~ | **Resuelto 5-sep-2026: `vercel --prod`, bundle en producción confirmado con `p_quantity`** |
| ⚪ | ~~Entregable 3 bloqueado: cupo de proyectos Free de Supabase agotado por `motioniq-rag`, ajeno a este repo~~ | **Resuelto 7-sep-2026: el PO lo borró desde el dashboard** (`pause_project` había fallado antes, ya hibernando). `bearingworld-e2e` creado, sembrado y probado (53/53 Playwright) — ver §1, §2 |
| ⚪ | ~~D-8 (un EDITOR no ve nada de sus compañeros) sin probar con el cliente real~~ | **Resuelto 5-sep-2026: EDITOR real, «0 hilos» con la organización ya en conversación activa** |
| ⚪ | ~~`F-151`: el paso de Vercel del *job* `deploy` bloqueado por acceso de cuenta~~ | **Resuelto 8-sep-2026: cuenta y proyecto de Vercel nuevos, verificados en CI real (`34219861643`) y con `curl` (`HTTP 200`)** — ver §1, §2, §4 |
| ⚪ | ~~Preview deployments de Vercel no ocurrían, proyecto nuevo sin Git conectado~~ | **Resuelto 10-sep-2026: `git.deploymentEnabled` en `app/vercel.json`, confirmado con push real y PR de prueba — `F-153`** |
| ⚪ | ~~Un cliente manipulado puede envolver de más hacia la CONTRAPARTE (backlog de `0023` §4)~~ | **Resuelto 10-sep-2026: `0024`, el guardia recalcula el conjunto exacto vía `thread_public_keys`. De paso salió `F-154` (tercera organización) y `F-155` (helper `security definer` para `otra`, en `0025`)** |
| ⚪ | ~~`F-152`: el CSV no distinguía «verde al primer intento» de «verde tras reintentos»~~ | **Resuelto 10-sep-2026: columna `primer_intento_limpio` en `harness-metrics.csv`, 143 filas históricas con `-`** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- ~~Si el 3 de 3 de la serie 15 se sostiene.~~ **Contestado el mismo día: no.** La réplica
  exacta dio 1 de 3. Lo que queda abierto es lo de detrás: **cuántas tiradas hacen falta para
  que este marcador signifique algo**. Con `n=3`, seis corridas dieron 4 de 6, oscilando
  entre 0 y 3 sin que el corpus cambiara. **La serie 17, primera con `n=5`, dio 5 de 5** —
  un único dato no decide si `n=5` basta, pero es la serie más limpia del proyecto hasta
  hoy. Haría falta una réplica de la 17 (misma `n=5`, mismo corpus) para saber si esta vez
  sí se sostiene, igual que se hizo con la 15 y la 16. **Réplica hecha, 10-sep (serie 18):
  el marcador final SÍ se sostiene (5/5), pero no tan limpio como la 17** — `18a` solo
  llegó verde en el intento 3 (`F-152`), las otras cuatro limpias al primer intento como
  toda la 17. Si esto cuenta como «se sostiene» o como la primera señal de que `n=5`
  necesita mirar también la tasa de reintentos, no solo el veredicto final, queda sin
  decidir.
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
- ~~Qué hay dentro de `motioniq-rag`.~~ **Ya no aplica: el PO lo borró el 7-sep (§5)**
  sin que nunca se mirara qué había dentro — la pérdida se aceptó a ciegas, y a estas
  alturas no hay nada que consultar.
- **Qué hay dentro del proyecto Vercel viejo (`bearingworld`), y si sigue existiendo.**
  El PO tomó la vía de cuenta nueva sin agotar las otras dos que `F-151` dejaba escritas
  (re-login con `aguillensp-sudo`, o invitación de quien administra `team_Dxbn...`). No
  se sabe si ese proyecto sigue vivo con sus variables de entorno intactas por si algún
  día la cuenta original vuelve a ser accesible, o si Vercel lo archiva/borra por
  inactividad. No se ha intentado averiguarlo.
- **Si `VERCEL_NEWACCOUNT_TOKEN` caduca, y cuándo.** Se generó y se usó sin comprobar su
  fecha de expiración en el dashboard de Vercel. Si tiene vencimiento por defecto, el
  *job* `deploy` volverá a fallar en algún push futuro sin que nadie lo note hasta que
  ocurra — el mismo patrón de fallo silencioso que ya costó semanas con la cuenta vieja
  (`F-151`), esta vez evitable si alguien lo comprueba antes de que pase.
- ~~Si hace falta recuperar los *Preview deployments* de Vercel para el entorno de
  ensayo.~~ **Contestado el 10-sep: se recuperaron** (`git.deploymentEnabled`, `F-153`)
  — no hizo falta decidir entre las dos opciones, se consiguieron las dos cosas:
  `bearingworld-e2e` sigue cubriendo el *job* `e2e`, y ahora también hay preview visual
  por PR.
- **Si "hilos propios de e2e" sale más barato que pagar Supabase Pro para el entregable
  3.** No medido hoy — ni el coste de tocar ~52 tests e2e existentes, ni cuánto durarían
  $25/mes siendo la solución. Es la comparación que le falta a la decisión del PO en §3.
- ~~Si el id de modelo y la región multi-UE de Vertex AI que cita
  `vera-vertex-eu-migracion.md` (de una búsqueda web del 6-sep) siguen vigentes el día
  que se ejecute la migración.~~ **Contestado el 8-sep: sí, confirmados contra
  `platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai` real** —
  `claude-sonnet-5` (GA, sin sufijo de fecha) y región multi-UE `eu`
  (`aiplatform.eu.rep.googleapis.com`). Lo que sigue sin dato es otra cosa: **cuánto va
  a tardar Anthropic en aprobar la solicitud de Model Garden** — ninguna comprobación
  de hoy lo acorta, ni siquiera a un rango.
- ~~Si el marcador verde/rojo de una corrida del harness debería distinguir «primer
  intento» de «verde tras reintentos».~~ **Contestado el 10-sep-2026 (Día 12): sí** —
  columna `primer_intento_limpio` en `harness-metrics.csv`, `si`/`no` en la fila que
  llega a `PASA`, `-` en cualquier otra. Las 143 filas históricas no se recalculan.
- **Si quedan otros `SELECT` bajo RLS, en funciones `security invoker`, que asuman en
  silencio que quien llama ya tiene una clave envuelta en el hilo.** `F-155` (10-sep)
  encontró dos —`otra` en `create_thread_item` y en `counter_offer`— corregidos en
  `0025` con `app.thread_counterpart()`. No se ha revisado el resto de `app/src/lib/`
  con esa pregunta concreta como criterio; puede haber más, o puede que estos dos
  fueran los únicos que dependían de `otra` con la fuerza suficiente para romper algo.

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
    Del Día 10: `F-151` (cerrado). Del Día 11: `F-152` (cerrado el Día 12), `F-153`
    (cerrado). Del Día 12: `F-154` (cerrado, `0024`), `F-155` (cerrado, `0025`).

---

*Día 12 de V1 · 10-sep-2026, cerrado a petición del PO tras cerrar las dos piezas del
backlog que el Día 11 dejó abiertas y recomprobar que el entregable 6 sigue bloqueado ·
fecha leída de la máquina (`date -u`) al cerrar: `2026-09-10` · bloqueo de Anthropic
recomprobado con una llamada real a `aiplatform.eu.rep.googleapis.com` (`429
RESOURCE_EXHAUSTED`, idéntico letra por letra al del cierre del Día 11) · CI del cierre
del Día 11 confirmada en verde (`gh run` `34464957453`) · `0024` y `0025` verificadas
contra un Postgres desechable (`supabase/tests/run.sh`, Docker) antes de tocar
producción, con dos asertos nuevos que disparan señalando exactamente al miembro
esperado — no solo "sigue en verde" — y aplicadas después a `troxminloxkjwihwfevs` y
`bearingworld-e2e` por el MCP, con `pg_proc` releído para confirmar las firmas nuevas ·
`get_advisors` (seguridad) sin avisos nuevos · `python -m harness.tests.test_checks`
(el comando exacto del *job* `arnes`): 22 en verde · columna `primer_intento_limpio` de
`harness-metrics.csv` verificada fila a fila contra el recuento de comas antes de
escribir, no asumida — 143 de 143 · `git status --short` releído antes de escribir este
pie: cinco ficheros modificados y dos migraciones nuevas, listos para commitear, más
`openspec/design-gui/Ingles/`, sin trackear y ajeno a esta sesión (sin cambios desde el
Día 11) · Dirección Técnica, Nortex Systems*
