import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · INV-01 adopta el filtro que deja VERA (decisión del PO del 14-oct-2026). Escrito a mano.
 *
 * Cuando VERA contesta con una lista de líneas, lleva a Inventario con el mismo filtro y la misma búsqueda
 * con que ha consultado, y contesta en una línea. El contrato de INV-01 (`Inventory.test.tsx`) no se toca
 * (`F-116`); esto vive aquí, como `Inventory.carreras.fuera-de-contrato.test.tsx`.
 */

const fetchPage = vi.fn<(q: PageQuery) => Promise<Page>>();
const fetchStats = vi.fn<() => Promise<Stats>>();

vi.mock('../../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/inventory')>()),
  fetchPage: (q: PageQuery) => fetchPage(q),
  fetchStats: () => fetchStats(),
  archiveLine: () => Promise.resolve(),
  deleteLine: () => Promise.resolve(),
}));

const { Inventory } = await import('./Inventory');

const NOW = new Date('2026-10-14T12:00:00Z');

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

const STATS: Stats = {
  published: 15,
  stale: 3,
  lastUploadAt: NOW.toISOString(),
  visits: null,
  visibilityMode: 'VISIBLE_TODOS',
};

beforeEach(() => {
  fetchPage.mockReset();
  fetchStats.mockReset();
  fetchPage.mockResolvedValue({ lines: [], total: 0 } as unknown as Page);
  fetchStats.mockResolvedValue(STATS);
});

describe('INV-01 con la vista que deja VERA', () => {
  it('al montar, carga directamente con ese filtro y esa búsqueda (sin una carga previa de «todos»)', async () => {
    render(<Inventory profile={profile} now={NOW} veraView={{ filter: 'desactualizados', search: '6204' }} />);

    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    expect(fetchPage.mock.calls[0]![0]).toMatchObject({ filter: 'desactualizados', search: '6204', page: 1 });
    expect(fetchPage.mock.calls.every(([q]) => q.filter === 'desactualizados')).toBe(true);
    expect(screen.getByRole('button', { name: /Desactualizados/, pressed: true })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por referencia o marca...')).toHaveValue('6204');
  });

  it('ya montada, una vista nueva cambia el filtro', async () => {
    const { rerender } = render(<Inventory profile={profile} now={NOW} />);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ filter: 'todos' })));

    rerender(<Inventory profile={profile} now={NOW} veraView={{ filter: 'archivados', search: '' }} />);

    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'archivados' })));
  });

  it('sin vista, arranca como siempre: «todos» y sin búsqueda', async () => {
    render(<Inventory profile={profile} now={NOW} veraView={null} />);
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
    expect(fetchPage.mock.calls[0]![0]).toMatchObject({ filter: 'todos', search: '' });
  });
});
