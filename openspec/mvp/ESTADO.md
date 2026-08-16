# ESTADO · MVP Bearingworld.io

**Aviso** El trabajo vive en C:/Users/admin/proyectos/Bearing.io/BearingWorld.io en mvp/bootstrap; si te lanzan en un worktree claude/…, opera sobre esa ruta con paths absolutos."

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.** Ahí está
> dónde viven las credenciales (`app/.env`), cuál es el proyecto, por qué el SQL va por el
> MCP y no por la CLI, y los nombres reales de las columnas.

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — el histórico vive en git, `findings-register.md` y
> `harness-metrics.csv`.
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.
>
> **Regla de F-095.** Un estado de la base que este fichero afirme se comprueba con SQL
> **en el momento de escribirlo**, y se dice cuándo. Hoy hay una forma corta de hacerlo:
> `select public.demo_state();` — devuelve catálogo, referencia y los cinco hilos.

**Día 13 de 15 · CERRADO, 16-ago-2026 · Estado: ÁMBAR · Riesgo #1: 🔴 ROJO.** Las dos filas
de `Plan §5` están hechas. Lo que cambia el color no es el trabajo del día: es lo que la
sesión de pruebas encontró.

> 🔴 **PRIMERO EL CALENDARIO, PORQUE EL RELEVO ANTERIOR LO TENÍA MAL.** El día 12 cerró el
> **14-ago** y el día 13 es el **16-ago**: se perdió el 15. `ESTADO.md` de ayer decía *"quedan
> 6 días naturales"* hasta la reunión del 20-ago. **Quedan 4.** Con el día 14 de congelación
> y el 15 de ensayo general, el margen real es el **19**.

---

## Lo que hay que saber antes de nada

🟢 **La base está en su estado congelado.** `npm run demo:reset` corrido al cerrar,
verificado a las **13:58:14 UTC**: 221 líneas · 159 frescas · 53 naranja · 9 rojas · 0 en el
futuro · `6205-2RS` 11/2/1 · **cinco hilos con cinco estados distintos**, Anadolu de vuelta en
`CERRADO SIN ACUERDO`.

🔴 **VERA no inventa datos. Hace otra cosa, y es lo que hay que arreglar mañana.** Cinco
sondeos contra la Edge Function **v4 desplegada** con sesión real de `alpha@`, más la sesión
completa del PO. **Ni una cifra falsa en todo el día** — se contrastaron fila a fila contra la
base, incluida una que parecía un error y no lo era (un `6305-2RS` de Roulements Rhône que
sale en **Bélgica** teniendo sede en Francia: `location_country` es dónde está el stock).

Lo que sí hace, tres veces y siempre igual: **le falta un dato o una regla, y rellena o
recorta sin decirlo.**

| | Qué hizo | Qué le faltaba |
|---|---|---|
| `F-101` | Refinas una búsqueda y te devuelve el catálogo entero | El turno anterior — es de un solo turno |
| `F-102` | Te manda a responder una consulta que enviaste tú | Quién envió el último elemento |
| `F-105` | Te oculta las dos filas de más stock del resultado | Una regla que prohíba filtrar en silencio |

**Esa es la buena noticia del día**, aunque no lo parezca: los tres se arreglan desde nuestro
lado —uno con una columna en un `select`, dos con frases en el prompt— y ninguno depende de
que Sonnet cambie de comportamiento.

---

## Dónde estamos

`Plan §5`, las dos filas del día 13 — **cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| **Sesión de pruebas 2, flujo completo** | Álvaro | Recorrido completo, contraoferta, dos pestañas y el interrogatorio. **Siete hallazgos: `F-099` a `F-105`** |
| ↳ *el guion, que no existía* | Claude Code (Opus 5) | `Plan §10` pedía *"15 preguntas preparadas"* desde el 5-ago y **no estaban escritas en ninguna parte del repo** (`F-097`). Escritas hoy en `guion-sesion-2.md`, con la verdad verificada por SQL contra la que se contrasta cada respuesta |
| **Entorno de demo con siembra congelada y reseteable** | Claude Code (Opus 5) | `npm run demo:reset` + teardown de Playwright + migración `0015`. **Aislamiento no — decisión del PO, `F-098`** |

