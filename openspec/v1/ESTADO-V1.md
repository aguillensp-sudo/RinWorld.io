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

**Día 10 de V1 · 8-sep-2026 · Estado: CERRADO**

Sesión de un solo punto: cerrar `F-151`, el único bloqueo que dejó abierto el Día 9. El
PO tomó la tercera vía que el propio hallazgo dejaba escrita —ni recuperar la cuenta
original ni pedir invitación a quien administra el equipo viejo, sino cuenta y proyecto
de Vercel nuevos— asumiendo lo que eso pierde: el dominio `bearingworld.vercel.app` y
las variables de entorno del proyecto viejo, ninguno de los dos ya accesible para
confirmarlo.

**El primer intento fue por el camino equivocado, y se detectó antes de dejarlo correr
en serio.** El proyecto nuevo se creó con "Import Git Repository" desde el dashboard de
Vercel, no con `vercel link`: esa vía conecta el disparador propio de Vercel por push,
redundante con el *job* `deploy` de la CI y sin su puerta de tests. Y desplegó `main`
(congelada en `43bb222` desde el 4-ago), no `mvp/bootstrap`, donde vive todo el trabajo
de V1 — lo que llegó a verse en el dashboard no era el producto, era una foto de hace
más de un mes. Detectado por la propia evidencia que el PO pegó (pantalla del
deployment, rama `main`, commit `43bb222`), antes de tocar nada de CI. Git integration
desconectado antes de seguir.

**Segundo hueco, no del PO sino de esta sesión: un token solo no iba a bastar.**
`app/.vercel/project.json` fija `orgId`/`projectId` de un proyecto, pero ese fichero
está en `.gitignore` desde que existe —es estado local de quien enlaza— y el *job*
`deploy` corre sobre un checkout limpio que nunca lo tuvo. Nunca se notó porque los
cuatro intentos de `F-151` fallaban antes, en el login. Con la cuenta nueva hacía falta
además el `orgId`/`projectId` reales: resuelto con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`
como env vars del *step* —alternativa que la propia CLI de Vercel documenta a
`vercel link`—, sin `--scope` (ya no hace falta con las dos puestas).

**Cambios:** `ci.yml` quita `--scope team_DxbnTcPjK55GRxmJiMm4YUsp` (equipo muerto),
añade `VERCEL_ORG_ID: team_R5unqkZcbV5BDvmyQsS9t64x` y
`VERCEL_PROJECT_ID: prj_ybo4kVtQJcL0ZbhrI3qhzIVe5GUP` literales —no son secretos, son
identificadores, igual que antes iba `team_...` literal en `--scope`— y apunta
`VERCEL_TOKEN` al secreto `VERCEL_NEWACCOUNT_TOKEN`, creado por el PO desde su propia
terminal y nunca pegado en el chat, la misma regla que ya regía para `SUPABASE_TOKEN`.
Secreto muerto `NEW_VERCEL_TOKEN` (cuenta vieja) borrado. `entornos.md`, `CLAUDE.md`
§10.2 y `findings-register.md` (`F-150`, `F-151`) actualizados para que ninguno de los
tres siga citando la cuenta o los nombres de secreto viejos.

**Verificado en CI real, no solo desplegado (regla 2):** push a `mvp/bootstrap`
(`5532789`), `gh run` `34219861643` — los cinco *jobs* en verde, incluido `deploy`.
Alias `https://rin-world-io.vercel.app` confirmado con `curl`, `HTTP 200`. Entregable 2
de Fundación V1 (despliegue continuo) queda **cerrado del todo**: VERA y Vercel, los dos
verdes en CI real, ninguno de los dos a medias.

