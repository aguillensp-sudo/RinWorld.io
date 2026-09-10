# Tres entornos como código (entregable 1 de Fundación V1)

**6-sep-2026.** El plan V1 v2.3 pide "tres entornos como código" en singular, sin decir
qué significa exactamente para un *stack* Vercel+Supabase (ninguno de los dos es nativo
de Terraform/Pulumi; los dos se gestionan por API/dashboard). Esta es la interpretación
que se adoptó, igual de explícita que la del entregable 5 sobre "el índice de búsqueda":
si el PO esperaba literalmente un módulo de Terraform, es una decisión de alcance
distinta, no un error de este documento.

**"Como código" se concreta en dos cosas, no en una herramienta de IaC nueva:**
1. Los *jobs* de `.github/workflows/ci.yml` declaran su `environment:` de GitHub — quién
   despliega dónde deja de vivir solo en la cabeza de quien lo corre a mano.
2. Este documento, versionado, es la fuente de verdad de qué proyecto/rama sirve a cada
   entorno — citado desde `FUNDACION-V1.md`, no un sustituto de él.

## El mapa

| Entorno | Vercel | Supabase | Rama | Estado |
|---|---|---|---|---|
| Producción | Production (`rin-world-io.vercel.app`, proyecto `prj_ybo4kVtQJcL0ZbhrI3qhzIVe5GUP`, cuenta personal `alvaro-7494`) | `troxminloxkjwihwfevs` (`MVP_RinWorld.io`, eu-west-1) | `mvp/bootstrap` | ✅ **8-sep-2026, `F-151` cerrado** — cuenta y proyecto nuevos (`bearingworld.vercel.app` y su cuenta quedan inaccesibles, sustituidos). Confirmado en CI real: `gh run` `34219861643`, *job* `deploy` verde, alias `https://rin-world-io.vercel.app` en `HTTP 200` |
| Ensayo/staging | Preview deployments — 🟡 **10-sep-2026, preparado, sin activar** (ver abajo) | `bearingworld-e2e` (`ogdhyzgjjbbikjbkhxmu`, eu-west-1) | PRs contra `mvp/bootstrap` | ✅ **Supabase real desde el 7-sep-2026** — `environment: staging` en el *job* `e2e`, secretos `SUPABASE_E2E_*`. Probado con la suite Playwright completa antes de conectarlo a CI: 53/53. **Vercel: las preview URLs dejaron de existir el 8-sep** al crear el proyecto nuevo sin Git conectado (evitar duplicar el *job* `deploy`, `F-151`) |
| Desarrollo | Local (`vite dev`, `.env`) | Comparte el proyecto de staging (`bearingworld-e2e`) vía `demo:reset:e2e-project`/`e2e:e2e-project` | Cualquiera, sin CI | 🟡 Existe de facto; "como código" es solo `app/.env.example` |

**Cómo se resolvió "ensayo":** el entregable 3 (aislamiento de demo/e2e) se decidió por
proyecto Supabase separado el 6-sep; `create_project` chocó primero con un límite real de
cuenta (2 proyectos Free activos, uno ajeno a este repo), resuelto por el PO borrando el
ajeno. Con el cupo libre, `bearingworld-e2e` se creó, se le aplicaron las 23 migraciones,
se sembraron cuentas+hilos, y se probó con la suite Playwright real (53/53) ANTES de
conectar CI — no se declaró "listo" con solo las filas insertadas. **No se creó un tercer
proyecto Supabase**: el mismo proyecto del entregable 3 sirve de staging, tal como este
documento proponía — la infraestructura se solapa con el diseño, el criterio que el
propio Plan V1 pide para este hito.

## Vercel Preview deployments (10-sep-2026, activado)

Al crear el proyecto Vercel nuevo el 8-sep sin Git conectado (`F-151`) se perdió el efecto
colateral de que cada PR generaba una URL de vista previa clicable — distinto del *job*
`e2e`, que prueba funcionalidad contra `bearingworld-e2e` pero no deja mirar la pantalla.

`app/vercel.json` lleva `ignoreCommand`, que le dice a Vercel que se salte el *build* en
`mvp/bootstrap` (nuestro *job* `deploy` de CI sigue siendo el único que toca producción,
gateado por los tests) y que SÍ construya para cualquier otra rama — preview automática en
PRs sin duplicar el despliegue de producción, el problema que causó desconectar el Git
integration la primera vez.

