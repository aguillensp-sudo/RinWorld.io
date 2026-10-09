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

**Día 32 de V1 · 7-oct-2026 · Estado: CERRADO (17:45 UTC).** Día de ocho sesiones. Construido y en producción: **`REC-01` y `SET-SEC-01`**, **`INVT-02` y `ACT-02`**
(25 pantallas; todas aceptadas por el PO: A.1, A.2 y A.3 de sus pruebas) y cuatro cierres de seguridad en la base: **`0050`** (canje de invitación), **`0051`**
(`F-234`, 8 políticas), **`0052`** (`F-239`, backup estanco) y **`0053`/`0054`** (`F-242`, sustituir el backup exige la frase anterior). **`INV-04`** tiene plan
(Amazon SES, `ingest.nortexsys.com`). Detalle en `diario/dia-32.md`.
**8-oct (día 33), `INV-04` fase 0 hecha en lo que toca al correo:** dominio verificado en SES (eu-west-1), 3 CNAME de DKIM y MX en Arsys. Ver §1, §3.2 y `diario/dia-33.md`.
**8-oct, microplan de 5 días: D1 (`0055`, `78182f2`) y D2 (`95cc7f8`, `29c1774`) hechos.** D2 = `createOffer`, `markOutOfStock`, «Responder con oferta», «Sin stock» y «Crear oferta». El PO los probó con dos sesiones (casos 1 a 4 OK, lo dijo en el chat); el estado del hilo se leyó de producción por SQL. **9-oct, D3 hecho:** `bearingworld-e2e` en `0055` (catálogo idéntico al de producción, medido). Ver `diario/dia-35.md`.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `0050`–`0054` en producción | Banco de esquema entero tras cada una; `pg_proc`, `has_function_privilege`, `has_column_privilege` y `pg_policies` de producción | Verde. Blob e IV sin `select`/`update` para `authenticated` y `anon`; solo existen las firmas nuevas de `store`/`replace_key_backup`; `end_key_recovery` no existe; el verificador no se lee |
| `accept-invitation` (sin JWT) | `curl` a producción con una invitación sintética (borrada, contada a 0) | `validate` OK, `accept` 200, canjeado 404. El canjeado salió ADMIN (organización vacía): el caso EDITOR solo está en el banco |
| `SET-SEC-01` y el verificador | `select` por SQL tras la prueba del PO | JULSA (`a.guillen@julsaindustrial.com`) **ya tiene verificador**; la cuenta `CANCELLED` `contact@nortexsys.com` no |
| Suite y CI | `vitest run` entero (1974 verdes, 23 omitidas); CI `37650282186` | Verde con e2e y despliegue en `8991133`. Después solo hay commits de documentación `[skip ci]` |
| Pruebas del PO | Lo dijo en el chat («todo aprobado A.2 y A.3»; A.1 OK; `SET-SEC-01` «ya funciona») | **No lo midió este agente.** Las pruebas con JULSA fueron antes y después de `0052`/`0053` |
| `INV-04` fase 0: SES y DNS | `Resolve-DnsName` contra 8.8.8.8 (3 CNAME DKIM y MX de `ingest`, y el MX de `nortexsys.com` intacto: `mx.serviciodecorreo.es`); estado «Verificado» y menú «Recepción de correo electrónico» **pegados por el PO desde la consola** | DNS verde, medido. SES: lo dijo el PO, no se consultó la API |
| Conector AWS del PO | `session_connectors_status` | `AWS MCP` pasó de `pending` a conectado al final del día (herramienta `aws___run_script`). **No se ha usado ni se ha mirado qué permisos tiene** |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **25 pantallas construidas y 25 aceptadas.** Las últimas cuatro (`REC-01`, `SET-SEC-01`, `INVT-02`, `ACT-02`), **a mano**, sin
  filas en `harness-metrics.csv`. **Ninguna pantalla aprobada queda por construir** salvo `INV-04` (plan en `v1/plan-inv04-ingestion-por-correo.md`) y `MSG-03` (vive
  en `MSG-02`). Cifras 7 y 8: un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar
   nuevas claves» con esa cuenta** (borra su backup). Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por ventana de 30 min,
   acertar no reinicia, `0052`): el PO se bloqueó una vez probando y se le reinició el contador a mano.
1. *(libre; `F-237` cerrado el 9-oct. Los números de §3 no se renumeran: otros documentos los citan.)*
2. **`INV-04`, fase 1 (la base, sin AWS):** tablas `ingest_addresses`/`ingest_senders`/`ingest_events`, RLS solo ADMIN, RPC; la pantalla sin enseñar. **Fase 0 hecha** (8-oct):
   SES eu-west-1, `ingest.nortexsys.com` verificado, MX `10 inbound-smtp.eu-west-1.amazonaws.com` en Arsys (el correo a `ingest` rebota hasta la fase 2: esperado).
   **Sin hacer ni comprobar de la fase 0: MFA y presupuesto de 5 USD** (la cuenta `2263-9540-1132` es miembro de una organización, se entra con rol federado, no con raíz).
   Antes de la fase 2: **leer los límites vigentes de las funciones de borde**. **No usar el conector `AWS MCP`** salvo que el PO lo pida, y con un rol de mínimo privilegio.
3. *(resuelto el 9-oct: `F-241`, `F-231`, umbral de zxcvbn y datos de ALPHA; ver `DECISIONES-V1.md`. Sin renumerar.)*
4. **`F-234` en las demás tablas:** `0051` envolvió 8; quedan **31** (`forum_*` y `watchers_*` primero). Patrón de `0047`/`0051`, con el banco delante.
5. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e entera**, con los marcadores; solo puede fallar el contrato de la tarea
   (más lo declarado en `e2e_fuera_de_contrato`). **Repetir sobre el log real el reparto de culpas** (`_repartir_culpas`).
