# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap`; si te lanzan en un worktree `claude/…`, **opera sobre esa ruta con paths
absolutos.** Desde el 25-sep `mvp/bootstrap` es la rama por defecto de GitHub. Si un worktree
nace en `43bb222`, es una sesión vieja reabierta: la receta está en `CLAUDE.md` §11.

**Qué es este fichero:** el relevo. Solo estado, **máximo 150 líneas** (un hook de git lo
impide). Se sobrescribe al cierre de cada día con el ritual de `CLAUDE.md` §11. La historia
va en `diario/`, las decisiones en `DECISIONES-V1.md`, los hallazgos en `../mvp/findings/` y
las reglas en `CLAUDE.md`. La versión larga anterior sigue en `git show d2df8d4:openspec/v1/ESTADO-V1.md`.

Empieza por §6 y luego §3.
---

**Día 39 de V1 · 13-oct-2026 · Estado: CERRADO (CI y despliegues de `7af9bc0` en verde; Vercel comprobado por contenido).** **`INV-04` fase 2 probada de punta a punta** (un CSV por Gmail → 3 líneas) y **pantalla del canal construida a mano**. También entra desde `julsaindustrial.com` (publicado su `_dmarc`). Falta:
comprobar la clave de AWS (guion listo) los límites por hora (el `.xlsx` ya está probado por correo, `6a3d68c`). Sin fecha de demo. Detalle en `diario/dia-39.md`.
---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| `ingest-email` v6 y `0061` en producción | `list_edge_functions`, `list_migrations`, `has_function_privilege` | v6 `verify_jwt=false`; `ingest_resolve` e `import_inventory_for_org` solo `service_role` |
| Correo de punta a punta | `ingest_events` de JULSA, 13-oct 08:02 y 09:48 UTC; DNS de `_dmarc` | `PROCESADO`, 3 filas, desde Gmail y desde `julsaindustrial.com` (tras publicar `_dmarc`, `F-252`). Sin perfil: `FORMATO_NO_RECONOCIDO` |
| Medidas de la función | `inv04-medidas-funcion.md` (Node, no Supabase) | 20.000 filas ≈ 0,3 s; 37 MB ≈ 1 GB: tope a 5 MB |
| Medidas del `.xlsx` | `inv04-medidas-xlsx.md` (Node, no Supabase) | 100.001 filas reales del PO ≈ 0,6 s y 173 MB hasta tener las líneas; tope 120.000 filas |
| Pantalla del canal contra la base | `e2e/ingest-channel.spec.ts` en `bearingworld-e2e` | 4 de 4: abrir idempotente, remitente protegido, añadir/quitar, rotar con confirmación |
| `vitest`, `tsc`, e2e de inventario | local | 2396 verdes; `tsc` limpio; `inventory.spec.ts` 16 de 16 |

## 2 · Dónde estamos, por corriente

- **Corriente A · Núcleo — EN CURSO.** Sin piezas abiertas propias; lo que queda está en §5.
- **Fundación V1.** Entregables 1 a 4 hechos. El 5 (índice de búsqueda), a medias: falta que
  el PO diga a qué índice se refiere el plan. **El 6 (residencia UE de VERA) está bloqueado**
  en la aprobación de Anthropic en Model Garden (`429`), sin fecha. Ya se tocó `vera/index.ts` (prompt, `F-246`); el cambio de proveedor sigue sin hacerse.
- **Corriente B · Fábrica — EN MARCHA.** **27 pantallas construidas y aceptadas** (la C5 de `MSG-03` la aprobó el PO el 12-oct). `REC-01`, `SET-SEC-01`, `INVT-02` y `ACT-02`, **a mano**, sin
  filas en `harness-metrics.csv`. `INV-04` se construyó **a mano** (PO, 13-oct), sin pasar por el arnés. Cifras 7 y 8: un solo punto limpio, `SRCH-03` (`F-205`).
- **Corriente C · Verificación — NO ABIERTA.**

## 3 · Qué toca, en este orden

