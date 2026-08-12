# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado, los
> nombres de columna y las asignaciones de modelo se copian del spec cerrado o del plan
> **con el puntero al lado**. Un enum o un nombre de campo sin puntero se considera no
> verificado.
>
> **Y el corolario del día 8, que endurece a F-024 y hoy costó una migración entera de
> más:** F-024 decía que *una advertencia sin puntero se comprueba antes de actuar*.
> Hoy se descubrió que no basta. `Dia-08_decisiones_e2ee.md` afirmaba, **con la palabra
> "Comprobado" delante**, que el esquema no tenía columna para ninguna clave pública — y
> era falso: `members.public_key` está en `0001:73` desde el día 2, y `thread_item_keys`
> entera en `0003:269`. **La regla, entonces, no es comprobar lo que no lleva puntero: es
> comprobar lo que no lleva un puntero VERIFICABLE.** Un puntero se sigue; una declaración
> de haber comprobado, no (F-065).

**Día 8 de 15 · cerrado 12-ago-2026 · Estado: VERDE. Los dos bloques cerrados, la
rebanada E2EE funcionando extremo a extremo contra el Supabase real, y nada bloquea
al día 9**

> **Verificado en local, todo hoy:** `typecheck` limpio · **457 tests** de unidad (eran
> 373) · `check:palette` cobertura completa · `build` verde · suite de esquema **exit 0**
> con 15 asertos nuevos · **Playwright 47/47** contra el Supabase real, **ya
> descifrando**.

---

## Dónde estamos

`Plan §3`, filas del día 8: *"**Rebanada E2EE**: cifrado de campos de oferta en cliente"*
y *"**VND-01** (ofertas del vendedor, metadata-only por RNG-VND-01)"*. **Los dos
cerrados.**

| Bloque | Ejecuta | Resultado |
|---|---|---|
| E2EE · decisiones previas | Claude Code | **D-08-01 (a)**, **D-08-02 (los dos)** y **D-08-03 (se mantiene el día 2)**, las tres del PO |
| E2EE · migración | Claude Code | **0012**, aplicada al remoto. **Cero columnas nuevas** (F-065) |
| E2EE · primitivas | Claude Code | `lib/crypto.ts` — X25519 + AES-256-GCM. 18 asertos |
| E2EE · llavero | Claude Code | `lib/keys.ts` — en memoria, sin `localStorage`. 12 asertos |
| E2EE · la costura | Claude Code | `decryptItem` rellenada. **`ThreadHistory.tsx` sin tocar** |
| E2EE · envío (D-08-02) | Claude Code | `sendMessage` + el pie de MSG-02 envía cifrado |
| E2EE · siembra | Claude Code | `demo_threads.sql` **generado y cifrado de verdad**. Aplicado al remoto |
| VND-01 · capa de datos | Claude Code | `lib/sent-offers.ts`, entregada no declarada. 21 asertos |
| VND-01 · contrato | Claude Code | **27 asertos, en ROJO TOTAL** antes de lanzar. Ni uno verde (F-058) |
| VND-01 · corrida del arnés | Arnés | **Escalada 3/3.** $0,026346 · 7,9 min |
| VND-01 · revisión a mano | Claude Code | **`+39 / −4`** sobre 640 líneas. **Dos de los cuatro ficheros sin tocar** |
| VND-01 · cableado | Claude Code | `App.tsx`, ítem de nav `Vendiendo` |

---

## Lo que hay que saber de la rebanada E2EE

**El esquema del día 2 ya lo traía todo, y esa es la noticia.** `members.public_key`
(`0001:73`, X25519, 32 bytes por `0001:93`) y `public.thread_item_keys` entera
(`0003:269-286`, con `wrapped_cek`, `wrap_iv`, `ephemeral_pubkey` y sus dos políticas en
`0003:351` y `0003:356`). El comentario de `0003:265` decía para qué: *"Existe desde hoy
para que el día 8 no sea una migración de datos cifrados, que es la peor clase de
migración."* **Cumplió.**

**El único hueco real era una vía de lectura**, no una columna: `members_select_own_org`
(`0001:207`) deja ver a los de la propia organización y a nadie más, así que nadie podía
leer la pública de la contraparte para envolverle la CEK. Lo resuelve `0012` con
`public.thread_public_keys`, que **devuelve tres columnas y nunca la fila de `members`** —
que lleva `email` y los cuatro campos del respaldo de clave (ADR-001 §8, primer
invariante). Es función y no política porque **RLS no filtra por columna**.

