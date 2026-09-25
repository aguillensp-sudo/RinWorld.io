# Bearingworld.io — Reglas de proyecto (V1)

Plataforma B2B de distribución de rodamientos industriales. Búsqueda conversacional
(**VERA**, Claude Sonnet 4.6) sobre arquitectura **zero-knowledge** E2EE para precio,
cantidad y negociación entre organizaciones. Metodología: SDD con OpenSpec.

Este fichero es el contrato de trabajo del proyecto y se carga en cada sesión. El MVP se
cerró el 18-ago-2026 (`openspec/mvp/CIERRE-MVP.md`); desde el 22-ago estamos en **V1**, que es
**fábrica, no producto**: se construye y se mide el arnés (`harness/`) que genera pantallas
con un Coder externo. **El estado del día está en `openspec/v1/ESTADO-V1.md`** (§11 dice
cómo se lee y cómo se escribe).

---

## 1. Reglas no negociables

1. **Ninguna API key en ningún fichero versionado, nunca.** El repo es
   público/compartido: ni en código, ni en configs, ni en un `.env` que se suba.
   Las claves viven en dos sitios y solo en dos — **§10 dice cuál es cuál y no hay que
   adivinarlo**:
   - **`app/.env`** (ignorado por git) → todo lo del proyecto Supabase y las cuentas de
     prueba. **Es lo primero que se mira antes de tocar Supabase.**
   - **Entorno de usuario** (`os.environ` / `process.env`) → `SUPABASE_SERVICE_KEY` ·
     `DEEPSEEK_API_KEY` · `LANGSMITH_API_KEY`.

2. **Nomenclatura Rinworld_ ↔ Bearingworld.io.** Los ficheros se llaman `Rinworld_*`
   (herencia del repo `RinWorld.io`), pero **todo el contenido visible al usuario**
   (title, h1, textos, VERA, tooltips) dice siempre **"Bearingworld.io"**.
   Nunca al revés: jamás sustituir "Bearingworld.io" por "Rinworld" en contenido.

3. **Contrato aprobado = solo lectura.** No mover, renombrar ni editar:
   - HTML de `openspec/design-gui/specs y html aprobados/` (sirven GitHub Pages con
     rutas relativas — moverlos rompe producción).
   - Specs de `openspec/specs/` (9 capabilities cerradas).
   Son referencia de reproducción fiel, no material de trabajo.

4. **Commit + push tras cada bloque completado, sin pedir confirmación.** El PO prueba en
   el entorno desplegado (Vercel) o en su localhost; un cambio sin pushear es invisible
   para él. **Se empuja a `mvp/bootstrap`** (rama por defecto y la única que despliega);
   `main` está congelada en `43bb222` y solo sirve los prototipos de GitHub Pages.

5. **Repo correcto.** Este repo (`BearingWorld.io`, remoto `github.com/aguillensp-sudo/RinWorld.io`)
   es propio e independiente. `C:\Users\admin` es otro repo git mal configurado que se
   traga todo lo que cuelga de él: verificar `git rev-parse --show-toplevel` antes de
   commitear y no dejar caer cambios del MVP en ese repo padre.

6. **Autoría honesta en los commits.** El objetivo 4 del MVP es medir qué produce el
   arnés; si la autoría se mezcla, la medición no vale.
   - Código generado por el Coder → trailer
     `Co-Authored-By: deepseek-v4-flash <coder@harness.local>`.
   - Código escrito por Claude Code → trailer `Co-Authored-By` del modelo de Claude
     correspondiente. Nunca atribuir a Claude lo que escribió el Coder, ni al revés.
   - **Nunca mezclar código del Coder y código a mano en el mismo commit.** Van en
     commits separados, aunque pertenezcan a la misma tarea: primero el artefacto del
     Coder tal cual sale, después las correcciones a mano. Así el diff del segundo commit
     *es* la medida de cuánto hubo que arreglar.
   - **Los commits previsiblemente rojos llevan `[skip ci]`, con el motivo en el
     cuerpo** (F-063, decidido por el PO el 12-ago). Construir una pantalla por el arnés
     deja **dos commits que la CI no puede pasar por diseño**: el contrato de aceptación
     en rojo contra los esqueletos, y el artefacto del Coder antes de revisarlo. Si esos
     dos corren la CI, el rojo deja de significar nada — y un rojo que no significa nada
     es peor que no tener CI. **La CI entera va en el commit de la revisión a mano**, que
     es el primero que puede estar verde. No se pierde cobertura: se pierde ruido.
     **Un artefacto que sale verde del arnés no lleva `[skip ci]`**: si puede pasar, pasa.
   - Precedente documentado: `0623451` incumple esto y no se reescribe (ver F-009).

