# ESTADO · MVP Bearingworld.io

> **Fichero de relevo.** Lo primero que lee cualquier sesión nueva. Se sobrescribe al
> cierre de cada día — no se acumula histórico aquí (el histórico vive en git,
> `findings-register.md` y `harness-metrics.csv`).

**Día 1 de 15 · cerrado 5-ago-2026 · Estado: VERDE**

---

## Dónde estamos

Día 1 cerrado con los tres spikes en verde. El plan de 15 días sigue sin cambios.

| Spike | Resultado |
|---|---|
| SP-1 · Coder | **PASA 5/5.** `deepseek-v4-flash` convierte INV-01 a React con calidad utilizable. Entra al camino crítico. |
| SP-2 · WebCrypto | **PASA.** X25519 nativo disponible — alineado con ADR-001, sin caer a P-256. |
| SP-3 · Realtime | **PASA.** 20/20 inserciones, <1s, reconecta solo. |

También cerrado: `design-system.md` extraído, `CLAUDE.md` creado, los tres registros del
proyecto en marcha.

---

## Hoy toca — Día 2

**Objetivo:** esquema Supabase + RLS + auth de dos organizaciones · scaffold React+TS+Vite
con el shell · Vitest + Playwright en CI.

**Puerta de salida:** dos navegadores, dos cuentas, cada una entra y ve su propia sesión.
CI en verde.

### Las tres decisiones del día 2 — no improvisar

El día 2 es el más irreversible del sprint: el esquema lo lee todo lo que viene después y
cambiarlo el día 8 significa migración más reescritura. Estas tres se deciden antes de
escribir DDL:

> **Las tres se decidieron en la puerta del 6-ago-2026.** El detalle, columna por columna,
> vive en **`Dia-02_decisiones_esquema.md`** — ese es el documento contra el que se escribe
> el DDL. Resumen:

**1 · Frontera de cifrado.** Es RNG-VND-01 materializado en DDL, y va **por columna en las
dos tablas** — el catálogo también tiene una columna cifrada:

- **Cifrado (`bytea`)** — precio unitario, cantidad *de las tarjetas*, plazo, transporte,
  divisa, `valid_until`, notas y el cuerpo de los mensajes. **Y `unit_price` en la propia
  línea de inventario** (lo exige `inventory-management`, sin indexar).
- **Metadato en claro** — estado de la oferta, timestamps, participantes del hilo,
  referencia y marca. Es lo que permite que VND-01 y PANEL-01 muestren agregados sin romper
  el zero-knowledge, y lo que exige `RNG-MSG-02`: ninguna transición de estado descifra.
- **Trampa:** `quantity` va **en claro en el inventario** (obligatoria y buscable) y
  **cifrada en las tarjetas**. Mismo nombre, tratamiento opuesto.

Si esto se modela mal, el día 11 se abre el panel de vista-servidor delante del socio y se
ve texto plano donde debía haber cifrado. A esas alturas no hay arreglo rápido.

**2 · Catálogo buscable vs. negociación cifrada.** El inventario tiene que ser
**consultable entre organizaciones** — sin eso SRCH-01 no encuentra nada el día 6. Buscable:
`part_number`, `brand`, `quantity`, `location_country`, `product_family`, `status`,
`updated_at`. **Decidido: el precio queda fuera de la parrilla de SRCH-01** — se ve al abrir
la negociación (ya estaba en Out of Scope de `conversational-search`). INV-07 va en esquema y
RLS sin UI, pero la lista de exclusión es **tabla propia**: al volver a modo VISIBLE la lista
queda inactiva y no se borra.

**3 · Máquina de estados como restricción de base de datos**, no solo como diagrama. **Manda
el spec cerrado**, cuatro estados y la contraoferta como fila nueva:

`estado_oferta ∈ {Pendiente, Aceptada, Rechazada, Superada por contraoferta}`

`Superada por contraoferta` es **terminal**: la contraoferta es otra fila que nace
`Pendiente`, y la anterior no se reutiliza jamás — el historial se conserva. **Entra hoy
también `thread-lifecycle`** (`ABIERTO · CON CONSULTA PENDIENTE · CON OFERTA PENDIENTE ·
ACUERDO ALCANZADO · CERRADO SIN ACUERDO`) más los estados de la tarjeta de consulta, para que
el día 7 no pague una migración.

### Además, antes de empezar — ✔ HECHO 6-ago-2026

