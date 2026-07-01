# Status Bearingworld.io — a 1 de Julio de 2026

**Documento de handoff entre agentes.** Escrito por Claude Code (Sonnet 5) al cierre de la fase de prototipado visual HTML, de cara al agente/pipeline que construirá el arnés de ingeniería (LangGraph + Claude Opus 4.8 + GLM-5.2) para la implementación real del producto.

---

## 1. Qué es Bearingworld.io (resumen de una línea)

Plataforma B2B de distribución de rodamientos industriales. Sustituye el formulario clásico de búsqueda (modelo BearingNet) por un agente conversacional (**VERA**, Claude Sonnet 4.6) con arquitectura **zero-knowledge** end-to-end encrypted para precios, cantidades y negociación entre organizaciones.

- **Repo GitHub:** `github.com/aguillensp-sudo/RinWorld.io` (el repo se renombró; el nombre de marca visible sigue siendo **Bearingworld.io** — ver §7).
- **GitHub Pages activo:** `https://aguillensp-sudo.github.io/RinWorld.io/`
- **Metodología:** Spec-Driven Development (SDD) con **OpenSpec** (Fission-AI).

---

## 2. Fase que se acaba de cerrar: prototipado visual HTML

Se ha completado el ciclo de **prototipado visual HTML/CSS** de las pantallas del producto — generación directa (sin pipeline LangGraph) por Claude Code, revisadas una a una por el Product Owner (Álvaro) y corregidas hasta aprobación. Estos HTML son **specs visuales de referencia** para el agente de implementación React — no son el código final, son el contrato visual/funcional que ese agente debe reproducir fielmente.

### 2.1 Pantallas aprobadas (HTML + spec)

Todas en `openspec/design-gui/specs y html aprobados/` (HTML en la raíz de esa carpeta; specs `.md` en la subcarpeta `specs/` — ver §6 reorganización).

