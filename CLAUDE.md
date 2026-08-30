# Bearingworld.io — MVP · Reglas de proyecto

Plataforma B2B de distribución de rodamientos industriales. Búsqueda conversacional
(**VERA**, Claude Sonnet 4.6) sobre arquitectura **zero-knowledge** E2EE para precio,
cantidad y negociación entre organizaciones. Metodología: SDD con OpenSpec.

Este fichero es el contrato de trabajo del MVP (plan de 15 días,
`openspec/mvp/Plan_MVP_Bearingworld_v1.0.md`). Se lee en cada sesión.

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

4. **Commit + push tras cada bloque completado, sin pedir confirmación.** El PO solo
   prueba vía la URL de GitHub Pages / entorno desplegado; un cambio sin pushear es
   invisible para él.

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
│   ├── mvp/             ← plan, métricas y registros del MVP
│   └── design-gui/      ← HTML aprobados + generador (read-only; sirve GitHub Pages)
├── app/                 ← NUEVO: aplicación React (Vite + TS)
├── harness/             ← NUEVO (día 4): grafo LangGraph
└── index.html, docs/…   ← sin cambios
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
  `SPEC-GAP` · `HARNESS` · `MODEL` · `INFRA` · `DESIGN`.

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

- `openspec/mvp/Plan_MVP_Bearingworld_v1.0.md` — plan maestro de 15 días.
- `openspec/mvp/Dia-01_Spikes_y_arranque.md` — plan del día.
- `openspec/design-gui/specs y html aprobados/notas/Status_bearingworld.io a 1 de Julio de 2026.md` — handoff de la fase de prototipado.
- `openspec/architecture/ADR-001_E2EE_Key_Backup_1.md` — decisión de cifrado (condiciona seguridad/mensajería).
- `openspec/gaps-register.md` · `openspec/product-decisions.md` — debates cerrados y abiertos.

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
- **Las Edge Functions no se despliegan con el push a git** y la app tampoco llega sola a
  Vercel (**F-091**, **F-072**). Cerrar un bloque que alguien va a probar en la URL
  desplegada incluye redesplegarlo o decir explícitamente que falta.

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

## Ritual de cierre de día (obligatorio, sin pedir confirmación)

Al terminar la jornada, antes del último commit:
1. Sobrescribir openspec/mvp/ESTADO.md: día, estado (verde/ámbar/rojo),
   qué se cerró, qué toca mañana, decisiones vivas, bloqueos, riesgo
   más cercano.
2. Volcar hallazgos a findings-register.md y métricas a harness-metrics.csv.
3. Si mañana es día 4, 8 o 9 — los de decisiones irreversibles — escribir
   además openspec/mvp/Dia-NN_*.md con el detalle. El resto de días van
   con la fila del plan maestro.
4. Commit + push.
