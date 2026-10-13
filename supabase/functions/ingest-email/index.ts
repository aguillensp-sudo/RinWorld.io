/**
 * ingest-email · INV-04 fase 2 (recepción de inventario por correo)
 * =============================================================================
 *
 * Recorrido (`openspec/v1/plan-inv04-ingestion-por-correo.md`):
 *
 *   remitente → MX de ingest.<dominio> → SES (eu-west-1) ─┬→ S3 privado, MIME crudo (30 días)
 *                                                         └→ SNS → ESTA FUNCIÓN (POST, sin JWT)
 *
 * **Es la tercera función de este proyecto que atiende a quien no tiene sesión** (tras
 * `access-request` y `register-organization`) y la primera que recibe datos de terceros. Se
 * despliega con `--no-verify-jwt` y no se fía de nada del cuerpo hasta verificar la firma de
 * SNS contra NUESTRO tema (`sns.ts`). Cualquier otra cosa recibe `403` sin explicación.
 *
 * Toda la lógica vive en módulos puros, probados en `app/src/lib/ingest-email.*.test.ts`:
 *   · `sns.ts`        firma de SNS
 *   · `mail-rules.ts` autenticación del remitente, dirección, adjunto
 *   · `pipeline.ts`   el orden de las comprobaciones y el historial
 *   · `import-core.ts` lectura del archivo y validación de líneas (copia de la del navegador)
 * Este fichero solo hace E/S: S3, MIME, la base. **No tiene tests propios y no se ha ejecutado
 * contra AWS**; lo que no se puede comprobar sin una cuenta está en `openspec/v1/ESTADO-V1.md`.
 *
 * Secretos de la función (nunca en el repositorio, `CLAUDE.md` §1.1):
 *   SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY          los pone Supabase
 *   INGEST_SNS_TOPIC_ARN        el tema de SNS que escribe aquí
 *   INGEST_DOMAIN               `ingest.nortexsys.com`
 *   AWS_INGEST_ACCESS_KEY_ID · AWS_INGEST_SECRET_ACCESS_KEY    clave de SOLO LECTURA de `inbox/`
 *   AWS_INGEST_REGION           opcional, `eu-west-1` por defecto
 *
 * Límites de la plataforma que mandan aquí (leídos el 12-oct-2026, plan §«Límites leídos»):
 * 2 s de CPU y 256 MB por petición. Por eso la fase 2 lee solo CSV/TSV/TXT, con un tope de
 * 20.000 líneas y de 5 MB por correo. Medido el 13-oct-2026 (`openspec/v1/inv04-medidas-funcion.md`):
 * 20.000 líneas son ~0,3 s de CPU; un correo de 37 MB desborda la memoria, de ahí el tope de 5 MB.
 * =============================================================================
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import PostalMime from 'npm:postal-mime@2.4.3';
import { processNotification, type Deps, type ResolvedAddress } from './pipeline.ts';
import { verifySnsMessage, type SnsMessage } from './sns.ts';
import type { Attachment, SesNotification } from './mail-rules.ts';

/** Cuerpo máximo que se acepta de SNS: el aviso de la acción S3 no lleva el correo. */
const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405);

  const env = (name: string): string | undefined => Deno.env.get(name) || undefined;
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const topicArn = env('INGEST_SNS_TOPIC_ARN');
  const domain = env('INGEST_DOMAIN');
  const awsKey = env('AWS_INGEST_ACCESS_KEY_ID');
  const awsSecret = env('AWS_INGEST_SECRET_ACCESS_KEY');
  if (!supabaseUrl || !serviceKey || !topicArn || !domain || !awsKey || !awsSecret) {
    // Falta configuración: se dice en el registro (sin valores) y se responde 500 para que SNS reintente.
    console.error('ingest-email: falta configuración');
    return json(500);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413);
  let msg: SnsMessage;
  try {
    msg = JSON.parse(raw) as SnsMessage;
  } catch {
    return json(400);
  }

  const verdict = await verifySnsMessage(msg, {
    expectedTopicArn: topicArn,
    fetchCert: async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('cert');
      return await r.text();
    },
  });
  if (!verdict.ok) {
    // El motivo (`tema`, `firma`, …) es de un vocabulario cerrado, nunca texto del cuerpo.
    console.warn(`ingest-email: SNS rechazado (${verdict.reason})`);
    return json(403);
  }

  // Alta de la suscripción: SNS manda un `SubscriptionConfirmation` y espera un GET a `SubscribeURL`.
  if (msg.Type === 'SubscriptionConfirmation') {
    try {
      const url = new URL(msg.SubscribeURL ?? '');
      if (url.protocol !== 'https:' || !SNS_HOST.test(url.hostname)) return json(403);
      const r = await fetch(url);
      return json(r.ok ? 200 : 502);
    } catch {
      return json(400);
    }
  }
  if (msg.Type !== 'Notification') return json(200);

  let notification: SesNotification;
  try {
    notification = JSON.parse(msg.Message) as SesNotification;
  } catch {
    return json(400);
  }
  if (notification.notificationType !== 'Received') return json(200);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const aws = new AwsClient({
    accessKeyId: awsKey,
    secretAccessKey: awsSecret,
    region: env('AWS_INGEST_REGION') ?? 'eu-west-1',
    service: 's3',
  });
  const objectUrl = (bucket: string, key: string) =>
    `https://${bucket}.s3.${env('AWS_INGEST_REGION') ?? 'eu-west-1'}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;

  const deps: Deps = {
    domain,
    resolve: async (token) => {
      const { data, error } = await db.rpc('ingest_resolve', { p_token: token });
      if (error) throw new Error('resolve');
      return (data ?? null) as ResolvedAddress | null;
    },
    objectSize: async (bucket, key) => {
      const r = await aws.fetch(objectUrl(bucket, key), { method: 'HEAD' });
      if (!r.ok) throw new Error('head');
      return Number(r.headers.get('content-length') ?? Number.POSITIVE_INFINITY);
    },
    getObject: async (bucket, key) => {
      const r = await aws.fetch(objectUrl(bucket, key));
      if (!r.ok) throw new Error('get');
      return new Uint8Array(await r.arrayBuffer());
    },
    attachmentsOf: async (rawMail) => {
      const email = await new PostalMime().parse(rawMail);
      return email.attachments
        .filter((a) => typeof a.filename === 'string' && a.content instanceof ArrayBuffer)
        .map((a): Attachment => ({ filename: a.filename as string, content: new Uint8Array(a.content as ArrayBuffer) }));
    },
    importLines: async (orgId, lines) => {
      const { data, error } = await db.rpc('import_inventory_for_org', { p_org: orgId, p_lines: lines });
      if (error) throw new Error('import');
      return Number((data as { published?: number } | null)?.published ?? lines.length);
    },
    alreadyHandled: async (messageId) => {
      const { data, error } = await db.from('ingest_events').select('id').eq('message_id', messageId).limit(1);
      if (error) throw new Error('dedupe');
      return (data ?? []).length > 0;
    },
    record: async (event) => {
      const { error } = await db.from('ingest_events').insert(event);
      // 23505: otro reintento de SNS ganó la carrera con el mismo `message_id`. No es un fallo.
      if (error && error.code !== '23505') throw new Error('record');
    },
  };

  try {
    const outcome = await processNotification(notification, deps);
    console.log(`ingest-email: ${outcome.result}${outcome.reason ? ` ${outcome.reason}` : ''}`);
    return json(200);
  } catch {
    // No se pudo ni escribir el historial: 500 para que SNS reintente (el `message_id` evita el doble conteo).
    console.error('ingest-email: no se pudo registrar el resultado');
    return json(500);
  }
});
