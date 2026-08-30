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

**Día 4 de V1 · 30-ago-2026 · SEGUNDO CIERRE, y esa es la primera noticia · Estado: VERDE**

Este fichero se cerró hoy a las 11:22 con `F-131` abierto y una lista de cinco cosas para
mañana. **Mañana empezó a las 11:32 del mismo día.** Lo que sigue es la segunda mitad del
día 4: `F-131` cerrado y medido, y detrás de él **cinco hallazgos nuevos** (`F-132` a
`F-136`) que no estaban en ninguna lista.

**El hallazgo del día, y no es `F-131`: cuatro de las cinco cosas que se dieron por buenas
esta mañana no lo eran, y ninguna era del modelo.** «Siete asertos» eran nueve. «Fundación
no empezada» tenía un entregable entero hecho desde el día 1. «`MSG-01`: 2 de 4» llevaba
tres corridas midiendo un choque entre dos decisiones propias. Y dos tests que llevaban
semanas en verde **pasaban sin que la pantalla llegara a abrirse**.

**Y el marcador se mueve, con una condición.** `MSG-01` llegó a **`C1` verde** en dos de
tres corridas —primera vez en la serie— y con la `C2` de `F-134` esos dos intentos habrían
sido **4/4**. Se dice como contrafactual, no como resultado: la `C2` nueva se escribió
después de medir.

---

## 1 · Qué se ha comprobado en esta segunda mitad, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-08-30`, 11:31 UTC al escribir esto |
| `F-131`: el mecanismo, y cuánto cuesta | Defecto inyectado a mano en el `ThreadList.tsx` bueno + `npx vitest run` | **9 rojas de 34.** Ocho por `Unable to find role="listitem"` y **una novena por `Found multiple elements`** — el `<li>` pisado es un segundo botón con el mismo nombre accesible que el de dentro. La cifra de esta mañana («siete») era corta. Inyección revertida |
| `F-131`: el guardia lo habría cazado | `cruzar_con_el_contrato` sobre `MSG-01` con la declaración quitada | Lo ve. Sobre la tarea de hoy, **calla** — que es la prueba de que la declaración llegó |
| `F-131`: la lista estructural está calibrada | El guardia sobre las seis tareas, con y sin el filtro | **5 avisos en 6 tareas** con los estructurales; **17** con todos los implícitos. `button` cantaría en las seis, y eso es un guardia que se desactiva en una semana (`F-003`) |
| El guardia, después de declarar las tres tareas | Las seis tareas, contadas | **Cero avisos de `F-131`.** No es que calle: es que no le queda nada que decir |
| `F-132`: la Fundación V1 no estaba sin empezar | `supabase/migrations/*.sql` **y** `information_schema` del proyecto real, por el MCP | Los **cuatro** campos del respaldo de clave están en `0001:78-81` y en la base (4 de 4), con tres restricciones que el hito ni pedía. `visibility_scope` 0, `thread_items.quantity` 0, índices GIN 2 |
| `F-133`: `CLAUDE.md` §10.2 se contradecía | `list_projects` por el MCP + `VITE_SUPABASE_URL` de `app/.env` | `troxminloxkjwihwfevs` es el **proyecto** (`MVP_RinWorld.io`, `eu-west-1`, `ACTIVE_HEALTHY`); `ujatcozvbspkycepemfq` es la **organización**. El texto los enfrentaba |
| `F-134`: por qué `C2` llevaba tres corridas en rojo | El detalle de `C2` del intento 3 de `09a` —el único con `C1` verde— y el artefacto guardado en su JSON | Los **6 fallos son los 6 del bloque `MSG-02`**. Causa: `Messages.tsx:152` del artefacto pinta `onOpen={noop}`, que es lo que la tarea le **ordena** («la recibes y la IGNORAS», `F-118`) |
| `F-134`: el reparto de culpas funciona | `_repartir_culpas` sobre la salida real de `09a` | 6 excusados, **0 imputables**, y contra esa salida vieja **2 caducadas** — que son los dos de `F-135`, o sea la cerradura 4 trabajando sobre datos reales |
| `F-135`: los dos tests medían aire | Navegación neutralizada a mano + `npx playwright test` | Los fallos de `MSG-02` pasan de **6 a 8**. Contra el repo intacto, **20 de 20**. Inyección revertida |
| `F-136`: el log lo escribe la corrida | `abrir_log` sobre un directorio temporal | Crea, encabeza con la orden de lanzamiento, captura los dos flujos, **no trunca** al relanzar, y ante una ruta imposible **avisa sin reventar** |
| La suite del arnés | `python -m harness.tests.test_checks` | **Todas en verde**, con 12 comprobaciones nuevas |
| La suite del producto | `npm test` | **642 pasan**, 23 saltadas, 0 fallos |
| El e2e completo | `npx playwright test e2e/messages.spec.ts` | **20 de 20** |
| El CSV, después de nueve filas nuevas | `csv.DictReader` sobre el fichero | **97 filas, 15 columnas**, cabecera intacta. Las 9 de la corrida 09 suman **$0,3171** y las tres escalaron |
| Estado del árbol y del cerrojo al cerrar | `git status`, `ls harness/.corrida-en-curso` | Limpio y suelto |
| CI del último commit del día | `gh run view` sobre `99f746d`, job a job | **Los cuatro en verde**: `Esquema`, `App · typecheck/Vitest/build`, `Arnés · piezas puras` y `Playwright · puerta de las dos cuentas`. `baff9ef` figura **cancelada**, no roja: la reemplazó el push siguiente |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `B-007`, `F-114`–`F-121`, `F-123`–`F-128`, `F-130` | ✅ 28 y 29-ago, y la mañana del 30 · ver el cierre anterior en `git show ebd5d5b` |
| **`F-131` un `role` explícito sustituye al implícito** | ✅ **30-ago · `ec0cce0`, `2c55b93`** — declarado en las **tres** tareas afectadas, no solo en la que lo sufrió |
| **`F-132` la Fundación V1, comprobada de verdad** | ✅ **30-ago · `ecc966a`** — `openspec/v1/FUNDACION-V1.md` |
| **`F-133` `CLAUDE.md` §10.2** | ✅ **30-ago · `ecc966a`** |
| **`F-134` `C2` reparte culpas sin dejar de mirar** | ✅ **30-ago · `0efe6a0`** — decisión (b) del PO |
| **`F-135` dos tests e2e que no miraban nada** | ✅ **30-ago · `baff9ef`** |
| **`F-136` la corrida escribe su propio log** | ✅ **30-ago · `99f746d`** |
| **Medición del corpus** | 🟡 **Sigue 2 de 4 en el marcador**, pero por primera vez con `n=3` debajo. Ver §3.1: mover el marcador ya solo depende de volver a correr |
| Fundación V1 | 🟡 **1 de 6 entregables hecho** (el respaldo de clave, desde `0001`), 2 a medias, 3 sin empezar. **ADR-002 a cero**: sus siete objetos, ninguno. Detalle en `FUNDACION-V1.md` |
| `MSG-01` a 4/4 | 🟡 **Un solo rojo lo separa**, y es del modelo: `Nuevo contacto`. Ver §3.1 |

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos. Límite escrito: **máximo
cuatro agentes de construcción concurrentes**.

