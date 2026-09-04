# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io` en
`mvp/bootstrap`; si te lanzan en un worktree `claude/…`, **opera sobre esa ruta con paths
absolutos.**

> ⚠ **Esa línea se gana su sitio: NO la reescribas al sobrescribir este fichero, ni siquiera
> para «mejorarla».** Ha pasado **cuatro veces** (`F-108` las tres primeras). La cuarta fue el
> 25-ago y la causó este documento: alguien cambió la instrucción —*«opera sobre esa ruta»*—
> por una comprobación —*«comprueba que tiene harness/»*—, y el agente detectó el problema y
> se quedó parado sin saber qué hacer. **Una instrucción resuelve; una comprobación solo
> avisa.**
>
> **Y la otra mitad, que nunca se arregló:** el 25-ago `git worktree list` mostraba **tres
> worktrees prunables** anclados a `43bb222`, viviendo en `openspec/mvp/.claude/worktrees/`.
> Que `.gitignore` los ignore desde el día 15 no impide que se creen. Dos cosas:
> **`git worktree prune`** limpia los registros muertos, y **lanzar Code desde la raíz del
> repo y no desde `openspec/mvp/`** parece cortar la causa — hipótesis por confirmar, porque
> es ahí donde aparecen.
>
> **30-ago, comprobado: `git worktree prune` NO los quita.** Los tres siguen ahí y sus
> directorios existen, así que no hay ningún registro muerto que limpiar — `prune --dry-run`
> no dice nada. Haría falta `git worktree remove`, y uno de los tres es la sesión desde la
> que se escribe esto. La primera mitad de la receta era falsa; la segunda sigue sin probar.
>
> **1-sep, 3-sep y 4-sep, comprobado tres veces más, mismo resultado:** los mismos cuatro
> prunables de siempre (`bearing-io-mvp-estado-f2911a`, `bearing-mvp-bootstrap-3bc0fc`,
> `dia-14-correcciones-mvp-8160b9`, `dia-4-f131-pending-003608`), todos anclados a `43bb222`
> —anterior a todo el trabajo de V1—, más la raíz al día (hoy en `71b803b`). Cuatro jornadas
> seguidas sin que cambie ni uno. **La hipótesis de lanzar desde la raíz sigue sin probarse.**
>
> **Y la SEGUNDA copia de este fichero en la raíz del repo, hallada el 3-sep: resuelta el
> 4-sep-2026.** Se comparó con la trackeada antes de tocarla: era la versión de ayer **menos**
> los párrafos que hablaban de sí misma, o sea que no tenía ni una línea propia. **Borrada**,
> con copia de seguridad fuera del repo. **Y NO se ha metido en `.gitignore`, a propósito:**
> ignorarla la haría invisible en `git status`, y fue justamente aparecer como `??` lo que
> hizo que alguien la descubriera. Si alguna herramienta la recrea, se quiere ver.

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.**

> **Qué es este fichero.** El relevo diario de V1. Se sobrescribe al cierre de cada día
> operativo. Lo primero que lee cualquier sesión nueva, humana o agente.
>
> **Lo permanente NO vive aquí:** el plan está en `openspec/v1/`, las decisiones de
> arquitectura en `docs/ADR-*.md`, el acta del MVP en `openspec/mvp/CIERRE-MVP.md`, y el
> histórico en git y en `findings-register.md`.

---

## ⚠ Las cinco reglas de este fichero

Salen de errores cometidos, no de teoría. Cada una tiene su cadáver detrás.

**1 · Cita, no parafrasees.** Los valores de estado y las asignaciones de modelo se copian
del documento cerrado **con el puntero al lado** (`F-012`).

