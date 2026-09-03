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
> **1-sep, comprobado otra vez, mismo resultado:** siguen siendo los mismos cuatro
> worktrees prunables de siempre (`bearing-io-mvp-estado-f2911a`, `bearing-mvp-bootstrap-
> 3bc0fc`, `dia-14-correcciones-mvp-8160b9`, `dia-4-f131-pending-003608`), todos anclados a
> `43bb222` -anterior a todo el trabajo de V1-, más la raíz al día. Ninguno nuevo, ninguno
> menos. Sigue sin probarse la hipótesis de lanzar desde la raíz.
>
> **3-sep, comprobado una tercera vez, mismo resultado:** `git worktree list` da los mismos
> cuatro prunables de siempre más la raíz, ahora en `185e0ce`. Tres jornadas seguidas sin que
> cambie ni un worktree, ninguno nuevo. La hipótesis sigue exactamente donde estaba.
>
> **Y un descubrimiento nuevo el 3-sep, de la misma familia que esta caja:** existe una
> SEGUNDA copia de este fichero en la raíz del repo (`ESTADO-V1.md`, sin `openspec/v1/`
> delante), **sin trackear por git**, casi idéntica a la tracked hasta hoy — alguna sesión
> anterior escribió en las dos sin que nadie lo dejara escrito. La de verdad es esta
> (`openspec/v1/ESTADO-V1.md`, la que aparece en `git log`); la de la raíz no se ha borrado
> por si alguna herramienta la espera ahí, pero **no es fuente de nada** y queda pendiente
> decidir si se elimina o se ignora en `.gitignore`.

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

**Día 6 de V1 · 3-sep-2026 · Estado: VERDE**

Este fichero se abrió hoy leyendo el segundo cierre del día 5 (`40067f7`, 1-sep), con
`F-141` y `F-142` cerrados y tres tareas para esta sesión: reescribir "Lista de hilos"
(la pieza que activa `visibility_scope`), otra remedición de `MSG-01` con `F-141` ya
puesto, y `D-3` (columna `quantity`). **Las tres se hicieron, y por el camino salieron dos
hallazgos nuevos (`F-143`, `F-144`), los dos cerrados el mismo día en que se midieron.**

**Antes de tocar SQL, un hueco real se paró a media frase.** `ADR-002` D-7 exige que el
ámbito por usuario sea opcional y apagado por defecto; nada en el esquema lo permitía —
`visibility_scope` (`0018`, 1-sep) quedó soldado al rol **sin condición, para el 100% de
las organizaciones**. Escribir `threads_select_participant` tal como D-1/D-8 lo piden
habría encendido el ámbito para todo el mundo, justo lo que D-7 prohíbe. Se paró la sesión,
se preguntó al PO, y la respuesta —añadir el interruptor ahora, ADR completo— es
`0019_threads_visibility_scope_toggle.sql`: `organizations.visibility_scope_enabled`
(octavo objeto de esquema que `ADR-002` §5 no tenía el 25-ago), más `threads_select_
participant` y `thread_items_select_participant` reescritas para considerarlo — las dos,
porque escribir solo la primera habría dejado un hueco real: con el ámbito encendido, un
`OWN` seguiría pudiendo leer los elementos de un compañero consultando `thread_items`
directamente en cuanto el hilo (compartido entre conversaciones independientes, `ADR-002`
§6) apareciera en su lista por tener un elemento propio — el invariante `V-6` roto por la
mitad que no se tocó. Probado local con dos organizaciones —una que enciende el ámbito,
otra que nunca lo toca— antes de aplicar al proyecto real.

**`D-3` fue el más barato, y no se quedó a medias.** `0020_thread_items_quantity.sql` añade
`quantity` a `thread_items` y la usa en `create_inquiry` (quinto parámetro, con default
para no romper al llamador de siempre) — y como dejar el quinto parámetro sin que nadie lo
mande habría sido la misma clase de "columna que nadie lee" que `visibility_scope` fue
durante dos días, `app/src/lib/thread-detail.ts` se actualizó en la misma sesión para
mandar la cantidad real. **Deliberadamente NO toca `OFERTA`:** `create_thread_item` y
`counter_offer` no conocen la columna todavía, y exigírsela hoy les habría roto el INSERT.

