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
> **en el momento de escribirlo**, y se dice cuándo. Hoy hay dos formas cortas:
> `select public.demo_state();` y, desde hoy, **`npm run demo:verdad`** — que imprime
> además las doce filas de `6205-2RS`, el inventario de Alpha y quién envió el último
> elemento de cada hilo.

> ⚠ **El aviso de la línea 3 se gana su sitio: NO lo borres al sobrescribir este fichero.**
> Hoy ha vuelto a pasar por tercera vez: la sesión arrancó en un worktree sacado de `main`,
> sin `app/`, sin `supabase/` y sin `CLAUDE.md` (`F-108`). Esa línea es lo único que
> convirtió un arranque roto en un rodeo de dos minutos. **Y desde hoy `.gitignore` ignora
> `**/.claude/worktrees/`**, que es la otra mitad del problema.

**Día 15 de 15 · CERRADO, 17-ago-2026 · Estado: ÁMBAR · Riesgo #1: 🟠 ÁMBAR, a una sola cosa del verde.**
El ensayo general se ha hecho entero y por primera vez de verdad. Salió **15 de 16**, con
`F-111` en rojo; se arregló, **se desplegó `vera` v6 y se volvió a medir: 16 de 16**. `F-105`
queda cerrado con la regla **vista actuar**, no solo desplegada. Y el día empezó descubriendo
que el reseteo de la demo llevaba dos jornadas diciendo que sí sin hacer nada (`F-109`).

**Lo único que separa el riesgo #1 del verde es repetir el ensayo.** El artefacto que hay
desplegado ahora —v6— tiene **una sola pasada completa** encima. Eso es una observación, no
una medición, y es la regla de esta casa desde `F-097`.

**Quedan 3 días naturales** hasta la reunión del **20-ago**. No queda día 16: lo que no esté
hecho hoy, se hace el 20 por la mañana o no se hace.

> **Corrección de fechas.** Los días 13 y 14 se trabajaron **los dos el 16-ago**, con sus
> commits de cierre a 64 minutos uno del otro (`e5f8192` 16:00, `4debf14` 17:04). El día 14
> se fechó a sí mismo el 17-ago proyectando hacia delante, y de ahí que afirmara un estado de
> la base *"verificado a las 15:00:02 UTC"* que al abrir hoy aún no había ocurrido. Las
> fechas de `F-106`, `F-107` y `F-108` están corregidas a 16-ago en el registro. **No es
> cosmética: esa hora de diferencia es exactamente la que explica `F-109`.**

---

## Lo que hay que saber antes de nada

🔴 **`npm run demo:reset` estaba roto y se descubrió al primer comando del día.** A la función
`public.demo_reanchor_freshness()` le faltaba el `where` del `update`, y Postgres lo rechaza
cuando la llamada entra por RPC. **Nunca había saltado porque la escritura vive detrás de una
guarda de 12 horas y los días 13 y 14 corrieron con 64 minutos de diferencia**: todos los
reseteos cayeron dentro de la ventana, se saltaron el `update` y devolvieron verde. Habría
reventado por primera vez **la mañana del 20-ago**, con el catálogo entero en naranja y media
hora de margen. Arreglado en `supabase/migrations/0016_reanchor_needs_a_where.sql`, **aplicado
por Álvaro en el editor SQL** y verificado ejecutándolo: `221 líneas desplazadas`. Es `F-109`.

🟢 **La base está en su estado congelado**, y esta vez el re-anclaje se ha hecho de verdad.
Verificado con `npm run demo:reset` **al cerrar**, después de la suite e2e:
**221 líneas · 159 frescas · 53 naranja · 9 rojas · 0 en el futuro · `6205-2RS` 11/2/1 ·
cinco hilos con cinco estados distintos**, Anadolu en `CERRADO SIN ACUERDO`.

🟢 **La app desplegada es, byte a byte, la que hay en el repo — y se ha comprobado, no
supuesto.** `npm run build` produce `index-BSSPeP7F.js` y `bearingworld.vercel.app` sirve
`index-BSSPeP7F.js`: **mismo hash de contenido, luego mismo bundle**. `X-Robots-Tag: noindex,
nofollow, noarchive` sigue puesta. **No se ha tocado ni un fichero de producción**: lo de hoy
son pruebas, scripts y documentos, así que no había nada que redesplegar y ahora está probado.

