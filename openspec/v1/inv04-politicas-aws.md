# INV-04 · Políticas de AWS para la fase 2

Preparado el 12-oct-2026. **Nada de esto está aplicado ni comprobado contra AWS**: las políticas son texto; las crea el PO en la consola.
Cuenta `2263-9540-1132`, región `eu-west-1`. Bucket creado por el PO el 12-oct-2026: `nortexsys-ingest-mail-eu-226395401132-eu-west-1-an` (nombre con espacio de nombres de cuenta y región que AWS asigna por defecto; la función lo lee del aviso de SES, no lo lleva en el código).
Prefijo de los correos: `inbox/`.

## 1 · Política del bucket (deja a SES escribir, y a nadie más)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SesPutInbox",
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::nortexsys-ingest-mail-eu-226395401132-eu-west-1-an/inbox/*",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "226395401132" },
        "StringLike": { "aws:SourceArn": "arn:aws:ses:eu-west-1:226395401132:receipt-rule-set/*" }
      }
    }
  ]
}
```

## 2 · Política IAM del usuario de la función (solo leer objetos de `inbox/`)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadInboxObjectsOnly",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nortexsys-ingest-mail-eu-226395401132-eu-west-1-an/inbox/*"
    }
  ]
}
```

Sin `ListBucket` (la clave del objeto llega en el aviso de SNS), sin `PutObject`, sin `DeleteObject` (la purga la hace el ciclo de vida del bucket).

## 3 · Ciclo de vida del bucket

Regla `expire-inbox-mail` (en la guía original se llamaba `purga-30-dias`; el nombre real en AWS es este): prefijo `inbox/`, expirar objetos a los **30 días**, y abortar subidas multiparte incompletas a los 1 día.

## Qué pulsar (consola de AWS, región Irlanda `eu-west-1`)

1. **S3 → Create bucket.** Nombre `nortexsys-ingest-mail-eu-226395401132-eu-west-1-an`, región `eu-west-1`. Deja marcado **Block all public access**. Cifrado: **SSE-S3** (el predeterminado; no KMS, complica la política de SES).
2. Dentro del bucket → **Permissions → Bucket policy → Edit** → pega la política 1 → Save.
3. Dentro del bucket → **Management → Create lifecycle rule** → política 3 (prefijo `inbox/`, Expire current versions 30 días, además "Delete expired object delete markers or incomplete multipart uploads" a 1 día).
4. **IAM → Policies → Create policy → JSON** → pega la política 2 → nombre `bearingworld-ingest-read-inbox`.
5. **IAM → Users → Create user** → nombre `bearingworld-ingest-fn`, **sin** acceso a la consola → Attach policies directly → `bearingworld-ingest-read-inbox`.
6. En ese usuario → **Security credentials → Create access key** → caso de uso "Application running outside AWS" → crea la clave. **No me la pegues en el chat ni la guardes en ningún fichero.** Pásala a los secretos de la función con:
   `supabase secrets set AWS_INGEST_ACCESS_KEY_ID=... AWS_INGEST_SECRET_ACCESS_KEY=...` (o en el panel de Supabase → Edge Functions → Secrets del proyecto `troxminloxkjwihwfevs`). Recuerda que la CLI está en otra cuenta (F-073): usa el panel.
7. Avísame cuando esté. Yo compruebo que la función lee un objeto de prueba, y que la clave **no** puede listar, escribir ni leer fuera de `inbox/`.

## Posibles tropiezos

- La cuenta es miembro de una organización con rol federado: una política de la organización (SCP) puede impedir crear usuarios IAM o claves de acceso. Si el paso 5 o 6 falla con "explicit deny", me dices el texto del error.
- Si pone que el nombre del bucket ya existe, elige otro y lo cambio en las políticas 1 y 2.
- Una clave de acceso de larga duración es el punto débil de este diseño: anótala con fecha para rotarla (cada 90 días) y bórrala si sospechas de filtración.

## Secretos de la función `ingest-email` (los cinco que exige `index.ts`; sin cualquiera de ellos responde 500)

| Secreto | Valor |
|---|---|
| `INGEST_SNS_TOPIC_ARN` | el ARN del tema de SNS que escribe a la función (la función rechaza cualquier otro) |
| `INGEST_DOMAIN` | `ingest.nortexsys.com` |
| `AWS_INGEST_ACCESS_KEY_ID` | clave de solo lectura (política 2) |
| `AWS_INGEST_SECRET_ACCESS_KEY` | su secreto |
| `AWS_INGEST_REGION` | opcional; `eu-west-1` por defecto |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los pone Supabase.

**Comprobado el 14-oct-2026 en la consola de S3** (bucket `nortexsys-ingest-mail-eu-226395401132-eu-west-1-an`, `eu-west-1`): la regla `expire-inbox-mail` está `Enabled`, con filtro de prefijo `inbox/`, caducidad de la versión actual a los 30 días y eliminación de subidas multiparte incompletas. Lo vio el PO a mano; no hay comprobación por CLI (la sesión de SSO no pudo abrirse ese día). Que el borrado ocurre de verdad solo se verá cuando el primer objeto cumpla 30 días (los primeros correos son del 12 y 13-oct, así que hacia el 12-nov): ese día conviene mirar que `inbox/` ya no los tiene.
