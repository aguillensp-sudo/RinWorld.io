import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { OrganizationProfile as OrganizationProfileData } from '../../lib/organization';
import type { MemberProfile } from '../../lib/session';

/**
 * `Contactar` de la búsqueda lleva aquí con `autoCompose`: sin hilo, el cuadro «Primer mensaje» ya
 * abierto. **Ninguna tarea del corpus lo pide**: fichero aparte para no tocar el contrato de
 * `OrganizationProfile.test.tsx`.
 */

const fetchOrganizationProfile = vi.fn<(id: string) => Promise<OrganizationProfileData | null>>();
const fetchThreadWithOrg = vi.fn<(own: string, other: string) => Promise<string | null>>();

vi.mock('../../lib/organization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/organization')>()),
  fetchOrganizationProfile: (id: string) => fetchOrganizationProfile(id),
  fetchThreadWithOrg: (own: string, other: string) => fetchThreadWithOrg(own, other),
  fetchOrganizationAdminName: () => Promise.resolve(''),
}));

const { OrganizationProfile } = await import('./OrganizationProfile');

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

const ORG: OrganizationProfileData = {
  id: 'org-x', name: 'Levante', initials: 'LE', countryLabel: 'España', address: '', city: '', postalCode: '',
  addressLines: [], memberSince: 'Octubre 2026', phone: '', email: '', favoriteCount: 0, status: 'ACTIVA',
};

function mount(autoCompose: boolean) {
  render(
    <OrganizationProfile profile={profile} organizationId="org-x" onBack={vi.fn()} onOpenThread={vi.fn()} autoCompose={autoCompose} />,
  );
}

beforeEach(() => {
  fetchOrganizationProfile.mockReset().mockResolvedValue(ORG);
  fetchThreadWithOrg.mockReset();
});

describe('DIR-02 · autoCompose', () => {
  it('sin hilo y con autoCompose, el cuadro «Primer mensaje» sale abierto', async () => {
    fetchThreadWithOrg.mockResolvedValue(null);
    mount(true);
    expect(await screen.findByLabelText('Primer mensaje')).toBeInTheDocument();
  });

  it('sin autoCompose, el cuadro no se abre solo', async () => {
    fetchThreadWithOrg.mockResolvedValue(null);
    mount(false);
    await screen.findByRole('heading', { level: 1, name: 'Levante' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contactar' })).toBeEnabled());
    expect(screen.queryByLabelText('Primer mensaje')).not.toBeInTheDocument();
  });

  it('con hilo previo no abre el cuadro aunque se pida', async () => {
    fetchThreadWithOrg.mockResolvedValue('hilo-1');
    mount(true);
    await screen.findByRole('heading', { level: 1, name: 'Levante' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contactar' })).toBeEnabled());
    expect(screen.queryByLabelText('Primer mensaje')).not.toBeInTheDocument();
  });
});