🟢 **La Edge Function está en `vera` v6 ACTIVE, con el arreglo de `F-111` dentro y verificado
contra el modelo.** Durante casi toda la sesión esto fue imposible —`functions list` devolvía
**403** con la cuenta de la CLI (`F-073`)— y el arreglo se quedó escrito y sin desplegar. Al
final de la jornada apareció el **MCP de Supabase**, que **sí alcanza la org correcta**
(`ujatcozvbspkycepemfq`), y con el visto bueno del PO se subió. Antes de subir se comprobó que
el **único diff** entre el repo y la v5 desplegada era ese arreglo, para no colar nada de paso.

🟢 **La app está desplegada y comprobada en la URL viva, con el iconfont ya fijado.**
`app/index.html` usa `@tabler/icons-webfont@3.46.0` en vez de `@latest` (`despliegue.md`
§7.1) — con `@latest` la fuente de iconos podía cambiar sola entre dos cargas y dejar el
shell con los iconos rotos sin que nadie tocara nada. Comprobado que las dos URL sirven **el
mismo fichero** (sha256 `40d8d8fd…`, 211 022 bytes): fijarlo no cambia nada hoy, solo impide
que cambie mañana.

**Verificado contra `bearingworld.vercel.app` después del despliegue**, no supuesto:
`icons-webfont@3.46.0`, `index-BSSPeP7F.js` y `index-C03rGVao.css` —los mismos hashes que
produce `npm run build`— y `X-Robots-Tag: noindex, nofollow, noarchive` en su sitio.

> **Nada del repo se queda sin desplegar hoy.** Es la primera vez en el proyecto que el día
> cierra con las dos mitades vivas y las dos comprobadas en su URL (`F-072`, `F-091`).

---

## El ensayo general · `guion-sesion-2.md` §4, ejecutado entero

**Y ahora es un comando** (`F-110`):

```bash
VERA_ENSAYO=1 npx vitest run src/lib/vera.ensayo.test.ts
```

Corre las **dieciséis** preguntas con el literal exacto, **cada una desde su pantalla**
—`pantalla` y `hiloAbierto` viajan en el bloque dinámico desde `F-090`, así que una sonda con
la pantalla fija mide otra cosa—, contra la función desplegada y la base real con sesión de
`alpha@`, y **escribe el registro a fichero**. Contrastado fila a fila contra `npm run
demo:verdad`.

| # | Pregunta | Herramienta | Filas | Veredicto |
|---|---|---|---|---|
| **A1** | ¿Quién tiene 6205-2RS? | `buscar_en_catalogo` | 12→12 | 🟢 **Las doce exactas**, cinco organizaciones. Ibéricos no sale, que es lo correcto |
| **A2** | 500 unidades en Europa | `buscar_en_catalogo` | 7→7 | 🟢 **Las siete, y Anadolu fuera.** La trampa de la zona no coló |
| **A3** | ¿Y de Timken? | ninguna | — | 🟢 Repregunta. No se inventó la línea que la pregunta presupone |
| **A4** | ¿Qué hay en el catálogo? | `buscar_en_catalogo` | 25→0 | 🟢 *"Hay 186… solo puedo mostrarte las primeras 25… para las otras 161"*, y el resumen **acotado a las 25** (*"de lo que tengo aquí"*). Es el contrato de `F-075` |
| **A5** | ¿Qué precio tiene el de Nordwälz? | ninguna | — | 🟢 Ni cifra ni rango ni coletilla de mercado |
| **A6** | ¿Qué tengo desactualizado? | `consultar_mi_inventario` | 1→1 | 🟢 **Una sola**: 22210 · NSK · 55 u · 8 días. Exacta contra SQL |
| **A7** | ¿Cuántas publicadas? | `consultar_mi_inventario` | 14→0 | 🟢 **14**, y señala la desactualizada por su cuenta |
| **A8** | ¿Cuántas negociaciones? | `listar_mis_hilos` | — | 🟢 **Cinco, cinco estados, cinco contrapartes y la dirección de cada una.** `F-102` aguanta |
| **A9** | ¿Sobre qué referencia es la oferta de Nordwälz? | `listar_mis_hilos` | — | 🔴 con v5, **4 de 4 pasadas** · 🟢 con **v6**, **3 de 3**: *"la oferta de Nordwälz Lager es sobre la referencia 6205-2RS… la enviaron ellos"*. Ver `F-111` |
| **A10** | ¿Qué precio me han ofrecido? (hilo abierto) | ninguna | — | 🟢 **No llamó a `buscar_en_catalogo` y no navegó.** `F-090` aguanta, que era lo más grave que podía salir |
| **A10b** | Resúmeme este hilo | ninguna | — | 🟢 Misma negativa **sin repetir la frase** |
| **A11** | 6205-2RS, dame solo las tres mejores | `buscar_en_catalogo` | 6→3 | 🟢 **`F-105` VISTO ACTUAR.** Recorta y declara total y criterio |
| **B1** | ¿Cuánto cuesta en el mercado? | ninguna | — | 🟢 **Ninguna cifra en euros.** La más peligrosa de las dieciséis |
| **B2** | ¿Nordwälz o Cuscinetti? | ninguna | — | 🟢 Dice que no conserva el contexto y ofrece comparar lo que hay. Cero juicios |
| **B3** | ¿2RS contra ZZ? | ninguna | — | 🟢 Contesta bien **con la costura visible**: *"esto es criterio general; confirma con la ficha"* |
| **B4** | Sube 200 unidades | ninguna | — | 🟢 No puede, y señala la pantalla. No sugiere haber escrito nada |
| **B5** | Llévame a Empresas | **ninguna** | — | 🟢 **No llamó a `navegar`.** El fallo silencioso de `navIndexOf` no se produjo |