0. **JULSA es el primer miembro `ACTIVE` con ADR-001 completo.** Su privada vive SOLO en el navegador del PO: no borrar sus datos del sitio y **no pulsar «Generar
   nuevas claves» con esa cuenta** (borra su backup). Cada «Desbloquear» de `REC-01` y cada cambio de `SET-SEC-01` **cuenta una petición** (5 por ventana de 30 min,
   acertar no reinicia, `0052`): el PO se bloqueó una vez probando y se le reinició el contador a mano.
1. ~~C5 de `MSG-03`~~ **aprobada por el PO el 12-oct-2026** (tablas, formulario por fila, `Crear consulta`, VERA preparando); veredicto en la `nota` de `harness-review.csv`. Sin fecha de demo; si se fija, `guion-demo-h5.md`.
2. **`INV-04`, lo que queda** (plan: `v1/plan-inv04-ingestion-por-correo.md`): (a) ~~tope de 5 MB~~ confirmado por el PO el 13-oct (`DECISIONES-V1.md`); (b) el PO corre el guion de CloudShell
   (`inv04-comprobar-clave-aws.md`: solo `GetObject` en `inbox/` debe salir `allowed`) y anota la fecha de la clave para rotarla a los 90 días; (c) avisar en la pantalla de que el dominio del remitente necesita DMARC o DKIM (`F-252`); (d) AWS: presupuesto `bearingworld-mensual-20usd` creado el 13-oct (20 USD/mes, avisos al 80 y 100 % a `alvaro.guillen@nortexsys.com`; verificado con `describe-budgets`, cuenta de gestión `226395401132`, cubre el gasto de toda la organización). **MFA del usuario raíz de la cuenta de gestión: hecho el 13-oct** (`iam get-account-summary` → `AccountMFAEnabled=1`). **Pendiente del PO: MFA del usuario SSO**, que se gestiona desde `Identity Delegated Admin` (`814774916668`). Las cuentas miembro no tienen raíz (acceso raíz centralizado). El PO decidió dejar la clave de AWS como está; (e) fase 3 **hecha en lo del `.xlsx`** (`6a3d68c`, CI y despliegue en verde; la función desplegada lleva `xlsx-rows.ts` y `MAX_XLSX_ROWS = 120_000`, comprobado en el código que sirve Supabase): lector sin DOM, 120.000 filas, lotes de 20.000. **Probada con correo real el 13-oct, 14:10 UTC**: `Rodamientos_100000_Ficticio.xlsx` (100.001 filas, 3 MB) desde `a.guillen@julsaindustrial.com` → `PROCESADO`, `rows_imported=23750`, JULSA con 23.750 líneas (el resto, 76.251, duplicados por `Codigo`+`Marca`); una sola fila en `ingest_events`, sin reintento de SNS. La primera vez (12:30) salió `FORMATO_NO_RECONOCIDO` porque el perfil de la muestra no estaba guardado. **Sin medir:** CPU y memoria reales dentro de Supabase (la herramienta de logs del MCP no encuentra las tablas); el Dashboard sí las tiene. Los 40 MB se descartaron (PO). Quedan los límites por hora (fase 4).
   **No usar el conector `AWS MCP`** salvo que el PO lo pida (esta sesión pedía autenticación).
3. **VERA: ampliar la guía verificada** (`index.ts`, sección «GUÍA VERIFICADA»): ya saben la subida de inventario, `Visibilidad`, los filtros y acciones de `Inventario`, `Crear consulta`/`Crear oferta` y
   `Consultar`. Siguientes: Vendiendo, el resto de Comprando y Hilos. Cada entrada con su nombre en el test de `vera-prompt.test.ts`. Antes de tocar `vera/index.ts`, `vera-vertex-eu-migracion.md`.
4. **`F-234` en las demás tablas:** `0051` envolvió 8; quedan **31** (`forum_*` y `watchers_*` primero). Patrón de `0047`/`0051`, con el banco delante. Las tres tablas `ingest_*` nacen ya envueltas.
5. **Lista previa a empujar, las cinco cosas**: `tsc --noEmit`, `vitest` entero, **el banco de esquema (`supabase/tests/run.sh`) si se tocó `supabase/`**, la suite e2e contra `bearingworld-e2e`
   si se tocó un e2e o el arnés (`F-230`) y **`py -m harness.tests.test_checks` si se tocó el contrato de una tarea** (`F-251`). **Mira la CI del push anterior antes de empujar otro.** Nunca `vitest` con un e2e en marcha.