| Código | Módulo | HTML | Spec `.md` | Notas |
|---|---|---|---|---|
| — | Sistema base | `Rinworld_app_shell.html` | `specs/Rinworld_app_shell_spec_3.md`, `specs/Rinworld_sistema_base_7.md` | Shell de referencia obligatorio — ver §7 proceso de actualización de shell |
| REG-00 | Onboarding | `REG-00 · FSR v1.0.html` | `specs/Rinworld_spec_REG-00.md` | Formulario solicitud de registro |
| REG-00-WAIT | Onboarding | `REG-00-WAIT · WAS v1.0.html` | `specs/Rinworld_spec_REG-00-WAIT.md` | Pantalla de espera de aprobación |
| REG-01 | Onboarding | `REG-01 · FRO v1.4.html` | `specs/Rinworld_spec_REG-01_5.md` | |
| REG-05 | Onboarding / E2EE | `REG-05 · E2EE v1.0.html` | `specs/REG-05.pdf` | Introducción E2EE — spec en PDF, no md |
| REG-06 | Onboarding / E2EE | `REG-06 · EBP v1.0.html` | `specs/Rinworld_spec_REG-06.md` | Establecer backup passphrase |
| REG-07 | Onboarding / E2EE | `REG-07 · GKB v1.0.html` | `specs/Rinworld_spec_REG-07.md` | Generación de claves |
| REG-09 | Onboarding | `REG-09 · ACT v1.0.html` | `specs/Rinworld_spec_REG-09.md` | Bienvenida y usuarios adicionales |
| FRU | Onboarding | `FRU · FRU v1.0.html` | `specs/Rinworld_spec_FRU.md` | Formulario usuario adicional |
| INVT-01 / REC-01 / SET-SEC-01 | Onboarding / seguridad | `INVT-01 · INV v1.0.html`, `REC-01 · REC v1.0.html`, `SET-SEC-01 · SSC v1.0.html` | `specs/Rigworld_spec_INVT-01_REC-01_SET-SEC-01.md` | Gestión invitaciones, recuperación de clave, cambiar passphrase — spec combinada |
| INV-01 a INV-04 | Inventario | `INV-01`…`INV-04 · INV v1.0.html` | `specs/Rinworld_spec_INV-01.md`…`INV-04.md` | |
| INV-07 | Inventario | `INV-07 · VIS v1.0.html` | `specs/Rinworld_spec_INV-07.md` | Vigente para V1 (DEC-001 revertida, ver §6). `INV-05` diferido a V2, `INV-06` reservado sin uso — ver §8 |
| SRCH-01 a SRCH-03 | Búsqueda conversacional | `SRCH-01`…`SRCH-03 · SRCH v1.0.html` | `specs/Rinworld_spec_SRCH-01.md`…`SRCH-03.md` | SRCH-01 tuvo un bug de navegación corregido — ver §9 |
| MSG-01 a MSG-03 | Mensajería E2EE | `MSG-01`…`MSG-03 · MSG v1.0.html` | `specs/Rinworld_spec_MSG-01.md`…`MSG-03.md` | |
| VND-01 | Mensajería / vendedor | `VND-01 · VND v1.0.html` | `specs/Rinworld_spec_VND-01.md` | Decisión de producto: solo metadatos, ver §7 |
| DIR-01, DIR-02 | Directorio empresas | `DIR-01`, `DIR-02 · DIR v1.0.html` | `specs/Rinworld_spec_DIR-01.md` (spec combinada) | |
| FORO-01 a FORO-03 | Foro comunidad | `FORO-01`…`FORO-03 · FORO v1.0.html` | `specs/Rinworld_spec_FORO-01.md`…`FORO-03.md` | |
| ADMIN-01, ADMIN-02 | Panel operador | `ADMIN-01`, `ADMIN-02 · ADMIN v1.0.html` | `specs/Rinworld_spec_ADMIN-01.md` (+`_1.md`), `ADMIN-02.md` | |
| **PANEL-01** | **Dashboard de inicio** | `PANEL-01 · PANEL v1.0.html` | `specs/Rinworld_spec_PANEL-01.md` | **Última pantalla construida (1 Jul 2026)** — ver detalle abajo |

**PANEL-01 (recién aprobada):** dashboard "Mi Panel", punto de entrada tras login. 4 cajas obligatorias (Ofertas pendientes → VND-01, Consultas sin respuesta → SRCH-01, Inventario → INV-01, Hilos sin leer → MSG-01) + caja "Resumen mes" a ancho completo (Ofertas Aceptadas / Ofertas Realizadas / Consultas Realizadas) + caja "Favoritos recibidos". `nav.js` actualizado: el ítem "Panel" del nav/sidebar en **todas** las pantallas apunta ahora a PANEL-01 (antes apuntaba al shell base).

### 2.2 Sistema de diseño — CERRADO

- **Tipografía:** Montserrat 700 (títulos) · Montserrat 600 uppercase (eyebrow) · Inter (body/labels/inputs) · IBM Plex Mono (referencias, hints, timestamps).
- **Paleta:** Deep Steel Dark `#07111F`/`#111827` (brand+nav) · Deep Steel `#1B2537` (sidebar) · Warm Cream `#FAF8F4` (VERA) · Cold White `#F1F3F6` (contenido) · Brass `#B8924A` (acentos VERA) · Calibration Blue `#2563EB` (acciones primarias) · Steel Mist `#6B7A99` (texto secundario).
- **Shell:** brand bar 24px + nav bar 72px + sidebar overlay (no empuja layout) + contenido 67% + VERA 33% (colapsable a 32px, redimensionable hasta 50%, arrastrable por el borde izquierdo).
- Proceso exacto de aplicación de shell a una pantalla nueva/antigua: ver §7.

---

## 3. Documentos de referencia — árbol completo

