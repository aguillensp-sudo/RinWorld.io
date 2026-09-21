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
>
> **18-sep: uno de los cuatro cambió de sitio, sin resolver el misterio.** Esta sesión se
> lanzó sobre `dia-14-correcciones-mvp-8160b9`, todavía en `43bb222`, y siguió la
> instrucción de arriba: reseteó su rama a `origin/mvp/bootstrap` y trabajó ahí de verdad
> —es de donde salen los commits de hoy—. `git worktree list` ahora lo muestra en `e9366bd`,
> no en `43bb222`: no es que el ghost se resolviera, es que esta sesión lo USÓ. Los otros
> tres (`dia-4-f131-pending-003608`, `seccion-3-relevo-8cef0a`, `sweet-mayer-f17466`) siguen
> anclados a `43bb222`, sin tocar. **La hipótesis de lanzar desde la raíz sigue sin
> probarse ni refutarse por esto.**

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

**Día 16 de V1 · corridas 13/14-sep-2026, C5 y cierre 17-sep-2026 · Estado: CERRADO — el H1 se
cierra.** Las tres pantallas del H1 (`DIR-01`, `ADMIN-01`, `FORO-01`) con corrida real limpia y C5
del PO sin ninguna corrección; las ocho cifras evaluadas contra su fuente y **veredicto «Funciona
con supervisión» — escenario base, 21 semanas, la corriente B con dos agentes**, con la cifra 3
como única que falla (0 de 3 verdes al primer intento). `F-161`, `F-162` y `F-163` cerrados,
ninguno defecto del Coder. El detalle completo vive en `git show fc9f34e:openspec/v1/ESTADO-V1.md`,
no se repite aquí. **Su adenda del 17-sep —«`push` no dispara CI; sospecha: el token de git»— era
falsa, y lo que había detrás llenó el Día 17.**

---

