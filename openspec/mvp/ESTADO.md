# ESTADO · MVP Bearingworld.io

**Aviso** El trabajo vive en C:/Users/admin/proyectos/Bearing.io/BearingWorld.io en mvp/bootstrap; si te lanzan en un worktree claude/…, opera sobre esa ruta con paths absolutos."

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.** Ahí está
> dónde viven las credenciales (`app/.env`), cuál es el proyecto, por qué el SQL va por el
> MCP y no por la CLI, y los nombres reales de las columnas. No lo deduzcas: se ha perdido
> tiempo con esto en casi todas las sesiones.

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.
>
> **Regla añadida hoy (F-095).** Un estado de la base que este fichero afirme se comprueba
> con SQL **en el momento de escribirlo**, y se dice cuándo se comprobó. La regla de F-089
> no bastó: el relevo del día 11 describía bien lo que había pasado, y la suite e2e se lo
> llevó por delante seis horas después.

**Día 12 de 15 · CERRADO, 14-ago-2026 · Estado: VERDE.** La fila de `Plan §5` para este día
—*"Correcciones de la sesión 1. Curación del catálogo hacia el guion"*— está hecha entera:
**los cuatro hallazgos abiertos de la sesión 1 cerrados** y **el catálogo re-anclado** contra
la base real.

> ✅ **Y esta vez está DESPLEGADO, no solo commiteado.** Edge Function de VERA en **v4** y app
> en `bearingworld.vercel.app`, las dos **comprobadas contra la URL real** — que es la regla que
> dejó `F-091` el día 11 y que se cumple por primera vez el mismo día del cierre. `F-090` no
> solo está escrito: está **confirmado contra Sonnet en producción** (ver su sección).

> ⚠ **Esta sesión la escribe Claude Code con Opus 5** (los días 9, 10 y 11 los escribió
> Sonnet 5). Apunte de autoría honesta, `CLAUDE.md` §1.6.

---

## Lo que hay que saber antes de nada

🔴 **La base de demo NO estaba como decía el relevo de ayer, y la causa tiene nombre
(F-095).** Consultado `threads`/`thread_items` contra `troxminloxkjwihwfevs` hoy a las 10:5x,
**antes de tocar nada**:

| Hilo | Estado | Contenido real |
|---|---|---|
| Ibéricos ↔ **Nordwälz Lager** | `CON OFERTA PENDIENTE` | 1 `OFERTA` · `6205-2RS · NSK` · **`Pendiente`** · la envía **Nordwälz** |
| Ibéricos ↔ Cuscinetti Padana | `CON CONSULTA PENDIENTE` | 1 `CONSULTA` · `NU2210-E-TVP2 · INA` |
| Ibéricos ↔ Łożyska Wschód | `ABIERTO` | 1 `MENSAJE` |
| Ibéricos ↔ Roulements Rhône | `ACUERDO ALCANZADO` | 1 `OFERTA` · `22316-E · Timken` · `Aceptada` |
| Ibéricos ↔ Anadolu Rulman | `CERRADO SIN ACUERDO` | 1 `MENSAJE` |

Es **la siembra limpia**, no lo que quedó tras la sesión de Álvaro. Ninguna tarjeta del día 11
sobrevive. **Por qué:** `e2e/fixture.setup.ts` borra y repone los cinco `HILO_IDS` al empezar
cada corrida de Playwright, y como `create_inquiry` es encontrar-o-crear, las CONSULTA del día
11 cayeron **dentro** de esos cinco hilos en vez de crear otros. Cualquier estado de demo hecho
a mano dura **hasta la siguiente suite e2e**.

> ✅ **Y esto desbloquea la sesión 2.** Hay una oferta **`Pendiente` emitida por Nordwälz**, así
> que **Alpha es la receptora** y puede aceptarla *o contra-ofertarla* (`F-051`/`F-056`: decide
> el receptor, nunca el emisor). El camino completo de contraoferta que ayer se daba por
> perdido para el día 13 **está disponible**.

---

## Dónde estamos

`Plan §5`, fila del día 12 — **cerrada**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Correcciones de la sesión 1 | Claude Code (Opus 5) | **Los cuatro abiertos cerrados.** `F-086` (decisión del PO), `F-087`, `F-088` (+`F-093`), `F-090` |
| Curación del catálogo hacia el guion | Claude Code (Opus 5) | **Re-anclado y con contrato nuevo.** `F-094`: script re-utilizable, asertos de dos lados y fase 3 del arnés |

