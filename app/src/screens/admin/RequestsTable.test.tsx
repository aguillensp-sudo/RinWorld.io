import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestRow } from '../../lib/admin-requests';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-01 · `RequestsTable` (presentacional).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder
 * no ve este fichero. Sin `vi.mock`: no toca red.
 */

const { RequestsTable } = await import('./RequestsTable');

const NOW = new Date('2026-09-11T12:00:00Z');
const hace = (horas: number) => new Date(NOW.getTime() - horas * 3_600_000).toISOString();

function row(over: Partial<RequestRow> = {}): RequestRow {
  return {
    id: '11110000-0000-4000-8000-000000000001',
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    countryLabel: 'España',
    applicantName: 'Juan Álvarez García',
    email: 'jalvarez@distribalvarez.com',
    phone: '+34 91 234 56 78',
    website: '',
    submittedAt: hace(52),
    state: 'PENDING_REVIEW',
    rejectionReason: '',
    decidedBy: null,
    decidedAt: null,
    ...over,
  };
}

describe('RequestsTable', () => {
  it('pinta las ocho columnas de la spec §3, en su orden fijo', () => {
    render(<RequestsTable rows={[row()]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      'Organización',
      'País',
      'Email',
      'Teléfono',
      'Sitio web',
      'Fecha solicitud',
      'Antigüedad en cola',
      'Estado',
    ]);
  });

  it('ninguna cabecera es un botón: ADMIN-01 no tiene ordenación por clic', () => {
    render(<RequestsTable rows={[row()]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    for (const th of screen.getAllByRole('columnheader')) {
      expect(within(th).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('el nombre de la organización es un control que abre el panel de detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const fila = row();
    render(<RequestsTable rows={[fila]} now={NOW} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Distribuciones Álvarez SL' }));
    expect(onSelect).toHaveBeenCalledWith(fila);
  });

  it('teléfono y sitio web vacíos se pintan con un guión; presentes, el sitio web es un enlace externo con esquema', () => {
    render(
      <RequestsTable
        rows={[row({ phone: '', website: 'nordicbearings.se' })]}
        now={NOW}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const fila = screen.getAllByRole('row')[1]!;
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[3]!.textContent?.trim()).toBe('—');
    const enlace = within(fila).getByRole('link', { name: 'nordicbearings.se' });
    expect(enlace).toHaveAttribute('href', 'https://nordicbearings.se');
    expect(enlace).toHaveAttribute('target', '_blank');
  });

  it('sin sitio web, la celda es un guión y no un enlace', () => {
    render(<RequestsTable rows={[row({ website: '' })]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    const fila = screen.getAllByRole('row')[1]!;
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument();
    expect(within(fila).getAllByRole('cell')[4]!.textContent?.trim()).toBe('—');
  });

  it('el país es el código ISO, no el nombre completo', () => {
    render(<RequestsTable rows={[row()]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    const fila = screen.getAllByRole('row')[1]!;
    expect(within(fila).getByText('ES')).toBeInTheDocument();
    expect(within(fila).queryByText('España')).not.toBeInTheDocument();
  });

  it('la fecha de solicitud usa el formateador de la capa de datos, no un ISO en crudo', () => {
    render(
      <RequestsTable
        rows={[row({ submittedAt: '2026-06-28T08:14:00Z' })]}
        now={NOW}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('28 jun 2026 · 08:14')).toBeInTheDocument();
  });

  it('la antigüedad usa el literal de la capa de datos ("Hace N horas")', () => {
    render(<RequestsTable rows={[row({ submittedAt: hace(52) })]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Hace 52 horas')).toBeInTheDocument();
  });

  it('el estado se pinta con el literal exacto del enum, como pide la spec §3', () => {
    render(<RequestsTable rows={[row({ state: 'INVITED_APPROVED' })]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('INVITED_APPROVED')).toBeInTheDocument();
  });

  it('el estado vacío pinta el literal exacto de la spec §6, dentro de la tabla', () => {
    render(<RequestsTable rows={[]} now={NOW} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('No hay solicitudes pendientes de revisión.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});
