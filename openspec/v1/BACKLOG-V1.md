# Backlog de V1

Lo que está **abierto pero sin fecha y sin dueño de esta semana**: deuda de producto, riesgos aceptados y trabajo que espera a un disparador. **No se lee al arrancar**; `ESTADO-V1.md` solo lleva lo que se está haciendo o bloqueando ahora. Creado el 14-oct-2026 (PO) para aligerar el relevo.

Cada fila dice **qué es**, **qué la activa** (el disparador) y **dónde está el detalle**. Cuando una se activa, vuelve al relevo; cuando se cierra, se borra de aquí y queda en su hallazgo o en `DECISIONES-V1.md`.

| Qué | Disparador | Detalle |
|---|---|---|
| **Riesgo aceptado: privilegios por defecto anchos** (`anon`, `authenticated` y `service_role` reciben `ALL` sobre cada tabla nueva de `public`) | **Se reabre antes de datos reales o de abrir el registro a terceros** | `F-192` (PO, 25-sep). **Propuesta lista y probada en el banco, sin aplicar** (14-oct): `supabase/propuestas/F-192/README.md` |
| **Riesgo aceptado: `VITE_DEMO_KEY_SEED` va en el JS de producción** (comprobado el 14-oct): quien lo descargue deriva las privadas de las cuentas de prueba (`ALPHA`, `BETA`, `EDITOR`…) y lee sus hilos. No afecta a miembros con ADR-001 | **Se reabre antes de datos reales o de abrir el registro a terceros**; salida: quitar la variable del entorno de Vercel de producción (inutiliza esas cuentas allí) | `F-067`, `DECISIONES-V1.md` (8-oct) |
| **Salida abrupta del ADMIN**: la recomendación de tener más de un ADMIN no llega a la interfaz | Producto lo prioriza; antes de abrir el registro a terceros | `docs/ADR-002_Ambito_de_visibilidad_por_usuario.md` §10 (Q-1) |
| **VERA no prepara contraofertas ni la respuesta a una consulta concreta, ni nada desde `Comprando`**: solo consulta nueva y oferta directa, con un hilo abierto | Producto lo pide | `DECISIONES-V1.md` (VERA prepara, no envía), `F-249` |
| **`REG-01` aceptada sin logo, sin Google y sin VERA** (sin sesión, `F-223`) | Cuando haya proveedor de identidad y almacenamiento | `F-226` |
| **No existe `Ajustes`**: `Configuración` abre `INVT-01` directamente | Producto | `F-213` |
| **Una cuenta baneada no se puede reinvitar con el mismo correo**; `contact@nortexsys.com` (`CANCELLED` en JULSA) sigue ocupando ese correo | Al diseñar la reinvitación | — |
| **RPC `search_catalog` para la búsqueda cruzada** (entregable 5 de Fundación). `0064` ya bajó la búsqueda de 3,1 s a 45 ms con el catálogo de hoy; con 1M de líneas la política sigue recorriendo la tabla (0,5–2,2 s) y la RPC con índice parcial la dejaría en 50–200 ms. Cambia el cliente y el total pasa a «más de 10.000» | Un catálogo real que pase de ~100.000 líneas, o una prueba de carga | `findings/F-253.md` |
| **Cifras 7 y 8 del umbral de fábrica**: `SRCH-03` tiene medida limpia e `INV-04` un segundo intento con salvedades que el PO rechazó en C5 (`F-261`: 27 min, ~10–17 $, no cuenta como aceptada) | Una sesión propia por pantalla | `F-205`, `UMBRAL-FABRICA-V1.md` |
| **Vercel en plan gratuito** | Antes de tráfico real o de una demo con cliente | — |
| **El móvil, como tratamiento aparte**: a 375 px VERA ocupa un tercio (aceptado), pero la navegación es mala: elementos superpuestos, la barra de marca recortada, «Cerrar sesión» fuera de pantalla, la dirección de INV-04 ilegible. No es un arreglo pantalla a pantalla: es el shell y `VeraPanel` en móvil | **Cuando el frontend esté cerrado al 100 %**: el PO pedirá entonces el plan de tratamiento móvil; antes, no se propone (PO, 16-oct: «merece un tratamiento aparte», «ese plan lo solicitaré más adelante») | `F-260` punto 6, capturas `*_375.png` del repaso |
| **Tablas anchas con VERA abierta a 1440**: se cortan sin pista de scroll. Se pierden «Contactar» (SRCH-01), «Fecha» (MSG-02) y «Fecha solicitud» (ADMIN-01), y el botón «Marcar pago recibido» de ADMIN-02. Más los detalles bajos del repaso: «186 resultados» partido en SRCH-01, el espaciado de «Crear oferta» y el primer `h1` de MSG-02 | Al repasar esas pantallas, o antes de una demo con cliente (PO, 16-oct: «va al backlog») | `F-260` puntos 7 y 8 |
| **VERA sin límite de preguntas por usuario y hora, y sin registro de `usage` por pregunta** (el tope de tamaño por petición sí está) | Antes de abrir el registro a terceros | `F-256` |
| **VERA sin registro de auditoría de sus acciones** (`action-audit-logging`) | Antes de la primera herramienta de VERA que escriba en la base | `F-257` |
| **VERA sin preferencias persistentes** (`profile-context-layer`, «Ajustes → Asistente VERA») | Producto lo prioriza | `F-257` |

## Decididas y cerradas el 14-oct-2026 (no hay nada que hacer)

- **`Suspender manualmente` no pide confirmación**: se respeta la spec cerrada.
- **Los cobros y la frescura de la demo envejecen con el calendario**: se re-anclan a mano antes de cada demo con `reanchor_freshness.sql` / `demo_reanchor_freshness()`; ver `openspec/mvp/guion-demo-y-siembra.md` §6.
