import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * ESCENARIOS · la pantalla de suspensión en `App.tsx`
 * (`billing-subscription/automatic-suspension#2`, `community-forum/active-account-access#2`).
 *
 * Un miembro de una organización SUSPENDED ve la pantalla de suspensión EN LUGAR del shell: no hay
 * menú, así que tampoco hay camino al foro ni a VERA. La puerta (`loadProfile` → `suspended`) se
 * prueba en `session.suspension.escenarios.test.ts`; la visibilidad para los demás, en
 * `supabase/tests/09_sin_prueba_sql.sql` §3. Escrito por Claude Code; no es contrato del arnés.
 */

const BASE: MemberProfile = {
  id: 'm-1',
  email: 'ana@padana.it',
  fullName: 'Ana Rossi',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-1',
  orgName: 'Cuscinetti Padana',
  orgCountry: 'IT',
};

type Estado =
  | { status: 'anonymous' }
  | { status: 'authenticated'; profile: MemberProfile }
  | { status: 'suspended'; profile: MemberProfile };

let session: Estado = { status: 'suspended', profile: BASE };
let rerenderApp: () => void = () => {};
const signOut = vi.fn(async () => {
  session = { status: 'anonymous' };
  rerenderApp();
});

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: session, error: null, signIn: vi.fn(), signOut, refresh: vi.fn() }),
}));
vi.mock('./lib/login-fingerprint', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/login-fingerprint')>()),
  hasLoginFingerprint: () => true,
}));
vi.mock('./lib/keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/keys')>()),
  ensureKeyring: async () => ({ publicKey: new Uint8Array(32) }),
  keyringHasBackup: () => true,
}));
vi.mock('./lib/invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/invitations')>()),
  fetchTeam: async () => [],
  fetchInvitations: async () => [],
}));
vi.mock('./screens/panel/Panel', () => ({ Panel: () => <div>panel</div> }));

const { App } = await import('./App');

vi.setConfig({ testTimeout: 30_000 });

function pintar() {
  const r = render(<App />);
  rerenderApp = () => r.rerender(<App />);
  return r;
}

beforeEach(() => {
  session = { status: 'suspended', profile: BASE };
  signOut.mockClear();
});

describe('billing-subscription/automatic-suspension', () => {
  it('billing-subscription/automatic-suspension#2 · pantalla de suspensión en lugar del dashboard', async () => {
    pintar();
    const pantalla = screen.getByTestId('org-suspended');
    expect(pantalla).toHaveTextContent('Organización suspendida');
    expect(pantalla).toHaveTextContent('Cuscinetti Padana');
    expect(pantalla).toHaveTextContent('Bearingworld.io');
    expect(pantalla).toHaveTextContent(/datos se conservan/);
    expect(pantalla).toHaveTextContent(/operador de la plataforma/);
    expect(pantalla.textContent).not.toMatch(/rinworld/i);
    // Ni el Panel ni el menú del shell
    expect(screen.queryByText('panel')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();

    // Cerrar sesión funciona desde aquí
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('org-suspended')).toBeNull();
  });

  it('control · el mismo miembro de una organización activa entra al shell, con el foro en el menú', async () => {
    session = { status: 'authenticated', profile: BASE };
    pintar();
    expect(screen.queryByTestId('org-suspended')).toBeNull();
    expect((await screen.findAllByText('Foros')).length).toBeGreaterThan(0);
  });
});

describe('community-forum/active-account-access', () => {
  it('community-forum/active-account-access#2 · un miembro de una suspendida no llega al foro: ve la pantalla de suspensión', () => {
    pintar();
    expect(screen.getByTestId('org-suspended')).toBeInTheDocument();
    expect(screen.queryAllByText('Foros')).toHaveLength(0);
    expect(screen.queryByTestId('forum-home')).toBeNull();
  });
});
