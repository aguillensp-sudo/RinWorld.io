import { describe, it, expect } from 'vitest';
import {
  IV_BYTES,
  PUBLIC_KEY_BYTES,
  toBytea,
  fromBytea,
  generateKeyPair,
  deriveKeyPairFromSeed,
  generateCek,
  wrapCekFor,
  unwrapCek,
  encryptContent,
  decryptContent,
} from './crypto';

/**
 * Contrato de las primitivas E2EE.
 *
 * **El orden importa y es la lección de F-059.** El primer bloque es el ANCLA
 * POSITIVA: dos partes distintas se intercambian un contenido y se lee. Todo lo
 * que viene detrás dice "esto NO se puede", y un "no se puede" lo cumple también
 * un módulo que no hace nada. Sin el round-trip verde delante, los asertos de
 * abajo no medirían nada.
 */

describe('bytea', () => {
  it('va y vuelve, con prefijo y sin él', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xa9]);
    expect(toBytea(bytes)).toBe('\\x000fffa9');
    expect(Array.from(fromBytea('\\x000fffa9'))).toEqual(Array.from(bytes));
    expect(Array.from(fromBytea('000fffa9'))).toEqual(Array.from(bytes));
  });

  it('el cero a la izquierda no se pierde', () => {
    // Un `toString(16)` sin `padStart` convierte 0x0f en "f" y desplaza el resto
    // del blob un nibble. El síntoma sería un fallo de descifrado, que apunta al
    // sitio equivocado.
    expect(toBytea(new Uint8Array([0x0f, 0x00]))).toBe('\\x0f00');
  });

  it('lo que no es hexadecimal se rechaza, no se trunca', () => {
    expect(() => fromBytea('\\xzz')).toThrow();
    expect(() => fromBytea('\\xabc')).toThrow();
  });
});