**`create_thread_item` (0012) existe por un fallo que no se puede reparar.** El elemento
va en `thread_items` y las CEK en `thread_item_keys`, y `item_keys_insert_sender`
(`0003:356`) exige que el elemento ya exista — así que primero la fila y después las
claves. Si la segunda escritura no llega, queda **un elemento cifrado sin una sola clave
que lo abra**: nadie, ni su autor, puede descifrarlo para volver a cifrarlo, y en pantalla
se ve **igual que el caso normal de D-07-05**. Va en una transacción, y en
`security invoker` para no conceder ni un permiso.

**La costura de D-07-05 aguantó.** `decryptItem` pasó a `async` porque `crypto.subtle` lo
es, pero **`fetchThreadItems` ya era `async` el día 7** y devuelve lo mismo: un
`Promise.all` dentro y quien llama no distingue una costura vacía de una llena. **No se
tocó ningún `.tsx` de descifrado.** `ThreadComposer` sí cambió — pero eso es el **envío**,
que D-08-02 metió hoy y el día 7 no existía. Que quede claro para el día 9: **la regla de
"no se toca ningún `.tsx`" era sobre el descifrado, y se cumplió.**

**`null` sigue significando lo mismo**, en cuatro caminos que valen igual desde la
pantalla, y hay uno nuevo: **contenido que no cuadra con el tipo del elemento**. Los
metadatos van en claro y el contenido cifrado, así que nada obliga a que una fila marcada
`OFERTA` lleve dentro cifras de oferta; sin esa comprobación la tarjeta pintaría campos
vacíos como si fueran datos — el riesgo #1 de `CLAUDE.md` §7 por la puerta de atrás.

---

## La siembra de la demo ya se lee, y lo que eso cuesta

**D-08-01 (a).** Las claves de las dos cuentas de demo se derivan por HKDF de
`VITE_DEMO_KEY_SEED`, y `demo_threads.sql` **es ahora un fichero generado** con contenido
cifrado de verdad. En el remoto: ciphertext de **131 a 261 bytes** donde había 6, **seis
CEK envueltas** donde no había ninguna, y **los cinco estados intactos**.

- **El generador importa `app/src/lib/crypto.ts`**, no copia la criptografía. Si derivara
  por su cuenta, bastaría cambiar un `info` de HKDF en la app para que nada de lo sembrado
  volviera a abrirse, y el síntoma sería *"la demo sale opaca"* tres días después.
- **Y se niega a escribir el fichero si lo que acaba de cifrar no se abre con un par
  derivado DE NUEVO.** Descifrar con el mismo objeto que cifró no probaría lo que decide
  D-08-01: que la semilla vuelva a dar la misma clave **en otra sesión**.
- **El `update` final que devuelve el hilo de Anadolu a `CERRADO SIN ACUERDO` no es
  redundante.** El `insert` dispara `app.sync_thread_state`, y desde `0009` **un elemento
  nuevo reabre un hilo cerrado** (D-07-01, F-045): sin él, MSG-01 se queda sin su quinto
  estado.
- **Ausente la semilla, el código cae solo al camino real del MVP** —par aleatorio por
  sesión, que se pierde al recargar (`CLAUDE.md` §4)— **sin ninguna rama especial**.
- ⚠ **Quien tenga la semilla tiene todas las privadas de la demo.** No es ADR-001, no debe
  existir en V1, y está anotado como divergencia en **F-067**.

---

## Lo que el arnés midió hoy, y por qué el veredicto no vale

**Una corrida, tres intentos, $0,026346** ($0,033792 en frío). Las tres filas están en el
CSV. **Escalada 3/3 — cuarta pantalla seguida.**

**⚠ Y esta vez el veredicto no dice NADA del modelo, por dos mecanismos distintos y
medidos.** Lee la corrida por el **primer intento**, como avisaba `Dia-08`:

| | intento 1 | intento 2 | intento 3 |
|---|---|---|---|
| C1 (`tsc`) | rojo · **3 errores, todos el mismo** | rojo · idéntico | rojo · **error de SINTAXIS** |
| C2 (contrato) | rojo | rojo | rojo · no parsea |
| C3 (paleta) | **verde** | **verde** | **rojo** — `rgba()` nuevo |
| C4 | verde | verde | verde |

