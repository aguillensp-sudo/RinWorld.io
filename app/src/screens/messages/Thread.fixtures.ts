import type { MemberProfile } from '../../lib/session';
import type { ThreadState } from '../../lib/threads';
import type { ThreadDetail, ThreadItem } from '../../lib/thread-detail';

/**
 * Datos de prueba de MSG-02, compartidos por `Thread.test.tsx` —el contrato de
 * aceptación que mide el arnés— y `Thread.fuera-de-contrato.test.tsx`.
 *
 * Aquí vive **solo lo puro**: ni `vi.mock` ni `render`. Ver la nota de
 * `Messages.fixtures.ts` para el porqué (`B-011`).
 */

export const NOW = new Date('2026-08-11T12:00:00Z');
export const HILO = 't1000000-0000-4000-8000-000000000001';
export const SUYA = 'b2000000-0000-4000-8000-000000000002';

export const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Juan Martínez',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

export function detail(state: ThreadState = 'CON OFERTA PENDIENTE'): ThreadDetail {
  return {
    id: HILO,
    counterpartyId: SUYA,
    counterpartyName: 'NSK Europe Ltd',
    counterpartyCountry: 'DE',
    state,
  };
}

export const ofertaRecibida: ThreadItem = {
  id: 'of-1',
  type: 'OFERTA',
  senderOrgId: SUYA,
  isOwn: false,
  createdAt: '2026-08-11T10:00:00Z',
  partNumber: '6205-2RS',
  brand: 'NSK',
  offerState: 'Pendiente',
  inquiryState: null,
  respondsToItemId: null,
  supersededByItemId: null,
  content: null,
  raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
};

export const ofertaConContenido: ThreadItem = {
  ...ofertaRecibida,
  content: {
    kind: 'OFERTA',
    unitPrice: 2.1,
    currency: 'EUR',
    quantity: 500,
    leadTimeDays: 14,
    shippingCost: null,
    shippingCostCurrency: null,
    validUntil: null,
    notes: null,
  },
};
