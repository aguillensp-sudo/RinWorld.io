/**
 * REG-07 · Generar el par de claves y guardar su backup cifrado (ADR-001 §6 y §7.1).
 * Capa de datos escrita a mano (criptografía, Plan §4.3): la pantalla la llama paso a
 * paso y pinta, no decide nada de lo que hay aquí.
 *
 * Los cuatro pasos de la pantalla son cuatro funciones:
 *
 *   1. `createKeyPair`      — 32 bytes aleatorios de privada X25519 y su par.
 *   2. `protectPrivateKey`  — Argon2id(frase, sal) → clave de envoltura → AES-256-GCM
 *                             de la privada, con el id del miembro como AAD.
 *   3. `uploadKeyBackup`    — `store_key_backup` (0048): los cinco campos, nada más.
 *   4. `verifyKeyBackup`    — relee la fila, DESCIFRA la copia que guardó el servidor,
 *                             comprueba que sale la misma pública y confirma
 *                             (`confirm_key_backup` → `KEY_ACTIVE`).
 *
 * **Invariante server-blind (ADR-001 §8).** A la red van la pública, el blob, el IV,
 * la sal y los parámetros. La frase, la clave de envoltura y la privada en claro no
 * salen de esta pestaña, ni en un payload ni en el texto de un error: ningún `throw`
 * de este fichero lleva bytes ni la frase.
 *
 * Decisiones (DECISIONES-V1, 7-oct-2026): la frase se normaliza a NFC antes de
 * derivar —la misma frase tecleada en otro sistema o teclado puede llegar con otra
 * composición Unicode y REC-01 no la abriría—; la AAD es el UUID del miembro en
 * minúsculas, en UTF-8; Argon2id va en un Web Worker (`hash-wasm`).
 */
import { supabase } from './supabase';
import {
  IV_BYTES,
  PUBLIC_KEY_BYTES,
  type SessionKeyPair,
  fromBytea,
  keyPairFromPrivateBytes,
  toBytea,
} from './crypto';
import type { Argon2Request, Argon2Response } from './argon2.worker';

/** ADR-001 §6.1 y §6.3, exactos; `0048` rechaza cualquier otro (`app.kdf_params_v1`). */
export const KDF_PARAMS = { algo: 'argon2id', m: 65536, t: 3, p: 4, v: 19 } as const;
export type KdfParams = typeof KDF_PARAMS;

/** ADR-001 §6.1: sal de 32 bytes. */
export const SALT_BYTES = 32;

/** ADR-001 §6.2: 32 de privada + 16 de etiqueta GCM. */
export const BLOB_BYTES = 48;

export const KEY_GENERATION_TEXTS = {
  eyebrow: 'Módulo 01 · Onboarding',
  title: 'Generando tus claves de seguridad',
  subtitle: 'Este proceso tardará unos segundos. No cierres esta ventana.',
  steps: [
    'Generando tu par de claves',
    'Protegiendo tu clave privada',
    'Guardando el backup en servidor',
    'Verificando la integridad',
  ],
  protecting: 'Calculando clave de protección…',
  notice: 'No cierres ni recargues esta ventana. El proceso puede tardar hasta 30 segundos.',
  done: '¡Todo listo! Tu cuenta está protegida.',
  continue: 'Continuar',
  retry: 'Reintentar',
  /** HTML aprobado, estado «Error paso 3». */
  connectionError: 'Error de conexión',
  backupErrorStrong: 'No hemos podido guardar el backup.',
  backupErrorRest: 'Comprueba tu conexión e inténtalo de nuevo.',
  /** Pasos 1–2: el HTML no pinta este estado (SPEC-GAP, F-237). */
  localError: 'Error en este navegador',
  localErrorStrong: 'No hemos podido generar tus claves.',
  localErrorRest: 'Inténtalo de nuevo; si se repite, prueba con un navegador actualizado.',
} as const;

// -----------------------------------------------------------------------------
// Paso 1 · el par
// -----------------------------------------------------------------------------

export interface NewKeyPair {
  /** Los 32 bytes de la privada. Viven hasta el paso 2, que los cifra y los borra. */
  privateBytes: Uint8Array;
  /** El par de la sesión, con la privada no extraíble. */
  keyPair: SessionKeyPair;
}

