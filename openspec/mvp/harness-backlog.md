# Harness Backlog — MVP Bearingworld.io

Mejoras del arnés (nodo **Coder** + **Test-runner** + orquestación) detectadas durante las corridas.
Se **llena a partir del día 4**, cuando el arnés empieza a producir pantallas en serie. Hoy (día 1)
va vacío a propósito.

Los hallazgos clasificados `HARNESS` en `findings-register.md` se promueven aquí como tareas
accionables (`B-00x`) cuando toca ejecutarlas.

| ID | Fecha | Origen | Mejora | Prioridad | Estado |
|---|---|---|---|---|---|
| _(vacío — se llena desde el día 4)_ | | | | | |

## Semillas ya identificadas (apuntadas, no accionar hoy)

Quedan en `findings-register.md`; se convertirán en entradas `B-00x` a partir del día 4:

- **F-003** — definir los tokens neutros que faltan como **variables CSS** y añadir en el Test-runner
  un check que rechace hex fuera de paleta.
- **F-005** — `max_tokens` alto por defecto para modelos de razonamiento y auto-reintento ante
  `finish_reason == length`.
- **F-007** — configurar `realtime.params.eventsPerSecond` por hilo en la app (no dejar el default).
