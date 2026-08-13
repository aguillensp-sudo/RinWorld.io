# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).
>
> **Regla de este fichero (F-012).** Cita, no parafrasees. Los valores de estado y las
> asignaciones de modelo se copian del spec cerrado o del plan **con el puntero al lado**.
>
> **Corolario del día 8 (F-065), que hoy volvió a costar caro:** no basta con comprobar lo
> que no lleva puntero. Hay que comprobar **lo que uno supone que no existe**. Hoy escribí
> en el registro que no había métricas de la corrida sin abrir el CSV. Las había — F-078.

**Día 9 de 15 · cerrado 13-ago-2026 08:30 · Estado: VERDE. Los TRES bloques cerrados.
VERA responde de verdad contra Sonnet, y el riesgo #1 del proyecto se observó, se midió
y se cerró el mismo día.**

> **⚠ EL DÍA 9 SE EJECUTÓ ENTRE LA TARDE DEL 12-AGO Y LA MAÑANA DEL 13.** El plan lo
> situaba el 13, así que **vamos aproximadamente un día por delante del calendario**. Las
> fechas del registro son las del reloj, no las de la etiqueta del plan, y las etiquetas
> «día N» del `Plan §3` **no se han renumerado**.

> **Verificado en local, todo hoy:** `typecheck` limpio · **578 tests** de unidad (eran
> 457 al empezar el día) · `check:palette` cobertura completa · `build` verde ·
> **Playwright 50/50**, la suite entera y no solo los ficheros declarados.
>
> **En CI:** la corrida del arreglo de F-075 salió **verde**. Antes hubo **dos pushes en
> rojo que no se miraron hasta el final del día** — F-076.

---

## Dónde estamos

`Plan §3`, filas del día 9 — **las tres cerradas**:

| Bloque | Ejecuta | Resultado |
|---|---|---|
| Las 4 herramientas de VERA + Edge Function proxy | Claude Code | **Desplegada (v3) y respondiendo.** Contrato 45/45 |
| **SRCH-01** · cableado VERA↔chips | Claude Code | Escribe criterios y lleva a Comprando. 10 asertos |
| **PANEL-01** | Arnés | **ESCALADO 3/3 · $0,030285 · 12,6 min.** Revisión a mano **+21/−3** |

---

## VERA está viva, y lo que costó saber que decía la verdad

**Las cuatro herramientas son las de D-09-01** — buscar en catálogo, consultar mi
inventario, listar mis hilos (metadatos) y navegar — y **el proxy no toca la base**
(D-09-05). Su única responsabilidad es guardar la clave de Sonnet; las herramientas se
ejecutan en el navegador contra `search.ts`, `inventory.ts` y `threads.ts`. Así el
*"actuando siempre con los permisos del usuario autenticado sin posibilidad de escalar
privilegios"* de `spec.md:223` **lo impone RLS con el JWT que ya está ahí**, y no la buena
fe del servidor. Comprometer el proxy no expone una fila de nadie.

**Medido en la primera corrida real:**

- La herramienta se llama bien: *"busca 6205-2RS en Europa"* → `buscar_en_catalogo` con
  `{referencia:"6205-2RS", zona:"EU"}`. Tradujo el continente al enum sin ayuda.
- **D-09-02 funciona delante del socio.** Ante *"resúmeme la negociación con Anadolu"*
  dijo que no puede, explicó por qué y **ofreció los metadatos**. No cayó en la opción (c).
  ⚠ **Parafrasea la frase, no la reproduce literal.** El contrato comprueba que está en el
  prompt, que es lo único comprobable.
- **Prompt caching real y medido:** `cache_creation_input_tokens: 2119` en la primera
  llamada y `cache_read_input_tokens: 2119` en la segunda. El bloque estático mide **2119
  tokens**, por encima del mínimo de **1024** de Sonnet 4.6 — el que falla en silencio.

### ⚠ F-075 · el riesgo #1 del proyecto, observado

**En la primera corrida real VERA inventó dos datos.** Con 13 filas en la base y el tope
en 10, el pie decía *"13 coincidencias (se listan 10)"* y contestó nombrando la marca
`NTN` y un stock *"desde 150"*: **ninguna de las dos estaba en su retorno** — eran los
puestos 11-13. Todo lo demás era exacto.

**Lo inquietante es que los dos inventos eran valores REALES de la base**, así que no
sonaron raros: rellenó el hueco con conocimiento del mundo que casualmente encajaba.