**Verificado:** **631 tests de unidad** · `typecheck` · **53 e2e en verde** (los 52 más el
teardown nuevo) · `demo_state()` consultado **después** de la corrida, con Anadolu de vuelta en
`CERRADO SIN ACUERDO` tras haberlo reabierto la propia suite — que es la prueba de que el
teardown hace lo que dice.

🟢 **Las 8 pantallas de `Plan §9` siguen completas**, sin cambios de alcance hoy.

> **Sin fila en `harness-metrics.csv`, y es correcto por cuarto día.** Ese CSV mide **tareas
> del Coder** (`CLAUDE.md` §6): sus 31 filas son todas `deepseek-v4-flash`. Los días 10, 11, 12
> y 13 no tuvieron ninguna. Inventar una fila falsearía el objetivo 4.

---

## El entorno de demo reseteable · `F-096`

**El hallazgo que lo motiva se midió antes de tocar nada.** El hilo de Anadolu estaba en
`ABIERTO` con dos `MENSAJE` en vez de `CERRADO SIN ACUERDO` con uno. No lo rompió nadie: lo
dejó así `messages.spec.ts`, el test que comprueba que un elemento nuevo reabre un hilo cerrado
(`D-07-01`). **`F-095` describió que la suite repone al arrancar; lo que faltaba por ver es que
reponer al arrancar significa irse dejándola rota.** Consecuencia: MSG-01 con **cuatro estados
en vez de cinco**, que es la primera pantalla que ve el socio.

| Pieza | Qué es |
|---|---|
| `app/scripts/demo-reset.mjs` | Módulo **y** comando (`npm run demo:reset`). Repone la siembra congelada, re-ancla la frescura y **se verifica**: cinco hilos, cinco estados, un elemento cada uno, cero fechas futuras. Falla en voz alta |
| `app/e2e/restore.teardown.ts` | Colgado del proyecto `fixture` por `teardown:`. La suite repone **también al terminar** |
| `supabase/migrations/0015` | `public.demo_reanchor_freshness()` y `public.demo_state()`. En `public` porque PostgREST solo expone ese esquema, con `revoke` de `anon`/`authenticated` y `grant` solo a `service_role` |

Los tres llaman **al mismo código**, que es la mitad del asunto: `fixture.setup.ts`,
`restore.teardown.ts` y el comando no pueden divergir. `seed/reanchor_freshness.sql` pasa a ser
la llamada a la función, no una segunda copia del algoritmo.

**Lo que NO devuelve el reseteo:** `inventory_lines.status` (si archivas una línea desde INV-01
sigue archivada) y los hilos que no sean los cinco. Ese segundo caso **lo detecta y no se
calla**: `demo_state()` cuenta todos los hilos y el reseteo falla con *"hay 6 y tienen que ser
5"*.

---

## Los siete hallazgos de la sesión 2

Ordenados por lo que hay que hacer mañana, no por número.

