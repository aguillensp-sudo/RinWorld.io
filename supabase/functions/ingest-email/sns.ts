/**
 * Verificación de los mensajes de Amazon SNS (INV-04, fase 2).
 *
 * La función `ingest-email` se despliega sin JWT y recibe POST de Internet: lo único que
 * distingue un aviso de SES de un POST de cualquiera es **la firma de SNS**. Sin ella,
 * cualquiera podría decirle «ha llegado este correo de esta organización» y hacerle leer el
 * S3 o escribir inventario.
 *
 * Es el algoritmo documentado por AWS («Verifying the signatures of Amazon SNS messages»):
 *   1. `SigningCertURL` tiene que ser `https` y de `sns.<región>.amazonaws.com`, y acabar en
 *      `.pem`. Si no, se descarga un certificado de quien lo diga el atacante.
 *   2. La cadena a firmar es `Nombre\nValor\n` de ciertos campos, en un orden fijo que depende
 *      del tipo de mensaje.
 *   3. `Signature` va en base64 y se comprueba con la clave pública del certificado:
 *      RSA-SHA1 para `SignatureVersion` 1, RSA-SHA256 para la 2.
 *
 * Además de la firma se exige que el `TopicArn` sea el esperado: la firma prueba que lo firmó
 * AWS, no que sea NUESTRO tema. Cualquiera con una cuenta de AWS puede firmar mensajes
 * válidos desde su propio tema.
 *
 * Sin `import`s relativos: lo carga Deno (la función) y Node (vitest). `node:crypto` existe
 * en los dos.
 */
import { createVerify } from 'node:crypto';

export interface SnsMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
}

/** Campos que entran en la cadena a firmar, en el orden en que entran. */
const SIGNED_FIELDS: Record<string, readonly (keyof SnsMessage)[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

const CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

export function isTrustedCertUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    CERT_HOST.test(url.hostname) &&
    url.pathname.endsWith('.pem')
  );
}

export function stringToSign(msg: SnsMessage): string | null {
  const fields = SIGNED_FIELDS[msg.Type];
  if (!fields) return null;
  let out = '';
  for (const name of fields) {
    const value = msg[name];
    // `Subject` es opcional: si no viene, no entra (ni el nombre).
    if (value === undefined) {
      if (name === 'Subject') continue;
      return null;
    }
    out += `${name}\n${value}\n`;
  }
  return out;
}

export type SnsVerdict = { ok: true } | { ok: false; reason: string };

export interface SnsVerifyOptions {
  /** El tema de SNS que escribe a esta función. Cualquier otro se rechaza. */
  expectedTopicArn: string;
  /** Descarga el certificado PEM. Inyectable para los tests; en producción, `fetch`. */
  fetchCert: (url: string) => Promise<string>;
}

export async function verifySnsMessage(msg: SnsMessage, opts: SnsVerifyOptions): Promise<SnsVerdict> {
  if (typeof msg !== 'object' || msg === null) return { ok: false, reason: 'cuerpo' };
  if (msg.TopicArn !== opts.expectedTopicArn) return { ok: false, reason: 'tema' };
  if (msg.SignatureVersion !== '1' && msg.SignatureVersion !== '2') return { ok: false, reason: 'version' };
  if (typeof msg.Signature !== 'string' || msg.Signature === '') return { ok: false, reason: 'firma' };
  if (typeof msg.SigningCertURL !== 'string' || !isTrustedCertUrl(msg.SigningCertURL)) {
    return { ok: false, reason: 'certificado' };
  }
  const toSign = stringToSign(msg);
  if (toSign === null) return { ok: false, reason: 'tipo' };

  let pem: string;
  try {
    pem = await opts.fetchCert(msg.SigningCertURL);
  } catch {
    return { ok: false, reason: 'descarga' };
  }

  try {
    const verifier = createVerify(msg.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1');
    verifier.update(toSign, 'utf8');
    return verifier.verify(pem, msg.Signature, 'base64') ? { ok: true } : { ok: false, reason: 'firma' };
  } catch {
    return { ok: false, reason: 'firma' };
  }
}
