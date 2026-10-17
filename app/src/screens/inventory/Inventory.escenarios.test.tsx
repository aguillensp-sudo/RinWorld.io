import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Page, PageQuery, Stats } from '../../lib/inventory';
import type { MemberProfile } from '../../lib/session';

/**
 * ESCENARIOS DE SPEC de `inventory-management` sobre INV-01 (nivel unit). Salen de
 * `openspec/specs/inventory-management/spec.md`; cada `it` empieza por el id del escenario de
 * `openspec/v1/trazabilidad.csv`.
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
  fetchStats.mockReset().mockResolvedValue({ published: 0, stale: 0, lastUploadAt: null, visits: null, visibilityMode: 'VISIBLE_TODOS' });
});

function archivoDe(bytes: number, nombre = 'inventario.csv') {
  const f = new File(['Ref;Marca\n6205;SKF'], nombre, { type: 'text/csv' });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('inventory-management/inventory-upload-channels', () => {
  /*
   * Escenario «archivo supera límite de tamaño CAN-01» (inventory-upload-channels#2)
   *   GIVEN un miembro que intenta subir un archivo mayor de 50 MB
   *   WHEN  el sistema detecta el tamaño
   *   THEN  rechaza el archivo antes de procesarlo
   *   AND   muestra un mensaje con instrucción de comprimir o dividir el archivo
   */
  it('inventory-management/inventory-upload-channels#2 · un archivo de más de 50 MB se rechaza antes de procesarlo (no llega a INV-02)', async () => {
    const onPickFile = vi.fn();
    render(<Inventory profile={profile} now={new Date('2026-10-02T12:00:00Z')} onPickFile={onPickFile} />);

    fireEvent.change(screen.getByTestId('inventory-file-input'), {
      target: { files: [archivoDe(50 * 1024 * 1024 + 1)] },
    });

    // Se avisa al miembro (ancla positiva) y el archivo no se entrega a nadie para procesar.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onPickFile).not.toHaveBeenCalled();

    // Frontera: exactamente 50 MB sí se entrega (la spec dice «mayor de 50 MB»).
    const justo = archivoDe(50 * 1024 * 1024, 'justo.csv');
    fireEvent.change(screen.getByTestId('inventory-file-input'), { target: { files: [justo] } });
    expect(onPickFile).toHaveBeenCalledWith(justo);
    await waitFor(() => expect(fetchPage).toHaveBeenCalled());
  });
});
