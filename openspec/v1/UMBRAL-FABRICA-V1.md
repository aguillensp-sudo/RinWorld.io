# Umbral de la fábrica — el criterio de cierre del H1

> **Escrito ANTES de medir nada.** 11-sep-2026, con el corpus en seis tareas, sin una sola
> línea escrita de las tres pantallas de la prueba y sin sus tareas. Las tres se confirmaron
> ese mismo día, también antes de correr nada (§1). Los dos commits —el del umbral y el de
> la confirmación— son anteriores a la primera corrida, y esa precedencia es comprobable con
> `git log`. **Un umbral escrito después de ver el resultado no es un umbral: es una
> justificación.**

> **Por qué existe este fichero.** El plan V1 v2.3 pone el H1 en la semana 3 con este
> criterio: *«Tres pantallas construidas y aceptadas, con su coste y su tiempo por pantalla
> registrados. A partir de aquí el plan deja de estimar y empieza a extrapolar»*. Y su tabla
> de riesgos añade la condición que este documento cumple: *«La fábrica de pantallas no
> rinde | MEDIO | Se pone a prueba en la semana tres con tres pantallas reales y **umbral
> escrito de antemano**»*. El umbral no existía. Ahora existe, y con él el H1 pasa a ser una
> medición con un sí y un no, en vez de una impresión.

---

## 1 · Qué se mide, y sobre qué

La unidad es **una pantalla**, y una pantalla son cuatro cosas, en este orden:

1. Su capa de datos, **escrita a mano y entregada**, no solo declarada. Es la práctica que
   ya siguen las seis tareas del corpus (`_nota_data_layer` de `SRCH-01.json`) y la que hace
   que el generador no toque criptografía (Plan §4.3).
2. Su **tarea en formato fijo**, que pasa `--seco` sin error.
3. Sus **tests de aceptación**, escritos antes de que el Coder vea la tarea y que el Coder
   no ve.
4. Una **corrida del arnés** y su **revisión humana**.

### Las tres pantallas se eligen antes, y se escriben aquí

**Regla, no preferencia.** Las tres se nombran en este fichero **antes** de la primera
corrida, y cumplen las tres condiciones siguientes:

- Son pantallas **pendientes para V1**: de las 24 que el Plan §3.2 deja sin construir. No
  vale remedir una de las siete del MVP: sobre corpus conocido la fábrica ya se sabe que
  rinde, y eso no es lo que el H1 pregunta.
- Son de **tres módulos distintos**. Tres pantallas del mismo módulo comparten capa de
  datos, vocabulario y forma, y medirían una sola cosa tres veces.
- Tienen **diseño aprobado y spec escrita** en `openspec/design-gui/specs y html
  aprobados/`.

**CONFIRMADAS POR EL PO EL 11-SEP-2026, antes de la primera corrida.** Son estas tres, y
no se cambian a partir de aquí:

| Pantalla | Módulo | Spec | Qué le hace falta a su capa de datos |
|---|---|---|---|
| **`DIR-01`** · Directorio de Organizaciones | 04 · Mensajería/Directorio | 167 líneas | ⚠ **Corregido el 11-sep, al escribir su capa de datos: NO corría sobre `organizations` tal como estaba.** Dos de las cinco columnas de su tabla —Teléfono y Email— no existían en el esquema. Las añade `0027`, con sus dos `CHECK` y metidas en `app.guard_organization_columns`, porque una columna nueva no entra sola en ese guardia y nacía editable por cualquier ADMIN. Sigue siendo la más barata de las tres —dos columnas frente a un módulo de foro sin una sola tabla— pero **no era gratis, y la frase anterior se escribió mirando las columnas de la tabla sin cruzarlas con las que la spec pinta**. Su forma —tabla con filtros, orden por cabecera y paginación— sí es la de `SRCH-01` e `INV-01`: **es la única comparable con algo ya medido** |
| **`ADMIN-01`** · Panel de Aprobación del Operador | 01 · Alta de empresas | 187 líneas | Campos nuevos. La tabla de solicitudes pide más de lo que `organizations` guarda hoy: `status` existe, el resto de la solicitud no |
| **`FORO-01`** · Lista de Categorías del Foro | 08 · Foro | 154 líneas | Tablas nuevas enteras: el foro **no tiene ni una** en las 26 migraciones. Es además la única parte no cifrada del producto, así que no arrastra ninguna decisión de criptografía |

