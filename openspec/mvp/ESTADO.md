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
> **Corolario que este fichero lleva seis días pagando (F-024).** Una advertencia de aquí
> sin puntero se comprueba antes de actuar. **Hoy volvió a pagar, y esta vez contra el
> propio fichero:** la tabla de decisiones vivas seguía diciendo *"Cierre del hilo ·
> **Irreversible** … no se reabre escribiendo porque no se puede escribir"* mientras la
> cabecera del mismo documento registraba la decisión contraria del PO. Quien hubiera leído
> solo la tabla habría hecho desaparecer el campo de mensaje en MSG-02 —que se construía
> ese mismo día— y con él la reapertura. **Corregido y con su puntero.**
>
> **Y el corolario nuevo del día 7, que vale para todo lo que se escriba a partir de aquí:
> un aserto negativo no mide nada por sí solo.** Nueve de los 67 asertos del contrato de
> MSG-02 pasaban en verde contra un componente que no pintaba nada, y entre ellos estaba el
> de la frontera del zero-knowledge. Un aserto que dice *"esto NO está"* lo cumple una
> pantalla vacía: necesita **un ancla positiva delante** y **un ámbito acotado**. Los tres
> fallos propios de hoy fueron los tres el mismo defecto (F-058, F-059).

**Día 7 de 15 · cerrado 11-ago-2026 · Estado: VERDE. Los dos bloques del día cerrados,
la CI en verde los tres trabajos, y por primera vez el día se cierra sin nada bloqueando
al siguiente**

> **La CI está entera en verde.** Corrida `31521288138`: `Esquema` ✅ · `App · typecheck,
> Vitest, build` ✅ · `Playwright · puerta de las dos cuentas` ✅ **47/47**. Y en local, lo
> mismo más la suite de esquema y el verificador de Realtime.

---

## Dónde estamos

`Plan §3`, filas del día 7: *"**MSG-02** (hilo) — la pantalla más compleja"* y *"**Realtime**:
hilos y mensajes propagando entre sesiones"*. **Los dos cerrados.**

| Bloque | Ejecuta | Resultado |
|---|---|---|
| MSG-02 · decisiones previas | Claude Code | **D-07-04** y **D-07-05**, las dos del PO. Sin ellas la tarea no se podía escribir |
| MSG-02 · capa de datos | Claude Code | `lib/thread-detail.ts` con **la costura de descifrado**. 20 asertos |
| MSG-02 · contrato de aceptación | Claude Code | **67 asertos**, en rojo entero antes de lanzar. Nueve hubo que anclarlos (F-058) |
| MSG-02 · corrida del arnés | Arnés | **Escalada 3/3.** $0,067393 · 22,8 min · un truncado (F-005) |
| MSG-02 · revisión a mano | Claude Code | **`+68 / −55`** sobre 1437 líneas. **Seis de los ocho ficheros sin tocar** |
| MSG-02 · cableado + e2e | Claude Code | `App.tsx` posee `openThreadId`. Seis escenarios e2e nuevos |
| Realtime · esquema | Claude Code | Migración **0011**, aplicada al remoto. La publicación estaba **vacía** (F-061) |
| Realtime · cliente | Claude Code | `lib/realtime.ts`, cableado en MSG-01 y MSG-02. 10 asertos |

**Verificaciones, todas de hoy y todas en local:**

| Verificación | Estado |
|---|---|
| `cd app && npm run typecheck` | **limpio** |
| `cd app && npm test` | **373 pasan** (20 ficheros) |
| `cd app && npx playwright test` | ✅ **47/47** contra el Supabase real |
| `cd app && npm run check:palette` | cobertura completa |
| `cd app && npm run build` | verde |
| `bash supabase/tests/run.sh` | verde, con los dos asertos nuevos de Realtime |
| `node app/scripts/check-realtime.mjs` | **verde · 563 ms a través de RLS, sin dejar rastro** |
| `python -m harness.tests.test_checks` | **52/52** |

