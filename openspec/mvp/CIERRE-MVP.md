# CIERRE · MVP Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io`, rama
`mvp/bootstrap`. Si te lanzan en un worktree `claude/…`, opera sobre esa ruta con paths
absolutos. Es el error que ya se ha cometido tres veces (`F-108`).

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.**

> **Qué es este fichero.** El acta de cierre del MVP y **el punto de entrada de V1**. No se
> sobrescribe: `ESTADO.md` es el relevo diario y se pisa cada día; esto no. Si estás
> arrancando V1, este fichero se lee **primero** y `ESTADO.md` después.

**MVP CERRADO · 18-ago-2026 · 15 días de 15 · Estado: ÁMBAR, a una sola cosa del verde.**
Nada de lo escrito aquí modifica ningún otro fichero del proyecto: el MVP se cierra **tal
como quedó** el 17-ago.

---

## 1 · Qué queda vivo, y dónde

| Qué | Dónde | Comprobado |
|---|---|---|
| App | `bearingworld.vercel.app` (`X-Robots-Tag: noindex`) | 17-ago: mismo hash de bundle que `npm run build` (`index-BSSPeP7F.js`) |
| VERA | Edge Function `vera` **v6 ACTIVE** | 17-ago: ensayo 16/16 contra el modelo |
| Base | Supabase `troxminloxkjwihwfevs` (eu-west-1), estado congelado | 17-ago: 221 líneas · 159 frescas · 53 naranja · 9 rojas · 5 hilos en 5 estados |
| Código | rama `mvp/bootstrap`, árbol limpio | — |
| Arnés | `harness/`, 6 tareas en `harness/tasks/*.json` | — |
| Tests | 17 suites Vitest en `app/src/lib/` + 9 ficheros e2e en `app/e2e/` | CI 49/49 verde desde el 12-ago |

**Ninguna mitad del repo se queda sin desplegar.** Es la única condición de cierre que el
proyecto se impuso a sí mismo y se cumple (`F-072`, `F-091`).

---

## 2 · Los seis entregables del `Plan §13`

| # | Entregable | Veredicto |
|---|---|---|
| 1 | **MVP funcional con guion ensayado** | ✅ Las 8 pantallas de `Plan §9`, desplegadas y verificadas en su URL. Guion en `guion-sesion-2.md`, ensayado entero el 17-ago: **16/16 contra v6** |
| 2 | **`harness-metrics.csv`** *(obj. 4)* | ✅ **con salvedad.** 30 filas, 9 tareas, 14 columnas. **Coste total del MVP: 0,41 USD** / 150,7 min con `deepseek-v4-flash`. Coste y tokens son válidos y extrapolables (el fichero separa coste real de **equivalente en frío**, que es donde estos ejercicios suelen mentirse). **La columna `intentos` NO es válida todavía**: el bucle no devolvía al Coder su propio código (`F-064` / `B-008`) |
| 3 | **`harness-backlog.md`** *(obj. 2)* | ✅ 10 entradas, cada una trazada a su hallazgo. **5 cerradas el día 4**, 5 pendientes con el arreglo ya escrito. Dos de máxima: `B-008` y `B-009` |
| 4 | **`findings-register.md`** *(obj. 3)* | ✅ **112 hallazgos** (F-001→F-111), 93 cerrados / 19 abiertos. Por tipo: `HARNESS` 48 · `INFRA` 23 · `SPEC-GAP` 21 · `DESIGN` 14 · `MODEL` 12. Los 21 `SPEC-GAP` son el objetivo 3 cumplido: vuelven a `openspec/specs/` y a `gaps-register.md` |
| 5 | **10-15 tareas en formato fijo** *(obj. 1)* | 🟠 **6, no 10-15**: `LOGIN-01`, `MSG-01`, `MSG-02`, `PANEL-01`, `SRCH-01`, `VND-01`. Es material suficiente para diseñar el Planner, pero **es menos de lo que el plan pedía** y hay que decirlo así |
| 6 | **Suite de tests ejecutable** | ✅ Vitest + Playwright, CI 49/49. Primer criterio de salida ejecutable del proyecto |

