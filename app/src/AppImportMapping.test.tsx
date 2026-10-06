import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MemberProfile } from './lib/session';

/**
 * CONTRATO DE CABLEADO · INV-01 → INV-02 → INV-03 en `App.tsx`. Lo escribe Claude Code (el
 * wiring es suyo, no del Coder): el archivo que entrega la subida manual abre INV-02, y
 * confirmar importa (la base, mockeada) y abre INV-03 con el resumen real. Queda rojo hasta
 * que exista la pantalla de INV-02.
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

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock('./lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => maybeSingle() }) }) }) }),
  },
}));

// INV-01 de verdad pide su inventario a la base; aquí basta con que entregue un archivo.
let nextFile: File;
vi.mock('./screens/inventory/Inventory', () => ({
  Inventory: ({ onPickFile }: { onPickFile?: (f: File) => void }) => (
    <div data-testid="inventory-stub">
      <button type="button" onClick={() => onPickFile?.(nextFile)}>
        elegir archivo
      </button>
    </div>
  ),
}));

// El panel (pantalla de inicio) también pide datos al montarse.
vi.mock('./screens/panel/Panel', () => ({ Panel: () => <div data-testid="panel-stub" /> }));

const { App } = await import('./App');

async function goToInventory(user: ReturnType<typeof userEvent.setup>) {
  // El ítem está dos veces (barra de navegación y menú lateral): vale cualquiera.
  await user.click((await screen.findAllByRole('button', { name: 'Inventario' }))[0] as HTMLElement);
}

const CSV = 'Ref;Marca;Uds;País\n6205-2RS;SKF;850;ES\nNU216;FAG;5;DE\nABC;SKF;1;ES\n';

beforeEach(() => {
  window.location.hash = '';
  rpc.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  nextFile = new File([CSV], 'inventario.csv', { type: 'text/csv' });
});

async function openInv02(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await goToInventory(user);
  await user.click(await screen.findByRole('button', { name: 'elegir archivo' }));
  return screen.findByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' });
}

describe('App · INV-02', () => {
  it('un CSV elegido en INV-01 abre INV-02 con su nombre', async () => {
    const user = userEvent.setup();
    await openInv02(user);
    expect(screen.getByText('inventario.csv')).toBeInTheDocument();
    expect(screen.queryByTestId('inventory-stub')).not.toBeInTheDocument();
  });

  it('«Cancelar y volver al inventario» vuelve a INV-01 sin escribir nada', async () => {
    const user = userEvent.setup();
    await openInv02(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar y volver al inventario' }));
    expect(await screen.findByTestId('inventory-stub')).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('confirmar importa las líneas válidas y abre INV-03 con el resumen real', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ data: { published: 2, removed: 4 }, error: null });
    await openInv02(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importación completada con advertencias' }),
    ).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('import_inventory', expect.objectContaining({ p_policy: 'REPLACE' }));
    expect(rpc.mock.calls[0]?.[1].p_lines).toHaveLength(2);
    expect(screen.getByTestId('stat-removed')).toHaveTextContent('4');
  });

  it('si la base rechaza el lote, se queda en INV-02 enseñando el motivo', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Límite de inventario alcanzado' } });
    await openInv02(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Límite de inventario alcanzado');
    expect(screen.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeInTheDocument();
  });

  it('si NINGUNA línea es válida, se queda en INV-02 con los motivos (no salta al fallo de INV-03)', async () => {
    const user = userEvent.setup();
    nextFile = new File([['Ref;Marca;Uds;País', 'ZZ-1;SKF;5;ES', 'ZZ-2;SKF;3;ES'].join('\n')], 'malo.csv');
    await openInv02(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Familia no identificable (2)');
    expect(screen.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('un perfil guardado para esta estructura se aplica y se anuncia', async () => {
    const user = userEvent.setup();
    maybeSingle.mockResolvedValueOnce({
      data: { name: 'Formato ERP', mapping: ['brand', 'part_number', 'quantity', 'location_country'] },
      error: null,
    });
    await openInv02(user);
    expect(screen.getByTestId('profile-banner')).toHaveTextContent('"Formato ERP"');
    expect(screen.getByRole('combobox', { name: 'Campo en plataforma para Ref' })).toHaveValue('brand');
  });

  it('un XLSX no pasa por INV-02: INV-03 en fallo, sin llamar a la base', async () => {
    const user = userEvent.setup();
    nextFile = new File(['PK'], 'inventario.xlsx');
    render(<App />);
    await goToInventory(user);
    await user.click(await screen.findByRole('button', { name: 'elegir archivo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'La importación no ha podido completarse' })).toBeInTheDocument();
    await waitFor(() => expect(rpc).not.toHaveBeenCalled());
  });

  it('cambiar de ítem del nav cierra INV-02', async () => {
    const user = userEvent.setup();
    await openInv02(user);
    await user.click(screen.getAllByRole('button', { name: 'Panel' })[0] as HTMLElement);
    expect(screen.queryByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).not.toBeInTheDocument();
  });
});
