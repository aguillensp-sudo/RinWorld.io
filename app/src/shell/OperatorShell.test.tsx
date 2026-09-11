import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperatorShell, operatorNavIndexOf } from './OperatorShell';
import type { OperatorProfile } from '../lib/session';

/**
 * Espejo de `AppShell.test.tsx`, sobre el shell del Operador -- mismo criterio
 * (día 3): quien decide el ítem activo es quien monta el shell, no el shell.
 */

const operator: OperatorProfile = {
  id: 'op-1000000-0000-4000-8000-000000000001',
  email: 'operador@bearingworld.test',
  fullName: 'Admin Principal',
};

function Harness({ onSignOut }: { onSignOut: () => void }) {
  const [nav, setNav] = useState(operatorNavIndexOf('Solicitudes'));
  return (
    <OperatorShell operator={operator} onSignOut={onSignOut} activeNav={nav} onNavigate={setNav}>
      <div>contenido</div>
    </OperatorShell>
  );
}

function renderShell() {
  const onSignOut = vi.fn();
  render(<Harness onSignOut={onSignOut} />);
  return {
    onSignOut,
    topNav: screen.getByRole('navigation', { name: 'Navegación principal' }),
    sideNav: screen.getByRole('navigation', { name: 'Navegación lateral' }),
  };
}

describe('OperatorShell', () => {
  it('pinta al operador, no una organización -no tiene ninguna-', () => {
    renderShell();
    expect(screen.getByTestId('nav-org')).toHaveTextContent('Admin Principal');
    expect(screen.getByTestId('nav-user')).toHaveTextContent('Bearingworld.io');
    expect(screen.getByText('Operador · Bearingworld.io')).toBeInTheDocument();
  });

  it('lleva la píldora "Operador", que el shell de miembro no tiene', () => {
    renderShell();
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('tiene los cinco ítems propios del Operador, no los ocho del miembro', () => {
    const { topNav } = renderShell();
    const labels = within(topNav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels).toEqual(['Panel', 'Solicitudes', 'Organizaciones', 'Log de auditoría', 'Sistema']);
  });

  it('el menú lateral repite los mismos cinco ítems', () => {
    const { sideNav } = renderShell();
    expect(within(sideNav).getAllByRole('button')).toHaveLength(5);
  });

  it('arranca con Solicitudes activo -es la única de las cinco con pantalla-', () => {
    const { topNav } = renderShell();
    expect(
      within(topNav).getByRole('button', { name: 'Solicitudes', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('mueve el activo al pulsar otro ítem, y arrastra el del menú lateral', async () => {
    const { topNav, sideNav } = renderShell();
    await userEvent.click(within(topNav).getByRole('button', { name: 'Panel' }));
    expect(within(topNav).getByRole('button', { name: 'Panel', current: 'page' })).toBeInTheDocument();
    expect(within(sideNav).getByRole('button', { name: 'Panel', current: 'page' })).toBeInTheDocument();
  });

  it('los tres textos de la brand bar son los mismos literales aprobados que el shell de miembro', () => {
    renderShell();
    expect(screen.getByText('ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY')).toBeInTheDocument();
    expect(screen.getByText('CONNECT · TRADE · SECURE')).toBeInTheDocument();
    expect(screen.getByText('INDUSTRIAL INTELLIGENCE NETWORK')).toBeInTheDocument();
  });

  it('muestra las iniciales del operador en el avatar', () => {
    renderShell();
    expect(screen.getByText('AP')).toBeInTheDocument();
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

  it('monta VERA desconectada -sin agente-, con su propio subtítulo', async () => {
    const user = userEvent.setup();
    render(
      <OperatorShell
        operator={operator}
        onSignOut={vi.fn()}
        activeNav={0}
        onNavigate={vi.fn()}
        veraSubtitle="Asistente del operador"
      >
        <div />
      </OperatorShell>,
    );
    expect(screen.getByText('Asistente del operador')).toBeInTheDocument();
    // Sin `agent`, VeraPanel no lo dice hasta que se le pregunta algo.
    await user.type(screen.getByLabelText('Pregunta a VERA'), '¿cuántas pendientes hay?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Todavía no estoy conectada/)).toBeInTheDocument();
  });

  it('operatorNavIndexOf resuelve los ítems por nombre y cae en Panel si no existe', () => {
    expect(operatorNavIndexOf('Panel')).toBe(0);
    expect(operatorNavIndexOf('Solicitudes')).toBe(1);
    expect(operatorNavIndexOf('Sistema')).toBe(4);
    expect(operatorNavIndexOf('Pantalla que no existe')).toBe(0);
  });
});
