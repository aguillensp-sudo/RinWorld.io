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

**Día 45 de V1 · 20-oct-2026, cierre a las 17:10 UTC · Estado: CERRADO.** Mañana: `F-256` cerrado (`0068`), los 4 SIN_PRUEBA a prueba, dos e2e y `F-274` aceptado como divergencia. Tarde: pantalla de suspensión y, **al final, `F-275`, `F-272` y `F-192` cerrados juntos (`0069`–`0071`, `859f5a5`)**. Detalle en `diario/dia-45.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| **`0068` en producción** (`vera_usage`, cupo 150/h) | `pg_class`, `pg_policies`, `relacl`, `has_function_privilege` | RLS activa; una política, SELECT solo para el operador; `authenticated` sin INSERT/DELETE; `anon` no ejecuta las tres funciones |
| **VERA registra su uso** | `vera_usage` a las 09:35 UTC | 4 filas, 1 usuario (el PO): 2 `ok = false` (sin créditos) y 2 `ok` de una sola pregunta, con sus tokens; ninguna abierta |
| Por qué fallaba VERA a las 06:31 | `function_logs` de `vera` | 400 de Anthropic, «credit balance is too low». El PO recargó; a las 06:34 contestó |
| Coste de una pregunta con herramienta | `usage` de esas 2 filas, tarifa de `vera.real.test.ts` | 0,051 $ (escritura de caché tras desplegar) + 0,009 $; con caché caliente ≈ 0,014 $. **n = 1** |
| `vera` desplegada con cupo y tope de opciones | `get_edge_function` (v45) | Contiene `vera_abrir_turno`, `vera_cerrar_turno`, `SUPABASE_ANON_KEY`, ninguna clave de servicio, y «nunca ofrezcas más de tres a la vez» |
| App desplegada con los favoritos por lote | Bundle de `rin-world-io.vercel.app` (`index-HYJ-5EFd.js`) | `favoritos:` aparece 2 veces (destructurado y llamada) |
| Banco con `08_vera_uso.sql` y `09_sin_prueba_sql.sql` | `supabase/tests/run.sh` en Docker, local | ESQUEMA, CATÁLOGO y FRESCURA en verde |
| **Matriz** | `harness.core.trazabilidad.resumen()` y `problemas()` vacío | 109 CUBIERTO, 20 DIVERGE, 38 NO_IMPLEMENTADO, 15 PARCIAL, 0 SIN_PRUEBA, 3 FUERA = 185 |
| **Miembro de una org SUSPENDED → pantalla de suspensión** | `session.suspension.escenarios.test.ts`, `App.suspension.escenarios.test.tsx` | `loadProfile` da `suspended`; `App` pinta `Suspended.tsx` en lugar del shell (sin foro ni VERA) |
| Pantalla de suspensión desplegada | Bundle de `rin-world-io.vercel.app` (`index-CAk8-7IE.js`) | «Organización suspendida», `org-suspended` y el texto del operador presentes; «Rinworld» 0 veces |
| Permisos desplegados | Bundle de `rin-world-io.vercel.app` (`index-CAzFNqcA.js`) | «Hilos recientes» pide `category_slug, category_name, author_org_name`; el cruce viejo con `organizations` ya no está; «Rinworld» 0 veces |
| La propia org se lee aunque no sea APPROVED | `pg_policies` (`organizations_select_approved`) | `status = 'APPROVED' or id = app.current_org_id()` |
| **`0069`–`0071` en producción y en `bearingworld-e2e`** (`F-275`, `F-272`, `F-192`) | `pg_get_functiondef`, `pg_get_viewdef`, `has_column_privilege`, las 7 reglas de `06` sobre `relacl`/`attacl`/`pg_default_acl`/`pg_policies` | **0 incumplimientos en las dos bases**; `is_active_member`/`is_org_admin` exigen `APPROVED`; `author_member_id` sin SELECT; `anon` sin nada en `public` |
| Un ADMIN activo real tras `0069` (transacción deshecha) | SQL como `authenticated` en producción | Activo y admin; 8 hilos del foro, todos con organización y categoría; 23.965 líneas ajenas; sus 5 hilos |
| `tsc`, `vitest` y banco (`859f5a5`) | Local, banco en Docker con `06` | `tsc` limpio; 2854 verdes, 135 saltadas; ESQUEMA, CATÁLOGO y FRESCURA verdes; ancla negativa de `06` sin `0070`/`0071`: 185 fallos |
| e2e local contra `bearingworld-e2e` con `0069`–`0071` | Playwright, suite entera | 161 verdes y 5 rojos en **2,4 h**; los 5 aislados, 11/11 en 1,5 min (lentitud de la instancia) |
| CI del día | `gh run list` | `cdefbe9`, `76b09ba`, `9eab663`, `3c24417` verdes con despliegue; **`4f4f8a7` roja** en `zz-h5-negociacion` por colisión con un A/B local (`F-262`, ver §6); `31e0fb1` (run `39401138058`) verde con despliegue; **`b4a97e3` (solo docs) roja** en dos e2e de la instancia (`batch-search`, `zz-h5`); **`6b9a34e` (run `39407772750`) verde con despliegue**, con `forum-thread` y `organization-profile` verdes al reintento; **`57fe972` (solo docs) roja** en 4 e2e de la instancia; **`859f5a5` (run `39461082451`) verde entera con despliegue** |
| Argon2id no bloquea el hilo (`key-generation#2`) | e2e en Chromium contra `bearingworld-e2e`, tres corridas | 260–411 ms de generación, ninguna `longtask`, 17 ms de hueco máximo de rAF; el control de 300 ms salta |
| Dónde se va el tiempo del lote (`F-274`) | Traza de Playwright + `edge_logs` de `bearingworld-e2e`, 08:57 UTC | Base 20–45 ms por petición; navegador 125–185 ms; dos viajes seguidos por referencia; paradas de hasta 3,7 s |
| Favoritos una vez por lote | Traza de las 6 corridas del A/B | `favorite_distributors`: 52 → 2 por lote. Tiempo: sin mejora demostrable (solo el par 3 está limpio) |
| Cuscinetti Padana | `billing_org_status` y `cron.job` | `APPROVED`, `ACTIVE`, **0 días restantes hoy**; ningún cron ejecuta `billing_evaluate_expirations` (solo `purge-ingest-events`) |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Su único cabo, `F-192`, cerrado el 20-oct con `0071` (privilegios mínimos en `public`).
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) sigue bloqueado.** Vertex: los 3 cupos pedidos el 14-oct fueron **denegados** el 16-oct (`vera-vertex-eu-migracion.md` §7). Alternativa: Bedrock UE, con Sonnet 4.6 funcionando y Sonnet 5 **sin acceso ni cupo** (`vera-bedrock-eu-plan.md`). **El modelo ya está cambiado**, solo queda el proveedor.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla y rol, una línea tras buscar, `navegar` a siete pantallas. Medida contra Sonnet 5 (`F-258`): bien en guía, trampas, memoria y pantalla; falla un recuento (B7) y el cambio de idioma a mitad (`F-264`). **Desde el 20-oct:** cupo de 150 llamadas por usuario y hora, `usage` de cada llamada en `vera_usage` (`0068`, `F-256`) y, si caben más de tres lecturas, ofrece tres opciones como mucho.
- **Corriente B · Fábrica — EN MARCHA, sin cambios desde el 17-oct.** `INV-04` del arnés en `exp/inv-04-fabrica` (no se fusiona): verde en C1–C4, **C5 NO del PO** (`F-261`). Cifras 7 y 8 cerradas. La próxima serie parte del prompt con `_nota*` (`F-263`) y no es comparable con la 7 y la 8.
- **Corriente C · Verificación — ABIERTA.** Nivel 1 (`trazabilidad.csv`): **109 de 185 con prueba que los ejerce y corre en CI**, 15 parciales, 38 NO implementados, 20 divergencias (todas aceptadas; `thread-and-reply-creation#3` pasó a CUBIERTO con `0070`), **0 sin prueba**, 3 fuera. Nivel 2 hecho (`F-266`). **Lo de hoy:** pantalla de suspensión (`automatic-suspension#2`, `active-account-access#2` CUBIERTO), `09_sin_prueba_sql.sql` (suspensión sin purga, CUBIERTO; tope de 500.000 líneas, DIVERGE aceptada el 20-oct: sin aviso al administrador), reglas de tono y de opciones en el prompt (PARCIAL «solo modelo real»), `key-generation#2` CUBIERTO por e2e y `batch-search#1` DIVERGE aceptada (`F-274`). Quedan 4 «solo e2e» que necesitan llamadas reales, un correo real o escribir en cuentas reales (§3.3). Niveles 4 y 5 aparcados.

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de CADA corrida contra `bearingworld-e2e`** (Playwright o arnés): `gh run list --branch mvp/bootstrap --status in_progress`, en ese momento y no una vez por sesión, y avisar a las demás sesiones vivas. **Tu propio push lanza el e2e de la CI** (~8 min): o esperas a que acabe o no tocas la instancia. Así se rompió `4f4f8a7` el 20-oct (`F-262`). Si `watchers.spec.ts` cae por «falta el estado …», mira primero si corrió `fixture.setup.ts` (`F-270`).
2. **Del PO:**
   - **`F-276`** (`forum_reactions.member_id` legible entre organizaciones, mismo patrón que `F-272`) y **`F-277`** (nadie compara las migraciones de producción y `bearingworld-e2e`): decidir. **`F-269` §2** queda para después del arranque.
   - **Casado de referencias (`F-254`):** el PO trae definiciones y avisa. **No se toca `search.ts` para eso hasta entonces.**
   - **Bedrock:** decidir el modelo (`vera-bedrock-eu-plan.md` §2) y pedir a AWS acceso o cupo para Sonnet 5 (`eu.anthropic.claude-sonnet-5`). Vertex: solo con un caso de soporte de pago; **no enviar la reclamación vieja.** Al llegar el cupo, cambiar solo el proveedor y repetir ~20 preguntas (~1 $, plan §9).
   - **Suspensión:** desde `0069` la base corta a la suspendida igual que la pantalla. Residual en `F-275`: `vera_abrir_turno` no mira la suspensión (el cliente no enseña VERA y las herramientas no leen nada).
   - **Semilla de demo:** quitar `VITE_DEMO_KEY_SEED` de Vercel de producción cuando se acerquen datos reales o terceros (`F-067`).
