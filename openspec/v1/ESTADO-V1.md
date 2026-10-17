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

**Día 42 de V1 · 16-oct-2026 · Estado: CERRADO (07:20 UTC), reabierto y vuelto a cerrar (08:02 UTC) por la sesión «sin VERA» tras la C5 a mano del PO.** `F-262` se queda en regla de avisar (PO). C5: producción aprobada salvo el «Cancelar» del alta en INV-04 (arreglado, `4bf324b`); la INV-04 del arnés, rechazada (`F-261`); el móvil y las tablas anchas, al backlog (`F-260`). Detalle en `diario/dia-42.md`, última sección. Días 41–42, por lo demás, solo la sesión de VERA. 15-oct: un filtro quitado a mano ya no se repone sin que el usuario lo pida (control en `buscar_en_catalogo`, `F-258`); `F-101` cerrado. 16-oct, tras la prueba a mano del PO («todo ha funcionado»): Resultados de búsqueda ordena por defecto lo más reciente arriba (decisión del PO) y VERA contesta en el idioma del usuario (`F-264`). Lo del día 40 (las tres sesiones) sigue en `diario/dia-40.md` y `dia-40-sin-vera.md`; lo de hoy, en `diario/dia-41.md` y `dia-42.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `0062`, `0063`, `0064` en producción | `pg_policies`, `cron.job` y recuentos como `authenticated` antes/después | Recuentos idénticos; búsqueda `6205` 3.086 → 45 ms; purga diaria activa |
| Canal de ingestión y borrado de S3 | `npm run ingest:salud`; consola de AWS (PO) | 10 eventos en 7 días; `expire-inbox-mail` activa, 30 días |
| VERA no tiene tablas de uso, cuota, preferencias ni auditoría | `pg_class` de producción | Solo `auth.audit_log_entries`: `F-256`, `F-257` |
| «6204» casa con 15 designaciones | `inventory_lines` `PUBLISHED`, `ilike '%6204%'` | 74 líneas: `F-254` |
| VERA desplegada (16-oct) | `get_edge_function` (v42) y el bundle de `rin-world-io.vercel.app` | Regla de idioma y orden por defecto en la guía; el bundle sirve `1290d71`+, con `last_upload_at` y el aviso de orden a VERA |
| Idioma de VERA (`F-264`) | Casos L1–L6 del runner contra la v41 y la v42 | Inglés, alemán, francés e italiano bien; falla el cambio de idioma a mitad de conversación (1 de 2) |
| Filtro quitado a mano (`F-258`, B2) | Runner contra la v40 (15-oct) | B2 3/3 y su opuesto B9 2/2 |
| Inventario de ALPHA | `inventory_lines` por organización | «Rodamientos Ibéricos»: 10.642 publicadas, subidas el 16-oct a las 07:14:43 UTC (antes, 1) |
| **Qué contesta VERA (Sonnet 5)** | `vera.real.test.ts` contra la v37–v42, cuentas ALPHA, EDITOR y BETA, sin escribir nada | 134 turnos (1,06 $) + repeticiones (~1,25 $): memoria, contexto de pantalla, filtro quitado a mano e idioma funcionan; abiertos B7 (`F-258`) y el cambio de idioma a mitad (`F-264`). Y el PO lo probó a mano el 16-oct |
| Caché del prompt con Sonnet 5 | `usage` de cada llamada | 18.709–18.991 tokens escritos al desplegar y leídos enteros después |
| CI de `8076668` | Run `38631715177` | Falló en MSG-01/MSG-02 por la colisión de `F-262`; el reintento de los jobs fallidos, verde entero |
| `F-259` (paradas de `bearingworld-e2e`), `F-260` (repaso visual), `F-192` (propuesta) | `edge_logs` y traza del run `38601905364`; capturas y métricas de Playwright; `probar.sh` — **por la otra sesión** | Ver cada hallazgo |
| **C5 a mano del PO** (16-oct), plan de `diario/dia-40-sin-vera.md` | El PO en producción y en `localhost:5174` | Panel, fondos, aviso XLSX, fila de ADMIN-01, VERA sobre XLSX, `SET-SEC-01` e `INV-03`: aprobados. INV-04 a mano: aprobada salvo un «Cancelar», ya arreglado. INV-04 del arnés: **C5 NO** (`F-261`) |
| XLSX real por correo | `ingest_events` de producción, 16-oct 07:45 UTC | Ningún correo nuevo desde el 13-oct: el PO no lo envió en esta prueba («ya sé que funciona»). El último `.xlsx`, 23.750 filas, `PROCESADO` el 13-oct |
| «Cancelar» del alta en INV-04 desplegado | Run `38869210641` y el bundle de `rin-world-io.vercel.app` | CI verde entera; producción sirve `4bf324b` con la clase `addCancel` en su CSS |
| `VITE_DEMO_KEY_SEED` en el JS de producción (`F-067`) | La semilla buscada en el bundle, sin imprimirla — otra sesión | **Está** |
| `vitest` y `tsc` del último empuje | Local, árbol fusionado | 2703 verdes; con la suite entera en paralelo a otra sesión fallan tests al azar por el tope de 5 s |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Único cabo suelto: `F-192`, ahora con propuesta lista en `supabase/propuestas/F-192/`.
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) sigue bloqueado.** Vertex: los 3 cupos pedidos el 14-oct fueron **denegados** el 16-oct (`vera-vertex-eu-migracion.md` §7). Alternativa: Bedrock UE, con Sonnet 4.6 funcionando y Sonnet 5 **sin acceso ni cupo** (`vera-bedrock-eu-plan.md`). El runbook aún dice que el cambio es de modelo y proveedor: **el modelo ya está cambiado**, solo queda el proveedor.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla y rol, una línea tras buscar, `navegar` a siete pantallas. **Medida contra Sonnet 5** (`F-258`): bien en guía, trampas, memoria y pantalla. Desde el 15-oct, un filtro quitado a mano no se repone sin que el usuario lo pida (control en la herramienta, v40). Falla un recuento (B7, intermitente). Contesta en el idioma del usuario (`F-264`). **Resultados de búsqueda ordena por defecto lo más reciente arriba** (PO, 16-oct); VERA sigue viendo sus 25 filas por cantidad.
- **Corriente B · Fábrica — EN MARCHA.** `INV-04` reconstruida por el arnés en `exp/inv-04-fabrica` (no se fusiona): verde en C1–C4 y con 13 líneas de corrección a mano, pero **C5 NO del PO** por diferencias de diseño, así que no cuenta como pantalla aceptada. Las cifras 7 y 8 **cerradas el 17-oct** (PO): `SRCH-03` único punto limpio, `INV-04` intento fallido, sin veredicto por mediana (`F-261`). Los checks no ven lo que el PO ve a simple vista. `F-263` cerrado (16-oct): las `_nota*` de `component_api` ya llegan al Coder; la próxima serie parte de ese prompt y no es comparable con las cifras 7 y 8.
- **Corriente C · Verificación — ABIERTA el 17-oct.** Nivel 1: `openspec/v1/trazabilidad.csv`, **58 de 185 escenarios con prueba que los ejerce y corre en CI**, 87 parciales, 31 NO implementados, 2 divergen, 4 sin prueba (`F-265`, `F-267`). Nivel 2 hecho (`F-266`: vectores RFC 7748 y NIST, IV no repetido, la frase no sale en recuperar/rotar; decididos por el PO: sin Wycheproof y sin tope duro). Paso 3 hecho (`F-267`): decide el PO qué `NO_IMPLEMENTADO` entra en V1. Siguiente: los `PARCIAL` por un agente distinto del que implementó. Niveles 4 y 5 aparcados.

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de lanzar Playwright o el arnés contra `bearingworld-e2e`:** avisar a las demás sesiones vivas y mirar que no haya un job en marcha (`gh run list --branch mvp/bootstrap --status in_progress`). Dos corridas a la vez se pisan el fixture (`F-262`); no hay cerrojo entre sesiones.
2. **Del PO:**
   - **Pruebas a mano de VERA:** el PO las hizo el 15–16-oct en producción (`troxminloxkjwihwfevs`); salieron dos comentarios, ya arreglados. Lo que falle en adelante se convierte en caso del runner.
   - **Casado de referencias (`F-254`):** el PO trae definiciones tras mirar al competidor. **No se toca `search.ts` hasta entonces.**
   - **Bedrock:** decidir el modelo (`vera-bedrock-eu-plan.md` §2) y pedir a AWS acceso o cupo para Sonnet 5 en `eu.anthropic.claude-sonnet-5` (cuenta y facturación, gratis). Vertex: solo un caso de soporte de pago lo desbloquearía; **no enviar la reclamación vieja.** Al llegar el cupo (Bedrock o Vertex), cambiar solo el proveedor y repetir una muestra del plan (~20 preguntas, ~1 $, plan §9).
   - **Semilla de demo:** quitar `VITE_DEMO_KEY_SEED` de Vercel de producción **cuando se acerquen datos reales o terceros** (`F-067`).
   - Cuscinetti Padana deja de estar `ACTIVE` el **20-oct**. **No se toca.**
3. **VERA, para la próxima pasada:** el runner (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_OUT` fuera del repo, freno en `VERA_REAL_TOPE_USD`) está listo. Toda llamada real, con el visto bueno del PO. Lo pendiente: B7, A24 (contesta en doce líneas) y L6 (cambio de idioma a mitad, `F-264`).
4. **Frontend:** el PO prepara más cambios por su cuenta.
   - **El plan móvil NO se propone hasta que él lo pida**, con el frontend cerrado (`BACKLOG-V1.md`).
   - INV-04 se queda con la versión hecha a mano; `exp/inv-04-fabrica` es solo evidencia (`F-261`).
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
| 🟠 | **Entregable 6** · VERA sigue en `api.anthropic.com`; Vertex denegado (16-oct); Bedrock UE: 4.6 sí, Sonnet 5 sin acceso | AWS + PO |
| 🟡 | **`F-067`** · la semilla de demo va en el JS de producción | PO (disparador en `BACKLOG-V1.md`) |
| 🟡 | **`F-254`** · la búsqueda casa por «contiene»; los sufijos de fabricante no se reconocen | PO (definiciones) |
| 🟡 | **`F-256`** · VERA sin límite por usuario y hora ni registro de `usage` (el tope de tamaño sí está) | Backlog, antes de terceros |
| 🟡 | **`F-192` · riesgo aceptado**, privilegios por defecto anchos; propuesta lista en `supabase/propuestas/F-192/` | PO |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse | Mirar ~12-nov |

