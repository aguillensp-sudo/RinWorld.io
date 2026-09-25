# Día 22 de V1

**Día 22 de V1 · 22-sep-2026 · Estado: CERRADO — reabierto una vez por la regla 4, y con
motivo.** Fecha de máquina al cerrar por segunda y última vez: `2026-09-22`, 07:28 UTC (`date -u`).

> **EL DÍA EN SEIS LÍNEAS.**
>
> 1. **`F-188` decidido por el PO: se deja como está.** Las C5 se siguen haciendo contra
>    producción, sin pulsar nada que escriba; el `.env` local no se apunta al staging.
> 2. **La séptima pantalla, elegida y NO construida:** `SRCH-03` · Gestión de Watchers
>    (Módulo 03, sin tocar por la corriente B). Razonamiento completo en
>    `UMBRAL-FABRICA-V1.md` §8. No se construye hoy a propósito: el propio relevo del
>    Día 21 pide una sesión nueva por pantalla y cronómetro, y esta sesión ya estaba
>    abierta para el punto 3.
> 3. **La sospecha de `F-186` sobre `Forum.module.css`/`AdminBilling.module.css`,
>    comprobada, arreglada y desplegada: `F-189`.** Confirmado primero en un navegador
>    real (no jsdom) fuera del login de la app, y **confirmado después por el PO en su
>    localhost, con `FORO-01` y `ADMIN-02` ya desplegados: funcionan.**
> 4. **Y el PO encontró una cuarta y una quinta, con el mismo método, sin que nadie se lo
>    pidiera: `F-190`.** `DIR-01` y `ADMIN-01` tampoco tenían scroll propio con la ventana
>    baja — de partida ninguna de las dos tenía siquiera `min-height: 100%`. Mismo
>    arreglo, mismas pruebas, desplegado y **verificado por contenido en producción**
>    (`._page_3xbnz_14`, `._screen_186li_1`, las dos con `overflow-y:auto` puesto).
>    **Con esto, las SEIS pantallas que ha construido la corriente B han tenido este
>    fallo en algún momento** — deja de ser un patrón aislado.
> 5. **Método, documentado para la próxima vez:** para reproducir un fallo de layout sin
>    tocar el login de la app (`F-188` sigue con `npm run dev` contra producción), se
>    copian las reglas CSS implicadas en una página aislada fuera del repo, servida por
>    un `http.server` propio y medida con JavaScript en un navegador real.
> 6. **Pendiente, dicho en voz alta:** meter el scroll propio en la plantilla de tarea del
>    Coder. Seis de seis pantallas con el mismo hueco ya no es una corrección puntual.

> **Adenda del 23-sep-2026, `2026-09-23` 10:27 UTC (`date -u`).** El único pendiente que
> dejó el cierre del 22-sep era la vuelta del PO sobre `DIR-01`/`ADMIN-01` ya desplegados
> (§3.3 de aquel cierre). **Recibida: «está todo aprobado y contrastado».** Con esto,
> `F-190` queda cerrado del todo — mismo criterio que `F-186`/`F-189`, confirmación visual
> incluida — y no queda ninguna C5 pendiente de esta serie de hallazgos. Sin código nuevo
> hoy: solo esta confirmación, el registro y el cierre de sesión (servidor de desarrollo
> parado, ver §5 y el pie de este fichero).


---

## Lo comprobado ese día (antes en §1 de ESTADO-V1)

