import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryTable } from './InventoryTable';
import type { InventoryLine, LineStatus } from '../../lib/inventory';

const NOW = new Date('2026-08-07T12:00:00Z');

function ago(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function line(over: Partial<InventoryLine> = {}): InventoryLine {
  return {
    id: over.id ?? '00000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 840,
    country: 'ES',
    productFamily: 'Rodamiento rigido de bolas',
    status: 'PUBLISHED',
    leadTimeDays: 3,
    lastUploadAt: ago(2),
    ...over,
  };
}

function renderTable(lines: InventoryLine[]) {
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  render(
    <InventoryTable lines={lines} now={NOW} onArchive={onArchive} onDelete={onDelete} />,
  );
  return { onArchive, onDelete };
}

describe('InventoryTable', () => {
  /**
   * La spec §3 llama a este orden "fijo inamovible" y §7 recuerda que `condition`
   * se eliminó del esquema canónico en v1.1 y no debe aparecer. Este test es lo
   * que impide que alguien meta una columna "de paso".
   */
  it('tiene las siete columnas de la spec, en orden, y ninguna más', () => {
    renderTable([line()]);
    const heads = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(heads).toEqual([
      'Referencia',
      'Marca',
      'Cantidad',
      'País',
      'Estado',
      'Antigüedad',
      'Acciones',
    ]);
  });

  it('no pinta ninguna columna de precio — no está en la spec y el dato va cifrado', () => {
    renderTable([line()]);
    const heads = screen.getAllByRole('columnheader').map((th) => th.textContent?.toLowerCase());
    expect(heads.some((h) => h?.includes('precio'))).toBe(false);
  });

  it('pinta los datos de la línea', () => {
    renderTable([line()]);
    expect(screen.getByText('6205-2RS')).toBeInTheDocument();
    expect(screen.getByText('SKF')).toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('Hace 2 días')).toBeInTheDocument();
  });

  /**
   * El separador de miles español es el punto, no la coma. Pero ojo con el caso de
   * cuatro cifras: el CLDR de `es` (y la recomendación de la RAE) **no** agrupa
   * cuatro dígitos, así que 1250 sale "1250" y solo a partir de cinco aparece el
   * punto. El HTML aprobado escribe "1.247" a mano, que es el uso informal; aquí
   * manda `toLocaleString('es-ES')`, que es correcto y se mantiene solo.
   */
  it('formatea la cantidad en español: punto a partir de cinco cifras', () => {
    renderTable([line({ id: 'l-1', quantity: 1250 })]);
    expect(screen.getByText('1250')).toBeInTheDocument();
  });

  it('y con cinco cifras sí agrupa con punto, no con coma', () => {
    renderTable([line({ id: 'l-2', quantity: 12_500 })]);
    expect(screen.getByText('12.500')).toBeInTheDocument();
    expect(screen.queryByText('12,500')).not.toBeInTheDocument();
  });

  it('una cantidad de cero se pinta, no se esconde', () => {
    // El ejemplo de la propia spec §3 tiene una línea ARCHIVED con cantidad 0.
    renderTable([line({ quantity: 0, status: 'ARCHIVED' })]);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  /** Los CUATRO estados de `inventory-line-lifecycle`, no los tres del HTML. */
  it.each<[LineStatus, string]>([
    ['PUBLISHED', 'Published'],
    ['DRAFT', 'Draft'],
    ['ARCHIVED', 'Archived'],
    ['DELETED', 'Deleted'],
  ])('pinta el badge de %s', (status, label) => {
    renderTable([line({ status })]);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  /**
   * El coloreado de antigüedad es lo único de esta tabla que un revisor no puede
   * comprobar a ojo sin saber la fecha de cada fila, así que va por clase.
   */
  it('colorea la antigüedad por los umbrales de 7 y 30 días', () => {
    renderTable([
      line({ id: 'l-1', lastUploadAt: ago(2) }),
      line({ id: 'l-2', lastUploadAt: ago(9) }),
      line({ id: 'l-3', lastUploadAt: ago(45) }),
      line({ id: 'l-4', lastUploadAt: ago(7) }),
    ]);
    const cls = (t: string) => screen.getByText(t).className;
    expect(cls('Hace 2 días')).not.toMatch(/stale|critical/);
    expect(cls('Hace 9 días')).toMatch(/stale/);
    expect(cls('Hace 45 días')).toMatch(/critical/);
    // 7 exactos: el borde. La spec dice "> 7 días", no ">=".
    expect(cls('Hace 7 días')).not.toMatch(/stale|critical/);
  });

  /**
   * F-017: con 50 filas por página, "Archivar" a secas aparece 50 veces y ninguna
   * consulta por rol es unívoca — ni en un test ni con un lector de pantalla.
   */
  it('los nombres accesibles de las acciones llevan la referencia', async () => {
    const { onArchive, onDelete } = renderTable([
      line({ id: 'l-1', partNumber: '6205-2RS' }),
      line({ id: 'l-2', partNumber: 'NU2210-E-TVP2' }),
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Archivar NU2210-E-TVP2' }));
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onArchive.mock.calls[0]?.[0]).toMatchObject({ partNumber: 'NU2210-E-TVP2' });

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar 6205-2RS' }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({ partNumber: '6205-2RS' });
  });

  it('no ofrece archivar una línea ya archivada', () => {
    renderTable([line({ status: 'ARCHIVED' })]);
    expect(screen.getByRole('button', { name: 'Archivar 6205-2RS' })).toBeDisabled();
    // Eliminar sí sigue disponible: archivada no es eliminada.
    expect(screen.getByRole('button', { name: 'Eliminar 6205-2RS' })).toBeEnabled();
  });

  it('deshabilita las acciones de la fila que está en vuelo, y solo esa', () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    render(
      <InventoryTable
        lines={[line({ id: 'l-1', partNumber: 'A' }), line({ id: 'l-2', partNumber: 'B' })]}
        now={NOW}
        busyId="l-1"
        onArchive={onArchive}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByRole('button', { name: 'Eliminar A' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar B' })).toBeEnabled();
  });

  it('con una lista vacía pinta la cabecera y ninguna fila', () => {
    renderTable([]);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    const body = screen.getByRole('table').querySelector('tbody');
    expect(within(body as HTMLElement).queryAllByRole('row')).toHaveLength(0);
  });
});
