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

> ⚠ **El aviso de la línea 3 se gana su sitio: NO lo borres al sobrescribir este fichero.**
> Hoy la sesión arrancó otra vez en un worktree sacado de `main`, ocho commits por detrás y
> **sin `app/`, sin `supabase/` y sin `CLAUDE.md`** (`F-108`). Esa línea es lo único que
> convirtió un arranque roto en un rodeo de dos minutos.

**Día 14 de 15 · CERRADO, 17-ago-2026 · Estado: ÁMBAR · Riesgo #1: 🟠 vuelve a ÁMBAR.**
El día 13 fijó el umbral por escrito —*"lo que lo devolvería a ámbar: `F-102` arreglado y
verificado contra Sonnet, y las frases del prompt desplegadas en v5 y comprobadas"*—. **Las
dos cosas están hechas y medidas contra el modelo desplegado**, no solo contra el código.

**Quedan 3 días naturales** hasta la reunión del 20-ago. Mañana es el día 15: ensayo general.

---

## Lo que hay que saber antes de nada

🟢 **La base está en su estado congelado.** `npm run demo:reset` corrido al cerrar, verificado
a las **15:00:02 UTC**: 221 líneas · 159 frescas · 53 naranja · 9 rojas · 0 en el futuro ·
`6205-2RS` 11/2/1 · **cinco hilos con cinco estados distintos**, Anadolu en `CERRADO SIN
ACUERDO`. Corrido **después** de la suite e2e, así que es el estado con el que amanece el 15.

🟢 **Los dos despliegues están hechos y comprobados en la URL viva** — que es la condición que
`F-072` y `F-091` llevan imponiendo desde el día 11, y hoy sí se tocaron las dos cosas:

| Qué | Cómo se comprobó |
|---|---|
| **Edge Function `vera` v5** | Desplegada por el MCP (`version: 5`, `ACTIVE`). Verificada con **una sonda real contra Sonnet**: sesión de `alpha@`, `POST` a `/functions/v1/vera`, **7 de 7**, y cada respuesta contrastada fila a fila contra SQL |
| **App en Vercel** | `npx vercel --prod` desde `app/`. `bearingworld.vercel.app` sirve **el bundle que se acaba de construir** (`index-BSSPeP7F.js`), la cabecera `X-Robots-Tag: noindex, nofollow, noarchive` sigue puesta, y el CSS desplegado lleva `white-space:pre-wrap;overflow-wrap:anywhere` |

🟢 **VERA ya no afirma lo contrario de lo que dice la base.** El fallo del día 13, palabra por
palabra, era: *"tienes dos hilos que requieren tu atención… Cuscinetti Padana — consulta
pendiente"*, cuando esa consulta la había enviado el propio usuario. Hoy, misma pregunta:

> *"Tienes **una** negociación donde te toca responder: Nordwälz Lager · Alemania · CON OFERTA
> PENDIENTE · te han enviado una oferta sobre 6205-2RS. El resto no requiere acción tuya ahora
> mismo: en Cuscinetti Padana **fuiste tú** quien envió la última consulta, y en Łożyska Wschód
> **tú** enviaste el último mensaje, así que en ambos estás esperando respuesta."*

**Coincide con SQL en los cinco hilos.** Y en inglés también, que es donde se reprodujo.

---

## Dónde estamos

`Plan §5`, día 14 — *"correcciones finales y congelación de código"*:

| Bloque | Resultado |
|---|---|
| **`F-102`** · el más grave | **Cerrado.** `sender_org_id` al `select`, `isOwn` en `LastItem`, dirección en cada fila y el aviso de que el estado no dice de quién es el turno. Verificado contra Sonnet |
| **`F-104`** · markdown en crudo | **Cerrado, las dos piezas** — `pre-wrap` en el CSS y la prohibición en el prompt |
| **`F-105`** · descartar filas en silencio | **Cerrado con reserva.** La regla está desplegada; **no se ha podido provocar el recorte** (ver abajo) |
| **`F-101`** · refinamiento sin contexto | **Mitigado.** Ahora repregunta en vez de buscar. **El arreglo de verdad sigue siendo de V1** |
| **`F-100`** · los dos botones muertos | **Cerrado.** `disabled` + motivo, y el masivo baja a **≥1** |
| **`F-103`** · idioma y estados | **Cerrado.** Idioma del interlocutor, estados en español y tal cual |
| **`B3`** · conocimiento técnico general | **Decidido y desplegado.** Permitido con la costura visible |
| ↳ **la pregunta de `F-102` a las otras tres herramientas** | **`F-106`: cuatro huecos más, arreglados el mismo día** |

**Verificado:** **642 tests de unidad** (los 631 más 11 nuevos) · `typecheck` · **53 e2e en
verde** · **7/7 de la sonda contra el modelo desplegado** · `demo_state()` después de todo.

