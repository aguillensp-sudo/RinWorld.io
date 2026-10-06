# Día 30 de V1

**Día 30 de V1 · 6-oct-2026 · Estado: CERRADO.** Fecha de máquina: `2026-10-06 13:02 UTC` al arrancar, `14:28 UTC` al cerrar. Orden del PO:
«vamos a por las pantallas REG… procede a generar la REG-05, que debe ser la primera del grupo de 3».

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **`REG-05` construida** (decimonovena pantalla, primera de la Fase B). Es explicativa: sin datos, sin red y sin criptografía, así que la
>    construye el Coder sin romper el Plan §4.3. La ve un ADMIN `REGISTERED`, dentro del shell; su botón lleva a un marcador de `REG-06`.
> 2. **La lista previa destapó `F-234`:** con las 18 303 líneas que el PO importó a las 11:34, `INV-01` no cargaba en producción (6–11 s y 500 por
>    el `statement_timeout`). Arreglado con **`0047`**: las políticas de `inventory_lines` evalúan sus funciones una vez por consulta (494 → 33 ms).
> 3. **Corrida 01 anulada** (regla 3): C2 agotó los 900 s por `F-234` y C4 dio un rojo falso por la palabra «importante» (**`F-236`**, arreglado).
>    Antes, un arranque murió sin coste por falta de `inputs.spec` (**`F-235`**).
> 4. **Corrida 02: VERDE en el intento 2** (0,049 $). El intento 1 solo cayó por un e2e ajeno (`ADMIN-02`, `F-225`).
> 5. **Revisión a mano: +7/−2** (indicador de pasos amontonado e icono de paso hecho). C5, del PO.

## La pantalla

`REG-05` no tenía spec en Markdown, solo HTML y PDF. Se escribió `openspec/v1/REG-05_spec.md` juntando la funcional (§3.3.2) y el HTML, con el
precedente de `LOGIN-01_spec.md`; manda el HTML (`F-170`): título, textos y botón son los suyos y no hay enlace «¿Cómo funciona esto?».

Wiring a mano en `App.tsx`: ADMIN + `REGISTERED` → `AppShell` con VERA `Asistente de registro` y `KeysIntro`; su botón cambia un estado local a
`passphrase` y pinta `BackupPassphrase` (marcador de `REG-06`). El paso no se guarda: al recargar se vuelve a `REG-05`, que no escribe nada.
Un usuario de `FRU` también nace `REGISTERED`, pero no entra: los pasos que pinta la pantalla no son los suyos (`F-217` sigue abierto).

Contrato: 17 de unidad, 1 de CSS y 6 e2e. Comprobado contra una referencia desechable (18 + 6 verdes). La prueba de scroll e2e se reescribió al
verla débil: `scrollIntoViewIfNeeded` desplaza también un `overflow: hidden`; con la rueda falla si se quita el scroll (comprobado).

## `F-234`, o la pregunta de las 20 000 filas

El relevo tenía abierta «cómo se comporta con 20 000 filas». Respuesta: la importación bien, la lectura no. Las políticas llamaban a
`app.current_org_id()` y `app.is_active_member()` —`SECURITY DEFINER`, no inlinables— por cada fila. Medido antes de tocar (transacción
deshecha), banco de esquema en verde, aplicada por el MCP y comprobada en `pg_policies`. `inventory.spec.ts`: de 0 a 13 de 16. Los 3 restantes
fallan por el dato (suponen ~15 líneas de demo en ALPHA) y siguen excusados en la tarea. Las demás tablas con el mismo patrón están sin revisar.

## Lo que costó

| Corrida | Intentos | Coste | Resultado |
|---|---|---|---|
| (arranque) | 0 | 0 $ | `KeyError: 'spec'` antes de llamar al modelo (`F-235`) |
| 01 | 2 | 0,096 $ | ANULADA: parada a mano en los checks del intento 2. El intento 2 no dejó JSON; filas con los números del log |
| 02 | 2 | 0,049 $ | VERDE |

En la corrida 01 el Coder esquivó el check roto escribiendo `impo{'r'}tante`. No llegó a comitearse como código (está en
`harness/metrics/REG-05/corrida-01/` como `.txt`), pero es el dato más interesante del día: un check falso no solo cobra de más, **empuja al
generador a escribir peor**.

## Siembras

`demo_watchers.sql` resembrada (había perdido el `PAUSED`). `npm run demo:reset` antes de cada corrida.

## Por la tarde: `REG-06`

El PO dio la C5 de `REG-05` en su localhost con JULSA y pidió seguir con `REG-06` (`date -u`: 18:35 UTC al cerrar esta parte).

**Dos decisiones del PO antes de escribir nada** (las dos en `DECISIONES-V1.md`):

1. **Frase ≠ contraseña sin mandar la frase a ningún sitio.** Tras el login la app ya no tiene la contraseña, y ADR-001 prohíbe que la frase
   salga del navegador. Se guarda una huella en memoria (`SHA-256(sal ‖ contraseña)`, atada al email) en el login y en el alta de `REG-01`.
   Una recarga la pierde: el botón de `REG-05` cierra entonces la sesión y pide entrar de nuevo.
2. **zxcvbn, como dice la spec**, y no la heurística del HTML. Al medirlo tuve que corregir el ejemplo con el que lo había argumentado:
   `Aaaaaaaaaaaa1!` también saca 3 con zxcvbn. Lo que sí separa: rechaza `Password2024!`, `Qwerty123456!` y `12345678Aa!!` y acepta cuatro
   palabras al azar, al revés que la heurística. Y un timeout en la suite destapó que **con Levenshtein cada medida tardaba hasta 1,4 s por
   pulsación**; sin ella, 3–30 ms. Se quitó.

A mano: `lib/passphrase.ts` (27 pruebas, zxcvbn real), `lib/login-fingerprint.ts` (6), el wiring (`REG-05` → `REG-06` → marcador de `REG-07`,
la frase en un `useRef`), tres tokens de color de la barra sacados del HTML y el contrato: 26 + 1 de unidad y 6 e2e, entre ellos uno que
**espía todas las peticiones de red y falla si alguna lleva la frase**. Referencia desechable: todo verde. Lista previa limpia.

**Corrida 01: VERDE al primer intento**, 0,062 $. Revisión a mano: **una línea de CSS** (fondo gris en los campos en vez de blanco). El
indicador de pasos salió bien a la primera: la tarea le decía que lo copiara de `KeysIntro`, ya revisada.

Un arranque falló sin coste: el proceso en segundo plano heredó otro directorio y Python no encontró `harness`. Se relanzó desde la raíz.

Para `REG-07`: el llavero de demo del MVP (`ensureKeyring`) publica una `public_key` en cada inicio de sesión; por eso JULSA ya tiene una
sin haber pasado por la Fase B. `REG-07` tendrá que decidir qué hace con él.
