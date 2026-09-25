# Día 15 de V1

**Día 15 de V1 · trabajo 11-sep-2026, cierre redactado 13-sep-2026 · Estado: CERRADO**

> **EL DÍA EN OCHO LÍNEAS.**
>
> 1. **Sesión nueva, arrancando exactamente donde dejó el Día 14:** el paso 3 de
>    `UMBRAL-FABRICA-V1.md` §7, las tres tareas en formato fijo.
> 2. **`F-160`, cazado antes de gastar un token.** `--seco` escalaba en FALSO en las SEIS
>    tareas del corpus —`DIR-01` incluida, y confirmado también contra `SRCH-01`, de hace
>    semanas— desde que `F-152` sumó `primer_intento_limpio` al CSV sin que `dry_run.py` lo
>    supiera. Cerrado el mismo día.
> 3. **`DIR-01` escrita, con sus tests, `--seco` limpia.** Precondición descubierta y resuelta
>    primero: "Empresas" no tenía ninguna ruta real en `App.tsx` a la que el e2e pudiera
>    llegar.
> 4. **`ADMIN-01`, y con ella un hallazgo de arquitectura, no solo de esquema.** El Operador
>    no encaja en `AppShell` —nav de cinco ítems propios y acento brass (spec §2), un
>    `OperatorProfile` sin organización—. Nuevo `OperatorShell.tsx`, sin tocar `AppShell.tsx`
>    ni sus 147 líneas de tests.
> 5. **Segundo hallazgo de `ADMIN-01`: el mock promete un email que nadie envía.** Aprobar y
>    Rechazar no disparan ningún correo —no hay proveedor configurado en todo el proyecto—, y
>    el texto de confirmación se corrigió para no afirmarlo (mismo principio que `F-100`).
> 6. **`FORO-01` escrita**, la más simple de las tres —un solo fichero, misma forma que
>    `PANEL-01`—. Con esto, el paso 3 del §7 queda completo: nueve tareas en el corpus, las
>    tres del H1 listas para correr.
> 7. **La corrida real sigue sin poder pasar en esta sesión.** `DEEPSEEK_API_KEY` vive en el
>    entorno local del PO (`C:\Users\admin\...`), nunca en esta sesión remota —comprobado con
>    `uname`/`mount` contra el propio contenedor, no supuesto ni discutido de oídas—. El paso
>    5 del §7 (las tres corridas, C5 y el veredicto) queda para una sesión con esa clave a
>    mano.
> 8. **Este fichero se cierra dos días después de escribirse el trabajo**, por una
>    interrupción de la conversación, no porque el día se alargara —regla 4 de este fichero,
>    y va anotado porque es justo el tipo de desfase que la regla 3 pide no maquillar.
>
> **Lo que toca a continuación no es trabajo de esta sesión:** las tres corridas, cada una en
> el entorno local del PO y en su propia sesión limpia. Ver §3.

**`F-160`, en detalle.** `harness/tests/dry_run.py` comprueba desde el día 4 que ninguna fila
del CSV quede marcada como escalada con `[f for f in filas if ",si," in f]` —un substring de
la LÍNEA ENTERA—. El 10-sep (`F-152`) `primer_intento_limpio` se sumó a `metrics.COLUMNS`
justo detrás de `corrida` y delante de `resultado`, y una corrida limpia al primer intento
escribe esa columna en `si` aunque `escalado_a_humano` sea `no`: la fila sale
`...,no,-,-,si,PASA...` y el substring la encuentra igual. Reproducido primero contra
`SRCH-01.json` para confirmar que no era nada de `DIR-01`: el propio arnés llevaba un mes
roto en cuanto `metrics.COLUMNS` creció. Arreglado con `_columna()`, que lee el CSV con el
módulo `csv` de la librería estándar y busca por NOMBRE, no por substring. Verificado con
`python -m harness.tests.dry_run` (los tres escenarios A/B/C en verde) y con `--seco` sobre
`DIR-01`/`ADMIN-01`/`FORO-01` y de nuevo sobre `SRCH-01`. Misma familia que `F-033`/`F-129`:
un cambio en el contrato de columnas de un fichero compartido rompió una comprobación en
otro que nadie reconectó.

**`DIR-01`, escrita cruzando la tarea con lo que el repo YA tenía, no solo con la spec.**
`harness/tasks/DIR-01.json`: `style_reference` es `ResultsTable.tsx` —mismo patrón de
cabecera ordenable con un `<button>` dentro del `<th>`—, `data_layer` es `directory.ts`
—entregada el Día 14—, y `component_api` fija cada literal verbatim, con cuidado explícito de
no confundir el `...` ASCII del placeholder del buscador con el `…` unicode de "Cargando
directorio…". La precondición que hizo falta antes de poder escribir el e2e: `App.tsx` no
tenía ninguna rama para "Empresas" —C2 corre SIEMPRE la suite de Playwright entera (D-09-03
a), así que sin esto el e2e de hoy habría tumbado cualquier corrida futura de `ADMIN-01` o
`FORO-01` por un fichero que no es el suyo—. Resuelto con un `Directory.tsx` de marcador
(mismo patrón que la rama del Operador del Día 14). Validada `--seco`: cero problemas, cero
avisos.