🟢 **Las 8 pantallas de `Plan §9` siguen completas.** Sin cambios de alcance hoy.

> **Sin fila en `harness-metrics.csv`, y es correcto por quinto día.** Ese CSV mide **tareas
> del Coder** (`CLAUDE.md` §6): sus 31 filas son todas `deepseek-v4-flash`. Del día 10 al 14 no
> ha habido ninguna. Inventar una fila falsearía el objetivo 4.

---

## Lo que sale de aplicarle a las otras tres herramientas la pregunta de `F-102` · `F-106`

La pregunta era: *¿qué pregunta razonable no puede contestarse con lo que devuelvo, y qué va a
inventar el modelo para taparlo?* **Salieron cuatro huecos, y lo revelador es que ninguno era
un dato que faltara en la base: los cuatro ya se pedían, ya se pintaban en pantalla y se
tiraban antes de llegar al modelo.**

| Herramienta | Qué no podía contestarse | Arreglo |
|---|---|---|
| `buscar_en_catalogo` | *"¿ese stock está actualizado?"* — `lastUploadAt` venía en la fila y no llegaba | `actualizada hace N días, al día/desactualizada/muy desactualizada`. **Con el nivel, no solo los días:** los umbrales (>7, >30) son del proyecto, y sin ellos el modelo se inventa uno |
| `buscar_en_catalogo` | *"¿a cuáles ya les he preguntado?"* — `consulted` igual | `YA CONSULTADA por tu organización`, **más la leyenda de qué significa que una fila no la lleve** |
| `consultar_mi_inventario` | *"¿14 líneas de qué?"* — el recuento no decía de qué filtro era | Declara el filtro antes del recuento |
| `buscar_en_catalogo` | Que **cambia la pantalla** al usuario (`App.tsx:157`) y no lo decía | Lo dice en el retorno |

**`navegar` es la única sin hueco:** devuelve una confirmación y su error ya enumera lo que
existe.

**Y funciona:** VERA dijo por su cuenta *"todas están al día salvo una, la 22210 de NSK (55 u),
que lleva 8 días sin actualizar"* — y en la base esa es **exactamente** la única línea publicada
de Alpha por encima de 7 días, con esa marca, esa cantidad y esos 8 días.

> **La lección, y es `F-075` una vuelta más arriba:** el riesgo no es solo lo que la
> herramienta calla, es **lo que ya sabe y no propaga**. Un dato que existe y no llega es peor
> que uno que no existe, porque el modelo no puede saber que le falta.

---

## Dos cosas que hay que leer antes de sacar conclusiones

### 🟠 `F-105` está desplegado y NO se ha podido ejercitar

La regla *"si enseñas menos filas de las que recibes, dilo y di con qué criterio"* está viva en
el prompt v5. Pero **la pregunta del hallazgo ya no llega a recortar nada**: al avisar en
`tools.json` de que `2RS` es un sufijo y no una referencia, el modelo dejó de buscar por él y
ahora pide el diámetro del eje. Forzándolo con `6205-2RS` + *"dame las mejores opciones para
500 unidades"*, la herramienta devolvió 8 filas y **VERA enseñó las 8**, exactas contra SQL.

**No hay recorte que declarar, así que la regla no se ha visto actuar.** Está verificada como
texto desplegado, no como comportamiento observado. **Para mañana:** una pregunta del guion que
fuerce de verdad el descarte.

### 🟠 El test que pasa por el motivo equivocado · `F-107`

Escribiendo la sonda, **dos versiones seguidas del aserto de `F-105` pasaron en verde sin
comprobar nada**: la primera casó con *"criterio general"* —que es la costura de `B3`, otra
regla— y la segunda exigía un `12` y casó con *"Anadolu Rulman · FAG · 830 u · Turquía · **12**
días"*, un plazo de entrega.

Es el fallo que `F-105` describe en el modelo, cometido en el test. Corregido sustituyendo la
búsqueda de palabras por un invariante medido: **total declarado vs. filas pintadas**.

> **Regla para el día 15:** un aserto sobre una respuesta de modelo que pueda satisfacerse con
> un número que significa otra cosa no es un aserto, es una coincidencia. Se comprueban
> relaciones entre magnitudes, no presencias de cadenas.

---

## La sonda, que ahora es un fichero y no una sesión a mano

**`app/src/lib/vera.probe.test.ts`**, apagada por defecto:

```bash
VERA_PROBE=1 npx vitest run src/lib/vera.probe.test.ts
```

Habla con la **función desplegada** y la **base real** con sesión de `alpha@`, e **imprime cada
respuesta** para contrastarla contra SQL. Usa `ask()` y `runTool()` **de producción**: las
herramientas de VERA corren en el cliente (`D-09-05`), así que una sonda que hablara solo con la
función recibiría `tool_use` y nunca una respuesta final.

