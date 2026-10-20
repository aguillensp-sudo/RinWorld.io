# Día 45 · 20-oct-2026

Una sesión, sin bloqueos del PO por delante («los pendientes siguen en manos de terceros»). Arranque desde el cierre
del día 44. Se propusieron cuatro líneas sin dependencias y el PO eligió dos y media.

- **`F-256` cerrado (`0068`, `cdefbe9`).** Tabla `public.vera_usage`, una fila por llamada al modelo con su `usage`, y
  cupo de 150 llamadas por usuario en 60 minutos deslizantes (`vera_abrir_turno` / `vera_cerrar_turno`). El proxy va a
  la base con el JWT del usuario y la clave anónima, nunca con la de servicio: D-09-05 se matiza. El 150 es propuesta
  de Claude Code por coste. Banco `08_vera_uso.sql`. Aplicada por el MCP y comprobada contra el catálogo.
- **Créditos de Anthropic agotados.** Las dos primeras preguntas del PO tras desplegar dieron «VERA no ha podido
  responder»: el log de la función traía el 400 de saldo insuficiente. Quedaron como dos filas `ok = false`, que de paso
  probaron el cierre de turno con fallo del modelo. El PO recargó y la siguiente pregunta registró dos llamadas: 0,051 $
  (escritura de caché tras el despliegue) y 0,009 $. Con la caché caliente, una pregunta con herramienta ronda 0,014 $.
- **Matriz: los 4 SIN_PRUEBA, a prueba (`76b09ba`).** `09_sin_prueba_sql.sql`: suspender no purga nada por las dos vías
  (`automatic-suspension#3`, CUBIERTO) y el tope de 500.000 líneas bloquea subida y publicación (`inventory-line-lifecycle#3`,
  PARCIAL: falta el aviso al administrador). En el prompt de VERA la regla de ambigüedad no ponía tope a las opciones;
  se añadió «nunca ofrezcas más de tres a la vez». De paso, la nota de `passphrase-rotation#2` tenía un `;` suelto y la
  fila salía con 9 columnas.
- **Dos e2e (`9eab663`).** `key-generation#2` CUBIERTO: Argon2id real en ~260–410 ms, sin tareas largas y con 17 ms de
  hueco máximo de `requestAnimationFrame`, con control positivo de 300 ms. `batch-search#1`: las 50 se resuelven, pero
  el tope de 5 s no se cumple → `F-274`.
- **`F-274`, de síntoma a causa.** Primero se atribuyó a la base y se corrigió: sus logs dan 20–45 ms por petición. La
  traza de Playwright lo pone en la latencia (dos viajes seguidos por referencia, ~400 ms, 10 rondas) más paradas de la
  instancia; se descartaron la cola del navegador y el refresco del token. Los favoritos se pedían 51 veces: ahora una
  por lote (`3c24417`), con un tercio menos de peticiones y sin mejora de tiempo demostrable. **El PO aceptó el tope
  como divergencia.**
- **Error propio: colisión con la CI (`F-262`).** El A/B de los favoritos se lanzó justo después de empujar `4f4f8a7` y
  se solapó con su job e2e (09:02–09:11 UTC): rompió `zz-h5-negociacion` (run `39397390184`) e invalidó 4 de las 6
  medidas. No se miró `gh run list --status in_progress` antes de esa corrida. Queda en memoria como regla.
- **La suite e2e local de la mañana** dio 164 verdes y 9 rojos, todos búsquedas colgadas en «Buscando...» en
  `bearingworld-e2e`, también sin el lote corriendo. La CI de los mismos commits salió verde.
- **No se tocó** Vertex, AWS, `search.ts` para `F-254`, ni las cuentas reales de JULSA. Sin llamadas al runner de VERA.