| # | Qué | Arreglo | Coste |
|---|---|---|---|
| **`F-102`** | 🔴 **El más grave.** `listar_mis_hilos` no dice quién envió el último elemento y VERA rellena: *"tienes dos hilos que requieren tu atención"* incluyendo una `CONSULTA` que envió el propio usuario. **Reproducido en inglés y en español** | `sender_org_id` al `select` de `fetchLastItems` (`threads.ts:263`), un campo en `LastItem` (`threads.ts:38`), y que la fila diga *"lo enviaste tú"* / *"lo envió X"*. Más el aserto negativo | app · pequeño |
| **`F-104`** | VERA responde en markdown y el panel lo pinta en crudo — asteriscos y tablas como tira de pipes. `VeraPanel.tsx:221` es `{m.text}` y `.bwbub` no lleva `pre-wrap`. **Nunca se especificó el formato**: ni la spec de `vera-agent` ni el sistema de diseño dicen nada | `white-space: pre-wrap` **y** una frase en el prompt: nada de markdown. Los dos, no uno — el CSS es la red por si el modelo desobedece | CSS + prompt |
| **`F-105`** | Ve 13 filas, enseña 8 y descarta 5 bajo criterio propio no declarado — entre ellas **las dos de más stock** (`6208-2RS`, 2.680 u y 2.140 u). Y se contradice: escribe *"40 mm → 6208"* y no pone ni una fila de 6208 | Frase en el bloque estático: *"si enseñas menos filas de las que recibes, dilo y di con qué criterio"*. Es el reverso de F-075 y falta desde el principio | prompt |
| **`F-101`** | VERA es de **un solo turno** (`vera.ts:62`): un refinamiento se ejecuta como búsqueda nueva. Y `criteriaFromInput` reemplaza los criterios enteros — son dos capas. **La spec lo pide**: `conversational-search/spec.md:36` | Mitigación: que una frase que parezca continuación se pregunte, no se busque. El arreglo de verdad (historial + fusión de criterios) es V1 | prompt |
| **`F-100`** | `Consultar` y `Contactar` de fila en SRCH-01 están **habilitados y son funciones vacías**. Y como el masivo exige ≥2 filas y su comentario remite al de fila, **consultar UNA línea no se puede por ningún camino** | `disabled` + `title` con el motivo, como el de watchers (`F-023 e`). **Y decidir si el masivo baja a ≥1** | app · pequeño |
| **`F-103`** | VERA contesta en el idioma de quien pregunta contra su propio prompt, y **traduce los valores de enum del estado**: diría *"Agreement reached"* junto a una pantalla que dice `ACUERDO ALCANZADO` | **El idioma ya no es problema** (ver más abajo). Lo que sí hay que forzar: *"los estados del hilo se citan en español y tal cual, aunque respondas en otro idioma"* | prompt |
| **`F-099`** | **No existe forma de originar una oferta.** Solo `counter_offer`, que exige una previa. Las dos `OFERTA` de la demo las puso la siembra. `messaging-and-negotiation/spec.md:134` lo pide | **No se construye.** Decidido por el PO. Guion adaptado: Alpha contraoferta, Beta acepta | ninguno |

**Los cuatro de prompt van en un solo redespliegue (v5)** y se verifican con la misma sonda que
se usó hoy: sesión de `alpha@`, `POST` a `/functions/v1/vera`, comparar contra SQL. Ninguno
toca base, ni migración, ni máquina de estados.

---

## Lo que salió y no estaba en el guion: el socio no lee español

⚠ **Descubierto al final de la sesión, y es lo más grande del día en consecuencias.** Toda la
interfaz está en español y **el socio de la reunión del 20-ago no lo entiende**.

**Medido antes de opinar:** no hay ninguna infraestructura de i18n, 20 componentes `.tsx`, y
—esto es lo que pesa— **536 asertos de texto en los tests** (388 unitarios + 148 e2e).
Traducir cadenas es mecánico; reescribir medio arnés de pruebas el día de la congelación no.

> 🟢 **Decisión del PO, 16-ago: no entra en el MVP. Se hace después, como un fork.**
> Literal: *"vamos a terminar este MVP y… le metemos mano en 2 días ya como un FORK al
> proyecto para no joder más la marrana"*. **No lo replantees desde cero en la próxima
> sesión: está decidido y el motivo está medido.**

**Y hay media solución gratis:** VERA en inglés **ya funciona**. Preguntada
*"HOWMANY INVENTORY LINES I HAVE PUBLISHED?"* responde *"You have 14 published inventory
lines, spanning brands like SKF, FAG, NTN, NSK, Koyo, and Timken"* — **14 es correcto y las
seis marcas son exactamente las que tiene Alpha**. Eso convierte `F-103` de fallo en función:
lo único que hay que impedir es que traduzca los estados.

---

## Bloqueos y riesgo más cercano

**Nada bloquea el día 14.** Siguen los dos frenos de siempre y el riesgo cambia de color.

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 **Freno 1** | **La CLI de Supabase sigue en la cuenta equivocada (`F-073`).** Cada migración y cada despliegue de función va por el MCP. Hoy se aplicó `0015` así, sin problema | Álvaro: re-loguear y `supabase link` |
| 🟡 **Freno 2** | **Nada despliega solo** (`F-072`, `F-091`). Hoy no hizo falta: no se tocó código de la app ni la Edge Function. **Mañana sí**, y hay que redesplegar las dos cosas | Se cumple cerrando con el despliegue hecho |

### 🔴 El riesgo #1 pasa a ROJO, por el umbral que este fichero fijó

El día 12 quedó escrito: *"lo que lo haría rojo: que la sesión 2 encuentre **dos o tres más de
la misma familia**, porque entonces no es un caso suelto sino que el reparto de herramientas
sobregeneraliza"*. La familia es **actuar sobre una lectura equivocada sin decirlo**. Han
salido **dos** —`F-101` y `F-102`— más `F-105`, que es la misma raíz por el otro lado.