---

## 2. Estructura (monorepo)

```
BearingWorld.io/
├── openspec/            ← specs = fuente de verdad (sin cambios)
│   ├── specs/           ← 9 capabilities cerradas (read-only)
│   ├── architecture/    ← ADR-001, design-system.md
│   ├── mvp/             ← plan y cierre del MVP, métricas, registro de hallazgos (findings/)
│   ├── v1/              ← relevo (ESTADO-V1.md), decisiones, diario/ y planes de V1
│   └── design-gui/      ← HTML aprobados + generador (read-only; sirve GitHub Pages)
├── app/                 ← aplicación React (Vite + TS)
├── harness/             ← el arnés: grafo LangGraph, tareas del Coder, métricas de corrida
├── supabase/            ← migraciones, siembras y tests de esquema
└── index.html, docs/…   ← specs funcionales y ADR
```

El MVP vive en este mismo repo (monorepo) para que el arnés lea specs y escriba código
en la misma pasada. Los HTML del prototipo no se tocan.

---

## 3. Reparto de modelos (stack v1.2)

Se reparte por **coste del fallo**, no por dificultad.

- **Claude Opus 4.8 / Claude Code** → arquitectura y piezas donde el fallo es caro o
  silencioso: esquema de datos, RLS y políticas Supabase, wiring de Realtime, rebanada
  E2EE, máquina de estados de la oferta, herramientas de VERA y su orquestación.
- **DeepSeek-V4-Flash** (`deepseek-v4-flash`, DeepSeek oficial vía `DEEPSEEK_API_KEY`) →
  nodos Coder y Test-runner: alto volumen y mecánico con verdad de referencia visible
  (HTML aprobado → React, GIVEN/WHEN/THEN → Playwright, siembra de catálogo). Sustituye a
  GLM-5.2/DeepInfra del plan original (cambio por coste, decidido en SP-1 el 5-ago-2026;
  ver `openspec/mvp/findings-register.md` F-001).
- **VERA en producción** → **Claude Sonnet 4.6, fijo por contrato (QA-A00-06)**. No se
  cambia por decisiones de testing/caching.

**Regla de integridad, innegociable:** **el Coder nunca escribe los tests que lo evalúan.**
El test es el contrato entre Planner y Coder; si el mismo modelo escribe prueba y código,
la prueba deja de verificar.

---

## 4. Seguridad y E2EE

- Los campos comerciales (precio, cantidad, plazo, transporte) van **cifrados**; el
  estado de la oferta y los timestamps son metadatos en claro (RNG-VND-01). Ninguna vista
  agregada muestra campos E2EE fuera del hilo cifrado.
- La clave de VERA (Sonnet 4.6) **nunca** llega al navegador: se usa vía Edge Function
  proxy en Supabase. Punto no negociable, no es un detalle de MVP.
- En el MVP las claves E2EE viven en memoria de sesión y se pierden al recargar: **sin
  backup, recuperación, passphrase ni rotación**. Es correcto para el MVP y **no debe
  confundirse con una implementación de ADR-001** (que sí las exige en V1).

---

## 5. Testing y prompt caching (contrato)

