# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.

**Día 11 de 15 · CERRADO, 14-ago-2026 · Estado: VERDE.** Las dos filas de `Plan §3` para
este día están hechas: el **panel de vista-servidor** (implementado y verificado el
13-ago) y la **sesión de pruebas 1 de Álvaro** (`Plan §10`, ejecutada el 14-ago) — **las 6
comprobaciones del guion, todas OK.**

> ⚠ **Esta sesión también la escribe Sonnet 5, no Opus 4.8** — mismo apunte que los días 9
> y 10 (`CLAUDE.md` §3, autoría honesta `§1.6`).

> **Sesión de pruebas 1 (`Plan §10`) — resultado: 6/6 OK, 5 hallazgos nuevos.** Login y
> aislamiento entre organizaciones, INV-01, búsqueda vía VERA en Comprando, "Consultar
> Seleccionados" cruzado entre las dos cuentas, aceptar oferta (camino rápido) y el panel
> de vista-servidor — verificado con `alpha@`/`beta@bearingworld.test` en dos perfiles,
> contra `https://bearingworld.vercel.app`. **`F-086` a `F-091`** en
> `findings-register.md`:
> - `F-086` (`DESIGN`) — tooltip nativo invisible en Chromium sobre el botón deshabilitado
>   de INV-01; el texto de repuesto es solo para lector de pantalla.
> - `F-087` (`SPEC-GAP`) — "Consultar seleccionados" con selección mixta no dice cuántas
>   filas se omitieron por ya consultadas.
> - `F-088` (`DESIGN`) — tabla de resultados de SRCH-01 sin scroll vertical en toda la
>   cadena de contenedores: contenido genuinamente inaccesible, no solo difícil de ver.
> - `F-089` (`HARNESS`) — este mismo fichero afirmaba una contraoferta de 4,50 €/ud. que la
>   base real no tiene; corregido en el momento, sin bloquear la sesión.
> - `F-090` (`SPEC-GAP`) — VERA no sabe leer un hilo y, en vez de decirlo (`D-09-02`),
>   malinterpreta la pregunta como búsqueda de catálogo y navega sin avisar. Adelanta el
>   "momento clave" que `Plan §10` sesión 2 reserva para el día 13.
> - `F-091` (`HARNESS`) — el propio commit del panel de vista-servidor no había llegado a
>   `bearingworld.vercel.app`; redesplegado en mitad de la sesión.
>
> **El camino completo de contraoferta (envío + aceptación en el otro perfil) queda sin
> verificar.** La única oferta `Pendiente` del hilo Alpha↔Nordwälz Lager se aceptó por el
> camino rápido y quedó `Aceptada` (terminal), y `Crear oferta` sigue deshabilitado (MSG-03
> fuera del MVP) — no hay forma de generar una oferta `Pendiente` nueva sin resembrar.
> Pendiente para la sesión 2 (`Plan §10`, día 13) si se quiere probar antes del 20-ago.
>
> 🟢 **Las 8 pantallas de `Plan §9` siguen completas**, cerrado el 13-ago, sin cambios hoy.

> **Lo del día 10 (contraoferta, "Consultar Seleccionados", F-083, F-082) sigue tal cual
> estaba.** Registro completo en `findings-register.md`, no se repite aquí.

---

## Dónde estamos

`Plan §3`, filas del día 10 — **las dos cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Contraoferta / modificación de oferta | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `counter_offer` (0013) atómico, formulario inline en MSG-02 |
| **"Consultar Seleccionados"** (GAP-004) | Claude Code (Sonnet 5) | **Cableada de extremo a extremo.** `create_inquiry` + `org_public_keys` (0014) atómicos |

`Plan §3`, filas del día 11 — **las dos cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Panel de vista-servidor | Claude Code (Sonnet 5) | **Cerrado.** Toggle por elemento en MSG-02, sin consulta nueva. Ver sección dedicada |
| **Sesión de pruebas 1 — Álvaro** (`Plan §10`) | Álvaro | **Cerrada, 6/6 OK.** 5 hallazgos (`F-086`-`F-091`). Ver "Sesión de pruebas 1, cómo quedó" |

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

## Sesión de pruebas 1 de Álvaro, cómo quedó