6. Deuda sin fecha: `F-213`.

**Fecha a tener en cuenta:** Cuscinetti Padana deja de estar `ACTIVE` el **20-oct** (cobros resembrados el 10-oct). Solo importa si hay demo o se enseña `ADMIN-02`. `demo_watchers.sql`, resembrada el 6-oct.

## 4 · Decisiones vivas

Todas en `DECISIONES-V1.md`. Las que más muerden al trabajar:

- **Cabeceras del shell: título 28, eyebrow 14, subtítulo 14; padding de toda pantalla `--bw-screen-pad` (24/28/40); el contenido arranca a la izquierda** (nada de `margin: 0 auto`). `screens/onboarding`
  queda aparte salvo `Invitations`. Una pantalla nueva con cabecera o contenedor raíz se añade a `cabeceras.test.ts` / `padding.test.ts`. Mandan sobre el HTML aprobado (`F-209`).
- **`Contactar` de fila (SRCH-01/02)**: con hilo abre el hilo; sin hilo, la ficha con «Primer mensaje» abierto (`autoCompose`). **`DIR-02` enseña el nombre del administrador** (`0058`). `DIR-01` lista solo los países que hay.
- **VERA no describe una interfaz que no está en su guía verificada** (`F-246`). Afirmar un control sin comprobarlo es el riesgo #1 (`CLAUDE.md` §7).
- **`demo_reanchor_freshness()` solo toca las seis de `demo_orgs.sql` y comprueba solo `PUBLISHED`** (`0059`). La séptima, `demo_org_sin_hilo.sql`, se aplica a mano y **no va en `demo_orgs.sql`**.
- Las C5 se hacen contra **producción**, sin pulsar nada que escriba (`F-188`), salvo decisión del PO.
- **Se siembra antes de cada corrida**, con `npm run demo:reset`, no a mano (`F-169`). No repone inventario. Repone las filas de los cinco hilos que falten (`F-248`).
- Series de medición con **n=5**; el corpus **no se toca a mitad de serie**, ni el arnés (`F-225`).
- El scroll propio va **en la plantilla de tarea del Coder** (`F-198`); las pantallas sin shell,
  con `height: 100%; overflow-y: auto` (su raíz cuelga de `#root`, que es `fixed` sin overflow).
- Lo que se afirme sobre privilegios o RLS se comprueba **contra el catálogo** (`F-146`); y **ninguna función de
  `public` la ejecuta `anon`**: lo sin sesión va por Edge Function con `service_role`.
- **En una política, las funciones de sesión van envueltas en `(select …)`** (`0047`, `F-234`): una `SECURITY DEFINER` no se inlina.
- **Fase B (`REG-05` → `06` → `07`)**: solo el ADMIN `REGISTERED`, dentro del shell con VERA `Asistente de registro`; el paso no se guarda;
  `REG-05` y `REG-06` las construye el Coder (sin criptografía), `REG-07` a mano (Plan §4.3). **La frase no sale nunca del navegador** y
  se compara con una huella en memoria de la contraseña (sin huella, se cierra la sesión); fortaleza con zxcvbn sin Levenshtein.
- **El backup de la clave** (`0052`–`0054`): sin `select` ni `update` directos de `encrypted_key_blob`/`key_iv`; el blob solo sale por `begin_key_recovery` (5 por 30 min,
  acertar no reinicia) y `read_pending_key_backup` (solo `REGISTERED`); sustituirlo exige la prueba de la frase anterior (`key_verifier`). Una columna nueva de `members` nace sin permiso.
- **El `localhost` del PO ejecuta tu carpeta de trabajo contra producción**: lo que dejes a medias lo prueba él. Migración aditiva primero, cliente después.
- **ADR-001 en código** (`0048`, `key-backup.ts`): frase en NFC, AAD = id en minúsculas, Argon2id en worker; el estado cambia solo tras abrir
  la copia del servidor. Privada en IndexedDB, no extraíble, y cerrar sesión no la borra. `ensureKeyring(id, estado)` no publica para
  `REGISTERED` ni para quien tiene backup.
