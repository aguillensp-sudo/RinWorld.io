# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero, aprendida a base de golpes (F-012).** Cita, no parafrasea. Los
> valores de estado, los nombres de columna y las asignaciones de modelo se copian del spec
> cerrado o del plan **con el puntero al lado**. Un enum o un nombre de campo sin puntero se
> considera no verificado: tres paráfrasis mal hechas llegaron a un DDL a punto de escribirse.

**Día 2 de 15 · cerrado 6-ago-2026 · Estado: VERDE**

---

## Dónde estamos

Día 2 cerrado. Es el día más irreversible del sprint y sale entero: esquema, RLS, auth de dos
organizaciones y el shell de la app. La puerta de salida está pasada de punta a punta.

| Bloque | Resultado |
|---|---|
| Atribución y métricas | **Hecho.** Regla de autoría en `CLAUDE.md` §1.6; coste unificado en $0.003581; columna `ficheros` en el CSV. El trailer de `0623451` **no** se reescribe (F-009). |
| Las tres decisiones de esquema | **Aprobadas por el PO.** Detalle en `Dia-02_decisiones_esquema.md`, que es el documento contra el que se escribió el DDL. |
| Esquema + RLS | **Aplicado** al proyecto remoto (`troxminloxkjwihwfevs`, eu-west-1, PG 17). Migraciones 0001–0004. |
| Dos cuentas | **Creadas y verificadas por API**, no por `SELECT`. Login real contra `/auth/v1/token`. |
| Shell de la app | **Hecho.** React 18 + TS + Vite. Es **una de las 8 pantallas** del alcance (Plan §9). |
| CI | Tres trabajos: esquema, app, e2e. **Necesita secrets — ver abajo.** |

**Puerta de salida del día 2: PASADA.** Dos contextos de navegador, dos cuentas, cada una entra
y ve su propia sesión, y ninguna ve la organización de la otra. Es un test, no una comprobación
a ojo: `app/e2e/session.spec.ts`.

| Verificación | Estado |
|---|---|
| `bash supabase/tests/run.sh` | **30/30** — el esquema dice "no" donde los specs exigen que diga no |
| `cd app && npm run typecheck` | limpio |
| `cd app && npm test` | **21/21** |
| `cd app && npx playwright test` | **9/9** contra el Supabase real, tres corridas sin flakiness |

`get_advisors` del proyecto: **un solo aviso**, y no es del esquema.

**Métricas del arnés: cero filas nuevas hoy, y es correcto.** El día 2 lo ejecutó Claude Code
completo; el arnés no existe hasta el día 4 y el Coder no interviene hasta el día 3. Las
primeras filas de `harness-metrics.csv` desde SP-1 son las de mañana.

---

## Hoy toca — Día 3

**Objetivo:** catálogo sembrado de 200+ líneas · INV-01 completa a mano con sus tests.

| Trabajo | Ejecuta | Fuente |
|---|---|---|
| Catálogo sembrado: 200+ líneas curadas | **Coder** | Plan §8, fila del día 3 |
| **Pantalla de referencia a mano:** INV-01 completa con sus tests | **Claude Code** | Plan, fila del día 3 |

**Puerta de salida:** INV-01 renderiza el inventario real de la base de datos, con sus tests en
verde, y las dos organizaciones tienen catálogo con solape deliberado.

### Hoy es el primer día del Coder — y eso trae reglas que hasta ahora no aplicaban

1. **Commits separados, sin excepción** (`CLAUDE.md` §1.6). El artefacto del Coder entra tal
   como sale, con `Co-Authored-By: deepseek-v4-flash <coder@harness.local>`. Las correcciones a
   mano van **después**, en otro commit. El diff del segundo *es* la medida de cuánto hubo que
   arreglar, y es el objetivo 4 del MVP.
2. **Una fila de `harness-metrics.csv` por intento**, con `ficheros`, y el `coste_usd` tiene que
   coincidir con el JSON de `metrics/` (F-010). Si el cache hit es alto, se declara: no se
   extrapola una cifra cacheada a coste por pantalla (F-011).
3. **El Coder no escribe los tests que lo evalúan** (`CLAUDE.md` §3, innegociable).

### Lo que INV-01 se va a encontrar

- **`inventory_lines.status` tiene CUATRO estados**, no tres: `DRAFT`, `PUBLISHED`, `ARCHIVED`,
  **`DELETED`** (`inventory-management` · inventory-line-lifecycle). El HTML aprobado de INV-01
  solo pinta tres. Decidir qué hace la pantalla con `DELETED` antes de generarla.
- **`unit_price` está cifrado y no se puede leer desde el servidor.** INV-01 muestra el
  inventario propio, así que el precio lo descifra el cliente o no se muestra. No hay tercera
  opción y no es un detalle de implementación.
- **`quantity` es la trampa:** en claro en el inventario (obligatoria y buscable), cifrada en las
  tarjetas de consulta y oferta. Mismo nombre, tratamiento opuesto.
- Los indicadores de antigüedad de 7 y 30 días se derivan de `last_upload_at`
  (`inventory-management` · data-freshness). Sin transición automática: archivar es decisión
  exclusiva del distribuidor.

### ⚠ Aviso para el arnés del día 4 — el check de paleta

