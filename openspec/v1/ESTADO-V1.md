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

**Día 14 de V1 · 11-sep-2026 · Estado: CERRADO**

La otra mitad de la misma pregunta, la que el Día 13 dejó fuera de alcance a propósito
porque `F-155` hablaba de `app/src/lib/`: **¿y todo lo que corre por debajo sin que ningún
RPC del cliente lo invoque?** Disparadores, funciones internas de `app`, las expresiones
de las propias políticas de RLS, y la función Edge. Auditado hoy contra el criterio exacto
de la familia —un `SELECT`/`EXISTS` bajo RLS dentro de código `security invoker` cuyo
resultado vacío **decide** en vez de fallar—. **La respuesta es que no hay ninguno más, y
por una razón más fuerte que la esperada.**

**Los siete disparadores `security invoker` de `app` no leen NINGUNA tabla.** No es que su
lectura esté bien resuelta: es que no hay lectura. `guard_member_privileges`,
`guard_offer_decider`, `guard_offer_terminal_state`, `guard_organization_columns`,
`guard_thread_state`, `touch_item_estado` y `touch_updated_at` deciden con `OLD`/`NEW`,
`current_user`, `auth.uid()` y ayudantes `security definer`. Todo lo que en `app` sí lee
tablas —las otras 21 funciones— es `security definer`, y las 23 `definer` de `app`/`public`
son de `postgres`, el dueño de las tablas: RLS no les aplica. La fuente fue el catálogo de
la base (`pg_proc`, `pg_trigger`, `pg_policies`, `pg_class`), no los `.sql`, y el barrido
se repitió en `troxminloxkjwihwfevs` y en `bearingworld-e2e` con el mismo resultado.

**Las 20 políticas de RLS de `public`, leídas una a una.** Dos leen otra tabla con RLS
dentro de su propia expresión, que es la forma exacta de `F-148`:
`thread_items_select_participant` y `threads_select_participant`, las dos con un `EXISTS`
sobre `thread_item_keys`. No es un hueco: la RLS anidada de esa tabla filtra por
`recipient_member_id = auth.uid()`, **la misma condición que el `EXISTS` ya impone**, así
que no puede esconder ninguna fila que el `EXISTS` fuera a contar.

**`vera/index.ts` queda fuera de la familia por construcción, no por auditoría.** Leído
entero: no toca Postgres en ningún punto —importa el SDK de Anthropic y `tools.json`, y de
la petición solo mira que traiga cabecera `Authorization`—. Es además la única función
Edge del repo.

**Sin migración nueva, a propósito: no había nada que corregir.** `0026` sigue siendo la
última y el contador de hallazgos sigue en `F-156`. Pero **un resultado negativo no se
guarda en un documento, se ancla** — caduca con la próxima migración, y este es el tipo de
invariante que nadie vuelve a comprobar a mano. Cuatro asertos nuevos en
`01_schema_smoke.sql`, ninguno con nombres de tabla escritos a mano (salen de `pg_class`,
así que una tabla con RLS nueva queda cubierta sin tocar el fichero):

1. **La superficie permitida.** Ninguna función `security invoker` de `app`/`public` fuera
   de las seis auditadas —las tres RPC del Día 13, las dos de demo y el falso positivo de
   `guard_member_privileges`, cada una con su porqué escrito al lado— puede nombrar una
   tabla con RLS.
2. **Una canaria que demuestra que el detector detecta.** Se crea una función `invoker` que
   lee `thread_items` y se exige que el detector la nombre. Sin esto, el aserto 1 pasaría
   en vacío el día que el barrido dejara de medir — que es exactamente como `F-146`
   sobrevivió desde `0012`.
3. **Nada de SQL dinámico en código `invoker`.** El detector lee el CUERPO de la función:
   una tabla nombrada dentro de un `execute` compuesto en tiempo de ejecución no aparece
   ahí. Hoy no hay ni una sola función así, comprobado contra el catálogo.
4. **La premisa de la inmunidad de `security definer`**, que no es un axioma: ninguna tabla
   con `FORCE ROW LEVEL SECURITY` y ninguna función `definer` de otro dueño. Si cualquiera
   de las dos cae, `F-148` renace entero, en silencio y en todas partes a la vez.

**Verificación de cierre:** `supabase/tests/run.sh` completo (`ESQUEMA VERDE` + `CATALOGO
VERDE` + `FRESCURA VERDE`), con la canaria detectada por su nombre. **Entregable 6
recomprobado hoy con una llamada real** `rawPredict` (región `eu`, `claude-sonnet-5`,
proyecto `bearingworld-vera-eu`): `HTTP 429 RESOURCE_EXHAUSTED`, mismo mensaje palabra por
palabra que el 8 y el 10-sep. Sin movimiento.