El detalle del Día 8 completo (D-7/D-8 con el cliente real, serie 17, el guardia
decidido que no) vive en `git show 591ea20:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-08` |
| Causa exacta de `F-151`, releída antes de tocar nada | `app/.vercel/project.json` (`orgId` con forma `team_...`) + el propio hallazgo | Confirma que el bloqueo era de acceso de cuenta, no de ningún token — coincide con lo ya escrito el 7-sep |
| Si `app/.vercel/project.json` llega al runner de CI | `git ls-files app/.vercel/`, `.gitignore` | Vacío — no se comitea, es estado local de quien enlaza. El *job* `deploy` nunca tuvo forma de resolver el proyecto sin `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; hueco no visto antes porque los cuatro intentos previos de `F-151` fallaban en el login, antes de llegar aquí |
| El primer deployment del proyecto nuevo (pantalla que pegó el PO) | Lectura directa de la pantalla: dominio, rama, commit | `main` @ `43bb222` — la rama congelada desde el 4-ago, no `mvp/bootstrap`. Viene de "Import Git Repository", que conecta el disparador propio de Vercel por push |
| Si ese disparador seguía activo tras pedir desconectarlo | Confirmación directa del PO | Desconectado, Project Settings → Git |
| `ci.yml` tras el cambio (sin `--scope`, con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` literales, secreto renombrado) | `python -c "import yaml; yaml.safe_load(...)"` | YAML válido |
| Secretos de GitHub tras el cambio | `gh secret list` antes y después de `gh secret delete NEW_VERCEL_TOKEN` | Antes: `NEW_VERCEL_TOKEN` (muerto, cuenta vieja) y `VERCEL_NEWACCOUNT_TOKEN` (nuevo, puesto por el PO desde su terminal) los dos presentes. Después: solo `VERCEL_NEWACCOUNT_TOKEN` |
| El *job* `deploy`, primera corrida real contra la cuenta nueva | `gh run watch 34219861643` + `gh run view --json jobs` | Los cinco *jobs* en verde: `schema`, `app`, `e2e`, `arnes`, `deploy` |
| El paso "App a Vercel (producción)" en concreto, no solo el *job* entero | `gh run view --log` sobre ese *step* | `Production https://rin-world-rejdpdrak-ring-world.vercel.app`, `▲ Aliased https://rin-world-io.vercel.app` — sin error, primera vez que este paso termina sin `"User not found"` |
| Si la URL de producción sirve de verdad, no solo que Vercel dice que desplegó | `curl -s -o /dev/null -w "%{http_code}"` contra `https://rin-world-io.vercel.app` | `HTTP 200` |

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
| Entregable 2 · despliegue continuo | ✅ **HECHO — 8-sep** — VERA y Vercel, los dos verdes en CI real (`gh run` `34219861643`). `F-151` cerrado: cuenta y proyecto de Vercel nuevos, ver §4/§5 |
| Entregable 1 · tres entornos como código | ✅ **HECHO — 7-sep** — `entornos.md`, producción y ensayo/staging reales, los dos con `environment:` de GitHub |
| Entregable 3 · aislamiento de demo/e2e | ✅ **HECHO — 7-sep** — el PO borró `motioniq-rag`; `bearingworld-e2e` creado, sembrado y probado (53/53 Playwright) antes de conectar CI. Cierra `F-149` de raíz, no solo la regla de proceso |
| Entregable 6 · residencia europea (VERA) | 🟡 **6-sep, runbook listo** — `vera-vertex-eu-migracion.md`, sin aplicar al código real; falta el proyecto GCP |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

Con el entregable 2 cerrado hoy, lo que queda abierto de Fundación V1 para el Día 11 es
exactamente lo que ya estaba pendiente el 7-sep — la sesión de hoy fue de un solo punto
y no tocó nada de esto:

1. **Entregable 6, con el proyecto GCP todavía por crear.** El runbook
   (`vera-vertex-eu-migracion.md`) está listo; en cuanto exista el proyecto GCP, aplicar
   el diff de código ahí descrito, siguiendo el orden de corte de su §4.
2. **Decisión del PO: ¿réplica de la serie 17?** Sigue sin decidirse, solo aplazada.
   Mismo `n=5`, mismo corpus de `MSG-01` (sin tocar desde el 5-sep). Implica gasto real
   (~$0,34) — no se lanza sin que lo digas.
3. **Del backlog de `§5`, sin decidir:** si el guardia de `0023` aprende a recalcular el
   reparto ENTERO de claves en cada escritura. Ninguna prisa: está declarado, no tapado.
4. **Del 7-sep, sin decidir:** el proyecto aislado (`bearingworld-e2e`) hoy solo tiene la
   siembra base. Falta decidir si el catálogo completo de 200+ líneas del proyecto
   principal (el que ve un socio real en la demo de venta) también se replica aquí, o si
   los 221 renglones que ya trajo el entregable 3 (mismos que `SRCH-01`/`INV-01`
   necesitan para pasar) bastan para lo que este proyecto tiene que hacer.
