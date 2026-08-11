import { describe, expect, it } from 'vitest';
import {
  asOfferCard,
  authorLabel,
  decryptItem,
  itemTypeLabel,
  validUntilLabel,
  AGREEMENT_DISABLED_REASON,
  CREATE_OFFER_DISABLED_REASON,
  ENCRYPTED_NOTICE,
  SEND_DISABLED_REASON,
  type ThreadItem,
} from './thread-detail';
import { offerActions } from './offers';

/**
 * La lógica pura de MSG-02. Igual que en `threads.test.ts`: estos tests son los
 * míos, no el contrato del arnés — el contrato vive en `screens/messages/
 * Thread*.test.tsx` y el Coder no lo ve (`CLAUDE.md` §3).
 */

const MIA = 'org-alpha';
const SUYA = 'org-beta';

function item(over: Partial<ThreadItem> = {}): ThreadItem {
  return {
    id: 'it-1',
    type: 'MENSAJE',
    senderOrgId: MIA,
    isOwn: true,
    createdAt: '2026-08-11T10:00:00Z',
    partNumber: null,
    brand: null,
    offerState: null,
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    ...over,
  };
}

describe('la costura de descifrado (D-07-05)', () => {
  it('hoy devuelve null para los tres tipos, y es deliberado', () => {
    // Este test CAMBIA el día 8, cuando entre la rebanada E2EE. Que cambie es la
    // señal de que la costura se rellenó; que siga verde el día 9 sería la señal
    // de que no.
    for (const type of ['MENSAJE', 'CONSULTA', 'OFERTA'] as const) {
      expect(decryptItem({ type, ciphertext: '\\xdeadbeef', iv: '\\x000102030405060708090a0b' }))
        .toBeNull();
    }
  });

  it('no intenta leer el ciphertext como si fuera texto', () => {
    // La tentación del día que corra prisa: devolver el blob tal cual para que la
    // pantalla "enseñe algo". Enseñaría bytes cifrados como si fueran un mensaje.
    const salida = decryptItem({ type: 'MENSAJE', ciphertext: 'Hola', iv: 'x' });
    expect(salida).toBeNull();
  });

  it('un elemento sin contenido descifrado conserva TODOS sus metadatos', () => {
    // Lo que separa un hilo sin passphrase de una pantalla en blanco. Los cinco
    // campos van en claro en `thread_items` desde 0003.
    const oferta = item({
      type: 'OFERTA',
      senderOrgId: SUYA,
      isOwn: false,
      partNumber: '6205-2RS',
      brand: 'NSK',
      offerState: 'Pendiente',
      content: null,
    });
    expect(oferta.partNumber).toBe('6205-2RS');
    expect(oferta.brand).toBe('NSK');
    expect(oferta.offerState).toBe('Pendiente');
    expect(oferta.createdAt).toBeTruthy();
    expect(oferta.type).toBe('OFERTA');
  });
});

describe('los literales que ve el usuario', () => {
  it('el indicador de cifrado es VERBATIM el de la capability', () => {
    // `messaging-and-negotiation/spec.md:68`. Es contrato, no copy de la casa: se
    // compara la cadena entera, con su raya larga.
    expect(ENCRYPTED_NOTICE).toBe('Contenido cifrado — introduce tu frase de seguridad para ver');
  });

  it('el indicador no ofrece nada, solo informa (F-027)', () => {
    // Ni "pulsa", ni "haz clic": en el MVP no hay dónde introducir la frase, y un
    // imperativo accionable sin acción detrás promete recuperación de claves que
    // no existe.
    expect(ENCRYPTED_NOTICE).not.toMatch(/pulsa|haz clic|introdúcela aquí/i);
  });

  it('los tres motivos de deshabilitado son frases completas y sin promesas', () => {
    for (const motivo of [
      SEND_DISABLED_REASON,
      AGREEMENT_DISABLED_REASON,
      CREATE_OFFER_DISABLED_REASON,
    ]) {
      expect(motivo.length).toBeGreaterThan(20);
      expect(motivo.endsWith('.')).toBe(true);
      // "Próximamente" es una fecha que nadie se ha comprometido a cumplir.
      expect(motivo).not.toMatch(/próximamente|pronto|en breve/i);
    }
  });

  it('el motivo del acuerdo dice la causa real, no que falte una función', () => {
    // D-07-04: no es que el botón esté a medias, es que el estado lo deriva la
    // base desde la aceptación de una oferta (`0007:246`, `spec.md:195`).
    expect(AGREEMENT_DISABLED_REASON).toMatch(/aceptando una oferta/i);
  });
});

