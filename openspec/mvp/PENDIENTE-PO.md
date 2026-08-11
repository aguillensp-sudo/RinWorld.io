# Pendiente del PO · cerrado el día 6 (10-ago-2026)

> **Revisado el 11-ago.** El punto 1 estaba **mal diagnosticado** y ya está resuelto; el punto 2
> ha cambiado de causa. Los dos se reescribieron con lo medido, no con lo supuesto.
>
> Cada punto lleva **qué pasa si no se hace**, **los pasos exactos** y **cómo comprobar que
> quedó cerrado**. Los tres primeros son los que bloquean algo; el resto son decisiones.
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

## 2 🟠 La contraseña de `alpha` de tu `.env` local no es la que hay en Supabase

**Ojo, esto ya no bloquea la CI** — la CI usa el secret `E2E_ALPHA_PASSWORD`, que es correcto y
autentica. **Bloquea solo tu máquina**: mientras no lo arregles no puedes correr el e2e en
local y dependes de esperar 5 minutos a GitHub para cada comprobación.

**Qué se sabe con certeza.** Con la clave ya arreglada, login directo contra GoTrue, sin la
app por medio:

| cuenta | resultado |
|---|---|
| `beta@bearingworld.test` | **200** · token emitido |
| `alpha@bearingworld.test` | **400** · `invalid_credentials` |

Y en `auth.users`: alpha está **confirmada, sin banear, sin borrar**, y su último login bueno
fue el **10-ago 12:04:35**, con `updated_at` idéntico — es decir, **la contraseña no se ha
tocado en Supabase desde entonces**. `app/.env` se modificó ese mismo día a las **15:57**, casi
cuatro horas después. Esa edición metió las dos averías a la vez: el `;` de la clave y una
contraseña de alpha que no coincide. El valor bueno no está en el repo (el seed las recibe
como variables de psql, correcto según `CLAUDE.md` §1), así que **solo lo tienes tú**.

**Tienes dos caminos, y el segundo es mejor.**

**(a) Recuperar el valor bueno.** Está en tu gestor de contraseñas o donde lo guardaras el
9-ago. Del secret de GitHub **no se puede sacar**: son de solo escritura. Lo pones en `.env` y
listo. Rápido, pero deja F-038 sin cerrar.

**(b) Rotarla, que es lo que F-038 pide desde el día 4 — recomendado.** Esa contraseña estuvo
descargable en texto plano en los artefactos de la CI de un repositorio público; las corridas
nuevas ya no la escriben, pero eso solo tapa lo de mañana. Y la que hay ahora en `.env` es
corta y de diccionario. Rotarla cierra el fallo **y** la deuda de seguridad de una vez.

### Pasos (camino b)

1. Elige una contraseña nueva **larga y aleatoria** (como la de beta, que sí lo es).
2. Aplícala en el SQL editor del proyecto — es exactamente lo que hace el seed, y funciona con
   un dominio `.test` que no recibe correo, cosa que "Reset password" del dashboard no:
   ```sql
   update auth.users
      set encrypted_password = crypt('PON-AQUI-LA-NUEVA', gen_salt('bf')),
          updated_at = now()
    where email = 'alpha@bearingworld.test';
   ```
3. Ponla en los **dos** sitios, sin espacios ni caracteres de más al final:
   - `app/.env` → `E2E_ALPHA_PASSWORD=`
   - GitHub secret `E2E_ALPHA_PASSWORD`
4. Aprovecha y haz lo mismo con **beta**: su contraseña viajó en los mismos informes.

### Cómo compruebas que quedó cerrado

```bash
cd app && npx playwright test
```

**40 en verde**, que es lo que la CI ya da. Ojo con una cosa: si lo lanzas encadenando algo
detrás (`| tail`, `&& echo`), **el código de salida que verás es el del último comando, no el
de Playwright**. Es F-046, y hoy he vuelto a caer en ella.

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

## 3 🟠 Aplicar las migraciones 0007 y 0008

**Qué pasa si no se hace:** hoy, en el Supabase real, **`threads.state` no lo mantiene nadie**
(los cinco badges de MSG-01 son ciertos solo porque la siembra los escribió a mano) y **una
organización puede aceptar su propia oferta**. Las dos cosas están escritas y probadas, pero
un fichero `.sql` en el repo no protege nada.

