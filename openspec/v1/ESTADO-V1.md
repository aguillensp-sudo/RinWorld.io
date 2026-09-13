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

**Día 12 de V1 · 10-sep-2026 · Estado: CERRADO.** Dos puntos del backlog de `0023` §4 cerrados a petición del PO — `0024` (`F-154`, reparto exacto hacia la CONTRAPARTE) y `0025` (`F-155`, `app.thread_counterpart` `security definer`) — más `F-152` (columna `primer_intento_limpio` en el CSV del arnés). El entregable 6 se recomprobó y sigue bloqueado en Anthropic Model Garden (`429 RESOURCE_EXHAUSTED`), sin movimiento posible desde el repo. El detalle completo vive en `git show 29520f3:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

**Día 13 de V1 · 10-sep-2026 · Estado: CERRADO.** Sesión de un solo punto: la pregunta
que `F-155` dejó abierta el Día 12 —*"¿hay OTROS `SELECT` bajo RLS con el mismo patrón en
el resto de `app/src/lib/`?"*— auditada contra las cinco llamadas RPC que tocan claves o
hilos. Sí había un tercero: el guardia *"ya has consultado"* de `create_inquiry`, que se
saltaba en silencio para cualquier EDITOR sin clave en el ítem de la consulta previa —
cerrado en `0026` (`F-156`), verificado contra un Postgres desechable ANTES de escribir la
migración y aplicado a las dos bases. El entregable 6 no se recomprobó ese día, a
propósito. El detalle completo vive en `git show 1c4e1ac:openspec/v1/ESTADO-V1.md`, no se
repite aquí.

---

**Día 14 de V1 · 11-sep-2026 · Estado: CERRADO.** Cerrada la familia `F-148`/`F-155`/`F-156`
por el lado que faltaba —disparadores, políticas y función Edge—, sin hallazgo y anclada con
cuatro asertos y una canaria. A petición del PO: plan releído contra el repo (semana 3, la
del H1), escrito `UMBRAL-FABRICA-V1.md` —el umbral que la tabla de riesgos exige "de
antemano" y no existía—, y confirmadas las tres pantallas del H1 (`DIR-01`, `ADMIN-01`,
`FORO-01`) antes de que existiera una línea de código de ninguna. Las tres capas de datos
escritas a mano, verificadas y sembradas (`0027`, `0028`, `0029`): paso 2 del hito cerrado.
Tres hallazgos: `F-157` (el medidor de coste borraba su propia historia, cerrado), `F-158`
(la spec de `ADMIN-01` se contradice a sí misma —**abierto, es del PO**) y `F-159` (un e2e
que falla por carrera, cerrado). El Operador de Plataforma existe de verdad en las dos
bases: cuenta, alta, rama de sesión, alcance comprobado desde su propia sesión. El detalle
completo —las seis adendas del día— vive en `git show f5e1d7e:openspec/v1/ESTADO-V1.md`, no
se repite aquí.

---

**Día 15 de V1 · trabajo 11-sep-2026, cierre redactado 13-sep-2026 · Estado: CERRADO**

> **EL DÍA EN OCHO LÍNEAS.**
>
> 1. **Sesión nueva, arrancando exactamente donde dejó el Día 14:** el paso 3 de
>    `UMBRAL-FABRICA-V1.md` §7, las tres tareas en formato fijo.
> 2. **`F-160`, cazado antes de gastar un token.** `--seco` escalaba en FALSO en las SEIS
>    tareas del corpus —`DIR-01` incluida, y confirmado también contra `SRCH-01`, de hace
>    semanas— desde que `F-152` sumó `primer_intento_limpio` al CSV sin que `dry_run.py` lo
>    supiera. Cerrado el mismo día.
> 3. **`DIR-01` escrita, con sus tests, `--seco` limpia.** Precondición descubierta y resuelta
>    primero: "Empresas" no tenía ninguna ruta real en `App.tsx` a la que el e2e pudiera
>    llegar.
> 4. **`ADMIN-01`, y con ella un hallazgo de arquitectura, no solo de esquema.** El Operador
>    no encaja en `AppShell` —nav de cinco ítems propios y acento brass (spec §2), un
>    `OperatorProfile` sin organización—. Nuevo `OperatorShell.tsx`, sin tocar `AppShell.tsx`
>    ni sus 147 líneas de tests.
> 5. **Segundo hallazgo de `ADMIN-01`: el mock promete un email que nadie envía.** Aprobar y
>    Rechazar no disparan ningún correo —no hay proveedor configurado en todo el proyecto—, y
>    el texto de confirmación se corrigió para no afirmarlo (mismo principio que `F-100`).
> 6. **`FORO-01` escrita**, la más simple de las tres —un solo fichero, misma forma que
>    `PANEL-01`—. Con esto, el paso 3 del §7 queda completo: nueve tareas en el corpus, las
>    tres del H1 listas para correr.
> 7. **La corrida real sigue sin poder pasar en esta sesión.** `DEEPSEEK_API_KEY` vive en el
>    entorno local del PO (`C:\Users\admin\...`), nunca en esta sesión remota —comprobado con
>    `uname`/`mount` contra el propio contenedor, no supuesto ni discutido de oídas—. El paso
>    5 del §7 (las tres corridas, C5 y el veredicto) queda para una sesión con esa clave a
>    mano.
> 8. **Este fichero se cierra dos días después de escribirse el trabajo**, por una
>    interrupción de la conversación, no porque el día se alargara —regla 4 de este fichero,
>    y va anotado porque es justo el tipo de desfase que la regla 3 pide no maquillar.
>
> **Lo que toca a continuación no es trabajo de esta sesión:** las tres corridas, cada una en
> el entorno local del PO y en su propia sesión limpia. Ver §3.

**`F-160`, en detalle.** `harness/tests/dry_run.py` comprueba desde el día 4 que ninguna fila
del CSV quede marcada como escalada con `[f for f in filas if ",si," in f]` —un substring de
la LÍNEA ENTERA—. El 10-sep (`F-152`) `primer_intento_limpio` se sumó a `metrics.COLUMNS`
justo detrás de `corrida` y delante de `resultado`, y una corrida limpia al primer intento
escribe esa columna en `si` aunque `escalado_a_humano` sea `no`: la fila sale
`...,no,-,-,si,PASA...` y el substring la encuentra igual. Reproducido primero contra
`SRCH-01.json` para confirmar que no era nada de `DIR-01`: el propio arnés llevaba un mes
roto en cuanto `metrics.COLUMNS` creció. Arreglado con `_columna()`, que lee el CSV con el
módulo `csv` de la librería estándar y busca por NOMBRE, no por substring. Verificado con
`python -m harness.tests.dry_run` (los tres escenarios A/B/C en verde) y con `--seco` sobre
`DIR-01`/`ADMIN-01`/`FORO-01` y de nuevo sobre `SRCH-01`. Misma familia que `F-033`/`F-129`:
un cambio en el contrato de columnas de un fichero compartido rompió una comprobación en
otro que nadie reconectó.

**`DIR-01`, escrita cruzando la tarea con lo que el repo YA tenía, no solo con la spec.**
`harness/tasks/DIR-01.json`: `style_reference` es `ResultsTable.tsx` —mismo patrón de
cabecera ordenable con un `<button>` dentro del `<th>`—, `data_layer` es `directory.ts`
—entregada el Día 14—, y `component_api` fija cada literal verbatim, con cuidado explícito de
no confundir el `...` ASCII del placeholder del buscador con el `…` unicode de "Cargando
directorio…". La precondición que hizo falta antes de poder escribir el e2e: `App.tsx` no
tenía ninguna rama para "Empresas" —C2 corre SIEMPRE la suite de Playwright entera (D-09-03
a), así que sin esto el e2e de hoy habría tumbado cualquier corrida futura de `ADMIN-01` o
`FORO-01` por un fichero que no es el suyo—. Resuelto con un `Directory.tsx` de marcador
(mismo patrón que la rama del Operador del Día 14). Validada `--seco`: cero problemas, cero
avisos.

**`ADMIN-01`: el hallazgo de arquitectura, completo.** ADMIN-01 §2 dice que el Operador
"tiene su propia vista de navegación", y el HTML aprobado lo confirma con cinco ítems propios
(`Panel`/`Solicitudes`/`Organizaciones`/`Log de auditoría`/`Sistema`) y acento BRASS, no los
ocho ítems azules del shell de un miembro. Y un `OperatorProfile` (`session.ts`) no tiene
`orgName` ni `role`: `AppShell` está tipado a `MemberProfile` y los usa en tres sitios
(nav-right, sidebar, avatar). Reusarlo habría significado tocar un componente compartido con
su propia suite de pruebas por una pantalla que ni siquiera pertenece a una organización.
`OperatorShell.tsx` es NUEVO —`AppShell.tsx` queda intacto, con sus tests intactos—: importa
`AppShell.module.css` para todo lo que el sistema base ya fija igual entre las dos vistas
(brand bar, nav, sidebar overlay, `bwcnt`) y suma un módulo propio de quince líneas solo para
las dos reglas de acento que de verdad cambian, más la píldora "Operador" del mock. `VeraPanel`
se reutiliza sin `agent` —el cableado VERA↔herramientas del Operador no existe todavía, y
`VeraPanel` ya sabe decir que no está conectada cuando se monta así—. Doce pruebas nuevas en
verde. `App.tsx`: el bloque `operator` deja de ser un `<div>` de marcador inline y pasa a
`<OperatorShell><AdminRequests .../></OperatorShell>`; el `data-testid="operator-home"` —ancla
del e2e desde el Día 14— se muda a `OperatorShell`.

**Y el segundo hallazgo, sobre el propio contenido.** El HTML aprobado y la spec §3/§6 dicen
que Aprobar/Rechazar "envían" los correos EML-07/EML-08, y el mock lo confirma en el panel
tras aprobar: *"Aprobación registrada. Email EML-07 enviado al solicitante."* **Ningún envío
de correo existe en el proyecto** —ni en `admin-requests.ts`, ni en ninguna Edge Function, ni
ningún proveedor configurado en `CLAUDE.md`—. Pintar que se envió un email que nadie envía es
la pantalla afirmando algo falso, la misma clase de riesgo que `CLAUDE.md` §7 describe para
VERA. `harness/tasks/ADMIN-01.json` corrige los dos textos a "Aprobación registrada." y
"Solicitud rechazada.", sin mencionar ningún email —mismo principio que `F-100` en `SRCH-01`,
escrito antes de que exista una línea de código—.

Dos ampliaciones a `admin-requests.ts` (ya entregada el Día 14, ahora con 22 pruebas en vez de
18): `requestDateLabel` —"DD Mmm YYYY · HH:MM", reusando el mismo `Intl.DateTimeFormat` de
`sentAtLabel`/`dateLabel`, no un tercer formato— y `websiteHref` —antepone `https://` a un
dominio del FSR sin esquema, para que el enlace de la tabla sea externo y no relativo a la
propia pantalla—. `harness/tasks/ADMIN-01.json` validada `--seco`: cero problemas, cero
avisos. El e2e (`admin-requests.spec.ts`) es DE SOLO LECTURA a propósito: aprobar, rechazar o
devolver a revisión de verdad dejaría `demo_registration_requests.sql` descuadrada, porque no
hay ningún `teardown` que la reponga entre corridas de Playwright —al contrario que la
siembra de mensajería—; el camino de escritura ya está cubierto con mocks en
`AdminRequests.test.tsx`.

