# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero, aprendida a base de golpes (F-012).** Cita, no parafrasees. Los
> valores de estado, los nombres de columna y las asignaciones de modelo se copian del spec
> cerrado o del plan **con el puntero al lado**. Un enum o un nombre de campo sin puntero se
> considera no verificado.
>
> **Y su corolario, del día 3 (F-024).** Una advertencia de aquí sin puntero se comprueba
> antes de actuar.
>
> **Y el del día 5, que es nuevo: una cifra de aquí también.** Este fichero decía
> *"`npm test` → 102 pasan"* y lo que daba eran **124**: los 22 de `threads.test.ts` estaban
> contados dos veces, en su fila y dentro de la suite. Un número mal copiado en el tripwire
> hace que mañana el rojo bueno parezca malo.

**Día 5 de 15 · cerrado 10-ago-2026 · Estado: ÁMBAR. Tres de las cuatro condiciones de S1
cerradas; la CI sigue roja y ya se sabe por qué**

> **Lo primero, porque es lo único urgente y es de seguridad (F-038).** El informe de
> Playwright adjunta a cada fallo un volcado del DOM **con el valor de cada campo**, ese
> informe se sube como artefacto de la CI, y **este repositorio es público**: la contraseña
> de la cuenta `alpha` ha estado descargable en texto plano. Ya no se escribe en corridas
> nuevas —`signIn` vacía la caja en cuanto el formulario ha leído el valor—, pero **eso solo
> tapa lo de mañana: la contraseña actual hay que rotarla.**

> **Lee esto antes de nada: hoy el arnés produjo su primera pantalla, y lo que se midió
> fueron sobre todo bugs propios.**
>
> **Tres corridas, nueve intentos, $0.104527.** De ese total, **$0.069372 se fueron en
> corridas donde los checks no llegaron a mirar.** Cinco bugs del arnés (F-028 a F-032), los
> cinco del mismo patrón: **el veredicto sobrevive y la razón no.** Un check que no puede
> ejecutarse, o que ejecuta y no sabe contarlo, se registra igual que uno que miró y falló.
>
> **Están arreglados los cinco, con guardia cada uno.** `test_checks` pasa de **34 a 52**.
> Ninguno puede repetirse en silencio: hay una guardia genérica para los inputs del prompt,
> otra para las rutas de C2, otra para la cadena de herramientas y otra para el UTF-8.
>
> **Lo que NO está cerrado y es de F-033:** el CSV sigue sin distinguir un check **en rojo**
> de uno **inejecutable**. Las nueve filas de hoy se quedan (decisión del PO) y su contexto
> vive en los `LEEME.md` de `harness/metrics/MSG-01/`. Léelos antes de usar esas filas para
> nada: seis de los nueve intentos no miden al modelo.

---

## Dónde estamos

`Plan §3`, fila del día 5: *"Primera pantalla producida por el arnés: **MSG-01**. Registro
de métricas."* Hecho, y la puerta de sprint con ello.

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Wiring de `Hilos` en `App.tsx` | Claude Code | **Hecho** antes de gastar un token (`801b577`) |
| Siembra de `demo_threads.sql` en el remoto | Claude Code | **Hecho.** 5 hilos + 5 elementos, uno por estado del CHECK |
| MSG-01 por el arnés | Arnés | **Escalada en 3 intentos**, terminada a mano |
| Cinco bugs del arnés | Claude Code | **Cerrados**, con guardia cada uno |
| `component_api` en el formato de tarea | Claude Code | **Hecho.** Desviación escrita en `Dia-04 §5` |

### Puerta de salida de S1 — `Plan §3`, textual

*"dos navegadores, dos cuentas, cada una ve su inventario. CI en verde. Una pantalla nacida
del arnés, con su coste medido."*

| Condición | Estado |
|---|---|
| Dos cuentas, cada una ve su inventario | ✅ re-verificado hoy dentro de los 31 e2e |
| Una pantalla nacida del arnés | ✅ MSG-01. Artefacto en `a31dfe3`, arreglo en `ccdbeed` |
| Con su coste medido | ✅ 9 filas en el CSV + 9 JSON + tres `LEEME.md` |
| **C5 · ¿lo mantendrías?** | ✅ **PASA. El PO lo dio el 10-ago**, después de que la revisión sacara F-035 |
| CI en verde | 🔴 **ROJA, y ya se sabe por qué: F-037.** Es lo único que queda de la puerta |

