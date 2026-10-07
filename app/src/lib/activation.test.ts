import { beforeEach, describe, expect, it, vi } from 'vitest';

/** ACT-02 · capa de datos. Se mockea SOLO el cliente de Supabase y la huella de la contraseña. */

const getSession = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const rememberLoginPassword = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
  },
}));
vi.mock('./login-fingerprint', () => ({
  rememberLoginPassword: (...a: unknown[]) => rememberLoginPassword(...a),
}));

const { hasProvisionalPassword, changeProvisionalPassword, WRONG_PROVISIONAL, SAME_PASSWORD, CHANGE_ERROR } =
  await import('./activation');

beforeEach(() => {
  for (const m of [getSession, signInWithPassword, updateUser, rememberLoginPassword]) m.mockReset();
  signInWithPassword.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe('ACT-02 · contraseña provisional', () => {
  it('se sabe por el aviso de la sesión, y solo si vale exactamente true', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { user_metadata: { must_change_password: true } } } } });
    expect(await hasProvisionalPassword()).toBe(true);
    getSession.mockResolvedValue({ data: { session: { user: { user_metadata: { must_change_password: false } } } } });
    expect(await hasProvisionalPassword()).toBe(false);
    getSession.mockResolvedValue({ data: { session: { user: { user_metadata: {} } } } });
    expect(await hasProvisionalPassword()).toBe(false);
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await hasProvisionalPassword()).toBe(false);
  });

  it('comprueba la provisional, cambia la contraseña, apaga el aviso y guarda la huella de la NUEVA', async () => {
    await changeProvisionalPassword('Ana@Acero.test', 'Provisional1!', 'NuevaClave2024!');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ana@acero.test', password: 'Provisional1!' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'NuevaClave2024!', data: { must_change_password: false } });
    expect(rememberLoginPassword).toHaveBeenCalledWith('Ana@Acero.test', 'NuevaClave2024!');
  });

  it('una provisional equivocada no cambia nada', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('bad') });
    await expect(changeProvisionalPassword('a@acero.test', 'mal', 'NuevaClave2024!')).rejects.toThrow(WRONG_PROVISIONAL);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rememberLoginPassword).not.toHaveBeenCalled();
  });

  it('la nueva no puede ser la provisional ni una contraseña floja', async () => {
    await expect(changeProvisionalPassword('a@acero.test', 'Provisional1!', 'Provisional1!')).rejects.toThrow(SAME_PASSWORD);
    await expect(changeProvisionalPassword('a@acero.test', 'Provisional1!', 'corta')).rejects.toThrow(CHANGE_ERROR);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('si el cambio falla en el servidor, no guarda huella', async () => {
    updateUser.mockResolvedValue({ error: new Error('x') });
    await expect(changeProvisionalPassword('a@acero.test', 'Provisional1!', 'NuevaClave2024!')).rejects.toThrow(CHANGE_ERROR);
    expect(rememberLoginPassword).not.toHaveBeenCalled();
  });
});
