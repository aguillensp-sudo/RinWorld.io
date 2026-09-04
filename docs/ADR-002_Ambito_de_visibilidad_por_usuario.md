# ADR-002 · Ámbito de visibilidad por usuario dentro de la organización

| | |
|---|---|
| **Estado** | **ACEPTADA** — 25-ago-2026 |
| **Decide** | Álvaro (PO) |
| **Prepara** | Dirección Técnica |
| **Ámbito** | V1. Entra en la **fundación** (corriente A), no después |
| **Relación con ADR-001** | No lo modifica. Añade invariantes del mismo rango en §4 |
| **Modifica** | La suposición implícita del día 2: *«todos los miembros de las dos organizaciones descifran todo»* (`0012:95`) |

> **Regla de este fichero.** Cita, no parafrasees. Todo estado del esquema que se
> afirme aquí se comprobó contra las migraciones el 25-ago-2026, con el puntero al
> lado.

---

## 1 · Por qué existe este documento

Durante la revisión del MVP se detectó que **bearingnet.net permite que cada usuario
de una empresa vea solo las consultas y ofertas en las que ha participado**, y que
bearingworld no tiene esa configuración porque se decidió lo contrario en la fase
funcional.

**El motivo de paridad competitiva no es suficiente por sí solo** y así se hizo
constar. El motivo que sí sostiene la decisión es otro, y es una extensión del
diferenciador:

> BearingNet hace un **filtro de presentación**: su servidor lee todo el contenido y
> decide qué muestra a cada usuario. Bearingworld puede hacer una **garantía
> criptográfica**: el compañero de al lado no es que no vea la negociación, es que
> **no puede** verla, porque la clave de contenido nunca se envolvió para él.
>
> No es alcanzar al competidor. Es ganarle en el único eje donde ya somos
> estructuralmente distintos.

**Se decide en la semana 0 de V1 y no más tarde** porque el reparto de claves se fija
en la fundación. Meterlo después es migración de datos cifrados — *«la peor clase de
migración»*, en palabras del propio día 2 (`0003:265`).

---

## 2 · Lo que ya estaba construido, y no hay que tocar

La mitad cara de este cambio se resolvió el día 2, antes de que nadie lo pidiera.

| Hecho | Puntero |
|---|---|
| La identidad criptográfica es **del miembro**, no de la organización | `members.public_key bytea` · `0001:73` |
| La clave de contenido de cada elemento se guarda **envuelta una vez por cada miembro que debe leerla** | `thread_item_keys`, PK `(item_id, recipient_member_id)` · `0003:269` |
| El acceso a esa clave ya es **por persona** | `item_keys_select_own`: `recipient_member_id = auth.uid()` · `0003:353` |

Y el comentario que dejó escrito el propósito, `0003:265`:

> *«En el MVP hay un miembro por organización y la tabla tendrá dos filas por
> elemento. Existe desde hoy para que el día 8 no sea una migración de datos
> cifrados, que es la peor clase de migración.»*

**Consecuencia:** la visibilidad por usuario **ya es criptográficamente expresable
sin tocar la jerarquía de claves**. Lo que cambia es *para quién se envuelve*, no
*cómo se envuelve*. Hoy `thread_public_keys(t_id)` devuelve todos los miembros de
las dos organizaciones (`0012:97`); a partir de V1 devolverá el conjunto que fije la
§3.

---

## 3 · Decisión

### D-1 · El ámbito es por ELEMENTO, no por hilo

El hilo sigue siendo **por pareja de organizaciones**, con su
`on conflict (org_low_id, org_high_id)` (`0014:167`). Esa decisión no se reabre.

Lo que se restringe es **qué elementos descifra cada miembro**, que es exactamente la
granularidad que `thread_item_keys` ya tiene.

**La lista de hilos pasa a derivarse:** un miembro ve un hilo si tiene al menos un
elemento legible en él. Deja de ser una consulta directa a `threads`.

> ⚠ **Riesgo de rendimiento, y va al Hito 6.** Esa derivación es un join contra
> `thread_item_keys` bajo política de acceso. Los benchmarks oficiales del proveedor
> muestran que el mismo join va de **9.000 ms a 20 ms** según su dirección. Se diseña
> con la dirección que filtra primero, se indexa, y **se mide bajo carga**. No se
> supone.

