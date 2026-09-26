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

**Día 24 de V1 · 26-sep-2026 · Estado: EN CURSO.** El PO aprobó `DIR-02` e `INVT-01` (C5) y decidió `F-214` (hecho, sin probar el ban) y `F-178` (hecho) y `F-212`/`F-211` (se dejan). Abajo, el cierre del Día 23 sin reescribir.

**Día 23 de V1 · 25-sep-2026 · Estado: CERRADO.** Decisiones del PO sobre los pendientes
(`F-192` riesgo aceptado; `F-196` aceptado; `F-201`/`F-202`/`F-204` cerrados sin acción) y dos
pantallas más por el arnés: **`DIR-02` (VERDE al primer intento, 0 líneas tocadas) e `INVT-01`
(VERDE en 2 intentos en su tercera corrida; +4/−2 a mano)**. **Las dos esperan la C5 del PO.**
Detalle en `diario/dia-23.md` (tercera parte).

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-25`; la sesión de la tarde, de las 16:09 a las 18:05 UTC |
| `0036` y `0037` en las dos bases | `apply_migration` y después `execute_sql` sobre `has_function_privilege`/`has_table_privilege`/`relrowsecurity` (F-146: catálogo, no `.sql`) | En `troxminloxkjwihwfevs` y `ogdhyzgjjbbikjbkhxmu`: `anon` nada; `authenticated` solo `select` en `member_invitations` y su vista y `execute` en las cuatro funciones; RLS activa; `org_seats_used` sin `execute` para nadie |
| Que el esquema aguanta | `supabase/tests/run.sh` (Docker, Postgres 16), 3 vueltas hasta `EXIT 0` | Fase 1, catálogo y frescura verdes; 5 asertos de `0036` y 11 de `0037` |
| Que la app sigue entera | `npx tsc --noEmit` y `npx vitest run` | **1 245 pasan**, 23 saltados; typecheck limpio |
| `DIR-02` | `harness/metrics/DIR-02/corrida-01/`, `git show --numstat 085a946` | VERDE en 1 intento; 556 líneas, 2 ficheros, **0 tocadas**; 0,0315 $; CI `8e1a731` en verde |
| `DIR-02` en producción | `curl` del bundle de `rin-world-io.vercel.app` (F-168: por contenido) | Trae `Esta organización no está disponible.` y `Cargando ficha…` |
| `INVT-01` | `harness/metrics/INVT-01/corrida-03/`, `git show --numstat 7402efe` y `4ae9457` | VERDE en 2 intentos (el 1, sin fichero parseable); 1 138 líneas, 6 ficheros; **+4/−2 a mano en 1 fichero**; 0,0894 $ la válida, 0,2315 $ con las inválidas; CI `4ae9457` verde en los seis jobs y desplegada |
| Fidelidad tipográfica de las dos | Reglas CSS del HTML aprobado contra las del artefacto | `DIR-02` coincide; `INVT-01`: eyebrow 11 px y título 22 px corregidos a mano, el resto coincide |
| Demo repuesta | `npm run demo:reset` | Cinco hilos, tres solicitudes y **tres invitaciones en Nordwälz** (`2/5`, 1 pendiente, 1 aceptada, 1 expirada) |
| Decisiones del PO | El PO, en el chat, 25-sep | `diario/dia-23.md` y `DECISIONES-V1.md` |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar
  `vera/index.ts`. Detalle en `FUNDACION-V1.md` §1 (sus fechas son del 6-sep).
- **Corriente B · Fábrica — EN MARCHA.** **11 pantallas construidas y aceptadas** (las 6
  remedidas, `SRCH-03`, `INV-07`, `SRCH-02`, `DIR-02` e `INVT-01`, estas dos el 26-sep).
  Faltan 13 de 24. Las cifras 7 y 8 solo tienen un punto limpio, `SRCH-03` (`F-205`); las
  dos de hoy comparten sesión y tampoco lo son.
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

1. ~~C5 de `DIR-02` e `INVT-01`~~ **aprobadas por el PO el 26-sep.** Lo que escribe en `INVT-01` sigue sin pulsarse: ver §6.
2. **Elegir la duodécima pantalla y construirla en sesión propia con cronómetro**
   (`UMBRAL-FABRICA-V1.md` §8), para que las cifras 7 y 8 tengan un segundo punto limpio.
3. **Comprobación tipográfica contra el HTML aprobado en el contrato de cada pantalla**
   (`F-209`): hoy se hizo a mano y encontró dos diferencias en `INVT-01`. El arnés no mide tamaños.
4. **Copiar a cada tarea nueva las `_nota_*` que ya pagaron un error** (`F-216`): el tipo
   `string | undefined` de un módulo CSS (`F-143`) costó dos corridas.
5. **Probar `F-214` con un ban real** (§6). Las demás decisiones están tomadas.
6. Deuda sin fecha: `F-170` (contradicciones entre specs), `F-172` (buscador sin migrar en
   `INV-01`/`MSG-01`/`SentOffers`), `F-178` (foro sin teardown), `F-213` (no existe `Ajustes`).

**Fecha límite:** Cuscinetti Padana vence el **30-sep** y la siembra de cobros cambia de
estado; antes de revisar `ADMIN-02` después de esa fecha, resembrar (`demo_billing.sql`). Las
invitaciones de demo llevan fechas relativas a AHORA: `npm run demo:reset` las repone.

En paralelo, sin acción de este lado: la aprobación de Model Garden; `F-073` (re-loguear la
CLI de Supabase) y el plan de pago de Vercel, fuera de sesión.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`).
- **Se siembra antes de cada corrida**, con `resetDemo`, no a mano (`F-169`).
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**.
- El scroll propio de `.bwcnt` va **en la plantilla de tarea del Coder** (`F-198`).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo**, no contra el `.sql` (`F-146`).
- La CD despliega desde `mvp/bootstrap`; `main` solo sirve GitHub Pages.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4 del umbral): las
  corridas 01 y 02 de `INVT-01` quedan como evidencia y no cuentan para la cifra 2.

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`F-212`** · una invitación de `INVT-01` queda *registrada*, sin correo ni token: no lleva a nadie a ningún sitio hasta que exista el flujo de registro por invitación | PO / producto |
| 🟠 | **`F-211`** · `Contactar` en `DIR-02` sin hilo previo no se puede: no existe hilo libre en el esquema | PO: ¿hilo libre en mensajería? |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; GCP listo, cupo de Vertex pendiente de Anthropic | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de tener más de un ADMIN tiene que llegar a la interfaz | Producto, al diseñar el alta de miembros |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos en producción (RLS en las 19 tablas; `0037` ya nace recortada). **Se reabre antes de datos reales de clientes o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla (`billing_payments` solo admite `INSERT` de `service_role`) | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente, solo para el ADMIN | Al construir una segunda pantalla de ajustes |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada (el MCP sí llega) · **Vercel en plan gratuito** (prohíbe uso comercial) | Álvaro |
| 🟡 | **La clave de Atria** vive en `C:/Users/admin/proyectos/04_01_Ticket_reader_Ninox/.env` | Álvaro: `setx ATRIA_API_KEY` si se vuelve a usar |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | Un e2e de `SRCH-02` falló una vez (1 de 119) con la demo recién repuesta, en la corrida 02 de `INVT-01` | Si reaparece: latencia de la base compartida o flaky propio |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Si invitar, reenviar y eliminar funcionan desde la pantalla de `INVT-01`.** Las tres
  funciones están medidas en el banco de esquema (11 asertos) y la pantalla en unidad y en
  un e2e de solo lectura; nadie ha pulsado `Enviar invitación` contra una base real.
