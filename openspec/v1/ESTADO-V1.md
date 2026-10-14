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

**Día 40 de V1 · 14-oct-2026 · Estado: CERRADO (20:48 UTC).** Tres sesiones. Mañana: limpieza del relevo y deuda (`F-224`, `F-225`, `F-233`, `F-234`, `F-250`–`F-253`). Tarde, VERA: memoria (`F-101`), contexto de pantalla real (`F-255`), tope del proxy (`F-256`), respuestas de una línea, `navegar` a Empresas y Foros, **paso a Sonnet 5** y **primera prueba real contra él** (`F-258`, 1,7 $ en total). Tarde, «desarrollo sin VERA»: `F-229` (País), `F-171`, `F-259` (timeouts e2e), `F-260` (primer repaso visual), `F-261` (cifras 7 y 8 con `INV-04`), `F-262` y `F-263`; `F-067` agravado. Diarios: `diario/dia-40.md` y `diario/dia-40-sin-vera.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `0062`, `0063`, `0064` en producción | `pg_policies`, `cron.job` y recuentos como `authenticated` antes/después | Recuentos idénticos; búsqueda `6205` 3.086 → 45 ms; purga diaria activa |
| Canal de ingestión y borrado de S3 | `npm run ingest:salud`; consola de AWS (PO) | 10 eventos en 7 días; `expire-inbox-mail` activa, 30 días |
| VERA no tiene tablas de uso, cuota, preferencias ni auditoría | `pg_class` de producción | Solo `auth.audit_log_entries`: `F-256`, `F-257` |
| «6204» casa con 15 designaciones | `inventory_lines` `PUBLISHED`, `ilike '%6204%'` | 74 líneas: `F-254` |
| VERA desplegada: Sonnet 5 y los arreglos de `F-258` | `get_edge_function` (v39) y el bundle de `rin-world-io.vercel.app` | `MODELO = 'claude-sonnet-5'`, `cambiosAMano`, guía de `INV-04` con XLSX; el bundle sirve `8076668` |
| **Qué contesta VERA (Sonnet 5)** | `vera.real.test.ts` contra la v37–v39, cuentas ALPHA, EDITOR y BETA, sin escribir nada | 134 turnos (1,06 $) + 45 de repetición (0,65 $): memoria y contexto de pantalla funcionan; abiertos B2 y B7 (`F-258`) |
| Caché del prompt con Sonnet 5 | `usage` de cada llamada | 18.709–18.991 tokens escritos al desplegar y leídos enteros después |
| CI de `8076668` | Run `38631715177` | Falló en MSG-01/MSG-02 por la colisión de `F-262`; el reintento de los jobs fallidos, verde entero |
| `F-259` (paradas de `bearingworld-e2e`), `F-260` (repaso visual), `F-192` (propuesta) | `edge_logs` y traza del run `38601905364`; capturas y métricas de Playwright; `probar.sh` — **por la otra sesión** | Ver cada hallazgo |
| `VITE_DEMO_KEY_SEED` en el JS de producción (`F-067`) | La semilla buscada en el bundle, sin imprimirla — otra sesión | **Está** |
| `vitest` y `tsc` del último empuje | Local, árbol fusionado | 2703 verdes; con la suite entera en paralelo a otra sesión fallan tests al azar por el tope de 5 s |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Único cabo suelto: `F-192`, ahora con propuesta lista en `supabase/propuestas/F-192/`.
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) sigue bloqueado** por cupo en cero en Vertex (`429`); 3 cupos pedidos el 14-oct (`vera-vertex-eu-migracion.md` §7). El runbook aún dice que el cambio es de modelo y proveedor: **el modelo ya está cambiado**, solo queda el proveedor.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla y rol, una línea tras buscar, `navegar` a siete pantallas. **Medida contra Sonnet 5** (`F-258`): bien en guía, trampas, memoria y pantalla; **falla en reponer un filtro que el usuario quitó a mano (B2)** y en un recuento (B7).
- **Corriente B · Fábrica — EN MARCHA.** Segundo punto de las cifras 7 y 8: `INV-04` reconstruida por el arnés en `exp/inv-04-fabrica`, que no se fusiona (`F-261`). `F-263`: las `_nota_*` de las tareas no llegan al Coder; lo decide quien abra la siguiente serie.
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de lanzar Playwright o el arnés contra `bearingworld-e2e`:** avisar a las demás sesiones vivas y mirar que no haya un job en marcha (`gh run list --branch mvp/bootstrap --status in_progress`). Dos corridas a la vez se pisan el fixture (`F-262`); no hay cerrojo entre sesiones.
2. **Del PO:**
   - **VERA, B2 (`F-258`):** si el usuario quita un chip a mano y luego habla con VERA, VERA repone el filtro, 4 de 4, aun con el aviso explícito en el contexto. Siguiente paso propuesto: que `buscar_en_catalogo` lo detecte y se lo diga en el retorno. Va con la semántica de refinamientos (`F-254`).
   - **Casado de referencias (`F-254`):** el PO trae definiciones tras mirar al competidor. **No se toca `search.ts` hasta entonces.**
   - **`CLAUDE.md` §10.1:** según la otra sesión, la frase «cuando exista el e2e de ADMIN-01» ya no es cierta. Pendiente de que el PO la corrija o lo pida.
   - **Vertex:** mirar `gcloud beta quotas preferences list --project=bearingworld-vera-eu` y repetir la llamada (`grantedValue` ≠ 0). **No enviar la reclamación vieja.** Al llegar el cupo, cambiar solo el proveedor y repetir una muestra del plan (~20 preguntas, ~1 $, plan §9).
   - **Semilla de demo:** quitar `VITE_DEMO_KEY_SEED` de Vercel de producción **cuando se acerquen datos reales o terceros** (`F-067`).
   - Cuscinetti Padana deja de estar `ACTIVE` el **20-oct**. **No se toca.**
3. **VERA, para la próxima pasada:** el runner (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_OUT` fuera del repo, freno en `VERA_REAL_TOPE_USD`) está listo. Toda llamada real, con el visto bueno del PO. Lo pendiente: B2, B7, y A24 (contesta en doce líneas).
4. **`F-260` sin arreglar:** VERA a 375 px tapa un tercio y las tablas anchas. Lo que sigue sin verse en navegador: `SET-SEC-01`, `INV-03` y que Inventario adopte el filtro que deja VERA.
5. **`INV-04`:** sin código pendiente. **~12-nov: comprobar que `inbox/` ya no conserva los primeros correos.**
6. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero (con otra sesión corriendo tests, `--maxWorkers=50%`), el banco si se tocó `supabase/` más allá de una función, la suite e2e si se tocó un e2e o el arnés (`F-230`) y `py -m harness.tests.test_checks` si se tocó el contrato de una tarea (`F-251`). **Mira la CI del push anterior antes de empujar otro. Un solo commit con `[skip ci]` salta la CI de todo su empuje**: va en un empuje aparte. Nunca `vitest` con un e2e en marcha.
7. Deuda sin fecha y sus disparadores: `BACKLOG-V1.md` (límite por hora de VERA `F-256`, auditoría `F-257`).

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA es Sonnet 5** (`claude-sonnet-5`); Vertex cambiará solo el proveedor. Sustituye a QA-A00-06; la spec de `vera-agent` dice 4.6 y no se toca.
- **VERA: memoria de 20 intercambios, solo texto; los datos se vuelven a consultar; la pantalla manda sobre lo recordado.** El 20 se ajusta con lo medido.
- **VERA no repite lo que la pantalla enseña**: tras buscar, una línea; Inventario se mueve solo con una lista; Hilos, texto breve. `navegar` lleva a siete pantallas, a su entrada.
- **Pantalla nueva con cabecera o contenedor raíz → `cabeceras.test.ts` / `padding.test.ts`** (`F-209`), y a `veraScreenName` (`F-255`) en el orden de las ramas del render.
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql`** (`0059`). **Se siembra antes de cada corrida** con `npm run demo:reset`. **No repone inventario.**
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell, con `height: 100%; overflow-y: auto`.
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**. **Una política que llame a `app.f()` o `auth.f()` sin `(select …)` rompe el banco** (`0062`).
- **Fase B (`REG-05` → `06` → `07`)**: el paso no se guarda; solo el ADMIN `REGISTERED`. **La frase no sale nunca del navegador.**
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: migración aditiva primero, cliente después.
- **La importación manual**: solo `ACTIVE` de una `APPROVED`; 20.000 filas por subida. El correo admite `.xlsx` de hasta 120.000 filas.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`).
- Series de medición con **n=5**; el corpus y el arnés **no se tocan a mitad de serie** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **Entregable 6** · VERA sigue en `api.anthropic.com`; 3 cupos pedidos, sin aprobar; `429` | Google + PO |
| 🟠 | **`F-258` · B2**: VERA repone un filtro que el usuario quitó a mano, aun avisada | PO (semántica, con `F-254`) |
| 🟡 | **`F-262`** · dos corridas e2e contra `bearingworld-e2e` se pisan; solo hay regla de proceso | Quien añada un cerrojo |
| 🟡 | **`F-260`** · VERA a 375 px y tablas anchas | Sin dueño |
| 🟡 | **`F-067`** · la semilla de demo va en el JS de producción | PO (disparador en `BACKLOG-V1.md`) |
| 🟡 | **`F-254`** · la búsqueda casa por «contiene»; los sufijos de fabricante no se reconocen | PO (definiciones) |
| 🟡 | **`F-256`** · VERA sin límite por usuario y hora ni registro de `usage` (el tope de tamaño sí está) | Backlog, antes de terceros |
| 🟡 | **`F-192` · riesgo aceptado**, privilegios por defecto anchos; propuesta lista en `supabase/propuestas/F-192/` | PO |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse | Mirar ~12-nov |

