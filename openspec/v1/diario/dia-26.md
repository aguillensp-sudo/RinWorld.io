# Día 26 de V1

**Día 26 de V1 · 29-sep-2026 · Estado: CERRADO.** Fecha de máquina: `2026-09-29` (`date -u`). Sesión corta,
continuación de la del día 25: C5 del PO sobre las dos pantallas de ayer y su único defecto.

> **EL DÍA EN CUATRO LÍNEAS.**
>
> 1. **Localhost para pruebas:** `.claude/launch.json` (vite, puerto 5173) para arrancarlo desde el panel
>    (`f16c18f`). Va contra la base de producción, como la demo.
> 2. **C5 del PO: `REG-00-WAIT` aprobada sin cambios; `REG-00` con un solo defecto**: al elegir el país, el
>    teléfono tenía que rellenarse con el prefijo de ese país y seguir siendo editable. Con ellas, **15
>    pantallas aceptadas**.
> 3. **Arreglado a mano en `3abc4c3`:** tabla de prefijos E.164 para los 194 países del HTML aprobado y
>    `phoneForCountry` en la capa de datos; la pantalla la llama al cambiar de país. Comprobado en localhost:
>    España → `+34 `, Portugal → `+351 `.
> 4. **Consecuencia que había que cerrar:** con el prefijo rellenado, `+34 ` solo pasaba por teléfono válido. El
>    teléfono exige ahora al menos 6 dígitos, en la pantalla y en la Edge Function.

## Cómo se comporta el prefijo

- Teléfono vacío → `+<prefijo> ` (con un espacio para seguir escribiendo).
- Si lo escrito empieza por el prefijo del país anterior, al cambiar de país se cambia **solo el prefijo**
  (`+34 963 456 789` → `+351 963 456 789`).
- Si el usuario escribió su propio número (`0034 …`, o sin prefijo), no se toca.
- Los países del plan de numeración norteamericano distintos de EE. UU. y Canadá llevan su código de área
  (`+1 876`, Jamaica): con `+1` a secas el número quedaría a medias.

## Medición

El cambio es una petición nueva del PO en la C5, no un error del artefacto: **no entra en la cifra 4** de
`REG-00` (se queda en +10/−3). Se anota igualmente en `harness-review.csv`: +11/−1 en `AccessRequest.tsx`,
y el resto en la capa de datos, que es trabajo a mano por definición.

Las pruebas nuevas de la pantalla van en un fichero aparte (`AccessRequestPhonePrefix.test.tsx`) y no en el
contrato del Coder, por lo mismo que las del botón del login ayer. El contrato solo cambia en su ayudante de
rellenado: vacía el campo antes de teclear el teléfono de ejemplo, que ya lleva prefijo.