**`FORO-01`, la más simple de las tres.** Sin filtros, sin orden, sin acciones: un único
fichero (`Forum.tsx` + su CSS Module), misma forma que `PANEL-01`. `component_api` fija el
aviso de confidencialidad como PERMANENTE (spec §7, "no es opcional ni ocultable"), los dos
formatos de tiempo relativo que `forum.ts` ya distingue (`relativeShort` para la lista de
recientes, `relativeLong` para la tarjeta —no son intercambiables—), y que ninguna tarjeta
necesita un estado vacío especial para "foro recién lanzado": con cero hilos,
`fetchCategories()` sigue devolviendo las cuatro filas a cero —ya resuelto por la vista
`forum_category_stats`—, así que inventar una rama nueva habría sido inventar un requisito
que la capa de datos ya cubre. El e2e comprueba, contra la siembra real de `demo_forum.sql`,
que el hilo más reciente de la actividad real NO lleva la organización autora que el HTML
aprobado le atribuye —el mock dice "Rodamientos del Sur SL"; la siembra real es "Rodamientos
Ibéricos"—. Validada `--seco`: cero problemas, cero avisos. Requirió su propia precondición
de wiring ("Foros" → `Forum` de marcador), mismo patrón que `DIR-01`.

**El límite del entorno, aclarado sin ambigüedad.** El PO dio por hecho que esta sesión veía
`C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\app\.env`, de donde sale
`DEEPSEEK_API_KEY`. Comprobado contra la propia máquina —`uname -a` (Linux, contenedor
`vm`), `mount` (raíz en `/dev/vda`, un disco propio; ningún volumen de red ni de Windows)—,
no contra lo que "los agentes" hicieran en otras sesiones: esta corre en un contenedor remoto
en la nube, clonado desde GitHub al arrancar, sin ningún canal hacia el portátil del PO. Las
sesiones que sí ven esa ruta son Claude Code local, instalado y lanzado directamente en esa
máquina Windows —es su propio disco, no un permiso—. Sin la clave aquí, el paso 5 del §7 no
puede correr en esta sesión bajo ninguna circunstancia; lo que sí puede es lo que se hizo:
escribir y validar en seco las tres tareas.

