# Día 31 de V1

**Día 31 de V1 · 7-oct-2026.** Fecha de máquina: `2026-10-07 07:31 UTC` al arrancar. Orden del PO: «procede con REG-07».

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **`REG-07` construida a mano** (criptografía, Plan §4.3) y **la Fase B cerrada**: `REG-05` → `REG-06` → `REG-07` → `REG-09`.
>    Un ADMIN `REGISTERED` sale de aquí con su par X25519, el backup cifrado en el servidor y la cuenta en `KEY_ACTIVE`.
> 2. **`0048`**: `store_key_backup` y `confirm_key_backup`. El estado cambia solo después de que el navegador haya abierto la copia del
>    servidor. Banco de esquema en verde; aplicada por el MCP y comprobada en el catálogo.
> 3. **El llavero de demo deja de publicar** para quien tiene backup o está `REGISTERED` (era lo que le había dado a JULSA una pública).
> 4. **La prueba más fuerte del día**: el e2e abre en Node, con otra implementación de Argon2id, el blob que subió el navegador.
> 5. **`F-237`** (`SPEC-GAP`: textos de error sin aprobar y `REC-01` sin construir) y **`F-238`** (e2e intermitente, arreglado).

## Lo que hace la pantalla

Cuatro pasos, cada uno una función de `lib/key-backup.ts`:

| Paso | Qué hace | Red |
|---|---|---|
| 1 | 32 bytes aleatorios de privada X25519 → `CryptoKey` no extraíble y su pública | — |
| 2 | Argon2id (64 MiB, t=3, p=4, sal de 32) en un Web Worker → clave AES-256-GCM → blob de 48 bytes, AAD = id del miembro. Borra los bytes de la privada | — |
| 3 | `store_key_backup`: pública, blob, IV, sal y parámetros. Nada más | escribe |
| 4 | Relee la fila, **abre la copia del servidor**, comprueba que sale la misma pública y `confirm_key_backup` → `KEY_ACTIVE`. Guarda la privada en IndexedDB y pone el llavero | escribe |

`Reintentar` tras un fallo en 3 o 4 sube el MISMO backup (la spec: «no vuelve a generar claves»); el servidor acepta la repetición. Tras un
fallo en 1–2 empieza de cero: la frase solo se suelta cuando el paso 2 ha salido bien. Sin retrasos artificiales: los pasos 1, 3 y 4 duran
milisegundos y el rodamiento se ve sobre todo en el 2. VERA, sin mensajes guionizados (como en `REG-05`/`REG-06`).

## Lo que ADR-001 no decía y hubo que decidir

Normalizar la frase a NFC; la AAD en minúsculas y UTF-8; `hash-wasm` en un worker (vector de referencia de Argon2id comprobado en la
unidad); dos funciones de servidor y no una; la copia del dispositivo como `CryptoKey` no extraíble que sobrevive al cierre de sesión. Todo
en `DECISIONES-V1.md`. Medido en Node: ~0,3 s por derivación.

## El llavero

`ensureKeyring` publicaba una pública nueva en CADA inicio de sesión. Con `REG-07` eso rompería al miembro: su pública dejaría de ser la del
backup y no podría abrir nada de lo que le escribieran. Ahora: `REGISTERED` no publica; con backup carga la copia del dispositivo o se queda
sin llavero; las cuentas del MVP, como siempre. La consecuencia, en `F-237`: sin `REC-01`, en otro navegador no hay clave.

## Pruebas

| Dónde | Qué | Resultado |
|---|---|---|
| `supabase/tests` | `0048`: forma, parámetros, sobrescribir en `REGISTERED`, confirmar, repeticiones no-op, `ACTIVE` rechazado | verde |
| `key-backup.test.ts` | 24: vector de Argon2id, forma del blob, frase/miembro/sal/bit equivocados, NFC, payload, verificación | verde |
| `keys.test.ts` | +5 del llavero nuevo | 37 verde |
| `device-key.test.ts` | 3, con `fake-indexeddb` (dependencia de desarrollo nueva) | verde |
| `KeyGeneration.test.tsx` | 11 de orquestación, más el de scroll | verde |
| `key-generation.spec.ts` | 3 e2e: la subida se abre en Node; fallo en el paso 3 y reintento; scroll | verde |
| `vitest` entero | 1871 | verde |
| e2e entera, en local | 1.ª pasada 13 rojos (12,4 min); 2.ª, 154 verdes y los 8 conocidos (7,5 min). Los 5 de más (mensajería y `REG-09`) pasan solos y en secuencia | sin regresión |
| CI y producción | `326cc34`: run 37593719431 verde; bundle con los textos y el worker | verde |

El e2e de `REG-07` no escribe en la base: contesta él las dos llamadas que escriben y devuelve en la relectura lo que subió el navegador. El
de `REG-06` ahora corta esas dos llamadas, para seguir sin escribir.

## Dos tropiezos

- **El puerto 4173 cae en un rango reservado de Windows** en esta máquina hoy (`netsh … excludedportrange`: 4077–4176). Los e2e se
  corrieron con una config temporal en el 4391, sin comitear. No se tocó la configuración del sistema.
- **`F-238`**: la reescritura del perfil fallaba a veces y dejaba pasar el perfil real. Helper común con reintento.