### Pasos

**El orden importa: 0007 antes que 0008.**

Con la CLI, desde la raíz del repo:

```bash
supabase db push
```

O a mano, en `https://supabase.com/dashboard/project/troxminloxkjwihwfevs/sql/new`, pegando y
ejecutando **primero** `supabase/migrations/0007_thread_state_machine.sql` y **después**
`supabase/migrations/0008_offer_only_receiver_decides.sql`.

### Qué hace 0007 que conviene saber antes de ejecutarlo

Al final **recalcula el estado de los hilos existentes** desde sus elementos. Ya está
verificado contra la siembra: **los cinco hilos conservan su estado**, uno por badge. El
único que se habría roto —`CERRADO SIN ACUERDO`, que caería a `ABIERTO`— queda excluido a
propósito porque es transición manual.

### Cómo compruebas que quedó cerrado

En el SQL editor:

```sql
-- 1. Los cinco estados siguen ahí, uno por hilo.
select state, count(*) from public.threads group by state order by state;

-- 2. La derivación coincide con lo almacenado (0 filas = correcto).
select id, state, app.derive_thread_state(id) as derivado
from public.threads
where state <> 'CERRADO SIN ACUERDO' and state is distinct from app.derive_thread_state(id);

-- 3. Los dos guardias existen.
select tgname from pg_trigger
where tgname in ('thread_items_sync_state','thread_items_guard_decider','threads_guard_state');
```

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

## 5 🟠 F-045 · ¿Se reabre un hilo cerrado? — **hoy es barato, mañana no**

**Por qué ahora:** mañana se construye **MSG-02**, que es donde vive el botón `Cerrar sin
acuerdo`. Después habría que rehacerlo.

**Lo que dicen las specs aprobadas, unánimes** (verificado hoy a petición tuya):

- `MSG-02:84` — *"`Cerrar sin acuerdo` → CERRADO SIN ACUERDO (**irreversible** — pide
  confirmación)"*
- `MSG-02:154` — *"El campo de mensaje y el botón `Crear oferta` **desaparecen**. Solo se
  muestra el historial en modo lectura. Botón `Revertir a abierto` **no disponible**"*
- `MSG-02:175` y `MSG-03:159` — *"El único estado irreversible es CERRADO SIN ACUERDO"*
- `MSG-01:82` — badge tachado, *"solo lectura"*

La capability `thread-lifecycle` **calla**: su único escenario de cierre habla del marcado de
líneas consultadas.

**El mecanismo que propusiste —que se reabra cuando cualquiera de las dos partes escribe— no
puede ocurrir tal como está especificado: si el campo de mensaje desaparece, nadie puede
escribir.** La reapertura por escritura exige antes quitar esa regla.

### Las dos opciones

| | Qué implica |
|---|---|
| **(a) Se queda irreversible** (lo implementado) | Cero trabajo. Es lo que dicen las cuatro specs |
| **(b) Se reabre al escribir** | Toca: la tabla de acciones de MSG-02, su §6 y §7, la §7 de MSG-03, el badge de MSG-01, y el trigger `app.sync_thread_state` de 0007. **De esas, solo MSG-01 está construida** |

Si eliges **(b)**, dilo **antes de que empiece MSG-02** y lo dejo hecho de una pasada. Como
decisión de producto es razonable —un cierre no tiene por qué ser para siempre—; lo que no
puede quedarse es la contradicción entre lo que dicen las specs y lo que hace el código.

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

1. **Punto 1** (la clave) — desbloquea el e2e, la CI y la puerta de S1 de una vez.
2. **Punto 2** (la contraseña) — es seguridad y lleva dos días abierta.
3. **Punto 3** (las migraciones) — cinco minutos, y hasta entonces hay dos agujeros vivos.
4. **Punto 5** (reapertura del hilo) — **antes de mañana o ya no**.
5. **Punto 4** (`RETIRADA`) — antes del día 8.
6. El resto, cuando quieras.

Los puntos 1, 2 y 3 se hacen en un cuarto de hora largo y cierran todo lo que hoy está en
rojo por tu lado.

---

*Escrito el 10-ago-2026 · Claude Code (Opus 5) · se sobrescribe en cada cierre de día*
