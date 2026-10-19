# F-268 · Las 21 divergencias de la matriz, con propuesta

Preparado el 19-oct-2026 (`date -u`) a partir de `openspec/v1/trazabilidad.csv` (21 filas `DIVERGE`, comprobado con
`grep -c ';DIVERGE;'`) y de las notas de cada fila. **Es una propuesta: no decide nada.** La decisión es del PO; lo que
decida va a `DECISIONES-V1.md` y la fila de la matriz pasa a `CUBIERTO` (con la divergencia aceptada anotada) o a la
tarea que corresponda. `openspec/specs/` no se edita (CLAUDE.md §1.3).

Tres salidas posibles por fila:

- **ACEPTAR** · el código manda; queda anotado como divergencia aceptada y la fila deja de contar como roto.
- **CÓDIGO** · la spec manda; se corrige el código (la tarea se estima).
- **SPEC** · hay que enmendar la spec en un change nuevo (el PO decide si merece la pena).

## A · Ya decididas por el PO: solo falta anotarlas (7)

| Fila | Qué ya se decidió | Propuesta |
|---|---|---|
| `single-reference-search#1` | Orden por defecto = lo más reciente arriba (PO 16-oct, `DECISIONES-V1.md:168`) | ACEPTAR |
| `operator-approval#2` | Texto de rechazo ya no promete email (PO 18-oct, `03a2f0c`). Queda el EML-08 en sí | ACEPTAR (sin proveedor de correo, `F-212`) |
| `canonical-schema#1` | La familia de producto deja de ser obligatoria (PO 6-oct) | ACEPTAR |
| `canonical-schema#2` | El precio se descarta en la importación (`INV-02` se aparta en cinco cosas, punto 2) | ACEPTAR; ver nota B-1 |
| `inquiry-card#3` | Bloqueo solo mientras la consulta anterior está `Pendiente` (`F-249`, `0060`) | ACEPTAR |
| `vera-drafting-assistance#2` | El precio unitario es siempre manual (`F-249`, 12-oct) | ACEPTAR |
| `e2ee-content-encryption#1` | `p_quantity` en claro (`ADR-002` D-3) | ACEPTAR |

## B · Sin correo de por medio: texto o mecanismo, barato de arreglar (5)

| Fila | Diferencia | Propuesta | Coste |
|---|---|---|---|
| `passphrase-rotation#2` | Spec: «Passphrase actual incorrecta». Código: «La passphrase actual no es correcta» (sale del HTML aprobado `SET-SEC-01`, que manda) | ACEPTAR: el HTML aprobado manda sobre la spec | Nulo |
| `inventory-upload-channels#2` | El aviso de >50 MB no dice «comprimir o dividir» | CÓDIGO: añadir la frase a `UPLOAD_REJECTED` o a un texto propio para `too_big` | Una línea + test |
| `additional-user-invitation#3` | Aviso de límite de 5 usuarios no sugiere contactar con soporte | CÓDIGO: añadir «o contacta con soporte para ampliar» a `invitations.ts:160` | Una línea + test |
| `ai-column-mapping#1` | Sin sección «Columnas ignoradas»; siguen en la tabla (HTML aprobado) | ACEPTAR: el HTML manda | Nulo |
| `inventory-line-lifecycle#1` | Las líneas nacen `PUBLISHED`, no pasan por `DRAFT` | ACEPTAR (mecanismo; el resultado visible está probado). Dejar `DRAFT` en el tipo es deuda menor | Nulo |

**B-1.** Si el PO acepta `canonical-schema#2`, conviene que el change que cierre `F-269`/precio deje claro que el cifrado de
`unit_price` ya no es objetivo de V1; hoy solo lo dicen `DECISIONES-V1.md` y el código.

## C · Necesitan una decisión de producto (6)

| Fila | Diferencia | Opciones | Mi propuesta |
|---|---|---|---|
| `ai-column-mapping#2` | Con perfil guardado la spec importa sin pedir confirmación; el código abre `INV-02` con banner | (a) ACEPTAR, revisar siempre; (b) CÓDIGO: auto-importar | **ACEPTAR.** Importar sin mirar con datos del distribuidor es más caro de equivocarse que un clic |
| `update-policy#2` | El modo acumulativo no se guarda en el perfil; se elige en cada subida y arranca en `REPLACE` | (a) ACEPTAR; (b) columna `mode` en `inventory_import_profiles` | **ACEPTAR.** `ACCUMULATE` borra menos, pero un valor por defecto persistente que sobrescribe sin querer es el riesgo que `REPLACE` explícito evita. Revisar si el PO lo quiere |
| `data-freshness#1` y `#2` | Sin los textos «Datos de hace X días…» y «Stock posiblemente desactualizado…», sin NOT-INV-03/04, sin nivel crítico a 30 días en la búsqueda | (a) ACEPTAR; (b) CÓDIGO: textos y nivel crítico en `ResultsTable` (sin correos); (c) lo anterior + notificaciones (necesita proveedor, `F-212`) | **(b)** para la parte visible: es lo que el comprador usa para decidir. Las notificaciones, con el correo (`F-212`) |
| `dual-entry-routes#1` | Invitado con token válido nace `REGISTERED`, no `INVITED_APPROVED` automático (`0050`) | (a) ACEPTAR: el canje + activación sustituye el camino; (b) CÓDIGO | **ACEPTAR.** El flujo real (INVT-02 → activación) está probado e2e; la spec describe otro camino |
| `agent-identity#1` | No hay «idioma de perfil»; VERA contesta en el idioma del último mensaje | (a) ACEPTAR; (b) añadir idioma a `members` | **ACEPTAR.** `F-264` ya midió el seguimiento del idioma del mensaje; un perfil sin pantalla de ajuste no se puede cambiar |

## D · Dependen de que exista un proveedor de correo (`F-212`) (2)

`operator-approval#1` (EML-07) y `additional-user-invitation#1` (correo de invitación); el EML-08 de
`operator-approval#2` ya está en A. Hoy el operador y el ADMIN pasan el enlace a mano y la pantalla lo dice. **Propuesta:** ACEPTAR
hasta que se elija proveedor; no hay nada que programar antes. Cuando exista, estas filas (con la de A) se convierten en una sola
tarea (envío de correo) con sus pruebas ya escritas desde la spec.

## E · Cifrado: lo más delicado (1)

`local-storage#1` · la spec dice `member_private_key_{member_id}`; el código usa la base `bearingworld-keys`, almacén
`device-keys`, clave = `member_id`. Cumple la sustancia (CryptoKey no extraíble en IndexedDB). **ACEPTAR** (cambiar la
clave de almacenamiento ahora dejaría sin privada al navegador de JULSA, `ESTADO-V1.md` §3.0). No renombrar nunca sin migración
de lectura.

## Resumen del recuento

| Salida | Filas |
|---|---|
| ACEPTAR | 15 |
| CÓDIGO (barato) | 2 (`upload-channels#2`, `additional-user-invitation#3`) |
| CÓDIGO (decisión) | 2 (`data-freshness#1`, `#2`) |
| Esperan proveedor de correo | 2 (`operator-approval#1`, `additional-user-invitation#1`) |

Suma 21. Lo único que pediría a mano al PO son `data-freshness` (¿textos y nivel crítico en la búsqueda?) y, si no está de
acuerdo, cualquiera de los ACEPTAR de la sección C.
