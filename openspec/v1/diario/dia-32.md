# Día 32 de V1 · 7-oct-2026 (segunda sesión del día)

**Encargo del PO:** «Proceder con nueva sesión y generar dos nuevas pantallas a tu elección. Una vez concluyas reviso todo lo pendiente
de la sesión anterior y los nuevos puntos abiertos que dependan de mí.»

## Qué pantallas y por qué esas

Quedaban cuatro sin construir: `INV-04` (necesita `bearingworld.io`, que no está registrado, `F-233`), `MSG-03` (ya vive en `MSG-02`),
`REC-01` y `SET-SEC-01`. Las dos últimas son criptografía y van **a mano**, no por el Coder (Plan §4.3, `CLAUDE.md` §3). Comparten
`key-backup.ts` y el mismo backup del servidor, y `REC-01` es lo que `F-237` decía que faltaba: sin ella, un miembro con backup no
tiene clave en otro navegador. **No hay corrida del arnés hoy**: ninguna de las dos pasa por el Coder, así que no hay filas en
`harness-metrics.csv` ni en `harness-review.csv`.

## Lo construido

- **`0049`** (aplicada por el MCP, privilegios leídos de `pg_proc`; banco de esquema en verde con sus asserts): `key_recovery_attempts`
  (RLS sin políticas), `begin_key_recovery` (cuenta cada petición del backup; la quinta aún lo entrega y abre los 30 min; la sexta,
  `locked` y ningún byte), `end_key_recovery`, `replace_key_backup` (misma pública, otra envoltura) y `discard_key_backup` (solo ADMIN).
- **`lib/key-recovery.ts`**: `openOwnBackup`, `recoverKey`, `changeBackupPassphrase` (abre el blob nuevo con la clave nueva ANTES de
  subirlo), `discardKeyBackup` y los textos. Los bytes de la privada se borran en un `finally`.
- **`REC-01`** (`screens/onboarding/KeyRecovery.tsx`): sale sola al entrar si hay backup y no hay privada en el navegador; contador desde
  el segundo fallo, cuenta atrás de 30 min, enlace «He perdido mi frase» con aviso y casilla (solo ADMIN), «Ahora no» para seguir.
- **`SET-SEC-01`** (`screens/settings/ChangePassphrase.tsx`): botón `Seguridad` en el pie del menú lateral, para quien tiene backup.
  Misma política de fortaleza que `REG-06` (reutiliza `passphraseView`).
- `keys.ts` recuerda si el miembro tiene backup (`keyringHasBackup`); `App.tsx` decide `REC-01` con `ensureKeyring`.

## Lo que el HTML y la spec no resolvían

Ver `F-239`: tabla de divergencias HTML/spec y lo añadido (un «Ahora no», el botón `Seguridad`, el aviso del bloqueo corregido porque
el del HTML es falso en esta versión). Y el límite del servidor **no es estanco** (lectura directa de la fila propia; `end_key_recovery`
sin prueba): dicho en la cabecera de `0049` y en `F-239`, no escondido.

## Qué no se ha hecho

- **No se ha visto en un navegador real**: ni `REC-01` ni `SET-SEC-01` (jsdom: 17 + 12 tests, y la capa criptográfica con 14).
  Hace falta la C5 del PO. Las rutas contra producción escriben (`begin_key_recovery` cuenta intentos; `SET-SEC-01` sustituye el backup
  de JULSA), así que **no las he recorrido yo** con su cuenta.
- Sin e2e de Playwright de las dos (el mock del servidor de `key-generation.spec.ts` serviría de base).

## Tercera sesión del día (7-oct)

El PO pidió «dos pantallas nuevas a tu elección». Comprobado contra `openspec/design-gui/` y `app/src/screens/`: todas las aprobadas están construidas salvo `INV-04` y `MSG-03`. Consultado: el PO eligió no construir pantallas. Sin cambios de código.