### 3.1 Funcionales (origen del producto, en `docs/`)
- `Rinworld.io_PRD_v1.1.md` — PRD maestro
- `Rinworld_Funcional_Modulo00_ArquitecturaIA_v1.1.md` — VERA / arquitectura de IA
- `Rinworld.io_Funcional_Modulo01_Onboarding_v1.5.md`
- `Rinworld.io_Funcional_Modulo02_Inventario_v1.3.md`
- `Rinworld.io_Funcional_Modulo03_Busqueda_v1.6.md`
- `Rinworld.io_Funcional_Modulo04_Mensajeria_v1.5.md`
- `Rinworld.io_Funcional_Modulo05_Logistica_v2.0.md`
- `Rinworld.io_Funcional_Modulo07_Billing_v1.1.md`
- `Rinworld.io_Funcional_Modulo08_Foro_v1.1_1.md`
- `ADR-001_E2EE_Key_Backup_1.md` — decisión arquitectónica del cifrado E2EE (documento **mandatorio**, condiciona toda la Capa de seguridad/mensajería)
- `Rinworld.io_Inventario_Pantallas_v1.1.md` (+ `.docx`) y `Bearingworld_io_Inventario_Pantallas_v1_2.docx` — inventario maestro de pantallas
- `Rinworld.io_TechStack_AI_Costs_v1.1.md` — versión anterior de costes (superada por Stack Tech v1.2, ver 3.3)
- `agente_SDD.md`, `promp_arquitectura_stacktech.md` — notas de proceso

### 3.2 OpenSpec (specs técnicas vigentes y propuestas)
- `openspec/specs/` — 9 capabilities cerradas: `billing-subscription`, `community-forum`, `conversational-search`, `e2ee-key-management`, `inventory-management`, `messaging-and-negotiation`, `organization-directory`, `organization-onboarding`, `vera-agent`
- `openspec/changes/add-*` — una carpeta por capability con `proposal.md` + `specs/` (historial de cómo se llegó a cada spec)
- `openspec/architecture/ADR-001_E2EE_Key_Backup_1.md`, `openspec/architecture/ui-layout.md`
- `openspec/product-decisions.md` — **registro de decisiones de producto que divergen del funcional original** (trazabilidad). Actualmente: DEC-001 (eliminación botón "Simular visibilidad" / INV-07 asociada).
- `openspec/gaps-register.md` — **registro maestro de gaps técnicos abiertos y cerrados**, transversal a todas las capabilities. Ver §5.

### 3.3 Stack tecnológico (recién incorporados a `docs/`, aún no comentados en ninguna spec — leer antes de tocar infraestructura o pipeline)
- `docs/Stack_Tech_V1.2.docx` — **stack tecnológico aprobado v1.2**, sustituye a `TechStack_AI_Costs_v1.1`. 12 capas (datos, edge/CDN, orquestación de agentes de desarrollo, testing, observabilidad, costes de IA recalculados, etc.)
- `docs/Complement_Stack Tech_v1.2.docx` — anexo de estrategia de deployment/siembra de mercado (anillos concéntricos, KPI de densidad de stock)

**Lo más relevante de Stack Tech v1.2 para el próximo agente — Capa 6, Orquestación de agentes de desarrollo (decisión CERRADA):**
- **LangGraph** como orquestador del pipeline de implementación (subfases E/F del SDD).
- **Arquitectura de dos modelos:**
  - **Claude Opus 4.8** → nodos Planner, Evaluator/exit-criteria, Escalation (human-in-the-loop), Reviewer (coherencia con OpenSpec).
  - **GLM-5.2** (Z.AI, 753B MoE, contexto 1M, vía DeepInfra, $1,20/$3,00 por M tokens input/output) → nodos Coder (implementación) y Test-runner (loop de verificación con Playwright/tests).
