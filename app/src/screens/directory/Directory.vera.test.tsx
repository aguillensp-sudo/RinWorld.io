import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  type CountryOption,
  type DirectoryPage,
  type DirectoryQuery,
} from '../../lib/directory';
import type { MemberProfile } from '../../lib/session';

/**
 * `organization-directory/directory-access-from-vera#1`, lado de la pantalla: cuando VERA deja un país puesto, el
 * Directorio pide al servidor exactamente ese filtro, el desplegable lo enseña, y pedirlo otra vez (objeto
 * nuevo) vuelve a aplicarlo aunque el usuario lo haya cambiado entre medias.
 */

const fetchOrganizations = vi.fn<(q: DirectoryQuery) => Promise<DirectoryPage>>();
const fetchDirectoryCountries = vi.fn<() => Promise<CountryOption[]>>();

vi.mock('../../lib/directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/directory')>()),
  fetchOrganizations: (q: DirectoryQuery) => fetchOrganizations(q),
  fetchDirectoryCountries: () => fetchDirectoryCountries(),
}));

const { Directory } = await import('./Directory');

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Alpha',
  orgCountry: 'ES',
};

const PAGINA: DirectoryPage = { rows: [], total: 0, pageCount: 1, page: 1 } as unknown as DirectoryPage;

beforeEach(() => {
  fetchOrganizations.mockReset();
  fetchOrganizations.mockResolvedValue(PAGINA);
  fetchDirectoryCountries.mockReset();
  fetchDirectoryCountries.mockResolvedValue([
    { code: 'DE', label: 'Alemania' },
    { code: 'PL', label: 'Polonia' },
  ]);
});

const paises = () => fetchOrganizations.mock.calls.map(([q]) => q.filters.country);

describe('Directorio · el país que deja VERA', () => {
  it('ANCLA · sin VERA, la primera consulta no lleva país', async () => {
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    expect(paises()[0]).toBe(EMPTY_FILTERS.country);
  });

  it('con el país de VERA, la PRIMERA consulta ya lo lleva y el desplegable lo enseña', async () => {
    render(<Directory profile={profile} veraView={{ country: 'PL' }} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    expect(paises()[0]).toBe('PL');
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('PL'));
  });

  it('si VERA lo deja con la pantalla ya abierta, vuelve a consultar con ese país y en la página 1', async () => {
    const { rerender } = render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    rerender(<Directory profile={profile} veraView={{ country: 'DE' }} />);
    await waitFor(() => expect(paises()).toContain('DE'));
    const ultima = fetchOrganizations.mock.calls.at(-1)![0];
    expect(ultima.filters.country).toBe('DE');
    expect(ultima.page).toBe(1);
  });

  it('pedir lo mismo otra vez (objeto nuevo) lo reaplica', async () => {
    const { rerender } = render(<Directory profile={profile} veraView={{ country: 'PL' }} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    rerender(<Directory profile={profile} veraView={{ country: 'DE' }} />);
    await waitFor(() => expect(paises().at(-1)).toBe('DE'));
    rerender(<Directory profile={profile} veraView={{ country: 'PL' }} />);
    await waitFor(() => expect(paises().at(-1)).toBe('PL'));
  });

  it('`DEFAULT_SORT` no cambia por culpa del filtro de VERA', async () => {
    render(<Directory profile={profile} veraView={{ country: 'PL' }} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    expect(fetchOrganizations.mock.calls[0]![0].sort).toEqual(DEFAULT_SORT);
  });
});
