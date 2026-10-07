import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from '../../lib/session';

/**
 * ACT-02 · Activa tu cuenta. Se mockean SOLO las dos funciones de red de `lib/activation`
 * (`hasProvisionalPassword`, `changeProvisionalPassword`); los textos y la validación son los de verdad.
 */

const hasProvisionalPassword = vi.fn<() => Promise<boolean>>();
const changeProvisionalPassword = vi.fn<(email: string, current: string, next: string) => Promise<void>>();

vi.mock('../../lib/activation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/activation')>()),
  hasProvisionalPassword: () => hasProvisionalPassword(),
  changeProvisionalPassword: (email: string, current: string, next: string) =>
    changeProvisionalPassword(email, current, next),
}));

const { ActivateAccount } = await import('./ActivateAccount');
const { ACTIVATION_TEXTS: T } = await import('../../lib/activation');

vi.setConfig({ testTimeout: 30_000 });

const PROFILE: MemberProfile = {
  id: 'ana',
  email: 'ana.ruiz@sur.es',
  fullName: 'Ana Ruiz',
  role: 'EDITOR',
  state: 'REGISTERED',
  orgId: 'org',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

const onStart = vi.fn<() => void>();
const onSignOut = vi.fn<() => void>();

beforeEach(() => {
  for (const m of [hasProvisionalPassword, changeProvisionalPassword, onStart, onSignOut]) m.mockReset();
  hasProvisionalPassword.mockResolvedValue(false);
  changeProvisionalPassword.mockResolvedValue(undefined);
});

describe('ACT-02 · activa tu cuenta', () => {
  it('dice a quién, de qué organización y en qué estado, con el rol Editor', async () => {
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(T.title);
    expect(screen.getByText(/Ya formas parte de Rodamientos del Sur SL\./)).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText(T.roleName)).toBeInTheDocument();
    expect(screen.getByText(T.stateBadge)).toBeInTheDocument();
  });

  it('enseña los tres pasos y las dos cajas, con lo que de verdad no puede hacer todavía', async () => {
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} />);
    await screen.findByRole('heading', { level: 1 });
    const pasos = screen.getByRole('list', { name: T.stepsLabel });
    expect(pasos).toHaveTextContent('Entender tu clave');
    expect(pasos).toHaveTextContent('Elegir tu frase');
    expect(pasos).toHaveTextContent('Guardar tu clave');
    expect(screen.getByText('No puedes enviar mensajes, consultas ni ofertas.')).toBeInTheDocument();
    expect(screen.getByText(T.after[0])).toBeInTheDocument();
  });

  it('el aviso de la frase es el corregido: se puede empezar de nuevo, y no promete reinvitar', async () => {
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText(T.noticeStrong)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/podrás empezar con una clave nueva/);
    expect(document.body.textContent).toMatch(/perderás el acceso al contenido cifrado anterior/);
    expect(document.body.textContent).not.toMatch(/invitarte de nuevo|invite de nuevo/);
  });

  it('«Empezar la activación» solo navega; «Ahora no» cierra la sesión', async () => {
    const user = userEvent.setup();
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} />);
    await user.click(await screen.findByRole('button', { name: T.start }));
    expect(onStart).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: T.later }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('sin nombre, usa el correo', async () => {
    render(<ActivateAccount profile={{ ...PROFILE, fullName: null }} onStart={onStart} onSignOut={onSignOut} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/ana\.ruiz@sur\.es/).length).toBeGreaterThan(0);
  });
});

describe('ACT-02 · contraseña provisional (alta por FRU)', () => {
  const campos = () => ({
    actual: screen.getByLabelText(new RegExp(T.tempCurrent)),
    nueva: screen.getByLabelText('Contraseña*'),
    repetir: screen.getByLabelText(/Repetir contraseña/),
  });
  const cambiar = () => screen.getByRole('button', { name: T.tempSubmit });

  it('con el aviso de la sesión, lo primero es cambiarla, y no se ve la pantalla normal', async () => {
    hasProvisionalPassword.mockResolvedValue(true);
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(T.tempTitle);
    expect(screen.queryByRole('button', { name: T.start })).not.toBeInTheDocument();
    expect(cambiar()).toBeDisabled();
  });

  it('cambia la contraseña con su correo y pasa a la pantalla normal', async () => {
    const user = userEvent.setup();
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} provisional />);
    await user.type(campos().actual, 'Provisional1!');
    await user.type(campos().nueva, 'NuevaClave2024!');
    await user.type(campos().repetir, 'NuevaClave2024!');
    await user.click(cambiar());
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(T.title));
    expect(changeProvisionalPassword).toHaveBeenCalledWith('ana.ruiz@sur.es', 'Provisional1!', 'NuevaClave2024!');
  });

  it('una provisional equivocada se dice y no avanza', async () => {
    changeProvisionalPassword.mockRejectedValue(new Error('La contraseña provisional no es correcta.'));
    const user = userEvent.setup();
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} provisional />);
    await user.type(campos().actual, 'mal');
    await user.type(campos().nueva, 'NuevaClave2024!');
    await user.type(campos().repetir, 'NuevaClave2024!');
    await user.click(cambiar());
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña provisional no es correcta.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(T.tempTitle);
  });

  it('no deja enviar con una nueva floja o que no coincide', async () => {
    const user = userEvent.setup();
    render(<ActivateAccount profile={PROFILE} onStart={onStart} onSignOut={onSignOut} provisional />);
    await user.type(campos().actual, 'Provisional1!');
    await user.type(campos().nueva, 'floja');
    await user.type(campos().repetir, 'floja');
    expect(cambiar()).toBeDisabled();
    await user.clear(campos().nueva);
    await user.type(campos().nueva, 'NuevaClave2024!');
    expect(cambiar()).toBeDisabled();
  });
});
