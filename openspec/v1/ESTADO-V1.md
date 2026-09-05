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

**Día 8 de V1 · 5-sep-2026 · Estado: EN CURSO (4 de 6 puntos del Día 7 hechos; este
fichero se reabrirá al cerrar los que quedan, no es el cierre del día)**

Este fichero se abrió hoy leyendo el cierre del día 7 (`9fe4eac`), con cinco tareas en su
§3 (más una sexta, deliberadamente detrás porque no bloquea nada). **Los puntos 1
(D-7 con el cliente real), 2 (otros caminos de escritura), 3 (`noUnusedLocals`) y 4
(Vercel) están hechos.** Quedan la serie 17 (necesita decisión del PO) y el guardia. Y de
probar D-7 salió una precisión importante que abre un punto nuevo — ver abajo y §6.

**D-7 se encendió en `Nordwälz Lager` (BETA) y las tres vías de escritura de `0023`
pasaron por el cliente real, no por `supabase/tests`.** Con la app corriendo local
(`npm run dev`, sin tocar código), sesión real como `alpha@bearingworld.test`: `SRCH-01`
→ «Consultar seleccionados» sobre una línea de Nordwälz → `create_inquiry` escribió la
`CONSULTA` sin error. Sesión real como `beta@bearingworld.test` (la organización con el
ámbito encendido): abrió el hilo, leyó la `CONSULTA` recién llegada —descifrada, no
«contenido cifrado»— y respondió con un `MENSAJE` → `create_thread_item` escribió sin el
`new row violates row-level security policy` que definía `F-148`. Vuelta a `alpha`:
«Contra-ofertar» sobre la oferta pendiente → `counter_offer` escribió la nueva oferta y
marcó la vieja `Superada por contraoferta`. **Las tres, con el interruptor encendido de
verdad en una de las dos organizaciones, cero errores de consola, verificado después
contra `thread_items`/`thread_item_keys` del proyecto real:** cada elemento nuevo con
exactamente 2 claves, las de los dos únicos miembros —ambos `ORG_METADATA`—, ninguna de
más ni de menos.

**Y lo que esto NO prueba, para no repetir el error de `F-132`:** las dos organizaciones
de e2e tienen **un solo miembro cada una, y ese miembro es el ADMIN**. D-8 («un EDITOR no
ve nada de sus compañeros») no se ha ejercitado —con cero EDITOR en la mesa, el conjunto
de destinatarios con el ámbito encendido y apagado da lo mismo por construcción, así que
esta prueba certifica que **encender el interruptor no rompe la escritura**, no que el
recorte de visibilidad a un EDITOR real funcione. Queda en §6.

**Y ese matiz se hizo más preciso al mirarlo con calma.** `app.caller_bypasses_visibility_
scope()` (`0019`) es `true` si quien llama es ADMIN, sin condición extra — y las dos
organizaciones de prueba solo tienen un miembro, que es ADMIN. Así que ni la prueba de
hoy ni la que encontró `F-148` el 4-sep pasaron nunca por la rama que exige una clave ya
envuelta, que es la rama que de verdad puede romperse. «Probado contra el cliente real»
seguía queriendo decir «probado para un ADMIN» — declarado, no descubierto por sorpresa
en producción. Nuevo punto de §3: falta un EDITOR de verdad.

**El punto 2 se hizo, revisando los tres pendientes y encontrando un cuarto que no
estaba en la lista.** `inventory_lines`, `favorite_distributors` y las dos funciones de
demo no tienen el hueco de `F-148` — políticas autocontenidas o `security definer`/
`service_role` que saltan RLS entera. Y apareció `acceptOffer`/`rejectOffer`
(`offers.ts`), con la misma forma (`update().select()`) que rompía `F-148`, pero sin el
mismo riesgo: actúa sobre una fila YA visible antes del clic, no crea una fila y su
clave en la misma operación. Razonado y comprobado con el cliente real, rechazando de
verdad una oferta de Nordwälz.

