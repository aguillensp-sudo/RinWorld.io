# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap` (rama por defecto desde el 25-sep). Si te lanzan en un worktree `claude/…`, opera ahí
con paths absolutos; si nace en `43bb222`, es una sesión vieja: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo impide). Se
sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. Historia en `diario/`, decisiones en
`DECISIONES-V1.md`, hallazgos en `../mvp/findings/`, reglas en `CLAUDE.md`, deuda sin fecha en
`BACKLOG-V1.md`. La versión larga anterior: `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

**Copias fuera del repo:** un proyecto de claude.ai guardaba una copia de este fichero del 25-ago y un
agente de allí dio por hecho que el proyecto llevaba parado desde entonces. La única versión viva es esta.

Empieza por §6 y luego §3.

---

**Día 53 de V1 · cerrado el 20-nov-2026 (UTC, `date -u`).** Entregable 6 (residencia UE) en stand-by indefinido por el PO: no se propone ni se pregunta. **VERA, D8: cerrado por el PO, no se toca.** Del 18 al 20-nov, con el PO probando en producción: VERA sabe con qué empresa es el hilo abierto (`F-285`); texto de ayuda del campo de escribir según haya referencia buscada; hilos sin leer en Panel y lista (`0082`, `F-027` cerrado); Ver hilo/Ver acuerdo y Contactar abren el hilo filtrado por la referencia de la fila, con la regla de etiquetas ampliada (`0083`); y el change de las pestañas de Hilos **archivado** en `openspec/specs/`. Detalle en `diario/dia-53.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| **CI de los seis commits del 18 al 20-nov** (`664aeee` … `6a7ee12`) | `gh run list --branch mvp/bootstrap`, runs 44308662171 a 44741777964 | Los seis en `success`, con e2e de las dos cuentas y los dos despliegues |
| **Migraciones en las dos bases** | `supabase_migrations.schema_migrations` por el MCP, `troxminloxkjwihwfevs` y `ogdhyzgjjbbikjbkhxmu` | La última es `0083_etiqueta_con_linea_publicada` en las dos; la CI de paridad, verde |
| **Hilos sin leer en producción** | SQL por el MCP | `thread_reads` con 84 filas (lo existente al aplicar `0082`, dado por leído); `unread_threads` y `mark_thread_read` existen |
| **`open_thread` con etiqueta** | `pg_proc` en las dos bases | Una sola firma, de seis argumentos (`p_part_number`, `p_brand`), `invoker`; sin `EXECUTE` para `anon` (comprobado al aplicar) |
| **`vera` en producción** | `list_edge_functions` / `get_edge_function` por el MCP | Versión 73. La 69 llevaba `hiloCon` (`F-285`) y la 71 «Todo leído» y «nada sin leer»; las posteriores las desplegó la CI con la guía de Vendiendo y Contactar |
| **La app servida lleva los cambios** | Bundle de `rin-world-io.vercel.app`, por contenido, tras cada despliegue | `hiloCon`, el texto «Inicia una conversación nueva…», `mark_thread_read`/«Todo leído», `initialReference` y `composeReference` |
| **Pruebas del PO en producción** | Lo que dijo el PO | Las 26 pruebas a mano de VERA, aprobadas; F-285, texto de ayuda, sin leer y Vendiendo, probados y bien. Contactar de Comprando: desplegado, sin respuesta suya todavía |
| **Banco SQL** | `bash supabase/tests/run.sh` | Verde entero, con `13_hilos_sin_leer.sql` (9 casos) y `14_etiqueta_linea_publicada.sql` (10) |
| **Matriz** | `harness.core.trazabilidad.resumen(leer_csv())` | 141 CUBIERTO, 21 DIVERGE, 31 NO_IMPLEMENTADO, 14 PARCIAL, 0 SIN_PRUEBA, 3 FUERA = 210 (25 escenarios nuevos del archivo, todos con prueba) |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Su único cabo, `F-192`, cerrado el 20-oct con `0071`.
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) está en stand-by (PO, 22-oct): no se trae a pendientes ni se pregunta** (`DECISIONES-V1.md`, `BACKLOG-V1.md`). VERA sigue en `api.anthropic.com`.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla, rol y **empresa del hilo abierto** (`hiloCon`, `F-285`), cupo de 150 llamadas por usuario y hora (`0068`). `listar_mis_hilos` distingue un mensaje etiquetado de una negociación y dice lo **sin leer** de cada hilo.
- **Hilos.** Change `amend-msg-hilos-pestanas-y-etiqueta` **archivado el 20-nov** (`openspec/changes/archive/2026-11-20-…`); su contrato está en `openspec/specs/messaging-and-negotiation/spec.md`. Pantalla: Mensajes · Soy cliente · Soy proveedor, tabla por papel, buscador arriba en Mensajes, etiqueta de referencia (`0080`, `0081`, `0083`). Sin leer por miembro (`0082`): Panel (§4.4) y recuento azul en la lista (MSG-01 §3).
- **Corriente B · Fábrica — EN MARCHA.** `MSG-HILO-PESTANAS` verde en el intento 2 (`a2990ea`, 0,075 USD). Los cambios a mano sobre artefactos del Coder (`ThreadList`, `SentOffers*`, `ResultsTable`, `Batch*`, `NegotiationTable`) van anotados en `harness-review.csv`. `INV-04` en `exp/inv-04-fabrica` (no se fusiona), **C5 NO del PO** (`F-261`).
- **Corriente C · Verificación — ABIERTA.** Nivel 1 (`trazabilidad.csv`): **141 de 210 con prueba que corre en CI**, 14 parciales, 31 NO implementados, 21 divergencias (aceptadas), **0 sin prueba**, 3 fuera. Quedan 2 «solo e2e» que no pueden estar en CI: modelo real y SES. Niveles 4 y 5 aparcados.
- **Foro, favoritos y siembra simulada:** sin cambios desde el día 52 (ver `git show 3312639:openspec/v1/ESTADO-V1.md`, §2).

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de CADA corrida contra `bearingworld-e2e`** (Playwright o arnés): `gh run list --branch mvp/bootstrap --status in_progress`, en ese momento y no una vez por sesión. **Tu propio push lanza el e2e de la CI** (~10-18 min): o esperas a que acabe o no tocas la instancia (`F-262`). Los e2e van por `npm run e2e:e2e-project`, nunca a secas (`F-282`).
2. **Pendiente del PO:** probar en producción Contactar desde Comprando (con hilo: filtrado y etiquetado; sin hilo: «Primer mensaje» etiquetado). Si algo falla, se arregla aquí antes de seguir.
3. **`docs/ADR-003_Capa_de_integracion.md` está en la raíz sin versionar y se queda FUERA del repo** (PO, 20-nov: «de momento no lo voy a aplicar»). No se commitea ni se borra. `DESCRIPCION.xlsx`, igual.
4. **VERA, D8: CERRADO por el PO (24-oct).** Toda llamada real, con su visto bueno (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_REPETIR`, `VERA_REAL_OUT` fuera del repo, `VERA_REAL_TOPE_USD`).
5. **Frontend:** el PO prepara cambios por su cuenta. **El plan móvil NO se propone hasta que él lo pida** (`BACKLOG-V1.md`). INV-04 se queda con la versión a mano (`F-261`).
6. **Vencido el ~12-nov y sin comprobar:** que `inbox/` de S3 ya no conserva los primeros correos (borrado a 30 días). El MCP de AWS no conectaba el 18 ni el 20-nov.
7. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero, el banco si se tocó `supabase/` más allá de una función, la suite e2e si se tocó un e2e o el arnés (`F-230`), y `py -m harness.tests.test_checks` si se tocó una tarea, la matriz, un test de contrato o se renombró/borró un test que cite la matriz (`F-251`, `F-125`). **Mira la CI del push anterior antes de empujar otro.** **Una migración nueva se aplica por el MCP a las dos bases antes de empujar su fichero** (`F-277`).
8. **La matriz se edita con `harness.core.trazabilidad.leer_csv`/`escribir_csv`, y ninguna nota ni nombre de test citado lleva `;`.** Si un test citado lo lleva, se renombra el test.
9. **`openspec archive` necesita que la spec vigente tenga `## Requirements`.** Las 9 specs heredan `## ADDED Requirements` del MVP; `messaging-and-negotiation` ya está corregida. Al archivar otro change, corrige la suya primero (solo la cabecera).
10. **El `localhost` del PO sirve la carpeta RAÍZ, no un worktree:** tras empujar, adelantarla con `git -C <raíz> merge --ff-only origin/mvp/bootstrap`. Su `app/.env` apunta a producción: lo que marque o escriba allí es real.
11. **`demo:reset` y `fixture.setup.ts` borran y reponen los 5 hilos de demo (`HILO_IDS`):** con `0082`, tras un reset todo lo de la otra empresa sale **sin leer**, porque para la base es nuevo. Los elementos simulados se reponen con `node supabase/seed/poblar-simulacion.mjs --apply --solo-hilos-existentes`.
12. **Remedir E5 con Sonnet 5 real** (n = 5, ≈ 0,04 $) cuando el PO dé su visto bueno a una llamada real.
13. **`git-ops` y los ficheros del Coder:** una línea a mano sobre un artefacto ya commiteado no es un commit mixto; dile qué fichero es artefacto y que la edición es a mano, o se negará.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA es Sonnet 5** (`claude-sonnet-5`) por la API directa; la residencia UE está en stand-by (PO, 22-oct) y no se propone.
- **El proxy de VERA no lee datos; solo abre y cierra su turno en `vera_usage`** (`F-256`). El cupo cuenta llamadas, no preguntas.
- **VERA: la pantalla manda sobre lo recordado** (`F-101`, `F-258`, `F-285`): filtros de Comprando, cambios a mano y la empresa del hilo abierto le llegan en el bloque dinámico.
- **VERA prepara consultas y ofertas en la pestaña Mensajes del hilo** (PO, 18-nov).
- **Etiqueta de un mensaje** (`0080` + `0083`, PO 17 a 20-nov): la referencia buscada, o la de la fila desde Vendiendo, Comprando o las tablas; sin búsqueda, conversación general; no se cambia después. Vale si está en una consulta, oferta u otro mensaje del hilo, o si es una línea **publicada de la otra empresa**. El texto de ayuda del campo dice cuál de los dos casos es.
- **Sin leer es por miembro** (`0082`, PO 18-nov): lo que la otra empresa crea o cambia de estado en lo propio después de abrir el hilo; abrirlo lo marca. Si no se puede medir, «—», nunca 0.
- **La guía de VERA solo cita lo que está en el código**: `vera-prompt.test.ts` ata cada cita a su fichero. Cambiar un texto de pantalla obliga a cambiar la guía en el mismo commit.
- **Pantalla nueva con cabecera o contenedor raíz → `cabeceras.test.ts` / `padding.test.ts`** (`F-209`), y a `veraScreenName` (`F-255`).
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**; **una tabla nueva de `public` nace cerrada** (`0071`). Una función `invoker` que lee una tabla con RLS entra en la superficie auditada de `F-155` (`01_schema_smoke.sql`) con su porqué.
- **El `localhost` del PO ejecuta la carpeta raíz contra producción** (§3.10): migración aditiva primero, cliente después.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Series de medición con **n = 5** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse (vencido el ~12-nov) | Agentes, cuando conecte el MCP de AWS (§3.6) |
| 🟡 | **Contactar de Comprando con etiqueta** desplegado y sin probar por el PO | PO (§3.2) |

## 6 · Lo que este fichero NO sabe

- **Si Contactar de Comprando funciona en producción con un usuario real**: probado por e2e contra `bearingworld-e2e` sin enviar nada; el envío etiquetado, solo en el banco SQL.
- **Si mostrar la empresa del hilo en el bloque dinámico basta** para que Sonnet 5 no arrastre la del hilo anterior en conversaciones largas: el PO lo probó una vez y fue bien.
- **Si el recuento de sin leer cuadra con la percepción del usuario** cuando la otra parte acepta o rechaza algo suyo: cuenta como sin leer por diseño; nadie lo ha discutido aún.
- **Si un elemento que llega justo mientras se marca como leído se pierde del recuento**: es una carrera de milisegundos (`now()` de dos transacciones); sin medir.
- **Si alguien echa de menos el aviso «Esta oferta ha expirado»**: lo dice el estado EXPIRADA (`offer-card#8`).
- **Cuánto cuesta VERA por pregunta en uso real**, **si el cupo de 150 llamadas/hora molesta** y **si contesta igual de bien con usuarios reales** (`F-264`): `vera_usage` lo registra; nadie lo ha mirado con tráfico de verdad.
- **Por qué el lote de 50 dispersa tanto (6–39 s)** y **de dónde salen las paradas de `F-278`**: sin medir en producción.
- **Qué ve el EDITOR `REGISTERED` al entrar** (`F-260`) y **por qué una pantalla del arnés con C1–C4 en verde no pasa C5** (`F-261`).
- **Si Argon2id (64 MiB) entra en un móvil modesto**, **si el umbral de zxcvbn (≥ 3) basta** y **si los reintentos del backup aguantan una caída de red real**: sin medir.
- **Qué permisos tiene la clave de AWS de `ingest-email`**, y si un cliente real puede enviar sin DMARC ni DKIM (`F-252`).
- **Cómo choca el ADR-003 (fuera del repo) con lo construido**: su §6 no está verificado contra las migraciones, y desde que se escribió entraron `0080`–`0083`, que tocan los elementos del hilo.

---

*Cerrado, Día 53 · 20-nov-2026 · Dirección Técnica, Nortex Systems*
