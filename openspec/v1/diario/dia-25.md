# Día 25 de V1

**Día 25 de V1 · 28-sep-2026 · Estado: CERRADO.** Fecha de máquina: `2026-09-28` (`date -u`). Sesión de las
05:49 a las 07:20 UTC, abierta por el PO con el encargo de elegir dos pantallas y producirlas sin parar.
Las dos comparten sesión, así que **no son puntos limpios de las cifras 7 y 8**.

> **EL DÍA EN SEIS LÍNEAS.**
>
> 1. **Elegidas antes de construir** (regla 1): `REG-00` (FSR) y `REG-00-WAIT` (espera), el flujo de entrada de
>    la Ruta 00.2 que alimenta la cola de `ADMIN-01`. Adenda en `UMBRAL-FABRICA-V1.md` §8 (`18d7cfc`).
> 2. **Capa de datos a mano, sin migración:** `registration_requests` (`0028`) ya tenía los seis campos. Edge
>    Function `access-request` sin JWT (envío con dos frenos de abuso y estado por token) y `access-request.ts`
>    (31 pruebas). Probada con `curl` en la base de e2e: 200, 409, 400, 404, 405, y rechazo con motivo.
> 3. **`REG-00`: VERDE en 2 intentos en su corrida 02**, +10/−3 a mano (el logo usaba un token inexistente y se
>    pintaba a 407 px; faltaba `aria-describedby`). La corrida 01 escaló por dos e2e ajenos (`F-224`).
> 4. **`REG-00-WAIT`: VERDE al primer intento en su corrida 02**, 0 líneas tocadas. La corrida 01 escaló con el
>    artefacto verde por e2e ajenos inestables contra producción (`F-225`).
> 5. **CI entera verde en `65b925b` y desplegado**; comprobado en `rin-world-io.vercel.app` por contenido y la
>    función en producción sin sesión (404 limpio y preflight CORS), sin escribir en la cola.
> 6. **C5 de las dos, pendiente del PO.** Hallazgos nuevos: `F-223` a `F-225`.

## Por qué estas dos

Las que quedaban tenían todas un motivo de descarte escrito el 26-sep. `REG-00`/`REG-00-WAIT` se habían
descartado por «exigen un camino de escritura para `anon` que no existe», y ese camino es exactamente una capa
de datos a mano del tamaño de la de `FRU`: una Edge Function con la service key. La tabla ya existía y el
disparador de `0028` ya escribía `'Envio FSR'` en el historial: el esquema estaba esperando esta pantalla. No
abre el registro a terceros en el sentido de `F-192`: una solicitud no crea cuenta ni organización.

## Lo que salió mal, y es culpa mía

- **Corrida 01 de `REG-00`:** pasé `tsc` y `vitest` antes de correr (la lección de `F-219`/`F-220`), pero **no
  la suite e2e**. En producción vive la cuenta de prueba del PO (`alvaro@vistabahia.eu`), que ocupa una plaza en
  Rodamientos Ibéricos; `INVT-01` (1/5) y `REG-09` (ADMIN solo) fallaban haga lo que haga el Coder. El Coder
  gastó el intento 3 persiguiéndolos: 136 044 tokens de salida y 0,18 $. Se excusan test a test (`F-134`) y la
  lista previa pasa a incluir la suite e2e.
- **Probé a mover el C2 local a `bearingworld-e2e`, como la CI, y lo descarté midiendo**: fallan 15 tests de
  `ADMIN-01`/`ADMIN-02` porque la contraseña del Operador de esa base solo está en el secreto de CI.
- **Dos pruebas de mi contrato de `REG-00` pasaban de 5 s con la suite cargada** (5 037 a 5 092 ms: teclean ~90
  caracteres). Límite a 20 s en ese fichero, sin tocar asertos. Lo vi antes de la corrida de la espera; si no,
  se le habría cobrado a ese Coder.
- **Las pruebas del botón de `Login` las puse dentro de `Login.test.tsx`**, que es el contrato de `LOGIN-01`, y el
  guardia de `--seco` rompió `test_checks` en CI (`5b32322`). Movidas a `LoginRequestAccess.test.tsx`; el
  contrato de `LOGIN-01` vuelve a ser idéntico al original.
- En la nota de revisión escribí «48 tokens» sin medir; eran 35. Corregido antes de comitear.

## Lo que el arnés no ve

El logo de `REG-00` con `var(--bw-h-logo-height)` (no existe; el bueno es `--bw-w-logo-height`) pasó los cuatro
checks: C3 busca colores literales, no variables sin definir. Una variable indefinida no rompe nada que un
test mida y deja el logo a su alto natural, 407 px. Para `REG-00-WAIT` lo comprobé con un bucle sobre todos los
`var(--bw-*)` contra `tokens.css`. Candidato a check del arnés; no se añade a mitad de serie.

## Cifras

| | `REG-00` | `REG-00-WAIT` |
|---|---|---|
| Corrida válida | 02, VERDE en 2 | 02, VERDE en 1 |
| Líneas del artefacto / tocadas | 421 / +10 −3 | 488 / 0 |
| Coste de la válida / con las inválidas | 0,017 $ / 0,249 $ | 0,016 $ / 0,071 $ |
| Corrida inválida | 01, `F-224` | 01, `F-225` |

Orquestación (coste-sombra del medidor, día 28): 5,06 $ antes de empezar y 39,59 $ al cerrar; unos **34,5 $
para las dos**, en 1 h 30 min de reloj. No son cifras limpias: comparten sesión.
