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

**Día 2 de V1 · 28-ago-2026 · Instrumento cerrado del todo, medición en n=4 · Estado: VERDE**

Segundo día operativo de V1 (el 26 y el 27 no hubo sesión). Se cerró la última pieza
pendiente del instrumento (`B-007`) y se amplió la medición del bucle arreglado de una
tarea a cuatro: dos pasan a verde, dos repiten el fallo exacto de antes del arreglo. Es
señal real, no ruido, y no está diagnosticada. No se ha tocado producto: sigue siendo
fábrica.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u`, dos veces, más `python -c "datetime.now()"` | `2026-08-28`. Una lectura suelta anterior en la sesión dio 25-ago; descartada, no se escribió nada con ella |
| El worktree activo era el correcto | `ls`, `harness/` `app/` `supabase/` presentes | Se empezó en un worktree `claude/…` sin esos tres — el error que la línea 3 describe, cuarta vez, en vivo |
| `git worktree prune` | `git worktree list` antes/después | Sin cambios: los tres worktrees `claude/…` siguen vivos como directorios, no son prunables |
| Aviso de la línea 3 restaurado | `git diff` sobre este fichero antes de comitear | Edición ya presente sin comitear en el repo (no la escribió esta sesión); comiteada en `fcafa70`, empujada |
| Medición del bucle arreglado, 3 tareas nuevas | `harness-metrics.csv`, 9 filas nuevas, fecha `2026-08-28` | `PANEL-01` **verde en 3** (antes escalaba con el mismo fallo repetido); `SRCH-01` y `MSG-01` **escalan en 3**, feedback del intento 3 indistinguible del histórico. Commit `f60a163`. Detalle en `F-112` |
| Working tree tras las corridas | `git status`, `git diff --stat -- app/` | El Coder escribió sobre `app/src/screens/{panel,search,messages}/*` (1219+/1393−). Descartado por decisión del PO — solo queda el CSV |
| `B-007` (`--seco` ignoraba la tarea) | `harness/tests/dry_run.py` en la punta, contra las 6 tareas reales + 1 tarea rota a propósito | Las 6 reales pasan limpias; la rota cazó los 4 tipos de problema (`inputs`, `acceptance`, `outputs`, `component_api`) sin llamar al grafo. Cerrado en `dfa8c74`, registros en `bbed0e1` |
| Coste de orquestación instrumentado | `python -m harness.core.orchestration_metrics` contra las transcripciones reales de los 3 worktrees con sesiones | 9 sesiones, **$331,58 de coste-sombra** (13-ago→hoy), a `openspec/mvp/orchestration-metrics.csv`. Fórmula probada a mano contra los 5 componentes de precio. Commit `ae8448d` |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `B-009` ruido en el feedback al generador | ✅ 12-ago · `e58fa9b` |
| `B-008` el reintento enseña el código anterior | ✅ 12-ago · `e58fa9b` |
| `B-010` el JSON guarda el contenido, no solo rutas | ✅ 12-ago · `e58fa9b` |
| Tabla de precios con vigencia | ✅ 25-ago · `ecb792c` |
| Manifiesto de dependencias | ✅ 25-ago · `f47e11a` |
| `B-007` `--seco` valida la tarea que recibe | ✅ 28-ago · `dfa8c74` |
| Instrumentar el coste de orquestación | ✅ 28-ago · `ae8448d` — precio-sombra, ver §4 |
| **Convertir la observación en medición** | 🟡 **En curso — n=4** (`VND-01` y `PANEL-01` verdes, `SRCH-01` y `MSG-01` escalados con el mismo fallo de antes del arreglo). Sigue sin ser tendencia; ahora es una discrepancia sin diagnosticar (`F-112`) |
| Fundación V1 (entornos, ADR-002, índice, residencia) | ⚪ No empezada |

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos. Límite escrito: **máximo
cuatro agentes de construcción concurrentes**.

### Corriente C · Verificación — NO ABIERTA

Utillaje externo instalado y endurecido el 22-ago: modo aislado, commit fijado en
`85fd9db5`, los cinco interruptores de red apagados.

---

## 3 · Qué toca mañana, en este orden

1. **`F-112`, antes de correr más tareas del corpus.** `SRCH-01` y `MSG-01` no mejoraron
   con el bucle arreglado y fallan igual que antes — descartar que sea el mismo tipo de
   defecto que `F-058` (un contrato con un hueco, no un límite del modelo) antes de gastar
   en medir más sin saber qué se está midiendo.
2. **`F-113`, delegado a sesión aparte** (`inputs.decisions` no llega al prompt del Coder
   en `MSG-02`, `PANEL-01`, `VND-01`). No es bloqueante — ninguna de las tres se
   reconstruye mañana.
3. **Fundación V1** sigue sin empezar. Ya no tiene el coste de orquestación por delante
   —eso se cerró hoy, ver §4—, así que es el candidato más barato que queda.
4. **Con el coste-sombra ya instrumentado, decidir qué hacer con el número.** $331,58 en
   9 sesiones no es una cifra para publicar sola: falta separar cuánto de eso es MVP
   (13→18-ago) de cuánto es V1 (22-ago en adelante), y decidir si esta cifra sustituye o
   solo informa la partida "tecnología" del plan (`Plan_V1…v2.3.docx`, Tabla 5, 3.000–7.000
   €). Es una lectura del número, no ingeniería.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después | `docs/ADR-002_*.md` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. No DeepSeek: sin acuerdo de tratamiento y entrena por defecto | Plan §4.2 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** — el coste por pasada lo desaconseja | Plan §5.4 |
| **Utillaje externo** | Modo aislado, commit fijado, interruptores apagados. Nunca modo equipo | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **Cuatro agentes máximo** | En construcción concurrente. Los de verificación no cuentan | Plan §6.2 |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió | 25-ago |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py` |
| **Coste de orquestación: envoltorio propio, precio-sombra** | Claude Code va por suscripción (confirmado con el PO): no hay € marginal por sesión. Se mide **tokens reales × tarifa pública de la API**, mismo criterio que el Coder — no consola de facturación (no aplica bajo suscripción) ni estimación a ojo | `orchestration_pricing.py` / `orchestration_metrics.py`, 28-ago |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`test_c2_paths` falla siempre**, no es intermitente. Asume que C2 pasa rutas a Playwright, pero `D-09-03(a)` del 12-ago decidió que corra la suite entera sin rutas. **El test no se actualizó el mismo día que la decisión.** Encontrado de pasada el 25-ago | Un encargo aparte, pequeño |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. No bloquea porque el MCP llega, pero depender de eso es depender de la suerte | Álvaro: re-loguear y `link` |
| 🟡 | **Nada despliega solo.** Si se toca código, se despliega **y se comprueba en la URL** | Se cumple cerrando con el despliegue hecho |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Riesgo aceptado por el PO el 18-ago hasta después de la reunión. **Sigue abierto** | Álvaro: 20 $/mes |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Cuánto de los $331,58 de coste-sombra es MVP y cuánto es V1**, y si esa cifra debe
  sustituir o solo informar la partida "tecnología" del plan. El número ya existe
  (`orchestration-metrics.csv`); la lectura, no.
- **Por qué el bucle arreglado resuelve `PANEL-01` y `VND-01` pero no `SRCH-01` ni
  `MSG-01`.** Con n=4 ya no es "una observación, no una medición" — es una discrepancia
  real y sin diagnosticar. `F-112`.
- **Si `inputs.decisions` importa para lo que construye el Coder.** Tres tareas lo declaran
  y ninguna lo recibe (`F-113`); no se sabe si el contenido de esos ficheros es del tipo
  que el Coder no puede reinventar o si el campo nunca debió estar ahí.
- **Si `visibility_scope` y la lista derivada de conversaciones aguantan bajo carga.** Se
  mide en el Hito 6 y no antes. El riesgo está escrito en ADR-002 §D-1.
- **Qué pasó en la reunión con el socio del 20-ago.** No hay ni una línea en el repo.
- **El estado de la CI.** No se ha comprobado hoy contra Actions — segundo día seguido sin
  comprobarlo.

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

*Día 2 de V1 · 28-ago-2026 · fecha leída de la máquina (dos veces, tras una lectura suelta
que no cuadraba) · estado del arnés verificado contra el código de `mvp/bootstrap` el mismo
día · Dirección Técnica, Nortex Systems*
