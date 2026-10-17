import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `messaging-and-negotiation/thread-lifecycle#5` · reversion de acuerdo alcanzado (mitad de cliente).
 *
 *   GIVEN un hilo en ACUERDO ALCANZADO
 *   WHEN  cualquiera de las dos partes solicita revertir el acuerdo
 *   THEN  el hilo transiciona de vuelta a ABIERTO
 *   AND   la reversion esta siempre disponible, sin restricciones ni periodo de gracia
 *
 * Aqui: lo que pide el cliente (escribir SOLO `threads.state = 'ABIERTO'` sobre ese hilo) y que la
 * disponibilidad no depende del tiempo transcurrido. La transicion real en la base es SQL.
 * Escrito por Claude Code; no es contrato del arnes.
 */

interface Llamada {
  tabla: string;
  metodo: string;
  args: unknown[];
}
let llamadas: Llamada[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      const api: Record<string, unknown> = {};
      for (const metodo of ['update', 'eq']) {
        api[metodo] = (...args: unknown[]) => {
          llamadas.push({ tabla, metodo, args });
          return api;
        };
      }
      api.then = (res: (v: unknown) => void) => res({ data: null, error: null });
      return api;
    },
  },
}));

import { canRevertAgreement, revertAgreement } from './offers';

beforeEach(() => {
  llamadas = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe('messaging-and-negotiation/thread-lifecycle', () => {
  it('messaging-and-negotiation/thread-lifecycle#5 · revertir escribe solo threads.state=ABIERTO sobre ese hilo, y esta disponible en ACUERDO ALCANZADO sea cuando sea', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-01-01T00:00:00Z')); // años despues del acuerdo: no hay periodo de gracia

    expect(canRevertAgreement('ACUERDO ALCANZADO')).toBe(true);
    for (const otro of ['ABIERTO', 'CON CONSULTA PENDIENTE', 'CON OFERTA PENDIENTE', 'CERRADO SIN ACUERDO'] as const) {
      expect(canRevertAgreement(otro)).toBe(false); // solo tiene sentido desde el acuerdo
    }

    await revertAgreement('hilo-7');
    expect(llamadas).toEqual([
      { tabla: 'threads', metodo: 'update', args: [{ state: 'ABIERTO' }] },
      { tabla: 'threads', metodo: 'eq', args: ['id', 'hilo-7'] },
    ]);
  });
});
