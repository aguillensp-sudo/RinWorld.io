# Pendiente del PO · cerrado el día 6 (10-ago-2026)

> Cada punto lleva **qué pasa si no se hace**, **los pasos exactos** y **cómo comprobar que
> quedó cerrado**. Los tres primeros son los que bloquean algo; el resto son decisiones.
>
> Proyecto Supabase: **`troxminloxkjwihwfevs`** · Repo: **`aguillensp-sudo/RinWorld.io`**

---

## 1 🔴 F-050 · La clave publicable de Supabase no vale

**Qué bloquea:** los **40 escenarios e2e**, la CI entera, y con ella la **puerta de salida de
S1**. Es lo único que la separa del verde.

**Qué se sabe con certeza.** La clave de `app/.env` está limpia —cero caracteres fuera de
ISO-8859-1, la guardia de `supabase.ts` no salta, la app arranca— y Supabase la rechaza
igual. Verificado sin la app por medio:

```
GET https://troxminloxkjwihwfevs.supabase.co/rest/v1/organizations?select=id&limit=1
→ HTTP 401  {"message":"Invalid API key","hint":"Double check your API key."}
```

Formato `sb_publishable_`, 47 caracteres. `app/.env` está modificado el 10-ago a las 15:57.
**Dos hipótesis:** se pegó una clave de **otro proyecto** o truncada, o se **rotó en Supabase**
y esta copia quedó vieja.

**Ojo, esto es distinto de F-037.** F-037 era un carácter fuera de ISO-8859-1 y **está
arreglado** — la guardia lo demuestra al no dispararse. Esto es una segunda causa detrás.

### Pasos

1. Entra en `https://supabase.com/dashboard/project/troxminloxkjwihwfevs/settings/api-keys`.
2. Copia la clave **publishable** (`sb_publishable_…`). **No la `secret`** (`sb_secret_…`):
   esa va al navegador jamás, y si acaba en `VITE_*` se publica en el bundle.
3. Comprueba que el **Project URL** de esa misma página es `https://troxminloxkjwihwfevs.supabase.co`.
   Si no lo es, el problema es que `.env` apunta a un proyecto y la clave es de otro.
4. Actualiza **`app/.env`** (local, gitignored):
   ```
   VITE_SUPABASE_URL=https://troxminloxkjwihwfevs.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
   Pégala en un editor de texto plano. Nada de Word ni de chat: es lo que causó F-037.
5. Actualiza el **secret de GitHub** en
   `https://github.com/aguillensp-sudo/RinWorld.io/settings/secrets/actions`:
   - `SUPABASE_PUBLISHABLE_KEY` ← la misma clave
   - `SUPABASE_URL` ← la misma URL

### Cómo compruebas que quedó cerrado

```bash
cd app && npx playwright test
```

Tiene que dar **40 escenarios en verde** (31 de antes + 9 de SRCH-01). Si el `setup` de
autenticación pasa, la clave es buena.

> **No des el diagnóstico por bueno hasta ver ese verde.** Es literalmente el error del día:
> F-037 se cerró ayer sin volver a correr el e2e después de repegar el secret, y por eso la
> segunda causa ha tardado un día más en aparecer.

---

## 2 🔴 F-038 · Rotar la contraseña de `alpha` — seguridad, sigue sin hacerse

**Qué pasa si no se hace:** la contraseña de `alpha@bearingworld.test` estuvo **descargable
en texto plano** en los artefactos de la CI de un repositorio público. Las corridas nuevas ya
no la escriben (`signIn` vacía la caja en cuanto el formulario lee el valor), pero **eso solo
tapa lo de mañana**. La contraseña actual sigue siendo la que estuvo expuesta, y los informes
ya publicados caducan solos a los 7 días — la contraseña no caduca sola.

### Pasos

1. `https://supabase.com/dashboard/project/troxminloxkjwihwfevs/auth/users`
2. Busca `alpha@bearingworld.test` → **Reset password** (o borra y recrea el usuario con
   contraseña nueva; si lo recreas, comprueba que su fila de `members` sigue apuntando a
   `Rodamientos Ibéricos`).
3. Haz lo mismo con la cuenta **beta** si su contraseña también viajó en algún informe.
4. Actualiza en los **dos** sitios:
   - `app/.env` → `E2E_ALPHA_PASSWORD` (y `E2E_BETA_PASSWORD` si la rotas)
   - GitHub secrets → `E2E_ALPHA_PASSWORD`, `E2E_BETA_PASSWORD`

### Y una decisión que va con esto

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
