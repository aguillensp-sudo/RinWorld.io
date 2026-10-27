import { describe, expect, it } from 'vitest';
import { toFavoriteRows } from './favorites';

describe('toFavoriteRows', () => {
  const raw = (id: string, at: string, org: { name: string; country: string } | null) => ({
    distributor_org_id: id,
    created_at: at,
    organizations: org,
  });

  it('ordena la última marcada primero y, a igualdad, por nombre', () => {
    const rows = toFavoriteRows([
      raw('a', '2026-10-01T00:00:00Z', { name: 'Zeta', country: 'ES' }),
      raw('b', '2026-10-05T00:00:00Z', { name: 'Beta', country: 'DE' }),
      raw('c', '2026-10-05T00:00:00Z', { name: 'Alfa', country: 'TR' }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Alfa', 'Beta', 'Zeta']);
  });

  it('salta las organizaciones que ya no se pueden leer (sin ficha a la que llevar)', () => {
    const rows = toFavoriteRows([raw('a', '2026-10-01T00:00:00Z', null), raw('b', '2026-10-02T00:00:00Z', { name: 'B', country: 'ES' })]);
    expect(rows.map((r) => r.orgId)).toEqual(['b']);
  });
});
