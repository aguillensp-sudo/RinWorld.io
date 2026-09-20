# Experimento de dos brazos · DeepSeek vs Atria sobre ADMIN-02

**Abierto el 20-sep-2026.** Pregunta del PO: *¿se puede acelerar la fábrica sin
comprometer el estándar?* Se mide con la misma pantalla, el mismo contrato y los mismos
checks, cambiando **solo el Coder**.

> **Estado: preparado, sin correr.** Falta `ATRIA_API_KEY` en el entorno de usuario. Todo
> lo demás está montado y probado en seco. Ver §8.

---

## 1 · Los dos brazos

| | Brazo **deepseek** (oficial) | Brazo **atria** (experimental) |
|---|---|---|
| Modelo | `deepseek-v4-flash` | `Atria-Dawn-Preview` |
| Quién lo hace | ATRIA / Shanghai AI Lab, 11-sep-2026. MoE de 744B sobre base GLM-5.2, licencia MIT | DeepSeek oficial |
| API | `https://api.deepseek.com` | `https://api.atria-asi.ai/v1`, compatible OpenAI |
| Clave | `DEEPSEEK_API_KEY` | `ATRIA_API_KEY` |
| Techo de salida | sin techo declarado (65536 de partida, dobla en truncado) | **65536 duro** (lo rechaza por encima) |
| Precio | tarifa publicada (0.014 / 0.44 / 1.32 USD por M) | **no publica tarifa**; se paga contra una cuota de 100 M tokens |
| Árbol | `.claude/worktrees/admin-02-code-generation-9a0220`, rama `claude/dual-agent-deepseek-experiment-93d0f4` → se sube a `mvp/bootstrap` | `.claude/worktrees/exp-admin-02-atria`, rama `exp/admin-02-atria` → **no se fusiona** |

**Por qué DeepSeek es el oficial y no se decide por resultados:** `ADMIN-02` es la sexta
pantalla, la de la **remedición obligatoria** (`UMBRAL-FABRICA-V1.md` §4). Las ocho cifras
del umbral se calibraron con el modelo del contrato (`CLAUDE.md` §3); si la sexta la
midiera otro modelo, la remedición mediría un cambio de modelo y no la fábrica. El brazo
de Atria es un experimento **al lado**, con su propia rama, y su artefacto no entra en
`mvp/bootstrap` salvo decisión explícita del PO.

Curiosidad que no cambia nada, pero conviene saber: Atria está entrenado sobre **GLM-5.2**,
que es justo el modelo que el plan original tenía para el nodo Coder antes de cambiarlo a
DeepSeek por coste (`F-001`, SP-1, 5-ago).

## 2 · Qué es idéntico, y qué no

**Idéntico, y esto es lo que hace que la comparación signifique algo:** la tarea
(`harness/tasks/ADMIN-02.json`, sin tocar), el prompt del sistema y del usuario, el
contrato de aceptación (58 pruebas de unidad + 12 e2e, escritas antes y que el Coder no
ve), los cuatro checks, el commit de partida (`2afa04c`), la siembra, `MAX_ATTEMPTS = 3` y
la regla de que el feedback del reintento es salida cruda.

**Distinto, y solo porque el proveedor obliga:**

1. **El techo de `max_tokens`.** Atria acepta hasta 65536, que es justo el presupuesto de
   partida del arnés. Así que **si su respuesta se trunca, no hay reintento posible**
   (F-005 dobla y doblar no cabe), mientras que DeepSeek tiene tres. No es un sesgo
   introducido por nosotros: es el techo del proveedor, y **si pasa hay que decirlo en el
   resultado**, porque una pantalla de ocho ficheros anda cerca (el peor intento medido
   del proyecto gastó 56 067 tokens de salida, `FORO-03`).
2. **El plazo de socket y el de pared.** DeepSeek manda líneas de keep-alive mientras
   genera, así que 300 s por operación de socket le sobran. Atria no documenta que lo
   haga: una generación larga sin un solo byte se vería como un **corte de conexión**, y
   F-119 manda reintentar — o sea, pagar otra vez. Por eso su brazo corre con
   `HARNESS_CODER_TIMEOUT=1500` y `--plazo 2400`. La `--sonda` mide la velocidad de salida
   real y dice si ese plazo aguanta.
3. **El precio.** Atria no publica tarifa, y registrar `0.0` está prohibido (`F-010`: un
   cero no se distingue de una llamada gratis). Su brazo usa un **precio-sombra**: la
   tarifa de GLM-5.2 en DeepInfra (1.20 in / 3.00 out USD por M, handoff del 1-jul-2026),
   por ser su modelo base. Viaja declarado en `price_table.note` de cada intento **y
   marcado en la fila del CSV** (`COSTE A PRECIO-SOMBRA: no es una factura`). El coste
   marginal real de este brazo es **cero** hasta agotar la cuota: la cifra que de verdad
   compara es **tokens**, no dólares.

## 3 · Cómo se aíslan dos corridas a la vez

El cerrojo de `F-121` es **por árbol**, así que no impedía nada entre worktrees. Lo que dos
árboles comparten no es el código: es **el puerto 4173 y la base de demo**. Con
`reuseExistingServer`, el segundo árbol habría probado el build del primero y firmado ese
veredicto como propio — `F-121` otra vez, y otra vez sin dar un solo error.

