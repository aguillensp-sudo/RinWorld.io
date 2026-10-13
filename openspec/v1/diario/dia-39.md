# Día 39 · 13-oct-2026

`INV-04` fase 2 probada de punta a punta y pantalla del canal construida.

## La prueba real (`F-252`)
- La función ya estaba desplegada (v5) y `0061` aplicada; las tablas `ingest_*` estaban vacías. El primer correo rebotó por `DIRECCION_INEXISTENTE`: el alta del canal (`ensure_ingest_channel`) no tenía pantalla, así que se hizo por SQL para JULSA con la misma lógica (token del servidor, remitente protegido).
- Desde `julsaindustrial.com`: `AUTENTICACION`. Se añadió a la función el registro de los veredictos de SES (v6, desplegada por la CI; el paso de CI de `ingest-email` no existía) y salió `spf=PASS dkim=GRAY dmarc=GRAY`. Arsys (DNS y correo) estaba caído; al recuperarse el PO publicó `_dmarc.julsaindustrial.com` (el panel exige el nombre completo) y el reenvío desde su cuenta corporativa salió `PROCESADO` (09:48 UTC, 3 filas).
- Desde Gmail (remitente `a.guillen.sp@gmail.com` autorizado): `FORMATO_NO_RECONOCIDO` hasta que el PO subió el CSV a mano y guardó el mapeo (el canal solo admite perfiles conocidos, decisión 2). Después: `PROCESADO`, 3 líneas `PUBLISHED` nuevas.

## Medidas y tope (decisión pendiente del PO)
Con un guion en Node: 20.000 filas ≈ 0,3 s de CPU y ~70 MB sobre la base; un correo de 37 MB ≈ 1 GB y 4 s. Tope de la fase 2 a 5 MB (`inv04-medidas-funcion.md`).

## Clave de AWS
No comprobada: el conector de AWS pedía autenticación y la CLI no tiene credenciales. Guion para CloudShell en `inv04-comprobar-clave-aws.md`.

## Pantalla `INV-04` (a mano)
`lib/ingest.ts`, `IngestChannel.tsx`, `Inventory` con `onOpenIngest`, `App.tsx`. Dirección con `Copiar` y `Rotar dirección` (confirmación), remitentes, historial con motivo. EDITOR: aviso, sin llamadas. VERA aprende la pantalla (la guía decía que el canal «todavía no funciona»). e2e nuevo contra el proyecto aislado (4 tests) y el de `inventory.spec.ts` actualizado.

## AWS y fase 3 (`.xlsx`), tarde
- Presupuesto `bearingworld-mensual-20usd` creado por la CLI (`aws login --profile nortex`) y verificado; MFA del raíz hecho por el PO tras restablecer la contraseña (`AccountMFAEnabled=1`). Las cuentas miembro no tienen raíz. El MFA de SSO se gestiona desde la cuenta `Identity Delegated Admin`.
- Medidas del `.xlsx` (`inv04-medidas-xlsx.md`): la CPU no manda, la memoria sí. Con el archivo real del PO (100.001 filas, 3 MB, hoja de 21 MB): 0,4 s para leerlo, 0,6 s y 173 MB hasta tener las líneas.
- `xlsx-rows.ts`: lector sin DOM (el de la app usa `DOMParser`), `DecompressionStream`, tope de bytes descomprimidos contado al vuelo (zip bomb) y de filas. El pipeline lo elige por extensión; la importación va en lotes de 20.000 (tope de `import_inventory_for_org`, sin migración). Diferencia con el lector del navegador, a favor del nuevo: no mezcla el texto fonético `<rPh>`.
- El archivo de prueba tiene 76.251 filas duplicadas por `Codigo`+`Marca` (23.750 únicas): `buildLines` descarta las repetidas, como en la subida manual.
- CI y despliegue de `6a3d68c` en verde; la función desplegada (versión 8) lleva el lector, comprobado en el código que sirve Supabase.

- Límite por hora (`b937057`): 20 correos/hora/organización, comprobado tras la lista de remitentes y antes de bajar el objeto; el contador excluye los rechazos previos a la lista y el propio `LIMITE_HORARIO`. Sin migración. CI y despliegue en verde (versión 9).

## Lecciones
- Un heredoc con comillas y tildes rompió el shell: los ficheros con regex o comillas van con el editor (`F-199`).
- Una afirmación de la guía de VERA («todavía no funciona») caducó al desplegar la fase 2; el test de la guía solo cubría que el nombre siguiera en la pantalla.
- El historial de `ingest_events` no guardaba el porqué de `AUTENTICACION`: diagnosticar costó dos envíos. Ahora va al registro de la función.
- `toLocaleString('es-ES')` no pone punto de millares en 4 cifras (`1247`), aunque la spec escriba `1.247`.