**La remedición de `MSG-01` repitió, otra vez, el patrón de "medir descubre lo que la
lectura no ve" — pero esta vez cada hallazgo se cazó y se cerró en la misma tanda que lo
produjo, sin que ninguno tocara la CI.** Primera serie (`12a`/`12b`, corpus con `F-141` ya
puesto): las dos fallan el intento 1 con el **mismo** `TS2322` — `TONE_CLASS: Record<
StateTone, string>` sin el `| undefined` que `noUncheckedIndexedAccess` exige para
cualquier clase de un módulo CSS. La corrida `12c` **no se lanzó**: el mismo síntoma dos
veces seguidas ya decía que el corpus estaba roto, y gastar un tercer intento no habría
medido nada nuevo. Declarado como `F-143`, corregido en `component_api`,
`python -m harness.tests.test_checks` en verde local antes de commitear. Segunda serie
(`13a`/`13b`/`13c`, con `F-143` ya puesto): **cero recurrencias del `TS2322`** en las tres —
`13b` pasa 4/4 al primer intento; `13a` necesita un segundo intento por un `import` por
defecto contra uno nombrado (variación ordinaria, autocorregida); `13c` necesita un segundo
intento por un hallazgo nuevo, `F-144`: el motivo de "Nuevo contacto" (`data-testid=
"directorio-scope"`, declarado desde `F-139`) nunca decía qué TEXTO tiene que llevar — el
literal `fuera del MVP` solo estaba declarado para el estado vacío de `ThreadList.tsx`
(`F-128`), un nodo distinto. **Y corregirlo chocó una segunda vez con la lección de
`F-140`:** el test que reconstruye "la tarea antes de `F-128`" truncaba solo
`ThreadList.tsx`, y la mención nueva en `Messages.tsx` sobrevivía intacta a esa
reconstrucción — `FALLAN 1` en local antes de tocar nada remoto, arreglado extendiendo el
truncado a un segundo marcador, sin relajar el aserto.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-03`, 17:56 UTC al escribir esto |
| El hueco de D-7 (ámbito opcional, apagado por defecto) no tenía objeto de esquema | `grep` de `visibility_scope_enabled`/`scope_enabled` contra `supabase/migrations/*.sql` y contra `docs/ADR-002*.md` §5, antes de escribir una línea de SQL | Cero resultados: ni el esquema ni la tabla de impacto de `ADR-002` §5 tenían el interruptor |
| `0019_threads_visibility_scope_toggle.sql` (interruptor + dos políticas reescritas) | Local: `supabase/tests/run.sh` (fase 1), con asertos nuevos de D-1/D-2/D-7/D-8 usando dos organizaciones. Remoto: `information_schema.columns`, `pg_policies.qual` y los datos reales del proyecto (`troxminloxkjwihwfevs`), por el MCP | Columna `boolean not null default false`; las 6 organizaciones sembradas, las 6 en `false`. `pg_policies.qual` de las dos políticas coincide literal con la migración, no con lo que la migración dice que hace |
| `0020_thread_items_quantity.sql` (`quantity` + `create_inquiry` con 5º parámetro) | Local: `supabase/tests/run.sh` (fase 1, con el guardia de `MENSAJE` sin `quantity` y el de cantidad negativa) y `npm test`/`npm run typecheck` en `app/`. Remoto: `information_schema.columns`, `pg_constraint`, `pg_proc` (una sola firma de `create_inquiry`, la de 5 parámetros — comprobado que el `drop function` no dejó las dos a la vez) | Todo verde. `app/src/lib/thread-detail.ts` manda `p_quantity` desde hoy; **no desplegado a Vercel** (§5) |
| `MSG-01`, serie `12a`/`12b` (corpus con `F-141`, antes de `F-143`) | `attempt_1.json` de las dos, campo `sources` | Las dos fallan `C1` con el mismo `TS2322` ×5 en `TONE_CLASS`. `12c` no se lanzó |
| `F-143` corregido, no reintroduce el mecanismo de `F-140` | `python -m harness.tests.test_checks`, corrido ANTES de commitear | Verde a la primera — el texto se añadió al final de `component_api` de `ThreadList.tsx`, sin tocar los anclajes de truncado |
| `MSG-01`, serie `13a`/`13b`/`13c` (corpus con `F-143`) | Los seis `attempt_N.json`, `harness-metrics.csv` | **Cero recurrencias del `TS2322` de `F-143`.** `13b`: 4/4 al primer intento. `13a`: 2 intentos, `import` por defecto vs nombrado (variación ordinaria). `13c`: 2 intentos, hallazgo nuevo (`F-144`) |
| `F-144` corregido, no reintroduce el mecanismo de `F-140` | `python -m harness.tests.test_checks`, corrido ANTES de commitear | Falló la primera vez (`FALLAN 1`): la mención nueva en `Messages.tsx` sobrevivía a la reconstrucción "antes de `F-128`". Corregido extendiendo el truncado a un segundo marcador; verde después |
| La CI de los cuatro pushes de hoy, job a job | `gh run view --json jobs` sobre `804dfe9`, `ce78a72`, `d3eb430` y `185e0ce` | Las **cuatro** piezas en verde en los cuatro pushes: Esquema, App, Arnés, Playwright |
| La suite del producto | `npm test` (tras `0020`, antes de los cambios de `harness/`, que no tocan `app/`) | **642 pasan, 23 saltadas** — mismo total que el 1-sep; el nuevo aserto de `p_quantity` vive DENTRO de un test ya existente, no suma uno |
| Los worktrees | `git worktree list` | Los mismos cuatro prunables de siempre + la raíz, en `185e0ce`. Ninguno nuevo hoy, tercera comprobación seguida con el mismo resultado |
| Estado del árbol al cerrar | `git status` | Limpio salvo `openspec/design-gui/Ingles/`, sin tocar hoy y ajeno a esta sesión |
| Artefactos crudos del Coder (`app/src/screens/messages/*`) | `git status` tras cada corrida | Descartados con `git checkout --` antes de cada commit, cinco veces (`12a`, `12b`, `13a`, `13b`, `13c`) — ninguno se commiteó sobre la pantalla revisada |
| La copia sin trackear de este fichero en la raíz del repo | `git ls-files \| grep ESTADO-V1` y `git status --short ESTADO-V1.md` | Confirmado: `openspec/v1/ESTADO-V1.md` es la única trackeada; la de la raíz es `??` y casi idéntica hasta hoy — ver caja de arriba |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-142` | ✅ ver cierres anteriores en `git show 40067f7` |
| **`F-143` `TONE_CLASS` de `ThreadList.tsx` sin `\| undefined` (`noUncheckedIndexedAccess`)** | ✅ **3-sep · `d3eb430`** |
| **`F-144` el motivo de "Nuevo contacto" sin el literal `fuera del MVP` declarado** | ✅ **3-sep · `185e0ce`** |
| Medición del corpus de `MSG-01`, con `F-143`/`F-144` ya puestos | 🟡 Sin remedir todavía — la serie `13a`/`13b`/`13c` es la que ENCONTRÓ `F-144`, no la que mide el corpus ya con los dos arreglos dentro |
| `MSG-01` a 4/4 sin reintentos | 🟡 1 de 3 (`13b`) al primer intento en la última serie; `13a` y `13c` necesitaron uno, por motivos ya cerrados y sin relación entre sí |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5) | ✅ **1-sep · `087962b`** |
| `visibility_scope` (D-4, `ADR-002` §5) | ✅ **1-sep · `f5ea8fc`** |
| **`organizations.visibility_scope_enabled` (D-7, octavo objeto — no estaba en `ADR-002` §5 del 25-ago)** | ✅ **3-sep · `804dfe9`**, `0019_threads_visibility_scope_toggle.sql` |
| **Lista de hilos (`threads_select_participant`) y `thread_items_select_participant`** | ✅ **3-sep · `804dfe9`** — las dos, por el invariante `V-6` (ver arriba) |
| **`D-3` (`thread_items.quantity`)** | ✅ **3-sep · `ce78a72`**, solo `CONSULTA` vía `create_inquiry` — `OFERTA` sigue sin ella, a propósito |
| Resto de la Fundación (entregables 1-3, 6; `thread_public_keys(t_id)`; `create_inquiry` con el reparto de destinatarios de D-1; `quantity` en `OFERTA`) | 🔴 Sin cambios |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

1. **Remedir `MSG-01` una tercera vez (n=3), con `F-143` Y `F-144` ya en el corpus desde el
   principio.** La serie `13a`/`13b`/`13c` midió el corpus mientras `F-144` todavía estaba
   sin descubrir — es evidencia del hallazgo, no la medida de un corpus ya completo. Es la
   primera vez que se puede preguntar de verdad si el marcador sube a 3/3 en 4/4.
   ~$0,10 por tirada, tres tiradas.
2. **`thread_public_keys(t_id)` (`ADR-002` §5): deja de devolver todos los miembros de las
   dos organizaciones, pasa a devolver el conjunto que fija D-1.** Es la pieza que falta
   para que `create_inquiry` pueda cambiar el reparto de destinatarios de la CEK sin
   romper el envoltorio de claves del primer contacto (`0014` §1).
3. **`create_inquiry`: el reparto de destinatarios de la CEK deja de ser «todos los
   miembros».** Depende de (2). Es la última fila roja de `ADR-002` §5 que no es
   `OFERTA`/`quantity`.
4. **`quantity` en `OFERTA`** (`create_thread_item`, `counter_offer`): mismo patrón que
   `D-3` para `CONSULTA`, pendiente desde hoy a propósito.
5. **Vercel no se ha redesplegado.** `create_inquiry` ya acepta `p_quantity` y `app/src/
   lib/thread-detail.ts` ya lo manda, pero lo que corre en producción sigue siendo el
   código de antes — ninguna consulta nueva escribirá `quantity` en claro hasta que alguien
   redespliegue (`CLAUDE.md` §10.2).
6. **Decidir qué hacer con la copia sin trackear de este fichero en la raíz** — borrarla o
   meterla en `.gitignore` con una nota, para que no vuelva a escribirse sin querer.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes, y un octavo objeto de esquema que el 25-ago no tenía (D-7).** Cuatro de siete objetos originales hechos, más el octavo | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **D-7 se implementa con interruptor ahora, no se difiere** | 3-sep-2026, PO. `organizations.visibility_scope_enabled`, apagado por defecto, lo activa el ADMIN de la propia organización por la misma vía que `inventory_visibility_mode` (INV-07) | `0019_threads_visibility_scope_toggle.sql`, adenda en `ADR-002` D-7 |
| **`D-3` se limita a `CONSULTA` en esta pieza** | 3-sep-2026. `OFERTA` tiene su propio campo `quantity` en `OfferContent` (cliente) sin conexión con la columna todavía; conectarla es la siguiente pieza, no esta — exigirla hoy rompía `create_thread_item`/`counter_offer` | `0020_thread_items_quantity.sql` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. Sigue sin desplegarse — entregable 6 de la Fundación, sin fecha | Plan §4.2, `FUNDACION-V1.md` §1 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió. Las filas inválidas se marcan, no se borran | 25-ago · `F-129` |
| **El guardia AVISA, no bloquea** | Vale para los roles (`F-127`), lo buscado por regex (`F-130`) y los roles estructurales (`F-131`). Es una **medida**, no una preferencia | `F-127`, `F-130`, `F-131` |
| **`C2` corre SIEMPRE la suite e2e ENTERA** | `D-09-03 (a)`, 12-ago. Su motivo (`F-070`) sigue en pie | `test_runner.py` |
| **Un verde con excusas se MARCA en el CSV** | 30-ago. Un verde con asterisco agregado como verde limpio es `F-129` otra vez | `F-134` |
| **Los logs de corrida se versionan, y los escribe la corrida** | 30-ago | `F-115`, `F-136` |
| **El 57 a 1 se acepta, sin acción** | 1-sep-2026, PO | `F-113` |
| **Un artefacto crudo del Coder no se commitea sobre una pantalla ya revisada** | Aplicado cinco veces más hoy (`12a`, `12b`, `13a`, `13b`, `13c`) sin necesidad de pedirlo | `CLAUDE.md` §1.6 |
| **Lo que el contrato exige, la tarea lo dice** | **Diecisiete veces en siete días.** La vía elegida ha sido siempre la misma: declararlo en `component_api`, sin tocar ni un aserto | `F-116`, `F-118`, `F-123`, `F-125`–`F-128`, `F-131`, `F-134`, `F-137`–`F-144` |
| **Reunión con el socio del 20-ago** | 3-sep-2026, PO: fue bien, se continúa con el plan. Asunto cerrado — no vuelve a §5 ni §6 | — |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **La Fundación V1 tiene un entregable con reloj: la residencia.** Sin cambios hoy — sigue llamando a `api.anthropic.com`, sin fecha puesta | Álvaro |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Sin cambios | Álvaro: 20 $/mes |
| 🟡 | **Vercel no redesplegó hoy.** `create_inquiry` acepta `p_quantity` desde `ce78a72` y el cliente ya lo manda, pero producción sigue en el código de antes: ninguna consulta nueva escribe `quantity` en claro hasta el próximo despliegue | Redesplegar `app/` (manual, `CLAUDE.md` §10.2) |
| 🟡 | **Los worktrees: siguen siendo cinco** (raíz + cuatro) — tercera comprobación seguida con el mismo resultado, hoy contra `185e0ce` | Fuera de sesión, desde la raíz |
| 🟡 | **Copia sin trackear de este fichero en la raíz del repo** (`ESTADO-V1.md`, hallada hoy) — no es fuente de nada, pero puede confundir a la próxima sesión si alguien lee de ahí | Borrarla o documentarla en `.gitignore` |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| ⚪ | ~~`visibility_scope` existe pero nada la lee todavía~~ | **Resuelto 3-sep-2026: `0019` la conecta, con el interruptor de D-7 delante** |
| ⚪ | ~~`Lista de hilos` y `thread_items_select_participant` sin reescribir~~ | **Resuelto 3-sep-2026: `0019`** |
| ⚪ | ~~`D-3`: columna `quantity` en `thread_items`~~ | **Resuelto 3-sep-2026: `0020`, solo `CONSULTA`** |
| ⚪ | ~~`MSG-01` sin remedir con `F-141` ya puesto~~ | **Resuelto 1-sep-2026: 3 de 3 en verde** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si el marcador de `MSG-01` sube de verdad a 3/3 en 4/4 con `F-143` Y `F-144` ya puestos
  desde el principio.** La serie `13a`/`13b`/`13c` midió mientras `F-144` seguía sin
  descubrir; hasta la próxima serie, es una expectativa, no un dato.
- **Cuántos huecos de la familia `F-116`–`F-144` quedan por descubrir en `MSG-01`.**
  Diecisiete instancias en siete días y cada serie de tres corridas ha encontrado al menos
  una nueva desde `F-137`. No hay forma de saber si la próxima serie sale limpia o
  encuentra la dieciocho sin medir.
- **Si `visibility_scope_enabled` y la derivación de la lista aguantan bajo carga.** Hito 6.
  Con el interruptor, las dos políticas y el índice de `0017` ya puestos, es lo primero que
  se puede medir en cuanto haya tráfico real que medir.
- **Si `quantity` en `OFERTA` va a tropezar con el mismo tipo de hueco que `CONSULTA`** —un
  `component_api` que no declare bien el tipo o la forma— cuando se conecte. No se ha
  mirado todavía.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** `13a` necesitó
  un segundo intento por una variación ordinaria (import por defecto/nombrado) que ningún
  `F-` explica — sigue siendo la misma pregunta abierta desde `F-137`.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sin datos nuevos hoy.
- **Desde cuándo existe la copia sin trackear de este fichero en la raíz**, y si alguna
  sesión anterior la usó como si fuera la de verdad. No se ha investigado el historial de
  ninguna herramienta que pudiera haberla creado.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas. **Y comprueba
   el contenido, no el continente** (`F-132`).
3. **Revisar §2 contra el código**, no contra el §2 de ayer. Toda pieza marcada como
   pendiente se comprueba en el fichero real ese mismo día.
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

⚠ **Y el paso cero, que es la regla 4: no cierres hasta que se acabe.** El día 3 se cerró a
las 12:33 y siguió hasta las 13:45. El día 4 se cerró a las 11:22 y siguió hasta las 12:31.
El día 5 lo cumplió dos veces corriendo `test_checks.py` antes de commitear en vez de al
cerrar. **El día 6 lo repitió dos veces más, con dos hallazgos distintos (`F-143`,
`F-144`) y ninguno tocó la CI.**

⚠ **Y este fichero se escribe en `openspec/v1/ESTADO-V1.md`, no en la raíz del repo** — ver
la caja del principio. Comprobar `git status --short` después de escribir, no solo antes.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado hoy: `visibility_
   scope_enabled` (D-7), Lista de hilos, `thread_items_select_participant` y `D-3`.
3. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**.
4. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
   `ADR-002` tiene adenda de hoy en D-7 y §5 (octavo objeto). Quedan rojas: `thread_public_
   keys(t_id)`, `create_inquiry` (reparto de destinatarios) y `quantity` en `OFERTA`.
5. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
6. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
7. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno. Hoy: `F-143` y `F-144`.

---

*Día 6 de V1 · 3-sep-2026 (17:56 UTC) · fecha leída de la máquina (`date -u`) · estado
verificado contra el código de `mvp/bootstrap`, contra `information_schema`/`pg_policies`/
los datos reales del proyecto `troxminloxkjwihwfevs`, contra la CI job a job de los cuatro
pushes de la sesión y contra la salida de cinco corridas pagadas más — no contra otro
documento · **los dos hallazgos del día se cazaron en local antes de commitear, no al
cerrar** · Dirección Técnica, Nortex Systems*
