import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * INV-01 con `onPickFile`: la subida manual que abre INV-02. Lo escribe Claude Code (es
 * cableado, no pantalla del Coder) y va en un fichero aparte para no tocar el contrato de
 * INV-01 (`Inventory.test.tsx`), que monta `<Inventory profile now />` sin el prop y sigue
 * esperando la subida inerte.
 */

const fetchPage = vi.fn<(q: PageQuery) => Promise<Page>>();
const fetchStats = vi.fn<() => Promise<Stats>>();

vi.mock('../../lib/inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/inventory')>()),
  fetchPage: (q: PageQuery) => fetchPage(q),
  fetchStats: () => fetchStats(),
}));

const { Inventory } = await import('./Inventory');

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

beforeEach(() => {
  fetchPage.mockReset().mockResolvedValue({ lines: [], total: 0 } as unknown as Page);
  fetchStats.mockReset().mockResolvedValue({ published: 0, stale: 0, lastUploadAt: null, visits: null });
});

function renderWith(onPickFile = vi.fn()) {
  render(<Inventory profile={profile} now={new Date('2026-10-02T12:00:00Z')} onPickFile={onPickFile} />);
  return onPickFile;
}

describe('INV-01 · subida manual (con onPickFile)', () => {
  it('el canal manual dice «Siempre disponible» y solo el email sigue fuera', async () => {
    renderWith();
    expect(screen.getByText('Siempre disponible')).toBeInTheDocument();
    expect(screen.getAllByText('Próximamente')).toHaveLength(1);
    expect(screen.queryByText('Fuera del MVP')).toBeNull();
    expect(screen.getByTestId('channels-scope')).toHaveTextContent('El canal email (INV-04) todavía no está disponible');
    // La dirección de ingestión sigue sin inventarse.
    expect(screen.getByTestId('ingest-addr')).toHaveTextContent('—');
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('«Subir nuevo inventario» está habilitado y sin el motivo de «fuera del MVP»', async () => {
    renderWith();
    const btn = screen.getByRole('button', { name: /Subir nuevo inventario/i });
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveAttribute('title');
    expect(screen.queryByText(/INV-02\) está fuera del alcance del MVP/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('elegir un CSV en el selector llama a onPickFile con ese archivo', async () => {
    const user = userEvent.setup();
    const onPickFile = renderWith();
    const file = new File(['Ref;Marca\n6205;SKF'], 'inv.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('inventory-file-input'), file);
    expect(onPickFile).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el input admite exactamente los formatos de la dropzone', async () => {
    renderWith();
    expect(screen.getByTestId('inventory-file-input')).toHaveAttribute('accept', '.csv,.tsv,.txt,.xlsx,.xls');
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('un formato no admitido no llama y pinta el error del HTML aprobado', async () => {
    const onPickFile = renderWith();
    const pdf = new File(['%PDF'], 'inv.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('inventory-file-input'), { target: { files: [pdf] } });
    expect(onPickFile).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Formato no admitido. Sube un CSV, XLSX, XLS, TSV o TXT de máx. 50 MB.',
    );
  });

  it('soltar un archivo en la dropzone también lo entrega', async () => {
    const onPickFile = renderWith();
    const file = new File(['a;b'], 'inv.tsv');
    fireEvent.drop(screen.getByTestId('inventory-dropzone'), { dataTransfer: { files: [file] } });
    expect(onPickFile).toHaveBeenCalledWith(file);
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });

  it('la dropzone es un botón que abre el selector', async () => {
    const user = userEvent.setup();
    renderWith();
    const input = screen.getByTestId('inventory-file-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByTestId('inventory-dropzone'));
    expect(click).toHaveBeenCalled();
  });
});
