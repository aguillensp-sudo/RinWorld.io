import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * Cableado del pie del menú: `Seguridad` abre SET-SEC-01 y `Configuración` abre INVT-01 (solo el ADMIN),
 * y cada uno cierra al otro. Un ADMIN con backup ve los dos botones, uno sobre otro.
 */

const ADMIN: MemberProfile = {
  id: 'a-1', email: 'admin@sur.es', fullName: 'Juan Martínez', role: 'ADMIN', state: 'ACTIVE',
  orgId: 'org-1', orgName: 'Rodamientos del Sur SL', orgCountry: 'ES',
};

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({ state: { status: 'authenticated', profile: ADMIN }, error: null, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
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

describe('App · pie del menú', () => {
  it('Configuración abre INVT-01 y Seguridad abre SET-SEC-01, y cada una cierra la otra', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Seguridad' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cambiar backup passphrase' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Gestión de invitaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cambiar backup passphrase' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Seguridad' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cambiar backup passphrase' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gestión de invitaciones' })).not.toBeInTheDocument();
  });
});