## 6 · Lo que este fichero NO sabe

- **Si VERA contesta igual de bien con usuarios reales**: la prueba fue con preguntas escritas por el plan y una vez (tres en las trampas). No se sabe cómo pregunta un comprador de verdad, ni con frases mal escritas.
- **Si VERA mantiene el idioma en conversaciones largas o mezcladas**: medido con seis preguntas; cambiar a mitad falla 1 de 2 (`F-264`).
- **Si el control de B2 acierta con frases reales**: probado con «ahora de FAG» y «vuelve a ponerme Europa»; no con peticiones ambiguas («y en Europa también»).
- **Cuánto cuesta VERA por pregunta en uso real**: en la prueba, ~0,008 $ con la caché caliente; nadie registra `usage` en producción (`F-256`).
- **Si 15 s por aserción bastan siempre en `bearingworld-e2e`**: el máximo visto fue 13,5 s (`F-259`).
- **Qué ve el EDITOR `REGISTERED` al entrar**: REG-09 «Activa tu cuenta» dentro del shell (`F-260`); sin comprobar si el menú le deja salir de ahí.
- **Si Inventario adopta bien el filtro que deja VERA**: nadie lo ha mirado en un navegador.
- **Por qué una pantalla del arnés con C1–C4 en verde no pasa C5**: el PO vio «variadas diferencias» en la INV-04 del arnés y decidió no detallarlas (`F-261`). No se sabe qué cambiar en la tarea ni en el arnés para que no se repita.
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
