# Plan de desarrollo y pruebas · MVP Bearingworld.io

**Versión:** 1.0
**Fecha:** 4 de agosto de 2026
**Plazo:** 15 días
**Propósito:** demo funcional para socio potencial + piloto real del arnés de implementación (LangGraph · Opus 4.8 / DeepSeek-V4-Flash)

> **Actualización · 5-ago-2026 (SP-1).** El nodo **Coder** del arnés es **DeepSeek-V4-Flash**
> (`deepseek-v4-flash`, DeepSeek oficial, vía `DEEPSEEK_API_KEY`), no GLM-5.2/DeepInfra como se
> escribió el 4-ago. Cambio por coste (≈ $0.0036/pantalla en SP-1). **En todo el documento,
> donde diga "GLM-5.2" / "GLM" / "DeepInfra" como Coder, léase DeepSeek-V4-Flash.** Ver
> `findings-register.md` F-001.

---

## 0. Supuestos declarados

Confirmar o corregir antes de arrancar. Cambian el plan, no el detalle.

| # | Supuesto | Impacto si es falso |
|---|---|---|
| S1 | 15 días naturales desde el arranque, con dedicación intensiva | Reajuste completo del calendario |
| S2 | Claude Code ejecuta el desarrollo, Álvaro supervisa y prueba. Sin dev adicional | **CONFIRMADO** 4/8/2026 |
| S3 | Entran los dos diferenciadores: VERA (4 herramientas) y rebanada E2EE en cliente | **CONFIRMADO** 4/8/2026 |
| S4 | Cuentas pre-sembradas: **no** se construye el onboarding (REG-00 a REG-09) | +4 días si entra |
| S5 | Inventario pre-cargado: **no** se construyen las pantallas de importación (INV-02/03/04) | +2 días si entra |

> **Nota sobre S5.** En la conversación se planteó que ambos usuarios cargasen su inventario en vivo. A 15 días eso no cabe en el camino crítico. El inventario va sembrado. Si la carga en vivo es imprescindible para el relato comercial, hay que quitar otra cosa — la candidata natural es la contraoferta (§9).

---

## 1. Principio de reparto: qué hace el Coder (DeepSeek) y qué no

El objetivo 1 exige aplicar el arnés de verdad. El objetivo de la demo exige que funcione el día 15. Ambos se satisfacen con un reparto por **coste del fallo**, no por dificultad.

**DeepSeek-V4-Flash (nodo Coder del arnés) — trabajo de alto volumen, mecánico, con verdad de referencia visible:**

- Conversión de los HTML aprobados a componentes React. Hay 32 HTML aprobados: el resultado correcto es *visible*, un fallo se detecta en segundos y se reintenta barato.
- Traducción de escenarios GIVEN/WHEN/THEN de OpenSpec a tests Playwright.
- Generación del catálogo sembrado (200+ líneas de inventario verosímil).

**Claude Code / Opus 4.8 — arquitectura y piezas donde el fallo es caro o silencioso:**

- Esquema de datos, RLS y políticas de Supabase.
- Wiring de Realtime.
- Rebanada E2EE con WebCrypto.
- Máquina de estados de la oferta.
- Herramientas de VERA y su orquestación.

Este reparto **es** el criterio del stack v1.2 ("Opus para orquestación y decisiones de alto valor, GLM para ejecución de código de alto volumen"), no una excepción a él.

---

## 2. Día 1 — Tres spikes antes de escribir nada

Hay tres incógnitas que hoy son suposiciones y que, si fallan, invalidan el plan. Se resuelven el primer día, en unas dos horas cada una. **No se avanza hasta tenerlas.**

| Spike | Pregunta que responde | Criterio de éxito |
|---|---|---|
| **SP-1 · GLM** | ¿GLM-5.2 convierte un HTML aprobado a React con calidad utilizable? | Toma `INV-01 · INV v1.0.html` + su spec y produce un componente que renderiza reconocible. Se mide: intentos hasta verde, tokens, coste. |
| **SP-2 · WebCrypto** | ¿X25519 + AES-256-GCM en navegador, sin librería externa? | Cifrar y descifrar un objeto de oferta entre dos pares de claves generadas en dos pestañas. |
| **SP-3 · Realtime** | ¿Supabase Realtime propaga entre dos sesiones sin refrescar? | Insertar fila en una pestaña, verla aparecer en la otra en <1s. |

