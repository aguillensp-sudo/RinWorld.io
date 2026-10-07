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

**Día 31 de V1 · 7-oct-2026 · Estado: CERRADO.** **`REG-07` construida a mano: la Fase B está entera** (`REG-05` → `06` → `07` → `REG-09`).
Un ADMIN `REGISTERED` sale con su par X25519, el backup cifrado (ADR-001) en el servidor y la cuenta en `KEY_ACTIVE`. **`0048`** aplicada.
El llavero de demo ya no publica para quien tiene backup o está `REGISTERED`. Falta la C5 de `REG-06` y `REG-07`. Detalle en `diario/dia-31.md`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-10-07 07:31` al arrancar; `08:34` al cerrar |
| `0048` (`store_key_backup`, `confirm_key_backup`) | `run.sh` (banco de esquema); `pg_proc` y `has_function_privilege` del proyecto | Banco en verde; dueño `postgres`, `security definer`, `anon` no, `authenticated` sí |
| Argon2id (`hash-wasm` 4.12.0) | Vector de referencia de argon2id en la unidad; Node | Coincide; ~0,3 s con los parámetros de ADR-001 |
| Lo que sube el navegador se abre fuera | `key-generation.spec.ts`: Argon2id y AES-GCM de Node sobre el payload capturado | Abre con la frase y el id; sale la pública subida; con otra frase, no |
| Copia del dispositivo | e2e (IndexedDB real) y `device-key.test.ts` | `CryptoKey` no extraíble con la pública subida |
| Unidad y tipos | `vitest run`; `tsc --noEmit`; `check:palette` | 1871 verdes; limpio; paleta completa |
| e2e | Suite entera en local (puerto 4391: el 4173 cae en un rango excluido de Windows) | 2.ª pasada: 154 verdes y los 8 rojos conocidos (`F-224`/`F-230`, 3 de `INV-01` por el dato). La 1.ª, más lenta, dio 5 más que no se reproducen |
| Estado de las cuentas `REGISTERED` | `execute_sql` | JULSA (ADMIN), `jose@yo.net` (ADMIN), `alvaro@vistabahia.eu` (EDITOR de ALPHA, `F-230`): con `public_key` de demo, sin backup |
| CI y producción | `gh run` 37593719431; `curl` del bundle de `rin-world-io.vercel.app` | `326cc34` todo verde y desplegado; textos de `REG-07`, las dos RPC y el worker de Argon2id (28 KB) servidos |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **21 pantallas construidas, 18 aceptadas** (`REG-01`, `REG-06` y `REG-07`, pendientes de C5).
  **Fase B entera** (`REG-07` a mano, fuera de la cuenta de la fábrica). Después, **`REC-01`** (`F-237`), `SET-SEC-01` (criptografía), `INV-04` (dominio, `F-233`) y
  `MSG-03` (ya vive en `MSG-02`). Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **C5 de `REG-06` y `REG-07` con JULSA. Escribe, sin vuelta atrás desde la interfaz:** JULSA queda `KEY_ACTIVE` con backup (y `ACTIVE`
   tras `REG-09`). Entrar con contraseña, `REG-05` → `06` → `07` → «Continuar» → `REG-09`. **Apuntar la frase** (sin `REC-01` no hay
   recuperación); la privada queda en ESE navegador (`F-237`). Comprobar antes el despliegue por contenido.
1. **`REC-01`** (recuperar la clave con la frase, ADR-001 §7.2): ahora es lo que falta para que un miembro con backup tenga su clave en otro
   navegador. **A mano**, con el formato de `lib/key-backup.ts` (NFC, AAD, parámetros) y el límite de 5 intentos EN EL SERVIDOR (§8). Decidir
   con el PO antes, y los textos de error de `REG-07` sin aprobar (`F-237`).
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
| 🟠 | **`REG-06` y `REG-07`** · en producción; falta la C5 del PO (§3.0). La de `REG-07` escribe | PO |
| 🟠 | **`F-237`** · sin `REC-01`, un miembro con backup no tiene clave en otro navegador; textos de error de `REG-07` sin aprobar | PO + construir (§3.1) |
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
- **Qué ve un ADMIN `REGISTERED` real en `REG-06` y `REG-07`**: el e2e reescribe el estado de ALPHA y contesta las escrituras de `REG-07`.
  **`0048` no la ha llamado nadie desde un navegador contra la base real**: solo el banco de esquema. Lo hará la C5.
- **Cuánto tarda Argon2id en el navegador del PO** (en Node, ~0,3 s) ni si un móvil modesto aguanta los 64 MiB.
- **Si el umbral de zxcvbn basta** contra un ataque offline al blob cifrado (Argon2id frena, pero ≥ 3 son ~10⁸ intentos): es juicio.
- **Cuánto tardó la importación de ~18 000 filas del PO** en el navegador: entró, nadie lo midió.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba y el del PO.
- **Si el recorrido entero funciona en un navegador real**: aprobar en `ADMIN-01` → copiar el enlace → `REG-01` → `REG-05`. Medido **por partes**.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).

---

*Cierre del Día 31 · 7-oct-2026 · Dirección Técnica, Nortex Systems*
