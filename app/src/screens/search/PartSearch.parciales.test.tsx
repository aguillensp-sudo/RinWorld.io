import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffersPage, OffersQuery, PartKeysPage, PartSearchCriteria } from '../../lib/part-search';
import type { SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * PARCIALES · conversational-search, pantalla SRCH-01 en dos fases. Los escenarios de la spec cerrada
 * (`openspec/specs/conversational-search/spec.md`) que la matriz (`openspec/v1/trazabilidad.csv`) prueba aquí.
 * Vienen de `SearchResults.parciales.test.tsx`, retirado el 25-oct-2026 con la pantalla vieja
 * (`amend-srch01-busqueda-en-dos-fases`, tarea 5.3): mismo GIVEN/WHEN/THEN sobre la pantalla nueva.
 *
 * Solo se mockea la red (`fetchPartKeys`, `fetchOffers`, `toggleFavorite`). Escrito por Claude Code.
 */

const fetchPartKeys = vi.fn<(c: PartSearchCriteria, page?: number) => Promise<PartKeysPage>>();
const fetchOffers = vi.fn<(q: OffersQuery) => Promise<OffersPage>>();
const toggleFavorite = vi.fn<(m: string, o: string, n: boolean) => Promise<void>>();

vi.mock('../../lib/part-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/part-search')>()),
  fetchPartKeys: (c: PartSearchCriteria, page?: number) => fetchPartKeys(c, page),
  fetchOffers: (q: OffersQuery) => fetchOffers(q),
}));
vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
}));

const { PartSearch } = await import('./PartSearch');

const NOW = new Date('2026-10-16T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

const profile: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Alpha Rodamientos',
  orgCountry: 'ES',
  orgContinent: 'EU',
};

function fila(id: string, over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id,
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 500,
    leadTimeDays: 3,
    orgId: `org-${id}`,
    orgName: `Distribuidora ${id}`,
    country: 'DE',
    lastUploadAt: hace(1),
    favoriteCount: 1,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}
const pagina = (rows: SearchResultRow[]): OffersPage => ({ rows, total: rows.length, page: 1, pageCount: 1 });

const LISTA: PartKeysPage = {
  keys: [{ key: '62052RS', offers: 3 }],
  totalKeys: 1,
  totalOffers: 3,
  matchedRef: '62052RS',
  truncated: false,
  page: 1,
  pageCount: 1,
};

beforeEach(() => {
  fetchPartKeys.mockReset().mockResolvedValue(LISTA);
  fetchOffers.mockReset().mockResolvedValue(pagina([fila('a')]));
  toggleFavorite.mockReset().mockResolvedValue();
});

const filas = () => screen.getAllByRole('row').slice(1);
const empresas = () => filas().map((f) => within(f).getByText(/^Distribuidora /).textContent);