export async function createKeyPair(): Promise<NewKeyPair> {
  const privateBytes = crypto.getRandomValues(new Uint8Array(PUBLIC_KEY_BYTES));
  const keyPair = await keyPairFromPrivateBytes(privateBytes);
  return { privateBytes, keyPair };
}

// -----------------------------------------------------------------------------
// Paso 2 · Argon2id y AES-256-GCM
// -----------------------------------------------------------------------------

/** Deriva 32 bytes con Argon2id. Inyectable: los tests de unidad no tienen Worker. */
export type Argon2Runner = (request: Argon2Request) => Promise<Uint8Array>;

/** En el navegador, en un Web Worker (ADR-001 §9). Fuera de él (vitest), directo. */
export const runArgon2: Argon2Runner = (request) => {
  if (typeof Worker === 'undefined') return runArgon2Inline(request);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<Argon2Response>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.key);
      else reject(new Error('No se pudo derivar la clave de protección.'));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('No se pudo derivar la clave de protección.'));
    };
    worker.postMessage(request, [request.password.buffer]);
  });
};

async function runArgon2Inline({ password, salt, m, t, p }: Argon2Request): Promise<Uint8Array> {
  const { argon2id } = await import('hash-wasm');
  try {
    return await argon2id({
      password,
      salt,
      memorySize: m,
      iterations: t,
      parallelism: p,
      hashLength: 32,
      outputType: 'binary',
    });
  } finally {
    password.fill(0);
  }
}

/** La frase, tal como entra en Argon2id: NFC y UTF-8. */
export function passphraseBytes(passphrase: string): Uint8Array {
  return new TextEncoder().encode(passphrase.normalize('NFC'));
}

/** La AAD de ADR-001 §6.2: ata el blob a su miembro. */
function aadFor(memberId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(memberId.toLowerCase()) as Uint8Array<ArrayBuffer>;
}

/** Copia a un `ArrayBuffer` propio (ver `asBuffer` en `crypto.ts`). */
function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * La clave de envoltura: Argon2id(frase, sal) importada como AES-256-GCM no
 * extraíble. Los 32 bytes de Argon2id se borran en cuanto están importados.
 */
export async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = KDF_PARAMS,
  argon2: Argon2Runner = runArgon2,
): Promise<CryptoKey> {
  const raw = await argon2({ password: passphraseBytes(passphrase), salt: own(salt), m: params.m, t: params.t, p: params.p });
  try {
    return await crypto.subtle.importKey('raw', own(raw), { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  } finally {
    raw.fill(0);
  }
}

/** AES-256-GCM de la privada. Devuelve el blob de 48 bytes y su IV de 12. */
export async function sealPrivateKey(
  privateBytes: Uint8Array,
  wrappingKey: CryptoKey,
  memberId: string,
): Promise<{ blob: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = own(privateBytes);
  try {
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aadFor(memberId), tagLength: 128 },
      wrappingKey,
      plain,
    );
    return { blob: new Uint8Array(sealed), iv };
  } finally {
    plain.fill(0);
  }
}

/**
 * Abre un blob. Lanza si la etiqueta GCM no cuadra: frase equivocada, blob
 * manipulado o de otro miembro (la AAD). El llamante borra los bytes que recibe.
 */
export async function openPrivateKey(
  blob: Uint8Array,
  iv: Uint8Array,
  wrappingKey: CryptoKey,
  memberId: string,
): Promise<Uint8Array> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: own(iv), additionalData: aadFor(memberId), tagLength: 128 },
      wrappingKey,
      own(blob),
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('El backup de la clave no se puede abrir con esta frase.');
  }
}

/** Lo único que viaja al servidor (ADR-001 §7.1, paso 6). */
export interface KeyBackupPayload {
  publicKey: Uint8Array;
  encryptedKeyBlob: Uint8Array;
  keyIv: Uint8Array;
  argon2Salt: Uint8Array;
  kdfParams: KdfParams;
}

export interface ProtectedKey {
  payload: KeyBackupPayload;
  /** Se queda en memoria hasta el paso 4, que la usa para abrir la copia del servidor. */
  wrappingKey: CryptoKey;
}

