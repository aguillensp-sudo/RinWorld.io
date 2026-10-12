/**
 * Firma de SNS (`supabase/functions/ingest-email/sns.ts`).
 *
 * La clave del test se genera al vuelo y `fetchCert` devuelve su parte pública en PEM. AWS
 * entrega un certificado X.509; `node:crypto` acepta las dos formas en `verify`. **Lo que no
 * prueba este test es el certificado real de AWS dentro de Deno**: eso solo se ve con un aviso
 * real de SNS (INV-04, fase 2, comprobación contra AWS).
 */
import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  isTrustedCertUrl,
  stringToSign,
  verifySnsMessage,
  type SnsMessage,
} from '../../../supabase/functions/ingest-email/sns';

const TOPIC = 'arn:aws:sns:eu-west-1:226395401132:bearingworld-ingest';
const CERT_URL = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc123.pem';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const otraClave = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }).toString();

function firmado(extra: Partial<SnsMessage> = {}, version: '1' | '2' = '2'): SnsMessage {
  const base: SnsMessage = {
    Type: 'Notification',
    MessageId: '22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324',
    TopicArn: TOPIC,
    Message: '{"notificationType":"Received"}',
    Timestamp: '2026-10-12T10:00:00.000Z',
    SignatureVersion: version,
    Signature: '',
    SigningCertURL: CERT_URL,
    ...extra,
  };
  const s = createSign(version === '2' ? 'RSA-SHA256' : 'RSA-SHA1');
  s.update(stringToSign(base) ?? '', 'utf8');
  return { ...base, Signature: s.sign(privateKey, 'base64') };
}

const opts = (pem = publicPem) => ({ expectedTopicArn: TOPIC, fetchCert: async () => pem });

describe('verifySnsMessage', () => {
  it('acepta un aviso bien firmado, en las dos versiones de firma', async () => {
    expect(await verifySnsMessage(firmado({}, '2'), opts())).toEqual({ ok: true });
    expect(await verifySnsMessage(firmado({}, '1'), opts())).toEqual({ ok: true });
  });

  it('acepta un aviso con Subject, que entra en la cadena firmada', async () => {
    expect(await verifySnsMessage(firmado({ Subject: 'Amazon SES Email Receipt Notification' }), opts())).toEqual({ ok: true });
  });

  it('rechaza si se cambia un solo carácter del mensaje firmado', async () => {
    const m = firmado();
    expect(await verifySnsMessage({ ...m, Message: '{"notificationType":"Received "}' }, opts())).toEqual({ ok: false, reason: 'firma' });
  });

  it('rechaza una firma hecha con otra clave', async () => {
    expect(await verifySnsMessage(firmado(), opts(otraClave))).toEqual({ ok: false, reason: 'firma' });
  });

  it('rechaza un aviso bien firmado de OTRO tema (cualquiera puede firmar desde su cuenta)', async () => {
    const m = firmado({ TopicArn: 'arn:aws:sns:eu-west-1:111111111111:otro' });
    expect(await verifySnsMessage(m, opts())).toEqual({ ok: false, reason: 'tema' });
  });

  it('no descarga certificados que no son de SNS', async () => {
    let descargas = 0;
    const o = { expectedTopicArn: TOPIC, fetchCert: async () => { descargas++; return publicPem; } };
    for (const url of [
      'http://sns.eu-west-1.amazonaws.com/x.pem',
      'https://sns.eu-west-1.amazonaws.com.evil.com/x.pem',
      'https://evil.com/sns.eu-west-1.amazonaws.com/x.pem',
      'https://sns.eu-west-1.amazonaws.com/x.txt',
      'https://sns.eu-west-1.amazonaws.com:8443/x.pem',
      'https://user@sns.eu-west-1.amazonaws.com/x.pem',
      'no es una url',
    ]) {
      expect(await verifySnsMessage(firmado({ SigningCertURL: url }), o)).toEqual({ ok: false, reason: 'certificado' });
    }
    expect(descargas).toBe(0);
  });

  it('rechaza versión desconocida, tipo desconocido, firma vacía y cuerpo que no es un objeto', async () => {
    expect((await verifySnsMessage({ ...firmado(), SignatureVersion: '3' }, opts())).ok).toBe(false);
    expect((await verifySnsMessage({ ...firmado(), Type: 'Otro' }, opts())).ok).toBe(false);
    expect((await verifySnsMessage({ ...firmado(), Signature: '' }, opts())).ok).toBe(false);
    expect((await verifySnsMessage(null as unknown as SnsMessage, opts())).ok).toBe(false);
  });

  it('si el certificado no se puede descargar, rechaza', async () => {
    const o = { expectedTopicArn: TOPIC, fetchCert: async () => { throw new Error('red'); } };
    expect(await verifySnsMessage(firmado(), o)).toEqual({ ok: false, reason: 'descarga' });
  });

  it('una confirmación de suscripción sin SubscribeURL no tiene cadena que firmar', () => {
    expect(stringToSign({ ...firmado(), Type: 'SubscriptionConfirmation' })).toBeNull();
  });
});

describe('isTrustedCertUrl', () => {
  it('acepta las regiones de AWS, también China', () => {
    expect(isTrustedCertUrl('https://sns.us-east-1.amazonaws.com/a.pem')).toBe(true);
    expect(isTrustedCertUrl('https://sns.cn-north-1.amazonaws.com.cn/a.pem')).toBe(true);
  });
});
