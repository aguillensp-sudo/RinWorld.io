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

**Día 5 de V1 · 1-sep-2026 · Estado: VERDE**

Este fichero se abrió hoy leyendo el segundo cierre del día 4, con `F-131` a `F-136`
cerrados y cinco tareas para hoy: desplegar `ThreadHeader.tsx`, remedir `MSG-01`,
decidir la Fundación V1, decidir el 57 a 1, y lo que saliera de mirar los tres artefactos
de "Nuevo contacto". **Las cinco se hicieron.** Y una de ellas escondía una sexta que no
estaba en ninguna lista.

**El hallazgo del día no es que `MSG-01` se remidiera peor de lo previsto, aunque también
pasó: `10c` pasó 4/4, pero `10a` y `10b` no solo repitieron el mismo rojo — con `n=3` real
fue 1 de 3, no las 2 de 3 que el contrafactual de ayer preveía.** El hallazgo es que
**arreglar uno de los hallazgos de hoy rompió la CI de otro, y nadie lo notó durante casi
una hora.** `F-139` explicaba un `data-testid` citando, sin darse cuenta, el mismo literal
que `F-128` tiene protegido en un test de regresión — `cruzar_con_el_contrato()` mira la
tarea entera como una sola cadena, así que una explicación nueva en un fichero pisó,
literalmente, la evidencia que otro test necesita en un fichero distinto. **Las tres CI
siguientes salieron rojas** (`9f09522`, `f47f026`, `087962b`) y ninguna corrección
posterior lo arregló, porque ninguna volvía a tocar esa frase. Se encontró al revisar la
CI job a job antes de cerrar — el mismo paso del §7 que ayer también se saltó nadie, y hoy
sí se hizo. **Un JSON válido y un test local en verde no bastan cuando el test que importa
es otro** (`F-140`).

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-01`, 09:15 UTC al escribir esto |
| Despliegue de `ThreadHeader.tsx` (`F-135`), pendiente desde ayer | `bearingworld.vercel.app`, tras `npx vercel --prod` | Desplegado y comprobado: `navigation "Ruta"` en el árbol de accesibilidad del hilo con Nordwälz Lager, y `X-Robots-Tag: noindex, nofollow, noarchive` presente |
| `MSG-01`, tres corridas más (`10a`/`10b`/`10c`) con `F-131`/`F-134`/`F-135` ya puestos | Los 9 `attempt_N.json` guardados | **1 de 3 en 4/4**, no las 2 de 3 que preveía el contrafactual de ayer. `10a` y `10b` escalan 2/4 — con causas DISTINTAS entre sí—; `10c` pasa 4/4 (marcado: e2e con 8 excusados por `F-134`) |
| `F-137`: por qué `10b` rompió `C1` con un `TS2375` | `relativeTime()` en `app/src/lib/threads.ts:133`, y los 9 artefactos | El tipo declarado `now?: Date` castigaba una omisión de default que nunca llegaba a causar un bug real — `relativeTime` ya tiene su propio respaldo. Ensanchado a `Date \| undefined` |
| `F-138`: por qué `10b` rompió `C2` en el contador de resultados | `harness/tasks/MSG-01.json` entero, buscando el literal | `data-testid="pag-info"` no estaba declarado en ningún sitio; `10a`/`10c` lo escribieron por costumbre, `10b` no. Declarado |
| `F-139`: por qué "Nuevo contacto" falla 9 de 9 | Los 9 `attempt_N.json`, no solo los 3 finales | No es del modelo: `directorio-scope` tampoco estaba declarado, y el único intento que lo acertó (`10c`) lo copió de un literal que se filtró por casualidad en el feedback truncado de `C2` — es `F-114` confirmado con nombre y apellido, no un hallazgo aparte |
| El índice de la derivación de la lista (`ADR-002` §5, última fila) | `pg_indexes` del proyecto real (`troxminloxkjwihwfevs`), antes y después, por el MCP | `thread_item_keys_recipient_idx (recipient_member_id)` sustituido por `thread_item_keys_recipient_item_idx (recipient_member_id, item_id)`, vía `apply_migration`. Solo el índice: la política sigue sin reescribirse |
| El 57 a 1 (Coder vs. orquestación, días 2-3 de V1) | Re-corrido `orchestration_metrics.py` contra las transcripciones reales + `harness-metrics.csv` | Confirmado exacto: $150,48 / $2,64 = 57,0. Decisión del PO: se acepta como patrón esperado del precio-sombra, sin acción |
| `F-140`: la CI del día, job a job | `gh run list` / `gh run view` sobre los cinco commits de hoy | **Tres corridas rojas** (`9f09522`, `f47f026`, `087962b`) por el literal de `F-128` citado sin querer al escribir `F-139`. Corregido en `025002a`: las cuatro piezas en verde |
| La suite del producto | `npm test` | **642 pasan, 23 saltadas** — igual que ayer; ninguno de los cambios de hoy tocó `app/` |
| La suite del arnés | `python -m harness.tests.test_checks` | **Todas en verde**, tras el arreglo de `F-140` |
| Los worktrees | `git worktree list` | Siguen siendo los mismos cuatro de ayer + la raíz. Ninguno nuevo hoy |
| Estado del árbol al cerrar | `git status` | Limpio tras el commit de cierre |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-136` | ✅ ver cierre anterior en `git show 2982d44` |
| **`F-137` tipo `now?: Date \| undefined` en `component_api`** | ✅ **1-sep · `b6e8d62`** |
| **`F-138` `data-testid="pag-info"` declarado** | ✅ **1-sep · `8c8becb`** |
| **`F-139` `data-testid="directorio-scope"` declarado — y es `F-114` confirmado** | ✅ **1-sep · `9f09522`, `f47f026`** |
| **`F-140` el arreglo de `F-139` rompió la CI de `F-128`, corregido** | ✅ **1-sep · `025002a`** |
| Medición del corpus | 🟡 **1 de 3 en 4/4** hoy, pero con un corpus que cambió A MITAD de medir: los tres arreglos se descubrieron corriendo estas mismas corridas, no se aplicaron antes de ellas. La cifra de mañana es la primera que mide el corpus ya arreglado |
| `MSG-01` a 4/4 | 🟡 Ya no queda un rojo conocido sin explicar, pero falta la corrida que lo confirme |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5, última fila) | ✅ **1-sep · `087962b`**, `0017_thread_derivation_index.sql` |
| Resto de la Fundación (entregables 1-3, 6; `visibility_scope`; el resto de `ADR-002` §5) | 🟡 Sin cambios — ver `FUNDACION-V1.md`, actualizado hoy en el punto del índice |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

