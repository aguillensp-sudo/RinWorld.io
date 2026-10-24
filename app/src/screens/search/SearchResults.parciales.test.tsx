import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EMPTY_CRITERIA, type SearchCriteria, type SearchPage, type SearchQuery, type SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * PARCIALES · conversational-search (SRCH-01). Escrito desde
 * `openspec/specs/conversational-search/spec.md`, no desde el código. Solo se mockean las dos
 * funciones que tocan la red; chips, criterios, ordenación y tabla son los de verdad.
 */

const fetchResults = vi.fn<(q: SearchQuery) => Promise<SearchPage>>();
const toggleFavorite = vi.fn<(m: string, o: string, n: boolean) => Promise<void>>();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchResults: (q: SearchQuery) => fetchResults(q),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
}));

const { SearchResults } = await import('./SearchResults');

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
const pagina = (rows: SearchResultRow[]): SearchPage => ({ rows, total: rows.length, capped: false });

beforeEach(() => {
  fetchResults.mockReset();
  toggleFavorite.mockReset();
  toggleFavorite.mockResolvedValue();
  fetchResults.mockResolvedValue(pagina([fila('a')]));
});

const filas = () => screen.getAllByRole('row').slice(1);
const empresas = () => filas().map((f) => within(f).getByText(/^Distribuidora /).textContent);

async function añadirFiltro(campo: string, valor: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Añadir filtro' }));
  await userEvent.selectOptions(screen.getByLabelText('Campo'), campo);
  await userEvent.type(screen.getByLabelText('Valor'), valor);
  await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));
}

describe('conversational-search/single-reference-search', () => {
  /*
   * Escenario «refinamiento en sesión activa» (#2)
   *   GIVEN un miembro que ha ejecutado una búsqueda y SRCH-01 está visible
   *   WHEN  modifica un chip de filtro directamente en la UI o pide a VERA un refinamiento
   *   THEN  el sistema actualiza los resultados manteniendo el contexto de la sesión
   *   AND   el usuario no necesita repetir los filtros anteriores
   */
  it('conversational-search/single-reference-search#2 · un chip nuevo se suma a los filtros ya puestos: no hay que repetirlos', async () => {
    const puestos: SearchCriteria = { ...EMPTY_CRITERIA, partNumber: '6205', country: 'DE', minQuantity: 200 };
    const alCambiar = vi.fn<(c: SearchCriteria) => void>();
    render(<SearchResults profile={profile} now={NOW} veraCriteria={puestos} onCriteriaChange={alCambiar} />);

    // GIVEN: la búsqueda ya se ejecutó con los tres filtros
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
    expect(fetchResults.mock.calls.at(-1)![0].criteria).toMatchObject({ partNumber: '6205', country: 'DE', minQuantity: 200 });
    fetchResults.mockClear();
    fetchResults.mockResolvedValue(pagina([fila('b')]));

    // WHEN: el usuario toca UN chip nuevo (marca)
    await añadirFiltro('Marca', 'FAG');

    // THEN: la nueva consulta lleva el nuevo filtro Y los tres anteriores
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    expect(fetchResults.mock.calls[0]![0].criteria).toMatchObject({
      brand: 'FAG',
      partNumber: '6205',
      country: 'DE',
      minQuantity: 200,
    });
    // y la pantalla se actualizó con los resultados nuevos
    await waitFor(() => expect(empresas()).toEqual(['Distribuidora b']));
    // AND: el contexto (criterios acumulados) es lo que se comunica hacia fuera, que es lo que VERA recibe en su siguiente pregunta
    expect(alCambiar.mock.calls.at(-1)![0]).toMatchObject({ brand: 'FAG', partNumber: '6205', country: 'DE', minQuantity: 200 });
  });

  it('conversational-search/single-reference-search#2 · quitar un chip conserva los demás y vuelve a buscar', async () => {
    render(
      <SearchResults
        profile={profile}
        now={NOW}
        veraCriteria={{ ...EMPTY_CRITERIA, partNumber: '6205', brand: 'SKF', country: 'DE' }}
      />,
    );
    await waitFor(() => expect(fetchResults).toHaveBeenCalled());
    fetchResults.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Marca' }));

    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));
    const criterios = fetchResults.mock.calls[0]![0].criteria;
    expect(criterios.brand).toBe('');
    expect(criterios).toMatchObject({ partNumber: '6205', country: 'DE' });
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
    fetchResults.mockResolvedValue(pagina([A, B, C]));
    render(<SearchResults profile={profile} now={NOW} />);
    await waitFor(() => expect(empresas()).toHaveLength(3));
    const antes = empresas();

    // Tras marcar, la base devuelve la misma lista con el recuento de C subido a 10: ahora sería
    // el MÁS favorito de todos, y aun así no puede cambiar de sitio.
    fetchResults.mockResolvedValue(pagina([A, B, { ...C, favoriteCount: 10, isFavorite: true }]));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar favorito de Distribuidora c' }));
    // (Cambio del PO, 24-oct-2026: marcar pide confirmación; el clic en la estrella solo abre el diálogo.)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Añadir a favoritos' }));

    // THEN: la acción se hizo sobre esa organización...
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('member-alpha', 'org-c', true));
    // ...queda marcada...
    const botonC = await screen.findByRole('button', { name: 'Quitar favorito de Distribuidora c' });
    expect(botonC).toHaveAttribute('aria-pressed', 'true');
    // ...el recuento de su fila sube...
    const filaC = botonC.closest('tr')!;
    expect(within(filaC).getByText('10')).toBeInTheDocument();
    // ...y nada se mueve
    expect(empresas()).toEqual(antes);
    expect(empresas()).toEqual(['Distribuidora a', 'Distribuidora b', 'Distribuidora c']);
  });
});