**Adenda del mismo día, a petición del PO: dónde estamos respecto al plan V1 v2.3, y qué
falta para el H1.** Cerrar no es terminar, y el día siguió. Se leyó el plan y se contrastó
contra el repo, pieza a pieza. **Estamos en la semana 3, que es exactamente la del H1**
(«la fábrica está medida»), con la banda de semanas 3–5 —la Fundación— casi entera hecha y
la de semanas 1–3 con cuatro de sus cinco piezas cerradas: tabla de precios con fecha de
vigencia, manifiesto de dependencias con LangGraph fijado en su versión exacta, coste de
orquestación instrumentado, y el arreglo del bucle convertido en medición. **La quinta,
diseñar y medir la fábrica, es la que cierra el hito y es la que faltaba.**

De esa quinta se cerró hoy la primera mitad: **`UMBRAL-FABRICA-V1.md`, el umbral escrito
ANTES de medir** — la condición literal que la tabla de riesgos del plan le pone al H1 y
que no existía en ningún sitio. Ocho cifras con su umbral y el origen de cada una, tres
veredictos atados a los tres escenarios de calendario del propio plan (18, 21 o 30
semanas), cuatro reglas anti-trampa y una §6 de lo que el umbral NO mide. **La más honesta
de esas advertencias: la corrección humana tiene una muestra de dos** —solo VND-01 y
LOGIN-01 se revisaron con el bucle ya arreglado—, que es justamente la razón de ser del
hito.

**Y una corrección de estado, que es la mitad incómoda de la adenda.** El informe al PO
dijo que la tarea de `SRCH-01` seguía sin actualizar desde la decisión de `F-118`. **Es
falso, y la fuente del error fue leer el registro de hallazgos en vez del repo:** la tarea
se actualizó el 29-ago en `1183a38` —declara `veraCriteria` con la instrucción de
ignorarla, y el test de VERA salió a `*.fuera-de-contrato.test.tsx`— y `SRCH-01` se midió
**14 veces** ese mismo día. Lo que estaba desfasado era la casilla de estado de `F-118`,
trece días diciendo «Abierto» con el arreglo hecho, comitteado y medido. Corregida hoy
contra `git log` y contra el CSV. **Es `F-012` otra vez, y esta vez llegó a un informe de
estado antes de que alguien la cazara.**

**Segunda adenda: el PO confirma las tres pantallas del H1, y arrancando por `DIR-01`
aparece `F-157`.** Confirmadas `DIR-01`, `ADMIN-01` y `FORO-01` —directorio, alta de
empresas y foro—, escritas en el umbral antes de que exista una sola línea de ninguna de
las tres. `REG-07`, que iba en la propuesta inicial, se cayó al leer su spec: es generación
de claves, o sea criptografía, y el Plan §4.3 dice que el generador no la toca. **Se
propuso sin haberla leído, y eso queda escrito en el umbral, no solo aquí.**

Y al correr el paso 4 de `UMBRAL-FABRICA-V1.md` §7 —el medidor del coste de orquestación,
para dar línea base a la cifra 7— salió **`F-157`: el medidor borraba su propia historia
cada vez que se usaba.** Una ejecución normal se llevó por delante once filas de agosto,
387 $ de coste ya medido. La causa estaba escrita en su propio docstring, con la premisa
correcta y la conclusión equivocada: *«cada pasada relee todas las transcripciones vivas,
así que añadir duplicaría cada sesión»* — cierto, pero lo que hacía falta no era añadir,
era **fundir por clave**. Cerrado el mismo día con `fusionar()`, historia restaurada desde
el commit anterior y siete comprobaciones nuevas en `test_checks.py`. **Línea base del H1:
21 filas, 887,77 $ acumulados, de los cuales 550,25 $ son de V1.**

**Tercera adenda: arranca `DIR-01`, y la capa de datos descubre que la pantalla no era
gratis.** El PO pidió empezar por el directorio. Al cruzar su spec con el esquema —no al
leer una de las dos— aparecieron **tres desajustes**, y los tres habrían salido como
defectos del Coder si nadie los mira antes:

1. **Dos de las cinco columnas de la tabla no existen.** Teléfono y Email de contacto no
   están en `organizations`. **Esto corrige lo que se le dijo al PO al proponer la
   pantalla** —que corría sobre la tabla *"tal como está"*—, y la corrección está escrita
   en el umbral y en la cabecera de la migración, no solo aquí.
