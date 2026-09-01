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

**Día 5 de V1 (segundo cierre) · 1-sep-2026 · Estado: VERDE**

Este fichero se abrió hoy por segunda vez leyendo el primer cierre del día 5 (`516d316`,
09:15 UTC), con `F-137` a `F-140` cerrados y cuatro tareas para esta sesión: remedir
`MSG-01` con los tres arreglos ya puestos desde el principio, construir `visibility_scope`
(D-4 de `ADR-002`), auditar si `SRCH-01`/`VND-01`/`PANEL-01`/`LOGIN-01` tienen el mismo
riesgo que mostró `F-140`, y lo que saliera de la reunión del socio del 20-ago. **Las tres
primeras se hicieron. La cuarta sigue exactamente donde estaba: no es cosa de esta
sesión.**

**El patrón del día anterior se repitió, y esta vez con la lección ya aprendida
funcionando de verdad.** La medida limpia de `MSG-01` —la primera con el corpus arreglado
desde antes de empezar, no a mitad de medir— destapó un hallazgo nuevo (`F-141`): el
estado vacío de `ThreadList.tsx` nunca declaró su FORMA, solo su contenido, y a la sexta
tirada real le tocó envolverlo en un `<li>` dentro del mismo `<ul>` de las filas —rojo en
C1 y C2, porque el contrato exige cero `listitem` cuando no hay hilos—. Al escribir la
declaración que lo arregla, el primer borrador **repitió el mecanismo exacto de `F-140`**:
insertó el texto antes del punto donde `test_checks.py` trunca `component_api` para
reconstruir "la tarea sin `F-131`", y la reconstrucción dejó de estar realmente sin
`F-131`. **La diferencia con ayer: esta vez `python -m harness.tests.test_checks` se corrió
ANTES de commitear, no al cerrar el día, y lo cazó en local** (`FALLAN 1`) antes de que
tocara la CI siquiera una vez. Reubicado el texto, la suite volvió a verde y así se
commiteó. La auditoría del punto 3, delegada a un subagente y verificada a mano contra el
código real, encontró un segundo caso de la misma familia —no el mismo mecanismo, pero el
mismo síntoma—: `_nota_accesibilidad` de `PANEL-01` llevaba describiendo, desde el 13-ago,
un contrato de aceptación que `F-077` ya había reemplazado (`F-142`). Ninguno de los dos
hallazgos de hoy rompió una CI real: los dos se cazaron antes de que llegaran a pisar
nada, que es exactamente lo que ayer no pasó.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-01`, 13:46 UTC al escribir esto (segunda sesión del mismo día; la primera cerró a las 09:15 UTC) |
| El corpus de `MSG-01` lleva `F-137`/`F-138`/`F-139` desde ANTES de medir | `grep` de `pag-info`, `directorio-scope` y `now?: Date \| undefined` contra `harness/tasks/MSG-01.json` y `app/src/lib/threads.ts:133` en el código real, antes de gastar un token | Presentes los tres, confirmados en el código, no en un documento |
| `MSG-01`, tres corridas limpias más (`11a`/`11b`/`11c`) | Los `attempt_N.json` guardados, `harness-metrics.csv` | **3 de 3 llegan a VERDE** (frente a 1/3 ayer). `11a` y `11b` pasan 4/4 al primer intento; `11c` falla 2/4 en el intento 1 por un defecto nuevo (`F-141`) y pasa 4/4 en el intento 2 |
| `F-141`: por qué `11c` rompió C1/C2 en el intento 1 | `attempt_1.json` de `11c` contra `ThreadList.test.tsx:173`, y comparado contra las cinco corridas limpias anteriores del día | El estado vacío se envolvió en `<li>` dentro de `<ul>`; el contrato exige cero `listitem` sin hilos. Las otras cinco corridas del día usaron `<div>` sin que nadie se lo pidiera — hueco real, no ruido |
| Que el arreglo de `F-141` no repitiera el mecanismo de `F-140` | `python -m harness.tests.test_checks`, corrido ANTES de commitear | El primer borrador SÍ lo repitió (`FALLAN 1`, detectado en local); reubicado el texto, la suite volvió a verde antes de tocar la CI |
| `visibility_scope` (D-4 de `ADR-002`) | Local: `supabase/tests/run.sh` contra Postgres desechable (fase 1, incluida la guardia nueva) ANTES de tocar nada remoto. Remoto: `information_schema`, `pg_constraint` y los datos reales del proyecto (`troxminloxkjwihwfevs`), por el MCP | Columna, check y trigger aplicados (`0018`). Los 2 miembros sembrados: `ADMIN` con `visibility_scope = 'ORG_METADATA'`, sin excepciones. La guardia bloquea el `UPDATE` desde el cliente, probado antes de aplicar |
| El riesgo de `F-140` sobre `SRCH-01`/`VND-01`/`PANEL-01`/`LOGIN-01` | Subagente + verificación a mano contra `Panel.test.tsx`, `git log --follow` sobre los cuatro `.json` y el propio `test_checks.py` (`.split(` completo) | `SRCH-01`, `VND-01`, `LOGIN-01` limpios. `PANEL-01` sí tenía deriva real (`F-142`): su `_nota_accesibilidad` describía selectores sin anclar que `F-077` ya había reemplazado el 13-ago. El mecanismo automático de `F-140` (reconstrucción `.split()`) **solo existe para `MSG-01`** — confirmado leyendo el fichero de test entero |
| La CI de los dos pushes de hoy, job a job | `gh run view --json jobs` sobre `643ddbc` y el push anterior | Las **cuatro** piezas en verde en los dos pushes: Esquema, App, Arnés, Playwright |
| La suite del producto | `npm test` | **642 pasan, 23 saltadas** — igual que ayer; ningún cambio de hoy tocó `app/` en el commit final (el diff que la corrida de `11c` dejó en `app/src/screens/messages/` se descartó: no es código revisado, es el artefacto crudo del Coder de la última tirada, y `MSG-01` ya estaba construida y desplegada) |
| La suite del arnés | `python -m harness.tests.test_checks` | Todas en verde tras reubicar el texto de `F-141` |
| Los worktrees | `git worktree list` | Siguen siendo los mismos cuatro prunables de siempre + la raíz. Ninguno nuevo hoy |
| Estado del árbol al cerrar | `git status` | Limpio salvo `openspec/design-gui/Ingles/`, sin tocar hoy y ajeno a esta sesión |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-140` | ✅ ver cierre anterior en `git show 516d316` |
| **`F-141` el contenedor del estado vacío de `ThreadList.tsx` declarado (fuera de `<ul>`)** | ✅ **1-sep · `874f1ad`** |
| **`F-142` `_nota_accesibilidad` de `PANEL-01` puesta al día con los selectores reales de `F-077`** | ✅ **1-sep · `643ddbc`** |
| Medición del corpus de `MSG-01` | 🟢 **3 de 3 en verde** con el corpus arreglado desde el principio — la primera cifra que no midió un corpus cambiando a mitad de tirada |
| `MSG-01` a 4/4 sin reintentos | 🟡 2 de 3 (`11a`, `11b`) al primer intento; `11c` necesitó uno. Con `F-141` ya declarado, la próxima medida es la que dice si sube a 3/3 |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5, penúltima fila) | ✅ **1-sep · `087962b`**, `0017_thread_derivation_index.sql` |
| **`visibility_scope` (D-4, `ADR-002` §5, segunda fila)** | ✅ **1-sep · `f5ea8fc`**, `0018_members_visibility_scope.sql` — columna, check y guardia aplicados y verificados contra la base real |
| Resto de la Fundación (entregables 1-3, 6; `D-3 quantity`; `Lista de hilos`; `thread_public_keys`; `thread_items_select_participant`; `create_inquiry`) | 🔴 Sin cambios — ver `FUNDACION-V1.md`, actualizado hoy en el punto de `visibility_scope`. **"Lista de hilos" es ahora la pieza que de verdad activa el ámbito**: `visibility_scope` existe pero nada la lee todavía, ni RLS ni pantalla |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