**Si SP-1 falla:** GLM sale del camino crítico y pasa a pista paralela de experimentación. El MVP lo construye Claude Code. Los objetivos 2 y 4 se cumplen igual — con datos de fallo, que también son datos.

**Si SP-2 falla:** cae S3 parcialmente. Se sustituye por cifrado simétrico simple, suficiente para el panel de vista-servidor.

**Si SP-3 falla:** cae el pilar de "dos usuarios interactuando". Es el spike más crítico y el menos probable que falle.

---

## 3. Sprint 1 · Días 1-5 — Cimientos y arnés v0

**Objetivo del sprint:** dos usuarios pueden entrar, ven inventarios distintos, y el arnés ha producido su primera pantalla.

| Día | Trabajo | Ejecuta |
|---|---|---|
| 1 | Los tres spikes. Decisión de continuidad. | Claude Code |
| 1 | Extraer `DESIGN_RULES` y `VERIFICATION_PROTOCOL` de `generate_screen.py` a `openspec/architecture/design-system.md` | Claude Code |
| 2 | Esquema Supabase + RLS + auth de dos organizaciones | Claude Code |
| 2 | Scaffold React+TS+Vite, shell de la app desde `Rinworld_app_shell.html`, Vitest + Playwright en CI | Claude Code |
| 3 | Catálogo sembrado: 200+ líneas curadas (§8) | GLM |
| 3 | **Pantalla de referencia a mano:** INV-01 completa con sus tests | Claude Code |
| 4 | **Arnés v0:** grafo LangGraph de 2 nodos — Coder (GLM) + Test-runner | Claude Code |
| 5 | Primera pantalla producida por el arnés: **MSG-01**. Registro de métricas. | Arnés |

> **Por qué MSG-01 es la primera del arnés y no SRCH-01.** La primera salida de GLM debe ser una pantalla representativa pero no crítica: MSG-01 es una lista, con estructura clara y fallo barato. SRCH-01 es la pantalla núcleo y la más delicada — entra en S2, con revisión a mano.

**Puerta de salida S1:** dos navegadores, dos cuentas, cada una ve su inventario. CI en verde. Una pantalla nacida del arnés, con su coste medido.

**Arquitectura desplegada en S1:**

- Proyecto **Supabase**: Postgres, Auth (email+password), RLS, Realtime habilitado sobre `threads`, `messages`, `offers`
- **Cloudflare Pages** — hosting del frontend (alineado con la capa edge del v1.2)
- **GitHub Actions** — Vitest + Playwright en cada PR
- **Runner del arnés** — Python local, LangGraph, trazas a **LangSmith**, DeepSeek-V4-Flash vía **DeepSeek oficial**, Opus/Sonnet vía **API de Anthropic**

> **Desviación registrada del stack v1.2:** no se despliegan contenedores gestionados (Fly.io/Fargate), Terraform, k6, Snyk ni Grafana. Disparador para incorporarlos: fin del MVP y arranque de V1. Registrar en `product-decisions.md` como DEC-002 para que no se convierta en deuda silenciosa.

---

## 4. Sprint 2 · Días 6-10 — Flujo completo

**Objetivo del sprint:** el ciclo consulta → oferta → aceptación funciona de punta a punta entre dos usuarios.

| Día | Trabajo | Ejecuta |
|---|---|---|
| 6 | **SRCH-01** — capa presentacional: chips editables, tabla de resultados, selección de filas | Arnés + revisión a mano |
| 6 | Máquina de estados de la oferta (§7) | Claude Code |
| 7 | MSG-02 (hilo) — la pantalla más compleja | Arnés + revisión a mano |
| 7 | Realtime: hilos y mensajes propagando entre sesiones | Claude Code |
| 8 | Rebanada E2EE: cifrado de campos de oferta en cliente | Claude Code |
| 8 | VND-01 (ofertas del vendedor, metadata-only por RNG-VND-01) | Arnés |
| 9 | Las 4 herramientas de VERA + Edge Function proxy | Claude Code |
| 9 | **SRCH-01** — cableado VERA↔chips: consulta en lenguaje natural → filtros → tabla | Claude Code |
| 9 | PANEL-01 | Arnés |
| 10 | Contraoferta / modificación de oferta | Claude Code |
| 10 | "Consultar Seleccionados": SRCH-01 → creación de hilo (GAP-004) | Claude Code |