- **Mockeo obligatorio:** todos los tests unitarios mockean el cliente LLM. Solo los
  tests `@pytest.mark.integration` hacen llamadas reales, y **nunca en CI automático**.
- **Prompt caching de VERA:** el system prompt separa bloque estático (`cache_control`)
  del bloque dinámico desde el primer commit de código, no como optimización posterior.

---

## 6. Instrumentación (objetivo 4 del MVP)

- Registrar **cada** tarea del arnés en `openspec/mvp/harness-metrics.csv`: modelo,
  tokens in/out, coste, intentos hasta verde, si escaló a humano, minutos y **`ficheros`**
  (los que escribió el Coder, separados por `;`). Cada reintento es una fila propia.
  Convención del fichero: **ningún valor lleva coma** — se usa `;` — para que el CSV se
  parsee sin comillas.
- **El coste que se registra es el coste real de la llamada, y el cache hit se declara.**
  Una cifra con cache alto no se extrapola nunca a coste por pantalla en frío (F-011).
  `coste_usd` del CSV y `cost_usd` del JSON de métricas **tienen que coincidir**; si no
  coinciden, gana el JSON recomputado, no la copia a mano (F-010).
- Los hallazgos van a `openspec/mvp/findings-register.md`, clasificados como
  `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`. Ese fichero es un **índice de una
  línea por hallazgo**; el detalle va en `openspec/mvp/findings/F-NNN.md`. Nunca se lee de
  corrido: por identificador.

---

## 7. Riesgo #1 — VERA inventando datos

Sonnet 4.6 responde con fluidez impecable tenga o no la herramienta para saberlo. El
fallo grave no es el silencio, es afirmar con aplomo un dato falso delante del socio.
Defensa única: **VERA responde exclusivamente desde el retorno de sus herramientas** y
dice "no tengo ese dato" en cuanto sale de ahí.

---

## 8. Detalles de UI

- **Logo:** `<img src="intentologo.png" style="height:46px;width:auto">` (fichero externo;
  el logo en base64 no renderiza — no usarlo).
- **Sistema de diseño:** fuente única en `openspec/architecture/design-system.md`
  (tokens, layout del shell, componentes, protocolo de verificación). Todo componente
  React usa esos tokens, no valores inventados.

---

## 9. Documentos de referencia

Se leen **cuando la tarea toca el tema**, no al arrancar:

- `openspec/v1/UMBRAL-FABRICA-V1.md` — **antes de tocar la fábrica o medir una pantalla.** Es
  el umbral escrito antes de medir y no se reescribe después de ver un resultado.
- `openspec/v1/DECISIONES-V1.md` — todas las decisiones de V1, con quién y cuándo.
- `openspec/v1/FUNDACION-V1.md` — los seis entregables de infraestructura.
- `docs/ADR-002` §10 (Q-1), **entero**, antes de tocar mensajería o reparto de claves.
- `docs/ADR-001` / `openspec/architecture/ADR-001_E2EE_Key_Backup_1.md` — criptografía.
- `openspec/v1/entornos.md` — CI/CD y mapa de entornos.
- `openspec/v1/vera-vertex-eu-migracion.md` — antes de tocar `vera/index.ts`.
- `openspec/mvp/CIERRE-MVP.md` — acta del MVP; **lee primero su bloque de corrección**.
- `openspec/gaps-register.md` · `openspec/product-decisions.md` — debates de producto.

---

## 10. Supabase — dónde está todo, antes de tocar nada

> **Esta sección existe porque el mismo problema se repitió ~30 veces:** cada sesión nueva
> se ponía a buscar credenciales, a adivinar nombres de columna o a intentarlo por la CLI,
> y el PO tenía que decir otra vez dónde estaba cada cosa. **Nada de lo de aquí se
> deduce del código en un vistazo, así que se lee antes de la primera consulta, no
> después del primer error.**
>
> Se añade como §10 y **no se renumera nada**: media docena de documentos citan
> `CLAUDE.md §1.6`, `§3`, `§4`, `§5` y `§7`, y renumerar rompería esos punteros.

