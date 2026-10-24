import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrganizationProfile as OrganizationProfileData } from '../../lib/organization';
import type { MemberProfile } from '../../lib/session';

/**
 * FUERA DE CONTRATO · Favoritos desde la ficha (DIR-02) · decisión del PO, 24-oct-2026 (`F-280`). Escrito a mano.
 *
 * La ficha de otra organización ofrece «Añadir a favoritos» / «Quitar de favoritos» a cualquier miembro
 * activo (ADMIN o EDITOR: el favorito es del miembro, no del perfil), y SIEMPRE con la confirmación. En la
 * ficha de la PROPIA organización no hay botón, sea quien sea quien la mira.
 *
 * Se mockea solo la red: `fetchOrganizationProfile` y `fetchThreadWithOrg` (organization), y
 * `fetchFavoriteOrgIds` y `toggleFavorite` (search). Lo que no cubre: que `favorite_distributors` acepte de
 * verdad el INSERT/DELETE con la RLS real; eso lo ejerce el e2e `favorites.spec.ts` contra la base.
 */

const fetchOrganizationProfile = vi.fn<(id: string) => Promise<OrganizationProfileData | null>>();
const fetchThreadWithOrg = vi.fn<(own: string, other: string) => Promise<string | null>>();
const fetchFavoriteOrgIds = vi.fn<(memberId: string) => Promise<Set<string>>>();
const toggleFavorite = vi.fn<(memberId: string, orgId: string, next: boolean) => Promise<void>>();

vi.mock('../../lib/organization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/organization')>()),
  fetchOrganizationProfile: (id: string) => fetchOrganizationProfile(id),
  fetchThreadWithOrg: (own: string, other: string) => fetchThreadWithOrg(own, other),
}));

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchFavoriteOrgIds: (memberId: string) => fetchFavoriteOrgIds(memberId),
  toggleFavorite: (m: string, o: string, n: boolean) => toggleFavorite(m, o, n),
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
const editor: MemberProfile = { ...profile, id: 'a1000000-0000-4000-8000-00000000000b', role: 'EDITOR' };

const NSK: OrganizationProfileData = {
  id: 'org-nsk',
  name: 'NSK Europe Ltd',
  initials: 'NSK',
  countryLabel: 'Alemania',
  address: 'Heinrich-Hertz-Strasse 1',
  city: 'Erkrath',
  postalCode: '40699',
  addressLines: ['Heinrich-Hertz-Strasse 1', '40699 Erkrath'],
  memberSince: 'Febrero 2024',
  phone: '+49 211 5288 0',
  email: 'contact@nskeurope.de',
  favoriteCount: 21,
  status: 'ACTIVA',
};

function mount(over: Partial<{ profile: MemberProfile; organizationId: string }> = {}) {
  return render(
    <OrganizationProfile profile={profile} organizationId="org-nsk" onBack={vi.fn()} onOpenThread={vi.fn()} {...over} />,
  );
}

beforeEach(() => {
  fetchOrganizationProfile.mockReset().mockResolvedValue(NSK);
  fetchThreadWithOrg.mockReset().mockResolvedValue(null);
  fetchFavoriteOrgIds.mockReset().mockResolvedValue(new Set());
  toggleFavorite.mockReset().mockResolvedValue();
});

describe('Ficha · favoritos', () => {
  it('en la ficha de otra organización ofrece «Añadir a favoritos» y el clic solo abre la confirmación', async () => {
    mount();
    const boton = await screen.findByRole('button', { name: /Añadir a favoritos/ });
    expect(boton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(boton);

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('¿Añadir a NSK Europe Ltd a tus favoritos?')).toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('confirmar añade, el botón pasa a «Quitar de favoritos» y el recuento se relee de la base', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir a favoritos/ }));
    fetchOrganizationProfile.mockResolvedValue({ ...NSK, favoriteCount: 22 });

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Añadir a favoritos' }));

    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-nsk', true));
    expect(await screen.findByRole('button', { name: /Quitar de favoritos/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('★ 22 favoritos')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quitar también pide confirmación, con su texto, y escribe false', async () => {
    fetchFavoriteOrgIds.mockResolvedValue(new Set(['org-nsk']));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: /Quitar de favoritos/ }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('¿Quitar a NSK Europe Ltd de tus favoritos?')).toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Quitar de favoritos' }));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(profile.id, 'org-nsk', false));
    expect(await screen.findByRole('button', { name: /Añadir a favoritos/ })).toBeInTheDocument();
  });

  it('Cancelar cierra la confirmación y no escribe', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir a favoritos/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggleFavorite).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Añadir a favoritos/ })).toBeInTheDocument();
  });

  it('un EDITOR también puede: el favorito es del miembro, no del rol', async () => {
    mount({ profile: editor });
    await userEvent.click(await screen.findByRole('button', { name: /Añadir a favoritos/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Añadir a favoritos' }));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith(editor.id, 'org-nsk', true));
  });

  it.each([
    ['ADMIN', profile],
    ['EDITOR', editor],
  ])('en la ficha de la PROPIA organización no hay botón de favoritos (%s)', async (_rol, quien) => {
    fetchOrganizationProfile.mockResolvedValue({ ...NSK, id: quien.orgId, name: quien.orgName });
    mount({ profile: quien, organizationId: quien.orgId });

    await screen.findByRole('heading', { level: 1, name: quien.orgName });
    expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
    expect(fetchFavoriteOrgIds).not.toHaveBeenCalled();
  });

  it('si no se puede saber si es favorita, no se ofrece ninguna acción', async () => {
    fetchFavoriteOrgIds.mockRejectedValue(new Error('sin red'));
    mount();

    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    await waitFor(() => expect(fetchFavoriteOrgIds).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
  });

  it('si la escritura falla, el error sale dentro de la confirmación y el estado no cambia', async () => {
    toggleFavorite.mockRejectedValueOnce(new Error('boom'));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: /Añadir a favoritos/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Añadir a favoritos' }));

    expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: /Añadir a favoritos/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
