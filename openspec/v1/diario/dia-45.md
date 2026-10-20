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

## Tarde · pantalla de suspensión (sesión lanzada desde la principal)

- **Lo pedido:** cerrar `billing-subscription/automatic-suspension#2` y `community-forum/active-account-access#2`, que
  la decisión del PO de hoy (suspensión manual desde ADMIN-02) deja a la vista: un miembro de una suspendida entraba
  al shell.
- **Cliente.** `loadProfile` pide `status` en el mismo embed de `organizations` (la política
  `organizations_select_approved` deja leer la propia aunque no sea APPROVED, comprobado en `pg_policies`). Con
  `SUSPENDED` y un miembro no revocado, el estado es `suspended` y `App` pinta `screens/Suspended.tsx` en lugar del
  shell: sin menú, sin VERA, sin foro. Un revocado sigue saliendo por `isRevoked`. El Operador no tiene organización.
  No va a `cabeceras.test.ts` / `padding.test.ts` ni a `veraScreenName`: es una pantalla fuera del shell, como el login.
- **La «RLS que oculta el inventario» no era la RLS (`F-275`).** `app.visible_inventory_owner_ids()` no mira
  `organizations.status`; lo que lo saca de la búsqueda es el `!inner` de `search.ts` con `organizations`. El banco
  (`09` §3) lo fija con control: con el cruce, 0 filas; sin él, 1. Fuera de la búsqueda se lee, los miembros de la
  suspendida conservan permisos en la base, y en el foro sus publicaciones salen sin nombre de organización.
  Propuesta en el hallazgo, para la tarea de permisos con `F-192`/`F-272`. No se aplicó nada en la base.
- **Pruebas, a mano:** `session.suspension.escenarios.test.ts` (la puerta y su consulta) y
  `App.suspension.escenarios.test.tsx` (la pantalla sustituye al shell, control con la org activa). Banco verde en
  local. La matriz queda en 108 CUBIERTO y 38 NO_IMPLEMENTADO.
- **La CI de `b4a97e3` (solo docs) salió roja** en dos e2e de la instancia (`batch-search` y `zz-h5-negociacion`,
  10:10–10:23 UTC), sin nada de código detrás.
- **`6b9a34e` verde (run `39407772750`) y desplegado**, comprobado en el bundle de producción por contenido. Dos e2e (`forum-thread`, `organization-profile`) pasaron al reintento: la instancia sigue inestable (`F-259`).
- **Sin probar en un navegador con una cuenta suspendida**: no se suspendió ninguna organización real.

## Tarde-noche · F-275, F-272 y F-192 en una tarea de permisos (sesión lanzada desde la principal)

- **Lo pedido:** cerrar los tres juntos (PO, 20-oct: «lo que me propones parece sensato y estoy de acuerdo»), con
  suspensiones manuales inminentes (Cuscinetti Padana a 0 días). Hecho en `859f5a5`.
- **Diagnóstico contra el catálogo de producción antes de escribir nada.** Las políticas coincidían con la propuesta de
  F-192 del 14-oct, pero había envejecido en tres cosas: Postgres 17 da `MAINTAIN` a `anon` y `authenticated` (el
  banco es 16 y no lo conoce), tres funciones de `public` (`billing_confirm_payment`, `billing_suspend_organization`,
  `forum_rate_limit_status`) las ejecutaba `anon` por PUBLIC, y dos tablas nuevas ya nacieron cerradas.
- **`0069` (F-275).** `is_active_member` e `is_org_admin` exigen la organización `APPROVED`; el inventario ajeno solo
  de `APPROVED`. Lo que la pantalla de suspensión lee no pasa por esas funciones. El foro nombra a la autora con
  `app.forum_author_org` (definer, solo de organizaciones que han publicado), y «Hilos recientes» lee de
  `forum_thread_list`, que gana dos columnas de categoría al final: único cambio de cliente.
- **El banco cazó dos cosas en la primera corrida:** el aserto de `0064` compara la visibilidad por conjunto con la
  antigua por fila (`can_view_inventory_of`), así que esa también recibe la regla; y la regla G nueva de `06` saltaba
  con las funciones de `pgcrypto`, que en el banco caen en `public`. Se excluyen las de extensión.
- **`0070` (F-272)** y **`0071` (F-192)** como estaban propuestos, más lo de arriba. Ancla negativa de `06`: sin
  `0070`/`0071` falla con 185 (los 182 del 14-oct más 3 de G). `supabase/propuestas/F-192/` se borra.
- **`bearingworld-e2e` estaba desfasada (`F-277`)**: le faltaban `0063`, `0064` y `0068`. Se le aplicaron `0064` y
  `0068` antes que lo nuevo. La CI llevaba días probando la política de inventario por fila que producción ya no tiene.
- **e2e local contra `bearingworld-e2e`:** 161 verdes y 5 rojos en una corrida de **2,4 h** (la CI tarda ~8 min);
  los 5 repetidos aislados, 11 de 11 en 1,5 min. La CI de `57fe972` (solo docs) ya había salido roja en cuatro specs
  de la instancia (`messages`, `session`, `visibility`, `zz-h5`): inestabilidad de la instancia, no de esto.
- **Visto de paso:** `forum_reactions.member_id` es legible entre organizaciones (`F-276`, mismo patrón que F-272; pide
  reescribir `reacted_by_me`). `vera_abrir_turno` no mira la suspensión (residual en F-275).
- **`859f5a5` verde entera (run `39461082451`) y desplegada**: el bundle `index-CAzFNqcA.js` lleva la consulta nueva de
  «Hilos recientes» y no el cruce viejo. Ninguna organización real se suspendió para probar: todo en el banco.
