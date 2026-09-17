# Barrido de specs aprobadas · la clase de `F-158`

**17-sep-2026 · pedido por el PO al cerrar `F-158`.** Registro: `F-170`.

**Qué se buscó.** Una spec aprobada que se contradice a sí misma (una regla normativa contra
un ejemplo de la misma spec: datos de ejemplo, mockup en texto, diálogo de VERA) o a la que
contradice su propio HTML aprobado, de forma que **quien construya la pantalla no puede cumplir
las dos cosas**. No se buscaron funcionalidades ausentes, erratas, nombres ficticios distintos
entre spec y HTML ni derivas del shell dentro de cada pantalla.

**Cómo.** Las 29 specs de pantalla y base de `openspec/design-gui/specs y html aprobados/specs/`
(más `REG-05.pdf`) y sus 32 HTML aprobados, repartidas en cuatro lotes leídos por agentes de solo
lectura. **Cada contradicción de la tabla se ha comprobado después a mano contra el fichero, con
la cita y la línea** — ninguna entra por lo que dijo un agente. Contrastado también contra
`notas/inconsistencias.md` y `notas/revisar.md`: ninguna estaba apuntada.

**Resultado: `F-158` no era un caso aislado. Once contradicciones más: nueve pantallas y la spec del shell**, dos de
ellas en pantallas ya construidas (`SRCH-01`), donde el código ya siguió la regla y no le afectan.

Tipos: **(a)** regla contra ejemplo dentro de la spec · **(b)** spec contra su HTML aprobado.

