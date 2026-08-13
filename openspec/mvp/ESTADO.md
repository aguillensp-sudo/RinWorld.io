# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.

**Día 10 de 15 · cerrado 13-ago-2026 · Estado: ÁMBAR. Los DOS bloques cerrados y verdes
en local y en la base real — pero ninguno de los dos se ha visto en un navegador, y
mañana (`Plan §3`, día 11) es la primera sesión de pruebas con el socio.**

> ⚠ **Este relevo lo escribe Sonnet 5, no Opus 4.8.** `CLAUDE.md` §3 asigna la máquina de
> estados de la oferta a Opus 4.8/Claude Code por coste del fallo; la sesión de hoy corrió
> en Sonnet 5. Se deja anotado en vez de atribuir el commit al modelo que "debería" haber
> sido (autoría honesta, `CLAUDE.md` §1.6) — el PO decide si esto importa para este tipo de
> pieza.

> **Verificado, hoy:** `typecheck` limpio · **610 tests** de unidad (eran 578 al empezar el
> día) · `check:palette` cobertura completa · `build` verde · `supabase/tests/run.sh`
> contra Postgres real en Docker — **ESQUEMA VERDE y CATÁLOGO VERDE**, con los asertos
> nuevos de `counter_offer` (0013) y `org_public_keys`/`create_inquiry` (0014).
>
> **NO verificado — y es la puerta que falta:** ningún click real en navegador. No hay
> credenciales de `alpha@bearingworld.test` / `beta@bearingworld.test` en esta sesión, y el
> único entorno de la app es el proyecto Supabase remoto (no hay réplica local): probar a
> mano habría mutado siembra real a dos días de la demo. **CI (`schema` + `app` + `e2e` con
> reseed de fixture) se disparó al hacer push** y es la primera vez que estos dos flujos se
> ven correr contra cuentas y un navegador de verdad.

---

## Dónde estamos

`Plan §3`, filas del día 10 — **las dos cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Contraoferta / modificación de oferta | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `counter_offer` (0013) atómico, formulario inline en MSG-02 |
| **"Consultar Seleccionados"** (GAP-004) | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `create_inquiry` + `org_public_keys` (0014) atómicos |

---

## Contraoferta, y por qué no es MSG-03

`offers.ts` lo dejó anotado desde el día 6: la contraoferta no es un cambio de estado, es
una fila `OFERTA` nueva que nace `Pendiente` más la anterior movida a "Superada por
contraoferta" con su puntero — las dos cosas o ninguna, en la misma transacción
(`counter_offer`, 0013, mismo patrón que `create_thread_item` de 0012 §5).

**MSG-03 sigue sin ser una pantalla propia** — no está en las 8 de `Plan §9` — pero su
formulario de creación de oferta (§4.2) sí hacía falta, y entra como modal dentro de
MSG-02: `OfferCounterForm.tsx`, prerellenado desde la oferta que se supera. `part_number` y
`brand` se muestran de solo lectura a propósito: `counter_offer` los hereda de la oferta
anterior **en la base**, ignorando lo que llegue por parámetro, así que un campo editable
en el formulario habría sido mentira — parecería que cambia algo que la base no deja
cambiar (`offer-card`: *"no editables salvo cambio explícito de referencia"*, y una
contraoferta no lo es).

El botón `Contra-ofertar` de `ThreadHistory.tsx` pasa de deshabilitado-por-día-10 a
**activo**, o deshabilitado solo cuando esta sesión no puede descifrar la oferta original
(D-07-05: sin contenido legible no hay con qué prerellenar, y eso no es lo mismo que
"fuera del MVP").

---

## GAP-004, y la pieza que faltaba para poder cerrarlo de verdad

El boundary ya estaba cerrado en spec desde junio: *"la selección y el disparo de la
acción pertenecen a conversational-search; la gestión del hilo, tarjeta de consulta y
cifrado E2EE pertenecen a messaging-and-negotiation"* (`conversational-search/spec.md`,
Cross-Capability References). Lo que faltaba era la segunda mitad, y tenía un hueco de
diseño que **0012 no había tenido que resolver**: `thread_public_keys` exige un hilo, y
"Consultar Seleccionados" contra un distribuidor nuevo es exactamente el caso en que ese
hilo **todavía no existe** en el momento de cifrar.

