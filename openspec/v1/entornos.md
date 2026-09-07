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
| Producción | Production (`bearingworld.vercel.app`) | `troxminloxkjwihwfevs` (`MVP_RinWorld.io`, eu-west-1) | `mvp/bootstrap` | ✅ Real, `environment: production` en el *job* `deploy` de `ci.yml` |
| Ensayo/staging | Preview deployments (automático por rama/PR, sin código nuevo) | `bearingworld-e2e` (`ogdhyzgjjbbikjbkhxmu`, eu-west-1) | PRs contra `mvp/bootstrap` | ✅ **Real desde el 7-sep-2026** — `environment: staging` en el *job* `e2e`, secretos `SUPABASE_E2E_*`. Probado con la suite Playwright completa antes de conectarlo a CI: 53/53 |
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
