# Decisiones del día 8 · la rebanada E2EE (12-ago-2026)

> **Qué es este fichero.** El día 8 es uno de los tres días de decisiones irreversibles del
> plan (`CLAUDE.md`, ritual de cierre), y la rebanada E2EE toca **ADR-001**. Esto se escribe
> **la noche antes**, con lo que hay medido, para que mañana no se decida con prisa lo que
> condiciona el resto del producto.
>
> **Lo escribe Claude Code el 11-ago. No caduca al cierre del día, a diferencia de
> `ESTADO.md`.**

---

## Lo que YA está decidido y no se reabre mañana

No todo está abierto. Estas cuatro vienen de antes y **mañana se implementan, no se debaten**:

| | |
|---|---|
| **El algoritmo** | `AES-256-GCM` con `iv` de 12 bytes. Lo fija el esquema, no una preferencia: `0003` tiene `thread_items_iv_len_chk check (octet_length(content_iv) = 12)` y la cabecera de la tabla dice *"todas las cifras de la oferta, serializadas y cifradas con AES-256-GCM"*. |
| **El acuerdo de claves** | `X25519` vía WebCrypto **nativo**. SP-2 lo midió el día 1 y salió **al revés de lo que el plan anticipaba**: no hace falta el fallback a P-256 (F-008). |
| **Un blob por elemento** | No una columna por campo. *"Nada del servidor necesita granularidad: todo lo que el servidor usa está arriba, en claro. Menos superficie y menos fuga por longitud de campo"* (`0003`). |
| **Sin backup, sin recuperación, sin rotación** | `CLAUDE.md` §4: en el MVP las claves viven **en memoria de sesión y se pierden al recargar**. Y lo dice con todas las letras: **esto NO es una implementación de ADR-001**, que sí las exige en V1. Mañana no se construye el respaldo de claves. |

**Y un aviso que no es del MVP pero conviene tener delante mientras se escribe:** ADR-001 §8
tiene tres invariantes, y el primero es que **la frase de respaldo no viaja al servidor jamás
— ni en payloads, ni en logs, ni en mensajes de error**. Aunque mañana no haya frase de
respaldo, cualquier atajo que meta material de clave en un log de hoy es el hueco por el que
se cuela mañana.

---

## D-08-01 · ⚠ LA GRANDE, Y NADIE LA HA ESCRITO TODAVÍA: la siembra no se puede descifrar

**Este es el punto que hay que resolver ANTES de escribir una línea de cifrado, porque
determina el modelo de claves entero.**

`demo_threads.sql:16` lo dice sin rodeos: *"EL CONTENIDO CIFRADO ES RELLENO A PROPÓSITO"*.
Los cinco hilos sembrados llevan bytes que no son el cifrado de nada.

**Consecuencia, y es la que duele:** cuando mañana se rellene `decryptItem()`, **los cinco
hilos de la demo seguirán mostrando `Contenido cifrado — introduce tu frase de seguridad para
ver` en cada elemento.** La rebanada E2EE funcionando no arregla la siembra: la deja
exactamente igual. Y el **día 11 es la primera sesión de prueba con el socio**.

### Por qué esto decide el modelo de claves y no solo la siembra

Si la siembra tiene que ser legible en la demo, **el material de clave no puede ser aleatorio
por sesión**: alguien tiene que poder cifrar el contenido de siembra hoy y que las dos cuentas
lo descifren mañana, en otra sesión y en otro navegador. Eso es una decisión de arquitectura,
no de datos.

### Las tres salidas

| | Qué implica | Coste |
|---|---|---|
| **(a) Claves de demo deterministas** — el par X25519 de cada organización se deriva de un valor fijo del entorno, y la siembra se regenera cifrando de verdad | La demo enseña un hilo **con contenido**, que es lo que el socio tiene que ver. **Y no es "romper el E2EE"**: el servidor sigue sin ver nada, lo que se relaja es de dónde sale la clave. Hay que dejarlo escrito en tres sitios para que nadie lo confunda con V1 | Medio día: derivación + regenerar `demo_threads.sql` |
| **(b) La demo solo enseña lo que se escribe en vivo** — la siembra se queda opaca y el guion crea el contenido durante la sesión | Cero trabajo de siembra. Pero el hilo del guion arranca **vacío de contenido** y el histórico —la consulta de hace 3 días, la oferta de hace 2 horas— se ve como bloques opacos. Es enseñar la caja fuerte cerrada | Cero, pero se paga en el guion |
| **(c) Aplazar el descifrado a después del día 11** | La rebanada se escribe y no se activa. **No la recomiendo**: deja la costura sin ejercitar justo hasta la semana en la que ya no hay margen | Cero hoy, caro el día 12 |

**Yo iría a la (a)**, y la razón es la del `guion-demo-y-siembra.md`: el argumento del producto
es *"el servidor no puede leer esto"*, y esa frase solo se demuestra enseñando **contenido
legible en el navegador junto al ciphertext en el panel del servidor**. Con (b) el socio ve
dos pantallas opacas y tiene que creerse la explicación.