**El intento 3 salió PEOR que el 1, y se sabe por qué:**

1. **F-064** — el reintento no le enseña al Coder el código que escribió. Sigue sin
   arreglarse; el PO lo aplazó el 11-ago.
2. **F-068, NUEVO Y BARATO DE ARREGLAR** — **el arnés le manda los códigos de color de la
   terminal como texto**. El byte ESC se pierde y sobrevive el resto: **72 secuencias en el
   feedback del intento 1, 70 en el del 2**. En el intento 3 el modelo pegó dos dentro de
   un `import` y el fichero dejó de parsear. **B-009, prioridad máxima**, y se arregla con
   un `NO_COLOR=1` en origen.

**Y el defecto real del intento 1 —el único— también es mío en parte (F-069):** cinco
`TS2322` de `string | undefined` sobre accesos a un módulo CSS. **Ese patrón ya estaba
resuelto en la casa, con su comentario, en `ThreadList.tsx`** — y yo puse
`ResultsTable.tsx` como `style_reference`, que es la otra tabla y no tiene mapa de clases
por estado. Elegí por la semejanza visible, no por la técnica.

**El reparto entero, y es el dato incómodo del día: de cuatro defectos encontrados, UNO
era del modelo y TRES de mi contrato.** Un `not.toContain('precio')` sin ámbito sobre el
contenedor entero, cuando el subtítulo de la §3 dice *"precio"* **verbatim y
obligatoriamente**; una cuenta mal hecha del orden descendente por organización; y un
`getByText` sobre una referencia que sale dos veces en el fixture — **la forma exacta del
`findByText('NSK Europe Ltd')` del día 7**.

**Lo bueno, y es la cifra del objetivo 4: `+39 / −4` sobre 640 líneas, con DOS de los
cuatro ficheros sin tocar —`SentOffers.tsx` y su CSS, 268 líneas—. Y de las 38 líneas
añadidas, 30 son comentarios: el cambio funcional son cuatro líneas.**

---

## Hoy toca — Día 9 (planificado 13-ago-2026)

> ⚠ **EL DÍA 9 SE EJECUTÓ EL 12-AGO, NO EL 13: vamos un día por delante del plan.**
> El día 8 se cerró el 12-ago por la mañana y el 9 arrancó esa misma tarde. Se deja escrito
> porque el registro de hallazgos se usa como evidencia y sus fechas tienen que ser las del
> reloj, no las de la etiqueta del plan: `F-073` y `F-074` nacieron fechadas 13-ago y están
> corregidas a 12-ago. **Las etiquetas «día N» del `Plan §3` no se renumeran** — el desfase
> se anota aquí y el calendario se recalcula, si hace falta, al cierre.

`Plan §3`, filas del día 9 — **son tres bloques**, y es el segundo de los tres días de
decisiones irreversibles:

| Trabajo | Ejecuta |
|---|---|
| **Las 4 herramientas de VERA + Edge Function proxy** | Claude Code |
| **SRCH-01** — cableado VERA↔chips: lenguaje natural → filtros → tabla | Claude Code |
| **PANEL-01** | Arnés |

**Escribe `Dia-09_decisiones_vera.md` antes de empezar** (`CLAUDE.md`, ritual de cierre:
los días 4, 8 y 9 llevan fichero propio). Y dos cosas que condicionan ese día:

1. **La clave de VERA no llega al navegador jamás** (`CLAUDE.md` §4). Es Edge Function
   proxy, y es *"punto no negociable, no es un detalle de MVP"*.
2. **VERA responde exclusivamente desde el retorno de sus herramientas** (`CLAUDE.md` §7).
   El fallo grave no es el silencio: es afirmar con aplomo un dato falso delante del socio.

**Antes de lanzar el arnés con PANEL-01:**

1. **El `style_reference` es el fichero que ya resolvió EL PATRÓN, no una pantalla
   parecida** (F-069, nuevo hoy). Es lo que costó el único defecto real de VND-01.
2. **El contrato compila, se ejecuta contra esqueletos vacíos y su rojo es TOTAL**
   (F-047, F-058). Hoy salió 27/27 en rojo: se puede.
3. **Todo aserto negativo lleva ancla positiva y ámbito acotado** (F-059) — **y si es
   sobre un LITERAL, hay que haberlo visto fallar contra el caso en que ese literal SÍ
   aparece** (F-066, nuevo hoy).
