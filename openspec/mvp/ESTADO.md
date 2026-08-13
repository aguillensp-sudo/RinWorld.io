# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.

**Día 11 de 15 · EN CURSO, 13-ago-2026 · Estado: VERDE parcial.** El día 10 cerró VERDE (ver
"Dónde estamos"). De las dos filas del día 11 (`Plan §3`), el **panel de vista-servidor**
está cerrado y verificado; **la sesión de pruebas 1 de Álvaro (`Plan §10`) está por
delante** — este fichero se actualiza justo antes de que empiece, no después.

> ⚠ **Esta sesión también la escribe Sonnet 5, no Opus 4.8** — mismo apunte que el día 10
> (`CLAUDE.md` §3, autoría honesta `§1.6`). El panel de vista-servidor no toca esquema, RLS
> ni la máquina de estados de la oferta —es capa de presentación sobre datos que
> `fetchThreadItems` ya traía—, así que el argumento de coste-del-fallo que reserva ese
> reparto a Opus pesa menos aquí que en la contraoferta o GAP-004 del día 10.

> **Panel de vista-servidor (`Plan §3`, día 11, primera fila) — CERRADO.** Toggle "Ver lo
> que ve el servidor" por elemento del hilo (MSG-02), colapsado por defecto. `ThreadItem.raw`
> retiene `content_ciphertext`/`content_iv`/conteo de `thread_item_keys` que
> `fetchThreadItems` ya traía y tiraba tras descifrar — **sin consulta nueva, sin RLS
> nueva**. **Verificado:** 617 tests de unidad (eran 611) · `typecheck`/`check:palette`/
> `build` verdes · **19/19 e2e de `messages.spec.ts` contra el Supabase real**, incluido un
> test nuevo que abre el toggle en el hilo Alpha↔Nordwälz Lager y confirma las dos mitades a
> la vez: `4,82 €/ud.` legible arriba, `\x…` cifrado abajo, y que no se escapa ni un byte
> antes de pulsarlo. Commit `5bec69d`. Detalle en "Panel de vista-servidor, cómo quedó".
>
> 🟢 **Con esto, las 8 pantallas de `Plan §9` quedan completas**: shell, PANEL-01, INV-01,
> SRCH-01, MSG-01, MSG-02, VND-01 y panel de vista-servidor. Es el alcance entero del MVP
> construido — lo que queda de aquí al 20-ago es endurecimiento y ensayo (`Plan §5`,
> Sprint 3), no pantallas nuevas.
>
> **Lo del día 10 (contraoferta, "Consultar Seleccionados", F-083, F-082) sigue tal cual
> estaba — no se ha tocado hoy.** Ver el resto de este fichero para ese registro completo:
> se mantiene porque la sesión de Álvaro de hoy depende de ambos días, no solo del 11.

---

## Dónde estamos

`Plan §3`, filas del día 10 — **las dos cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Contraoferta / modificación de oferta | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `counter_offer` (0013) atómico, formulario inline en MSG-02 |
| **"Consultar Seleccionados"** (GAP-004) | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `create_inquiry` + `org_public_keys` (0014) atómicos |

`Plan §3`, filas del día 11 — **una cerrada, una por delante**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Panel de vista-servidor | Claude Code (Sonnet 5) | **Cerrado.** Toggle por elemento en MSG-02, sin consulta nueva. Ver sección dedicada |
| **Sesión de pruebas 1 — Álvaro** (`Plan §10`) | Álvaro | **Por delante.** Es la razón de esta actualización |

---

## Panel de vista-servidor, cómo quedó

`Plan §3`, día 11, primera fila: *"panel de vista-servidor (comprador vs. lo que almacena
Postgres)"*. No tiene spec cerrada ni existe en los 32 HTML aprobados (`Plan §9`) — es
diseño nuevo, decidido con el PO antes de escribir una línea.

