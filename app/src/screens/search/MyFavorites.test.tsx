import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberProfile } from '../../lib/session';
import { MyFavorites } from './MyFavorites';

/**
 * F-280 · «Mis favoritos»: la lista del miembro, con la confirmación de siempre al quitar y el enlace a
 * la ficha. Mockea la capa de datos; la RLS (`favorites_select_own`) la cubre el banco y el e2e.
 */
const fetchMyFavorites = vi.fn();
const toggleFavorite = vi.fn();

vi.mock('../../lib/favorites', async (orig) => ({
  ...(await orig<typeof import('../../lib/favorites')>()),
  fetchMyFavorites: (...a: unknown[]) => fetchMyFavorites(...a),
}));
vi.mock('../../lib/search', async (orig) => ({
  ...(await orig<typeof import('../../lib/search')>()),
  toggleFavorite: (...a: unknown[]) => toggleFavorite(...a),
}));

const PROFILE = { id: 'm1', orgId: 'o0', role: 'EDITOR' } as unknown as MemberProfile;
const FILAS = [
  { orgId: 'o1', name: 'Nordwälz Lager', country: 'DE', addedAt: '2026-10-20T10:00:00Z' },
  { orgId: 'o2', name: 'Anadolu Rulman', country: 'TR', addedAt: '2026-10-10T10:00:00Z' },
];

beforeEach(() => {
  fetchMyFavorites.mockReset().mockResolvedValue(FILAS);
  toggleFavorite.mockReset().mockResolvedValue(undefined);
});

describe('MyFavorites', () => {
  it('pide la lista del miembro y la pinta con su país', async () => {
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    const lista = await screen.findByTestId('favorites-list');
    expect(fetchMyFavorites).toHaveBeenCalledWith('m1');
    expect(within(lista).getByText('Nordwälz Lager')).toBeInTheDocument();
    expect(within(lista).getByText('Anadolu Rulman')).toBeInTheDocument();
  });

  it('pulsar el nombre abre la ficha de esa organización', async () => {
    const abrir = vi.fn();
    render(<MyFavorites profile={PROFILE} onOpenOrganization={abrir} />);
    fireEvent.click(await screen.findByText('Anadolu Rulman'));
    expect(abrir).toHaveBeenCalledWith('o2');
  });

  it('quitar pide confirmación y NO borra hasta confirmar', async () => {
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Nordwälz Lager de favoritos' }));
    expect(screen.getByText('¿Quitar a Nordwälz Lager de tus favoritos?')).toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(toggleFavorite).not.toHaveBeenCalled();
    expect(screen.getByText('Nordwälz Lager')).toBeInTheDocument();
  });

  it('confirmar quita el favorito, lo saca de la lista y avisa', async () => {
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Nordwälz Lager de favoritos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('m1', 'o1', false));
    await waitFor(() => expect(screen.queryByText('Nordwälz Lager')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Nordwälz Lager');
    expect(screen.getByText('Anadolu Rulman')).toBeInTheDocument();
  });

  it('si quitar falla, la fila sigue y el error sale en el cuadro', async () => {
    toggleFavorite.mockRejectedValue(new Error('sin permiso'));
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Nordwälz Lager de favoritos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalled());
    expect(await screen.findByText(/sin permiso/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar a Nordwälz Lager de favoritos' })).toBeInTheDocument();
  });

  it('sin favoritos, el estado vacío explica cómo marcar', async () => {
    fetchMyFavorites.mockResolvedValue([]);
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    expect(await screen.findByTestId('favorites-empty')).toBeInTheDocument();
  });

  it('si la carga falla, enseña el error y no una lista vacía', async () => {
    fetchMyFavorites.mockRejectedValue(new Error('caída'));
    render(<MyFavorites profile={PROFILE} onOpenOrganization={() => {}} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('favorites-empty')).toBeNull();
  });
});
