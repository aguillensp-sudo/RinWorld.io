# Plan · Sprint de demo — dos empresas negociando de punta a punta (8–12 oct 2026)

> **Decidido por el PO el 8-oct-2026** (chat, cuatro respuestas, ver §2). Adelanta la parte funcional
> del **H5** del Plan V1 v2.3 (§6.3, semana 16) a la semana 8. Es la entrada del trabajo de estos cinco
> días; las decisiones están también en `DECISIONES-V1.md`.

## 1 · Objetivo

Dos empresas **nuevas, dadas de alta por el recorrido real** (claves de ADR-001, sin la semilla de demo)
completan, en dos navegadores y contra producción:

búsqueda (VERA / `SRCH-01`) → **consulta** → **oferta** → **contraoferta** → **aceptar** → `ACUERDO ALCANZADO`,
con las tarjetas en el hilo (`MSG-02`) y el panel «Ver lo que ve el servidor».

Del criterio del H5 cubre las dos primeras cláusulas. La tercera (dos editores de la MISMA organización no
ven nada el uno del otro) **solo si negocian con contrapartes distintas**: con la misma contraparte el
estado y la actividad del hilo son comunes (metadatos por hilo, no por conversación; ADR-002). Arreglarlo es
L y de esquema: queda fuera.

## 2 · Decisiones del PO (8-oct-2026)

1. **Cinco días de trabajo, fin de semana incluido:** D1 jue 8 → D5 lun 12. La demo, después.
2. **Dos empresas nuevas, alta real**, no las cuentas de prueba.
3. **Tarjetas en el hilo** (HTML aprobado de `MSG-02`); las tablas de `MSG-03` v1.2, después de la demo.
4. **`INV-04` fuera del sprint**; su fase 1, solo si sobra tiempo.

Y, como consecuencia (Plan §7.2, escenario base: «las pantallas de negociación se terminan a mano»):
**todo a mano por Claude Code, fuera de la fábrica**; no es punto de las cifras 7 y 8. La fábrica, en pausa.

## 3 · Punto de partida, verificado el 8-oct contra producción

| Afirmación | Verificado contra |
|---|---|
| No hay forma de crear una oferta: `create_thread_item` solo acepta `MENSAJE`; `counter_offer` exige una oferta previa; las ofertas que existen son de la siembra | `pg_proc` (texto de la función en producción) |
| Tras aceptar, el hilo seguiría en `CON CONSULTA PENDIENTE`: nada pasa la consulta a «Respondida» y `app.derive_thread_state` mira la consulta antes que el acuerdo | `pg_proc` |
| Un miembro sin clave pública bloquea a toda su empresa (el cliente se niega a enviar). JULSA tiene hoy un EDITOR `REGISTERED` sin clave | `members` en producción |
| `authenticated` tiene `INSERT`/`UPDATE` directos sobre `thread_items`; las guardias de la oferta solo son `BEFORE UPDATE` y no hay guardia de `estado_consulta` | `role_table_grants`, `pg_policies`, `pg_trigger` |
| `VITE_DEMO_KEY_SEED` va dentro del JS de producción: las claves de los miembros sin backup se pueden derivar (`F-168`) | `curl` del bundle + búsqueda del valor de `app/.env` (1 aparición; el valor no se imprimió) |
| Un hilo por pareja de empresas | `pg_indexes` (`threads_pair_uniq`) |
| `Crear oferta` y `Marcar acuerdo alcanzado` están desactivados a fuego; las pantallas de mensajería no se tocan desde el 30-ago | Código y `git log` |

## 4 · Los cinco días

| Día | Qué | Hecho cuando |
|---|---|---|
| **D1 · jue 8** | Migración `0056`: `create_offer` (respuesta a una consulta o directa; la consulta pasa a «Respondida» en la misma transacción); «Sin stock»; destinatarios de la CEK = solo miembros `ACTIVE` con clave, con la guardia de `0024` coherente; toda oferta y consulta nace `Pendiente`, el contenido de un elemento no se reescribe y `estado_consulta` solo lo mueve quien recibió la consulta. Banco de esquema antes; se aplica por el MCP y se comprueba en el catálogo. `createOffer()` en el cliente | Banco verde, `0056` en producción y releída del catálogo |
| **D2 · vie 9** | `MSG-03` en la interfaz: `Crear oferta`, `Responder con oferta`, `Sin stock`; formulario de oferta (el de contraoferta generalizado, 8 campos de `MSG-03` §4.2); confirmación al aceptar/rechazar (HTML de `MSG-02`); divisa del transporte, país, `EXPIRADA`. `Consultar` por fila con la cantidad y las notas del comprador. La cantidad (en claro por ADR-002 D-3) aparece en el panel del servidor como metadato declarado | Ciclo completo a mano en dos navegadores, en producción |
| **D3 · sáb 10** | `Contactar` sin hilo previo (`F-211`); textos «fuera del MVP» que ya son falsos, enlaces muertos (`Contacto`, ítems del Operador, contraparte en `MSG-02`); e2e de H5 con dos contextos de Playwright; `bearingworld-e2e` al día (`0040`–`0056`) para que corra en la CI | e2e de H5 verde en la CI |
| **D4 · dom 11** | Alta real de las dos empresas por el recorrido completo (`REG-00` → `ADMIN-01` → `REG-01` → `REG-05`/`06`/`07` → invitación → `ACT-02`): primera medición de H3 de punta a punta. Catálogo de la vendedora por `INV-02`/`INV-03`. **Ensayo 1** en dos navegadores. Resembrar cobros (`demo_billing.sql`, Cuscinetti cambia ~14-oct) y frescura | Lista de arreglos del ensayo |
| **D5 · lun 12** | Solo arreglos del ensayo 1; **ensayo 2** cronometrado; grabación de respaldo del recorrido; guion escrito. **Congelación** hasta la demo: ni despliegues ni e2e locales contra producción | Ensayo 2 sin incidencias |

**Si sobra:** no leídos (las tres cifras «—» de `PANEL-01`), tablas de `MSG-03` v1.2, `INV-04` fase 1.

## 5 · Fuera del sprint

`INV-04` fases 2–4 (AWS); metadatos por conversación de ADR-002; notificaciones; VERA abriendo consultas o
redactando ofertas; crear watchers e hilos de foro desde la app; la corriente C; `0055` (resto de `F-234`,
sin aplicar ni comitear: se retoma después).

## 6 · Riesgos y cómo se controlan

- **La máquina de estados ya costó `F-051`, `F-056`, `F-148` y `F-155`.** Banco de esquema delante de cada
  cambio, sin atajos; lo que se afirme de privilegios o RLS, contra el catálogo (`F-146`).
- **El `localhost` del PO ejecuta la carpeta de trabajo contra producción.** Migración aditiva primero,
  cliente después; nada a medias al final de cada bloque.
- **`demo:reset` y cualquier e2e local reinician los hilos de demo** (`F-095`): las dos empresas nuevas no
  están en `HILO_IDS`, pero desde D4 no se corre la suite local contra producción.
- **El alta de punta a punta nunca se ha medido**: por eso va en D4 y no el día de la demo. Si falla, el
  respaldo es negociar con una de las dos empresas nuevas y una cuenta de prueba, sin enseñar el panel.
- **`REC-01` cuenta intentos** (5 por 30 min): la clave de cada empresa nueva vive en el navegador donde se
  generó; la demo se hace desde esos dos navegadores.
