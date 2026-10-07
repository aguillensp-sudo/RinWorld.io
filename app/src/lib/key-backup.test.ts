import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toBytea, toHex, keyPairFromPrivateBytes } from './crypto';
import {
  BLOB_BYTES,
  KDF_PARAMS,
  SALT_BYTES,
  type Argon2Runner,
  createKeyPair,
  deriveWrappingKey,
  openPrivateKey,
  passphraseBytes,
  protectPrivateKey,
  runArgon2,
  uploadKeyBackup,
  verifyKeyBackup,
} from './key-backup';

/**
 * REG-07 · la capa criptográfica del backup (ADR-001 §6–§7.1). Lo que se verifica:
 * que Argon2id es Argon2id de verdad (vector de referencia), que el blob tiene la
 * forma de ADR-001, que solo lo abre la misma frase, para el mismo miembro, y que a
 * la red van los cinco campos y nada más.
 *
 * Casi todas las pruebas derivan con parámetros reducidos (`fast`) para no gastar
 * 64 MiB y ~0,3 s en cada una; una sola corre los de ADR-001 enteros.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

const MEMBER = '0a000001-0000-0000-0000-000000000001';
const OTHER = '0b000001-0000-0000-0000-000000000001';
const PASSPHRASE = 'tornillo ámbar cometa jilguero 42';

const fast: Argon2Runner = (r) => runArgon2({ ...r, m: 1024, t: 1, p: 1 });

const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcError: unknown = null;
let storedRow: Record<string, unknown> | null = null;

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      // La lectura del backup pendiente (REG-07) ya no es un `select` de la tabla (0052): es esta función.
      if (fn === 'read_pending_key_backup') {
        return Promise.resolve({ data: storedRow ? [storedRow] : [], error: null });
      }
      return Promise.resolve({ data: null, error: rpcError });
    },
  },
}));

beforeEach(() => {
  rpcCalls.length = 0;
  rpcError = null;
  storedRow = null;
});

/** La fila tal como la devolvería PostgREST tras `store_key_backup`. */
function rowFromUpload(): Record<string, unknown> {
  const args = rpcCalls.find((c) => c.fn === 'store_key_backup')?.args;
  if (!args) throw new Error('no se subió nada');
  return {
    public_key: args.p_public_key,
    encrypted_key_blob: args.p_encrypted_key_blob,
    key_iv: args.p_key_iv,
    argon2_salt: args.p_argon2_salt,
    kdf_params: args.p_kdf_params,
  };
}

describe('ANCLA · Argon2id es el de RFC 9106, con los parámetros de ADR-001', () => {
  it('reproduce el vector de referencia de argon2id (password/somesalt, t=2, m=64 MiB, p=1)', async () => {
    const out = await runArgon2({
      password: new TextEncoder().encode('password'),
      salt: new TextEncoder().encode('somesalt'),
      m: 65536,
      t: 2,
      p: 1,
    });
    expect(toHex(out)).toBe('09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7');
  }, 20_000);

  it('los parámetros son exactamente los de ADR-001 §6.3', () => {
    expect(KDF_PARAMS).toEqual({ algo: 'argon2id', m: 65536, t: 3, p: 4, v: 19 });
  });

  it('con los parámetros reales, la misma frase y sal abren lo que cerraron', async () => {
    const generated = await createKeyPair();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated);
    const key = await deriveWrappingKey(PASSPHRASE, payload.argon2Salt);
    const opened = await openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, key, MEMBER);
    expect((await keyPairFromPrivateBytes(opened)).publicKey).toEqual(payload.publicKey);
  }, 20_000);
});

describe('paso 1 · el par', () => {
  it('32 bytes de privada, su pública de 32 y una CryptoKey que no deja sacarla', async () => {
    const { privateBytes, keyPair } = await createKeyPair();
    expect(privateBytes).toHaveLength(32);
    expect(keyPair.publicKey).toHaveLength(32);
    expect(keyPair.privateKey.extractable).toBe(false);
  });

  it('dos pares seguidos son distintos', async () => {
    const a = await createKeyPair();
    const b = await createKeyPair();
    expect(toHex(a.keyPair.publicKey)).not.toBe(toHex(b.keyPair.publicKey));
  });
});