**Tabla del 22-sep-2026, Día 22 — lo comprobado HOY:**

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Fecha de máquina | `date -u` | `2026-09-22`, entre 06:48 y 07:07 UTC según el paso |
| Worktree adelantado a la raíz | `git merge --ff-only origin/mvp/bootstrap` desde `43bb222` | Fast-forward a `3921781`, igual que la raíz y `origin/mvp/bootstrap` |
| Copia de `ESTADO-V1.md` en la raíz | `ls` en la raíz del repo | No ha reaparecido |
| Que `Forum.module.css` (`.body`) y `AdminBilling.module.css` (`.screen`) son hijos directos de `.bwcnt` | Lectura de `AppShell.tsx:160` (`<main className={styles.bwcnt}>{children}</main>`), `OperatorShell.tsx:155` (mismo patrón, reutiliza `AppShell.module.css`), `Forum.tsx` y `AdminBilling.tsx` | Confirmado en los dos: sin ningún `<div>` intermedio entre `.bwcnt` y `.body`/`.screen` |
| Que el fallo de scroll de `F-186` se reproduce en los dos, ANTES del arreglo | Página aislada (fuera del login) que copia `.bwshell`/`.bwcnt`/`.body`-`.screen` literales, con 40 filas de contenido, medida con `getComputedStyle`/`scrollHeight`/`clientHeight` en un navegador real | `.bwcnt` de 814 px de alto, contenido de 1862–1989 px, `overflowY: hidden`: recortado sin barra en los dos casos |
| Que el arreglo (`flex: 1; min-height: 0; overflow-y: auto`) lo corrige | Misma página, con la regla puesta | El propio bloque pasa a `overflowY: auto` con `clientHeight` acotado a 814 px y `scrollHeight` de 1910/1989 px: todo el contenido alcanzable por scroll |
| Que las dos pruebas nuevas vigilan algo, no solo pasan | Script aparte (`node`) que aplica la misma regex de extracción al CSS de `HEAD` (antes del arreglo) | El bloque extraído no contiene `overflow-y: auto` en ninguno de los dos ficheros: la prueba habría fallado antes del arreglo |
| Que la app sigue entera | `npx vitest run` y `npm run typecheck` | **956 pasan** (954 + 2 nuevas), 23 saltados; typecheck limpio |
| Que el arnés sigue entero | `python -m harness.tests.test_checks` | «Todas en verde» |
| La CI | `gh run watch 35697446434` sobre `730c330` | Los **seis jobs** en verde, incluidos los dos despliegues |
| Que producción sirve el arreglo | Descarga de `/assets/index-CK6WL1nR.css` y extracción de las reglas `.screen`/`.body` por selector minificado | `._screen_jkne8_9{…gap:20px;min-height:0;…overflow-y:auto}` y `._body_1j5i6_18{…flex:1;min-height:0;…overflow-y:auto}` — por contenido, no por `HTTP 200` |
| **Que el resultado visual de `F-189` es el bueno en la app real** | El PO, en su localhost, con `FORO-01` y `ADMIN-02` ya desplegados | «Probados FORO-01 y 02, ADMIN-02, FUNCIONAN.» — confirmado |
| Que `DIR-01` y `ADMIN-01` tenían el MISMO fallo (`F-190`) | El PO, en su localhost, con la ventana baja — el mismo método que se le pidió para `F-189` | «Ni DIR-01 ni ADMIN-01 tienen el scroll cuando la ventana es baja.» Confirmado leyendo el código: los dos son hijos directos de `.bwcnt` (`Directory.tsx:184`, `AdminRequests.tsx:223`), sin ni `min-height: 100%` de partida |
| Que las dos pruebas nuevas de `F-190` vigilan algo | Mismo script de extracción, contra el CSS de `HEAD` antes del arreglo | Ninguno de los dos bloques (`.page`, `.screen`) contenía `overflow-y: auto` |
| Que la app sigue entera tras `F-190` | `npx vitest run` y `npm run typecheck` | **958 pasan** (956+2), 23 saltados; typecheck limpio |
| Que el arnés sigue entero tras `F-190` | `python -m harness.tests.test_checks` | «Todas en verde» |
| La CI de `F-190` | `gh run watch 35699368803` sobre `ab98e79` | Los **seis jobs** en verde, incluidos los dos despliegues |
| Que producción sirve el arreglo de `F-190` | Descarga de `/assets/index-DMJjyngJ.css`, extracción de `.page`/`.screen` por selector minificado | `._page_3xbnz_14{…flex:1;min-height:0;…overflow-y:auto}` y `._screen_186li_1{…flex:1;min-width:0;min-height:0;…overflow-y:auto}` — por contenido |
