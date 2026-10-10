# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap`; si te lanzan en un worktree `claude/…`, **opera sobre esa ruta con paths
absolutos.** Desde el 25-sep `mvp/bootstrap` es la rama por defecto de GitHub. Si un worktree
nace en `43bb222`, es una sesión vieja reabierta: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo
impide). Se sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. La historia
va en `diario/`, las decisiones en `DECISIONES-V1.md`, los hallazgos en `../mvp/findings/` y
las reglas en `CLAUDE.md`. La versión larga anterior sigue en `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

Empieza por §6 y luego §3.
---

**Día 36 de V1 · 10-oct-2026 · Estado: CERRADO (16:50 UTC).** Microplan de demo (8–12 oct, `plan-demo-h5.md`): **D1 a D4 hechos.** Queda **D5** (arreglos, ensayo 2, congelación).
D4 = alta real de Nakishita Nakamoto Inc. y Rey Transmisiones por el PO (recorrido completo), catálogo de Rey (29 líneas), cobros y frescura resembrados, ensayo 1 aprobado por el PO.
Además: `INV-04` fase 1 (`0057`), nombre del administrador en `DIR-02` (`0058`), `Contactar` por la spec, VERA con guía verificada (`F-246`), cabeceras 28/14/14, padding único
`--bw-screen-pad`, `F-247` (`0059`), `F-248`. Detalle en `diario/dia-36.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Despliegue de todo lo del día | CI `38067281582` (verde, los dos `deploy`); `curl` a `rin-world-io.vercel.app`: el JS trae `Abre tu hilo…` y `organization_admin_name`, el CSS `--bw-screen-pad:24px 28px 40px` | Servido. Por contenido, no por 200 |
| `0057` y `0058` en producción | `has_function_privilege`/`has_table_privilege` en el catálogo de producción; banco de esquema en Docker | `anon` no ejecuta ni lee nada de las dos; las tablas `ingest_*` solo se leen |
| `0059` y re-anclaje de frescura | `select demo_reanchor_freshness()` en producción: 221 movidas, 4 d 5 h; 113 de 187 publicadas < 7 d (60,4 %); `6205-2RS` 7 frescas / 5 viejas; 1 > 30 d | Hecho el 10-oct. Mañana ya habrá envejecido: repetir antes de cada ensayo |
| Cobros de producción | `billing_org_status` tras `demo_billing.sql` | Cuscinetti `ACTIVE` 10 d (vence 20-oct), Rhône 246 d, Ruiz `SUSPENDED`, Timken `CANDIDATA A BORRADO`; las dos nuevas `EN PRUEBA` |
| `Consultar` y `Contactar` de fila | `app/e2e/search-contactar.spec.ts` (3 casos, solo lectura) en local contra `bearingworld-e2e`: 6/6; CI verde | Pasa. Cubre el flujo que antes se rompía sin avisar |
| Tipografía y padding | `cabeceras.test.ts` (58) y `padding.test.ts`; `vitest run` entero: 2094 verdes, 23 omitidas; `tsc` limpio | Lee el CSS, **no mide el render** |
| VERA | `vera-prompt.test.ts` (12): el prompt trae la regla y la guía, y cada nombre citado existe en `Inventory.tsx`/`ImportMapping.tsx` | El test no prueba qué contesta el modelo. El PO sí lo probó (ver abajo) |
| Pruebas del PO | Lo dijo en el chat | Todo correcto tras ver las cabeceras, el padding y la alineación; `Consultar`/`Contactar` bien; ensayo 1 hecho; VERA contesta cómo subir inventario y no sabe `Visibilidad`. **No lo midió este agente** |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. Ya se tocó `vera/index.ts` (prompt, `F-246`); el cambio de proveedor sigue sin hacerse.
- **Corriente B · Fábrica — EN MARCHA.** **25 pantallas construidas y 25 aceptadas.** Las últimas cuatro (`REC-01`, `SET-SEC-01`, `INVT-02`, `ACT-02`), **a mano**, sin
  filas en `harness-metrics.csv`. **Ninguna pantalla aprobada queda por construir** salvo `INV-04` (plan en `v1/plan-inv04-ingestion-por-correo.md`) y `MSG-03` (vive
  en `MSG-02`). Cifras 7 y 8: un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar
   nuevas claves» con esa cuenta** (borra su backup). Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por ventana de 30 min,
   acertar no reinicia, `0052`): el PO se bloqueó una vez probando y se le reinició el contador a mano.
1. **D5 (lun 12-oct)**: solo los arreglos del ensayo 1, **ensayo 2** cronometrado, grabación de respaldo, guion escrito y **congelación** (ni despliegues ni e2e locales contra producción).
   Antes del ensayo: `select public.demo_reanchor_freshness()` y, si pasan de ~20-oct, `demo_billing.sql`. Ver `plan-demo-h5.md` §4. Los números de §3 no se renumeran.
