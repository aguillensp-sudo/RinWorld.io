import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffersPage, OffersQuery, PartKeysPage, PartSearchCriteria } from '../../lib/part-search';
import type { SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * SRCH-01 · búsqueda en dos fases, pantalla (`amend-srch01-busqueda-en-dos-fases`).
 *
 * Se mockean solo las dos funciones que tocan red (`fetchPartKeys`, `fetchOffers`). La lógica pura de
 * `part-search.ts` (chips, normalización, zona) es la de verdad. Lo que la base filtra o deja de filtrar lo
 * prueban `supabase/tests/11_busqueda_dos_fases.sql` (como miembro, bajo RLS) y, contra la base real, el e2e.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

const fetchPartKeys = vi.fn<(c: PartSearchCriteria, page?: number) => Promise<PartKeysPage>>();
const fetchOffers = vi.fn<(q: OffersQuery) => Promise<OffersPage>>();

vi.mock('../../lib/part-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/part-search')>()),
  fetchPartKeys: (c: PartSearchCriteria, page?: number) => fetchPartKeys(c, page),
  fetchOffers: (q: OffersQuery) => fetchOffers(q),
}));

const { PartSearch } = await import('./PartSearch');

const NOW = new Date('2026-10-25T12:00:00Z');

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
  orgContinent: 'EU',
};

function keys(over: Partial<PartKeysPage> = {}): PartKeysPage {
  return {
    keys: [
      { key: '62042RS', offers: 11 },
      { key: '6204', offers: 8 },
      { key: '6204ZZ', offers: 8 },
      { key: '6204C3', offers: 7 },
      { key: '6204C4', offers: 6 },
    ],
    totalKeys: 5,
    totalOffers: 40,
    matchedRef: '6204',
    truncated: false,
    page: 1,
    pageCount: 1,
    ...over,
  };
}

function row(over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    partNumber: '6204-2RS',
    brand: 'SKF',
    quantity: 850,
    leadTimeDays: 3,
    orgId: 'b2000000-0000-4000-8000-000000000002',
    orgName: 'Nordwälz Lager',
    country: 'DE',
    lastUploadAt: '2026-10-24T12:00:00Z',
    favoriteCount: 12,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

function offers(rows: SearchResultRow[], over: Partial<OffersPage> = {}): OffersPage {
  return { rows, total: rows.length, page: 1, pageCount: 1, ...over };
}

beforeEach(() => {
  fetchPartKeys.mockReset().mockResolvedValue(keys());
  fetchOffers.mockReset().mockResolvedValue(offers([row()]));
});

async function buscar(ref: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('searchbox', { name: 'Referencia' }), ref);
  await user.click(screen.getByRole('button', { name: 'Buscar referencia' }));
  return user;
}

// -----------------------------------------------------------------------------

describe('estado inicial', () => {
  it('no busca nada hasta que se escribe una referencia', () => {
    render(<PartSearch profile={profile} now={NOW} />);
    expect(screen.getByText('Escribe una referencia y pulsa Enter o la lupa.')).toBeInTheDocument();
    expect(fetchPartKeys).not.toHaveBeenCalled();
  });

  it('enseña desde el principio el chip de zona con el continente de la organización', () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const chips = screen.getByLabelText('Filtros activos');
    expect(within(chips).getByText('Europa')).toBeInTheDocument();
  });

  it('sin continente en la sesión, no hay chip de zona', () => {
    const { orgContinent: _sinContinente, ...sinContinente } = profile;
    render(<PartSearch profile={sinContinente} now={NOW} />);
    expect(screen.queryByLabelText('Filtros activos')).not.toBeInTheDocument();
  });

  it('la segunda línea está oculta y aparece con Filtros', async () => {
    const user = userEvent.setup();
    render(<PartSearch profile={profile} now={NOW} />);
    expect(screen.queryByLabelText('Contiene')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Filtros'));
    expect(screen.getByLabelText('Contiene')).not.toBeChecked();
    for (const campo of ['Marca', 'Cantidad ≥', 'Incluir', 'Excluir', 'Zona']) {
      expect(screen.getByLabelText(campo)).toBeInTheDocument();
    }
  });
});

