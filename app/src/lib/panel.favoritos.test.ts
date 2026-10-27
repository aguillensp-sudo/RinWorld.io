import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFavoritesReceived } from './panel';

/**
 * F-280 · «Favoritos recibidos» del Panel. La RPC `favorites_received_this_month` (`0077`) es la
 * única vía: `favorites_select_own` haría que un conteo por el cliente diera 0 en silencio.
 * Lo que se prueba aquí es que un fallo NUNCA se convierta en cero.
 */
let rpc: (nombre: string) => Promise<{ data: unknown; error: unknown }>;
const llamadas: string[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (nombre: string) => {
      llamadas.push(nombre);
      return rpc(nombre);
    },
  },
}));

beforeEach(() => {
  llamadas.length = 0;
});

describe('fetchFavoritesReceived', () => {
  it('llama a la RPC y devuelve el número', async () => {
    rpc = async () => ({ data: 5, error: null });
    expect(await fetchFavoritesReceived()).toBe(5);
    expect(llamadas).toEqual(['favorites_received_this_month']);
  });

  it('un cero medido es 0', async () => {
    rpc = async () => ({ data: 0, error: null });
    expect(await fetchFavoritesReceived()).toBe(0);
  });

  it('un error de la RPC es null (guion), no 0', async () => {
    rpc = async () => ({ data: null, error: { message: 'permission denied' } });
    expect(await fetchFavoritesReceived()).toBeNull();
  });

  it('sin miembro activo la base devuelve null y sigue siendo null', async () => {
    rpc = async () => ({ data: null, error: null });
    expect(await fetchFavoritesReceived()).toBeNull();
  });

  it('si la llamada revienta, no propaga: null', async () => {
    rpc = async () => {
      throw new Error('red caída');
    };
    expect(await fetchFavoritesReceived()).toBeNull();
  });
});
