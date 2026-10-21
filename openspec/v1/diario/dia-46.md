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
