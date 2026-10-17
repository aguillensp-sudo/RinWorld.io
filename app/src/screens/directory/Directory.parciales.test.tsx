import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CountryOption, DirectoryPage, DirectoryQuery, DirectoryRow } from '../../lib/directory';
import type { MemberProfile } from '../../lib/session';

/**
 * PARCIALES · organization-directory/directory-sorting#2
 *
 * GIVEN un miembro que pulsa el header de la columna Favoritos
 * WHEN se aplica el nuevo criterio de orden
 * THEN la tabla se reordena por esa columna
 * AND el usuario puede volver a pulsar para invertir el sentido del orden
 *
 * El `fetchOrganizations` falso ORDENA las filas según el `sort` que recibe: lo
 * que se comprueba es el orden de las filas que pinta la tabla, no solo el
 * parámetro.
 */

const fila = (id: string, name: string, favoriteCount: number): DirectoryRow => ({
  id,
  name,
  country: 'ES',
  countryLabel: 'España',
  phone: '',
  email: '',
  favoriteCount,
});
const FILAS = [fila('a', 'Alfa', 9), fila('b', 'Beta', 2), fila('c', 'Gamma', 5)];

const fetchOrganizations = vi.fn<(q: DirectoryQuery) => Promise<DirectoryPage>>();
const fetchDirectoryCountries = vi.fn<() => Promise<CountryOption[]>>();

vi.mock('../../lib/directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/directory')>()),
  fetchOrganizations: (q: DirectoryQuery) => fetchOrganizations(q),
  fetchDirectoryCountries: () => fetchDirectoryCountries(),
}));

const { Directory } = await import('./Directory');

const profile: MemberProfile = {
  id: 'm1',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'o1',
  orgName: 'Alfa',
  orgCountry: 'ES',
};

beforeEach(() => {
  fetchDirectoryCountries.mockReset().mockResolvedValue([]);
  fetchOrganizations.mockReset().mockImplementation(async ({ sort }) => {
    const rows = [...FILAS].sort((x, y) => {
      const c =
        sort.field === 'favorite_count' ? x.favoriteCount - y.favoriteCount : x.name.localeCompare(y.name);
      return sort.ascending ? c : -c;
    });
    return { rows, total: rows.length, page: 1, pageCount: 1 };
  });
});

function nombresEnTabla(): string[] {
  const tbody = screen.getAllByRole('rowgroup')[1]!;
  return within(tbody)
    .getAllByRole('row')
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('Directory (parciales)', () => {
  it('organization-directory/directory-sorting#2 · pulsar la cabecera Favoritos reordena las filas y pulsarla otra vez las invierte', async () => {
    const user = userEvent.setup();
    render(<Directory profile={profile} />);
    await waitFor(() => expect(nombresEnTabla()).toEqual(['Alfa', 'Beta', 'Gamma']));

    await user.click(screen.getByRole('button', { name: 'Favoritos' }));
    await waitFor(() => expect(nombresEnTabla()).toEqual(['Beta', 'Gamma', 'Alfa']));
    expect(fetchOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { field: 'favorite_count', ascending: true } }),
    );
    expect(screen.getByRole('columnheader', { name: 'Favoritos' })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: 'Favoritos' }));
    await waitFor(() => expect(nombresEnTabla()).toEqual(['Alfa', 'Gamma', 'Beta']));
    expect(screen.getByRole('columnheader', { name: 'Favoritos' })).toHaveAttribute('aria-sort', 'descending');
  });
});
