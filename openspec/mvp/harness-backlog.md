# Harness Backlog — MVP Bearingworld.io

Mejoras del arnés (nodo **Coder** + **Test-runner** + orquestación) detectadas durante las corridas.
Se **llena a partir del día 4**, cuando el arnés empieza a producir pantallas en serie.

Los hallazgos clasificados `HARNESS` en `findings-register.md` se promueven aquí como tareas
accionables (`B-00x`) cuando toca ejecutarlas.

| ID | Fecha | Origen | Mejora | Prioridad | Estado |
|---|---|---|---|---|---|
| B-001 | 2026-08-09 | F-010 | El CSV se **genera desde** el JSON del intento, y la tabla de precios a cero **peta** en vez de escribir `cost_usd: 0.0`. `harness/core/metrics.py` + `harness/core/pricing.py`. La cabecera se verifica antes de añadir la fila y un guardia rechaza cualquier valor con coma (`CLAUDE.md` §6). | Alta | **Hecho (día 4)** |
| B-002 | 2026-08-09 | F-011 | `cache_hit_pct` y `escalado_a_humano` como **columnas propias** del CSV, y `cost_usd_cold_equivalent` como campo del JSON. Las tres filas históricas rellenadas con su valor real. | Alta | **Hecho (día 4)** |
| B-003 | 2026-08-09 | F-005 | El reintento automático ante `finish_reason == 'length'` pasa al grafo (`harness/core/llm.py`), doblando presupuesto y sumando al intento el coste de **todas** las llamadas. **No consume intento del modelo:** es bug de arnés. | Alta | **Hecho (día 4)** |
| B-004 | 2026-08-09 | F-003 | Check de paleta sobre el output del Coder, validado contra **§1.1 + §1.4 + §1.5** vía `app/src/styles/tokens.css`. `harness/graph/checks.py`, con 8 pruebas — la mitad comprueban que **no** rechace output correcto. | Alta | **Hecho (día 4)** |
| B-005 | 2026-08-09 | F-015 | Un check que no se puede ejecutar cuenta como **rojo**, nunca como ausente. Una tarea sin tests de aceptación declarados es roja; un test declarado que no existe en el repo, también. | Alta | **Hecho (día 4)** |
| B-006 | 2026-08-09 | F-007 | Configurar `realtime.params.eventsPerSecond` por hilo en la app. No es del arnés, pero es la única semilla del día 1 que sigue sin dueño. | Media | Pendiente — día 7 (MSG-02) |
| B-007 | 2026-08-11 | F-042 | `--seco` tiene que correr **la tarea que recibe**, o dejar de aceptar el argumento. Hoy `run_dry(task)` ignora el parámetro y va contra su fixture de MSG-01, así que una tarea nueva con un `data_layer` inexistente o un `component_api` malformado pasa el seco y revienta con el modelo ya pagado. Mínimo: verificar que existen los ficheros de `inputs` y de `acceptance`, que `outputs` no está vacío y que `component_api` cubre cada `.tsx` de `outputs`. | Media | Pendiente |

| B-008 | 2026-08-11 | F-064 | **🔴 EL REINTENTO TIENE QUE ENSEÑARLE AL CODER EL CÓDIGO QUE ESCRIBIÓ.** Hoy `coder_node` arma el reintento con la tarea —idéntica a la del intento 1— y la salida cruda de los checks, **sin un turno de asistente con el artefacto anterior**: el modelo recibe `fichero.tsx(136,61): error TS…` sobre un fichero que no está viendo, y se le pide regenerar los ocho desde cero. **El estado ya lleva el dato** (`HarnessState.files`, declarado como *"{ruta: contenido} del último intento del Coder"*, y `coder_node` lo devuelve en cada vuelta): solo hay que volver a mandarlo. **Es la entrada más importante de este backlog — mientras no esté, ninguna cifra de "intentos hasta verde" dice nada del modelo, y el objetivo 4 se apoya justamente en esa cifra.** El experimento que la cierra: aplicar el cambio y **relanzar MSG-02 con la misma tarea y el mismo contrato** — misma entrada, único cambio el bucle. ~$0,07 y 20 minutos. | **Máxima** | Pendiente — aplazada por el PO el 11-ago |

## Semillas ya identificadas (apuntadas, no accionar hoy)

Quedan en `findings-register.md`; se convertirán en entradas `B-00x` a partir del día 4:

- **F-003** — definir los tokens neutros que faltan como **variables CSS** y añadir en el Test-runner
  un check que rechace hex fuera de paleta.
- **F-005** — `max_tokens` alto por defecto para modelos de razonamiento y auto-reintento ante
  `finish_reason == length`.
- **F-007** — configurar `realtime.params.eventsPerSecond` por hilo en la app (no dejar el default).
- **F-010** — el nodo debe **fallar ruidosamente** si la tabla de precios está a cero o ausente,
  en vez de escribir `cost_usd: 0.0`; y `harness-metrics.csv` debe **generarse desde** los JSON de
  `metrics/`, no mantenerse a mano en paralelo (fue el CSV a mano el que acertó y el JSON de máquina
  el que falló — con el CSV generado, esa divergencia no puede existir).
- **F-011** — añadir `cache_hit_pct` como columna propia del CSV y, en el resumen de coste, reportar
  siempre **dos** cifras: la real de la corrida y la equivalente en frío.