5. **Nuevo, del 8-sep:** `entornos.md` describía el entorno de ensayo/staging de Vercel
   como "Preview deployments (automático por rama/PR)" — con el proyecto nuevo SIN Git
   conectado (a propósito, para no duplicar el *job* `deploy`, ver más abajo), eso ya no
   ocurre. Nadie parece haber usado esas *preview URLs* de Vercel hasta donde consta en
   este fichero, así que no bloquea nada hoy, pero **queda sin decidir** si hace falta
   recuperarlas (Vercel permite Git conectado solo para Preview, sin tocar Production) o
   si el *job* `e2e` contra `bearingworld-e2e` ya cubre lo que un preview daría.

Fuera de sesión, siguen sin moverse: `F-073` (re-loguear la CLI de Supabase), la
pregunta de alcance del entregable 5 (`FUNDACION-V1.md`), y los worktrees (§5) —
ninguno bloquea trabajo de ingeniería.

### Lo que se cerró hoy (Día 10, 8-sep)

- **`F-151` cerrado.** Cuenta y proyecto de Vercel nuevos (`alvaro-7494` / `rin-world-io`),
  `ci.yml` apuntado con `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` literales en vez de
  `--scope`, verificado en CI real (`gh run` `34219861643`) y con `curl` (`HTTP 200`).
- **Entregable 2 (despliegue continuo) queda cerrado del todo.** VERA y Vercel, los dos
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

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **El riesgo de la salida abrupta ya no se pierde, se CONCENTRA en el ADMIN.** Con Q-1 cerrada, la consecuencia 7.1 desaparece porque el ADMIN conserva copia de todo — y por eso el día que el ADMIN se vaya de golpe o pierda su frase, la organización pierde lo único que quedaba. La recomendación (más de un ADMIN) **tiene que llegar a la interfaz**, no quedarse en el ADR | Producto, cuando se diseñe el alta de miembros |
| 🟠 | **La residencia sigue siendo el entregable con reloj, pero ya con runbook.** `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com` — el diff de código y los pasos de GCP están en `vera-vertex-eu-migracion.md`, sin fecha puesta porque falta el proyecto GCP | Álvaro: crear el proyecto GCP |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando. **Nota 6-sep:** el *job* `deploy` nuevo usa un `SUPABASE_ACCESS_TOKEN` de CI aparte, así que no hereda este bloqueo | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito** (ahora en la cuenta nueva, `alvaro-7494`), que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Nuevo, 8-sep:** con el proyecto Vercel nuevo sin Git conectado (a propósito, ver `F-151`), `entornos.md` ya no describe bien el entorno de ensayo — decía "Preview deployments automático por rama/PR" para Vercel y eso dejó de pasar. Sin decidir si hace falta recuperarlo o si `bearingworld-e2e` (staging de Supabase) ya cubre la necesidad | Sin decidir, ver §3 |
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
| ⚪ | ~~`F-151`: el paso de Vercel del *job* `deploy` bloqueado por acceso de cuenta~~ | **Resuelto 8-sep-2026: cuenta y proyecto de Vercel nuevos, verificados en CI real (`34219861643`) y con `curl` (`HTTP 200`)** — ver §1, §2, §4 |

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
- **Si hace falta recuperar los *Preview deployments* de Vercel para el entorno de
  ensayo.** Ver §3 punto 5 y §5 — no se ha decidido ni medido si `bearingworld-e2e`
  (staging de Supabase, sin Vercel de por medio) ya cubre lo que un preview daría.
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
    Del Día 10: `F-151` (cerrado).

---

*Día 10 de V1 · 8-sep-2026, cerrado a petición del PO tras dejar `F-151` resuelto y
verificado, sin nada suelto detrás · fecha leída de la máquina (`date -u`) dos veces, al
abrir y al cerrar · estado verificado contra `gh run` `34219861643` job a job (los cinco
en verde, incluido `deploy`), contra el log real del paso "App a Vercel (producción)"
(`▲ Aliased https://rin-world-io.vercel.app`, sin `"User not found"` por primera vez),
contra `curl` a esa URL (`HTTP 200`), contra `gh secret list` antes y después de borrar
`NEW_VERCEL_TOKEN`, y contra `python -c "import yaml; yaml.safe_load(...)"` sobre
`ci.yml` — no contra otro documento · `git status --short` releído antes de escribir
este pie: solo los ficheros que esta sesión tocó (`ci.yml`, `entornos.md`, `CLAUDE.md`,
`findings-register.md`, este fichero) · Dirección Técnica, Nortex Systems*
