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
| Producción | Production (`bearingworld.vercel.app`) | `troxminloxkjwihwfevs` (`MVP_RinWorld.io`, eu-west-1) | `mvp/bootstrap` | ✅ Real, y desde el 6-sep con `environment: production` declarado en el *job* `deploy` de `ci.yml` |
| Ensayo/staging | Preview deployments (automático por rama/PR, sin código nuevo) | **Pendiente** — depende del entregable 3 | PRs contra `mvp/bootstrap` | 🔴 Sin backend propio todavía. Hoy el *job* `e2e` sigue apuntando a `troxminloxkjwihwfevs`, el mismo proyecto que producción |
| Desarrollo | Local (`vite dev`, `.env`) | Compartiría el proyecto de staging una vez exista | Cualquiera, sin CI | 🟡 Existe de facto (todo el mundo desarrolla así hoy); "como código" es solo `app/.env.example` |

**Por qué "ensayo" no tiene proyecto propio todavía, dicho sin maquillar:** el entregable
3 (aislamiento de demo/e2e) se decidió por proyecto Supabase separado el mismo 6-sep,
pero `create_project` chocó con un límite real de cuenta (2 proyectos Free activos ya
existentes en la org, uno de ellos ajeno a este repo) que no se puede resolver desde
aquí — ver `FUNDACION-V1.md` entregable 3 y `findings-register.md`. **El diseño de este
documento asume que, cuando se resuelva, ese MISMO proyecto nuevo sirve de staging** — no
se crea un tercer proyecto Supabase solo para "ensayo": la infraestructura se solapa con
el diseño, que es justo el criterio que el propio Plan V1 pide para este hito.

## Qué queda por hacer cuando el entregable 3 se resuelva

1. Declarar `environment: staging` en el *job* `e2e` de `ci.yml`, apuntando sus secretos
   (`SUPABASE_URL`, `E2E_ALPHA_*`, etc.) al proyecto nuevo.
2. Actualizar la fila de "ensayo/staging" de este documento de 🔴 a ✅, con la fecha y el
   `project_id` real — no antes, para no repetir el error de `F-132` (declarar hecho lo
   que no se ha comprobado).
3. Decidir si el entorno `production` de GitHub lleva revisores obligatorios antes de que
   el *job* `deploy` corra — es un cambio de configuración del repositorio compartido,
   así que se pide confirmación explícita en el momento, aparte de la de este documento.

## Lo que este documento NO decide

Si "desarrollo" necesita alguna vez el *stack* local de Supabase (`supabase start`) en
vez de compartir el proyecto de staging — hoy nadie lo usa (`supabase/config.toml` lo dice
explícito) y no hay señal de que haga falta. Se revisita si aparece la necesidad, no antes.
