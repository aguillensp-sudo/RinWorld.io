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

A petición del PO («diseña ambas»), propuesta de `INVT-02` (canje de invitación) y `ACT-02` (activar a un EDITOR) en `openspec/v1/diseno/`, con spec y cinco decisiones (`F-240`). Maquetas abiertas solo en el panel del navegador: cargan sin errores y los estados conmutan; la maquetación no se vio.

## Cuarta sesión del día: `INVT-02` y `ACT-02` construidas

El PO aprobó las cinco decisiones y pidió construir. **Antes de escribir código** se comprobó contra el esquema lo que la propuesta
había dejado sin comprobar, y la primera afirmación era falsa: un EDITOR que pierde su frase no puede «ser invitado de nuevo»
(`invite_member` rechaza el correo y `remove_member` solo marca `CANCELLED`). Por eso `0050` abre `discard_key_backup` al EDITOR: con
`ACT-02` ya tiene camino de vuelta, que era el motivo de que fuera solo del ADMIN (`F-217`).

- **Base (`0050`)**: `access_tokens` ya admitía `MEMBER_INVITATION` desde `0040`, así que el enlace sigue el patrón de `REG-01` (hash, un
  solo uso). `issue_invitation_link`, `revoke_invitation`, `invitation_link_validate`, `redeem_invitation`; `revoked_at` y estado
  `Anulada`; `activate_own_membership` y `discard_key_backup` abiertos al EDITOR. Banco de esquema: seis bloques nuevos, en verde a la
  primera salvo un nombre de organización repetido (el `sed` de arreglo tocó antes otro que no era mío; revertido).
- **Función de borde `accept-invitation`**, sin JWT, desplegada por la CI. Probada en producción con una invitación sintética: `validate` →
  `accept` → canjeado = 404; todo borrado y comprobado.
- **Pantallas**: `INVT-02` (sin shell, como `REG-01`), `ACT-02` (con la variante de contraseña provisional), el modal del enlace de `INVT-01`
  con `Nuevo enlace` y `Anular`, y el rótulo de los pasos de `REG-05/06/07` para un invitado. `App.tsx`: ruta del enlace, rama del EDITOR
  `REGISTERED`, activación automática tras `REG-07`.
- **Tests**: unitarios completos en verde (1967); nuevos para las dos capas de datos, las tres pantallas y el cableado. Sin e2e nueva.

Tropiezos: dos heredocs de shell fallaron por comillas y se pasó a ficheros con el editor (`F-199`); el primer token de prueba tenía 66
caracteres y la función lo rechazó con razón; `userEvent.setup()` pisa el portapapeles que un test acababa de definir.

## Quinta sesión (mismo día): lo que no dependía del PO

- **`F-231` no se tocó, y es lo importante.** Se intentó sustituir `toLocaleString('es-ES')` por `formatCount` en `Inventory`, `InventoryTable`,
  `Messages` y `Panel`. Cuatro tests lo impidieron, con razón: `F-024` decidió que `1247` es el español correcto (CLDR y RAE no agrupan cuatro
  cifras) y las specs de `INV-03` escriben `1.247`. Son dos decisiones que se contradicen: la elige el PO, no un arreglo. Revertido, sin commit.
- **`F-234` en las demás tablas**: auditado contra `pg_policies` de producción, solo lectura. 39 políticas sin envolver, por riesgo en `F-234`.
- **`0051` (aprobado por el PO)**: las 8 políticas de `threads`, `thread_items` y `thread_item_keys` evalúan sus funciones de sesión una vez por
  consulta, igual que `0047`. Banco de esquema entero en verde con un chequeo del catálogo; aplicado por el MCP y comprobado en `pg_policies` de
  producción. Ganancia sin medir; quedan 31 políticas (`F-234`).

## Sexta sesión: `F-239` cerrado con `0052`

El PO pidió cerrarlo ya. Tres hallazgos al construirlo: (1) `members_select_own_org` dejaba leer el blob de **todos los compañeros**, no solo el
propio; (2) el `update` directo del blob tampoco estaba cerrado; (3) la mitad de las pruebas antiguas del disparador de `members` esperaban que
parara él, y ahora para antes el permiso de columna (nuevo `expect_denied`).

Orden: cliente primero (`verifyKeyBackup` pasa a `read_pending_key_backup`, `REC-01` deja de llamar a `end_key_recovery`), migración después.
Incidencias: GitHub dio HTTP 500 al relanzar y al hacer `push` (reintentado en segundo plano hasta que volvió) y el e2e de `REG-07` falló porque su
servidor simulado seguía contestando al `select` quitado; adaptado. Producción comprobada por el catálogo y con `select encrypted_key_blob` como
`authenticated` → `42501`. Abierto: `F-242`.
