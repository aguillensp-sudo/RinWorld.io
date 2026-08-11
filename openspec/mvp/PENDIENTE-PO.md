# Pendiente del PO · cerrado el día 7 (11-ago-2026)

> **Hoy no queda ni un arreglo pendiente de tu parte.** Los cinco puntos que bloqueaban algo
> se cerraron ayer y ninguno ha vuelto. Lo que resta son **decisiones de producto** y cosas
> de V1 — y esas no las puedo tomar yo.
>
> Cada punto lleva **qué pasa si no se hace**, **lo que yo haría** y **cuánto cuesta**.
>
> Proyecto Supabase: **`troxminloxkjwihwfevs`** · Repo: **`aguillensp-sudo/RinWorld.io`**

---

## 0 · Lo que hay que leer antes que nada, si mañana tocas el día 8

**[`Dia-08_decisiones_e2ee.md`](Dia-08_decisiones_e2ee.md)**, escrito esta noche. El día 8 es
uno de los tres días de decisiones irreversibles y hay **una decisión tuya que bloquea el
resto**: la de abajo, el punto 1.

---

## 1 🔴 D-08-01 · La siembra de la demo NO se puede descifrar, y eso decide el modelo de claves

**Es lo más urgente que hay sobre la mesa, y no estaba escrito en ninguna parte hasta hoy.**

`demo_threads.sql:16` lo dice sin rodeos: *"EL CONTENIDO CIFRADO ES RELLENO A PROPÓSITO"*. Los
cinco hilos sembrados llevan bytes que no son el cifrado de nada.

**Qué pasa si no se decide:** mañana se escribe la rebanada E2EE, funciona perfectamente, y
**los cinco hilos de la demo siguen mostrando `Contenido cifrado` en cada elemento**. La
rebanada no arregla la siembra: la deja igual. Y **el día 11 es tu primera sesión de prueba**.

**Por qué es una decisión de arquitectura y no de datos:** si la siembra tiene que ser legible
en la demo, el material de clave **no puede ser aleatorio por sesión** — alguien tiene que
cifrarla hoy y que las dos cuentas la lean mañana, en otro navegador.

| | Qué implica | Coste |
|---|---|---|
| **(a) Claves de demo deterministas** y siembra regenerada cifrando de verdad | La demo enseña un hilo **con contenido**. **No es "romper el E2EE"**: el servidor sigue sin ver nada; lo que se relaja es de dónde sale la clave, y va anotado en tres sitios para que nadie lo confunda con V1 | Medio día |
| **(b) La demo solo enseña lo que se escribe en vivo** | Cero trabajo. Pero el histórico del hilo —la consulta de hace 3 días, la oferta de hace 2 horas— se ve como bloques opacos: es enseñar la caja fuerte cerrada | Cero, se paga en el guion |
| **(c) Aplazar el descifrado a después del día 11** | Deja la costura sin ejercitar justo hasta la semana sin margen. **No la recomiendo** | Cero hoy, caro el día 12 |

**Yo iría a la (a).** El argumento del producto es *"el servidor no puede leer esto"*, y esa
frase solo se demuestra enseñando **contenido legible arriba y ciphertext abajo**. Con (b) el
socio ve dos pantallas opacas y tiene que creerse la explicación — y además el **panel de
vista-servidor del día 11** (`Plan §3`) necesita exactamente ese contraste: con la siembra de
relleno, las dos mitades salen ilegibles y el panel no enseña nada.

**Dime (a), (b) o (c) y mañana se construye para esa.**

---

## 2 🟠 F-063 · Los commits del arnés dejan la CI roja por diseño

Construir una pantalla por el arnés produce **dos commits rojos previstos**: el del contrato
—que tiene que estar en rojo total antes de lanzar, es la regla nueva de hoy— y el del
artefacto tal cual sale, que escaló. Solo el tercero, la revisión a mano, sale verde.

**Qué pasa si no se decide:** con VND-01 el día 8 y PANEL-01 el día 9, **un rojo en esta rama
deja de significar "algo se ha roto"**. Es lo mismo que dejó la CI nueve días en rojo sin que
nadie mirara por qué.

**Lo que yo haría:** `[skip ci]` en los dos commits previstos, con el motivo en el cuerpo, y la
CI entera en el de la revisión. No se pierde cobertura y **un rojo vuelve a significar algo**.
Una línea de convención. No lo he aplicado hoy porque cambia una regla de commit a mitad de un
día ya cerrado.

---

## 3 🟠 El informe de Playwright en `ci.yml`

Sigue igual desde ayer. `actions/upload-artifact@v4` con `retention-days: 7`. Ese informe es el
que llegó a adjuntar el volcado del DOM con la contraseña de alpha.

- **(a)** Dejarlo como está. Ya no se escribe la contraseña, y 7 días acotan el daño.
- **(b)** Subirlo **solo cuando el job falla** (`if: failure()`). Menos superficie, y cuando lo
  necesitas sigue estando. **Es lo que yo haría.**
- **(c)** No subirlo. Barato hoy y caro el día que la CI falle y no puedas ver por qué.

**Dime cuál y lo dejo hecho.**

---

## 4 🔴 F-064 · Llevamos tres días midiendo al modelo con un instrumento roto — APLAZADO POR TI

