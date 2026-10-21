# Día 46 de V1 · 21-oct-2026

## F-277 · paridad de migraciones (sesión lanzada desde la principal; el PO: «ve a f-277»)

- **Lo pedido:** que no vuelva a pasar sin que nadie se entere lo del 20-oct (`bearingworld-e2e` sin migraciones
  que producción tenía). Solo comparar, nunca aplicar desde la CI.
- **Cómo casan fichero y versión**, mirado en `schema_migrations` de las dos bases antes de escribir nada: tres
  formas (número como versión en producción `0001`–`0012`; marca de tiempo con `00NN_` en el nombre; marca de
  tiempo con el nombre sin número). La comparación saca el número del nombre o de la versión y, si no hay, casa
  por el resto del nombre.
- **La comparación entera destapó más desfase que el del 20-oct:** a e2e le faltaban también `0061` (importación
  por correo) y `0062` (31 políticas con `(select …)`). Las diferencias de `pg_policies` entre las dos bases eran
  exactamente esas 31. Aplicadas por el MCP con el SQL del repo, revisadas una a una, y `0063` también (idempotente,
  purga `ingest_events` de más de 90 días; no hay filas tan viejas). Después, huella del catálogo de `public` y
  `app` en las dos bases: políticas, tablas, columnas, índices, `relacl` y publicación de Realtime idénticos;
  funciones iguales salvo comentarios y las tildes de dos mensajes de error.
- **Diferencias históricas** con motivo comprobado, en `supabase/paridad-migraciones.json`: `0016` sin registrar en
  producción (SQL suelto, efecto presente), el spike SP-3 y `mvp_0011a` registradas en producción sin fichero,
  `0035b` en e2e sin fichero. Una excepción que deja de darse hace fallar el job.
- **El mecanismo:** job `migraciones` en la CI, del que dependen `e2e`, `deploy` y `deploy-app`;
  `app/scripts/paridad-migraciones.mjs` (Management API con `SUPABASE_TOKEN`, sin `npm ci`) y su lógica pura en
  `paridad-migraciones-lib.mjs`, con 8 tests sin red. Sin token, falla.
- **Comprobación real, a mano, con las listas sacadas por el MCP:** primero **roja**, con
  `SIN FICHERO en e2e: 0072_reacciones_del_foro_sin_persona`: la sesión de `F-276` la había aplicado a e2e diez
  minutos antes y aún no la había empujado. Se le avisó y no se tocó. Tras su `52d2801` (fichero y producción),
  **verde**: 71 ficheros, 4 diferencias aceptadas, 0 pendientes.
- **Los rojos de solo docs del 20-oct no los explica F-277** (`F-278`): `859f5a5` verde y `d9c6344` rojo con 17
  minutos y el mismo esquema de por medio, y los tests que fallaron no tocan lo que faltaba.
- **Lista previa:** `tsc` limpio; `vitest` entero 2862 verdes, 135 saltadas. Banco y e2e no: no se tocó ni
  `supabase/migrations/` ni un e2e.
- **En la CI real:** `bf14b90`, run `39661281919`: el job «Paridad de migraciones» verde a la primera. `SUPABASE_TOKEN`
  lee las dos bases por `database/migrations` (72 y 72), así que no hizo falta un secreto nuevo. El resto del run
  lo canceló el empuje de `522e2e1`; su run (`39661497466`) salió verde entero, con el job nuevo delante del e2e.

## F-276 · quién reaccionó en el foro (sesión de Claude Code, en paralelo con la de `F-277`)

El PO aprobó cerrar `F-276` «siguiendo el mismo razonamiento» que `F-272`: otra organización no debe saber qué persona
concreta hizo algo en el foro.

- **Diagnóstico contra el catálogo de las dos bases.** `forum_reactions` daba SELECT de tabla entera a
  `authenticated` (`relacl` = `ard`) y la política de SELECT deja leer a cualquier miembro activo: `member_id` se leía
  desde otra organización. Lo único que lo necesitaba era `forum_post_detail.reacted_by_me` (`security_invoker`). El
  cliente nunca lee la tabla: reacciona con INSERT y quita con DELETE por `post_id`.