**Y la (a) trae de propina el panel del día 11** — `Plan §3`, fila del día 11: *"Panel de
vista-servidor (comprador vs. lo que almacena Postgres)"*. Ese panel **necesita** que lo de
arriba sea legible y lo de abajo no. Con la siembra de relleno, las dos mitades salen
ilegibles y el panel no enseña nada.

**Esto es una decisión del PO. Sin respuesta, mañana se escribe la rebanada de forma que
sirva a las tres**, y la siembra se decide después — pero el día 11 se acerca.

---

## D-08-02 · Qué pasa con el envío de mensajes

Hoy el botón de enviar de MSG-02 está **deshabilitado con el motivo a la vista** (D-07-05),
porque enviar exige producir ciphertext y no había con qué. Mañana lo hay.

**No es automático, y conviene decidirlo explícitamente:** la rebanada del `Plan §3` dice
*"cifrado de campos de **oferta** en cliente"*, no de mensajes libres. Son el mismo blob y el
mismo algoritmo, así que habilitar el mensaje libre es marginal — **pero el mensaje libre es
lo que hace observable la reapertura de D-07-01**, que hoy solo prueban dos asertos de SQL.

**Propuesta: entran los dos.** Cifrar un `MENSAJE` es el caso más simple del mismo código, y
sin él la decisión del PO sobre la reapertura del hilo se queda sin ninguna prueba en la
interfaz.

---

## D-08-03 · Dónde vive el par de claves de la organización

El esquema **no tiene columna para la clave pública de nadie**. Comprobado: `organizations` y
`members` en `0001` no llevan material de clave, y ADR-001 §6.3 describe unas columnas en la
tabla de usuarios que **no se han creado**.

Para que A cifre algo que B pueda leer, A necesita **la pública de B**, y tiene que salir de
algún sitio que el servidor sirva.

Las opciones, en orden de coste:

1. **Columna `public_key` en `organizations`**, en claro, servida por RLS a cualquiera
   autenticado. Es lo que hace falta y es una migración corta. La pública **es pública**: no
   hay nada que proteger ahí.
2. **Por miembro, en `members`.** Más fiel a ADR-001 —la identidad es del miembro— pero
   multiplica el problema: un hilo es entre **organizaciones**, así que habría que cifrar para
   cada miembro de la contraparte y el blob deja de ser uno.

**Recomiendo la 1 para el MVP y dejar escrito que V1 es la 2**, porque el hilo es entre
organizaciones por diseño (`single-thread-model`) y el MVP tiene un miembro por organización.
**Es una desviación de ADR-001 y va anotada como tal**, igual que se hizo con F-025: no se
edita el ADR, se registra la divergencia.

---

## Lo que hay que revisar de lo de hoy antes de empezar

- **`decryptItem()` en `app/src/lib/thread-detail.ts`.** Es la costura. Se rellena ahí y
  **no se toca ningún `.tsx`**. Si mañana alguien se encuentra editando `ThreadHistory.tsx`,
  la costura estaba mal puesta y hay que releer D-07-05 antes de seguir.
- **El test que dice que hoy devuelve `null`** (`thread-detail.test.ts`) **tiene que cambiar
  mañana.** Que cambie es la señal de que la costura se rellenó; que siga verde el día 9 sería
  la señal de que no.
- **La rama descifrada de `ThreadHistory` no la ha ejecutado nunca la aplicación**, solo los
  tests. Mañana pasa a ser la que se ve. Ya se encontró ahí un defecto que ningún check podía
  ver —la fecha de validez en crudo (F-059)—; **presupuesta tiempo para lo que quede debajo,
  no solo para escribir el cifrado.**
- **`0011` publica `thread_items` por Realtime**, y el payload de un elemento nuevo lleva el
  blob. Va cifrado, así que no es una fuga — pero cuando el contenido sea real, **mirar el
  socket es una forma más de comprobar que el servidor no ve nada**, y merece un aserto.

---

## Y el otro bloque del día: VND-01

Va por el arnés. Antes de lanzarlo, `Dia-07_decisiones_producto.md` **se lee antes que la spec
de pantalla** (D-07-02 y D-07-03): **no se pinta `Retirar oferta`**, y **`EXPIRADA` es una
etiqueta de presentación, no un quinto estado** — una oferta caducada sigue `Pendiente` y el
receptor puede aceptarla igualmente.

Las precondiciones del arnés están en `ESTADO.md`, sección "Hoy toca". Las tres nuevas de hoy
son **F-058** (el rojo del contrato tiene que ser total), **F-059** (todo aserto negativo con
ancla y ámbito) y **F-060** (un escalado no se canaliza ni se le pone nada detrás).

---

*Escrito el 11-ago-2026 · Claude Code (Opus 5) · las decisiones de este fichero no caducan al
cierre del día*
