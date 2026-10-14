# Día 40 · 14-oct-2026 · sesión «desarrollo sin VERA» (tarde-noche)

Sesión en paralelo con la de VERA, que estaba cambiando el modelo y escribiendo `vera.real.test.ts`. Encargo
del PO: avanzar sin tocar nada de VERA, decidiendo sola porque él no iba a estar. No se ha tocado `vera*`,
`VeraPanel*`, `supabase/functions/vera/*`, `search.ts`, `CLAUDE.md`, `README.md` ni `ESTADO-V1.md`.

## Lo que se hizo

- **`F-259` · por qué fallaban a ratos los e2e.** Se bajaron el informe y la traza de la corrida que falló en
  `0357340` y se cruzaron con los `edge_logs` de `bearingworld-e2e`. El proyecto se para 4–13 s varias veces
  por hora de uso, auth incluida; en ese parón, hasta una lectura por clave primaria tardó 4,6 s. La suite
  esperaba 5 s por aserción. **`playwright.config.ts`: `expect` a 15 s y test a 60 s.** Se cierra si la CI
  no vuelve a fallar así; si falla, la salida es el plan del proyecto e2e, no subir el número.
- **El e2e de ADMIN-01 con la cuenta de operador ya existía.** `admin-requests.spec.ts` y
  `admin-billing.spec.ts` corren en CI con `E2E_OPERATOR_PASSWORD`. Son de solo lectura a propósito: un pago
  no se puede borrar desde Playwright (F-169). La línea de `CLAUDE.md` §10.1 que dice «cuando exista el e2e
  de ADMIN-01» se ha quedado vieja; no la toco porque `CLAUDE.md` lo tenía abierto la sesión de VERA.
- **`F-260` · primer repaso visual en un navegador real**, hecho por un subagente con Playwright contra
  `bearingworld-e2e`. Cabeceras y padding bien en todo el shell. Se arreglaron cuatro cosas a mano, con test:
  - el scroll de PANEL-01;
  - el fondo `#F1F3F6` de seis pantallas;
  - el aviso de INV-04, que negaba el XLSX;
  - el clic en la fila de ADMIN-01.

  Queda abierto: la guía de VERA dice lo viejo de INV-04 (avisada la sesión de VERA), VERA tapa un tercio a
  375 px, y las tablas anchas se cortan con VERA abierta.
- **`F-192` preparado, sin aplicar** (`supabase/propuestas/F-192/`):
  - una migración revisada contra el catálogo de producción, con el criterio de que un privilegio sin
    política está muerto;
  - el stub con las DEFAULT PRIVILEGES de tablas;
  - un aserto de reglas, no de lista de tablas.

  En el banco: sin la migración, 182 incumplimientos; con ella, `run.sh` entero en verde. El riesgo sigue
  aceptado y el disparador es el mismo.
- **Corriente B, cifras 7 y 8: medidas aquí, por orden del PO (`F-261`).** Propuse una sesión aparte, y el PO
  pidió hacerlo en esta. Las 27 pantallas aprobadas están construidas, así que se reconstruyó `INV-04` (hecha a
  mano, sin tarea del arnés) en `exp/inv-04-fabrica`, que no se fusiona. La elección y sus salvedades se
  escribieron en `DECISIONES-V1.md` antes de la corrida, pero se commitearon después de medir: la hora la prueba
  la transcripción, no git. Fallo mío; lo cazó `git-ops`.
  - Verde en 2 intentos, con 0,065 $ de generador.
  - La revisión cambió 13 líneas de 1.020.
  - Reloj: 27 min.
  - Orquestación: 16,81 $ en bruto, ~10,05 $ sin la relectura del contexto que arrastraba esta sesión.

  La revisión encontró algo serio: el historial decía «ningún correo» sin haberlo consultado.
- **`F-262`: mi corrida del arnés tumbó la CI de la sesión de VERA.** Su e2e y el C2 de mi corrida coincidieron
  contra `bearingworld-e2e`, y el `fixture`/`restore` de cada una repone los mismos hilos. Nadie avisó antes de
  lanzar. Desde entonces se avisa entre sesiones.
- **`F-263`: las `_nota_*` de una tarea no llegan al Coder.** Por eso el botón de quitar salió con el email
  visible.

## Para el relevo (quien cierre el día 40 o abra el 41)

Lo que hay que cambiar en `ESTADO-V1.md`, que esta sesión no ha tocado para no pisar a la de VERA:

- **§1:**
  - F-259: verificado contra los `edge_logs` y la traza del run `38601905364`.
  - F-260: verificado con las capturas y las métricas de Playwright.
  - F-192: verificado con `probar.sh`.
- **§3:**
  - Mirar que la CI del push de esta sesión no tiene fallos de `expect` por infraestructura (F-259); la de
    `bd0a6fe` salió verde entera.
  - **Del PO:** C5 de `INV-04` en `exp/inv-04-fabrica` y decidir si el punto de `F-261` cuenta para la serie de
    las cifras 7 y 8.
  - Antes de lanzar e2e o el arnés contra `bearingworld-e2e`, avisar a las otras sesiones (F-262).
- **§2, Corriente B:** cifras 7 y 8 con dos puntos: `SRCH-03` limpio e `INV-04` con salvedades (F-261).
- **§5:** la fila de F-192 añade «propuesta lista en `supabase/propuestas/F-192/`». Entra F-260 (VERA a
  375 px y tablas anchas).
- **§6:**
  - Sale «Si los e2e de `bearingworld-e2e` son estables»: se sabe por qué no (F-259).
  - Sale «Cómo se ve nada en un navegador»: hay un repaso, F-260. Lo que sigue sin verse es SET-SEC-01, INV-03
    y que Inventario adopte el filtro que deja VERA.
  - Sale «Qué ve al entrar el EDITOR `REGISTERED`»: ve REG-09 «Activa tu cuenta» dentro del shell. Sin
    comprobar si el menú le deja salir de ahí.
  - Entra si 15 s bastan siempre: el máximo visto fue 13,5 s.
- **`CLAUDE.md` §10.1:** la frase «cuando exista el e2e de ADMIN-01» ya no es cierta.

## Lecciones

- **Un fallo «sin relación» que repite en el reintento no es mala suerte.** El volcado del DOM del informe de
  Playwright dijo en un minuto qué esperaba cada test. Los `edge_logs` dijeron por qué.
- **Un test que exige que la pantalla NO diga algo envejece en silencio.** El de INV-04 prohibía «XLSX» y
  siguió en verde cuando XLSX pasó a admitirse: protegía la frase vieja.
