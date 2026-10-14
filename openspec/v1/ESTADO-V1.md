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

**Día 40 de V1 · 14-oct-2026 · Estado: CERRADO.** Mañana: limpieza del relevo y deuda técnica (`F-224`, `F-225`, `F-233`, `F-234`, `F-250`–`F-253`). Tarde: VERA lista para probarse como la usaría un usuario real —memoria de conversación (`F-101`), contexto de pantalla real (`F-255`), tope de tamaño en el proxy (`F-256`), respuestas que no repiten la pantalla, `navegar` a Empresas y Foros— y **VERA pasa a Sonnet 5** por la API directa (PO), **sin preguntarle todavía**. Otras sesiones cerraron `F-229` (chip País), `F-171`, `F-099`, `F-039` y `F-098`, y dieron a `INV-03` el motivo de un archivo ilegible (`.xls`, tamaño, vacío); `F-067` quedó agravado: la semilla de demo está en el JS de producción. Sin fecha de demo. Detalle en `diario/dia-40.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `0062` en producción: 31 políticas con la función de sesión envuelta | `pg_policies` y 15 recuentos como `authenticated` (ADMIN de ALPHA) antes/después | 0 de 45 a pelo; recuentos idénticos |
| `0064` en producción: visibilidad del inventario ajeno calculada una vez | Líneas visibles como `authenticated` para 8 espectadores, antes/después | Mismas líneas; recuento 2.700 → 7 ms; búsqueda `6205` 3.086 → 45 ms |
| `0063`: purga diaria del historial | `cron.job` | `purge-ingest-events`, `17 3 * * *`, activo |
| Regla de S3 que borra el correo crudo | Consola de AWS, a mano por el PO | `expire-inbox-mail`, Enabled, prefijo `inbox/`, 30 días |
| Canal de ingestión | `npm run ingest:salud` | 10 eventos en 7 días; último 13-oct 14:10 UTC `PROCESADO` |
| VERA no tiene tablas de uso, cuota, preferencias ni auditoría | `pg_class` de producción, fuera de los esquemas del sistema | Solo `auth.audit_log_entries` (la de Supabase): `F-256`, `F-257` |
| «6204» casa con 15 designaciones distintas | `inventory_lines` `PUBLISHED`, `part_number ilike '%6204%'` | 74 líneas, de `6204` a `S-6204-2RS`: `F-254` |
| CI de `de0e67a` (motivo en `INV-03`), `0357340` (País) y `5a4c243` (`F-171`) | `gh run list` | Verdes. `0357340` falló la primera vez en dos e2e sin relación (`keys-intro`, `messages`, timeout de 5 s) y pasó al repetir los jobs fallidos |
| `F-171`: producción sirve el commit desplegado | `curl` al bundle de `rin-world-io.vercel.app` | Contiene `dataset.build=` con el SHA completo de `5a4c243`; el paso de CI nuevo pasó en el run `38605908970` |
| `VITE_DEMO_KEY_SEED` en el JS de producción (`F-067`) | La semilla local (43 caracteres, sin imprimirla) buscada en el bundle servido | **Está.** Quien lo descargue deriva las privadas de las cuentas de prueba; no afecta a los miembros con ADR-001 |
| Segundo dispositivo MFA del raíz de AWS y acceso del usuario SSO | Lo dijo el PO el 14-oct | HECHO, **no verificado por este agente** |
| `vitest` y `tsc` con la memoria de VERA | Local, sobre el árbol fusionado con `origin` | 2676 verdes, 31 saltados (las sondas reales); `tsc` y `tsc -p tsconfig.build.json` limpios |
| CI y despliegue de `e9447b1` (memoria de VERA) | Run `38608195562`; `get_edge_function` de `vera` en producción, buscando tres cadenas | Los seis jobs verdes; `vera` **v35** ACTIVE lleva la guía nueva («Encontrar una empresa…», «Cambiar la frase de backup») y la memoria («LA CONVERSACIÓN TE LLEGA; LOS DATOS, NO:») |
| Qué contesta VERA con todo lo de hoy | — | **No se ha preguntado a Sonnet**: plan en `vera-plan-pruebas-sonnet.md` |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct** (decisión del PO, `DECISIONES-V1.md`). Único cabo suelto: `F-192`, riesgo aceptado con disparador en `BACKLOG-V1.md`.
- **Fundación V1.** Entregables 1 a 5 hechos (el 5 se midió y se dio por cumplido, `F-253`). **El 6 (residencia UE de VERA) sigue bloqueado** por cupo en cero en Vertex (`429`). El 14-oct se pidieron 3 cupos por `gcloud` (`vera-eu-sonnet-requests`, `-input-tokens`, `-output-tokens`), sin aprobar aún (`vera-vertex-eu-migracion.md` §7). Lo lleva otra sesión: no tocar.
- **VERA.** La guía verificada cubre todas las pantallas construidas (`5dc1624`, más País de `F-229`). Desde `da5b1fa`: memoria de 20 intercambios, solo texto (`F-101`); el contexto dice la pantalla real con subpantallas (`F-255`); tras una búsqueda, una línea; Inventario solo se mueve si la respuesta es una lista. Desde el 14-oct (tarde, decisión del PO) `navegar` lleva también a Empresas y Foros, a su entrada; Contacto sigue sin existir. **Modelo: `claude-sonnet-5`** desde el 14-oct (PO; antes 4.6), por `api.anthropic.com`: Vertex UE cambiará solo el proveedor. `MAX_TOKENS` 3072 por el tokenizador nuevo. Todo con el modelo mockeado: **construido, no medido**.
- **Corriente B · Fábrica — EN MARCHA.** 27 pantallas construidas y aceptadas. `REC-01`, `SET-SEC-01`, `INVT-02`, `ACT-02` e `INV-04` fueron **a mano**, sin filas en `harness-metrics.csv`. Cifras 7 y 8: un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta** (borra su backup). Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por ventana de 30 min, acertar no reinicia, `0052`).
1. **Del PO:**
   - **VERA contra Sonnet 5:** dar o no el visto bueno a `vera-plan-pruebas-sonnet.md` (~120 preguntas, 3–8 $, tope propuesto 10 $). **Sin ese sí no se hace ninguna llamada real.** Es la primera línea base de Sonnet 5: lo de agosto era 4.6 y no se compara número a número.
   - **Casado de referencias (`F-254`):** el PO va a analizar cómo lo hace el competidor y traerá definiciones. **No se toca `search.ts` hasta entonces.** De esto depende qué hace VERA con «ahora busca 6304» con otros filtros puestos (hoy: dice cuáles mantiene).
   - **Vertex:** mirar `gcloud beta quotas preferences list --project=bearingworld-vera-eu` y repetir la llamada de prueba (`grantedValue` ≠ 0). **No enviar la reclamación vieja** (§7 la da por superada). Si en unos días no cambia, caso de soporte de Google citando los 3 identificadores.
   - **Semilla de demo:** quitar `VITE_DEMO_KEY_SEED` del entorno de Vercel de producción **cuando se acerquen datos reales o abrir el registro a terceros** (PO, 14-oct: «cuando se acerque»). Inutiliza allí las cuentas de prueba (`BACKLOG-V1.md`, `F-067`). Hasta entonces, no.
   - Cuscinetti Padana deja de estar `ACTIVE` el **20-oct**. **No se toca** (ni resiembra ni reactivación): solo importaría con demo o enseñando `ADMIN-02`.
2. **VERA, si el PO da el sí:** escribir `app/src/lib/vera.real.test.ts` (`VERA_REAL=1`, patrón de `vera.ensayo`), con captura de `usage` y de los retornos de herramienta (hoy `createProxyCall` tira `usage`), y ejecutar el plan. El despliegue ya está comprobado por contenido (v35). La primera llamada reescribe la caché (~17.000 tokens estimados con el tokenizador de Sonnet 5). Mirar en el registro lo propio de Sonnet 5 (plan §7): respuestas demasiado literales o restrictivas, el tope de 4 vueltas, `max_tokens` y `refusal`.
3. **`INV-04`:** sin código pendiente. Mirar `npm run ingest:salud` al abrir sesión. **~12-nov: comprobar que `inbox/` ya no conserva los primeros correos**. No usar el conector `AWS MCP` salvo que el PO lo pida.
4. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero, **el banco (`supabase/tests/run.sh`, Docker) si se tocó `supabase/`** más allá de una función, la suite e2e contra `bearingworld-e2e` si se tocó un e2e o el arnés (`F-230`) y `py -m harness.tests.test_checks` si se tocó el contrato de una tarea (`F-251`). **Mira la CI del push anterior antes de empujar otro. Basta UN commit con `[skip ci]` dentro de un empuje para que GitHub salte la CI de TODOS sus commits** (basta con ESCRIBIR la cadena en el mensaje): los `[skip ci]` van en un empuje aparte, o primero el código y después la documentación. Nunca `vitest` con un e2e en marcha.
5. Deuda sin fecha y sus disparadores: `BACKLOG-V1.md` (incluye el límite por hora de VERA, `F-256`, y su auditoría, `F-257`).

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA: memoria de 20 intercambios, solo texto; los datos se vuelven a consultar; los filtros de Comprando mandan sobre lo recordado.** El 20 se ajusta con lo medido.
- **VERA no repite lo que la pantalla enseña**: tras buscar, una línea con filtros y recuento; solo añade que algo no se pudo filtrar o que no hay resultados. Inventario se mueve solo con una lista; Hilos, texto breve.
- **Pantalla nueva con cabecera o contenedor raíz → añadirla a `cabeceras.test.ts` / `padding.test.ts`.** Contenido a la izquierda, padding `--bw-screen-pad` (`F-209`). Y si VERA debe saber que está ahí, a `veraScreenName` (`F-255`), en el orden de las ramas del render.
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql`** (`0059`). **Se siembra antes de cada corrida** con `npm run demo:reset` (`F-169`, `F-248`). **No repone inventario.**
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell, con `height: 100%; overflow-y: auto`.
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**. **Una política que llame a `app.f()` o `auth.f()` sin envolver en `(select …)` rompe el banco** (`0062`).
- **Fase B (`REG-05` → `06` → `07`)**: el paso no se guarda; solo el ADMIN `REGISTERED`. **La frase no sale nunca del navegador.**
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: migración aditiva primero, cliente después.
- **La importación manual**: solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; tope 20.000 filas por subida. El correo admite `.xlsx` de hasta 120.000 filas en lotes de 20.000.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Un artefacto verde del arnés no lleva `[skip ci]`.
- Series de medición con **n=5**; el corpus y el arnés **no se tocan a mitad de serie** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; 3 cupos pedidos el 14-oct, sin aprobar; `429` | Google (aprobar) + PO |
| 🟠 | **VERA sin medir contra Sonnet 5**: modelo nuevo desde el 14-oct, con un prompt afinado para 4.6, más la guía nueva y la memoria (`F-101`, `F-255`); plan escrito, sin ejecutar | PO (visto bueno) |
| 🟡 | **`F-067` · `VITE_DEMO_KEY_SEED` va en el JS de producción**: las privadas de las cuentas de prueba son derivables. Datos inventados hoy | PO (disparador en `BACKLOG-V1.md`) |
| 🟡 | **`F-254` · la búsqueda casa por «contiene»**; los sufijos de fabricante no se reconocen | PO (definiciones) |
| 🟡 | **VERA sin límite por usuario y hora ni registro de `usage`** (`F-256`; el tope de tamaño sí está) | Backlog, antes de terceros |
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse (§3.3) | Mirar ~12-nov |
| 🟡 | **`F-192` · riesgo aceptado**, privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Qué contesta VERA con lo de hoy**: la memoria, el contexto de pantalla corregido, la regla de una línea y las ocho entradas nuevas de la guía están probados con el modelo mockeado, **no preguntados a Sonnet**; y desde el 14-oct el modelo es Sonnet 5, que nadie ha visto contestar con este prompt (sigue las órdenes más al pie de la letra que 4.6). Antes de hoy, con 4.6, se probó con 8 preguntas del ensayo, el ejemplo de la spec y siete trampas, una vez cada una.
- **Si con memoria VERA reutiliza datos de sus respuestas anteriores** en vez de volver a consultar: el prompt lo prohíbe; solo una llamada real lo dice.
- **Cuánto cuesta VERA por pregunta en uso real**: `usage` se devuelve y el cliente lo tira; lo del plan (~0,03–0,08 $) es una estimación por caracteres.
- **Si los e2e de `bearingworld-e2e` son estables**: falló una vez por timeout de 5 s en dos specs sin relación (14-oct) y no se ha investigado la causa; un `npm run e2e` local a secas toca el proyecto de la demo (`F-098`).
- **Cómo se ve nada en un navegador desde este agente**: cabeceras, padding, `MSG-03`, `INV-04`, y que Inventario adopte bien el filtro que deja VERA. Los tests leen DOM y CSS, no miden render.
- **Qué ve al entrar el EDITOR `REGISTERED` de cada empresa nueva** (Nakishita y Rey): nadie lo ha recorrido.
- **Cuánto se gana con `0047`/`0051`/`0062`**: sin medir con volumen. La de `0064` sí está medida (`F-253`).
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: es juicio, no medida.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba, el del PO y el de Rey.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Qué permisos tiene la clave de AWS de `ingest-email`**: el guion está escrito, no ejecutado.
- **Si un cliente real puede enviar desde su dominio**: entran Gmail y `julsaindustrial.com`; otro sin DMARC ni DKIM no (`F-252`).
- **Cómo se comporta la búsqueda cruzada con volumen real en Supabase**: la medida de 1M es de un Postgres local.

---

*Cierre del Día 40 · 14-oct-2026 · Dirección Técnica, Nortex Systems*