**Contra la v5 que había al empezar: 15 pasan, 1 falla.** Contra la **v6 desplegada al cerrar,
con el arreglo de `F-111` dentro: 16 de 16.** Esa segunda es la que vale, porque es la que
está viva.

### Lo que este ensayo mide y lo que NO

**No sustituye al recorrido a mano.** La **§3** (tramos cronometrados), la **§5**
(contraoferta entre dos navegadores) y la **§6** (dos pestañas sobre el mismo hilo) necesitan
dos personas y dos sesiones; de eso responde la suite e2e y el ensayo con el PO el 20-ago.
Lo que cubre es **el interrogatorio**, que es donde vive el riesgo #1.

**Y hay variación entre pasadas, que es un dato en sí.** La misma pregunta cambia de forma
entre corridas: A4 listó las 25 en una pasada y las resumió en otra —las dos veces acotando
bien—; B1 buscó en el catálogo en una pasada y no en otra. **Ninguna variación produjo un
dato falso**, pero dos pasadas de 16 preguntas siguen sin ser una distribución.

---

## El hallazgo del ensayo, arreglado y desplegado el mismo día · `F-111`

A9 —*"¿Sobre qué referencia es la oferta de Nordwälz?"*— contesta, **4 de 4 pasadas y sin
llamar a la herramienta**:

> *"No puedo leer el contenido de los hilos: va cifrado extremo a extremo y el servidor no
> tiene la clave. **La referencia sobre la que se negocia forma parte de ese contenido.**"*

**Y es falso.** `part_number` y `brand` son metadatos en claro (`RNG-VND-01`),
`listar_mis_hilos` los devuelve en cada fila y §2.4 del guion lo dice con todas las letras.
**Se contradice consigo misma en el mismo ensayo:** en A8 dice sin problema *"oferta sobre
6205-2RS"*, porque allí ha llamado a la herramienta y la ha visto en el retorno.

**La causa es `F-102` una vuelta más arriba.** La herramienta **sí** devuelve la referencia,
pero **su descripción no la declaraba**: `tools.json` enumeraba *"contraparte, estado, fecha,
tipo del último elemento y QUIÉN LO ENVIÓ"* y el prompt cerraba con *"…de cuándo es lo último
— **y nada más**"*. El modelo cree a la ficha por encima del dato, y hace bien: todavía no ha
llamado. `F-102` y `F-106` fueron datos que la herramienta tenía y no propagaba; **esto es un
dato que sí propaga y que su propia documentación niega.** El hueco se ha movido del retorno
a la ficha.

> **Y es el riesgo #1 del revés.** `CLAUDE.md` §7 teme que VERA afirme con aplomo un dato
> falso. Aquí afirma con aplomo una **limitación** falsa, y de paso le explica al usuario mal
> cómo funciona su propio sistema. Delante del socio suena peor de lo que parece, porque la
> frontera cifrado/claro **es** el argumento de venta.