describe('el par de claves', () => {
  it('la pública mide los 32 bytes que exige members_pubkey_len_chk (0001:93)', async () => {
    const kp = await generateKeyPair();
    expect(kp.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
  });

  it('dos pares aleatorios no coinciden', async () => {
    const [a, b] = await Promise.all([generateKeyPair(), generateKeyPair()]);
    expect(toBytea(a.publicKey)).not.toBe(toBytea(b.publicKey));
  });
});

describe('ANCLA · el camino entero, de una parte a la otra', () => {
  it('Alpha cifra, Nordwälz descifra, y sale exactamente lo que entró', async () => {
    const nordwalz = await generateKeyPair();

    // Lado emisor: una CEK por elemento, envuelta para el destinatario.
    const cek = await generateCek();
    const oferta = {
      kind: 'OFERTA',
      unitPrice: 12.4,
      currency: 'EUR',
      quantity: 800,
      leadTimeDays: 5,
      shippingCost: null,
      shippingCostCurrency: null,
      validUntil: '2026-08-20T00:00:00.000Z',
      notes: 'Portes no informados',
    };
    const { ciphertext, iv } = await encryptContent(oferta, cek);
    const envuelta = await wrapCekFor(cek, nordwalz.publicKey);

    // Lado receptor: abre la envoltura y con ella el contenido.
    const cekAbierta = await unwrapCek(envuelta, nordwalz);
    expect(await decryptContent(ciphertext, iv, cekAbierta)).toEqual(oferta);
  });

  it('el emisor también se envuelve una copia para sí mismo, y la abre', async () => {
    // Sin esto, quien escribe no podría releer lo que escribió al recargar:
    // `item_keys_select_own` (0003:353) reparte por persona, no por organización.
    const alpha = await generateKeyPair();
    const cek = await generateCek();
    const { ciphertext, iv } = await encryptContent({ kind: 'MENSAJE', text: 'Hola' }, cek);

    const propia = await unwrapCek(await wrapCekFor(cek, alpha.publicKey), alpha);
    expect(await decryptContent(ciphertext, iv, propia)).toEqual({ kind: 'MENSAJE', text: 'Hola' });
  });

  it('los dos IV miden los 12 bytes que exige 0003, o la base rechaza la fila', async () => {
    const kp = await generateKeyPair();
    const cek = await generateCek();
    const { iv } = await encryptContent({ kind: 'MENSAJE', text: 'x' }, cek);
    const envuelta = await wrapCekFor(cek, kp.publicKey);

    expect(iv).toHaveLength(IV_BYTES);
    expect(envuelta.wrapIv).toHaveLength(IV_BYTES);
    expect(envuelta.ephemeralPublicKey).toHaveLength(PUBLIC_KEY_BYTES);
  });
});

describe('la frontera: quién NO puede leer', () => {
  it('un tercero con su propia clave no abre la envoltura ajena', async () => {
    // ÁMBITO: se prueba contra el MISMO ciphertext que el ancla de arriba abre
    // con la clave correcta. Lo que cambia es solo quién intenta abrirlo.
    const destinatario = await generateKeyPair();
    const intruso = await generateKeyPair();

    const cek = await generateCek();
    const envuelta = await wrapCekFor(cek, destinatario.publicKey);

    await expect(unwrapCek(envuelta, destinatario)).resolves.toBeTruthy();
    await expect(unwrapCek(envuelta, intruso)).rejects.toThrow();
  });

  it('una envoltura con la efímera cambiada no abre', async () => {
    const destinatario = await generateKeyPair();
    const otro = await generateKeyPair();
    const cek = await generateCek();
    const envuelta = await wrapCekFor(cek, destinatario.publicKey);

    await expect(unwrapCek(envuelta, destinatario)).resolves.toBeTruthy();
    await expect(
      unwrapCek({ ...envuelta, ephemeralPublicKey: otro.publicKey }, destinatario),
    ).rejects.toThrow();
  });

  it('un ciphertext manipulado no descifra a medias: GCM autentica', async () => {
    const cek = await generateCek();
    const { ciphertext, iv } = await encryptContent({ kind: 'MENSAJE', text: 'Precio 12,40' }, cek);

    await expect(decryptContent(ciphertext, iv, cek)).resolves.toBeTruthy();

    const tocado = Uint8Array.from(ciphertext);
    tocado[0] = (tocado[0] ?? 0) ^ 0x01;
    await expect(decryptContent(tocado, iv, cek)).rejects.toThrow();
  });

  it('el IV equivocado tampoco abre', async () => {
    const cek = await generateCek();
    const { ciphertext, iv } = await encryptContent({ kind: 'MENSAJE', text: 'x' }, cek);

    await expect(decryptContent(ciphertext, iv, cek)).resolves.toBeTruthy();
    await expect(
      decryptContent(ciphertext, new Uint8Array(IV_BYTES), cek),
    ).rejects.toThrow();
  });

  it('ningún error lleva material de clave dentro (ADR-001 §8)', async () => {
    // El invariante dice que el material de clave no viaja "ni en payloads, ni
    // en logs, ni en mensajes de error". Este es el aserto de la tercera.
    const corta = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const cek = await generateCek();
    await expect(wrapCekFor(cek, corta)).rejects.toThrow(/32 bytes/);
    await expect(wrapCekFor(cek, corta)).rejects.not.toThrow(/0102030405060708/);
  });
});

describe('claves de demo deterministas (D-08-01 a)', () => {
  const SEMILLA = 'semilla-de-pruebas-no-es-la-de-la-demo';
  const ALPHA = '0a000001-0000-0000-0000-000000000001';
  const NORDWALZ = '0b000001-0000-0000-0000-000000000001';

  it('la misma semilla y el mismo miembro dan siempre la misma pública', async () => {
    const uno = await deriveKeyPairFromSeed(SEMILLA, ALPHA);
    const dos = await deriveKeyPairFromSeed(SEMILLA, ALPHA);
    expect(toBytea(uno.publicKey)).toBe(toBytea(dos.publicKey));
    expect(uno.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
  });

  it('dos miembros con la misma semilla salen distintos', async () => {
    // Si no, la demo sería una organización hablando consigo misma y el panel
    // de vista-servidor del día 11 no enseñaría dos partes.
    const a = await deriveKeyPairFromSeed(SEMILLA, ALPHA);
    const b = await deriveKeyPairFromSeed(SEMILLA, NORDWALZ);
    expect(toBytea(a.publicKey)).not.toBe(toBytea(b.publicKey));
  });

  it('otra semilla da otras claves', async () => {
    const a = await deriveKeyPairFromSeed(SEMILLA, ALPHA);
    const b = await deriveKeyPairFromSeed(`${SEMILLA}-otra`, ALPHA);
    expect(toBytea(a.publicKey)).not.toBe(toBytea(b.publicKey));
  });

  it('LO QUE DE VERDAD DECIDE D-08-01: lo cifrado al sembrar se abre en otra sesión', async () => {
    // Sesión 1 · la siembra. Se deriva el par de Nordwälz y se cifra para él.
    const sesion1 = await deriveKeyPairFromSeed(SEMILLA, NORDWALZ);
    const cek = await generateCek();
    const contenido = { kind: 'CONSULTA', quantity: 800, comment: null };
    const { ciphertext, iv } = await encryptContent(contenido, cek);
    const envuelta = await wrapCekFor(cek, sesion1.publicKey);

    // Sesión 2 · otro navegador, otro día, sin nada en memoria. Solo la semilla.
    const sesion2 = await deriveKeyPairFromSeed(SEMILLA, NORDWALZ);
    const abierta = await unwrapCek(envuelta, sesion2);
    expect(await decryptContent(ciphertext, iv, abierta)).toEqual(contenido);
  });

  it('sin la semilla correcta no se abre nada', async () => {
    const buena = await deriveKeyPairFromSeed(SEMILLA, NORDWALZ);
    const mala = await deriveKeyPairFromSeed('semilla-que-no-es', NORDWALZ);
    const cek = await generateCek();
    const envuelta = await wrapCekFor(cek, buena.publicKey);

    await expect(unwrapCek(envuelta, buena)).resolves.toBeTruthy();
    await expect(unwrapCek(envuelta, mala)).rejects.toThrow();
  });
});
