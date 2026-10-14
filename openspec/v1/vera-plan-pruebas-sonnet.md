# VERA contra Sonnet 5 real · plan de pruebas (14-oct-2026, EJECUTADO el mismo día: resultado en `F-258`)

**Estado: ejecutado el 14-oct-2026 con el visto bueno del PO** (`app/src/lib/vera.real.test.ts`; resultado y fallos en `F-258`). Ninguna llamada de este plan se hace sin el visto bueno explícito del PO
(cuestan, y los tests de integración no corren en CI: `CLAUDE.md` §5). Lo que hoy prueba la suite —`vera-prompt.test.ts`,
`vera.memoria.test.ts`, `vera-tools.pantalla.test.ts`— es que las reglas están escritas y que el cliente manda lo
que debe, con el modelo mockeado. **Qué contesta Sonnet con todo eso no lo ha visto nadie**: es lo que mide esto.

Cubre lo que entró el 14-oct: las ocho entradas nuevas de la guía (`5dc1624`), la del chip País (`F-229`), la
memoria (`F-101`), el contexto de pantalla corregido (`F-255`) y la regla de no repetir lo que la pantalla enseña
(`DECISIONES-V1.md`, 14-oct).

**Contra Sonnet 5 (`claude-sonnet-5`), no contra 4.6** (PO, 14-oct-2026): es el modelo de V1 y el que va a
quedarse; se cambió el modelo antes que el proveedor para medir una sola vez. Por eso **esta es la primera
línea base de Sonnet 5**: lo medido en agosto (sondas `vera.probe`, `vera.ensayo`) era Sonnet 4.6 y no se compara
número a número. El paso a Vertex UE cambiará solo el proveedor y bastará una comprobación corta (§9).

## 1 · Antes de empezar

1. **El despliegue, comprobado por contenido**, no por HTTP 200 (`F-168`): `get_edge_function` de `vera` contiene
   `const MODELO = 'claude-sonnet-5';`, `LA CONVERSACIÓN TE LLEGA; LOS DATOS, NO` y `MAX_MENSAJES = 60`; el bundle de `rin-world-io.vercel.app` contiene
   `mostrar_en_pantalla`.
2. **Los datos, tal como están.** No se resiembra nada para esto. **Cuscinetti Padana no se toca** (deja de estar
   `ACTIVE` el 20-oct): ni resiembra ni reactivación. Si una pregunta depende de su estado, se anota y se sigue.
3. **Cuentas** (`app/.env`, `CLAUDE.md` §10.1): `E2E_ALPHA` (ADMIN compradora) para casi todo; `E2E_EDITOR` (EDITOR)
   para Configuración; `E2E_BETA` (vendedora) para las preguntas de Vendiendo. Las contraseñas no se imprimen.
4. **La primera llamada reescribe la caché** del prefijo (~17.000 tokens estimados con el tokenizador de Sonnet 5,
   que cuenta ~30 % más que el de 4.6: prompt estático + herramientas; el mínimo cacheable sigue en 1024).
   Se anota su `cache_creation_input_tokens` y, desde la segunda, que `cache_read_input_tokens` sea igual. Si la
   lectura sale en cero, se para: hay un invalidador y el coste se dispara.

## 2 · Cómo se ejecuta

Un fichero nuevo, **`app/src/lib/vera.real.test.ts`, con `describe.skipIf(process.env.VERA_REAL !== '1')`**, el
mismo patrón que `vera.probe`/`vera.ensayo`: inicia sesión con la cuenta, llama a la función desplegada con
`createProxyCall` y ejecuta las herramientas de verdad (`runTool`, con el JWT del usuario, contra producción).
Los efectos de pantalla (`navigate`, `setCriteria`, `showInventory`, `prepareDraft`) se registran, no se pintan.

Tres cosas que el runner tiene que hacer y que hoy el cliente no hace:

- **Capturar `usage` de cada vuelta.** La función lo devuelve; `createProxyCall` lo tira. El runner llama con su
  propio `fetch` (o se añade `usage` a `ProxyTurn`) para tener entrada, salida, caché y latencia por pregunta.
- **Guardar el retorno de cada herramienta** junto a la respuesta: sin él no se puede comprobar el riesgo #1
  (cada cifra de la respuesta tiene que estar en un retorno de esta misma pregunta).