**Coste-sombra al cierre:** `python -m harness.core.orchestration_metrics` corrido dos veces
—a mitad de sesión (tras `DIR-01`) y al cerrar—. Cierre: **1.055,62 $** acumulados; el
11-sep entero (Día 14 + Día 15, misma fecha de calendario) pasa de 148,75 $ a **206,60 $**,
así que esta sesión sola son **57,85 $** —sin ninguna corrida real, solo escribir y validar
tres tareas—. Las 21 filas anteriores al Día 14 siguen intactas (`F-157`).

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-11` durante el trabajo (commits, 15:48–19:44 UTC); `2026-09-13` al redactar este cierre — la sesión de chat se interrumpió dos días, el trabajo no se alargó (ver Día 15, punto 8) |
| El cierre del Día 14 llegó a `origin` y su CI acabó en verde | `mcp__github__actions_get`/`actions_list` sobre el run del push, no el mensaje del commit | Run `34618286746` sobre `f5e1d7e`: `success`, los CINCO jobs (arnés, app, esquema, Playwright, despliegue continuo app+VERA) |
| Que la rama asignada a esta sesión (`claude/amazing-hawking-q7pm45`) tuviera el trabajo de V1 | `git log`, `git merge-base` contra `origin/main` y `origin/mvp/bootstrap` | **No.** Anclada a `43bb222`, el `main` de antes de todo V1 — exactamente el patrón `F-108` que este mismo fichero describe en su aviso de cabecera. Se cambió a trabajar sobre `mvp/bootstrap`, con permiso explícito del PO |
| Que `--seco` escalaba en falso (nuevo, `F-160`) | `python -m harness.graph.run harness/tasks/DIR-01.json --seco`, y el mismo comando contra `SRCH-01.json` para descartar que fuera cosa de la tarea nueva | Las dos crasheaban con `AssertionError: no deberia haber ninguna fila marcada como escalada` — la causa vive en `dry_run.py`, no en ninguna tarea |
| La causa exacta de `F-160` | Corrida manual del grafo con el CSV real, leyendo la fila byte a byte | `...,no,-,-,si,PASA...` — el `,si,` de `primer_intento_limpio` (columna añadida por `F-152` el 10-sep) cae justo donde el detector de escalado buscaba el suyo |
| Que el arreglo de `F-160` funciona y no rompe nada más | `python -m harness.tests.dry_run` (los tres escenarios A/B/C) y `--seco` sobre `DIR-01`, `ADMIN-01`, `FORO-01` y de nuevo `SRCH-01` | Los cinco, verdes |
| La tarea `DIR-01`, formato fijo | `--seco` | `[DIR-01] tarea valida: 8 inputs, 4 outputs, component_api cubre cada .tsx, ficheros de aceptacion en su sitio` — cero avisos |
| La tarea `ADMIN-01`, formato fijo | `--seco` | `[ADMIN-01] tarea valida: 8 inputs, 6 outputs...` — cero avisos |
| La tarea `FORO-01`, formato fijo | `--seco` | `[FORO-01] tarea valida: 8 inputs, 2 outputs...` — cero avisos |
| Que ADMIN-01 encajara en `AppShell` tal cual | Spec `ADMIN-01` §2, el HTML aprobado (nav propio de cinco ítems, acento brass) y los tipos de `session.ts` (`OperatorProfile` sin `orgName`/`role`) contra las props de `AppShell.tsx` | **No.** `AppShell` está tipado a `MemberProfile` y usa `orgName` en tres sitios. Motivó `OperatorShell.tsx` nuevo |
| Que `AppShell.tsx` y sus tests quedaran intactos tras crear `OperatorShell` | `git diff -- app/src/shell/AppShell.tsx app/src/shell/AppShell.module.css` | Vacío — cero líneas tocadas |
| `OperatorShell.tsx` | `npx tsc --noEmit` y `npx vitest run src/shell/OperatorShell.test.tsx` | Typecheck limpio, 12 pruebas nuevas en verde |
| Que algún envío de correo (EML-07/EML-08) exista en el proyecto | Lectura de `admin-requests.ts`, `supabase/functions/` entera y `CLAUDE.md` | Ninguno. Cero proveedores de correo configurados en ningún sitio del repo — el texto de confirmación de `ADMIN-01` se corrigió para no afirmarlo |
| `admin-requests.ts` ampliada (`requestDateLabel`, `websiteHref`) | `npx vitest run src/lib/admin-requests.test.ts` | 22 pruebas en verde (18 + 4 nuevas) |
| El wiring de "Empresas" y "Foros" en `App.tsx`, antes de escribir cualquier e2e | `npx tsc --noEmit` y `npx vitest run` sobre la suite entera, tras cada wiring | Typecheck limpio; suite existente sin ninguna regresión en los dos puntos |
| El estado de la app tras las tres tareas nuevas | `npx tsc --noEmit` (repo entero) y `npx vitest run` (repo entero) | Typecheck: solo los tres `Cannot find module` esperados (`DirectoryTable`, `RequestsTable`, `RequestDetailPanel` — no los escribe esta sesión). Vitest: **712 pruebas en verde, 36 en rojo contra los marcadores de las tres pantallas (esperado), 23 saltadas** |
| Que `DEEPSEEK_API_KEY` esté disponible en esta sesión (afirmado por el PO, `app/.env` local) | `uname -a`, `mount`, `ls /` sobre esta misma máquina | **No.** Contenedor Linux (`vm`), raíz en `/dev/vda` propio, sin ningún volumen de red ni de Windows. Sin canal hacia `C:\Users\admin\...` |
| Coste de orquestación, antes y después de esta sesión | `python -m harness.core.orchestration_metrics`, corrido a mitad de sesión (tras `DIR-01`) y otra vez al cerrar | 997,77 $ → 1.018,06 $ → **1.055,62 $**. El 11-sep entero (Día 14 + Día 15) pasa de 148,75 $ a **206,60 $**: esta sesión sola, **57,85 $**, sin ninguna corrida real |
| Divergencia con `origin/mvp/bootstrap` antes de escribir este cierre | `git fetch origin mvp/bootstrap` + `git status -sb` | Sin desfase — nadie más ha tocado la rama desde el último push de esta sesión |
| CI de los commits de esta sesión | `mcp__github__actions_list` sobre `mvp/bootstrap` | El primer push (harness fix + tarea `DIR-01` + métricas) SÍ corrió: `failure` en `App · typecheck` — rojo esperado y por diseño, sin `[skip ci]` por un descuido (corregido en los push siguientes). Los cuatro commits de `OperatorShell`/`ADMIN-01`/`FORO-01` llevan `[skip ci]` en el commit de cabeza de cada push: **GitHub no llegó a arrancar ningún run** — verificado con `actions_list`, sigue siendo el run `34637176421` el más reciente. Lo verde de esos cuatro commits es SOLO la verificación local (typecheck + vitest de arriba), no CI |
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
| Entregable 6 · residencia europea (VERA) | 🟠 **11-sep, recomprobado con llamada real: mismo `429`. Infraestructura GCP creada y verificada el 10-sep** (proyecto, facturación, API, cuenta de servicio — §1) — bloqueada en la aprobación de Anthropic (Model Garden), `429 RESOURCE_EXHAUSTED` en cada comprobación, sin fecha. Código (`vera/index.ts`) sin tocar, a propósito |

### Corriente B · Fábrica — NO ABIERTA, con el paso 3 del §7 completo

Se abre cuando la corriente A publique los contratos de datos, y esa condición se cumplió el
11-sep: `0027`/`directory.ts`, `0028`/`admin-requests.ts` y `0029`/`forum.ts`, verificadas y
sembradas en las dos bases. Y tiene su vara de medir, `UMBRAL-FABRICA-V1.md`, escrita antes
de medir.

**El Día 15 completó el paso 3: las tres tareas en formato fijo** —`DIR-01`, `ADMIN-01`,
`FORO-01`, las nueve del corpus— **, cada una validada con `--seco` (cero problemas, cero
avisos).** Lo único que falta para abrir la corriente son las tres corridas (§3, paso 5), y
**esta vez la dependencia no es de nadie externo al proyecto, sino de dónde vive
`DEEPSEEK_API_KEY`:** en el entorno local del PO, no en una sesión remota (Día 15,
comprobado con `uname`/`mount`, no supuesto). Las corridas no dependen de ninguna
aprobación ni de ningún tercero — dependen de correrlas en la máquina que tiene la clave.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

**El H1 sigue siendo lo único con acción propia en el repo. De los cinco pasos de
`UMBRAL-FABRICA-V1.md` §7, cuatro están hechos y el quinto tiene una dependencia real, no de
aprobación sino de máquina:**

| | Paso | Estado |
|---|---|---|
| 1 | El PO confirma las tres pantallas | ✅ **11-sep** · `DIR-01`, `ADMIN-01`, `FORO-01` |
| 2 | Las tres capas de datos, a mano | ✅ **11-sep** · `0027`, `0028`, `0029` |
| 3 | Las tres tareas en formato fijo | ✅ **11-sep (Día 15)** · las nueve del corpus, `--seco` limpias |
| 4 | Línea base del coste de orquestación | ✅ **11-sep** · y de ahí salió `F-157` |
| 5 | **Las tres corridas, su revisión y el C5** | 🔴 **Es lo único que queda** |

1. **Correr las tres tareas** —`DIR-01`, `ADMIN-01`, `FORO-01`, en ese orden: `DIR-01` sigue
   siendo la única comparable con algo ya medido (`SRCH-01`/`INV-01`)— **en el entorno LOCAL
   del PO**, donde vive `DEEPSEEK_API_KEY`. Esta sesión remota no puede: comprobado con
   `uname`/`mount` contra el propio contenedor, no supuesto (Día 15).
2. **El C5 de cada una**, a mano, del PO.
3. **El veredicto**, con las ocho cifras, en §1 y contra la regla de decisión del umbral §4.

⚠ **CADA CORRIDA VA EN SESIÓN LIMPIA, y el medidor de orquestación se corre ANTES y
DESPUÉS.** No es ceremonia: la cifra 7 del umbral —la que decide si la partida de modelos
del plan se sostiene— se mide por sesión, así que una sesión compartida le imputa a la
pantalla un coste que no es suyo. **La sesión del Día 14, sin construir ninguna pantalla,
costó 148,75 $; la del Día 15, escribiendo las tres tareas sin correr ninguna, 57,85 $**
—ninguna de las dos es la cifra 7 de ninguna pantalla, y el umbral pone su techo en 50 de
mediana. Si las tres corridas se escriben Y se corren en la MISMA sesión (lo que el propio
§7 pide), la cifra 7 de cada una sale limpia; si se corren en una sesión que ya trae encima
el coste de escribir la tarea, no.

En paralelo, sin acción propia desde este lado:

- **Entregable 6: esperar la aprobación de Anthropic (Model Garden), sin ETA.** Recomprobado
  el 11-sep con llamada real: mismo `429 RESOURCE_EXHAUSTED`. **No tocar `vera/index.ts`.**
- **`F-158`, del PO:** la spec de `ADMIN-01` dice *"naranja si > 24h"* y pinta en naranja una
  solicitud de 18 horas. El código sigue la regla y lo dice en voz alta, así que no bloquea
  nada; corregir la spec es suyo.

Fuera de sesión, sin moverse: `F-073` (re-loguear la CLI de Supabase) y el plan de pago de
Vercel — ninguno bloquea trabajo de ingeniería.

### Lo que se cerró el Día 15 (trabajo 11-sep, redactado 13-sep)

- **`F-160` cerrado.** `--seco` escalaba en falso en las seis tareas del corpus por una
  columna del CSV (`primer_intento_limpio`, `F-152`) que `dry_run.py` no sabía leer.
  Arreglado leyendo el CSV por nombre de columna, no por substring de la línea.
- **Las tres tareas del paso 3 escritas, con sus tests de aceptación, y validadas `--seco`**:
  `DIR-01`, `ADMIN-01`, `FORO-01`. Corpus de seis a nueve tareas.
- **`OperatorShell.tsx` nuevo**, porque el Operador no encaja en `AppShell` (nav propio,
  `OperatorProfile` sin organización). `AppShell.tsx` y sus tests, intactos.
- **Hallazgo sobre `ADMIN-01`: ningún envío de correo existe en el proyecto.** El texto de
  confirmación de Aprobar/Rechazar se corrigió para no afirmar un email que nadie manda.
- **Aclarado sin ambigüedad: esta sesión remota no ve `C:\Users\admin\...`.** El PO dio por
  hecho lo contrario; comprobado contra la propia máquina (`uname`, `mount`), no discutido
  de oídas. Las tres corridas del paso 5 necesitan el entorno local.
- **Siete commits en `mvp/bootstrap`**: el de la tarea `DIR-01` salió rojo por diseño SIN
  `[skip ci]` —se me olvidó, primer descuido de la sesión—; corregido desde `ADMIN-01` en
  adelante, con `[skip ci]` en los dos commits de tarea que quedaban. Ver §1.

### Lo que se cerró el Día 14 (11-sep)

- **Contestada la última pregunta abierta de la familia `F-155`, y la respuesta es que no
  hay nada que arreglar.** Auditados contra el criterio exacto —un `SELECT`/`EXISTS` bajo
  RLS dentro de código `security invoker` cuyo resultado vacío decide en vez de fallar—
  los siete disparadores de `app`, las 20 políticas de RLS de `public` y la función Edge
  `vera/index.ts`. Ninguno tiene la forma: **los disparadores no leen tablas**, las dos
  políticas con `EXISTS` anidado imponen ya la misma condición que la RLS anidada
  aplicaría, y `vera` no toca Postgres.
- **Un resultado negativo no se guarda en un documento: se ancla.** Tres asertos nuevos
  en `01_schema_smoke.sql`, ninguno con nombres de tabla escritos a mano —salen de
  `pg_class`, así que una tabla con RLS nueva queda cubierta sin tocar el fichero:
  1. ninguna función `security invoker` de `app`/`public` fuera de la superficie auditada
     (seis, listadas con su porqué) puede nombrar una tabla con RLS;
  2. **una canaria que demuestra que el detector detecta** — se crea una función `invoker`
     que lee `thread_items` y se exige que el detector la nombre. Sin esto, el aserto de
     arriba pasaría en vacío el día que el barrido dejara de medir, que es exactamente
     como `F-146` sobrevivió desde `0012`;
  3. la premisa de la inmunidad de `security definer`: ninguna tabla con `FORCE ROW LEVEL
     SECURITY` y ninguna función `definer` de otro dueño. Si alguna de las dos cae,
     `F-148` renace entero, en silencio y en todas partes a la vez.
- **Sin migración nueva, a propósito.** No hay nada que corregir en la base: lo de hoy es
  una auditoría y su ancla. `0026` sigue siendo la última migración, y el número de
  hallazgos sigue en `F-156`.
- **Entregable 6: recomprobado con llamada real, sigue bloqueado.** Mismo `429`.

### Lo que se cerró el Día 13 (10-sep)

- **`F-156` (nuevo, respondiendo la pregunta abierta de `F-155`): cerrado en `0026`.**
  El guardia "ya has consultado esta referencia con este distribuidor" de
  `create_inquiry` se saltaba en silencio para cualquier EDITOR de la organización que
  no fuera quien escribió la consulta original ni un ADMIN — permitiendo duplicar una
  consulta a la misma línea y al mismo distribuidor. Nuevo helper
  `app.org_already_inquired`, `security definer`, mismo patrón que
  `app.thread_counterpart`/`app.resolve_thread`/`app.is_item_sender`.
- **Auditadas las cinco llamadas RPC de `app/src/lib/` que tocan claves o hilos contra
  el criterio de `F-155`.** Solo `create_inquiry` tenía el hueco; las otras cuatro ya
  estaban limpias (dos `security definer` desde `0012`/`0023`, dos arregladas en
  `0025`).

### Lo que se cerró el Día 12 (10-sep)

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
| **Un guardia que decide con un `SELECT`/`EXISTS` bajo RLS puede saltarse en silencio, no solo bloquear a quien escribe** | 10-sep-2026 (Día 13), `F-156`. Misma causa que `F-148`/`F-155` (política de SELECT derivada de `thread_item_keys` dentro de una función `security invoker`), pero con un efecto nuevo: en vez de romper la escritura de quien llama, deja pasar algo que el guardia debía impedir. Auditadas las cinco llamadas RPC de `app/src/lib/` que tocan claves o hilos contra este criterio; ninguna otra tenía el hueco | `0026`, `F-156`, `findings-register.md` |
| **El Operador de Plataforma tiene su propio componente de shell, `OperatorShell.tsx`, no una rama dentro de `AppShell`** | 11-sep-2026 (Día 15). Nav de cinco ítems propios y acento brass (spec `ADMIN-01` §2) contra un `AppShell` tipado a `MemberProfile` que usa `orgName`/`role` en tres sitios — reusarlo habría tocado un componente compartido con 147 líneas de tests por una pantalla sin organización. Reutiliza `AppShell.module.css` para el layout común; `AppShell.tsx` queda intacto | `OperatorShell.tsx`, `App.tsx` |
| **`ADMIN-01` no afirma que se envía ningún email** | 11-sep-2026 (Día 15). El HTML aprobado y la spec prometen EML-07/EML-08; ningún envío de correo existe en el proyecto. Los textos de confirmación se corrigen a "Aprobación registrada."/"Solicitud rechazada.", sin mencionar ningún email — mismo principio que `F-100` | `harness/tasks/ADMIN-01.json` |
| **Un commit con el contrato de aceptación en rojo contra un marcador lleva `[skip ci]`, con el motivo en el cuerpo** | Ya estaba en `CLAUDE.md` §1; aplicado con un descuido el 11-sep (el commit de la tarea `DIR-01` salió sin él) y corregido desde `ADMIN-01` en adelante | `CLAUDE.md` §1, Día 15 |

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
| ⚪ | ~~`F-155` deja una pregunta sin cerrar: ¿hay OTROS `SELECT` bajo RLS en funciones `security invoker` que asuman en silencio que quien llama ya tiene una clave envuelta?~~ | **Resuelto 10-sep-2026 (Día 13): sí, un tercero — el guardia "ya has consultado" de `create_inquiry`, cerrado en `0026` (`F-156`). Auditadas las cinco llamadas RPC de `app/src/lib/` que tocan claves o hilos; ninguna otra tenía el hueco** |
| 🟠 | **`F-158`, y es del PO: la spec aprobada de `ADMIN-01` se contradice a sí misma.** Su tabla de columnas dice *"en naranja si > 24h, en rojo si > 48h"* y su bloque de ejemplo pinta en naranja una solicitud de *"Hace 18 horas"*. Cada lectura lleva a una pantalla distinta. El código sigue la REGLA y lo deja escrito en los tres sitios donde alguien podría arreglarlo al revés, así que **no bloquea la construcción**; lo que no puede arreglar el código es el documento | Producto: corregir la spec |
| 🟡 | **Nadie ha mirado si las otras 30 specs aprobadas tienen la misma clase de contradicción que `F-158`.** Salió por casualidad, porque la siembra de demo se verifica a sí misma y exigía una fila de cada color. Un barrido cuesta poco y no se ha hecho | Cualquier sesión, antes de que la fábrica construya sobre ellas |
| ⚪ | ~~ADMIN-01 no se puede probar de extremo a extremo: no hay cuenta de Operador~~ | **Resuelto 11-sep-2026: cuenta creada por el PO en las dos bases, dada de alta por el MCP, alcance comprobado desde su propia sesión y `E2E_OPERATOR_PASSWORD` en los secretos de CI.** La rama de sesión del shell, que era la otra mitad y no se sabía, también |
| ⚪ | ~~Y la otra mitad, que el Día 13 dejó fuera de alcance a propósito: los disparadores, las expresiones de política y la función Edge — todo lo que corre sin que ningún RPC del cliente lo invoque~~ | **Resuelto 11-sep-2026 (Día 14): ninguno tiene la forma.** Los siete disparadores de `app` no leen ninguna tabla; las dos políticas con `EXISTS` anidado imponen ya la misma condición que la RLS anidada aplicaría; `vera/index.ts` no toca Postgres. Anclado con cuatro asertos y una canaria en `01_schema_smoke.sql`, sin migración |
| ⚪ | ~~`F-160`: `--seco` escalaba en falso en las seis tareas del corpus~~ | **Resuelto 11-sep-2026 (Día 15): `_columna()` en `dry_run.py`, lee el CSV por nombre de columna, no por substring de la línea.** Verificado con `python -m harness.tests.dry_run` y `--seco` sobre las tres tareas nuevas y `SRCH-01` |
| 🔴 | **Las tres corridas del paso 5 de `UMBRAL-FABRICA-V1.md` §7 no pueden correr en una sesión remota.** `DEEPSEEK_API_KEY` vive solo en el entorno local del PO (`app/.env` no la lleva; es variable de entorno de usuario, `CLAUDE.md` §1). Comprobado el 11-sep (Día 15) contra la propia máquina de esta sesión (`uname`, `mount`): contenedor Linux en la nube, sin ningún canal hacia `C:\Users\admin\...` | El PO, en su terminal local, con `git pull` de `mvp/bootstrap` |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si las tres tareas del H1 pasan al primer intento, y con qué corrección humana.** Nada de
  esto se sabrá hasta que corran de verdad. `DIR-01` es la más comparable con algo ya
  medido; `ADMIN-01` es la más grande de las tres (panel lateral, formulario de rechazo,
  máquina de tres botones según estado) y la que más riesgo de escalado tiene por tamaño de
  contrato; `FORO-01` es la más simple y la que menos debería sorprender.
- **Si la cifra 7 de las tres pantallas va a servir para algo, dado que se escribieron en una
  sesión y (previsiblemente) se correrán en otra.** `UMBRAL-FABRICA-V1.md` §6 ya avisa de
  esto: si escribir la tarea y correrla van en sesiones distintas, la cifra sale BAJA, no
  falsa — pero baja para las tres a la vez, con el mismo sesgo, así que la comparación
  ENTRE ellas debería seguir siendo válida aunque el número absoluto no sirva para el
  umbral tal cual está redactado. No se ha decidido si el PO acepta esa lectura o prefiere
  remedir escribiendo y corriendo junto.
- **Si `F-158` es un caso aislado o el primero de varios.** Sigue sin barrerse si las otras
  30 specs aprobadas tienen la misma clase de contradicción regla-contra-ejemplo (§5, fila
  ya existente desde el Día 14).
- **Si algún otro campo de `DEEPSEEK_API_KEY`/`DS_PRICE_*` falta en el entorno local del PO
  cuando corra las tres tareas.** Esta sesión no lo puede comprobar: solo puede confirmar
  que AQUÍ no está, no que allí sí lo esté completo — `harness/README.md` dice que el
  arnés no arranca si `DS_PRICE_IN_HIT`/`DS_PRICE_IN_MISS`/`DS_PRICE_OUT` están a cero.
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
- ~~Si quedan otros `SELECT` bajo RLS, en funciones `security invoker`, que asuman en
  silencio que quien llama ya tiene una clave envuelta en el hilo.~~ **Contestado el
  10-sep-2026 (Día 13): sí, un tercero.** Auditadas las cinco llamadas RPC de
  `app/src/lib/` que tocan claves o hilos (`thread_public_keys`, `org_public_keys`,
  `create_thread_item`, `counter_offer`, `create_inquiry`) contra el criterio exacto:
  las dos primeras ya eran `security definer` con `can_access_thread` como puerta —
  inmunes; `create_thread_item`/`counter_offer` ya limpias tras `0025`; `create_inquiry`
  tenía el hueco en su guardia "ya has consultado" — cerrado en `0026` (`F-156`),
  verificado contra un Postgres desechable ANTES de escribir la migración. **Lo que
  esto NO cubre:** no se ha revisado ningún trigger ni función `app.*` que ningún RPC
  de `app/src/lib/` invoque directamente hoy (`app.validate_thread_item`, `app.check_
  thread_rate_limit`, `app.guard_thread_state`…), ni la función Edge `vera/index.ts` —
  fuera de alcance de la pregunta original de `F-155`, que hablaba de `app/src/lib/`.
- ~~Si el mismo patrón vive en algún trigger o función `app.*` interna que corre en
  cada escritura sin que ningún RPC del cliente lo invoque por su cuenta.~~
  **Contestado el 11-sep-2026 (Día 14): no, y por una razón más fuerte que «no se
  encontró ninguno» — los siete disparadores no leen NINGUNA tabla.** No es que su
  lectura esté bien resuelta: es que no hay lectura. Todo lo que en `app` lee tablas es
  `security definer` y de `postgres`, el dueño, así que RLS no le aplica. **Lo que esto
  NO cubre, y conviene decirlo:** la auditoría mira una sola dirección —código `invoker`
  que lee de menos sin enterarse—. La contraria, si cada ayudante `security definer`
  está tan acotado como debería estar ahora que son 23 y ven la base entera, **no la ha
  mirado nadie con ese criterio**.
- **Si el barrido que ancla ese resultado sigue midiendo toda la superficie el día que
  el esquema crezca.** El detector lee el CUERPO de cada función `invoker` y busca
  nombres de tablas con RLS. Dos cosas lo pueden dejar ciego, y hoy ninguna ocurre
  —comprobado contra el catálogo, no supuesto—: SQL dinámico (`execute`), que ahora
  tiene su propio aserto, y una vista o una función intermedia que tape la tabla. Lo
  segundo no está cubierto por nada.
- **Si el aserto le va a servir de algo a quien lo rompa.** Cuando nazca una función
  `invoker` legítima que lea una tabla con RLS —que nacerá—, el ancla se pone roja y
  alguien tendrá que auditarla y meterla en la lista. Eso es el diseño, no un fallo.
  Lo que no se sabe es si el mensaje de error basta para que una sesión que no conoce
  la historia de `F-148`/`F-155`/`F-156` haga la auditoría en vez de añadir el nombre a
  la lista y seguir.
- **Si la rama de sesión del Operador funciona contra la API real.** Está probada con mock
  de red (seis pruebas que miran la consulta, no solo el resultado) y el esquema está
  probado desde la sesión del propio Operador, pero **nadie ha entrado con esa cuenta en la
  aplicación**: hacerlo es teclear una contraseña y eso no lo hace esta sesión. Si al entrar
  saliera la pantalla de login en vez del hueco con nombre, lo que falla es el puente entre
  las dos mitades, no ninguna de las dos.
- **Cuánto de los 148,75 $ de esta sesión es fábrica y cuánto es todo lo demás.** El dato
  existe por sesión, no por tarea (`F-157` lo dejó escrito), así que una jornada que audita,
  lee un plan, escribe un umbral y tres capas de datos produce **un solo número**. Para la
  cifra 7 del umbral hace falta lo contrario: una sesión, una pantalla. De ahí la regla de
  §3, y **no está probada todavía**: la primera sesión limpia dirá si una pantalla cabe en
  los 50 $ o si el plan tiene un problema de coste que nadie ha visto.
- **Si los umbrales del H1 están puestos donde deben.** Los de la corrección humana
  (cifras 4 y 5 de `UMBRAL-FABRICA-V1.md`) se apoyan en **dos** puntos de medida, los
  únicos dos revisados con el bucle ya arreglado, y el resto es juicio declarado como tal.
  Un umbral que nadie puede fallar no mide, y uno imposible tampoco: cuál de las dos cosas
  es este solo se sabrá al correr las tres pantallas. Lo que sí está cerrado es que **no se
  toca después de ver el resultado**.
- **Cuánto de las 21 pantallas restantes dice una muestra de tres.** Tres de módulos
  distintos es mejor muestra que tres del mismo, pero siguen siendo tres de veinticuatro.
  Por eso el escenario base del umbral obliga a remedir al llegar a seis.
- **Cuántas casillas más del registro de hallazgos dicen «Abierto» con el trabajo hecho.**
  Hoy apareció una (`F-118`, trece días) y no se buscó ninguna otra: el registro tiene
  dieciocho filas en algún estado abierto y **ninguna se ha contrastado contra el repo con
  este criterio**. Es barato y no se ha hecho.
- **Si `app.guard_offer_decider` se está apoyando sin saberlo en una política de otra
  tabla.** Compara `quien = old.sender_org_id` y, si `app.current_org_id()` devolviera
  `NULL`, la comparación no sería cierta y el guardia dejaría pasar el cambio de estado
  **sin decir nada** — la forma de la familia, con el ayudante `definer` en medio en vez
  de un `SELECT` crudo. Hoy es inalcanzable: `current_org_id()` solo da `NULL` si no hay
  fila en `members` para `auth.uid()`, y entonces `app.is_active_member()` es falso y la
  política `thread_items_update_participant` corta el `UPDATE` antes. **Comprobado
  leyendo los tres cuerpos y la política en el catálogo, NO contra una sesión viva.**
  Que un guardia dependa de una política de otro fichero para no fallar en silencio es
  exactamente lo que costó `F-148`.

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
3. **`openspec/v1/UMBRAL-FABRICA-V1.md`** ANTES de tocar nada de la fábrica de pantallas o
   del H1. Es el umbral escrito antes de medir, y **no se reescribe después de ver un
   resultado**: si hay que cambiar las tres pantallas, se cambian ahí y antes de correr.
4. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado el 6-sep: entregables
   1, 2 y 6 con movimiento; el 3 bloqueado — lee su adenda del 6-sep antes de reintentar
   `create_project`.
5. **`openspec/v1/entornos.md`** (nuevo, 6-sep) si vas a tocar CI/CD o el mapa de entornos.
6. **`openspec/v1/vera-vertex-eu-migracion.md`** (nuevo, 6-sep) antes de tocar `vera/index.ts`
   por el entregable 6 — no reinventar el runbook.
7. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**.
8. **`docs/ADR-001`** si vas a tocar criptografía.
9. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
10. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
11. **`findings-register.md`** nunca de corrido: por identificador. Del Día 9: `F-150`.
    Del Día 10: `F-151` (cerrado). Del Día 11: `F-152` (cerrado el Día 12), `F-153`
    (cerrado). Del Día 12: `F-154` (cerrado, `0024`), `F-155` (cerrado, `0025`). Del
    Día 13: `F-156` (cerrado, `0026`). Del Día 14, tres: `F-157` (cerrado — el medidor de
    coste borraba su propia historia), `F-158` (**ABIERTO, es del PO** — la spec de
    `ADMIN-01` se contradice a sí misma en el umbral de color de la antigüedad en cola) y
    `F-159` (cerrado — un e2e que fallaba por carrera, arreglado justo antes de que la
    fábrica empiece a medirse con esa suite). Del Día 15: `F-160` (cerrado — `--seco`
    escalaba en falso por una columna del CSV que el detector no sabía leer). `F-158`
    sigue siendo el único abierto del corpus, y sigue siendo del PO.

---

*Día 14 de V1 · 11-sep-2026 · el detalle completo de su cierre vive en
`git show f5e1d7e:openspec/v1/ESTADO-V1.md` (no se repite en este pie: este es el cierre del
Día 15, que empieza donde el 14 terminó).*

*Día 15 de V1 · trabajo hecho el 11-sep-2026 (15:48–19:44 UTC, los siete commits) · fecha
leída de la máquina (`date -u`) al escribir este cierre: `2026-09-13`, 07:38 UTC — **dos días
después del trabajo, por una interrupción de la conversación, no porque el día se alargara
(regla 4, y se dice en voz alta por la regla 3)** · empezó donde el Día 14 lo dejó: el paso 3
de `UMBRAL-FABRICA-V1.md` §7 · `F-160` cazado y cerrado antes de gastar un token en ninguna
tarea —`--seco` escalaba en falso en las seis del corpus por una columna del CSV
(`primer_intento_limpio`, `F-152`) que el detector de escalado no sabía leer, reproducido
también contra `SRCH-01` para confirmar que no era cosa de hoy— · **las tres tareas del H1
escritas, con sus tests de aceptación, y validadas `--seco`: cero problemas, cero avisos en
las tres** · `OperatorShell.tsx` nuevo, porque el Operador no encaja en `AppShell`
(`AppShell.tsx` y sus 147 líneas de tests, intactos) · segundo hallazgo en `ADMIN-01`: ningún
envío de correo existe en el proyecto, y el texto de confirmación se corrigió para no
afirmarlo · `admin-requests.ts` ampliada a 22 pruebas (`requestDateLabel`, `websiteHref`) ·
**el límite del entorno, aclarado sin ambigüedad y comprobado contra la propia máquina**
(`uname`, `mount`): esta sesión es un contenedor remoto sin ningún canal hacia
`C:\Users\admin\...`, así que el paso 5 del §7 —las tres corridas— no puede correr aquí bajo
ninguna circunstancia · typecheck limpio y **712 pruebas existentes en verde** tras las tres
tareas, con las 36 nuevas de `DIR-01`/`ADMIN-01`/`FORO-01` en rojo contra sus marcadores,
como corresponde antes de que exista la pantalla de verdad · siete commits en
`mvp/bootstrap`, con un `[skip ci]` olvidado en el primero (`DIR-01`) y corregido desde
`ADMIN-01` en adelante — por eso el primer push sí corrió CI (rojo esperado, `App ·
typecheck`) y los tres siguientes no corrieron ninguno, verificado con
`mcp__github__actions_list` y no con el mensaje del commit · coste-sombra de orquestación al
cierre: **1.055,62 $** acumulados; el 11-sep entero (Día 14 + Día 15) pasa de 148,75 $ a
**206,60 $**, así que esta sesión sola son **57,85 $**, sin ninguna corrida real ·
`F-158` sigue abierto, es del PO · `git status --short` releído antes de escribir este pie:
limpio salvo los dos ficheros de este mismo cierre (`ESTADO-V1.md`,
`orchestration-metrics.csv`) · Dirección Técnica, Nortex Systems*