### Corriente C · Verificación — NO ABIERTA

Utillaje externo instalado y endurecido el 22-ago: modo aislado, commit fijado en
`85fd9db5`, los cinco interruptores de red apagados. Sin cambios hoy.

---

## 3 · Qué toca mañana, en este orden

1. **Correr `MSG-01` otra vez, y es lo más barato que hay sobre la mesa.** Todo lo que la
   bloqueaba está arreglado y ninguna corrida lo ha visto todavía junto: `F-131`
   declarado, la `C2` de `F-134` repartiendo culpas, `F-135` anclado y el log
   escribiéndose solo. **Con lo medido hoy, dos de cada tres tiradas deberían dar 4/4.**
   Si sale, el marcador pasa a **3 de 4** con `n=3` detrás, que es la primera cifra
   defendible del `Plan §11`. ~$0,10 por tirada; **tres, no una** — hoy se ha visto por qué.
2. **`Nuevo contacto`, que es el único rojo que queda y ahora sí es medida.** Falla en
   **9 de 9** intentos, en tres corridas independientes, con el requisito declarado en la
   tarea desde `F-128`. Ya no es «parece del modelo»: es del modelo, con `n=3`. La
   pregunta ya no es de quién es, es qué se hace — ¿se acepta como techo, se reescribe la
   declaración, o se cambia el aserto?
