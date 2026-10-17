import { describe, it, expect } from 'vitest';
import {
  IV_BYTES,
  fromBytea,
  generateCek,
  keyPairFromPrivateBytes,
  encryptContent,
  decryptContent,
  wrapCekFor,
  unwrapCek,
} from './crypto';

/**
 * Corriente C · nivel 2 del plan v2.3 (§5.1): «que el cifrado protege de verdad».
 *
 * Lo que `crypto.test.ts` no cubría, y por qué importa:
 *
 *  1. **Vectores públicos.** Los de RFC 7748 §6.1 (X25519) pasan por *nuestro*
 *     camino de importación de claves y de derivación de la pública, no solo por
 *     WebCrypto; el de NIST/McGrew–Viega para AES-GCM-256 fija que el motor del
 *     navegador/Node hace lo que dice el estándar (si un día cambia de motor y se
 *     equivoca, esto es lo que lo caza antes que ningún round-trip, porque un
 *     round-trip lo pasa también un cifrado mal implementado pero simétrico).
 *     Argon2id (RFC 9106) ya tiene su vector en `key-backup.test.ts`.
 *  2. **El IV no se repite.** Reutilizar un nonce en AES-GCM no degrada nada poco a
 *     poco: revela el XOR de los textos planos y deja recuperar la clave de
 *     autenticación. No hay herramienta que lo vigile; esto es la herramienta.
 *
 * **Lo que NO hace** (dicho para que nadie lo dé por cubierto): no ejecuta el corpus
 * de Wycheproof —habría que traerlo de un repositorio de terceros a CI— y no pone un
 * tope duro de usos por clave, porque el código no lo tiene: la mitigación real es
 * que **cada elemento lleva su propia CEK** (se prueba abajo) y cada envoltura una
 * clave derivada de un par efímero nuevo. Ver `F-266`.
 */

const hex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(fromBytea(`\\x${s}`));
const aHex = (b: Uint8Array | ArrayBuffer): string =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

// -----------------------------------------------------------------------------
// Vectores públicos
// -----------------------------------------------------------------------------

describe('vectores públicos · X25519 (RFC 7748 §6.1)', () => {
  const ALICE_PRIV = '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a';
  const ALICE_PUB = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
  const BOB_PRIV = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb';
  const BOB_PUB = 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f';
  const SHARED = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';

  it('nuestra importación de la privada da la pública del estándar, para Alice y para Bob', async () => {
    const alice = await keyPairFromPrivateBytes(hex(ALICE_PRIV));
    const bob = await keyPairFromPrivateBytes(hex(BOB_PRIV));
    expect(aHex(alice.publicKey)).toBe(ALICE_PUB);
    expect(aHex(bob.publicKey)).toBe(BOB_PUB);
  });

  it('el secreto compartido de las dos partes es el del estándar, en los dos sentidos', async () => {
    const alice = await keyPairFromPrivateBytes(hex(ALICE_PRIV));
    const bob = await keyPairFromPrivateBytes(hex(BOB_PRIV));
    const s = crypto.subtle;
    const bobPub = await s.importKey('raw', hex(BOB_PUB), { name: 'X25519' }, false, []);
    const alicePub = await s.importKey('raw', hex(ALICE_PUB), { name: 'X25519' }, false, []);
    const ab = await s.deriveBits({ name: 'X25519', public: bobPub }, alice.privateKey, 256);
    const ba = await s.deriveBits({ name: 'X25519', public: alicePub }, bob.privateKey, 256);
    expect(aHex(ab)).toBe(SHARED);
    expect(aHex(ba)).toBe(SHARED);
  });

  it('con las claves del estándar, envolver y abrir una CEK da la misma CEK', async () => {
    const bob = await keyPairFromPrivateBytes(hex(BOB_PRIV));
    const cek = await generateCek();
    const abierta = await unwrapCek(await wrapCekFor(cek, bob.publicKey), bob);
    expect(aHex(await crypto.subtle.exportKey('raw', abierta))).toBe(
      aHex(await crypto.subtle.exportKey('raw', cek)),
    );
  });
});

