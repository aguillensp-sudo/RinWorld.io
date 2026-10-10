import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { OrganizationProfile as OrganizationProfileData } from '../../lib/organization';
import type { MemberProfile } from '../../lib/session';

/**
 * El nombre del administrador en la ficha (DIR-02, 0058). **Ninguna tarea del corpus lo pide**:
 * va en fichero aparte para que `OrganizationProfile.test.tsx` siga siendo el contrato que midió
 * al Coder.
 */

const fetchOrganizationProfile = vi.fn<(id: string) => Promise<OrganizationProfileData | null>>();
const fetchThreadWithOrg = vi.fn<(own: string, other: string) => Promise<string | null>>();
const fetchOrganizationAdminName = vi.fn<(id: string) => Promise<string>>();

vi.mock('../../lib/organization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/organization')>()),
  fetchOrganizationProfile: (id: string) => fetchOrganizationProfile(id),
  fetchThreadWithOrg: (own: string, other: string) => fetchThreadWithOrg(own, other),
  fetchOrganizationAdminName: (id: string) => fetchOrganizationAdminName(id),
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
  id: 'org-x',
  name: 'Rey Transmisiones',
  initials: 'RT',
  countryLabel: 'Zimbabue',
  address: 'Totem, 24',
  city: '',
  postalCode: '',
  addressLines: ['Totem, 24'],
  memberSince: 'Octubre 2026',
  phone: '',
  email: '',
  favoriteCount: 0,
  status: 'ACTIVA',
};

function mount() {
  render(<OrganizationProfile profile={profile} organizationId="org-x" onBack={vi.fn()} onOpenThread={vi.fn()} />);
}

/** El valor (`<dd>`) de «Administrador», en la tarjeta de contacto público. */
async function administrador(): Promise<string> {
  const tarjeta = await screen.findByRole('region', { name: 'Contacto público' });
  const dt = within(tarjeta).getByText('Administrador', { selector: 'dt' });
  return (dt.nextElementSibling as HTMLElement).textContent ?? '';
}

beforeEach(() => {
  fetchOrganizationProfile.mockReset().mockResolvedValue(ORG);
  fetchThreadWithOrg.mockReset().mockResolvedValue(null);
  fetchOrganizationAdminName.mockReset();
});

describe('DIR-02 · el administrador', () => {
  it('enseña el nombre de la persona administradora', async () => {
    fetchOrganizationAdminName.mockResolvedValue('Ana Rey');
    mount();
    await waitFor(async () => expect(await administrador()).toBe('Ana Rey'));
    expect(fetchOrganizationAdminName).toHaveBeenCalledWith('org-x');
  });

  it('si no hay nombre, un guion y la ficha sigue entera', async () => {
    fetchOrganizationAdminName.mockResolvedValue('');
    mount();
    expect(await administrador()).toBe('—');
    expect(screen.getByRole('heading', { level: 1, name: 'Rey Transmisiones' })).toBeInTheDocument();
  });
});