**Verificado:** **631 tests de unidad** (617 + 14) · `typecheck` / `check:palette` / `build`
verdes · **52/52 e2e contra Supabase real** · **`bash supabase/tests/run.sh` verde**, incluida
la fase 3 nueva · **los dos despliegues comprobados en la URL viva**.

🟢 **Las 8 pantallas de `Plan §9` siguen completas**, sin cambios de alcance hoy.

> **Sin fila en `harness-metrics.csv` hoy, y es correcto.** Ese CSV mide **tareas del Coder**
> (`CLAUDE.md` §6): sus 31 filas son todas `deepseek-v4-flash`. El día 12 no tuvo ninguna —todo
> lo de hoy lo escribió Claude Code a mano—, igual que los días 10 y 11. Inventar una fila
> falsearía el objetivo 4, que es justamente lo que el CSV existe para medir.

---

## Las cuatro correcciones, una a una

### `F-088` · la tabla de SRCH-01 recortaba filas — y la causa no era la que parecía

El hallazgo apuntaba a `overflow`. **La causa raíz era `min-height`.** `.page` de SRCH-01 es
hijo flex de `.bwcnt`, que sí acota su alto, pero **un ítem flex con `overflow: visible`
conserva `min-height: auto` y no encoge por debajo de su contenido**. Medido en navegador con
una ventana de 480px: `.page` ocupaba **11521px dentro de un `.bwcnt` de 384px**, y la última
de 186 filas caía a y=11555. Nada en la cadena tenía `overflow-y: auto`.

Con `min-height: 0` en `.page`, el `flex: 1; min-height: 0` que `.resultsArea` y `.tableOuter`
ya traían **desde el día 6** empieza a significar algo: `.tableOuter` pasa a 242px de alto
sobre 11379 de contenido y el scroll cae donde estaba diseñado —dentro de la tabla, con la
cabecera `sticky` quieta encima—. `overflow-y: auto` explícito en `.tableOuter`, que antes solo
lo heredaba de una regla de cascada que nadie leía.

> ⚠ **El primer test que escribí para esto pasaba con el defecto puesto, y conviene saber por
> qué.** Decía `scrollIntoViewIfNeeded()` + `toBeInViewport()`, que es lo que uno escribe sin
> pensarlo. Pero **`overflow: hidden` sigue siendo un contenedor de scroll**: lo que quita es la
> barra y el gesto de la persona, no la capacidad de desplazarlo por script. Playwright
> desplazaba `.bwcnt` a mano y el aserto se ponía verde sobre contenido inalcanzable. El aserto
> bueno recorre **la cadena de contenedores**, que es lo que el hallazgo nombra: ninguno puede
> recortar con `hidden` lo que le desborda, y alguno tiene que desbordar con `auto`. Comprobado
> en las dos direcciones antes de darlo por bueno.

### `F-093` · MSG-01 tenía el mismo defecto, y se vio al arreglar el anterior

`Messages.module.css` `.page` llevaba `min-height: 100%` dentro del mismo `.bwcnt` recortador.
No se notó en la sesión 1 porque la lista de hilos tiene cinco entradas. **De las cuatro
pantallas con contenido largo, dos lo tenían bien** (`Inventory` `.body` y `SentOffers`
`.content`, las dos con `flex: 1; overflow-y: auto`) **y dos mal** — no era diseño, era que
cada pantalla lo resolvió por su cuenta. Arreglado con la forma de las que ya estaban bien.

### `F-087` · la selección mixta ya no se calla

`consultSummary(resultados, omitidas)` añade *"N filas de la selección ya estaban consultadas y
no se han vuelto a enviar"* **después** del literal verbatim de `SRCH-01 §6`, que no cambia ni
una coma. Uno de los cuatro tests nuevos existe solo para impedir que ese literal crezca cuando
no hay omitidas.

### `F-090` · VERA y la pregunta sobre un hilo — arreglado por tres sitios

Uno solo habría sido un ruego al modelo:

