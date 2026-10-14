# Día 40 · 14-oct-2026

Día de limpieza del relevo: se cerró lo que no dependía del PO, se decidió con él lo que sí, y de paso salió un hallazgo de rendimiento serio (`F-253`).

## Lo que se cerró sin el PO
- **`F-234` (RLS):** `0062` envuelve en `(select …)` las 31 políticas que quedaban (18 tablas; la cuenta de 31 del relevo era buena). El banco de esquema tiene ahora un chequeo sobre todo `public`: ninguna política puede llamar a `app.f()`/`auth.f()` sin envolver, así que las futuras también lo cumplen. En producción: 0 de 45 a pelo y 15 recuentos de un ADMIN idénticos antes y después.
- **`F-250`:** auditoría por lectura de 13 pantallas que cargan datos. Cuatro tenían la carrera de `SearchResults` (`Inventory`, `Messages`, `Thread`, `Visibility`); arregladas con el mismo contador de cargas y ocho tests que fallan sin el arreglo.
- **`F-252`:** la pantalla del canal avisa de que el dominio de cada remitente necesita DMARC o DKIM.
- **`F-224`, `F-225`, `F-233`, `F-251`:** cerrados. Los dos primeros nacían de correr el e2e del arnés contra producción, que ya no ocurre desde `F-230`.
- **VERA:** la guía verificada cubre `Vendiendo`, resultados de `Comprando`, búsqueda por lotes, `Mis watchers` e `Hilos` (8 entradas, cada nombre comprobado contra el código por `vera-prompt.test.ts`).
- **`INV-04` fase 4:** `0063` programa con `pg_cron` la purga diaria del historial (activó la extensión en producción) y `npm run ingest:salud` es la monitorización mínima.
- Sobraban en el relevo: las Edge Functions de `bearingworld-e2e` (los e2e las mockean), `watchers_evaluate_expirations` (el estado efectivo se deriva al leer y el límite de 50 ya cuenta solo los vigentes), la revisión adversarial de dos brazos y el registro de `0059`.

## `F-253`: la medida que pidió el PO
El entregable 5 («índice de búsqueda dedicado») no decía qué índice. El PO pidió medir. Con 1 millón de líneas en un Postgres local, los índices trigrama sirven; lo que no aguanta es la política `inventory_select_cross_org`, que llama por fila a una función `SECURITY DEFINER`. En producción, con las 24.000 líneas de hoy, una búsqueda cruzada ya tardaba 3,1 s sobre un tope de 8 s: un segundo catálogo como el de JULSA la llevaba al error 500. `0064` calcula el conjunto de propietarios visibles una vez: 3.086 → 45 ms, mismas líneas visibles para 8 espectadores. La RPC que lo lleva a milisegundos queda en el backlog.

## Decisiones del PO (`DECISIONES-V1.md`)
Purga con `pg_cron` diaria; monitorización como consulta que se mira; descartar los 25 hallazgos de la revisión adversarial; reclamar el cupo de Vertex; `Suspender manualmente` sin confirmación; cobros y frescura a mano antes de cada demo; backlog en `BACKLOG-V1.md`; medir el índice de búsqueda ahora.

## AWS: una tarde perdida
Para comprobar por CLI la regla de S3 hubo que abrir sesión. La sesión de SSO había caducado; el usuario SSO es un AWS Builder ID y el login dio «Acceso denegado»; el MFA del raíz dejó de dejar entrar (la app Authenticator del Samsung S22, entrada «Nortex Root»). Se recuperó el raíz y la regla se miró en la consola de S3: `expire-inbox-mail`, activa, `inbox/`, 30 días. El nombre real difería del de la guía (`purga-30-dias`); corregida.

## Lecciones
- **Basta un commit con `[skip ci]` dentro de un empuje para que no corra la CI de ninguno de sus commits**, aunque el último no lo lleve. Pasó tres veces el 14-oct, la tercera por escribir la cadena en el asunto del commit que explicaba la regla: el empuje de la mañana (corrección de carreras, aviso de DMARC) y el de la tarde (`0063`, `0064`, guía de VERA) no corrieron CI ni despliegue. Se resolvió con un empuje posterior de un solo commit sin `[skip ci]`. Regla: el código se empuja primero; la documentación `[skip ci]`, en otro empuje.
- Dije «el mensaje de rechazo ya lo dice» de `.xls` sin mirarlo, y era falso: un `.xls` cae en el fallo de `INV-03` sin explicación. Afirmado sin comprobar; corregido en el backlog.
- Los scripts con comillas y regex van con el editor, no con un heredoc (`F-199`); volvió a romper un comando.
- El PO no sabía qué MFA tenía registrado en el raíz. Un solo dispositivo es una dependencia con un solo punto de fallo.