/** Paso 2. Cifra la privada y BORRA `privateBytes`, salga bien o mal. */
export async function protectPrivateKey(
  passphrase: string,
  memberId: string,
  generated: NewKeyPair,
  argon2: Argon2Runner = runArgon2,
): Promise<ProtectedKey> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const wrappingKey = await deriveWrappingKey(passphrase, salt, KDF_PARAMS, argon2);
    const { blob, iv } = await sealPrivateKey(generated.privateBytes, wrappingKey, memberId);
    return {
      payload: {
        publicKey: generated.keyPair.publicKey,
        encryptedKeyBlob: blob,
        keyIv: iv,
        argon2Salt: salt,
        kdfParams: KDF_PARAMS,
      },
      wrappingKey,
    };
  } finally {
    generated.privateBytes.fill(0);
  }
}

// -----------------------------------------------------------------------------
// Paso 3 · subir
// -----------------------------------------------------------------------------

export async function uploadKeyBackup(payload: KeyBackupPayload): Promise<void> {
  const { error } = await supabase.rpc('store_key_backup', {
    p_public_key: toBytea(payload.publicKey),
    p_encrypted_key_blob: toBytea(payload.encryptedKeyBlob),
    p_key_iv: toBytea(payload.keyIv),
    p_argon2_salt: toBytea(payload.argon2Salt),
    p_kdf_params: payload.kdfParams,
  });
  if (error) throw new Error('No se pudo guardar el backup de la clave.');
}

// -----------------------------------------------------------------------------
// Paso 4 · verificar y confirmar
// -----------------------------------------------------------------------------

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Relee la fila del miembro, abre la copia que guardó el servidor con la clave de
 * envoltura y comprueba que de ella sale la misma pública que se generó. Solo
 * entonces confirma (`KEY_ACTIVE`). Un backup que no se puede abrir no llega a
 * confirmarse: la cuenta sigue `REGISTERED` y REG-07 se puede repetir.
 */
export async function verifyKeyBackup(memberId: string, protectedKey: ProtectedKey): Promise<void> {
  const { payload, wrappingKey } = protectedKey;
  // El blob ya no se lee con un `select` de la tabla (0052, F-239): solo lo entrega `begin_key_recovery`, que
  // cuenta, y esta función, que solo responde mientras la cuenta sigue `REGISTERED` (justo lo que dura REG-07).
  const { data, error } = await supabase.rpc('read_pending_key_backup');
  const first = Array.isArray(data) ? data[0] : null;
  if (error || !first) throw new Error('No se pudo leer el backup guardado.');

  const row = first as Record<string, unknown>;
  const stored = {
    publicKey: typeof row.public_key === 'string' ? fromBytea(row.public_key) : null,
    blob: typeof row.encrypted_key_blob === 'string' ? fromBytea(row.encrypted_key_blob) : null,
    iv: typeof row.key_iv === 'string' ? fromBytea(row.key_iv) : null,
    salt: typeof row.argon2_salt === 'string' ? fromBytea(row.argon2_salt) : null,
  };
  if (
    !stored.publicKey || !stored.blob || !stored.iv || !stored.salt ||
    !sameBytes(stored.publicKey, payload.publicKey) ||
    !sameBytes(stored.salt, payload.argon2Salt) ||
    !sameKdf(row.kdf_params)
  ) {
    throw new Error('El backup guardado no es el que se ha subido.');
  }

  const opened = await openPrivateKey(stored.blob, stored.iv, wrappingKey, memberId);
  try {
    const reopened = await keyPairFromPrivateBytes(opened);
    if (!sameBytes(reopened.publicKey, payload.publicKey)) {
      throw new Error('El backup guardado no corresponde a la clave generada.');
    }
  } finally {
    opened.fill(0);
  }

  const { error: confirmError } = await supabase.rpc('confirm_key_backup', {
    p_public_key: toBytea(payload.publicKey),
  });
  if (confirmError) throw new Error('No se pudo confirmar el backup de la clave.');
}

/** jsonb no garantiza el orden de las claves: se compara campo a campo. */
function sameKdf(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  return (
    keys.length === Object.keys(KDF_PARAMS).length &&
    (Object.keys(KDF_PARAMS) as (keyof KdfParams)[]).every((k) => v[k] === KDF_PARAMS[k])
  );
}