**Descartado: hilo por pareja de usuarios.** Rompe `create_inquiry`, reabre una
decisión cerrada con motivo y multiplica hilos sin ganar nada que D-1 no dé.

---

### D-2 · El administrador ve el plano de metadatos, y no necesita clave

El ADMIN de una organización **no accede a la conversación**. Ve, en claro y sin
descifrar nada, lo que ya es metadato en `thread_items`:

| Campo | Estado |
|---|---|
| `item_type` (MENSAJE · CONSULTA · OFERTA) | ya en claro |
| `part_number` | ya en claro |
| `brand` | ya en claro |
| `estado_consulta` · `estado_oferta` | ya en claro |
| `sender_member_id` · `sender_org_id` · `created_at` | ya en claro |
| **`quantity`** | **NUEVO — ver D-3** |

**No ve:** el precio, el coste de transporte, la divisa ni el texto de ningún
mensaje. Todo eso vive en `content_ciphertext` y ahí se queda.

**Esto es más limpio que darle la clave:** el ADMIN obtiene supervisión **sin ser
destinatario criptográfico**. La frontera se mantiene intacta.

---

### D-3 · La cantidad pasa a metadato en claro

Columna nueva en `thread_items`. Motivo del PO, textual:

> *«No es lo mismo preguntar 15 unidades del 6205 que preguntar por 20.000. Lo
> segundo es interesante y al menos el ADMIN debe tener consciencia de ello.»*

> ⚠ **Se declara lo que esto ensancha.** La cantidad demandada es el dato de mercado
> más valioso que maneja la plataforma, y al pasar a metadato lo ve **también nuestro
> servidor y lo ve VERA**. Es coherente con que `part_number` y `brand` ya lo sean
> (`RNG-VND-01`), pero es una ampliación consciente de la superficie en claro, no un
> efecto colateral. Queda escrita aquí para que nadie la descubra dentro de seis
> meses.

---

### D-4 · `visibility_scope` es columna propia, soldada al rol en V1

Hoy `role` (`0001:65`, valores `ADMIN` | `EDITOR`, `0001:85`) hace **dos trabajos
distintos**: administrar la organización y supervisar negociaciones.

En V1 se mantienen soldados —el comportamiento es el que pide el PO— **pero no se
implementa sobre `role`**:

```
members.visibility_scope  check (visibility_scope in ('OWN','ORG_METADATA'))
```

- Lo rellena el **trigger** desde el rol: `ADMIN → ORG_METADATA`, `EDITOR → OWN`.
- **Ningún cliente puede pedirlo**, igual que hoy con el rol (`0001:122`).

**Por qué así y no con `role` a secas.** En un distribuidor de tres a cinco personas
administra y supervisa la misma persona, y soldarlos es correcto. En uno de veinte,
la administrativa gestiona altas y facturación mientras el director comercial
supervisa las negociaciones; con una sola columna hay que dar supervisión a quien no
la necesita o poderes de administración a quien no los quiere.

Con columna propia, el día que un cliente lo pida se desacopla **habilitando un
selector: cero migración, cero reescritura**. Es el principio 4 — una decisión de V1
que no escala es deuda, no ahorro.

---

### D-5 · El traspaso de hilos es una acción explícita de quien se va

**Corrección a una suposición que había que romper:** en cualquier SaaS normal,
controlar el buzón es controlar la cuenta. **Aquí no.** La clave privada se deriva de
la **frase de respaldo** con Argon2id, y esa frase vive solo en la cabeza de esa
persona. El ADMIN puede quedarse el correo, restablecer la contraseña y entrar — y el
contenido **seguirá siendo ilegible**, porque restablecer el acceso no reconstruye la
clave. Es el mismo motivo por el que perder la frase propia es perder el historial
propio: no hay puerta trasera, por diseño.

**Por tanto:** existe una acción **«traspasar hilos a…»** que ejecuta **la persona que
se va, mientras aún tiene su clave**, y que vuelve a envolver las claves de contenido
de los hilos elegidos para el ADMIN o para su sustituto.

Con eso la práctica real de la empresa —periodo transicional, cierre ordenado de
temas abiertos— funciona igual que hoy.

---

### D-6 · VERA queda confinada al ámbito de quien pregunta

