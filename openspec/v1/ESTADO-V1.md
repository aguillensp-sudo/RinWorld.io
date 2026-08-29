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
pendientes cuando se habían cerrado el 12-ago. El error se propagó al acta de cierre, al
plan de V1 y a un encargo que estuvo a punto de lanzarse. **Ningún documento es fuente de
verdad sobre el código. Solo el código lo es.**

**3 · La fecha se lee de la máquina, nunca de memoria.** El día 14 del MVP se fechó a sí
mismo un día por delante y esa hora de diferencia es exactamente lo que ocultó `F-109`
durante dos jornadas. El 25-ago volvió a pasar por el otro lado: tres documentos se
fecharon tres días atrás. **`date -u` antes de escribir la cabecera.**

---

**Día 3 de V1 · 29-ago-2026 · El corpus ya se mide sin el arnés dentro · Estado: VERDE**

Tercer día operativo. El día 2 diagnosticó `F-112` —el 2 de 4 medía el arnés, no al
Coder—; hoy se han quitado las siete cosas que se interponían y se ha remedido el
corpus **cuatro veces**, tres de ellas tiradas a la basura por fallos de la propia
instrumentación. **La cuarta es la primera medición limpia del proyecto.**

El marcador sigue siendo **2 de 4 en verde**. Lo que ha cambiado es todo lo demás: los
rojos de `SRCH-01` pasaron de **13 a un solo check**, los de `MSG-01` de **6 a 3
tests**, y ya no queda ni uno en un fichero que el Coder no escriba, ni en un bloque
rotulado fuera de contrato, ni una dependencia inventada. No se ha tocado producto:
sigue siendo fábrica.