**Por qué existe:** es el procedimiento con el que se verificó `F-090` y con el que se encontró
`F-102`, y las dos veces se hizo a mano sin dejar rastro ejecutable. `F-097` ya cobró ese peaje:
*"una instrucción que no se ha ejecutado nunca es una hipótesis, no un procedimiento"*.

**No comprueba que la respuesta sea VERDAD.** Eso lo hace quien la corre, leyendo lo que imprime
y contrastándolo con SQL. Los asertos solo fijan las reglas de v5.

---

## Bloqueos y riesgo más cercano

**Nada bloquea el día 15.** Siguen los dos frenos de siempre.

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 **Freno 1** | **La CLI de Supabase sigue en la cuenta equivocada (`F-073`).** El despliegue de la función v5 fue por el MCP, sin problema | Álvaro: re-loguear y `supabase link` |
| 🟡 **Freno 2** | **Nada despliega solo** (`F-072`, `F-091`). Hoy se han hecho los dos y están comprobados en la URL viva. **Si mañana se toca código, hay que repetirlos** | Se cumple cerrando con el despliegue hecho |

### 🟠 El riesgo #1 vuelve a ÁMBAR, y por qué no a verde

**Lo que lo baja:** el caso que lo puso rojo —`F-102`— está arreglado y **verificado contra el
modelo**, no contra el código; las cinco reglas de v5 están desplegadas y medidas; y `F-106`
atacó la causa raíz de la familia entera (herramientas que devuelven menos de lo que la pregunta
necesita) en vez de rogarle al modelo.

**Lo que impide el verde, y son tres cosas concretas:**

1. **`F-101` está mitigado, no arreglado.** VERA sigue siendo de un solo turno. Hoy repregunta
   en vez de mentir, que es todo lo que se pedía para el 20 — pero el refinamiento sigue sin
   existir, y es lo primero que hace cualquier comprador.
2. **`F-105` no se ha visto actuar** (arriba).
3. **Una sola pasada de sonda no es una medición.** Son 7 preguntas contra un modelo no
   determinista. Mañana hay que repetirlas con el guion completo.

**Lo que lo empeoraría:** tocar código mañana sin repetir los dos despliegues.

---

## Decisiones del PO tomadas hoy

| # | Decisión | Consecuencia |
|---|---|---|
| **`F-104`** | **Texto plano, no se renderiza markdown** | CSS + prompt. El renderizador de markdown queda anotado para V1 |
| **`F-100`** | **El masivo baja a `≥1`** | **Revierte `F-039`** y se actualiza `conversational-search/spec.md`, para que la capability no contradiga al código |
| **`F-103`** | **VERA sigue el idioma del interlocutor** | Es lo único de la aplicación que puede hablarle en inglés al socio. Los estados **no se traducen** |
| **`B3`** | **Conocimiento técnico general permitido, con la costura visible** | *"por lo general…", "confírmalo con la ficha"*, y **nunca mezclado sin costura** con filas de una herramienta |

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| **i18n** | **Fuera del MVP. Fork después, ~2 días.** No hay infraestructura y hay **536 asertos de texto** en los tests. **No lo replantees: está decidido y el motivo está medido** | **PO, 16-ago** |
| **Reseteo de la demo** | `npm run demo:reset` desde `app/`. Antes de cada ensayo, el 20-ago por la mañana, y al cerrar. **No correr la suite e2e durante un ensayo** | **F-096** · `guion-sesion-2.md` §0 |
| **La sonda de VERA** | `VERA_PROBE=1 npx vitest run src/lib/vera.probe.test.ts`. **Apagada en `npm test`** — toca red, base y cuota | **F-107** |
| **Aislamiento de la demo** | **No se hace.** Demo y pruebas comparten base; el reseteo delante y detrás lo hace sobrevivible | **F-098** |
| **Originar una oferta** | **No existe y no se construye.** Solo contraoferta. Si el socio pregunta cómo responde el vendedor: es V1 | **F-099** |
| **Acciones de fila en SRCH-01** | **Apagadas con el motivo dicho.** El wiring (`FL-MSG-01`) es de V1 | **F-100** · F-023 e |
| **Un hilo es por PAREJA DE ORGANIZACIONES** | No por rodamiento. `create_inquiry` es encontrar-o-crear con `on conflict (org_low_id, org_high_id)`. **Ninguna pantalla lo dice en voz alta** | `0014:167` |
| Frescura del catálogo | Se **re-ancla**, no se re-siembra. Delta constante; conserva la distribución. **Desde hoy, VERA la ve** | **F-094** · **F-106** |
| El estado de demo es efímero | La suite repone los cinco `HILO_IDS` al empezar **y al terminar** | **F-095** · **F-096** |
| VERA y el contenido de un hilo | Preguntar por lo ofrecido **no es una búsqueda**. No ha reaparecido | **F-090** · D-09-02 |
| Contraoferta | **Fila `OFERTA` nueva**, la anterior a `Superada por contraoferta`. `part_number`/`brand` **se heredan en la base** (`0013:112`) | **0013** |
| Quién decide una oferta | **El receptor, nunca el emisor** (`offers.ts:101`, `app.guard_offer_decider`) | F-051 · F-056 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, E2EE y herramientas de VERA. **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
| Coder | `deepseek-v4-flash` vía `DEEPSEEK_API_KEY` | F-001 |
| Dónde corren las herramientas | **En el navegador, no en el proxy.** El proxy solo guarda la clave | **D-09-05** |
| Tope de filas al modelo | **25**, y al recortar **prohíbe** hablar de lo que no ve. **Y desde v5, descartar lo que sí ve obliga a declararlo** | **F-075** · **F-105** |
| Dónde cae el scroll | `.bwcnt` acota el alto; la raíz de la pantalla scrollea | **F-088** · F-093 |
| Claves de sesión | **En memoria, se pierden al recargar. Sin `localStorage`** | `CLAUDE.md` §4 |
| Estados de oferta | `Pendiente` · `Aceptada` · `Rechazada` · `Superada por contraoferta`. **Capitalizados, y VERA no los traduce** | `0003:132` · **F-103** |
| Cierre del hilo | **Reversible: un elemento nuevo lo reabre** | **D-07-01** · `0009` |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit** | `CLAUDE.md` §1.6 |
| Alcance | **Las 8 pantallas de `Plan §9` completas** | Plan §9 |