---

## Lo que hay que saber de MSG-02

**La pantalla está en `app/src/screens/messages/`** —`Thread.tsx` es la pantalla;
`ThreadHeader`, `ThreadHistory` y `ThreadComposer` son presentacionales— y **comparte ítem
de nav y subtítulo de VERA con MSG-01**: las dos son `Hilos` (MSG-02 §2) y
`Agente de mensajería` (MSG-02 §5). Son el mismo sitio del shell; lo que cambia es qué se
pinta dentro, y por eso `App.tsx` necesita `openThreadId` además de `nav`.

**⚠ TRES DESVIACIONES CONTRA SU PROPIA SPEC, y las tres están en
`Dia-07_decisiones_producto.md`, que se lee ANTES que la spec de pantalla:**

- **El campo de mensaje NO desaparece en un hilo cerrado** (D-07-01). La §6 dice lo
  contrario, y si desapareciera nadie podría volver a escribir y la reapertura de 0009 no
  ocurriría nunca. Hay un e2e que lo prueba contra el hilo cerrado real de Anadolu Rulman.
- **`Marcar acuerdo alcanzado` se pinta deshabilitado, siempre** (D-07-04). No es estilo:
  `thread-lifecycle` alcanza ese estado aceptando una oferta
  (`messaging-and-negotiation/spec.md:195`) y `app.guard_thread_state` levanta excepción ante
  cualquier otro valor puesto desde el cliente (`0007:246`). **El botón activo reventaría en
  ejecución, con un mensaje de Postgres delante del socio.**
- **No hay contenido descifrado** (D-07-05). Ver la costura, abajo.

**El badge de país es el ISO de dos letras** (§3). El HTML aprobado escribe `Alemania` y es
el mock: manda el spec, como en F-041.

---

## La costura de descifrado, y es lo que hay que entender antes de tocar el día 8

`ThreadItem.content` es `ItemContent | null`, y **`null` no significa "vacío": significa
"cifrado y sin clave en esta sesión"**. Es un estado de primera clase de la pantalla, no un
caso de error.

**Existe porque el `Plan §3` pone la rebanada E2EE el día 8 y MSG-02 el día 7.** Comprobado,
no supuesto: `app/src` no tenía una sola línea de criptografía, `content_ciphertext` es
`bytea not null` y la siembra lleva relleno a propósito (`demo_threads.sql:16`).

- La pantalla pinta **las dos ramas desde hoy**. Hoy solo la opaca tiene datos detrás; la
  otra está cubierta por los tests porque `ThreadHistory` es presentacional y se le puede
  pasar contenido a mano.
- Donde iría el contenido va el literal de la capability, **verbatim y sin botón**:
  `Contenido cifrado — introduce tu frase de seguridad para ver`
  (`messaging-and-negotiation/spec.md:68`). Sin botón por F-027: en el MVP las claves viven
  en memoria de sesión, y pedir una frase que no existe promete recuperación de claves que
  no hay.
- **El envío está deshabilitado con el motivo a la vista.** Enviar exige producir ciphertext
  y no hay con qué.
- **`fetchThreadItems` SÍ se trae el blob**, y `threads.ts` decidió lo contrario a propósito
  para MSG-01. No es incoherencia: en la vista previa el blob no se puede enseñar nunca, aquí
  el contenido **es** la pantalla, y traerlo desde hoy es lo que hace que la costura sea real.

**El día 8 se rellena `decryptItem()` y no se toca ningún `.tsx`.** Si alguien se encuentra
editando un componente, la costura estaba mal puesta y eso es lo que hay que releer.

---

## Lo que hay que saber de Realtime

**El principio, y es toda la decisión de diseño: un evento es una SEÑAL PARA RELEER, nunca
una fuente de datos.** No se mira el payload. Llega un evento y la pantalla vuelve a
preguntar. Tres razones, ninguna es purismo:

1. **El estado del hilo lo deriva la base** (0007). Dos navegadores mezclándolo a mano
   discreparían y ganaría el último que escriba — F-044 otra vez.
2. **El orden de llegada no es el orden de los hechos.** Dos eventos de dos tablas llegan por
   el mismo socket sin garantía de orden. Una relectura no tiene ese problema.
3. **Una relectura pasa por RLS entera y por la costura.** Mezclar un payload se salta las dos.

- **0011** publica `threads` y `thread_items`, y solo esas dos. **No toca la
  `REPLICA IDENTITY`, y es una decisión:** `FULL` mandaría el `content_ciphertext` **viejo**
  en cada UPDATE, a todos los suscriptores que pasen RLS, a cambio de un evento DELETE que
  este MVP ni produce ni escucha. Hay un aserto que protege esa decisión.
- **MSG-01 se suscribe sin filtro a propósito.** El filtro de `postgres_changes` es un único
  `columna=op.valor` y hace falta `org_low_id = yo OR org_high_id = yo`. Media lista es peor
  que ninguna: **filtra RLS**, que es donde tiene que estar.
- **MSG-02 escucha también `threads`**, una fila que el navegador no escribe nunca — la mueve
  el trigger de 0007 cuando la otra parte acepta. Sin eso, el historial se actualizaría y la
  cabecera no.
- **Agrupa a 120 ms**, porque una sola acción produce dos eventos, y **la baja cancela la
  relectura pendiente**, que es lo único que de verdad se rompe al desmontar.

---

## Lo que el arnés midió hoy, y lo que no

**Una corrida, tres intentos, $0,067393** ($0,080196 en frío). Las tres filas están en el CSV.

| | MSG-02 |
|---|---|
| Coste real | **$0,067393** |
| Tiempo | 22,8 min |
| Truncados (F-005) | 1, en el intento 1 |
| Veredicto | **Escalada 3/3** — tercera pantalla seguida |
| Checks | C3 y C4 **verdes los tres intentos**; C1 y C2 rojos los tres |

**⚠ Estas tres filas miden a medias, y hay que leerlas con eso delante.** De los cuatro
fallos de C2, **dos eran defectos de mi contrato, no del artefacto** —dos asertos sin
ámbito—. Los defectos reales fueron tres:

1. **`closeThreadWithoutAgreement` y `revertAgreement` importados de `thread-detail`**, y
   viven en `offers`. Como el `catch` de cada handler se lo traga, **cerrar y revertir no
   hacían nada y lo decían con un banner de error**: dos de las tres acciones del hilo,
   muertas en silencio.
2. Un **`busy` de estado que nadie leía** (`TS6133`) → cero protección contra doble clic,
   justo el día que entra Realtime y `setOfferState` documenta esa carrera.
3. **La fecha de validez pintada en crudo**, un ISO entero en la cara del usuario. **Ningún
   check podía verlo**: vive en la rama descifrada, que no se ejercita hasta el día 8.

**Lo bueno, y es la cifra que importa para el objetivo 4: seis de los ocho ficheros salieron
sin tocar, incluidos los cuatro CSS enteros —690 líneas—.**

### ⚠ Y LO QUE ESTE FICHERO DECÍA DEL MODELO ERA FALSO. Léelo antes de sacar conclusiones

Al cerrar el día, esta sección afirmaba *"el modelo recibió la salida exacta de `tsc` en los
intentos 2 y 3 y no la resolvió"*, y lo daba como el tercer caso de la misma forma que F-036.
**Se comprobó esa misma noche y no se sostiene (F-064).**

**El reintento del arnés no le enseña al Coder el código que escribió.** `coder_node` arma dos
mensajes —la tarea, idéntica a la del intento 1, y *"produce los ficheros ahora"* más la salida
cruda de los checks— y **no hay turno de asistente con el artefacto anterior**. El modelo
recibe `ThreadHistory.tsx(136,61): error TS2375: …` **sobre un fichero que no está viendo**, y
se le pide regenerar los ocho desde cero.

