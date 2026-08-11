# Pendiente del PO · cerrado el día 6 (10-ago-2026)

> **Revisado el 11-ago, dos veces.** El punto 1 estaba **mal diagnosticado**, el punto 2 cambió
> de causa, y el punto 3 mandaba ejecutar **un comando que no puede funcionar en este repo**
> (F-054). Los tres se reescribieron con lo medido, no con lo supuesto, y los tres están
> **cerrados y comprobados**. De aquí en adelante solo quedan decisiones.
>
> Cada punto lleva **qué pasa si no se hace**, **los pasos exactos** y **cómo comprobar que
> quedó cerrado**.
>
> Proyecto Supabase: **`troxminloxkjwihwfevs`** · Repo: **`aguillensp-sudo/RinWorld.io`**

---

## 1 ✅ F-050 · La clave publicable — RESUELTO en local (11-ago)

**Lo que yo escribí aquí ayer era falso.** Te mandé al dashboard a por una clave nueva. No
hacía falta: la clave siempre fue la correcta. **Le sobraba un `;` al final.**

```
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…N1g;
                                                 ^ esto
```

47 caracteres en `app/.env` contra los 46 que devuelve el API del proyecto; el resto coincidía
byte a byte. Con el `;` fuera, `GET /auth/v1/health` responde **200**. Ya está quitado de tu
`.env` local — no hay nada que hacer por tu parte en esta máquina.

**Por qué se escapó un día entero.** F-037 había sido un carácter fuera de ISO-8859-1, así que
comprobé la clase de carácter, salió limpia, y la di por buena. Pero un `;` es ASCII: la
guardia miraba el **alfabeto** cuando el defecto estaba en la **forma**. Un `sb_publishable_`
tiene longitud fija — comparar 47 contra 46 lo habría cazado en el primer minuto. Verifiqué
que los bytes eran legales sin verificar que el valor lo fuera.

### De este punto no queda nada. Los secrets de GitHub están bien

Llegué a escribir aquí que había que repegar el secret de CI. **No hace falta: ya lo hiciste
tú hoy a las 09:45 UTC y está correcto.** Lo demuestra la corrida de CI de las 09:59, que
**autenticó y ejecutó los 40 escenarios** — cosa imposible con una clave mala.

Los ocho secrets del repo, por fecha:

| secret | actualizado |
|---|---|
| `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL` | **hoy 09:45 / 09:46 UTC** |
| los seis `E2E_*` | 9-ago |

> **Y de paso, una aclaración por si te vuelve a pasar:** un secret de GitHub Actions **no se
> puede copiar nunca**, ni siendo dueño del repo. Son de solo escritura: la web enseña el
> nombre y la fecha, y el valor no lo enseña a nadie. Si estás en una pantalla donde puedes
> copiar el valor pero no editarlo, es la de **claves API de Supabase**, no la de GitHub.
> Para editarlos de verdad: `Settings → Secrets and variables → Actions`, icono del lápiz.
> Eres **admin** del repo, así que permisos no te faltan.

---

## 2 ✅ La contraseña de `alpha` — ROTADA Y VERIFICADA (11-ago)

Cerrado, y cierra F-038 con ello. Los tres sitios:

| dónde | cuándo | comprobado |
|---|---|---|
| Supabase (`auth.users`) | 10:33:40 UTC | cambio real de contraseña, no un login |
| Secret `E2E_ALPHA_PASSWORD` | 10:38:40 UTC | corrida `31483500764`, la primera posterior, **41/41** |
| `app/.env` local | 12:56 local | login directo contra GoTrue → **200** |

**Que la CI pasara es lo que demuestra que el secret y la base emparejan.** Sin esa corrida
posterior a la rotación, tener los dos "actualizados" no probaba que fueran el mismo valor.

### Lo que se aprendió por el camino, que vale más que el arreglo

El `.env` local tardó un paso más, y durante un rato quedó como cambiado sin estarlo. Lo que
lo resolvió no fue mirar el fichero otra vez, sino **tres evidencias independientes**: el
`mtime` era anterior a la rotación, el tamaño cuadraba byte a byte con la edición previa, y un
login en vivo devolvía `400`.

