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
- F-230 en curso: el arnes ya corre el e2e contra bearingworld-e2e (commit del arnes). Suite entera: 146 pasan, 16 fallan (15 por la contrasena del operador en esa base, 1 test de REG-05 desactualizado tras ACT-02). No se borro JULSA ni Jose Bearings.
- F-230 cerrado: suite aislada 162/162 en local. Causas: contrasena del operador distinta en bearingworld-e2e (script nuevo) y test de REG-05/Editor desactualizado tras ACT-02.
- F-172 cerrado: INV-01, MSG-01 y SentOffers usan SearchField (commit de codigo aparte). SentOffers ya no filtra al teclear. Vitest 1985 verdes, e2e inventario y mensajeria 33/33. No visto en navegador.
- F-227 (medidor tolerante), F-235 (--seco construye el prompt) y harness-review.csv (4 filas reconstruidas desde git: DIR-02, INVT-01, REG-09, FRU) cerrados. F-170 fuera de la lista (ya estaba cerrado). Deuda sin fecha: solo F-213.
- Ojo: al encender F-235, 7 tareas cerradas salen invalidas en --seco por contratos retocados a mano tras su corrida (ya lo eran antes).
- D3 completo: F-211 (open_thread 0056, banco de esquema, aplicada a produccion y a e2e), enlaces muertos y textos (NotAvailable, Nuevo contacto, contraparte de MSG-02, canal email), e2e de H5 con dos contextos. Suite aislada 164/164.
- Lecciones: (1) el e2e de H5 borraba el hilo de siembra y dejo rota la restauracion de bearingworld-e2e (repuesta a mano por SQL); ahora vacia los elementos y repone la fila. (2) 0056 se aplico por el MCP en produccion y en e2e despues del banco.
- Sin decidir: el primer mensaje de Contactar es texto libre, sin plantilla.
- La CI de D3 salio roja en el job del arnes: el guardia de --seco cantaba MSG-01 porque mis tests de onOpenDirectory estaban en su contrato de aceptacion. Movidos a Messages.fuera-de-contrato (y los de la contraparte a Thread.fuera-de-contrato). Comprobado en local con python -m harness.tests.test_checks, no solo con pytest (pytest no ejecuta los check).
