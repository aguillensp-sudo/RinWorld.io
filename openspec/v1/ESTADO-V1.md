# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap` (rama por defecto desde el 25-sep). Si te lanzan en un worktree `claude/…`, opera ahí
con paths absolutos; si nace en `43bb222`, es una sesión vieja: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo impide). Se
sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. Historia en `diario/`, decisiones en
`DECISIONES-V1.md`, hallazgos en `../mvp/findings/`, reglas en `CLAUDE.md`, deuda sin fecha en
`BACKLOG-V1.md`. La versión larga anterior: `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

Empieza por §6 y luego §3.
---

**Día 40 de V1 · 14-oct-2026 · Estado: CERRADO.** Día de limpieza del relevo y de deuda técnica. Cerrados `F-224`, `F-225`, `F-233`, `F-234`, `F-250`, `F-251` y `F-252`; abierto y cerrado `F-253` (la búsqueda cruzada pasaba de 8 s con un segundo catálogo grande). `INV-04` sin pendientes de código. Sin fecha de demo. Detalle en `diario/dia-40.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `0062` en producción: 31 políticas con la función de sesión envuelta | `pg_policies` y 15 recuentos como `authenticated` (ADMIN de ALPHA) antes/después | 0 de 45 a pelo; recuentos idénticos |
| `0064` en producción: visibilidad del inventario ajeno calculada una vez | Líneas visibles como `authenticated` para 8 espectadores, antes/después | Mismas líneas; recuento 2.700 → 7 ms; búsqueda `6205` 3.086 → 45 ms |
| `0063`: purga diaria del historial | `cron.job` | `purge-ingest-events`, `17 3 * * *`, activo |
| Regla de S3 que borra el correo crudo | Consola de AWS, a mano por el PO | `expire-inbox-mail`, Enabled, prefijo `inbox/`, 30 días |
| Escala del catálogo | Postgres local en Docker con 1.030.000 líneas | `F-253`; formas del plan válidas, milisegundos no |
| Canal de ingestión | `npm run ingest:salud` | 10 eventos en 7 días; último 13-oct 14:10 UTC `PROCESADO` |
| `bearingworld-e2e` sin funciones | `list_edge_functions` | Solo `access-request` v1; los e2e mockean el resto con `page.route` |
| Guía de VERA ampliada (8 entradas) | `vera-prompt.test.ts` contra el código de cada pantalla | 177 verdes. **No se ha preguntado a VERA** |
| Banco de esquema, `vitest`, `tsc` | `supabase/tests/run.sh` (Docker), local | Verde con `0062`–`0064`; 2539 verdes, 31 saltados; `tsc` limpio |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct** (decisión del PO, `DECISIONES-V1.md`). Único cabo suelto: `F-192`, riesgo aceptado con disparador en `BACKLOG-V1.md`.
- **Fundación V1.** Entregables 1 a 5 hechos (el 5 se midió y se dio por cumplido, `F-253`). **El 6 (residencia UE de VERA) sigue bloqueado** en el cupo de Anthropic en Vertex (`429`); se reclama por escrito, texto en `vera-vertex-eu-migracion.md` §7.
- **Corriente B · Fábrica — EN MARCHA.** 27 pantallas construidas y aceptadas. `REC-01`, `SET-SEC-01`, `INVT-02`, `ACT-02` e `INV-04` fueron **a mano**, sin filas en `harness-metrics.csv`. Cifras 7 y 8: un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta** (borra su backup). Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por ventana de 30 min, acertar no reinicia, `0052`).
1. **Del PO:**
   - **Enviar la reclamación de Vertex** y repetir la llamada de prueba a los 7 días.
   - **AWS: acceso administrativo.** El 14-oct se perdió el MFA del raíz y se recuperó. Falta **añadir un segundo dispositivo MFA al raíz** (el actual es una app en el Samsung S22). El **usuario SSO es un AWS Builder ID** (portal `ssoins-722356743f2a19e8`, `us-east-1`) y el login dio «Acceso denegado»: probable que ese Builder ID no esté dado de alta en la instancia; mirar IAM Identity Center → Usuarios. Su MFA se gestiona en `profile.aws.amazon.com`, **no** en `Identity Delegated Admin` (a confirmar).
   - Cuscinetti Padana deja de estar `ACTIVE` el **20-oct** (cobros resembrados el 10-oct). Solo importa si hay demo o se enseña `ADMIN-02`.
