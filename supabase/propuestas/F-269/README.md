# F-269 · borrador, NO aplicado

Preparado el 19-oct-2026. **No está en `supabase/migrations/` a propósito:** criptografía, a mano y decisión del PO
(`F-269`). Nada de aquí se ha ejecutado contra `troxminloxkjwihwfevs`.

## Lo comprobado hoy (SQL en producción)

- `members` con blob: 5 `ACTIVE` con verificador, 1 `CANCELLED` sin él. **Ningún miembro vivo depende de la vía «sin prueba».**
- El cuerpo de `replace_key_backup` (`0053:100-157`) no toca `key_recovery_attempts`.

## Por qué no basta con un `insert` y un `raise`

Un `raise exception` revierte la transacción de la función: el intento fallido que se contara justo antes **se perdería**.
Por eso `begin_key_recovery` devuelve un `status` en vez de lanzar. El borrador hace lo mismo con `replace_key_backup`:
**cambia el tipo de retorno de `void` a `table(status, seconds_left, attempts_left)`** (hay que soltarla y crearla, como
hizo `0053` con `begin_key_recovery`) y toca `key-recovery.ts` y `ChangePassphrase.tsx`.

## Piezas

1. `0066_replace_key_backup_cuenta_intentos.sql` (borrador): usa la misma tabla y ventana (5 por 30 min) que
   `begin_key_recovery`. Un fallo de prueba cuenta y devuelve `wrong_proof`; con el bloqueo activo devuelve `locked` sin
   mirar la prueba; un acierto **no** reinicia el contador (igual que `0052`).
2. Quitar la vía «sin prueba, una vez»: como el recuento de backups sin verificador de miembros vivos es 0, la rama
   `m.key_verifier is not null and …` pasa a exigir la prueba siempre. El `CANCELLED` sin verificador no puede llamar a la
   función (`state not in ('KEY_ACTIVE','ACTIVE')`).
3. **Fuera de este borrador:** `begin_key_recovery` pidiendo la prueba antes de entregar el blob (hueco 2). Cambia el
   protocolo de `REC-01` (el cliente tendría que derivar antes de pedir el blob, y no tiene la sal sin el blob), así que
   necesita diseño aparte: no es una migración.

## Antes de aplicar

- Repetir el recuento del punto de arriba **el día que se aplique**.
- Pruebas desde la spec en `01_schema_smoke.sql` (5 fallos → `locked` el sexto, un acierto no reinicia, la ventana vence a los 30 min) y en `key-recovery` del cliente.
- Cambia el tipo de retorno: migración aditiva primero no es posible con la misma firma. Hay que desplegar migración y cliente juntos, o
  dejar una función nueva con otro nombre un día. El `localhost` del PO ejecuta la carpeta de trabajo contra producción.

## El cliente (qué cambia al aplicar)

Un solo llamador: `app/src/lib/key-recovery.ts`, `rewrapBackup` (`supabase.rpc('replace_key_backup', …)`, ~l.228), que hoy
trata cualquier `error` como «No se pudo guardar la nueva frase». Con el borrador, la RPC devuelve una fila
`{status, seconds_left, attempts_left}` y:

- `ok` → igual que hoy.
- `wrong_proof` → «La passphrase actual no es correcta» (el texto aprobado de `SET-SEC-01`) con los intentos que quedan.
- `locked` → el mensaje de bloqueo con los minutos, el mismo que ya usa `REC-01`.

**No hay doble cuenta en el camino legítimo:** `openOwnBackup` ya cuenta una petición en `begin_key_recovery`, y
`replace_key_backup` solo cuenta los fallos. Un cambio de frase normal gasta 1 de las 5, como hoy.

## Pruebas por escribir (desde la spec `passphrase-rotation#2`, no desde el código)

SQL, en `supabase/tests/01_schema_smoke.sql` junto al bloque de `0049/0053`:
1. Prueba mala → `wrong_proof` con `attempts_left = 4`, y la fila de `key_recovery_attempts` sube a 1 (el intento sobrevive).
2. Cinco malas → la quinta devuelve `locked`; la sexta, aunque lleve la prueba buena, devuelve `locked` y el backup no cambia.
3. Prueba buena tras 2 malas → `ok` y el contador **no** se reinicia.
4. Ventana vencida (`window_started_at` a hace 31 min) → el contador vuelve a empezar.
5. Miembro con `key_verifier is null` → excepción; no es posible sustituir sin prueba.
6. Privilegios contra el catálogo (`has_function_privilege`): `authenticated` sí, `anon` no (`F-146`).

Cliente (Vitest, `key-recovery`): los tres `status` mapeados a sus mensajes; ninguna rama borra `privateBytes` dos veces.