describe('REF obligatoria', () => {
  it('vacía, o vacía al normalizar, no lanza la búsqueda y lo dice', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    await buscar(' -- ');
    expect(screen.getByRole('alert')).toHaveTextContent('La referencia es obligatoria.');
    expect(fetchPartKeys).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------

describe('fase A · lista previa', () => {
  it('busca con la zona por defecto y pinta las claves en el orden de la RPC', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    await buscar('6204');

    expect(fetchPartKeys).toHaveBeenCalledWith(
      expect.objectContaining({ ref: '6204', contains: false, area: { kind: 'zone', zone: 'EU' } }),
      1,
    );
    const grid = await screen.findByRole('list', { name: 'Referencias encontradas' });
    const celdas = within(grid).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent);
    expect(celdas).toEqual(['62042RS11 ofertas', '62048 ofertas', '6204ZZ8 ofertas', '6204C37 ofertas', '6204C46 ofertas']);
    expect(screen.getByText('5 referencias · 40 ofertas')).toBeInTheDocument();
  });

  it('caso 1.3: avisa de con qué cadena se ha buscado', async () => {
    fetchPartKeys.mockResolvedValue(keys({ matchedRef: '62042R', truncated: true }));
    render(<PartSearch profile={profile} now={NOW} />);
    await buscar('6204-2RX');
    expect(await screen.findByText(/No hay ninguna referencia que empiece por «62042RX»/)).toHaveTextContent(
      'Se muestran las que empiezan por «62042R».',
    );
  });

  it('caso 1.4: «No hay coincidencias», watcher deshabilitado y buscar fuera de la zona', async () => {
    fetchPartKeys.mockResolvedValueOnce(keys({ keys: [], totalKeys: 0, totalOffers: 0, matchedRef: null }));
    const user = await (async () => {
      render(<PartSearch profile={profile} now={NOW} />);
      return buscar('XQXQ');
    })();

    expect(await screen.findByText('No hay coincidencias para «XQXQ».')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear watcher/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Buscar en todas las zonas' }));
    expect(fetchPartKeys).toHaveBeenLastCalledWith(expect.objectContaining({ ref: 'XQXQ', area: null }), 1);
  });

  it('quitar un chip después de buscar relanza la búsqueda sin ese filtro', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await screen.findByRole('list', { name: 'Referencias encontradas' });
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Zona' }));
    expect(fetchPartKeys).toHaveBeenLastCalledWith(expect.objectContaining({ area: null }), 1);
  });

  it('el chip de REF no se puede quitar', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    await buscar('6204');
    await screen.findByRole('list', { name: 'Referencias encontradas' });
    expect(screen.queryByRole('button', { name: 'Quitar filtro Ref' })).not.toBeInTheDocument();
  });

  it('los filtros de la segunda línea viajan al buscar, y siguen en los chips al ocultarla', async () => {
    const user = userEvent.setup();
    render(<PartSearch profile={profile} now={NOW} />);
    await user.click(screen.getByLabelText('Filtros'));
    await user.click(screen.getByLabelText('Contiene'));
    await user.type(screen.getByLabelText('Marca'), 'FAG');
    await user.type(screen.getByLabelText('Cantidad ≥'), '5');
    await user.type(screen.getByLabelText('Incluir'), 'C3');
    await user.type(screen.getByLabelText('Excluir'), 'ETVPB');
    await user.selectOptions(screen.getByLabelText('Zona'), 'country:US');
    await buscar('6240');

    expect(fetchPartKeys).toHaveBeenLastCalledWith(
      {
        ref: '6240',
        contains: true,
        brand: 'FAG',
        minQuantity: 5,
        include: 'C3',
        exclude: 'ETVPB',
        area: { kind: 'country', country: 'US' },
      },
      1,
    );

    await user.click(screen.getByLabelText('Filtros'));
    const chips = screen.getByLabelText('Filtros activos');
    expect(within(chips).getByText('FAG')).toBeInTheDocument();
    expect(within(chips).getByText('Estados Unidos')).toBeInTheDocument();
  });

  it('pagina la lista previa', async () => {
    fetchPartKeys.mockResolvedValue(keys({ totalKeys: 130, pageCount: 3 }));
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6');
    await screen.findByText('Página 1 de 3');
    await user.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(fetchPartKeys).toHaveBeenLastCalledWith(expect.objectContaining({ ref: '6' }), 2);
  });
});

// -----------------------------------------------------------------------------

