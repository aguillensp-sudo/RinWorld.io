import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * user-revocation#1 · revocación de acceso: lo que hace el CLIENTE.
 *
 * GIVEN un Administrador que revoca el acceso de un usuario desde INVT-01
 * WHEN  confirma la acción
 * THEN  el usuario pierde inmediatamente la capacidad de iniciar sesión
 * AND   la clave privada del usuario revocado se mantiene intacta en el servidor
 * AND   su historial cifrado permanece inaccesible pero no destruido
 *
 * Lo que se mide: que «Eliminar» revoca por `remove_member` Y DESPUÉS pide el bloqueo de inicio de
 * sesión a `ban-revoked-member` con ese mismo miembro; que ninguna de las dos llamadas toca claves ni
 * hilos; que si el bloqueo falla NO se calla; y que una cuenta bloqueada se dice como acceso revocado.
 *
 * ⚠ No caza que `ban-revoked-member` ponga de verdad `banned_until` en Auth (función Deno con la
 * service key) ni que Auth rechace el inicio de sesión: eso solo lo ve un e2e contra el proyecto.
 */

const rpc = vi.fn();
const invoke = vi.fn();
const from = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const { removeMember } = await import('./invitations');
const { REVOKED_MESSAGE, signInErrorMessage } = await import('./session');

const MIEMBRO = '33330000-0000-4000-8000-000000000003';

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  from.mockReset();
});

describe('user-revocation · el cliente', () => {
  it('user-revocation#1 · revoca con remove_member y después bloquea el inicio de sesión de ESE miembro, sin tocar claves ni hilos', async () => {
    await removeMember(MIEMBRO);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('remove_member', { p_member_id: MIEMBRO });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('ban-revoked-member', { body: { member_id: MIEMBRO } });
    // El orden importa: la función solo bloquea a quien YA está revocado.
    expect(rpc.mock.invocationCallOrder[0]!).toBeLessThan(invoke.mock.invocationCallOrder[0]!);
    // Ni borra filas ni accede a tablas: la clave y el historial cifrado ni se tocan desde el cliente.
    expect(from).not.toHaveBeenCalled();
  });

  it('user-revocation#1 · si la revocación falla no se pide el bloqueo', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('No puedes eliminar a un administrador') });
    await expect(removeMember(MIEMBRO)).rejects.toThrow('No puedes eliminar a un administrador');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('user-revocation#1 · si el bloqueo falla se dice: el administrador tiene que saber que la cuenta aún puede autenticarse', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(removeMember(MIEMBRO)).rejects.toThrow(/no se pudo bloquear su inicio de sesión/);
  });

  it('user-revocation#1 · una cuenta bloqueada intenta entrar y se le dice acceso revocado, no «contraseña incorrecta»', () => {
    expect(signInErrorMessage('User is banned')).toBe(REVOKED_MESSAGE);
    expect(signInErrorMessage('Invalid login credentials')).toBe('Invalid login credentials');
  });
});
