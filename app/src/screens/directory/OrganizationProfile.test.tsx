import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrganizationProfile as OrganizationProfileData } from '../../lib/organization';
import type { MemberProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · DIR-02 · pantalla (`OrganizationProfile`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no lo ve.
 *
 * Se mockean **solo** las dos funciones de `lib/organization` que tocan red
 * (`fetchOrganizationProfile`, `fetchThreadWithOrg`). El resto del módulo —los
 * formateadores puros `favoritesLabel`, `telHref`…— sigue siendo el de verdad:
 * mockearlo convertiría esto en una comprobación de los mocks, no de la pantalla.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe
 * `app/e2e/organization-profile.spec.ts`: que la ficha lea de verdad la fila de la
 * base (con `0036` aplicada) y no un ejemplo pintado, y que `Contactar` encuentre
 * el hilo real entre las dos organizaciones.
 */

const fetchOrganizationProfile = vi.fn<(id: string) => Promise<OrganizationProfileData | null>>();
const fetchThreadWithOrg = vi.fn<(own: string, other: string) => Promise<string | null>>();

vi.mock('../../lib/organization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/organization')>()),
  fetchOrganizationProfile: (id: string) => fetchOrganizationProfile(id),
  fetchThreadWithOrg: (own: string, other: string) => fetchThreadWithOrg(own, other),
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

/** El ejemplo del HTML aprobado. */
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

const NOTA =
  'Los datos de contacto son visibles para todos los miembros de la plataforma, independientemente de la configuración de visibilidad de inventario.';

function mount(over: Partial<{ organizationId: string; onBack: () => void; onOpenThread: (id: string) => void }> = {}) {
  const props = {
    profile,
    organizationId: 'org-nsk',
    onBack: vi.fn(),
    onOpenThread: vi.fn(),
    ...over,
  };
  const view = render(<OrganizationProfile {...props} />);
  return { ...view, props };
}

/** El valor (`<dd>`) que acompaña a una etiqueta (`<dt>`) dentro de una tarjeta. */
function valorDe(tarjeta: HTMLElement, etiqueta: string): HTMLElement {
  const dt = within(tarjeta).getByText(etiqueta, { selector: 'dt' });
  const dd = dt.nextElementSibling as HTMLElement | null;
  expect(dd?.tagName).toBe('DD');
  return dd!;
}

beforeEach(() => {
  fetchOrganizationProfile.mockReset();
  fetchThreadWithOrg.mockReset();
  fetchOrganizationProfile.mockResolvedValue(NSK);
  fetchThreadWithOrg.mockResolvedValue(null);
});

describe('DIR-02 · OrganizationProfile · carga', () => {
  it('mientras llega la ficha dice «Cargando ficha…» en una región de estado', () => {
    fetchOrganizationProfile.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando ficha…');
  });

  it('pide la ficha de la organización recibida y el hilo entre las dos organizaciones', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    expect(fetchOrganizationProfile).toHaveBeenCalledWith('org-nsk');
    expect(fetchThreadWithOrg).toHaveBeenCalledWith(profile.orgId, 'org-nsk');
  });

  it('si cambia la organización recibida, vuelve a pedir la ficha', async () => {
    const { rerender, props } = mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    fetchOrganizationProfile.mockResolvedValue({ ...NSK, id: 'org-otra', name: 'Otra SL', initials: 'OS' });
    rerender(<OrganizationProfile {...props} organizationId="org-otra" />);
    await screen.findByRole('heading', { level: 1, name: 'Otra SL' });
    expect(fetchOrganizationProfile).toHaveBeenLastCalledWith('org-otra');
  });
});