3. **Fundación V1, y ahora se sabe por dónde.** El candidato barato es el **índice de la
   derivación de la lista** (entregable 5 + última fila de ADR-002 §5): es **una
   migración** y desbloquea media ADR-002. `visibility_scope` es la siguiente, y es la que
   cambia el comportamiento visible.
4. **Decidir qué se hace con el 57 a 1.** Sin tocar desde ayer. Ver §5.
5. **Desplegar `ThreadHeader.tsx`.** Ver §5, y es lo primero de la lista si alguien va a
   mirar la URL.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después. ⚠ **Comprobado el 30-ago: sus siete objetos de esquema están a cero** | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. No DeepSeek: sin acuerdo de tratamiento y entrena por defecto. ⚠ **Lo desplegado hoy no es eso** —`api.anthropic.com` sin `baseURL`, `claude-sonnet-4-6`—: la decisión es de V1 y ese cambio **es** el entregable 6 de la Fundación | Plan §4.2, `FUNDACION-V1.md` §1 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Utillaje externo** | Modo aislado, commit fijado, interruptores apagados. Nunca modo equipo | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **Cuatro agentes máximo** | En construcción concurrente. Los de verificación no cuentan | Plan §6.2 |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió. Las filas inválidas de `F-121` se marcan, no se borran — y desde el 30-ago **están marcadas de verdad** | 25-ago · `F-129` |