describe('paso 2 · proteger la privada', () => {
  it('blob de 48, IV de 12, sal de 32 y los parámetros de ADR-001', async () => {
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    expect(payload.encryptedKeyBlob).toHaveLength(BLOB_BYTES);
    expect(payload.keyIv).toHaveLength(12);
    expect(payload.argon2Salt).toHaveLength(SALT_BYTES);
    expect(payload.kdfParams).toEqual(KDF_PARAMS);
  });

  it('borra los bytes de la privada en cuanto los ha cifrado', async () => {
    const generated = await createKeyPair();
    await protectPrivateKey(PASSPHRASE, MEMBER, generated, fast);
    expect(Array.from(generated.privateBytes).every((b) => b === 0)).toBe(true);
  });

  it('y también si falla', async () => {
    const generated = await createKeyPair();
    const broken: Argon2Runner = () => Promise.reject(new Error('sin memoria'));
    await expect(protectPrivateKey(PASSPHRASE, MEMBER, generated, broken)).rejects.toThrow();
    expect(Array.from(generated.privateBytes).every((b) => b === 0)).toBe(true);
  });

  it('el blob no contiene la privada en claro', async () => {
    const generated = await createKeyPair();
    const plainHex = toHex(generated.privateBytes);
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, fast);
    expect(toHex(payload.encryptedKeyBlob)).not.toContain(plainHex);
  });

  it('dos protecciones de la misma clave dan sal, IV y blob distintos', async () => {
    const generated = await createKeyPair();
    const copy = { ...generated, privateBytes: generated.privateBytes.slice() };
    const a = await protectPrivateKey(PASSPHRASE, MEMBER, generated, fast);
    const b = await protectPrivateKey(PASSPHRASE, MEMBER, copy, fast);
    expect(toHex(a.payload.argon2Salt)).not.toBe(toHex(b.payload.argon2Salt));
    expect(toHex(a.payload.keyIv)).not.toBe(toHex(b.payload.keyIv));
    expect(toHex(a.payload.encryptedKeyBlob)).not.toBe(toHex(b.payload.encryptedKeyBlob));
  });
});

describe('solo la misma frase, para el mismo miembro, abre el blob', () => {
  async function sealed() {
    return protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
  }

  it('otra frase: la etiqueta GCM no cuadra, y el error no lleva la frase', async () => {
    const { payload } = await sealed();
    const wrong = await deriveWrappingKey('otra frase cualquiera 99', payload.argon2Salt, KDF_PARAMS, fast);
    const error = await openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, wrong, MEMBER).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('otra frase');
  });

  it('otro miembro (AAD de ADR-001 §6.2): no se abre aunque la frase sea la buena', async () => {
    const { payload, wrappingKey } = await sealed();
    await expect(openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, wrappingKey, OTHER)).rejects.toThrow();
  });

  it('otra sal: no se abre', async () => {
    const { payload } = await sealed();
    const key = await deriveWrappingKey(PASSPHRASE, new Uint8Array(32), KDF_PARAMS, fast);
    await expect(openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, key, MEMBER)).rejects.toThrow();
  });

  it('un bit cambiado en el blob: no se abre', async () => {
    const { payload, wrappingKey } = await sealed();
    const tampered = payload.encryptedKeyBlob.slice();
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    await expect(openPrivateKey(tampered, payload.keyIv, wrappingKey, MEMBER)).rejects.toThrow();
  });

  it('la frase se normaliza a NFC: la misma frase con otra composición Unicode abre', async () => {
    const composed = 'café con leche y tostadas';
    const decomposed = 'café con leche y tostadas';
    expect(passphraseBytes(composed)).toEqual(passphraseBytes(decomposed));
    const { payload } = await protectPrivateKey(composed, MEMBER, await createKeyPair(), fast);
    const key = await deriveWrappingKey(decomposed, payload.argon2Salt, KDF_PARAMS, fast);
    const opened = await openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, key, MEMBER);
    expect((await keyPairFromPrivateBytes(opened)).publicKey).toEqual(payload.publicKey);
  });
});

