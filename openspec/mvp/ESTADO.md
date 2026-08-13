# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.

**Día 10 de 15 · cerrado 13-ago-2026 · Estado: VERDE. Los DOS bloques cerrados, verdes en
local, en la base real y — desde esta tarde — verificados de extremo a extremo en el
navegador con las dos cuentas reales. Un bug de verdad apareció en la primera corrida y se
arregló en la misma sesión (F-083).**

> ⚠ **Este relevo lo escribe Sonnet 5, no Opus 4.8.** `CLAUDE.md` §3 asigna la máquina de
> estados de la oferta a Opus 4.8/Claude Code por coste del fallo; la sesión de hoy corrió
> en Sonnet 5. Se deja anotado en vez de atribuir el commit al modelo que "debería" haber
> sido (autoría honesta, `CLAUDE.md` §1.6) — el PO decide si esto importa para este tipo de
> pieza.

> **Verificado, hoy:** `typecheck` limpio · **611 tests** de unidad (eran 578 al empezar el
> día) · `check:palette` cobertura completa · `build` verde · `supabase/tests/run.sh`
> contra Postgres real en Docker — **ESQUEMA VERDE y CATÁLOGO VERDE**, con los asertos
> nuevos de `counter_offer` (0013) y `org_public_keys`/`create_inquiry` (0014).
>
> **Y, por primera vez esta tarde, verificado en navegador con las cuentas reales
> (`alpha@bearingworld.test` sobre la app local apuntando al Supabase remoto):**
> contraoferta de 4,82 €/ud. a 4,50 €/ud. sobre la oferta real de Nordwälz Lager —la
> anterior queda "SUPERADA POR CONTRAOFERTA" en el historial, la nueva "PENDIENTE",
> comprobado en la base que `superseded_by_item_id` apunta bien y las dos partes tienen su
> clave— y "Consultar seleccionados" sobre dos líneas de Nordwälz Lager, agrupadas en el
> hilo existente, con el literal exacto *"Consultas enviadas a 1 distribuidor..."*.
> **Y un fallo parcial real, esperado y correcto:** consultar líneas de las cuatro
> organizaciones de catálogo sin cuenta (Cuscinetti Padana, Łożyska Wschód, Roulements
> Rhône, Anadolu Rulman — ver "Decisiones vivas") dio *"Ese distribuidor no tiene miembros
> a los que consultar"*, sin tumbar nada más.
>
> 🔴 **Y un bug de verdad, F-083:** la primera corrida de "Consultar seleccionados" envolvió
> la CEK solo para el distribuidor, nunca para quien escribía — Alpha no podía releer sus
> propias consultas. Causa y arreglo en `findings-register.md`; **es exactamente la clase de
> fallo que ni Vitest con mocks ni el smoke test SQL podían ver**, porque el mock de los
> tests daba por buena una llamada que la función real nunca haría. Cerrado con test de
> regresión y reverificado con las cuentas reales tras el arreglo.

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

1. ✅ **Contraoferta y "Consultar Seleccionados" ya se verificaron en navegador con cuentas
   reales** (ver cabecera y F-083). El hilo Alpha↔Nordwälz Lager quedó con tres filas que la
   siembra no puso — decidir si se dejan o se limpian antes de la sesión ("Pendiente de
   Álvaro" #7).
2. **El bloqueo de despliegue sigue igual que ayer** (ver "Pendiente de Álvaro" #1): sin URL
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
     real y correcta de las dos funciones del día 10; el hilo Alpha↔Nordwälz Lager se usa
     para la sesión de mañana con este estado, no con el de la siembra original.

---

## Riesgo con la vista más corta

**El primero se cerró esta tarde: `https://bearingworld.vercel.app` está viva, sin login de
Vercel por delante y con las variables de entorno correctas** (ver "Pendiente de Álvaro" #1
y F-084). Queda un resto de riesgo, no un bloqueo: las comprobaciones 3 y 4 de
`despliegue.md` §4 (aislamiento Beta/Alpha en remoto, cabecera por `curl`) no se repitieron
hoy.

**El segundo se cerró esta tarde también, y con un hallazgo real de por medio.** Contraoferta y
"Consultar Seleccionados" se verificaron en el navegador con las dos cuentas reales —la
primera corrida de "Consultar Seleccionados" reveló F-083 (la CEK no se envolvía para quien
escribía), arreglado y reverificado en la misma sesión. **La lección de F-082 se repitió a
otra escala:** lo que Vitest con mocks no puede ver, a veces solo lo ve la base real; lo que
la base real no puede ver —aquí, que el propio emisor se quedaba sin su copia de la
clave— solo lo vio abrir la aplicación de verdad y releer lo que se acababa de escribir.
Ninguna de las tres capas de prueba (unidad, Postgres real, navegador real) sustituye a las
otras dos.

**El tercero es informativo, no un riesgo: la base de demo tiene tres filas que la siembra no
puso** (contraoferta + dos consultas sobre el hilo Alpha↔Nordwälz), y el PO decidió dejarlas
— el guion de mañana cuenta con ellas.

**El cuarto sigue abierto: la clave rotada de F-081 no identificada.** Mientras no se sepa
cuál es, cualquier pieza que dependa de una credencial es sospechosa.

> **La conclusión operativa para el día 11:** las dos piezas del día 10 están probadas de
> punta a punta con cuentas reales, y la URL de la demo está viva. Queda repasar las dos
> comprobaciones de `despliegue.md` §4 que no se repitieron hoy, y la clave rotada de F-081
> — no más código.

---

*Cerrado el 13-ago-2026 · Claude Code (Sonnet 5)*