3. **Los 4 «solo e2e» que quedan en la matriz**, cada uno con su permiso: `single-reference-search#3` y los de VERA, con llamadas reales al runner (visto bueno y tope de gasto del PO); `inventory-upload-channels#3`, con un correo real del PO desde un remitente autorizado; `dual-entry-routes#2` y `user-revocation#1`, que escriben en cuentas reales.
4. **VERA, próxima pasada del runner** (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_OUT` fuera del repo, `VERA_REAL_TOPE_USD`): B7, A24, L6 (`F-264`) y un caso de «más de tres lecturas» para la regla nueva. Toda llamada real, con el visto bueno del PO.
5. **Frontend:** el PO prepara cambios por su cuenta. **El plan móvil NO se propone hasta que él lo pida** (`BACKLOG-V1.md`). INV-04 se queda con la versión a mano (`F-261`).
6. **~12-nov:** comprobar que `inbox/` de S3 ya no conserva los primeros correos (borrado a 30 días).
7. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero (`--maxWorkers=50%` si hay otra sesión con tests), el banco si se tocó `supabase/` más allá de una función, la suite e2e si se tocó un e2e o el arnés (`F-230`), y `py -m harness.tests.test_checks` si se tocó una tarea o la matriz (`F-251`). **Mira la CI del push anterior antes de empujar otro.** Un commit con `[skip ci]` salta la CI de todo su empuje: va en un empuje aparte. Nunca `vitest` con un e2e en marcha.
8. **La matriz se edita con `harness.core.trazabilidad.leer_csv`/`escribir_csv`, y ninguna nota lleva `;`**: un `;` suelto parte la fila y la reescritura pierde la cola (pasó el 20-oct con `passphrase-rotation#2`).

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA es Sonnet 5** (`claude-sonnet-5`); Vertex o Bedrock cambiarán solo el proveedor. La spec de `vera-agent` dice 4.6 y no se toca.
- **El proxy de VERA no lee datos; solo abre y cierra su turno en `vera_usage`, con el JWT del usuario y la clave anónima, nunca con la de servicio** (D-09-05 matizada, `F-256`). El cupo cuenta llamadas, no preguntas.
- **VERA: memoria de 20 intercambios, solo texto; los datos se vuelven a consultar; la pantalla manda sobre lo recordado.**
- **VERA no repite lo que la pantalla enseña**: tras buscar, una línea; Inventario se mueve solo con una lista; Hilos, texto breve.
- **Búsqueda por lotes: el tope de 5 s para 50 referencias se acepta como divergencia** (`F-274`). Los favoritos se piden una vez por lote; si se quiere cumplir el tope, la vía es la RPC de lote (`F-253`, backlog).
- **Pantalla nueva con cabecera o contenedor raíz → `cabeceras.test.ts` / `padding.test.ts`** (`F-209`), y a `veraScreenName` (`F-255`).
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql`** (`0059`). Se siembra antes de cada corrida con `npm run demo:reset`. No repone inventario.
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`).
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**. Una política que llame a `app.f()` o `auth.f()` sin `(select …)` rompe el banco (`0062`).
- **Desde `0071` una tabla nueva de `public` nace cerrada**: su migración concede a `authenticated` lo que usan sus políticas (si se olvida, `permission denied`); `06_privilegios_asserts.sql` caza lo que sobre. **Un miembro de una organización no `APPROVED` no es miembro activo** (`0069`).
- **Fase B (`REG-05` → `06` → `07`)**: el paso no se guarda; solo el ADMIN `REGISTERED`. **La frase no sale nunca del navegador.**
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: migración aditiva primero, cliente después.
- **La importación manual**: solo `ACTIVE` de una `APPROVED`; 20.000 filas por subida. El correo admite `.xlsx` de hasta 120.000 filas.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Series de medición con **n = 5** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **Entregable 6** · VERA sigue en `api.anthropic.com`; Vertex denegado (16-oct); Bedrock UE: 4.6 sí, Sonnet 5 sin acceso | AWS + PO |
| 🟡 | **`F-067`** · la semilla de demo va en el JS de producción | PO (disparador en `BACKLOG-V1.md`) |
| 🟡 | **`F-276`** · `forum_reactions.member_id` legible entre organizaciones | PO |
| 🟡 | **`F-254`** · la búsqueda casa por «contiene»; los sufijos de fabricante no se reconocen | PO (definiciones) |
| 🟡 | **`F-277`** · `bearingworld-e2e` se migra a mano y se desfasó (le faltaba `0064`/`0068`; `0063` sigue sin aplicar allí) | PO (mecanismo) |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse | Mirar ~12-nov |

