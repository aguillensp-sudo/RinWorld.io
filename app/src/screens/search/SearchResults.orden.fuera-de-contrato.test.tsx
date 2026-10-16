import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { EMPTY_CRITERIA, type SearchPage, type SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · SRCH-01 ordena por defecto lo más reciente arriba (PO, 16-oct-2026). Escrito a mano.
 *
 * La spec §3 decía «cantidad disponible descendente» y el contrato de aceptación (`SearchResults.test.tsx`)
 * lo fija así; no se toca (`F-116`) y sigue en verde porque sus filas tienen la misma fecha. La decisión nueva
 * vive aquí, con filas que se distinguen: la más reciente tiene MENOS stock.
 */

const fetchResults = vi.fn();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchResults: (...a: unknown[]) => fetchResults(...a),
}));

const { SearchResults } = await import('./SearchResults');

const PERFIL: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.io',
  fullName: 'Alpha Uno',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Alpha Rodamientos',
  orgCountry: 'ES',
};

const NOW = new Date('2026-10-16T10:00:00Z');

function fila(id: string, partNumber: string, quantity: number, lastUploadAt: string): SearchResultRow {
  return {
    id,
    partNumber,
    brand: 'SKF',
    quantity,
    leadTimeDays: 5,
    orgId: `org-${id}`,
    orgName: `Proveedor ${id}`,
    country: 'DE',
    lastUploadAt,
    favoriteCount: 0,
    isFavorite: false,
    consulted: false,
  };
}

beforeEach(() => {
  fetchResults.mockReset();
  const page: SearchPage = {
    rows: [
      fila('a', 'MUCHO-VIEJO', 5000, '2026-09-01T10:00:00Z'),
      fila('b', 'POCO-NUEVO', 10, '2026-10-15T10:00:00Z'),
      fila('c', 'MEDIO', 300, '2026-10-01T10:00:00Z'),
    ],
    total: 3,
    capped: false,
  };
  fetchResults.mockResolvedValue(page);
});

describe('SRCH-01 · orden por defecto', () => {
  it('sin tocar ninguna cabecera, lo más reciente arriba aunque tenga menos stock', async () => {
    render(<SearchResults profile={PERFIL} now={NOW} veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '6204' }} />);

    await waitFor(() => expect(screen.getByText('POCO-NUEVO')).toBeInTheDocument());
    const filas = screen.getAllByRole('row').slice(1);
    expect(within(filas[0]!).getByText('POCO-NUEVO')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('MEDIO')).toBeInTheDocument();
    expect(within(filas[2]!).getByText('MUCHO-VIEJO')).toBeInTheDocument();
  });

  it('pide a la base el corte por lo más reciente (sin «orden» = reciente)', async () => {
    render(<SearchResults profile={PERFIL} now={NOW} veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '6204' }} />);
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
    expect(fetchResults.mock.calls.every(([q]) => (q as { orden?: string }).orden !== 'cantidad')).toBe(true);
  });
});
