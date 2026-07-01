# Inconsistencias detectadas · Junio 2026

> Generado durante la revisión de instrucciones_finalizacion_html.md

---

## INV-01 · Chips de tabla — lógica de filtrado "Desactualizados"

**Cambio solicitado:** Los chips deben filtrar la tabla.

**Inconsistencia:** El chip "Desactualizados (34)" filtra por la clase CSS `.age.warn` o `.age.danger` en la columna de antigüedad. Sin embargo, el estado correcto debería ser el campo "Estado" (Published/Draft/Archived) combinado con la antigüedad, pero no existe un estado "Desactualizado" como valor en la columna Estado. Se ha implementado el filtrado por indicador visual de antigüedad (warn/danger) como mejor aproximación. En implementación React se deberá usar un campo de backend específico.

---

## SRCH-01 · "Sin filtros al acceder" vs conversación de VERA activa

**Cambio solicitado:** Al acceder siempre sin filtros, orden por fecha más reciente.

**Inconsistencia menor:** Los chips de búsqueda se han eliminado al cargar, y el sidebar de filtros se ha limpiado. Sin embargo, la conversación de VERA en el panel derecho muestra un intercambio que referencia una búsqueda de "6205 2RS, mínimo 500 unidades, Europa". Esta conversación quedará incongruente con la pantalla vacía. Se mantiene la conversación de VERA tal cual (es contenido de demo) — en implementación React la conversación de VERA será real y no tendrá este problema.

---

## VND-01 · Botones "Ver Hilo" y "Ver Acuerdo" ya corregidos

**Cambio solicitado:** Vincular botones a su hilo correspondiente.

**Nota:** Este cambio ya estaba implementado en la sesión de trabajo anterior (commit previo). La columna Marca y el orden por fecha ya estaban también correctos en el código base — la columna Marca se ha separado en columna independiente según la instrucción.
