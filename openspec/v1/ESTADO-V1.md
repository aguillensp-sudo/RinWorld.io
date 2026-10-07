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

**Día 32 de V1 · 7-oct-2026 · Estado: CERRADO.** **`REC-01` y `SET-SEC-01` construidas a mano (22.ª y 23.ª pantallas)** a petición del PO.
Un miembro con backup recupera su clave en otro navegador con la frase, y cambia la frase re-cifrando la MISMA privada. **`0049`** aplicada.
**Nadie las ha visto en un navegador real**: falta la C5 del PO (§3.1). Detalle en `diario/dia-32.md`; dudas de producto en `F-239`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-10-07 12:02` al arrancar |
| `0049` (`begin_key_recovery`, `end_key_recovery`, `replace_key_backup`, `discard_key_backup`) | Banco de esquema (`run.sh`) con sus asserts; `pg_proc` y `has_function_privilege` del proyecto | Banco en verde. Las cuatro: dueño `postgres`, `security definer`, `anon` no, `authenticated` sí; `key_recovery_attempts` con RLS y sin `select` |
| Cinco intentos y 30 min | Asserts de `0049`: 1.º a 5.º entregan el backup (quedan 4,3,2,1,0), el 6.º `locked` sin un byte; vencido el bloqueo, de cero | Verde (en el banco, no en producción) |
| La capa de datos | `lib/key-recovery.test.ts` (14), con Argon2id reducido; blob real | La frase buena abre, la mala no, otro miembro no (AAD); el cambio sube un blob que abre solo la frase nueva y con la MISMA pública |
| Las dos pantallas | `KeyRecovery.test.tsx` (17) y `ChangePassphrase.test.tsx` (12) en jsdom | Verdes. **No son un navegador real** |
| Unidad y tipos | `vitest run`; `tsc --noEmit`; `check:palette` | 1913 verdes y 1 rojo (timeout de `INV-02` por carga; solo, pasa); tipos limpios; paleta completa |
| e2e | **No se ha corrido** | Ninguna spec nueva |
| CI y producción | `gh run` 37620737822; `curl` del bundle de `rin-world-io.vercel.app` | `bf60b23`: los seis jobs en verde, desplegado; servidos los textos de `REC-01` y `SET-SEC-01` y las RPC `begin_key_recovery`, `replace_key_backup`, `discard_key_backup` |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **23 pantallas construidas, 20 aceptadas** (`REG-01`, `REC-01` y `SET-SEC-01` esperan la C5 del PO).
  `REC-01` y `SET-SEC-01` van **a mano** (criptografía), sin corrida del arnés: sin filas en `harness-metrics.csv`. Quedan `INV-04` (dominio,
  `F-233`) y `MSG-03` (ya vive en `MSG-02`). Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO (`F-237`): no borrar sus datos del sitio.
1. **C5 del PO de `REC-01` y `SET-SEC-01`, con cuidado: escriben en la base real.** `REC-01`: abrir JULSA en un navegador sin su clave
   (ventana privada); cada «Desbloquear» **cuenta un intento** (5 y 30 min) y la frase buena lo reinicia. «Generar nuevas claves» **borra el
   backup de JULSA**: no pulsarlo con esa cuenta. `SET-SEC-01` (`Seguridad` en el pie del menú) **sustituye** su backup: apuntar la frase nueva.
   Decidir con el PO el cierre estanco del límite y los textos añadidos (`F-239`), y los textos de error de `REG-07` (`F-237`).
2. **Revisar el umbral de zxcvbn** (score ≥ 3 ≈ 10⁸ intentos, el de la spec) con el PO: el blob ya existe y es lo que protege.
3. **Decidir con el PO** qué hacer con las 18 303 líneas de ALPHA (cuenta de pruebas): rompen 3 e2e locales (`F-234`). Y las altas de prueba
   (`F-230`), y si se registra `bearingworld.io` (`F-233`). Borrar las 500 `DELETED` basura del 6-oct y la referencia por contenido (de ayer).
4. **Falta la C5 de la sección «Enlace de acceso» de `ADMIN-01`.** Recorrido en su localhost (va contra producción y escribe): aprobar → copiar
   el enlace → abrirlo sin sesión → crear la cuenta. Decidir con el PO (`F-188`) y **borrar las filas después**.
5. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e entera**, con los marcadores; solo puede
   fallar el contrato de la tarea (más lo declarado en `e2e_fuera_de_contrato`). **Repetir sobre el log real el reparto de culpas** (`_repartir_culpas`).
6. **`F-234` en las demás tablas**: el mismo patrón (funciones por fila en la política) en `threads`, `thread_items`, `watchers`… sin revisar.
7. **`INVT-01` con token (`F-212`, `F-217`)**: la tabla ya lo admite pero **no existe la función que lo genere ni el canje**.
8. Deuda sin fecha: `F-170`, `F-172`, `F-213`, `F-227`, `F-231`, `F-235`; poner `bearingworld-e2e` en `0048` (está en `0039`) y
   desplegarle las funciones; `harness-review.csv` sin filas de `DIR-02`, `INVT-01`, `REG-09` y `FRU`.

**Fecha límite:** la siembra de cobros de producción se resembró el 4-oct; Cuscinetti Padana vence a los 10 días (**~14-oct**) y
cambia de estado. Antes de correr la e2e o revisar `ADMIN-02` después, resembrar (`demo_billing.sql`). `demo_watchers.sql`, resembrada el 6-oct.

En paralelo, sin acción de este lado: Model Garden; `F-073` (re-loguear la CLI de Supabase) y el plan de pago de Vercel.

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
| 🟠 | **`F-239`** · el límite de `REC-01` no es estanco (select directo de la fila; reinicio sin prueba); textos añadidos al HTML | PO (§3.1) |
| 🟠 | **`F-237`** · textos de error de `REG-07` sin aprobar (`REC-01` ya existe) | PO |
| 🟠 | **`F-226`** · `REG-01` construida; falta la C5 del PO. Sin logo, sin Google y sin VERA | PO (§3.4) |
| 🟠 | **`F-234` (el dato)** · 18 303 líneas reales en la cuenta de pruebas ALPHA: 3 e2e locales rotos (excusados en `REG-05`) | PO |
| 🟠 | **`F-233`** · `bearingworld.io` sin registrar: ninguna pantalla, texto ni correo puede usarlo como destino | PO |
| 🟠 | **`F-230`** · el e2e local va contra producción y los datos vivos de las altas de prueba lo rompen (excusados en la tarea) | PO: borrarlos, o apuntar el e2e a `bearingworld-e2e` |
| 🟠 | **`F-223`** · el enlace y `REG-01` están; falta el equivalente para `INVT-01` | Construir (§3.7) |
| 🟠 | **`F-217`** · el alta de `FRU` crea una cuenta que queda `REGISTERED` sin flujo para activarse (la Fase B es solo del ADMIN) | PO |
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token | Construir (§3.7) |
| 🟠 | **`F-225`** · la suite contra producción sigue con fallos ajenos sueltos (hoy, `ADMIN-02` en el intento 1 de `REG-05`) | PO: la base `bearingworld-e2e` para el C2 |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Con ADR-002 Q-1 delante |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-235`** · `--seco` no construye el prompt del Coder: un campo obligatorio que falte revienta ya lanzado | Arnés |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas mientras exista la cuenta de prueba del PO en Rodamientos Ibéricos | PO |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`F-231`** · `toLocaleString('es-ES')` no agrupa `1247`: `Inventory`, `InventoryTable`, `Messages` y `Panel` lo usan | Cambiar a `formatCount` |
| 🟡 | **`F-227`** · el medidor se para con cada modelo nuevo | Hacerlo tolerante (declarar lo sin valorar) |
| 🟡 | **`bearingworld-e2e`** en `0039`, sin `0040` a `0048` ni funciones: en la CI `fetchProfile` falla en silencio y nadie importa | Aplicarlas por el MCP, revisadas |
| 🟡 | **`.xls` binario no se lee** (el `.xlsx` sí, sin formatos: una fecha sale como número): va al fallo de `INV-03` | Producto: pedir `.xlsx` |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente | Al construir otra pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada · **Vercel en plan gratuito** | Álvaro |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Si las demás tablas tienen el problema de `F-234`** (`threads`, `thread_items`, `watchers`…): sin medir, porque aún no tienen volumen.
- **Cómo se ven `REC-01` y `SET-SEC-01` en un navegador real** y si Argon2id (64 MiB) entra en un móvil modesto: solo jsdom.
- **Qué ve al entrar `a.guillen.sp@gmail.com`** (EDITOR `REGISTERED` creado por FRU): la Fase B es solo del ADMIN (`F-217`).
- **Cuánto tarda Argon2id en el navegador del PO** (en Node, ~0,3 s).
- **Si el umbral de zxcvbn basta** contra un ataque offline al blob cifrado (Argon2id frena, pero ≥ 3 son ~10⁸ intentos): es juicio.
- **Cuánto tardó la importación de ~18 000 filas del PO** en el navegador: entró, nadie lo midió.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba y el del PO.
- **Si el recorrido entero funciona en un navegador real**: aprobar en `ADMIN-01` → copiar el enlace → `REG-01` → `REG-05`. Medido **por partes**.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).

---

*Cierre del Día 32 · 7-oct-2026 · Dirección Técnica, Nortex Systems*