**Lo encontré al cerrar el día, comprobando una conclusión mía que no me cuadraba, y tumba
tres días de dato sobre el objetivo 4.**

El reintento del arnés **no le enseña al Coder el código que escribió**. Le manda la tarea
otra vez —idéntica— y la salida cruda de los checks, o sea `ThreadHistory.tsx(136,61): error
TS2375: …` **sobre un fichero que el modelo no está viendo**, y le pide regenerar los ocho
desde cero. Que reproduzca el mismo error no es ignorar a `tsc`: es volver a tirar el dado.

**Y el estado del grafo ya lleva ese código guardado.** `HarnessState.files` está declarado
como *"{ruta: contenido} del último intento del Coder"*. Viaja por el grafo y nadie lo vuelve
a mandar. No falta información: falta usarla.

**Qué se cae:** F-036 (día 5), la lectura de la corrida 2 de SRCH-01 (día 6) y la mitad de
F-059 (día 7) decían todas alguna forma de *"recibió `tsc` y no lo resolvió"*. **Ninguna vale
como dato sobre el modelo.** Las escaladas ocurrieron y los defectos del artefacto eran
reales — lo que se cae es la causa.

**Decidiste el 11-ago aplazarlo**, y queda escrito para que nadie lo lea como un descuido. Lo
que hay que tener presente mientras tanto:

- **Ninguna decisión sobre el arnés en V1 debería apoyarse en las cifras de estos tres días.**
- El experimento limpio es barato: meter los ficheros del intento anterior en el prompt y
  **relanzar MSG-02 con la misma tarea y el mismo contrato** — misma entrada, único cambio el
  bucle. **~$0,07 y veinte minutos.**
- Si VND-01 escala mañana con el bucle sin arreglar, **esa cuarta medición tampoco dice nada
  del modelo.**

---

## 5 🟠 F-033 · El CSV no distingue un check en rojo de uno inejecutable — y hoy suma un caso nuevo

**Y el caso nuevo es peor que los anteriores.** Las tres filas de MSG-02 dicen `FALLA 2/4` y
`ESCALADO 2/4`, pero **dos de los cuatro fallos de C2 eran defectos de mi contrato de
aceptación, no del artefacto** — dos asertos mal escritos que casaban con dos nodos. En el CSV
son indistinguibles de un fallo del modelo.

**Con el formato de hoy, "intentos hasta verde" no es fiable**, y es justo la cifra de la que
`Plan §11` hace depender la viabilidad del arnés en V1.

Para V1 hay que decidir: ¿el CSV lleva un estado propio de check (`rojo` / `inejecutable`)?
¿Un intento que falla por un defecto del **contrato** cuenta como intento del modelo?

Mientras tanto, las tres filas de hoy llevan su contexto en `harness/metrics/MSG-02/`.
**No las promedies con las de SRCH-01.**

---

## 6 🟠 F-016 · El diseño de la pantalla de login

No existe entre los 32 HTML aprobados ni entre las 8 del alcance: es una **novena** que nadie
planificó, y **es la primera que ve el socio**. Sigue con el andamiaje hecho con los tokens. Si
quieres algo mejor para el día 11, hay que decidirlo con margen — y quedan cuatro días.

---

## 7 🟠 F-054 · Dos rutas de despliegue de migraciones a medias

O se enlaza la CLI y se retro-registran las once en su formato, o **el MCP pasa a ser la ruta
oficial y se documenta como tal** — que es la que funciona y la que se ha usado para 0007 a
0011. Dos caminos a medias es exactamente como se llegó a un pendiente con un comando que no
podía funcionar. No urge, pero no se puede quedar así.

---

## 8 · Preguntas menores, sin bloqueo

| # | Pregunta | Nota |
|---|---|---|
| 7.1 | **¿Los cinco hilos sembrados son los de la demo del día 11?** | Sube de prioridad con el punto 1: si eliges (a), la siembra se regenera y es el momento de cambiarlos |
| 7.2 | F-027 (a) · el recuento de no leídos de MSG-01 | Fuera del MVP. Para V1: o `thread_read_receipts` con su RLS, o se retira del spec |
| 7.3 | ¿Qué hace INV-01 con una línea eliminada? (F-023 d) | O quinto chip "Eliminados" con restaurar, o eliminar es definitivo. **No urge** |
| 7.4 | `auth_leaked_password_protection` desactivado en Auth | ¿Se activa? |
| 7.5 | La app no tiene URL desplegada | Decisión del 7-ago: solo local. **Se retoma antes del día 11**. Mientras: `npm --prefix app run dev` (5173), o `npm run build && npm run preview` (4173), que es el bundle que prueba el e2e |

---

## Orden que yo seguiría

1. **El punto 1**, y hoy si puedes: bloquea cómo se escribe la rebanada E2EE de mañana.
2. **El punto 2**, que es una línea y devuelve el significado a la CI.
3. **El punto 3**, que es otra línea.
4. **El punto 4 lo has aplazado tú** y está bien aplazado — pero es el que decide si el
   objetivo 4 tiene datos o no. En cuanto haya un hueco, es media hora y ~$0,07.
5. Los puntos 5 a 8 — nada urge, y varios son de V1.

---

*Escrito el 11-ago-2026 · Claude Code (Opus 5) · se sobrescribe en cada cierre de día*