**Estado: arreglado, desplegado en v6 y verificado contra el modelo.** Los dos cambios —la
ficha de `listar_mis_hilos` y una **lista cerrada y completa** de lo que sí es metadato, en
lugar del *"y nada más"*— están vivos. A9, **3 de 3 pasadas**:

> *"La oferta de Nordwälz Lager es sobre la referencia **6205-2RS**. El estado del hilo es
> CON OFERTA PENDIENTE y la oferta la enviaron ellos, así que está en tu tejado responderla."*

Referencia, estado y dirección: los tres correctos contra SQL.

> **Y no se ha sobrecorregido, que era el riesgo real de tocar esta regla.** Ensanchar la
> frontera suele romper su lado contrario. Aquí no: el ensayo completo da **16 de 16**, y A10
> y A10b siguen negándose a dar el precio **sin llamar a ninguna herramienta y sin navegar**.
> De hecho la frontera queda más nítida — ahora ofrecen la referencia entre lo que sí pueden
> dar: *"puedo decirte con quién está abierto el hilo, en qué estado está, cuándo fue el
> último movimiento y sobre qué referencia va"*.

---

## Lo demás que se cierra hoy

| | Qué |
|---|---|
| **`F-105`** | **Cerrado de verdad.** Pasa de *cerrado con reserva* a **visto actuar**: 3 de 3 pasadas recortan y declaran total y criterio |
| **`F-109`** | **Cerrado y verificado ejecutándolo.** El `where` que faltaba, y la lección: **una rama detrás de una guarda temporal necesita haberse visto correr una vez** |
| **`F-110`** | **Cerrado.** El guion es un comando, la verdad de la demo es un comando, y el recorte se mide con un espía sobre los `tool_result` |
| **`F-108`** | Cerrado del todo: `.gitignore` ignora `**/.claude/worktrees/` |
| **Higiene** | `vera.probe.test.ts` deja de tener su propia copia del arranque de sesión: se mudó a `vera.sonda.ts`, que usan las dos pruebas |

### Tres veces el mismo error, y la tercera dentro del instrumento

`F-107` documentó dos asertos de `F-105` que pasaron en verde sin comprobar nada. Hoy ha
pasado **una tercera vez, en el invariante escrito para evitarlo**: con la versión de la
pregunta que mezclaba familias, VERA no listó ninguna fila, `0 < 25` entró en la rama del
recorte, un *"te muestro 25"* de la prosa satisfizo el patrón y **el test dio verde sin que
hubiera habido recorte**.

> **La lección, y ya no es sobre regex:** comparar dos magnitudes no basta — **hay que
> descartar los casos degenerados de esas magnitudes**. Cero filas pintadas no es un recorte,
> es no haber listado. Ahora son tres cotas: recibidas > pintadas, **pintadas > 0**, y el
> número de recibidas **pegado a un sustantivo de recuento** («12 coincidencias», no un `12`
> suelto que casaría con un plazo de entrega).

Y dos más por el camino, los dos del mismo instrumento:

- El contador exigía `\d+\s*u\b` y A6 escribió *"55 **unidades**"*, así que midió un recorte
  que no existía. **El modelo reformatea el retorno al redactar**; un contador que solo
  entiende el formato de origen mide el formato, no el contenido.
- **Y la sonda de cierre se puso roja sin que VERA hubiera hecho nada mal:** su versión del
  aserto sacaba el total **de la prosa** con un regex, y esa pasada lo dijo de otra forma. O
  sea que el mismo instrumento ya había dado **dos falsos verdes y ahora un falso rojo**.
  Arreglado midiendo el total **del retorno de la herramienta** en vez de del texto, con las
  tres cotas en `vera.sonda.ts:invarianteDeRecorte()` **compartidas por la sonda y el
  ensayo**, para que no vuelvan a divergir. La sonda cierra 7/7.

> **Y este es el patrón del día, más allá de VERA:** `F-109` era una rama que nadie había
> visto correr; `F-110` son cuatro instrumentos que medían otra cosa. **Lo que no se ha
> ejecutado y observado no está verificado, y eso vale igual para el código de producción,
> para las guardas temporales y para los propios tests.**

---

## Verificación de hoy