**Los tres objetivos que Álvaro preguntó por su nombre —2, 3 y 4— están cumplidos.** El
único punto que no se puede dar por bueno es la métrica de *intentos*, y el mérito del
registro es que lo dice en voz alta en vez de enseñar una cifra bonita.

---

## 3 · Lo que queda entre hoy y el 20-ago · **NO es V1**

Esto es cola del MVP, no arranque de V1. Está en `ESTADO.md §Qué toca el 20-ago` y no se
duplica aquí más que en el titular:

1. `npm run demo:reset` — y comprobar que dice **«N líneas desplazadas»**, no `movidas: 0`.
2. `npm run demo:verdad` — la salida delante durante la demo.
3. **`VERA_ENSAYO=1 npx vitest run src/lib/vera.ensayo.test.ts`, DOS VECES.** Es lo único
   que separa el riesgo #1 del verde: v6 tiene **una sola pasada** encima, y una pasada es
   una observación, no una medición.
4. **Pendiente de Álvaro, y solo lo puede hacer una persona:** comprobaciones 2 y 3 de
   `despliegue.md §4` — un hilo cifrado leído con las dos cuentas, y que las dos
   organizaciones no se vean entre sí. Sin repetir desde el 13-ago.

---

## 4 · Por dónde empieza V1 · **el siguiente agente empieza AQUÍ**

En este orden, y el orden importa: los tres primeros son baratos y **desbloquean la
medición**, que es de lo que depende todo lo demás.

### 4.1 · Arreglar el instrumento antes de volver a medir nada

1. **`B-009` · limpiar los códigos ANSI del feedback al Coder.** Es de una línea
   (`re.sub(r'\x1b?\[[0-9;]*m', '', texto)` en `harness/graph/nodes/test_runner.py`), mejor
   todavía apagando el color en origen (`NO_COLOR=1`, `--no-color`). Medido: 72 secuencias
   en el feedback de un intento, y el modelo llegó a pegar dos dentro de un `import` y
   romper el parseo. Origen `F-068`.
2. **`B-008` · el reintento tiene que enseñarle al Coder el código que escribió.** Hoy se le
   manda `fichero.tsx(136,61): error TS…` sobre un fichero que no está viendo. **El estado
   ya lleva el dato** (`HarnessState.files`): solo hay que volver a mandarlo. Origen `F-064`.
3. **Remedir.** Relanzar **MSG-02** con la misma tarea y el mismo contrato — misma entrada,
   único cambio el bucle. **~0,07 USD y 20 minutos.** Hasta que esto no esté, ninguna cifra
   de «intentos hasta verde» dice nada del modelo, y **el objetivo 4 no queda completo**.
4. **`B-010`** · guardar el **contenido** de los ficheros de cada intento en el JSON, no las
   rutas. Sin esto la corrida no es reproducible sin volver a pagarla.
5. **`B-007`** · `--seco` tiene que correr la tarea que recibe, o dejar de aceptar el
   argumento.

### 4.2 · Lo que el MVP dejó dicho sobre el diseño de V1

- **El Planner** (objetivo 1). El material son las 6 tareas de `harness/tasks/` y `F-036`:
  *la palanca del arnés no es el modelo, es lo que entra en el prompt.* Léase `F-036`,
  `F-048`, `F-058` y `F-069` antes de escribir una línea del Planner.
- **`F-063`** · los commits del arnés y la señal de CI: con rojos previstos por pantalla, el
  problema no es el rojo, es lo que le hace a la señal.
- **`F-101`** · VERA es de **un solo turno**. Repregunta en vez de mentir, que era todo lo
  que se pedía para el 20 — pero el refinamiento es lo primero que hace cualquier comprador.
  **Es la primera pieza de producto de V1.**

### 4.3 · Funcionalidad aplazada explícitamente a V1

Todas con decisión tomada y motivo escrito. **No se replantean, se construyen:**

