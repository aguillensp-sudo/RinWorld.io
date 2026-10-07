import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * INVT-02 · capa de datos. Se mockea SOLO el cliente de Supabase (`functions.invoke` y `auth`) y la
 * huella de la contraseña; el formato del enlace, la fecha de caducidad y la lectura de las respuestas
 * son los de verdad.
 */

const invoke = vi.fn();
const signInWithPassword = vi.fn();
const rememberLoginPassword = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) },
  },
}));
vi.mock('./login-fingerprint', () => ({
  rememberLoginPassword: (...args: unknown[]) => rememberLoginPassword(...args),
}));

const { invitationTokenFromHash, invitationUrl, validateInvitationLink, acceptInvitation, expiryText, InvitationBlocked } =
  await import('./invitation-link');

const TOKEN = 'ab'.repeat(32);

beforeEach(() => {
  for (const m of [invoke, signInWithPassword, rememberLoginPassword]) m.mockReset();
  signInWithPassword.mockResolvedValue({ error: null });
});

function httpError(status: number, body: unknown) {
  return { context: new Response(JSON.stringify(body), { status }) };
}

describe('INVT-02 · el enlace', () => {
  it('lee el token del hash, y solo si son 64 hexadecimales', () => {
    expect(invitationTokenFromHash(`#invitacion?token=${TOKEN}`)).toBe(TOKEN);
    expect(invitationTokenFromHash(`#invitacion?token=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    expect(invitationTokenFromHash(`#registro?token=${TOKEN}`)).toBeNull();
    expect(invitationTokenFromHash('#invitacion?token=abc')).toBeNull();
    expect(invitationTokenFromHash('')).toBeNull();
  });

  it('la URL que se copia va en el hash: el servidor no ve el token', () => {
    const url = new URL(invitationUrl(TOKEN));
    expect(url.hash).toBe(`#invitacion?token=${TOKEN}`);
    expect(url.search).toBe('');
    expect(invitationTokenFromHash(url.hash)).toBe(TOKEN);
  });

  it('la caducidad nunca dice «0 días»', () => {
    const now = new Date('2026-10-07T10:00:00Z');
    expect(expiryText('2026-10-12T10:00:00Z', now).left).toBe('dentro de 5 días');
    expect(expiryText('2026-10-07T12:00:00Z', now).left).toBe('dentro de 1 día');
    expect(expiryText('2026-10-12T10:00:00Z', now).date).toMatch(/12 oct 2026/);
  });
});

describe('INVT-02 · validar', () => {
  it('traduce la respuesta de la función', async () => {
    invoke.mockResolvedValue({
      data: {
        invitation: {
          status: 'OK',
          org_name: 'Acero SL',
          inviter_name: 'Ana',
          email: 'a@acero.test',
          expires_at: '2026-10-12T10:00:00Z',
        },
      },
      error: null,
    });
    expect(await validateInvitationLink(TOKEN)).toEqual({
      status: 'OK',
      orgName: 'Acero SL',
      inviterName: 'Ana',
      email: 'a@acero.test',
      expiresAt: '2026-10-12T10:00:00Z',
    });
    expect(invoke).toHaveBeenCalledWith('accept-invitation', { body: { action: 'validate', token: TOKEN } });
  });

  it('sin nombre de quien invita, `null`', async () => {
    invoke.mockResolvedValue({
      data: { invitation: { status: 'EXPIRED', org_name: 'Acero SL', inviter_name: null, email: 'a@acero.test', expires_at: 'x' } },
      error: null,
    });
    expect((await validateInvitationLink(TOKEN)).inviterName).toBeNull();
  });

  it('un 404 y una respuesta rara son «no vale», sin más', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(404, { error: 'El enlace no es válido.' }) });
    await expect(validateInvitationLink(TOKEN)).rejects.toThrow('El enlace no es válido.');
    invoke.mockResolvedValue({ data: { invitation: { status: 'RARO' } }, error: null });
    await expect(validateInvitationLink(TOKEN)).rejects.toThrow('Este enlace no es válido.');
  });
});

describe('INVT-02 · aceptar', () => {
  const input = { fullName: ' Nuria Nueva ', password: 'Abcdef1234!', email: 'Nuria@Acero.test' };

  it('crea la cuenta, inicia sesión con el correo en minúsculas y guarda la huella', async () => {
    invoke.mockResolvedValue({ data: { accepted: true }, error: null });
    await acceptInvitation(TOKEN, input);
    expect(invoke).toHaveBeenCalledWith('accept-invitation', {
      body: { action: 'accept', token: TOKEN, full_name: 'Nuria Nueva', password: 'Abcdef1234!' },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'nuria@acero.test', password: 'Abcdef1234!' });
    expect(rememberLoginPassword).toHaveBeenCalledWith('Nuria@Acero.test', 'Abcdef1234!');
  });

  it('el cuerpo no lleva el correo: el servidor usa el de la invitación', async () => {
    invoke.mockResolvedValue({ data: { accepted: true }, error: null });
    await acceptInvitation(TOKEN, input);
    const body = (invoke.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
    expect(Object.keys(body).sort()).toEqual(['action', 'full_name', 'password', 'token']);
  });

  it('un 409 con el estado se convierte en InvitationBlocked', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(409, { status: 'FULL' }) });
    const error = await acceptInvitation(TOKEN, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvitationBlocked);
    expect((error as InstanceType<typeof InvitationBlocked>).status).toBe('FULL');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('otro error dice el mensaje del servidor; sin él, el genérico', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(400, { error: 'El nombre debe tener entre 2 y 100 caracteres.' }) });
    await expect(acceptInvitation(TOKEN, input)).rejects.toThrow('El nombre debe tener');
    invoke.mockResolvedValue({ data: null, error: {} });
    await expect(acceptInvitation(TOKEN, input)).rejects.toThrow('No se pudo crear la cuenta.');
  });

  it('si la cuenta se crea y el inicio de sesión falla, lo dice sin guardar huella', async () => {
    invoke.mockResolvedValue({ data: { accepted: true }, error: null });
    signInWithPassword.mockResolvedValue({ error: new Error('x') });
    await expect(acceptInvitation(TOKEN, input)).rejects.toThrow('Tu cuenta se ha creado');
    expect(rememberLoginPassword).not.toHaveBeenCalled();
  });
});
