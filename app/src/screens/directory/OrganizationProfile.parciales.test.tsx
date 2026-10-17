import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { OrganizationProfile as OrganizationProfileData } from '../../lib/organization';
import type { MemberProfile } from '../../lib/session';

/**
 * PARCIALES · organization-directory/organization-public-profile#1
 *
 * GIVEN un miembro que accede a la ficha pública de una organización
 * WHEN la pantalla MSG-04 carga
 * THEN muestra nombre, país, dirección completa, código postal y fecha de incorporación
 * AND muestra el nombre de la persona administradora
 * AND muestra email y teléfono de contacto público
 * AND muestra el recuento de favoritos de esa organización
 *
 * Una sola ficha con todos los datos distintos entre sí, para que un campo
 * pintado en el sitio de otro no pase.
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
  id: 'm1',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'o-propia',
  orgName: 'Rodamientos Ibéricos',
  orgCountry: 'ES',
};

const ORG: OrganizationProfileData = {
  id: 'org-x',
  name: 'Cojinetes Tramontana SA',
  initials: 'CT',
  countryLabel: 'Portugal',
  address: 'Rua das Flores 12',
  city: 'Porto',
  postalCode: '4050-262',
  addressLines: ['Rua das Flores 12', '4050-262 Porto'],
  memberSince: 'Marzo 2025',
  phone: '+351 22 000 1234',
  email: 'geral@tramontana.example',
  favoriteCount: 17,
  status: 'ACTIVA',
};

beforeEach(() => {
  fetchOrganizationProfile.mockReset().mockResolvedValue(ORG);
  fetchThreadWithOrg.mockReset().mockResolvedValue(null);
  fetchOrganizationAdminName.mockReset().mockResolvedValue('Inés Carvalho');
});

describe('OrganizationProfile (parciales)', () => {
  it('organization-directory/organization-public-profile#1 · la ficha muestra todos los datos de la spec, incluido el administrador', async () => {
    render(<OrganizationProfile profile={profile} organizationId="org-x" onBack={vi.fn()} onOpenThread={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Cojinetes Tramontana SA' })).toBeInTheDocument();
    expect(screen.getByTestId('org-country')).toHaveTextContent('Portugal');
    expect(screen.getByText('★ 17 favoritos')).toBeInTheDocument();

    const valor = (region: HTMLElement, etiqueta: string) =>
      within(region).getByText(etiqueta, { selector: 'dt' }).nextElementSibling as HTMLElement;

    const contacto = await screen.findByRole('region', { name: 'Contacto público' });
    await vi.waitFor(() => expect(valor(contacto, 'Administrador')).toHaveTextContent('Inés Carvalho'));
    expect(valor(contacto, 'Teléfono')).toHaveTextContent('+351 22 000 1234');
    expect(valor(contacto, 'Email')).toHaveTextContent('geral@tramontana.example');
    expect(fetchOrganizationAdminName).toHaveBeenCalledWith('org-x');

    const datos = screen.getByText('Código postal', { selector: 'dt' }).closest('section') as HTMLElement;
    expect(valor(datos, 'Dirección')).toHaveTextContent('Rua das Flores 12');
    expect(valor(datos, 'Dirección')).toHaveTextContent('4050-262 Porto');
    expect(valor(datos, 'Código postal')).toHaveTextContent('4050-262');
    expect(valor(datos, 'Miembro desde')).toHaveTextContent('Marzo 2025');
  });
});