**Un "ya está cambiado" no es una verificación. La longitud del valor sí lo es** — y no
obliga a enseñar el secreto a nadie. Para la próxima:

```bash
awk -F= '/^E2E_ALPHA_PASSWORD=/{print "longitud: " length(substr($0, index($0,"=")+1))}' app/.env
```

### `beta` no se rota — decisión del PO, 11-ago

Su contraseña viajó en los mismos informes de CI y **se acepta el riesgo a sabiendas**: es una
cuenta de prueba de un dominio `.test`, sin datos reales, sin más poder que el de su propia
organización sembrada, y los informes ya publicados caducan a los 7 días. Queda anotado para
que nadie lo reabra como si fuera un descuido. **Si algún día se siembran datos que no sean de
demo, esto vuelve a la mesa.**

### Y una decisión que sigue pendiente

`ci.yml` sube el informe de Playwright con `actions/upload-artifact@v4` y `retention-days: 7`.
Ese informe es el que adjuntaba el volcado del DOM con el valor de cada campo. Tres opciones:

- **(a)** Dejarlo como está. Ya no se escribe la contraseña, y 7 días de retención acotan el
  daño de un descuido futuro. **Es lo que yo haría.**
- **(b)** Subir el informe **solo cuando el job falla** (`if: failure()`). Menos superficie,
  y cuando lo necesitas sigue estando.
- **(c)** No subirlo. Barato hoy y caro el día que la CI falle y no puedas ver por qué — que
  es exactamente lo que pasó ocho días seguidos.

**Dime cuál y lo dejo hecho.**

---

## 3 ✅ Migraciones 0007 y 0008 — APLICADAS AL REMOTO (11-ago)

**Aplicadas y comprobadas. No queda nada por tu parte.** Los dos agujeros están cerrados en la
base: `threads.state` ya lo mantiene la derivación, y una organización ya no puede aceptar su
propia oferta.

| versión | migración |
|---|---|
| `20260811130123` | `mvp_0007_thread_state_machine` |
| `20260811130148` | `mvp_0008_offer_only_receiver_decides` |

### Lo que pasó de verdad, que es lo que hay que aprender de aquí

**El comando que te dejé escrito no podía funcionar, y por eso te quedaste parado.** Este repo
**no tiene `supabase/config.toml`**: nunca se inicializó como proyecto de la CLI ni se enlazó
con `troxminloxkjwihwfevs`. `supabase db push` te habría pedido un `supabase link` antes de
nada. Es F-054.

Y la pista estaba delante desde el principio. Así figuran registradas las seis anteriores:

```
mvp_0001_organizations_and_members … mvp_0006_favorite_count_without_view
```

Ese prefijo `mvp_` **no lo pone la CLI** — lo puse yo al aplicarlas por MCP. El camino que sí
funciona en este proyecto era justo el que no estaba escrito, y bastaba con leer el registro de
migraciones del remoto para verlo. **Una instrucción que no se ha ejecutado nunca es una
hipótesis, no un procedimiento.**

### Antes de escribir, el recálculo se simuló en seco

La única parte de 0007 que toca datos existentes es el `update` final del §6. Se corrió su
misma lógica **como consulta de lectura contra tus datos reales** antes de aplicar nada:

| almacenado | derivado | veredicto |
|---|---|---|
| ABIERTO | ABIERTO | coincide |
| ACUERDO ALCANZADO | ACUERDO ALCANZADO | coincide |
| CON CONSULTA PENDIENTE | CON CONSULTA PENDIENTE | coincide |
| CON OFERTA PENDIENTE | CON OFERTA PENDIENTE | coincide |
| CERRADO SIN ACUERDO | *(ABIERTO)* | excluido — transición manual |

### Y después, las tres comprobaciones del plan