- Verificación cerrada por Playwright (E2E) + suite de tests (Vitest + go test) + Snyk (SAST/SCA).
- VERA en producción usa **Claude Sonnet 4.6** (decisión distinta y ya cerrada — QA-A00-06) — no confundir con los modelos del pipeline de desarrollo.
- Infra: Cloudflare (edge) + Supabase (datos/auth/storage) + host de contenedores gestionado (Fly.io/Fargate) + Terraform + GitHub Actions.
- Testing: Vitest + go test + Testcontainers + Playwright + k6 (carga E2EE) + vectores criptográficos dedicados para ADR-001.
- Observabilidad: OpenTelemetry → Grafana Cloud + Sentry (con scrubbing agresivo — ningún dato E2EE ni passphrase puede aparecer en logs/trazas).

**Este es exactamente el "arnés" que el Product Owner ha indicado que se construye ahora.** El generador actual (`openspec/design-gui/generator/generate_screen.py`) es un prototipo previo de un solo agente (sin el reparto Opus/GLM) — habrá que evaluar si se reutiliza, se extiende, o se sustituye por el pipeline LangGraph de dos modelos descrito arriba.

---

## 4. Estado del repositorio y estructura de carpetas

```
BearingWorld.io/
├── README.md
├── index.html                          ← landing / entrada pública
├── docs/                                ← funcionales + ADR + stack tech (ver §3)
└── openspec/
    ├── product-decisions.md
    ├── gaps-register.md                 ← fuente única de verdad de gaps (ver §5)
    ├── architecture/
    ├── specs/                           ← 9 capabilities OpenSpec cerradas
    ├── changes/                         ← historial de propuestas add-*
    └── design-gui/
        ├── Rinworld_handoff_claude_code.md   ← handoff ANTERIOR (chat → Claude Code, junio 2026 — parcialmente superado por este documento)
        ├── Rinworld_screen_spec_template_7.md
        ├── generator/generate_screen.py      ← generador LangGraph de un solo agente (prototipo previo)
        ├── Old/                              ← versiones descartadas
        └── specs y html aprobados/           ← CARPETA DE TRABAJO PRINCIPAL
            ├── *.html, *.png, nav.js          ← pantallas aprobadas + assets (rutas relativas — NO mover)
            ├── specs/                         ← specs .md/.pdf de cada pantalla (reorganizado 1 Jul 2026)
            └── notas/                         ← notas de trabajo, dudas, docx sin procesar (este documento vive aquí)
```

**Importante sobre `specs y html aprobados/`:** el 1 de julio de 2026 se reorganizó esta carpeta (antes tenía 77 archivos sueltos de 5 tipos distintos mezclados). Los HTML, PNG y `nav.js` se dejaron deliberadamente en la raíz porque usan **rutas relativas** entre sí (`nav.js`, `intentologo.png`, enlaces `window.location.href` entre pantallas) y ya están publicados en GitHub Pages con esas rutas — moverlos habría roto todos los enlaces en producción. Las specs `.md` y las notas de trabajo sí se movieron a subcarpetas porque no las carga el navegador.

---

## 5. Gaps abiertos — resumen (fuente de verdad: `openspec/gaps-register.md`)

| ID | Resumen | Estado |
|---|---|---|
| GAP-001 | Selección de adaptador Signal Protocol (`libsodium.js` vs `@privacyresearch/libsignal-protocol-typescript`) | ABIERTO — no bloqueante |
| GAP-002 | Política de fortaleza de passphrase (¿entropía mínima obligatoria, zxcvbn ≥3?) | ABIERTO — no bloqueante |
| GAP-003 | Parámetros Argon2id (m=65536, t=3, p=4) sujetos a revisión anual/por hardware | ABIERTO — no bloqueante |
| GAP-004 | Boundary conversational-search vs messaging-and-negotiation en "Consultar Seleccionados" | **CERRADO** — resuelto por PO, junio 2026 |
| GAP-005 | INV-01: chip "Desactualizados" filtra por CSS de antigüedad, no por campo Estado real (no existe ese valor en el modelo) | ABIERTO — no bloqueante |
| GAP-006 | SRCH-01: conversación demo de VERA incongruente con tabla vacía al acceder sin filtros | ABIERTO — no bloqueante |
| GAP-007 | PANEL-01: "Favoritos recibidos" y "Consultas Realizadas" (recibidas como proveedor) no tienen endpoint de backend definido | ABIERTO — no bloqueante |