describe('paso 3 · a la red van los cinco campos y nada más', () => {
  it('store_key_backup con pública, blob, IV, sal y parámetros, en bytea', async () => {
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    await uploadKeyBackup(payload);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.fn).toBe('store_key_backup');
    expect(rpcCalls[0]?.args).toEqual({
      p_public_key: toBytea(payload.publicKey),
      p_encrypted_key_blob: toBytea(payload.encryptedKeyBlob),
      p_key_iv: toBytea(payload.keyIv),
      p_argon2_salt: toBytea(payload.argon2Salt),
      p_kdf_params: KDF_PARAMS,
    });
  });

  it('la frase no está en el payload, ni en claro ni en hexadecimal', async () => {
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    await uploadKeyBackup(payload);
    const wire = JSON.stringify(rpcCalls);
    expect(wire).not.toContain(PASSPHRASE);
    expect(wire).not.toContain(toHex(passphraseBytes(PASSPHRASE)));
  });

  it('un rechazo del servidor lanza un error genérico', async () => {
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    rpcError = { message: 'Tu cuenta no está pendiente de generar claves.' };
    await expect(uploadKeyBackup(payload)).rejects.toThrow('No se pudo guardar el backup de la clave.');
  });
});

describe('paso 4 · verificar la copia del servidor antes de confirmar', () => {
  async function uploaded() {
    const protectedKey = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    await uploadKeyBackup(protectedKey.payload);
    storedRow = rowFromUpload();
    return protectedKey;
  }

  it('abre la copia guardada y confirma con la pública', async () => {
    const protectedKey = await uploaded();
    await verifyKeyBackup(MEMBER, protectedKey);
    expect(rpcCalls.map((c) => c.fn)).toEqual(['store_key_backup', 'read_pending_key_backup', 'confirm_key_backup']);
    expect(rpcCalls[2]?.args).toEqual({ p_public_key: toBytea(protectedKey.payload.publicKey) });
  });

  it('acepta los parámetros en otro orden (jsonb no lo conserva)', async () => {
    const protectedKey = await uploaded();
    storedRow = { ...storedRow, kdf_params: { v: 19, p: 4, t: 3, m: 65536, algo: 'argon2id' } };
    await expect(verifyKeyBackup(MEMBER, protectedKey)).resolves.toBeUndefined();
  });

  it('un blob guardado que no se abre NO se confirma', async () => {
    const protectedKey = await uploaded();
    const blob = protectedKey.payload.encryptedKeyBlob.slice();
    blob[47] = (blob[47] ?? 0) ^ 1;
    storedRow = { ...storedRow, encrypted_key_blob: toBytea(blob) };
    await expect(verifyKeyBackup(MEMBER, protectedKey)).rejects.toThrow();
    expect(rpcCalls.map((c) => c.fn)).not.toContain('confirm_key_backup');
  });

  it('otra pública guardada (otra pestaña la pisó) NO se confirma', async () => {
    const protectedKey = await uploaded();
    storedRow = { ...storedRow, public_key: toBytea(new Uint8Array(32).fill(7)) };
    await expect(verifyKeyBackup(MEMBER, protectedKey)).rejects.toThrow();
    expect(rpcCalls.map((c) => c.fn)).not.toContain('confirm_key_backup');
  });

  it('sin fila que leer, falla sin confirmar', async () => {
    const protectedKey = await protectPrivateKey(PASSPHRASE, MEMBER, await createKeyPair(), fast);
    await expect(verifyKeyBackup(MEMBER, protectedKey)).rejects.toThrow('No se pudo leer el backup guardado.');
    expect(rpcCalls.map((c) => c.fn)).toEqual(['read_pending_key_backup']);
  });

  it('si la confirmación falla, lanza', async () => {
    const protectedKey = await uploaded();
    rpcError = { message: 'red' };
    await expect(verifyKeyBackup(MEMBER, protectedKey)).rejects.toThrow('No se pudo confirmar el backup de la clave.');
  });
});