**No es una pantalla ni una ruta nueva.** El único requisito cerrado es `Plan §10`, sesión
1, paso 6: *"Abrir el panel de vista-servidor... y verificar que los campos comerciales
salen cifrados"*, desde dentro del hilo — no desde un ítem de nav nuevo, que además no
existe para esto (`AppShell.tsx`, 8 ítems, ninguno es este). Entra como un toggle **"Ver lo
que ve el servidor"** por cada elemento del historial de MSG-02 (`ThreadHistory.tsx`), a
nivel de `<li>` y no dentro de `Card` — cubre MENSAJE, CONSULTA y OFERTA con una sola
implementación, coherente con que `e2ee-content-encryption` habla de "cualquier elemento
del hilo", no solo de ofertas.

**El hallazgo que abarató la implementación:** `fetchThreadItems` (`thread-detail.ts`) ya
traía `content_ciphertext`, `content_iv` y el embed de `thread_item_keys` en la misma
consulta que arma cada tarjeta, y los tiraba tras `decryptItem`. `ThreadItem.raw` los
retiene — **cero consultas nuevas, cero RLS nueva**, y es más honesto que un fetch a
demanda: es literalmente lo que Postgres devolvió en la misma llamada que ya pinta la
pantalla. `wrappedKeyCount` es 0 o 1, nunca el total de destinatarios — `item_keys_select_own`
(`0003:353`) filtra por mí, así que enseñar el conteo real y no "N destinatarios" evita
afirmar un dato que este componente no tiene (`CLAUDE.md` §7).

**Colapsado por defecto**, a propósito: el ciphertext no debe llegar al DOM salvo que
alguien pulse el toggle. Lo comprueba un e2e nuevo en `messages.spec.ts` contra el hilo
real Alpha↔Nordwälz Lager (la misma oferta de 4,82 €/ud. que usa el resto de la suite) —
cerrado el toggle, cero bytes `\x…` en `page.content()`; abierto, las dos mitades a la vez.
Un locator del primer intento coincidía con dos nodos (`content_ciphertext` Y `content_iv`
son hex ≥16 caracteres) — bug del test, no del producto, arreglado con `.first()`.

**Verificado:** 617 tests de unidad (611 + 6) · `typecheck`/`check:palette`/`build` verdes
· **19/19 e2e de `messages.spec.ts` contra Supabase real**. Commit `5bec69d`, pusheado a
`mvp/bootstrap`.

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
| Panel de vista-servidor (comprador vs. lo que almacena Postgres) | Claude Code (Sonnet 5) — **CERRADO**, ver sección dedicada |
| **Sesión de pruebas 1 — Álvaro** (`Plan §10`) | Álvaro — **por delante** |

**No lleva fichero de decisiones propio** (`CLAUDE.md` §ritual: solo los días 4, 8 y 9).

**Lo que hay que tener delante antes de empezar:**

