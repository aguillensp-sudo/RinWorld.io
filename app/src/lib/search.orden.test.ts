import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Qué filas se quedan en la base cuando hay más de 200 (PO, 16-oct-2026). La pantalla pinta lo más reciente
 * arriba (`DEFAULT_SORT`), así que la base tiene que cortar por lo mismo; quien busca el máximo —el resumen de
 * Búsqueda por lotes, VERA— pide `orden: 'cantidad'`. El cliente de Supabase va falso: se mira la consulta.
 */

const ordenes: [string, { ascending: boolean }][][] = [];

vi.mock('./supabase', () => {
  const builder = (): Record<string, unknown> => {
    const llamadas: [string, { ascending: boolean }][] = [];
    ordenes.push(llamadas);
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'ilike', 'gte', 'lte', 'in', 'range', 'not', 'is']) b[m] = () => b;
    b.order = (columna: string, opciones: { ascending: boolean }) => {
      llamadas.push([columna, opciones]);
      return b;
    };
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok);
    return b;
  };
  return { supabase: { from: () => builder() } };
});

const { fetchResults, EMPTY_CRITERIA } = await import('./search');

beforeEach(() => {
  ordenes.length = 0;
});

const pedir = (orden?: 'reciente' | 'cantidad') =>
  fetchResults({ orgId: 'org-a', memberId: 'm-a', criteria: { ...EMPTY_CRITERIA, partNumber: '6204' }, ...(orden ? { orden } : {}) });

describe('fetchResults · por qué orden corta la base', () => {
  it('por defecto, lo más reciente primero (el orden de la pantalla), con desempate por id', async () => {
    await pedir();
    expect(ordenes[0]).toEqual([
      ['last_upload_at', { ascending: false }],
      ['id', { ascending: true }],
    ]);
  });

  it('con orden «cantidad», lo de más stock primero (para el máximo de lotes y para VERA)', async () => {
    await pedir('cantidad');
    expect(ordenes[0]).toEqual([
      ['quantity', { ascending: false }],
      ['id', { ascending: true }],
    ]);
  });
});