## 6 · Lo que este fichero NO sabe

- **Cuánto cuesta VERA por pregunta en uso real**: una sola pregunta medida (≈ 0,014 $ con caché caliente, dos llamadas). `vera_usage` ya lo registra; hacen falta más preguntas y más usuarios.
- **Si el cupo de 150 llamadas/hora molesta a un usuario de verdad**: nadie se ha acercado; una pregunta gasta de 1 a 7 llamadas.
- **Si VERA cumple la regla nueva de tres opciones**: está en el prompt, sin probar con el modelo.
- **Si VERA contesta igual de bien con usuarios reales**, mantiene el idioma en conversaciones largas (`F-264`) y acierta el control de B2 con peticiones ambiguas.
- **Por qué el lote de 50 dispersa tanto (6–39 s)**: la traza lo pone en paradas de la instancia, pero solo hay una corrida trazada limpia; 4 de las 6 del A/B coincidieron con la CI. No se ha medido en producción.
- **Por qué la suite local de la mañana dejó 9 búsquedas colgadas en «Buscando...»** en `bearingworld-e2e` mientras la CI salía verde: no se investigó más allá de los logs (paradas de 4–9 s, `F-259`).
- **Por qué la suite e2e local tardó 2,4 h** contra `bearingworld-e2e` (la CI, ~8 min) y si la paridad de `0064` (`F-277`) estabiliza la instancia: sin medir.
- **Si 15 s por aserción bastan siempre en `bearingworld-e2e`** (`F-259`).
- **Qué ve el EDITOR `REGISTERED` al entrar** (`F-260`), y **si Inventario adopta bien el filtro que deja VERA**: nadie lo ha mirado en un navegador.
- **Por qué una pantalla del arnés con C1–C4 en verde no pasa C5** (`F-261`).
- **Si la pantalla de subida enseña el motivo del tope de 500.000 líneas**: la base lo da; la pantalla, sin comprobar.
- **Cuánto se gana con `0047`/`0051`/`0062`** con volumen, y cómo se comporta la búsqueda cruzada con volumen real en Supabase.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: en un escritorio tarda ~400 ms y no bloquea; en un móvil, sin medir.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: es juicio, no medida.
- **Cómo se ve la pantalla de suspensión con una cuenta real**: nadie ha suspendido una organización real; la base ya la corta (`0069`), la pantalla solo se evalúa al cargar la sesión.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Qué permisos tiene la clave de AWS de `ingest-email`**, si el MFA y el SSO de AWS están bien, y si un cliente real puede enviar sin DMARC ni DKIM (`F-252`).

---

*Cierre del Día 45 · 20-oct-2026 · Dirección Técnica, Nortex Systems*