### 10.1 Las credenciales — `app/.env`

**`C:\Users\admin\proyectos\Bearing.io\BearingWorld.io\app\.env`.** Ignorado por git
(`app/.gitignore`), nunca versionado, y **es la fuente de verdad** de:

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | El proyecto. De aquí sale el `project_ref` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable del cliente. **46 caracteres exactos** (F-050: un `;` de más costó dos días) |
| `E2E_ALPHA_EMAIL` / `_PASSWORD` / `_ORG` | Cuenta de pruebas compradora |
| `E2E_BETA_EMAIL` / `_PASSWORD` / `_ORG` | Cuenta de pruebas vendedora |
| `E2E_EDITOR_EMAIL` / `_PASSWORD` / `_ORG` | Añadida 5-sep-2026. EDITOR (no ADMIN) en `Nordwälz Lager`, para probar D-7/D-8 y la rama de `caller_bypasses_visibility_scope()` que ningún ADMIN ejercita (`F-149`) |
| `E2E_OPERATOR_EMAIL` / `_PASSWORD` | Añadida 11-sep-2026. **Operador de Plataforma** (`0028`): sin organización a propósito, por eso no hay `_ORG`. Es la cuenta con la que se puede probar ADMIN-01 de extremo a extremo. **La cuenta se crea en el panel, no por SQL** (`F-013`), y después hay que darla de alta en `platform_operators`. **En los secretos de GitHub va SOLO `E2E_OPERATOR_PASSWORD`** (puesto el 11-sep-2026): el correo no es un secreto, está en claro en `.env.example`, y cuando exista el e2e de ADMIN-01 irá literal en `ci.yml` — mismo criterio que `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`, §10.2. Un secreto de más es un sitio de más donde puede faltar sin que nadie se entere (`F-071`) |
| `VITE_DEMO_KEY_SEED` | Deriva las claves E2EE de demo (D-08-01, F-067) |
| `ANTHROPIC_API_KEY` | Solo local; en producción vive en el entorno de la Edge Function |

**`SUPABASE_SERVICE_KEY` NO está en `app/.env`**: vive en el entorno de usuario, y es la
única que salta RLS. `app/.env.example` lleva la lista con marcadores, sin valores.

> **Cómo se usan sin exponerlos:** se leen y se pasan por tubería o por variable de
> entorno. **Nunca se imprimen en pantalla, nunca se pegan en un fichero, nunca se pasan
> como argumento de línea de comandos.** Si hace falta comprobar uno, se comprueba su
> **longitud o su efecto**, no su valor (F-038: un "ya está cambiado" no es una
> verificación; la longitud sí).

### 10.2 El proyecto, y por qué el SQL va por el MCP

- **Un solo proyecto: `troxminloxkjwihwfevs`** (eu-west-1). Cualquier otro ref que
  aparezca es de otro cliente.
- **El SQL y las migraciones van por el MCP de Supabase** (`execute_sql`,
  `apply_migration`), **no por `npx supabase`**. Motivo, y no es preferencia: **la CLI
  está logueada en la cuenta equivocada** —`web-julsaindustrial`, org
  `mjxnlvvrnjuuawlxkmte`— mientras el MVP vive en la org `ujatcozvbspkycepemfq`
  (**F-073**). Hasta que eso se arregle, un `supabase db push` va al proyecto de otro.
  > ⚠ **Corregido el 30-ago:** esta línea decía *«el MVP vive en
  > `ujatcozvbspkycepemfq`»* a secas, y eso contradecía el punto de arriba. Los dos son
  > ciertos y hablan de cosas distintas: `ujatcozvbspkycepemfq` es la **organización** y
  > `troxminloxkjwihwfevs` es el **proyecto** dentro de ella. Comprobado con
  > `list_projects` por el MCP —`MVP_RinWorld.io`, `eu-west-1`, `ACTIVE_HEALTHY`, org
  > `ujatcozvbspkycepemfq`— y contra `VITE_SUPABASE_URL` de `app/.env`. Un ref de
  > organización usado como ref de proyecto en la sección que se lee **antes de la primera
  > consulta** es exactamente el error que esta §10 existe para evitar.
