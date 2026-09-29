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

**Día 26 de V1 · 29-sep-2026 · Estado: CERRADO.** **C5 del PO dada a `REG-00` y `REG-00-WAIT`**
(15 pantallas aceptadas). `REG-00` tenía un defecto: el teléfono se rellena ahora con el prefijo del país
elegido y es editable (`3abc4c3`). Detalle en `diario/dia-26.md`; la construcción, en `diario/dia-25.md`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-29` (construcción: 28-sep, de 05:49 a 07:17 UTC) |
| C5 de las dos pantallas | El PO, en el chat, 29-sep, tras probarlas en su localhost | `REG-00-WAIT` sin cambios; `REG-00` con un defecto (prefijo del teléfono) |
| Prefijo del teléfono | 1 404 pruebas de unidad en verde; `test_checks`; localhost con el panel del navegador | ES → `+34 `, PT → `+351 `; los 194 países tienen prefijo; `+34 ` solo ya no es válido (6 dígitos mínimo, también en la función) |
| Despliegue del prefijo | `gh run` 36528928347 en `3abc4c3`; `curl` del bundle y de la función | Seis jobs verdes; el bundle trae `+1 876` y `+351`; la función rechaza `+34 ` solo (400, antes de escribir) |
| Elección previa a construir | `git log`: `18d7cfc` (adenda §8) antes que `fa29058` (capa de datos) | Regla 1 del umbral cumplida |
| `access-request` en la base de e2e | `curl` sin sesión; fila de prueba borrada después (0 quedan) | envío 200, duplicado 409, `http://` 400, estado 200, inexistente 404, id basura 400, GET 405; rechazo con motivo leído por la función |
| `access-request` en producción | `curl` de solo lectura y preflight `OPTIONS` | sin JWT responde (404 limpio a un id inexistente); CORS 200 con los cuatro headers. **No se envió ninguna solicitud** |
| `REG-00` | `harness/metrics/REG-00/corrida-02/`, `git show --numstat f435a62` y `5b32322` | VERDE en 2; 421 líneas; **+10/−3 a mano** (token del logo inexistente → 407 px; `aria-describedby`); 0,017 $ la válida, 0,249 $ con la inválida |
| `REG-00-WAIT` | `harness/metrics/REG-00-WAIT/corrida-02/`, `8352c82` | VERDE en 1; 488 líneas; **0 tocadas**; 0,016 $ la válida, 0,071 $ con la inválida |
| Fidelidad | Reglas CSS del HTML aprobado contra las del artefacto; bucle de todos los `var(--bw-*)` contra `tokens.css` | Tamaños iguales; los 35 tokens de la espera existen. En `REG-00`, uno no existía (corregido) |
| Que la app sigue entera | `tsc --noEmit`, `vitest` con la suite entera, `test_checks` | typecheck limpio; 1 394 pasan con 23 saltados; piezas puras del arnés en verde |
| CI y producción | `gh run` 36390071102 en `65b925b` y `curl` del bundle de `rin-world-io.vercel.app` (F-168) | Seis jobs verdes, desplegado; el bundle trae los textos de `REG-00`, `REG-00-WAIT` y el botón del login |
| Cuenta que rompe dos e2e | `execute_sql` en producción | Rodamientos Ibéricos: `alpha` ADMIN ACTIVE y `alvaro@vistabahia.eu` EDITOR REGISTERED |
| Orquestación | `python -m harness.core.orchestration_metrics` antes y después | 5,06 $ → 39,59 $ el 28-sep: ~34,5 $ las dos pantallas. **No limpias** |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar `vera/index.ts`.
- **Corriente B · Fábrica — EN MARCHA.** **15 pantallas construidas y aceptadas** (las dos últimas,
  `REG-00` y `REG-00-WAIT`, el 29-sep). Quedan 9 de 24, todas con un motivo de descarte escrito
  (`DECISIONES-V1.md`, 26-sep y 28-sep): la siguiente exige decidir algo antes (§3.3).
  Las cifras 7 y 8 siguen con un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

1. **Comprobar en pantalla que el `REGISTERED` ve el shell vacío** (`alvaro@vistabahia.eu`) tras
   `0039`, y **después borrar esa cuenta** si el PO está de acuerdo: con ella, dos e2e fallan en
   local (`F-224`) y están excusados en las tareas; al borrarla, la exclusión se canta sola.