**10-sep-2026: el PO reconectó el repo** en Project Settings → Git del proyecto
`rin-world-io`. Primera comprobación en el dashboard: **todos** los pushes a `mvp/bootstrap`
desde la reconexión salían como *deployment* completo "Ready" (10-15s de build), no como
"Ignored" — el `ignoreCommand` no se estaba aplicando. Producción seguía sirviendo bien
(`HTTP 200` verificado), pero el riesgo de que uno de esos *builds* fantasma pisara el
*deploy* bueno era real y creciente con cada push.

**Causa:** `Root Directory` del proyecto estaba en `./` (raíz del repo), no en `app`. El
proyecto se creó con `vercel link` ejecutado dentro de `app/` (ver comentario en `ci.yml`),
lo que nunca fija ese ajuste — solo importa cuando el disparador es Git, no cuando despliega
la CLI. Con `Root Directory` en la raíz, el Git integration nunca llegaba a leer
`app/vercel.json` ni, por tanto, su `ignoreCommand`.

**Corregido por el PO:** `Root Directory` cambiado de `./` a `app` en Settings → General.
Efecto colateral: rompió el propio `deploy` job de CI (la CLI, que ya arranca en `app/` por
el `working-directory` del job, sumaba las dos rutas y buscaba `app/app` -- `gh run`
`34459783951`). Corregido forzando ese paso a la raíz del repo (`d932dcb`).

**Comprobado en el dashboard tras el fix de Root Directory:** los pushes a `mvp/bootstrap`
seguían sin generar ninguna fila nueva de origen GitHub en Deployments -- ni "Ready" ni
"Ignored"/"Canceled", solo las filas de siempre con *Source* = CLI (el `deploy` job de CI,
autor `alvaro-7494`, que no pasa por `ignoreCommand` porque no es un despliegue disparado por
Git). La única fila de *Source* = GitHub visible es una de `main` de cuando se reconectó el
repo -- nada de `mvp/bootstrap` llegó a intentar un build ni cancelarlo.

**Cambio de enfoque:** `ignoreCommand` solo cancela un build ya en marcha (sigue contando
para el cupo de *builds*) y, según la documentación oficial de Vercel, no hay garantía de que
se lea correctamente en todas las combinaciones de `Root Directory`. La propiedad pensada
exactamente para esto es `git.deploymentEnabled` (`vercel.json`, ver
`/docs/project-configuration/git-configuration`): un mapa rama→booleano que impide que el
push dispare *ningún* deployment en absoluto para esa rama, sin gastar cupo. `app/vercel.json`
pasa de `ignoreCommand` a:

```json
"git": { "deploymentEnabled": { "mvp/bootstrap": false } }
```

Cualquier otra rama (PRs incluidas) sigue con el valor por defecto (`true`), así que sí
generará su preview. Pendiente de confirmar en el dashboard: (1) que el próximo push a
`mvp/bootstrap` no genera ninguna fila de *Source* = GitHub, y (2) que una rama/PR distinta sí
la genera.

**Prueba en vivo (10-sep-2026):** esta misma línea se comitea en una rama de prueba
(`test/vercel-preview-check`) con PR abierta contra `mvp/bootstrap`, precisamente para
comprobar (2) -- que Vercel genera una Preview deployment real para esa rama. PR y rama se
cierran/borran en cuanto quede confirmado.

## Scripts nuevos (7-sep-2026)

- `app/scripts/demo-reset-e2e-project.mjs` — resiembra los cinco hilos congelados del
  proyecto aislado (equivalente a `npm run demo:reset`, pero apuntado a
  `SUPABASE_E2E_*` en vez de a las variables de producción).
- `app/scripts/run-e2e-against-e2e-project.mjs` — corre `npm run e2e` con el entorno
  sobreescrito para apuntar al proyecto aislado, sin tocar `app/.env` ni el proyecto
  compartido. Accesibles como `npm run demo:reset:e2e-project` / `npm run e2e:e2e-project`.

## Lo que este documento NO decide

Si "desarrollo" necesita alguna vez el *stack* local de Supabase (`supabase start`) en
vez de compartir el proyecto de staging — hoy nadie lo usa (`supabase/config.toml` lo dice
explícito) y no hay señal de que haga falta. Se revisita si aparece la necesidad, no antes.