**`ADMIN-01`: el hallazgo de arquitectura, completo.** ADMIN-01 §2 dice que el Operador
"tiene su propia vista de navegación", y el HTML aprobado lo confirma con cinco ítems propios
(`Panel`/`Solicitudes`/`Organizaciones`/`Log de auditoría`/`Sistema`) y acento BRASS, no los
ocho ítems azules del shell de un miembro. Y un `OperatorProfile` (`session.ts`) no tiene
`orgName` ni `role`: `AppShell` está tipado a `MemberProfile` y los usa en tres sitios
(nav-right, sidebar, avatar). Reusarlo habría significado tocar un componente compartido con
su propia suite de pruebas por una pantalla que ni siquiera pertenece a una organización.
`OperatorShell.tsx` es NUEVO —`AppShell.tsx` queda intacto, con sus tests intactos—: importa
`AppShell.module.css` para todo lo que el sistema base ya fija igual entre las dos vistas
(brand bar, nav, sidebar overlay, `bwcnt`) y suma un módulo propio de quince líneas solo para
las dos reglas de acento que de verdad cambian, más la píldora "Operador" del mock. `VeraPanel`
se reutiliza sin `agent` —el cableado VERA↔herramientas del Operador no existe todavía, y
`VeraPanel` ya sabe decir que no está conectada cuando se monta así—. Doce pruebas nuevas en
verde. `App.tsx`: el bloque `operator` deja de ser un `<div>` de marcador inline y pasa a
`<OperatorShell><AdminRequests .../></OperatorShell>`; el `data-testid="operator-home"` —ancla
del e2e desde el Día 14— se muda a `OperatorShell`.

**Y el segundo hallazgo, sobre el propio contenido.** El HTML aprobado y la spec §3/§6 dicen
que Aprobar/Rechazar "envían" los correos EML-07/EML-08, y el mock lo confirma en el panel
tras aprobar: *"Aprobación registrada. Email EML-07 enviado al solicitante."* **Ningún envío
de correo existe en el proyecto** —ni en `admin-requests.ts`, ni en ninguna Edge Function, ni
ningún proveedor configurado en `CLAUDE.md`—. Pintar que se envió un email que nadie envía es
la pantalla afirmando algo falso, la misma clase de riesgo que `CLAUDE.md` §7 describe para
VERA. `harness/tasks/ADMIN-01.json` corrige los dos textos a "Aprobación registrada." y
"Solicitud rechazada.", sin mencionar ningún email —mismo principio que `F-100` en `SRCH-01`,
escrito antes de que exista una línea de código—.

Dos ampliaciones a `admin-requests.ts` (ya entregada el Día 14, ahora con 22 pruebas en vez de
18): `requestDateLabel` —"DD Mmm YYYY · HH:MM", reusando el mismo `Intl.DateTimeFormat` de
`sentAtLabel`/`dateLabel`, no un tercer formato— y `websiteHref` —antepone `https://` a un
dominio del FSR sin esquema, para que el enlace de la tabla sea externo y no relativo a la
propia pantalla—. `harness/tasks/ADMIN-01.json` validada `--seco`: cero problemas, cero
avisos. El e2e (`admin-requests.spec.ts`) es DE SOLO LECTURA a propósito: aprobar, rechazar o
devolver a revisión de verdad dejaría `demo_registration_requests.sql` descuadrada, porque no
hay ningún `teardown` que la reponga entre corridas de Playwright —al contrario que la
siembra de mensajería—; el camino de escritura ya está cubierto con mocks en
`AdminRequests.test.tsx`.

**`FORO-01`, la más simple de las tres.** Sin filtros, sin orden, sin acciones: un único
fichero (`Forum.tsx` + su CSS Module), misma forma que `PANEL-01`. `component_api` fija el
aviso de confidencialidad como PERMANENTE (spec §7, "no es opcional ni ocultable"), los dos
formatos de tiempo relativo que `forum.ts` ya distingue (`relativeShort` para la lista de
recientes, `relativeLong` para la tarjeta —no son intercambiables—), y que ninguna tarjeta
necesita un estado vacío especial para "foro recién lanzado": con cero hilos,
`fetchCategories()` sigue devolviendo las cuatro filas a cero —ya resuelto por la vista
`forum_category_stats`—, así que inventar una rama nueva habría sido inventar un requisito
que la capa de datos ya cubre. El e2e comprueba, contra la siembra real de `demo_forum.sql`,
que el hilo más reciente de la actividad real NO lleva la organización autora que el HTML
aprobado le atribuye —el mock dice "Rodamientos del Sur SL"; la siembra real es "Rodamientos
Ibéricos"—. Validada `--seco`: cero problemas, cero avisos. Requirió su propia precondición
de wiring ("Foros" → `Forum` de marcador), mismo patrón que `DIR-01`.

**El límite del entorno, aclarado sin ambigüedad.** El PO dio por hecho que esta sesión veía
`C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\app\.env`, de donde sale
`DEEPSEEK_API_KEY`. Comprobado contra la propia máquina —`uname -a` (Linux, contenedor
`vm`), `mount` (raíz en `/dev/vda`, un disco propio; ningún volumen de red ni de Windows)—,
no contra lo que "los agentes" hicieran en otras sesiones: esta corre en un contenedor remoto
en la nube, clonado desde GitHub al arrancar, sin ningún canal hacia el portátil del PO. Las
sesiones que sí ven esa ruta son Claude Code local, instalado y lanzado directamente en esa
máquina Windows —es su propio disco, no un permiso—. Sin la clave aquí, el paso 5 del §7 no
puede correr en esta sesión bajo ninguna circunstancia; lo que sí puede es lo que se hizo:
escribir y validar en seco las tres tareas.

**Coste-sombra al cierre:** `python -m harness.core.orchestration_metrics` corrido dos veces
—a mitad de sesión (tras `DIR-01`) y al cerrar—. Cierre: **1.055,62 $** acumulados; el
11-sep entero (Día 14 + Día 15, misma fecha de calendario) pasa de 148,75 $ a **206,60 $**,
así que esta sesión sola son **57,85 $** —sin ninguna corrida real, solo escribir y validar
tres tareas—. Las 21 filas anteriores al Día 14 siguen intactas (`F-157`).