Lo más incómodo: **el estado ya lo lleva.** `HarnessState.files` está declarado como *"{ruta:
contenido} del último intento del Coder"* y `coder_node` lo devuelve en cada vuelta. El dato
viaja por el grafo y nadie lo vuelve a mandar.

**Qué se cae con esto, dicho entero:** F-036 (día 5), la lectura de la corrida 2 de SRCH-01
(día 6) y la mitad de diagnóstico de F-059 (hoy) **atribuyen al modelo un comportamiento
medido sobre un bucle roto**. Las escaladas ocurrieron y los defectos del artefacto eran
reales; **lo que se cae es la causa**.

**Hasta que el bucle se arregle y se remida, el objetivo 4 no tiene ni un dato en contra del
modelo. Tiene un dato en contra del arnés.** El PO decidió el 11-ago **aplazar el arreglo**:
no entra el día 8 por delante de la rebanada E2EE y VND-01.

**El apunte de método, y es el más caro del registro: antes de concluir nada sobre lo que mide
un instrumento, hay que leer el instrumento.** Tres días de dato acumulado, y bastaban veinte
líneas de `coder.py`.

---

## Hoy toca — Día 8 (12-ago-2026)

`Plan §3`, filas del día 8 — **son dos bloques**, y el primero es de decisiones irreversibles:

| Trabajo | Ejecuta |
|---|---|
| **Rebanada E2EE**: cifrado de campos de oferta en cliente | Claude Code |
| **VND-01** (ofertas del vendedor, metadata-only por RNG-VND-01) | Arnés |

**Léete `Dia-08_decisiones_e2ee.md` antes de escribir una línea.** El día 8 es uno de los tres
días de decisiones irreversibles del plan y la rebanada E2EE toca ADR-001.

**Antes de lanzar el arnés con VND-01:**

1. **`Dia-07_decisiones_producto.md` se lee ANTES que la spec de VND-01** (D-07-02): no se
   pinta `Retirar oferta`, y `EXPIRADA` es una etiqueta de presentación, no un quinto estado.
2. **El contrato tiene que compilar y ejecutarse contra esqueletos vacíos** (F-047) **y su
   rojo tiene que ser TOTAL** (F-058, nuevo hoy). Un aserto que se queda verde contra una
   pantalla vacía no está midiendo nada.
3. **Todo aserto negativo lleva ancla positiva y ámbito acotado** (F-059, nuevo hoy). Los
   tres fallos propios de hoy fueron los tres eso.
4. **Todo literal que ve el usuario va verbatim en la tarea, con sus acentos** (F-048).
5. **Cuando el mock y la spec ofrecen dos caminos, la tarea elige uno explícitamente** (F-049).
6. **`check:palette` verde antes** (F-003).
7. **Commits separados** (`CLAUDE.md` §1.6). El diff del segundo *es* la medida.
8. **Un escalado no se canaliza NI SE LE PONE NADA DETRÁS** (F-060, nuevo hoy). Un `; echo`
   detrás del lanzamiento se lleva el código de salida igual que una tubería.