1. **"Lista de hilos" (`ADR-002` §5, última fila roja): reescribir `threads_select_participant`
   para derivar de `thread_item_keys`, usando el índice de `0017` y `visibility_scope` de
   `0018` — los dos ya están puestos, esta es la pieza que los conecta y la que de verdad
   cambia comportamiento visible.** Sin ella, `visibility_scope` es una columna que nadie
   lee.
2. **Otra remedición de `MSG-01` (n=3), con `F-141` ya en el corpus desde el principio.**
   Hoy lo descubrió la misma corrida que medía; la próxima es la primera que puede decir
   si el marcador sube a 3/3 en 4/4 sin reintentos. ~$0,10 por tirada, tres tiradas.
3. **`D-3` de `ADR-002`: columna `quantity` en `thread_items`.** El otro entregable de
   esquema que sigue en rojo, y el más barato de los que quedan — sin índice nuevo, sin
   guardia nueva, solo la columna y su uso en `create_inquiry`.
4. **(sigue abierto) Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en
   el repo. Van ya doce días.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después. El índice de la derivación de la lista y `visibility_scope` (D-4) ya están hechos (§2); quedan cinco de los siete objetos de esquema, y "Lista de hilos" es la que activa el comportamiento | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. No DeepSeek: sin acuerdo de tratamiento y entrena por defecto. Lo desplegado sigue sin ser eso —`api.anthropic.com` sin `baseURL`—: sigue siendo el entregable 6 de la Fundación, sin fecha | Plan §4.2, `FUNDACION-V1.md` §1 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Utillaje externo** | Modo aislado, commit fijado, interruptores apagados. Nunca modo equipo | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **Cuatro agentes máximo** | En construcción concurrente. Los de verificación no cuentan | Plan §6.2 |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió. Las filas inválidas se marcan, no se borran | 25-ago · `F-129` |