**Los puntos 3 (`noUnusedLocals` en los `constraints`, `a385eba`) y 4 (Vercel
redesplegado, `p_quantity` confirmado en el bundle de producción) se hicieron enteros.**
Quedan la serie 17 —con una pregunta para el PO delante, no se lanza sin ella— y el
guardia. El detalle del Día 7 (series 14-16, Q-1, `F-145`-`F-148`, `0022`/`0023`) vive en
`git show 9fe4eac:openspec/v1/ESTADO-V1.md`, no se repite aquí.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-05`, 15:27 UTC al escribir esto |
| Estado de partida de las dos organizaciones de e2e | `select … from organizations o left join members m` sobre `Rodamientos Ibéricos` y `Nordwälz Lager`, proyecto real | Las dos `APPROVED`, `visibility_scope_enabled = false`, **un solo miembro cada una y ese miembro es ADMIN** (`visibility_scope = 'ORG_METADATA'`), con `public_key` publicada |
| **D-7 encendido en `Nordwälz Lager`** | `update organizations set visibility_scope_enabled = true … returning …` | `visibility_scope_enabled = true` confirmado en la fila devuelta |
| La app real arranca sin tocar código | `npm run dev` (vía `.claude/launch.json`, nuevo hoy) + `preview_logs` | Sin errores en el servidor |
| `create_inquiry` con el cliente real, receptor con D-7 encendido | Sesión de navegador como `alpha@bearingworld.test`, `SRCH-01` → «Consultar seleccionados» sobre `6205-2RS · NSK` de Nordwälz | Mensaje de éxito en la UI, cero errores de consola. En la base: `CONSULTA` nueva, thread `11111111…001`, **2 claves** |
| `create_thread_item` con el cliente real, ESCRITO DESDE la organización con D-7 encendido | Sesión como `beta@bearingworld.test` (Nordwälz), abrir el hilo, leer la `CONSULTA` (descifrada, no «contenido cifrado»), responder con `MENSAJE` | Escribió sin el `new row violates row-level security policy` de `F-148`. En la base: `MENSAJE` de Nordwälz, **2 claves** |
| `counter_offer` con el cliente real | Sesión como `alpha`, «Contra-ofertar» sobre la oferta pendiente de Nordwälz | Nueva `OFERTA` (`4,60 €/ud`, `1100 ud`, `3 días`), la vieja pasa a `Superada por contraoferta` con `superseded_by_item_id` apuntando a la nueva. **2 claves** |
| Que los destinatarios de las tres escrituras son EXACTAMENTE los que exige Q-1 | `thread_item_keys` de cada elemento nuevo, cruzado con `members.visibility_scope` | Las tres: los dos únicos miembros, ambos `ORG_METADATA` — ni de más ni de menos |
| Consola del navegador en las tres escrituras | `read_console_messages` (`onlyErrors`) tras cada una | Sin logs — ni un error |
| Que la suite e2e (CI) no rompe con D-7 encendido en `Nordwälz Lager` | El push del commit anterior (`8dc5adc`) disparó CI completo con el interruptor ya puesto; `gh run list` sobre `mvp/bootstrap` | `conclusion: success`. El fixture de Playwright reseteó los `thread_items` del hilo de prueba (efímero, `CLAUDE.md` §10.4) pero **no tocó** `organizations.visibility_scope_enabled` — comprobado después, seguía en `true` |
| `inventory_lines`: ¿algún INSERT/UPDATE depende de una política de SELECT que aún no se cumple? | `0002_inventory.sql`: `inventory_write_own` (using/with check) y `inventory_select_own` | Ninguna referencia a filas creadas después. `inventory_select_own` solo pide `org_id = current_org_id()`, cierto desde el primer instante. `archiveLine`/`deleteLine` ni siquiera encadenan `.select()` |
| `favorite_distributors`: ídem, y el trigger que toca `organizations.favorite_count` de OTRA organización | `0005_lead_time_and_favorites.sql`: políticas + `app.sync_favorite_count()` | Políticas por `member_id = auth.uid()`, sin dependencia circular. El trigger que escribe en la fila de la CONTRAPARTE es `security definer` a propósito — bypasa RLS, comentario explícito en la migración |
| Las dos funciones de demo (`demo_reanchor_freshness`, `demo_state`) | `0015_demo_reset_helpers.sql` | Las dos `security invoker` (el defecto) y **solo concedidas a `service_role`**, que salta RLS entera — no hay política de lectura de la que puedan colgar |
| **Cuarto camino de escritura encontrado, no estaba en la lista: `acceptOffer`/`rejectOffer`** (`app/src/lib/offers.ts:251`) | Lectura de `setOfferState`: `update(thread_items).select(COLUMNS)` — misma forma que rompía `F-148` | Es un `UPDATE`+lectura sobre una fila YA EXISTENTE y ya visible antes del clic (si no lo fuera, el botón no se habría podido pulsar); no crea una fila ni una clave nueva en la misma operación, así que no hay el hueco huevo-y-gallina de `F-148`. Razonado Y probado: `alpha` rechazó una oferta de `Nordwälz` (D-7 encendido) sin error, `estado_oferta` pasó a `Rechazada` en la base |
| **D-7 y el "bypass" del ADMIN, matiz que cambia lo que las pruebas de arriba certifican** | `app.caller_bypasses_visibility_scope()` (`0019:83-96`) | Es `true` si la organización de quien llama tiene el ámbito APAGADO **o si quien llama es ADMIN**. Las dos organizaciones de prueba solo tienen un miembro y es ADMIN — así que TODAS las pruebas de hoy y de ayer (`F-148` incluido) pasaron por la rama del *bypass*, nunca por la rama que exige una clave ya envuelta. La única forma de ejercitar esa rama de verdad es un EDITOR real, que no existe en ninguna de las dos organizaciones |
| `noUnusedLocals`/`noUnusedParameters` en los `constraints` de `MSG-01` | `harness/tasks/MSG-01.json`, `python -m harness.tests.test_checks` | Añadido (`a385eba`). Todas en verde |
| Vercel redesplegado | `vercel --prod` desde `app/`, alias `https://bearingworld.vercel.app` | `HTTP 200`. El bundle servido contiene `p_quantity` — los dos cambios de cliente pendientes (`CONSULTA` 3-sep, `OFERTA` 4-sep) ya están en producción |