**La causa era del contrato de la herramienta, no del modelo:** se le dio un **recuento
cuyo contenido no podía ver**, y eso es una invitación a especular. Arreglado por los dos
lados — `MAX_FILAS` de 10 a **25**, y cuando aun así recorta, el retorno **prohíbe
explícitamente** mencionar marcas, cantidades, plazos o empresas que no estén en la lista;
más un párrafo del system prompt para el caso de RESUMIR, donde la regla general no bastó.

**Reverificado contra SQL:** misma pregunta, 11 filas, y los cinco subtotales por marca
(SKF 2250, NSK 2145, FAG 1630, Koyo 540, NTN 150), los cuatro proveedores y el rango de
plazos 2-21 **cuadran todos**. Cero invenciones.

> ⚠ **El arreglo se validó SIN recorte** (25 > 11). **La instrucción anti-especulación
> para más de 25 resultados sigue sin ejercitarse.**

---

## PANEL-01, y por qué su veredicto no dice nada del modelo

**Escaló 3/3.** Y como el día 8, **el veredicto no es atribuible al modelo** — esta vez por
un mecanismo peor:

**C1 corre `npm test`, o sea la suite entera, contrato incluido.** Mis cuatro selectores de
navegación iban sin anclar (F-077), así que tiñeron de rojo **C1 y C2 a la vez, en los tres
intentos**. Con los selectores corregidos, **el mismo artefacto pasa 20/20**.

**El reparto del día, y es el dato incómodo: cuatro defectos míos y uno del modelo.**

| Defecto | De quién | ¿Lo cazó C2? |
|---|---|---|
| Cuatro selectores sin anclar (F-077) | **mío** | sí, y por eso escaló |
| Aserto de aislamiento sobre la página entera (F-080) | **mío** | no, lo cazó el e2e |
| `\b0\b` sobre un `textContent` concatenado | **mío** | sí |
| Afirmar que no había métricas sin mirar el CSV (F-078) | **mío** | — |
| **Bucle infinito de consultas (F-079)** | **del modelo** | **NO** |

**Y el único defecto real era el grave.** El `useEffect` de carga dependía del **objeto**
`now`, y `App.tsx` construye `now={new Date()}` en el render a propósito. Identidad nueva
cada render ⇒ **una consulta por render, sin fallar ni avisar**, en la primera pantalla
después del login. Medido: 5 llamadas en 5 renders. Arreglado dependiendo del **día** y
leyendo el valor de una `ref`. **El contrato no lo cazaba porque pasa un `now` constante**;
lleva ya el test de regresión que lo reproduce.

**La cifra del objetivo 4: `+21 / −3` sobre 237 líneas, con `Panel.module.css` SIN TOCAR
—1 de 2 ficheros—. Y de las 21 añadidas, 17 son el comentario: el cambio funcional son
cuatro líneas.**

---

## Lo que PANEL-01 obligó a decidir, y es lo más transferible del día

**De los diez números que pide el spec, TRES no tienen fuente de datos**, comprobado contra
el esquema antes de escribir una línea:

| Métrica | Por qué no existe |
|---|---|
| Visitas (30d), §4.3 | **No hay tabla de visitas.** INV-01 ya lo resolvió igual el día 3 |
| Hilos sin leer, §4.4 | **No hay ningún registro de lectura.** Es F-027 (a) |
| Favoritos del mes, §4.6 | `created_at` existe, pero `favorites_select_own` (`0005:67`) restringe a `member_id = auth.uid()`: **devolvería 0 en silencio** |

**Van con guion, decidido por el PO.** Y el motivo importa: `RNG-PANEL-02` dice que las
cajas se ven *"incluso en valor 0 … para reforzar que el dato está actualizado y no
ausente"*. **Esa regla convierte un 0 en una afirmación.** Pintar 0 donde no hay fuente no
sería un hueco: sería mentir con el respaldo del spec, en la primera pantalla que se ve al
entrar. `panel.ts` lo impone en el **tipo** — `visits: null`, no `number`.

**Y una corrección de premisa mía:** pregunté al PO cómo definir *"consulta sin
respuesta"* dando por hecho que el esquema no lo modelaba. **Sí lo modelaba desde el día
2**: `estado_consulta` con su índice parcial (`0003:137-139`, `0003:175`). Las dos
definiciones daban números distintos — un `MENSAJE` de cortesía cuenta como respuesta en
una y no en la otra.

---

## Hoy toca — Día 10

