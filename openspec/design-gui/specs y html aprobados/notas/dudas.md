# Dudas de producto · Junio 2026

> Análisis generado a partir de instrucciones_finalizacion_html.md · Sección "Dudas"
> No se ejecuta ninguna acción sobre estas cuestiones.

---

## INV-07 · Campo "Exclusión por organización" — ¿desplegable de selección?

**Pregunta:** ¿El campo "Exclusión por organización" debería llevar a un desplegable para seleccionar una organización existente?

**Análisis:**

Sí, lo recomendaría. Las razones:

1. **Consistencia con el modelo de datos:** Las organizaciones ya existen como entidades en la plataforma (ver DIR-01). Un campo de texto libre permitiría errores tipográficos que impedirían la exclusión real.
2. **UX:** Un desplegable con búsqueda (typeahead) permite al usuario localizar la organización sin recordar el nombre exacto.
3. **Opciones de implementación:**
   - **Opción A (recomendada):** Input con typeahead — el usuario empieza a escribir y aparecen sugerencias de organizaciones del directorio. Al seleccionar, guarda el `org_id`.
   - **Opción B:** Desplegable `<select>` completo — menos usable si hay muchas organizaciones.
   - **Opción C:** Campo de texto libre con validación backend — más simple pero propenso a errores.

**Decisión pendiente de Product Owner.**

---

## MSG-02 · Alteración de datos de oferta en un hilo ya existente

**Pregunta:** Si en el hilo entre dos empresas se altera el dato de una oferta ya realizada (cantidad, precio, etc.), ¿el sistema o VERA generan el cambio en la ficha de oferta o consulta correspondiente sin que el usuario la cambie manualmente?

**Análisis:**

Según `Módulo04_Mensajeria_v1.5.md` y la arquitectura E2EE de BearingNet:

- Las tarjetas de oferta son **mensajes cifrados E2EE** dentro del hilo. Una vez enviadas, son inmutables por diseño (el servidor nunca las ve en claro).
- Si un vendedor quiere modificar una oferta, la forma correcta es **enviar una nueva tarjeta de oferta** dentro del mismo hilo, que sustituye (o complementa) a la anterior. El estado del hilo pasaría de "CON OFERTA PENDIENTE" a un nuevo estado con la oferta actualizada.
- **VERA no puede modificar automáticamente** una oferta enviada, porque:
  1. El cifrado E2EE impide que el servidor (y por tanto VERA backend) acceda al contenido.
  2. Modificar mensajes ya enviados violaría la trazabilidad de la negociación.

**Recomendación:** Aclarar este comportamiento en el spec de MSG-02 y en el spec de MSG-03 (componente tarjeta de oferta): añadir que una oferta modificada se envía como nueva tarjeta con referencia a la anterior ("Oferta revisada · reemplaza a la anterior").

**No requiere cambio en el HTML actual.** Sí requiere actualización de spec funcional.

---

## SRCH-01 · Botón "Consultar seleccionados" — estado de pantalla tras pulsarlo

**Pregunta:** Cuando se pulsa "Consultar seleccionados", ¿en qué estado queda la visualización de pantalla?

**Análisis (basado en el HTML actual y el spec SRCH-01):**

El comportamiento implementado en el prototipo es:
1. Las filas seleccionadas pasan al estado `consulted` (fondo azul muy tenue, botón "Consultar" deshabilitado).
2. Los checkboxes se desmarcan.
3. VERA muestra confirmación: "Consultas enviadas a N distribuidores. Las respuestas llegarán a tu bandeja de Hilos."
4. El usuario permanece en SRCH-01 con los resultados visibles.

**¿Es correcto este comportamiento?** Es una decisión de producto. Alternativas:
- **A (actual):** Permanece en SRCH-01 con filas marcadas como "consultadas". Natural para consultas masivas.
- **B:** Redirige a MSG-01 (bandeja de hilos) después de enviar. Más inmediato pero interrumpe el flujo de búsqueda.
- **C:** Modal de confirmación antes de enviar, luego permanece en SRCH-01.

**Decisión pendiente de Product Owner.**

---

## SRCH-01 · Botón "Crear Watcher" — estado de pantalla tras pulsarlo

**Pregunta:** Cuando se pulsa "Crear Watcher", ¿en qué estado queda la visualización de pantalla?

**Análisis:**

El comportamiento implementado en el prototipo es:
1. Aparece un **toast** en la esquina inferior derecha: "Watcher creado para [criterios]. Te avisaremos cuando haya stock."
2. VERA confirma: "Watcher activado para [criterios]. Caduca en 30 días."
3. El toast desaparece tras 4 segundos.
4. La pantalla permanece igual — el usuario sigue viendo los resultados.

**Preguntas adicionales que derivan de esta acción:**
- ¿Dónde gestiona el usuario sus watchers activos? Actualmente no existe pantalla de gestión de watchers en el inventario de pantallas (no hay SRCH-04 ni equivalente).
- ¿Cómo se notifica al usuario cuando el watcher dispara? (Email, notificación in-app, etc.)

**Decisión pendiente de Product Owner.** Se recomienda añadir gestión de watchers al inventario de pantallas si esta función es prioritaria para V1.