**Puerta de salida S2:** un usuario busca, consulta, el otro recibe en tiempo real, oferta cifrada, contraoferta, aceptación. Feo pero completo.

**Arquitectura añadida en S2:**

- **Supabase Edge Function** como proxy de VERA hacia la API de Anthropic. La clave de Sonnet 4.6 **nunca** llega al navegador — punto no negociable, no es un detalle de MVP.
- **Canales Realtime** por hilo
- **WebCrypto** en cliente (sin infraestructura: claves en memoria de sesión, sin backup ni recuperación)

---

## 5. Sprint 3 · Días 11-15 — Endurecimiento y ensayo

**Objetivo del sprint:** que la demo no se rompa delante del socio.

| Día | Trabajo |
|---|---|
| 11 | Panel de vista-servidor (comprador vs. lo que almacena Postgres) |
| 11 | **Sesión de pruebas 1 — Álvaro** (§10) |
| 12 | Correcciones de la sesión 1. Curación del catálogo hacia el guion. |
| 13 | **Sesión de pruebas 2 — Álvaro**, flujo completo cronometrado |
| 13 | Entorno de demo aislado, con siembra congelada y reseteable |
| 14 | Correcciones finales. Congelación de código. |
| 15 | **Ensayo general** con el guion y las preguntas fuera de ámbito |

**Arquitectura añadida en S3:**

- **Proyecto Supabase separado para la demo** (o esquema aislado) con datos congelados y script de reseteo a estado inicial. Sin esto, cada ensayo deja la base sucia y el día de la reunión el estado no es el previsto. Es barato y evita el fallo más tonto posible.

---

## 6. Cómo se aplica SDD + TDD dentro del arnés

Esta es la parte que da valor al objetivo 1, y depende de una regla de integridad.

**La cadena:**

```
Spec OpenSpec (GIVEN/WHEN/THEN, ya escrita)
        ↓  Opus 4.8
Test de aceptación Playwright  ←── contrato, escrito ANTES del código
        ↓  GLM-5.2 (Coder)
Implementación
        ↓  Test-runner
Verde / rojo → feedback → reintento
```

**Hallazgo que hay que aprovechar:** vuestras specs OpenSpec ya están escritas en formato GIVEN/WHEN/THEN. Solo `vera-agent` tiene 31 escenarios. Ese formato mapea casi 1:1 a tests Playwright — el trabajo de traducción es mecánico, no creativo. Fue una buena decisión de la fase SDD y ahora se cobra.

**Regla de integridad, innegociable:**

> **GLM nunca escribe los tests que lo evalúan.** El test es el contrato entre Planner y Coder. Si el mismo modelo escribe la prueba y el código, la prueba se convierte en descripción de lo que hizo, no en verificación de lo que debía hacer. Ese es exactamente el fallo de `generate_screen.py`, donde un LLM revisaba la salida de otro LLM sin verdad de referencia.

**Qué nodos se construyen y cuáles no:**

- **En el MVP:** Coder (GLM) + Test-runner. Es donde hay verdad ejecutable.
- **Fuera del MVP:** Planner, Evaluator, Reviewer y Escalation. Sus umbrales se calibran con datos de fallo reales, que es justamente lo que este MVP va a generar. Construirlos ahora sería inventárselos.

En el MVP, la tarea la escribe Claude Code a mano en un formato fijo — que además es el borrador del contrato Planner→Coder de V1. Al final de los 15 días tendrás 10-15 tareas reales en ese formato: el mejor material posible para diseñar el Planner.

---

## 7. Máquina de estados de la oferta

Núcleo del flujo comercial y lo que distingue la demo de un catálogo.

```
BORRADOR → ENVIADA → ┬→ CONTRAOFERTADA → (vuelve a ENVIADA, otra parte)
                     ├→ ACEPTADA   (terminal)
                     ├→ RECHAZADA  (terminal)
                     └→ RETIRADA   (terminal, solo emisor)
```

Reglas: los campos comerciales (precio, cantidad, plazo, transporte) van **cifrados**; el estado y las marcas de tiempo son metadatos en claro. Es la aplicación directa de RNG-VND-01 y lo que permite que VND-01 y PANEL-01 muestren agregados sin romper el zero-knowledge.

