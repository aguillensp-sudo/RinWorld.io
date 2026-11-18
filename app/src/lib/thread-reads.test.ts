import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUnreadThreads, markThreadRead } from './thread-reads';

/**
 * F-027 a · hilos sin leer (`0082`). La regla de qué cuenta la prueba la base
 * (`supabase/tests/13_hilos_sin_leer.sql`); aquí, el cliente: qué RPC llama, cómo traduce las filas y
 * que marcar como leído nunca tumbe la pantalla del hilo. Escrito a mano por Claude Code.
 */
let rpc: (nombre: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>;
const llamadas: { nombre: string; args?: unknown }[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (nombre: string, args?: unknown) => {
      llamadas.push({ nombre, args });
      return rpc(nombre, args);
    },
  },
}));

beforeEach(() => {
  llamadas.length = 0;
});

describe('fetchUnreadThreads', () => {
  it('llama a unread_threads y traduce cada fila', async () => {
    rpc = async () => ({
      data: [
        {
          thread_id: 'h1',
          counterparty_name: 'Suministros Industriales Levante',
          thread_state: 'CON CONSULTA PENDIENTE',
          unread_count: 2,
          last_unread_at: '2026-11-18T10:00:00Z',
        },
      ],
      error: null,
    });
    expect(await fetchUnreadThreads()).toEqual([
      {
        threadId: 'h1',
        counterpartyName: 'Suministros Industriales Levante',
        threadState: 'CON CONSULTA PENDIENTE',
        count: 2,
        lastUnreadAt: '2026-11-18T10:00:00Z',
      },
    ]);
    expect(llamadas).toEqual([{ nombre: 'unread_threads', args: undefined }]);
  });

  it('sin nada sin leer, lista vacía', async () => {
    rpc = async () => ({ data: [], error: null });
    expect(await fetchUnreadThreads()).toEqual([]);
  });

  it('un error de la RPC se lanza: quien llama decide pintar «—», nunca un 0', async () => {
    rpc = async () => ({ data: null, error: { message: 'permission denied' } });
    await expect(fetchUnreadThreads()).rejects.toEqual({ message: 'permission denied' });
  });
});

describe('markThreadRead', () => {
  it('llama a mark_thread_read con el id del hilo', async () => {
    rpc = async () => ({ data: null, error: null });
    await markThreadRead('h1');
    expect(llamadas).toEqual([{ nombre: 'mark_thread_read', args: { p_thread_id: 'h1' } }]);
  });

  it('si falla, no lanza', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc = async () => ({ data: null, error: { message: 'boom' } });
    await expect(markThreadRead('h1')).resolves.toBeUndefined();
    rpc = async () => {
      throw new Error('red');
    };
    await expect(markThreadRead('h1')).resolves.toBeUndefined();
    consola.mockRestore();
  });
});
