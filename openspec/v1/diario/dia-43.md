# Día 43 · 17-oct-2026 (cierre el 18-oct, 05:42 UTC)

Una sola sesión, la de la corriente C. Se cruzó la medianoche.

## Matriz de trazabilidad (`F-265`, `F-266`, `F-267`, `F-268`)

Nivel 2 del cifrado: vectores públicos, IV no repetido y que la frase no sale en recuperar y rotar. El PO decidió sin Wycheproof y sin tope
duro de usos por clave. Pasos 3 y 4: pruebas escritas desde la spec para los escenarios sin prueba y los parciales (45 pruebas nuevas en 25
ficheros `*.parciales.test.*`). Las que fallaban contra el código no se borraron: el escenario pasó a `DIVERGE`. Al cerrar la sesión, la matriz
dice 82 CUBIERTO, 21 DIVERGE, 40 NO_IMPLEMENTADO, 35 PARCIAL, 4 SIN_PRUEBA y 3 FUERA, 185 en total.

## VERA filtra el Directorio por país

`navegar` admite `pais` (código ISO de dos letras) con la pantalla `Empresas`; la herramienta solo filtra por un país que tenga organizaciones
(los países salen de la base, como el desplegable) y, si no, lo dice y no mueve la pantalla. El 18-oct, muestra con `claude-sonnet-5` real y
una vez por frase: Polonia → `PL`, «empresas alemanas» → `DE`, Islandia → `IS`, «las del sur» → pregunta. No se probó el segundo turno.

## Dos decisiones del PO sobre las divergencias de `F-268`

1. **Texto de rechazo de `ADMIN-01`.** El panel decía que el motivo iba en un email (EML-08) que no sale (`F-212`). Ahora dice que el solicitante
   lo ve al consultar el estado de su solicitud. `03a2f0c`, CI verde.
2. **El verificador y la prueba de la frase (`F-242`) pasan a ser contrato.** Decisión final del PO: se acepta la divergencia y el código no
   cambia. `openspec/specs/` no se edita: el contrato nuevo es el change `amend-e2ee-key-verifier` (sin archivar) y `ADR-001` lleva la adenda del
   §11. La autoridad es la fila del 7-oct, `F-242` y `0053`/`0054`, no la ADR. Antes de escribirlo se contrastó el texto con el código y se
   encontró un desajuste: al generar, `public_key` es la del par nuevo, que `store_key_backup` registra; solo `replace_key_backup` exige que
   coincida con la ya registrada. El PO corrigió el AND y se escribieron cinco pruebas desde el texto modificado. `2e5d17f`.

Corrección en `F-242`: el argumento no es «la prueba es de 256 bits»; es que nada de lo que el servidor recibe o guarda comprueba una frase
candidata con menos coste que un Argon2id con los `kdf_params` guardados.

## `F-269` (abierto, sin tocar código)

Tres huecos que la decisión deja a la vista: `replace_key_backup` no cuenta intentos fallidos, `begin_key_recovery` entrega el blob sin pedir
la prueba, y la vía «sin prueba, una vez» de `0053:141-148`. Para esta última el hallazgo propone cerrarla eliminando los backups sin verificador
(contar, abrir en `REC-01` o descartar) y después una migración que la quite. Decide el PO; es criptografía y se hace a mano.

## Lo que se vio de paso

- El worktree no trae `app/node_modules`: hay que enlazarlo con una junction (`CLAUDE.md` §11.1). No se comitea.
- Un heredoc del shell se comió las barras invertidas de un script con regex: se crea con el editor (`F-199`).
- Con la suite entera de `vitest` y la máquina cargada fallan al azar tests por el tope de 5 s; aislados, pasan.

## Al cierre

`2e5d17f` publicado en `mvp/bootstrap`. Su CI (run `39101154327`) seguía en curso: sin resultado. Árbol limpio antes de este cierre.
