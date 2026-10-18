import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptContent,
  encryptContent,
  fromBytea,
  generateCek,
  toBytea,
  toHex,
  unwrapCek,
  wrapCekFor,
} from './crypto';
import {
  type Argon2Runner,
  KDF_PARAMS,
  createKeyPair,
  deriveBackupKeys,
  deriveWrappingKey,
  keyVerifierOf,
  openPrivateKey,
  passphraseBytes,
  protectPrivateKey,
  runArgon2,
  sealPrivateKey,
  uploadKeyBackup,
} from './key-backup';
import { changeBackupPassphrase, discardKeyBackup, recoverKey } from './key-recovery';
import { clearKeyring, currentKeyPair } from './keys';
import { saveDeviceKey } from './device-key';

/**
 * Cierre de los PARCIAL de `e2ee-key-management` (corriente C). Cada `it` empieza por el id del
 * escenario de `openspec/v1/trazabilidad.csv`; las expectativas salen de
 * `openspec/specs/e2ee-key-management/spec.md`, no del comportamiento del codigo.
 *
 * Truco para medir «no sale al servidor» de verdad: Argon2id se sustituye por un ejecutor que
 * devuelve un valor MARCADO conocido (32 bytes 0xA5). Ese valor ES la materia de la clave de
 * envoltura, asi que si aparece en cualquier forma (hex, bytea, base64) en lo que se manda a
 * `supabase.rpc`, la clave de envoltura habria salido. Lo que se inspecciona es el argumento real
 * de cada llamada, no una inferencia.
 *
 * Escrito por Claude Code; no es contrato del arnes.
 */

const MEMBER = '0a000001-0000-0000-0000-000000000001';
const PASSPHRASE = 'tornillo ámbar cometa jilguero 42';
const NEW_PASSPHRASE = 'faro cebra nube pizarra 77';

const fast: Argon2Runner = (r) => runArgon2({ ...r, m: 1024, t: 1, p: 1 });

const MARK = new Uint8Array(32).fill(0xa5);
const marcado: Argon2Runner = async () => MARK.slice();

const rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
let beginQueue: { data: unknown; error: unknown }[] = [];
let beginResponse: { data: unknown; error: unknown } = { data: null, error: null };
let otherError: unknown = null;
const signOut = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: { signOut: () => signOut() },
    rpc: (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === 'begin_key_recovery') {
        return Promise.resolve(beginQueue.length > 0 ? beginQueue.shift()! : beginResponse);
      }
      return Promise.resolve({ data: null, error: otherError });
    },
  },
}));

