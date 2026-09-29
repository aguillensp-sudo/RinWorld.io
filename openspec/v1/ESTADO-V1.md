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

**Día 27 de V1 · 29-sep-2026 · Estado: CERRADO.** **`REG-01` (decimosexta pantalla) construida y desplegada, a falta
de la C5 del PO**, con su token (`0040`), su alta (`0041`), su función de borde y el **enlace copiable en `ADMIN-01`**.
`F-225` con `workers: 1`. **C5 parcial del PO sobre `REG-01`** (pasos 1 a 8): países por desplegable, leyenda de
obligatorios en blanco y contacto = administrador permitido (`0042`); **pasos 9 y 10 dados por correctos** y contacto
!= otra organización (`0043`). Detalle en `diario/dia-27.md`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-29` (sesión: de 06:25 a ~08:15 UTC) |
| `F-225`, `workers: 1` | 5 pasadas de la suite e2e entera contra producción, con `date` | 4,2–4,6 min por pasada; fallos ajenos en 2 de 5 (`SRCH-01`, `INV-01`); `INV-01` pasa solo, 16/16. **No lo elimina** |
| Token `0040` | Banco de esquema (`supabase/tests/run.sh`, exit 0) y catálogo de producción por `execute_sql` | Solo hash; privilegios: ni `anon` ni `authenticated` tocan la tabla; la validación y el canje solo `service_role`; RLS sin fuerza; 0 filas |
| Alta `0041` | Banco de esquema (23 rechazos con su mensaje, camino feliz, fallo tardío que deshace el canje, NIF) y catálogo de producción | `register_organization` solo `service_role`; `organization_internal` con RLS; dueño `postgres` |
| Edge Function `register-organization` | `curl` contra producción con una solicitud sintética `@bearingworld.test` | validar 200, email libre/ocupado, contraseña floja 400, datos malos 400 sin cuenta huérfana, alta 200, reuso 404, login 200. **Filas borradas: 0 quedan** |
| Enlace en `ADMIN-01` | 1 537 pruebas de unidad; tsc; e2e | Verde. **Probado con mocks; no aprobado de verdad en producción** (`F-188`) |
| `REG-01` | `harness/metrics/REG-01/corrida-01/`, `git show --numstat 857b46a` | VERDE en 1 intento; 37 030 / 36 433 tokens; **0,064 $**; 2,1 min; 1 342 líneas; **+60/−3 a mano** |
| Fidelidad de `REG-01` | 0 `var(--bw-*)` inexistentes, 0 colores literales; tamaños 24/13/12/10; captura real contra la del aprobado (subagente) | 4 defectos visuales corregidos; quedan 2 cosméticos (forma de la flecha del select, relleno de los términos) |
| C5 parcial de `REG-01` | El PO, en el chat, 29-sep, en su localhost con un enlace de prueba | Pasos 1-3, 5-7 «perfectos»; tres cambios pedidos y hechos (`9da5785`, `6749723`); **pasos 9 y 10 sin probar** |
| `0043` y `check_contact_email` | Banco de esquema (exit 0); `curl` contra producción con una solicitud efímera, borrada | `alpha@…` como contacto → `false`; email libre → `true`; sin token → 404 |
| `0042` | Banco de esquema (exit 0) y `pg_get_functiondef` + catálogo de producción | Sin la regla del contacto; `register_organization` sigue solo para `service_role` |
| Contrato de `REG-01` | Implementación de referencia desechable (fuera del árbol) | 40 unitarias, 2 de CSS y 7 e2e verdes con ella; salieron 3 errores del propio contrato |
| CI y producción | `gh run` 36540317696 (`857b46a`) y 36586619528 (`9da5785`), seis jobs verdes; el de `e3c0ea5` (36590098438) **rojo solo en el paso de verificación** (`F-228`, propagación del alias); `curl` del bundle | El bundle de producción trae los textos de `REG-01`, la leyenda, el desplegable, `check_contact_email` y NO trae la ayuda vieja del contacto |
| Medidor de orquestación | `python -m harness.core.orchestration_metrics` antes y después | **10,02 $ → 40,06 $** el 29-sep; se paraba con Sonnet 5.5 (`F-227`); tarifa añadida. **No limpia** |
| Base de e2e | `list_migrations` de `ogdhyzgjjbbikjbkhxmu` | En `0039`; sin `0040`/`0041` ni las funciones |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **16 pantallas construidas, 15 aceptadas** (`REG-01`, pendiente de C5).
  Quedan 8 de 24, todas con un motivo de descarte escrito (`DECISIONES-V1.md`): `REG-05`/`06`/`07`,
  `REC-01`, `SET-SEC-01` (criptografía), `INV-02`/`03`/`04` (subida de ficheros y correo) y `MSG-03`.
  Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

1. **Falta la C5 de la sección «Enlace de acceso» de `ADMIN-01`** (la de `REG-01` está dada: pasos 1 a 10 correctos).
   **Hay datos de prueba vivos en producción**: la organización «JULSA INDUSTRIAL S.A» del PO, su administrador
   `a.guillen@julsaindustrial.com` y la solicitud sintética `ZZ Prueba REG-01 SL` (token gastado); **el PO aún no ha dicho que
   se borren.** Recorrido completo en su
   localhost (`preview_start` con `app`, puerto 5173; **va contra producción y escribe**): aprobar una solicitud
   → copiar el enlace → abrirlo sin sesión → rellenar y crear la cuenta. Crea una organización y una cuenta reales:
   hay que decidir con el PO si se hace así (`F-188`) y **borrar las filas después** (`auth.users`, `organizations`,
   `registration_requests`; los tokens y el NIF caen por cascada). Sin el PO, solo se ha probado por partes.
2. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e
   entera**, con los marcadores; solo puede fallar el contrato de la tarea (más lo declarado en
   `e2e_fuera_de_contrato`). Un contrato en rojo solo en el árbol si su corrida es la siguiente (`F-219`).
3. **Lo que de verdad falta para que la ruta sirva: `REG-05`/`06`/`07`.** `REG-01` crea un ADMIN `REGISTERED` y
   ahí acaba: nada le lleva a `KEY_ACTIVE` (`F-218`). Son criptografía (Plan §4.3): a mano, con `docs/ADR-002` §10
   entero delante.
4. **`INVT-01` con token (`F-212`, `F-217`)**: la tabla ya lo admite (`access_tokens.member_invitation_id`) pero
   **no existe la función que lo genere ni el canje**; y `FRU` crea cuentas `REGISTERED` sin flujo para activarse.
5. **Revisión a mano: tipografía contra el HTML (`F-209`) y todos los `var(--bw-*)` contra `tokens.css`**, y
   **comparar una captura del formulario real con la del aprobado**: los estados `.on` del HTML no se infieren de la spec.
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
- **Con qué frecuencia exacta falla la suite e2e contra producción** (`F-225`): 2 de 5 pasadas con `workers: 1`; muestra pequeña.

---

*Cierre del Día 27 · 29-sep-2026 · Dirección Técnica, Nortex Systems*
