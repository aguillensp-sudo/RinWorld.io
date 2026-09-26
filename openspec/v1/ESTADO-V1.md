# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap`; si te lanzan en un worktree `claude/…`, **opera sobre esa ruta con paths
absolutos.** Desde el 25-sep `mvp/bootstrap` es la rama por defecto de GitHub, así que los
worktrees nuevos deberían nacer al día. Si uno nace en `43bb222`, es una sesión vieja
reabierta: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo
impide). Se sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. Lo que no es
estado vive en otro sitio: la historia en `diario/`, las decisiones en `DECISIONES-V1.md`,
los hallazgos en `../mvp/findings/` y las reglas en `CLAUDE.md`. La versión larga anterior
(1 084 líneas) sigue en `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

Empieza por §6 y luego §3.

---

**Día 24 de V1 · 26-sep-2026 · Estado: CERRADO.** El PO aprobó `DIR-02` e `INVT-01`; `F-214`
(cerrado y probado con un ban real) y `F-178` (cerrado); y dos pantallas más por el arnés:
**`REG-09` (VERDE en 2 intentos, 0 líneas tocadas) y `FRU` (VERDE en 2 intentos, +2/−2 a mano).
Las dos esperan la C5 del PO.** Detalle en `diario/dia-24.md`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-26`; la sesión, de las 07:31 a las 08:16 UTC |
| `F-214` de extremo a extremo | Cuenta desechable creada por el PO; `execute_sql` sobre `auth.users` y `members`; el PO intentó entrar | `Eliminar` en `INVT-01` → `CANCELLED` y `banned_until = 2126-09-02` en el mismo instante; Auth respondió `User is banned`; la cuenta se borró (0 filas) |
| `F-178` | `forum_thread_list` por `execute_sql` tras `npm run demo:reset` | `c003` 3 reacciones, `c004` 1, `c001` 1 |
| `0038` en las dos bases | `apply_migration` y después `has_function_privilege` (F-146: catálogo, no `.sql`) | `troxminloxkjwihwfevs` y `ogdhyzgjjbbikjbkhxmu`: `anon` nada; `authenticated` solo `onboarding_seats_used`, `activate_own_membership` y `email_has_account`; `add_registered_member` solo `service_role`; `app.is_onboarding_admin` interna |
| Que el esquema aguanta | `supabase/tests/run.sh` (Docker), hasta `EXIT 0` | 269 `OK`, los de `0038` incluidos (KEY_ACTIVE consulta y se activa, el Editor no, el límite de 5 en el alta) |
| Que la app sigue entera | `npx tsc --noEmit` y `npx vitest run` | **1 326 pasan**, 23 saltados; typecheck limpio |
| `REG-09` | `harness/metrics/REG-09/corrida-02/`, `git show --numstat 7efaa3a` | VERDE en 2 intentos; 434 líneas, 2 ficheros, **0 tocadas**; 0,0297 $ la válida, 0,0928 $ con la inválida |
| `FRU` | `harness/metrics/FRU/corrida-02/`, `git show --numstat e4fe910` y `b6d2323` | VERDE en 2 intentos; 597 líneas, 2 ficheros, **+2/−2 a mano en 1 fichero**; 0,0389 $ la válida, 0,1045 $ con la inválida |
| Fidelidad tipográfica | Reglas CSS del HTML aprobado contra las del artefacto | `REG-09` coincide; `FRU`: eyebrow 11 px y título 22 px corregidos a mano, el resto coincide |
| CI y producción | `gh run view` en `b6d2323` y `curl` del bundle de `rin-world-io.vercel.app` (F-168) | Seis jobs verdes; el bundle trae las cuatro frases de `REG-09`/`FRU` y no las variables rotas |
| `register-additional-member` | `curl` sin sesión, con la clave anónima y con cuerpos inválidos | 401, 401, 400, 400. **No se creó ninguna cuenta con ella** |
| Decisiones del PO | El PO, en el chat, 26-sep | `F-214`/`F-178` con mi recomendación; `F-212`/`F-211` como están; `diario/dia-24.md` y `DECISIONES-V1.md` |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar
  `vera/index.ts`. Detalle en `FUNDACION-V1.md` §1 (sus fechas son del 6-sep).
- **Corriente B · Fábrica — EN MARCHA.** **13 pantallas construidas, 11 aceptadas** (las 6
  remedidas, `SRCH-03`, `INV-07`, `SRCH-02`, `DIR-02` e `INVT-01`) **y 2 verdes sin C5**:
  `REG-09` y `FRU`. Faltan 11 de 24. Las cifras 7 y 8 solo tienen un punto limpio,
  `SRCH-03` (`F-205`); las cuatro de estos dos días comparten sesión y tampoco lo son.
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

1. **C5 del PO sobre `REG-09` y `FRU`.** Hoy no se pueden ver con un miembro `KEY_ACTIVE`
   real (`F-218`): para mirarlas, `npm run dev` con un ADMIN cuyo `state` de `members` se ponga
   a `KEY_ACTIVE` a mano por SQL (y se devuelva a `ACTIVE`). Sin pulsar `Registrar usuario`
   (crea una cuenta de Auth de verdad) ni `Ir al panel` (activa la cuenta): ver §6.
2. **Elegir la decimocuarta pantalla y construirla en sesión propia con cronómetro**
   (`UMBRAL-FABRICA-V1.md` §8), para que las cifras 7 y 8 tengan un segundo punto limpio.
3. **Antes de cada corrida, `tsc --noEmit` y `vitest` sobre el árbol con los marcadores**, y
   comprobar que solo fallan los ficheros de esa tarea (`F-219`, `F-220`): `--seco` no lo mide.
   Un contrato en rojo solo puede estar en el árbol si su corrida es la siguiente.
