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

*Escrito el 11-ago-2026 · Claude Code (Opus 5) · las decisiones de este fichero no caducan al
cierre del día, a diferencia de `ESTADO.md`*
