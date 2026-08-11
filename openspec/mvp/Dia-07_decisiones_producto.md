# Decisiones de producto · día 7 (11-ago-2026)

> **Qué es este fichero.** Decisiones del PO que **se apartan de un contrato aprobado**. Los
> HTML y las specs de pantalla son de solo lectura (`CLAUDE.md` §1) y no se editan nunca: la
> divergencia se anota aquí, con su alcance exacto y su fecha, igual que se hizo con F-025.
>
> Quien construya una de las pantallas citadas **tiene que leer esto antes que su spec**.

---

## D-07-01 · Un hilo cerrado se reabre al volver a escribir en él

**Decisión del PO, 11-ago-2026, literal:**

> *"Un hilo cerrado sólo se reabre cuando uno de los dos usuarios vuelve a escribir en él. No
> hay más opciones."*

Cierra **F-045**, que llevaba abierta desde el día 6.

### Qué decían las specs aprobadas

Cuatro, y todas lo contrario:

| dónde | qué dice |
|---|---|
| `Rinworld_spec_MSG-02.md` · tabla de acciones | *"`Cerrar sin acuerdo` → CERRADO SIN ACUERDO (**irreversible** — pide confirmación)"* |
| `Rinworld_spec_MSG-02.md` §6 | *"El campo de mensaje y el botón `Crear oferta` **desaparecen**. Solo se muestra el historial en modo lectura. Botón `Revertir a abierto` **no disponible**"* |
| `Rinworld_spec_MSG-02.md` §7 · `Rinworld_spec_MSG-03.md` §7 | *"El único estado irreversible es CERRADO SIN ACUERDO"* |
| `Rinworld_spec_MSG-01.md` §3 | badge tachado, *"solo lectura"* |

### Y qué dice la capability cerrada: nada

**Esto es lo que abarata la decisión.** `thread-lifecycle` menciona `CERRADO SIN ACUERDO` una
sola vez —`openspec/specs/messaging-and-negotiation/spec.md:225`— y es para hablar del marcado
de líneas consultadas. **No declara el estado irreversible en ninguna parte.**

Así que la decisión **no rompe ninguna de las nueve capabilities**. Se aparta de cuatro specs de
pantalla, que es un grado distinto: las capabilities son el contrato del producto y las specs de
pantalla son su interpretación visual.

### La regla que se cae con ella, y no es opcional

**MSG-02 debe mantener el campo de mensaje visible en un hilo CERRADO SIN ACUERDO.**

No es una interpretación libre: si el campo desaparece, nadie puede volver a escribir y la
reapertura no puede ocurrir nunca. La decisión, para tener efecto, obliga a esto. El botón
`Crear oferta` se deja a criterio de quien construya MSG-02 — la decisión habla de *escribir*,
y un mensaje basta.

`Revertir a abierto` **sigue sin existir**: la reapertura no es un botón, es la consecuencia de
escribir.

### Qué cuenta como "volver a escribir"

**Un elemento nuevo. Nada más.** El trigger se dispara con `insert`, `update` y `delete`, y las
tres son escrituras para Postgres pero no para una persona:

- **INSERT** → alguien ha escrito. **Reabre.**
- **UPDATE** → alguien ha tocado algo que ya existía (marcar una consulta como respondida,
  sellar el puntero de una contraoferta, un backfill). **No reabre.**
- **DELETE** → menos todavía.

Si el UPDATE reabriera, cualquier mantenimiento sobre `thread_items` resucitaría hilos cerrados
en silencio. Es el patrón de F-023 y F-044: un estado que deja de significar lo que dice.

### A qué estado reabre

**Al que digan sus filas**, porque el estado es una función de las filas (0007). Con un mensaje
suelto sale `ABIERTO`; si el hilo se cerró teniendo una oferta aceptada y vigente, sale
`ACUERDO ALCANZADO`. No se fuerza `ABIERTO` — forzarlo sería reintroducir un estado que
contradice sus propios elementos.

### Dónde está implementado

| | |
|---|---|
| Base | `supabase/migrations/0009_thread_reopens_on_write.sql` |
| Pruebas | `supabase/tests/01_schema_smoke.sql` — dos asertos: un `update` no reabre, un elemento nuevo sí |
| Cliente | Nada que cambiar hoy. `canCloseThread` y `canRevertAgreement` siguen igual: lo que se movió es MSG-02, que aún no está construida |

### Lo que hay que revisar cuando se construyan las pantallas

- **MSG-02** (día 7-8) · el campo de mensaje se queda. Es la única desviación obligatoria.
- **MSG-01** · el badge de `CERRADO SIN ACUERDO` ya no significa "solo lectura". Sigue tachado
  y sigue siendo correcto como estado; lo que no se puede es pintar el hilo como inerte.
- **MSG-03** · su §7 dice "el único estado irreversible". Ya no hay ninguno.

---

## D-07-02 · `RETIRADA` no entra en el MVP

