# Día 28 de V1

**Día 28 de V1 · 30-sep-2026 · Estado: CERRADO.** Fecha de máquina: `2026-09-30` (`date -u`, sesión de 07:23 a ~08:30 UTC). Orden del PO: «iniciar
sesión y producir 1 pantalla a elegir libremente de la lista de pendientes».

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **Elegida `INV-03`** (Resultado de la Importación), decimoséptima pantalla: la única de las ocho pendientes sin criptografía, correo ni fichero.
>    Se construye contra el tipo `ImportSummary`; su productor (`INV-02`) no existe, así que **en producción nadie la abre**.
> 2. **A mano:** capa de datos `lib/import-result.ts` (33 pruebas), cableado en `App.tsx` (`#importacion-ejemplo=ok|warn|fail`, solo en desarrollo),
>    contrato (29 de pantalla y CSS + 6 de cableado, comprobados contra una referencia desechable) y la tarea. Sin e2e, a propósito.
> 3. **La lista previa encontró dos problemas de producción** (`F-230`): 4 hilos de `beta@` que impedían el reseteo de la demo (borrados con el visto
>    bueno del PO) y datos vivos de las altas de prueba que rompen 3 tests más (excusados en la tarea).
> 4. **La corrida: ESCALADA en el intento 3 por un e2e ajeno** (`INV-01`, `F-225`), con C1, C3 y C4 verdes. **0,43 $, 21,1 min**, 814 líneas, **0 líneas
>    tocadas a mano**. Los intentos 1 y 2 fallaron de verdad. No cuenta para la cifra 2 (regla 3).
> 5. **Falta la C5 del PO** y, como la pantalla no se alcanza en producción, hay que decidir cómo la ve (`#importacion-ejemplo=warn` en su localhost, con sesión).

## Por qué `INV-03`

De las ocho pendientes (`DECISIONES-V1.md`, día 24): `REG-05`/`06`/`07`, `REC-01` y `SET-SEC-01` son criptografía (a mano, con `ADR-002` §10 delante);
`INV-02` es subida y análisis de ficheros; `INV-04` es un canal de correo que no tiene proveedor —construirla enseñaría una dirección de ingestión que no
recibe nada, el riesgo #1 de `CLAUDE.md` §7 en la interfaz—; `MSG-03` es un componente de `MSG-02`, que ya lo tiene. `INV-03` es la única de solo lectura.

## Lo que hay debajo

- **`lib/import-result.ts`:** el resultado (`ok`/`warn`/`fail`) sale de `published` y `failed`; títulos y subtítulos; `formatCount`; la muestra fija en 10 líneas;
  las 4 filas del panel de errores y la fila «… y 30 líneas más en el CSV descargable»; el CSV con BOM (Excel rompe los acentos sin él) y con guardia contra
  fórmulas (`=`, `+`, `@`) que **no** toca `-5`, porque es el valor real que el usuario va a corregir.
- **`toLocaleString('es-ES')` no agrupa `1247`** (`F-231`). Se cazó al escribir la spec `1.247` como prueba; por eso `formatCount` es propio. Las pantallas
  existentes lo usan y muestran `1247`.
- **El contrato salió con dos errores míos**, cazados por el validador de la tarea (`--seco`): una variable de prueba (`onCorrections`) que la tarea no nombraba
  y dos nombres accesibles (`1 línea…`, `2 líneas…`) que no estaban declarados. Y uno cazado por la referencia: jsdom no tiene `Blob.arrayBuffer` y
  `Response.text()` se come el BOM (se leen los bytes con `FileReader`).
- **Una regla del CLAUDE.md volvió a morder (`F-199`):** un `python - <<EOF` con `\r\n` dentro escribió saltos de línea reales en un fichero de pruebas.
  Se rehízo con el editor y un script en fichero.
- **Se apartó del HTML aprobado en tres cosas** (`DECISIONES-V1.md`): el texto del bloque de fallo prometía un informe que no existe, se quitan los botones «Demo:» y la
  etiqueta de la muestra cuenta las líneas que hay.

## La lista previa y `F-230`

`tsc` limpio y `vitest` entero con solo las 34 pruebas del contrato en rojo. La e2e entera **no arrancó**: 9 hilos en producción en vez de 5. Los cuatro sobrantes eran de
`beta@bearingworld.test` (29-sep 17:14 UTC, en 0,6 s; dos con mensaje posterior a las 17:16 y 17:20), sin rastro en el relevo. **Se preguntó al PO antes de borrar** y
dijo que sí; se borraron por cascada solo esos cuatro ids. Con eso, la suite dejó 5 fallos ajenos (2 de `F-224` y 3 por las organizaciones de altas de prueba y la
solicitud sintética aprobada), que se excusaron uno a uno en la tarea. **`Jose Bearings` (29-sep 17:43 UTC) no está en ningún documento**: se dice tal cual.

## Medición

- **Corrida 01 de `INV-03`:** ESCALADA en 3 intentos. Intento 1: C1, C2, C4 rojos (26 346 / 20 815 tokens, 0,039 $). Intento 2: C2 y C4 rojos (33 652 / 20 800, 0,031 $).
  **Intento 3:** truncado dos veces por longitud (`F-232`), 105 354 / 268 218 tokens, **0,359 $**, C1, C3, C4 verdes; C2 rojo **solo** por `INV-01 · filtro Publicados`,
  que con el artefacto en el árbol pasa solo (16/16). Total 0,43 $, 21,1 min.
- **Revisión a mano: 0 líneas tocadas.** 0 `var(--bw-*)` inexistentes, 0 colores literales fuera de comentarios, tamaños 11/24/14/10/22 px, y capturas reales de los estados
  `warn` (con el panel abierto) y `fail` contra el HTML: fieles. El chevron gira; los dos únicos apartes son el fondo crema en vez de blanco y la flecha del panel.
- **Cifras 7 y 8: NO limpias** (comparte sesión con el arranque del día 28). Es la tercera pantalla seguida sin punto limpio.

## Cosas que se hicieron mal o a medias

- **El commit del artefacto (`e49ec1c`) lleva `[skip ci]`** aunque no salió verde del arnés (escaló): es el caso que la regla permite. La CI entera va en el commit del cierre.
- **No se pudo probar la pantalla en el navegador dentro de la app**: entrar exige sesión contra producción. Se miró con una página de prueba desechable (no comiteada).
- **La corrida no se repite.** El artefacto pasa todas las comprobaciones que dependen de él; repetirla costaría otra tanda de tokens para una cifra que la regla 3 ya excluye.
