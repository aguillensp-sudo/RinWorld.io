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

**Día 23 de V1 · 25-sep-2026 · Estado: CERRADO (reabierto y reescrito a las 16:06 UTC con las decisiones del PO).** Las tres C5 recibidas («todo perfecto»):
`SRCH-03`, `INV-07` y `SRCH-02` aceptadas. Decisiones del PO sobre los pendientes: `F-192` riesgo aceptado, `F-196` aceptado, `F-201`/`F-202`/`F-204` cerrados sin acción. Reorganizado el espacio de trabajo: este fichero,
el registro de hallazgos, `CLAUDE.md` y la rama por defecto. Detalle en `diario/dia-23.md`.

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-25` |
| Rama por defecto | `gh repo view --json defaultBranchRef` y `git symbolic-ref refs/remotes/origin/HEAD` | `mvp/bootstrap` en los dos; Pages sigue sirviendo desde `main` (`gh api …/pages`) |
| Las tres C5 | El PO, en el chat (adenda del 25-sep, ahora en `diario/dia-23.md`) | «todo perfecto»: `SRCH-03`, `INV-07`, `SRCH-02` aceptadas |
| Que el diario conserva el texto | Script: cada línea no vacía de los bloques de los días 9 a 23, en orden | 290 de 290, idénticas |
| Decisiones del PO sobre `F-192`, `F-196`, `F-201`, `F-202`, `F-204` | El PO, en el chat, 25-sep tarde (ahora en `diario/dia-23.md` y `DECISIONES-V1.md`) | Cerrados en su fichero y en el registro |
| Que el registro de hallazgos conserva el texto | Reconstrucción fila a fila desde `findings/F-*.md` contra el original | Ver el commit que lo parte |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. No tocar
  `vera/index.ts`. Detalle en `FUNDACION-V1.md` §1 (sus fechas son del 6-sep).
- **Corriente B · Fábrica — EN MARCHA.** **9 pantallas construidas y aceptadas**: las 6
  remedidas (`DIR-01`, `ADMIN-01`, `FORO-01`, `FORO-02`, `FORO-03`, `ADMIN-02`; veredicto
  «Funciona con supervisión», `remedicion-seis-pantallas.md`) más `SRCH-03`, `INV-07` y
  `SRCH-02` (C5 del 25-sep). Faltan 15 de 24. Las cifras 7 y 8 solo tienen un punto limpio,
  `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

1. **Cerrar la cifra 8 de `SRCH-03`**: el reloj esperaba la C5, que llegó el 25-sep.
2. **Elegir la décima pantalla y construirla en sesión propia con cronómetro**
   (`UMBRAL-FABRICA-V1.md` §8), para que las cifras 7 y 8 tengan un segundo punto limpio.
3. **Proponer una comprobación tipográfica contra el HTML aprobado** en el contrato de cada
   pantalla: el arnés no mide tamaños y `INV-07` pasó 40 pruebas con un botón roto (`F-209`).
4. **Decisión que espera al PO** (§5): `F-178`.
5. Deuda sin fecha: `F-170` (contradicciones entre specs), `F-172` (buscador sin migrar en
   `INV-01`/`MSG-01`/`SentOffers`), `F-178` (foro sin teardown).

**Fecha límite:** Cuscinetti Padana vence el **30-sep** y la siembra de cobros cambia de
estado; antes de revisar `ADMIN-02` después de esa fecha, resembrar (`demo_billing.sql`).

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

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos en producción (RLS en las 19 tablas). **Se reabre antes de datos reales de clientes o de abrir el registro a terceros** | PO (25-sep) |
| 🟠 | **`F-178`** · el foro sin teardown ni `resetDemo`; ya costó una corrida (`F-195`) | Sin decidir: foro en `resetDemo` o reacciones solo con mocks |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; GCP listo, cupo de Vertex pendiente de Anthropic | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de tener más de un ADMIN tiene que llegar a la interfaz | Producto, al diseñar el alta de miembros |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟡 | **`F-172`** · buscador estándar solo en `DIR-01`/`FORO-02` | Quien toque `INV-01`, `MSG-01` o `SentOffers` |
| 🟡 | **La siembra de cobros envejece** y `resetDemo` no la re-ancla (`billing_payments` solo admite `INSERT` de `service_role`) | Decidir: verbo `security definer` o resembrar a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-073`** CLI de Supabase en la organización equivocada (el MCP sí llega) · **Vercel en plan gratuito** (prohíbe uso comercial) | Álvaro |
| 🟡 | **La clave de Atria** vive en `C:/Users/admin/proyectos/04_01_Ticket_reader_Ninox/.env` | Álvaro: `setx ATRIA_API_KEY` si se vuelve a usar |
| 🟡 | **`F-197`** · una sesión lanzada fuera de este repo no la mide el medidor de coste | Lanzar desde la raíz del repo |
| ⚪ | Seis fallos ajenos sin explicar en el intento 2 de la corrida 03 de `INV-07` | Si reaparece: latencia de la base compartida |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

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

*Cierre del Día 23 · 25-sep-2026 · Dirección Técnica, Nortex Systems*
