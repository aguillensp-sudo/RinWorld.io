# Día 27 de V1

**Día 27 de V1 · 29-sep-2026 · Estado: CERRADO.** Fecha de máquina: `2026-09-29` (`date -u`). Segunda sesión del día:
abre con la orden de trabajo del PO (F-225, el token de invitación y `REG-01`) y cierra con `REG-01` construida y
desplegada, a falta de su C5.

> **EL DÍA EN CINCO LÍNEAS.**
>
> 1. **`F-225`, decidido por el PO: `workers: 1` también en local** (`989b1ad`). Medido después: 3 pasadas con solo
>    los 2 fallos de `F-224` en dos de ellas; más tarde, otra con 2 fallos ajenos de `INV-01`. **No lo elimina.**
> 2. **El token de invitación (`F-223`), a mano:** `0040` (tabla `access_tokens`: solo el hash, 7 días, un solo uso;
>    generar, ver el estado, validar y canjear) y el enlace copiable en `ADMIN-01` (`a60f901`), con el visto bueno del PO
>    a la colocación. El enlace se ve **una sola vez**.
> 3. **`REG-01`, la decimosexta pantalla:** `0041` (`organization_internal` con el NIF, tres columnas públicas,
>    `register_organization`), la Edge Function `register-organization`, la capa de datos `register-org.ts` y la pantalla.
> 4. **La pantalla, por el arnés: VERDE en 1 intento, 0,064 $, 2,1 min.** A mano: +60/−3 (4,5 %), cuatro defectos
>    visuales contra el HTML aprobado.
> 5. **Todo desplegado** (CI de `857b46a`, seis jobs verdes; el bundle trae los textos; la función responde 404 a un token
>    que no vale). Falta la C5 del PO.

## `F-225`

`app/playwright.config.ts` pasa de `workers` solo en CI a `workers: 1` siempre. Suite entera contra producción, tres
pasadas seguidas: 4,6 / 4,2 / 4,3 min; fallos: los 2 de `F-224`; los 2 de `F-224`; los 2 de `F-224` y 2 de `SRCH-01`
(esperan 5 s a una tabla). Ya con el token hecho, una pasada más falló en 2 tests de `INV-01` que pasaron solos. Con
esto son **2 de 5 pasadas con fallos ajenos**, frente a 3 de 4 antes. La suite tarda ~2,7 veces más.

## El token (`0040`)

- **Solo se guarda el hash sha256** del token (dos `gen_random_uuid()`, 244 bits). Consecuencia que el PO aceptó: el
  enlace se ve una vez, al generarlo; si se pierde, se genera otro y el anterior queda revocado.
- **Ninguna función que ejecute `anon`**: el barrido de `F-146` lo cazó en la primera pasada del banco de esquema
  (`registration_link_validate` daba EXECUTE a `anon`). Se resolvió como `access-request`: validar lo hace una Edge
  Function con `service_role`.
- Un token canjeado no se regenera (evita una segunda organización desde la misma solicitud).
- `ADMIN-01`: sección nueva «Enlace de acceso» en el panel de una solicitud aprobada; al reabrirla enseña el **estado**
  (vigente, caducado, canjeado, sin enlace). Una carrera real, cazada por un test: al aprobar, el efecto que pide el
  estado se disparaba antes de que llegara el enlace y lo pisaba (marca `issuingRef`).

## `REG-01` — lo que hay debajo

- **Decisiones del PO:** NIF, países y marcas se guardan; el logo queda fuera; Google se pinta desactivado; el email
  del administrador se comprueba en vivo por la función. Del PO no salió el destino tras crear la cuenta: se
  decidió aquí (sesión iniciada, shell de un `REGISTERED`, `F-218`).
- **`register_organization`** valida la spec en servidor, canjea el token **al final** de las comprobaciones y crea
  organización, NIF y ADMIN en una transacción: un fallo tardío deshace el canje (medido: una PK repetida en `members`,
  lo último que hace la función). El banco de esquema tenía una trampa mía: 23 pruebas de rechazo «pasaban» por un
  error de sintaxis del propio ayudante; se corrigió y se comprobó que cada una trae **su** mensaje.
- **La Edge Function**, probada contra producción con una solicitud sintética (`@bearingworld.test`): validar, email
  libre y ocupado, contraseña floja, datos malos (400, sin cuenta huérfana), alta, reuso del token (404), inicio de
  sesión (200). **Todas las filas de prueba, borradas** (0 en `access_tokens`, `organization_internal`, `auth.users`).
- **El contrato** salió con tres errores míos que solo se vieron contra una implementación de referencia desechable
  (etiquetas con asterisco oculto, textos repetidos en las `<option>`): 40 pruebas de unidad, 2 de CSS y 7 e2e, todos
  verdes con la referencia. **La referencia no se commitea.**

## Medición

- **Corrida 01 de `REG-01`:** VERDE en 1 intento; 37 030 tokens de entrada y 36 433 de salida; 0,064 $; 2,1 min; 1 342
  líneas. Los 4 checks verdes. **Cuenta para la cifra 2** (una corrida válida, sin invalidas).
- **Revisión a mano (`857b46a`): +60/−3**, 4,5 % del artefacto. Tipografía y variables limpias a la primera (0
  inexistentes, 0 colores literales). Los cuatro defectos salieron de comparar la captura del formulario real con la
  del aprobado (la hizo un subagente): resalte azul de la opción marcada, tarjeta sin centrar, icono del aviso de rol y
  flecha nativa de los selects. **El defecto de fondo es el de siempre: el HTML tiene estados (`.on`) que el Coder no
  infiere de la spec.** El logo de Google sale en un solo color (evitó el literal).
