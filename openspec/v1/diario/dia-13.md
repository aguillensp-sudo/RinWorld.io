# Día 13 de V1

**Día 13 de V1 · 10-sep-2026 · Estado: CERRADO.** Sesión de un solo punto: la pregunta
que `F-155` dejó abierta el Día 12 —*"¿hay OTROS `SELECT` bajo RLS con el mismo patrón en
el resto de `app/src/lib/`?"*— auditada contra las cinco llamadas RPC que tocan claves o
hilos. Sí había un tercero: el guardia *"ya has consultado"* de `create_inquiry`, que se
saltaba en silencio para cualquier EDITOR sin clave en el ítem de la consulta previa —
cerrado en `0026` (`F-156`), verificado contra un Postgres desechable ANTES de escribir la
migración y aplicado a las dos bases. El entregable 6 no se recomprobó ese día, a
propósito. El detalle completo vive en `git show 1c4e1ac:openspec/v1/ESTADO-V1.md`, no se
repite aquí.