4. **Todo literal que ve el usuario va verbatim en la tarea, con sus acentos** (F-048).
5. **Cuando el mock y la spec ofrecen dos caminos, la tarea elige uno explícitamente**
   (F-049). En VND-01 fueron tres.
6. **`check:palette` verde antes** (F-003).
7. **Commits separados** (`CLAUDE.md` §1.6). El diff del segundo *es* la medida.
8. **Un escalado no se canaliza NI SE LE PONE NADA DETRÁS** (F-060).
9. **La capa de datos se entrega, no se declara** (F-057).

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Tope de intentos | **3**, y el tercero escala al humano con código de salida 2. | `Dia-04_decisiones_arnes.md` §1 |
| **Formato de tarea** | Congelado el día 4. **Cuatro desviaciones: `component_api` (día 5), literales verbatim y estado accesible declarado (día 6), y el `style_reference` por patrón y no por parecido (día 8).** | `Dia-04` §5 · F-034 · F-047 · F-048 · **F-069** |
| **Contrato de aceptación** | Compila, se ejecuta contra esqueletos vacíos **y su rojo es TOTAL**. Todo aserto negativo lleva **ancla y ámbito**, y si es sobre un literal, ese literal tiene que poder aparecer. | F-047 · F-058 · F-059 · **F-066** |
| **Algoritmo E2EE** | **AES-256-GCM con IV de 12 bytes** (`0003`, `thread_items_iv_len_chk`) y **X25519 nativo** por WebCrypto, sin fallback a P-256 (F-008). El secreto X25519 **pasa por HKDF**, no se usa en crudo como clave AES. | `0003` · F-008 |
| **Dónde vive la clave** | **`members.public_key`** (0001:73) y **`thread_item_keys`** (0003:269), los dos del día 2. **Ninguna columna nueva.** La contraparte se lee por `public.thread_public_keys` (0012), tres columnas y nunca la fila de `members`. | **D-08-03** · **F-065** |
| **Escritura de un elemento** | **`create_thread_item` (0012), en UNA transacción.** Un elemento sin claves envueltas es ilegible para siempre y no se puede reparar. `security invoker`: no concede ni un permiso. | `0012` §5 |
| **Claves de sesión** | **En memoria, se pierden al recargar. Sin `localStorage`.** Lo cifrado antes de recargar deja de abrirse, y eso es correcto: la pantalla lo dice con `ENCRYPTED_NOTICE`. | `CLAUDE.md` §4 · D-07-05 |
| **Claves de demo** | **Deterministas desde `VITE_DEMO_KEY_SEED`.** Divergencia de ADR-001, registrada. Ausente la semilla, se cae al camino real sin rama especial. | **D-08-01 (a)** · **F-067** |
| **Envío de mensajes** | **Entra, cifrado** (D-08-02). Es lo único que hace observable en interfaz la reapertura del hilo de D-07-01. `SEND_DISABLED_REASON` retirado. | **D-08-02** |
| **Estados de oferta** | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. **Capitalizados, no en mayúsculas** — la §5.2 de VND-01 dice `PENDIENTE` y no manda. | `offer-card` · `0003:132` |
| **`EXPIRADA` en VND-01** | **No existe y no puede existir**: `valid_until` vive dentro del blob cifrado (`0003:121`) y RNG-VND-01 prohíbe descifrar aquí. Con ella se cae también `Renovar`. | `0003` · D-07-03 |
| **`RETIRADA`** | **No entra en el MVP.** VND-01 no pinta `Retirar oferta` **ni deshabilitado**: el estado no existe en la base, así que el botón no se pinta en absoluto. | **D-07-02** · F-043b |
| **VND-01 es metadata-only** | `fetchSentOffers` **no pide `content_ciphertext`**. La rebanada E2EE entró hoy, así que descifrar aquí es posible por primera vez — **y sigue prohibido**. | RNG-VND-01 |
| **Quién decide una oferta** | **El receptor, nunca el emisor.** Lo acota `app.guard_offer_decider`, en **invoker** (0010). | `offer-card` · F-051 · F-056 |
| **Cierre del hilo** | **Reversible: un elemento nuevo lo reabre.** Solo el `insert`. **MSG-02 mantiene el campo de mensaje visible en un hilo cerrado**, y desde hoy ese campo funciona. | **D-07-01** · `0009` · F-045 |
| **`Marcar acuerdo alcanzado`** | **Deshabilitado siempre, con el motivo a la vista.** | **D-07-04** · `0007:246` |
| **Realtime** | **El evento es una señal para releer, nunca datos.** `threads` y `thread_items` publicadas (0011); **la `REPLICA IDENTITY` no se toca**. | `0011` · F-061 |
| Test-runner | **Sin LLM.** C5 lo da el PO, fuera del grafo. | `Dia-04` §4 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan, **y tampoco los ve**. | `CLAUDE.md` §3 · Plan §6 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Demo | Referencia **`6205-2RS`** y **seis organizaciones**, solo dos con cuenta. | `guion-demo-y-siembra.md` §1 y §3 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. | `conversational-search` · F-040 |
| Alcance | 8 pantallas + LOGIN-01, que nadie planifico (F-016). **Hechas: shell, LOGIN-01, INV-01, MSG-01, SRCH-01, MSG-02, VND-01.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