---

## Qué toca mañana · día 15, ensayo general

1. **`npm run demo:reset` antes de empezar**, y **no correr la suite e2e mientras dure el
   ensayo** (`F-098`: es un ruego, no una barrera — una corrida concurrente se lleva la demo
   por delante).
2. **Las 15 preguntas de `guion-sesion-2.md`, con el literal exacto** y **anotando pregunta por
   pregunta**. La sesión 2 no dejó hoja de registro, así que **la de mañana es la primera
   medición completa, no la segunda**: no saques conclusiones de tendencia.
3. **Añadir al guion una pregunta que fuerce el recorte de verdad** (`F-105`).
4. **Si se toca código: redesplegar app Y función, y comprobarlo en la URL viva.**
5. **La sonda antes y después**, que ahora es un comando.

---

## Pendiente de Álvaro

1. **`npx supabase link --project-ref troxminloxkjwihwfevs`** — sigue `F-073`: la CLI está en la
   cuenta de `web-julsaindustrial`. Por eso todo va por el MCP.
2. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
3. **F-027 (a)** (no leídos de MSG-01) y **F-023 d** (línea eliminada en INV-01). De V1.
4. ⚠ **Sigue sin saberse qué clave dijiste que estaba rotada** (F-081, 13-ago). No es la del
   Coder — comprobado. Si sigue habiendo alguna, hace falta el nombre.
5. **Comprobaciones 2 y 3 de `despliegue.md` §4** —hilo cifrado legible, y las dos
   organizaciones sin verse— **sin repetir desde el 13-ago**. La 1 y la 4 se han hecho hoy.
6. **`@tabler/icons-webfont@latest` sigue sin fijar** (`despliegue.md` §7.1): la versión puede
   cambiar sola entre hoy y el día 20 y romper el shell sin que nadie toque nada.

---

## Ritual de cierre — qué se ha hecho hoy

`CLAUDE.md` §ritual, los cuatro puntos:

1. ✅ **Este fichero, sobrescrito**: día, estado, qué se cerró, qué toca mañana, decisiones
   vivas, bloqueos y riesgo más cercano. Estado de la base **verificado con SQL al escribirlo**.
2. ✅ **Hallazgos a `findings-register.md`**: `F-100` a `F-105` cerrados o mitigados con su
   verificación, y **tres nuevos — `F-106`, `F-107`, `F-108`**. **`harness-metrics.csv` sin
   fila** — no hubo tarea del Coder, quinto día seguido.
3. — **Sin fichero de decisiones del día**: solo lo llevan los días 4, 8 y 9. Las cuatro del PO
   quedan en la tabla de arriba.
4. ✅ **Commit + push** a `mvp/bootstrap`, **y los dos despliegues hechos y comprobados en la
   URL viva** — app y Edge Function v5.

---

*Actualizado el 17-ago-2026, cerrando el día 14 · estado de la base verificado con
`npm run demo:reset` a las 15:00:02 UTC, después de la suite e2e · Edge Function v5 verificada
con sonda real contra Sonnet y contrastada contra SQL · Claude Code (Opus 5)*