**La mezcla es deliberada, y el PO la eligió sabiendo lo que cuesta.** Una pantalla sobre
esquema existente, una con campos nuevos y una con tablas nuevas. Si las tres corrieran
sobre lo que ya existe, la fábrica se mediría en su caso más cómodo y el número no se
parecería al trabajo real de las 24 pantallas que quedan. Eso alarga el paso 2 de §7, y ese
alargamiento **es el precio de que la cifra sirva para extrapolar**, que es lo único que el
H1 existe para conseguir.

**Y por qué NO están las tres que se propusieron primero, que es parte del registro.**
`REG-07` se cayó al leer su spec: es *Generación de Claves y Almacenamiento de Backup*, o
sea criptografía, y el Plan §4.3 tiene decidido que el generador no la toca — medir la
fábrica con ella habría medido otra cosa, y se propuso sin haber leído la spec. `INV-02`
(procesamiento y mapeo de columnas con confirmación humana) se cayó por el motivo
contrario: es de las pantallas más complejas del producto y mediría el techo, no la media.

---

## 2 · Qué cuenta como «construida y aceptada»

| Puerta | Quién la da | Dónde queda registrada |
|---|---|---|
| C1 a C4 | El arnés | Una fila en `harness-metrics.csv`, con coste, minutos e intentos |
| C5 · aceptación | **El PO, a mano** | Una fila en `harness-review.csv`, con la corrección humana medida y el veredicto en `nota` |

**C5 no se deduce de C1–C4.** Las 143 filas del CSV terminan hoy con la nota *«C5 lo da el
PO»* y en ninguna consta que se haya dado: por eso el H1 sigue abierto aunque haya siete
pantallas medidas. Una pantalla verde que el PO no ha mirado **no cuenta** para este hito.

---

## 3 · Las ocho cifras, y de dónde sale cada umbral

Ninguna cifra de esta tabla es redonda por gusto. Cada una dice de dónde sale, y las que
salen de un juicio y no de un dato lo declaran.

| # | Cifra | Umbral | De dónde sale | Qué decide |
|---|---|---|---|---|
| 1 | Pantallas aceptadas | **3 de 3** | El criterio literal del H1 | Si el hito se cierra |
| 2 | Corridas sin escalada | **3 de 3** | El arnés escala al humano al tercer intento sin verde | Si la fábrica **produce** o solo **asiste** |
| 3 | Verdes limpias al primer intento | **≥ 2 de 3** | Las series 17 y 18 dieron 5/5 y 4/5 con `n=5`, pero **sobre corpus conocido**; sobre pantalla nueva se exige menos a propósito | Si el coste por pantalla es estable o depende de la suerte |
| 4 | Corrección humana | **Mediana ≤ 10 %** de las líneas del artefacto, y **ninguna > 25 %** | Los **dos únicos** puntos válidos tras arreglar el bucle: VND-01 `+0/−0` (0 %) y LOGIN-01 `+8/−2` sobre 241 (4,1 %). El 10 % deja aire para una pantalla más dura; el 25 % es el punto en que revisar cuesta más que escribir, y **eso es juicio, no medida** | Si la revisión de una persona escala a 24 pantallas |
| 5 | Ficheros sin tocar en la revisión | **≥ la mitad**, en cada una de las tres | En el MVP fue de 0 de 4 (MSG-01, bucle roto) a 4 de 4 (VND-01, bucle arreglado) | Lo mismo que la 4, por otra vía: mide dispersión, no volumen |
| 6 | Coste del generador | **≤ 0,25 $** por pantalla aceptada, reintentos incluidos | El MVP entero costó 0,41 $ para siete pantallas (0,06 $ cada una). El tope es cuatro veces eso | **Nada.** Es el nodo barato y se sabe. Se registra para no perder la serie |
| 7 | Coste de orquestación | **Mediana ≤ 50 $** de coste-sombra por pantalla, **ninguna > 100 $** | El plan estima 1.500–4.500 € para TODA la orquestación de V1 y llama a esa cifra su estimación menos firme. Punto medio 3.000 € ≈ 3.300 $; un tercio para la fábrica ≈ 1.100 $ entre 24 pantallas ≈ 46 $ | **Esta es la cifra que importa.** Si se pasa, la partida de modelos del plan no se sostiene y hay que rehacerla antes de la semana 6 |
| 8 | Tiempo de reloj | **≤ 1 jornada** por pantalla, de tarea validada a C5 dada | El propio plan fija el límite de cuatro agentes porque *«cuatro es aproximadamente lo que una persona puede revisar bien en un día»*. Una pantalla por jornada es ese techo con cuatro veces de margen | Si las 21 semanas se sostienen |

