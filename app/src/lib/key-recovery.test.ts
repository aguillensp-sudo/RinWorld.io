import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromBytea, keyPairFromPrivateBytes, toBytea } from './crypto';
import { type Argon2Runner, createKeyPair, deriveWrappingKey, openPrivateKey, protectPrivateKey, runArgon2 } from './key-backup';
import { changeBackupPassphrase, discardKeyBackup, openOwnBackup, recoverKey } from './key-recovery';
import { clearKeyring, currentKeyPair, keyringHasBackup } from './keys';

/**
 * REC-01 y SET-SEC-01 · la capa de datos (ADR-001 §7.2 y §8). Se comprueba lo que
 * importa: que la frase buena abre y la mala no, que el cliente pide el backup al
 * servidor cada vez (es lo que cuenta el intento), que se avisa al servidor solo al
 * abrir, y que cambiar la frase mantiene la MISMA clave.
 *
 * Argon2id con parámetros reducidos (`fast`); la prueba de ADR-001 entero vive en
 * `key-backup.test.ts`. Escrito por Claude Code; no es contrato del arnés.
 */

const MEMBER = '0a000001-0000-0000-0000-000000000001';
const PASSPHRASE = 'tornillo ámbar cometa jilguero 42';
const NEW_PASSPHRASE = 'faro cebra nube pizarra 77';

const fast: Argon2Runner = (r) => runArgon2({ ...r, m: 1024, t: 1, p: 1 });

const rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
let beginResponse: { data: unknown; error: unknown } = { data: null, error: null };
let otherError: unknown = null;
const saved: unknown[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === 'begin_key_recovery') return Promise.resolve(beginResponse);
      return Promise.resolve({ data: null, error: otherError });
    },
  },
}));

vi.mock('./device-key', () => ({
  saveDeviceKey: (id: string, pair: unknown) => {
    saved.push({ id, pair });
    return Promise.resolve(true);
  },
}));

/** Un backup real, cerrado con parámetros reducidos, tal como lo devolvería `begin_key_recovery`. */
async function backupRow(attemptsLeft = 4, secondsLeft = 0) {
  const generated = await createKeyPair();
  const publicKey = generated.keyPair.publicKey;
  const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, fast);
  return {
    status: 'ok',
    seconds_left: secondsLeft,
    attempts_left: attemptsLeft,
    public_key: toBytea(publicKey),
    encrypted_key_blob: toBytea(payload.encryptedKeyBlob),
    key_iv: toBytea(payload.keyIv),
    argon2_salt: toBytea(payload.argon2Salt),
    kdf_params: payload.kdfParams,
  };
}

beforeEach(() => {
  rpcCalls.length = 0;
  saved.length = 0;
  otherError = null;
  beginResponse = { data: null, error: null };
  clearKeyring();
});

describe('openOwnBackup · pedir y abrir', () => {
  it('la frase buena abre, devuelve la privada y la pública publicada', async () => {
    const row = await backupRow();
    beginResponse = { data: [row], error: null };
    const out = await openOwnBackup(PASSPHRASE, MEMBER, fast);
    expect(out.kind).toBe('opened');
    if (out.kind !== 'opened') return;
    expect(out.privateBytes).toHaveLength(32);
    expect(out.publicKey).toEqual(fromBytea(row.public_key));
    expect((await keyPairFromPrivateBytes(out.privateBytes)).publicKey).toEqual(out.publicKey);
    expect(out.attemptsLeft).toBe(4);
  });

  it('la frase mala no lanza: es «wrong», con los intentos que quedan', async () => {
    beginResponse = { data: [await backupRow(3)], error: null };
    const out = await openOwnBackup('otra frase muy distinta 9', MEMBER, fast);
    expect(out).toEqual({ kind: 'wrong', attemptsLeft: 3, lockedSeconds: 0 });
  });

  it('el quinto fallo trae la cuenta atrás de los 30 minutos', async () => {
    beginResponse = { data: [await backupRow(0, 1800)], error: null };
    const out = await openOwnBackup('otra frase muy distinta 9', MEMBER, fast);
    expect(out).toEqual({ kind: 'wrong', attemptsLeft: 0, lockedSeconds: 1800 });
  });

  it('bloqueado: ni se intenta abrir nada', async () => {
    const argon = vi.fn(fast);
    beginResponse = {
      data: [{ status: 'locked', seconds_left: 1500, attempts_left: 0, public_key: null, encrypted_key_blob: null, key_iv: null, argon2_salt: null }],
      error: null,
    };
    const out = await openOwnBackup(PASSPHRASE, MEMBER, argon);
    expect(out).toEqual({ kind: 'locked', secondsLeft: 1500 });
    expect(argon).not.toHaveBeenCalled();
  });

  it('el backup de OTRO miembro no se abre (la AAD es el id)', async () => {
    beginResponse = { data: [await backupRow()], error: null };
    const out = await openOwnBackup(PASSPHRASE, '0b000001-0000-0000-0000-000000000001', fast);
    expect(out.kind).toBe('wrong');
  });

  it('cada llamada pide el backup al servidor: así se cuenta el intento', async () => {
    beginResponse = { data: [await backupRow()], error: null };
    await openOwnBackup('mala mala mala mala 1', MEMBER, fast);
    await openOwnBackup('mala mala mala mala 2', MEMBER, fast);
    expect(rpcCalls.filter((c) => c.fn === 'begin_key_recovery')).toHaveLength(2);
  });

  it('si el servidor no contesta, lanza sin llevar la frase en el mensaje', async () => {
    beginResponse = { data: null, error: { message: 'red caída' } };
    const err = await openOwnBackup(PASSPHRASE, MEMBER, fast).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain(PASSPHRASE);
  });
});

