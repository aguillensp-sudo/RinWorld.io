# ESTADO · V1 Bearingworld.io

**Aviso** El trabajo vive en `C:/Users/admin/proyectos/Bearing.io/BearingWorld.io`, rama
`mvp/bootstrap`. Si te lanzan en un worktree `claude/…`, **comprueba que tiene `harness/`,
`app/` y `supabase/` antes de nada** — un worktree de una rama antigua parece el repo bueno
y no lo es. Pasó el 25-ago.

> 🔑 **¿Vas a tocar Supabase? Lee `CLAUDE.md` §10 ANTES de la primera consulta.**

> **Qué es este fichero.** El relevo diario de V1. Se sobrescribe al cierre de cada día
> operativo. Lo primero que lee cualquier sesión nueva, humana o agente.
>
> **Lo permanente NO vive aquí:** el plan está en `openspec/v1/`, las decisiones de
> arquitectura en `docs/ADR-*.md`, el acta del MVP en `openspec/mvp/CIERRE-MVP.md`, y el
> histórico en git y en `findings-register.md`.

---

## ⚠ Las tres reglas de este fichero

Salen de errores cometidos, no de teoría. Cada una tiene su cadáver detrás.

**1 · Cita, no parafrasees.** Los valores de estado y las asignaciones de modelo se copian
del documento cerrado **con el puntero al lado** (`F-012`).

**2 · Un estado que este fichero afirme se comprueba EL DÍA que se escribe, contra el
código o contra la base — no contra otro documento.** El 25-ago se descubrió que tres
documentos llevaban **diez días** diciendo que `B-008`, `B-009` y `B-010` estaban
pendientes cuando se habían cerrado el 12-ago. El error se propagó al acta de cierre, al
plan de V1 y a un encargo que estuvo a punto de lanzarse. **Ningún documento es fuente de
verdad sobre el código. Solo el código lo es.**

**3 · La fecha se lee de la máquina, nunca de memoria.** El día 14 del MVP se fechó a sí
mismo un día por delante y esa hora de diferencia es exactamente lo que ocultó `F-109`
durante dos jornadas. El 25-ago volvió a pasar por el otro lado: tres documentos se
fecharon tres días atrás. **`date -u` antes de escribir la cabecera.**

---

**Día 1 de V1 · 25-ago-2026 · Corriente A arrancada · Estado: VERDE**

Primer día operativo de V1 después del cierre del MVP (18-ago). Se han cerrado las dos
piezas que quedaban del instrumento y se ha corregido un error de medición que venía del
MVP. No se ha tocado producto: esto es todavía fábrica.

---

## 1 · Qué se ha comprobado hoy, y contra qué

| Afirmación | Verificado contra | Resultado |
|---|---|---|
| Tabla de precios actualizada | `harness/core/pricing.py` en la punta | `0.014 / 0.44 / 1.32` + `PRICE_TABLE_DATE = 2026-08-25` |
| El aviso de caducidad funciona | Test `test_pricing_date_guard` | Avisa a 100 días, calla a 10, **no bloquea** |
| Manifiesto existe y fija versión | `harness/requirements.txt` | `langgraph==1.2.6`, versión exacta instalada |
| El arnés arranca desde entorno limpio | `python -m harness.graph.run … --seco` en venv nuevo | Exit 0, cero llamadas al modelo |
| El CSV histórico sigue intacto | `git log -- openspec/mvp/harness-metrics.csv` | Último cambio 13-ago. No se ha tocado |
| `B-008`, `B-009`, `B-010` cerrados | Código de `coder.py`, `test_runner.py`, `metrics.py` | Cerrados el **12-ago 10:12** en `e58fa9b` |
| La remedición se hizo | `harness-metrics.csv`, dos filas consecutivas | VND-01: escalado en 3 → **verde 4/4 en 2** |

**El dato del día, y hay dos métodos independientes que coinciden:** las 30 filas
históricas, recalculadas con la tabla vigente, suman **1,884333 USD** frente a los
**0,411464** registrados. Factor **4,58×**. Calculado por el agente reconstruyendo
`cache_hit`/`cache_miss` desde el CSV, y por separado por la Dirección Técnica: **1,8843**.
Coinciden a la cuarta cifra.