`Plan §3`, filas del día 10 — **son dos, las dos de Claude Code**:

| Trabajo | Ejecuta |
|---|---|
| **Contraoferta / modificación de oferta** | Claude Code |
| **"Consultar Seleccionados": SRCH-01 → creación de hilo (GAP-004)** | Claude Code |

**No lleva fichero de decisiones propio** (`CLAUDE.md` §ritual: solo los días 4, 8 y 9).

**Lo que hay que tener delante antes de empezar:**

1. **`handleConsultSelected` es hoy un cuerpo VACÍO** en `SearchResults.tsx`, con el hueco
   anotado. El botón existe desde el día 6 porque está en el HTML aprobado.
2. **La contraoferta toca la máquina de estados de la oferta**, de las piezas que
   `CLAUDE.md` §3 asigna a Claude Code por coste del fallo. `Superada por contraoferta` ya
   existe en `0003:132`.
3. **Un aserto negativo y su ancla positiva van en el MISMO `it`** (F-074).
4. **Un selector por rol se elige contra el nombre accesible REAL** (F-077), que se imprime
   en treinta segundos con un sondeo. No contra lo que uno cree que renderiza.
5. **Mirar la CI antes de encadenar pushes** (F-076), no al final del día.
6. **El día 10 no necesita el arnés**, y menos mal: la clave del Coder está rotada.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`. **⚠ Clave ROTADA: el arnés no puede correr hasta que el PO la reponga** | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React. **VERA en producción: Sonnet 4.6, fijo (QA-A00-06)** | Plan §1 y §7 |
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

1. 🔴 **La `DEEPSEEK_API_KEY` está rotada.** Sin ella **el arnés no puede correr**. El día
   10 no lo necesita —sus dos filas son de Claude Code— pero el 11 sí.
2. 🟠 **Despliegue · sigue esperando tus clics.** Decidido el 12-ago: **Vercel, con semilla
   de demo, la semilla solo en *Production*, URL sin indexar y muerte en V1**. El repo lleva
   las tres piezas del no-indexado y el runbook en **`openspec/mvp/despliegue.md`**. Los
   cuatro valores por defecto de Vercel están mal: Root Directory **`app`**, rama
   **`mvp/bootstrap`**, nombre **`bearingworld`** y las tres `VITE_*`.
   **⚠ Quedan DOS días para la sesión con el socio y sigue sin haber URL viva.**
3. 🟠 **`npx supabase link --project-ref troxminloxkjwihwfevs`** — pide la contraseña de la
   base. **Y ojo (F-073): la CLI está logueada en la cuenta equivocada** —la de
   `web-julsaindustrial`, org `mjxnlvvrnjuuawlxkmte`—; el MVP vive en `ujatcozvbspkycepemfq`.
   Por eso los despliegues de la Edge Function van por el MCP.
4. 🟠 **¿Se prueba VERA con más de 25 resultados antes del día 11?** Es lo único de F-075
   que quedó sin ejercitar.
5. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
6. **F-027 (a)** (no leídos de MSG-01) y **F-023 d** (línea eliminada en INV-01). Los dos de
   V1 y pendientes desde hace días. **F-027 ya ha costado una caja con guion en PANEL-01.**

---

## Riesgo con la vista más corta

**El primero es de calendario y ya no admite más aplazamiento: quedan DOS días para la
sesión con el socio y la app sigue sin URL desplegada.** Vamos un día por delante del plan,
así que hay colchón — pero el colchón no despliega nada. **Todo lo que falta son clics en
la cuenta de Álvaro.**

**El segundo es que el arnés está parado por la clave rotada.** No bloquea el día 10;
bloquea el 11.

**El tercero es el que más enseña, y es sobre el instrumento, no sobre el modelo.** De los
cinco defectos de PANEL-01, **cuatro fueron míos y uno del modelo — y el del modelo fue el
único grave, y C2 no lo vio.** El contrato de aceptación escaló la corrida por selectores
rotos mientras dejaba pasar un bucle infinito de consultas contra la base.

> **La conclusión operativa, para el día 10:** el contrato de aceptación mide bien lo que se
> le ocurrió a quien lo escribió, y nada más. **Lo que atrapó el defecto real fue leer el
> artefacto entero a mano**, y lo que atrapó el segundo fue correr la suite e2e completa.
> Ninguna de las dos cosas es automática. Presupuestar tiempo para las dos.

---

*Cerrado el 13-ago-2026 08:30 · Claude Code (Opus 5)*