| **Columna `corrida` en el CSV** | Entra **antes de `resultado`**. Las 85 filas históricas llevan `-`. La escribe `--corrida` | `F-129` |
| **El guardia AVISA, no bloquea** | Vale para los roles (`F-127`), para lo buscado por regex (`F-130`) y para los roles estructurales (`F-131`). Las tres veces es una **medida**, no una preferencia: bloquear pararía tareas que demostrablemente funcionan | `F-127`, `F-130`, `F-131` |
| **`C2` corre SIEMPRE la suite e2e ENTERA** | `D-09-03 (a)`, 12-ago. **NO se ha tocado hoy**, y su motivo (`F-070`) sigue en pie | `test_runner.py` |
| **…pero no le cobra al Coder lo que la tarea le prohibió** | 30-ago, PO, opción (b) de `F-134`. Exclusión **por tarea y por test**, con motivo escrito. Cuatro cerraduras: la suite corre entera, se excusa test a test, si no cuadra el recuento se cobra entero, y una exclusión caducada se canta | `F-134` |
| **Un verde con excusas se MARCA en el CSV** | 30-ago. `e2e con N excusado(s)… la suite NO estaba limpia`. Un verde con asterisco agregado como verde limpio es `F-129` otra vez | `F-134` |
| **Los logs de corrida se versionan, y los escribe la corrida** | 30-ago. `!harness/metrics/**/*.log`, y `run.py` los escribe él mismo: en append, con flush, antes del cerrojo | `F-115`, `F-136` |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py:33-40` |
| **Coste de orquestación: precio-sombra** | Tokens reales × tarifa pública de la API | `orchestration_pricing.py` |
| **El corpus se congela en ALCANCE, no en git** | Se congela lo que se le pide al Coder; la **firma** se declara al día. ⚠ Hoy se ha usado tres veces (`F-131` en `MSG-01`, `SRCH-01` y `VND-01`) | `F-118` |
| **El recorte lo hace quien mide, no el producto** | `npm test` y la CI corren la suite entera; el que excluye es C1 (`test:arnes`) — y desde hoy también C2, con la misma forma | `F-116`, `F-134` |
| **Lo que el contrato exige, la tarea lo dice** | **Once veces en cinco días.** La vía elegida ha sido siempre la misma: declararlo en `component_api` —o, desde hoy, en `acceptance`—, sin tocar ni un aserto | `F-116`, `F-118`, `F-123`, `F-125`–`F-128`, `F-131`, `F-134` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🔴 | **`ThreadHeader.tsx` se tocó y NO se ha desplegado.** El `<div>` del breadcrumb pasó a `<nav aria-label="Ruta">` (`F-135`). Es producto, y el §7 de este fichero dice que si se toca código se despliega **y se comprueba en la URL**. No se ha hecho: desplegar es una acción hacia fuera y no se hizo por cuenta propia. **Nada más de hoy toca producto** — el resto es arnés, tareas y documentos | Álvaro, o autorizar el despliegue |
| 🟠 | **`Nuevo contacto`: 9 de 9.** Ya no es sospecha, es medida con `n=3`. Es el único rojo que separa a `MSG-01` de 4/4 | §3.2 |
| 🟠 | **57 a 1, y sin dueño.** El Coder de los días 2 y 3 costó **$2,64**; la orquestación atribuida a esos días, **$150,48**. ⚠ Es precio-**sombra** a tarifa pública y Claude Code va por suscripción, así que no es lo que se paga — pero es el número que el proyecto eligió seguir, y dice que **el coste de una pantalla lo domina la orquestación, no la generación** | Álvaro, con §3.4 |
| 🟠 | **La Fundación V1 tiene un entregable con reloj: la residencia.** Lo desplegado llama a `api.anthropic.com`. No incumple ninguna decisión cerrada —la de §4 es de V1— pero es el único punto del hito con consecuencias legales, y nadie le ha puesto fecha | Álvaro |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. No bloquea porque el MCP llega, pero depender de eso es depender de la suerte | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Riesgo aceptado por el PO el 18-ago hasta después de la reunión. **Sigue abierto** | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: ya son CINCO, y la hipótesis de la cabecera queda tocada.** Esa nota dice que lanzar Code desde la raíz «parece cortar la causa, porque es en `openspec/mvp/` donde aparecen». Hoy ha aparecido uno nuevo en **`openspec/v1/.claude/worktrees/`**, que no es `openspec/mvp/`. No se toca esa nota —se gana su sitio— pero el dato va aquí | Fuera de sesión, desde la raíz |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Hoy se perdieron dos ficheros a medio escribir: la tanda de corridas cierra cada una con `git checkout -- app/` y se llevó por delante lo que no estaba commiteado. Se rehízo, no costó nada, y la próxima vez puede costar más | Se cumple mirando el cerrojo antes de tocar `app/` |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si el reparto de culpas de `F-134` aguanta una salida de playwright que no sea esta.**
  Se ha probado contra **una** salida real y contra tres variantes construidas a mano. El
  formato de las líneas de fallo es de playwright y puede cambiar al actualizarlo; la
  cerradura 3 —si el recuento no cuadra, se cobra entero— está puesta exactamente para que
  ese día el fallo sea caro y visible en vez de silencioso y barato.
- **Si `Nuevo contacto` falla por el modelo o por cómo está redactada su declaración.**
  `n=3` dice que falla siempre; no dice por qué. Están declarados el literal, el `disabled`
  y el motivo, y el Coder pinta otra cosa. **Nadie ha leído todavía qué pinta exactamente
  en los tres artefactos**, y eso es una tarde de trabajo sin gastar un token.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** `09a` y `09b`
  convergieron idénticas; `09c` arrancó con cinco errores de tipos que las otras no
  tuvieron y no convergió, costando un 52 % más. Con `n=3` se ve que la varianza existe y
  es cara; no se ve de dónde sale.
- **Qué se pierde por no versionar los artefactos de las corridas 09.** Los JSON llevan las
  fuentes (`sources`), así que esta vez sí está — pero nadie las ha comparado entre sí. Las
  tres escribieron un `ThreadList.tsx` distinto y **en qué se parecen es la pregunta del
  punto anterior**.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sigue sin datos. Hoy se lanzaron **tres corridas seguidas** y no pasó ni una vez, que es
  el primer dato en contra de que sea «la segunda de una tanda». `F-122` sigue sin haberse
  disparado en el caso que lo motivó.
- **Si `visibility_scope` y la lista derivada aguantan bajo carga.** Hito 6, no antes.
- **Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en el repo. Diez días.

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
**Dos días seguidos, y el segundo con la regla ya escrita.** Si después del cierre se toca
algo, este fichero se vuelve a tocar — que es lo que ha pasado hoy.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Es nuevo de hoy y desmonta el
   «no empezada» que este fichero repitió cuatro días.
3. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**: el cuerpo
   del acta contiene tres afirmaciones falsas que la corrección desmonta.
4. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
5. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
6. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
7. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno. Hoy: `F-131` a `F-136`.

---

*Día 4 de V1 · 30-ago-2026, segundo cierre (11:31 UTC) · fecha leída de la máquina
(`date -u`) · estado verificado contra el código de `mvp/bootstrap`, contra
`information_schema` del proyecto real y contra la salida de tres corridas pagadas, no
contra otro documento · **la primera medida del proyecto con `n>1`, y el fallo que la
explicaba reproducido a mano en las dos direcciones antes de escribirlo aquí** · Dirección
Técnica, Nortex Systems*