`Plan §10`, sesión 1 (14-ago): las 6 comprobaciones del guion, ejecutadas con
`alpha@`/`beta@bearingworld.test` en dos perfiles de navegador contra
`https://bearingworld.vercel.app`.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Entrar con ambas cuentas en paralelo | OK |
| 2 | Cada una ve solo su inventario | OK (`F-086`: tooltip del botón deshabilitado invisible en Chromium) |
| 3 | Buscar una referencia que existe en la otra organización | OK |
| 4 | Consulta llega sola a la otra pestaña | OK (`F-087` y `F-088` encontrados en el camino) |
| 5 | Enviar oferta → aceptarla | OK, camino rápido (`F-089`: dato de este fichero corregido en el momento) |
| 6 | Panel de vista-servidor | OK, tras redesplegar (`F-091`); en el camino, `F-090` sobre VERA |

**Nada bloqueó la sesión.** Los seis hallazgos son del producto o del relevo, no del guion
de prueba, y los cinco quedan registrados en `findings-register.md` con su clasificación,
causa y acción para V1 — no se repiten aquí.

**Dos cosas que vale la pena que Álvaro tenga presentes de cara a la sesión 2 (día 13):**
- El camino completo de contraoferta (envío + aceptación, no solo aceptar lo ya pendiente)
  sigue sin probarse — la única oferta `Pendiente` del hilo de demo se gastó hoy.
- `F-090` (VERA sin herramienta para leer un hilo) es casi literalmente el "momento clave"
  que `Plan §10` sesión 2 reserva a propósito (*"VERA, ¿qué precio me han ofrecido?"*) — ya
  se sabe que falla; la sesión 2 puede confirmar si el fix aguanta en vez de descubrirlo.

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

## Día 11, cerrado — qué sigue

`Plan §3`, las dos filas del día 11 hechas. **No lleva fichero de decisiones propio**
(`CLAUDE.md` §ritual: solo los días 4, 8 y 9).

**Próximo hito de `Plan §10`: sesión 2, día 13** — recorrido completo cronometrado,
interrogatorio a VERA (15 preguntas), contraoferta y modificación, el "momento clave" del
precio cifrado (ver `F-090`, ya se sabe que falla hoy) y dos pestañas sobre el mismo hilo a
la vez. La reunión real con el socio es **el 20 de agosto** (confirmado por el PO) —
separada de las tres sesiones de `Plan §10`, que son ensayo interno. Quedan **6 días
naturales**.

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
7. ⚠ **La base de demo sigue sin ser la de la siembra, y hoy se movió otra vez** —
   verificado con SQL contra `troxminloxkjwihwfevs` durante la sesión de Álvaro, no de
   memoria (ver `F-089`). Estado real ahora mismo del hilo Alpha↔Nordwälz Lager:
   - La oferta de **4,82 €/ud.** (`6205-2RS · NSK`, la enviaba **Nordwälz Lager**, no
     Alpha) está **`Aceptada`** — aceptada hoy por Alpha en el paso 5 de la sesión 1. Es
     terminal: no admite contraoferta ni se puede deshacer con un `update`.
   - **No existe ninguna contraoferta de 4,50 €/ud.** — este fichero la dio por hecha el
     13-ago y era falso (`F-089`, corregido).
   - Varias tarjetas `CONSULTA` nuevas, incluida una a `22215` del "Consultar seleccionados"
     de hoy (paso 4, enviada a 5 distribuidores; solo la de Nordwälz Lager es visible desde
     la cuenta Beta).
   - **Sigue el mismo criterio del PO (13-ago): se deja tal cual, no se limpia.** Es
     demostración real de las funciones del día 10 y del 11. **Efecto para la sesión 2
     (día 13):** no queda ninguna oferta `Pendiente` en este hilo — ver "Sesión de pruebas
     1, cómo quedó".
8. **`F-086`** (tooltip invisible en Chromium sobre botón deshabilitado): ¿texto visible
   siempre en vez de solo `title`, o se acepta el hueco en Chrome/Edge para V1?
9. **`F-087`** ("Consultar seleccionados" con selección mixta, sin aviso de cuántas se
   omitieron por ya consultadas): ¿se amplía `consultSummary` para V1, o se considera
   menor y se deja para después de la demo del 20-ago?

---

*Actualizado el 14-ago-2026, cerrando el día 11 tras la sesión de pruebas 1 de Álvaro (6/6
OK) · Claude Code (Sonnet 5)*