**Día 17 de V1 · 17-sep-2026 · Estado: CERRADO.** Cadena de cinco hallazgos que empezó
comprobando por qué el cierre del Día 16 no había disparado CI (`F-164`, el marcador de
salto en el cuerpo del mensaje) y siguió una CI rota desde el 11-sep (`F-165`, sin
credenciales del Operador), un e2e declarado que nunca se había ejecutado y que el arnés
contaba como verde (`F-166`), un token de Supabase caducado (`F-167`) y la app de
producción sin arrancar desde el 8-sep, verificado y cerrado por CONTENIDO, no por HTTP
200 (`F-168`). Barrido de once contradicciones más de la familia `F-158` (`F-170`),
trece filas del registro puestas al día y la carpeta `Ingles/` archivada por decisión del
PO. La corriente B se abrió de verdad: `0030` a mano y `FORO-02` **PASA 4/4 al primer
intento**, la primera del proyecto. El detalle completo —las diez líneas y las cuatro
adendas— vive en `git show 9e546d1:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

**Día 18 de V1 · 18-sep-2026 · Estado: CERRADO -con DOS reaperturas por la regla 4: el primer
cierre fue a las 16:23 UTC, el esquema de `ADMIN-02` se escribió después hasta las 18:12 UTC, y
un hallazgo de CI (`F-178`) se investigó y resolvió después de eso, hasta las 18:45 UTC**

> **EL DÍA EN DIEZ LÍNEAS.**
>
> 1. **Sesión nueva, lanzada sobre uno de los cuatro worktrees fantasma que este fichero
>    lleva semanas señalando** (`dia-14-correcciones-mvp-8160b9`, anclado a `43bb222`, sin
>    `harness/` ni `app/`). Reseteada su rama a `origin/mvp/bootstrap` para poder trabajar
>    y empujar de verdad desde ahí — la hipótesis de "lanzar desde la raíz" sigue sin
>    probarse, esta sesión no la prueba ni la refuta.
> 2. **El C5 de `FORO-02` no salió limpio, y el PO señaló dos síntomas.** Uno era
>    percepción, no defecto: "Crear hilo" está apagado a propósito, documentado. El otro
>    era real pero distinto de lo que parecía: **ningún** input del proyecto tenía ya la
>    "x" que el PO recordaba en `DIR-01` —ni `DIR-01` la tenía—. El PO decidió el estándar
>    ahí mismo (`F-172`): input con lupa integrada + "x" que aparece al escribir y solo
>    borra el campo, sin disparar la búsqueda (que sigue siendo server-side, decisión
>    explícita del PO). Nuevo componente `app/src/components/SearchField.tsx`, aplicado en
>    `DIR-01` y `FORO-02`; `INV-01`/`MSG-01`/`SentOffers` quedan de deuda.
> 3. **`RNG-FORO-06` escrito, con un bug real cazado antes de tocar las bases** (`F-173`):
>    la primera versión del guardia era `security definer`, y dentro de una función así
>    `current_user` es el DUEÑO de la función, no quien llama — el límite no limitaba a
>    nadie. Corregido a invoker. `0031`/`0032`/`0033` aplicadas y comprobadas contra el
>    catálogo de las dos bases.
> 4. **`FORO-03` construida: capa de datos, wiring, contrato de aceptación (23 pruebas de
>    unidad + e2e real) y la tarea, validada `--seco` sin avisos.**
> 5. **La corrida real escaló 2/4 en los tres intentos, y no era el Coder** (`F-174`): un
>    test propio mockeaba datos que nunca cambiaban entre llamadas. Corregido sin tocar ni
>    una línea del artefacto: 23/23 de unidad, 871 del repo entero y **10/10 del e2e
>    contra `troxminloxkjwihwfevs`**, incluida la reacción que se autolimpia. Cuenta como
>    ESCALADO para la cifra 3 del umbral — el CSV no se recalcula.
> 6. **Un commit intermedio salió rojo en CI por heredar el test roto de uno anterior que sí
>    saltaba CI** (`F-175`): sin acción, el siguiente push ya iba verde en los seis jobs, y
>    producción sirve `FORO-03` verificado por contenido. Y un commit de documentación
>    **no disparó ningún run**, sin pedirlo: su cuerpo citaba entre comillas el marcador de
>    salto para EXPLICAR `F-175`, y GitHub lo lee igual venga o no entre comillas —
>    exactamente `F-164`, cometido por quien acababa de leer sobre `F-164` (`F-176`).
> 7. **Coste-sombra de orquestación: de $1.363,42 a $1.371,48** — la sesión entera del día,
>    no solo `FORO-03`, sigue sin poder medirse limpia (misma limitación que `ADMIN-01`/
>    `FORO-02`, §1). El Coder: 0,143118 $ en los tres intentos, 5,9 minutos.
> 8. **Lo que queda pendiente, y no se da por hecho:** el C5 de `FORO-02` no tiene
>    confirmación final del PO tras la corrección del buscador, y `FORO-03` no tiene
>    ningún C5 todavía — las dos siguen sin contar como aceptadas.
> 9. **`ADMIN-02` (la sexta pantalla de la remedición) tiene ya su esquema** (`0034`):
>    `billing_accounts`/`billing_payments`/`billing_status_events`, la vista
>    `billing_org_status` y los verbos de confirmar pago y suspender. "ACTIVE"/"EN
>    PRUEBA" de la spec son la MISMA fila que `organizations.status='APPROVED'`
>    -calculada, no guardada-; `SUSPENDED` reusa el status que ya usan la visibilidad
>    y la búsqueda desde `0001`. `Iniciar borrado` queda fuera a propósito -un borrado
>    en cascada real merece su propia auditoría, no una casilla de esta tarea-. De
>    paso, comprobado empíricamente que el `GRANT` de tabla de sobra que la plataforma
>    concede en casi todo `public` no es una puerta abierta -RLS bloquea la escritura
>    sin política, con o sin ese `GRANT`- (`F-177`).
> 10. **Empujar `0034` disparó una CI que escaló 2/4 en cuatro intentos seguidos, y no era
>     la migración** (`F-178`): el job `e2e` corre contra el proyecto AISLADO
>     `bearingworld-e2e`, no contra `troxminloxkjwihwfevs` -donde se había probado todo a
>     mano, detalle que esta misma sesión olvidó al ver los 14/14 locales-, y ese proyecto
>     tenía una reacción huérfana: el test propio "reaccionar y quitar la reacción" quedó a
>     medias cuando una corrida se canceló por un push posterior, lo mismo que ya había
>     pasado dos veces hoy (`F-171`). Borrada la fila exacta por SQL, `forum_thread_list`
>     verificado de vuelta a sus cifras correctas, CI reintentado y verde en los seis jobs
>     (`35378570024`). Deuda sin resolver: el foro no tiene teardown ni entra en
>     `resetDemo`, así que el mismo residuo puede repetirse con cualquier test futuro que
>     reaccione y desreaccione dentro de la misma corrida.

---

**Día 19 de V1 · 19-sep-2026 · Estado: EN CURSO, no es el cierre de la sexta pantalla — se cierra la
SESIÓN, no la tarea: `ADMIN-02` queda con esquema, siembra, wiring, capa de datos, contrato de
aceptación y tarea validada en seco, y SIN correr. Fecha de máquina al escribir: `2026-09-19`,
17:28 UTC.**

> **EL DÍA EN OCHO LÍNEAS.**
>
> 1. **Se empezó revisando `ADMIN-02` a mano en localhost**, con el HTML aprobado servido aparte
>    (la pantalla aún no existía en la app): cinco de las nueve comprobaciones del PO salieron
>    limpias, tres eran límites del mock (los chips no filtran, el pago no refresca la tabla, la
>    fecha del modal es fija) y una era un defecto real: **el mock sombreaba por POSICIÓN la
>    fila que no era** (`F-179`, herencia de la reordenación de `F-170`). Corregido en el HTML
>    aprobado por decisión del PO, verificado clicando las cinco filas.
> 2. **`F-179` también cierra la cita a *Acme Bearings Ltd*** que la spec ponía en el saludo
>    de VERA sin que existiera en los datos de ejemplo: manda la tabla (opción 1 del PO). Saludo
>    y contador del chip `Próximos a vencer`, de 2 a 1, corregidos en la spec y en el HTML.
> 3. **Wiring de precondición hecho (`F-180`):** el HTML aprobado de `ADMIN-02` pinta el nav del
>    Operador con SEIS ítems -`Cobros` entre `Solicitudes` y `Organizaciones`-, no cinco.
>    `OperatorShell` lo tiene y `App.tsx` monta un marcador `AdminBilling`.
> 4. **Capa de datos `admin-billing.ts`** (22 pruebas): filtros de los cinco chips, fechas,
>    tono de color, validación del modal y las llamadas de red. El email de contacto NO viene
>    en la vista: es `organizations.contact_email` (`0027`), y se lee aparte.
> 5. **Siembra `supabase/seed/demo_billing.sql`, aplicada en las dos bases:** los cuatro estados
>    con datos reales. Las dos suspendidas son organizaciones NUEVAS -suspender una de las seis
>    las sacaría de directorio y búsqueda y descuadraría los e2e que las cuentan-.
> 6. **Contrato de aceptación:** 58 pruebas de unidad en rojo contra marcadores y 12 e2e de solo
>    lectura (`billing_payments` no admite `DELETE`). `Iniciar borrado` va DESHABILITADO en tabla,
>    sección y panel, y sin modal ni checkbox: es una desviación consciente del HTML aprobado.
> 7. **`harness/tasks/ADMIN-02.json`, `--seco` verde:** cuatro componentes (pantalla, tabla,
>    panel, modal de pago), `Iniciar borrado` fuera de alcance.
> 8. **Lo que NO se ha hecho, y no cuenta como hecho:** la corrida real, las C5 del PO de
>    `FORO-02`/`FORO-03`, y la deuda de `F-178` (el foro sin teardown ni `resetDemo`). Ninguna
>    de las ocho cifras del umbral se ha movido hoy.

---

**Día 20 de V1 · 20-sep-2026 · Estado: CERRADO.** La sexta pantalla corrió, y con dos
Coders a la vez: el PO pidió un experimento de dos brazos —DeepSeek contra
`Atria-Dawn-Preview`, publicado hace nueve días— para ver si se puede acelerar la fábrica
sin comprometer el estándar. **Las dos cosas que hay que llevarse de hoy:**

1. **`ADMIN-02` está construida, verde y desplegada, y el artefacto del Coder no necesitó
   NI UNA LÍNEA de corrección a mano.** 1 594 líneas, cero tocadas: el mejor resultado de
   la fábrica hasta ahora en la única métrica que no se deja engañar por el instrumento.
2. **Y sin embargo el arnés la registró como ESCALADO 3/4**, porque los ocho e2e que
   fallaron los tres intentos eran **defectos del contrato de aceptación** (`F-183`), no
   del artefacto. Recuperado el intento 1 de su JSON y pasado por la batería corregida:
   **verde entero** —typecheck, 936 de unidad, 89/89 de e2e—. Con un contrato correcto
   habría sido el primer verde al primer intento de la fábrica.

> **La consecuencia para la remedición, sin maquillarla:** la cifra 3 cuenta esta pantalla
> como escalada, porque `F-161`/`F-162` fijaron que una escalada cuenta sea cual sea la
> causa. Pero es el **tercer caso** —con `F-166` y `F-174`— en que el instrumento puntúa al
> Coder por un defecto propio, y van tres de seis pantallas. **El patrón ya no es
> anecdótico: la cifra 3 mide el contrato de aceptación tanto como al modelo.** Quien
> evalúe el umbral tiene que decidir qué hacer con eso; este fichero no lo decide.

**El experimento, en una línea:** Atria salió **VERDE 4/4 en 2 intentos** y tampoco
necesitó corrección a mano, pero costó **tres corridas muertas** por límites de su API
(dos `502` sin streaming, un stream cortado a los 605 s) y hubo que enseñarle al arnés a
hablar por trozos. **Decisión: `CLAUDE.md` §3 no cambia** — DeepSeek sigue en el nodo
Coder, y no por calidad de código sino por operabilidad (`F-185`). El detalle entero, con
lo que el experimento NO mide, está en `openspec/v1/experimento-dos-brazos.md`.

**Hallazgos del día: cinco.** `F-181` (el guardia del seco avisaba en falso de dos roles
que la tarea sí declara), `F-182` (la excepción nueva del guardia del puerto se llevaba
todas las filas del CSV — lo cazó una revisión adversarial ANTES de la primera corrida),
`F-183`, `F-184` (36 de las 49 líneas del feedback al Coder eran avisos de Node, y viene
de corridas anteriores) y `F-185`.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-20` — la sesión empezó el 19 y cruzó la medianoche; el cierre lleva el día en que se escribe (regla 3) |
| El árbol de partida estaba sano: solo lo de ADMIN-02 en rojo | `npm run typecheck` y `npm run test:arnes` ANTES de gastar un token | typecheck exit 0; **58 fallos y los 58 en los tres ficheros de aceptación de ADMIN-02**, 878 verdes. Nada más roto que pudiera envenenar las dos ramas (lo que pasó en `FORO-03`) |
| La siembra de cobros seguía dando los cuatro estados | SQL por el MCP sobre `billing_org_status`, antes y después de resembrar | Antes: los cuatro, Cuscinetti a 9 días. Resembrada: Cuscinetti 10, Ruiz −133, Timken −190, Rhône 246 |
| El cambio del arnés no toca la ruta de DeepSeek | `test_segundo_proveedor_no_toca_el_primero`, con los valores escritos a mano y no leídos del módulo | Cuerpo de petición, cabecera, URL y doblado de F-005 idénticos sin las variables nuevas |
| El cerrojo de checks excluye de verdad entre procesos | Subprocesos reales tomando el mismo fichero, y uno muriendo por `os._exit` sin soltarlo | Excluye, se suelta solo al morir el dueño, la espera se mide. 213 comprobaciones de `test_checks` en verde |
| `E2EInfraError` se llevaba todas las filas del CSV | Grafo de juguete con `Volcado` y `record_metrics` reales (lo hizo el escéptico de la revisión) | `attempt_1.json` en disco y **cero filas** de CSV. Corregido y probado antes de la primera corrida (`F-182`) |
| **La corrida oficial (`brazo-deepseek`)** | El arnés, tres intentos | **ESCALADO 3/4**: C1, C3 y C4 verdes los tres intentos; C2 rojo por los mismos ocho e2e. $0,2366 y 14 min de pared |
| **Que esos ocho fallos NO eran del artefacto** | Test desechable escuchando la red DENTRO de la misma corrida de la suite | La petición devolvía **8 filas** y el chip decía 'Todos 8' mientras los ocho tests leían cero. La causa: el estado vacío también es una fila y la espera del `beforeEach` se cumplía antes del primer dato (`F-183`) |
| Que la RLS y la capa de datos estaban bien, por tres vías distintas | (a) SQL como `service_role`; (b) SQL suplantando el JWT del Operador (`set local role authenticated` + `request.jwt.claims`); (c) PostgREST con la clave publicable y un token real de Operador | **8 filas en las tres.** Y sin sesión, `401 permission denied`, no cero filas — que es lo que descartó la hipótesis de la sesión ausente |
| **Que el artefacto del Coder es correcto** | Contrato corregido, batería entera | typecheck 0, **936 de unidad**, **89/89 de e2e**. **Cero líneas tocadas** del artefacto |
| **Que habría salido verde al PRIMER intento** | Intento 1 recuperado de `attempt_1.json`, escrito al árbol y pasado por la batería corregida | typecheck 0, 936 de unidad, 89/89 de e2e. Después se restauró el árbol al artefacto comiteado |
| La pantalla llega a producción | `gh run view` job a job sobre `9a89bc8` | Los **seis** en verde: esquema, arnés, app, Playwright contra el proyecto aislado, y los dos despliegues (VERA y Vercel) |
| Los límites de la API de Atria | Tres corridas muertas y dos sondas propias | `502` a 5m17s y 5m40s sin streaming; stream cortado a 605 s; **33 399 tokens de salida en 435 s sí completan** con su `usage`. Velocidad entre 24 y 110 tokens/s la misma tarde (`F-185`) |
| **La corrida de Atria (`brazo-atria`)** | El arnés, dos intentos | **VERDE 4/4 en 2**. Su único rojo propio: `TS6133: 'loading' is declared but its value is never read`, que tumbó el build y arrastró a C2 |
| Que el feedback del reintento iba degradado en los dos brazos | Recuento sobre los JSON de intento | **36 de 49 líneas** eran avisos de Node, y el mismo aviso aparece en corridas de agosto (`F-184`) |

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
| **`RNG-FORO-06` · límite de 10 publicaciones por hora natural** | ✅ **18-sep · `0031`/`0032`**, `F-173` (bug de `security definer` cazado antes de aplicar). Disparador + estado consultable, aplicados y comprobados contra el catálogo de las dos bases |

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
| **`0030` · reacciones del foro y la vista de la lista de hilos** | ✅ **17-sep** — `forum_reactions` y `forum_thread_list`, capa de datos de `FORO-02`. Validada en Postgres desechable, aplicada y comprobada contra el catálogo de las dos bases |
| **`0031`/`0032` · límite de publicaciones por hora (RNG-FORO-06)** | ✅ **18-sep** — disparador + estado público, precondición de `FORO-03`. Validadas en Postgres desechable, aplicadas y comprobadas contra el catálogo de las dos bases |
| **`0033` · `forum_post_detail`, capa de datos de `FORO-03`** | ✅ **18-sep** — reacciones y `reacted_by_me` POR PUBLICACIÓN. Validada en Postgres desechable, aplicada y comprobada contra el catálogo de las dos bases |
| **`0034` · esquema de billing y suscripción anual (ADMIN-02)** | ✅ **18-sep** — `billing_accounts`/`billing_payments`/`billing_status_events`, vista `billing_org_status`, `billing_confirm_payment`/`billing_suspend_organization`/`app.billing_evaluate_expirations`. Validado en Postgres desechable y comprobado contra el catálogo Y contra los datos reales de las dos bases (las seis organizaciones calculan EN PRUEBA con los días exactos). **Iniciar borrado, el email de aviso y el enganche a `pg_cron` quedan fuera, documentados en la cabecera de `0034`** |
| **`F-177` · el GRANT de tabla de sobra en casi todo `public` no es un agujero** | ✅ **18-sep**, comprobado empíricamente en Postgres desechable (no solo leído): RLS bloquea la escritura sin política pase lo que pase con el `GRANT`. Deuda de higiene, no de seguridad |
| Entregable 6 · residencia europea (VERA) | 🟠 **11-sep, recomprobado con llamada real: mismo `429`. Infraestructura GCP creada y verificada el 10-sep** (proyecto, facturación, API, cuenta de servicio — §1) — bloqueada en la aprobación de Anthropic (Model Garden), `429 RESOURCE_EXHAUSTED` en cada comprobación, sin fecha. Código (`vera/index.ts`) sin tocar, a propósito |