**Lo de arriba prueba que encender el interruptor no rompe la escritura PARA UN ADMIN.**
No prueba D-8 ni la rama "clave ya envuelta" de `F-148` para un EDITOR real, porque
ninguna de las dos organizaciones tiene uno — ver §6, que se ha precisado con esto. El
detalle del Día 7 completo (series de medida, Q-1, `F-145`-`F-148`) queda en
`git show 9fe4eac:openspec/v1/ESTADO-V1.md`.

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `F-114`, `F-131`–`F-144` | ✅ ver cierres anteriores en `git show 7abbc33` |
| **`F-145` los botones de página se buscan por su número y un `aria-label` lo sustituye** | ✅ **4-sep · `71b803b`** |
| **`F-146` `revoke … from public` no le quita nada a `anon`** | ✅ **4-sep · `bf2f285`**, `0022`, aplicada y verificada en la base real |
| **`F-147` la frase del estado vacío tiene que ir en UN solo nodo** | ✅ **4-sep · `1c43957`** |
| **`F-148` con el ámbito encendido no se podía escribir nada** | ✅ **4-sep · `0023`**, aplicada y verificada contra el esquema; **5-sep, verificada contra el CLIENTE REAL** (D-7 en `Nordwälz Lager`, las tres vías de escritura) |
| `MSG-01` a 4/4 sin reintentos | 🟡 **4 de 6 sobre el mismo corpus** — serie 15: 3 de 3; serie 16 (réplica exacta): **1 de 3**. Con `n=3` el marcador mide también la suerte |
| Medición del corpus de `MSG-01` con `F-145` ya puesto | ✅ **4-sep · series 15 y 16**, seis corridas. La 15 no encontró nada; **la 16 encontró `F-147`** |
| **`F-147` la frase del estado vacío tiene que ir en UN solo nodo** | ✅ **4-sep · `1c43957`** — sin remedir: la serie 17 sería la primera que lo mide |

### Fundación V1

| Pieza | Estado |
|---|---|
| Índice de la derivación de la lista (entregable 5 + `ADR-002` §5) | ✅ **1-sep · `087962b`** |
| `visibility_scope` (D-4) · `organizations.visibility_scope_enabled` (D-7) · Lista de hilos · `thread_items_select_participant` | ✅ **1-sep y 3-sep · `f5ea8fc`, `804dfe9`** |
| `D-3` (`thread_items.quantity`) | ✅ **COMPLETO** — `CONSULTA` el 3-sep (`0020`), **`OFERTA` el 4-sep (`0021`, `ce78a72`→`098ba19`)** |
| **`thread_public_keys(t_id)`** (reparto de destinatarios) | ✅ **4-sep · `0023`**, aplicada y verificada |
| **`create_inquiry`** (reparto de destinatarios de la CEK) | ✅ **4-sep · `0023`**, con guardia en la base (`app.guard_cek_recipients`) |
| **`F-148` · escribir con el ámbito encendido era imposible desde `0019`** | ✅ **4-sep · `0023`** — tres piezas, sin relajar ninguna política de lectura |
| Resto de la Fundación (entregables 1-3, 6) | 🔴 Sin cambios |