1. ✅ **Contraoferta y "Consultar Seleccionados" ya se verificaron en navegador con cuentas
   reales** (ver cabecera y F-083). El hilo Alpha↔Nordwälz Lager quedó con tres filas que la
   siembra no puso — decidir si se dejan o se limpian antes de la sesión ("Pendiente de
   Álvaro" #7).
2. ✅ **Despliegue resuelto** (ver "Pendiente de Álvaro" #1): `https://bearingworld.vercel.app`
   viva. Útil para la sesión 1 de hoy si Álvaro quiere probar la app desplegada en vez de
   solo local — no es indispensable para esa sesión, pero sí lo será para la reunión real.
3. ✅ **Panel de vista-servidor: CERRADO esta tarde**, ver "Panel de vista-servidor, cómo
   quedó" arriba. Para la sesión de Álvaro: dentro de un hilo (MSG-02), cada elemento del
   historial lleva un enlace **"Ver lo que ve el servidor"** debajo de autor/fecha — al
   pulsarlo enseña el `content_ciphertext`/`content_iv` en hex, al lado de lo que la tarjeta
   ya pinta descifrado. No se recorta nunca (`Plan §9`): es, junto con SRCH-01 y Realtime,
   uno de los tres argumentos que no se pueden sacrificar.
4. ⚠ **Corrección de una asunción mía, sin comprobar, repetida varias veces en este fichero
   los últimos dos días:** el día 11 (`Plan §10`, "Sesión 1 · Cimientos") **lo ejecuta
   Álvaro solo**, con dos perfiles de navegador para encarnar comprador y vendedor — no es
   una reunión con el socio. La reunión real con el socio es **el 20 de agosto** (confirmado
   por el PO, 13-ago), separada de las tres sesiones de `Plan §10` (días 11, 13 y 15), que
   son ensayo interno. Quedan **7 días naturales**, no uno. La sesión 2 (día 13) es la que
   el propio plan señala como el ensayo que tiene que pasar *"antes del día de la
   reunión"* (`Plan §12`).

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
| Alcance | **Hechas: shell, LOGIN-01, INV-01, MSG-01, SRCH-01, MSG-02, VND-01, PANEL-01 y panel de vista-servidor.** Las 8 de `Plan §9` completas | Plan §9 |

---

## Pendiente de Álvaro

1. ✅ **Despliegue · RESUELTO esta tarde. URL viva: `https://bearingworld.vercel.app`.**
   Dos problemas, los dos cerrados con el CLI (proyecto ya estaba enlazado desde el 12-ago,
   ruta B de `despliegue.md`):
   - **Vercel Authentication (SSO) bloqueaba la URL** con un 302 al login de Vercel.
     `npx vercel project protection disable bearingworld --sso` — confirmado contigo antes
     de tocarlo. Verificado con `curl -I`: `200 OK`, sin redirección, `X-Robots-Tag: noindex,
     nofollow, noarchive` puesto.
   - 🔴 **F-084 · las tres variables de *Production* valían literalmente `"n"`** desde que se
     pusieron el 12-ago — no vacías, el carácter `n`, compatible con que se colara la
     respuesta a un `y/N` de otro prompt en una sesión no interactiva de verdad. La app
     cargaba en blanco (`Invalid supabaseUrl`). Borradas y vueltas a poner por pipe desde
     `app/.env` (el valor nunca se tecleó ni quedó en el historial de la shell). Redesplegado
     y **verificado contra el bundle real**: `troxminloxkjwihwfevs` aparece, ningún
     `sb_secret_…`, y la app carga el login limpio en una pestaña nueva sin errores de
     consola.
   - **Pendiente, sin bloquear:** las comprobaciones 3 y 4 de `despliegue.md` §4 (que Beta no
     vea el inventario/hilos de Alpha en remoto, y la cabecera por `curl`) no se repitieron
     hoy porque no hacía falta para desbloquear la URL — son un minuto si quieres cerrarlas
     del todo antes de la sesión.
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
6. ✅ **Verificación en navegador de los dos bloques del día 10: HECHA esta misma tarde**,
   con `alpha@bearingworld.test` sobre la app local apuntando al Supabase remoto (el
   `.env` de `app/` ya traía las credenciales). Contraoferta y "Consultar Seleccionados"
   funcionan de extremo a extremo. Ver la cabecera de este fichero y F-083.
7. ⚠ **La base de demo YA NO está como la dejó la siembra — la tocó esta verificación, con
   intención pero sin guion.** Concretamente sobre el hilo Alpha↔Nordwälz Lager:
   - La oferta sembrada de **4,82 €/ud.** quedó **"Superada por contraoferta"** por una
     real de **4,50 €/ud.**, `Pendiente`, emitida por Alpha. Es terminal: no se puede
     deshacer con un `update`, solo borrando filas.
   - Dos tarjetas de **`CONSULTA`** nuevas de Alpha a Nordwälz Lager (`6205-2RS` SKF 1250 u.
     y NSK 1200 u.), ambas `Pendiente`, ambas legibles por las dos partes.
   - **Decidido por el PO (13-ago): se deja tal cual, no se limpia.** Es una demostración
     real y correcta de las dos funciones del día 10; el hilo Alpha↔Nordwälz Lager llega
     así a la sesión 1 de Álvaro (hoy) y, salvo que algo lo cambie antes, también al
     20-ago.
8. **La reunión real con el socio es el 20 de agosto**, no el día 11. Corregido tras una
   asunción mía sin comprobar — ver "Riesgo con la vista más corta".

---

## Riesgo con la vista más corta

**🔴 Corrección de calendario, y va primero porque cambia la lectura de todo lo demás.**
`ESTADO.md` llevaba dos días escribiendo "la sesión de mañana" como si el día 11 fuera la
reunión con el socio. **Es falso, y no se comprobó hasta que Álvaro preguntó directamente.**
`Plan §10` es explícito: los días 11, 13 y 15 son *"Plan de pruebas de usuario — ejecuta
Álvaro"*, tres ensayos internos con Álvaro haciendo de comprador y vendedor a la vez. **La
reunión real con el socio es el 20 de agosto** (confirmado por el PO, 13-ago) — un evento
aparte que el plan de 15 días ni fecha ni nombra directamente, solo lo referencia como *"el
día de la reunión"* (`Plan §12`, nota sobre el riesgo de VERA). Quedan **7 días naturales**,
no uno. Nada de lo urgente de hoy (despliegue, verificación en navegador) estaba mal hecho
ni de más — solo mal explicado el porqué de la prisa.

**El despliegue está resuelto:** `https://bearingworld.vercel.app` viva, sin login de Vercel
por delante y con las variables de entorno correctas (ver "Pendiente de Álvaro" #1 y F-084).
Queda un resto menor: las comprobaciones 3 y 4 de `despliegue.md` §4 (aislamiento Beta/Alpha
en remoto, cabecera por `curl`) no se repitieron hoy, y hay margen de sobra para hacerlas
antes del 20-ago.

**Contraoferta y "Consultar Seleccionados" están verificadas en navegador con las dos
cuentas reales, con un hallazgo real de por medio (F-083):** la primera corrida de
"Consultar Seleccionados" reveló que la CEK no se envolvía para quien escribía, arreglado y
reverificado en la misma sesión. **La lección de F-082 se repitió a otra escala:** lo que
Vitest con mocks no puede ver, a veces solo lo ve la base real; lo que la base real no puede
ver —aquí, que el propio emisor se quedaba sin su copia de la clave— solo lo vio abrir la
aplicación de verdad y releer lo que se acababa de escribir. Ninguna de las tres capas de
prueba (unidad, Postgres real, navegador real) sustituye a las otras dos.

**Informativo, no un riesgo: la base de demo tiene tres filas que la siembra no puso**
(contraoferta + dos consultas sobre el hilo Alpha↔Nordwälz), y el PO decidió dejarlas — el
guion de la sesión 1 de hoy y, salvo cambio, el del 20-ago cuentan con ellas.

**Sigue abierto: la clave rotada de F-081 no identificada.** Mientras no se sepa cuál es,
cualquier pieza que dependa de una credencial es sospechosa. Con 7 días por delante en vez
de uno, no es urgente hoy, pero no se debe olvidar antes del 20-ago.

> **La conclusión operativa, con el calendario ya corregido:** el día 11 es el primer ensayo
> de Álvaro, no la demo — sirve para encontrar fricción, no para llegar impecable. Con 7 días
> hasta el 20-ago hay margen para las comprobaciones menores de despliegue, la clave rotada
> de F-081, y lo que salga de las sesiones 1 y 2 (`Plan §10`). La próxima vez que este
> fichero mencione una fecha límite, se comprueba contra `Plan §10`/§12 o se pregunta —no se
> asume por el nombre de la fila del plan.

---

*Actualizado el 13-ago-2026, antes de la sesión de pruebas 1 de Álvaro · Claude Code (Sonnet 5)*
*Día 11 sigue EN CURSO — no cerrar este fichero hasta que la sesión de Álvaro termine.*