- **Cifras 7 y 8: NO limpias** (comparte sesión con el cierre de `F-225` y `ADMIN-01`). Coste de orquestación del día,
  hasta el cierre: **10,02 $ → 40,06 $** (precio-sombra; sesión de Sonnet 5.5, tarifa añadida hoy, `F-227`).

## Cosas que se hicieron mal o a medias

- **El commit del artefacto del Coder (`751b945`) lleva `[skip ci]`** y salió verde del arnés: la regla de
  `CLAUDE.md` §1.6 dice que un artefacto verde **no** lo lleva. No se reescribe (queda como el precedente `0623451`); el
  commit siguiente (`857b46a`) corrió la CI entera y pasó.
- **La Edge Function se desplegó primero por el MCP con el comentario de cabecera resumido**; la CI la redesplegó
  después desde el repositorio (el fichero entero).
- `bearingworld-e2e` sigue en `0039`: sin `0040`, `0041` ni las funciones. No afecta a la CI (el e2e de `REG-01`
  intercepta la función) pero hay que ponerla al día antes de un e2e que toque el alta de verdad.

## C5 parcial del PO sobre `REG-01` (la misma tarde)

El PO probó `REG-01` en su localhost con un enlace de prueba (solicitud sintética `ZZ Prueba REG-01 SL` y su token) y
validó los pasos 1, 2, 3, 5, 6 y 7 («perfectos»). **Tres peticiones**, ninguna un error del artefacto (no entran en la
cifra 4):

1. **Países de operación:** el campo de texto con Intro era «funcionalmente malo» —no dice el idioma ni que haya que pulsar
   Intro—. Ahora es un desplegable de los 194 países que va añadiendo a una caja multilínea con su ×; el país elegido
   deja de ofrecerse y vuelve a ofrecerse al quitarlo. `matchCountry` y la normalización de texto salen de la capa de datos.
2. **Leyenda de obligatorios en blanco:** marcar los términos habilitaba el botón sin decir qué faltaba. Bajo los términos
   hay ahora una leyenda (`role="status"`) con las etiquetas de los obligatorios en blanco, desde el principio. El botón
   sigue dependiendo solo de los términos (spec §4); al pulsar con huecos, el foco va al primero, como antes.
3. **Contacto = administrador:** «si el administrador quiere que su email sea el de contacto público no hay razón para no
   dejarle». Se quita en la pantalla, en la capa de datos y en la base (`0042`, único cambio respecto a `0041`).
   **Se aparta del HTML aprobado**, cuya ayuda decía «distinto del email del administrador»: ahora dice `Máx 30 caracteres`.

Comprobado: 48 pruebas de unidad de la pantalla, 75 de la capa de datos, 8 e2e, vitest entero (1 547) y el banco de
esquema (con el alta de contacto = administrador). Los pasos 4 y 8 del PO quedan cubiertos por esto; **los 9 y 10 (crear
la cuenta y reusar el enlace) los tiene sin probar**. La solicitud y el token de prueba siguen vivos hasta que el PO
termine: **borrarlos después** (`auth.users` con el email que use, `organizations`, `registration_requests`).

## Pasos 9 y 10 del PO, y lo que encontró (la misma tarde)

- **Pasos 9 y 10: correctos, y «todos los cambios OK».** El PO creó una organización con el enlace de prueba y el enlace
  quedó gastado (con sesión abierta lleva al panel; sin ella, «Este enlace no es válido»). Se borraron los datos de la primera
  vuelta (cuenta, organización con su NIF y solicitud sintética) y se le dio un enlace nuevo.
- **Preguntas del PO sobre lo que ve como Operador**, contestadas con datos: la solicitud `ZZ Prueba REG-01 SL` sale en
  `ADMIN-01` porque la creé yo, ya aprobada, para poder darle un enlace (no es una solicitud real): su historial tiene un
  solo evento «Envío FSR» en estado aprobado y sin decisor, porque se insertó directamente así. Y la organización nueva sale en
  la gestión de cobros **por diseño** (`0034`): toda organización nace con su fila de cobro, «EN PRUEBA» 90 días.
- **El fallo real: se coló `alpha@bearingworld.test` como email de contacto público.** Nada lo comparaba con otras
  organizaciones. `0043`: `contact_email_available` rechaza el email de acceso de otro usuario, el de una cuenta solo-Auth y
  el contacto público de otra organización, y admite el del propio administrador. La comprueba `register_organization` (sin
  gastar el token) y la Edge Function (`check_contact_email`, con token) al salir del campo. Probado en el banco de esquema y con
  `curl` contra producción (otra organización `false`, libre `true`, sin token 404).
- Comprobado: tsc; vitest entero (1 556); 54 unitarias de la pantalla y 78 de la capa de datos; 9 e2e; banco de esquema.

**Datos de prueba vivos en producción al cierre:** la organización «JULSA INDUSTRIAL S.A» (segunda vuelta del PO, con `alpha@…`
como contacto: anterior a `0043`), su administrador `a.guillen@julsaindustrial.com` y la solicitud sintética `ZZ Prueba
REG-01 SL` con su token ya gastado. **El PO no ha dicho que se borren**; hacerlo antes de repetir el alta con ese correo.