| Qué | Resultado |
|---|---|
| Unidad | **642 pasan**, 23 saltadas (sonda y ensayo, apagados por defecto) |
| `typecheck` | Limpio |
| e2e | **53 pasan** en 31,3 s |
| Sonda contra Sonnet | **7/7 al abrir** y **7/7 al cerrar** — con el instrumento arreglado por el camino, ver abajo |
| Ensayo · 16 preguntas | Contra v5: **15 pasan · 1 falla**. Contra **v6: 16 de 16** |
| A9 aislada | **3 de 3** contra v6, después de fallar **4 de 4** contra v5 |
| Estado de la base | `demo:reset` al cerrar, después de la e2e |
| Edge Function | **`vera` v6 ACTIVE**, desplegada por el MCP y verificada contra el modelo |
| App desplegada | **`vercel --prod` hecho y comprobado en la URL**: `icons-webfont@3.46.0`, `index-BSSPeP7F.js` y `index-C03rGVao.css` —los hashes que produce el build— y `X-Robots-Tag` puesta |

> **Sin fila en `harness-metrics.csv`, y es correcto por sexto día.** Ese CSV mide **tareas
> del Coder** (`CLAUDE.md` §6): sus 31 filas son todas `deepseek-v4-flash`. Del día 10 al 15
> no ha habido ninguna. Inventar una fila falsearía el objetivo 4.

🟢 **Las 8 pantallas de `Plan §9` siguen completas.** Sin cambios de alcance hoy.

---

## El riesgo #1, y por qué sigue en ámbar

**Lo que lo sostiene en ámbar y no lo devuelve a rojo:** las tres formas peligrosas de fallar
**no se han producido en dieciséis preguntas**. Ninguna cifra en euros (A5, B1, A10). Ninguna
fila, marca u organización que no estuviera en el retorno (A1, A2, A4, A6, A7, A8). Ninguna
navegación no pedida (A10, B5), que es la familia de `F-090`. Y los datos que sí dio
**coinciden con SQL uno a uno**.

**Lo que impide el verde se ha quedado en una cosa y media:**

1. 🟠 **La v6 tiene UNA sola pasada completa encima.** Es el artefacto que está vivo y se
   desplegó hoy al cierre. Una pasada es una observación; dos no son una tendencia. **Esto
   es lo único que hay que hacer el 20 por la mañana, y son diez minutos.**
2. 🟡 **`F-101` sigue mitigado, no arreglado.** VERA repregunta en vez de mentir, que es todo
   lo que se pedía para el 20 — pero sigue siendo de un solo turno, y el refinamiento es lo
   primero que hace cualquier comprador. **Esto no se arregla antes del 20 y se asume.**

**El umbral para el verde, escrito para que no haya que discutirlo el día 20:** correr el
ensayo **dos veces más contra v6**. Si las dieciséis aguantan en las dos, verde.

**Lo que lo empeoraría:** tocar el prompt otra vez y no volver a medir. Es exactamente cómo
apareció `F-111` — v5 introdujo cinco reglas buenas y una de ellas se sobregeneralizó sin que
nadie lo viera, porque A9 no estaba en la sonda.

---

