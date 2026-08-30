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

## ⚠ Las tres reglas de este fichero

Salen de errores cometidos, no de teoría. Cada una tiene su cadáver detrás.

**1 · Cita, no parafrasees.** Los valores de estado y las asignaciones de modelo se copian
del documento cerrado **con el puntero al lado** (`F-012`).

**2 · Un estado que este fichero afirme se comprueba EL DÍA que se escribe, contra el
código o contra la base — no contra otro documento.** El 25-ago se descubrió que tres
documentos llevaban **diez días** diciendo que `B-008`, `B-009` y `B-010` estaban
pendientes cuando se habían cerrado el 12-ago. **Y el 30-ago volvió a morder, desde
dentro:** la §4 de este fichero afirmaba como decisión cerrada que las filas inválidas de
`F-121` «se marcan, no se borran», y **no se habían marcado** — `grep -i F-121` sobre el
CSV daba cero (`F-129`). **Ningún documento es fuente de verdad sobre el código. Este
tampoco.**

**3 · La fecha se lee de la máquina, nunca de memoria.** El día 14 del MVP se fechó a sí
mismo un día por delante y esa hora de diferencia es exactamente lo que ocultó `F-109`
durante dos jornadas. El 25-ago volvió a pasar por el otro lado: tres documentos se
fecharon tres días atrás. **`date -u` antes de escribir la cabecera.**

**4 · Este fichero se cierra CUANDO SE ACABA, no cuando parece que se acaba.** El día 3 se
cerró a las 12:33 y el trabajo siguió hasta las 13:45: `F-125`, el guardia de tarea contra
contrato, `F-126` y `F-127` se cerraron **después** de escribirlo, y `F-128` se descubrió.
El día 4 arrancó leyendo un relevo que ya estaba desfasado por una tarde y que mandaba
hacer dos cosas que ya estaban hechas.

---

**Día 4 de V1 · 30-ago-2026 · Lo que vigila siempre es una muesca más estrecho que lo
vigilado · Estado: VERDE**

Cuarto día operativo. Se cierra `F-122` —el último punto abierto de la fiabilidad del
propio arnés— y el arnés **entra por fin en la CI**. Con eso, la corriente A no tiene
ninguna pieza de instrumentación pendiente.

**Y el hallazgo del día es que tres cosas escritas para vigilar resultaron ser, cada una,
una muesca más estrechas que lo que vigilaban.** Una decisión afirmaba una marca que no
existía (`F-129`). El guardia escrito **ayer** leía literales entrecomillados y el contrato
buscaba con expresiones regulares, que es exactamente por lo que no cazó `F-128`
(`F-130`). Y el guardia comprueba los roles que hay que **poner** y ninguno de los que no
hay que **quitar**, que es lo que se llevó la corrida 08 por delante (`F-131`).

