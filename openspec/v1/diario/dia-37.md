# Día 37 · 11-oct-2026

D5 del microplan de demo, adelantado al domingo. Cerrado al final de la sesión.

## D5
- Arreglos del ensayo 1: ninguno. No se recogió lista el 10-oct y el PO no tenía nada que añadir.
- Guion de la demo escrito (`v1/guion-demo-h5.md`): preparación, recorrido de 7 pasos con los nombres de los botones del e2e de H5, plan B,
  congelación y hoja de tiempos. Referencia propuesta, `6204` SKF: solo la tiene Rey. Leída `app.derive_thread_state` en `pg_proc`: una
  consulta nueva en un hilo con acuerdo no se bloquea, así que el hilo de un ensayo se puede reutilizar.
- Al empezar, producción no tenía ningún hilo entre Nakishita y Rey: el ensayo 1 no las enfrentó a ellas dos.
- Ensayo 2 hecho por el PO, «perfecto», sin incidencias. Se hizo entre **Fulano S.A** (BB, alta real del 10-oct, ADMIN `ACTIVE` con clave) y Rey
  Transmisiones, no con Nakishita como decía el guion. En `thread_items`: consulta respondida con oferta → oferta superada por contraoferta →
  contraoferta aceptada, `ACUERDO ALCANZADO` a las 08:37 UTC. No se cronometró ni consta la grabación de respaldo.
- El PO no tiene fecha para la demo: se levanta la congelación, se vuelve al plan normal y los datos se quedan (`DECISIONES-V1.md`).

## Lecciones
- El guion dio por hecho la pareja de empresas (Nakishita↔Rey) a partir del relevo, que solo decía «ensayo 1 hecho». La pareja real se supo
  consultando `thread_items`, no preguntando. La próxima vez, la base antes que el guion.

## MSG-03 por la fábrica (reabierto tras el cierre)
- El PO preguntó por `MSG-03`: nunca se había construido como tal (`F-249`). Las tarjetas eran la v1.0; la v1.2 son dos tablas. Pidió que las tablas fueran por la fábrica.
- A mano, antes de la corrida: `lib/negotiation-tables.ts` (filas, textos, badges, `Aceptar igualmente`, formatos; 12 pruebas), el país de la línea consultada en
  `fetchThreadItems`, el montaje en `ThreadHistory` (tablas encima, historial con una línea por elemento y su panel de servidor, notas de la oferta en su línea),
  marcadores, contrato nuevo (30 pruebas) y el de `MSG-02` reescrito para las tablas. Referencia desechable: 178 verdes. Suite e2e entera contra los marcadores:
  solo fallan los 3 del contrato.
- Corrida 01: intento 1 rojo (import sin usar; aviso de expirada sin `role=img`), intento 2 verde C1–C4. 0,074 USD. Revisión a mano: 1 línea (`title` del aviso).
- `bearingworld-e2e` tenía los cobros caducados (ADMIN-02 rojo en el e2e): resembrados con `demo_billing.sql`.

## Lecciones (MSG-03)
- «Vive en `MSG-02`» tapó durante semanas que una pantalla aprobada no existía. Un pendiente se escribe como pendiente, aunque se pinte dentro de otro.
- Empujé la revisión a mano seguida de un commit con `[skip ci]`: GitHub mira solo la cabeza del push y la revisión se quedó sin CI. El commit de documentación
  que va detrás de código no lleva `[skip ci]`.
- Un heredoc del shell volvió a comerse las barras invertidas de un regex (`F-199`): ficheros con `\` se escriben con el editor.