1. **Los cinco estados siguen ahí**, uno por hilo. Los badges de MSG-01 no se han movido.
2. **La consulta de divergencia devuelve 0 filas**: lo almacenado y lo derivado coinciden.
3. **Los cuatro triggers existen y están habilitados** — `thread_items_touch_estado`,
   `thread_items_sync_state`, `threads_guard_state`, `thread_items_guard_decider`.
4. Y de propina: **0 filas** con estado de tarjeta y sin `estado_changed_at`, o sea que el
   relleno de la columna nueva cubrió toda la siembra.

El badge de MSG-01 ha dejado de ser una afirmación de la siembra y ha pasado a ser una función
de las filas. Que era todo el objetivo.

### Una salvedad honesta sobre lo que aquí ponía "probadas" (F-055)

Este documento decía que las dos migraciones estaban *"escritas y probadas"*. **Escritas y
revisadas sí; probadas no.** En `supabase/tests/` no hay ni una mención a `derive_thread_state`
ni a `guard_offer_decider`: los 30 asertos cubren las reglas de 0003, no las nuevas. Que la CI
siga verde con las dos aplicadas demuestra que **no rompen nada**, que no es lo mismo.

Tampoco se pueden comprobar desde una conexión administrativa: las dos guardias se
auto-exceptúan para `service_role` y `postgres` —tiene que ser así, por ahí entra la siembra—,
así que ni el MCP ni el smoke test pueden dispararlas. Hace falta el stub de `auth.uid()` que
la suite ya usa para RLS. **Cuatro asertos, y los pongo el día 8 junto a MSG-02** — no los meto
hoy porque el día ya va cargado y esto no lo has pedido.

### Lo que sigue pendiente de decidir, para V1

**Hay dos rutas de despliegue a medias y hay que quedarse con una:** o se enlaza la CLI y se
retro-registran las seis primeras en su formato, o el MCP pasa a ser la ruta oficial y se
documenta como tal. Dos caminos a medias es exactamente como se llega a un pendiente con un
comando que no existe. No urge, pero no se puede quedar así.

---

## 4 🟠 F-043b · ¿Existe `RETIRADA`? — **decide antes del día 8**

**Por qué ahora:** VND-01 se construye el día 8 (`Plan §3`) y es la pantalla que la pide.

**El estado real, verificado hoy sobre las 9 capabilities y los 32 HTML:**