6. Deuda sin fecha: `F-170`, `F-172`, `F-213`, `F-227`, `F-235`; `harness-review.csv` sin filas de `DIR-02`, `INVT-01`, `REG-09`, `FRU`.

**Fecha límite:** la siembra de cobros de producción se resembró el 4-oct; Cuscinetti Padana vence a los 10 días (**~14-oct**) y
cambia de estado. Antes de correr la e2e o revisar `ADMIN-02` después, resembrar (`demo_billing.sql`). `demo_watchers.sql`, resembrada el 6-oct.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida**, con `npm run demo:reset`, no a mano (`F-169`). No repone inventario.
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
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: lo que dejes a medias lo prueba él (el 404 de `SET-SEC-01` fue eso). Migración aditiva primero, cliente después.
- **ADR-001 en código** (`0048`, `key-backup.ts`): frase en NFC, AAD = id en minúsculas, Argon2id en worker; el estado cambia solo tras abrir
  la copia del servidor. Privada en IndexedDB, no extraíble, y cerrar sesión no la borra. `ensureKeyring(id, estado)` no publica para
  `REGISTERED` ni para quien tiene backup.
- **La importación (`0044`–`0046`)**: una transacción; solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; identidad = referencia + marca + país;
  `Reemplazo total` pasa a `DELETED` lo publicado que no viene; devuelve `inserted` y `updated`. Familia opcional (`0045`); el país puede salir
  de la organización. `price` no se importa (E2EE); solo CSV/TSV/TXT/XLSX; tope 20.000 filas por subida.
- **`INV-01` sin `onPickFile` es la pantalla de su contrato** (subida inerte): el prop lo pasa `App.tsx`.
- **La CD despliega dos funciones sin JWT**: `access-request` y `register-organization`. Su único permiso es el
  token (la segunda) o el límite por hora (la primera).
- **El enlace de acceso se ve una sola vez** (solo se guarda el hash); perderlo obliga a generar otro y revoca el anterior.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que
  escala por causas ajenas no cuenta para la cifra 2 (regla 3). Una corrida parada a mano deja sus filas en el CSV marcadas `ANULADA`.
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`.
- **Un artefacto verde del arnés no lleva `[skip ci]`** (`CLAUDE.md` §1.6).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **`F-242`** · cerrado; solo la cuenta `CANCELLED` `contact@nortexsys.com` sigue sin verificador (irrelevante: está revocada) | — |
| 🟡 | **`F-226`** · `REG-01` aceptada por el PO el 7-oct; sigue sin logo, sin Google y sin VERA (sin sesión, `F-223`) | Cuando haya proveedor y almacenamiento |
| 🟠 | **`F-233`** · `INV-04` con `ingest.nortexsys.com` y Amazon SES (40 MB), plan confirmado: fase 0 hecha salvo MFA y presupuesto; sigue la fase 1 (§3.2) | PO + este agente |
| 🟠 | **`F-230`** · el e2e del arnés ya va contra `bearingworld-e2e` (146/162): faltan la contraseña de `operador@bearingworld.test` en esa base (15 tests) y un test de `REG-05` desactualizado tras `ACT-02` | PO: contraseña en el panel Auth de `bearingworld-e2e` |
| 🟠 | **`F-225`** · la suite contra producción sigue con fallos ajenos sueltos (hoy, `ADMIN-02` en el intento 1 de `REG-05`) | PO: `bearingworld-e2e` ya tiene el esquema (`0055`); sus Edge Functions no (solo `access-request` v1) |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Con ADR-002 Q-1 delante |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-235`** · `--seco` no construye el prompt del Coder: un campo obligatorio que falte revienta ya lanzado | Arnés |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas mientras exista la cuenta de prueba del PO en Rodamientos Ibéricos | PO |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`F-227`** · el medidor se para con cada modelo nuevo | Hacerlo tolerante (declarar lo sin valorar) |
| 🟡 | **`.xls` binario no se lee** (el `.xlsx` sí, sin formatos: una fecha sale como número): va al fallo de `INV-03` | Producto: pedir `.xlsx` |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente | Al construir otra pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada · **Vercel en plan gratuito** | Álvaro |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Cuánto se gana con `0051`, y cuánto cuestan las 31 políticas sin envolver**: sin medir, porque aún no hay volumen. Solo se midió que no cambia lo que ve un miembro.
- **Si `INVT-02` y `ACT-02` funcionan con una organización real y con otros navegadores**: el PO las recorrió una vez y las aprobó; medido por partes, sin e2e propia.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Qué ve al entrar `a.guillen.sp@gmail.com`** (EDITOR `REGISTERED` creado por FRU antes de `0050`): `ACT-02` sin el aviso de contraseña provisional. Nadie lo ha visto.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: el PO decidió mantenerlo el 9-oct; sigue siendo juicio, no medida.
- **Cuánto tardó la importación de ~18 000 filas del PO** en el navegador: entró, nadie lo midió.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba y el del PO.
- **Si el recorrido entero funciona en un navegador real**: aprobar en `ADMIN-01` → copiar el enlace → `REG-01` → `REG-05`. Medido **por partes**.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **Qué permisos tiene el conector `AWS MCP` del PO** y si usa credenciales acotadas: no se miró. **Qué límites tienen las funciones de borde hoy**: sin leer. **Si MFA y alarma de gasto están en la organización**: nadie lo ha visto.

---

*Cierre del Día 32 · 7-oct-2026 · Dirección Técnica, Nortex Systems*
