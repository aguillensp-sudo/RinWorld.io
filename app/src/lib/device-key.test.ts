import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { generateKeyPair, toHex } from './crypto';
import { createKeyPair } from './key-backup';
import { loadDeviceKey, saveDeviceKey } from './device-key';

/**
 * La copia de la clave en este dispositivo (ADR-001 §7.2). Con `fake-indexeddb`: lo
 * que se comprueba es que la `CryptoKey` vuelve USABLE y NO EXTRAÍBLE, por miembro.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

const ALPHA = '0a000001-0000-0000-0000-000000000001';
const BETA = '0b000001-0000-0000-0000-000000000001';

async function sharedSecret(a: CryptoKey, publicKey: Uint8Array): Promise<string> {
  const pub = await crypto.subtle.importKey('raw', publicKey.slice(), { name: 'X25519' }, false, []);
  return toHex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: pub }, a, 256)));
}

describe('device-key · IndexedDB', () => {
  it('ANCLA · guarda y devuelve el par de REG-07, todavía no extraíble y que sigue sirviendo', async () => {
    const { keyPair } = await createKeyPair();
    expect(await saveDeviceKey(ALPHA, keyPair)).toBe(true);

    const back = await loadDeviceKey(ALPHA);
    expect(back).not.toBeNull();
    expect(toHex(back!.publicKey)).toBe(toHex(keyPair.publicKey));
    expect(back!.privateKey.extractable).toBe(false);

    const other = await generateKeyPair();
    expect(await sharedSecret(back!.privateKey, other.publicKey)).toBe(
      await sharedSecret(other.privateKey, keyPair.publicKey),
    );
  });

  it('por miembro: la de uno no es la de otro', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    await saveDeviceKey(ALPHA, a);
    await saveDeviceKey(BETA, b);
    expect(toHex((await loadDeviceKey(BETA))!.publicKey)).toBe(toHex(b.publicKey));
    expect(toHex((await loadDeviceKey(ALPHA))!.publicKey)).toBe(toHex(a.publicKey));
  });

  it('sin copia, null', async () => {
    expect(await loadDeviceKey('ffffffff-0000-0000-0000-000000000000')).toBeNull();
  });
});