- A un **EDITOR**, VERA responde **solo sobre lo suyo**.
- A un **ADMIN**, VERA responde además sobre **el plano de metadatos** de D-2: qué
  negociaciones hay abiertas, con quién, sobre qué referencia, en qué cantidad y en
  qué estado.
- **A nadie** le da contenido cifrado, ni precio, ni texto de conversación.

> **Esto convierte las herramientas de VERA en una frontera de seguridad, no solo de
> producto.** `listar_mis_hilos` y `consultar_mi_inventario` pasan a depender del
> ámbito del llamante. Un EDITOR preguntando *«¿qué negociaciones hay abiertas en mi
> empresa?»* tiene que negarse igual que hoy se niega a dar un precio de mercado
> (`B1` del guion).

**Efecto lateral positivo, y no se pidió:** con la cantidad en claro, un ADMIN podrá
preguntar *«¿qué operaciones grandes tenemos abiertas?»* y obtener respuesta. Es
exactamente el tipo de capacidad que el competidor no puede ofrecer con la misma
garantía.

---

### D-7 · El ámbito por usuario es opcional y viene apagado

La organización lo activa si lo quiere. Por defecto, comportamiento actual: todos los
miembros ven todo.

**Motivo:** menos ojos sobre una negociación es respuesta más lenta, y el semáforo de
crecimiento del piloto mide **ofertas por búsqueda**. En un marketplace que vive de la
densidad, imponer confidencialidad interna por defecto trabajaría contra la métrica
que decide si se abre el siguiente anillo geográfico.

Y comercialmente es mejor: la privacidad interna pasa a ser algo que el cliente
**elige**, no algo que sufre.

> ⚠ **Adenda del 3-sep-2026.** Esta decisión llevaba nueve días aceptada sin
> un objeto de esquema que la sostuviera: §5 (Impacto en el esquema) lista
> los siete objetos que el 25-ago ya se habían identificado, y ninguno es un
> interruptor por organización. `visibility_scope` (D-4, `0018`, 1-sep) quedó
> soldado al rol **sin condición, para el 100% de las organizaciones**, y
> nada en el esquema decidía si ese ámbito debía aplicarse. Detectado el
> 3-sep-2026, antes de escribir la política de "Lista de hilos" —no después—
> porque reescribirla tal cual pedía D-1/D-8 habría encendido el ámbito para
> todo el mundo, exactamente lo que este punto prohíbe. Resuelto en la misma
> sesión: `organizations.visibility_scope_enabled boolean not null default
> false` (`0019_threads_visibility_scope_toggle.sql`), octavo objeto de
> esquema, añadido a §5. Lo activa el ADMIN de la propia organización, por la
> misma política que ya gobierna `inventory_visibility_mode` (INV-07,
> `0002`).

---

### D-8 · Un EDITOR no ve nada de sus compañeros

Ni el contenido ni los metadatos. **No ve siquiera que esos hilos existen.**

D-2 fija el techo del ADMIN; esta fija el suelo del EDITOR, y es el suelo más bajo
posible: su lista de conversaciones contiene exclusivamente aquellas en las que él ha
participado.

---

### D-9 · Activar el ámbito es irreversible hacia atrás

Apagar el ámbito **no devuelve claves que nunca se envolvieron**. Los elementos
creados mientras estaba activo seguirán siendo ilegibles para el resto de la
organización, para siempre.

**Por tanto la activación se declara irreversible hacia atrás, y se dice en el momento
de activarla**, no en la ayuda. Desactivarlo solo afecta a los elementos futuros.

---

### D-10 · El traspaso es en bloque, con lista de exclusión

La acción de D-5 se ofrece como **«traspasar todos mis hilos a…»**, con la lista
delante y posibilidad de desmarcar. No hilo a hilo.

**Motivo ergonómico:** el caso real es alguien que se va con treinta conversaciones
abiertas. Hilo a hilo son treinta acciones y se olvidan la mitad.

**Motivo técnico, y pesa igual:** el re-envoltorio ocurre **en el navegador**, que es
donde vive la clave privada. Traspasar treinta hilos es descifrar y volver a envolver
N elementos en el cliente. Sin lotes, la acción tarda minutos y el usuario la
abandona a medias — que es la peor forma de fallar en algo irreversible.