> **El CSV histórico NO se recalcula.** Se queda con la tabla con la que se midió, y ahora
> cada JSON nuevo lleva su `price_table` con fecha. La trazabilidad vale más que la
> coherencia cosmética.

---

## 2 · Dónde estamos, por corriente

### Corriente A · Núcleo — EN CURSO

| Pieza | Estado |
|---|---|
| `B-009` ruido en el feedback al generador | ✅ 12-ago · `e58fa9b` |
| `B-008` el reintento enseña el código anterior | ✅ 12-ago · `e58fa9b` |
| `B-010` el JSON guarda el contenido, no solo rutas | ✅ 12-ago · `e58fa9b` |
| Tabla de precios con vigencia | ✅ 25-ago · `ecb792c` |
| Manifiesto de dependencias | ✅ 25-ago · `f47e11a` |
| **Instrumentar el coste de orquestación** | 🟠 **Pendiente — y sigue sin diseño** |
| **Convertir la observación en medición** | 🟠 **Pendiente** |
| Fundación V1 (entornos, ADR-002, índice, residencia) | ⚪ No empezada |

### Corriente B · Fábrica — NO ABIERTA

Se abre cuando la corriente A publique los contratos de datos. Límite escrito: **máximo
cuatro agentes de construcción concurrentes**.

### Corriente C · Verificación — NO ABIERTA

Utillaje externo instalado y endurecido el 22-ago: modo aislado, commit fijado en
`85fd9db5`, los cinco interruptores de red apagados.

---

## 3 · Qué toca mañana, en este orden

1. **La medición, que es lo único que bloquea el Hito 1.** El bucle arreglado tiene **una**
   observación a favor —VND-01— y `F-097` dice que una pasada no es una tendencia. Correr
   dos o tres tareas del corpus con el bucle actual y comparar contra sus filas históricas.
   Céntimos. **No relanzar MSG-02**: `D-08-02` le cambió el contrato y su tarea sigue
   declarando `SEND_DISABLED_REASON`, así que mediría el bucle y una tarea rancia a la vez.
2. **Decidir cómo se instrumenta el coste de orquestación.** Es una conversación, no un
   encargo: hay que elegir entre consola de facturación, envoltorio propio, o estimación
   declarada. Hasta entonces, la partida de 1.500–4.500 € del plan es la cifra más floja
   que contiene.
3. **`B-007`** — `--seco` tiene que correr la tarea que recibe, o dejar de aceptar el
   argumento.

---

## 4 · Decisiones vivas

| # | Decisión | Dónde |
|---|---|---|
| **ADR-002** | Ámbito de visibilidad por usuario. **Diez decisiones, seis invariantes.** Entra en la fundación, no después | `docs/ADR-002_*.md` |
| **El hilo no es concepto visible** | El usuario ve «mi conversación con tal empresa». MSG-01 y MSG-02 no se titulan por hilo | ADR-002 §6 |
| **VERA en producción** | **Sonnet 5** vía Vertex AI europeo. No DeepSeek: sin acuerdo de tratamiento y entrena por defecto | Plan §4.2 |
| **Generador de código** | DeepSeek V4 Flash **vía Microsoft Foundry, zona UE**. Nunca toca criptografía, reglas de acceso, claves ni datos de cliente | Plan §4.3 |
| **Revisión multiagente** | Sobre esquema, criptografía y capa de datos. **Nunca sobre cada pantalla** — el coste por pasada lo desaconseja | Plan §5.4 |
| **Utillaje externo** | Modo aislado, commit fijado, interruptores apagados. Nunca modo equipo | Plan §5.4 |
| **Cláusula de parada** | Todo encargo lleva la instrucción de detenerse si el diagnóstico no cuadra con el código | Plan, Anexo B |
| **Cuatro agentes máximo** | En construcción concurrente. Los de verificación no cuentan | Plan §6.2 |
| **El CSV histórico no se recalcula** | Cada corrida conserva la tabla con la que se midió | 25-ago |
| **Precios del generador** | `0.014 / 0.44 / 1.32`, vigentes a 25-ago. `check_prices()` avisa a los 90 días | `pricing.py` |

