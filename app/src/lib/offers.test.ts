import { describe, expect, it } from 'vitest';
import {
  canAccept,
  canCloseThread,
  canRevertAgreement,
  EXPIRED_NOTICE,
  expiryNotice,
  isExpired,
  isTerminal,
  offerActions,
  OFFER_STATES,
  shippingLine,
  TERMINAL_OFFER_STATES,
  type OfferCard,
  type OfferState,
} from './offers';

/**
 * La lógica pura de la máquina de estados de la oferta.
 *
 * Se prueba sin base ni React porque es donde viven las decisiones. Lo que estos
 * tests NO son es la defensa: los invariantes están en las migraciones 0003, 0007
 * y 0008, y ahí es donde tienen que fallar. Esto comprueba que la interfaz ofrece
 * lo mismo que la base permite — que discrepen es el bug interesante.
 */

const NOW = new Date('2026-08-10T12:00:00Z');
const MIA = 'org-alpha';
const SUYA = 'org-nordwalz';

function oferta(over: Partial<OfferCard> = {}): OfferCard {
  return {
    id: 'item-1',
    threadId: 'hilo-1',
    senderOrgId: SUYA,
    state: 'Pendiente',
    partNumber: '6205-2RS',
    brand: 'NSK',
    createdAt: '2026-08-10T10:00:00Z',
    respondsToItemId: null,
    supersededByItemId: null,
    ...over,
  };
}

describe('los cuatro estados de offer-card', () => {
  it('son exactamente los del CHECK de la migración 0003', () => {
    expect(OFFER_STATES).toEqual(['Pendiente', 'Aceptada', 'Rechazada', 'Superada por contraoferta']);
  });

  it('tres son terminales y solo Pendiente se mueve', () => {
    expect(TERMINAL_OFFER_STATES).toHaveLength(3);
    expect(isTerminal('Pendiente')).toBe(false);
    for (const s of TERMINAL_OFFER_STATES) expect(isTerminal(s)).toBe(true);
  });

  it('no existe RETIRADA, ni BORRADOR, ni ENVIADA', () => {
    // El Plan §7 las dibuja y no están en ninguna capability. Ver F-043.
    const inventadas = ['RETIRADA', 'BORRADOR', 'ENVIADA', 'CONTRAOFERTADA'];
    for (const s of inventadas) expect(OFFER_STATES).not.toContain(s as OfferState);
  });
});

describe('quién puede decidir una oferta', () => {
  it('el receptor tiene las tres acciones', () => {
    expect(offerActions(oferta(), MIA)).toEqual(['aceptar', 'rechazar', 'contraofertar']);
  });

  /**
   * El test que justifica la migración 0008. Antes de ella, esto era cierto en la
   * interfaz y falso en la base: RLS deja escribir a las dos partes y ni el CHECK
   * ni la guardia de terminales miran quién firma. Ver F-051.
   */
  it('el EMISOR no puede hacer nada con su propia oferta', () => {
    expect(offerActions(oferta({ senderOrgId: MIA }), MIA)).toEqual([]);
    expect(canAccept(oferta({ senderOrgId: MIA }), MIA)).toBe(false);
  });

  it('una oferta ya terminal no admite nada, ni del receptor', () => {
    for (const s of TERMINAL_OFFER_STATES) {
      expect(offerActions(oferta({ state: s }), MIA)).toEqual([]);
    }
  });
});

describe('validez · la fecha informa, no vincula', () => {
  it('sin fecha no hay expiración', () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(expiryNotice(null, NOW)).toBeNull();
  });

  it('una fecha pasada da el aviso literal del spec', () => {
    expect(isExpired('2026-08-09T12:00:00Z', NOW)).toBe(true);
    expect(expiryNotice('2026-08-09T12:00:00Z', NOW)).toBe(EXPIRED_NOTICE);
  });

  it('una fecha futura no avisa', () => {
    expect(expiryNotice('2026-08-11T12:00:00Z', NOW)).toBeNull();
  });

  /**
   * Va contra la intuición y es lo que dice el spec: *"el receptor puede
   * aceptarla igualmente — la fecha es orientativa, no contractual en V1"*.
   * Deshabilitar el botón parecería más correcto y sería una regla inventada.
   */
  it('estar expirada NO quita la acción de aceptar', () => {
    const vencida = oferta();
    expect(isExpired('2026-08-01T00:00:00Z', NOW)).toBe(true);
    expect(canAccept(vencida, MIA)).toBe(true);
  });

  it('una fecha ilegible no inventa una expiración', () => {
    expect(isExpired('no es una fecha', NOW)).toBe(false);
  });
});

describe('coste de transporte · el cero engañoso', () => {
  it('no informado es null, no un cero', () => {
    expect(shippingLine(null, 'EUR')).toBeNull();
    expect(shippingLine(undefined, 'EUR')).toBeNull();
  });

  it('un cero informado SÍ se pinta: portes gratis es una afirmación válida', () => {
    expect(shippingLine(0, 'EUR')).not.toBeNull();
  });

  it('se formatea con Intl y su divisa, no a mano', () => {
    const esperado = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(42.5);
    expect(shippingLine(42.5, 'EUR')).toBe(esperado);
  });
});

describe('las dos transiciones manuales del hilo', () => {
  it('se puede cerrar cualquier hilo que no esté ya cerrado', () => {
    expect(canCloseThread('ABIERTO')).toBe(true);
    expect(canCloseThread('CON OFERTA PENDIENTE')).toBe(true);
    expect(canCloseThread('ACUERDO ALCANZADO')).toBe(true);
    expect(canCloseThread('CERRADO SIN ACUERDO')).toBe(false);
  });

  it('revertir solo aplica a un acuerdo alcanzado', () => {
    expect(canRevertAgreement('ACUERDO ALCANZADO')).toBe(true);
    expect(canRevertAgreement('ABIERTO')).toBe(false);
    expect(canRevertAgreement('CERRADO SIN ACUERDO')).toBe(false);
  });

  /**
   * **El PO decidió lo contrario el 11-ago (F-045): un hilo cerrado se reabre
   * cuando uno de los dos vuelve a escribir en él.** Este comentario decía que
   * este test sería lo primero en cambiar, y resulta que no cambia nada — porque
   * lo que prueba es otra cosa.
   *
   * La reapertura la hace la base al llegar un elemento nuevo (0009), no una
   * transición que el cliente pida. Estas dos funciones siguen diciendo lo mismo
   * que antes: no se cierra un hilo ya cerrado, y `Revertir a abierto` sigue
   * siendo solo para un acuerdo alcanzado. **Lo que se movió está en MSG-02 —el
   * campo de mensaje ya no desaparece— y en el trigger, no aquí.**
   */
  it('un hilo cerrado no se revierte a mano: lo reabre escribir, no un botón', () => {
    expect(canRevertAgreement('CERRADO SIN ACUERDO')).toBe(false);
    expect(canCloseThread('CERRADO SIN ACUERDO')).toBe(false);
  });
});