**Y el hallazgo del día no es el marcador.** Cuatro veces en tres días el contrato
exigía algo que la tarea no decía (`F-116`, `F-118`, `F-123`, `F-125`). No es mala
suerte: es que **la tarea y el contrato se escriben una vez y el repo sigue andando**,
y nadie los vuelve a cruzar. Mientras eso no tenga un guardia, cada medición vuelve a
empezar con este trabajo.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` y `datetime.now()` | `2026-08-29` |
| El feedback ya lleva el inventario (`F-114`) | La salida real de las corridas | `19 fallo(s) en total, no solo el ultimo. Lista completa:` — y con la lista delante se vio a la primera que los errores que mandaban estaban en `App.tsx`, un fichero que el Coder no escribe |
| El reintento de transporte (`F-119`) funciona contra la API real | `SRCH-01.log`, corrida 04 | `⚠ TimeoutError… No es un intento del modelo (F-119): reintento en 5s`. **Ese mismo cuelgue, el día anterior, costó nueve horas en silencio** |
| Las dos suites miden cosas distintas y ninguna pierde cobertura | `npm test` / `npm run test:arnes` | **642** el producto, **627** el arnés. La diferencia son los tests fuera de contrato |
| El corpus, remedido limpio | 4 tareas × 3 intentos, corridas 03 y 04 | `PANEL-01` verde en 3 · `VND-01` verde en 2 · `MSG-01` escalado 2/4 · `SRCH-01` escalado **3/4** |
| Que la medición de la mañana **no** valía | Marcas de tiempo de los commits del CSV | `abf4733` (09:53) y `f3daddf` (09:57) se solapan, y así tres pares: **dos corridas midiendo a la vez sobre el mismo `app/src`**, y ninguna dio error (`F-121`) |
| Que el cerrojo sobrevivía a su dueño | `ls harness/.corrida-en-curso` tras un corte por plazo | Seguía puesto: un `finally` no corre con `SIGKILL` (`F-124`) |
| Que el plazo de pared dispara tarde | Reloj contra el arranque | 25 min configurados, **34m45s reales** (`F-122`) |
| Estado del árbol y del cerrojo al cerrar | `git status`, `ls` | Limpio y suelto |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `B-007` `--seco` valida la tarea que recibe | ✅ 28-ago · `dfa8c74` |
| Coste de orquestación instrumentado | ✅ 28-ago · `ae8448d` — $331,58, ver §3.5 |
| `F-114` el feedback lleva el inventario de fallos | ✅ 28-ago · `ecd5952` |
| `F-115` una corrida ya no borra su evidencia | ✅ 28-ago · `ecd5952` |
| `B-011`/`F-116` lo fuera de contrato no puntúa | ✅ 29-ago · `28aa31b` |
| `F-117` C4 deja de leer `!important` como un `import` | ✅ 29-ago · `1183a38` |
| `F-118` corpus congelado: alcance intacto, firma al día | ✅ 29-ago · `1183a38` |
| `F-119` un corte de conexión no gasta intento | ✅ 29-ago · `1183a38` — visto funcionar |
| `F-120` la señal de vida llega al log | ✅ 29-ago · `cf917cc` |
| `F-121` dos corridas no caben en el mismo árbol | ✅ 29-ago · `9c47960` |
| `F-123` la tarea de `SRCH-01` deja de contradecir su contrato | ✅ 29-ago · `dbfd49c` |
| `F-124` el cerrojo caduca cuando su dueño ya no existe | ✅ 29-ago · `34f85b4` |
| **Medición del corpus** | 🟡 **Tres de cuatro medidas de verdad.** `SRCH-01` a un `aria-label` de estarlo (`F-125`) |
| `F-122` reloj de pared dentro de `run.py` | 🔴 Abierto. El plazo de fuera dispara tarde y al matar pierde los intentos ya pagados |
| Fundación V1 (entornos, ADR-002, índice, residencia) | ⚪ No empezada |

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos. Límite escrito: **máximo
cuatro agentes de construcción concurrentes**.

### Corriente C · Verificación — NO ABIERTA

Utillaje externo instalado y endurecido el 22-ago: modo aislado, commit fijado en
`85fd9db5`, los cinco interruptores de red apagados.

---

## 3 · Qué toca mañana, en este orden

1. **`F-125`, y es una línea.** Declarar en `component_api` de `FilterChips.tsx` que el
   botón que despliega el formulario lleva nombre accesible `Añadir filtro`. Con eso
   `SRCH-01` queda medido: hoy llegó a `C1`, `C3` y `C4` verdes y la aceptación de
   unidad entera en verde, y lo único rojo es el e2e por ese nombre. ~$0,24 y 20 min.
2. **Un guardia que cruce tarea contra contrato.** Cuatro veces en tres días el
   contrato exigió algo que la tarea no decía. `--seco` ya comprueba que los ficheros
   existan; lo que falta es cruzar **lo que el contrato busca** —nombres accesibles,
   literales— contra **lo que la tarea declara**. Es la deuda que de verdad importa:
   sin ella, la próxima medición vuelve a empezar por aquí.
3. **`F-122`**, el reloj de pared dentro de `run.py`, escribiendo cada intento en
   cuanto termina. Hoy un corte por plazo tira los intentos ya pagados.
4. **Fundación V1** sigue sin empezar. Es el candidato más barato que queda.
5. **Leer el coste-sombra.** $331,58 en 9 sesiones: falta separar MVP de V1 y decidir
   si sustituye o solo informa la partida "tecnología" del plan (`Plan_V1…v2.3.docx`,
   Tabla 5, 3.000–7.000 €).

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
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió. **Por eso las filas inválidas de `F-121` se marcan, no se borran** | 25-ago |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py` |
| **Coste de orquestación: precio-sombra** | Tokens reales × tarifa pública de la API. No consola de facturación —Claude Code va por suscripción— ni estimación a ojo | `orchestration_pricing.py`, 28-ago |
| **El corpus se congela en ALCANCE, no en git** | 29-ago, PO. Restaurar `app/` a un commit viejo congelaría también los arreglos del arnés. Se congela lo que se le pide al Coder; la **firma** se declara al día | `F-118` |
| **El recorte lo hace quien mide, no el producto** | `npm test` y la CI corren la suite entera; el que excluye es C1 (`test:arnes`). Al revés, olvidar una bandera perdería cobertura del producto en silencio | `F-116` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **Nada cruza tarea contra contrato.** Cuatro veces en tres días el contrato exigió lo que la tarea no decía. Es la causa raíz de casi todo lo de hoy | Un encargo propio, ver §3.2 |
| 🟠 | **`F-122`: el plazo vive fuera del proceso.** Dispara tarde y al matar pierde los intentos ya pagados | Reloj de pared en `run.py` |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. No bloquea porque el MCP llega, pero depender de eso es depender de la suerte | Álvaro: re-loguear y `link` |
| 🟡 | **Nada despliega solo.** Si se toca código, se despliega **y se comprueba en la URL** | Se cumple cerrando con el despliegue hecho |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Riesgo aceptado por el PO el 18-ago hasta después de la reunión. **Sigue abierto** | Álvaro: 20 $/mes |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si `MSG-01` escala por el modelo o por lo mismo de siempre.** Sus tres rojos están
  dentro de su contrato de unidad —estado de error, botón sin motivo, `Intl`— y eso
  **parece** una medida limpia del Coder. Pero eso mismo parecían los dos de `SRCH-01`
  hace seis horas, y resultaron ser `F-123`. **No se han leído uno por uno.**
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Cuatro cortes en cuatro tandas, ninguno en la que abre. Puede ser el proveedor
  limitando peticiones seguidas, puede ser reutilización de conexión, puede ser
  casualidad con n=4. No hay datos para decidirlo y no se ha adivinado.
- **Cuánto de los $331,58 de coste-sombra es MVP y cuánto es V1.**
- **Cuánto costó de verdad medir hoy.** Cuatro corridas del corpus, tres inválidas.
  Los números están en el CSV y nadie los ha sumado — y es el dato que dice si esta
  forma de medir sale a cuenta.
- **Si `visibility_scope` y la lista derivada aguantan bajo carga.** Hito 6, no antes.
- **Qué pasó en la reunión con el socio del 20-ago.** Ni una línea en el repo.
- **Por qué la suite del arnés no está en la CI.** La CI corre esquema, app y
  Playwright, y no `harness/tests/test_checks.py`. Por eso `test_c2_paths` estuvo
  dieciséis días en rojo fijo sin que saltara nada.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas.
3. **Revisar §2 contra el código**, no contra el §2 de ayer. Toda pieza marcada como
   pendiente se comprueba en el fichero real ese mismo día. Es la regla 2 y costó diez días
   descubrir por qué existe.
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

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
   uno.

---

*Día 3 de V1 · 29-ago-2026 · fecha leída de la máquina (`date -u` + `datetime.now()`) ·
estado verificado contra el código de `mvp/bootstrap` y contra la salida real de las
corridas, no contra otro documento · **cuatro corridas del corpus, tres invalidadas por
la propia instrumentación y dichas como tales** · Dirección Técnica, Nortex Systems*