---

## 4 · Invariantes

Del mismo rango que los tres de ADR-001 §8. **Cada uno tiene una prueba automática que
falla si se rompe.** Rozar uno es VIOLA automático, no RIESGO.

| # | Invariante | Cómo se prueba |
|---|---|---|
| **V-1** | Un miembro con `visibility_scope = OWN` **nunca** recibe una copia envuelta de la clave de un elemento en el que no participa | Se siembran dos editores y un elemento; se afirma que `thread_item_keys` no tiene fila para el no participante |
| **V-2** | El ADMIN **nunca** recibe copia envuelta por el hecho de ser ADMIN | Se afirma que ninguna fila de `thread_item_keys` tiene como destinatario a un ADMIN que no participó |
| **V-3** | El precio, el coste de transporte, la divisa y el texto **nunca** salen de `content_ciphertext` a metadato | Volcado de todas las columnas legibles por el servidor; se afirma que ninguna es un campo comercial de esos cuatro |
| **V-4** | VERA **nunca** devuelve una fila fuera del ámbito de quien pregunta | Banco de preguntas con un EDITOR preguntando por hilos de un compañero; la verdad se computa por SQL |
| **V-5** | El traspaso de D-5 **solo** puede originarlo el propio titular de la clave | Se intenta desde la sesión del ADMIN; el servidor lo rechaza |
| **V-6** | Un EDITOR **no obtiene ni un metadato** de un hilo en el que no participa — ni por consulta directa, ni por la lista derivada, ni por VERA | Dos editores con hilos distintos contra la misma contraparte; se afirma que la lista de cada uno es disjunta y que ninguna consulta devuelve filas del otro |

---

## 5 · Impacto en el esquema

| Objeto | Cambio | Estado |
|---|---|---|
| `thread_items` | **+ columna `quantity`** (D-3) | ✅ **Completo.** `0020`, 3-sep-2026 (`CONSULTA`, vía `create_inquiry`) y `0021`, 4-sep-2026 (`OFERTA`, vía `counter_offer`). `create_thread_item` no la lleva y no le falta: rechaza `OFERTA` por diseño (`0012:185`) y solo crea `MENSAJE`, que tiene `quantity is null` obligatorio. La cantidad **no se hereda** de la oferta anterior — ver el §2 de `0021` |
| `members` | **+ columna `visibility_scope`** con check y trigger (D-4) | ✅ `0018`, 1-sep-2026 |
| `thread_public_keys(t_id)` | Deja de devolver todos los miembros (`0012:97`); devuelve el conjunto de destinatarios que fija D-1 | 🔴 **BLOQUEADA por Q-1 (§10)** — el lado del emisor está claro, el del receptor no lo decide este documento |
| `thread_items_select_participant` | Hoy `app.can_access_thread(thread_id)` (`0003:329`). Pasa a considerar el ámbito | ✅ `0019`, 3-sep-2026 |
| Lista de hilos (`threads_select_participant`) | Deja de ser consulta directa a `threads` (`0003:312`); se deriva de `thread_item_keys` | ✅ `0019`, 3-sep-2026 |
| `create_inquiry` | El conjunto de destinatarios de la CEK deja de ser «todos los miembros» | 🔴 **BLOQUEADA por Q-1 (§10)**, y depende de la fila de arriba |
| Índices | Nuevo índice para la derivación de la lista de hilos, en la dirección que filtra primero | ✅ `0017`, 1-sep-2026 |
| **`organizations.visibility_scope_enabled`** (D-7, octavo objeto — no estaba en la lista original del 25-ago; ver adenda del 3-sep-2026 en D-7) | Interruptor por organización, apagado por defecto. Sin él, `visibility_scope` (D-4) se aplicaría al 100% de las organizaciones sin que D-7 lo permitiera | ✅ `0019`, 3-sep-2026 |

**No cambia:** la jerarquía de claves, las primitivas criptográficas, el modelo de
hilo por pareja de organizaciones, ni ninguno de los tres invariantes de ADR-001.

---

## 6 · El hilo deja de ser un concepto visible

Esta consecuencia se cae directamente de juntar D-1 (el hilo sigue siendo por pareja
de organizaciones) con D-8 (el editor no ve nada de sus compañeros). **No es un
problema, pero cambia el vocabulario del producto y hay que escribirlo antes de
construir MSG-01 y MSG-02.**