- En `openspec/specs/` **no aparece en ninguna parte**. Tu recuerdo era correcto.
- El día 2 ya se resolvió así (`Dia-02_decisiones_esquema.md:138`: *"`RETIRADA` · No existe.
  No hay escenario de retirada"*).
- **Pero `Rinworld_spec_VND-01.md` sí la tiene**, y con regla numerada: la tabla de acciones
  da `Retirar oferta` en estado PENDIENTE (línea 91) y **`RNG-VND-04`** (línea 149) describe
  la confirmación inline entera. **La decisión del día 2 se tomó mirando solo la capability.**
- Y VND-01 usa además un estado **`EXPIRADA`** que tampoco existe en `offer-card`, donde
  `valid_until` es un aviso **local** y orientativo.

**Un problema añadido:** `RNG-VND-04` dice *"Confirmar retira la oferta y **elimina la
fila**"*. Eso choca de frente con el *"sin eliminarse del historial"* de `offer-card`. **Tal
como está escrita, no es implementable.**

### Las tres opciones

| | Qué implica |
|---|---|
| **(a) No entra.** VND-01 no pinta `Retirar oferta` | Cero trabajo. VND-01 se aparta de su spec en un botón, con la nota escrita al lado como se hizo con F-025 |
| **(b) Entra como quinto estado** | Migración nueva: valor en `thread_items_estado_oferta_chk`, guardia de que **solo el emisor** retira (simétrica a 0008), y `offerActions()` devuelve `['retirar']` al emisor. Medio día |
| **(c) Entra, pero como decisión de V1** | Se anota en `product-decisions.md` y VND-01 pinta el botón deshabilitado con el motivo, como el watcher de SRCH-01 |

**Mi recomendación: (a) para el MVP.** No está en ninguna capability, la demo del día 11 no la
necesita, y el día 8 ya lleva la rebanada E2EE encima. Si la quieres para V1, (c) deja la
constancia sin coste.

---

## 5 ✅ F-045 · El hilo cerrado se reabre al escribir — DECIDIDO (11-ago)

**Tu decisión, literal:** *"Un hilo cerrado sólo se reabre cuando uno de los dos usuarios
vuelve a escribir en él. No hay más opciones."* Implementada en **0009** y registrada en
[`Dia-07_decisiones_producto.md`](Dia-07_decisiones_producto.md) (D-07-01), que es donde tiene
que leerla quien construya MSG-02.

**Tres cosas que conviene que sepas de cómo ha quedado:**

1. **Sale más barata de lo que este documento decía.** Las cuatro specs que dicen lo contrario
   son de *pantalla*. La **capability cerrada no dice nada**: `thread-lifecycle` nombra
   `CERRADO SIN ACUERDO` una sola vez y es para hablar del marcado de líneas consultadas. **Tu
   decisión no rompe ninguna de las nueve capabilities.**
2. **Arrastra una regla obligatoria:** MSG-02 tiene que **mantener el campo de mensaje visible**
   en un hilo cerrado. Si desaparece —como dice su spec— nadie puede escribir y la reapertura
   no ocurre nunca.
3. **Solo reabre un elemento nuevo.** Marcar una consulta como respondida o cualquier
   mantenimiento sobre los elementos existentes **no** resucita el hilo. Si no, un hilo que
   cerraste se te reabriría solo y sin que nadie hubiera dicho nada.

Reabre además **al estado que digan sus filas**, no a un `ABIERTO` forzado: si el hilo se cerró
teniendo una oferta aceptada, vuelve a `ACUERDO ALCANZADO`. El estado es una función de los
elementos, y forzarlo sería reintroducir el problema que 0007 vino a quitar.

---

## 5-bis ✅ 0009 y 0010 — APLICADAS AL REMOTO (11-ago)

| versión | migración |
|---|---|
| `20260811…` | `mvp_0009_thread_reopens_on_write` |
| `20260811…` | `mvp_0010_offer_decider_guard_must_be_invoker` |

**0010 no era cosmética: tapaba un agujero que estuvo abierto en producción toda la tarde.** La
guardia que aplicamos a mediodía para impedir que una organización acepte su propia oferta **no
bloqueaba a nadie**. Se creó `security definer`, y dentro de una función así `current_user` es
la dueña —`postgres`—, con lo cual su propia exención para la siembra se cumplía siempre. Es
**F-056**, y reabrió F-051 durante unas horas.

Lo encontró el aserto que por la mañana no existía, en su primera corrida. Y el aviso llevaba
escrito en el repo desde el día 2, en `0001_organizations_and_members.sql:219`: *"OJO: este
trigger NO puede ser SECURITY DEFINER […] la guarda se desactivaría siempre a sí misma"*. **Un
comentario solo protege a quien lo lee. Lo que protege de verdad es un aserto.**

### Cómo se comprobó esta vez, que es lo que cambia

A mediodía di 0008 por buena porque *"el trigger existe y está habilitado"*. **Eso no probaba
nada** — el trigger existía y no hacía nada. La comprobación de ahora es el bit del que dependía
todo:

```
app.guard_offer_decider   security invoker   ← el arreglo
app.guard_thread_state    security invoker
app.derive_thread_state   SECURITY DEFINER   ← a propósito: escribe por encima de RLS
app.sync_thread_state     SECURITY DEFINER   ← a propósito, y no mira current_user
```

Y los cinco estados de los hilos siguen intactos tras 0009.

**Lo que sigue sin poder comprobarse desde aquí, dicho claro:** las dos guardias se
auto-exceptúan para `service_role` y `postgres`, así que ninguna conexión administrativa puede
dispararlas. Que **bloqueen** lo prueban los asertos de `01_schema_smoke.sql` desde una sesión
`authenticated`; lo que se verifica en el remoto es que lo desplegado es ese mismo código.

---

## 6 🟠 F-033 · El CSV no distingue un check en rojo de uno inejecutable

**Sigue igual que ayer y hoy ha sumado un caso nuevo.** Las **tres filas de la corrida 1 de
SRCH-01** dicen `FALLA 2/4` y **no miden al modelo**: C1 estuvo rojo por un defecto de mi
contrato de aceptación, no del artefacto. En el CSV son indistinguibles de las tres de la
corrida 2, que sí miden.

**Con el formato de hoy, la métrica de "intentos hasta verde" no es fiable** — que es
justamente la cifra de la que `Plan §11` hace depender la viabilidad del arnés en V1.

**Lo que hay que decidir para V1:**

1. ¿El CSV lleva un estado propio de check — `rojo` / `inejecutable`?
2. ¿Un intento con algún check inejecutable **cuenta como intento del modelo**?
3. **Nuevo hoy:** ¿y un intento que falla por un defecto del **contrato**? Hoy son tres de
   seis filas.

Mientras tanto, las seis filas de hoy llevan su contexto en `harness/metrics/SRCH-01/`.
**No promedies las seis.**

---

## 7 🟠 F-027 (a) · El recuento de no leídos de MSG-01

Para V1: o `thread_read_receipts` con su RLS, o el indicador se retira del spec. **En el MVP
queda fuera**, y hay un test que falla si reaparece. No urge.

---

## 8 🟠 F-016 · El diseño de la pantalla de login

No existe entre los 32 HTML aprobados ni entre las 8 del alcance: es una **novena** que nadie
planificó, y **es la primera que ve el socio**. Sigue con el andamiaje hecho con los tokens.
Si quieres algo mejor para el día 11, hay que decidirlo con margen.

---

## 9 · Preguntas menores, sin bloqueo

| # | Pregunta | Nota |
|---|---|---|
| 9.1 | ¿Los cinco hilos sembrados son los de la demo del día 11? | Están en el Supabase real con `content_ciphertext` de relleno. Cambiarlos son diez minutos |
| 9.2 | ¿Qué hace INV-01 con una línea eliminada? (F-023 d) | O quinto chip "Eliminados" con restaurar, o eliminar es definitivo. **No urge** |
| 9.3 | ¿Debe verse la paginación de INV-01 en la demo? | Alpha cabe en una página |
| 9.4 | `auth_leaked_password_protection` desactivado en Auth | ¿Se activa? Va bien con el punto 2 |
| 9.5 | La app no tiene URL desplegada | Decisión del 7-ago: solo local. **Se retoma antes del día 11**. Mientras: `npm --prefix app run dev` (5173), o `npm run build && npm run preview` (4173), que es el bundle que prueba el e2e |

---

## Orden que yo seguiría

**Los tres que bloqueaban algo están cerrados.** No queda ni un arreglo pendiente de tu parte:
lo que resta son decisiones de producto, y esas no las puedo tomar yo.

1. ~~Punto 1 (la clave)~~ ✅ · ~~Punto 2 (la contraseña)~~ ✅ · ~~Punto 3 (0007 y 0008)~~ ✅ ·
   ~~Punto 5 (reapertura del hilo)~~ ✅ decidido por ti
2. **Punto 5-bis** (aplicar 0009 y 0010) — **lo único urgente que queda**, y lo es porque
   **0010 tapa un agujero que ahora mismo está abierto en producción**. Un «sí» y lo hago.
3. **Punto 4** (`RETIRADA`) — antes del día 8, que es cuando se construye VND-01.
4. La opción (a)/(b)/(c) del informe de Playwright en `ci.yml` — una línea, cuando quieras.
5. El resto, sin prisa.

El punto 4 es una decisión de una frase y se abarata hoy: la pantalla que la implementa todavía
no existe.

---

*Escrito el 10-ago-2026 · Claude Code (Opus 5) · se sobrescribe en cada cierre de día*