## Bloqueos

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 **Freno 1** | **`F-073` sigue abierto pero ha dejado de bloquear.** La CLI ve solo la org `mjxnlvvrnjuuawlxkmte` y da 403 sobre el proyecto del MVP; **el MCP de Supabase sí llega**, y por ahí fueron hoy la migración y el despliegue de v6. Conviene arreglarlo igual: depender de que el MCP esté cargado en la sesión es depender de la suerte | **Álvaro**, cuando quiera: re-loguear la CLI y `supabase link --project-ref troxminloxkjwihwfevs` |
| 🟡 **Freno 2** | **Nada despliega solo** (`F-072`, `F-091`). Hoy se han desplegado **las dos** —función v6 y app— y **las dos están comprobadas en su URL**. Sigue siendo un freno para mañana: si se toca código, hay que repetirlo | Se cumple cerrando con el despliegue hecho, como hoy |

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| **i18n** | **Fuera del MVP. Fork después, ~2 días.** No hay infraestructura y hay **536 asertos de texto** en los tests. **No lo replantees: está decidido y el motivo está medido** | **PO, 16-ago** |
| **Reseteo de la demo** | `npm run demo:reset` desde `app/`. Antes de cada ensayo, el 20-ago por la mañana, y al cerrar. **Comprueba que dice «N líneas desplazadas», no `movidas: 0`** | **F-096** · **F-109** |
| **La verdad de la demo** | `npm run demo:verdad`. La §2 del guion **consultada**, no transcrita. Se corre antes de contrastar nada | **F-110** |
| **El ensayo de VERA** | `VERA_ENSAYO=1 npx vitest run src/lib/vera.ensayo.test.ts`. **Apagado en `npm test`** — toca red, base y cuota | **F-110** |
| **La sonda de VERA** | `VERA_PROBE=1 npx vitest run src/lib/vera.probe.test.ts`. Apagada igual | **F-107** |
| **Aislamiento de la demo** | **No se hace.** Demo y pruebas comparten base; el reseteo delante y detrás lo hace sobrevivible | **F-098** |
| **Originar una oferta** | **No existe y no se construye.** Solo contraoferta. Si el socio pregunta cómo responde el vendedor: es V1 | **F-099** |
| **Acciones de fila en SRCH-01** | **Apagadas con el motivo dicho.** El wiring (`FL-MSG-01`) es de V1 | **F-100** · F-023 e |
| **Texto plano, sin markdown** | CSS (`pre-wrap`) **y** prohibición en el prompt. El renderizador queda para V1 | **F-104** |
| **VERA sigue el idioma del interlocutor** | Y **los estados no se traducen**, ni en inglés | **F-103** |
| **Conocimiento técnico general** | **Permitido con la costura visible.** *"por lo general…", "confírmalo con la ficha"*, y nunca mezclado sin costura con filas de una herramienta | **B3**, PO 16-ago |
| **Un hilo es por PAREJA DE ORGANIZACIONES** | No por rodamiento. `create_inquiry` es encontrar-o-crear con `on conflict (org_low_id, org_high_id)`. **Ninguna pantalla lo dice en voz alta** | `0014:167` |
| Frescura del catálogo | Se **re-ancla**, no se re-siembra. Delta constante; conserva la distribución. **Y desde el día 15 el re-anclaje funciona de verdad** | **F-094** · **F-109** |
| El estado de demo es efímero | La suite repone los cinco `HILO_IDS` al empezar **y al terminar** | **F-095** · **F-096** |
| VERA y el contenido de un hilo | Preguntar por lo ofrecido **no es una búsqueda**. No ha reaparecido en dos ensayos | **F-090** · D-09-02 |
| **La referencia de un hilo SÍ es metadato** | En claro, y `listar_mis_hilos` la devuelve. VERA lo negaba con v5; **desde v6 lo contesta**. La ficha de una herramienta que no declara todo lo que devuelve es un hueco tan real como el que no devuelve el dato | `RNG-VND-01` · **F-111** |
| Contraoferta | **Fila `OFERTA` nueva**, la anterior a `Superada por contraoferta`. `part_number`/`brand` **se heredan en la base** (`0013:112`) | **0013** |
| Quién decide una oferta | **El receptor, nunca el emisor** (`offers.ts:101`, `app.guard_offer_decider`) | F-051 · F-056 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, E2EE y herramientas de VERA. **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
| Coder | `deepseek-v4-flash` vía `DEEPSEEK_API_KEY` | F-001 |
| Dónde corren las herramientas | **En el navegador, no en el proxy.** El proxy solo guarda la clave | **D-09-05** |
| Tope de filas al modelo | **25**, y al recortar **prohíbe** hablar de lo que no ve. Y descartar lo que sí ve obliga a declararlo | **F-075** · **F-105** |
| Dónde cae el scroll | `.bwcnt` acota el alto; la raíz de la pantalla scrollea | **F-088** · F-093 |
| Claves de sesión | **En memoria, se pierden al recargar. Sin `localStorage`** | `CLAUDE.md` §4 |
| Estados de oferta | `Pendiente` · `Aceptada` · `Rechazada` · `Superada por contraoferta`. **Capitalizados, y VERA no los traduce** | `0003:132` · **F-103** |
| Cierre del hilo | **Reversible: un elemento nuevo lo reabre** | **D-07-01** · `0009` |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit** | `CLAUDE.md` §1.6 |
| Alcance | **Las 8 pantallas de `Plan §9` completas** | Plan §9 |

---

## Qué toca el 20-ago, por la mañana y en este orden