**El marcador no se mueve: sigue 2 de 4.** `MSG-01` volvió a escalar. Pero por primera vez
se sabe exactamente por qué, y no es el modelo.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` y `datetime.now()` | `2026-08-30` |
| El relevo del día 3 estaba desfasado | `git log --date=format` sobre `mvp/bootstrap` | Se cerró en `ed859b7` (12:33) y siguieron **nueve commits** hasta las 13:45. Los puntos 1 y 2 de su §3 ya estaban hechos |
| `F-122`: el reloj corre con el hilo principal bloqueado | Subproceso real, hilo principal en un `sleep(30)`, plazo 0,3 s | Sale en **menos de un segundo**, con código 4 y habiendo volcado. El GIL se suelta en la E/S y el hilo del reloj sigue contando |
| `F-122`: lo pagado ya no se tira | Grafo entero con nodos falsos, `stream(stream_mode="values")` | **El intento 1 está en disco mientras el 2 se está pagando.** Es el dato exacto que `SRCH-01` perdió el 29-ago |
| …y en una corrida de verdad | `remedicion-08-msg-con-F128/MSG-01.log` | `· intento 1 ya en disco … (F-122)` tras cada intento, antes de que el grafo terminara |
| El arnés corre en la CI, y en Linux | Log del job `Arnés · piezas puras`, run `33303797454` | `Todas en verde`. **La rama POSIX de `_pid_vivo` se ejecutó por primera vez** — se escribió mirando solo Windows |
| `F-129`: las filas inválidas de `F-121` nunca se marcaron | `grep -i "F-121" openspec/mvp/harness-metrics.csv` | **Cero.** La §4 de ayer lo daba por decidido el 25-ago |
| …y cuáles son exactamente las doce | `git show` de los cinco commits de la tanda (09:53 → 10:21) y búsqueda literal en el fichero de hoy | **12 de 12**, en orden y sin ambigüedad. Marcadas. Cabecera intacta, 85 filas, 14 columnas |
| `F-130`: el guardia no ve lo que se busca por regex | `cruzar_con_el_contrato` sobre las seis tareas, antes y después | `'fuera del MVP'` era invisible; ahora sale. **Y siete nombres más en tareas que están VERDES**, por eso va a aviso |
| `F-128` llegó al Coder | Corrida 08 contra corrida 07, fallo a fallo | Los **dos** objetivos de `F-128` arreglados: el aviso enseña el error de verdad y el estado vacío sale con su botón y su motivo |
| `F-131`: por qué la 08 empeoró | `ThreadList.tsx:75` del artefacto, y `npx vitest run` a mano contra él | `<li role="button">`. Un `role` explícito **sustituye** al implícito: `Unable to find an accessible element with the role "listitem"`, y el contrato lo consulta **siete veces** |
| Fundación V1 sigue sin empezar | `ls openspec/v1/` y `git log --since=2026-08-26` | Solo los tres `.docx` del plan, este fichero y el script de gstack. Nada de entornos, índice ni residencia |
| Utillaje externo sigue fijado | `openspec/v1/gstack-instalacion-endurecida.sh:33` | `SHA_AUDITADO="85fd9db554ae…"`, v1.68.3.0 del 21-ago. Modo aislado |
| Los worktrees no son prunables | `git worktree prune --dry-run` | **No dice nada.** Los directorios existen; no hay registro muerto que limpiar |
| Estado del árbol y del cerrojo al cerrar | `git status`, `ls` | Limpio y suelto |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `B-007` `--seco` valida la tarea que recibe | ✅ 28-ago · `dfa8c74` |
| `F-114`/`F-115` feedback con inventario, y la evidencia no se borra | ✅ 28-ago · `ecd5952` |
| `B-011`/`F-116` lo fuera de contrato no puntúa | ✅ 29-ago · `28aa31b` |
| `F-117`/`F-118`/`F-119` `!important`, corpus congelado, corte de conexión | ✅ 29-ago · `1183a38` |
| `F-120`/`F-121`/`F-124` señal de vida, cerrojo, y que caduque solo | ✅ 29-ago · `cf917cc`, `9c47960`, `34f85b4` |
| `F-123`/`F-125`/`F-126`/`F-127` cuatro tareas que contradecían su contrato | ✅ 29-ago · `dbfd49c`, `904d1f7`, `85eb991`, `38edd66` |
| **Guardia que cruza tarea contra contrato** | ✅ 29-ago · `ae670fb`, `debb576` — **y ya se le han escapado dos cosas**, ver `F-130` y `F-131` |
| **`F-122` reloj de pared dentro de `run.py`** | ✅ **30-ago · `343d559`** — visto funcionar en la corrida 08 |
| **El arnés en la CI** | ✅ **30-ago · `6fc7c7f`** — verde en Linux a la primera |
| **`F-129` filas inválidas marcadas + columna `corrida`** | ✅ **30-ago · `d672326`, `762e4de`** |
| **`F-128`/`F-130`** | ✅ **30-ago · `65099d9`, `2f841bd`** |
| **Medición del corpus** | 🟡 **Sigue 2 de 4.** `SRCH-01` verde en la corrida 06; `MSG-01` escaló otra vez y ahora se sabe por qué (`F-131`) |
| `F-131` la tarea no protege los roles implícitos | 🔴 **Abierto.** Es el único rojo que separa a `MSG-01` de ser medible |
| Fundación V1 (entornos, ADR-002, índice, residencia) | ⚪ **No empezada.** Comprobado hoy contra el directorio, no contra el §2 de ayer |

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos. Límite escrito: **máximo
cuatro agentes de construcción concurrentes**.

### Corriente C · Verificación — NO ABIERTA

Utillaje externo instalado y endurecido el 22-ago: modo aislado, commit fijado en
`85fd9db5`, los cinco interruptores de red apagados. Verificado hoy en el script.

---

## 3 · Qué toca mañana, en este orden

1. **`F-131`, y es la misma receta de siempre.** Declarar en `component_api` de
   `ThreadList.tsx` que la fila **conserva su rol `listitem`** y que hacerla pulsable no
   puede costárselo — el patrón correcto es un botón **dentro** del `<li>`, no un `role`
   **encima**. Con eso `MSG-01` se queda a dos rojos —`Nuevo contacto` deshabilitado con
   motivo, y el recuento con `Intl`—, que son los dos que llevan tres corridas seguidas
   fallando **y sí están declarados**: esos dos, por primera vez, parecen del modelo.
   Corrida 09, ~$0,10.
2. **La otra mitad de `F-131`: que el guardia lea los roles IMPLÍCITOS.** Hoy solo mira los
   que hay que escribir a mano y descarta `listitem` *porque el elemento lo da gratis* —
   supuesto que es falso en cuanto el Coder escribe un `role` encima. **Es la cuarta vez que
   el guardia es una muesca más estrecho que el contrato** (`F-127`, `F-130`, `F-131`), y a
   la cuarta ya no es mala suerte: cada versión cubre las formas de aserto que había
   delante, no las que hay.
3. **Decidir qué se hace con el 57 a 1.** Ver §5. Es la cifra que más debería mover el plan
   y no tiene dueño.
4. **Fundación V1.** Sigue sin empezar y ahora es lo único que queda en la corriente A
   además de la medición. Es el candidato más barato.
5. **Medir algo con n>1.** Ver §6: la pregunta «¿esto ha mejorado?» no es contestable con
   una corrida por configuración, y hoy ha vuelto a hacer falta.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después | `docs/ADR-002_*.md` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. No DeepSeek: sin acuerdo de tratamiento y entrena por defecto | Plan §4.2 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Utillaje externo** | Modo aislado, commit fijado, interruptores apagados. Nunca modo equipo | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **Cuatro agentes máximo** | En construcción concurrente. Los de verificación no cuentan | Plan §6.2 |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió. Las filas inválidas de `F-121` **se marcan, no se borran** — y desde el 30-ago **están marcadas de verdad**, que es lo que esta línea llevaba cinco días afirmando en falso | 25-ago · `F-129` |
| **Columna `corrida` en el CSV** | 30-ago, PO. Entra **antes de `resultado`**, que es la convención escrita en `metrics.py`; las 85 filas históricas llevan `-` y no se reconstruyen. La escribe `--corrida` | `F-129` |
| **El guardia AVISA de lo que busca por regex, no bloquea** | 30-ago, y es una **medida**: al encenderlo salieron siete nombres nuevos en tareas que están **VERDES** con ellos sin declarar. Uno de los siete era real. Misma decisión que `F-127` con los roles | `F-130` |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py:33-40` |
| **Coste de orquestación: precio-sombra** | Tokens reales × tarifa pública de la API. No consola de facturación —Claude Code va por suscripción— ni estimación a ojo | `orchestration_pricing.py` |
| **El corpus se congela en ALCANCE, no en git** | 29-ago, PO. Se congela lo que se le pide al Coder; la **firma** se declara al día | `F-118` |
| **El recorte lo hace quien mide, no el producto** | `npm test` y la CI corren la suite entera; el que excluye es C1 (`test:arnes`) | `F-116` |
| **Lo que el contrato exige, la tarea lo dice** | Ocho veces en cuatro días. La vía elegida ha sido siempre la misma: **declararlo en `component_api`**, sin tocar ni un aserto | `F-116`, `F-118`, `F-123`, `F-125`, `F-126`, `F-127`, `F-128`, `F-131` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🔴 | **`F-131`: la tarea dice qué roles escribir y ninguno que no se pueda pisar.** Es el único rojo que separa a `MSG-01` de ser medible | §3.1 y §3.2 |
| 🟠 | **El guardia va cuatro veces por detrás del contrato.** `F-127`, `F-130`, `F-131`. Cada versión cubre las formas de aserto que había delante | §3.2 |
| 🟠 | **57 a 1, y sin dueño.** El Coder de los días 2 y 3 costó **$2,64**; la orquestación atribuida a esos días, **$150,48**. ⚠ Es precio-**sombra** a tarifa pública y Claude Code va por suscripción, así que no es lo que se paga — pero es el número que el proyecto eligió seguir, y dice que **el coste de una pantalla lo domina la orquestación, no la generación.** Eso, si se sostiene, cambia la premisa de la fábrica | Álvaro, con §3.3 |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. No bloquea porque el MCP llega, pero depender de eso es depender de la suerte | Álvaro: re-loguear y `link` |
| 🟡 | **Nada despliega solo.** Si se toca código, se despliega **y se comprueba en la URL**. Hoy no se ha tocado producto: el artefacto de la corrida 08 se descarta, como siempre | Se cumple cerrando con el despliegue hecho |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Riesgo aceptado por el PO el 18-ago hasta después de la reunión. **Sigue abierto** | Álvaro: 20 $/mes |
| 🟡 | **Los tres worktrees no se van con `prune`.** Comprobado hoy: sus directorios existen, no hay registro muerto. Haría falta `git worktree remove`, y uno es la sesión desde la que se escribe | Fuera de sesión, desde la raíz del repo |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si `F-128` causó los ocho fallos nuevos de la corrida 08, o es varianza.** El mecanismo
  de `F-131` es seguro —un `role` explícito tapa al implícito, reproducido a mano—, pero
  **por qué el Coder escribió `role="button"` en la 08 y no en la 07 no se sabe**. Las dos
  únicas menciones de `role=` que tiene la tarea son las que metieron `F-127` y `F-128`, las
  dos diciendo «escribe este rol», y es tentador leer ahí la causa. **Con n=1 por
  configuración eso no es distinguible de una diferencia de tirada, y no se ha adivinado.**
