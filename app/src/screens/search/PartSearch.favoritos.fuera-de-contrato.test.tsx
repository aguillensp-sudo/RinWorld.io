import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffersPage, OffersQuery, PartKeysPage, PartSearchCriteria } from '../../lib/part-search';
import { quantityLabel, type SearchResultRow } from '../../lib/search';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · SRCH-01 · favoritos con confirmación (PO, 24-oct-2026, `F-280`).
 *
 * Los cuerpos vienen de los tests de `SearchResults.tsx`, retirada el 25-oct-2026 con la búsqueda en dos fases
 * (`amend-srch01-busqueda-en-dos-fases`, tarea 5.3): `PartSearch` copia de ella las acciones de la tabla de ofertas
 * y estos tests las siguen midiendo. Cambia solo la preparación (`pintar` busca y abre la tabla de ofertas) y
 * `fetchResults` es ahora el doble de `fetchOffers`, que es quien lee la tabla. Escrito por Claude Code.
 */

const fetchOffers = vi.fn<(q: OffersQuery) => Promise<OffersPage>>();
const fetchPartKeys = vi.fn<(c: PartSearchCriteria, page?: number) => Promise<PartKeysPage>>();
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

/** Quien lee la tabla de ofertas. Se llama así para que los cuerpos de los tests viejos digan lo mismo que decían. */
const fetchResults = fetchOffers;

const NOW = new Date('2026-08-11T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

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

function row(over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 850,
    leadTimeDays: 3,
    orgId: 'b2000000-0000-4000-8000-000000000002',
    orgName: 'Nordwälz Lager',
    country: 'DE',
    lastUploadAt: hace(1),
    favoriteCount: 12,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

function page(rows: SearchResultRow[], over: Partial<OffersPage> = {}): OffersPage {
  return { rows, total: rows.length, page: 1, pageCount: 1, ...over };
}

beforeEach(() => {
  fetchOffers.mockReset();
  fetchPartKeys.mockReset();
  toggleFavorite.mockReset();
  fetchOffers.mockResolvedValue(page([row()]));
  fetchPartKeys.mockResolvedValue({
    keys: [{ key: '62052RS', offers: 1 }],
    totalKeys: 1,
    totalOffers: 1,
    matchedRef: '62052RS',
    truncated: false,
    page: 1,
    pageCount: 1,
  });
  toggleFavorite.mockResolvedValue();
});

/** Monta SRCH-01, busca una referencia y abre la tabla de ofertas de todas sus claves (fases A y C). */
async function pintar() {
  const r = render(<PartSearch profile={profile} now={NOW} />);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Referencia' }), '6205-2RS');
  await userEvent.click(screen.getByRole('button', { name: 'Buscar referencia' }));
  await userEvent.click(await screen.findByRole('button', { name: /Ver ofertas de todas/ }));
  return r;
}

const filas = () => screen.getAllByRole('row').slice(1);

// -----------------------------------------------------------------------------

describe('SRCH-01 · favoritos', () => {
  /** El diálogo de confirmación (PO, 24-oct-2026): la estrella ya no escribe, abre esto. */
  const dialogo = () => screen.findByRole('dialog');

  it('la estrella NO escribe: abre una confirmación que nombra a la organización', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', orgName: 'Rey Transmisiones', isFavorite: false })]));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));

    expect(within(await dialogo()).getByText('¿Añadir a Rey Transmisiones a tus favoritos?')).toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('Cancelar cierra el diálogo y no escribe nada', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', isFavorite: false })]));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('confirmar marcar avisa a la capa de datos con mi miembro y la distribuidora', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', isFavorite: false })]));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Añadir a favoritos' }));

    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-9', true));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('quitar también pide confirmación, con su propio texto, y pasa false, no vuelve a marcar', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', orgName: 'Rey Transmisiones', isFavorite: true })]));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    // Aquí la fila llega YA marcada, así que el botón está `pressed: true`.
    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: true }));
    expect(toggleFavorite).not.toHaveBeenCalled();

    const d = await dialogo();
    expect(within(d).getByText('¿Quitar a Rey Transmisiones de tus favoritos?')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-9', false));
  });

  it('si la escritura falla, el error se dice dentro del diálogo y la tabla sigue ahí', async () => {
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', isFavorite: false })]));
    toggleFavorite.mockRejectedValueOnce(new Error('boom'));
    await pintar();
    await waitFor(() => expect(filas()).toHaveLength(1));

    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Añadir a favoritos' }));

    expect(await within(await dialogo()).findByRole('alert')).toBeInTheDocument();
    expect(filas()).toHaveLength(1);
  });

  it('el recuento se relee de la base, no se incrementa a ojo', async () => {
    // `organizations.favorite_count` lo mantiene un trigger y es agregado de toda
    // la plataforma: sumarle uno en cliente enseña un número que puede no ser el
    // que hay. Ver la migración 0006.
    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', favoriteCount: 12 })]));
    await pintar();
    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(1));

    fetchResults.mockResolvedValue(page([row({ orgId: 'org-9', favoriteCount: 13, isFavorite: true })]));
    await userEvent.click(within(filas()[0]!).getByRole('button', { pressed: false }));
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Añadir a favoritos' }));

    await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(filas()[0]!).getByText(quantityLabel(13))).toBeInTheDocument());
  });
});