**La CI está roja por el valor de un secret, no por el código.** De los tres trabajos,
`Esquema` y `App · typecheck, Vitest, build` **pasan**; cae `Playwright`, y con un error que
no menciona ni a Supabase ni a la clave:

```
Failed to execute 'fetch' on 'Window': Failed to read the 'headers' property
from 'RequestInit': String contains non ISO-8859-1 code point.
```

`SUPABASE_PUBLISHABLE_KEY` tiene un carácter fuera de ISO-8859-1 —comilla tipográfica o
espacio duro al pegarlo— y una cabecera HTTP no lo admite. El navegador **falla al construir
la petición**, no al autenticar, así que parecía un fallo de credenciales. **Ninguna corrida
de Playwright ha llegado nunca a autenticarse**, desde el día 2. Los otros dos síntomas que
este fichero vigilaba quedan **descartados**: no son los diacríticos de `E2E_*_ORG` (habrían
dado texto distinto, no `element(s) not found`) ni la clave de servicio (Beta ve 1 hilo de 5,
luego RLS se aplica).

**Lo arregla volver a pegar el secret en texto plano, y es lo único.** Desde hoy, si vuelve a
pasar, `supabase.ts` lo dice al arrancar con el punto de código exacto.

**Verificaciones, todas de hoy:**

| Verificación | Estado |
|---|---|
| `cd app && npm run typecheck` | **limpio** |
| `cd app && npm test` | **158 pasan** (9 ficheros) |
| `cd app && npx vitest run src/screens/messages` | **34/34** de aceptación |
| `cd app && npx playwright test` | **31/31**, con los 9 de MSG-01 contra el Supabase real |
| `cd app && npm run check:palette` | cobertura completa |
| `python -m harness.tests.test_checks` | **52/52** |
| `python -m harness.graph.run … --seco` | 3/3 escenarios |