- **Corregido el 6-sep-2026 (entregable 2 de Fundación V1):** el *job* `deploy` de
  `.github/workflows/ci.yml` despliega la app a Vercel y la función `vera` a Supabase
  automáticamente tras el verde de `schema`+`app`+`e2e`+`arnes`, en cada push a
  `mvp/bootstrap` — **F-091 y F-072 quedan cerrados de raíz**, ya no de proceso: un
  "cerrado" en el relevo ahora sí implica que llegó a la URL real, sin que nadie tenga
  que acordarse de correr `vercel --prod` a mano. Usa dos secretos de GitHub, con los
  nombres reales con los que se crearon (GitHub no deja renombrar): `SUPABASE_TOKEN`
  (scopeado a la org `ujatcozvbspkycepemfq`, **no** el login de la CLI de F-073 — es un
  token aparte, solo para CI) y, **desde el 8-sep-2026 (F-151), `VERCEL_NEWACCOUNT_TOKEN`**
  — cuenta y proyecto nuevos (`alvaro-7494` / `rin-world-io`), el `orgId`/`projectId`
  van literales como `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` en el propio `ci.yml`, no por
  `.vercel/project.json` (no se comitea). **Las migraciones siguen sin tocarse aquí, a
  propósito:** este *job* no corre `supabase db push`; el esquema sigue yendo por el
  MCP, revisado migración a migración.

### 10.3 El esquema — para no adivinar nombres de columna

**Fuente de verdad: `supabase/migrations/*.sql`, en orden.** Este resumen es un atajo para
no equivocarse en la primera consulta, no un sustituto.

- **Las tablas están en `public`, no en `app`.** `app` es el esquema de *funciones*
  (`app.current_org_id()`, `app.is_active_member()`, `app.guard_offer_decider`).
- `inventory_lines` → `location_country` (**no** `country_code`), `last_upload_at`,
  `product_family`, `lead_time_days`, `status` ∈ `DRAFT` `PUBLISHED` `ARCHIVED` `DELETED`,
  `unit_price_ciphertext`/`_iv` (E2EE, siempre NULL en la siembra).
- `threads` → `org_low_id` / `org_high_id` (**no** `org_a`/`org_b`; van en orden canónico
  `low < high`), `created_by_org_id`, `state` (**no** `status` ni `estado_hilo`) ∈
  `ABIERTO` · `CON CONSULTA PENDIENTE` · `CON OFERTA PENDIENTE` · `ACUERDO ALCANZADO` ·
  `CERRADO SIN ACUERDO`.
- `thread_items` → `sender_org_id`, `item_type`, `estado_consulta`, `estado_oferta`
  (capitalizados: `Pendiente` `Aceptada` `Rechazada` `Superada por contraoferta`),
  `responds_to_item_id`, `superseded_by_item_id`, `content_ciphertext`/`content_iv`.
- `thread_item_keys` → `item_id` (**no** `thread_item_id`), `recipient_member_id`,
  `wrapped_cek`, `wrap_iv`, `ephemeral_pubkey`.
- `members` → `public_key`, `role`, `state`. `organizations` → `name`, `country`,
  `continent`, `status`.

### 10.4 Dos cosas que la base hace y que sorprenden

1. **Un estado de la base que se afirme se consulta con SQL en el momento de afirmarlo.**
   Tres veces se ha escrito en un documento un estado que la base no tenía (**F-012**,
   **F-089**, **F-095**). No es un fallo de memoria: es que reconstruirlo entre sesiones
   no funciona.
