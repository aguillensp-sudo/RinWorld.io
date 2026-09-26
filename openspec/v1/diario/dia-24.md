# Día 24 de V1

**Día 24 de V1 · 26-sep-2026 · Estado: CERRADO.** Fecha de máquina al cerrar: `2026-09-26`, 08:16 UTC
(`date -u`). Sesión de la mañana, de las 07:31 a las 08:16 UTC; comparte sesión con el cierre de
`F-214` y `F-178`, así que **no es un punto limpio de las cifras 7 y 8**.

> **EL DÍA EN SEIS LÍNEAS.**
>
> 1. **C5 del PO recibida: `DIR-02` e `INVT-01` aprobadas** (en su localhost, sin pulsar nada que
>    escriba). Con ellas son **11 pantallas de la fábrica aceptadas**.
> 2. **`F-214` cerrado y probado de extremo a extremo.** La app cierra la sesión de un miembro
>    revocado (`isRevoked`), la Edge Function `ban-revoked-member` pone `banned_until` en Auth y
>    el login de una cuenta baneada dice «Tu acceso… ha sido revocado». Probado con una cuenta
>    desechable que creó el PO en el panel: `Eliminar` en `INVT-01` → `CANCELLED` y
>    `banned_until = 2126-09-02` en el mismo instante; Auth respondió `User is banned`.
> 3. **`F-178` cerrado:** `resetDemo` repone las 5 reacciones del foro (medido en producción:
>    `c003` 3, `c004` 1, `c001` 1). `F-212` y `F-211` se dejan como están (decisión del PO).
> 4. **`REG-09` (Bienvenida) y `FRU` (Registro de usuario adicional), las pantallas 12 y 13:
>    ambas VERDE en 2 intentos en su corrida 02.** `REG-09`: 434 líneas, 2 ficheros, **0 tocadas**;
>    `FRU`: 597 líneas, 2 ficheros, **+2/−2 a mano en 1 fichero** (eyebrow 11 px y título 22 px,
>    las mismas dos diferencias que en `INVT-01`). **Las dos esperan la C5 del PO.**
> 5. **Dos corridas inválidas por defectos MÍOS de contrato (`F-219`, `F-220`)**, una por
>    pantalla, conservadas como evidencia y fuera de la cifra 2. Coste con ellas: `REG-09`
>    0,0928 $ (la válida, 0,0297 $) y `FRU` 0,1045 $ (la válida, 0,0389 $).
> 6. **Un tropiezo mío sin consecuencia, dicho:** al desplegar por MCP `ban-revoked-member` subí
>    un relleno (`PLACEHOLDER`) en vez del código y lo redesplegué a los pocos segundos; nadie
>    llamaba aún a la función. La CI la sustituyó por el fichero completo (versión 3).

## `F-214`, paso a paso

`session.ts`: `isRevoked` (`SUSPENDED`/`REJECTED`/`CANCELLED`) → `signOut` y mensaje; los estados
previos a la activación no cuentan. La Edge Function valida el JWT contra Auth, lee de `members`
quién llama y exige ADMIN `ACTIVE` de la misma organización sobre un EDITOR ya `CANCELLED`: no
puede revocar a nadie por sí sola. `removeMember` la llama tras `remove_member` y, si el ban
falla, lo dice sin deshacer la revocación. `signInErrorMessage` traduce `User is banned`. La
cuenta desechable se borró después en el panel (0 filas en `auth.users` y `members`, comprobado).
**Sin resolver:** una cuenta baneada no se puede reinvitar con el mismo correo; no hay operación
inversa.

## `REG-09` y `FRU`: qué se construyó y qué no

Elegidas porque forman un flujo y reutilizan `invitations.ts` y el límite de 5; descartadas, con
su motivo, en `DECISIONES-V1.md`. **Precondiciones a mano** (commit `e1ae90f`): migración `0038`
(`is_onboarding_admin`, `onboarding_seats_used`, `activate_own_membership`, `email_has_account`
ampliada a ADMIN `KEY_ACTIVE`, `add_registered_member` solo `service_role`), con 20 asertos en el
banco de esquema (269 OK en total) y **aplicada en las dos bases con los privilegios releídos del
catálogo**; la Edge Function `register-additional-member`; `onboarding.ts` (31 pruebas). Wiring en
`App.tsx` (un ADMIN `KEY_ACTIVE` ve `REG-09`, o `FRU` tras `Sí, añadir…`, dentro del shell
estándar) y `useSession().refresh`. **Contrato:** 16 pruebas de `Welcome` y 21 de `AdditionalUser`
(más un test de scroll cada una) y dos ficheros e2e.

**Lo que el HTML aprobado decide sobre la spec** (regla de `F-170`): botón `Ir al panel`, contador
que cuenta al ADMIN (`2 de 5`), textos de la comprobación del email, contraseña puesta por el
ADMIN. **Lo que NO existe y sigue sin existir:** el flujo E2EE que lleva a un ADMIN a `KEY_ACTIVE`
(`F-218`) y el del nuevo usuario para pasar de `REGISTERED` a `ACTIVE` (`F-217`); el alta crea
cuentas que hoy no se pueden completar.

## Los dos errores de contrato (`F-219`, `F-220`) y la corrida de CI (`F-221`)

- **`F-219`:** dejé el contrato de `FRU` en el árbol durante la corrida de `REG-09`. `C1` corre todo
  Vitest y `C2` todo Playwright, así que fallaban en los tres intentos con 22 pruebas y 3 e2e de una
  pantalla que aún no existía. Las 16 pruebas de `Welcome` pasaron los tres intentos.
- **`F-220`:** al separar el e2e copié una constante `EDITOR` sin usar y `noUnusedLocals` rompió
  `tsc` en los tres intentos de `FRU`. **Raíz común: validé la tarea en `--seco`, que solo mira
  que existan los ficheros, y no ejecuté `tsc` ni `vitest` sobre el árbol antes de gastar tokens.**
  Ahora la lista previa a una corrida es esa, a mano.
- **`F-221`:** la CI de `REG-09` salió roja en el último paso (404 del bundle recién desplegado, una
  carrera de propagación de Vercel). Comprobado por contenido después; el paso reintenta.

## Comprobaciones de hoy

`tsc` limpio · 1 253 pruebas de unidad antes de las nuevas · CI verde en los seis jobs en `b6d2323`
(la de `4e6c3d0` roja solo por `F-221`) · producción sirve por contenido `Registro de usuario
adicional`, `Usuario registrado correctamente.`, `Este email ya está registrado en la plataforma.` y
`Equipo al completo` · `register-additional-member` responde 401 sin sesión y con la clave
anónima, y 400 con contraseña floja o nombre corto. **No se ha creado ninguna cuenta con ella.**