### Corriente B · Fábrica — ABIERTA y EN MARCHA · **6 pantallas de 24 (Día 20)**

**`ADMIN-02` corrió, y es la sexta.** Artefacto del Coder en `993db73`, sin una sola
corrección a mano; contrato de aceptación corregido en `ab27b0f`; CI entera verde y
desplegada. **Veredicto del arnés: ESCALADO 3/4** — y ese número no dice lo que parece,
porque los ocho e2e que fallaron eran del contrato (`F-183`) y el intento 1, pasado por la
batería corregida, sale verde entero. Ver el bloque del Día 20.

**La remedición obligatoria ya se puede hacer: van 6 de 6.** No se ha hecho hoy, a
propósito —el día ya llevaba dos corridas, un experimento y cinco hallazgos—, y además hay
que decidir antes una cosa que no es de cálculo sino de criterio:

> **La cifra 3 (verdes al primer intento) queda en 1 de 6 contando como siempre**
> (`FORO-02` la única limpia). Pero de las cinco que fallan, **tres fallan por el
> instrumento y no por el Coder**: `FORO-03` (`F-174`, test propio roto), `ADMIN-01`
> (`F-166`, e2e declarado que se saltaba) y ahora `ADMIN-02` (`F-183`). Si se contara
> «verde al primer intento con un contrato correcto», `ADMIN-02` sería verde y la cifra
> sería 2 de 6. **Las dos lecturas son defendibles y este fichero no elige**: lo que no
> vale es evaluar el umbral sin haber visto este párrafo.

