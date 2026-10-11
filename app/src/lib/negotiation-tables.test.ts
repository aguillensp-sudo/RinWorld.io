import { describe, expect, it } from 'vitest';
import type { OfferContent, ThreadItem } from './thread-detail';
import { NEGOTIATION_TEXTS as T, inquiryRows, moneyLabel, offerRows, quantityLabel } from './negotiation-tables';

const MIA = 'org-mia';
const SUYA = 'org-suya';
const NOW = new Date('2026-10-11T12:00:00Z');
const CTX = { viewerOrgId: MIA, ownOrgName: 'Rey Transmisiones', counterpartyName: 'Fulano S.A', now: NOW };

function item(over: Partial<ThreadItem>): ThreadItem {
  return {
    id: 'x',
    type: 'CONSULTA',
    senderOrgId: SUYA,
    isOwn: false,
    createdAt: '2026-10-11T07:00:00Z',
    partNumber: '6204',
    brand: 'SKF',
    offerState: null,
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
    ...over,
  };
}

const OFERTA: OfferContent = {
  kind: 'OFERTA',
  unitPrice: 2.1,
  currency: 'EUR',
  quantity: 1247,
  leadTimeDays: 14,
  shippingCost: 45,
  shippingCostCurrency: 'USD',
  validUntil: '2026-12-15T00:00:00.000Z',
  notes: null,
};

describe('negotiation-tables · formato', () => {
  it('cantidad con millares desde cuatro cifras y «ud.»', () => {
    expect(quantityLabel(500)).toBe('500 ud.');
    expect(quantityLabel(1247)).toBe('1.247 ud.');
  });
  it('importe con dos decimales y el ISO detrás', () => {
    expect(moneyLabel(2.1, 'EUR')).toBe('2,10 EUR');
    expect(moneyLabel(0, 'EUR')).toBe('0,00 EUR');
  });
});

describe('negotiation-tables · consultas', () => {
  const recibida = item({
    id: 'q1',
    inquiryState: 'Pendiente',
    locationCountry: 'CU',
    content: { kind: 'CONSULTA', quantity: 10, comment: 'Plazo, por favor' },
  });

  it('solo CONSULTA, con referencia, organización que la envió, país, cantidad y notas', () => {
    const rows = inquiryRows([recibida, item({ id: 'o1', type: 'OFERTA' }), item({ id: 'm1', type: 'MENSAJE' })], CTX);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'q1',
      reference: '6204 · SKF',
      orgId: SUYA,
      orgName: 'Fulano S.A',
      country: 'CU',
      quantity: '10 ud.',
      notes: 'Plazo, por favor',
      encrypted: false,
      badge: { label: 'PENDIENTE', tone: 'pendiente' },
      actions: ['responder', 'sin-stock'],
    });
    expect(rows[0]!.date).toBe('hace 5 h');
  });

  it('quien la envió no tiene acciones; una consulta decidida, tampoco', () => {
    expect(inquiryRows([{ ...recibida, isOwn: true, senderOrgId: MIA }], CTX)[0]!.actions).toEqual([]);
    const respondida = inquiryRows([{ ...recibida, inquiryState: 'Respondida con oferta' }], CTX)[0]!;
    expect(respondida.actions).toEqual([]);
    expect(respondida.badge).toEqual({ label: 'RESPONDIDA', tone: 'respondida' });
    expect(inquiryRows([{ ...recibida, inquiryState: 'Sin stock' }], CTX)[0]!.badge).toEqual({
      label: 'SIN STOCK',
      tone: 'sin-stock',
    });
  });

  it('sin país, sin notas y sin referencia: «—»; sin clave: «Cifrado» en lo cifrado', () => {
    const r = inquiryRows(
      [item({ id: 'q2', partNumber: null, brand: null, content: { kind: 'CONSULTA', quantity: 3, comment: null } })],
      CTX,
    )[0]!;
    expect(r).toMatchObject({ reference: T.none, country: T.none, notes: T.none });
    const c = inquiryRows([item({ id: 'q3', content: null })], CTX)[0]!;
    expect(c).toMatchObject({ quantity: T.encrypted, notes: T.encrypted, encrypted: true });
  });

  it('las más nuevas arriba', () => {
    const rows = inquiryRows(
      [
        item({ id: 'vieja', createdAt: '2026-10-09T00:00:00Z' }),
        item({ id: 'nueva', createdAt: '2026-10-11T00:00:00Z' }),
      ],
      CTX,
    );
    expect(rows.map((r) => r.id)).toEqual(['nueva', 'vieja']);
  });
});

describe('negotiation-tables · ofertas', () => {
  const recibida = item({ id: 'o1', type: 'OFERTA', offerState: 'Pendiente', content: OFERTA });

  it('pinta las cifras formateadas y el transporte en su propia divisa', () => {
    expect(offerRows([recibida], CTX)[0]).toMatchObject({
      reference: '6204 · SKF',
      orgName: 'Fulano S.A',
      price: '2,10 EUR',
      quantity: '1.247 ud.',
      leadTime: '14 días',
      shipping: '45,00 USD',
      validUntil: '15 dic 2026',
      expired: false,
      badge: { label: 'PENDIENTE', tone: 'pendiente' },
      actions: ['aceptar', 'contraofertar', 'rechazar'],
      counterDisabledReason: null,
    });
  });

  it('lo no informado es «—», nunca 0', () => {
    const r = offerRows(
      [{ ...recibida, content: { ...OFERTA, leadTimeDays: null, shippingCost: null, validUntil: null } }],
      CTX,
    )[0]!;
    expect(r).toMatchObject({ leadTime: T.none, shipping: T.none, validUntil: T.none });
  });

  it('solo el receptor decide (offerActions): el emisor no tiene acciones', () => {
    expect(offerRows([{ ...recibida, isOwn: true, senderOrgId: MIA }], CTX)[0]!.actions).toEqual([]);
  });

  it('expirada: EXPIRADA, «Aceptar igualmente» y «Rechazar», sin contraoferta', () => {
    const r = offerRows([{ ...recibida, content: { ...OFERTA, validUntil: '2026-10-01T00:00:00.000Z' } }], CTX)[0]!;
    expect(r.expired).toBe(true);
    expect(r.badge).toEqual({ label: 'EXPIRADA', tone: 'expirada' });
    expect(r.actions).toEqual(['aceptar-igualmente', 'rechazar']);
  });

  it('una oferta terminal no expira ni tiene acciones', () => {
    for (const [state, label] of [
      ['Aceptada', 'ACEPTADA'],
      ['Rechazada', 'RECHAZADA'],
      ['Superada por contraoferta', 'SUPERADA'],
    ] as const) {
      const r = offerRows(
        [{ ...recibida, offerState: state, content: { ...OFERTA, validUntil: '2026-10-01T00:00:00.000Z' } }],
        CTX,
      )[0]!;
      expect(r.badge.label).toBe(label);
      expect(r.expired).toBe(false);
      expect(r.actions).toEqual([]);
    }
  });

  it('sin clave: «Cifrado», no se da por expirada y la contraoferta lleva su motivo', () => {
    const r = offerRows([{ ...recibida, content: null }], CTX)[0]!;
    expect(r).toMatchObject({
      price: T.encrypted,
      quantity: T.encrypted,
      leadTime: T.encrypted,
      shipping: T.encrypted,
      validUntil: T.encrypted,
      encrypted: true,
      expired: false,
      actions: ['aceptar', 'contraofertar', 'rechazar'],
      counterDisabledReason: T.counterDisabledReason,
    });
  });
});