- **La importación (`0044`–`0046`)**: una transacción; solo `ACTIVE` (ADMIN o EDITOR) de una `APPROVED`; identidad = referencia + marca + país;
  `Reemplazo total` pasa a `DELETED` lo publicado que no viene; devuelve `inserted` y `updated`. `price` no se importa (E2EE); CSV/TSV/TXT/XLSX; tope 20.000 filas por subida.
- **`INV-01` sin `onPickFile` es la pantalla de su contrato** (subida inerte): el prop lo pasa `App.tsx`.
- **La CD despliega dos funciones sin JWT**: `access-request` y `register-organization`. Su único permiso es el token (la segunda) o el límite por hora (la primera).
- **El enlace de acceso se ve una sola vez** (solo se guarda el hash); perderlo obliga a generar otro y revoca el anterior.
- **Una tarea con un defecto para la corrida y se repite entera** (regla 4); una corrida que escala por causas ajenas no cuenta para la cifra 2 (regla 3).
- **El contrato de una tarea no se toca para otra cosa**: `Login.test.tsx` es de `LOGIN-01`; lo que no es de la tarea va a `*.fuera-de-contrato.test.tsx` (`F-251`). **Un artefacto verde del arnés no lleva `[skip ci]`** (`CLAUDE.md` §1.6).
- **Consulta duplicada: solo se bloquea mientras la anterior está `Pendiente`** (`0060`, PO 12-oct), y `Consultar` abre **un formulario por fila, en cola** (se aparta de la capability cerrada, que decía «sin formulario»).
- **VERA prepara, no envía, y el precio es siempre manual** (PO 12-oct): `preparar_consulta`/`preparar_oferta` no tienen campo de precio, solo con hilo abierto, una cifra mal entendida se rechaza. No prepara contraofertas.

## 5 · Bloqueos y deuda abierta

| | Qué | Quién lo quita |
|---|---|---|
| 🟡 | **`F-226`** · `REG-01` aceptada por el PO el 7-oct; sigue sin logo, sin Google y sin VERA (sin sesión, `F-223`) | Cuando haya proveedor y almacenamiento |
| 🟠 | **`F-233`** · `INV-04`: fases 0–2 hechas salvo MFA del usuario SSO de AWS; clave de AWS sin comprobar por decisión del PO (13-oct); fase 3 hecha y probada con correo real, fase 4 sin hacer (§3.2) | PO + este agente |
| 🟠 | **`F-252`** · un remitente cuyo dominio no publica DMARC ni DKIM no entra por correo. JULSA resuelto; falta avisarlo a otros clientes | Producto |
| 🟠 | **`F-225`** · el e2e del arnés ya no va contra producción (`F-230`); falta releer el hallazgo y cerrarlo · Edge Functions de `bearingworld-e2e` sin desplegar (solo `access-request` v1) | Este agente |
| 🟠 | **Entregable 6** · VERA sigue llamando a `api.anthropic.com`; cupo de Vertex pendiente | Anthropic |
| 🟠 | **Riesgo de salida abrupta del ADMIN** (Q-1): la recomendación de más de un ADMIN tiene que llegar a la interfaz | Producto |
| 🟠 | **Cifras 7 y 8** · solo `SRCH-03` tiene medida limpia (`F-205`) | Una sesión propia por pantalla |
| 🟠 | **`F-251` / `F-250`** · la lista previa a empujar incluye ya las pruebas del arnés (§3.5). `F-250`: otras pantallas del arnés con el mismo patrón de `load` sin guardia, sin revisar | Este agente |
| 🟡 | **VERA no prepara contraofertas ni la respuesta a una consulta concreta, ni nada desde `Comprando`**: solo consulta nueva y oferta directa, con un hilo abierto | Producto |
| 🟡 | **VERA solo conoce la subida de inventario**: en el resto de pantallas dice «no conozco los controles» (§3.3) | Este agente |
| 🟡 | **`F-224`** · dos e2e excusados en las tareas por la cuenta de prueba del PO en Rodamientos Ibéricos; el e2e aislado no la tiene (`F-230`) | Releer y cerrar |
| 🟡 | **Riesgo aceptado `F-192`** · privilegios por defecto anchos. **Se reabre antes de datos reales o de abrir el registro a terceros** | PO (25-sep) |
| 🟡 | **`.xls` binario no se lee** (el `.xlsx` sí, sin formatos: una fecha sale como número): va al fallo de `INV-03` | Producto: pedir `.xlsx` |
| 🟡 | **Una cuenta baneada no se puede reinvitar** con el mismo correo; `contact@nortexsys.com` (`CANCELLED` en JULSA) sigue ocupando ese correo | Al diseñar la reinvitación |
| 🟡 | **Los cobros y la frescura envejecen** y `resetDemo` no los re-ancla | Decidir: verbo `security definer` o repetir a mano |
| 🟡 | **`Suspender manualmente` no pide confirmación** (la spec no la pide) | PO |
| 🟡 | **`F-213`** · no existe `Ajustes`: `Configuración` abre `INVT-01` directamente · **`F-073`** CLI de Supabase en la organización equivocada · Vercel en plan gratuito | Álvaro |
| ⚪ | **No se edita nada de `app/` mientras una corrida está viva** | Mirar el cerrojo antes |