### Corriente B · Fábrica — NO ABIERTA

Sin cambios. Se abre cuando la corriente A publique los contratos de datos.

### Corriente C · Verificación — NO ABIERTA

Sin cambios.

---

## 3 · Qué queda, en este orden

> ~~1. Encender el interruptor de D-7 en una organización de prueba y usar la aplicación de
> verdad.~~ **Hecho 5-sep-2026.** D-7 encendido en `Nordwälz Lager`, las tres vías de
> escritura de `0023` probadas con el cliente real (§1). **Con un matiz que resultó
> importante: las pruebas solo ejercitan la rama del ADMIN** (`caller_bypasses_
> visibility_scope`), porque ninguna de las dos organizaciones tiene un EDITOR — ver §6.
>
> ~~2. Lo que `F-148` deja abierto: si queda algún OTRO camino de escritura que dependa de
> una política de lectura.~~ **Hecho 5-sep-2026.** `inventory_lines`, `favorite_distributors`
> y las dos funciones de demo revisadas — ninguna tiene el hueco de `F-148`. Y salió un
> CUARTO camino que no estaba en la lista original: `acceptOffer`/`rejectOffer` en
> `offers.ts`, con la misma forma (`update().select()`) pero sin el mismo riesgo, porque
> actúa sobre una fila YA visible, no una recién creada. Razonado y probado con el cliente
> real (§1).
>
> ~~3. Opcional y barato: meter `noUnusedLocals` en los `constraints` de la tarea.~~
> **Hecho 5-sep-2026**, `a385eba`. `test_checks` en verde.
>
> ~~4. Vercel sigue sin redesplegar, con DOS cambios de cliente pendientes.~~ **Hecho
> 5-sep-2026.** `vercel --prod` desde `app/`, alias `https://bearingworld.vercel.app` en
> `HTTP 200`, bundle servido confirmado con `p_quantity` dentro (§1).

1. ~~Serie 17, con `F-147` puesto, y la pregunta de `n=3`.~~ **Decidido 5-sep-2026, PO:
   subir las tiradas por serie.** A partir de la 17, una serie mide con **`n=5`**, no
   `n=3` — ver la fila nueva de §4. **Lanzada en segundo plano** (`17a`-`17e`,
   `remedicion-17{a..e}-msg-n5`) tras confirmar el árbol de `app/src/screens/messages/`
   limpio antes de empezar; resultado y coste real se añaden a §1 cuando termine.
2. **Decidir si el guardia de `cruzar_con_el_contrato` aprende a mirar nombres accesibles**
   (`F-145`). Antes de escribirlo hay que medir cuántos avisos en falso daría sobre las
   seis tareas: si canta en todas, se desactiva solo, que es `F-003`. **Este sigue detrás a
   propósito: es el único que no bloquea nada.**