2. **El estado de demo es efímero.** `app/e2e/fixture.setup.ts` borra y repone los cinco
   `HILO_IDS` al empezar **cada** corrida de Playwright, y `create_inquiry` es
   encontrar-o-crear, así que lo que se haga a mano dentro de esos hilos dura **hasta la
   siguiente suite e2e** (**F-095**). Y el catálogo envejece con el calendario: hay que
   correr `supabase/seed/reanchor_freshness.sql` antes de cada ensayo (**F-094**,
   `guion-demo-y-siembra.md` §6).

---

## 11. El relevo, sus reglas y el ritual de cierre

### 11.1 Al arrancar

1. `openspec/v1/ESTADO-V1.md`: primero su §6 (lo que no se sabe) y después su §3 (lo que toca).
2. Lo de §9 que toque la tarea, y nada más. `findings-register.md` y `diario/`, solo por
   identificador o por fecha.

**Si la sesión arranca en un worktree en `43bb222`, sin `harness/` ni `app/`** (pasa al reabrir
una sesión vieja): no te pares. En el worktree, `git merge --ff-only origin/mvp/bootstrap`,
trabaja ahí, `git push origin HEAD:mvp/bootstrap` y adelanta la raíz con
`git -C <raíz> merge --ff-only origin/mvp/bootstrap`. Al worktree le faltan `app/.env`
(cópialo de la raíz) y `node_modules` (junction con `mklink /J`; se quita con `rmdir`,
**nunca con `rm -rf`, que seguiría el enlace**). Un fichero con regex o barras invertidas
se crea con el editor, nunca con un heredoc del shell (`F-199`).

### 11.2 Las cinco reglas del relevo

Salen de errores reales; el hallazgo de cada una cuenta la historia.

1. **Cita, no parafrasees.** Estados y asignaciones de modelo se copian con su puntero al lado.
2. **Lo que el relevo afirme se comprueba el día que se escribe, contra el código o la base**,
   nunca contra otro documento (`F-129`, `F-132`). Privilegios, RLS y permisos, contra el
   catálogo (`pg_proc`, `pg_policies`, `pg_default_acl`), no contra el `.sql` (`F-146`).
3. **La fecha se lee de la máquina** (`date -u`), nunca de memoria (`F-109`).
4. **Se cierra cuando se acaba, no cuando parece que se acaba.** Si el trabajo sigue después
   del cierre, se reabre y se reescribe.
5. **Una evidencia que depende de que alguien se acuerde de producirla no es evidencia**
   (`F-136`). Mira quién la produce y qué pasa si se distrae.

Y una sexta, de forma: **el relevo solo lleva estado.** Nada de historia, crónicas ni
justificaciones: eso va al diario o al hallazgo. **El código, las migraciones y las tareas no
citan el relevo** (se reescribe cada día y el puntero caduca): citan `F-NNN`, un ADR o
`DECISIONES-V1.md`.

### 11.3 Ritual de cierre (obligatorio, sin pedir confirmación)

1. `date -u` para la cabecera.
2. **Sobrescribir** `ESTADO-V1.md` entero, sin añadir debajo de lo de ayer: §1 lo comprobado
   hoy, cada fila con su «verificado contra»; §2 revisado contra el código; §3 lo que toca;
   §5 solo lo abierto (lo resuelto se borra, ya está en su hallazgo); §6 nunca vacía.
   **Máximo 150 líneas**: el hook `.githooks/pre-commit` rechaza el commit si pasa.
3. La historia del día, a `openspec/v1/diario/dia-NN.md`. Las decisiones nuevas, a
   `DECISIONES-V1.md`. Los hallazgos, fila en `findings-register.md` + `findings/F-NNN.md`.
   Las métricas, a `harness-metrics.csv`.
4. Commit y push. Si se tocó código, desplegar **y comprobarlo en su URL por contenido**, no
   por `HTTP 200` (`F-168`).
5. `git status --short` limpio. El relevo vive en `openspec/v1/`, nunca en la raíz.
