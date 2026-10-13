# INV-04 · Comprobar la clave de AWS de `ingest-email` y rotarla

Preparado el 13-oct-2026. **No se ha ejecutado**: el conector de AWS de esta sesión pide autenticación y la CLI local no tiene
credenciales, así que lo corre el PO en **AWS CloudShell** (consola de AWS, región `eu-west-1`, icono `>_` de la barra superior),
con su propia sesión. No hace falta tocar ni ver la clave: el simulador de IAM evalúa las políticas del usuario `bearingworld-ingest-fn`.

## 1 · ¿Qué puede y qué no puede hacer el usuario?

```bash
U=arn:aws:iam::226395401132:user/bearingworld-ingest-fn
B=arn:aws:s3:::nortexsys-ingest-mail-eu-226395401132-eu-west-1-an

sim() { aws iam simulate-principal-policy --policy-source-arn $U --action-names "$1" --resource-arns "$2" \
          --query 'EvaluationResults[0].EvalDecision' --output text; }

echo "GetObject  inbox/x          (debe ser allowed):"; sim s3:GetObject    "$B/inbox/x"
echo "GetObject  otra/x          (debe ser implicitDeny):"; sim s3:GetObject    "$B/otra/x"
echo "ListBucket bucket          (debe ser implicitDeny):"; sim s3:ListBucket   "$B"
echo "PutObject  inbox/x         (debe ser implicitDeny):"; sim s3:PutObject    "$B/inbox/x"
echo "DeleteObject inbox/x       (debe ser implicitDeny):"; sim s3:DeleteObject "$B/inbox/x"
echo "GetObject  otro bucket     (debe ser implicitDeny):"; sim s3:GetObject    "arn:aws:s3:::cualquier-otro-bucket/x"
echo "iam:ListUsers              (debe ser implicitDeny):"; sim iam:ListUsers   "*"
```

Resultado esperado: **solo la primera línea dice `allowed`**; todas las demás, `implicitDeny` (o `explicitDeny`).
Si alguna otra dice `allowed`, el usuario tiene un permiso de más: míralo con
`aws iam list-attached-user-policies --user-name bearingworld-ingest-fn`, `aws iam list-user-policies --user-name bearingworld-ingest-fn`
y `aws iam list-groups-for-user --user-name bearingworld-ingest-fn`.

El simulador no mira las políticas de recurso (la del bucket) ni las SCP de la organización; la política del bucket solo
concede `s3:PutObject` a `ses.amazonaws.com`, así que no añade nada para este usuario.

## 2 · Edad de la clave

```bash
aws iam list-access-keys --user-name bearingworld-ingest-fn --query 'AccessKeyMetadata[].[AccessKeyId,Status,CreateDate]' --output text
```

Debe haber **una sola clave `Active`**. Anota aquí su `CreateDate`; la rotación es **a los 90 días** de esa fecha.

| Clave (primeros 8 caracteres) | Creada | Rotar antes de |
|---|---|---|
| _(rellenar tras ejecutar el paso 2)_ | | _(creada + 90 días)_ |

## 3 · Rotarla (sin cortar el servicio)

1. IAM → Users → `bearingworld-ingest-fn` → Security credentials → **Create access key** (la segunda; AWS admite dos a la vez).
2. Panel de Supabase → proyecto `troxminloxkjwihwfevs` → Edge Functions → Secrets: sustituye `AWS_INGEST_ACCESS_KEY_ID` y
   `AWS_INGEST_SECRET_ACCESS_KEY` (la CLI de Supabase está en otra cuenta, `F-073`). Los secretos se aplican en la siguiente invocación.
3. Envía un correo de prueba (remitente autorizado, CSV con perfil guardado) y comprueba en `ingest_events` que sale `PROCESADO`.
4. Solo entonces, en IAM: la clave **antigua → Make inactive**, esperar unos días, y **Delete**.

Si se sospecha de filtración: desactivar la clave primero, rotar después.