**`org_public_keys` (0014 §1)** resuelve eso: la pública X25519 de los miembros de una
organización, con la misma condición de acceso que ya deja ver esa organización en SRCH-01
(`organizations_select_approved`, 0001) — si la búsqueda ya enseña su inventario, enseñar
la clave pública de sus miembros no abre nada nuevo.

**`create_inquiry` (0014 §2)** encuentra-o-crea el hilo y deposita la tarjeta `CONSULTA`
con sus claves en una transacción, derivando `part_number`/`brand`/organización de
`inventory_lines` — nunca del parámetro — y bloqueando con el literal exacto de
`inquiry-card` una segunda consulta sobre la misma línea.

### 🔴 F-082 · el bug que solo se veía contra Postgres real

El primer diseño de "encontrar o crear el hilo" era `insert ... on conflict do nothing`,
razonando que un insert que no inserta nada es barato. **Falso:** el trigger `BEFORE
INSERT` del límite de 25 hilos/día se dispara para la fila candidata *antes* de que
Postgres resuelva el conflicto, con o sin `ON CONFLICT`. Contra `supabase/tests/run.sh`,
consultar una línea de un distribuidor **ya conocido** agotaba el cupo pensado para
distribuidores **nuevos**. Arreglado buscando antes de insertar. Ver F-082 en
`findings-register.md` — es la clase de defecto que un catálogo de demo pequeño no
enseña nunca, y que 25+ líneas del mismo distribuidor sí habrían enseñado delante del
socio.

### Lo que se dejó fuera, y por qué

