# Día 35 · 9-oct-2026

D3 del microplan: `bearingworld-e2e` al día.

- Aplicadas `0040`–`0055` (16) a `bearingworld-e2e` (`ogdhyzgjjbbikjbkhxmu`) por el MCP, en orden y una a una. Sin datos de producción: todo DDL y funciones.
- Verificado contra el catálogo, en los dos proyectos, con el mismo `select`: 89 funciones (firma + `prosecdef` + ACL), 42 políticas, 258 columnas, 34 triggers y privilegios de columna de `members`. Los cinco hashes md5 coinciden entre `troxminloxkjwihwfevs` y `bearingworld-e2e`.
- Al aplicar se quitaron las líneas de comentario de cabecera (y las de dentro de cuerpos de función en `0049`–`0055`): el comportamiento es el mismo, el texto de `prosrc` no es byte a byte el del `.sql`.
- Sin hacer: las Edge Functions de `bearingworld-e2e` (solo `access-request` v1; faltan `register-organization`, `accept-invitation`, `ban-revoked-member`, `register-additional-member`, `vera`). Ningún e2e actual las necesita que se sepa; no se ha comprobado.
- Hallazgo ajeno a D3: la CI de `20f8357` (MSG-02) estaba roja por su propio test (cursor tras Alt+Enter, `rAF`). Arreglado en `aa4b756` con `useLayoutEffect`. Eso había bloqueado el despliegue de ese commit.
- Hallazgo ajeno a D3: la CI de `2b66b54` pasó todo salvo «Despliegue continuo · app (Vercel)»: `Could not retrieve Project Settings`. Sin investigar.
- Vercel: el token había caducado; renovado por el PO y el job `deploy` relanzado en la corrida `37885251380` (verde). Servido en `rin-world-io.vercel.app` (200, `Age: 2`).

- F-237 cerrado: el PO aprobó los textos de error de REG-07 tal cual (opción 1). Sin código.
- Decisiones del PO sobre §3.3: F-241 aprobada tal cual; F-231 = 1.247 (código en 9cb6028, 4 tests cambiados, CI pendiente de mirar); zxcvbn se queda en score >= 3; borradas de ALPHA las 18 806 filas de la importación del 6-oct (quedan 15 de siembra, 1 PUBLISHED). F-230 sigue: JULSA y Jose Bearings son las empresas de la demo y no se borran.
- Ojo: el borrado de ALPHA no se puede deshacer y se hizo sin copia; el archivo origen lo tiene el PO.