## 6 · Lo que este fichero NO sabe

- **Si VERA contesta igual de bien con usuarios reales**: la prueba fue con preguntas escritas por el plan y una vez (tres en las trampas). No se sabe cómo pregunta un comprador de verdad, ni con frases mal escritas.
- **Cómo resolver B2 sin que VERA ignore lo que dijo el usuario**: la regla de producto no está decidida, y decírselo en el contexto no bastó.
- **Cuánto cuesta VERA por pregunta en uso real**: en la prueba, ~0,008 $ con la caché caliente; nadie registra `usage` en producción (`F-256`).
- **Si 15 s por aserción bastan siempre en `bearingworld-e2e`**: el máximo visto fue 13,5 s (`F-259`).
- **Qué ve el EDITOR `REGISTERED` al entrar**: REG-09 «Activa tu cuenta» dentro del shell (`F-260`); sin comprobar si el menú le deja salir de ahí.
- **Cómo se ven en un navegador `SET-SEC-01`, `INV-03`** y que Inventario adopte el filtro que deja VERA.
- **Cuánto se gana con `0047`/`0051`/`0062`**: sin medir con volumen.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: es juicio, no medida.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores.**
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Qué permisos tiene la clave de AWS de `ingest-email`**, y si el MFA y el SSO de AWS están bien (lo dijo el PO; no verificado).
- **Si un cliente real puede enviar desde su dominio** sin DMARC ni DKIM (`F-252`).
- **Cómo se comporta la búsqueda cruzada con volumen real en Supabase**: la medida de 1M es de un Postgres local.

---

*Cierre del Día 40 · 14-oct-2026 · Dirección Técnica, Nortex Systems*