---

## 5 · Bloqueos y deuda conocida

| | Qué | Quién lo quita |
|---|---|---|
| 🟠 | **`test_c2_paths` falla siempre**, no es intermitente. Asume que C2 pasa rutas a Playwright, pero `D-09-03(a)` del 12-ago decidió que corra la suite entera sin rutas. **El test no se actualizó el mismo día que la decisión.** Encontrado de pasada el 25-ago | Un encargo aparte, pequeño |
| 🟡 | **`F-073`** · la CLI de Supabase ve la organización equivocada. No bloquea porque el MCP llega, pero depender de eso es depender de la suerte | Álvaro: re-loguear y `link` |
| 🟡 | **Nada despliega solo.** Si se toca código, se despliega **y se comprueba en la URL** | Se cumple cerrando con el despliegue hecho |
| 🟡 | **Vercel sigue en plan gratuito**, que prohíbe uso comercial. Riesgo aceptado por el PO el 18-ago hasta después de la reunión. **Sigue abierto** | Álvaro: 20 $/mes |

---

## 6 · Lo que este fichero NO sabe

Sección obligatoria. Si está vacía, no se ha pensado lo suficiente.

- **Cuánto cuesta realmente la orquestación.** No se mide en ninguna parte. Es la cifra más
  floja del plan y lo dice el propio plan.
- **Si el bucle arreglado mejora de verdad la métrica.** Hay una observación, no una
  medición.
- **Si `visibility_scope` y la lista derivada de conversaciones aguantan bajo carga.** Se
  mide en el Hito 6 y no antes. El riesgo está escrito en ADR-002 §D-1.
- **Qué pasó en la reunión con el socio del 20-ago.** No hay ni una línea en el repo.
- **El estado de la CI.** No se ha comprobado hoy contra Actions.

---

## 7 · Ritual de cierre — cómo se sobrescribe este fichero

Cinco pasos. Se ejecutan **todos** o el relevo no vale.

1. **`date -u`.** La cabecera lleva la fecha de la máquina, nunca la recordada.
2. **Rellenar §1 comprobando, no recordando.** Cada fila necesita su columna «verificado
   contra». Si no puedes escribir contra qué lo comprobaste, no lo escribas.
3. **Revisar §2 contra el código**, no contra el §2 de ayer. Toda pieza marcada como
   pendiente se comprueba en el fichero real ese mismo día. Es la regla 2 y costó diez días
   descubrir por qué existe.
4. **Rellenar §6.** Si está vacía, no se ha pensado lo suficiente.
5. **Hallazgos a `findings-register.md`, métricas a `harness-metrics.csv`, commit y push.**
   Si se tocó código, desplegar **y comprobarlo en su URL**.

---

## 8 · Cómo arrancar la sesión siguiente

Orden de lectura, y el orden importa:

1. **Este fichero.** Empieza por §6 —lo que no se sabe— y luego §3 —lo que toca.
2. **`openspec/mvp/CIERRE-MVP.md`**, y **lee primero su bloque de corrección**: el cuerpo
   del acta contiene tres afirmaciones falsas que la corrección desmonta.
3. **`docs/ADR-001` y `docs/ADR-002`** si vas a tocar criptografía, roles o mensajería.
4. **El plan de V1** en `openspec/v1/` para el porqué y el calendario.
5. **`CLAUDE.md`** — §1.6 autoría, §4 claves, §6 métricas, §10 Supabase.
6. **`findings-register.md`** nunca de corrido: por identificador, cuando algo te mande a
   uno.

---

*Día 1 de V1 · 25-ago-2026 · fecha leída de la máquina · estado del arnés verificado
contra el código de `mvp/bootstrap` el mismo día · Dirección Técnica, Nortex Systems*
