import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchResults } from './SearchResults';
import { EMPTY_CRITERIA, type SearchCriteria, type SearchPage } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · SRCH-01 avisa de sus criterios (`F-101`, 14-oct-2026). Escrito a mano.
 *
 * Ninguna tarea del corpus lo pide: es para que VERA reciba en cada pregunta los filtros que hay de verdad
 * en pantalla, también los que el usuario cambió a mano. Mismo criterio que
 * `SearchResults.vera.fuera-de-contrato.test.tsx` (`F-118`): el sufijo lo saca de la medida del arnés.
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

const NOW = new Date('2026-10-14T10:00:00Z');
const VACIA: SearchPage = { rows: [], total: 0, capped: false };

beforeEach(() => {
  fetchResults.mockReset();
  fetchResults.mockResolvedValue(VACIA);
});

describe('SRCH-01 avisa de los criterios que tiene puestos', () => {
  it('avisa de los que deja VERA', async () => {
    const avisos: SearchCriteria[] = [];
    render(
      <SearchResults
        profile={PERFIL}
        now={NOW}
        veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '6204', zone: 'EU' }}
        onCriteriaChange={(c) => avisos.push(c)}
      />,
    );

    await waitFor(() => expect(avisos.at(-1)).toMatchObject({ partNumber: '6204', zone: 'EU' }));
  });

  it('y de los que quita el usuario a mano, que es lo que VERA no puede saber por la conversación', async () => {
    const avisos: SearchCriteria[] = [];
    render(
      <SearchResults
        profile={PERFIL}
        now={NOW}
        veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '6204', zone: 'EU' }}
        onCriteriaChange={(c) => avisos.push(c)}
      />,
    );
    await waitFor(() => expect(avisos.at(-1)?.zone).toBe('EU'));

    await userEvent.setup().click(await screen.findByLabelText('Quitar filtro Zona'));

    await waitFor(() => expect(avisos.at(-1)).toMatchObject({ partNumber: '6204', zone: null }));
  });

  it('sin el prop, la pantalla es la de siempre', async () => {
    render(<SearchResults profile={PERFIL} now={NOW} />);
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
  });
});