1. **Bloque estático del prompt:** sección nueva que nombra la pregunta del guion (*"¿Qué precio
   me han ofrecido?"*), prohíbe llamar a `buscar_en_catalogo` para ella y dice por qué además es
   grave — *buscar CAMBIA LA PANTALLA*.
2. **`tools.json`:** `buscar_en_catalogo` se descarta a sí misma para ese caso.
3. **Bloque dinámico:** ahora lleva `pantalla` y `hiloAbierto`. **Este era el dato que
   faltaba** — sin saber desde dónde se pregunta, *"¿qué precio me han ofrecido?"* es
   genuinamente ambigua, y el modelo la resolvía por el lado malo.

Nueve asertos nuevos, uno de ellos estructural: **el bloque cacheado no puede contener
interpolaciones**, o se pierde la caché sin que nada falle (`CLAUDE.md` §5).

> ✅ **DESPLEGADO Y CONFIRMADO CONTRA SONNET EL MISMO DÍA.** La función va por la **v4** en
> `troxminloxkjwihwfevs` (desplegada por el MCP: la CLI solo ve `web-julsaindustrial`, F-073).
> Probada contra la URL real con la sesión de `alpha@`:
>
> | Caso | Herramienta llamada | Respuesta |
> |---|---|---|
> | `pantalla: Hilos`, `hiloAbierto: true` → *"¿Qué precio me han ofrecido?"* | **ninguna** (`end_turn`) | *"No puedo leer el contenido del hilo: va cifrado extremo a extremo y el servidor no tiene la clave"* + ofrece los metadatos |
> | `pantalla: Comprando` → *"Necesito 500 unidades de 6205-2RS en Europa"* | `buscar_en_catalogo` | *"Ahora mismo busco en el catálogo"* |
>
> Es exactamente `D-09-02 (a)`: lo dice, explica por qué, una vez, en una frase, **parafraseando
> y no repitiendo el literal**. Y el control demuestra que el arreglo **no ha roto** el camino
> principal. **La caché sigue viva** tras crecer el prompt: 2659 de escritura y luego 2659 de
> lectura (eran 2119 antes).
>
> ⚠ **Es UNA pregunta, no las quince.** La sesión 2 sigue haciendo el interrogatorio completo
> — lo que cambia es que ya no va a descubrir este fallo, va a buscar los que queden.

### `F-086` · decisión del PO: se acepta el hueco

El tooltip del botón deshabilitado de INV-01 sigue invisible en Chrome/Edge. **Decidido hoy por
el PO:** el botón está deshabilitado porque la subida de inventario no entra en el MVP, así que
lo que se pierde es la explicación de una función que tampoco existe. Se arregla en V1 junto con
la subida. Cerrado, no olvidado.

---

## La curación del catálogo · `F-094`

🔴 **El catálogo no se degrada por uso: se degrada por calendario, y no lo miraba nadie.**

Medido con SQL antes de tocar nada: **220 de 221 líneas pasaban ya de 7 días**, y las 14 de
`6205-2RS` también — la más fresca por 8. `ResultsTable.tsx:168` pinta naranja todo lo que pase
de 7, así que **el 20-ago la columna Antigüedad de SRCH-01 habría salido entera en naranja**, y
un indicador que marca el 100% de las filas no indica nada. `guion-demo-y-siembra.md` §2.1 lo
diseñó al revés: naranja como excepción, con una línea en rojo.

**Por qué ningún test lo vio:** `03_catalog_asserts.sql` pedía *"al menos dos líneas de la
referencia con más de 7 días"* — un **suelo**, que el caso contrario al deseado también cumple.
Y corre siempre sobre una siembra recién hecha, donde el defecto no puede existir.

**Lo que se ha hecho:**

| Pieza | Qué es |
|---|---|
| `supabase/seed/reanchor_freshness.sql` | Desplaza `last_upload_at` por un delta constante que devuelve la más reciente a `now()`. Conserva la distribución entera. **Se verifica a sí mismo** y falla en voz alta si no cumple el guion — F-089 aplicado a un script |
| `supabase/tests/05_freshness_asserts.sql` | El contrato de **dos lados** que faltaba: ≥60% del catálogo bajo 7 días · ≥2 de la referencia por encima · ≥1 por encima de 30 · ninguna en el futuro |
| `run.sh` fase 3 | **Envejece el catálogo 9 días a propósito**, comprueba que `05` FALLA así (ancla negativa), re-ancla y comprueba que pasa |

**Estado de la base tras el re-anclaje, verificado hoy:** 221 líneas · **159 frescas** (era 1) ·
`6205-2RS`: **11 frescas, 3 en naranja** · **9 en rojo** · **0 en el futuro**.

> **Hay que volver a correrlo antes de cada ensayo y el 20-ago por la mañana.** Es idempotente
> dentro del mismo día. Está documentado en `guion-demo-y-siembra.md` §6, con el comando.

---

## Día 12, cerrado — qué sigue

**Día 13 (`Plan §5`), dos filas:**

1. **Sesión de pruebas 2 — Álvaro**, flujo completo cronometrado: interrogatorio a VERA (15
   preguntas), contraoferta y modificación, el "momento clave" del precio cifrado y dos pestañas
   sobre el mismo hilo a la vez.
   - **El "momento clave" ya está confirmado en producción** (`F-090`, una pregunta): la sesión 2
     hace las quince y busca los que queden, en vez de descubrir este.
   - **El camino completo de contraoferta está disponible** (ver la cabecera): hay una oferta
     `Pendiente` emitida por Nordwälz y Alpha es quien decide.
   - **Antes de empezar, correr `reanchor_freshness.sql`** o la columna Antigüedad vuelve a
     mentir (`guion-demo-y-siembra.md` §6).
2. **Entorno de demo aislado, con siembra congelada y reseteable.** `F-095` le da motivo medido:
   hoy el estado de demo y el de prueba comparten base, y la suite e2e se come lo que haya.

**La reunión real con el socio es el 20 de agosto** (confirmado por el PO) — separada de las
tres sesiones de `Plan §10`, que son ensayo interno. Quedan **6 días naturales**.

**No lleva fichero de decisiones propio** (`CLAUDE.md` §ritual: solo los días 4, 8 y 9).

---

## Bloqueos y riesgo más cercano

**Nada bloquea el día 13.** Lo que hay son dos frenos y un riesgo con fecha.

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 **Freno 1** | **La CLI de Supabase está en la cuenta equivocada (`F-073`).** Comprobado hoy: `npx supabase projects list` solo devuelve `web-julsaindustrial` y `Base de Conocimientos`. Mientras siga así, **cada migración y cada despliegue de función tiene que ir por el MCP** — funciona, pero es un camino que solo conoce quien lea `CLAUDE.md` §10 | Álvaro: re-loguear y `supabase link` |
| 🟡 **Freno 2** | **Nada despliega solo.** Ni la app a Vercel ni las Edge Functions salen con el push (`F-072`, `F-091`). Un "cerrado" en este fichero no implica "visible en la URL" salvo que lo diga | Se cumple cerrando con el despliegue hecho, como hoy |

### 🔴 El riesgo más cercano: la sesión 2 encuentra en VERA lo que las pruebas de aquí no pueden ver

Es el **riesgo #1 de `CLAUDE.md` §7** y sigue siendo el mismo: nada de lo que se prueba en
este repo comprueba lo que Sonnet *hace*, solo lo que el prompt *dice*. Hoy se ha cerrado la
única pregunta que ya se sabía mal (`F-090`); **quedan catorce del guion sin probar nunca contra
el modelo**, y `F-090` demostró que la forma del fallo no es inventarse un dato —eso está bien
defendido— sino **malinterpretar la intención y actuar**: llamar a una herramienta que navega,
y sacar al usuario de donde estaba sin decir nada.

**Por qué no es rojo hoy:** la sesión 2 es un ensayo interno del día 13, quedan seis días hasta
el 20-ago, y el patrón ya tiene arreglo probado que sirve de plantilla si aparece otro igual.
**Lo que lo haría rojo:** que la sesión 2 encuentre dos o tres más de la misma familia, porque
entonces no es un caso, es que el reparto de herramientas sobregeneraliza y eso ya no se arregla
con una frase en el prompt.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, DeepSeek oficial vía `DEEPSEEK_API_KEY`. **La clave funciona** — comprobado con `GET /models` → 200 | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
| **Frescura del catálogo** | **Se re-ancla, no se re-siembra.** Delta constante que devuelve la más reciente a `now()`; conserva la distribución. Antes de cada ensayo y el 20-ago | **F-094** · `guion-demo-y-siembra.md` §6 |
| **El estado de demo es efímero** | `e2e/fixture.setup.ts` repone los cinco `HILO_IDS` en cada corrida de Playwright. Lo hecho a mano dura hasta la siguiente suite | **F-095** |
| **Dónde cae el scroll de una pantalla** | `.bwcnt` acota el alto; **la raíz de la pantalla es quien scrollea** (`flex: 1; min-height: 0; overflow-y: auto`). Un ítem flex con `overflow: visible` NO encoge | **F-088** · F-093 |
| **VERA y el contenido de un hilo** | Preguntar por lo ofrecido/pedido/acordado **no es una búsqueda de catálogo**. El prompt lo prohíbe, `tools.json` lo repite y el contexto lleva `pantalla`/`hiloAbierto` | **F-090** · D-09-02 |
| **Contraoferta** | **Fila `OFERTA` nueva**, nunca un cambio de estado: la anterior pasa a `Superada por contraoferta` con `superseded_by_item_id`, atómico en `counter_offer` (RPC, security invoker) | **0013** |
| **`part_number`/`brand` de la contraoferta** | Se heredan **en la base**, nunca del parámetro del cliente — un formulario que los dejara editar mentiría | `offer-card` · 0013 |
| **Claves del primer contacto** | `org_public_keys(org_id)`: la pública de un distribuidor **sin hilo previo**, misma condición que `organizations_select_approved` | **0014 §1** |
| **"Consultar Seleccionados": cantidad** | La publicada de la línea (`row.quantity`), no una tecleada — el escenario cerrado no tiene paso de formulario | `results-row-actions` · decisión del día 10 |
| **"Consultar Seleccionados": lo omitido se dice** | El banner cuenta también las filas descartadas por ya consultadas. El literal verbatim de la spec **no cambia**: la coletilla va detrás | **F-087** |
| **"Consultar Seleccionados": qué queda fuera** | `Consultar` de fila individual (formulario FL-MSG-01) y `Contactar` (hilo libre). Dos requisitos distintos, no pedidos para el día 10 | `results-row-actions` |
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

1. ✅ **Edge Function de VERA · DESPLEGADA (v4) y verificada.** Por el **MCP**, no por la CLI:
   `npx supabase projects list` solo devuelve `web-julsaindustrial` y `Base de Conocimientos`
   —F-073 en vivo—, así que `functions deploy` no puede llegar a `troxminloxkjwihwfevs`.
   `verify_jwt` sigue en `true`. Ver la tabla de la sección de `F-090`.
2. ✅ **App desplegada a Vercel y comprobada en el alias**, que es lo que falló el día 11
   (F-091). `bearingworld.vercel.app` → `200`, y el bundle servido lleva los tres marcadores del
   día 12: `hiloAbierto`, el literal de `F-087` y las dos reglas CSS de `F-088`/`F-093`
   (`._page_u1035_9{…min-height:0}` y `._page_1mia6_39{…overflow-y:auto}`). **Ningún secreto en
   el bundle** — la única coincidencia de `sb_secret_` es un literal de la propia librería
   supabase-js, que clasifica prefijos de clave; `service_role` no aparece.
3. **Correr `reanchor_freshness.sql` otra vez antes de la sesión 2 y el 20-ago.** Comando en
   `guion-demo-y-siembra.md` §6. Hoy ya está corrido.
4. **`npx supabase link --project-ref troxminloxkjwihwfevs`** — pide la contraseña de la base. Y
   sigue `F-073`: la CLI está en la cuenta de `web-julsaindustrial`, org `mjxnlvvrnjuuawlxkmte`;
   el MVP vive en `ujatcozvbspkycepemfq`. Por eso las migraciones van por el MCP.
5. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
6. **F-027 (a)** (no leídos de MSG-01) y **F-023 d** (línea eliminada en INV-01). Los dos de V1 y
   pendientes desde hace días.
7. ⚠ **Sigue sin saberse qué `DEEPSEEK_API_KEY` u otra clave dijiste que estaba rotada**
   (F-081, 13-ago). No es la del Coder — comprobado. Si sigue habiendo alguna rotada, hace falta
   el nombre.
8. **Pendiente sin bloquear:** las comprobaciones 3 y 4 de `despliegue.md` §4 (que Beta no vea el
   inventario/hilos de Alpha en remoto, y la cabecera por `curl`) no se han repetido desde el
   13-ago. Son un minuto si quieres cerrarlas antes de la sesión 2.

---

## Ritual de cierre — qué se ha hecho hoy

`CLAUDE.md` §ritual, los cuatro puntos:

1. ✅ **Este fichero, sobrescrito**: día, estado, qué se cerró, qué toca mañana, decisiones
   vivas, bloqueos y riesgo más cercano.
2. ✅ **Hallazgos a `findings-register.md`**: `F-093`, `F-094` y `F-095` nuevos; `F-086`,
   `F-087`, `F-088` y `F-090` actualizados a cerrado con lo que se hizo de verdad.
   **`harness-metrics.csv` sin fila** — no hubo tarea del Coder, ver arriba.
3. — **Sin fichero de decisiones del día**: solo lo llevan los días 4, 8 y 9.
4. ✅ **Commit + push** a `mvp/bootstrap`, y hoy además **desplegado y verificado en la URL
   viva**, que es lo que `F-091` dejó escrito el día 11.

---

*Actualizado el 14-ago-2026, cerrando el día 12 · estado de la base verificado con SQL a las
10:5x · despliegues verificados contra `bearingworld.vercel.app` y la Edge Function v4 ·
Claude Code (Opus 5)*