| **Columna `corrida` en el CSV** | Entra antes de `resultado`. La escribe `--corrida` | `F-129` |
| **El guardia AVISA, no bloquea** | Vale para los roles (`F-127`), lo buscado por regex (`F-130`) y los roles estructurales (`F-131`). Es una **medida**, no una preferencia | `F-127`, `F-130`, `F-131` |
| **`C2` corre SIEMPRE la suite e2e ENTERA** | `D-09-03 (a)`, 12-ago. Su motivo (`F-070`) sigue en pie | `test_runner.py` |
| **…pero no le cobra al Coder lo que la tarea le prohibió** | 30-ago, PO, opción (b) de `F-134`. Exclusión por tarea y por test, con motivo escrito | `F-134` |
| **Un verde con excusas se MARCA en el CSV** | 30-ago. Un verde con asterisco agregado como verde limpio es `F-129` otra vez | `F-134` |
| **Los logs de corrida se versionan, y los escribe la corrida** | 30-ago. `run.py` los escribe él mismo: en append, con flush, antes del cerrojo | `F-115`, `F-136` |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py:33-40` |
| **Coste de orquestación: precio-sombra** | Tokens reales × tarifa pública de la API. **No es factura: Claude Code va por suscripción** | `orchestration_pricing.py` |
| **El 57 a 1 se acepta, sin acción** | 1-sep-2026, PO. El coste de una pantalla lo domina orquestar, no generar; sin presión de coste marginal real, se sigue midiendo pero no se optimiza | `F-113` |
| **El recorte posicional del feedback (`F-114`) se acepta como coste conocido** | 1-sep-2026, PO, opción (a). No se toca `test_runner.py`: el arreglo real sigue siendo declarar en `component_api` en cuanto se descubre, no hacer más listo el canal de feedback | `F-114`, `F-139` |
| **El corpus se congela en ALCANCE, no en git** | Se congela lo que se le pide al Coder; la firma se declara al día | `F-118` |
| **El recorte lo hace quien mide, no el producto** | `npm test` y la CI corren la suite entera; el que excluye es C1 (`test:arnes`) y C2, con la misma forma | `F-116`, `F-134` |
| **Lo que el contrato exige, la tarea lo dice** | **Quince veces en seis días.** La vía elegida ha sido siempre la misma: declararlo en `component_api` —o, en `acceptance`—, sin tocar ni un aserto | `F-116`, `F-118`, `F-123`, `F-125`–`F-128`, `F-131`, `F-134`, `F-138`, `F-139`, `F-141`, `F-142` |
| **Un artefacto crudo del Coder no se commitea sobre una pantalla ya revisada** | 1-sep-2026, aplicado sin necesidad de pedirlo: las corridas de remedición sobreescriben `app/` como efecto colateral de medir, y ese diff se descarta tras cada corrida salvo que alguien decida explícitamente promoverlo. Solo se commitean los artefactos de `harness/metrics/` y el CSV | `CLAUDE.md` §1.6, precedente `c95d442`/`31c4095` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **La Fundación V1 tiene un entregable con reloj: la residencia.** Sin cambios hoy — sigue llamando a `api.anthropic.com`, sin fecha puesta | Álvaro |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Sin cambios | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: siguen siendo cinco** (raíz + cuatro), comprobado hoy con `git worktree list` — los mismos cuatro de siempre, ninguno nuevo. La hipótesis de lanzar desde la raíz sigue sin confirmarse ni descartarse | Fuera de sesión, desde la raíz |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| 🟡 | **`visibility_scope` existe pero nada la lee todavía.** Columna, check y guardia aplicados; ninguna política de RLS ni ninguna pantalla la consultan. La activa de verdad la reescritura de "Lista de hilos" | §3.1 de mañana |
| ⚪ | ~~`MSG-01` sin remedir con los tres arreglos de `F-137`-`F-139` ya puestos desde el principio~~ | **Resuelto 1-sep-2026, segunda sesión: 3 de 3 en verde** |
| ⚪ | ~~Auditar si `SRCH-01`/`VND-01`/`PANEL-01`/`LOGIN-01` tienen el riesgo de `F-140`~~ | **Resuelto 1-sep-2026: `PANEL-01` tenía deriva real (`F-142`), corregida; los otros tres, limpios** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si el marcador de `MSG-01` sube de verdad a 3/3 en 4/4 con `F-141` ya puesto desde el
  principio.** Hoy lo descubrió la misma corrida que medía; la próxima es la primera que
  se mide con los cuatro arreglos ya en el corpus, y hasta entonces es una expectativa,
  no un dato.
- **Si `visibility_scope` y la lista derivada aguantan bajo carga una vez que
  `threads_select_participant` la use de verdad.** Hito 6. Con la columna y el índice ya
  puestos, es lo primero que se puede medir en cuanto se escriba esa política.
- **Si hay más hallazgos del tipo `F-141`/`F-142` en tareas que no se han vuelto a medir
  con `n>1` desde que se escribieron.** La auditoría de hoy fue por LITERALES en el
  `component_api`; no fue una remedición real de `SRCH-01`, `VND-01`, `PANEL-01` ni
  `LOGIN-01` con corridas pagadas — un hallazgo de forma (como `F-141`) solo se ve
  midiendo, y esas cuatro tareas no se han vuelto a medir desde antes de `F-131`.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** `F-137` añade
  un dato —el modelo a veces omite un default que la tarea ya pide literal— y `F-141` otro
  —dos formas de DOM igual de idiomáticas, y solo una es la que el contrato acepta— pero
  ninguno explica por qué una corrida concreta elige una y no la otra.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sin datos nuevos hoy.
- **Si el reparto de culpas de `F-134` aguanta una salida de playwright que no sea esta.**
  Sin tocar hoy.
- **Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en el repo. Doce días.

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
**El día 5 lo cumplió dos veces: la primera sesión revisó la CI job a job antes de cerrar
—por eso `F-140` está en el registro en vez de descubrirse al día siguiente—, y esta
segunda sesión corrió `test_checks.py` ANTES de commitear el arreglo de `F-141`, no al
cerrar el día, y por eso el mecanismo de `F-140` no volvió a colarse en la CI.**

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado hoy en el punto
   de `visibility_scope` (D-4).
3. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**: el cuerpo
   del acta contiene tres afirmaciones falsas que la corrección desmonta.
4. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
   `ADR-002` D-4 ya está construido; la siguiente pieza es "Lista de hilos" (§5, última
   fila roja).
5. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
6. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
7. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno. Hoy: `F-141` y `F-142`.

---

*Día 5 de V1, segundo cierre · 1-sep-2026 (13:46 UTC) · fecha leída de la máquina
(`date -u`) · estado verificado contra el código de `mvp/bootstrap`, contra
`information_schema`/`pg_constraint`/los datos reales del proyecto `troxminloxkjwihwfevs`,
contra la CI job a job de los dos pushes de la sesión y contra la salida de tres corridas
pagadas más — no contra otro documento · **el hallazgo del día no lo dio una medida sola,
lo dio correr el guardia local ANTES de commitear, no al cerrar** ·
Dirección Técnica, Nortex Systems*
