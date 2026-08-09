# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero, aprendida a base de golpes (F-012).** Cita, no parafrasea. Los
> valores de estado, los nombres de columna y las asignaciones de modelo se copian del spec
> cerrado o del plan **con el puntero al lado**. Un enum o un nombre de campo sin puntero se
> considera no verificado: tres paráfrasis mal hechas llegaron a un DDL a punto de escribirse.
>
> **Y su corolario, del día 3 (F-024).** Una advertencia de aquí sin puntero se comprueba
> antes de actuar: la que este fichero traía sobre el precio de INV-01 apuntaba a una
> pantalla que no tiene columna de precio.

**Día 4 de 15 · cerrado 9-ago-2026 · Estado: VERDE, con la CI en la fase roja de TDD**

> **Lee esto antes de abrir GitHub. La CI está roja, y el único motivo que queda se cierra
> mañana solo.**
>
> **`App · typecheck` — fase roja de TDD, y es la buena.** `npm run typecheck` da **dos**
> errores, `Cannot find module './Messages'` y `'./ThreadList'`, y ninguno más: el contrato
> de aceptación de MSG-01 se escribió hoy y los componentes los produce el Coder mañana
> (`Plan §6`: *"Test de aceptación Playwright ←── contrato, escrito ANTES del código"*).
> **Los 102 tests que ya estaban siguen en verde.** Si mañana el rojo es otro, o son más de
> dos, se rompió otra cosa.
>
> **Efecto colateral, que hoy no se ve:** el trabajo `Playwright` tiene `needs: app`, así que
> con el typecheck rojo **ni arranca**. Y `npm run build` es `tsc -b && vite build`, que es
> lo que lanza el `webServer` de Playwright — **tampoco se puede correr el e2e en local**
> hasta que llegue el artefacto del Coder.
>
> **Lo que SÍ se resolvió hoy: los secrets de CI (9-ago, 17:11).** Llevaban rojos desde el
> día 2 y hacían caer el trabajo de Playwright en **todas** las corridas de la rama — por
> diseño, porque `session.spec.ts` lanza excepción en CI en vez de saltarse la puerta (F-015:
> un skip silencioso reportaría verde sin probar nada). Están los **8**, y sus nombres casan
> uno a uno con los `secrets.*` de `ci.yml` (cruzado con `gh secret list`).
> **Que los VALORES sean buenos no se puede leer, y hoy no se puede probar.** Los dos fallos
> que siguen vivos están en la puerta del sprint, más abajo — y el segundo no da rojo.

---

## Dónde estamos

El día 4 era de decisiones irreversibles y los dos entregables están. El calendario del plan
corrió **un día natural**: el día 4 nominal era el 8-ago y se ejecutó el 9. Las fechas del
registro y del CSV son las **reales**, no las nominales.

| Bloque | Ejecuta | Resultado |
|---|---|---|
| `Dia-04_decisiones_arnes.md`, antes de escribir código | Claude Code | **Aprobado por el PO**: las cinco decisiones sin cambios |
| **Arnés v0** · grafo LangGraph de 2 nodos | Claude Code | **Hecho.** `harness/`, verde en seco, **cero coste** |
| Contrato de aceptación de MSG-01 | Claude Code | **Hecho.** 69 asertos en cuatro ficheros + capa de datos + siembra |

**Puerta de salida del día 4: PASADA.** *"El grafo corre de punta a punta con el Coder
mockeado: da verde a la vuelta 1 con un artefacto bueno, rojo→reintento con uno malo, y
escala al tercero. El CSV sale generado desde el JSON, con las dos columnas nuevas."*

| Verificación | Estado |
|---|---|
| `python -m harness.tests.dry_run` | **3/3 escenarios.** Verde al 1, reintento al 2, escalado al 3 |
| `python -m harness.tests.test_checks` | **34/34** |
| `cd app && npx vitest run src/lib/threads.test.ts` | **22/22** |
| `cd app && npm test` | **102 pasan** + 2 ficheros que no resuelven (fase roja, arriba) |
| `cd app && npm run typecheck` | **2 errores, los dos esperados** |
| Coste del día | **$0.000000.** Ni una llamada al modelo |

---

## Lo que hay que saber del arnés

**Está en `harness/`, y su porqué en `openspec/mvp/Dia-04_decisiones_arnes.md`.** Se corre
así:

```
python -m harness.graph.run harness/tasks/MSG-01.json          # de verdad
python -m harness.graph.run harness/tasks/MSG-01.json --seco   # sin gastar un token
```

**`harness/core/` sale de `dia-03-catalogo/run_coder.py` sin cambiar la lógica**, que era el
riesgo escrito del día. La prueba de que la extracción es fiel no es una opinión:
`test_checks` **reproduce al céntimo las cifras de SP-1** — 0.003581 real, 0.006145 en frío,
99,58% de cache. Si alguien toca `pricing.py` y esa aritmética se mueve, el test lo dice.