Ninguno es bloqueante para arrancar la construcción del arnés, pero **GAP-001, 002 y 003 (todos sobre ADR-001/E2EE) deberían resolverse antes de que el pipeline llegue a la capability `e2ee-key-management`**, porque son decisiones de diseño criptográfico, no de implementación.

---

## 6. Decisiones de producto registradas (`openspec/product-decisions.md`)

- **DEC-001 — REVERTIDA (Julio 2026):** originalmente eliminaba el botón "Simular visibilidad" y la pantalla INV-07. Resuelto por el PO: **manda el HTML ya aprobado** — INV-07 (`INV-07 · VIS v1.0.html`) queda vigente para V1. `product-decisions.md` actualizado en consecuencia (tachado + nota de reversión, no se borra el histórico).

---

## 7. Reglas de trabajo validadas por el Product Owner (aplican a cualquier agente futuro)

1. **Commit + push inmediato tras cada cambio, sin pedir confirmación.** El PO solo puede probar vía la URL de GitHub Pages, nunca en local — cualquier cambio no pusheado es invisible para él.
2. **Nunca hardcodear API keys** — usar variables de entorno; el repo es público/compartido.
3. **Nomenclatura:** nombres de archivo en `Rinworld_*` (herencia del nombre de repo `RinWorld.io`), pero **todo el contenido visible al usuario dentro de las pantallas es siempre "Bearingworld.io"** (title, h1, textos, VERA, tooltips). Nunca reemplazar `Bearingworld.io` por `Rinworld.io` dentro del contenido.
4. **Logo:** usar `<img src="intentologo.png" style="height:46px;width:auto">` (archivo externo — funciona bien en GitHub Pages). El logo en base64 NO renderiza correctamente — no usarlo.
5. **Generación directa preferida** sobre pipeline de agentes cuando el contexto de spec ya está disponible — más rápido y sin pérdida de calidad (validado empíricamente en REG-00-WAIT y sucesivas). Esto es específico de la fase de prototipado HTML; **no aplica necesariamente al arnés de implementación real**, donde el pipeline LangGraph Opus/GLM sí es la decisión cerrada del Stack Tech v1.2.
6. **Proceso de actualización de shell** (para cualquier pantalla que deba alinearse al shell aprobado): copiar verbatim de `Rinworld_app_shell.html` — CSS de shell completo (bwshell, bwbrand, bwnav, bwsb, bwvera y sub-clases), brand bar (3 textos exactos: "ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY" / "CONNECT · TRADE · SECURE" / "INDUSTRIAL INTELLIGENCE NETWORK"), nav bar de 8 ítems + hamburguesa + logo, sidebar overlay (8 ítems + footer), VERA completo (resize, toggle, chat, input), y todo el JS de shell — conservando solo el contenido específico (`.bwcnt`) de cada pantalla. Aprobación pantalla por pantalla.
7. **Decisión de producto sobre VND-01 (Junio 2026):** metadata-only — los campos cifrados E2EE (precio, cantidad, plazo, transporte) nunca se muestran fuera del hilo cifrado en MSG-02. Este principio (RNG-VND-01) es el patrón a replicar en cualquier vista agregada que toque contenido E2EE.

---

## 8. Pendientes conocidos de la fase de prototipado (no gaps de producto, huecos de prototipo)