3. **Nuevo, de hoy: añadir un miembro EDITOR real a una organización de prueba** (con su
   `public_key`) para poder probar la rama de `caller_bypasses_visibility_scope()` que
   NINGUNA prueba de hoy tocó — la que exige que la clave ya esté envuelta, que es
   exactamente la que rompía `F-148`. Sin esto, "probado contra el cliente real" sigue
   queriendo decir "probado para un ADMIN".

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **Las series de medición pasan de `n=3` a `n=5`** | 5-sep-2026, PO. La serie 16 (réplica exacta de la 15) dio 1 de 3 donde la 15 dio 3 de 3 sobre el MISMO corpus: con tres tiradas el marcador mide tanto el corpus como la suerte. A partir de la serie 17, cinco tiradas por serie | Esta fila. Aplica desde `remedicion-17a-msg-n5` |
| **ADR-002** | Ámbito de visibilidad por usuario. Diez decisiones, seis invariantes, ocho objetos de esquema — **seis hechos, dos bloqueados por Q-1** | `docs/ADR-002_*.md`, `FUNDACION-V1.md` §2 |
| **Q-1 · CERRADA: buzón abierto + el ADMIN recibe copia de todo** | 4-sep-2026, PO. El elemento entrante llega a **todos** los miembros de la receptora; asume quien responde, sin acción de reparto; y el ADMIN de las dos organizaciones es destinatario criptográfico permanente | `ADR-002` §10 Q-1, D-2 (adenda) |
| **V-2 queda INVERTIDO y V-1/V-6 precisados** | 4-sep-2026, consecuencia directa de Q-1. El ADMIN pasa de «nunca recibe copia por ser ADMIN» a «recibe copia de todo». La promesa interna deja de ser «el compañero no puede verlo» y pasa a «solo tu ADMIN puede» | `ADR-002` §4, §1 (matiz) |
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
| 🟠 | **El riesgo de la salida abrupta ya no se pierde, se CONCENTRA en el ADMIN.** Con Q-1 cerrada, la consecuencia 7.1 desaparece porque el ADMIN conserva copia de todo — y por eso el día que el ADMIN se vaya de golpe o pierda su frase, la organización pierde lo único que quedaba. La recomendación (más de un ADMIN) **tiene que llegar a la interfaz**, no quedarse en el ADR | Producto, cuando se diseñe el alta de miembros |
| 🟠 | **La residencia sigue siendo el entregable con reloj.** Sin cambios hoy: `supabase/functions/vera/index.ts` sigue llamando a `api.anthropic.com`, sin fecha puesta | Álvaro |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. Sin cambios; el MCP sigue llegando | Álvaro: re-loguear y `link` |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial | Álvaro: 20 $/mes |
| 🟡 | **Los worktrees: siguen siendo cinco** (raíz + cuatro), cuarta comprobación seguida | Fuera de sesión, desde la raíz |
| 🟡 | **Un cliente manipulado puede envolver de más hacia la CONTRAPARTE.** El guardia cubre V-1 en el lado del emisor y V-2 en las dos organizaciones, no el conjunto entero: comprobarlo exigiría recalcular el reparto en cada escritura. Declarado en `0023`, no tapado | Sin decidir |
| 🟡 | **El guardia no ve los nombres accesibles** (`F-145`). Cazó catorce huecos de la familia y este se le escapó entero | §3.5 |
| 🟡 | **No se edita nada de `app/` mientras una corrida está viva.** Sin incidentes hoy | Se cumple mirando el cerrojo antes de tocar `app/` |
| ⚪ | ~~`quantity` en `OFERTA`~~ | **Resuelto 4-sep-2026: `0021`, aplicada y verificada** |
| ⚪ | ~~Copia sin trackear de este fichero en la raíz~~ | **Resuelto 4-sep-2026: borrada, y NO ignorada a propósito** |
| ⚪ | ~~`anon` podía ejecutar cinco funciones de `public`~~ | **Resuelto 4-sep-2026: `0022`, con ancla negativa** |
| ⚪ | ~~`0023` no lo ha probado ningún cliente~~ | **Resuelto 5-sep-2026: probado con el cliente real, D-7 encendido en `Nordwälz Lager`, las tres vías de escritura** (matiz: solo la rama del ADMIN, ver §6) |
| ⚪ | ~~Vercel no redesplegó, DOS cambios de cliente pendientes~~ | **Resuelto 5-sep-2026: `vercel --prod`, bundle en producción confirmado con `p_quantity`** |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- ~~Si el 3 de 3 de la serie 15 se sostiene.~~ **Contestado el mismo día: no.** La réplica
  exacta dio 1 de 3. Lo que queda abierto es lo de detrás: **cuántas tiradas hacen falta para
  que este marcador signifique algo**. Seis sobre el mismo corpus dan 4 de 6, y las series de
  tres han oscilado entre 0 y 3 sin que el corpus cambiara.
- **Cuántos huecos de la familia `F-116`–`F-147` quedan.** Dieciséis en ocho días. La serie
  15 fue la primera desde `F-137` que no encontró ninguno **y la 16, sobre el corpus idéntico,
  encontró uno** — así que «una serie limpia» no significa «corpus completo», significa «esas
  tres tiradas no lo tocaron». `F-145` y `F-147` son además de una clase nueva: el Coder no se
  salta el contrato, **elige entre dos formas que el contrato no distingue**.
