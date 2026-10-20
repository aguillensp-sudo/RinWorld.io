import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `F-274`: el lote pedía los favoritos del miembro una vez POR REFERENCIA (50 peticiones idénticas en un lote de
 * 50). Ahora se piden una vez por lote. Aquí van de verdad `fetchBatchResults` y `fetchResults`; lo falso es el
 * cliente de Supabase, que cuenta cuántas veces se consulta cada tabla y contesta con una línea de la org «o1».
 */

const consultas: string[] = [];
let favoritosFallan = false;

vi.mock('./supabase', () => {
  const builder = (tabla: string): Record<string, unknown> => {
    consultas.push(tabla);
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'ilike', 'gte', 'lte', 'in', 'range', 'not', 'is', 'order']) b[m] = () => b;
    b.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (tabla === 'favorite_distributors') {
        return Promise.resolve(
          favoritosFallan
            ? { data: null, error: { message: 'favoritos caídos' } }
            : { data: [{ distributor_org_id: 'o1' }], error: null },
        ).then(ok, ko);
      }
      if (tabla === 'inventory_lines') {
        const fila = {
          id: `l-${consultas.length}`,
          part_number: 'X',
          brand: 'SKF',
          quantity: 10,
          lead_time_days: null,
          org_id: 'o1',
          location_country: 'DE',
          last_upload_at: '2026-10-20T00:00:00Z',
          organizations: { id: 'o1', name: 'Uno', country: 'DE', continent: 'EU', favorite_count: 3 },
        };
        return Promise.resolve({ data: [fila], error: null, count: 1 }).then(ok, ko);
      }
      return Promise.resolve({ data: [], error: null }).then(ok, ko);
    };
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

const { fetchBatchResults } = await import('./batch');
const { fetchResults, EMPTY_CRITERIA } = await import('./search');

const cuenta = (t: string) => consultas.filter((c) => c === t).length;

beforeEach(() => {
  consultas.length = 0;
  favoritosFallan = false;
});

describe('F-274 · los favoritos, una vez por lote', () => {
  it('50 referencias: 50 consultas de inventario y UNA de favoritos, y la estrella sale igual en todas', async () => {
    const refs = Array.from({ length: 50 }, (_, i) => `R-${i}`);
    const out = await fetchBatchResults(refs, { orgId: 'yo', memberId: 'm1' });
    expect(cuenta('inventory_lines')).toBe(50);
    expect(cuenta('favorite_distributors')).toBe(1);
    expect(out.every((r) => r.error === null && r.page?.rows[0]?.isFavorite === true)).toBe(true);
  });

  it('si los favoritos fallan, cada referencia lo dice en su tarjeta (como antes), y no hay rechazo suelto', async () => {
    favoritosFallan = true;
    const out = await fetchBatchResults(['A', 'B', 'C'], { orgId: 'yo', memberId: 'm1' });
    expect(out.map((r) => r.page)).toEqual([null, null, null]);
    expect(out.every((r) => typeof r.error === 'string' && r.error.length > 0)).toBe(true);
    expect(cuenta('favorite_distributors')).toBe(1);
  });

  it('sin referencias no pide ni los favoritos', async () => {
    expect(await fetchBatchResults([], { orgId: 'yo', memberId: 'm1' })).toEqual([]);
    expect(consultas).toEqual([]);
  });

  it('CONTROL: una búsqueda suelta (Comprando, VERA) sigue pidiendo sus favoritos ella misma', async () => {
    const page = await fetchResults({ orgId: 'yo', memberId: 'm1', criteria: { ...EMPTY_CRITERIA, partNumber: 'X' } });
    expect(cuenta('favorite_distributors')).toBe(1);
    expect(page.rows[0]?.isFavorite).toBe(true);
  });
});