9. **La capa de datos se entrega, no se declara**, y `inputs.data_layer` ya acepta varias
   rutas (F-057).

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA. El **Coder** para HTML→React, tests Playwright y catálogo sembrado. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 y §7 · `CLAUDE.md` §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Tope de intentos | **3**, y el tercero escala al humano con código de salida 2. | `Dia-04_decisiones_arnes.md` §1 |
| **Formato de tarea** | Congelado el día 4. **Tres desviaciones: `component_api` (día 5), literales verbatim y estado accesible declarado (día 6).** | `Dia-04` §5 · F-034 · F-047 · F-048 |
| **Contrato de aceptación** | Compila, se ejecuta contra esqueletos vacíos **y su rojo es TOTAL** antes de lanzar. Todo aserto negativo lleva **ancla y ámbito**. | F-047 · **F-058** · **F-059** |
| **Estados de oferta** | Los **cuatro** del spec: `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. La última es **terminal** y la contraoferta es **fila nueva**. **El `Plan §7` dibuja otra máquina y no manda** (F-043). | `messaging-and-negotiation` · offer-card |
| **Quién decide una oferta** | **El receptor, nunca el emisor.** Lo acota `app.guard_offer_decider`, y en **invoker** (0010) — en definer no bloqueaba a nadie. | `offer-card` · F-051 · F-056 |
| **Oferta expirada** | **Sigue siendo aceptable.** La fecha informa, no vincula en V1. | `offer-card` · D-07-03 |
| **`RETIRADA`** | **No entra en el MVP.** VND-01 no pinta `Retirar oferta`. Hay un aserto que lo sostiene. | **D-07-02** · F-043b |
| **`shipping_cost` no informado** | `null`, **nunca `0`**. Un cero dice "portes gratis", no "no informado". | `offer-card` |
| Estados de hilo | Los **cinco** del CHECK de 0003. **Derivados en la base desde 0007**; `CERRADO SIN ACUERDO` y la reversión del acuerdo son manuales. | `0003` · `0007` |
| **Cierre del hilo** | **Reversible: un elemento nuevo lo reabre.** Solo el `insert`; un `update` no. Reabre **al estado que digan sus filas**. **Arrastra una regla obligatoria: MSG-02 mantiene el campo de mensaje visible en un hilo cerrado.** | **D-07-01** · `0009` · F-045 |
| **`Marcar acuerdo alcanzado`** | **Deshabilitado siempre, con el motivo a la vista.** La base lo rechaza desde el cliente. | **D-07-04** · `0007:246` |
| **Contenido cifrado** | **Hoy no se descifra nada.** `content: ItemContent \| null`, y `null` = "cifrado sin clave". La rebanada E2EE es el día 8 y **rellena `decryptItem()` sin tocar ningún `.tsx`**. | **D-07-05** |
| **Realtime** | **El evento es una señal para releer, nunca datos.** `threads` y `thread_items` publicadas (0011); **la `REPLICA IDENTITY` no se toca**. | `0011` · F-061 |
| Test-runner | **Sin LLM.** C5 lo da el PO, fuera del grafo. | `Dia-04` §4 |
| Checks | Un check que no se puede ejecutar es **rojo**, nunca ausente. **Correcto para decidir; insuficiente para medir** (F-033). | F-015 · F-033 |
| Integridad | El **Coder** nunca escribe los tests que lo evalúan, **y tampoco los ve**. | `CLAUDE.md` §3 · Plan §6 |
| Autoría | Código del Coder y código a mano **nunca en el mismo commit**. | `CLAUDE.md` §1.6 · F-009 |
| Demo | Referencia **`6205-2RS`** y **seis organizaciones**, solo dos con cuenta. | `guion-demo-y-siembra.md` §1 y §3 |
| Turquía | `continent = 'AS'`, geoscheme de la ONU, para que el chip de zona "Europa" corte. | `guion-demo-y-siembra.md` §3 |
| Precio en SRCH-01 | **Fuera de la parrilla.** No se ordena ni se filtra por precio, nunca. | `conversational-search` · F-040 |
| Watchers | **Fuera** (SRCH-03, `Plan §9`). El botón se pinta **deshabilitado y con el motivo**. | `Plan §9` · F-023 e |
| Alcance | 8 pantallas. **Hechas: shell, INV-01, MSG-01, SRCH-01, MSG-02.** | Plan §9 |
| Monorepo | `openspec/` + `app/` + `supabase/` + `harness/`. Los HTML aprobados no se tocan. | `CLAUDE.md` §2 |

---

## Pendiente de Álvaro

**Ver `openspec/mvp/PENDIENTE-PO.md`.** **Hoy no queda ni un arreglo pendiente de tu parte**;
lo que resta son decisiones de producto y cosas de V1. Por urgencia:

1. 🟠 **El informe de Playwright en `ci.yml`** — (a) dejarlo, (b) subirlo solo al fallar,
   (c) no subirlo. **Yo haría la (b).** Una línea, cuando quieras.
2. 🟠 **F-033 · el CSV no distingue un check en rojo de uno inejecutable.** Con el formato de
   hoy, "intentos hasta verde" no es fiable — y hoy suma otro caso: **dos de los cuatro
   fallos de C2 eran de mi contrato**, no del modelo, y en el CSV son indistinguibles.
3. 🟠 **Diseño de la pantalla de login** (F-016). Es una novena pantalla que nadie planificó
   y **es la primera que ve el socio**. Si quieres algo mejor para el día 11, decídelo con
   margen.
4. 🟠 **Una sola ruta de despliegue de migraciones** (F-054). Hoy hay dos a medias: la CLI sin
   `config.toml` y el MCP, que es la que funciona. No urge, pero no se puede quedar así.
5. 🟠 **F-027 (a) · el recuento de no leídos de MSG-01.** Fuera del MVP; para V1 o se retira
   del spec.
6. **¿Los cinco hilos sembrados son los de la demo del día 11?**
7. **¿Qué hace INV-01 con una línea eliminada?** (F-023 d). No urge.
8. **`auth_leaked_password_protection`** desactivado en Auth. ¿Se activa?
9. **La app no tiene URL desplegada.** Decisión del 7-ago: solo local. **Se retoma antes del
   día 11**, que es la primera sesión de prueba.

---

## Riesgo con la vista más corta

**El primero es que llevamos tres días midiendo al modelo con un instrumento roto, y el
objetivo 4 se ha estado decidiendo con esas cifras.** El arnés lleva tres pantallas escalando
3/3 —MSG-01, SRCH-01 dos veces, MSG-02—, y hasta anoche la explicación que este fichero daba
era del modelo. **No lo es: el reintento no le enseña al Coder su propio código (F-064).** Se
le manda un error con número de línea sobre un fichero que no está viendo y se le pide
regenerar los ocho desde cero.

**Lo que eso deja en pie y lo que tumba:** las escaladas ocurrieron, los defectos del artefacto
eran reales y la medida `+68 / −55` vale. **Lo que no vale es la causa** — y con ella, tres
conclusiones acumuladas (F-036, la corrida 2 de SRCH-01, la mitad de F-059).

**El riesgo real, entonces, no es que el modelo no sirva: es que no lo sabemos, a cuatro días
de la sesión de prueba y a ocho del final.** El experimento limpio es barato —meter los
ficheros del intento anterior en el prompt y relanzar MSG-02 con la misma tarea y el mismo
contrato, ~$0,07 y veinte minutos— y **el PO lo ha aplazado a propósito el 11-ago** para no
meterlo por delante de la rebanada E2EE y VND-01. **Hasta que corra, ninguna decisión sobre el
arnés en V1 debería apoyarse en las cifras de estos tres días.** A favor del arnés, y esto sí
está medido: **seis de ocho ficheros salieron sin tocar y los 690 de CSS estaban bien.**

**El segundo es que la revisión a mano encontró un defecto que ningún check podía ver** —la
fecha en crudo, en la rama descifrada— y **el día 8 esa rama pasa a ser la que se ejecuta**.
La rebanada E2EE va a destapar lo que hoy nadie recorre. Presupuesta tiempo para eso, no solo
para escribir el cifrado.

**El tercero es de calendario y es nuevo: el día 8 tiene dos bloques y uno de ellos es de
decisiones irreversibles** (rebanada E2EE, ADR-001) más una pantalla del arnés. Es el mismo
reparto que hoy, y hoy cupo — pero hoy la mitad de la mañana se fue en decisiones que ya
estaban tomadas y anotadas. Si el día 8 se estrecha, **el orden de recorte del `Plan §9` dice
que se simplifica VND-01, no la rebanada.**

---

*Cerrado el 11-ago-2026 · Claude Code (Opus 5)*