beforeEach(() => {
  rpcCalls.length = 0;
  beginQueue = [];
  beginResponse = { data: null, error: null };
  otherError = null;
  signOut.mockReset();
  clearKeyring();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Todas las formas en que un secreto podria viajar: hex, bytea y base64. */
function formas(bytes: Uint8Array): string[] {
  return [toHex(bytes), toBytea(bytes), btoa(String.fromCharCode(...bytes))];
}

function nadaDe(bytes: Uint8Array) {
  expect(rpcCalls.length).toBeGreaterThan(0); // sin llamadas, «no aparece» no mediria nada
  const wire = JSON.stringify(rpcCalls);
  for (const f of formas(bytes)) expect(wire).not.toContain(f);
}

/** Un backup real, cerrado con el ejecutor dado, tal como lo devolveria `begin_key_recovery`. */
async function backupRow(argon2: Argon2Runner, attemptsLeft = 4, secondsLeft = 0) {
  const generated = await createKeyPair();
  const publicKey = generated.keyPair.publicKey;
  const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, argon2);
  return {
    row: {
      status: 'ok',
      seconds_left: secondsLeft,
      attempts_left: attemptsLeft,
      public_key: toBytea(publicKey),
      encrypted_key_blob: toBytea(payload.encryptedKeyBlob),
      key_iv: toBytea(payload.keyIv),
      argon2_salt: toBytea(payload.argon2Salt),
      kdf_params: payload.kdfParams,
      has_verifier: true,
    },
    publicKey,
  };
}

// -----------------------------------------------------------------------------
// key-generation#2
// -----------------------------------------------------------------------------

describe('e2ee-key-management/key-generation', () => {
  /*
   * GIVEN el proceso de generacion de claves en curso
   * WHEN  se ejecutan las operaciones criptograficas
   * THEN  ninguna operacion bloquea el hilo principal de la UI
   * AND   el usuario ve un indicador de progreso de 4 pasos
   *
   * Aqui: Argon2id (la unica operacion pesada, ~0,3 s) se delega en un Worker y no se calcula en el
   * hilo que llama. El resto (X25519, AES-GCM, HKDF) es WebCrypto asincrono. Medir que el hilo
   * principal no se congela es de navegador.
   */
  it('e2ee-key-management/key-generation#2 · con Worker disponible, Argon2id se manda al Worker (transferiendo la frase) y no se calcula en el hilo que llama', async () => {
    const enviados: { request: { password: Uint8Array; m: number }; transfer: unknown[] }[] = [];
    let terminated = 0;
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: URL, public options: { type: string }) {}
      postMessage(request: { password: Uint8Array; m: number }, transfer: unknown[]) {
        enviados.push({ request, transfer });
        queueMicrotask(() =>
          this.onmessage?.({ data: { ok: true, key: new Uint8Array(32).fill(7) } } as MessageEvent),
        );
      }
      terminate() {
        terminated += 1;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);

    const password = passphraseBytes(PASSPHRASE);
    const buffer = password.buffer;
    const key = await runArgon2({ password, salt: new Uint8Array(32), m: 65536, t: 3, p: 4 });

    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.request.m).toBe(65536);
    expect(enviados[0]!.transfer).toEqual([buffer]);
    expect(Array.from(key).every((b) => b === 7)).toBe(true); // el resultado vino del Worker
    expect(terminated).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// key-wrapping#1
// -----------------------------------------------------------------------------

describe('e2ee-key-management/key-wrapping', () => {
  /*
   * GIVEN una backup passphrase valida y una privada X25519 recien generada
   * WHEN  el sistema ejecuta el cifrado
   * THEN  ciphertext AES-256-GCM de 48 bytes
   * AND   el payload enviado al servidor contiene unicamente {encrypted_key_blob, key_iv, argon2_salt, kdf_params}
   * AND   la passphrase y la wrapping key NO estan en el payload
   */
  it('e2ee-key-management/key-wrapping#1 · la wrapping key (y la frase) no viajan en el payload de store_key_backup, en ninguna forma', async () => {
    const generated = await createKeyPair();
    const { payload, wrappingKey } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, marcado);
    await uploadKeyBackup(payload);

    expect(payload.encryptedKeyBlob).toHaveLength(48);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe('store_key_backup');
    nadaDe(MARK);
    nadaDe(passphraseBytes(PASSPHRASE));
    expect(JSON.stringify(rpcCalls)).not.toContain(PASSPHRASE);

    // Y MARK es de verdad la materia de la wrapping key: con ella, y solo con ella, el blob abre.
    const key = await deriveWrappingKey(PASSPHRASE, payload.argon2Salt, KDF_PARAMS, marcado);
    const abierta = await openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, key, MEMBER);
    expect(abierta).toHaveLength(32);
    expect(wrappingKey.extractable).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// server-blind-storage#1
// -----------------------------------------------------------------------------

describe('e2ee-key-management/server-blind-storage', () => {
  /*
   * GIVEN cualquier flujo de la capability (generacion, recuperacion, rotacion)
   * WHEN  el cliente realiza cualquier llamada a la API de gestion de claves
   * THEN  ningun payload contiene la passphrase, la wrapping key ni la privada en claro
   *       ni en ninguna forma derivada directamente
   * AND   el servidor almacena datos computacionalmente indistinguibles de bytes aleatorios
   *       sin la passphrase del miembro
   */
  it('e2ee-key-management/server-blind-storage#1 · ni la wrapping key ni la privada en claro aparecen en ninguna llamada de generacion, recuperacion o rotacion', async () => {
    // Generacion
    const generated = await createKeyPair();
    const privadaHex = toHex(generated.privateBytes); // copia ANTES de que protectPrivateKey la borre
    const privada = generated.privateBytes.slice();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, marcado);
    await uploadKeyBackup(payload);
    nadaDe(MARK);
    nadaDe(privada);
    expect(JSON.stringify(rpcCalls)).not.toContain(privadaHex);

    // Recuperacion
    rpcCalls.length = 0;
    const { row } = await backupRow(marcado);
    beginResponse = { data: [row], error: null };
    expect(await recoverKey(PASSPHRASE, MEMBER, marcado)).toEqual({ kind: 'recovered' });
    nadaDe(MARK);

    // Rotacion
    rpcCalls.length = 0;
    const otro = await backupRow(marcado);
    beginResponse = { data: [otro.row], error: null };
    expect(await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, marcado)).toEqual({ kind: 'changed' });
    expect(rpcCalls.map((c) => c.fn)).toEqual(['begin_key_recovery', 'replace_key_backup']);
    nadaDe(MARK);
    // La privada que se re-cifra tampoco sale en claro.
    const abierta = await openPrivateKey(
      fromBytea(otro.row.encrypted_key_blob),
      fromBytea(otro.row.key_iv),
      await deriveWrappingKey(PASSPHRASE, fromBytea(otro.row.argon2_salt), KDF_PARAMS, marcado),
      MEMBER,
    );
    nadaDe(abierta);
  });

  it('e2ee-key-management/server-blind-storage#1 · el blob de un texto plano fijo es indistinguible de ruido: sin estructura del plano y ~50% de bits distintos entre dos cifrados', async () => {
    const key = await deriveWrappingKey(PASSPHRASE, new Uint8Array(32).fill(1), KDF_PARAMS, fast);
    const ceros = new Uint8Array(32); // el peor plano: si el cifrado fuera una identidad, saldria todo ceros
    const blobs: Uint8Array[] = [];
    for (let i = 0; i < 64; i++) blobs.push((await sealPrivateKey(ceros, key, MEMBER)).blob);

    let distintos = 0;
    let bits = 0;
    for (let i = 0; i + 1 < blobs.length; i += 2) {
      const a = blobs[i]!;
      const b = blobs[i + 1]!;
      expect(a.slice(0, 32).some((x) => x !== 0)).toBe(true);
      for (let j = 0; j < a.length; j++) {
        let d = (a[j] ?? 0) ^ (b[j] ?? 0);
        while (d) {
          distintos += d & 1;
          d >>= 1;
        }
        bits += 8;
      }
    }
    const fraccion = distintos / bits;
    expect(fraccion).toBeGreaterThan(0.45);
    expect(fraccion).toBeLessThan(0.55);
  });
});

// -----------------------------------------------------------------------------
// local-storage#1
// -----------------------------------------------------------------------------

describe('e2ee-key-management/local-storage', () => {
  /*
   * GIVEN que el POST /api/identity/key-backup ha respondido con exito
   * WHEN  el sistema finaliza el proceso de generacion
   * THEN  la clave privada queda en IndexedDB bajo `member_private_key_{member_id}`
   * AND   la passphrase y la wrapping key son eliminadas de memoria del Web Worker
   */
  it('e2ee-key-management/local-storage#1 · la frase en bytes se borra tras derivar y la privada queda en IndexedDB como CryptoKey no extraible', async () => {
    let capturada: Uint8Array | null = null;
    const espia: Argon2Runner = (r) => {
      capturada = r.password;
      return fast(r);
    };
    const generated = await createKeyPair();
    const { wrappingKey } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, espia);
    expect(capturada).not.toBeNull();
    expect(Array.from(capturada!).every((b) => b === 0)).toBe(true); // la frase ya no esta en memoria
    expect(wrappingKey.extractable).toBe(false); // la clave de envoltura no se puede volver a leer
    expect(Array.from(generated.privateBytes).every((b) => b === 0)).toBe(true);

    // La privada, en IndexedDB.
    const { keyPair } = await createKeyPair();
    expect(await saveDeviceKey(MEMBER, keyPair)).toBe(true);
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const rq = indexedDB.open('bearingworld-keys');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ko(rq.error);
    });
    const registros = await new Promise<{ keys: IDBValidKey[]; values: { privateKey: CryptoKey }[] }>((ok, ko) => {
      const store = db.transaction('device-keys', 'readonly').objectStore('device-keys');
      const k = store.getAllKeys();
      const v = store.getAll();
      v.onsuccess = () => ok({ keys: k.result, values: v.result });
      v.onerror = () => ko(v.error);
    });
    db.close();
    expect(registros.keys).toContain(MEMBER);
    expect(registros.values.every((x) => x.privateKey.extractable === false)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// key-recovery#1 y #4
// -----------------------------------------------------------------------------

describe('e2ee-key-management/key-recovery', () => {
  /*
   * #1 GIVEN un miembro autenticado cuya IndexedDB no contiene su privada
   *    WHEN  introduce su passphrase correcta en REC-01
   *    THEN  descarga el blob, re-deriva Argon2id con el salt, descifra, la guarda en IndexedDB
   *    AND   el miembro accede a su historial cifrado completo sin intervencion de soporte
   */
  it('e2ee-key-management/key-recovery#1 · tras recuperar en un dispositivo nuevo, el historial cifrado antes para su publica se abre sin mas intervencion', async () => {
    const { row, publicKey } = await backupRow(fast);

    // El historial: tres elementos cifrados en el pasado para la publica del miembro.
    const historial = await Promise.all(
      ['uno', 'dos', 'tres'].map(async (texto) => {
        const cek = await generateCek();
        return { texto, enc: await encryptContent({ kind: 'MENSAJE', text: texto }, cek), w: await wrapCekFor(cek, publicKey) };
      }),
    );

    // Dispositivo nuevo: ni llavero ni copia local.
    expect(currentKeyPair()).toBeNull();
    beginResponse = { data: [row], error: null };
    expect(await recoverKey(PASSPHRASE, MEMBER, fast)).toEqual({ kind: 'recovered' });

    const par = currentKeyPair();
    expect(par).not.toBeNull();
    for (const h of historial) {
      const cek = await unwrapCek(h.w, par!);
      expect(await decryptContent(h.enc.ciphertext, h.enc.iv, cek)).toEqual({ kind: 'MENSAJE', text: h.texto });
    }
  });

  /*
   * #4 GIVEN un miembro que no recuerda su passphrase y no tiene backup en nube
   *    WHEN  confirma por checkbox que entiende la perdida permanente de su historial
   *    THEN  el sistema genera un nuevo par X25519
   *    AND   el historial cifrado anterior queda permanentemente inaccesible
   */
  it('e2ee-key-management/key-recovery#4 · tras descartar el backup se genera un par X25519 NUEVO y lo cifrado para el anterior ya no se abre', async () => {
    const { row, publicKey } = await backupRow(fast);
    const cek = await generateCek();
    const enc = await encryptContent({ kind: 'MENSAJE', text: 'historial anterior' }, cek);
    const envuelta = await wrapCekFor(cek, publicKey);

    beginResponse = { data: [row], error: null };
    await recoverKey(PASSPHRASE, MEMBER, fast);
    // Sanidad: con el par viejo SI se abre.
    expect(await decryptContent(enc.ciphertext, enc.iv, await unwrapCek(envuelta, currentKeyPair()!))).toEqual({
      kind: 'MENSAJE',
      text: 'historial anterior',
    });

    await discardKeyBackup();
    expect(rpcCalls.at(-1)?.fn).toBe('discard_key_backup');
    expect(currentKeyPair()).toBeNull(); // se suelta el llavero viejo

    const nuevo = await createKeyPair(); // lo que REG-07 hace despues del descarte
    expect(nuevo.keyPair.privateKey.algorithm.name).toBe('X25519');
    expect(toHex(nuevo.keyPair.publicKey)).not.toBe(toHex(publicKey));
    await expect(unwrapCek(envuelta, nuevo.keyPair)).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------------
// passphrase-rotation#1 y #2
// -----------------------------------------------------------------------------

describe('e2ee-key-management/passphrase-rotation', () => {
  /*
   * #1 ... THEN ... el PUT sobrescribe el blob anterior AND la sesion continua sin interrupcion
   */
  it('e2ee-key-management/passphrase-rotation#1 · tras rotar, el llavero de la sesion sigue siendo el mismo, no se cierra sesion y lo cifrado antes se sigue abriendo', async () => {
    const { row, publicKey } = await backupRow(fast);
    const cek = await generateCek();
    const enc = await encryptContent({ kind: 'MENSAJE', text: 'antes de rotar' }, cek);
    const envuelta = await wrapCekFor(cek, publicKey);

    beginResponse = { data: [row], error: null };
    await recoverKey(PASSPHRASE, MEMBER, fast); // sesion con llavero
    const antes = currentKeyPair();
    expect(antes).not.toBeNull();
    rpcCalls.length = 0;

    beginResponse = { data: [row], error: null };
    expect(await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, fast)).toEqual({ kind: 'changed' });

    expect(currentKeyPair()).toBe(antes); // mismo objeto: nada se tiro ni se rehizo
    expect(signOut).not.toHaveBeenCalled();
    expect(rpcCalls.map((c) => c.fn)).toEqual(['begin_key_recovery', 'replace_key_backup']);
    expect(await decryptContent(enc.ciphertext, enc.iv, await unwrapCek(envuelta, currentKeyPair()!))).toEqual({
      kind: 'MENSAJE',
      text: 'antes de rotar',
    });
  });

  /*
   * #2 GIVEN un miembro en SET-SEC-01
   *    WHEN  introduce una passphrase actual incorrecta
   *    THEN  "Passphrase actual incorrecta"
   *    AND   rate limiting de 5 intentos con bloqueo de 30 minutos server-side
   *
   * El contador es del servidor (`begin_key_recovery`, SQL 0049); el cliente tiene que pedirlo cada
   * vez, no rotar nunca con frase mala y callarse cuando el servidor se bloquea.
   */
  it('e2ee-key-management/passphrase-rotation#2 · cinco frases actuales malas seguidas: cinco peticiones al servidor, la quinta trae los 30 min, la sexta esta bloqueada y nunca se sube un backup', async () => {
    const { row } = await backupRow(fast);
    const mala = 'esta no es la frase 123';
    beginQueue = [
      { data: [{ ...row, attempts_left: 4 }], error: null },
      { data: [{ ...row, attempts_left: 3 }], error: null },
      { data: [{ ...row, attempts_left: 2 }], error: null },
      { data: [{ ...row, attempts_left: 1 }], error: null },
      { data: [{ ...row, attempts_left: 0, seconds_left: 1800 }], error: null },
      {
        data: [{ status: 'locked', seconds_left: 1790, attempts_left: 0, public_key: null, encrypted_key_blob: null, key_iv: null, argon2_salt: null }],
        error: null,
      },
    ];
    const argon = vi.fn(fast);

    const resultados = [];
    for (let i = 0; i < 6; i++) resultados.push(await changeBackupPassphrase(mala, NEW_PASSPHRASE, MEMBER, argon));

    expect(resultados.slice(0, 4).map((r) => r.kind)).toEqual(['wrong', 'wrong', 'wrong', 'wrong']);
    expect(resultados[4]).toEqual({ kind: 'wrong', attemptsLeft: 0, lockedSeconds: 1800 });
    expect(resultados[5]).toEqual({ kind: 'locked', secondsLeft: 1790 });
    expect(rpcCalls.filter((c) => c.fn === 'begin_key_recovery')).toHaveLength(6);
    expect(rpcCalls.some((c) => c.fn === 'replace_key_backup')).toBe(false);
    // Bloqueado, ni se intenta derivar: 5 derivaciones de Argon2 (las de las frases malas), ninguna mas.
    expect(argon.mock.calls.length).toBe(5);
  });

  it('e2ee-key-management/passphrase-rotation#2 · el limite del cliente coincide con la spec: 5 intentos y 30 minutos', async () => {
    const m = await import('./key-recovery');
    expect(m.MAX_RECOVERY_ATTEMPTS).toBe(5);
    expect(m.RECOVERY_COOLDOWN_MINUTES).toBe(30);
  });
});

// -----------------------------------------------------------------------------
// schema-desde-dia-uno#1 (la parte que se puede mirar sin base)
// -----------------------------------------------------------------------------

describe('e2ee-key-management/schema-desde-dia-uno', () => {
  /*
   * GIVEN la primera migracion ejecutada
   * WHEN  se inspecciona el esquema de la tabla de miembros (la spec dice `users`)
   * THEN  encrypted_key_blob, key_iv, argon2_salt y kdf_params existen con sus tipos (BYTEA / JSONB) y son nullable
   */
  it('e2ee-key-management/schema-desde-dia-uno#1 · la PRIMERA migracion (0001) declara los cuatro campos con bytea/jsonb y sin NOT NULL', () => {
    const sql = readFileSync(
      resolve(process.cwd(), '..', 'supabase', 'migrations', '0001_organizations_and_members.sql'),
      'utf-8',
    );
    const tipos: Record<string, string> = {
      encrypted_key_blob: 'bytea',
      key_iv: 'bytea',
      argon2_salt: 'bytea',
      kdf_params: 'jsonb',
    };
    for (const [col, tipo] of Object.entries(tipos)) {
      const linea = sql.split('\n').find((l) => new RegExp(`^\\s*${col}\\s`).test(l));
      expect(linea, `columna ${col} en 0001`).toBeDefined();
      expect(linea!).toMatch(new RegExp(`^\\s*${col}\\s+${tipo}\\s*,?\\s*(--.*)?$`));
      expect(linea!.toLowerCase()).not.toContain('not null');
    }
  });
});

// -----------------------------------------------------------------------------
// Contrato modificado: openspec/changes/amend-e2ee-key-verifier (F-242, F-268)
// -----------------------------------------------------------------------------

/** SHA-256 y HKDF recalculados aquí con WebCrypto, sin pasar por el código que se prueba. */
async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', copia));
}

async function pruebaDe(materia: Uint8Array): Promise<Uint8Array> {
  const copia = new Uint8Array(materia.byteLength);
  copia.set(materia);
  const ikm = await crypto.subtle.importKey('raw', copia, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('bearingworld.io/key-backup/proof/v1'),
    },
    ikm,
    256,
  );
  return new Uint8Array(bits);
}

describe('e2ee-key-management · contrato modificado (amend-e2ee-key-verifier)', () => {
  /*
   * key-wrapping, escenario «cifrado de backup correcto» (texto modificado):
   * el payload contiene únicamente {encrypted_key_blob, key_iv, argon2_salt, kdf_params, key_verifier, public_key};
   * public_key es la del par recién generado, que la llamada registra.
   */
  it('key-wrapping#1 (modificado) · store_key_backup recibe exactamente las seis claves y public_key es la del par recien generado', async () => {
    const generated = await createKeyPair();
    const generada = generated.keyPair.publicKey.slice();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, marcado);
    await uploadKeyBackup(payload);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe('store_key_backup');
    expect(Object.keys(rpcCalls[0]!.args!).sort()).toEqual(
      ['p_argon2_salt', 'p_encrypted_key_blob', 'p_key_iv', 'p_key_verifier', 'p_kdf_params', 'p_public_key'].sort(),
    );
    expect(rpcCalls[0]!.args!.p_public_key).toBe(toBytea(generada));
  });

  it('key-wrapping#1 (modificado) · al rotar, replace_key_backup lleva la publica ya registrada, la misma que devolvio begin_key_recovery', async () => {
    const { row } = await backupRow(fast);
    beginResponse = { data: [row], error: null };
    expect(await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, fast)).toEqual({ kind: 'changed' });

    const replace = rpcCalls.find((c) => c.fn === 'replace_key_backup')!;
    expect(replace.args!.p_public_key).toBe(row.public_key);
  });

  it('key-wrapping#1 (modificado) · key_verifier = sha256(prueba); la prueba es HKDF de la salida de Argon2id y es distinta de ella y del verificador', async () => {
    const generated = await createKeyPair();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, marcado);
    await uploadKeyBackup(payload);

    const prueba = await pruebaDe(MARK); // la materia de Argon2id es MARK (ejecutor marcado)
    const verificador = await sha256(prueba);
    expect(rpcCalls[0]!.args!.p_key_verifier).toBe(toBytea(verificador));
    expect(toHex(prueba)).not.toBe(toHex(MARK));
    expect(toHex(prueba)).not.toBe(toHex(verificador));
    expect(toHex(verificador)).not.toBe(toHex(MARK));
    // y lo que sale es el verificador, nunca la prueba ni la salida de Argon2id
    nadaDe(prueba);
    nadaDe(MARK);
  });

  /*
   * server-blind-storage, escenario «invariante del servidor ciego» (texto modificado):
   * la prueba solo viaja cuando el servidor tiene que comprobar la passphrase actual.
   */
  it('server-blind-storage#1 (modificado) · p_old_proof solo aparece en replace_key_backup y es la prueba de la frase ACTUAL, no la de la nueva', async () => {
    // Generacion y recuperacion: ninguna lleva p_old_proof.
    const generated = await createKeyPair();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, fast);
    await uploadKeyBackup(payload);
    const { row } = await backupRow(fast);
    beginResponse = { data: [row], error: null };
    expect(await recoverKey(PASSPHRASE, MEMBER, fast)).toEqual({ kind: 'recovered' });
    for (const c of rpcCalls) expect(c.args ?? {}).not.toHaveProperty('p_old_proof');

    // Rotacion.
    rpcCalls.length = 0;
    beginResponse = { data: [row], error: null };
    expect(await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, fast)).toEqual({ kind: 'changed' });
    const conPrueba = rpcCalls.filter((c) => c.args && 'p_old_proof' in c.args);
    expect(conPrueba.map((c) => c.fn)).toEqual(['replace_key_backup']);
    const replace = conPrueba[0]!;

    // La prueba que viaja es la de la frase ACTUAL con la sal del backup que se sustituye...
    const actual = await deriveBackupKeys(PASSPHRASE, fromBytea(row.argon2_salt), KDF_PARAMS, fast);
    expect(replace.args!.p_old_proof).toBe(toBytea(actual.proof));
    // ...y el verificador que se sube es el de la frase NUEVA, con la sal nueva, no el mismo.
    const nueva = await deriveBackupKeys(NEW_PASSPHRASE, fromBytea(replace.args!.p_argon2_salt as string), KDF_PARAMS, fast);
    expect(replace.args!.p_key_verifier).toBe(toBytea(await keyVerifierOf(nueva.proof)));
    expect(replace.args!.p_key_verifier).not.toBe(toBytea(await keyVerifierOf(actual.proof)));
    // La prueba de la frase nueva no sale en ninguna llamada.
    nadaDe(nueva.proof);
  });

  it('server-blind-storage#1 (modificado) · la salida de Argon2id no aparece en hex, bytea ni base64 en generacion, recuperacion ni rotacion', async () => {
    const generated = await createKeyPair();
    const { payload } = await protectPrivateKey(PASSPHRASE, MEMBER, generated, marcado);
    await uploadKeyBackup(payload);
    nadaDe(MARK);

    rpcCalls.length = 0;
    const { row } = await backupRow(marcado);
    beginResponse = { data: [row], error: null };
    expect(await recoverKey(PASSPHRASE, MEMBER, marcado)).toEqual({ kind: 'recovered' });
    nadaDe(MARK);

    // En la rotacion viaja la prueba (HKDF de MARK), pero MARK no.
    rpcCalls.length = 0;
    const otro = await backupRow(marcado);
    beginResponse = { data: [otro.row], error: null };
    expect(await changeBackupPassphrase(PASSPHRASE, NEW_PASSPHRASE, MEMBER, marcado)).toEqual({ kind: 'changed' });
    nadaDe(MARK);
    const replace = rpcCalls.find((c) => c.fn === 'replace_key_backup')!;
    expect(replace.args!.p_old_proof).toBe(toBytea(await pruebaDe(MARK)));
  });
});