**Pero el diagnóstico es mejor que el pronóstico.** No es que el reparto de herramientas
sobregeneralice: es que **tres herramientas devuelven menos de lo que la pregunta necesita**, y
el modelo tapa el hueco. Eso es `F-075` otra vez —*"un recuento sin contenido es un hueco, y
este modelo rellena huecos con fluidez"*— y `F-075` se arregló cambiando la herramienta, no
rogándole al modelo.

**Por qué no es catastrófico:** ni una cifra inventada en todo el día, con datos contrastados
contra la base. La defensa del `CLAUDE.md` §7 —responder solo desde el retorno de las
herramientas— **aguanta**. Lo que falla es lo que las herramientas no dicen.

**Lo que lo devolvería a ámbar:** `F-102` arreglado y verificado contra Sonnet, y las tres
frases del prompt desplegadas en v5 y comprobadas. Es el trabajo de mañana por la mañana.

**Lo que lo empeoraría:** que al arreglar `F-102` aparezca la misma forma en
`consultar_mi_inventario` o en `buscar_en_catalogo`. Por eso el día 14 incluye pasarles a las
cuatro herramientas la misma pregunta: *¿qué pregunta razonable no puede contestarse con lo que
devuelvo, y qué va a inventar el modelo para taparlo?*

---

## Decisiones pendientes del PO, y bloquean el trabajo de mañana

1. **`F-104` · formato de VERA.** Nunca se especificó. Recomendación registrada: **texto
   plano**, no renderizar markdown. Motivo: el panel ocupa un tercio del ancho y colapsa a 32px
   (`design-system.md:190`), una tabla de seis columnas no cabe — y **la tabla ya existe en
   SRCH-01**, que VERA rellena ella misma con `setCriteria`. Su papel es narrar, no tabular.
2. **`F-100` · ¿el botón masivo baja a `≥1`?** Si se apagan los de fila, una selección de una
   sola fila se queda sin ninguna acción posible. El `≥2` de `F-039` se sostenía delegando en un
   botón que no existe.
3. **`F-103` · ¿se fuerza español o se acepta el idioma del interlocutor?** Con el socio en
   inglés, lo segundo parece lo obvio — pero decídelo, porque cambia la frase del prompt.
4. **`B3` · ¿VERA contesta conocimiento técnico general?** Contestó *2RS vs ZZ* impecablemente
   y sin llamar a ninguna herramienta. Recomendación: **permitirlo con la costura visible** —
   *"por lo general…", "confírmalo con tu ficha"*— porque en la pregunta mixta mezcló una tabla
   de filas reales con dos afirmaciones de entrenamiento (*"eje 25 mm"*) sin distinguirlas.

---

## Una limitación honesta de la sesión de hoy

**No hay hoja de registro pregunta por pregunta.** El guion (`guion-sesion-2.md` §8) pedía
anotar herramienta, veredicto y nota para cada una de las quince; lo que existe es lo que fue
saliendo, capturado en `F-099`…`F-105` según aparecía. El PO cerró con *"casi éxito total"*.