describe('fases B y C · selección y ofertas', () => {
  it('sin nada marcado no se puede ver ofertas de las seleccionadas', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    await buscar('6204');
    expect(await screen.findByRole('button', { name: 'Ver ofertas de las seleccionadas (0)' })).toBeDisabled();
  });

  it('las marcadas a mano: pide sus ofertas por clave y pinta la tabla', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await user.click(await screen.findByRole('checkbox', { name: /62042RS/ }));
    await user.click(screen.getByRole('checkbox', { name: /6204ZZ/ }));
    await user.click(screen.getByRole('button', { name: 'Ver ofertas de las seleccionadas (2)' }));

    await waitFor(() => expect(fetchOffers).toHaveBeenCalled());
    expect(fetchOffers.mock.calls[0]?.[0]).toMatchObject({
      orgId: profile.orgId,
      memberId: profile.id,
      selection: { kind: 'keys', keys: ['62042RS', '6204ZZ'] },
      page: 1,
    });
    expect(await screen.findByText('1 oferta de 2 referencias')).toBeInTheDocument();
    expect(screen.getByText('Nordwälz Lager')).toBeInTheDocument();
  });

  it('«Seleccionar las de esta página» marca todas las de la página', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await user.click(await screen.findByRole('button', { name: 'Seleccionar las de esta página' }));
    expect(screen.getByRole('button', { name: 'Ver ofertas de las seleccionadas (5)' })).toBeEnabled();
  });

  it('«Ver ofertas de todas» manda la cadena con la que se encontró', async () => {
    fetchPartKeys.mockResolvedValue(keys({ matchedRef: '62042R', truncated: true }));
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204-2RX');
    await user.click(await screen.findByRole('button', { name: 'Ver ofertas de todas (5)' }));
    await waitFor(() => expect(fetchOffers).toHaveBeenCalled());
    expect(fetchOffers.mock.calls[0]?.[0].selection).toEqual({ kind: 'all', matchedRef: '62042R' });
  });

  it('volver a la lista previa conserva las casillas marcadas', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await user.click(await screen.findByRole('checkbox', { name: /6204C3/ }));
    await user.click(screen.getByRole('button', { name: 'Ver ofertas de las seleccionadas (1)' }));
    await user.click(await screen.findByRole('button', { name: '‹ Volver a la lista de referencias' }));
    expect(screen.getByRole('checkbox', { name: /6204C3/ })).toBeChecked();
  });

  it('pagina las ofertas en el servidor y avisa de que ordenar por columna es solo de la página', async () => {
    fetchOffers.mockResolvedValue(offers([row()], { total: 120, pageCount: 3 }));
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await user.click(await screen.findByRole('button', { name: 'Ver ofertas de todas (5)' }));
    await screen.findByText('Página 1 de 3');

    await user.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(fetchOffers.mock.lastCall?.[0]).toMatchObject({ page: 2 });

    await user.click(screen.getByRole('button', { name: /Cantidad/ }));
    expect(screen.getByText('El orden por columna se aplica solo a esta página.')).toBeInTheDocument();
  });

  it('una búsqueda nueva olvida la selección de la anterior', async () => {
    render(<PartSearch profile={profile} now={NOW} />);
    const user = await buscar('6204');
    await user.click(await screen.findByRole('checkbox', { name: /6204C3/ }));
    await user.click(screen.getByRole('button', { name: 'Buscar referencia' }));
    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Ver ofertas de las seleccionadas (0)' })).toBeDisabled();
  });
});

// -----------------------------------------------------------------------------

describe('VERA', () => {
  it('lo que busca VERA se adopta y lanza la fase A', async () => {
    const deVera: PartSearchCriteria = {
      ref: '6205-2RS',
      contains: false,
      brand: 'SKF',
      minQuantity: null,
      include: '',
      exclude: '',
      area: { kind: 'zone', zone: 'EU' },
    };
    render(<PartSearch profile={profile} now={NOW} veraCriteria={deVera} />);
    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalledWith(deVera, 1));
    expect(within(screen.getByLabelText('Filtros activos')).getByText('SKF')).toBeInTheDocument();
  });

  it('avisa a VERA de lo que hay en pantalla (F-101, F-258)', async () => {
    const onCriteriaChange = vi.fn();
    render(<PartSearch profile={profile} now={NOW} onCriteriaChange={onCriteriaChange} />);
    await buscar('6204');
    await waitFor(() =>
      expect(onCriteriaChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ref: '6204', area: { kind: 'zone', zone: 'EU' } }),
      ),
    );
  });
});