El caso: el editor Juan tiene un hilo abierto con Nordwälz. La editora Ana consulta a
Nordwälz por otra referencia. `create_inquiry` es encontrar-o-crear sobre
`(org_low_id, org_high_id)` (`0014:167`): **encuentra el hilo de Juan y mete ahí el
elemento de Ana.**

En la misma fila de `threads` conviven entonces dos conversaciones que ninguno de los
dos puede ver del otro. **Funciona** — cada uno descifra solo lo suyo, y la cadena
`responds_to_item_id` mantiene separadas las respuestas — pero obliga a un cambio de
nombre:

> **Lo que el usuario ve es «mi conversación con Nordwälz», no «el hilo».** Juan ve la
> suya y Ana la suya; ninguno sabe que existe la otra, y la fila de la base es la
> misma. El hilo pasa a ser fontanería interna.

**Consecuencias de diseño:**

- MSG-01 y MSG-02 dejan de titularse por hilo. El identificador visible es la
  contraparte, no el hilo.
- Dos usuarios de la misma organización pueden tener «conversaciones con Nordwälz»
  simultáneas e independientes. La interfaz no debe sugerir que son la misma.
- Del lado de la contraparte, quien responda a cada consulta verá solo aquello en lo
  que participa, por la misma regla. Si responde la misma persona a las dos, verá las
  dos; si responden dos personas distintas, cada una la suya.

---

## 7 · Consecuencias aceptadas

1. **Salida abrupta = pérdida de contenido.** Si alguien se va sin ejecutar el
   traspaso de D-5 —despido, baja médica, conflicto—, la organización conserva **con
   quién, qué referencia, qué cantidad y en qué estado**, y pierde **para siempre** el
   precio y la conversación. Es irreversible por diseño y **debe decirse en la
   interfaz**, no en la letra pequeña.
2. **La cantidad entra en la superficie de metadatos** (D-3), con lo que implica.
3. **Coste de escritura.** Cada elemento se cifra para N destinatarios. Con cinco
   usuarios por organización, hasta diez filas por elemento. Es almacenamiento y
   latencia de escritura que hoy no existe.
4. **Riesgo de liquidez**, mitigado por D-7.

---

## 8 · Lo que NO se hace, y por qué

| Descartado | Motivo |
|---|---|
| Hilo por pareja de usuarios | Rompe `create_inquiry` y `0014:167` sin aportar nada sobre D-1 |
| Dar la clave al ADMIN «por si acaso» | Convierte la supervisión en acceso al contenido. D-2 lo consigue sin cruzar esa línea |
| Depósito de claves de organización con rescate | Es la salida al problema de la salida abrupta, y es **V2**: exige acción explícita, registrada y visible, más su propio análisis. Hoy se asume la consecuencia 6.1 |
| Desacoplar rol y ámbito en V1 | Complejidad sin disparador. D-4 deja la puerta abierta a coste cero |

---

## 9 · Impacto en el plan de V1

| | |
|---|---|
| **Momento** | Fundación (corriente A, semanas 3-5). Después sería migración de datos cifrados |
| **Coste** | 1 – 2 semanas, absorbidas entre corriente A y corriente B |
| **Coste si se decidiera en la semana 12** | El triple, con pantallas ya construidas que habría que rehacer |
| **Capabilities afectadas** | `messaging-and-negotiation`, `conversational-search`, y las de alta y roles |
| **Escenarios** | Los de mensajería se reescriben con el eje de visibilidad. Cuentan dentro de los 182 |
| **Pruebas nuevas** | V-1 a V-5 van con los invariantes criptográficos, **no** con las funcionales: un fallo ahí es una fuga |
| **Hito 6** | La derivación de la lista de hilos se mide bajo carga, con aserto de aislamiento y no solo de latencia |

---

## 10 · Preguntas abiertas

Las tres del borrador se cerraron el mismo día que se escribió:

| Era | Cerrada como |
|---|---|
| ¿Traspaso por hilo o en bloque? | **D-10** — en bloque, con lista de exclusión |
| ¿Qué ve un EDITOR de sus compañeros? | **D-8** — nada, ni siquiera que existen |
| ¿Activar el ámbito es reversible? | **D-9** — irreversible hacia atrás |