| # | Pantalla | Tipo | Regla | Contradicción | Impacto | Recomendación |
|---|---|---|---|---|---|---|
| 1 | `ADMIN-02` | a + b | `Rinworld_spec_ADMIN-02.md:57` «Ordenación por defecto: días restantes ascendente (las más próximas a vencer o ya vencidas aparecen primero)» | Ejemplo `:109-113` y HTML (filas en `:290-326`): −133, 2, 91, 246, **−182**. La más vencida va la última | **Bloquea**: ningún orden cumple la regla y reproduce el ejemplo | Manda la regla: −182, −133, 2, 91, 246 |
| 2 | `INVT-01` | a + b | `Rigworld_spec_INVT-01_REC-01_SET-SEC-01.md:35` «Deshabilitado si la organización ya tiene 5 usuarios **activos**» | VERA `:67` «Ahora tienes 2 activos y 1 invitación pendiente, así que puedes invitar a 2 más»; HTML `INVT-01 · INV v1.0.html:263,387` «2 plazas libres» / «ya tienes 3 plazas ocupadas» | **Bloquea**: es una regla de negocio — ¿cuentan las invitaciones pendientes para el tope de 5? | ✅ **Resuelta 17-sep, PO: las pendientes cuentan.** Regla de la spec reescrita (y `Reenviar` respeta el límite); el aviso de límite, en spec y HTML, dice ahora cómo liberar plaza |
| 3 | `SET-SEC-01` | b | `…INVT-01_REC-01_SET-SEC-01.md:195` «Misma política que REG-06: score zxcvbn ≥ 3 · **mín. 12 caracteres**» (REG-06 `:50` y `:73` lo confirman) | HTML `SET-SEC-01 · SSC v1.0.html:235` placeholder «Mínimo **10** caracteres» y `:345` `length>=10` | **Seguridad**: el mock promete y valida una frase de paso más corta que la política | Manda la spec (12) |
| 4 | `FORO-03` | b | `Rinworld_spec_FORO-03.md:62` «`Editar` · `Eliminar` — visibles únicamente si la publicación pertenece a la organización del usuario»; ejemplo `:116` «solo visible para SKF Nordic AB» | HTML `FORO-03 · FORO v1.0.html:227` y `:251`: botones Editar en la publicación de SKF Nordic AB **y** en la de Rodamientos del Sur SL | **Permisos**: el mock da edición sobre publicaciones de dos organizaciones distintas | Manda la spec |
| 5 | `REG-09` | b | `Rinworld_spec_REG-09.md:94` «Límite alcanzado (5 usuarios): Solo muestra el botón `Ir al panel`. **Sin mensaje de error**» | HTML `REG-09 · ACT v1.0.html:247` pinta «Has alcanzado el límite de 5 usuarios por organización.» — y esa línea lleva un `)` de más (`…");`), un error de sintaxis que invalida el `<script>` del mock: ese estado no pudo verse funcionando al aprobarlo | Confunde | ✅ **Resuelta 17-sep, PO: el mensaje se muestra, sin dudarlo.** La spec adopta los textos del HTML; arreglados en el HTML los dos `)` de más que rompían su `<script>` (ahora `node --check` limpio) |
| 6 | `REC-01` | b | `…INVT-01_REC-01_SET-SEC-01.md:121-122` «Contador de intentos: visible **a partir del segundo intento fallido**: `X de 5 intentos restantes`» | HTML `REC-01 · REC v1.0.html:235` visible desde la carga con «5 intentos disponibles»; `:362` cambia a «N intentos disponibles» | Confunde (visibilidad y literal) | Manda la spec |
| 7 | `MSG-03` | a | `Rinworld_spec_MSG-03.md:75` (v1.2, tablas) columna Transporte: «si no: `—`» | `:138-140` §6 «La línea de shipping_cost no aparece en la **tarjeta** renderizada · No se muestra `0` ni `—`». Resto del diseño de tarjetas que la v1.2 sustituyó (`:5`). El HTML sigue la tabla | Confunde | El §6 está desfasado: se reescribe según la tabla (`—`) |
| 8 | `INV-02` | a + b | `Rinworld_spec_INV-02.md:65` «verde **>85%** · amarillo 60–85%» | Ejemplo `:108` «Confianza: 85% [verde]»; HTML `INV-02 · INV v1.0.html:340` `conf hi">85%` | Cosmético, pero el umbral literal pinta distinto de la pantalla aprobada | Manda la regla: el ejemplo pasa a 86 % (o se pinta amarillo) |
| 9 | `SRCH-01` | a + b | Filas del ejemplo `Rinworld_spec_SRCH-01.md:110-114`: 850, 350, 1.200, 200, 600 con qty mín 500 → **3** superan | `:108` «5 resultados · **4** con stock ≥ 500 u»; HTML `SRCH-01 · SRCH v1.0.html:256` igual y VERA `:404` «**Cuatro** superan las 500 unidades» | Ninguno en la app: ya construida, calcula el recuento del dato (`SearchResults.test.tsx:163`) | El ejemplo pasa a «3» |
| 10 | `SRCH-01` | b | `Rinworld_spec_SRCH-01.md:82` «Por defecto: cantidad disponible descendente» | HTML `SRCH-01 · SRCH v1.0.html`, al cargar: `// Init default sort: antigüedad asc` → `applySortDOM('antiguedad', 'asc')` | Ninguno en la app: `DEFAULT_SORT` es cantidad descendente (`app/src/lib/search.ts:209`) | Manda la spec; se corrige el HTML |
| 11 | Shell | b | `Rinworld_app_shell_spec_3.md:69` nav bar **46px**; `:47`/`:70` brand bar `#111827` y nav `#1B2537`; `:125` icono `ti-settings` | `Rinworld_app_shell.html:53-55` nav **72px**, las dos barras `#07111F`, `:727` `ti-adjustments-horizontal` | Ninguno en la app: el HTML manda desde `F-004` (5-ago) y `AppShell` lo sigue (72px, mismo fondo, mismo icono) | La spec del shell se pone al día con el HTML |

**Dudoso, no contado:** `ADMIN-02` `:136` — VERA dice que hay 2 organizaciones con vencimiento en
15 días, «Nordic Bearings AB (2 días) y Acme Bearings Ltd (8 días)», y Acme no está entre las cinco
filas del ejemplo. Puede ser una fila que el ejemplo no enseña.

**Revisadas sin hallazgos:** `REG-00`, `REG-00-WAIT`, `REG-01`, `REG-05`, `REG-06`, `REG-07`, `FRU`,
`Rinworld_sistema_base_7`, `INV-01`, `INV-03`, `INV-04`, `INV-07`, `PANEL-01`, `MSG-01`, `MSG-02`,
`SRCH-02`, `SRCH-03`, `VND-01`, `ADMIN-01` (fuera de la de 18 h, ya corregida), `DIR-01`, `DIR-02`
(contra la spec de `DIR-01`), `FORO-01`, `FORO-02`.

**Lo que no cubre.** Contradicciones ENTRE specs distintas (como `F-039`), specs contra el esquema
de la base (como `F-027`) y specs contra el código. Tampoco garantiza que no quede ninguna: es
una lectura con criterio, no una comprobación mecánica.