2. **VERA: ampliar la guía verificada** (`index.ts`, «GUÍA VERIFICADA»). Ya sabe: subida de inventario, `Visibilidad`, `Inventario`, `Crear consulta`/`Crear oferta`/`Consultar`, `Vendiendo`, resultados de `Comprando`, búsqueda por lotes, `Mis watchers` e `Hilos`. **Faltan: Empresas (Directorio y ficha), Foro, Panel y Configuración.** Cada entrada con su nombre en `vera-prompt.test.ts`; antes de tocar `vera/index.ts`, `vera-vertex-eu-migracion.md`. El prompt estático creció ~1.700 tokens: la primera llamada tras desplegar reescribe la caché.
3. **`INV-04`:** sin código pendiente. Mirar `npm run ingest:salud` al abrir sesión. **~12-nov: comprobar que `inbox/` ya no conserva los primeros correos** (el borrado a 30 días solo se verá entonces). No usar el conector `AWS MCP` salvo que el PO lo pida; la CLI de AWS necesita un login que hoy no funciona.
4. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero, **el banco (`supabase/tests/run.sh`, Docker) si se tocó `supabase/`**, la suite e2e contra `bearingworld-e2e` si se tocó un e2e o el arnés (`F-230`) y `py -m harness.tests.test_checks` si se tocó el contrato de una tarea (`F-251`). **Mira la CI del push anterior antes de empujar otro. Basta UN commit con `[skip ci]` dentro de un empuje para que GitHub salte la CI de TODOS los commits de ese empuje** (comprobado tres veces el 14-oct; basta con ESCRIBIR la cadena en el mensaje, también para hablar de ella): los `[skip ci]` van en un empuje aparte, o primero el código y después la documentación. Nunca `vitest` con un e2e en marcha.
5. Deuda sin fecha y sus disparadores: `BACKLOG-V1.md`.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **Pantalla nueva con cabecera o contenedor raíz → añadirla a `cabeceras.test.ts` / `padding.test.ts`.** Contenido a la izquierda (nada de `margin: 0 auto`), padding `--bw-screen-pad`. Manda sobre el HTML aprobado (`F-209`).
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql`** (`0059`). La séptima, `demo_org_sin_hilo.sql`, se aplica a mano y no va en `demo_orgs.sql`.
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida** con `npm run demo:reset` (`F-169`, `F-248`). **No repone inventario.**
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell, con `height: 100%; overflow-y: auto` (su raíz cuelga de `#root`, que es `fixed` sin overflow).
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**: lo sin sesión va por Edge Function con `service_role`. **Una política que llame a `app.f()` o `auth.f()` sin envolver en `(select …)` rompe el banco** (`0062`).
- **Fase B (`REG-05` → `06` → `07`)**: el paso no se guarda; solo el ADMIN `REGISTERED`. **La frase no sale nunca del navegador.**
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: lo que dejes a medias lo prueba él. Migración aditiva primero, cliente después.
- **La importación manual**: solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; tope 20.000 filas por subida. El correo admite `.xlsx` de hasta 120.000 filas en lotes de 20.000.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`. Su único permiso es el token, el límite por hora o la autenticación del correo.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Un artefacto verde del arnés no lleva `[skip ci]` (`CLAUDE.md` §1.6).
- Series de medición con **n=5**; el corpus y el arnés **no se tocan a mitad de serie** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex en `429` desde el 10-sep | PO (reclamar) + Anthropic |
| 🟠 | **Acceso administrativo a AWS** · MFA del raíz con un solo dispositivo; el usuario SSO no entra (§3.1). El correo de entrada sigue funcionando | PO |
| 🟡 | **VERA solo conoce parte de la aplicación**: faltan Empresas, Foro, Panel y Configuración (§3.2) | Este agente |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse (§3.3) | Mirar ~12-nov |
| 🟡 | **`F-192` · riesgo aceptado**, privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** (está en `BACKLOG-V1.md`) | PO (25-sep) |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Cómo se ve nada en un navegador desde este agente**: cabeceras, padding, alineación, `MSG-03` (tablas con 30–40 filas, formulario por fila) e `INV-04`. Las vio el PO en parte; los tests leen DOM y CSS, no miden render.
- **Qué contesta VERA**: se probó con 8 preguntas del ensayo, el ejemplo de la spec y siete trampas, una vez cada una. Las 8 entradas nuevas de la guía están comprobadas contra el código, **no preguntadas a VERA**.
- **Qué ve al entrar el EDITOR `REGISTERED` de cada empresa nueva** (Nakishita y Rey): `ACT-02` con una organización real. Nadie lo ha recorrido.
- **Cuánto duró la negociación entre dos empresas**: el ensayo 2 no se cronometró.
- **Cuánto se gana con `0047`/`0051`/`0062`**: sin medir con volumen (solo se midió que no cambia lo que ve un miembro). La de `0064` sí está medida (`F-253`).
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: el PO lo mantuvo el 9-oct; es juicio, no medida.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba, el del PO y el de Rey.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Qué permisos tiene la clave de AWS de `ingest-email`**: el guion está escrito, no ejecutado (el PO decidió dejarla como está, 13-oct).
- **Cuánta CPU gasta la función dentro de Supabase** con 20.000 filas: se midió en Node; solo el Dashboard lo sabe.
- **Si un cliente real puede enviar desde su dominio**: entran Gmail y `julsaindustrial.com` (con `_dmarc`); otro dominio sin DMARC ni DKIM no (`F-252`, ya avisado en la pantalla).
- **Cómo se comporta la búsqueda cruzada con volumen real en Supabase**: la medida de 1M es de un Postgres local; `0064` está medida en producción solo con 24.000 líneas.

---

*Cierre del Día 40 · 14-oct-2026 · Dirección Técnica, Nortex Systems*
