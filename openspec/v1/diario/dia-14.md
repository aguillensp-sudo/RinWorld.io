# Día 14 de V1

**Día 14 de V1 · 11-sep-2026 · Estado: CERRADO.** Cerrada la familia `F-148`/`F-155`/`F-156`
por el lado que faltaba —disparadores, políticas y función Edge—, sin hallazgo y anclada con
cuatro asertos y una canaria. A petición del PO: plan releído contra el repo (semana 3, la
del H1), escrito `UMBRAL-FABRICA-V1.md` —el umbral que la tabla de riesgos exige "de
antemano" y no existía—, y confirmadas las tres pantallas del H1 (`DIR-01`, `ADMIN-01`,
`FORO-01`) antes de que existiera una línea de código de ninguna. Las tres capas de datos
escritas a mano, verificadas y sembradas (`0027`, `0028`, `0029`): paso 2 del hito cerrado.
Tres hallazgos: `F-157` (el medidor de coste borraba su propia historia, cerrado), `F-158`
(la spec de `ADMIN-01` se contradice a sí misma —**abierto, es del PO**) y `F-159` (un e2e
que falla por carrera, cerrado). El Operador de Plataforma existe de verdad en las dos
bases: cuenta, alta, rama de sesión, alcance comprobado desde su propia sesión. El detalle
completo —las seis adendas del día— vive en `git show f5e1d7e:openspec/v1/ESTADO-V1.md`, no
se repite aquí.
