import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * INV-01 con `onOpenIngest`: el canal email de INV-04, ya en producción. Cableado escrito por Claude
 * Code en un fichero aparte para no tocar el contrato de INV-01 (`Inventory.test.tsx`) ni el de la
 * subida manual (`InventoryUpload.test.tsx`), que montan sin este prop y siguen esperando el canal
 * como «Próximamente» y la dirección con guion.
 */

const fetchPage = vi.fn<(q: PageQuery) => Promise<Page>>();
const fetchStats = vi.fn<() => Promise<Stats>>();

vi.mock('../../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/inventory')>()),
  fetchPage: (q: PageQuery) => fetchPage(q),
  fetchStats: () => fetchStats(),
}));

const { Inventory } = await import('./Inventory');

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

beforeEach(() => {
  fetchPage.mockReset().mockResolvedValue({ lines: [], total: 0 } as unknown as Page);
  fetchStats.mockReset().mockResolvedValue({ published: 0, stale: 0, lastUploadAt: null, visits: null, visibilityMode: 'VISIBLE_TODOS' });
});

describe('INV-01 · canal email (con onOpenIngest)', () => {
  it('el canal email deja de decir «Próximamente» y no pinta ninguna dirección', async () => {
    render(<Inventory profile={profile} now={new Date('2026-10-13T12:00:00Z')} onPickFile={vi.fn()} onOpenIngest={vi.fn()} />);
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.queryByText('Próximamente')).toBeNull();
    expect(screen.getByTestId('channels-scope')).toHaveTextContent('El canal email (INV-04) está disponible');
    // La dirección la abre y la rota el ADMIN en INV-04: aquí no se inventa ninguna.
    expect(screen.queryByTestId('ingest-addr')).toBeNull();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('«Gestionar canal email» abre INV-04', async () => {
    const onOpenIngest = vi.fn();
    render(<Inventory profile={profile} now={new Date('2026-10-13T12:00:00Z')} onPickFile={vi.fn()} onOpenIngest={onOpenIngest} />);
    await userEvent.click(screen.getByRole('button', { name: /Gestionar canal email/i }));
    expect(onOpenIngest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });
});