2. **`INV-04`, fase 2 (recepción)** — la fase 1 está hecha (`0057`). SES eu-west-1, `ingest.nortexsys.com` verificado, MX `10 inbound-smtp.eu-west-1.amazonaws.com` en Arsys (el correo a
   `ingest` rebota hasta la fase 2: esperado). **Sin hacer ni comprobar de la fase 0: MFA y presupuesto de 5 USD** (la cuenta `2263-9540-1132` es miembro de una organización, rol federado).
   Antes de la fase 2: **leer los límites vigentes de las funciones de borde**. **No usar el conector `AWS MCP`** salvo que el PO lo pida, y con un rol de mínimo privilegio.
   Fuera del sprint de demo (decisión del 8-oct).
3. **VERA: ampliar la guía verificada** (`index.ts`, sección «GUÍA VERIFICADA»): hoy solo la subida de inventario. Siguientes, por orden: `Visibilidad` (`INV-07`) y el resto de `INV-01`,
   Comprando, Hilos, Vendiendo. Cada entrada con su nombre en el test de `vera-prompt.test.ts`. Antes de tocar `vera/index.ts`, `vera-vertex-eu-migracion.md`.
4. **`F-234` en las demás tablas:** `0051` envolvió 8; quedan **31** (`forum_*` y `watchers_*` primero). Patrón de `0047`/`0051`, con el banco delante. Las tres tablas `ingest_*` nacen ya envueltas.
5. **Lista previa a empujar, las cuatro cosas**: `tsc --noEmit`, `vitest` entero, **el banco de esquema (`supabase/tests/run.sh`) si se tocó `supabase/`** y, si se tocó un e2e o el arnés, la suite
   e2e contra `bearingworld-e2e` (`F-230`). El 10-oct se empujaron dos commits sin el banco y uno dejó la CI roja.
6. Deuda sin fecha: `F-213`.

**Fecha límite:** Cuscinetti Padana pasa de `ACTIVE` a otro estado el **20-oct** (cobros resembrados el 10-oct, vence a los 10 días). `demo_watchers.sql`, resembrada el 6-oct.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **Cabeceras del shell: título 28, eyebrow 14, subtítulo 14; padding de toda pantalla `--bw-screen-pad` (24/28/40); el contenido arranca a la izquierda** (nada de `margin: 0 auto`). `screens/onboarding`
  queda aparte salvo `Invitations`. Una pantalla nueva con cabecera o contenedor raíz se añade a `cabeceras.test.ts` / `padding.test.ts`. Mandan sobre el HTML aprobado (`F-209`).
- **`Contactar` de fila (SRCH-01/02)**: con hilo abre el hilo; sin hilo, la ficha con «Primer mensaje» abierto (`autoCompose`). **`DIR-02` enseña el nombre del administrador** (`0058`). `DIR-01` lista solo los países que hay.
- **VERA no describe una interfaz que no está en su guía verificada** (`F-246`). Afirmar un control sin comprobarlo es el riesgo #1 (`CLAUDE.md` §7).
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql` y comprueba solo `PUBLISHED`** (`0059`). La séptima, `demo_org_sin_hilo.sql`, se aplica a mano y **no va en `demo_orgs.sql`**.
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida**, con `npm run demo:reset`, no a mano (`F-169`). No repone inventario. Repone las filas de los cinco hilos que falten (`F-248`).
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**, ni el arnés (`F-225`).
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell,
  con `height: 100%; overflow-y: auto` (su raíz cuelga de `#root`, que es `fixed` sin overflow).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo** (`F-146`); y **ninguna función de
  `public` la ejecuta `anon`**: lo sin sesión va por Edge Function con `service_role`.
- **En una política, las funciones de sesión van envueltas en `(select …)`** (`0047`, `F-234`): una `SECURITY DEFINER` no se inlina.
- **Fase B (`REG-05` → `06` → `07`)**: solo el ADMIN `REGISTERED`, dentro del shell con VERA `Asistente de registro`; el paso no se guarda;
  `REG-05` y `REG-06` las construye el Coder (sin criptografía), `REG-07` a mano (Plan §4.3). **La frase no sale nunca del navegador** y
  se compara con una huella en memoria de la contraseña (sin huella, se cierra la sesión); fortaleza con zxcvbn sin Levenshtein.