**Cinco cosas del grafo que conviene no redescubrir:**

1. **Tope de 3 intentos, y el tercero escala.** No hay nodo Escalation (`Plan §6`), así que
   escalar es parar, marcar `escalado_a_humano = si` y salir con código 2. `Plan §11` pide
   *"porcentaje de tareas que requieren intervención humana"*, y con reintentos infinitos
   ese dato no existiría.
2. **⚠ El veredicto lo escribe el Test-runner, no la arista.** Una función de enrutado de
   LangGraph decide por dónde salir pero **no toca el estado**. Con el escalado viviendo
   solo en la arista, el estado final decía `en_curso` y el CSV salía sin la marca. Lo cazó
   la corrida en seco, no una revisión a ojo.
3. **El Test-runner no lleva LLM.** Es la lección de `generate_screen.py` (`Plan §6`): *"un
   LLM revisaba la salida de otro LLM sin verdad de referencia"*. El modelo que
   `CLAUDE.md` §3 asigna a ese nodo **queda sin usar en el MVP**, y está bien.
4. **El feedback al Coder es el `detail` crudo de los checks rojos, y nada más.** Un
   feedback redactado inyecta la solución y el intento 2 deja de medir al Coder.
5. **C5 no está en el grafo.** "¿Lo mantendrías?" lo da el PO. El grafo llega a C4.

**`harness-metrics.csv` tiene dos columnas nuevas** — `cache_hit_pct` y
`escalado_a_humano` — y van **antes de `resultado`, no al final**: `resultado` es la única
columna de texto libre, y en medio del fichero es una trampa para quien lo parsee. Las tres
filas históricas llevan su valor real (`0.00` / `99.58` / `0.00`). La desviación respecto a
lo aprobado está escrita en `Dia-04_decisiones_arnes.md` §6.

**Cinco hallazgos cerrados hoy**, promovidos a `B-001..B-005` del backlog, que llevaba desde
el día 1 vacío esperando este día: F-010, F-011, F-005, F-003 y F-015.

---

## Lo que hay que saber del contrato de MSG-01

**Los tests están escritos y el código no.** Eso es lo correcto (`Plan §6`), pero significa
que mañana **el primer bloque no es lanzar el arnés**: es cerrar dos cosas que son de mano.

| Fichero | Qué es | Estado |
|---|---|---|
| `app/src/screens/messages/ThreadList.test.tsx` | 22 asertos del componente | rojo (falta el componente) |
| `app/src/screens/messages/Messages.test.tsx` | 16 de la pantalla, con `fetchThreadPage` mockeado | rojo (ídem) |
| `app/e2e/messages.spec.ts` | 9 contra el Supabase real | rojo (ídem) |
| `app/src/lib/threads.test.ts` | 22 de la lógica pura | **22/22 verde** |

**`app/src/lib/threads.ts` y `supabase/seed/demo_threads.sql` fueron con ellos, y no es
ampliación de alcance:** sin capa de datos el test no tiene tipos que fijar, y sin datos el
e2e es un contrato inejecutable — que cuenta como **rojo** (F-015). Las dos son de mano por
`CLAUDE.md` §3: RLS y embeds son fallo caro y silencioso.

**⚠ `threads` tiene TRES claves ajenas hacia `organizations`** — `org_low_id`, `org_high_id`
y `created_by_org_id` — así que `organizations(name)` a secas devuelve `PGRST201` y la
pantalla se queda en blanco. Con **una** de más eso dejó el login roto varias horas el día 3
(F-020). Los embeds van nombrados desde el primer minuto:
`organizations!threads_org_low_id_fkey(...)`.

**El aserto que más vale de los nueve del e2e** es el de la contraparte. El par va en orden
canónico en base (`org_low_id < org_high_id`, constraint `threads_canonical_order_chk`), no
por rol, así que resolverlo al revés **no da error**: da una lista entera de "Rodamientos
Ibéricos" hablando consigo mismo. Plausible y falsa, y ningún test de unidad la ve.