- **Y por eso mismo: la pregunta «¿esto ha mejorado?» no es contestable hoy.** Cada corrida
  es n=1. Es la primera vez que hace falta de verdad y ha sido hoy.
- **Si los dos rojos que le quedan a `MSG-01` son del modelo.** `Nuevo contacto` con motivo y
  el recuento con `Intl` llevan **tres corridas seguidas** fallando y **sí están
  declarados**. Eso ya parece medida limpia — pero eso mismo parecía `SRCH-01` antes de
  `F-123`, así que no se afirma hasta leerlos uno por uno.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.** Sigue
  sin datos. Hoy no ha pasado: la corrida 08 fue tarea única y el reloj de pared no llegó a
  dispararse, así que **`F-122` sigue sin haberse probado en el caso que lo motivó.**
- **Cuánto del coste-sombra es una sesión larga y cuánto son muchas.** El total son
  **$501,69**, no los $331,58 que decía el relevo de ayer: la cifra llevaba parada desde el
  25-ago. Por fecha, $337,51 cae en el MVP y $164,18 en V1 — pero el propio módulo avisa de
  que una sesión larga concentra su coste en el día que arrancó, así que la frontera es
  borrosa justo donde importa.
- **Qué se pierde por no versionar los logs de corrida.** `.gitignore:32` ignora `*.log` y
  **hay cero logs de `harness/metrics/` en el repo**. El §1 de ayer citaba `SRCH-01.log`
  como prueba de que el reintento de `F-119` funcionaba, y esa prueba **no la puede
  comprobar nadie más**: vive solo en la máquina donde se corrió. Los JSON guardan los
  checks y el artefacto (`B-010`); el log guarda el **orden y los tiempos** — los avisos de
  reintento, los del reloj de pared, en qué momento se volcó cada intento— y eso no está en
  ningún otro sitio. Es `F-115` sin terminar. No se ha tocado `.gitignore` hoy porque `*.log`
  es una regla ancha y quitarla a medias es peor que dejarla.