- **Desde cuándo `anon` podía ejecutar esas cinco funciones, y si alguien lo hizo.** El
  agujero existía desde `0012` (12-ago). **No se han mirado los logs de PostgREST** para ver
  si hubo llamadas anónimas a `org_public_keys` — se puede, y no se ha hecho hoy.
- ~~Si queda algún otro camino de escritura colgando de una política de lectura.~~
  **Contestado el 5-sep: no en `inventory_lines`, `favorite_distributors` ni en las dos
  funciones de demo — pero sí apareció un cuarto camino no listado, `acceptOffer`/
  `rejectOffer`, con la misma forma que `F-148` y sin el mismo riesgo (§1: actúa sobre una
  fila ya visible, no una recién creada).**
- ~~Si el reparto de `0023` sobrevive al cliente real.~~ **Contestado el 5-sep: sí, las
  tres vías de escritura, con D-7 encendido en `Nordwälz Lager` — pero con un matiz que
  vacía buena parte de la respuesta.** `app.caller_bypasses_visibility_scope()` (`0019`)
  es `true` si quien llama es ADMIN, sin mirar nada más; las dos organizaciones de prueba
  solo tienen un miembro y es ADMIN. **Así que TODO lo probado hoy — y también `F-148`
  cuando se encontró el 4-sep — pasó por la rama del *bypass*, nunca por la rama que
  exige una clave ya envuelta**, que es la que de verdad puede reventar. Sigue sin
  probarse con el cliente real, y ahora se sabe con precisión qué falta: un EDITOR
  auténtico (con su `public_key`) en una de las dos organizaciones, o en una tercera
  desechable. Nuevo punto 3 de §3.
- **D-8 («un EDITOR no ve nada de sus compañeros») sigue sin probarse**, por el mismo
  motivo de arriba: sin un EDITOR real no hay a quién negarle la vista.
- **Cuántos ADMIN va a tener de verdad una organización.** Q-1 hace del ADMIN el único
  depositario de todo lo que sus editores dejen de tener, y hoy las dos organizaciones con
  miembros tienen **exactamente uno** (comprobado el 4-sep y otra vez el 5-sep contra
  `members`). Con un solo ADMIN, la consecuencia 7.1 no se ha resuelto: se ha mudado de
  sitio.
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
antes de darlo por bueno, y la CI job a job antes de escribir esto. Y luego el día siguió
igualmente: la serie 15 entera se corrió DESPUÉS de este cierre y este fichero se reescribió
para meterla. Cerrar no es terminar.**

⚠ **Y este fichero se escribe en `openspec/v1/ESTADO-V1.md`, no en la raíz del repo.** La
copia de la raíz se borró el 4-sep y **no** está en `.gitignore`: si reaparece, saldrá como
`??` en `git status`, que es como se descubrió. Comprobar `git status --short` después de
escribir, no solo antes.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`docs/ADR-002` §10 (Q-1) ENTERA**, si vas a tocar mensajería o reparto de claves. Sin
   esa decisión no se escribe SQL de reparto de CEK.
3. **`openspec/v1/FUNDACION-V1.md`** si vas a tocar el hito. Actualizado hoy: `quantity`
   completa y las dos filas bloqueadas.
4. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**.
5. **`docs/ADR-001`** si vas a tocar criptografía.
6. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
7. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
8. **`findings-register.md`** nunca de corrido: por identificador. Hoy: `F-145` y `F-146`.

---

*Día 8 de V1 · 5-sep-2026, 17:51 UTC — EN CURSO, no cerrado: quedan tres puntos de §3
(serie 17 con decisión del PO pendiente, la del guardia, y el EDITOR de prueba nuevo de
hoy) y el ritual de §7 no se ha corrido. De los cinco puntos que dejó el Día 7, cuatro
están hechos hoy · fecha leída de la máquina (`date -u`) · estado verificado contra el
proyecto real `troxminloxkjwihwfevs` (`update organizations`, `thread_items`/
`thread_item_keys` tras cada escritura, `pg_proc`/`0019` para `caller_bypasses_
visibility_scope`), contra sesiones de navegador reales como `alpha@bearingworld.test` y
`beta@bearingworld.test`, contra `python -m harness.tests.test_checks`, y contra el bundle
servido en `https://bearingworld.vercel.app` tras `vercel --prod` — no contra otro
documento · Dirección Técnica, Nortex Systems*
