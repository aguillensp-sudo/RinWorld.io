# Change: amend-e2ee-key-verifier

**Estado:** propuesto, sin archivar. `openspec/specs/` no se edita (CLAUDE.md §1.3); este change es el contrato nuevo.

## Por qué

El 7-oct-2026 se cerró `F-242` (`0053`, `0054`): sin un verificador de la frase, cualquiera con la sesión de un miembro podía subir un
backup con su propia frase y dejar a la víctima sin recuperación. El diseño añade dos valores derivados de la frase que viajan al servidor,
y la spec de `e2ee-key-management` (escrita antes) dice que el payload son cuatro campos y que no sale «ninguna forma derivada» de la
frase. El paso 4 de la corriente C (`F-268`) lo midió: dos escenarios divergen del contrato, el código no.

El PO decidió aceptar la divergencia (`DECISIONES-V1.md`, fila del 18-oct-2026) y recoger el diseño de `F-242` en el contrato.

## Qué cambia

- **`key-wrapping`:** de la misma salida de Argon2id que da la wrapping key sale una **prueba** de la frase (32 bytes, HKDF-SHA-256, salt vacío,
  info `bearingworld.io/key-backup/proof/v1`); al servidor solo llega su SHA-256 (`key_verifier`). El payload de subida pasa a seis campos:
  los cuatro de siempre más `key_verifier` y `public_key`. `public_key` es la del par recién generado, que `store_key_backup` registra;
  al rotar, `replace_key_backup` exige que coincida con la ya registrada.
- **`server-blind-storage`:** se permiten exactamente dos valores derivados de la frase: la prueba (solo al rotar, para demostrar que se conoce
  la frase actual; el servidor no la guarda) y el verificador (en todo backup; se guarda). Se añade el criterio que los acota: nada de lo que
  el servidor recibe o guarda permite comprobar una frase candidata con menos coste que un Argon2id con los `kdf_params` guardados.

## Qué no cambia

Argon2id `{m:65536,t:3,p:4}`, sal de 32 bytes, AES-256-GCM con IV de 12 y `member_id` como AAD, el blob de 48 bytes, y que la frase, la salida de
Argon2id, la wrapping key y la privada no salen del navegador. El código y la base no cambian (`key-backup.ts`, `key-recovery.ts`, `0053`, `0054`).

## Por qué el argumento es el coste y no el tamaño

La prueba no es «de 256 bits y por eso no se adivina»: su entropía es la de la frase. Lo que la hace admisible es que quien la tiene (o el
verificador) solo puede comprobar una frase candidata derivando Argon2id con los `kdf_params` guardados, y ese mismo coste ya lo impone el blob,
que permite el mismo ataque fuera de línea. El verificador no es una vía más barata.

## Autoridad y punteros

- `DECISIONES-V1.md`, fila del 7-oct («hazlo F-242 ahora») y la del 18-oct-2026 que acepta esta divergencia.
- `openspec/mvp/findings/F-242.md`, `F-268.md`; migraciones `0053_verificador_de_la_frase.sql` y `0054`.
- ADR-001 **no** respalda el diseño: no menciona ni la prueba ni el verificador, y su §7.1 paso 6 también da cuatro campos. Por eso se amplía con la
  adenda del §11 de la propia ADR.

## Fuera de este change (abierto, sin tocar código)

Ver el hallazgo nuevo que abre esta decisión: `replace_key_backup` no cuenta intentos fallidos; `begin_key_recovery` no pide la prueba antes de
entregar el blob; la vía «sin prueba, una vez» de `0053:141-148`. Decisión del PO, criptografía a mano.