| Qué | Referencia |
|---|---|
| **i18n** — fork de ~2 días, hay 536 asertos de texto | PO, 16-ago |
| **Originar una oferta** (hoy solo hay contraoferta) | `F-099` |
| **Acciones de fila en SRCH-01** — el wiring `FL-MSG-01` | `F-100` · `F-023 e` |
| **Renderizador de markdown** en los mensajes (hoy texto plano por CSS y por prompt) | `F-104` |
| **Recuento de no leídos** en MSG-01: o `thread_read_receipts` con su RLS, o se retira del spec | `F-027 (a)` |
| **Borrado en INV-01**: o quinto chip «Eliminados» con restaurar, o eliminar es definitivo | `F-023 (d)` |
| **E2EE completo** — hoy hay una relajación consciente; `WebCrypto` nativo sin `libsodium.js` | `ADR-001` · `GAP-001` · `F-008` · `F-067` |
| **Aislamiento demo/pruebas** — comparten base, hoy lo hace sobrevivible el reseteo | `F-098` |

### 4.4 · Deuda de infraestructura que V1 hereda

- **`F-073`** · la CLI de Supabase ve solo la org `mjxnlvvrnjuuawlxkmte` y da **403** sobre
  el proyecto del MVP. Ha dejado de bloquear porque el **MCP sí llega**, pero depender de que
  el MCP esté cargado en la sesión es depender de la suerte. Lo quita Álvaro: re-loguear y
  `supabase link --project-ref troxminloxkjwihwfevs`.
- **Nada despliega solo** (`F-072`, `F-091`). Si se toca código, se despliega **y se
  comprueba en la URL**. Sin excepción: `F-111` existió porque una regla se sobregeneralizó
  y nadie volvió a mirar.
- **Plan Hobby de Vercel** — es para uso no comercial. Demo privada es zona gris; si esto se
  queda puesto, deja de serlo.

---

## 5 · Lo que NO se toca al arrancar V1

Decisiones cerradas con motivo medido. Reabrirlas cuesta días y ya se pagaron:

- **Un hilo es por PAREJA DE ORGANIZACIONES**, no por rodamiento (`0014:167`).
- **Quién decide una oferta: el receptor, nunca el emisor** (`offers.ts:101`).
- **Cierre de hilo reversible** — un elemento nuevo lo reabre (`D-07-01`).
- **Contraoferta = fila `OFERTA` nueva**; la anterior pasa a `Superada por contraoferta`.
- **Estados capitalizados y VERA no los traduce** (`F-103`).
- **Las herramientas de VERA corren en el navegador, no en el proxy** (`D-09-05`).
- **Tope de 25 filas al modelo**, y al recortar se prohíbe hablar de lo que no ve (`F-075`).
- **Claves de sesión en memoria, sin `localStorage`** (`CLAUDE.md §4`).
- **Modelos:** Opus/Claude Code para esquema, RLS, E2EE y herramientas; `deepseek-v4-flash`
  como Coder; **VERA en producción Sonnet 4.6, fijo** (`QA-A00-06`).
- **Código del Coder y código a mano nunca en el mismo commit** (`CLAUDE.md §1.6`).

La lista completa y viva está en `ESTADO.md §Decisiones vivas`. Si algo de aquí choca con
algo de allí, **manda el spec cerrado en `openspec/specs/`** (`F-039`).

---

## 6 · Orden de lectura para quien arranque V1

1. **Este fichero.**
2. `CLAUDE.md` — §1.6 (autoría), §4 (claves), §6 (métricas), §10 (Supabase).
3. `ESTADO.md` — decisiones vivas y bloqueos. Ojo: se sobrescribe cada día.
4. `harness-backlog.md` — las 5 pendientes son el trabajo de la primera semana.
5. `findings-register.md` — no de corrido: por ID, cuando este fichero te mande a uno.
6. `openspec/specs/` — la fuente de verdad del producto.

---

*Cierre del MVP Bearingworld.io · 18-ago-2026 · 15 días, 112 hallazgos, 0,41 USD de Coder,
8 pantallas desplegadas y comprobadas en su URL · Claude Code (Opus 5)*