**Las otras cinco:** el H1 (`DIR-01`, `ADMIN-01`, `FORO-01`) cerrado el Día 16 con C5 del
PO y sin correcciones; `FORO-02` con C5 pendiente de la confirmación final tras la
corrección del buscador; `FORO-03` sin C5 todavía.

**C5 pendientes: tres** — `FORO-02`, `FORO-03` y ahora `ADMIN-02`. Es lo único que impide
dar las tres por cerradas, y no lo da una máquina.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

1. ✅ **`F-184` CERRADO el 21-sep** (`test_runner._entorno_sin_color`, commit de la sesión del Día 21). Playwright pone `FORCE_COLOR=1` a sus workers y heredaban el `NO_COLOR=1` del arnés: Node avisaba en cada uno y Playwright reinicia el worker tras cada test fallido. Reproducido y comprobado por el `run_cmd` real: 8 líneas de ruido → 0. **Lo que NO arregla:** las corridas anteriores siguen medidas con el feedback degradado (cifra 3) y quedan 4 líneas fijas de arranque (`[WebServer]`, `npm notice`).
2. 🟠 **Tres C5 del PO, y una es de hoy.** `ADMIN-02` está desplegada y se puede revisar en
   la URL real (Operador → `Cobros`); `FORO-02` con la corrección del buscador ya aplicada;
   `FORO-03` entera. **Sin pulsar `Aprobar`/`Rechazar` en `ADMIN-01`** (`F-169`) ni
   `Marcar pago recibido` en `ADMIN-02`: un pago confirmado NO se puede borrar desde el
   cliente y la única limpieza es resembrar (`demo_billing.sql`, corre como `postgres`).
3. **La remedición de las ocho cifras, con el párrafo de la cifra 3 del §2 delante.** Van 6
   de 6, así que toca. Estado de las otras dos que se sabían sucias: la 7 (coste de
   orquestación) sigue sucia y hoy más —esta sesión hizo el cambio del arnés, su revisión
   adversarial y dos corridas—, así que `ADMIN-02` tampoco sirve para esa cifra; van cuatro
   de seis pantallas sucias en la 7.
4. **Decidir qué se hace con la rama `exp/admin-02-atria`.** Tiene un artefacto verde de
   `Atria-Dawn-Preview` que nadie ha fusionado y que no se va a fusionar sin decisión del
   PO. Si no se quiere, se borra la rama y queda el informe; si se quiere comparar a ojo
   con el de DeepSeek, están los dos commits.
5. **La deuda que dejó `F-170`** (contradicciones ENTRE specs y entre spec y esquema) y
   **la de `F-172`** (el estándar de buscador solo en `DIR-01` y `FORO-02`) y **la de
   `F-178`** (el foro sin teardown ni `resetDemo`). Sin cambios desde el Día 19.

En paralelo, sin acción propia desde este lado:

- **Entregable 6: esperar la aprobación de Anthropic (Model Garden), sin ETA.** Sin
  recomprobar hoy. **No tocar `vera/index.ts`.**
