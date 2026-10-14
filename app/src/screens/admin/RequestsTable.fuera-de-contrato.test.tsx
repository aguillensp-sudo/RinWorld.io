import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestRow } from '../../lib/admin-requests';

/**
 * FUERA DEL CONTRATO de la tarea ADMIN-01 (F-251): escrito a mano el 14-oct, tras el
 * repaso visual con Playwright. La spec dice «Panel lateral de detalle (al hacer clic en
 * una fila)» y el contrato solo exigía el botón del nombre, así que la fila no respondía.
 * El botón sigue siendo el control de teclado; el clic en la fila es para el ratón, y no
 * debe dispararse cuando el clic es en el enlace del sitio web.
 */

const { RequestsTable } = await import('./RequestsTable');

const NOW = new Date('2026-09-11T12:00:00Z');

function row(over: Partial<RequestRow> = {}): RequestRow {
  return {
    id: '11110000-0000-4000-8000-000000000001',
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    countryLabel: 'España',
    applicantName: 'Juan Álvarez García',
    email: 'jalvarez@distribalvarez.com',
    phone: '+34 91 234 56 78',
    website: 'distribalvarez.com',
    submittedAt: '2026-09-09T08:00:00Z',
    state: 'PENDING_REVIEW',
    rejectionReason: '',
    decidedBy: null,
    decidedAt: null,
    ...over,
  };
}

describe('RequestsTable · clic en la fila', () => {
  it('un clic en cualquier celda de la fila abre el detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const fila = row();
    render(<RequestsTable rows={[fila]} now={NOW} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByText('jalvarez@distribalvarez.com'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(fila);
  });

  it('el botón del nombre abre el detalle una sola vez, no dos', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RequestsTable rows={[row()]} now={NOW} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Distribuciones Álvarez SL' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('el enlace del sitio web abre la web y NO el detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RequestsTable rows={[row()]} now={NOW} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByRole('link', { name: 'distribalvarez.com' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