**Por qué importa para el día 15:** `guion-sesion-2.md` §4 dice que las preguntas se reutilizan
**con el literal exacto** en la sesión 3, o los resultados dejan de ser comparables. Sin la hoja
de la sesión 2, la del día 15 será la primera medición completa en vez de la segunda. **No es
un problema hoy; es un dato para no sacar conclusiones de tendencia el día 15.**

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| **i18n** | **Fuera del MVP. Fork después, ~2 días.** No hay infraestructura y hay 536 asertos de texto en los tests | **PO, 16-ago** |
| **Reseteo de la demo** | `npm run demo:reset` desde `app/`. Antes de cada ensayo, el 20-ago por la mañana, y al cerrar el día. **No correr la suite e2e durante un ensayo** | **F-096** · `guion-sesion-2.md` §0 |
| **Aislamiento de la demo** | **No se hace.** Demo y pruebas comparten base; el reseteo delante y detrás lo hace sobrevivible | **F-098** |
| **Originar una oferta** | **No existe y no se construye.** Solo contraoferta. Si el socio pregunta cómo responde el vendedor: es V1 | **F-099** |
| **Un hilo es por PAREJA DE ORGANIZACIONES** | No por rodamiento. `create_inquiry` es encontrar-o-crear con `on conflict (org_low_id, org_high_id)`. Por eso una consulta de SKF cae en el mismo hilo que una oferta de NSK, y **ninguna pantalla lo dice en voz alta** | `0014:167` |
| Frescura del catálogo | Se **re-ancla**, no se re-siembra. Delta constante; conserva la distribución | **F-094** |
| El estado de demo es efímero | La suite repone los cinco `HILO_IDS`. **Desde hoy, también al terminar** | **F-095** · **F-096** |
| VERA y el contenido de un hilo | Preguntar por lo ofrecido **no es una búsqueda**. Confirmado contra Sonnet el 14-ago y **no ha reaparecido hoy** | **F-090** · D-09-02 |
| Contraoferta | **Fila `OFERTA` nueva**, la anterior a `Superada por contraoferta`. `part_number`/`brand` **se heredan en la base** (`0013:112`) | **0013** |
| Quién decide una oferta | **El receptor, nunca el emisor** (`offers.ts:101`, `app.guard_offer_decider`) | F-051 · F-056 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, E2EE y herramientas de VERA. **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
| Coder | `deepseek-v4-flash` vía `DEEPSEEK_API_KEY` | F-001 |
| Dónde corren las herramientas | **En el navegador, no en el proxy.** El proxy solo guarda la clave | **D-09-05** |
| Tope de filas al modelo | **25**, y al recortar **prohíbe** hablar de lo que no ve. **No cubre descartar lo que sí ve** (`F-105`) | **F-075** |
| Dónde cae el scroll | `.bwcnt` acota el alto; la raíz de la pantalla scrollea | **F-088** · F-093 |
| Claves de sesión | **En memoria, se pierden al recargar. Sin `localStorage`** | `CLAUDE.md` §4 |
| Estados de oferta | `Pendiente` · `Aceptada` · `Rechazada` · `Superada por contraoferta`. **Capitalizados** | `0003:132` |
| Cierre del hilo | **Reversible: un elemento nuevo lo reabre** | **D-07-01** · `0009` |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit** | `CLAUDE.md` §1.6 |
| Alcance | **Las 8 pantallas de `Plan §9` completas** | Plan §9 |

---

## Pendiente de Álvaro

1. **Las cuatro decisiones de la sección de arriba.** Bloquean el redespliegue v5 de mañana.
2. **`npx supabase link --project-ref troxminloxkjwihwfevs`** — sigue `F-073`: la CLI está en la
   cuenta de `web-julsaindustrial`. Por eso las migraciones van por el MCP.
3. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
4. **F-027 (a)** (no leídos de MSG-01) y **F-023 d** (línea eliminada en INV-01). De V1.
5. ⚠ **Sigue sin saberse qué clave dijiste que estaba rotada** (F-081, 13-ago). No es la del
   Coder — comprobado. Si sigue habiendo alguna, hace falta el nombre.
6. **Comprobaciones 3 y 4 de `despliegue.md` §4** sin repetir desde el 13-ago.

---

## Ritual de cierre — qué se ha hecho hoy

`CLAUDE.md` §ritual, los cuatro puntos:

1. ✅ **Este fichero, sobrescrito**: día, estado, qué se cerró, qué toca mañana, decisiones
   vivas, bloqueos y riesgo más cercano. Estado de la base **verificado con SQL al escribirlo**.
2. ✅ **Hallazgos a `findings-register.md`**: `F-096` a `F-105`, diez nuevos.
   **`harness-metrics.csv` sin fila** — no hubo tarea del Coder, cuarto día seguido.
3. — **Sin fichero de decisiones del día**: solo lo llevan los días 4, 8 y 9.
4. ✅ **Commit + push** a `mvp/bootstrap`. **Sin despliegue hoy y no hace falta**: no se tocó
   código de la app ni la Edge Function; la migración `0015` se aplicó por el MCP y está viva.

---

*Actualizado el 16-ago-2026, cerrando el día 13 · estado de la base verificado con
`select public.demo_state()` a las 13:58:14 UTC, después de correr `npm run demo:reset` ·
sondeos de VERA contra la Edge Function v4 desplegada con sesión real · Claude Code (Opus 5)*