- Fuera de sesión: `F-073` (re-loguear la CLI de Supabase) y el plan de pago de Vercel.

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **Estándar de buscador: input con lupa integrada + "x" al escribir, server-side** | 18-sep-2026, PO (`F-172`), en la C5 de `FORO-02`. Manda sobre lo que diga la spec de cada pantalla, incluidas las ya aprobadas. La búsqueda sigue siendo server-side (Enter/lupa), no live search — decisión explícita, distinta de la "x" | `app/src/components/SearchField.tsx`, `design-system.md` |
| **`RNG-FORO-06` cuenta por HORA NATURAL, no por ventana móvil** | 18-sep-2026, resuelta al escribir `0031`: la spec se contradice entre su `Requirement` ("hora natural") y su `Scenario` ("en la última hora"). Gana la regla, mismo criterio que `F-158`/`F-170`. La ventana es siempre `[HH:00:00, HH:59:59]` del reloj | `0031`, `supabase/specs/community-forum/spec.md` |
| **Un guardia que se salta a sí mismo comparando `current_user` NO puede ser `security definer`** | 18-sep-2026, `F-173`. Dentro de una función definer, `current_user` es el DUEÑO de la función, no quien llama: el bypass de siembra se vuelve permanente y el guardia deja de guardar. Regla general, no solo del foro | `F-173`, `app.guard_forum_rate_limit` (0031) |
| **`openspec/design-gui/Ingles/` se olvida para siempre** | 17-sep-2026, PO. Copia puntual de las specs para traducir; se deja como está, no se versiona, no se revisa ni se sincroniza, y **no se menciona en ningún relevo ni cierre**. Llevaba días apareciendo como `??` en `git status` y colándose en cada resumen | `.gitignore`, `Ingles/_CARPETA-ARCHIVADA-NO-TOCAR.md` |
| **Las invitaciones pendientes ocupan plaza en el tope de 5 usuarios** | 17-sep-2026, PO (`F-170`, `INVT-01`). Si no la ocuparan, se podrían enviar más invitaciones que plazas y acabar con más de 5 usuarios. `Reenviar` una expirada respeta el mismo límite | Spec `INVT-01` §3, `barrido-specs-F158.md` |
| **Al llegar al límite de usuarios, el mensaje se muestra** | 17-sep-2026, PO (`F-170`, `REG-09`): «hay que mostrarlo al usuario sin dudarlo». La spec decía «sin mensaje» | Spec `REG-09` §6 |
| **En una spec, la regla manda sobre el ejemplo** | 17-sep-2026, PO, al cerrar `F-158`: la de `ADMIN-01` decía *naranja si > 24h* y pintaba en naranja 18 horas. Se corrige el ejemplo (a 30 h), no la regla | `F-158`, spec y HTML de `ADMIN-01` |
| **La cifra 2 de `ADMIN-01` cuenta, aunque su C2 no ejecutara el e2e en la corrida del arnés** | 17-sep-2026, PO. El contrato se cumple en CI real (66/66) y en local (4/4) contra el artefacto tal cual salió del Coder; el hueco era de la medición, no de la pantalla. Desde `6e25a9a` ese hueco no puede repetirse: un e2e declarado que se salta deja C2 `INEJECUTABLE` | `F-166` |
| **Se siembra antes de cada corrida, y no a mano** | 17-sep-2026, PO. `resetDemo` devuelve las tres solicitudes de `ADMIN-01` a la cola en cada arranque de la suite y en `npm run demo:reset`: una revisión a mano que pulse Aprobar/Rechazar ya no puede cobrarse al Coder en la corrida siguiente | `F-169`, `app/scripts/demo-reset.mjs` |
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
| ✅ | **`F-184` · CERRADO el 21-sep.** El feedback del reintento iba lleno de avisos de Node (36 de 49 líneas): `NO_COLOR` heredado por los workers de Playwright. Ya no se pone en ese comando. | Quedan 4 líneas fijas de arranque sin tocar; las corridas anteriores no se reescriben |
| 🟡 | **La clave de Atria no vive donde dice `CLAUDE.md` §1.1.** Está en el `.env` de otro proyecto (`C:/Users/admin/proyectos/04_01_Ticket_reader_Ninox/.env`), que es un tercer sitio: no la encuentra ni el `grep` del repo (respeta `.gitignore`) ni la lectura del registro de Windows. Costó media hora de búsqueda a ciegas | Álvaro, si se vuelve a usar ese brazo: `setx ATRIA_API_KEY` la deja donde ya está `DEEPSEEK_API_KEY` |
| 🟡 | **El turno de checks entre árboles está probado pero no ejercitado en producción**: los dos brazos no llegaron a solaparse (Atria arrancó cuando DeepSeek ya había acabado). La primera vez que dos corridas coincidan de verdad será la primera prueba real del cerrojo | Quien lance dos a la vez: mirar el log, que dice la espera |
| ⚪ | ~~`push` a `mvp/bootstrap` no dispara CI; sospecha: el token de git~~ | **Resuelto 17-sep-2026, y no era el token: `F-164`** (el cuerpo del mensaje de `7eeb6d8` nombraba el marcador de salto). `5cfbf2f`, con las mismas credenciales, creó su run al momento. Detrás apareció `F-165` (`ci.yml` sin credenciales del Operador), cerrado |
| ⚪ | ~~**`F-168` · la app de producción no arranca desde el 8-sep.**~~ **Resuelto 17-sep: variables puestas por el PO, verificado por contenido (`index-CHmJc7cl.js`, 480.802 bytes) y en navegador (login pintado, cero errores de consola), y con un paso nuevo en `deploy-app` que lo comprueba en cada despliegue.** Lo que decía: El proyecto `rin-world-io` de Vercel no tiene `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`; el bundle es un `throw`. Pasó nueve días sin verse porque `F-151` se verificó con `HTTP 200` | Álvaro: variables en Vercel (Production + Preview) y la decisión sobre `VITE_DEMO_KEY_SEED` (§3) |
| ⚪ | **Resuelto 17-sep: token nuevo, VERA desplegada en verde (run `35238997261`, intento 2).** ~~`F-167` · `SUPABASE_TOKEN` de CI devuelve `401`.~~ VERA no se despliega. Desde `05d2f1b` ya no arrastra a la app | Álvaro: token nuevo y `gh secret set SUPABASE_TOKEN` |
| ⚪ | ~~`F-166` · falta `E2E_OPERATOR_PASSWORD` en la máquina local~~ | **Resuelto 17-sep: en `app/.env` (no como variable de usuario, como decía esta fila), login comprobado, e2e local 4/4** |
| 🟠 | **El C5 de `FORO-02` sigue sin cerrarse del todo (18-sep).** El PO revisó en `npm run dev` y señaló dos síntomas (`F-172`): "Crear hilo" sin acción y el buscador inconsistente con DIR-01. El primero era intencional (documentado, `disabled` con motivo). El segundo era real pero distinto de lo que parecía: ninguna pantalla tenía la "x" que el PO recordaba en DIR-01. El PO decidió el estándar y ya está aplicado en las dos pantallas (`F-172`) — **falta la confirmación final del PO sobre el resultado** | Álvaro: revisar de nuevo y confirmar C5 |
| 🟡 | **La cifra 7 está sucia en tres de las cinco pantallas medidas** (`ADMIN-01`, `FORO-02` y ahora `FORO-03`, 18-sep: 7,82 $ de delta en una sesión que ya traía encima el buscador y tres migraciones): son techos, no medidas limpias. Solo queda una pantalla (la sexta, de la remedición) para intentar una cifra 7 real | Quien corra la sexta: sesión nueva, solo para esa pantalla |
| ⚪ | ~~**El límite de 10 publicaciones por hora (RNG-FORO-06) no existe en la base.**~~ **Resuelto 18-sep-2026: `0031`/`0032`, aplicadas y comprobadas contra el catálogo de las dos bases.** La primera versión del disparador tenía un bug real (`F-173`: `security definer` hacía que el bypass de siembra se activara siempre) cazado en Postgres desechable antes de tocar nada real | Corriente A |
| 🟡 | **`F-172`: el estándar de buscador (input+lupa integrada+"x" al escribir) solo está aplicado en DIR-01 y FORO-02.** `INV-01`, `Messages.tsx` (MSG-01) y `SentOffers.tsx` siguen con su implementación propia, sin la "x" y (en INV-01) con la lupa a la izquierda | Quien toque esas pantallas: migrar a `components/SearchField.tsx` |
| 🟡 | **`F-178`: el foro no tiene reset/teardown, así que un e2e que reaccione y desreaccione en la misma corrida puede dejar un residuo si esa corrida se cancela a medias** — ya pasó una vez (reacción huérfana de `alpha@bearingworld.test` en `ogdhyzgjjbbikjbkhxmu`, borrada a mano el 18-sep). Dos vías sin aplicar: sumar el foro a `resetDemo`, o probar reacciones solo con mocks | Quien toque el e2e del foro de nuevo |
| ⚪ | **Resuelto 17-sep: decisión del PO (sembrar antes de cada corrida), automatizada en `resetDemo` y probada reproduciendo el fallo.** ~~`F-169` · una prueba a mano de `ADMIN-01` sobre la base de producción descuadra la siembra~~ (pasó en la C5 del 17-sep: una aprobada, una rechazada y devuelta). Repuesta el mismo día; la causa sigue: la próxima corrida del arnés le cobraría al Coder un fallo de datos | PO: resembrar antes de cada corrida de `ADMIN-*`, o C5 sin pulsar acciones |
| 🟠 | **El riesgo de la salida abrupta ya no se pierde, se CONCENTRA en el ADMIN.** Con Q-1 cerrada, la consecuencia 7.1 desaparece porque el ADMIN conserva copia de todo — y por eso el día que el ADMIN se vaya de golpe o pierda su frase, la organización pierde lo único que quedaba. La recomendación (más de un ADMIN) **tiene que llegar a la interfaz**, no quedarse en el ADR | Producto, cuando se diseñe el alta de miembros |
| 🟠 | **La residencia sigue siendo el entregable con reloj — la infraestructura GCP ya está, el bloqueo es una revisión externa.** `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com`; el proyecto GCP, la facturación, la API y la cuenta de servicio están creados y verificados (§1), pero el cupo de Vertex AI para Claude Sonnet 5 exige aprobación de Anthropic vía Model Garden — `429 RESOURCE_EXHAUSTED` en cada comprobación de hoy, sin fecha | Anthropic: aprobar la solicitud de Model Garden (fuera del control de este repo) |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando. **Nota 6-sep:** el *job* `deploy` nuevo usa un `SUPABASE_ACCESS_TOKEN` de CI aparte, así que no hereda este bloqueo | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito** (ahora en la cuenta nueva, `alvaro-7494`), que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: siete** (raíz + seis), contados el 20-sep con `git worktree list`. Subió de cinco: esta sesión creó dos —`admin-02-code-generation-9a0220` para el brazo de DeepSeek y `exp-admin-02-atria` para el de Atria— y el segundo se borró al cerrar, a petición del PO, dejando las dos ramas. Los cuatro fantasma de siempre siguen en `43bb222`, tres de ellos ya en `detached HEAD`. **Séptima comprobación seguida sin que la hipótesis de lanzar desde la raíz se pruebe ni se refute** | Fuera de sesión |
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
| ⚪ | **Resuelto 17-sep: el PO decidió que manda la regla; ejemplo corregido de 18 a 30 h en la spec (dos copias) y en el HTML aprobado.** ~~`F-158`, y es del PO: la spec aprobada de `ADMIN-01` se contradice a sí misma.~~ Su tabla de columnas dice *"en naranja si > 24h, en rojo si > 48h"* y su bloque de ejemplo pinta en naranja una solicitud de *"Hace 18 horas"*. Cada lectura lleva a una pantalla distinta. El código sigue la REGLA y lo deja escrito en los tres sitios donde alguien podría arreglarlo al revés, así que **no bloquea la construcción**; lo que no puede arreglar el código es el documento | Producto: corregir la spec |
| ⚪ | **Barrido hecho 17-sep: once contradicciones más, `F-170`, en `openspec/v1/barrido-specs-F158.md` — cerradas las once el mismo día.** ~~Nadie ha mirado si las otras 30 specs aprobadas tienen la misma clase de contradicción que `F-158`.~~ Salió por casualidad, porque la siembra de demo se verifica a sí misma y exigía una fila de cada color. Un barrido cuesta poco y no se ha hecho | Cualquier sesión, antes de que la fábrica construya sobre ellas |
| ⚪ | ~~ADMIN-01 no se puede probar de extremo a extremo: no hay cuenta de Operador~~ | **Resuelto 11-sep-2026: cuenta creada por el PO en las dos bases, dada de alta por el MCP, alcance comprobado desde su propia sesión y `E2E_OPERATOR_PASSWORD` en los secretos de CI.** La rama de sesión del shell, que era la otra mitad y no se sabía, también |
| ⚪ | ~~Y la otra mitad, que el Día 13 dejó fuera de alcance a propósito: los disparadores, las expresiones de política y la función Edge — todo lo que corre sin que ningún RPC del cliente lo invoque~~ | **Resuelto 11-sep-2026 (Día 14): ninguno tiene la forma.** Los siete disparadores de `app` no leen ninguna tabla; las dos políticas con `EXISTS` anidado imponen ya la misma condición que la RLS anidada aplicaría; `vera/index.ts` no toca Postgres. Anclado con cuatro asertos y una canaria en `01_schema_smoke.sql`, sin migración |
| ⚪ | ~~`F-160`: `--seco` escalaba en falso en las seis tareas del corpus~~ | **Resuelto 11-sep-2026 (Día 15): `_columna()` en `dry_run.py`, lee el CSV por nombre de columna, no por substring de la línea.** Verificado con `python -m harness.tests.dry_run` y `--seco` sobre las tres tareas nuevas y `SRCH-01` |
| ⚪ | ~~Las tres corridas del paso 5 de `UMBRAL-FABRICA-V1.md` §7 no pueden correr en una sesión remota~~ | **Resuelto 13/14-sep-2026 (Día 16): corridas en Claude Code local, en la máquina del PO, donde `DEEPSEEK_API_KEY` sí está** —confirmado como variable de usuario de Windows, no en `app/.env` como se daba por hecho. Las tres pantallas corrieron y llegaron a `PASA` |
| 🟡 | **La siembra de cobros envejece y ningún reseteo la re-ancla.** `demo_billing.sql` es relativa a hoy y solo se re-ancla corriéndola a mano por psql o por el MCP; `demo-reset.mjs` NO la incluye, porque `billing_payments` solo admite `INSERT` para `service_role` (0034) y desde JS no se puede reponer un pago | Decidir si `resetDemo` la incorpora vía un verbo `security definer` o si se acepta resembrar a mano antes de cada corrida. El e2e falla en voz alta si falta un estado, así que no hay verde falso |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) y suspender oculta el inventario de esa organización en búsqueda y directorio | Decisión de producto del PO, sin tomar; hoy se implementa literal |
| 🟠 | **`F-163`, cerrado pero con una secuela abierta: la sesión que corre las tareas no fue una sesión limpia por pantalla.** La misma sesión Haiku corrió `ADMIN-01` (original), `FORO-01` y la repetición de `ADMIN-01`; la cifra 7 de cada una se reconstruyó por diferencia de sesión, no midiéndose limpia desde el principio (§1). No cambia el veredicto —todas las cifras observadas están muy por debajo del techo—, pero la próxima tanda de corridas debería abrir una sesión de Code nueva por pantalla de verdad, no reutilizar la del terminal | Quien lance la próxima corrida: sesión nueva de Code, no una terminal reutilizada dentro de la misma |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si `billing_confirm_payment` y `billing_suspend_organization` funcionan de verdad desde
  la pantalla.** Sigue exactamente igual que ayer, y el e2e no puede cerrarlo: no escribe a
  propósito, porque un pago confirmado no se borra desde el cliente. Lo que hoy SÍ se ha
  probado con sesión viva es la LECTURA (8 filas por tres vías distintas) y la RLS del
  miembro. **La primera vez que alguien pulse «Confirmar pago recibido» en producción deja
  un pago permanente.**