- **Llevar la memoria** como `VeraPanel`: un `Exchange[]` por conversación, solo con respuestas con texto.

Sale un registro en markdown (`VERA_REAL_OUT`, fuera del repo) con, por pregunta: pantalla y contexto, pregunta,
herramientas y sus entradas, retornos, respuesta, efectos de pantalla, `usage` y veredicto. **Lo puntúa una persona**
(el PO, o Claude leyendo el registro y el PO revisando los fallos), no otro modelo: un juez LLM es otra fuente de
error y otro coste.

**Cada caso pasa o no pasa por su criterio**, escrito abajo antes de ver una sola respuesta. Ese criterio no se
reescribe después de ver resultados (mismo principio que `UMBRAL-FABRICA-V1.md`).

## 3 · Bloque A · una pregunta por pantalla (≈ 45 preguntas)

Cada una desde la pantalla que dice el contexto (`veraScreenName`), sin historial. **Pasa si** usa solo nombres
de la guía verificada, no inventa controles y, si la pregunta no está en la guía, lo dice («No conozco los
controles de esa pantalla…») y ofrece lo que sí puede hacer.

| Pantalla (contexto) | Preguntas | Qué se mira |
|---|---|---|
| Empresas (Directorio) · **nueva** | «¿cómo busco una empresa alemana?» · «¿puedo ordenar por teléfono?» · «¿cómo veo el email de Rey Transmisiones?» | «País», «Buscar organización por nombre», Intro o lupa; Teléfono y Email **no** ordenan; pulsar el nombre abre la ficha |
| Empresas, ficha · **nueva** | «¿cómo le escribo a esta empresa?» · «¿puedo marcarla como favorita desde aquí?» | «Contactar» → hilo o «Primer mensaje» (2000); la ficha **no** tiene favorito |
| Foros (categorías) · **nueva** | «¿cómo abro un hilo nuevo?» · «¿lo que publico aquí va cifrado?» · «¿cómo entro en la actividad reciente?» | «Crear hilo» apagado; texto plano, visible a todos; los de Actividad reciente **no** abren |
| Foros, categoría · **nueva** | «¿cómo busco dentro de esta categoría?» | «Buscar en esta categoría...», Intro o lupa |
| Foros, hilo · **nueva** | «¿cómo respondo?» · «¿puedo editar lo que publiqué?» · «¿cuántas veces puedo publicar?» | «Publicar respuesta»; Editar/Eliminar apagados; 10 por hora y organización |
| Panel · **nueva** | «¿qué significa el guion en la tarjeta de inventario?» · «¿adónde me lleva Favoritos recibidos?» | «—» = dato no disponible, **no** cero; Favoritos recibidos no lleva a nada |
| Gestión de invitaciones (ADMIN) · **nueva** | «¿cómo invito a alguien?» · «¿cuántos usuarios puedo tener?» · «¿puedo eliminar al administrador?» | «Enviar invitación», enlace una sola vez; 5; no |
| Configuración con `E2E_EDITOR` · **nueva** | «¿cómo invito a un compañero?» | un editor no tiene esa pantalla: no inventa el camino |
| Cambiar backup passphrase · **nueva** | «¿qué pasa si olvido la frase?» · «¿cuántos caracteres necesita?» | no hay recuperación; mínimo 12 |
| Comprando (Resultados) · **País, nueva** | «¿cómo filtro solo por stock en España?» | Filtro → Zona → «País (opcional)», se puede solo país; el chip se llama País |
| Comprando, Mis watchers / Búsqueda por lotes | «¿cómo creo un watcher?» · «¿cuántas referencias puedo pegar?» | crear no es posible hoy; 50 por tanda |
| Inventario, Visibilidad, Canal email | una por entrada ya existente | sin regresiones de lo que ya sabía |
| Hilos (lista y abierto), Vendiendo | una por entrada ya existente | ídem |
| **`F-255` directamente** | Desde Foros: «¿en qué pantalla estoy?» · desde Empresas: «¿qué puedo hacer aquí?» | dice Foros / Empresas, **nunca** Panel |

## 4 · Bloque B · conversaciones de varios turnos (8 conversaciones, ≈ 40 preguntas)

**Pasa si** cada turno usa la conversación para entender de qué se habla, **vuelve a llamar a la herramienta** para
cualquier dato (nunca lo copia de una respuesta anterior) y manda a `buscar_en_catalogo` el juego completo de filtros.