2. **Lista previa a una corrida, las tres cosas**: `tsc --noEmit`, `vitest` entero y la **suite e2e
   entera**, con los marcadores; solo puede fallar el contrato de la tarea (más lo declarado en
   `e2e_fuera_de_contrato`). Un contrato en rojo solo en el árbol si su corrida es la siguiente (`F-219`).
3. **Siguiente pantalla: antes hay que decidir algo.** Lo que queda es `REG-01` (token de invitación:
   depende de `F-212`/`F-217`/`F-223`), `REG-05`/`06`/`07`, `REC-01` y `SET-SEC-01` (criptografía,
   Plan §4.3), `INV-02`/`03`/`04` (subida de ficheros y correo) y `MSG-03` (componente de `MSG-02`).
4. **Revisión a mano: tipografía contra el HTML (`F-209`) y todos los `var(--bw-*)` contra
   `tokens.css`**: una variable inexistente no la ve ningún check (hoy, el logo a 407 px).
5. **Decisiones que esperan al PO** (§5): `F-217`, `F-223` y cómo tratar `F-225`.
6. Deuda sin fecha: `F-170`, `F-172`, `F-213`, `F-218`; y `harness-review.csv` sin filas de `DIR-02`,
   `INVT-01`, `REG-09` y `FRU` (desde el 24-sep solo se apuntaron hoy las dos nuevas).

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
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo** (`F-146`).
- La CD despliega desde `mvp/bootstrap` también `access-request`, **la única función sin JWT**.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que
  escala por causas ajenas no cuenta para la cifra 2 (regla 3).
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`.

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`F-223`** · la Ruta 00.2 promete VERA sin sesión y un correo tras la decisión: aprobar en `ADMIN-01` solo cambia el estado; el aprobado ve «revisa tu email» y no llega nada | PO: ¿VERA sin sesión? ¿orden entre correo, invitación y `REG-01`? |
| 🟠 | **`F-217`** · el alta de `FRU` crea una cuenta que queda `REGISTERED` sin flujo para activarse | PO (misma pregunta que `F-223`) |
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token | PO / producto |
| 🟠 | **`F-225`** · la suite e2e local contra producción falla a ratos en tests ajenos; el C2 se los cobra al Coder | PO: `retries`, base de e2e o suite en serie, al cerrar la serie |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Con ADR-002 Q-1 delante |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-224`** · dos e2e excusados en `REG-00`/`REG-00-WAIT` mientras exista la cuenta de prueba del PO | PO (§3.1) |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos (RLS en las 19 tablas). **Se reabre antes de datos reales o de abrir el registro a terceros**; el FSR público no crea cuentas | PO (25-sep) |
| 🟡 | **`F-218`** · nada lleva a un ADMIN a `KEY_ACTIVE` (REG-05 a REG-07 no existen) | Al construir el flujo E2EE |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente | Al construir otra pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada · **Vercel en plan gratuito** | Álvaro |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Si el FSR funciona de extremo a extremo en producción con un navegador**: la función se probó con
  `curl` en la base de e2e y en producción solo en lectura; el e2e no envía. Nadie ha enviado una
  solicitud real desde la pantalla ni la ha visto aparecer en `ADMIN-01`.
- **Si el sondeo de la espera ve el cambio de estado de verdad**: los tests lo miden con temporizadores
  falsos y el e2e con la respuesta sustituida.
- **Si 20 solicitudes por hora es un techo razonable** para un formulario público sin captcha: es juicio.
- **Qué ve `alvaro@vistabahia.eu` en pantalla tras `0039`** (medido por SQL, no visto).
- **Si invitar y reenviar funcionan desde la pantalla de `INVT-01`** (medido en el banco de esquema).
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment` y `billing_suspend_organization` funcionan desde la pantalla.**
- **Si `watcher_renew`, `watcher_let_expire`, `watcher_update` y eliminar funcionan con un cliente real.**
- **Cuántas tablas más tienen privilegios de sobra**, columna a columna (`F-192`, aceptado).
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **Con qué frecuencia exacta falla la suite e2e contra producción** (`F-225`): 3 de 4 pasadas del arnés
  hoy, 1 de 2 a mano; muestra pequeña.

---

*Cierre del Día 25 · 28-sep-2026 · Dirección Técnica, Nortex Systems*