- **Si el ban de `F-214` funciona de verdad.** La Edge Function `ban-revoked-member` está
  desplegada y rechaza bien (401/400), pero nadie ha revocado una cuenta real desde `INVT-01`
  ni visto qué le sale al revocado. Una cuenta baneada tampoco se puede reinvitar sin quitarle el ban.
- **Si `Contactar` de `DIR-02` abre el hilo correcto** con un clic real: el e2e lo abre y ve
  su cuerpo, pero no compara el hilo con el de la fila.
- **Si `billing_confirm_payment` y `billing_suspend_organization` funcionan desde la
  pantalla.** Nadie las ha pulsado a propósito: un pago confirmado no se borra.
- **Si `watcher_renew`, `watcher_let_expire`, `watcher_update` y eliminar funcionan con un
  cliente real.** El e2e solo pausa y reactiva; el resto, con mocks y PGlite.
- **Si `INV-07` oculta el stock de verdad con el modo restringido guardado** en pantalla, y
  si `Guardar configuración` funciona fuera de los mocks.
- **Cuántas tablas más tienen privilegios de sobra**, columna a columna (`F-192`, aceptado).
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `MSG-01`, `MSG-02` y `VND-01` (del MVP) tienen el fallo de scroll** de `F-186`/`F-189`/`F-190`.
- **Si `DIR-01`, `ADMIN-01` y `FORO-01` siguen bien** tras las 110 líneas de `F-172`.
- **Si el Coder habría puesto el scroll sin pedírselo** (`F-198` se lo pidió; decisión del
  agente que el PO puede revisar).
- **Si el veredicto de la remedición aguanta sin la decisión 1 del PO** del 21-sep: no; las
  dos corridas escaladas no se repitieron con el contrato corregido.
- **Si el arreglo de `F-184` cambia algo medible**: nadie lo ha medido.
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados);
  viven en la transcripción del workflow, no en un documento.
- **Atria frente a DeepSeek:** nadie ha comparado el código a ojo, ni cuánta cuota se gastó
  en las corridas cortadas, ni dónde está el límite de 605 s.

---

*Cierre del Día 23, tercera parte · 25-sep-2026 · Dirección Técnica, Nortex Systems*