---

## 8. Siembra del catálogo

200 líneas curadas rinden más que 2.000 aleatorias, pero hay que diseñarlas **hacia atrás desde el guion de demo**.

1. Decidir primero qué va a buscar el socio (referencia, cantidad, zona).
2. Sembrar el inventario de la organización vendedora para que ese resultado sea rico: varias ofertas, precios dispares, plazos distintos.
3. Sembrar el resto como ruido verosímil: fabricantes reales, nomenclatura real, precios coherentes con el mercado.
4. Solape deliberado entre ambas organizaciones para que la búsqueda cruce.

> Vuestro `Complement_Stack Tech v1.2` sitúa la **densidad de stock** como KPI de la estrategia de anillos concéntricos. Un catálogo pobre contradice visualmente la tesis que le estás vendiendo al socio.

---

## 9. Alcance: dentro y fuera

**Dentro (8 pantallas):** app shell · PANEL-01 · INV-01 · **SRCH-01** · MSG-01 · MSG-02 · VND-01 · panel vista-servidor *(nueva, no existe en los 32 HTML)*

> **SRCH-01 es la pantalla núcleo de la demo.** Es donde VERA convierte la consulta en lenguaje natural en chips de filtro editables sobre la tabla de resultados, y donde la selección dispara "Consultar Seleccionados" que abre el hilo (resolución de GAP-004). Sin ella no hay búsqueda conversacional que enseñar. Su spec: `Rinworld_spec_SRCH-01.md`.

**Fuera:** onboarding completo (REG-00…REG-09) · importación de inventario (INV-02/03/04) · **SRCH-02** (búsqueda por lotes) · **SRCH-03** (watchers) · INV-07 · foro · directorio · billing · admin · logística · recuperación de clave y passphrase · ADR-001 completo (backup, rotación, Argon2id) · roles y permisos · log de auditoría

> **Por qué SRCH-02 y SRCH-03 quedan fuera.** SRCH-02 (pegar 50 referencias desde el ERP) es comercialmente atractivo para un distribuidor porque toca su dolor diario, pero no demuestra ninguno de los dos diferenciadores y no forma parte del flujo entre dos usuarios. SRCH-03 (watchers) es peor candidato aún para una demo en vivo: su valor solo se aprecia con el paso del tiempo, que es justo lo que no hay en una reunión.

**Orden de recorte si el calendario se tensa** — de menos a más doloroso:

1. Contraoferta (queda oferta simple: aceptar/rechazar)
2. VERA baja de 4 herramientas a 2 (buscar + navegar)
3. PANEL-01
4. VND-01

**No se recorta nunca:** SRCH-01, el panel de vista-servidor y el Realtime. Son, respectivamente, la demostración de VERA, el argumento del zero-knowledge y la prueba de que dos usuarios interactúan de verdad.

---

## 10. Plan de pruebas de usuario — ejecuta Álvaro

Tres sesiones formales. Cada una necesita **dos navegadores con perfiles distintos** (o uno normal y otro en incógnito) para encarnar comprador y vendedor.

### Sesión 1 · Día 11 — Cimientos (45 min)

Se prueba que el flujo existe, no que sea bonito.

1. Entrar con ambas cuentas en paralelo
2. Comprobar que cada una ve solo su inventario
3. Buscar una referencia que sabes que existe en la otra organización
4. Lanzar consulta → confirmar que aparece **sola** en la otra pestaña
5. Enviar oferta → aceptarla
6. Abrir el panel de vista-servidor y verificar que los campos comerciales salen cifrados

**Qué anotar:** cualquier punto donde tengas que refrescar, esperar más de 2 segundos, o dudar de qué hacer a continuación.

### Sesión 2 · Día 13 — Flujo completo y cronometrado (90 min)

1. Recorrido completo dos veces seguidas, cronometrando cada tramo
2. **Interrogatorio a VERA**: 15 preguntas preparadas — 10 dentro de ámbito, 5 fuera
3. Contraoferta y modificación
4. Provocar el momento clave: *"VERA, ¿qué precio me han ofrecido?"* → debe responder que está cifrado extremo a extremo
5. Intentar romperlo: dos pestañas actuando sobre el mismo hilo a la vez