> **⚠ ADENDA DE LA TARDE DEL 12-AGO.** Contestaste a `PENDIENTE-PO.md` entero y **los ocho
> puntos accionables están hechos**: `.env.example` al repo, el bucle del arnés arreglado y
> el experimento de F-064 corrido, la convención `[skip ci]`, el informe de Playwright como
> pediste (opción **a**, se queda), el reseteo de fixture del e2e con su test de envío,
> F-054 cerrado con la CLI como ruta oficial, y **LOGIN-01 construida**. El detalle está en
> el registro, en "Cierres del 12-ago (tarde)".

**Ver `openspec/mvp/PENDIENTE-PO.md`.** Lo que queda, por urgencia:

1. 🔴 **Dos órdenes tuyas, y las dos piden credenciales que no puedo tener.**
   - `npx supabase link --project-ref troxminloxkjwihwfevs` — pide la contraseña de la base.
     Después, `npx supabase db push --dry-run` **tiene que decir que no hay nada pendiente**.
     **Y ahora se sabe que eso es lo que dirá**: el registro del remoto está leído y son
     `0001`…`0012` más las dos filas históricas que se dejaron a propósito
     (`sp3_spike_messages_realtime`, `mvp_0011a_realtime_publication_portable`), que `db push`
     ignora por estar ya aplicadas. Si dijera otra cosa, párate y avísame. Falta solo el
     enlace: no hay `supabase/.temp`, así que la CLI aún no está enlazada.
   - ✅ **Los dos secrets: HECHO, y no los tuviste que poner tú (F-071 cerrado).**
     `DEMO_KEY_SEED` salió de `app/.env` y `SUPABASE_SERVICE_KEY` de tu entorno de usuario;
     ninguno de los dos valores pasó por pantalla ni por fichero. **CI verde: Playwright
     49/49**, desde `4 failed / 2 skipped / 43 passed`. Era la primera verde desde el 11-ago
     19:54: **la CI llevaba siete corridas en rojo** y el día 8 se cerró reportando
     *"Playwright 47/47"*, cierto en local y nunca contrastado contra CI.
2. 🟠 **Despliegue · decidido y preparado el 12-ago; falta que lo pulses tú.** El PO eligió
   **Vercel, con semilla de demo, la semilla solo en *Production*, URL sin indexar y muerte
   en V1**. El repo ya lleva las tres piezas del no-indexado (`app/vercel.json`,
   `<meta robots>` en `index.html`, `app/public/robots.txt`) y el runbook completo en
   **`openspec/mvp/despliegue.md`**.
   **Lo que queda son clics en tu cuenta**, y los cuatro valores por defecto de Vercel están
   mal en este repo: Root Directory **`app`**, rama de producción **`mvp/bootstrap`**, nombre
   del proyecto **`bearingworld`** (si no, la URL sale `rinworld-io.vercel.app` — el nombre
   que `CLAUDE.md` §2 prohíbe enseñar, y una URL sale en todas las capturas), y las tres
   `VITE_*`. Comprobado que el build sale limpio desde un clon nuevo con **solo** esas tres.
3. 🟠 **F-070, nuevo de esta tarde: los cuatro checks del arnés no ven el e2e.** LOGIN-01
   salió **4/4 verde** y colgaba la suite entera. Para V1 hay que decidir si C2 corre siempre
   el e2e completo o si la tarea está obligada a declarar los ficheros que la cubren.
