import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnreadThread } from './thread-reads';

/**
 * F-027 a · la lista de Hilos lleva cuántos elementos sin leer tiene cada hilo (`0082`). Si no se pudo
 * saber, el hilo no lleva el dato: la lista no afirma «todo leído» sin haberlo mirado. Escrito a mano.
 */

/** Una consulta de supabase-js de mentira: cualquier cadena de filtros acaba en `resultado`. */
function consulta(resultado: { data: unknown; error: unknown; count?: number }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'order', 'range', 'or', 'ilike', 'eq']) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) =>
      tabla === 'threads'
        ? consulta({
            data: [
              { id: 'h1', org_low_id: 'yo', org_high_id: 'b', state: 'ABIERTO', last_item_at: '2026-11-18T10:00:00Z', org_low: { name: 'Yo', country: 'ES' }, org_high: { name: 'Levante', country: 'ES' } },
              { id: 'h2', org_low_id: 'yo', org_high_id: 'c', state: 'ABIERTO', last_item_at: '2026-11-17T10:00:00Z', org_low: { name: 'Yo', country: 'ES' }, org_high: { name: 'Julsa', country: 'ES' } },
            ],
            error: null,
            count: 2,
          })
        : consulta({ data: [], error: null }),
  },
}));

let sinLeer: () => Promise<UnreadThread[]>;
vi.mock('./thread-reads', () => ({ fetchUnreadThreads: () => sinLeer() }));

const { fetchThreadPage } = await import('./threads');

beforeEach(() => {
  sinLeer = async () => [];
});

describe('fetchThreadPage · sin leer (F-027 a)', () => {
  it('cada hilo lleva sus elementos sin leer, y 0 si no tiene ninguno', async () => {
    sinLeer = async () => [
      { threadId: 'h1', counterpartyName: 'Levante', threadState: 'ABIERTO', count: 2, lastUnreadAt: '2026-11-18T10:00:00Z' },
    ];
    const page = await fetchThreadPage({ orgId: 'yo', search: '', page: 1 });
    expect(page.threads.map((t) => [t.id, t.unread])).toEqual([
      ['h1', 2],
      ['h2', 0],
    ]);
  });

  it('si no se puede saber, la lista sale igual y sin el dato', async () => {
    sinLeer = async () => {
      throw new Error('permission denied');
    };
    const page = await fetchThreadPage({ orgId: 'yo', search: '', page: 1 });
    expect(page.threads).toHaveLength(2);
    expect(page.threads.every((t) => !('unread' in t))).toBe(true);
  });
});
