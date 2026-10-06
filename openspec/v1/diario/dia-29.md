# Día 29 de V1

**Día 29 de V1 · 4-oct-2026 · Estado: CERRADO.** Fecha de máquina: el primer `date -u` de la sesión dio `2026-10-02 09:21 UTC` y el del cierre
`2026-10-04`; el trabajo se hizo en una sola sesión y se fecha con el del cierre. Orden del PO: «iniciamos sesión y no pares hasta poner una
pantalla más en producción. Avísame al terminar y haz ritual de cierre».

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **Elegida `INV-02`** (Procesamiento y Mapeo de Columnas), decimoctava pantalla. `INV-04` se descartó con un dato nuevo: **`bearingworld.io`
>    no está registrado** (`F-233`). Con `INV-02`, `INV-03` deja de ser inalcanzable: **la importación de inventario por archivo está en producción.**
> 2. **A mano:** migración `0044` (`import_inventory`, perfiles, `notes`; 15 asertos en el banco, aplicada a producción y comprobada en el catálogo),
>    `lib/inventory-import.ts` (38 pruebas), la subida viva en `INV-01` (solo con `onPickFile`: su contrato no cambia), el cableado
>    `INV-01 → INV-02 → INV-03` y el contrato (27 + 2 + 7 de unidad, 2 e2e), comprobado contra una referencia desechable.
> 3. **La corrida: VERDE en el intento 1**, C1–C4. **0,049 $**, 30 668 / 27 263 tokens, 0 % de caché, 837 líneas. Sin `[skip ci]`.
> 4. **Revisión a mano: 14 líneas de CSS** (superficies crema en vez de blancas; padding dentro del contenedor de 860 px). `ImportMapping.tsx` sin tocar.
> 5. **La siembra de cobros de producción había caducado** (Cuscinetti, 30-sep) y rompía `ADMIN-02` en la lista previa: resembrada con `demo_billing.sql`.

## Por qué `INV-02` y no `INV-04`

De las pendientes, `REG-05`/`06`/`07`, `REC-01` y `SET-SEC-01` son criptografía y `MSG-03` ya vive en `MSG-02`. Quedaban `INV-02` e `INV-04`.
`INV-04` parecía la pequeña (configuración: dirección, lista blanca, historial), pero su pieza central es una dirección `ingest-…@ingest.bearingworld.io`
y `nslookup` dice *Non-existent domain* para el dominio, su MX y el subdominio. Pintarla es invitar a mandar inventario a un dominio que cualquiera
puede comprar. `INV-02` es la grande, pero no tiene producto que falte detrás salvo el XLSX y el precio, y completa `INV-03`.

## Lo que hay debajo

- **`0044`:** `import_inventory(p_lines, p_policy, p_profile_name, p_header_signature, p_mapping)`, `security definer`, una transacción. Solo un
  miembro `ACTIVE` (ADMIN o EDITOR) de una organización `APPROVED`. Repite la validación del cliente y rechaza el lote entero si una línea no vale o
  si hay repetidas. Identidad de línea: referencia + marca (sin mayúsculas) + país. `REPLACE` pasa a `DELETED` lo **publicado** que no viene, sin
  borrar filas; `ACCUMULATE` no toca lo demás. Los perfiles se leen por RLS y solo los escribe la función.
- **El banco de esquema trata cualquier `42xxx` como test roto** (`expect_fail`): el primer `raise … using errcode = '42501'` salió como «TEST ROTO».
  Se quitó el código; el resto del proyecto ya lanza con el de por defecto.
- **`lib/inventory-import.ts`:** CSV/TSV/TXT con comillas RFC 4180 y delimitador detectado por la cabecera; **UTF-8 o Windows-1252** (un CSV de
  Excel en español llega en 1252: «País» como `Pa\xEDs`); propuesta por sinónimos (99/92/70/10, sin decir «IA» en ningún texto); un campo por
  columna; familia por la forma de la referencia (las cinco de la siembra, más contacto angular y bolas a rótula); cantidad con punto de millares.
- **jsdom no tiene `File.text()`**: se lee con `FileReader` + `TextDecoder`, que es además lo que permite el 1252.
- **`price` deshabilitada** con su etiqueta del HTML: el precio de catálogo es E2EE y hoy no hay clave con la que cifrarlo para su lector.
- **INV-01:** «Siempre disponible», dropzone que es un `<button>` y acepta *drop*, y el error del HTML para un formato no admitido. Solo con
  `onPickFile`; sin él, la pantalla del contrato de `INV-01` (28 pruebas intactas). Las dos e2e de `INV-01` que afirmaban la subida inerte se reescriben.
