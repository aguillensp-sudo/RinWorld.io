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

**Día 29 de V1 · 4-oct-2026 · Estado: CERRADO.** **`INV-02` (decimoctava pantalla) construida y EN PRODUCCIÓN, a falta de la C5 del PO**,
por delegación («no pares hasta poner una pantalla más en producción»). Con ella **la importación de inventario por archivo funciona** y `INV-03`
deja de ser inalcanzable. Corrida VERDE en el intento 1; 14 líneas de CSS tocadas a mano. `INV-04` sigue fuera: `bearingworld.io` no está
registrado (`F-233`). Detalle en `diario/dia-29.md`. Pendientes de C5: `INV-02`, `INV-03` y la sección «Enlace de acceso» de `ADMIN-01`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-10-02 09:21` al arrancar; `2026-10-04` al cerrar (una sola sesión) |
| `bearingworld.io` | `nslookup` (dominio, MX, `ingest.`) | *Non-existent domain* en los tres (`F-233`) |
| `0044` en producción | `apply_migration` + catálogo (`has_*_privilege`, `pg_class`, `pg_policies`) | `anon` no ejecuta ni lee; `authenticated` ejecuta y solo LEE perfiles; RLS activa, 1 política; columna `notes` |
| `0044` en el banco de esquema | `supabase/tests/run.sh` (Docker) | `TODOS LOS ASSERTS PASAN`, 15 nuevos (quién no puede, lotes inválidos, acumulativo, reemplazo, perfiles) |
| Contrato de `INV-02` | Referencia desechable (no comiteada) | 36 de unidad y 2 e2e verdes con ella; contra el marcador fallan 33 |
| Lista previa | `tsc`; `vitest` entero; `playwright test` entero | Solo el contrato; e2e: 138 pasan, fallan los 2 del contrato y los 5 excusados (tras resembrar cobros) |
| Siembra de cobros de producción | `execute_sql` con `demo_billing.sql` + `billing_org_status` | Había caducado (rompía `ADMIN-02`); resembrada: los cuatro estados; `ADMIN-02` 15/15 |
| Corrida 01 de `INV-02` | `harness/metrics/INV-02/`, `harness-metrics.csv` | VERDE en 1 intento (C1–C4). **0,049 $**, 30 668/27 263 tokens, 0 % caché, 837 líneas |
| Fidelidad de `INV-02` | Captura real (build + sesión ALPHA) contra el HTML aprobado; script sobre `tokens.css` | 2 desviaciones corregidas a mano (14 líneas, `harness-review.csv`); 0 variables inexistentes, 0 colores literales |
| CI de `0f82de3` | `gh run` 37196204151 | 5 jobs verdes; despliegue de la app rojo **solo** por el paso F-168 (404 del alias en 30 s, `F-228`) |
| Producción | `curl` del bundle de `rin-world-io.vercel.app` | `index-DGHNjIbP.js` trae «Confirma el mapeo de columnas», «Siempre disponible», `import_inventory` y el aviso del canal email; **no** trae `importacion-ejemplo` |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **18 pantallas construidas, 15 aceptadas** (`REG-01`, `INV-03` e `INV-02`, pendientes de C5).
  Quedan, todas con un motivo de descarte escrito (`DECISIONES-V1.md`): `REG-05`/`06`/`07`, `REC-01`, `SET-SEC-01`
  (criptografía), `INV-04` (dominio sin registrar, `F-233`) y `MSG-03` (ya vive dentro de `MSG-02`). **No queda ninguna sin criptografía.**
  Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **C5 de `INV-02` + `INV-03`, en la web real** (ya se alcanzan): `Inventario` → «Subir nuevo inventario» o la dropzone → un CSV → mapeo →
   `Confirmar e importar` → resultado. **Escribe en producción.** En una organización de demo, usar **`Acumulativo`** con una o dos referencias
   nuevas: un `Reemplazo total` retira todo su inventario y **`npm run demo:reset` no lo repone** (hay que resembrar `catalog_demo.sql`).
   Probar también un XLSX (debe ir directo al fallo de `INV-03`) y un `.pdf` (error en la dropzone). Después, borrar las líneas de prueba.
1. **Decidir con el PO** si se borran los datos de las altas de prueba (`JULSA INDUSTRIAL S.A`, `Jose Bearings`, `ZZ Prueba REG-01 SL`): rompen 3
   tests e2e locales (`F-230`). Y si se registra `bearingworld.io` (`F-233`).
2. **Falta la C5 de la sección «Enlace de acceso» de `ADMIN-01`** (la de `REG-01` está dada). Recorrido en su localhost (`preview_start` con `app`;
   **va contra producción y escribe**): aprobar → copiar el enlace → abrirlo sin sesión → crear la cuenta. Decidir con el PO (`F-188`) y **borrar
   las filas después** (`auth.users`, `organizations`, `registration_requests`; los tokens y el NIF caen por cascada).
3. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e entera**, con los marcadores; solo puede
   fallar el contrato de la tarea (más lo declarado en `e2e_fuera_de_contrato`). Un contrato en rojo solo en el árbol si su corrida es la siguiente (`F-219`).
4. **Lo que falta para que la ruta sirva: `REG-05`/`06`/`07`.** `REG-01` crea un ADMIN `REGISTERED` y ahí acaba (`F-218`). Son criptografía
   (Plan §4.3): a mano, con `docs/ADR-002` §10 entero delante. **Es lo siguiente de la fábrica**: no quedan pantallas sin criptografía.
5. **`INVT-01` con token (`F-212`, `F-217`)**: la tabla ya lo admite pero **no existe la función que lo genere ni el canje**.
6. Deuda sin fecha: `F-170`, `F-172`, `F-213`, `F-218`, `F-227` (medidor tolerante), `F-231`; poner `bearingworld-e2e` en `0044` (está en
   `0039`) y desplegarle las funciones; `harness-review.csv` sin filas de `DIR-02`, `INVT-01`, `REG-09` y `FRU`.

**Fecha límite:** la siembra de cobros de producción se resembró el 4-oct; Cuscinetti Padana vence a los 10 días (**~14-oct**) y
cambia de estado. Antes de correr la e2e o revisar `ADMIN-02` después, resembrar (`demo_billing.sql`). `bearingworld-e2e`, igual.

En paralelo, sin acción de este lado: la aprobación de Model Garden; `F-073` (re-loguear la
CLI de Supabase) y el plan de pago de Vercel, fuera de sesión.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida**, con `npm run demo:reset`, no a mano (`F-169`). No repone inventario.
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**, ni el arnés (`F-225`).
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell,
  con `height: 100%; overflow-y: auto` (su raíz cuelga de `#root`, que es `fixed` sin overflow).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo** (`F-146`); y **ninguna función de
  `public` la ejecuta `anon`**: lo sin sesión va por Edge Function con `service_role`.