- **`Consultar`, fila individual** (`results-row-actions`, escenario *"consultar línea no
  consultada previamente"*): abre la tarjeta de consulta de FL-MSG-01 con un formulario de
  verdad (cantidad obligatoria, comentario opcional). Es una pieza más grande que la de
  hoy — un formulario nuevo, no una llamada en lote — y **no estaba en la fila del día 10**.
- **`Contactar`** (hilo libre, siempre disponible): requisito distinto de
  `results-row-actions`, tampoco pedido para hoy.
- Los dos siguen como no-ops, igual que ayer.
- **La cantidad de "Consultar Seleccionados" es la publicada de la línea (`row.quantity`),
  no una que el comprador teclee.** El escenario cerrado de la capability
  (*"consultar seleccionados en lote"*) no tiene paso de formulario — *"envía... sin abrir
  ningún hilo en pantalla"* — así que no hay de dónde sacar una cifra tecleada. Es una
  decisión de diseño, no un hueco: "quiero saber de esto", no un pedido con cantidad
  propia. Si el PO prefiere otra fuente (p. ej. el chip `Qty mín` de la búsqueda activa),
  es un cambio de una línea en `thread-detail.ts::sendInquiries`.

---

## Hoy toca — Día 11

`Plan §3`, filas del día 11:

| Trabajo | Ejecuta |
|---|---|
| Panel de vista-servidor (comprador vs. lo que almacena Postgres) | — |
| **Sesión de pruebas 1 — Álvaro** (`Plan §10`) | Álvaro |

**No lleva fichero de decisiones propio** (`CLAUDE.md` §ritual: solo los días 4, 8 y 9).

**Lo que hay que tener delante antes de empezar:**

1. **Nada de lo de hoy se ha visto en un navegador.** Antes de la sesión de pruebas hace
   falta un click-through real de contraoferta y de "Consultar Seleccionados" con las dos
   cuentas demo — o al menos leer el resultado de la corrida de CI que se disparó al pushear
   (`schema` + `app` + `e2e`, con reseed de fixture).
2. **El bloqueo de despliegue sigue igual que ayer** (ver "Pendiente de Álvaro" #2): sin URL
   viva, la sesión de mañana no tiene dónde probar. Con día 10 cerrado el mismo 13-ago, el
   colchón de calendario no ha crecido — sigue sin haber clics en la cuenta de Vercel.
3. El panel de vista-servidor **no se recorta nunca** (`Plan §9`): es, junto con SRCH-01 y
   Realtime, uno de los tres argumentos que no se pueden sacrificar.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, DeepSeek oficial vía `DEEPSEEK_API_KEY`. **La clave funciona** — comprobado con `GET /models` → 200 | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
| **Contraoferta** | **Fila `OFERTA` nueva**, nunca un cambio de estado: la anterior pasa a `Superada por contraoferta` con `superseded_by_item_id`, atómico en `counter_offer` (RPC, security invoker) | **0013** |
| **`part_number`/`brand` de la contraoferta** | Se heredan **en la base**, nunca del parámetro del cliente — un formulario que los dejara editar mentiría | `offer-card` · 0013 |
| **Claves del primer contacto** | `org_public_keys(org_id)`: la pública de un distribuidor **sin hilo previo**, misma condición que `organizations_select_approved` | **0014 §1** |
| **"Consultar Seleccionados": cantidad** | La publicada de la línea (`row.quantity`), no una tecleada — el escenario cerrado no tiene paso de formulario | `results-row-actions` · decisión del día 10 |
| **"Consultar Seleccionados": qué queda fuera** | `Consultar` de fila individual (formulario FL-MSG-01) y `Contactar` (hilo libre). Dos requisitos distintos, no pedidos para el día 10 | resultsrow-actions |
| **Encontrar-o-crear un hilo con trigger de límite** | Mirar (`select`) ANTES de `insert ... on conflict`: un `BEFORE INSERT` se dispara aunque el conflicto descarte la fila | **F-082** |
| **Las 4 herramientas** | Buscar en catálogo · Consultar mi inventario · Listar mis hilos (metadatos) · Navegar | **D-09-01** |
| **VERA cuando no puede** | Dice que no puede **y explica por qué**, una vez, en una frase. **Parafrasea, no repite literal** | **D-09-02 (a)** |
| **Dónde corren las herramientas** | **En el navegador, no en el proxy.** El proxy solo guarda la clave y no toca la base | **D-09-05** |
| **Tope de filas al modelo** | **25**, y al recortar **prohíbe explícitamente** hablar de lo que no ve | **F-075** |
| **C2 del arnés** | Corre **SIEMPRE la suite e2e completa**, declare la tarea ficheros o no | **D-09-03 (a)** · F-070 |
| **Métricas sin fuente** | **Guion, nunca 0.** `RNG-PANEL-02` hace que un 0 afirme «he mirado y no hay» | **PANEL-01** |
| **«Consulta sin respuesta»** | `estado_consulta = 'Pendiente'`, la definición **del esquema** | `0003:137` |
| **Contrato de aceptación** | Compila, corre contra esqueletos vacíos y su rojo es **TOTAL**. Negativo y ancla **en el mismo `it`** | F-047 · F-058 · **F-074** |
| **Algoritmo E2EE** | **AES-256-GCM con IV de 12 bytes** y **X25519 nativo**, sin fallback a P-256 | `0003` · F-008 |
| **Dónde vive la clave** | `members.public_key` (0001:73) y `thread_item_keys` (0003:269). **Ninguna columna nueva** | **D-08-03** |
| **Claves de sesión** | **En memoria, se pierden al recargar. Sin `localStorage`** | `CLAUDE.md` §4 |
| **Claves de demo** | Deterministas desde `VITE_DEMO_KEY_SEED`. Divergencia registrada | **D-08-01 (a)** · F-067 |
| **Estados de oferta** | Los cuatro: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. **Capitalizados** | `0003:132` |
| **Quién decide una oferta** | **El receptor, nunca el emisor** (`app.guard_offer_decider`, invoker) | F-051 · F-056 |
| **Cierre del hilo** | **Reversible: un elemento nuevo lo reabre** | **D-07-01** · `0009` |
| Test-runner | **Sin LLM.** C5 lo da el PO, fuera del grafo | `Dia-04` §4 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan, **y tampoco los ve** | `CLAUDE.md` §3 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit** | `CLAUDE.md` §1.6 |
| Precio en SRCH-01 | **Fuera de la parrilla.** Nunca se ordena ni se filtra por precio | F-040 |
| Alcance | **Hechas: shell, LOGIN-01, INV-01, MSG-01, SRCH-01, MSG-02, VND-01 y PANEL-01** | Plan §9 |

---

## Pendiente de Álvaro

1. 🟠 **Despliegue · sigue esperando tus clics, y mañana es la sesión de pruebas.** Decidido
   el 12-ago: **Vercel, con semilla de demo, la semilla solo en *Production*, URL sin
   indexar y muerte en V1**. El repo lleva las tres piezas del no-indexado y el runbook en
   **`openspec/mvp/despliegue.md`**. Los cuatro valores por defecto de Vercel están mal:
   Root Directory **`app`**, rama **`mvp/bootstrap`**, nombre **`bearingworld`** y las tres
   `VITE_*`. **⚠ Con el día 10 cerrado el mismo 13-ago, no queda colchón: la sesión de
   `Plan §3` día 11 es la próxima fila del plan y sigue sin haber URL viva.**
2. **`npx supabase link --project-ref troxminloxkjwihwfevs`** — pide la contraseña de la
   base. **Y ojo (F-073): la CLI está logueada en la cuenta equivocada** —la de
   `web-julsaindustrial`, org `mjxnlvvrnjuuawlxkmte`—; el MVP vive en `ujatcozvbspkycepemfq`.
   Por eso los despliegues de migraciones van por el MCP (0013 y 0014 de hoy, incluidas).
3. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
4. **F-027 (a)** (no leídos de MSG-01) y **F-023 d** (línea eliminada en INV-01). Los dos de
   V1 y pendientes desde hace días.
5. ⚠ **Sigue sin saberse qué `DEEPSEEK_API_KEY` u otra clave dijiste que estaba rotada**
   (F-081, 13-ago). No es la del Coder — comprobado. Si sigue habiendo alguna rotada, hace
   falta el nombre.
6. **Verificación en navegador de los dos bloques del día 10**, si hay un hueco antes de la
   sesión de mañana: no se hizo en esta sesión por falta de credenciales de las cuentas
   demo (ver la cabecera de este fichero).

---

## Riesgo con la vista más corta

**El primero, sin cambios desde ayer y ahora sin colchón: la sesión de pruebas de mañana
(`Plan §3`, día 11) no tiene URL desplegada.** Todo lo que falta son clics en la cuenta de
Álvaro.

**El segundo es nuevo y es de hoy: dos piezas de negociación end-to-end —contraoferta y
"Consultar Seleccionados"— están verdes en Vitest y en Postgres real, pero NUNCA se han
visto en un navegador con las dos cuentas demo.** CI las ejerce por primera vez al mismo
tiempo que se escribe esto; si algo falla ahí, es la primera señal. La lección de F-082 es
la misma en otra escala: lo que un test de unidad con mocks no puede ver, a veces solo lo
ve la base real — y lo que la base real no puede ver, solo lo ve un navegador de verdad.
Ninguna de las dos cosas sustituye a la otra.

**El tercero sigue abierto: la clave rotada de F-081 no identificada.** Mientras no se
sepa cuál es, cualquier pieza que dependa de una credencial es sospechosa.

> **La conclusión operativa para el día 11:** si hay una ventana antes de la sesión con el
> socio, gastarla en abrir la app de verdad con `alpha@bearingworld.test` y
> `beta@bearingworld.test` y contraofertar + consultar en lote una vez cada uno — no en
> escribir más código. Lo que falta no es más lógica, es una comprobación que ningún test
> de este repo puede hacer por sí solo.

---

*Cerrado el 13-ago-2026 · Claude Code (Sonnet 5)*