- **El e2e de `INV-02` no escribe**: sube un CSV, comprueba la propuesta y cancela. Importar en la demo (y más un `Reemplazo total`) cambiaría el
  inventario que comparten la demo y las demás pruebas.

## La lista previa

`tsc` limpio; `vitest` entero: solo el contrato (33). E2E entera: 138 pasan; fallan los 2 del contrato, los 5 ya excusados en `INV-03` (`F-224`,
`F-230`) y **`ADMIN-02` «la siembra está anclada»**: la siembra de cobros de producción había caducado (el relevo lo avisaba para después del
30-sep). `demo_billing.sql` solo toca las ocho organizaciones de demo por id; resembrada, `ADMIN-02` 15/15. El validador de la tarea (`F-125`) pidió
declarar tres nombres accesibles que el contrato de cableado busca y que no son de `INV-02` (dos de `INV-03`, uno del stub de `INV-01`).

## La corrida y la revisión

Verde en el intento 1. La captura real contra el HTML aprobado enseñó dos cosas que ningún check ve: el Coder, sin token de blanco, eligió
`--bw-warm-cream` (crema) para todas las superficies blancas, y metió el padding dentro del contenedor de 860 px, con lo que el contenido quedaba en
764 px y el primer desplegable recortaba «Referencia del rodamiento». 14 líneas. 0 `var(--bw-*)` inexistentes, 0 colores literales fuera de
comentarios, tamaños 11/24/14.

## Lo que no se ha hecho

- **No se ha importado nada en producción** desde la pantalla: la escritura está medida en el banco (`0044`) y con la base mockeada. Es la C5 del PO,
  y en una organización de demo un `Reemplazo total` retira su inventario entero. **`npm run demo:reset` no lo repone** (no toca `inventory_lines`): hay que resembrar
  `supabase/seed/catalog_demo.sql`. Lo seguro para la C5 es `Acumulativo` con un CSV de una o dos referencias nuevas.
- **`bearingworld-e2e` sigue en `0039`**: sin `0044`, `fetchProfile` falla en silencio (a propósito) y nadie importa en la CI.

## Postdata · 6-oct · la primera importación real del PO

El PO probó en su localhost y el botón «Confirmar e importar» quedó deshabilitado. En los logs de Supabase solo había la lectura de perfiles (nunca llegó a
llamarse a `import_inventory`) y en la base, ninguna línea nueva. Causa doble: su archivo (`Item Number`, `Item Type`, `Qty`, `Marca`) no tenía columna
de país (obligatoria) y `Item Number` no estaba entre los sinónimos de la referencia; y el motivo solo salía como `title`, que un botón deshabilitado no
enseña. Arreglado a mano, por decisión del PO: sinónimos nuevos, motivo a la vista y país de la organización por defecto (`DECISIONES-V1.md`, 6-oct).
**Lección:** la C5 de una pantalla con un botón condicionado tiene que probarse con un archivo que NO sea el feliz; los de prueba del contrato traían país.

**Segunda tanda del 6-oct:** el PO pidió quitar la familia como dato exigido (`0045`, aplicada y comprobada en producción; 3 aserciones nuevas en el banco). Sus 54 líneas rechazadas por eso se recuperan volviendo a subir el archivo con «Acumulativo»: las ya importadas se actualizan y las 54 entran sin familia.

**Cierre del 6-oct:** C5 de `INV-02`/`INV-03` aceptada por el PO («espectacular todas las pruebas»): importación real, familia opcional, desglose de nuevas y existentes, `.xlsx`, límite de 20.000 y duplicados dentro del archivo (se importa la primera; la repetida sale en el panel de errores como «no importada»). **Incidencia:** la siembra de watchers de `bearingworld-e2e` envejeció (`falta el estado PAUSED`) y la CI quedó en rojo en 4 commits seguidos, lo que **bloqueó el despliegue** de `0045`/`0046`/`.xlsx` a Vercel durante ~1 h sin que nadie lo viera; resembrada con `demo_watchers.sql` y relanzada, todo verde y comprobado en el bundle de producción. Lección: tres siembras con fecha relativa (cobros, watchers, frescura) envejecen y rompen la CI; falta un aviso antes de que lo hagan (`F-094`).
