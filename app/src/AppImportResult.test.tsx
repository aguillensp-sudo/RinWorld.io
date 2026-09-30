import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * CONTRATO DE CABLEADO · INV-03 en `App.tsx`. Lo escribe Claude Code (el wiring es suyo, no
 * del Coder): comprueba que la pantalla se monta en `Inventario`, con el ejemplo que pide la
 * URL, y que sus dos botones vuelven a INV-01.
 *
 * ⚠ La ruta `#importacion-ejemplo=…` existe SOLO en desarrollo (`import.meta.env.DEV`); vitest
 * corre en modo desarrollo, el build de producción no. Por eso no hay e2e de INV-03: la
 * suite e2e corre contra el build y en él INV-03 no es alcanzable (INV-02, que la abriría, no
 * existe).
 */

const profile: MemberProfile = {
  id: 'm-1',
  email: 'editor@bearingworld.test',
  fullName: 'Editor de prueba',
  role: 'EDITOR',
  state: 'ACTIVE',
  orgId: 'org-1',
  orgName: 'Rodamientos de prueba',
  orgCountry: 'ES',
};

vi.mock('./lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/session')>()),
  useSession: () => ({
    state: { status: 'authenticated', profile },
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// El inventario real pide sus líneas a la base al montarse: aquí solo importa que se monte.
vi.mock('./screens/inventory/Inventory', () => ({
  Inventory: () => <div data-testid="inventory-stub">Mi inventario</div>,
}));

const { App } = await import('./App');

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => {
  window.location.hash = '';
});

describe('App · INV-03', () => {
  it('sin ejemplo en la URL no aparece: el inventario sigue siendo INV-01', async () => {
    render(<App />);
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
  });

  it('#importacion-ejemplo=warn abre INV-03 con el ejemplo de advertencias', async () => {
    window.location.hash = '#importacion-ejemplo=warn';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Importación completada con advertencias' })).toBeInTheDocument();
    expect(screen.getByTestId('import-result')).toHaveAttribute('data-outcome', 'warn');
    expect(screen.queryByTestId('inventory-stub')).not.toBeInTheDocument();
  });

  it('también cuando el hash cambia con la app ya abierta (pegar el enlace en la pestaña)', async () => {
    render(<App />);
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
    await act(async () => {
      window.location.hash = '#importacion-ejemplo=fail';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'La importación no ha podido completarse' })).toBeInTheDocument();
  });

  it('«Volver al panel de inventario» lleva a INV-01', async () => {
    const user = userEvent.setup();
    window.location.hash = '#importacion-ejemplo=ok';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Volver al panel de inventario' }));
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
    expect(await screen.findByTestId('inventory-stub')).toBeInTheDocument();
  });

  it('«Subir correcciones» también lleva a INV-01', async () => {
    const user = userEvent.setup();
    window.location.hash = '#importacion-ejemplo=warn';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Subir correcciones' }));
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
    expect(await screen.findByTestId('inventory-stub')).toBeInTheDocument();
  });

  it('cambiar de ítem del nav cierra INV-03', async () => {
    const user = userEvent.setup();
    window.location.hash = '#importacion-ejemplo=warn';
    render(<App />);
    await screen.findByTestId('import-result');
    // El ítem está dos veces (barra de navegación y menú lateral): vale cualquiera.
    await user.click(screen.getAllByRole('button', { name: 'Panel' })[0] as HTMLElement);
    expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
  });
});