describe('conversational-search/single-reference-search', () => {
  /*
   * Escenario «refinamiento en sesión activa» (#2)
   *   GIVEN un miembro que ha ejecutado una búsqueda y SRCH-01 está visible
   *   WHEN  modifica un chip de filtro directamente en la UI (o pide a VERA un refinamiento)
   *   THEN  el sistema actualiza los resultados manteniendo el contexto de la sesión
   *   AND   el usuario no necesita repetir los filtros anteriores
   */
  it('conversational-search/single-reference-search#2 · un filtro nuevo se suma a los ya puestos: no hay que repetirlos', async () => {
    const puestos: PartSearchCriteria = {
      ref: '6205',
      contains: false,
      brand: '',
      minQuantity: 200,
      include: '',
      exclude: '',
      area: { kind: 'country', country: 'DE' },
    };
    const alCambiar = vi.fn<(c: PartSearchCriteria) => void>();
    render(<PartSearch profile={profile} now={NOW} veraCriteria={puestos} onCriteriaChange={alCambiar} />);

    // GIVEN: la búsqueda ya se ejecutó con los tres filtros
    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalledWith(puestos, 1));
    fetchPartKeys.mockClear();

    // WHEN: el usuario pone UN filtro nuevo (marca) y vuelve a buscar
    await userEvent.click(screen.getByLabelText('Filtros'));
    await userEvent.type(screen.getByLabelText('Marca'), 'FAG');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar referencia' }));

    // THEN: la nueva búsqueda lleva el filtro nuevo Y los tres anteriores
    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalledTimes(1));
    expect(fetchPartKeys.mock.calls[0]![0]).toEqual({ ...puestos, brand: 'FAG' });
    // y la pantalla enseña la lista de esa búsqueda
    expect(await screen.findByRole('list', { name: 'Referencias encontradas' })).toBeInTheDocument();
    // AND: los criterios acumulados salen hacia fuera, que es lo que VERA recibe en su siguiente pregunta
    expect(alCambiar.mock.calls.at(-1)![0]).toEqual({ ...puestos, brand: 'FAG' });
  });

  it('conversational-search/single-reference-search#2 · quitar un chip conserva los demás y vuelve a buscar', async () => {
    const puestos: PartSearchCriteria = {
      ref: '6205',
      contains: false,
      brand: 'SKF',
      minQuantity: null,
      include: '',
      exclude: '',
      area: { kind: 'country', country: 'DE' },
    };
    render(<PartSearch profile={profile} now={NOW} veraCriteria={puestos} />);
    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalled());
    fetchPartKeys.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Marca' }));

    await waitFor(() => expect(fetchPartKeys).toHaveBeenCalledTimes(1));
    expect(fetchPartKeys.mock.calls[0]![0]).toEqual({ ...puestos, brand: '' });
  });
});

describe('conversational-search/favorites-system', () => {
  /*
   * Escenario «marcar favorito» (#1)
   *   GIVEN un miembro en SRCH-01 que pulsa el indicador de favoritos de una fila
   *   WHEN  ejecuta la acción
   *   THEN  la organización distribuidora queda marcada como favorita
   *   AND   el recuento de favoritos en esa fila se incrementa
   *   AND   la posición de esa fila en los resultados no cambia
   */
  it('conversational-search/favorites-system#1 · marcar favorito a la última fila incrementa su recuento y la fila no sube ni baja', async () => {
    const A = fila('a', { lastUploadAt: hace(1), favoriteCount: 9, quantity: 900 });
    const B = fila('b', { lastUploadAt: hace(2), favoriteCount: 5, quantity: 700 });
    const C = fila('c', { lastUploadAt: hace(3), favoriteCount: 1, quantity: 100 });
    fetchOffers.mockResolvedValue(pagina([A, B, C]));
    render(<PartSearch profile={profile} now={NOW} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Referencia' }), '6205-2RS');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar referencia' }));
    await userEvent.click(await screen.findByRole('button', { name: /Ver ofertas de todas/ }));
    await waitFor(() => expect(empresas()).toHaveLength(3));
    const antes = empresas();

    // Tras marcar, la base devuelve la misma página con el recuento de C subido a 10: ahora sería
    // el MÁS favorito de todos, y aun así no puede cambiar de sitio.
    fetchOffers.mockResolvedValue(pagina([A, B, { ...C, favoriteCount: 10, isFavorite: true }]));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar favorito de Distribuidora c' }));
    // (Cambio del PO, 24-oct-2026: marcar pide confirmación; el clic en la estrella solo abre el diálogo.)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Añadir a favoritos' }));

    // THEN: la acción se hizo sobre esa organización...
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('member-alpha', 'org-c', true));
    // ...queda marcada...
    const botonC = await screen.findByRole('button', { name: 'Quitar favorito de Distribuidora c' });
    expect(botonC).toHaveAttribute('aria-pressed', 'true');
    // ...el recuento de su fila sube...
    expect(within(botonC.closest('tr')!).getByText('10')).toBeInTheDocument();
    // ...y nada se mueve
    expect(empresas()).toEqual(antes);
    expect(empresas()).toEqual(['Distribuidora a', 'Distribuidora b', 'Distribuidora c']);
  });
});