1. **Re-correr `MSG-01` una vez más (n=3), con `F-137`/`F-138`/`F-139` ya en el corpus
   desde el principio.** La corrida de hoy fue la que los descubrió; esta es la primera
   que puede decir de verdad si el marcador sube. ~$0,10 por tirada, tres tiradas.
2. **`visibility_scope` (D-4 de `ADR-002`), el siguiente entregable de la Fundación.**
   Cambia comportamiento visible, y con el índice de hoy ya puesto no bloquea nada.
3. **Auditar si `SRCH-01`, `VND-01`, `PANEL-01` y `LOGIN-01` tienen el mismo riesgo que
   `F-140` acaba de mostrar hoy:** una explicación nueva en `component_api` pisando sin
   querer un literal que un test de regresión de otro hallazgo usa como ancla. No
   auditado todavía en ninguna de las cuatro.
4. **(sigue abierto) Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en
   el repo. Van ya doce días.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después. El índice de la derivación de la lista ya está hecho (§2); el resto de sus siete objetos de esquema sigue a cero | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
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
| **El 57 a 1 se acepta, sin acción** | 1-sep-2026, PO. El coste de una pantalla lo domina orquestar, no generar; sin presión de coste marginal real, se sigue midiendo pero no se optimiza | `F-113`, hoy |
| **El recorte posicional del feedback (`F-114`) se acepta como coste conocido** | 1-sep-2026, PO, opción (a). No se toca `test_runner.py`: el arreglo real sigue siendo declarar en `component_api` en cuanto se descubre, no hacer más listo el canal de feedback | `F-114`, `F-139` |
| **El corpus se congela en ALCANCE, no en git** | Se congela lo que se le pide al Coder; la firma se declara al día | `F-118` |
| **El recorte lo hace quien mide, no el producto** | `npm test` y la CI corren la suite entera; el que excluye es C1 (`test:arnes`) y C2, con la misma forma | `F-116`, `F-134` |
| **Lo que el contrato exige, la tarea lo dice** | **Trece veces en seis días.** La vía elegida ha sido siempre la misma: declararlo en `component_api` —o, en `acceptance`—, sin tocar ni un aserto | `F-116`, `F-118`, `F-123`, `F-125`–`F-128`, `F-131`, `F-134`, `F-138`, `F-139` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **`MSG-01` sin remedir con los tres arreglos de hoy ya puestos desde el principio.** `F-137`, `F-138` y `F-139` cierran los rojos conocidos, pero la corrida de hoy fue la que los DESCUBRIÓ, no una que los mida ya aplicados | §3.1 de mañana |
| 🟠 | **La Fundación V1 tiene un entregable con reloj: la residencia.** Sin cambios hoy — sigue llamando a `api.anthropic.com`, sin fecha puesta | Álvaro |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Sin cambios | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: siguen siendo cinco** (raíz + cuatro), comprobado hoy con `git worktree list` — los mismos cuatro de ayer, ninguno nuevo. La hipótesis de la cabecera sigue sin confirmarse ni descartarse | Fuera de sesión, desde la raíz |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| 🟡 | **Un corpus de tareas en prosa densa puede romper un test de regresión de OTRO hallazgo sin que nadie lo note (`F-140`).** Auditar `SRCH-01`, `VND-01`, `PANEL-01`, `LOGIN-01` | §3.3 de mañana |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si el marcador de `MSG-01` sube de verdad con los tres arreglos ya puestos desde el
  principio.** Hoy los descubrió la misma corrida que medía; mañana es la primera vez que
  se mide con ellos ya en el corpus, y hasta entonces es una expectativa, no un dato.