- **INV-05, INV-06 — resuelto (Julio 2026):** ambos códigos están correctamente **reservados y sin construir a propósito**, no son un hueco accidental (confirmado por `docs/Rinworld.io_Inventario_Pantallas_v1.1.md`, nota de inconsistencia junio 2026 + confirmación del PO):
  - **INV-05** = "Configuración de Carpeta Monitorizada" — **diferido a V2**, no se construye en esta fase.
  - **INV-06** = código **libre/sin asignar** en el inventario maestro; reservado por si en el futuro se decide dar pantalla propia a "Perfiles de Mapeo Guardados" (esa funcionalidad vive integrada como sección dentro de INV-04 en V1).
  - Se eliminó `specs/Rinworld_spec_INV-05.md` de la carpeta de trabajo: era la spec de diseño **incorrecta** de una versión previa (usaba el código INV-05 para "Perfiles de Mapeo Guardados" por error), que el propio inventario maestro ya declaraba retirada pero que seguía presente físicamente como basura documental.
- **`Rinworld_handoff_claude_code.md`** (el handoff anterior, de junio 2026): quedó parcialmente desactualizado por este documento — sigue siendo útil como referencia histórica del sistema de diseño, pero su sección "Specs de pantalla escritas (pendientes de HTML)" ya no refleja el estado real (todas esas pantallas se completaron después). No se ha borrado ni tocado.
- **`nav.js`** es un script compartido por todas las pantallas que simula la navegación del prototipo (mapea nav bar/sidebar a ficheros, y engancha flujos de click específicos por pantalla — filas de tabla, botones de acción). El agente de implementación React deberá sustituir esta navegación simulada por routing real; `nav.js` es *solo* andamiaje de prototipo, no debe traducirse literalmente a producción.

---

## 9. Incidentes recientes resueltos (contexto útil, no acción pendiente)

- **Bug de navegación en SRCH-01:** el checkbox de selección de fila disparaba por error la navegación a MSG-02 porque `nav.js` enganchaba el click a nivel de `<tr>` completo y el evento del checkbox burbujeaba hasta la fila. Corregido excluyendo clicks originados en `input`/`button`/`.td-chk`/`.actions-cell`/`.cell-fav`. **Patrón a vigilar:** cualquier pantalla nueva con checkboxes/controles dentro de filas clicables en `nav.js` debe aplicar la misma exclusión.
- Se detectaron y corrigieron dos claves de API expuestas en texto plano en `.claude/settings.local.json` (LangSmith, Anthropic) — el archivo está en `.gitignore` global y nunca llegó a GitHub, pero **se recomendó rotar ambas claves** por higiene; pendiente de confirmar si el PO las rotó.

---

## 10. Qué necesita el siguiente agente para arrancar

**Lectura obligatoria, en este orden:**
1. Este documento.
2. `docs/Stack_Tech_V1.2.docx` + `docs/Complement_Stack Tech_v1.2.docx` — arquitectura y pipeline a construir.
3. `openspec/architecture/ADR-001_E2EE_Key_Backup_1.md` — condiciona toda decisión de seguridad/mensajería.
4. `openspec/specs/` (las 9 capabilities) — contrato funcional-técnico cerrado que el código debe cumplir.
5. `openspec/gaps-register.md` y `openspec/product-decisions.md` — para no repetir debates ya cerrados ni ignorar los abiertos.
6. Los HTML de `specs y html aprobados/` como referencia de UI/UX pantalla por pantalla, junto con su spec `.md` correspondiente en `specs/`.

**Antes de escribir el primer nodo del grafo LangGraph:** confirmar con el Product Owner si se reutiliza `generate_screen.py` como base, o se construye desde cero el pipeline de dos modelos (Opus 4.8 orquestador / GLM-5.2 ejecutor) descrito en la Capa 6 del Stack Tech v1.2 — esa decisión de arranque no está tomada todavía.

---

*Status Bearingworld.io · 1 de Julio de 2026 · Escrito por Claude Code (Sonnet 5) para handoff al siguiente agente.*
