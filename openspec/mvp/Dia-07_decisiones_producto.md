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

*Escrito el 11-ago-2026 · Claude Code (Opus 5) · las decisiones de este fichero no caducan al
cierre del día, a diferencia de `ESTADO.md`*