- **El backup de la clave** (`0052`–`0054`): sin `select` ni `update` directos de `encrypted_key_blob`/`key_iv`; el blob solo sale por `begin_key_recovery` (5 por 30 min,
  acertar no reinicia) y `read_pending_key_backup` (solo `REGISTERED`); sustituirlo exige la prueba de la frase anterior (`key_verifier`). Una columna nueva de `members` nace sin permiso.
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: lo que dejes a medias lo prueba él. Migración aditiva primero, cliente después.
- **ADR-001 en código** (`0048`, `key-backup.ts`): frase en NFC, AAD = id en minúsculas, Argon2id en worker; el estado cambia solo tras abrir
  la copia del servidor. Privada en IndexedDB, no extraíble, y cerrar sesión no la borra. `ensureKeyring(id, estado)` no publica para
  `REGISTERED` ni para quien tiene backup.
- **La importación (`0044`–`0046`)**: una transacción; solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; identidad = referencia + marca + país;
  `Reemplazo total` pasa a `DELETED` lo publicado que no viene; devuelve `inserted` y `updated`. `price` no se importa (E2EE); CSV/TSV/TXT/XLSX; tope 20.000 filas por subida.
- **`INV-01` sin `onPickFile` es la pantalla de su contrato** (subida inerte): el prop lo pasa `App.tsx`.
- **La CD despliega dos funciones sin JWT**: `access-request` y `register-organization`. Su único permiso es el token (la segunda) o el límite por hora (la primera).
- **El enlace de acceso se ve una sola vez** (solo se guarda el hash); perderlo obliga a generar otro y revoca el anterior.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que escala por causas ajenas no cuenta para la cifra 2 (regla 3).
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`. **Un artefacto verde del arnés no lleva `[skip ci]`** (`CLAUDE.md` §1.6).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **`F-226`** · `REG-01` aceptada por el PO el 7-oct; sigue sin logo, sin Google y sin VERA (sin sesión, `F-223`) | Cuando haya proveedor y almacenamiento |
| 🟠 | **`F-233`** · `INV-04` con `ingest.nortexsys.com` y Amazon SES (40 MB): fase 0 hecha salvo MFA y presupuesto; fase 1 hecha; sigue la fase 2 (§3.2) | PO + este agente |
| 🟠 | **`F-225`** · el e2e del arnés ya no va contra producción (`F-230`); falta releer el hallazgo y cerrarlo · Edge Functions de `bearingworld-e2e` sin desplegar (solo `access-request` v1) | Este agente |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **VERA solo conoce la subida de inventario**: en el resto de pantallas dice «no conozco los controles» (§3.3) | Este agente |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas por la cuenta de prueba del PO en Rodamientos Ibéricos; el e2e aislado no la tiene (`F-230`) | Releer y cerrar |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`.xls` binario no se lee** (el `.xlsx` sí, sin formatos: una fecha sale como número): va al fallo de `INV-03` | Producto: pedir `.xlsx` |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo; `contact@nortexsys.com` (`CANCELLED` en JULSA) sigue ocupando ese correo | Al diseñar la reinvitación |
| 🟡 | **Los cobros y la frescura envejecen** y `resetDemo` no los re-ancla | Decidir: verbo `security definer` o repetir a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente · **`F-073`** CLI de Supabase en la organización equivocada · Vercel en plan gratuito | Álvaro |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Cómo se ve nada en un navegador desde este agente**: las cabeceras, el padding y la alineación los vio el PO ("todo correcto"); los tests leen CSS, no miden render.
- **Qué contesta VERA fuera de la subida de inventario**: el prompt exige no inventar controles, pero solo se ha probado una pregunta (Inventario).
- **El registro de migraciones de producción para `0059`** guarda una primera versión (sin el filtro `PUBLISHED`); la función viva es la del `.sql`. Un `db push` futuro no la corregiría.
- **Si el ensayo 1 dejó incidencias**: el PO dijo que está bien; no se recogió ninguna lista de arreglos para D5.
- **Qué ve al entrar el EDITOR `REGISTERED` de cada empresa nueva** (Nakishita y Rey): `ACT-02` con una organización real. Nadie lo ha recorrido.
- **Cuánto tardó la importación de las 29 líneas de Rey** y cómo se ve su catálogo en `SRCH-01` para otra empresa: el PO la usó, nadie lo midió.
- **Cuánto se gana con `0051`, y cuánto cuestan las 31 políticas sin envolver**: sin medir, aún no hay volumen. Solo se midió que no cambia lo que ve un miembro.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: el PO decidió mantenerlo el 9-oct; sigue siendo juicio, no medida.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba, el del PO y el de Rey.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **Qué permisos tiene el conector `AWS MCP` del PO**, qué límites tienen las funciones de borde hoy y si MFA y alarma de gasto están en la organización: sin mirar.

---

*Cierre del Día 36 · 10-oct-2026 · Dirección Técnica, Nortex Systems*