describe('validUntilLabel', () => {
  it('una fecha de validez se lee, no se pinta el ISO en crudo', () => {
    // El artefacto del Coder pintaba `content.validUntil` tal cual. Ningun check
    // lo vio porque la rama descifrada no se ejercita hasta el dia 8: es el tipo
    // de defecto que solo caza leer el codigo.
    const salida = validUntilLabel('2026-07-15T00:00:00.000Z');
    expect(salida).not.toMatch(/T\d{2}:\d{2}|Z$/);
    expect(salida).toMatch(/2026/);
    expect(salida).toMatch(/jul/i);
  });

  it('lo que no es una fecha se devuelve tal cual, sin taparlo', () => {
    // Un guion en su lugar ocultaria que el dato llego mal.
    expect(validUntilLabel('pronto')).toBe('pronto');
  });
});

describe('authorLabel', () => {
  const nombres = { ownOrgName: 'Rodamientos del Sur SL', counterpartyName: 'NSK Europe Ltd' };

  it('lo mío lo firma mi organización', () => {
    expect(authorLabel(item({ isOwn: true }), nombres)).toBe('Rodamientos del Sur SL');
  });

  it('lo suyo lo firma la contraparte', () => {
    expect(authorLabel(item({ isOwn: false }), nombres)).toBe('NSK Europe Ltd');
  });
});

describe('itemTypeLabel', () => {
  it.each([
    ['CONSULTA', 'Consulta'],
    ['OFERTA', 'Oferta'],
    ['MENSAJE', 'Mensaje'],
  ] as const)('%s → %s', (type, esperado) => {
    expect(itemTypeLabel(type)).toBe(esperado);
  });
});

describe('asOfferCard · el puente con offers.ts', () => {
  const oferta = item({
    id: 'of-1',
    type: 'OFERTA',
    senderOrgId: SUYA,
    isOwn: false,
    partNumber: '6205-2RS',
    brand: 'NSK',
    offerState: 'Pendiente',
  });

  it('un mensaje no es una tarjeta de oferta', () => {
    expect(asOfferCard(item({ type: 'MENSAJE' }), 'th-1')).toBeNull();
  });

  it('una consulta tampoco', () => {
    expect(asOfferCard(item({ type: 'CONSULTA', inquiryState: 'Pendiente' }), 'th-1')).toBeNull();
  });

  it('una oferta conserva los campos de los que depende quién puede decidirla', () => {
    const card = asOfferCard(oferta, 'th-1');
    expect(card).not.toBeNull();
    expect(card!.senderOrgId).toBe(SUYA);
    expect(card!.state).toBe('Pendiente');
    expect(card!.threadId).toBe('th-1');
  });

  it('la oferta recibida y pendiente ofrece las tres acciones al receptor', () => {
    expect(offerActions(asOfferCard(oferta, 'th-1')!, MIA)).toEqual([
      'aceptar',
      'rechazar',
      'contraofertar',
    ]);
  });

  it('⚠ la oferta PROPIA no ofrece ninguna, y es la regla que costó F-051 y F-056', () => {
    // El puente existe para que esta condición viva SOLO en `offerActions`. Si la
    // pantalla se la monta con `item.isOwn`, la regla pasa a estar en dos sitios y
    // el día que una cambie, la otra no.
    const propia = { ...oferta, senderOrgId: MIA, isOwn: true };
    expect(offerActions(asOfferCard(propia, 'th-1')!, MIA)).toEqual([]);
  });

  it('una oferta terminal no ofrece acciones aunque sea recibida', () => {
    const aceptada = { ...oferta, offerState: 'Aceptada' as const };
    expect(offerActions(asOfferCard(aceptada, 'th-1')!, MIA)).toEqual([]);
  });
});
