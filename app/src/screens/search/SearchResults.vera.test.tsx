import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchResults } from './SearchResults';
import { EMPTY_CRITERIA, type SearchCriteria, type SearchPage } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * El cableado VERA↔chips del día 9.
 *
 * **Fichero aparte a propósito:** `SearchResults.test.tsx` es el contrato de
 * aceptación contra el que se midió al Coder el día 6, y no se toca — si se
 * ampliara, la medida del objetivo 4 dejaría de significar lo que dice.
 *
 * Lo que se prueba aquí es la costura nueva: VERA escribe **criterios**, y los
 * chips salen de ellos. `search.ts:154` lo dejó dicho hace tres días — si los
 * chips fueran su propio estado habría dos verdades sobre qué se filtra.
 */

const fetchResults = vi.fn();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchResults: (...a: unknown[]) => fetchResults(...a),
}));

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

const NOW = new Date('2026-08-13T10:00:00Z');

const PAGINA: SearchPage = {
  rows: [
    {
      id: 'line-1',
      partNumber: '6205-2RS',
      brand: 'SKF',
      quantity: 1200,
      leadTimeDays: 5,
      orgId: 'org-nsk',
      orgName: 'NSK Europe Ltd',
      country: 'DE',
      lastUploadAt: '2026-08-11T10:00:00Z',
      favoriteCount: 3,
      isFavorite: false,
      consulted: false,
    },
  ],
  total: 1,
  capped: false,
};

beforeEach(() => {
  fetchResults.mockReset();
  fetchResults.mockResolvedValue(PAGINA);
});

function criterios(p: Partial<SearchCriteria>): SearchCriteria {
  return { ...EMPTY_CRITERIA, ...p };
}

describe('SRCH-01 recibe criterios de VERA', () => {
  /**
   * Ancla del comportamiento del día 6: sin VERA, la pantalla arranca igual que
   * siempre. Va primero para que el resto de asertos signifiquen algo.
   */
  it('sin criterios de VERA arranca sin ningún chip', async () => {
    render(<SearchResults profile={PERFIL} now={NOW} />);
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
    expect(screen.queryByLabelText(/^Quitar filtro/)).not.toBeInTheDocument();
  });

  it('los criterios que escribe VERA se pintan como chips', async () => {
    render(
      <SearchResults
        profile={PERFIL}
        now={NOW}
        veraCriteria={criterios({ partNumber: '6205-2RS', zone: 'EU' })}
      />,
    );

    expect(await screen.findByText('6205-2RS')).toBeInTheDocument();
    expect(screen.getByText('Europa')).toBeInTheDocument();
    expect(screen.getByLabelText('Quitar filtro Ref')).toBeInTheDocument();
  });

  it('y la consulta sale con ellos, no con los criterios vacíos', async () => {
    render(
      <SearchResults
        profile={PERFIL}
        now={NOW}
        veraCriteria={criterios({ partNumber: '6205-2RS', minQuantity: 500 })}
      />,
    );

    await waitFor(() => {
      const ultima = fetchResults.mock.calls[fetchResults.mock.calls.length - 1] as [
        { criteria: SearchCriteria },
      ];
      expect(ultima[0].criteria.partNumber).toBe('6205-2RS');
      expect(ultima[0].criteria.minQuantity).toBe(500);
    });
  });

  /**
   * Manda el usuario. Si VERA pusiera un filtro que no se puede quitar, el chip
   * dejaría de ser un control y pasaría a ser una decoración.
   */
  it('el usuario puede quitar un chip que puso VERA', async () => {
    const user = userEvent.setup();
    render(
      <SearchResults
        profile={PERFIL}
        now={NOW}
        veraCriteria={criterios({ partNumber: '6205-2RS' })}
      />,
    );

    await screen.findByLabelText('Quitar filtro Ref');
    await user.click(screen.getByLabelText('Quitar filtro Ref'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Quitar filtro Ref')).not.toBeInTheDocument();
    });
  });

  /**
   * Dos búsquedas seguidas de VERA sobre la misma pantalla: la segunda tiene que
   * sustituir a la primera, no acumularse encima.
   */
  it('una búsqueda nueva de VERA sustituye a la anterior', async () => {
    const { rerender } = render(
      <SearchResults profile={PERFIL} now={NOW} veraCriteria={criterios({ partNumber: '6205-2RS' })} />,
    );
    await screen.findByText('6205-2RS');

    rerender(
      <SearchResults profile={PERFIL} now={NOW} veraCriteria={criterios({ brand: 'SKF' })} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Quitar filtro Marca')).toBeInTheDocument();
      expect(screen.queryByLabelText('Quitar filtro Ref')).not.toBeInTheDocument();
    });
  });
});
