

### Y dos cosas nuevas que aparecieron construyéndolo

**🟠 A · `app/.env.example` no está en el repo, y nunca lo ha estado.** El `.gitignore` raíz
tiene `.env.*`, que se lo traga. `supabase.ts` remite a él —*"Copia .env.example a .env"*— y
quien clone el repo no lo encuentra. **No contiene ningún secreto**: es la plantilla con
marcadores y las contraseñas de e2e vacías. **Yo lo añadiría con un `!.env.example` en el
`.gitignore`**, pero no toco esa regla por mi cuenta: es la §1 no negociable de `CLAUDE.md`.
Una línea, cuando digas. *(Efecto hoy: el aviso de `VITE_DEMO_KEY_SEED` que escribí ahí solo
existe en tu máquina.)*
*** RESPUESTA: Arréglalo, permitido por owner.***



**🟠 B · El envío cifrado de D-08-02 no tiene e2e, y es el único hueco del bloque.** Los tests
de unidad lo cubren —el pie de composición, `sendMessage`, y el esquema prueba que un elemento
no puede quedarse sin claves—, pero **no hay un test que envíe de verdad contra el Supabase
real**. El motivo es concreto: enviar mueve el hilo al principio de la lista y cambia la vista
previa de MSG-01, y eso rompe otros dos e2e que ya existen. La suite **no tiene forma de
reponer la siembra entre corridas**, así que un test así solo pasaría la primera vez. **Lo que
hace falta es un paso de reseteo de fixture antes de la suite**, no el test; medio día, y
resolvería lo mismo para el día 10. **No lo he metido a medias a propósito:** un e2e que solo
pasa con la base recién sembrada es peor que un hueco documentado.
*** RESPUESTA: resuelve por ti mismo, permitido por owner.***

---

## 1 🔴 D-08-01 · La siembra de la demo NO se puede descifrar, y eso decide el modelo de claves


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

*** RESPUESTA: OPCION (a), permitido por owner.***

---

## 2 🟠 F-063 · Los commits del arnés dejan la CI roja por diseño


**Lo que yo haría:** `[skip ci]` en los dos commits previstos, con el motivo en el cuerpo, y la
CI entera en el de la revisión. No se pierde cobertura y **un rojo vuelve a significar algo**.
Una línea de convención. No lo he aplicado hoy porque cambia una regla de commit a mitad de un
día ya cerrado.
*** RESPUESTA: adelante hazlo, permitido por owner.***

---

## 3 🟠 El informe de Playwright en `ci.yml`

Sigue igual desde ayer. `actions/upload-artifact@v4` con `retention-days: 7`. Ese informe es el
que llegó a adjuntar el volcado del DOM con la contraseña de alpha.

- **(a)** Dejarlo como está. Ya no se escribe la contraseña, y 7 días acotan el daño.
- **(b)** Subirlo **solo cuando el job falla** (`if: failure()`). Menos superficie, y cuando lo
  necesitas sigue estando. **Es lo que yo haría.**
- **(c)** No subirlo. Barato hoy y caro el día que la CI falle y no puedas ver por qué.

**Dime cuál y lo dejo hecho.**
*** RESPUESTA: (a), permitido por owner.***

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

  *** RESPUESTA: adelante realiza experimento pero dejemos esto ya cerrado, permitido por owner.***

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

*** RESPUESTA: Mantén esta decisión pendiente ***

---

## 6 🟠 F-016 · El diseño de la pantalla de login

No existe entre los 32 HTML aprobados ni entre las 8 del alcance: es una **novena** que nadie
planificó, y **es la primera que ve el socio**. Sigue con el andamiaje hecho con los tokens. Si
quieres algo mejor para el día 11, hay que decidirlo con margen — y quedan cuatro días.
*** RESPUESTA: Adelante diseña la pantalla llama a Deepseek para hacerlo. Que siga los estandares del resto de la aplicación, permitido por owner. ***

---

## 7 🟠 F-054 · Dos rutas de despliegue de migraciones a medias

O se enlaza la CLI y se retro-registran las once en su formato, o **el MCP pasa a ser la ruta
oficial y se documenta como tal** — que es la que funciona y la que se ha usado para 0007 a
0011. Dos caminos a medias es exactamente como se llegó a un pendiente con un comando que no
podía funcionar. No urge, pero no se puede quedar así.
*** RESPUESTA: solucionalo de la manera que consideres más inteligente a pesar de que sea la más cosotosa. El MVP es sólo MVP, ninguna decisión ahora nos debe descentrarnos del objetivo final de esta aplicacion ***
---

## 8 · Preguntas menores, sin bloqueo

| # | Pregunta | Nota |
|---|---|---|
| 7.1 | **¿Los cinco hilos sembrados son los de la demo del día 11?** | Sube de prioridad con el punto 1: si eliges (a), la siembra se regenera y es el momento de cambiarlos |
| 7.2 | F-027 (a) · el recuento de no leídos de MSG-01 | Fuera del MVP. Para V1: o `thread_read_receipts` con su RLS, o se retira del spec |
| 7.3 | ¿Qué hace INV-01 con una línea eliminada? (F-023 d) | O quinto chip "Eliminados" con restaurar, o eliminar es definitivo. **No urge** |
| 7.4 | `auth_leaked_password_protection` desactivado en Auth | ¿Se activa? |
| 7.5 | La app no tiene URL desplegada | Decisión del 7-ago: solo local. **Se retoma antes del día 11**. Mientras: `npm --prefix app run dev` (5173), o `npm run build && npm run preview` (4173), que es el bundle que prueba el e2e |
*** RESPUESTA: Mantén estas decisiónes pendiente ***

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