**Decisión del PO, 11-ago-2026:** *"RETIRADA no entra en el MVP."*

Cierra **F-043b**. Se decide hoy porque **VND-01 se construye el día 8** (`Plan §3`) y es la
pantalla que la pide.

### Qué queda fuera, exactamente

`Rinworld_spec_VND-01.md` da `Retirar oferta` en la tabla de acciones para una oferta en estado
PENDIENTE (línea 91), y `RNG-VND-04` (línea 149) describe su confirmación inline. **VND-01 no
pinta ese botón.** Es la única desviación, y va con su nota al lado, como se hizo con F-025.

### Por qué la desviación es pequeña

- **No está en ninguna capability.** `offer-card` tiene cuatro estados —Pendiente, Aceptada,
  Rechazada, Superada por contraoferta— y `RETIRADA` no es uno.
- **El día 2 ya se había decidido igual** (`Dia-02_decisiones_esquema.md:138`: *"`RETIRADA` · No
  existe. No hay escenario de retirada"*). Lo que faltó entonces fue mirar VND-01, no la
  decisión.
- **Y no es implementable tal como está escrita:** `RNG-VND-04` dice *"Confirmar retira la
  oferta y **elimina la fila**"*, y eso choca de frente con el *"sin eliminarse del historial"*
  de `offer-card`. Habría hecho falta rehacer la regla antes de poder construirla.

### Ya hay un aserto que la sostiene

No es solo una nota en un documento. `01_schema_smoke.sql` comprueba que la base **rechaza** el
literal:

```
OK · bloqueado: offer-card: estado RETIRADA (no existe en el spec)
```

Y `offerActions()` no devuelve `retirar` a nadie. Si alguien lo reintroduce por descuido, falla
la CI.

### Si la quieres para V1

Es una migración —valor nuevo en `thread_items_estado_oferta_chk`, guardia de que **solo el
emisor** retira, simétrica a 0008/0010— más el botón. **Y antes hay que reescribir `RNG-VND-04`
para que no elimine la fila.** Medio día largo, no un rato.

---

## D-07-03 · `EXPIRADA` no es un estado — y esto no es una decisión, es lo que dice el contrato

Va junto a la anterior porque venía en el mismo hallazgo (F-043b) y afecta a la misma pantalla,
pero **no hacía falta decidir nada**: la capability ya lo resuelve, con escenario propio.

`messaging-and-negotiation/spec.md:173`:

> - GIVEN una tarjeta de oferta con `valid_until` informado, ya pasada, y **`estado_oferta=Pendiente`**
> - THEN se muestra el aviso *"Esta oferta ha expirado"* **de forma local**
> - AND **el receptor puede aceptarla igualmente** — la fecha es orientativa, no contractual en V1

Es decir: una oferta caducada **sigue Pendiente**. `EXPIRADA` en VND-01 es una **etiqueta de
presentación**, no un quinto estado, y la caducidad no cambia lo que se puede hacer con la
oferta. VND-01 puede pintar el aviso; lo que no puede es tratarla como terminal ni impedir que
se acepte.

**Si querías que caducar sí cerrara la oferta, dilo — eso sí sería una decisión y cambiaría la
capability.** Tal como está, no hay nada que decidir.

---

## D-07-04 · `Marcar acuerdo alcanzado` se pinta deshabilitado y con el motivo

**Decisión del PO, 11-ago-2026:** la opción (b) — el ítem se queda en el menú, inerte y con la
razón a la vista.

### Por qué no se puede pintar activo

La tabla de acciones de `Rinworld_spec_MSG-02.md` (línea 82) lo da como transición manual desde
ABIERTO, CON CONSULTA PENDIENTE o CON OFERTA PENDIENTE. **Las otras dos fuentes dicen que no**, y
las dos mandan más que una spec de pantalla:

| dónde | qué dice |
|---|---|
| `messaging-and-negotiation/spec.md:195` · `thread-lifecycle` | ACUERDO ALCANZADO se alcanza **aceptando una oferta**. No hay escenario de marcado manual |
| `0007_thread_state_machine.sql:246` · `app.guard_thread_state` | *"Desde el cliente solo se cierra el hilo o se revierte a ABIERTO; el resto del ciclo lo deriva la base"* — cualquier otro valor **lanza excepción** |

O sea que el botón no es una desviación de estilo: **reventaría en ejecución**, y con un mensaje
de Postgres delante del socio. Es la misma forma que D-07-03 —una spec de pantalla contra una
capability cerrada— con el agravante de que aquí además hay una guardia aplicada al remoto.

### Qué se pinta

El ítem del desplegable, **deshabilitado**, con el motivo en **texto visible** y no en un
`title` ni en un `aria-describedby`: es F-023 e, y `Messages.tsx:107` ya lo resolvió así para
`Nuevo contacto`. Un ítem inerte sin explicación se lee como avería.

El motivo es una frase que dice la verdad y no promete nada: **`El acuerdo se alcanza aceptando
una oferta.`** No dice "próximamente" ni "en V1", porque no es una función que falte — es que el
estado no se marca a mano por diseño.

### Lo que NO cambia

`Cerrar sin acuerdo` y `Revertir a abierto` **sí son las dos transiciones manuales de verdad** —
las dos que `guard_thread_state` deja pasar— y se pintan activas cuando su estado toca.
`closeThreadWithoutAgreement()` y `revertAgreement()` existen desde ayer en
`app/src/lib/offers.ts:295`.

### Si lo quieres activo en V1

Sería una migración: ampliar lo que la guardia acepta desde el cliente, y decidir qué pasa
cuando la derivación vuelva a discrepar de lo marcado a mano —que es exactamente el problema que
0007 vino a quitar (F-044: *"el badge deja de ser una afirmación de la siembra y pasa a ser una
función de las filas"*)—. **No es media jornada de trabajo: es rehacer la decisión del día 6.**

---

## D-07-05 · MSG-02 se construye contra una costura de descifrado, no contra contenido en claro

**Decisión del PO, 11-ago-2026:** la opción (ii) — MSG-02 se construye hoy, con la costura, y la
rebanada E2EE del día 8 la rellena **sin volver a tocar la pantalla**.

### El hecho que la obliga

`Plan §3` pone la rebanada E2EE el **día 8** y MSG-02 el **día 7**, y MSG-02 es la primera
pantalla cuyo contenido *es* lo cifrado. Comprobado hoy, no supuesto:

- **`app/src` no tiene una sola línea de criptografía.** Cero coincidencias de `crypto`, `AES`,
  `X25519` o `subtle` fuera de los tests. Las únicas dependencias son `@supabase/supabase-js` y
  React.
- `content_ciphertext` es `bytea not null` (`0003_threads_and_items.sql`) — no hay forma de
  insertar un elemento sin producir bytes.
- La siembra lleva **relleno a propósito**: `demo_threads.sql:16`, *"EL CONTENIDO CIFRADO ES
  RELLENO A PROPÓSITO"*. No hay nada que descifrar aunque hubiera con qué.

### Qué es la costura

`ThreadItem.content` es `ItemContent | null`. **`null` no significa "vacío": significa "cifrado y
sin clave en esta sesión"**, que es un estado de primera clase de la pantalla y no un caso de
error. La pantalla pinta las dos ramas desde hoy; hoy sólo la rama opaca tiene datos reales
detrás.

Los metadatos —tipo, autor, timestamp, `part_number`, `brand`, estado de la tarjeta— **no pasan
por la costura**: van en claro en `thread_items` desde el día 2, y la migración 0003 los comenta
como *"METADATO EN CLARO"* precisamente para esto. Un hilo sin passphrase no es una pantalla en
blanco: es una pantalla con todo salvo las cifras y el texto.

### Qué se pinta donde iría el contenido

El literal de la capability, **verbatim**, que es contrato y no elección:
`messaging-and-negotiation/spec.md:68` — **`Contenido cifrado — introduce tu frase de seguridad
para ver`**.

**Sin botón.** Es F-027 aplicado otra vez: la `§3` de MSG-02 pide un bloque brass con
`Introducir frase de seguridad`, y en el MVP las claves viven en memoria de sesión y se pierden
al recargar (`CLAUDE.md` §4). Un botón que pide una frase que no existe promete recuperación de
claves que el MVP no tiene, y es el mock prometiendo lo que no hay. El indicador informa; no
ofrece.

### Y el envío de mensajes queda deshabilitado hoy, con el motivo

Enviar exige producir ciphertext, y no hay con qué. Las dos salidas malas se descartan por
escrito: escribir el texto en claro en `content_ciphertext` rompe `CLAUDE.md` §4 y el argumento
entero del producto; escribir relleno deja un mensaje ilegible para siempre.

Así que el textarea **se pinta y se queda visible** —lo exige D-07-01, que sin campo de mensaje
no tiene efecto— y el botón de enviar va deshabilitado con el motivo a la vista:
**`El cifrado en cliente llega en la rebanada E2EE.`**

**Esto no debilita D-07-01.** La reapertura del hilo la garantiza `0009` en la base y la prueban
dos asertos de `01_schema_smoke.sql`; no dependía nunca de que la pantalla supiera escribir.

### Qué hay que revisar el día 8

Cuando entre la rebanada, **la pantalla no se toca**: se rellena `decryptItem()` para que
devuelva contenido en vez de `null`, y se habilita el envío. Si el día 8 alguien se encuentra
editando `Thread.tsx`, la costura estaba mal puesta y esto es lo que hay que releer.

---

*Escrito el 11-ago-2026 · Claude Code (Opus 5) · las decisiones de este fichero no caducan al
cierre del día, a diferencia de `ESTADO.md`*
