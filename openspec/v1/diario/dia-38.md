# Día 38 · 12-oct-2026

Sin sprints ni fecha de demo. Se cierra `F-249` entero (`MSG-03`): formulario, bloqueo por duplicado, `Crear consulta` y VERA.

## Mañana · guía de VERA
- La guía verificada aprende `Visibilidad` (INV-07) y los filtros, la búsqueda y las acciones de fila de `Inventario`; cada nombre citado está cubierto en `vera-prompt.test.ts`.
- Hallado de paso: la fila «Visibilidad del inventario:» de `Inventario` era un literal que no cambiaba con el modo guardado. Ahora lee el modo (`fetchStats`).

## `MSG-03` (`F-249`)
- **Duplicado.** La base ya tenía la guardia (índice único + helper, `0026`); lo que no coincidía era la regla (para siempre frente a «solo pendiente»). Decisión del PO: la de `MSG-03`. `0060`, aplicada en producción y en `bearingworld-e2e` y comprobada contra el catálogo; banco de esquema con dos bloques nuevos.
- **Formulario de consulta por la fábrica** (`MSG-03-FORM`): VERDE en 2 intentos, 0,060 USD, 0 líneas a mano. Capa de datos y contrato antes, a mano; referencia desechable 24/24. El rojo del intento 1 era `F-250`, no del artefacto.
- **Cableado a mano.** `Consultar` y `Consultar seleccionados` abren un formulario por fila, en cola (cambia el contrato de SRCH-01, 8 tests reescritos). `Crear consulta` en el hilo: selector de líneas de la contraparte + formulario. Paso 6 en el e2e de negociación.
- **VERA prepara consultas y ofertas.** El PO decidió que el precio es siempre manual. Dos herramientas sin campo de precio, solo con hilo abierto, nada se envía. Ensayo contra el modelo real: 8 de 8.

## Lecciones
- Un contrato de tarea no se reescribe para otra cosa: lo que no es de la tarea va a `*.fuera-de-contrato` (`F-251`).
- **Mirar la CI del push anterior antes de empujar otro.** Una CI roja dejó dos despliegues saltados sin que lo notara.
- No correr `vitest` mientras corre una suite e2e: 5 rojos por carga, que pasaron en solitario.
- Una prueba cuyo ejemplo es un fichero real se rompe cuando ese fichero cambia (`F-126`).