- **Si `visibility_scope` y la lista derivada aguantan bajo carga.** Hito 6, no antes.
- **Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en el repo. Diez días.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas.
3. **Revisar §2 contra el código**, no contra el §2 de ayer. Toda pieza marcada como
   pendiente se comprueba en el fichero real ese mismo día. Es la regla 2 y costó diez días
   descubrir por qué existe — y el 30-ago volvió a morder desde dentro (`F-129`).
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

⚠ **Y el paso cero, que es la regla 4: no cierres hasta que se acabe.** El día 3 se cerró a
las 12:33 y siguió trabajando hasta las 13:45. Si después del cierre se toca algo, este
fichero se vuelve a tocar.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**: el cuerpo
   del acta contiene tres afirmaciones falsas que la corrección desmonta.
3. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
4. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
5. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
6. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno. Hoy: `F-129`, `F-130`, `F-131`.

---

*Día 4 de V1 · 30-ago-2026 · fecha leída de la máquina (`date -u` + `datetime.now()`) ·
estado verificado contra el código de `mvp/bootstrap`, contra los logs de la CI y contra la
salida real de la corrida 08, no contra otro documento · **una corrida del corpus, y el
fallo que la explica reproducido a mano contra el artefacto antes de escribirlo aquí** ·
Dirección Técnica, Nortex Systems*