> **El tiempo se mide sin las esperas del PO.** El reloj para cuando la pantalla queda lista
> para C5 y arranca otra vez cuando el PO responde. Medir la agenda de una persona como si
> fuera rendimiento de la fábrica mezcla dos cosas que se arreglan de maneras distintas.

---

## 4 · La regla de decisión

Se evalúa **una sola vez**, con las tres pantallas terminadas, y el resultado se escribe en
`ESTADO-V1.md` §1 con las ocho cifras al lado. Los tres veredictos son los tres escenarios
de calendario del propio plan, para que la medición decida algo y no solo informe:

| Veredicto | Condición | Consecuencia en el plan |
|---|---|---|
| **La fábrica rinde** | Las ocho cifras dentro de umbral | Escenario favorable, 18 semanas. La corriente B se abre con cuatro agentes |
| **Funciona con supervisión** | Las tres aceptadas, pero falla la 3, la 4 o la 5 sin pasar de `mediana 25 %` ni de una escalada | Escenario base, 21 semanas. La corriente B se abre con **dos** agentes, no cuatro, y se remide al llegar a seis pantallas |
| **No rinde** | Menos de tres aceptadas, o mediana de corrección > 25 %, o dos escaladas o más, o la cifra 7 por encima de 100 $ de mediana | Escenario adverso, 30 semanas. Las pantallas se construyen asistidas a mano y **el plan se rehace antes de la semana 6**, que es cuando se contrata la auditoría y deja de haber margen |

---

## 5 · Las cuatro reglas que impiden hacerse trampas

Salen de errores que este proyecto ya cometió, no de teoría.

1. **Las tres pantallas se eligen antes** (§1). Elegir después de ver cuál salió bien es
   medir la suerte y llamarlo rendimiento.
2. **La que falla, cuenta.** No se sustituye una pantalla por otra a mitad de la prueba. Si
   una escala al humano, el resultado es «escaló», y la cifra 2 lo recoge.
3. **No se repite una corrida para quedarse con la mejor.** Si hay que repetir por un fallo
   del arnés y no del Coder, se repite entera **y se dice en `nota` por qué**, con el
   hallazgo abierto en `findings-register.md`. Es lo que se hizo con `F-114` y con `F-118`:
   una corrida cuyo veredicto no depende del artefacto no mide al Coder.
4. **La tarea no se toca a mitad.** Si aparece un `F-116`/`F-118` —el contrato pide de más,
   o el repo ha avanzado por delante de la tarea— la prueba se **para**, se arregla la
   tarea, y las tres pantallas se corren otra vez desde el principio. Una vara de medir que
   cambia a mitad de la medición no mide.

---

## 6 · Lo que este umbral NO mide

Sección obligatoria, misma regla que `ESTADO-V1.md` §6.

- **La corrección humana tiene una muestra de dos.** Solo VND-01 y LOGIN-01 se revisaron
  con el bucle ya arreglado; las otras cuatro filas de la tabla del MVP se midieron con el
  instrumento roto y no valen como base. Los umbrales 4 y 5 se apoyan en dos puntos y en
  juicio. **Es exactamente la razón por la que existe el H1**, y por eso el hito no se cierra
  con menos de tres pantallas.
- **No mide la calidad de lo que sale, solo cuánto hay que corregirlo.** Una pantalla que
  nadie toca porque nadie la miró bien pasa este umbral. C5 es la única defensa contra eso,
  y C5 es un juicio humano sin métrica.
- **No mide el coste de escribir la tarea ni los tests de aceptación**, que los escribe
  Claude Code antes y que en el MVP fueron trabajo real. Entran en la cifra 7 solo si se
  hacen en la misma sesión; si se hacen en otra, quedan fuera y la cifra 7 sale **baja**.
  Conviene hacerlos en la misma sesión, precisamente por eso.
- **La cifra 7 no es dinero que se pague.** Es coste-sombra a tarifa publicada, calculado
  sobre las transcripciones. Sirve para extrapolar y para comparar sesiones entre sí, no
  para conciliar una factura.
- **Y su instrumento acaba de demostrar que es frágil.** `F-157`: hasta hoy, cada pasada
  del medidor borraba las sesiones cuya transcripción ya no estaba en disco. Está
  arreglado y fijado con una prueba, pero **lo que ya se podó antes de medirse no vuelve**.
  Si una de las tres pantallas se construye en una sesión que nadie mide a tiempo, su cifra
  7 no existe y no se puede reconstruir.