- **Si `SRCH-01`, `VND-01`, `PANEL-01` o `LOGIN-01` tienen el mismo riesgo que `F-140`
  acaba de mostrar en `MSG-01`.** No se ha revisado ninguna de las cuatro contra sus
  propios tests de regresión.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** `F-137` añade
  un dato —el modelo a veces omite un default que la tarea ya pide literal— pero no dice
  por qué esa omisión ocurre en un intento y no en otro.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sin datos nuevos hoy.
- **Si `visibility_scope` y la lista derivada aguantan bajo carga.** Hito 6. Con el
  índice de hoy puesto, es lo primero que se puede medir cuando llegue ese hito.
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
**El día 5 lo cumplió: la CI se revisó job a job antes de escribir este cierre, y por eso
`F-140` está aquí en vez de descubrirse mañana.**

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado hoy en el punto
   del índice de la derivación de la lista.
3. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**: el cuerpo
   del acta contiene tres afirmaciones falsas que la corrección desmonta.
4. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
5. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
6. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
7. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno. Hoy: `F-137` a `F-140`.

---

*Día 5 de V1 · 1-sep-2026 (09:15 UTC) · fecha leída de la máquina (`date -u`) · estado
verificado contra el código de `mvp/bootstrap`, contra `pg_indexes` del proyecto real,
contra `bearingworld.vercel.app` desplegado, contra la CI job a job de los cinco commits
del día y contra la salida de tres corridas pagadas más — no contra otro documento ·
**el hallazgo del día no lo dio una medida, lo dio revisar la CI antes de cerrar** ·
Dirección Técnica, Nortex Systems*