**F-027, y necesita decisión tuya para V1.** La spec de MSG-01 pide dos cosas que el esquema
no sostiene: (a) un **recuento de no leídos** sin ningún seguimiento de lectura en la base —
ni `read_at`, ni `last_read_at`, ni tabla de recibos; (b) los puntitos `• • • • • •` de §3,
que **contradicen a la §7 del mismo documento** (*"la vista previa nunca muestra contenido
descifrado"*). Resuelto a favor de §7. Es la **quinta** vez que el contrato aprobado no es la
fuente de verdad en un detalle (F-003, F-019, F-024, F-025) y la **primera en que la
contradicción está dentro del mismo documento**, no entre el mock y la spec.

---

## Hoy toca — Día 5 (10-ago-2026)

`Plan §3`, fila del día 5: *"Primera pantalla producida por el arnés: **MSG-01**. Registro de
métricas."*, ejecuta el **Arnés**.

### Y es fin de sprint: la puerta de salida de S1

`Plan §3`, textual: *"dos navegadores, dos cuentas, cada una ve su inventario. CI en verde.
Una pantalla nacida del arnés, con su coste medido."* Son **cuatro** condiciones y conviene
mirarlas por separado, porque no dependen de lo mismo:

| Condición | Cómo está | De quién depende |
|---|---|---|
| Dos cuentas, cada una ve su inventario | **Hecha el día 3.** `inventory.spec.ts`, 22/22 en local, tres corridas sin flakiness | hecho — solo re-verificar |
| Una pantalla nacida del arnés | Mañana. El grafo está y la tarea también | del Coder, y del wiring previo |
| Con su coste medido | El CSV lo genera el arnés solo, desde el JSON | automático |
| **CI en verde** | 🟠 **Secrets puestos el 9-ago (8/8, nombres verificados). Sin probar** | del Coder, ya no de Álvaro |

**La cuarta dejó de depender de Álvaro el 9-ago a las 17:11.** Con los 8 secrets puestos, la
puerta se cierra entera mañana **si** el artefacto del Coder pasa y **si** los valores son
buenos. Dos fallos siguen vivos y hay que mirarlos expresamente:

- **Diacríticos comidos en `E2E_ALPHA_ORG` / `E2E_BETA_ORG`.** Síntoma: falla
  `session.spec.ts` comparando el nombre de la organización, no el login. Es F-019.
- **Clave de servicio en vez de la publicable en `SUPABASE_PUBLISHABLE_KEY`.** Síntoma: el
  e2e pasa **de más**, saltándose RLS. Es el peligroso, porque no da rojo: da un verde que
  no significa nada. Si el e2e pasa entero a la primera sin tocar nada, merece una mirada.

**En este orden, y los dos primeros antes de gastar un token:**

1. **Wiring a mano** (es mío, no del Coder): ítem `Hilos` en `App.tsx` con su `veraSubtitle`
   — la spec MSG-01 §5 dice **`Agente de mensajería`** — y el mapeo del ítem activo.
   `App.tsx` está en `constraints` de la tarea como "no tocar": lo toco yo, antes.
2. **Aplicar `supabase/seed/demo_threads.sql` al remoto**, o el e2e no tiene datos. Y
   después **volver a correr el e2e de la app**, no solo el smoke del esquema (regla de
   F-020): esta siembra no añade FK, pero sí filas que el e2e da por existentes.
3. **Lanzar el arnés.** `python -m harness.graph.run harness/tasks/MSG-01.json`.
4. **Commits separados** (`CLAUDE.md` §1.6, F-009): primero el artefacto del Coder tal cual
   sale, con `Co-Authored-By: deepseek-v4-flash <coder@harness.local>`; después las
   correcciones a mano. El diff del segundo *es* la medida de cuánto hubo que arreglar.

**Lo que el día 4 deja hecho y no hay que rehacer:** los cinco puntos del grafo de arriba, y
que `harness/tasks/MSG-01.json` ya lleva **seis** entradas de `out_of_scope` aprobadas por el
PO. Si el Coder pinta un badge verde o un recuento inventado, es que el prompt no las está
metiendo.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Tope de intentos | **3**, y el tercero escala al humano con código de salida 2. | `Dia-04_decisiones_arnes.md` §1 |
| Test-runner | **Sin LLM.** Ejecuta procesos y lee códigos de salida. C5 lo da el PO, fuera del grafo. | `Dia-04_decisiones_arnes.md` §4 |
| C2 del arnés | Se evalúa sobre el **panel de contenido**, nunca sobre el shell. | F-025 |
| C3 del arnés | Contra **§1.1 + §1.4 + §1.5** de `design-system.md`, nunca §1.1 a secas. | F-003 |
| Formato | Los checks comparan contra la **función de formato**, nunca contra la cifra del mock. | F-024 |
| Checks | Un check que no se puede ejecutar es **rojo**, nunca ausente. | F-015 |
| Formato de tarea | **Congelado.** Es el corpus con el que se diseñará el Planner de V1. | `Dia-04_decisiones_arnes.md` §5 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan, **y tampoco los ve**. | `CLAUDE.md` §3 · Plan §6 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Demo | Referencia **`6205-2RS`** y **seis organizaciones** distribuidoras, solo dos con cuenta. | `guion-demo-y-siembra.md` §1 y §3 |
| Turquía | `continent = 'AS'`, geoscheme de la ONU, para que el chip de zona "Europa" corte. | `guion-demo-y-siembra.md` §3 |
| Estados de oferta | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. La última es **terminal** y la contraoferta es **fila nueva**. | `messaging-and-negotiation` · offer-card |
| Estados de hilo | Los **cinco** del CHECK de la migración 0003: `ABIERTO`, `CON CONSULTA PENDIENTE`, `CON OFERTA PENDIENTE`, `ACUERDO ALCANZADO`, `CERRADO SIN ACUERDO`. Literales en el badge. | `0003_threads_and_items.sql` · MSG-01 §3 |
| Vista previa de MSG-01 | **Metadatos siempre**, sin puntitos y sin bloque de passphrase. | F-027 · MSG-01 §7 |
| Frontera de cifrado | Por columna. `unit_price` cifrado **también** en la línea de inventario. Pero **INV-01 no tiene columna de precio**. | `Dia-02_decisiones_esquema.md` §1 · F-024 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. | `conversational-search` · Out of Scope |
| Eliminar una línea | **Borrado lógico** a `status = 'DELETED'`. | F-023 |
| Embeds de PostgREST | **Siempre con la clave ajena nombrada.** En `threads` son tres FK al mismo destino. | F-020 |
| Alcance | 8 pantallas, y el **app shell es una de ellas**. SRCH-01 es la núcleo y no se recorta. **Hechas: shell, INV-01.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Ninguno bloquea el día 5.**

1. ✅ **Secrets de CI — RESUELTO el 9-ago a las 17:11. No queda nada de tu lado.** Los 8
   están puestos y sus nombres casan uno a uno con los `secrets.*` de `ci.yml` (cruzado con
   `gh secret list`). Y `app/.env` **ya los tenía desde antes**, con los `_ORG` con sus
   diacríticos: `haveCreds` da `true` en local, comprobado cargando dotenv.
   **Lo que sigue sin poder afirmarse** es que los valores de GitHub sean los buenos: no se
   pueden leer y hoy no se pueden probar. Se ve mañana. Los dos síntomas a vigilar están en
   la puerta del sprint, más arriba.
2. 🟠 **F-027 (a) · el recuento de no leídos de MSG-01.** Para V1: o `thread_read_receipts`
   con su RLS, o el indicador se retira del spec. **En el MVP queda fuera**, y hay un test
   que falla si reaparece.
3. 🟠 **Diseño de la pantalla de login** (F-016). No existe entre los 32 HTML aprobados ni
   entre las 8 del alcance: es una novena que nadie planificó, y es la primera que ve el
   socio. Hoy va andamiaje hecho con los tokens.
4. **¿Qué hace INV-01 con una línea eliminada?** (F-023 d). Para V1: o quinto chip
   "Eliminados" con restaurar, o eliminar es definitivo desde la interfaz. **No urge.**
5. **¿Debe verse la paginación de INV-01 en la demo?** Alpha cabe en una página. Si quieres
   que se vea, necesita más de 50 líneas: son cinco minutos.
6. **La app no tiene URL desplegada.** Decisión del PO el 7-ago: **de momento solo local**.
   Se retoma antes del **día 11**, que es la primera sesión de prueba contigo. Mientras
   tanto: `npm --prefix <ruta>/app run dev` y `http://localhost:5173`.
7. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
8. **Realtime** sigue sin habilitar en `threads` y `thread_items`. El Plan §3 nombra tablas
   `messages`/`offers` que **no existen**. No urge hasta el día 7.

---

## Riesgo con la vista más corta

**Mañana el arnés produce código por primera vez, y el riesgo no es que salga mal: es que
salga bien y no sepamos por qué.** Los dos datos que hay (F-002 y F-022) son de un intento
cada uno y los dos con prompts muy guiados. Si MSG-01 sale al primer intento, la cifra que
importa para V1 no es esa: es **cuánto hubo que corregir a mano después**, y eso solo se lee
si los commits van separados (`CLAUDE.md` §1.6). El día que se mezclen, la medición del
objetivo 4 se pierde y no se recupera.

**El segundo riesgo es el rojo de hoy.** Un repo rojo es un repo donde un rojo nuevo no se
distingue del viejo. Son dos errores conocidos y desaparecen mañana con el artefacto del
Coder; si a media mañana siguen ahí, la prioridad es cerrarlos, no seguir.

**Día 7 · MSG-02** sigue siendo el riesgo estructural: la pantalla más compleja del MVP, con
margen para comerse dos días. Si el día 7 no está, se simplifica el hilo. A favor:
`thread-lifecycle` ya está en el DDL, así que el día 7 no paga migración — y desde hoy
`lib/threads.ts` y la siembra de hilos también están.

---

*Cerrado el 9-ago-2026 · Claude Code (Opus 5)*