F-003 pedía "un check en el Test-runner que rechace hex fuera de paleta (habría cazado el
`#ef4444`)". **Tal como estaba redactado, ese check rechazaría output correcto.** El `#ef4444`
no era un desvío del Coder: el HTML aprobado usa `.age.danger{color:#ef4444}` para la
antigüedad crítica y `.dropzone-err{color:#DC2626}` para el texto de error — dos roles
distintos. El check se valida contra **§1.1 + §1.4 + §1.5** del sistema de diseño. Con la
paleta del shell a secas, C3 fallaría en pantallas bien hechas, y C3 puertea cada pantalla del
arnés desde el día 5.

### Convenciones de React ya escritas — no reinventarlas

`design-system.md` §6 está **rellena** (se hizo el día 2, no el 4, porque el Coder lee ese
documento desde el día 4 y la primera pantalla del arnés es del día 5). Tokens como variables
CSS, CSS Modules conservando los nombres `bw*` del shell aprobado, y cuatro de los siete puntos
del protocolo de verificación convertidos en test automático.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Estados de oferta | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. La última es **terminal** y la contraoferta es **fila nueva**. | `messaging-and-negotiation` · offer-card |
| Frontera de cifrado | Por columna, en las dos tablas. `unit_price` cifrado **también en la línea de inventario**. | `Dia-02_decisiones_esquema.md` §1 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. Se ve al abrir la negociación. | `conversational-search` · Out of Scope |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan. | `CLAUDE.md` §3 |
| Alcance | 8 pantallas, y el **app shell es una de ellas** (ya hecha). SRCH-01 es la núcleo y no se recorta. | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/`. `harness/` llega el día 4. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Uno bloquea el arranque del día 3.**

1. ✔ ~~**Los cuatro tokens neutros de fondo claro**~~ — **hecho el 6-ago.** `design-system.md`
   §1.4 (neutros de superficie clara) y §1.5 (semánticos), extraídos de los seis HTML aprobados
   y publicados en `tokens.css`. Resultó que **el Coder no había inventado nada**: los grises
   están en el HTML aprobado de INV-01 y tres de ellos en las seis pantallas. F-003 cerrado y
   corregido; ver el aviso de abajo sobre el check de paleta.
2. 🔴 **¿Qué va a buscar el socio en la demo?** Referencia, cantidad y zona. Plan §8 es
   explícito: el catálogo se diseña **hacia atrás desde el guion de demo**, con solape
   deliberado entre las dos organizaciones para que la búsqueda cruce. Sin esa decisión, las 200
   líneas salen verosímiles pero no lucen en la reunión — y sembrar dos veces es tirar el
   trabajo del Coder.

**No bloquean, pero cuanto antes mejor.**

3. **Diseño de la pantalla de login** (F-016). No existe entre los 32 HTML aprobados y **tampoco
   está entre las 8 pantallas del alcance**: es una novena que nadie planificó, y es la primera
   que ve el socio. Hoy va andamiaje hecho con los tokens. *(El "panel de vista-servidor" del
   Plan §9 también es nuevo, pero ese sí está planificado.)*
4. **Secrets de GitHub Actions**, o el trabajo de e2e falla a propósito:
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `E2E_ALPHA_EMAIL/PASSWORD/ORG`,
   `E2E_BETA_EMAIL/PASSWORD/ORG`.
5. **`auth_leaked_password_protection`** está desactivado en Auth (comprobación contra
   HaveIBeenPwned). Es configuración del proyecto, no del esquema. ¿Se activa?

---

## Riesgo con la vista más corta

**El día 3 arranca bloqueado.** Los dos puntos rojos de arriba son media hora de decisiones
tuyas, pero sin ellos el Coder siembra un catálogo que habrá que rehacer e INV-01 vuelve a
inventar grises. Es el riesgo más cercano y el más barato de quitar.

**Día 7 · MSG-02** sigue siendo el riesgo estructural: la pantalla más compleja del MVP, con
margen para comerse dos días. Si el día 7 no está, se simplifica el hilo. Lo que sí mejoró hoy:
`thread-lifecycle` entró en el DDL del día 2, así que el día 7 no paga migración.

---

## Punteros

| Fichero | Qué contiene |
|---|---|
| `Plan_MVP_Bearingworld_v1.0.md` | Plan maestro de 15 días. La referencia. |
| `Dia-02_decisiones_esquema.md` | Las tres decisiones de esquema, aprobadas. El DDL se escribió contra este documento. |
| `Dia-01_Spikes_y_arranque.md` | Detalle del día 1 (cerrado). |
| `findings-register.md` | 17 hallazgos. Abiertos: **F-008, F-010, F-011, F-016**. F-003 cerrado el 6-ago (y su diagnóstico original, corregido). |
| `harness-metrics.csv` | Tokens, coste, intentos, ficheros → objetivo 4. Primeras filas del Coder: mañana. |
| `harness-backlog.md` | Defectos del arnés a corregir antes de V1. Se llena desde el día 4. |
| `../architecture/design-system.md` | Contrato visual. **§1.4 y §1.5 (neutros claros y semánticos) y §6 (traducción a React) ya están rellenas.** |
| `../../supabase/README.md` | Esquema, las siete decisiones de implementación y cómo probarlo. |
| `../../app/README.md` | Scaffold, qué decide y cómo verificarlo. |
| `../../CLAUDE.md` | Reglas de proyecto no negociables. §1.6 es nueva. |

---

*Actualizado al cierre del día 2 · 6 de agosto de 2026*
