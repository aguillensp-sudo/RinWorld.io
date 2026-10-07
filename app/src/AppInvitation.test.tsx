import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * CONTRATO DE CABLEADO · INVT-02 y ACT-02 en `App.tsx`. Lo escribe Claude Code (el wiring es suyo).
 * Comprueba: que `#invitacion?token=…` abre INVT-02 sin sesión; que un EDITOR `REGISTERED` ve ACT-02
 * primero y REG-05 después, mientras el ADMIN va derecho a REG-05; y que un EDITOR `KEY_ACTIVE` se
 * activa solo (no hay REG-09 para él).
 *
 * No puede cazar: que el flujo entero funcione contra la base real (lo midió `0050` en el banco de
 * esquema y la verificación de producción) ni que se vea bien en un navegador.
 */

const BASE: MemberProfile = {
  id: 'm-1',
  email: 'ana.ruiz@sur.es',
  fullName: 'Ana Ruiz',
  role: 'EDITOR',
  state: 'REGISTERED',
  orgId: 'org-1',
  orgName: 'Rodamientos del Sur SL',
  orgCountry: 'ES',
};

let session: { status: 'anonymous' } | { status: 'authenticated'; profile: MemberProfile } = { status: 'anonymous' };
const refresh = vi.fn();
const signOut = vi.fn();
const activateOwnMembership = vi.fn<() => Promise<void>>();

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: session, error: null, signIn: vi.fn(), signOut, refresh }),
}));
vi.mock('./lib/onboarding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/onboarding')>()),
  activateOwnMembership: () => activateOwnMembership(),
}));
vi.mock('./lib/invitation-link', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/invitation-link')>()),
  validateInvitationLink: async () => ({
    status: 'OK',
    orgName: 'Rodamientos del Sur SL',
    inviterName: 'Juan Martínez',
    email: 'ana.ruiz@sur.es',
    expiresAt: '2030-01-01T00:00:00Z',
  }),
}));
vi.mock('./lib/activation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/activation')>()),
  hasProvisionalPassword: async () => false,
}));

const { App } = await import('./App');

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  window.location.hash = '';
  session = { status: 'anonymous' };
  for (const m of [refresh, signOut, activateOwnMembership]) m.mockReset();
  activateOwnMembership.mockResolvedValue(undefined);
});
afterEach(() => {
  window.location.hash = '';
});

describe('App · INVT-02', () => {
  it('con #invitacion?token=… y sin sesión abre «Te han invitado», no el login', async () => {
    window.location.hash = `#invitacion?token=${'ab'.repeat(32)}`;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Te han invitado a Bearingworld.io' })).toBeInTheDocument();
  });

  it('un token mal formado no abre nada: se ve el login', async () => {
    window.location.hash = '#invitacion?token=corto';
    render(<App />);
    expect(screen.queryByRole('heading', { name: 'Te han invitado a Bearingworld.io' })).not.toBeInTheDocument();
  });
});

describe('App · ACT-02', () => {
  it('un EDITOR REGISTERED ve «Activa tu cuenta» y, al empezar, REG-05 con los pasos de un invitado', async () => {
    session = { status: 'authenticated', profile: BASE };
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Activa tu cuenta' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Empezar la activación' }));
    expect(await screen.findByRole('button', { name: 'Entendido, crear mi frase de seguridad' })).toBeInTheDocument();
    expect(screen.getByText('Invitación')).toBeInTheDocument();
    expect(screen.getByText('Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Solicitud')).not.toBeInTheDocument();
  });

  it('el ADMIN REGISTERED va derecho a REG-05, con sus pasos de siempre', async () => {
    session = { status: 'authenticated', profile: { ...BASE, role: 'ADMIN' } };
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Entendido, crear mi frase de seguridad' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Activa tu cuenta' })).not.toBeInTheDocument();
    expect(screen.getByText('Solicitud')).toBeInTheDocument();
    expect(screen.getByText('Organización')).toBeInTheDocument();
  });

  it('un EDITOR KEY_ACTIVE se activa solo y relee el perfil', async () => {
    session = { status: 'authenticated', profile: { ...BASE, state: 'KEY_ACTIVE' } };
    render(<App />);
    await waitFor(() => expect(activateOwnMembership).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('si la activación falla, lo dice y deja reintentar', async () => {
    activateOwnMembership.mockRejectedValueOnce(new Error('Tu cuenta no está pendiente de activación.'));
    session = { status: 'authenticated', profile: { ...BASE, state: 'KEY_ACTIVE' } };
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta no está pendiente de activación.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(activateOwnMembership).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('un ADMIN KEY_ACTIVE no se activa solo: tiene REG-09', async () => {
    session = { status: 'authenticated', profile: { ...BASE, role: 'ADMIN', state: 'KEY_ACTIVE' } };
    render(<App />);
    // Su pantalla es REG-09 (no el aviso de «Activando tu cuenta…»), y nada llama a la activación por él.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Activando tu cuenta…')).not.toBeInTheDocument();
    expect(activateOwnMembership).not.toHaveBeenCalled();
  });
});
