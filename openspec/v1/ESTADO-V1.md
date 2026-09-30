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

**Día 28 de V1 · 30-sep-2026 · Estado: CERRADO.** **`INV-03` (decimoséptima pantalla) construida, a falta de la C5 del PO**,
por delegación («1 pantalla a elegir libremente»). Se construye contra el tipo `ImportSummary`: su productor, `INV-02`, no existe,
así que **en producción nadie la abre**. Corrida ESCALADA en el intento 3 por un e2e ajeno (`F-225`); 0 líneas tocadas a mano.
Detalle en `diario/dia-28.md`. La C5 de `REG-01` (pasos 1 a 10) está dada; falta la de la sección «Enlace de acceso» de `ADMIN-01`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-30` (sesión: de 07:23 a ~08:30 UTC) |
| Producción antes de la lista previa | `execute_sql` sobre `threads` | 9 hilos en vez de 5: 4 de `beta@` del 29-sep 17:14 UTC. **Borrados con el sí del PO** (`F-230`) |
| Datos vivos de altas de prueba | `execute_sql` sobre `organizations` | `JULSA INDUSTRIAL S.A` (29-sep 15:09) y `Jose Bearings` (29-sep 17:43, **origen no documentado**), las dos `APPROVED`. Siguen |
| `lib/import-result.ts` | `vitest`, 33 pruebas | Verde. `toLocaleString('es-ES')` da `1247` en Node (`F-231`) |
| Contrato de `INV-03` | Referencia desechable (no comiteada) | 29 de pantalla y CSS + 6 de cableado, verdes con ella; contra el marcador fallan 34 (una del cableado pasa) |
| Lista previa | `tsc`; `vitest` entero; `playwright test` entero | Solo fallaba el contrato. E2E: 139 pasan y fallan justo los 5 excusados en la tarea |
| Corrida 01 de `INV-03` | `harness/metrics/INV-03/`, `harness-metrics.csv` | ESCALADA en 3 intentos; C1/C3/C4 verdes en el 3; C2 rojo solo por `INV-01` (16/16 solo). **0,43 $, 21,1 min**, 814 líneas, **0 tocadas** |
| Fidelidad de `INV-03` | Capturas reales de `warn` y `fail` contra el HTML; script sobre `tokens.css` | 0 variables inexistentes, 0 colores literales fuera de comentarios, tamaños 11/24/14/10/22 |
| Suite tras la corrida | `tsc` y `vitest` entero | Limpio; 1 629 pruebas |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **17 pantallas construidas, 15 aceptadas** (`REG-01` e `INV-03`, pendientes de C5).
  Quedan, todas con un motivo de descarte escrito (`DECISIONES-V1.md`): `REG-05`/`06`/`07`, `REC-01`, `SET-SEC-01`
  (criptografía), `INV-02` (subida de ficheros), `INV-04` (correo sin proveedor) y `MSG-03` (ya vive dentro de `MSG-02`).
  Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **C5 de `INV-03`.** No se alcanza en la web: en su localhost (`preview_start` con `app`, puerto 5173), con sesión, abrir
   `#importacion-ejemplo=warn` (también `ok` y `fail`). No escribe nada. **Y decidir con el PO** si se borran los datos de las altas de
   prueba (`JULSA INDUSTRIAL S.A`, `Jose Bearings`, `ZZ Prueba REG-01 SL`): rompen 3 tests e2e locales (`F-230`).
1. **Falta la C5 de la sección «Enlace de acceso» de `ADMIN-01`** (la de `REG-01` está dada). Datos de prueba vivos en producción: la
   organización «JULSA INDUSTRIAL S.A» del PO, su administrador `a.guillen@julsaindustrial.com` y la solicitud `ZZ Prueba REG-01 SL`
   (token gastado); **el PO aún no ha dicho que se borren.** Recorrido en su localhost (`preview_start` con `app`; **va contra
   producción y escribe**): aprobar una solicitud → copiar el enlace → abrirlo sin sesión → crear la cuenta. Crea una organización y una
   cuenta reales: decidir con el PO (`F-188`) y **borrar las filas después** (`auth.users`, `organizations`, `registration_requests`;
   los tokens y el NIF caen por cascada).
2. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e
   entera**, con los marcadores; solo puede fallar el contrato de la tarea (más lo declarado en
   `e2e_fuera_de_contrato`). Un contrato en rojo solo en el árbol si su corrida es la siguiente (`F-219`).
3. **Lo que de verdad falta para que la ruta sirva: `REG-05`/`06`/`07`.** `REG-01` crea un ADMIN `REGISTERED` y
   ahí acaba: nada le lleva a `KEY_ACTIVE` (`F-218`). Son criptografía (Plan §4.3): a mano, con `docs/ADR-002` §10
   entero delante.
4. **`INVT-01` con token (`F-212`, `F-217`)**: la tabla ya lo admite (`access_tokens.member_invitation_id`) pero
   **no existe la función que lo genere ni el canje**; y `FRU` crea cuentas `REGISTERED` sin flujo para activarse.
5. **Revisión a mano: tipografía contra el HTML (`F-209`), todos los `var(--bw-*)` contra `tokens.css` y una captura real contra la
   del aprobado**: los estados `.on` del HTML no se infieren de la spec.
6. Deuda sin fecha: `F-170`, `F-172`, `F-213`, `F-218`, `F-227` (medidor tolerante), poner `bearingworld-e2e` en
   `0041` y desplegarle las funciones; `harness-review.csv` sin filas de `DIR-02`, `INVT-01`, `REG-09` y `FRU`.

**Fecha límite:** Cuscinetti Padana vence el **30-sep** y la siembra de cobros cambia de
estado; antes de revisar `ADMIN-02` después de esa fecha, resembrar (`demo_billing.sql`).