- **`0072_reacciones_del_foro_sin_persona.sql`.** SELECT solo de `post_id`; `reacted_by_me` desde
  `app.forum_reacted_by_me(post_id)`, `SECURITY DEFINER`, que solo responde por `auth.uid()`; las dos vistas cuentan
  `count(r.post_id)` (con la clave `(post_id, member_id)`, una fila es una persona). Mismas columnas y tipos: el
  cliente no cambia. Las tres políticas de la tabla se reescriben con `(select …)`.
- **Hallazgo de paso:** en `bearingworld-e2e` esas tres políticas estaban a pelo, sin lo de `0062`. Se dejó la nota a la
  sesión de `F-277`, que compara las migraciones de las dos bases.
- **Orden:** banco en Docker con el bloque nuevo de `07_parciales_sql.sql` → `apply_migration` en e2e → catálogo y
  sesión simulada → e2e del foro local (18/18) → producción → catálogo y sesión simulada otra vez. Mismo md5 de las
  vistas en las dos bases.
- **Unitario:** `reactions#2` de `forum.parciales.test.ts` miraba la primera definición de la vista (`0033`); ahora la
  última, y acepta `count(r.post_id)`.
- **Commit `52d2801`**, CI `39659841898` verde entera con despliegue. El bundle desplegado no lee `forum_reactions`.
- **La CI anterior (`d9c6344`, solo docs) salió roja** en `backup-passphrase.spec.ts:94` con 2 flaky más; la de
  `52d2801` pasó (`F-278`).
- La matriz no cambia: ningún escenario cambia de estado (`reactions#2` y `thread-and-reply-creation#3` siguen
  CUBIERTO).

## F-278 · por qué salieron rojos los commits de solo docs del 20-oct (~20:55–21:05 UTC)

- **Sin gasto y sin tocar la instancia:** los logs del 20-oct seguían en `bearingworld-e2e`, así que no hizo falta
  reproducir (ninguna corrida de Playwright contra e2e).
- **Concurrencia descartada:** en los `edge_logs` de cada ventana hay una sola IP cliente, del runner de GitHub. El
  único solape del día fue el de `4f4f8a7` a las 09:07–09:14 con un local (`F-262`, ya sabido).
- **Paradas de la instancia, confirmadas por las dos puntas:** el servidor (`origin_time` hasta 24,8, 29,7 y 13,3 s
  en el minuto de cada caída) y el navegador (trazas del reintento: login sin respuesta en 15 s en
  `backup-passphrase`; cinco lecturas colgadas en `zz-h5`).
- **El 20-oct fue un día malo:** 9–22 peticiones de más de 10 s por hora y máx. 55,8 s; la suite tardó hasta
  14,7 min. El 21-oct, con una carga por hora parecida, 1 petición de más de 4 s y la suite en ~5 min. El plan de la
  organización es `free` (Nano). Encaja con el presupuesto diario de E/S de disco, sin comprobar: esa métrica solo
  está en el panel.
- **No se toca el código:** `retries: 1` y 15 s ya estaban desde `F-259`, y `F-259` dejó escrito que no se subía otra
  vez el número. Pregunta al PO en el relevo §3.2: comprobar el «Disk IO balance», no correr e2e en pushes de solo
  docs, o pasar a Pro (≈ 35 $/mes con producción incluida).
- **Después, con el PO en el panel** (*Settings → Infrastructure* de `bearingworld-e2e`): Disk IO balance 99 %
  (mínimo de 7 días), CPU 16 %, memoria 58 %. **La hipótesis del disco cae**: las paradas no las provoca nuestra
  carga, sino el entorno compartido de Free. Pasar a Pro deja de ser una apuesta segura; (b) no depende de la causa.