describe('recoverKey · REC-01', () => {
  it('abre, guarda en el dispositivo, monta el llavero y reinicia el contador', async () => {
    const row = await backupRow();
    beginResponse = { data: [row], error: null };
    const out = await recoverKey(PASSPHRASE, MEMBER, fast);
    expect(out).toEqual({ kind: 'recovered' });
    expect(saved).toHaveLength(1);
    expect(currentKeyPair()?.publicKey).toEqual(fromBytea(row.public_key));
    expect(currentKeyPair()?.privateKey.extractable).toBe(false);
    expect(keyringHasBackup()).toBe(true);
    const end = rpcCalls.find((c) => c.fn === 'end_key_recovery');
    expect(end?.args).toEqual({ p_public_key: row.public_key });
  });

  it('con la frase mala no guarda nada, no monta el llavero y no reinicia', async () => {
    beginResponse = { data: [await backupRow(2)], error: null };
    const out = await recoverKey('mala mala mala mala', MEMBER, fast);
    expect(out.kind).toBe('wrong');
    expect(saved).toHaveLength(0);
    expect(currentKeyPair()).toBeNull();
    expect(rpcCalls.some((c) => c.fn === 'end_key_recovery')).toBe(false);
  });
});

describe('changeBackupPassphrase · SET-SEC-01', () => {
  it('sube un backup que abre la frase NUEVA, no la vieja, con la misma pública', async () => {
    const row = await backupRow();
    beginResponse = { data: [row], error: null };
    const out = await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, fast);
    expect(out).toEqual({ kind: 'changed' });

    const replace = rpcCalls.find((c) => c.fn === 'replace_key_backup')?.args as Record<string, string>;
    expect(replace.p_public_key).toBe(row.public_key);
    expect(replace.p_encrypted_key_blob).not.toBe(row.encrypted_key_blob);

    const open = async (phrase: string) => {
      const key = await deriveWrappingKey(phrase, fromBytea(replace.p_argon2_salt!), undefined, fast);
      return openPrivateKey(fromBytea(replace.p_encrypted_key_blob!), fromBytea(replace.p_key_iv!), key, MEMBER);
    };
    const bytes = await open(NEW_PASSPHRASE);
    expect((await keyPairFromPrivateBytes(bytes)).publicKey).toEqual(fromBytea(row.public_key));
    await expect(open(PASSPHRASE)).rejects.toThrow();
  });

  it('con la frase actual mala no sube nada', async () => {
    beginResponse = { data: [await backupRow(3)], error: null };
    const out = await changeBackupPassphrase('no es esta frase 123', NEW_PASSPHRASE, MEMBER, fast);
    expect(out).toEqual({ kind: 'wrong', attemptsLeft: 3, lockedSeconds: 0 });
    expect(rpcCalls.some((c) => c.fn === 'replace_key_backup')).toBe(false);
  });

  it('si el servidor rechaza la sustitución, lanza', async () => {
    beginResponse = { data: [await backupRow()], error: null };
    otherError = { message: 'no' };
    await expect(changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, fast)).rejects.toThrow();
  });
});

describe('discardKeyBackup', () => {
  it('llama a discard_key_backup y suelta el llavero', async () => {
    beginResponse = { data: [await backupRow()], error: null };
    await recoverKey(PASSPHRASE, MEMBER, fast);
    expect(currentKeyPair()).not.toBeNull();
    await discardKeyBackup();
    expect(rpcCalls.at(-1)?.fn).toBe('discard_key_backup');
    expect(currentKeyPair()).toBeNull();
  });

  it('si falla, lanza y no suelta nada', async () => {
    otherError = { message: 'no' };
    await expect(discardKeyBackup()).rejects.toThrow();
  });
});