Y de cerrarlas salió §6, que no estaba en el borrador.

---

### ⚠ Q-1 · ¿A quién se envuelve la CEK de un elemento que ENTRA en una organización con el ámbito encendido? — ABIERTA desde el 4-sep-2026

**Detectada antes de escribir SQL, no después**, al empezar la fila
`thread_public_keys(t_id)` de §5. El PO decidió el mismo día **parar y decidirlo
con este documento delante**: las dos filas rojas de §5 quedan bloqueadas hasta
entonces, y no se escribe media pieza mientras tanto.

**El lado del emisor no tiene ambigüedad:** con el ámbito encendido, la CEK deja
de envolverse para sus compañeros. Eso es D-8 y V-1 aplicados literalmente, y es
implementable hoy.

**El lado del receptor no tiene respuesta en este documento.** En el primer
contacto —una CONSULTA que llega de otra organización— **todavía no participa
nadie** en la que recibe:

- Si se envuelve **para todos sus miembros**, la consulta llega y se puede
  contestar, pero cada uno de sus EDITOR podrá descifrar toda consulta entrante
  aunque la lleve un compañero. V-1 dice, literalmente, que un `OWN` *nunca*
  recibe copia envuelta de un elemento en el que no participa: esta salida
  obliga a precisar V-1 para el elemento de entrada, por escrito.
- Si **no se envuelve para nadie**, no la puede leer ni contestar nadie. El
  elemento queda ilegible para siempre y es irreparable (mismo caso que
  `create_thread_item`, `0012` §5).
- Si **el emisor elige destinatario**, se cumple V-1 al pie de la letra, pero
  expone la plantilla de la contraparte a quien consulta y es interfaz nueva en
  SRCH-01 — sale de la fundación y entra en la corriente B.
- **Darlo al ADMIN como buzón está descartado por este mismo documento:** V-2
  prohíbe que el ADMIN reciba copia envuelta por serlo, y D-2 existe justamente
  para darle supervisión *sin* ser destinatario criptográfico. Elegir esa vía
  obliga a reabrir V-2.

**Dato de esquema que cierra las salidas intermedias, comprobado el 4-sep-2026
contra `0003:148` (`thread_items_shape_chk`):** un `MENSAJE` **no puede** llevar
`responds_to_item_id`. O sea que hoy **no existe ancla de conversación** para los
mensajes dentro de un hilo compartido entre conversaciones independientes (§6):
«los que ya tienen clave en este hilo» mezcla conversaciones distintas, y «solo
el emisor» deja el mensaje sin llegar a la contraparte. Cualquier respuesta que
dependa de saber *a qué conversación pertenece un mensaje* exige antes un cambio
de esquema.

**Señal a favor de la primera salida, y es lectura, no decisión:** §5 lista los
objetos que cambian y **no incluye `org_public_keys`** (`0014` §1), que es
precisamente la función del primer contacto y la que hoy devuelve todos los
miembros de la organización consultada.

**Qué bloquea:** las dos filas rojas de §5 — `thread_public_keys(t_id)` y el
reparto de destinatarios de `create_inquiry`. Nada más: `quantity` en `OFERTA`
(`0021`) es independiente y se hizo el 4-sep-2026.


*ADR-002 · v1.4, 4-sep-2026 · **§10 deja de estar vacía: Q-1, el reparto de la CEK en el lado que RECIBE, abierta y bloqueando las dos últimas filas rojas de §5 por decisión del PO** · `quantity` cerrada del todo el 4-sep (`0021`, `OFERTA`) ·*

*v1.3, 3-sep-2026 · las tres preguntas abiertas del borrador, cerradas el mismo día que se escribió (25-ago) · adenda del 3-sep-2026 en D-7 y §5: octavo objeto de esquema (`organizations.visibility_scope_enabled`) que la lista original no tenía; D-3 (`thread_items.quantity`) cerrado el mismo día, solo para `CONSULTA` · estado del esquema verificado contra las migraciones `0001`, `0003`, `0012`, `0014` el 25-ago, y contra `0017`, `0018`, `0019`, `0020` y `information_schema`/`pg_policies` del proyecto real el 1-sep y el 3-sep · Dirección Técnica, Nortex Systems*
