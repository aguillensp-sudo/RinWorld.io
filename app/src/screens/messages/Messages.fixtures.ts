import type { ThreadPage, ThreadSummary } from '../../lib/threads';
import type { MemberProfile } from '../../lib/session';

/**
 * Datos de prueba de MSG-01, compartidos por `Messages.test.tsx` —el contrato de
 * aceptación que mide el arnés— y `Messages.fuera-de-contrato.test.tsx`.
 *
 * Aquí vive **solo lo puro**: ni `vi.mock` ni `render`. Los mocks se declaran en
 * cada fichero de test porque Vitest los iza por módulo y no se pueden compartir
 * sin volverlos frágiles; los datos sí, y son lo que de verdad se estropea al
 * duplicarse (`B-011`).
 */

export const NOW = new Date('2026-08-08T12:00:00Z');

export const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

export function thread(over: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    counterpartyName: 'Nordwälz Lager',
    counterpartyCountry: 'DE',
    state: 'CON OFERTA PENDIENTE',
    lastItemAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(),
    lastItem: { type: 'OFERTA', partNumber: '6205-2RS', isOwn: false },
    ...over,
  };
}

export function page(threads: ThreadSummary[], total = threads.length): ThreadPage {
  return { threads, total };
}
