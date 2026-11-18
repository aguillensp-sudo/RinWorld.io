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

**Día 52 de V1 · cerrado el 18-nov-2026 (UTC, `date -u`).** Entregable 6 (residencia UE) en stand-by indefinido por el PO: no se propone ni se pregunta. **VERA, D8: cerrado por el PO, no se toca.** Hecho hoy: cierre del change `amend-msg-hilos-pestanas-y-etiqueta` salvo su archivo (6.3): VERA y los mensajes etiquetados (5.2), retirada de las tablas de MSG-03 v1.2 y de `ThreadHistory` (2.9, 4.5), accesos (5.1), CI y despliegue (6.1, 6.2). Detalle en `diario/dia-52.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| **CI de `f92e506` (5.2) y `98ccf07` (2.9, 4.5)** | `gh run view` por jobs, runs 44287829446 y 44289585843 | Verdes los ocho jobs, con el e2e de las dos cuentas y los dos despliegues (app y `vera`) |
| **`vera` en producción lleva la guía nueva** | `get_edge_function` por el MCP en `troxminloxkjwihwfevs`, versión 68 (10:52 UTC) | Tres pestañas, «El formulario se abre en la pestaña "Mensajes"», «La etiqueta no se puede cambiar después», la nota del mensaje etiquetado en `tools.json` y la regla de `F-283`; la guía de «Consultas»/«Ofertas» ya no está |
| **La app en producción es la pantalla nueva** | Bundle servido por `rin-world-io.vercel.app`, por contenido | Lleva «Soy proveedor», el buscador del hilo y «Ver lo que ve el servidor»; no lleva «Precio/ud.» (tablas retiradas) ni «Cambiar etiqueta». Sin sesión: con Alpha y Beta lo prueba `thread-tabs.spec.ts` en la CI, contra `bearingworld-e2e` |
| **Herramientas de VERA con mensajes etiquetados** | `grep` de `part_number is null` en `app/src` y `supabase/functions`; `vera-tools.test.ts` | Ninguna lo supone. `listar_mis_hilos` pintaba un `MENSAJE` etiquetado igual que una consulta u oferta: corregido y con test |
| **VERA prepara en Mensajes** | `Thread.fuera-de-contrato.test.tsx`, rojo sin el cambio | `Thread` arranca en Mensajes y vuelve a Mensajes al llegar un borrador (decisión del PO del 18-nov) |
| **Accesos al hilo (5.1)** | `App.tsx` | Vendiendo, Comprando y el Contactar de la ficha de Empresas abren el hilo en Mensajes; Panel (cajón Hilos) y el menú, la lista |
| **Suites locales** | `tsc --noEmit`, `vitest` entero, `py -m harness.tests.test_checks` | Limpio; 2.985 de unidad en verde; arnés en verde tras re-apuntar 4 filas de la matriz |
| **Matriz** | `harness.core.trazabilidad.resumen(leer_csv())` | 116 CUBIERTO, 21 DIVERGE, 31 NO_IMPLEMENTADO, 14 PARCIAL, 0 SIN_PRUEBA, 3 FUERA = 185 |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — CERRADA el 14-oct.** Su único cabo, `F-192`, cerrado el 20-oct con `0071`.
- **Fundación V1.** Entregables 1 a 5 hechos. **El 6 (residencia UE) está en stand-by (PO, 22-oct): no se trae a pendientes ni se pregunta** (`DECISIONES-V1.md`, `BACKLOG-V1.md`). VERA sigue en `api.anthropic.com`.
- **VERA.** `claude-sonnet-5` por `api.anthropic.com` (PO, 14-oct). Memoria de 20 intercambios (`F-101`), contexto de pantalla y rol, una línea tras buscar, `navegar` a siete pantallas, cupo de 150 llamadas por usuario y hora y `usage` en `vera_usage` (`0068`, `F-256`). La guía de Hilos describe la pantalla de tres pestañas; `listar_mis_hilos` distingue un mensaje etiquetado de una negociación.
- **Hilos · `amend-msg-hilos-pestanas-y-etiqueta`.** En producción: Mensajes · Soy cliente · Soy proveedor (`Thread.tsx`, a mano), tabla por papel (`NegotiationTable`, lógica en `negotiation-rows.ts`), buscador arriba en Mensajes y etiqueta de referencia en los mensajes (`0080`, `0081`). C5 del PO dada. Tareas hechas salvo **6.3 (archivar en `openspec/specs/`), que espera al PO**. `negotiation-tables.ts`, `InquiriesTable`, `OffersTable` y `ThreadHistory` ya no existen.
- **Corriente B · Fábrica — EN MARCHA.** `MSG-HILO-PESTANAS` verde en el intento 2 (`a2990ea`, 0,075 USD); los cambios a mano posteriores son de producto y van anotados en `harness-review.csv`. `INV-04` en `exp/inv-04-fabrica` (no se fusiona), **C5 NO del PO** (`F-261`).
- **Corriente C · Verificación — ABIERTA.** Nivel 1 (`trazabilidad.csv`): **116 de 185 con prueba que corre en CI**, 14 parciales, 31 NO implementados, 21 divergencias (todas aceptadas), **0 sin prueba**, 3 fuera. Quedan 2 «solo e2e» que no pueden estar en CI: modelo real y SES. Niveles 4 y 5 aparcados.
- **Foro.** Crear hilo, editar y eliminar la publicación propia (`0078`). VERA redacta un borrador (`preparar_hilo_foro`, CUBIERTO por e2e) y resume a petición (`resumir_hilo_foro`, PARCIAL: solo con modelo real).
- **Favoritos.** Por miembro (`favorite_distributors`), recuento por trigger, estrella con confirmación en Comprando y Búsqueda por lotes, botón en la ficha de otra organización. Revisión visual del PO (30-oct): OK.
- **Siembra simulada (PO, 1-nov: «opción 1, solo demo»).** `supabase/seed/poblar-simulacion.mjs`: 21 hilos entre las 7 organizaciones de demo en la base compartida, cifrados con la semilla de demo (`F-067`); ids `5eed000N-`, se retiran con `supabase/seed/retirar_simulacion.sql`.

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar nuevas claves» con esa cuenta**. Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por 30 min, `0052`).
1. **Antes de CADA corrida contra `bearingworld-e2e`** (Playwright o arnés): `gh run list --branch mvp/bootstrap --status in_progress`, en ese momento y no una vez por sesión. **Tu propio push lanza el e2e de la CI** (~10 min): o esperas a que acabe o no tocas la instancia (`F-262`). Los e2e van por `npm run e2e:e2e-project`, nunca a secas (`F-282`).
2. **Pendiente del PO, dos cosas, para sí o no:** (a) archivar el change en `openspec/specs/` (6.3); (b) en Empresas, «tarjeta de Empresa/botón Contactar» se lee como la ficha y su Contactar, que es lo que hay hoy (pulsar una empresa del Directorio abre la ficha, no el hilo). Lo demás que se vigila (`F-067`, `F-269` §2, `F-278`, `F-275`) no se le presenta.
3. **VERA, D8: CERRADO por el PO (24-oct).** Toda llamada real, con su visto bueno (`VERA_REAL=1`, `VERA_REAL_CASOS`, `VERA_REAL_REPETIR`, `VERA_REAL_OUT` fuera del repo, `VERA_REAL_TOPE_USD`).
4. **Frontend:** el PO prepara cambios por su cuenta. **El plan móvil NO se propone hasta que él lo pida** (`BACKLOG-V1.md`). INV-04 se queda con la versión a mano (`F-261`).
5. **Vencido el ~12-nov y sin comprobar:** que `inbox/` de S3 ya no conserva los primeros correos (borrado a 30 días). Hoy el MCP de AWS no conectaba.
6. **Lista previa a empujar:** `tsc --noEmit`, `vitest` entero (`--maxWorkers=50%` si hay otra sesión con tests), el banco si se tocó `supabase/` más allá de una función, la suite e2e si se tocó un e2e o el arnés (`F-230`), y `py -m harness.tests.test_checks` si se tocó una tarea, la matriz, un test de contrato **o se borró un test que cite la matriz** (`F-251`, `F-125`). **Mira la CI del push anterior antes de empujar otro.** Un commit con `[skip ci]` salta la CI de todo su empuje. **Una migración nueva se aplica por el MCP a las dos bases antes de empujar su fichero** (`F-277`).
7. **La matriz se edita con `harness.core.trazabilidad.leer_csv`/`escribir_csv`, y ninguna nota ni nombre de test citado lleva `;`.** La reescritura quita las comillas sobrantes de algunas notas: es normal.
8. **El `localhost` del PO sirve la carpeta RAÍZ, no un worktree:** tras empujar, adelantarla con `git -C <raíz> merge --ff-only origin/mvp/bootstrap`. Su `app/.env` apunta a producción: lo que marque o escriba allí es real.
9. **Los elementos simulados de los 5 hilos de demo (`HILO_IDS`) los borra `demo:reset` y `fixture.setup.ts`.** Se reponen con `node supabase/seed/poblar-simulacion.mjs --apply --solo-hilos-existentes`.
10. **Remedir E5 con Sonnet 5 real** (n = 5, ≈ 0,04 $) cuando el PO dé su visto bueno a una llamada real (§3.3). `vera` en producción ya lleva la regla de `F-283` (comprobado hoy).
11. **`git-ops` y los ficheros del Coder:** una línea a mano sobre un artefacto ya commiteado no es un commit mixto; dile el commit del artefacto (`a2990ea` para `MSG-HILO-PESTANAS`) o se negará.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **VERA es Sonnet 5** (`claude-sonnet-5`) por la API directa; la residencia UE está en stand-by (PO, 22-oct) y no se propone. La spec de `vera-agent` dice 4.6 y no se toca.
- **El proxy de VERA no lee datos; solo abre y cierra su turno en `vera_usage`, con el JWT del usuario y la clave anónima** (D-09-05 matizada, `F-256`). El cupo cuenta llamadas, no preguntas.
- **VERA: memoria de 20 intercambios, solo texto; los datos se vuelven a consultar; la pantalla manda sobre lo recordado.** No repite lo que la pantalla enseña.
- **VERA prepara consultas y ofertas en la pestaña Mensajes del hilo** (PO, 18-nov). Sin prop de pestaña: `Thread` vuelve a Mensajes al llegar el borrador.
- **Hilos:** la etiqueta de un mensaje es la referencia buscada; sin búsqueda, conversación general; no se cambia después (PO, 17 y 18-nov). La base (`0080`) sigue permitiendo el cambio a la organización emisora: no se toca.
- **La guía de VERA solo cita lo que está en el código**: `vera-prompt.test.ts` ata cada cita a su fichero. Cambiar un texto de pantalla obliga a cambiar la guía en el mismo commit.
- **Búsqueda por lotes: el tope de 5 s para 50 referencias se acepta como divergencia** (`F-274`).
- **Pantalla nueva con cabecera o contenedor raíz → `cabeceras.test.ts` / `padding.test.ts`** (`F-209`), y a `veraScreenName` (`F-255`).
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- Privilegios y RLS se comprueban **contra el catálogo** (`F-146`); **ninguna función de `public` la ejecuta `anon`**. **Desde `0071` una tabla nueva de `public` nace cerrada.**
- **El `localhost` del PO ejecuta la carpeta raíz contra producción** (§3.8): migración aditiva primero, cliente después.
- **La CD despliega cuatro funciones sin JWT**: `access-request`, `register-organization`, `accept-invitation` e `ingest-email`.
- **Lo que no es del contrato de una tarea va a `*.fuera-de-contrato.test.tsx`** (`F-251`). Series de medición con **n = 5** (`F-225`).

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **Borrado a 30 días de S3** sin ver ejecutarse (vencido el ~12-nov) | Agentes, cuando conecte el MCP de AWS (§3.5) |
| 🟡 | **Change `amend-msg-hilos-pestanas-y-etiqueta` sin archivar** | PO (§3.2) |

## 6 · Lo que este fichero NO sabe

- **Si VERA con Sonnet 5 real distingue un mensaje etiquetado de una negociación** y si contesta bien sobre las pestañas nuevas: la herramienta y la guía están probadas como texto, sin llamada real.
- **Si alguien echa de menos el aviso «Esta oferta ha expirado»**: la tabla por papel no lo pinta y lo dice el estado EXPIRADA (`offer-card#8`).
- **Cuánto cuesta VERA por pregunta en uso real**: una sola pregunta medida (≈ 0,014 $ con caché caliente). `vera_usage` ya lo registra.
- **Si el cupo de 150 llamadas/hora molesta a un usuario de verdad**: nadie se ha acercado.
- **Si VERA contesta igual de bien con usuarios reales**, mantiene el idioma en conversaciones largas (`F-264`) y acierta el control de B2 con peticiones ambiguas.
- **Por qué el lote de 50 dispersa tanto (6–39 s)** y **de dónde salen las paradas de `F-278`**: sin medir en producción.
- **Qué ve el EDITOR `REGISTERED` al entrar** (`F-260`), y **si Inventario adopta bien el filtro que deja VERA**: nadie lo ha mirado en un navegador.
- **Por qué una pantalla del arnés con C1–C4 en verde no pasa C5** (`F-261`).
- **Si la pantalla de subida enseña el motivo del tope de 500.000 líneas**: la base lo da; la pantalla, sin comprobar.
- **Si Argon2id (64 MiB) entra en un móvil modesto** y **si el umbral de zxcvbn (≥ 3) basta**: sin medir.
- **Cómo se ve la pantalla de suspensión con una cuenta real**, y **si `billing_*` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **Si los favoritos de un miembro revocado siguen sumando al recuento**: deducido del código, no probado.
- **Si los reintentos del backup aguantan una caída de red real**: el e2e simula los fallos.
- **Cómo se encuentran las cosas con 21 hilos y ~600 elementos en la pantalla de tres pestañas**, y **si las cuentas de JULSA y de Ibéricos abren lo cifrado para ellas**.
- **Qué permisos tiene la clave de AWS de `ingest-email`**, y si un cliente real puede enviar sin DMARC ni DKIM (`F-252`).

---

*Cerrado, Día 52 · 18-nov-2026 · Dirección Técnica, Nortex Systems*