- **Si el PO mantendría estas dos pantallas (C5).** Tres C5 pendientes, y de `ADMIN-02` no
  la ha visto nadie salvo la CI. Que pase 89 e2e no dice que se parezca a lo que el PO
  quiere: C3/C4 miran tokens e idiomatismo, no diseño.
- **Si el artefacto de Atria es igual de bueno que el de DeepSeek.** Los dos pasan los
  cuatro checks y las 15 pruebas de aceptación sin corrección a mano; **nadie ha comparado
  el CÓDIGO de los dos a ojo**, y la revisión que se hizo no es ciega: la hizo el mismo
  agente que montó el experimento sabiendo cuál era cuál.
- **Cuánta cuota de Atria se gastó de verdad.** Las tres corridas muertas generaron tokens
  que ningún `usage` devolvió —un stream cortado no manda contabilidad—, así que están
  pagados y no registrados. Lo que hay en el CSV es solo la corrida buena.
- **Por qué el stream de Atria se cortó a los 605 s.** Se midió que 435 s completan y que
  605 s no, pero no se ha probado dónde está el límite exacto ni si depende de la hora. La
  hipótesis —un tope de su pasarela— encaja con los dos `502` previos, pero es hipótesis.
- **Si la cifra 3 debe contar `ADMIN-02` como escalada.** Este fichero deja las dos
  lecturas escritas (§2) y no elige. **Es una decisión del PO, no de cálculo.**