describe('DIR-02 · OrganizationProfile · la cabecera', () => {
  it('eyebrow, título (h1), avatar con las iniciales, país, favoritos y estado', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' })).toBeInTheDocument();
    expect(screen.getByText('Directorio de Organizaciones')).toBeInTheDocument();
    expect(screen.getByTestId('org-avatar')).toHaveTextContent('NSK');
    expect(screen.getByTestId('org-country')).toHaveTextContent('Alemania');
    expect(screen.getByText('★ 21 favoritos')).toBeInTheDocument();
    expect(screen.getByText('ACTIVA')).toBeInTheDocument();
  });

  it('con un solo favorito lo dice en singular', async () => {
    fetchOrganizationProfile.mockResolvedValue({ ...NSK, favoriteCount: 1 });
    mount();
    expect(await screen.findByText('★ 1 favorito')).toBeInTheDocument();
  });

  it('el breadcrumb es una navegación «Ruta» con «Empresas» (botón) y el nombre de la organización', async () => {
    const { props } = mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    const ruta = screen.getByRole('navigation', { name: 'Ruta' });
    expect(within(ruta).getByText('NSK Europe Ltd')).toBeInTheDocument();
    await userEvent.setup().click(within(ruta).getByRole('button', { name: 'Empresas' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});

describe('DIR-02 · OrganizationProfile · las dos tarjetas', () => {
  it('«Información general»: país, dirección en dos líneas, código postal y miembro desde', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    const tarjeta = screen.getByRole('region', { name: 'Información general' });

    expect(valorDe(tarjeta, 'País')).toHaveTextContent('Alemania');
    const direccion = valorDe(tarjeta, 'Dirección');
    expect(within(direccion).getByText('Heinrich-Hertz-Strasse 1')).toBeInTheDocument();
    expect(within(direccion).getByText('40699 Erkrath')).toBeInTheDocument();
    expect(valorDe(tarjeta, 'Código postal')).toHaveTextContent('40699');
    expect(valorDe(tarjeta, 'Miembro desde')).toHaveTextContent('Febrero 2024');
  });

  it('«Contacto público»: el teléfono es un enlace tel: y el email un enlace mailto:', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    const tarjeta = screen.getByRole('region', { name: 'Contacto público' });

    const tel = within(tarjeta).getByRole('link', { name: '+49 211 5288 0' });
    expect(tel).toHaveAttribute('href', 'tel:+4921152880');
    const mail = within(tarjeta).getByRole('link', { name: 'contact@nskeurope.de' });
    expect(mail).toHaveAttribute('href', 'mailto:contact@nskeurope.de');
  });

  it('«Contacto público» lleva la nota de que el contacto no depende de la visibilidad del inventario', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    const tarjeta = screen.getByRole('region', { name: 'Contacto público' });
    expect(within(tarjeta).getByText(NOTA)).toBeInTheDocument();
  });

  it('lo que la organización no tiene se pinta como «—», sin enlaces rotos ni «undefined»', async () => {
    fetchOrganizationProfile.mockResolvedValue({
      ...NSK,
      address: '',
      city: '',
      postalCode: '',
      addressLines: [],
      phone: '',
      email: '',
    });
    mount();
    await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' });
    const general = screen.getByRole('region', { name: 'Información general' });
    const contacto = screen.getByRole('region', { name: 'Contacto público' });

    expect(valorDe(general, 'Dirección')).toHaveTextContent('—');
    expect(valorDe(general, 'Código postal')).toHaveTextContent('—');
    expect(valorDe(contacto, 'Teléfono')).toHaveTextContent('—');
    expect(valorDe(contacto, 'Email')).toHaveTextContent('—');
    expect(within(contacto).queryByRole('link')).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/);
  });
});

describe('DIR-02 · OrganizationProfile · Contactar', () => {
  it('con un hilo ya existente el botón está habilitado y lo abre', async () => {
    fetchThreadWithOrg.mockResolvedValue('thread-42');
    const { props } = mount();
    const boton = await screen.findByRole('button', { name: 'Contactar' });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.setup().click(boton);
    expect(props.onOpenThread).toHaveBeenCalledTimes(1);
    expect(props.onOpenThread).toHaveBeenCalledWith('thread-42');
  });

  it('sin hilo previo está deshabilitado y dice por qué; pulsarlo no abre nada', async () => {
    fetchThreadWithOrg.mockResolvedValue(null);
    const { props } = mount();
    const boton = await screen.findByRole('button', { name: 'Contactar' });
    await waitFor(() => expect(fetchThreadWithOrg).toHaveBeenCalled());
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute(
      'title',
      'Todavía no tienes un hilo con esta organización. Iniciar uno sin referencia llega con la mensajería.',
    );
    await userEvent.setup().click(boton);
    expect(props.onOpenThread).not.toHaveBeenCalled();
  });

  it('mientras se busca el hilo el botón sigue deshabilitado: no se puede pulsar antes de saber si existe', async () => {
    fetchThreadWithOrg.mockReturnValue(new Promise(() => {}));
    mount();
    const boton = await screen.findByRole('button', { name: 'Contactar' });
    expect(boton).toBeDisabled();
  });

  it('si la búsqueda del hilo falla, la ficha se ve igual y Contactar queda deshabilitado', async () => {
    fetchThreadWithOrg.mockRejectedValue(new Error('sin red'));
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'NSK Europe Ltd' })).toBeInTheDocument();
    await waitFor(() => expect(fetchThreadWithOrg).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeDisabled();
  });

  it('en la ficha de la PROPIA organización Contactar está deshabilitado y no busca ningún hilo', async () => {
    fetchOrganizationProfile.mockResolvedValue({ ...NSK, id: profile.orgId, name: 'Rodamientos Ibéricos', initials: 'RI' });
    mount({ organizationId: profile.orgId });
    const boton = await screen.findByRole('button', { name: 'Contactar' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('title', 'Es tu propia organización.');
    expect(fetchThreadWithOrg).not.toHaveBeenCalled();
  });
});

describe('DIR-02 · OrganizationProfile · cuando no hay ficha', () => {
  it('una organización que no existe o no es visible dice «Esta organización no está disponible.» y deja volver', async () => {
    fetchOrganizationProfile.mockResolvedValue(null);
    const { props } = mount();
    expect(await screen.findByText('Esta organización no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contactar' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al directorio' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red se dice en una alerta con el motivo y deja volver; no se pinta una ficha vacía', async () => {
    fetchOrganizationProfile.mockRejectedValue(new Error('Fallo de red'));
    const { props } = mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo de red');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al directorio' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