2. **La spec dice `ACTIVE` y ese estado no existe.** El `CHECK` admite `PENDING_REVIEW`,
   `APPROVED`, `REJECTED` y `SUSPENDED`. Lo que la spec llama *"organizaciones activas"* es
   `APPROVED`.
3. **La política de lectura deja ver la organización propia en cualquier estado**, así que
   sin un `.eq('status','APPROVED')` explícito una organización propia en revisión se vería
   a sí misma en el directorio público. Misma forma que el `.neq` de `SRCH-01`: no falla
   nada, sale una fila que no debería estar.

**`0027`** añade las dos columnas con sus dos `CHECK` y —esto es lo que no es obvio— las
mete en `app.guard_organization_columns`: **una columna nueva no entra sola en ese
guardia**, y nacía editable por cualquier ADMIN vía una política que filtra por
organización y no por columna. Cinco asertos nuevos en `01_schema_smoke.sql` lo fijan, con
ancla positiva incluida para que el bloque no mida que el ADMIN no puede tocar nada.
Verificada contra un Postgres desechable ANTES de aplicarla, y aplicada después a las dos
bases con el catálogo releído (columnas, `CHECK` y cuerpo del guardia) en vez de creerle al
`{"success":true}`. `get_advisors` sin avisos nuevos.

**`app/src/lib/directory.ts`** y su prueba quedan escritos a mano, que es lo que exige el
umbral: la capa de datos es precondición de la pantalla, no producto de la fábrica. 15
pruebas en verde y typecheck limpio. **Lo que NO se hace en esta sesión, a propósito: la
tarea, los tests de aceptación y la corrida.** Esa es la unidad que mide el H1 y debe
correr en una sesión limpia, o la cifra 7 le imputaría a `DIR-01` el coste de la auditoría
de `F-155`, del plan y del umbral. Esta sesión ya lleva 35,42 $.

**Cuarta adenda: `ADMIN-01`, y dos cosas que no se sabían al elegirla.** Segunda capa de
datos de las tres. Al contrario que `DIR-01`, esta pantalla **no tenía ni una fila de
esquema debajo**: `0028` estrena tres tablas —la cola del FSR, su historial y los
operadores— dos disparadores y un actor que el proyecto no tenía, el **Operador de
Plataforma**, que no pertenece a ninguna organización.

**La decisión que la migración toma y el PO puede revocar barato:** el operador se resuelve
con una tabla y un ayudante `security definer`, igual que `app.is_org_admin()`, en vez de
con un *claim* en el JWT o con una función de borde. Las tres opciones están escritas en la
cabecera de `0028` con su porqué; si el PO prefiere otra, lo que cambia es
`app.is_platform_operator()` y las cuatro políticas que la invocan.

**Y dos hallazgos, los dos cazados por asertos escritos ANTES de aplicar nada:**

- **Un `CHECK` que dejaba pasar justo lo que prohibía.** Estaba escrito como
  `(state = 'REJECTED' and char_length(...) between 10 and 500) or (state <> 'REJECTED' and
  ... is null)`, y con el motivo a `NULL` la primera rama vale `NULL`, la segunda `FALSE`, y
  **`NULL or FALSE` es `NULL` — y un `CHECK` que da `NULL` PASA**. Un rechazo sin motivo
  entraba sin una queja. Reescrito con `case`, que nunca devuelve `NULL`. No llegó a la base
  real: lo paró el banco de pruebas contra el Postgres desechable.
- **`F-158`: la spec aprobada de `ADMIN-01` se contradice a sí misma.** Su tabla de columnas
  dice *"en naranja si > 24h, en rojo si > 48h"* y catorce líneas más abajo su bloque de
  datos de ejemplo pinta en naranja una solicitud de *"Hace 18 horas"*. Las dos no pueden
  ser ciertas, y cada una lleva a una pantalla distinta. **Manda la regla**, y queda escrito
  en los tres sitios donde alguien podría arreglarlo al revés. Lo cazó la siembra de demo,
  que se verifica a sí misma exigiendo una fila de cada color y salió con dos.

**Lo que `ADMIN-01` necesita y esta sesión no puede dar: una cuenta de Operador.** `0028`
no crea ninguna a propósito. Sin ella la pantalla no se ve, no se prueba de extremo a
extremo, y su tarea no puede declarar un test e2e que la ejercite. **Es lo único de las tres
pantallas que depende del PO.**