En paralelo, sin acción de este lado: la aprobación de Model Garden; `F-073` (re-loguear la
CLI de Supabase) y el plan de pago de Vercel, fuera de sesión.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida**, con `npm run demo:reset`, no a mano (`F-169`).
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**, ni el arnés (`F-225`).
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell,
  con `height: 100%; overflow-y: auto` (su raíz cuelga de `#root`, que es `fixed` sin overflow).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo** (`F-146`); y **ninguna función de
  `public` la ejecuta `anon`**: lo sin sesión va por Edge Function con `service_role`.
- **La CD despliega dos funciones sin JWT**: `access-request` y `register-organization`. Su único permiso es el
  token (la segunda) o el límite por hora (la primera).
- **El enlace de acceso se ve una sola vez** (solo se guarda el hash); perderlo obliga a generar otro y revoca el anterior.
- **Un token canjeado no se regenera**: una solicitud crea como mucho una organización.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que
  escala por causas ajenas no cuenta para la cifra 2 (regla 3).
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`.
- **Un artefacto verde del arnés no lleva `[skip ci]`** (`CLAUDE.md` §1.6; el del 29-sep se equivocó, `diario/dia-27.md`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`F-226`** · `REG-01` construida; falta la C5 del PO. Sin logo, sin Google y sin VERA | PO (§3.1) |
| 🟠 | **`INV-03`** · construida; falta la C5 del PO. Sin productor (`INV-02`): en producción nadie la abre | PO (§3.0) |
| 🟠 | **`F-230`** · el e2e local va contra producción y los datos vivos de las altas de prueba lo rompen (3 tests excusados en la tarea) | PO: borrarlos, o apuntar el e2e a `bearingworld-e2e` |
| 🟠 | **`F-223`** · el enlace y `REG-01` están; falta el equivalente para `INVT-01` | Construir: generar y canjear por invitación (§3.4) |
| 🟠 | **`F-217`** · el alta de `FRU` crea una cuenta que queda `REGISTERED` sin flujo para activarse | PO / al construir `REG-05` a `07` |
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token | Construir (§3.4) |
| 🟠 | **`F-225`** · `workers: 1` bajó los fallos ajenos de la suite (2 de 5 pasadas, antes 3 de 4) pero no los quita | PO: la base `bearingworld-e2e` para el C2, si vuelve a escalar |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Con ADR-002 Q-1 delante |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas mientras exista la cuenta de prueba del PO en Rodamientos Ibéricos | PO |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos (RLS en las 19 tablas). **Se reabre antes de datos reales o de abrir el registro a terceros**: ahora existe un camino que crea cuentas sin sesión, pero solo con un token que emite el Operador | PO (25-sep) |
| 🟡 | **`F-218`** · nada lleva a un ADMIN a `KEY_ACTIVE` (`REG-05` a `07` no existen); ahora `REG-01` también termina ahí | Al construir el flujo E2EE |
| 🟡 | **`F-231`** · `toLocaleString('es-ES')` no agrupa `1247`: `Inventory`, `InventoryTable`, `Messages` y `Panel` lo usan | Cambiar a `formatCount` |
| 🟡 | **`F-232`** · el intento 3 de `INV-03` se truncó dos veces y gastó el 84 % del coste de la corrida | Un dato; sin acción |
| 🟡 | **`F-227`** · el medidor se para con cada modelo nuevo | Hacerlo tolerante (declarar lo sin valorar) |
| 🟡 | **`F-228`** · rojo falso e intermitente del paso `F-168` de la CI (alias de Vercel tarda más que 30 s) | Subir el margen de reintentos en `ci.yml` |
| 🟡 | **`bearingworld-e2e`** en `0039`, sin `0040`/`0041` ni funciones | Aplicarlas por el MCP, revisadas |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente | Al construir otra pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada · **Vercel en plan gratuito** | Álvaro |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Si el recorrido entero funciona en un navegador real contra producción**: aprobar en `ADMIN-01` → copiar el enlace → `REG-01` → cuenta.
  Está medido **por partes** (la función con `curl`, las pantallas con mocks y con el build).
- **Qué ve en pantalla un ADMIN recién creado por `REG-01`** (`REGISTERED`, shell vacío): sin visto.
- **Si «Copiar enlace» copia en el navegador del PO** (el portapapeles real; los tests lo simulan).
- **Si 20 solicitudes por hora es un techo razonable** para un formulario público sin captcha: es juicio.
- **Si un solo intento de adivinar tokens es de verdad inofensivo**: son 244 bits y no hay freno de ritmo en `register-organization`; es cálculo, no medida.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment` y `billing_suspend_organization` funcionan desde la pantalla.**
- **Si `watcher_renew`, `watcher_let_expire`, `watcher_update` y eliminar funcionan con un cliente real.**
- **Si invitar y reenviar funcionan desde la pantalla de `INVT-01`** (medido en el banco de esquema).
- **Cuántas tablas más tienen privilegios de sobra**, columna a columna (`F-192`, aceptado).
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **Cómo se ve `INV-03` dentro de la app real** (con sesión, shell y VERA): medida en una página de prueba, sin shell; y **qué forma tendrá el resumen que produzca `INV-02`**.
- **De quién es `Jose Bearings`** (alta del 29-sep 17:43 UTC, sin rastro en ningún documento).
- **Con qué frecuencia exacta falla la suite e2e contra producción** (`F-225`): 2 de 5 pasadas con `workers: 1`; muestra pequeña.

---

*Cierre del Día 28 · 30-sep-2026 · Dirección Técnica, Nortex Systems*
