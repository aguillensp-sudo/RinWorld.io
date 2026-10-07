import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvitationInfo } from '../../lib/invitation-link';

/**
 * INVT-02 · Aceptar invitación. Se mockean SOLO las dos llamadas de red de `lib/invitation-link`
 * (`validateInvitationLink`, `acceptInvitation`); la validación, los textos y la caducidad son los de verdad.
 *
 * Lo que este fichero NO puede cazar: el alta real (Edge Function + `redeem_invitation`, medidos por el
 * banco de esquema `0050`) ni que la pantalla se vea bien en un navegador (jsdom no maqueta).
 */

const validateInvitationLink = vi.fn<(token: string) => Promise<InvitationInfo>>();
const acceptInvitation = vi.fn<(token: string, input: { fullName: string; password: string; email: string }) => Promise<void>>();

vi.mock('../../lib/invitation-link', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/invitation-link')>()),
  validateInvitationLink: (token: string) => validateInvitationLink(token),
  acceptInvitation: (token: string, input: { fullName: string; password: string; email: string }) =>
    acceptInvitation(token, input),
}));

const { InvitationAcceptance } = await import('./InvitationAcceptance');
const { InvitationBlocked, INVITATION_TEXTS: T } = await import('../../lib/invitation-link');

vi.setConfig({ testTimeout: 30_000 });

const TOKEN = 'ef'.repeat(32);
const NOW = new Date('2026-10-09T10:00:00Z');
const INFO: InvitationInfo = {
  status: 'OK',
  orgName: 'Rodamientos del Sur SL',
  inviterName: 'Juan Martínez',
  email: 'ana.ruiz@sur.es',
  expiresAt: '2026-10-14T10:00:00Z',
};
const PASSWORD = 'Abcdef1234!';

const onAccepted = vi.fn<() => void>();
const onBackToLogin = vi.fn<() => void>();

beforeEach(() => {
  for (const m of [validateInvitationLink, acceptInvitation, onAccepted, onBackToLogin]) m.mockReset();
  validateInvitationLink.mockResolvedValue(INFO);
  acceptInvitation.mockResolvedValue(undefined);
});

async function mount() {
  render(<InvitationAcceptance token={TOKEN} onAccepted={onAccepted} onBackToLogin={onBackToLogin} now={NOW} />);
  return screen.findByRole('heading', { level: 1 });
}

const enviar = () => screen.getByRole('button', { name: T.submit });

async function rellenar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nombre completo/), 'Ana Ruiz');
  await user.type(screen.getByLabelText(/^Contraseña/), PASSWORD);
  await user.type(screen.getByLabelText(/Repetir contraseña/), PASSWORD);
  await user.click(screen.getByRole('checkbox'));
}

describe('INVT-02 · el formulario', () => {
  it('valida el enlace una sola vez, con su token, y enseña la invitación', async () => {
    expect(await mount()).toHaveTextContent(T.title);
    expect(validateInvitationLink).toHaveBeenCalledTimes(1);
    expect(validateInvitationLink).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText('Rodamientos del Sur SL')).toBeInTheDocument();
    expect(screen.getByText(/Juan Martínez/)).toBeInTheDocument();
    expect(screen.getByText(T.roleName)).toBeInTheDocument();
    expect(screen.getByText(/dentro de 5 días/)).toBeInTheDocument();
  });

  it('el correo es el de la invitación y no se edita', async () => {
    await mount();
    const correo = screen.getByLabelText(T.emailLabel);
    expect(correo).toHaveValue('ana.ruiz@sur.es');
    expect(correo).toHaveAttribute('readonly');
  });

  it('sin nombre de quien invitó, dice «Tu administrador»', async () => {
    validateInvitationLink.mockResolvedValue({ ...INFO, inviterName: null });
    await mount();
    expect(screen.getByText(T.rowInviter).nextElementSibling).toHaveTextContent(T.inviterFallback);
  });

  it('avisa de que la frase de seguridad es solo suya, y no afirma ningún correo', async () => {
    await mount();
    expect(screen.getByText(T.notice)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/te hemos enviado|recibirás un (email|correo)/i);
  });

  it('el botón espera a un nombre, una contraseña buena, que coincida y los términos', async () => {
    const user = userEvent.setup();
    await mount();
    expect(enviar()).toBeDisabled();
    await user.type(screen.getByLabelText(/Nombre completo/), 'Ana Ruiz');
    await user.type(screen.getByLabelText(/^Contraseña/), 'corta');
    await user.type(screen.getByLabelText(/Repetir contraseña/), 'corta');
    await user.click(screen.getByRole('checkbox'));
    expect(enviar()).toBeDisabled();
    await user.clear(screen.getByLabelText(/^Contraseña/));
    await user.type(screen.getByLabelText(/^Contraseña/), PASSWORD);
    expect(enviar()).toBeDisabled(); // ya no coincide
    await user.clear(screen.getByLabelText(/Repetir contraseña/));
    await user.type(screen.getByLabelText(/Repetir contraseña/), PASSWORD);
    expect(enviar()).toBeEnabled();
  });

  it('sin marcar los términos no se envía', async () => {
    const user = userEvent.setup();
    await mount();
    await rellenar(user);
    await user.click(screen.getByRole('checkbox'));
    expect(enviar()).toBeDisabled();
  });
});