describe('vectores públicos · AES-256-GCM (McGrew–Viega, Test Case 14)', () => {
  // Clave de 256 bits a cero, IV de 96 bits a cero, un bloque de texto plano a cero,
  // sin AAD. Es el caso 14 del documento original de GCM, el mismo que usa NIST.
  it('el motor cifra el bloque a cero con el texto cifrado y la etiqueta del estándar', async () => {
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, [
      'encrypt',
    ]);
    const out = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      key,
      new Uint8Array(16),
    );
    const bytes = new Uint8Array(out);
    expect(aHex(bytes.slice(0, 16))).toBe('cea7403d4d606b6e074ec5d3baf39d18');
    expect(aHex(bytes.slice(16))).toBe('d0d1c8a799996bf0265b98b5d48ab919');
  });
});

// -----------------------------------------------------------------------------
// El IV no se repite
// -----------------------------------------------------------------------------

describe('propiedad · ningún IV se repite con la misma clave', () => {
  it('1.000 cifrados con la misma CEK dan 1.000 IV distintos de 12 bytes', async () => {
    const cek = await generateCek();
    const ivs: Uint8Array[] = [];
    for (let i = 0; i < 1000; i++) {
      const { iv } = await encryptContent({ n: i }, cek);
      ivs.push(iv);
    }
    expect(ivs.every((iv) => iv.length === IV_BYTES)).toBe(true);
    expect(new Set(ivs.map(aHex)).size).toBe(1000);
  });

  it('y no es un contador ni un generador a cero: ningún IV es todo ceros y los 8 primeros bytes no se repiten', async () => {
    // Un contador que se reinicia, un IV derivado de la hora o un generador
    // determinista comparten prefijo entre cifrados seguidos. Con 64 bits al azar,
    // la probabilidad de que dos de 1.000 coincidan es ~3e-14.
    const cek = await generateCek();
    const ivs: Uint8Array[] = [];
    for (let i = 0; i < 1000; i++) ivs.push((await encryptContent('x', cek)).iv);
    expect(ivs.some((iv) => iv.every((b) => b === 0))).toBe(false);
    expect(new Set(ivs.map((iv) => aHex(iv.slice(0, 8)))).size).toBe(1000);
  });

  it('cada envoltura usa IV, efímera y texto envuelto nuevos, aunque sea para el mismo destinatario', async () => {
    const dest = await keyPairFromPrivateBytes(crypto.getRandomValues(new Uint8Array(32)));
    const cek = await generateCek();
    const envolturas = [];
    for (let i = 0; i < 300; i++) envolturas.push(await wrapCekFor(cek, dest.publicKey));
    for (const campo of ['wrapIv', 'ephemeralPublicKey', 'wrappedCek'] as const) {
      expect(new Set(envolturas.map((e) => aHex(e[campo]))).size, campo).toBe(300);
    }
  });

  it('cada elemento lleva su propia CEK: es la mitigación del tope de usos por clave', async () => {
    const claves = await Promise.all(Array.from({ length: 200 }, () => generateCek()));
    const crudas = await Promise.all(claves.map((k) => crypto.subtle.exportKey('raw', k)));
    expect(new Set(crudas.map(aHex)).size).toBe(200);
  });

  it('el mismo contenido cifrado dos veces con la misma clave da textos cifrados distintos', async () => {
    const cek = await generateCek();
    const a = await encryptContent({ precio: 12.4 }, cek);
    const b = await encryptContent({ precio: 12.4 }, cek);
    expect(aHex(a.ciphertext)).not.toBe(aHex(b.ciphertext));
    // y los dos abren: no es que uno esté roto
    expect(await decryptContent(a.ciphertext, a.iv, cek)).toEqual({ precio: 12.4 });
    expect(await decryptContent(b.ciphertext, b.iv, cek)).toEqual({ precio: 12.4 });
  });
});
