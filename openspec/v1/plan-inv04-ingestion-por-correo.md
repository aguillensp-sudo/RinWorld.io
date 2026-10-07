# Plan · `INV-04` — Ingestión de inventario por correo (Amazon SES)

**Estado: PLAN del 7-oct-2026, sin construir; las seis decisiones de abajo están CONFIRMADAS por el PO.** Dominio: `nortexsys.com` (canal en `ingest.nortexsys.com`, registrado en Arsys con web y dos buzones). Decidido por el PO: dominio propio (no `bearingworld.io`, `F-233`), Amazon SES, tope de
**40 MB** por correo (la spec dice 50 MB; SES recibe hasta 40). El registro del dominio, su DNS en Arsys y la cuenta de AWS son del PO; yo no
accedo a ellos. Spec: `Rinworld_spec_INV-04.md` (aprobada, solo lectura). **Nada de esto se ha construido ni se ha comprobado contra AWS**:
los datos de SES, S3 y de los límites de las funciones de borde hay que **leerlos de su documentación al implementar**, no de este plan.

## Cómo viaja un correo

```
remitente → MX de ingest.<dominio> (Arsys) → SES (eu-west-1) ─┬→ S3 privado: el MIME crudo, borrado a los 30 días
                                                              └→ SNS → función de borde `ingest-email` (Supabase, sin JWT)
`ingest-email`: verifica la firma de SNS · SPF/DKIM/virus de SES · dirección → organización · remitente en la lista ·
                adjunto (extensión, 40 MB) · formato conocido → importa · escribe una fila en el historial
```

El DNS del dominio principal (web y los dos buzones) **no se toca**: solo se añade un registro `MX` para el subdominio `ingest`.

## Decisiones que propongo (el PO las confirma)

1. **Remitente autenticado, no `From`.** El `From` se falsifica. Se acepta solo si SES da `PASS` de SPF **y** DKIM (o DMARC). Si no, `Rechazado`.
2. **Formato: solo perfiles conocidos.** `INV-02` mapea columnas con una persona delante; un correo no puede preguntar. Se procesa solo si la
   cabecera coincide con un perfil de la organización (`inventory_import_profiles`). Si no: `Rechazado · formato no reconocido, súbelo a mano`.
3. **Modo seguro por defecto: actualizar, nunca «Reemplazo total».** Un correo erróneo o falsificado no debe poder pasar a `DELETED` el inventario
   publicado. El reemplazo total sigue siendo cosa de la subida manual.
4. **Dirección con token de 12 caracteres**, no de 6 (`a3f7k9` de la spec es un ejemplo): `ingest-<12>@ingest.<dominio>`.
5. **Extensiones:** `.csv`, `.tsv`, `.txt`, `.xlsx`. **`.xls` binario no** (tampoco se lee en la subida manual: `ESTADO` §5): `Rechazado`.
6. **Límite por organización** de correos por hora, y los rechazados también cuentan en el historial (la spec dice «silenciosamente»: sin
   respuesta al remitente, pero **sí** con fila en el historial del ADMIN).

## Riesgos que decidirán el orden

- **Procesar un `.xlsx` grande en una función de borde.** Las funciones de Supabase tienen límites de CPU y memoria por petición; 20 000 filas
  de Excel pueden no caber. Por eso la **fase 3** aparte: primero CSV/TSV/TXT, que se leen en flujo; el `.xlsx` pequeño después; el grande, si
  hace falta, en un trabajador fuera de la función (una Lambda). **Hay que leer los límites vigentes antes de la fase 2.**
- **Credenciales de AWS.** La función necesita leer el S3: una clave de **solo lectura** del prefijo de ese bucket, en los secretos de la función
  (nunca en el repositorio, `CLAUDE.md` §1.1, y se documenta como un tercer sitio de claves).
- **Superficie nueva.** Recibe datos de cualquiera desde Internet. Firma de SNS verificada, objetos solo del bucket esperado, nada del contenido en
  los registros, y el correo se trata como dato no confiable.

## Fases

| | Qué | Quién | Se comprueba con |
|---|---|---|---|
| **0** | Dominio elegido; cuenta de AWS con MFA y alarma de gasto; **registro `MX` de `ingest.<dominio>` y el `TXT` de verificación**, que yo escribo y el PO pone en Arsys | PO + yo | `dig MX` y la verificación de SES |
| **1** | Base: `ingest_addresses`, `ingest_senders`, `ingest_events`, RLS solo ADMIN, RPC para rotar dirección y gestionar remitentes (con el ADMIN fijo), purga de eventos. **La pantalla `INV-04` no se enseña aún** (una dirección que no recibe sería mentir) | yo, a mano | Banco de esquema |
| **2** | Recepción: regla de SES → S3 + SNS, `ingest-email` con todas las comprobaciones, historial, **CSV/TSV/TXT**; `INV-04` se activa | yo, a mano | Un correo real de prueba de punta a punta; los de rechazo uno por uno |
| **3** | `.xlsx`, ficheros grandes, perfiles; la importación del servidor (variante de `0044`–`0046` para `service_role`) | yo, a mano | Archivos reales del PO |
| **4** | Límites por hora, monitorización, comprobar que la purga a los 30 días borra de verdad, e2e | yo | S3 y la base |

La pantalla `INV-04` (formulario, lista, historial) se puede hacer por el arnés cuando la fase 1 exista; **todo lo que recibe correo y toca claves, no**
(`CLAUDE.md` §3).

## Qué cambia en lo ya aprobado

- `INV-01`: el canal email pasa de «Fuera del MVP» a disponible **solo cuando la fase 2 esté en producción** (mismo criterio que la subida manual, `INV-02`).
- Spec `INV-04`: 50 MB → 40 MB, sin `.xls`, token de 12; lo anota `DECISIONES-V1.md` cuando el PO confirme.

## Antes de empezar, del PO

1. **El dominio** (y confirmar que el subdominio `ingest` está libre).
2. **Una cuenta de AWS** con MFA en el usuario raíz y una alarma de presupuesto.
3. **Confirmar las seis decisiones de arriba**, sobre todo la 2 y la 3.