- **La importación (`0044`)**: una transacción; solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; identidad = referencia + marca + país;
  `Reemplazo total` pasa a `DELETED` lo publicado que no viene. `price` no se importa (E2EE); solo CSV/TSV/TXT; tope 20.000 filas por subida.
- **`INV-01` sin `onPickFile` es la pantalla de su contrato** (subida inerte): el prop lo pasa `App.tsx`.
- **La CD despliega dos funciones sin JWT**: `access-request` y `register-organization`. Su único permiso es el
  token (la segunda) o el límite por hora (la primera).
- **El enlace de acceso se ve una sola vez** (solo se guarda el hash); perderlo obliga a generar otro y revoca el anterior.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que
  escala por causas ajenas no cuenta para la cifra 2 (regla 3).
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`.
- **Un artefacto verde del arnés no lleva `[skip ci]`** (`CLAUDE.md` §1.6).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`INV-02` + `INV-03`** · en producción; falta la C5 del PO (escribe: ver §3.0) | PO (§3.0) |
| 🟠 | **`F-226`** · `REG-01` construida; falta la C5 del PO. Sin logo, sin Google y sin VERA | PO (§3.2) |
| 🟠 | **`F-233`** · `bearingworld.io` sin registrar: ninguna pantalla, texto ni correo puede usarlo como destino | PO |
| 🟠 | **`F-230`** · el e2e local va contra producción y los datos vivos de las altas de prueba lo rompen (3 tests excusados en la tarea) | PO: borrarlos, o apuntar el e2e a `bearingworld-e2e` |
| 🟠 | **`F-223`** · el enlace y `REG-01` están; falta el equivalente para `INVT-01` | Construir: generar y canjear por invitación (§3.5) |
| 🟠 | **`F-217`** · el alta de `FRU` crea una cuenta que queda `REGISTERED` sin flujo para activarse | PO / al construir `REG-05` a `07` |
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token | Construir (§3.5) |
| 🟠 | **`F-225`** · `workers: 1` bajó los fallos ajenos de la suite pero no los quita (hoy, 0 ajenos en la corrida) | PO: la base `bearingworld-e2e` para el C2, si vuelve a escalar |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Con ADR-002 Q-1 delante |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas mientras exista la cuenta de prueba del PO en Rodamientos Ibéricos | PO |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`F-218`** · nada lleva a un ADMIN a `KEY_ACTIVE` (`REG-05` a `07` no existen) | Al construir el flujo E2EE |
| 🟡 | **`F-231`** · `toLocaleString('es-ES')` no agrupa `1247`: `Inventory`, `InventoryTable`, `Messages` y `Panel` lo usan | Cambiar a `formatCount` |
| 🟡 | **`F-232`** · el intento 3 de `INV-03` se truncó dos veces y gastó el 84 % del coste de la corrida | Un dato; sin acción |
| 🟡 | **`F-227`** · el medidor se para con cada modelo nuevo | Hacerlo tolerante (declarar lo sin valorar) |
| 🟡 | **`bearingworld-e2e`** en `0039`, sin `0040` a `0044` ni funciones: en la CI `fetchProfile` falla en silencio y nadie importa | Aplicarlas por el MCP, revisadas |
| 🟡 | **XLSX/XLS no se leen** (sin dependencia): van al fallo de `INV-03` | Producto: elegir lector o quitarlos del texto |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente | Al construir otra pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada · **Vercel en plan gratuito** | Álvaro |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Si una importación de verdad funciona en el navegador contra producción**: medida en el banco (`0044`), con la base mockeada y en un e2e que
  cancela antes de escribir. Nadie ha pulsado «Confirmar e importar» contra la base real.
- **Cómo se comporta con 20.000 filas** (tiempo de la función, tamaño de la petición): probado con decenas.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores** (cabeceras, codificación, separadores): solo con los de prueba.
- **Si la familia inferida acierta fuera de las siete formas de referencia** que conoce `inferFamily`: lo demás sale como error de línea.
- **Si el recorrido entero funciona en un navegador real**: aprobar en `ADMIN-01` → copiar el enlace → `REG-01` → cuenta. Medido **por partes**.
- **Qué ve en pantalla un ADMIN recién creado por `REG-01`** (`REGISTERED`, shell vacío): sin visto.
- **Si «Copiar enlace» copia en el navegador del PO** (el portapapeles real; los tests lo simulan).
- **Si 20 solicitudes por hora es un techo razonable** para un formulario público sin captcha: es juicio.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Si invitar y reenviar funcionan desde la pantalla de `INVT-01`** (medido en el banco de esquema).
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **De quién es `Jose Bearings`** (alta del 29-sep 17:43 UTC, sin rastro en ningún documento).
- **Con qué frecuencia exacta falla la suite e2e contra producción** (`F-225`): muestra pequeña.

---

*Cierre del Día 29 · 4-oct-2026 · Dirección Técnica, Nortex Systems*
