import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import type { MemberProfile } from '../lib/session';

const profile: MemberProfile = {
  id: 'a1000000-0000-4000-8000-00000000000a',
  email: 'alpha@bearingworld.test',
  fullName: 'Alvaro Alpha',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  orgName: 'Rodamientos Ibericos',
  orgCountry: 'ES',
};

function renderShell() {
  const onSignOut = vi.fn();
  render(
    <AppShell profile={profile} onSignOut={onSignOut}>
      <div>contenido</div>
    </AppShell>,
  );
  // El shell tiene DOS navegaciones con los mismos ocho ítems (barra superior y
  // menú lateral). Toda consulta de ítem se acota a una de las dos, o no es
  // unívoca.
  return {
    onSignOut,
    topNav: screen.getByRole('navigation', { name: 'Navegación principal' }),
    sideNav: screen.getByRole('navigation', { name: 'Navegación lateral' }),
  };
}

describe('AppShell', () => {
  it('pinta la organización y el usuario de la sesión, no datos de ejemplo', () => {
    renderShell();
    expect(screen.getByTestId('nav-org')).toHaveTextContent('Rodamientos Ibericos');
    expect(screen.getByTestId('nav-user')).toHaveTextContent('Alvaro Alpha');
    // El shell aprobado traía estos dos literales; no deben sobrevivir.
    expect(screen.queryByText('Rodamientos del Sur SL')).not.toBeInTheDocument();
    expect(screen.queryByText('Juan Martínez')).not.toBeInTheDocument();
  });

  it('tiene los ocho ítems de nav en el orden del shell aprobado', () => {
    const { topNav } = renderShell();
    const labels = within(topNav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels).toEqual([
      'Panel',
      'Vendiendo',
      'Comprando',
      'Hilos',
      'Inventario',
      'Empresas',
      'Foros',
      'Contacto',
    ]);
  });

  it('el menú lateral repite los mismos ocho ítems', () => {
    const { sideNav } = renderShell();
    expect(within(sideNav).getAllByRole('button')).toHaveLength(8);
  });

  it('arranca con Panel activo', () => {
    const { topNav } = renderShell();
    expect(
      within(topNav).getByRole('button', { name: 'Panel', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('mueve el activo al pulsar otro ítem, y arrastra el del menú lateral', async () => {
    const { topNav, sideNav } = renderShell();
    await userEvent.click(within(topNav).getByRole('button', { name: 'Inventario' }));

    expect(
      within(topNav).getByRole('button', { name: 'Inventario', current: 'page' }),
    ).toBeInTheDocument();
    expect(
      within(topNav).queryByRole('button', { name: 'Panel', current: 'page' }),
    ).not.toBeInTheDocument();
    // Las dos navegaciones son la misma selección: el shell aprobado las
    // sincroniza en setAct().
    expect(
      within(sideNav).getByRole('button', { name: 'Inventario', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('pulsar en el menú lateral también mueve la barra superior', async () => {
    const { topNav, sideNav } = renderShell();
    await userEvent.click(within(sideNav).getByRole('button', { name: 'Hilos' }));
    expect(
      within(topNav).getByRole('button', { name: 'Hilos', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('los tres textos de la brand bar son los literales aprobados', () => {
    renderShell();
    expect(
      screen.getByText('ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY'),
    ).toBeInTheDocument();
    expect(screen.getByText('CONNECT · TRADE · SECURE')).toBeInTheDocument();
    expect(screen.getByText('INDUSTRIAL INTELLIGENCE NETWORK')).toBeInTheDocument();
  });

  it('muestra las iniciales del miembro en el avatar', () => {
    renderShell();
    expect(screen.getByText('AA')).toBeInTheDocument();
  });

  it('llama a onSignOut al cerrar sesión', async () => {
    const { onSignOut } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('renderiza el contenido que recibe', () => {
    renderShell();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