**C5 ya está dado** (`Dia-04_decisiones_arnes.md` §4: *"El PO, a mano. El grafo llega hasta
C4"*). Pasa — y de la revisión salió **el primer hallazgo de C5 del proyecto**, F-035: la
pantalla estaba mal compuesta con los cuatro checks automáticos en verde.

---

## Lo que hay que saber de MSG-01

**La pantalla está en `app/src/screens/messages/`** y cuelga del ítem `Hilos`, con
`veraSubtitle = 'Agente de mensajería'` (MSG-01 §5, `Rinworld_spec_MSG-01.md:113`).

**El reparto es el de la casa:** `Messages.tsx` es la pantalla —posee búsqueda y página, y
llama a `fetchThreadPage` con `profile.orgId`—; `ThreadList.tsx` es presentacional y pinta
las filas en el orden que las recibe. **El estado vacío de la spec §6 vive en `ThreadList`**,
no en la pantalla: "no hay filas" es un estado de la lista, y si lo deciden los dos acaban
discrepando. La pantalla se queda solo con el vacío **por búsqueda**, que no es el mismo caso.

**⚠ `App.tsx` le pasa `now` explícito, y hay que saber por qué antes de "simplificarlo".**
El contrato de aceptación monta `<Messages profile={…} now={NOW} />` pero no fija si `now`
es opcional. Si el Coder lo declarara obligatorio, un `<Messages profile={…} />` a secas
rompería el typecheck desde un fichero que la tarea le prohíbe tocar: C1 en rojo por el
wiring y no por el artefacto. Se construye en el render y **no se congela al montar**: con
un `now` fijo, una sesión abierta un par de horas acabaría diciendo "en 1 h" de un elemento
del pasado.

**Lo que costó terminarla a mano: `+171 / −145` sobre 695 líneas** (`a31dfe3` → `ccdbeed`).
Cuatro defectos y una decisión, detallados en el mensaje de `ccdbeed`. **Dos de los cuatro
eran inalcanzables para el Coder:** `errorMessage` vive en `lib/session.ts`, que no está
entre sus inputs, y el bloque de passphrase lo prohíbe F-027, que no viaja en la tarea.

**Lo que NO hubo que tocar**, y es el dato bueno: la consulta, la cancelación del efecto, la
paginación, la búsqueda con submit, los cinco literales del esquema, la separación
pantalla/presentación y el CSS entero de la fila. C3 y C4 estaban verdes antes del arreglo.

**La siembra está en el remoto y es idempotente** (`where not exists`). Cinco hilos de
Alpha, uno por estado. El `content_ciphertext` es relleno a propósito: MSG-01 nunca descifra.

---

## Hoy toca — Día 6 (11-ago-2026)

`Plan §3`, filas del día 6 — **son dos bloques y no dependen el uno del otro**:

| Trabajo | Ejecuta |
|---|---|
| **SRCH-01** — capa presentacional: chips editables, tabla de resultados, selección de filas | Arnés + revisión a mano |
| **Máquina de estados de la oferta (§7)** | Claude Code |

**Antes de lanzar el arnés con SRCH-01, y esto es de hoy:**

1. **La tarea de SRCH-01 lleva `component_api` desde el minuto uno.** Es campo del formato
   desde hoy (`Dia-04 §5`) y sin él el Coder adivina nombres de prop que fijan tests que no
   ve. Y lleva `data_layer` **entregado**, no solo declarado.
2. **Lo que F-036 dice que hay que meterle además: las decisiones vivas que afectan a la
   pantalla.** El bloque de passphrase se pintó porque la §6 del spec lo pide y F-027 lo
   prohíbe — y F-027 no viaja en la tarea. Para SRCH-01 la equivalente es **`Precio fuera de
   la parrilla`** (`conversational-search`, Out of Scope): si no entra en `out_of_scope`, el
   Coder pintará una columna de precio porque el mock la tiene.
3. **`app/scripts/check-palette.mjs` tiene que estar verde antes**, o C3 juzga con un
   sistema de diseño incompleto y suspende output correcto (F-003).
4. **Commits separados, otra vez** (`CLAUDE.md` §1.6): artefacto tal cual con
   `Co-Authored-By: deepseek-v4-flash <coder@harness.local>`, y las correcciones aparte. El
   diff del segundo *es* la medida. Hoy funcionó y dio la cifra de F-036.

**SRCH-01 es la pantalla núcleo y `Plan §9` dice que no se recorta.** Es la primera vez que
el arnés toca algo crítico: la revisión a mano de después no es opcional.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Tope de intentos | **3**, y el tercero escala al humano con código de salida 2. | `Dia-04_decisiones_arnes.md` §1 |
| Test-runner | **Sin LLM.** Ejecuta procesos y lee códigos de salida. C5 lo da el PO, fuera del grafo. | `Dia-04_decisiones_arnes.md` §4 |
| **Formato de tarea** | Congelado el día 4, **con una desviación del día 5: el campo `component_api`**. Solo la firma pública, nunca lo que los tests asertan. | `Dia-04_decisiones_arnes.md` §5 · F-034 |
| **Prompt del Coder** | **Todo input declarado en la tarea tiene que llegar al prompt**, y hay guardia que falla si no. | F-030 |
| **Antes de gastar** | `check_prices_or_exit()` **y** `check_toolchain_or_exit()`, los dos antes de la primera llamada al modelo. | F-028 |
| C2 del arnés | Se evalúa sobre el **panel de contenido**, nunca sobre el shell. | F-025 |
| C3 del arnés | Contra **§1.1 + §1.4 + §1.5** de `design-system.md`, nunca §1.1 a secas. | F-003 |
| Formato | Los checks comparan contra la **función de formato**, nunca contra la cifra del mock. | F-024 |
| Checks | Un check que no se puede ejecutar es **rojo**, nunca ausente. **Correcto para decidir; insuficiente para medir** (F-033). | F-015 · F-033 |
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
| Alcance | 8 pantallas, y el **app shell es una de ellas**. SRCH-01 es la núcleo y no se recorta. **Hechas: shell, INV-01, MSG-01.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Los dos primeros no bloquean el día 6, pero cierran la puerta de S1 — y el primero es de
seguridad.**

1. 🔴 **F-038 · rotar la contraseña de la cuenta `alpha`. No es opcional.** Ha estado en
   texto plano dentro de los artefactos de la CI de un repositorio público. Las corridas
   nuevas ya no la escriben, pero la contraseña actual sigue siendo la que estuvo expuesta.
   Decide también si el informe de Playwright se sigue subiendo tal cual: con
   `retention-days: 7` los informes ya publicados caducan solos, la contraseña no.
2. 🔴 **F-037 · volver a pegar `SUPABASE_PUBLISHABLE_KEY` en texto plano.** Tiene un
   carácter fuera de ISO-8859-1 y por eso Playwright no ha autenticado nunca. **Es lo único
   que separa la CI del verde** y, con ello, la puerta de S1 de estar cerrada: los otros dos
   trabajos ya pasan y C5 ya está dado.
3. ✅ **C5 de MSG-01 — DADO el 10-ago.** Pasa. De la revisión salió F-035.
4. 🟠 **F-033 · qué hacer con las nueve filas de hoy en V1.** Se quedan como están (tu
   decisión de hoy). Lo que falta decidir es si en V1 el CSV lleva un estado propio de check
   —`rojo` / `inejecutable`— y si un intento con algún check inejecutable cuenta como intento
   del modelo. Con el formato de hoy, la métrica de "intentos hasta verde" no es fiable.
3. 🟠 **F-027 (a) · el recuento de no leídos de MSG-01.** Para V1: o `thread_read_receipts`
   con su RLS, o el indicador se retira del spec. **En el MVP queda fuera**, y hay un test
   que falla si reaparece.
4. 🟠 **Diseño de la pantalla de login** (F-016). No existe entre los 32 HTML aprobados ni
   entre las 8 del alcance: es una novena que nadie planificó, y es la primera que ve el
   socio. Sigue con el andamiaje hecho con los tokens.
5. **¿Los cinco hilos sembrados son los de la demo del día 11?** Están en el Supabase real,
   con `content_ciphertext` de relleno. Si quieres otros, es de mano y son diez minutos.
6. **¿Qué hace INV-01 con una línea eliminada?** (F-023 d). Para V1: o quinto chip
   "Eliminados" con restaurar, o eliminar es definitivo desde la interfaz. **No urge.**
7. **¿Debe verse la paginación de INV-01 en la demo?** Alpha cabe en una página.
8. **La app no tiene URL desplegada.** Decisión del PO el 7-ago: **de momento solo local**.
   Se retoma antes del **día 11**, que es la primera sesión de prueba contigo. Mientras
   tanto: `npm --prefix <ruta>/app run dev` (5173) o, más rápido para revisar,
   `npm run build && npm run preview` (4173), que es el bundle que prueba el e2e.
9. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
10. **Realtime** sigue sin habilitar en `threads` y `thread_items`. El Plan §3 nombra tablas
    `messages`/`offers` que **no existen**. Entra mañana con el día 7 a un día vista.

---

## Riesgo con la vista más corta

**El riesgo de hoy ya no es la CI: es lo que la CI escondía.** La causa está identificada
(F-037, un carácter mal pegado en un secret) y se arregla en un minuto. Lo que preocupa es
cómo se encontró: **la CI llevaba ocho días roja y nadie había bajado el artefacto**. Al
bajarlo apareció, de paso, que el informe publicaba una contraseña en un repositorio público
(F-038). Ninguna de las dos cosas la ve un test; las ve mirar el fallo entero una vez.

**La regla que sale de ahí, para mañana: un rojo viejo deja de leerse.** Este fichero lo
escribió el día 4 —*"un repo rojo es un repo donde un rojo nuevo no se distingue del
viejo"*— y aun así la CI encadenó ocho días en rojo con la causa a un `gh run download` de
distancia. Si mañana la CI sigue roja después de repegar el secret, se para y se mira, no se
sigue.

**El segundo riesgo es creerse la métrica de hoy.** Nueve filas en el CSV y solo tres miden
al modelo. Si mañana alguien promedia "intentos hasta verde" sobre las nueve, sale un número
que dice que el Coder necesita tres intentos, cuando lo que hubo fue un arnés que no miraba.
Los `LEEME.md` están para eso; F-033 es la solución de verdad y es tuya.

**Día 7 · MSG-02** sigue siendo el riesgo estructural: la pantalla más compleja del MVP, con
margen para comerse dos días. A favor, y desde hoy más: `thread-lifecycle` ya está en el DDL,
`lib/threads.ts` y la siembra existen, **y MSG-01 deja el patrón pantalla/presentacional ya
resuelto y probado**. Si el día 7 no está, se simplifica el hilo.

---

*Cerrado el 10-ago-2026 · Claude Code (Opus 5)*