## 6 · Lo que este fichero NO sabe

- **Cómo se ve nada en un navegador desde este agente**: las cabeceras, el padding y la alineación los vio el PO ("todo correcto"); los tests leen CSS, no miden render.
- **Qué contesta VERA fuera de la subida de inventario**: el prompt exige no inventar controles, pero solo se ha probado una pregunta (Inventario).
- **El registro de migraciones de producción para `0059`** guarda una primera versión (sin el filtro `PUBLISHED`); la función viva es la del `.sql`. Un `db push` futuro no la corregiría.
- **Cómo se ve nada de `MSG-03` en un navegador**: las dos tablas (con 30–40 filas o en un panel estrecho), el formulario por fila, el selector de `Crear consulta` y VERA abriendo formularios. Los tests leen DOM y CSS, no miden render.
- **Cómo habla VERA con el prompt nuevo fuera de las 8 preguntas del ensayo**: se probó con el ejemplo de la spec y siete trampas, una vez cada una.
- **Si otras pantallas del arnés tienen `load` sin guardia contra respuestas viejas** (`F-250`).
- **Cuánto dura el ciclo de negociación** entre dos empresas: el ensayo 2 no se cronometró, y no consta que se grabara.
- **Qué ve al entrar el EDITOR `REGISTERED` de cada empresa nueva** (Nakishita y Rey): `ACT-02` con una organización real. Nadie lo ha recorrido.
- **Cuánto tardó la importación de las 29 líneas de Rey**: nadie lo midió. Que su catálogo se encuentra y se negocia desde otra empresa, sí (ensayo 2).
- **Cuánto se gana con `0051`, y cuánto cuestan las 31 políticas sin envolver**: sin medir, aún no hay volumen. Solo se midió que no cambia lo que ve un miembro.
- **Si Argon2id (64 MiB) entra en un móvil modesto**: solo jsdom y el navegador del PO.
- **Si el umbral de zxcvbn (≥ 3) basta** contra un ataque offline al blob: el PO decidió mantenerlo el 9-oct; sigue siendo juicio, no medida.
- **Si la propuesta por sinónimos acierta con archivos reales de distribuidores**: solo con los de prueba, el del PO y el de Rey.
- **Qué hace `app.watchers_evaluate_expirations()` en producción**: no está enganchada a ningún job.
- **Si `billing_confirm_payment`, `billing_suspend_organization` y los verbos de `watcher_*` funcionan desde la pantalla con un cliente real.**
- **25 hallazgos de la revisión adversarial del arnés sin comprobar** (7 de 32 verificados).
- **Qué permisos tiene la clave de AWS de `ingest-email`**: el guion para comprobarlo está escrito, no ejecutado.
- **Cuánta CPU gasta la función dentro de Supabase** con 20.000 filas: se midió en Node; el primer correo grande real lo dirá en los registros.
- **Si un cliente real puede enviar desde su dominio**: entran Gmail y `julsaindustrial.com` (con `_dmarc`); otro dominio sin DMARC ni DKIM no (`F-252`).
- **Cómo se ve `INV-04` en un navegador**: los tests leen DOM y CSS y el e2e comprueba los datos; nadie la ha mirado.

---

*Cierre del Día 38 · 12-oct-2026 · Dirección Técnica, Nortex Systems*
