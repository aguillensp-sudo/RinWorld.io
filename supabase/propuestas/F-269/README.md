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