4. ✅ **F-033 · cerrado el 12-ago.** Los checks tienen tercer estado
   (`verde`/`rojo`/`inejecutable`) con columna propia en el CSV, las 27 filas históricas
   están rellenadas —**7 tenían algún check ciego**— y **la métrica del objetivo 4 se ha
   movido** de «intentos hasta verde» a las dos que no dependen del bucle: líneas tocadas
   sobre líneas del artefacto, y ficheros sin tocar. Viven en
   **`openspec/mvp/harness-review.csv`**, derivadas de git. La tendencia se lee sola: de
   tocar **4 de 4** ficheros en MSG-01 a **0 de 4** en VND-01 con el bucle arreglado.
5. **¿Los cinco hilos sembrados son los de la demo del día 11?** Ahora llevan contenido
   legible, así que la pregunta pasa a ser **qué dicen**, no si se ven. Los textos están en
   `supabase/seed/demo-content.mjs` y se cambian en un sitio.
6. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
7. **F-027 (a)** · el recuento de no leídos de MSG-01, y **F-023 d** · qué hace INV-01 con
   una línea eliminada. Los dos de V1, los dos los dejaste pendientes.

---

## Riesgo con la vista más corta

> **⚠ ESTE PRIMER RIESGO SE CERRÓ LA MISMA TARDE, y se deja escrito con su antes y su
> después porque el contraste es el dato.** Lo de abajo se redactó al cerrar el día; unas
> horas más tarde el PO autorizó arreglar el bucle y correr el experimento. **Se corrió, y
> el arnés escalaba por su bucle, no por el modelo:** misma tarea, mismo contrato, mismo
> repo, único cambio el bucle → de **escalado 3/3** a **VERDE en 2**, más barato y con cero
> líneas de revisión a mano. **F-064 cerrado con dato.** Lo que sigue en pie: las cuatro
> corridas anteriores no valen como medida del modelo. Y hay un tercer mecanismo nuevo,
> **F-070**: los cuatro checks no ven el e2e, así que "verde 4/4" no es "verde".

**El primero era el arnés, y al cerrar el día el diagnóstico había empeorado, no mejorado.**
La noche anterior había **un** mecanismo que invalidaba las medidas (F-064: el reintento no
le enseña al Coder su propio código). Al cerrar había **dos**: el feedback le llegaba además
con los códigos de color como texto, y el intento 3 pegó dos dentro de un `import` (F-068).
**Para las cuatro corridas anteriores eso significa que cualquier lectura de un intento ≥2
está contaminada por los dos, no solo por uno.**

**La cara buena era real y se confirmó: el arreglo de F-068 era de una línea** —`NO_COLOR=1`
en origen— y **B-010** (guardar el contenido de cada intento, no solo las rutas) igual de
barato. Los tres se pusieron esa misma tarde, y el experimento costó **$0,0178**.

**El segundo es que tres de los cuatro defectos de hoy fueron míos, no del modelo**, y los
tres de la misma familia: asertos sin ámbito. Es la tercera vez (F-059, la revisión de
SRCH-01, hoy). **A partir del día 9 el contrato no está terminado hasta que cada aserto
negativo se haya visto fallar contra el caso positivo que le corresponde** — no basta con
comprobar que el conjunto está en rojo contra un esqueleto vacío.

> **⚠ ESTE TERCER RIESGO TAMBIÉN SE MOVIÓ ESA NOCHE, y por la misma vía que el primero:
> preguntando en vez de esperar al día 9.** El PO decidió el despliegue el 12-ago y el repo
> quedó preparado — punto 2 de los pendientes y `openspec/mvp/despliegue.md`. **Pero sigue
> sin haber URL viva hasta que él dé los clics**, que son en su cuenta y con sus
> credenciales. El riesgo baja de rojo a naranja; no desaparece. Lo de abajo se deja escrito
> tal como se redactó al cerrar el día 8.

**El tercero es de calendario, y es el más corto: quedan TRES días hasta la sesión de
prueba con el socio y la app sigue sin URL desplegada.** La decisión del 7-ago fue "solo
local" y decía retomarse antes del día 11. El día 9 tiene tres bloques y uno es de
decisiones irreversibles; el día 10 tiene dos. **Si el despliegue no entra el día 9, entra
el 10 o no entra.**

---

*Cerrado el 12-ago-2026 · Claude Code (Opus 5)*