**2 · Un estado que este fichero afirme se comprueba EL DÍA que se escribe, contra el
código o contra la base — no contra otro documento.** El 25-ago se descubrió que tres
documentos llevaban **diez días** diciendo que `B-008`, `B-009` y `B-010` estaban
pendientes cuando se habían cerrado el 12-ago. **Y el 30-ago mordió dos veces más:** la §4
afirmaba como decisión cerrada que las filas inválidas de `F-121` «se marcan, no se
borran», y **no se habían marcado** (`F-129`); y la §2 daba la Fundación V1 por «no
empezada» **comprobándolo contra un `ls`**, cuando uno de sus seis entregables está entero
desde la primera migración (`F-132`). **Comprobar el continente no es comprobar el
contenido. Ningún documento es fuente de verdad sobre el código. Este tampoco.**

> **Y el 4-sep la regla se ganó una hermana, `F-146`:** comprobar el CÓDIGO tampoco basta
> cuando la plataforma añade cosas por su cuenta. Las migraciones decían `revoke execute …
> from public` desde `0001` y lo que la base tenía puesto era otra cosa. **Lo que se afirme
> sobre privilegios, RLS o permisos se comprueba contra `pg_proc` / `pg_policies` / `pg_
> default_acl`, no contra el `.sql` que se escribió.**

**3 · La fecha se lee de la máquina, nunca de memoria.** El día 14 del MVP se fechó a sí
mismo un día por delante y esa hora de diferencia es exactamente lo que ocultó `F-109`
durante dos jornadas. El 25-ago volvió a pasar por el otro lado: tres documentos se
fecharon tres días atrás. **`date -u` antes de escribir la cabecera.**

**4 · Este fichero se cierra CUANDO SE ACABA, no cuando parece que se acaba.** El día 3 se
cerró a las 12:33 y el trabajo siguió hasta las 13:45. **Y el día 4 lo repitió, con la
regla ya escrita delante:** se cerró a las 11:22 y siguió hasta las 12:31, con nueve
commits más y seis hallazgos nuevos. Escribir la regla no la cumple.

**5 · Una evidencia que solo existe si alguien se acuerda de producirla no es evidencia:
es suerte.** El 30-ago se abrió un hueco en `.gitignore` para versionar los logs de
corrida, con el argumento de que eran la evidencia de la primera medida con `n>1` del
proyecto. **Las tres corridas de esa medida no dejaron ni un log**, porque `run.py` no lo
escribía: lo escribía quien lanzaba, redirigiendo, y quien lanzó puso un `| tail -45`
delante (`F-136`). La regla protegía un fichero que nadie garantizaba que existiera.
**Antes de confiar en una evidencia, mira quién la produce y qué pasa si ese alguien se
distrae.**

---

**Día 7 de V1 · 4-sep-2026 · Estado: VERDE**

Este fichero se abrió hoy leyendo el cierre del día 6 (`7abbc33`), con seis tareas en su
§3. **Dos se hicieron enteras, una la paró el PO a propósito, una era suya y sigue suya, y
por el camino salieron dos hallazgos nuevos —uno de ellos de seguridad— que no estaban en
ninguna lista.**

**El punto 1 se hizo y por fin midió lo que decía medir.** Serie `14a`/`14b`/`14c`, la
primera con `F-143` **y** `F-144` en el corpus desde el principio: **2 de 3 a 4/4 al primer
intento** (`14b` y `14c`), contra 1 de 3 en la serie 13. `14a` necesitó un segundo intento
por un hueco nuevo (`F-145`). $0,2221 las cuatro filas de CSV.

**Los puntos 2 y 3 se pararon antes de escribir una línea de SQL, y esa es la noticia del
día.** `thread_public_keys(t_id)` tenía que «devolver el conjunto que fija D-1», y al ir a
escribirlo apareció que **`ADR-002` no dice a quién se envuelve la CEK de un elemento que
ENTRA en una organización con el ámbito encendido**: en el primer contacto no participa
nadie allí todavía. Envolver para todos deja a cada EDITOR del distribuidor leyendo toda
consulta entrante y obliga a precisar `V-1`; no envolver para nadie deja la consulta
ilegible e incontestable, irreparable; que el emisor elija destinatario expone la plantilla
de la contraparte y es interfaz nueva. **Y una salida intermedia que parecía obvia está
cerrada por el esquema:** un `MENSAJE` no puede llevar `responds_to_item_id`
(`thread_items_shape_chk`, `0003:148`), así que **no hay ancla de conversación** dentro de
un hilo compartido (`ADR-002` §6). Se preguntó al PO y decidió **parar y decidirlo con el
ADR delante**. Queda escrito como **Q-1** en `ADR-002` §10 —que hasta hoy decía
«Ninguna»— con las cuatro salidas, lo que cada una cuesta y la señal que apunta a la
primera (§5 no lista `org_public_keys` como objeto a cambiar, y es la función del primer
contacto).