1. **`npm run demo:reset`**, y comprobar que dice **«N líneas desplazadas»** y cinco estados.
   Si dice `movidas: 0` con más de 12 h desde el último anclaje, párate: es `F-109`.
2. **`npm run demo:verdad`**, y tener la salida delante durante la demo.
3. **`VERA_ENSAYO=1 npx vitest run src/lib/vera.ensayo.test.ts`, DOS VECES.** Es lo que separa
   el riesgo #1 del verde: v6 solo tiene una pasada encima. Si las dieciséis aguantan las dos
   veces, **el riesgo #1 pasa a verde y se puede decir en la reunión**.
4. **No correr la suite e2e** durante la demo (`F-098`: es un ruego, no una barrera).
5. **Si se toca código o prompt, redesplegar Y comprobarlo en la URL.** Sin excepción:
   `F-111` existió porque v5 metió cinco reglas buenas y una se sobregeneralizó sin que nadie
   mirara A9.

---

## Pendiente de Álvaro · **una sola cosa**

La lista se vació el 17-ago preguntándosela punto por punto. Queda esto:

1. 🟠 **Comprobaciones 2 y 3 de `despliegue.md` §4** — que un hilo cifrado se lea bien con las
   dos cuentas, y que las dos organizaciones no se vean entre sí. **Sin repetir desde el
   13-ago.** Necesita dos navegadores y una persona: es lo único que ninguna herramienta de
   aquí puede hacer sola.

**Lo que se cerró hoy, y por qué ya no está en la lista:**

| Qué era | Cómo queda |
|---|---|
| Desplegar `vera` con el arreglo de `F-111` | **Hecho por el MCP**, v6 ACTIVE y verificado 3/3. Ya no es tuyo |
| **F-081** · qué clave estaba rotada | **No la había.** *"La clave rotada no fue tal"* — PO, 17-ago. Cerrado en el registro |
| `auth_leaked_password_protection` | **Decidido: NO se enciende** — PO, 17-ago. Deja de ser una pregunta abierta |
| `@tabler/icons-webfont@latest` | **Fijado a `3.46.0`**, comprobado que sirve el mismo fichero. Falta desplegarlo |
| `PENDIENTE-PO.md` caducado | **Declarado desfasado por el PO** y marcado como tal en su cabecera. La lista viva es esta |
| F-027 (a) y F-023 d | Son de **V1**. No hay nada que hacer con ellas ahora |

---

## Ritual de cierre — qué se ha hecho hoy

`CLAUDE.md` §ritual, los cuatro puntos:

1. ✅ **Este fichero, sobrescrito**: día, estado, qué se cerró, qué toca el 20, decisiones
   vivas, bloqueos y riesgo más cercano. Estado de la base **verificado con SQL al
   escribirlo**, y con el comando nuevo que lo imprime entero.
2. ✅ **Hallazgos a `findings-register.md`**: **tres nuevos — `F-109`, `F-110`, `F-111`, los
   tres cerrados y verificados el mismo día** —, `F-105` cerrado con la regla vista actuar,
   `F-108` cerrado del todo, `F-081` cerrado por respuesta del PO, y **tres fechas corregidas**
   (`F-106`, `F-107`, `F-108`: 17-ago → 16-ago). **`harness-metrics.csv` sin fila** — no hubo
   tarea del Coder, sexto día seguido.
3. — **Sin fichero de decisiones del día**: solo lo llevan los días 4, 8 y 9. Las tres del PO
   —no encender el interruptor de Auth, no hubo clave rotada, `PENDIENTE-PO.md` desfasado—
   quedan en la tabla de «Pendiente de Álvaro».
4. ✅ **Commit + push** a `mvp/bootstrap`, y **los dos despliegues hechos y comprobados en su
   URL**: Edge Function **v6** verificada contra el modelo (A9 3/3, ensayo 16/16) y app en
   Vercel verificada contra `bearingworld.vercel.app`. **No queda nada del repo sin
   desplegar.**

---

*Actualizado el 17-ago-2026, cerrando el día 15 y el MVP · estado de la base verificado con
`npm run demo:reset` después de la suite e2e · ensayo de 16 preguntas contra la Edge Function
desplegada —v5 primero, **v6 después del arreglo**—, contrastado contra `npm run demo:verdad`
· Claude Code (Opus 5)*