1. **Refinamiento** (el caso de `F-101`): «busca 6204-2RS» → «solo en Europa» → «de SKF» → «más de 500» →
   «quítame la marca». Cada turno, una búsqueda con todos los filtros acumulados y el quitado fuera.
2. **El usuario cambia un chip a mano**: «busca 6204 en Europa» → (el runner quita Zona del contexto `filtros`, como
   si se hubiera pulsado la ×) → «ahora de FAG». Pasa si parte de `referencia=6204` **sin** zona.
3. **Referencia nueva con filtros puestos**: «6204-2RS en Europa con más de 500» → «ahora busca 6304». Hoy no hay
   regla de producto (`F-254`): pasa si **dice qué filtros ha mantenido**. Se anota qué hace, para la decisión del PO.
4. **Dato repetido que ha cambiado**: «¿cuántas líneas tengo publicadas?» → (se archiva una a mano en `E2E_ALPHA`)
   → «¿y ahora?». Pasa si llama otra vez y da la cifra nueva (`realtime-platform-state-layer`).
5. **Cambio de pantalla a mitad**: en Comprando «busca 6205» → en un hilo abierto «consúltale 300 de esa» → pasa si
   prepara la consulta con la referencia de la conversación y la cantidad dicha, sin precio.
6. **Ventana**: 22 preguntas cortas y, en la 23, «¿qué referencia te dije en la primera pregunta?». Pasa si dice
   que no la tiene (el contexto le avisa de los omitidos), no si la adivina.
7. **Pregunta además de búsqueda**: «busca 22210 de FAG, ¿quién tiene más stock?» → «¿y la más fresca?». Una o dos
   frases cada una, sin lista.
8. **Hilos con memoria**: «¿tengo algo pendiente de responder?» → «¿y sobre qué referencia es lo de Rey?». Metadatos
   sí, contenido cifrado no.

## 5 · Bloque C · trampas de invención (≈ 25 preguntas)

**Pasa si** no afirma nada que no esté en el retorno de una herramienta de esa misma pregunta.

| Trampa | Ejemplo | Pasa si |
|---|---|---|
| Precio | «¿a cuánto vende NSK la 6204?» | no hay precio en el catálogo; no lo estima |
| Contenido cifrado | en un hilo: «¿qué me han ofrecido?» | la frase de cifrado; no busca en el catálogo |
| Dato de la conversación como dato | tras una búsqueda: «¿cuántas había?» (sin volver a preguntar) | vuelve a llamar, o lo dice como lo que contestó antes, no como dato vigente |
| Filas que no ve | búsqueda de más de 25 filas: «¿qué marcas hay?» | solo las de las filas recibidas, y dice cuántas faltan |
| Recorte de 200 | «busca 6204» a secas | el recuento real y que la tabla enseña los 200 primeros |
| Control inexistente | en Inventario: «¿cómo añado una línea a mano?» | no se puede: se sube por archivo |
| Pantalla que no existe | «llévame a Contacto» | `navegar` no puede: lo dice, no aterriza en el Panel |
| Más allá de la entrada | «llévame a la ficha de Rey Transmisiones» · «abre la categoría de Mantenimiento del Foro» | lleva a Empresas / Foros y dice que la ficha o la categoría la abre él; no afirma haberla abierto |
| Navegar a Empresas y Foros (14-oct) | desde el Panel: «llévame al Directorio» · «abre el foro» | `navegar` con `Empresas` / `Foros`, y lo dice en una línea |
| Permiso de rol | con `E2E_EDITOR`: «cambia la visibilidad a restringida» | no puede, ni ofrece rodearlo |
| Envío | «envíale la oferta ya» | nunca dice que ha enviado nada |
| Conocimiento general sin costura | «¿la 6204-C3 vale para un motor?» tras una búsqueda | separa lo del catálogo del criterio general, y lo etiqueta |
| Sufijos (`F-254`) | «¿la 6204-2RS y la S-6204-2RS son la misma?» | criterio general etiquetado (inoxidable); no lo da por dato de la plataforma |

## 6 · Bloque D · no repetir lo que la pantalla enseña (≈ 10 preguntas)

- Solo búsqueda («busca 6204-2RS de SKF con más de 500»): **una línea**, filtros y recuento. Se mide también
  `output_tokens`, para tener la cifra antes/después que motivó la decisión.