**Quinta adenda: `FORO-01`, y con ella el paso 2 del hito queda cerrado.** Tercera y última
capa de datos. El foro es **la única parte no cifrada del producto**, así que aquí no hay
CEK ni reparto de claves: hay texto plano y un aviso permanente en pantalla que lo dice.
`0029` estrena tres tablas —categorías, hilos y publicaciones—, una vista para los
contadores de la tarjeta y dos disparadores.

**Tres decisiones que la migración toma y deja escritas:**

- **Las cuatro categorías van en la migración, no en la siembra.** La spec las llama *"las
  cuatro categorías de lanzamiento"* y las nombra una a una con su descripción: son
  producto, no datos de demo, y cambiarlas debe costar una migración.
- **Los contadores se calculan, no se guardan.** Se podrían mantener desnormalizados con
  disparadores —es lo que hace `organizations.favorite_count`— y se ha decidido que no: son
  cuatro filas, un contador guardado puede derivar y un `count(*)` no. La vista lleva
  `security_invoker = true`, sin lo cual habría devuelto los recuentos del foro entero a
  quien no puede ver ni un hilo; hay un aserto que lo comprueba con un usuario sin
  organización.
- **No hay moderación: ni una política de `UPDATE` ni de `DELETE` para nadie.** El *control
  de abuso* del Plan §3.1 es de FORO-02/03 y es una decisión de producto sin tomar. Es más
  fácil añadir esas políticas el día que se decida que retirar las que se hubieran puesto
  de más.

**Y lo que más importa en el único sitio sin cifrar: la firma la pone la base.** Un
disparador sobrescribe autor y organización con `auth.uid()` y `app.current_org_id()`, y el
aserto lo comprueba publicando a nombre de otro a propósito. Publicar suplantando a otra
organización donde el contenido se lee en claro es el peor fallo posible de este módulo.

**Estado del paso 2 del H1: cerrado.** Las tres capas de datos hechas, verificadas y
sembradas en las dos bases. Lo siguiente son las tres tareas en formato fijo, y esas van en
sesión limpia.

**Sexta adenda: la rama de sesión del Operador, y `F-159`.** Dos cosas después de cerrar el
paso 2.

**La rama de sesión (a petición del PO).** Hasta hoy, un Operador de Plataforma con su
cuenta creada y su fila en `platform_operators` entraba y acababa en la pantalla de login
con el mensaje *"la cuenta existe pero no está asignada a ninguna organización, habla con el
operador"*. Dicho al operador. `session.ts` gana `status: 'operator'` —se pregunta por
`platform_operators` **solo cuando no hay fila en `members`**, para que el camino de los
miembros no pague una consulta de más en cada arranque— y `App.tsx` su rama. Detrás hay un
hueco con nombre, no una pantalla: ADMIN-01 la construye el generador y lo que se sustituirá
es el interior del `return`. Seis pruebas nuevas con mock de red, que miran **la consulta y
no solo el resultado**: una tabla mal escrita devolvería cero filas, y cero filas aquí
significa "no es Operador" — el mismo fallo que esto viene a arreglar.

**La cuenta de Operador, por fin, en producción.** El PO creó la cuenta en Auth
(`operador@bearingworld.test`, confirmada) pero no pudo completar el segundo paso, el alta
en `platform_operators`. Hecha por el MCP y **comprobada desde la sesión del propio
operador**, no solo mirando que la fila exista: `app.is_platform_operator()` le devuelve
cierto y la RLS le enseña las tres solicitudes, sus tres filas de historial y un operador.
**Sigue faltando la cuenta equivalente en `bearingworld-e2e`**, que es la que permitiría a
la tarea de ADMIN-01 declarar un test de extremo a extremo.