- **La batería de checks se serializa** entre árboles con un cerrojo del sistema operativo
  en el directorio común de git. Cubre C1 y C2 enteros, no solo el e2e: con 14 CPU
  lógicos, el `build` de un brazo compite con el vitest del otro, y **un test lento no
  falla distinto de un test roto**.
- **Lo que sí se solapa es la llamada al modelo**, que son los minutos que cuentan. Ahí
  está el paralelismo que se quiere medir.
- **La espera del turno se mide y se dice en el log.** No es tiempo del Coder ni de los
  checks, y se resta del tiempo de pared al comparar.
- **Si con el turno tomado algo sigue respondiendo en el 4173, la corrida para** (salida
  5) y vuelca lo medido por el mismo camino que el plazo de pared. Un rojo de
  infraestructura devuelto al Coder se paga como un intento y no mide nada.

## 4 · Qué se mide y de dónde sale

| Cifra | De dónde sale | Quién la produce |
|---|---|---|
| Intentos hasta verde · escalada | `openspec/mvp/harness-metrics.csv` de cada árbol, columna `corrida` = `brazo-<nombre>` | el arnés |
| Tokens in/out · caché · coste | la misma fila, derivada del JSON por intento | el arnés |
| Minutos de modelo | columna `minutos` (solo tiempo de llamada, no de checks) | el arnés |
| Tiempo de pared bruto y neto | `harness/metrics/ADMIN-02/brazo-*/ADMIN-02.log` (arranque, esperas de turno) | el arnés |
| Checks rojos / inejecutables | columna propia del CSV (`F-033`) | el arnés |
| **Líneas tocadas en la revisión a mano** | `harness-review.csv`, recomputable desde los dos commits | Claude Code |
| C5 «¿lo mantendrías?» | el PO, sobre cada artefacto | el PO |

## 5 · Lo que este experimento NO mide, y hay que decirlo al contar el resultado

1. **n = 1 por brazo.** Una corrida cada uno. Una diferencia de un intento puede ser el
   modelo o puede ser el día.
2. **La revisión a mano de los dos artefactos la hace el mismo agente que montó el
   experimento, y sabiendo cuál es cuál.** No es ciega.
3. **La cifra 7 del umbral (coste de orquestación) queda sucia para ADMIN-02**, y no por
   el segundo brazo: esta sesión ha hecho, además de lanzar, el cambio del arnés y su
   revisión. `ESTADO-V1` §3 pedía sesión limpia justo para evitarlo. Se declara y se
   excluye de la remedición, como ya pasa en `ADMIN-01`, `FORO-02` y `FORO-03`.
4. **Las dos ramas comparten máquina.** El turno serializa los checks, pero no el resto
   del sistema.
5. **La revisión adversarial del cambio del arnés quedó a medias**: 32 hallazgos, 7
   verificados (2 refutados) antes de agotarse el límite de uso. Los arreglados están en
   `2afa04c`; los que quedan vivos, en §7.

## 6 · Cómo se lanza

```bash
# en cada árbol, uno por brazo, a la vez
python -m harness.experimento.brazo deepseek harness/tasks/ADMIN-02.json
python -m harness.experimento.brazo atria    harness/tasks/ADMIN-02.json
```

El lanzador fija la configuración del brazo **antes** de importar el arnés, añade
`--corrida brazo-<nombre>`, y se niega a arrancar el brazo oficial si el entorno trae
variables del otro. Antes de gastar nada: `--seco` (valida la tarea, cero llamadas) y
`--sonda` (una llamada de prueba que mide velocidad de salida y forma de `usage`).

**Antes de lanzar:** resembrar `supabase/seed/demo_billing.sql` (las fechas envejecen), y
comprobar que no hay ningún servidor en el 4173.

## 7 · Riesgos conocidos que siguen vivos

- **429 no se reintenta.** Un `HTTPError` no se reintenta nunca (y con razón: reintentar
  una clave mala es gastar sin cambiar nada). Atria documenta 60 peticiones/minuto con
  `Retry-After`; el arnés hace ~1 por intento, así que el riesgo es bajo — pero si cae un
  429, la corrida muere. No se ha tocado: cambiar el reintento del cliente antes de la
  corrida oficial es tocar el instrumento por un caso improbable.
- **Truncado sin reintento en Atria** (§2.1).
- **`reasoning_content` se descarta.** Si Atria razona, esos tokens van en
  `completion_tokens` y encarecen/alargan su brazo sin aparecer como razonamiento. La
  `--sonda` dice si los devuelve.
- **Un `vite preview` huérfano** de una corrida cortada a lo bruto deja el 4173 ocupado y
  para la siguiente corrida (por diseño, salida 5). Se mata a mano.

## 8 · Bitácora

| Fecha | Qué |
|---|---|
| 20-sep-2026 | Arnés preparado (`2afa04c`), revisión adversarial y sus arreglos, dos árboles listos con dependencias instaladas, `--seco` verde en los dos brazos, pre-vuelo del árbol limpio (typecheck 0, 58 rojos y solo los de ADMIN-02, 878 verdes). **Pendiente: `ATRIA_API_KEY`.** |