- **Si el arreglo de `F-184` cambia algo medible.** Suena a que sí —el Coder vería por fin
  la razón de los fallos del e2e— pero nadie lo ha medido, y las cinco pantallas anteriores
  no se van a volver a correr para averiguarlo.
- **Lo que quedó sin verificar de la revisión adversarial del arnés:** 32 hallazgos, 7
  verificados antes de que el límite de uso cortara la sesión. Los arreglados están en el
  registro; los otros 25 **no están refutados, solo sin comprobar**, y viven en la
  transcripción del *workflow*, no en un documento.

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
    escalaba en falso por una columna del CSV que el detector no sabía leer). Del Día 16:
    `F-161` (cerrado — escalada de `DIR-01` no dependiente del artefacto, contagio de
    `ADMIN-01`), `F-162` (cerrado — escalada de `ADMIN-01`, tres bugs de test más
    contagio de `FORO-01` más un `TZ` sin fijar) y `F-163` (cerrado — tarifa de Haiku 4.5
    incorrecta, tumbaba el medidor de coste para cualquier pantalla). Del 17-sep, tras el cierre:
    `F-164` (cerrado — el push no disparó CI por el marcador de salto escrito en el cuerpo
    del mensaje, NO por el token de git), `F-165` (cerrado — `ci.yml` no pasaba las
    credenciales del Operador al job `e2e`, y con eso bloqueaba el despliegue), `F-166`
    (cerrado — C2 contaba como verde un e2e declarado que se había saltado; el de `ADMIN-01`
    no se había ejecutado nunca), `F-167` (cerrado — token renovado por el PO; VERA y la app se despliegan en jobs separados) y `F-168`
    (cerrado — la app de producción no arrancaba desde el 8-sep; ahora `deploy-app` lo
    comprueba por contenido) y `F-169` (cerrado — la C5 de `ADMIN-01` descuadró la siembra de
    producción; ahora `resetDemo` la repone antes de cada suite, decisión del PO). Y trece filas
    viejas que decían «Abierto» con el trabajo hecho, cerradas contra el código. Y `F-158`,
    cerrado el mismo 17-sep por decisión del PO: el ejemplo de la spec de `ADMIN-01` pasa a 30 h.
    Del 18-sep: `F-172` (cerrado en `DIR-01`/`FORO-02`, abierto en `INV-01`/`MSG-01`/`SentOffers`
    — estándar de buscador nuevo, decisión del PO en la C5 de `FORO-02`), `F-173` (cerrado —
    `security definer` rompía el propio guardia de `RNG-FORO-06`, cazado antes de tocar las
    bases reales), `F-174` (cerrado — la escalada de `FORO-03` era un test roto, no el
    artefacto), `F-175` (cerrado, sin acción — un commit intermedio heredó un rojo ya
    esperado sin saltar CI él mismo), `F-176` (cerrado, sin acción posible — un commit de
    documentación citó el marcador de salto ENTRE COMILLAS para explicar `F-175`, y eso
    bastó para que no disparara CI: mismo mecanismo que `F-164`, otra vez) y `F-177`
    (cerrado como comprobación, no como parche — el `GRANT` de tabla de sobra que la
    plataforma concede en casi todo `public` a `authenticated`/`anon` no es un agujero,
    comprobado empíricamente en Postgres desechable: RLS bloquea la escritura sin
    política pase lo que pase con el `GRANT`) y `F-178` (cerrado el mismo día, con deuda
    real pendiente — el job `e2e` de CI corre contra el proyecto aislado, no producción,
    y una reacción huérfana de un e2e cancelado a medias hizo escalar el CI de `0034`
    cuatro veces; borrada a mano, CI verde, pero el foro sigue sin teardown ni entra en
    `resetDemo`, así que el mismo residuo puede repetirse). Del 19-sep: `F-179` (cerrado —
    el mock de `ADMIN-02` sombreaba por posición la fila que no era, más la cita a *Acme* y el
    contador del chip; corregido en el HTML y en la spec por decisión del PO) y `F-180`
    (cerrado — `Cobros` como sexto ítem del nav del Operador, según el HTML aprobado).

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

*Día 16 de V1 · corridas hechas el 13/14-sep-2026, C5 y cierre el 17-sep-2026 · fecha
leída de la máquina (`date -u`) al escribir este cierre: `2026-09-17`, 07:46 UTC · arrancó
donde dejó el Día 15: paso 5 de `UMBRAL-FABRICA-V1.md` §7, las tres corridas reales ·
`DIR-01` y `ADMIN-01` escalaron primero (13-sep) por un instrumento roto, no por el
artefacto —`F-161`: contagio de `ADMIN-01` sobre `C1`; `F-162`: tres bugs en
`RequestDetailPanel.test.tsx` más contagio de `FORO-01` más un `TZ` sin fijar, ya
compensado por el propio Coder con su `utcClock()`—, los dos corregidos el mismo día sin
tocar el artefacto · `FORO-01` corrió limpia a la primera, `PASA` 4/4, y confirmó contra el
repo entero (`typecheck` + `test:arnes`, 770 pruebas) que no quedaba nada más pendiente ·
`F-163`: la tarifa de `claude-haiku-4-5-20251001` faltaba —y la que había puesta,
revertida dos veces sin comprobarla, era la de Haiku 3.5, retirado—, y sin ella el medidor
de coste no podía correr para NINGUNA pantalla; corregida contra la fuente oficial · con
las cuatro causas resueltas, `DIR-01` y `ADMIN-01` se repitieron enteras en sesión limpia:
las dos `PASA` 4/4 al segundo intento · **el PO dio C5 a las tres pantallas, sin ninguna
corrección**, resolviendo dos dudas contra el código en vivo (`RequestsTable.tsx`,
`Forum.tsx`) antes de responder · **el H1 se cierra: ocho cifras contra su fuente (§1),
falla solo la cifra 3 (0 de 3 al primer intento), veredicto Funciona con supervisión —
escenario base, 21 semanas, corriente B con dos agentes** · coste-sombra de orquestación al
cierre: **1.111,05 $** acumulados · nueve commits en `mvp/bootstrap`; los ocho primeros con
`[skip ci]` heredado de cuando el corpus estaba incompleto, el noveno —este cierre— sin él,
porque esa razón dejó de existir en cuanto las tres pantallas quedaron en verde: el paso 5
del ritual (desplegar y comprobarlo en su URL) se cumple con el CI de este push, no se
salta · `git status --short` releyéndose antes de empujar: limpio salvo los dos ficheros de
este mismo cierre (`ESTADO-V1.md`, `orchestration-metrics.csv`) · Dirección Técnica, Nortex
Systems*