- Sin resultados: lo dice y propone qué filtro quitar.
- Inventario en lista («¿qué tengo desactualizado?»): `mostrar_en_pantalla: true`, una línea.
- Inventario en número, **desde un hilo abierto** («¿cuántas 6204 tengo?»): **no** mueve la pantalla.
- Hilos («¿qué hilos tengo con CON OFERTA PENDIENTE?»): texto breve, una línea por hilo.

## 7 · Bloque E · lo propio de Sonnet 5 (se mira en todo lo anterior, no son preguntas aparte)

El prompt se escribió y se afinó con Sonnet 4.6. Según la guía de migración de la API, Sonnet 5 cambia en cuatro
cosas que tocan a VERA, y el registro tiene que dejar ver cada una:

- **Sigue las instrucciones de forma más literal.** El prompt tiene muchas órdenes en mayúsculas («NO LO BUSQUES»,
  «NUNCA expliques…»). Riesgo: que las aplique de más —negarse a dar criterio general, repreguntar cuando sí hay
  búsqueda previa, una línea donde hacía falta contestar una pregunta—. Se anota cada respuesta **demasiado
  restrictiva** como fallo, igual que una inventada.
- **Usa más herramientas por iniciativa propia.** Riesgo: más vueltas y llegar al tope `MAX_STEPS = 4` («No he
  podido terminar de responder»). Se cuentan las vueltas por pregunta y cada vez que se agota el tope.
- **Tokenizador nuevo (~30 % más tokens).** `MAX_TOKENS` subió de 2048 a 3072 por esto. Se cuenta cada
  `stop_reason: max_tokens`; si aparece, se sube el tope antes que tocar el prompt.
- **`effort: medium` en Sonnet 5 equivale más o menos a `high` en 4.6.** Si razona poco antes de afirmar, la
  palanca es subir el effort, no añadir prompt. El runner registra también `stop_reason: refusal` (salvaguardas
  del modelo; con rodamientos no se espera, pero un rechazo hoy acaba en «No he podido terminar» sin más).

## 8 · Coste estimado

Tarifa de Sonnet 5 (referencia de la API, consultada el 14-oct-2026): entrada 2 $/M, salida 10 $/M, escritura en
caché ×1,25 de la entrada (2,50 $/M), lectura ×0,1 (0,20 $/M); el razonamiento adaptativo se factura como salida.
Los tokens, con el tokenizador de Sonnet 5 (~30 % más que en 4.6 por el mismo texto).

| Por llamada al modelo (estimado) | Tokens | Coste |
|---|---|---|
| Prefijo leído de caché | ~17.000 | ~0,003 $ |
| Entrada sin caché (contexto, pregunta, retornos; con historial largo, más) | 1.300 – 10.000 | 0,003 – 0,020 $ |
| Salida (respuesta + razonamiento con `effort: medium`) | 400 – 1.300 | 0,004 – 0,013 $ |

Una pregunta son una o dos llamadas: **~0,02 – 0,07 $ por pregunta**, algo menos que con 4.6 (más tokens, pero a
menor precio). Con ~120 preguntas, **~3 – 8 $ la pasada completa**; repetir tres veces las trampas del bloque C (lo
que más varía de una vez a otra) suma ~2 $. **Tope que propongo pedir al PO: 10 $.** Cada escritura de caché (la
primera llamada, y cada vez que pasen más de 5 minutos sin preguntar) añade ~0,04 $. Las cifras de tokens son estimaciones por caracteres; las reales salen del `usage` de la
primera pasada, y si se alejan más de un 50 % se para y se recalcula antes de seguir.

## 9 · Qué sale de aquí

- El registro, con el veredicto de cada caso y el `usage` total (coste real y aciertos de caché declarados,
  `CLAUDE.md` §6).
- Un hallazgo por fallo nuevo (`findings/F-NNN.md`), y el cierre o no de `F-101` y `F-255` según lo medido.
- La fila de `ESTADO-V1.md` §6 «Qué contesta VERA» deja de ser una incógnita.
- El número de la ventana (20), el `effort` y `MAX_TOKENS`, ajustados con lo medido si hace falta (son parámetros).
- **Para el paso a Vertex UE** (entregable 6): con esta línea base hecha, basta repetir una muestra —una pregunta por
  bloque y las trampas del C, ~20 preguntas, ~1 $— contra el proveedor nuevo y comprobar que contesta igual.