**El punto 4 se hizo entero, y «las dos vías de OFERTA» eran una.** `0021_counter_offer_
quantity.sql` le da `p_quantity` a `counter_offer`. `create_thread_item` no lo lleva y no
le falta: **rechaza `OFERTA`** (`0012:185`, MSG-03 fuera del MVP) y solo crea `MENSAJE`,
que tiene `quantity is null` obligatorio. Y la cantidad **no se hereda** de la oferta
anterior, a diferencia de `part_number` y `brand`: una contraoferta puede cambiarla, y
copiar la vieja escribiría **en claro** una cifra que el ciphertext desmiente — un ADMIN
leyendo D-2 vería 500 donde la oferta dice 300. `NULL` dice «no se sabe»; 500 dice una
mentira comprobable.

**Y el hallazgo que nadie buscaba, `F-146`.** Verificando —por rutina— que `0021` había
dejado **una sola** firma de `counter_offer`, la consulta a `pg_proc.proacl` devolvió de
paso quién puede ejecutarla: `postgres, anon, authenticated, service_role`. **El
`revoke execute … from public` que todas las migraciones llevan desde `0001` revoca el
pseudo-rol PUBLIC, y `anon` no recibe su permiso por ahí:** Supabase tiene *default
privileges* en el esquema `public` que le dan `EXECUTE` sobre cada función nueva al
crearla. **Cinco de las siete funciones de `public` estaban abiertas a `anon`**, y se
comprobó ejecutándolo, no razonándolo: `set local role anon` + `org_public_keys(<org>)`
devolvió una fila con su clave pública. Arreglado el mismo día (`0022`), con la mitad que
más duele arreglada también: **el banco de pruebas local era más ESTRICTO que producción**
—no copiaba esas *default privileges*— así que cualquier aserto sobre esto habría pasado
**en vacío**.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-04`, 09:08 UTC al escribir esto |
| `MSG-01`, serie `14a`/`14b`/`14c` (corpus con `F-143` y `F-144` desde el principio) | Los cuatro `attempt_N.json` y las cuatro filas de `harness-metrics.csv` | **2 de 3 a 4/4 al primer intento.** `14b` y `14c` limpias; `14a` verde en 2 intentos. Cero recurrencias de `F-143` y `F-144` en las tres. $0,2221 en total |
| `F-145` es hueco NUEVO y no una recurrencia | Los `attempt_1.json` de `09c`, `10a`, `10b`, `12b` y `13a` — las corridas anteriores donde esos dos tests de paginación salen en rojo | Ninguna tiene `aria-label` sobre los botones de página; `12b` y `13a` ni llegaban a los tests (fallaban en `typecheck`) |
| `F-145` corregido, y sin reintroducir el mecanismo de `F-140` | `python -m harness.tests.test_checks`, corrido ANTES de commitear | «Todas en verde» a la primera. El texto se añadió al FINAL del `component_api` de `Messages.tsx`, sin tocar los dos anclajes de truncado |
| Que el guardia de `cruzar_con_el_contrato` NO habría cazado `F-145` | Corrido sobre `MSG-01` el mismo día | 0 errores, 16 avisos, **ninguno** sobre `name: '2'`. No lo ve, y enseñárselo es pieza aparte (`F-003`: un guardia que grita en falso se desactiva) |
| El hueco de Q-1: `ADR-002` no dice quién recibe la CEK en el lado que ENTRA | Lectura completa de `ADR-002` (D-1, D-2, D-7, D-8, V-1, V-2, §5, §6) **antes** de escribir SQL | Ni una línea sobre el receptor sin participantes. Y §5 **no** lista `org_public_keys`, que es la función del primer contacto |
| Que no hay ancla de conversación para un `MENSAJE` | `thread_items_shape_chk` en `0003:148` y su reedición en `0020:44` | `MENSAJE` exige `responds_to_item_id is null`. Confirmado: cualquier respuesta a Q-1 que necesite saber a qué conversación pertenece un mensaje exige antes cambiar el esquema |
| `0021_counter_offer_quantity.sql` | Local: `supabase/tests/run.sh` (fase 1) con cuatro asertos nuevos —cantidad en claro, NO herencia de la anterior, negativa bloqueada, una sola firma— y `npm test`/`npm run typecheck`. Remoto: `pg_proc` por el MCP | Todo verde. `npm test`: **642 pasan, 23 saltadas** (mismo total: el aserto nuevo vive dentro de un test que ya existía). Remoto: **una sola firma** de `counter_offer`, la de cinco parámetros |
| `F-146`: `anon` podía ejecutar cinco funciones de `public` | `pg_proc.proacl` del proyecto real, y **la llamada de verdad**: `begin; set local role anon; select … from public.org_public_keys('b2000000-…-0002')` | **1 fila, con `public_key`.** Las dos funciones a salvo eran las de `0015`, que nombran a `anon` en su `revoke` |
| Que lo que se filtraba NO incluía datos personales ni respaldo de clave | Las tres columnas que devuelve `org_public_keys` (`0014` §1) y la definición de `members` (`0001:73-81`) | `member_id`, `org_id`, `public_key`. Ni `email`, ni `full_name`, ni los cuatro campos del respaldo. El primer invariante de ADR-001 sigue en pie |
| Que `anon` no puede enumerar organizaciones para conseguir el UUID | La misma llamada sacando el UUID por subconsulta, como `anon` | 0 filas — la política de `organizations` no le devuelve nada. Hace falta conocer el UUID por otra vía |
| `0022_revoke_anon_execute.sql`, **con ancla negativa** | Sacando `0022` de la carpeta y corriendo la suite entera | **Falla con `EXIT=3`** nombrando exactamente las cinco: `counter_offer, create_inquiry, create_thread_item, org_public_keys, thread_public_keys`. Con `0022` puesta, verde |
| `0022` aplicada de verdad | `pg_proc.proacl` y `pg_default_acl` del proyecto real, tras aplicar | Las cinco sin `anon`; `authenticated` intacto en las cinco; la *default privilege* de `postgres` ya sin `anon` (la de `supabase_admin` no se toca: es de la plataforma) |
| Que revocar a `anon` no rompe la aplicación | `grep` de `.rpc(` en `app/src`, `app/e2e`, `app/scripts` y `supabase/functions` | Las cinco llamadas viven en `keys.ts` y `thread-detail.ts`, todas tras iniciar sesión. Los scripts de demo van con `service_role` |
| Las dos migraciones están en el proyecto real | `list_migrations` por el MCP | `20260904075151 · 0021_counter_offer_quantity` y `20260904085916 · 0022_revoke_anon_execute` |
| La CI del push de hoy, job a job | `gh run view 33856519511 --json jobs` sobre `71b803b` (que lleva los seis commits) | Las **cuatro** en verde: Esquema, App, Arnés, Playwright |
| La copia sin trackear de este fichero en la raíz | `diff` contra `git show HEAD:openspec/v1/ESTADO-V1.md` antes de borrarla | Era la de ayer **menos** los párrafos sobre sí misma: ni una línea propia. Borrada, con respaldo fuera del repo. Ver la caja de arriba |
| Los worktrees | `git worktree list` | Los mismos cuatro prunables + la raíz, hoy en `71b803b`. Cuarta comprobación seguida sin un cambio |
| Estado del árbol al cerrar | `git status` | Limpio salvo `openspec/design-gui/Ingles/`, sin tocar hoy y ajeno a esta sesión |
| Artefactos crudos del Coder (`app/src/screens/messages/*`) | `git status` tras cada corrida | Descartados con `git checkout --` antes de cada commit, tres veces (`14a`, `14b`, `14c`) |

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-144` | ✅ ver cierres anteriores en `git show 7abbc33` |
| **`F-145` los botones de página se buscan por su número y un `aria-label` lo sustituye** | ✅ **4-sep · `71b803b`** |
| **`F-146` `revoke … from public` no le quita nada a `anon`** | ✅ **4-sep · `bf2f285`**, `0022`, aplicada y verificada en la base real |
| `MSG-01` a 4/4 sin reintentos | 🟡 **2 de 3** en la serie 14 (`14b`, `14c`), contra 1 de 3 en la 13 |
| Medición del corpus de `MSG-01` con `F-145` ya puesto | 🔴 Sin medir — la serie 14 es la que ENCONTRÓ `F-145`; la 15 sería la primera que lo mide |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5) | ✅ **1-sep · `087962b`** |
| `visibility_scope` (D-4) · `organizations.visibility_scope_enabled` (D-7) · Lista de hilos · `thread_items_select_participant` | ✅ **1-sep y 3-sep · `f5ea8fc`, `804dfe9`** |
| `D-3` (`thread_items.quantity`) | ✅ **COMPLETO** — `CONSULTA` el 3-sep (`0020`), **`OFERTA` el 4-sep (`0021`, `ce78a72`→`098ba19`)** |
| **`thread_public_keys(t_id)`** (reparto de destinatarios) | ⛔ **BLOQUEADA por Q-1** (`ADR-002` §10), decisión del PO del 4-sep |
| **`create_inquiry`** (reparto de destinatarios de la CEK) | ⛔ **BLOQUEADA por Q-1**, y depende de la de arriba |
| Resto de la Fundación (entregables 1-3, 6) | 🔴 Sin cambios |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué toca mañana, en este orden

1. **Q-1 de `ADR-002` §10, con el ADR delante.** Es lo que el PO dejó parado hoy y lo que
   desbloquea las dos últimas filas rojas de §5. Las cuatro salidas están escritas con lo
   que cuesta cada una; no hace falta reconstruir el análisis, solo decidir. **Media hora
   de lectura vale más que media pieza escrita.**
2. **`thread_public_keys(t_id)` y `create_inquiry`**, en cuanto Q-1 esté cerrada. El lado
   del emisor no depende de la respuesta y está claro desde hoy: con el ámbito encendido,
   la CEK deja de envolverse para los compañeros de quien escribe.
3. **Remedir `MSG-01` (serie 15, `n=3`) con `F-145` ya en el corpus.** La 14 es la que lo
   encontró, así que el 2 de 3 de hoy **no** es la medida del corpus completo. ~$0,07 por
   tirada, tres tiradas.
4. **Vercel sigue sin redesplegar, y ahora arrastra DOS cambios de cliente**, no uno:
   `p_quantity` de `CONSULTA` (3-sep) y el de `OFERTA` (hoy). La base acepta las dos y
   producción no manda ninguna (`CLAUDE.md` §10.2).
5. **Decidir si el guardia de `cruzar_con_el_contrato` aprende a mirar nombres accesibles**
   (`F-145`). Antes de escribirlo hay que medir cuántos avisos en falso daría sobre las
   seis tareas: si canta en todas, se desactiva solo, que es `F-003`.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. Diez decisiones, seis invariantes, ocho objetos de esquema — **seis hechos, dos bloqueados por Q-1** | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **Q-1 se decide con el ADR delante, no sobre la marcha** | 4-sep-2026, PO. El reparto de la CEK en el lado que RECIBE no lo dice el ADR, y las salidas posibles cambian el producto, no solo el SQL | `ADR-002` §10 |
| **`quantity` NO se hereda de la oferta anterior** | 4-sep-2026. Copiar la cantidad vieja escribiría en claro una cifra que el ciphertext puede desmentir. `NULL` dice «no se sabe» | `0021` §2 |
| **D-7 se implementa con interruptor, no se difiere** | 3-sep-2026, PO. `organizations.visibility_scope_enabled`, apagado por defecto | `0019`, adenda en `ADR-002` D-7 |
| **Lo que se afirme sobre privilegios se comprueba contra el catálogo, no contra el `.sql`** | 4-sep-2026, `F-146`. La plataforma añade concesiones que ninguna migración escribió | `0022`, regla 2 de este fichero |
| **El banco de pruebas tiene que ser tan permisivo como producción, no más estricto** | 4-sep-2026, `F-146`. Un local más estricto esconde agujeros reales en vez de cazarlos | `00_auth_stub.sql` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa» | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. Sigue sin desplegarse — entregable 6, sin fecha | Plan §4.2, `FUNDACION-V1.md` §1 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código. **Hoy se usó dos veces** (Q-1 y `F-146`) | Plan, Anexo B |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió | 25-ago · `F-129` |
| **El guardia AVISA, no bloquea** | Vale para roles, literales y roles estructurales. Es una **medida**, no una preferencia | `F-127`, `F-130`, `F-131` |
| **`C2` corre SIEMPRE la suite e2e ENTERA** | `D-09-03 (a)`, 12-ago | `test_runner.py` |
| **Un verde con excusas se MARCA en el CSV** | 30-ago | `F-134` |
| **Los logs de corrida se versionan, y los escribe la corrida** | 30-ago | `F-115`, `F-136` |
| **El corpus NO se toca a mitad de serie** | 4-sep-2026. `F-145` se declaró después de `14c`: cambiarlo antes habría hecho que las tres corridas midieran corpus distintos | serie 14 |
| **Un artefacto crudo del Coder no se commitea sobre una pantalla ya revisada** | Aplicado tres veces más hoy | `CLAUDE.md` §1.6 |
| **Lo que el contrato exige, la tarea lo dice** | **Quince veces en ocho días.** La vía ha sido siempre la misma: declararlo en `component_api`, sin tocar ni un aserto | `F-116`…`F-145` |
| **El 57 a 1 se acepta, sin acción** | 1-sep-2026, PO | `F-113` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| ⛔ | **Q-1 de `ADR-002` §10 bloquea las dos últimas filas rojas de §5.** No es deuda: es una decisión pendiente, tomada a propósito | Álvaro (PO), con el ADR delante |
| 🟠 | **La residencia sigue siendo el entregable con reloj.** Sin cambios hoy: `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com`, sin fecha puesta | Álvaro |
| 🟡 | **Vercel no redesplegó, y ahora son DOS cambios de cliente sin desplegar** (`quantity` de `CONSULTA` y de `OFERTA`) | Redesplegar `app/` (manual, `CLAUDE.md` §10.2) |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: siguen siendo cinco** (raíz + cuatro), cuarta comprobación seguida | Fuera de sesión, desde la raíz |
| 🟡 | **El guardia no ve los nombres accesibles** (`F-145`). Cazó catorce huecos de la familia y este se le escapó entero | §3.5 |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| ⚪ | ~~`quantity` en `OFERTA`~~ | **Resuelto 4-sep-2026: `0021`, aplicada y verificada** |
| ⚪ | ~~Copia sin trackear de este fichero en la raíz~~ | **Resuelto 4-sep-2026: borrada, y NO ignorada a propósito** |
| ⚪ | ~~`anon` podía ejecutar cinco funciones de `public`~~ | **Resuelto 4-sep-2026: `0022`, con ancla negativa** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Si el marcador de `MSG-01` sube con `F-145` puesto.** El 2 de 3 de hoy se midió sobre
  el corpus que todavía no lo tenía. Hasta la serie 15, es una expectativa.
- **Cuántos huecos de la familia `F-116`–`F-145` quedan.** Quince en ocho días, y cada
  serie desde `F-137` ha encontrado al menos uno nuevo. `F-145` además es de una clase que
  no se había visto: el Coder **aplicó** una convención (accesibilidad) en vez de saltársela.
  No hay forma de saber si la 15 sale limpia sin medir.
- **Desde cuándo `anon` podía ejecutar esas cinco funciones, y si alguien lo hizo.** El
  agujero existía desde `0012` (12-ago). **No se han mirado los logs de PostgREST** para ver
  si hubo llamadas anónimas a `org_public_keys` — se puede, y no se ha hecho hoy.
- **Cuántas funciones de `public` van a nacer fuera de nuestras migraciones.** `0022` cierra
  la *default privilege* del rol `postgres`; la de `supabase_admin` sigue abierta y es de la
  plataforma. Si algún día la plataforma crea una función en `public`, nacerá con `anon`.
- **Si `quantity` en `OFERTA` se pinta en alguna pantalla.** La columna existe y la escribe
  `counter_offer`, pero **nadie la lee todavía** — ni MSG-02, ni el plano de metadatos de
  D-2, ni VERA. Es exactamente el estado en el que estuvo `visibility_scope` dos días.
- **Cuánto de la varianza entre corridas es el modelo y cuánto el prompt.** Sin datos nuevos
  hoy: las tres corridas de la serie 14 no tuvieron ninguna variación ordinaria que explicar.
- **Por qué la API se cuelga en la segunda tarea de una tanda y nunca en la primera.**
  Sin datos nuevos hoy.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas. **Y comprueba
   el contenido, no el continente** (`F-132`). **Si la afirmación es sobre permisos o
   privilegios, la fuente es el catálogo de la base, no el `.sql`** (`F-146`).
3. **Revisar §2 contra el código**, no contra el §2 de ayer.
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

⚠ **Y el paso cero, que es la regla 4: no cierres hasta que se acabe.** El día 3 se cerró a
las 12:33 y siguió hasta las 13:45. El día 4 se cerró a las 11:22 y siguió hasta las 12:31.
El día 6 lo cumplió dos veces corriendo `test_checks.py` antes de commitear. **El día 7 lo
cumplió tres veces: `test_checks` antes de commitear `F-145`, el ancla negativa de `0022`
antes de darlo por bueno, y la CI job a job antes de escribir esto.**

⚠ **Y este fichero se escribe en `openspec/v1/ESTADO-V1.md`, no en la raíz del repo.** La
copia de la raíz se borró el 4-sep y **no** está en `.gitignore`: si reaparece, saldrá como
`??` en `git status`, que es como se descubrió. Comprobar `git status --short` después de
escribir, no solo antes.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`docs/ADR-002` §10 (Q-1) ENTERA**, si vas a tocar mensajería o reparto de claves. Es
   lo primero de §3 y sin esa decisión no se escribe SQL de esas dos filas.
3. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado hoy: `quantity`
   completa y las dos filas bloqueadas.
4. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**.
5. **`docs/ADR-001`** si vas a tocar criptografía.
6. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
7. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
8. **`findings-register.md`** nunca de corrido: por identificador. Hoy: `F-145` y `F-146`.

---

*Día 7 de V1 · 4-sep-2026 (09:08 UTC) · fecha leída de la máquina (`date -u`) · estado
verificado contra el código de `mvp/bootstrap`, contra `pg_proc`/`pg_default_acl`/
`list_migrations` del proyecto `troxminloxkjwihwfevs`, contra una llamada real como `anon`,
contra la CI job a job de `71b803b` y contra la salida de tres corridas pagadas — no contra
otro documento · **dos paradas a tiempo: Q-1 antes de escribir SQL, y `F-146` antes de dar
`0021` por terminada** · Dirección Técnica, Nortex Systems*