**`F-159`: la CI se puso roja en un test que no tocaba nada de lo que se cambió.** El job de
Playwright falló en INV-01 con `Expected Set {"Published"}, Received Set {}`. Confirmado **no
reproducible antes de tocar nada** (relanzado el mismo job sobre el mismo commit: verde
entero). La causa es una carrera que el propio fichero documenta dos veces y en ese test no
protegía: `allTextContents()` no auto-espera, y entre el clic en el filtro y la llegada de
la consulta la tabla se queda sin filas. Arreglado en los tres sitios, incluida la raíz (el
`beforeEach`). **Se arregla hoy y no cuando toque porque las tres pantallas del H1 se van a
medir con esta suite: un rojo de carrera se cobraría como un rojo del Coder, que es `F-033`,
`F-112` y `F-114` otra vez.**

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-11` |
| El cierre del Día 13 llegó a `origin` y su CI acabó en verde | `git status -sb` y `gh run list` | Sin desfase con `origin/mvp/bootstrap` (`1c4e1ac`); corrida `34497839743`, `success` |
| La pregunta que el Día 13 dejó abierta: ¿vive el patrón de `F-155` en algún disparador o función interna de `app` que ningún RPC del cliente invoque? | El catálogo de la base, no los `.sql`: `pg_proc` (28 funciones en `app`, 7 en `public`), `pg_trigger` (19 disparadores, 14 colgando de funciones de `app`) y el cuerpo (`prosrc`) de las 12 `security invoker` | **No.** Las siete `invoker` de `app` son exactamente las siete de disparador, y **ninguna lee ninguna tabla**: deciden con `OLD`/`NEW`, `current_user`, `auth.uid()` y ayudantes `security definer`. Todo lo que en `app` lee tablas es `security definer` |
| La premisa de la que depende esa inmunidad — que a `security definer` no le aplique RLS | `pg_class.relforcerowsecurity` y `pg_proc.proowner` contra `pg_class.relowner`, en las dos bases | Ninguna de las 8 tablas con RLS de `public` fuerza RLS sobre su dueño, y las 23 funciones `security definer` de `app`/`public` son de `postgres`, dueño de las tablas. Se sostiene hoy — y por eso se ancla, no se supone |
| Las políticas que leen OTRA tabla con RLS dentro de su propia expresión (la forma exacta de `F-148`) | `pg_policies`, las 20 políticas de `public` leídas una a una | Dos: `thread_items_select_participant` y `threads_select_participant`, las dos con un `EXISTS` sobre `thread_item_keys`. La RLS anidada de esa tabla filtra por `recipient_member_id = auth.uid()`, **la misma condición que el `EXISTS` ya impone** — no puede esconder ninguna fila que el `EXISTS` fuera a contar. No es un hueco |
| Qué funciones `security invoker` nombran una tabla con RLS | Barrido del cuerpo contra los nombres de las tablas con RLS **derivados de `pg_class`**, no escritos a mano — en `troxminloxkjwihwfevs` y en `bearingworld-e2e` | Seis, todas conocidas: las tres RPC auditadas el Día 13 (`create_inquiry`, `create_thread_item`, `counter_offer`), las dos de demo, y `app.guard_member_privileges` — falso positivo: lo único que nombra es `members.role` dentro del texto de una excepción |
| Que el ancla estructural nueva mida de verdad y no en vacío (la lección de `F-146`) | `supabase/tests/run.sh` completo, con canaria: se crea una función `invoker` que lee `thread_items`, se exige que el detector la nombre, y se borra | `ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`. Los tres asertos nuevos en verde **y la canaria detectada por su nombre** |
| `vera/index.ts`, la mitad que el Día 13 dejó explícitamente fuera de alcance | Lectura del fichero entero (236 líneas) y `grep` de `createClient`/`.from(`/`.rpc(`/`SERVICE_ROLE` sobre `supabase/functions/` | **No toca Postgres en ningún punto.** Importa el SDK de Anthropic y `tools.json`, y de la petición solo mira que traiga cabecera `Authorization`. Queda fuera de la familia por construcción, no por auditoría. Es además la única función Edge del repo |
| Entregable 6 (residencia UE, bloqueo de Anthropic) | Llamada real `rawPredict` contra `aiplatform.eu.rep.googleapis.com`, `claude-sonnet-5`, proyecto `bearingworld-vera-eu`, con token de la cuenta del PO — ejecutada hoy, no recordada | `HTTP 429 RESOURCE_EXHAUSTED`, mismo mensaje palabra por palabra que el 8 y el 10-sep. Sin ningún movimiento |
| Dónde estamos respecto al plan V1 v2.3 (adenda, a petición del PO) | El `.docx` del plan leído entero contra el repo: `harness/tasks/` (6 tareas), `harness/requirements.txt`, `harness/core/pricing.py` y `orchestration_pricing.py`, `harness-metrics.csv` (143 filas, 7 pantallas), `harness-review.csv` y `orchestration-metrics.csv` | Semana 3, la del H1. Banda de semanas 1–3: cuatro de cinco piezas hechas. Banda de semanas 3–5 (Fundación): 5 de 6 entregables, el sexto bloqueado fuera del repo. **El H1 sigue abierto** |
| Que el umbral del H1 no existía en ninguna parte | `grep -rl "umbral" openspec/ --include=*.md` antes de escribir nada | Cero resultados relativos a la fábrica. La tabla de riesgos del plan lo exige «escrito de antemano» — escrito hoy, `UMBRAL-FABRICA-V1.md`, y su commit es anterior a cualquier corrida de las tres pantallas |
| Si la tarea de `SRCH-01` seguía sin actualizar tras `F-118` | `git log -- harness/tasks/SRCH-01.json`, el cuerpo de `1183a38`, el propio JSON, y las fechas de las filas `SRCH-01` de `harness-metrics.csv` | **No: actualizada el 29-ago y medida 14 veces ese mismo día.** Lo desfasado era la casilla de estado de `F-118` en el registro, cerrada hoy con esa evidencia |
| Las tres pantallas del H1, elegidas y confirmadas por el PO | Specs leídas una a una en `openspec/design-gui/specs y html aprobados/specs/`, y las columnas reales de `organizations` consultadas por el MCP antes de afirmar qué capa de datos hace falta | `DIR-01`, `ADMIN-01`, `FORO-01`. **`REG-07` descartada por criptografía** (Plan §4.3), leyendo la spec que no se había leído al proponerla. Escritas en `UMBRAL-FABRICA-V1.md` §1 antes de cualquier corrida |
| Que el medidor de orquestación borra historia al usarlo (`F-157`) | `git diff` del CSV inmediatamente después de una pasada normal, no el resumen que imprime el propio módulo | **Once filas de agosto borradas, 387 $ de coste ya medido.** De 13 filas y 591,54 $ a 11 y 386,14 $. Arreglado el mismo día y la historia restaurada: 21 filas, 887,77 $ |
| Que el arreglo de `F-157` funciona y no duplica | `python -m harness.tests.test_checks` entero (23 pruebas) con el caso nuevo, y una pasada real del medidor sobre el CSV restaurado | Todas en verde. La pasada real conserva las diez filas cuyas transcripciones ya no existen y lo dice por pantalla |
| Línea base de la cifra 7 del umbral | El CSV fundido, separando por fecha | 887,77 $ acumulados; **550,25 $ desde el 27-ago, que es V1** |
| Que `DIR-01` necesitaba esquema nuevo, al contrario de lo que se le dijo al PO | Las cinco columnas que la spec pinta, cruzadas una a una con `information_schema.columns` de `organizations` | **Faltaban dos: Teléfono y Email.** Añadidas en `0027`, con sus `CHECK` y dentro del guardia de columnas |
| Que el estado `ACTIVE` de la spec no existe en la base | `pg_get_constraintdef` de la restricción de `organizations.status` | Admite `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`. El directorio filtra por `APPROVED`, documentado en la cabecera de `directory.ts` |
| `0027` contra un Postgres desechable, ANTES de aplicarla | `supabase/tests/run.sh` completo, con cinco asertos nuevos (ancla positiva + las dos columnas bloqueadas al ADMIN + el operador sí + el `CHECK` del email) | `ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE` |
| `0027` aplicada a las dos bases | Catálogo releído por el MCP —columnas, `CHECK` y cuerpo del guardia—, no el `{"success":true}` | Las dos columnas, las dos restricciones y el guardia actualizado en `troxminloxkjwihwfevs` y `bearingworld-e2e`; seis organizaciones con contacto en cada una |
| Avisos de seguridad tras `0027` | `get_advisors(type=security)` | Los tres de siempre; ninguno nuevo |
| La capa de datos de `DIR-01` | `npx tsc --noEmit` y `npx vitest run src/lib/directory.test.ts` | Typecheck limpio, 15 pruebas en verde |
| `0028` contra un Postgres desechable, ANTES de aplicarla | `supabase/tests/run.sh` completo con trece asertos nuevos: la cola invisible para quien no es Operador, el `UPDATE` que no da error y no cambia nada, la firma que pone la base, la máquina de estados, el motivo obligatorio, `Volver a revisión` y los privilegios de `anon` y `authenticated` | `ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`. **Dos asertos fallaron antes de pasar**, y los dos eran defectos reales: el `CHECK` que daba `NULL` y un aserto mío que medía el error equivocado |
| `0028` aplicada a las dos bases | Catálogo releído por el MCP: RLS en las tres tablas, 4 políticas, 2 disparadores, 5 `CHECK`, el ayudante `security definer`, el guardia `invoker` y cero privilegios de `anon` | Todo presente en `troxminloxkjwihwfevs` y `bearingworld-e2e` |
| La siembra de demo de `ADMIN-01` | Ella misma: exige una solicitud de cada color y falla si no | 3 solicitudes, 1 roja / 1 naranja / 1 normal, 3 filas de historial y **0 operadores** en las dos bases |
| Avisos de seguridad tras `0028` | `get_advisors(type=security)` | Los tres de siempre; ninguno nuevo. `app.is_platform_operator` no sale porque vive en `app`, no expuesta por REST |
| La capa de datos de `ADMIN-01` | `npx tsc --noEmit` y `npx vitest run src/lib/admin-requests.test.ts` | Typecheck limpio, 18 pruebas en verde |
| `0029` contra un Postgres desechable, ANTES de aplicarla | `supabase/tests/run.sh` completo con siete asertos nuevos: las cuatro categorías y su orden, el reloj del hilo, los contadores calculados, el foro visible para todo miembro activo, la vista respetando la RLS de quien consulta, la firma que pone la base y los privilegios que no existen | `ESQUEMA VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`, en verde a la primera |
| `0029` aplicada y sembrada en las dos bases | El resultado releído: contadores por categoría y ninguna categoría vacía | Cuatro categorías con dos hilos cada una, entre 3 y 7 publicaciones, y última actividad de hace 2 h, 5 h, 5 días y 11 días — los cuatro valores distintos, que es lo que la tarjeta tiene que poder distinguir |
| Avisos de seguridad tras `0029` | `get_advisors(type=security)` | Los tres de siempre; ninguno nuevo. **La vista no dispara el aviso de vista `security definer`**, que es la confirmación de que `security_invoker` está puesto |
| La capa de datos de `FORO-01` | `npx tsc --noEmit` y `npx vitest run src/lib/forum.test.ts` | Typecheck limpio, 15 pruebas en verde |
| Que el rojo de la CI no lo causaba el commit | `gh run rerun --failed` sobre el MISMO commit, antes de tocar una línea | Verde entero, despliegue incluido. El fallo era una carrera, y el arreglo se escribió después de saberlo, no para que pasara |
| La rama de sesión del Operador | `npx tsc --noEmit` y la suite entera de vitest | Typecheck limpio, **696 pruebas en verde**, 6 de ellas nuevas sobre la bifurcación (miembro / Operador / cuenta a medio provisionar) |
| Lo que esa rama NO verifica todavía | — | **No se ha ejecutado con una cuenta real**, porque no existe ninguna: el alta de un Operador es credenciales y la da el PO. Hasta entonces, la rama está probada con mock y con el esquema, no contra la API |
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

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos, y esa sigue siendo la
condición. **Novedad del 11-sep: ya tiene su vara de medir** — `UMBRAL-FABRICA-V1.md`, el
umbral del H1, escrito antes de medir. Lo que falta para abrirla está en §3, en orden.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

**El H1 del plan es lo único con acción propia que queda en el repo**, y desde hoy tiene la
pieza que le faltaba para ser una medición en vez de una impresión: el umbral, escrito
antes de medir. El orden de abajo es el de `UMBRAL-FABRICA-V1.md` §7, y ninguno de los
cinco depende de nadie de fuera:

1. ~~El PO confirma las tres pantallas.~~ **HECHO el 11-sep, antes de correr nada:
   `DIR-01`, `ADMIN-01` y `FORO-01`** — directorio, alta de empresas y foro. `REG-07` se
   cayó de la propuesta al leer su spec (es generación de claves: criptografía, y el Plan
   §4.3 dice que el generador no la toca) e `INV-02` por medir el techo y no la media.
2. ~~Las tres capas de datos, escritas a mano y entregadas.~~ **HECHO el 11-sep, las
   tres:** `0027`/`directory.ts`, `0028`/`admin-requests.ts` y `0029`/`forum.ts`, cada una
   con sus pruebas, sus asertos de esquema y su siembra, verificadas en las dos bases. Con estas tres la capa de datos no es gratis y se eligieron así a
   propósito: tres pantallas sobre esquema existente habrían medido la fábrica en su caso
   más cómodo.
   ⚠ **Y la corrida de cada pantalla va en SESIÓN LIMPIA**, con el medidor de orquestación
   corrido antes y después. Si la tarea, los tests y la corrida comparten sesión con otro
   trabajo, la cifra 7 le imputa a la pantalla un coste que no es suyo y el veredicto sale
   falso por arriba.
3. **Las tres tareas en formato fijo, validadas con `--seco`.** El corpus pasa de **6 a 9**,
   camino de las **10–15** que el plan declaró objetivo no alcanzado del MVP y asignó
   explícitamente a este hito.
4. ~~Correr `python -m harness.core.orchestration_metrics`.~~ **HECHO el 11-sep, y de ahí
   salió `F-157`** (el medidor borraba su propia historia; arreglado y fijado con prueba).
   Línea base: 887,77 $ acumulados, 550,25 $ de ellos en V1. ⚠ **A partir de ahora se corre
   ANTES y DESPUÉS de cada pantalla**, no al final de las tres: una transcripción podada es
   una medida que ya no existe.
5. **Las tres corridas, su revisión y el C5 del PO.** El veredicto va a §1 con las ocho
   cifras al lado, y arrastra el escenario de calendario: 18, 21 o 30 semanas.

En paralelo, sin acción propia desde este lado:

- **Entregable 6: seguir esperando la aprobación de Anthropic (Model Garden), sin ETA.**
  Recomprobado el 11-sep con llamada real: mismo `429 RESOURCE_EXHAUSTED`. **No tocar
  `vera/index.ts` hasta que responda** (orden de corte del runbook).

Fuera de sesión, sin moverse: `F-073` (re-loguear la CLI de Supabase) y el plan de pago de
Vercel — ninguno bloquea trabajo de ingeniería.

### Lo que se cerró hoy (Día 14, 11-sep)

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
| ⚪ | ~~Y la otra mitad, que el Día 13 dejó fuera de alcance a propósito: los disparadores, las expresiones de política y la función Edge — todo lo que corre sin que ningún RPC del cliente lo invoque~~ | **Resuelto 11-sep-2026 (Día 14): ninguno tiene la forma.** Los siete disparadores de `app` no leen ninguna tabla; las dos políticas con `EXISTS` anidado imponen ya la misma condición que la RLS anidada aplicaría; `vera/index.ts` no toca Postgres. Anclado con cuatro asertos y una canaria en `01_schema_smoke.sql`, sin migración |

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
    Día 13: `F-156` (cerrado, `0026`). Del Día 14: `F-157` (cerrado el mismo día) y `F-158`
    (**abierto, es del PO**: la spec de `ADMIN-01` se contradice a sí misma en el umbral
    de color de la antigüedad en cola) — el medidor del
    coste de orquestación borraba su propia historia al usarlo. La auditoría de la
    mañana no encontró hallazgo y dejó un ancla en `01_schema_smoke.sql`; el hallazgo
    salió por la tarde, arrancando el H1.

---

*Día 14 de V1 · 11-sep-2026, cerrado tras contestar la última pregunta abierta de la
familia `F-155` — la mitad que el Día 13 dejó fuera de alcance a propósito: lo que corre
por debajo sin que ningún RPC del cliente lo invoque · fecha leída de la máquina
(`date -u`) al cerrar: `2026-09-11` · auditados contra el criterio exacto los siete
disparadores `security invoker` de `app`, las 20 políticas de RLS de `public` y la
función Edge `vera/index.ts`; ninguno tiene la forma, y los disparadores por una razón
más fuerte que la esperada: **no leen ninguna tabla** · la fuente fue el catálogo de la
base (`pg_proc`, `pg_trigger`, `pg_policies`, `pg_class`), no los `.sql`, y el barrido se
repitió en `troxminloxkjwihwfevs` y en `bearingworld-e2e` con el mismo resultado ·
**sin migración nueva: no había nada que corregir**, `0026` sigue siendo la última y el
contador de hallazgos sigue en `F-156` · el resultado negativo queda anclado con cuatro
asertos nuevos en `01_schema_smoke.sql` —superficie `invoker` permitida, canaria que
demuestra que el detector detecta, ausencia de SQL dinámico, y la premisa de la inmunidad
de `security definer` (`FORCE RLS` y dueño)—, todos con los nombres de tabla derivados de
`pg_class` y no escritos a mano · `supabase/tests/run.sh` completo en verde (`ESQUEMA
VERDE` + `CATALOGO VERDE` + `FRESCURA VERDE`) con la canaria detectada por su nombre ·
entregable 6 recomprobado hoy con una llamada real a `rawPredict` (región `eu`,
`claude-sonnet-5`): `HTTP 429 RESOURCE_EXHAUSTED`, mismo mensaje palabra por palabra que
el 8 y el 10-sep · **adenda del mismo día, a petición del PO:** leído el plan
V1 v2.3 contra el repo pieza a pieza — estamos en la semana 3, la del H1, con la Fundación
casi entera hecha y el hito abierto — y escrito `UMBRAL-FABRICA-V1.md`, el umbral que la
tabla de riesgos del plan exige «de antemano» y que no existía; corregida además la casilla
de `F-118`, trece días en «Abierto» con el arreglo hecho y medido desde el 29-ago
(`1183a38`, 14 corridas de `SRCH-01` ese mismo día) · `git status --short` releído antes de
escribir este pie · Dirección Técnica, Nortex Systems*
