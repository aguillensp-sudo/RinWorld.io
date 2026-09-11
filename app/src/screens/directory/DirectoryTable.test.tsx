import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SORT, type DirectoryRow, type DirectorySort } from '../../lib/directory';

/**
 * CONTRATO DE ACEPTACIÓN · DIR-01 · `DirectoryTable` (presentacional).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`: el Coder
 * no ve este fichero). Solo pinta lo que recibe — ordenar y paginar son de la
 * pantalla (`Directory.tsx`), no de esta tabla.
 *
 * Sin `vi.mock`: `DirectoryRow` es un tipo, no una función, y no hay nada de
 * `lib/directory` que tocar red aquí — la tabla no la llama.
 */

const { DirectoryTable } = await import('./DirectoryTable');

function row(over: Partial<DirectoryRow> = {}): DirectoryRow {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Rodamientos Ibéricos',
    country: 'ES',
    countryLabel: 'España',
    phone: '+34 954 123 456',
    email: 'info@rodamientosibericos.es',
    favoriteCount: 5,
    ...over,
  };
}

describe('DirectoryTable', () => {
  it('pinta las cinco columnas de la spec §3, en su orden fijo', () => {
    render(
      <DirectoryTable rows={[row()]} sort={DEFAULT_SORT} onSort={vi.fn()} onOpenOrganization={vi.fn()} />,
    );
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual(['Nombre', 'País', 'Teléfono', 'Email', 'Favoritos']);
  });

  it('Nombre, País y Favoritos son ordenables -botón dentro del `columnheader`-; Teléfono y Email no', () => {
    render(
      <DirectoryTable rows={[row()]} sort={DEFAULT_SORT} onSort={vi.fn()} onOpenOrganization={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'País' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favoritos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Teléfono' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
  });

  it('el `aria-sort` marca SOLO la columna activa, con la dirección del prop `sort`', () => {
    const sort: DirectorySort = { field: 'country', ascending: false };
    render(<DirectoryTable rows={[row()]} sort={sort} onSort={vi.fn()} onOpenOrganization={vi.fn()} />);
    const ths = screen.getAllByRole('columnheader');
    const porNombre = Object.fromEntries(ths.map((th) => [th.textContent?.trim(), th]));
    expect(porNombre['País']).toHaveAttribute('aria-sort', 'descending');
    expect(porNombre['Nombre']).not.toHaveAttribute('aria-sort');
    expect(porNombre['Favoritos']).not.toHaveAttribute('aria-sort');
  });

  it('pulsar una cabecera ordenable llama a `onSort` con el campo de esa columna, nunca con la dirección', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<DirectoryTable rows={[row()]} sort={DEFAULT_SORT} onSort={onSort} onOpenOrganization={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'País' }));
    expect(onSort).toHaveBeenCalledWith('country');
    await user.click(screen.getByRole('button', { name: 'Favoritos' }));
    expect(onSort).toHaveBeenCalledWith('favorite_count');
  });

  it('el estado vacío pinta el literal exacto de la spec §6, dentro de la tabla', () => {
    render(<DirectoryTable rows={[]} sort={DEFAULT_SORT} onSort={vi.fn()} onOpenOrganization={vi.fn()} />);
    expect(
      screen.getByText('No hemos encontrado organizaciones que coincidan con los filtros aplicados.'),
    ).toBeInTheDocument();
    // Sigue siendo una `table` de verdad, no un `<div>` distinto para el hueco.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // cabecera + la fila del hueco
  });

  it('el país se pinta con su código ISO tal cual llega -no el nombre completo-', () => {
    render(
      <DirectoryTable
        rows={[row({ country: 'DE', countryLabel: 'Alemania' })]}
        sort={DEFAULT_SORT}
        onSort={vi.fn()}
        onOpenOrganization={vi.fn()}
      />,
    );
    const fila = screen.getAllByRole('row')[1]!;
    expect(within(fila).getByText('DE')).toBeInTheDocument();
    expect(within(fila).queryByText('Alemania')).not.toBeInTheDocument();
  });

  it('teléfono y email vacíos se pintan con un guión, nunca en blanco ni "null"', () => {
    render(
      <DirectoryTable
        rows={[row({ phone: '', email: '' })]}
        sort={DEFAULT_SORT}
        onSort={vi.fn()}
        onOpenOrganization={vi.fn()}
      />,
    );
    const fila = screen.getAllByRole('row')[1]!;
    const celdas = within(fila).getAllByRole('cell').map((c) => c.textContent?.trim());
    expect(celdas[2]).toBe('—');
    expect(celdas[3]).toBe('—');
  });

  it('favoritos pinta la estrella y el recuento exacto de la fila', () => {
    render(
      <DirectoryTable rows={[row({ favoriteCount: 21 })]} sort={DEFAULT_SORT} onSort={vi.fn()} onOpenOrganization={vi.fn()} />,
    );
    const fila = screen.getAllByRole('row')[1]!;
    expect(within(fila).getByText('★')).toBeInTheDocument();
    expect(within(fila).getByText('21')).toBeInTheDocument();
  });

  it(
    'el nombre es un control APAGADO -DIR-02 no existe todavía- y dice por qué; el callback se conserva sin dispararse',
    async () => {
      const user = userEvent.setup();
      const onOpenOrganization = vi.fn();
      render(
        <DirectoryTable
          rows={[row({ name: 'NSK Europe Ltd', id: 'x' })]}
          sort={DEFAULT_SORT}
          onSort={vi.fn()}
          onOpenOrganization={onOpenOrganization}
        />,
      );
      const control = screen.getByRole('button', { name: 'NSK Europe Ltd' });
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute(
        'title',
        'La ficha de organización (DIR-02) llega en una próxima versión.',
      );
      await user.click(control);
      expect(onOpenOrganization).not.toHaveBeenCalled();
    },
  );
});