4. **Comprobación tipográfica contra el HTML aprobado en el contrato de cada pantalla**
   (`F-209`): hoy se hizo a mano, y por tercera vez el Coder puso el eyebrow y el título con
   los tokens (14 y 28 px) en vez de los del HTML (11 y 22). El arnés no mide tamaños.
5. **Decisiones que esperan al PO** (§5): `F-217` (el alta de `FRU` crea cuentas que nadie
   puede completar).
6. Deuda sin fecha: `F-170` (contradicciones entre specs), `F-172` (buscador sin migrar en
   `INV-01`/`MSG-01`/`SentOffers`), `F-213` (no existe `Ajustes`), `F-218` (nada lleva a
   `KEY_ACTIVE`).

**Fecha límite:** Cuscinetti Padana vence el **30-sep** y la siembra de cobros cambia de
estado; antes de revisar `ADMIN-02` después de esa fecha, resembrar (`demo_billing.sql`). Las
invitaciones de demo llevan fechas relativas a AHORA: `npm run demo:reset` las repone.

En paralelo, sin acción de este lado: la aprobación de Model Garden; `F-073` (re-loguear la
CLI de Supabase) y el plan de pago de Vercel, fuera de sesión.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`).
- **Se siembra antes de cada corrida**, con `resetDemo`, no a mano (`F-169`); desde hoy repone
  también las reacciones del foro (`F-178`).
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**.
- El scroll propio de `.bwcnt` va **en la plantilla de tarea del Coder** (`F-198`), y la regla de
  las clases `string | undefined` de un módulo CSS también (`F-216`).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo**, no contra el `.sql` (`F-146`).
- La CD despliega desde `mvp/bootstrap`; `main` solo sirve GitHub Pages. Desde hoy despliega
  también `ban-revoked-member` y `register-additional-member`.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4 del umbral): las
  corridas 01 de `REG-09` y de `FRU` quedan como evidencia y no cuentan para la cifra 2.
- **`REG-09` y `FRU` van en el `AppShell` estándar** (no hay shell de onboarding) y el HTML
  aprobado manda sobre la spec en sus textos.

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`F-217`** · el alta de `FRU` crea una cuenta de Auth con contraseña del ADMIN, sin correo, que queda `REGISTERED` y sin flujo para activarse | PO: ¿flujo E2EE del nuevo usuario primero, o invitación con enlace (`F-212`)? |
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token | PO / producto (se deja como está, 26-sep) |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede | Se decide con ADR-002 Q-1 delante (26-sep) |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; GCP listo, cupo de Vertex pendiente de Anthropic | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de tener más de un ADMIN tiene que llegar a la interfaz | Producto, al diseñar el alta de miembros |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos en producción (RLS en las 19 tablas; `0037` y `0038` ya nacen recortadas). **Se reabre antes de datos reales de clientes o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`F-218`** · nada lleva a un ADMIN a `KEY_ACTIVE` (REG-05 a REG-07 no existen) | Al construir el flujo E2EE |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo: no hay operación inversa de `ban-revoked-member` | Al diseñar la reinvitación |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla (`billing_payments` solo admite `INSERT` de `service_role`) | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente, solo para el ADMIN | Al construir una segunda pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada (el MCP sí llega) · **Vercel en plan gratuito** (prohíbe uso comercial) | Álvaro |
| 🟡 | **La clave de Atria** vive en `C:/Users/admin/proyectos/04_01_Ticket_reader_Ninox/.env` | Álvaro: `setx ATRIA_API_KEY` si se vuelve a usar |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | Un e2e de `SRCH-02` falló una vez (1 de 119) con la demo recién repuesta | Si reaparece: latencia de la base compartida o flaky propio |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Cómo se ven `REG-09` y `FRU` con un miembro `KEY_ACTIVE` real.** El e2e reescribe en el navegador
  solo el `state` del perfil (la cuenta sigue `ACTIVE`); la unidad y el banco de esquema cubren el resto.
- **Si `Registrar usuario` crea de verdad la cuenta.** La Edge Function solo se ha rechazado
  (401/400); su camino feliz (crear la cuenta de Auth, escribir `members`, borrarla si falla) no se ha
  ejecutado. Crear una cuenta en producción a propósito es una acción que el PO tiene que decidir.
- **Si `Ir al panel` activa la cuenta desde la pantalla.** `activate_own_membership` está medida en el
  banco de esquema; nadie ha pulsado el botón.
- **Si invitar y reenviar funcionan desde la pantalla de `INVT-01`.** Las funciones están medidas en el
  banco de esquema (11 asertos); `Eliminar` sí se probó hoy con una cuenta real (`F-214`).
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment` y `billing_suspend_organization` funcionan desde la pantalla.** Nadie las
  ha pulsado a propósito: un pago confirmado no se borra.
- **Si `watcher_renew`, `watcher_let_expire`, `watcher_update` y eliminar funcionan con un cliente real.**
  El e2e solo pausa y reactiva; el resto, con mocks y PGlite.
- **Si `INV-07` oculta el stock de verdad con el modo restringido guardado** en pantalla, y si
  `Guardar configuración` funciona fuera de los mocks.
- **Si `Contactar` de `DIR-02` abre el hilo correcto** con un clic real: el e2e lo abre y ve su cuerpo,
  pero no compara el hilo con el de la fila.
- **Cuántas tablas más tienen privilegios de sobra**, columna a columna (`F-192`, aceptado).
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados); viven en la
  transcripción del workflow, no en un documento.
- **Atria frente a DeepSeek:** nadie ha comparado el código a ojo, ni cuánta cuota se gastó en las
  corridas cortadas, ni dónde está el límite de 605 s.

---

*Cierre del Día 24 · 26-sep-2026 · Dirección Técnica, Nortex Systems*