**Qué anotar:** toda respuesta de VERA que suene convincente pero que no puedas verificar contra un dato real. Es el fallo más peligroso de la demo (§11).

### Sesión 3 · Día 15 — Ensayo general (60 min)

Recorrido con el guion cerrado, en el entorno de demo, reseteando antes de empezar. Cronometrado. Con las preguntas fuera de ámbito incluidas a propósito.

### Registro de hallazgos

Todo lo que salga de las tres sesiones va a `openspec/mvp/findings-register.md`, con esta clasificación — que es lo que alimenta los objetivos 2 y 3:

| Clasificación | Destino |
|---|---|
| `SPEC-GAP` | Se traslada a la spec OpenSpec correspondiente, aunque esa capability no se haya implementado en el MVP |
| `HARNESS` | Va a `openspec/mvp/harness-backlog.md` → corrección del arnés antes de V1 |
| `MODEL` | Límite observado de GLM o Sonnet → afecta a la asignación de modelos del v1.2 |
| `INFRA` | Supabase, Realtime, Cloudflare |
| `DESIGN` | Divergencia respecto al HTML aprobado |

---

## 11. Instrumentación · Objetivo 4 (tokens y costes)

Se instrumenta **desde la primera ejecución del arnés**, no al final. Añadirlo después falsea los datos.

**Por cada tarea ejecutada, registrar:** id de tarea · pantalla o componente · modelo del nodo · tokens entrada/salida por nodo · coste calculado · intentos hasta verde · si escaló a humano · minutos de reloj.

Destino: `openspec/mvp/harness-metrics.csv` + trazas en LangSmith (ya está en vuestro entorno).

**Las tres métricas que importan de verdad para V1:**

1. **Coste por pantalla aceptada** — no coste por llamada. Incluye los reintentos fallidos, que es donde se va el dinero.
2. **Distribución de intentos hasta verde** — si la media es 1,5 el arnés es viable; si es 4, el cuello de botella es la spec, no el modelo.
3. **Porcentaje de tareas que requieren intervención humana** — define el ahorro real y calibra el umbral del futuro nodo Escalation.

Extrapolar de aquí a V1 con prudencia: el MVP no tiene E2EE completo, ni roles, ni las capabilities complejas. El multiplicador honesto se decide **con los datos delante**, no ahora.

---

## 12. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| GLM no da calidad utilizable | Media | SP-1 el día 1. Plan B: GLM a pista paralela, Claude Code construye. |
| VERA responde con seguridad datos inventados | **Alta** | Regla dura en system prompt + las 15 preguntas de la sesión 2. Ver abajo. |
| MSG-02 se come dos días | Media | Es la pantalla más compleja. Si el día 7 no está, se simplifica el hilo. |
| El día 15 llega sin ensayo | Media | El día 14 es congelación. Nada nuevo entra después. |
| La base de demo queda sucia del ensayo | Alta si no se aísla | Proyecto separado + script de reseteo (S3) |

**Sobre el riesgo de VERA — el más subestimado.** Sonnet 4.6 va a responder con fluidez impecable a cualquier cosa, tenga o no la herramienta para saberlo. Delante de un socio, el fallo no es el silencio: es afirmar con aplomo que hay 800 unidades disponibles en Polonia. Suena perfecto y nadie en la sala lo detecta. La única defensa real es que VERA responda **exclusivamente** desde el retorno de sus 4 herramientas, y que diga "no tengo ese dato" en cuanto salga de ahí. Eso se prueba en la sesión 2, no el día de la reunión.

---

## 13. Entregables al día 15

1. MVP funcional en el entorno de demo, con guion ensayado
2. `harness-metrics.csv` — datos reales de tokens, coste e intentos *(objetivo 4)*
3. `harness-backlog.md` — defectos del arnés a corregir antes de V1 *(objetivo 2)*
4. `findings-register.md` — hallazgos trasladados a las specs OpenSpec *(objetivo 3)*
5. 10-15 tareas reales en formato fijo — material de diseño del futuro nodo Planner *(objetivo 1)*
6. Suite de tests Playwright/Vitest — primer criterio de salida ejecutable del proyecto

---

*Plan MVP Bearingworld.io v1.0 · 4 de agosto de 2026*