*Día 17 de V1 · 17-sep-2026 · fecha leída de la máquina (`date -u`) al escribir este cierre:
`2026-09-17`, 20:11 UTC, el mismo día del trabajo · empezó contestando «¿listo?» con el relevo del
Día 16 delante y encontró que su adenda se equivocaba: `F-164` (el marcador de salto escrito en el
cuerpo del mensaje, no el token de git) · detrás, en cadena, `F-165` (CI sin credenciales del
Operador, y con ella nueve días sin desplegar), `F-166` (un e2e declarado que no se ejecutaba nunca
y que C2 contaba como verde), `F-167` (token de Supabase caducado, VERA y app desacopladas) y
`F-168` (**producción sin arrancar desde el 8-sep**, cerrada en su día con `curl` → 200) · `F-169`
(la C5 descuadró la siembra; repuesta y automatizada) · `F-158` cerrado y `F-170` cerrado el mismo
día: once contradicciones más en las specs aprobadas, cada una recomprobada a mano, dos decididas
por el PO y nueve aplicadas · trece filas del registro puestas al día contra el código · la carpeta
`Ingles/` archivada por decisión del PO · y la corriente B en marcha: `0030` a mano y **`FORO-02`
PASA 4/4 al primer intento**, la primera del proyecto, 0,037318 $ y 1,2 minutos · coste-sombra de
orquestación al cierre: **1.303,32 $** acumulados, **179,02 $** esta sesión, de los que **21,96 $**
son la corrida de `FORO-02` · 22 commits en `mvp/bootstrap` · queda el C5 de `FORO-02`, del PO ·
Dirección Técnica, Nortex Systems*

*Día 18 de V1 · 18-sep-2026 · fecha leída de la máquina (`date -u`) al escribir este cierre:
`2026-09-18`, 16:23 UTC, el mismo día del trabajo · sesión lanzada sobre uno de los cuatro
worktrees fantasma (`dia-14-correcciones-mvp-8160b9`, en `43bb222`), reseteado a
`origin/mvp/bootstrap` para trabajar de verdad · el C5 de `FORO-02` no salió limpio: el PO señaló
"Crear hilo" (intencional, no defecto) y un buscador inconsistente con `DIR-01` — que tampoco
tenía la "x" que se recordaba —, y decidió ahí mismo el estándar transversal (`F-172`): nuevo
`app/src/components/SearchField.tsx`, aplicado en `DIR-01`/`FORO-02`, deuda en `INV-01`/`MSG-01`/
`SentOffers` · `RNG-FORO-06` escrito a mano (`0031`/`0032`/`0033`) con un bug real cazado en
Postgres desechable antes de tocar las bases (`F-173`: `security definer` volvía permanente el
bypass de siembra del guardia) · `FORO-03` construida entera: capa de datos, wiring, contrato de
aceptación (23 pruebas + e2e real) y tarea, validada `--seco` sin avisos · la corrida real escaló
2/4 en los tres intentos, y no era el Coder (`F-174`: un test propio con datos mockeados que nunca
cambiaban) — corregido sin tocar el artefacto, 23/23 de unidad y **10/10 del e2e real** contra
`troxminloxkjwihwfevs`, incluida la reacción que se autolimpia · un commit intermedio salió rojo
por heredar ese mismo test roto sin saltar CI él mismo (`F-175`, sin acción), y uno de
documentación no disparó ningún run al citar el marcador de salto entre comillas para explicar
eso mismo -- mecanismo de `F-164`, otra vez (`F-176`, sin acción posible sobre lo ya hecho) · CI
final en seis jobs de seis verdes y producción sirviendo `FORO-03` verificado por contenido
(`index-DkCZ8HQ8.js`, 495.540 bytes) · coste-sombra de orquestación al cierre: **1.371,48 $**
acumulados, **54,45 $** esta sesión — sigue sin poder medirse limpia por pantalla (§1, §5), el
Coder: **0,143118 $** en los tres intentos de `FORO-03` · **van 5 de las 24 pantallas de la
fábrica, cifra 3 en 1 de 5, queda UNA para la remedición obligatoria** · el día siguió después de
ese primer cierre (regla 4): esquema de `ADMIN-02` escrito y aplicado (`0034`) —
`billing_accounts`/`billing_payments`/`billing_status_events`, la vista `billing_org_status`, los
verbos de confirmar pago y suspender, "ACTIVE"/"EN PRUEBA" como la misma fila
`organizations.status='APPROVED'` calculada y no guardada— validado en Postgres desechable y
comprobado contra el catálogo Y los datos reales de las dos bases; `Iniciar borrado` queda fuera a
propósito, documentado en la cabecera de `0034` · de paso, comprobado empíricamente que el `GRANT`
de tabla de sobra que la plataforma concede en casi todo `public` no es una puerta abierta —RLS
bloquea la escritura sin política pase lo que pase con el `GRANT`— deuda de higiene, no de
seguridad (`F-177`) · fecha releída al escribir ese pie: `2026-09-18`, 18:12 UTC, sigue el mismo
día · **el día siguió otra vez, regla 4:** empujar `0034` hizo escalar el CI 2/4 en cuatro
intentos seguidos, tres de ellos aislados sin ninguna otra corrida a la vez, mientras el mismo
e2e pasaba 14/14 en local — `F-178`: el job `e2e` corre contra el proyecto AISLADO
`bearingworld-e2e`, no contra `troxminloxkjwihwfevs` donde se había probado todo a mano, olvido
de esta misma sesión; ese proyecto tenía una reacción huérfana en el post de `c003` (2 en vez de
1), dejada por el propio test "reaccionar y quitar la reacción" cuando una corrida se canceló a
medias por un push posterior, lo mismo que ya había pasado dos veces hoy (`F-171`) · borrada la
fila exacta por SQL contra el catálogo de `ogdhyzgjjbbikjbkhxmu`, `forum_thread_list` verificado
de vuelta a sus cifras correctas, CI reintentado (`gh run rerun 35378570024 --failed`) y
**verde en los seis jobs**, `e2e` incluido · deuda real, sin resolver: el foro no tiene teardown
ni entra en `resetDemo`, así que el mismo residuo puede repetirse con cualquier test futuro que
reaccione y desreaccione dentro de la misma corrida — dos vías sin aplicar (sumar el foro a
`resetDemo`, o probar reacciones solo con mocks) quedan escritas en `F-178` y en §3/§5/§6, no
decididas · fecha releída de nuevo: `2026-09-18`, 18:45 UTC, sigue el mismo día · `git status
--short` limpio salvo este mismo cierre (`ESTADO-V1.md`) · 15 commits en `mvp/bootstrap` desde
el cierre del Día 17 · quedan DOS C5 sin cerrar (`FORO-02` con su corrección ya aplicada, y
`FORO-03` entera) y `ADMIN-02` sin tarea del arnés ni wiring de precondición —ninguno de los
tres cuenta como hecho · Dirección Técnica, Nortex Systems*