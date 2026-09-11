import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  type CountryOption,
  type DirectoryPage,
  type DirectoryQuery,
} from '../../lib/directory';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · DIR-01 · pantalla (`Directory`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no lo ve.
 *
 * Se mockean **solo** las dos funciones de `lib/directory` que tocan red
 * (`fetchOrganizations`, `fetchDirectoryCountries`). El resto del módulo —
 * `DEFAULT_SORT`, `EMPTY_FILTERS`, `hasActiveFilters`, `nextSort`, `toDirectoryRow`,
 * `pageCountFor`, `clampPage`— sigue siendo el de verdad: mockearlo convertiría
 * esto en una comprobación de los mocks, no de la pantalla.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/directory.spec.ts`:
 * que el filtro de estado sea de verdad `status = 'APPROVED'` contra RLS (una
 * organización propia en `PENDING_REVIEW` viéndose a sí misma en el directorio
 * público no falla nada aquí, porque el mock de `fetchOrganizations` no aplica
 * ningún filtro real) y que las opciones de país vengan de la base, no de una
 * lista de ~250 códigos ISO inventada.
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
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

const COUNTRIES: CountryOption[] = [
  { code: 'DE', label: 'Alemania' },
  { code: 'ES', label: 'España' },
  { code: 'FR', label: 'Francia' },
];

function page(over: Partial<DirectoryPage> = {}): DirectoryPage {
  return {
    rows: [
      {
        id: 'a1000000-0000-4000-8000-000000000001',
        name: 'Rodamientos Ibéricos',
        country: 'ES',
        countryLabel: 'España',
        phone: '+34 954 123 456',
        email: 'info@rodamientosibericos.es',
        favoriteCount: 5,
      },
      {
        id: 'b2000000-0000-4000-8000-000000000002',
        name: 'Nordwälz Lager',
        country: 'DE',
        countryLabel: 'Alemania',
        phone: '+49 7161 44 22 10',
        email: 'kontakt@nordwaelz.de',
        favoriteCount: 12,
      },
    ],
    total: 2,
    page: 1,
    pageCount: 1,
    ...over,
  };
}

beforeEach(() => {
  fetchOrganizations.mockReset().mockResolvedValue(page());
  fetchDirectoryCountries.mockReset().mockResolvedValue(COUNTRIES);
});

describe('Directory', () => {
  it('pinta el eyebrow, el título y el subtítulo literales de la spec §3', async () => {
    render(<Directory profile={profile} />);
    expect(screen.getByText('Directorio de Organizaciones')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Empresas' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Todas las organizaciones activas en Bearingworld.io. Los datos de contacto son públicos para todos los miembros.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
  });

  it('al montar, pide la página 1 con el orden por defecto (Nombre asc) y sin filtros', async () => {
    render(<Directory profile={profile} />);
    await waitFor(() =>
      expect(fetchOrganizations).toHaveBeenCalledWith({
        filters: EMPTY_FILTERS,
        sort: DEFAULT_SORT,
        page: 1,
      }),
    );
  });

  it('mientras carga, la zona de la tabla lleva `aria-busy` y no hace falta esperar al montaje para verlo', async () => {
    let resolver: (p: DirectoryPage) => void = () => {};
    fetchOrganizations.mockReset().mockReturnValue(new Promise((r) => (resolver = r)));
    render(<Directory profile={profile} />);
    expect(screen.getByText('Cargando directorio…')).toBeInTheDocument();
    resolver(page());
    await waitFor(() => expect(screen.queryByText('Cargando directorio…')).not.toBeInTheDocument());
  });

  it('el desplegable de país ofrece las opciones que hay -no una lista de ~250 códigos-, con "Todos los países" primero', async () => {
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchDirectoryCountries).toHaveBeenCalled());
    const select = await screen.findByRole('combobox', { name: 'País' });
    const opciones = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opciones).toEqual(['Todos los países', 'Alemania', 'España', 'Francia']);
  });

  it('si fallan los países, el directorio sigue funcionando -el desplegable se queda solo con "Todos los países"-', async () => {
    fetchDirectoryCountries.mockReset().mockRejectedValue(new Error('network down'));
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalled());
    const select = await screen.findByRole('combobox', { name: 'País' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos los países']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('escribir en el buscador NO dispara consulta -no es live search-; Enter sí, y no borra el país', async () => {
    const user = userEvent.setup();
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(1));

    await user.selectOptions(await screen.findByRole('combobox', { name: 'País' }), 'DE');
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2));

    const input = screen.getByPlaceholderText('Buscar organización...');
    await user.type(input, 'Nordwälz');
    expect(fetchOrganizations).toHaveBeenCalledTimes(2); // seguir escribiendo no pide nada

    await user.type(input, '{Enter}');
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(3));
    expect(fetchOrganizations).toHaveBeenLastCalledWith({
      filters: { country: 'DE', name: 'Nordwälz' },
      sort: DEFAULT_SORT,
      page: 1,
    });
  });

  it('el icono de lupa dispara la misma búsqueda que Enter', async () => {
    const user = userEvent.setup();
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(1));

    await user.type(screen.getByPlaceholderText('Buscar organización...'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Buscar organización' }));
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2));
    expect(fetchOrganizations).toHaveBeenLastCalledWith({
      filters: { country: '', name: 'Acme' },
      sort: DEFAULT_SORT,
      page: 1,
    });
  });

  it('"Limpiar filtros" está oculto sin filtros activos, aparece con uno aplicado, y al pulsarlo limpia los dos y repide', async () => {
    const user = userEvent.setup();
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    await user.selectOptions(await screen.findByRole('combobox', { name: 'País' }), 'DE');
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2));
    const limpiar = await screen.findByRole('button', { name: 'Limpiar filtros' });

    await user.click(limpiar);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(3));
    expect(fetchOrganizations).toHaveBeenLastCalledWith({ filters: EMPTY_FILTERS, sort: DEFAULT_SORT, page: 1 });
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar organización...')).toHaveValue('');
  });

  it('pulsar la cabecera "País" ordena por esa columna y vuelve a la página 1', async () => {
    const user = userEvent.setup();
    fetchOrganizations.mockReset().mockResolvedValue(page({ total: 120, page: 3, pageCount: 3 }));
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: 'País' }));
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(3));
    expect(fetchOrganizations).toHaveBeenLastCalledWith({
      filters: EMPTY_FILTERS,
      sort: { field: 'country', ascending: true },
      page: 1,
    });
  });

  it('la paginación pide la página siguiente/anterior y muestra el recuento y la posición', async () => {
    const user = userEvent.setup();
    fetchOrganizations.mockReset().mockResolvedValue(page({ total: 120, page: 1, pageCount: 3 }));
    render(<Directory profile={profile} />);
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(1));

    expect(screen.getByText('120 organizaciones · pág. 1/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() =>
      expect(fetchOrganizations).toHaveBeenLastCalledWith({ filters: EMPTY_FILTERS, sort: DEFAULT_SORT, page: 2 }),
    );
  });

  it('el estado de error se pinta en `role="alert"` con el mensaje del rechazo', async () => {
    fetchOrganizations.mockReset().mockRejectedValue(new Error('la base no responde'));
    render(<Directory profile={profile} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('la base no responde');
  });

  it('un solo resultado dice "organización" en singular', async () => {
    fetchOrganizations.mockReset().mockResolvedValue(page({ rows: [page().rows[0]!], total: 1, pageCount: 1 }));
    render(<Directory profile={profile} />);
    expect(await screen.findByText('1 organización · pág. 1/1')).toBeInTheDocument();
  });
});