- ✔ **Atribución de autoría.** Regla escrita en `CLAUDE.md` §1.6: trailer
  `Co-Authored-By: deepseek-v4-flash <coder@harness.local>` para código del Coder, y
  **nunca** mezclar código del Coder con código a mano en el mismo commit (van en commits
  separados, para que el diff del segundo mida cuánto hubo que arreglar).
- ✔ **`0623451` NO se reescribe** — y queda documentado como precedente en **F-009**. Dos
  razones: ya está en `origin/mvp/bootstrap` (exigiría force-push) y **mezcla** salida del
  Coder con código a mano, así que ningún trailer único sería correcto. La autoría real del
  artefacto se traza por `files` en `attempt_1.json` y por la columna `ficheros` del CSV.
- ✔ **Columna `ficheros`** añadida a `harness-metrics.csv`.
- ✔ **Coste unificado en `0.003581`** (el CSV acertaba; el JSON tenía `0.0`). Recomputado
  con la fórmula de `run_deepseek.py`. Lo grave: falló el artefacto *de máquina* y acertó la
  copia *a mano* → **F-010**, y el CSV pasa a generarse desde los JSON.
- ✔ **Aviso de cache** en el CSV y en el JSON: 99,58% hit (18688/18767). En frío con los
  mismos tokens serían ~$0.006145 (×1,7), y SP-1 sólo generó **un componente**, no una
  pantalla → **F-011**. Para extrapolar a V1, cifra en frío.

---

## Decisiones vivas que condicionan el trabajo

| # | Decisión | Dónde |
|---|---|---|
| Coder | `deepseek-v4-flash`, no GLM-5.2/DeepInfra. Cambio por coste. | F-001 |
| Modelos | **Opus 4.8 / Claude Code** para esquema, RLS, Realtime, E2EE, máquina de estados y herramientas de VERA — y también para el **andamiaje del día 2**. El **Coder** (`deepseek-v4-flash`) para conversión de HTML→React, tests Playwright y catálogo sembrado; su primer trabajo es el día 3. **VERA en producción: Sonnet 4.6, fijo por contrato (QA-A00-06).** | Plan §1 + §7 · CLAUDE.md §3 |
| Arnés | Solo 2 nodos (Coder + Test-runner). Planner/Evaluator/Escalation **no** se construyen en el MVP. | Plan §6 |
| Integridad | El Coder **nunca** escribe los tests que lo evalúan. | Plan §6 |
| Alcance | 8 pantallas. SRCH-01 es la núcleo y no se recorta. Inventario sembrado, sin pantallas de importación. | Plan §9 |
| Monorepo | `app/` y `harness/` en este repo. Los HTML aprobados no se tocan. | Día-01 §1 |

---

## Pendiente de Álvaro

- **Secrets de GitHub Actions**, o el CI falla en el trabajo de e2e a propósito:
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `E2E_ALPHA_EMAIL/PASSWORD/ORG`,
  `E2E_BETA_EMAIL/PASSWORD/ORG`.
- **Diseño de la pantalla de login** (F-016). No existe entre los 32 HTML aprobados y es la
  primera que ve el socio. Hoy va andamiaje hecho con los tokens.
- **Los cuatro tokens neutros de fondo claro** (F-003): bordes, divisores, texto secundario
  sobre blanco y hover. INV-01 los necesita **mañana**; sin ellos el Coder vuelve a inventar
  grises.
- `auth_leaked_password_protection` está desactivado en Auth. ¿Se activa?

---

## Riesgo con la vista más corta

**Día 7 · MSG-02** es la pantalla más compleja del MVP y tiene margen para comerse dos
días. Si el día 7 no está, se simplifica el hilo.

---

## Punteros

| Fichero | Qué contiene |
|---|---|
| `Plan_MVP_Bearingworld_v1.0.md` | Plan maestro de 15 días. La referencia. |
| `Dia-01_Spikes_y_arranque.md` | Detalle del día 1 (cerrado). |
| `findings-register.md` | Hallazgos → objetivos 2 y 3. |
| `harness-metrics.csv` | Tokens, coste, intentos → objetivo 4. |
| `harness-backlog.md` | Defectos del arnés a corregir antes de V1. |
| `../architecture/design-system.md` | Contrato visual que lee el Coder en cada tarea. |
| `../../CLAUDE.md` | Reglas de proyecto no negociables. |

---

*Actualizado al cierre del día 1 · 5 de agosto de 2026*