- **Si el ritmo de gasto de orquestación de estas tres semanas se parece al de las 21.**
  Los 550 $ de V1 en 16 días de calendario dan unos 34 $/día; a ese ritmo, las 21 semanas
  del plan salen por encima de los 4.500 € que el plan pone como techo de TODA la
  orquestación. **No es una predicción:** estas primeras semanas han sido de auditoría y de
  documento, donde el modelo caro hace casi todo, y la fase de fábrica mueve trabajo al
  generador barato. Justamente por eso importa medir las tres pantallas: son las primeras
  sesiones con la forma que tendrán las 24.
- **No dice nada sobre las 21 pantallas restantes.** Tres pantallas de tres módulos son
  mejor muestra que tres del mismo, pero siguen siendo tres de veinticuatro. La regla de
  decisión del escenario base incluye una remedición a las seis por este motivo.

---

## 7 · Precondiciones antes de la primera corrida

Ninguna de las cuatro es opcional, y ninguna depende de nadie de fuera.

1. ~~El PO confirma las tres pantallas de §1.~~ **Hecho el 11-sep-2026: `DIR-01`,
   `ADMIN-01` y `FORO-01`.**
2. **Sus tres capas de datos, escritas a mano y entregadas.** Es la condición que la
   corriente B ya tenía escrita: se abre cuando la corriente A publica el contrato de datos
   de cada módulo. ~~`DIR-01`, `ADMIN-01` y `FORO-01`.~~ **LAS TRES HECHAS el 11-sep**, cada
   una con su migración, su capa de datos a mano, su prueba de unidad, sus asertos de
   esquema y su siembra de demo: `0027` para `DIR-01` (dos columnas), `0028` para
   `ADMIN-01` (tres tablas, un actor nuevo y dos disparadores) y `0029` para `FORO-01`
   (tres tablas, una vista con `security_invoker`, dos disparadores y las cuatro categorías
   de lanzamiento como producto). Las tres verificadas contra un Postgres desechable ANTES
   de aplicarse y releídas del catálogo después, en las dos bases.
   ⚠ **`ADMIN-01` tiene DOS dependencias que no son capa de datos, y sin las dos su prueba
   de extremo a extremo no puede existir.**
   **(a) Una cuenta de Operador de Plataforma.** `0028` no crea ninguna a propósito —una cuenta es
   credenciales, y eso lo decide el PO, como con `E2E_EDITOR_*` el 5-sep—. Sin ella la
   pantalla no se puede ver ni probar de extremo a extremo, y su tarea del paso 3 no puede
   declarar ningún test e2e que la ejercite.
   **(b) Una rama de sesión para quien no tiene organización.** Descubierto el 11-sep
   leyendo `App.tsx:117`: hoy, cualquier usuario autenticado sin fila en `members` acaba en
   la pantalla de login con el mensaje *"La cuenta existe pero no está asignada a ninguna
   organización. Habla con el operador."* — que es exactamente lo que le diría **al
   operador**. `session.ts` ya distingue ese caso (`status: 'orphan'`), así que el arreglo
   es corto: consultar `platform_operators` cuando no hay miembro y devolver un estado
   propio. **Es trabajo de corriente A, escrito a mano, no del generador**, y toca el shell,
   así que se hace a propósito y no de paso.
3. **Sus tres tareas en formato fijo**, validadas con `--seco`. Con ellas el corpus pasa de
   seis a nueve, camino de las diez a quince que el plan declaró objetivo no alcanzado del
   MVP y asignó a este mismo hito.
4. ~~`python -m harness.core.orchestration_metrics` corrido, para que la cifra 7 tenga
   línea base.~~ **Hecho el 11-sep-2026, y de paso salió `F-157`:** el medidor borraba su
   propia historia en cada pasada —once filas de agosto, 387 $ ya medidos, desaparecidas en
   una ejecución normal— porque reescribía el fichero entero con lo que quedaba en disco.
   Arreglado el mismo día (funde por sesión en vez de reescribir) y la historia restaurada.
   **Línea base: 21 filas, 887,77 $ de coste-sombra acumulado, de los cuales 550,25 $ son
   de V1** (desde el 27-ago). ⚠ **Y una consecuencia para esta medición: el medidor se
   corre ANTES y DESPUÉS de cada una de las tres pantallas**, no al final de las tres. Una
   transcripción podada es una medida que ya no existe.

---

*Escrito el 11-sep-2026, Día 14 de V1, antes de medir · Dirección Técnica, Nortex Systems*
