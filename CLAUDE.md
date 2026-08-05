# Bearingworld.io — MVP · Reglas de proyecto

Plataforma B2B de distribución de rodamientos industriales. Búsqueda conversacional
(**VERA**, Claude Sonnet 4.6) sobre arquitectura **zero-knowledge** E2EE para precio,
cantidad y negociación entre organizaciones. Metodología: SDD con OpenSpec.

Este fichero es el contrato de trabajo del MVP (plan de 15 días,
`openspec/mvp/Plan_MVP_Bearingworld_v1.0.md`). Se lee en cada sesión.

---

## 1. Reglas no negociables

1. **Ninguna API key en ningún fichero, nunca.** Todas viven en variables de entorno
   de usuario y se leen con `os.environ` / `process.env`:
   `ANTHROPIC_API_KEY` · `LANGSMITH_API_KEY` · `DEEPSEEK_API_KEY` ·
   `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY`.
   El repo es público/compartido: ni en código, ni en configs, ni en `.env` versionado.

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

**Regla de integridad, innegociable:** GLM nunca escribe los tests que lo evalúan. El
test es el contrato entre Planner y Coder; si el mismo modelo escribe prueba y código,
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
  tokens in/out, coste, intentos hasta verde, si escaló a humano, minutos. Cada reintento
  es una fila propia.
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