describe('INVT-02 · enviar', () => {
  it('crea la cuenta con el token, el nombre y la contraseña, y avisa a la app', async () => {
    const user = userEvent.setup();
    await mount();
    await rellenar(user);
    await user.click(enviar());
    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    expect(acceptInvitation).toHaveBeenCalledWith(TOKEN, { fullName: 'Ana Ruiz', password: PASSWORD, email: 'ana.ruiz@sur.es' });
  });

  it('un error del servidor se dice en una alerta y deja reintentar', async () => {
    acceptInvitation.mockRejectedValue(new Error('No se pudo crear la cuenta.'));
    const user = userEvent.setup();
    await mount();
    await rellenar(user);
    await user.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear la cuenta.');
    expect(onAccepted).not.toHaveBeenCalled();
    expect(enviar()).toBeEnabled();
  });

  it('si entre medias alguien ocupa la última plaza, pasa a la pantalla de «organización llena»', async () => {
    acceptInvitation.mockRejectedValue(new InvitationBlocked('FULL'));
    const user = userEvent.setup();
    await mount();
    await rellenar(user);
    await user.click(enviar());
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(T.full.title);
    expect(onAccepted).not.toHaveBeenCalled();
  });
});

describe('INVT-02 · los estados que no son el formulario', () => {
  it('caducada: lo dice y no deja crear nada', async () => {
    validateInvitationLink.mockResolvedValue({ ...INFO, status: 'EXPIRED' });
    expect(await mount()).toHaveTextContent(T.expired.title);
    expect(screen.getByRole('alert')).toHaveTextContent(T.expired.text);
    expect(screen.queryByLabelText(/Nombre completo/)).not.toBeInTheDocument();
  });

  it('usada, anulada o inventada: un solo mensaje, sin decir cuál', async () => {
    validateInvitationLink.mockRejectedValue(new Error('El enlace no es válido.'));
    expect(await mount()).toHaveTextContent(T.invalid.title);
    expect(screen.getByRole('alert')).toHaveTextContent(T.invalid.text);
  });

  it('organización llena: dice cuántos y hasta cuándo vale la invitación', async () => {
    validateInvitationLink.mockResolvedValue({ ...INFO, status: 'FULL' });
    expect(await mount()).toHaveTextContent(T.full.title);
    expect(screen.getByRole('alert')).toHaveTextContent('Rodamientos del Sur SL ya tiene 5 usuarios activos.');
    expect(screen.getByRole('alert')).toHaveTextContent(/hasta el 14 oct 2026/);
  });

  it('correo ya registrado: ofrece iniciar sesión', async () => {
    validateInvitationLink.mockResolvedValue({ ...INFO, status: 'EXISTS' });
    const user = userEvent.setup();
    expect(await mount()).toHaveTextContent(T.exists.title);
    await user.click(screen.getByRole('button', { name: T.exists.action }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });

  it('desde cualquier error se puede volver al inicio de sesión', async () => {
    validateInvitationLink.mockResolvedValue({ ...INFO, status: 'EXPIRED' });
    const user = userEvent.setup();
    await mount();
    await user.click(screen.getByRole('button', { name: T.toLogin }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
