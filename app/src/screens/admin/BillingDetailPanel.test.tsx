import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BillingPayment, BillingRow, BillingStatusEvent } from '../../lib/admin-billing';
import { BillingDetailPanel } from './BillingDetailPanel';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-02 · panel lateral (`BillingDetailPanel`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. TOTALMENTE
 * CONTROLADO: no llama a la red ni decide cuándo se abre el modal de pago (eso es
 * de `AdminBilling`); solo pinta y avisa por callbacks.
 */

function row(over: Partial<BillingRow> = {}): BillingRow {
  return {
    orgId: 'org-nordic',
    name: 'Nordic Bearings AB',
    country: 'SE',
    countryLabel: 'Suecia',
    state: 'ACTIVE',
    joinedAt: '2025-06-30T09:00:00Z',
    suspendedSince: null,
    lastPaymentDate: '2025-06-30',
    trialEndsAt: '2025-09-28',
    dueDate: '2026-06-30',
    daysRemaining: 2,
    ...over,
  };
}

const PAGOS: BillingPayment[] = [
  { id: 'p2', paymentDate: '2025-06-30', note: 'Transferencia BBVA ref. 8841', operatorName: 'Admin Principal' },
  { id: 'p1', paymentDate: '2024-06-28', note: '', operatorName: null },
];

const EVENTOS: BillingStatusEvent[] = [
  {
    id: 2,
    fromStatus: 'SUSPENDED',
    toStatus: 'APPROVED',
    at: '2025-07-01T10:00:00Z',
    operatorName: 'Admin Principal',
    automatic: false,
  },
  { id: 1, fromStatus: 'APPROVED', toStatus: 'SUSPENDED', at: '2025-06-01T00:00:00Z', operatorName: null, automatic: true },
];

function renderPanel(over: Partial<Parameters<typeof BillingDetailPanel>[0]> = {}) {
  const h = { onClose: vi.fn(), onMarkPaid: vi.fn(), onSuspend: vi.fn(), onReactivate: vi.fn() };
  render(
    <BillingDetailPanel
      row={row()}
      contactEmail="info@nordicbearings.se"
      payments={PAGOS}
      events={EVENTOS}
      loading={false}
      actionBusy={false}
      actionError={null}
      feedback={null}
      {...h}
      {...over}
    />,
  );
  return h;
}

/** El valor de un campo del panel: el `<dd>` que sigue a su `<dt>`. */
const valor = (etiqueta: string) => screen.getByText(etiqueta).nextElementSibling?.textContent;

describe('BillingDetailPanel', () => {
  it('cabecera: eyebrow verbatim, nombre de la organización y botón de cerrar', async () => {
    const h = renderPanel();
    const panel = screen.getByRole('complementary', { name: 'Detalle de organización' });
    expect(within(panel).getAllByText('Detalle de organización').length).toBeGreaterThan(0);
    expect(within(panel).getByRole('heading', { level: 2, name: 'Nordic Bearings AB' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('datos de la organización con las etiquetas de la spec §3', () => {
    renderPanel();
    expect(valor('País')).toBe('Suecia · SE');
    expect(valor('Email de contacto')).toBe('info@nordicbearings.se');
    expect(valor('Incorporada')).toBe('30 Jun 2025');
    expect(valor('Estado actual')).toBe('ACTIVE');
    expect(valor('Fin del periodo de prueba')).toBe('28 Sep 2025');
  });

  it('sin email de contacto, un guion largo', () => {
    renderPanel({ contactEmail: null });
    expect(valor('Email de contacto')).toBe('—');
  });

  it('"Estado desde" de una ACTIVE es la fecha de su último pago', () => {
    renderPanel();
    expect(valor('Estado desde')).toBe('30 Jun 2025');
  });

  it('"Estado desde" de una suspendida es la fecha de suspensión', () => {
    renderPanel({ row: row({ state: 'SUSPENDED', suspendedSince: '2026-02-15T00:00:00Z' }) });
    expect(valor('Estado actual')).toBe('SUSPENDED');
    expect(valor('Estado desde')).toBe('15 Feb 2026');
  });

  it('"Estado desde" de una EN PRUEBA es la fecha de alta', () => {
    renderPanel({ row: row({ state: 'EN PRUEBA', lastPaymentDate: null, joinedAt: '2026-08-07T00:00:00Z' }) });
    expect(valor('Estado desde')).toBe('7 Ago 2026');
  });

  it('historial de pagos: fecha · operador · nota, con guion largo donde falte', () => {
    renderPanel();
    const lista = screen.getByRole('list', { name: 'Historial de pagos' });
    const items = within(lista).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      '30 Jun 2025 · Admin Principal · Transferencia BBVA ref. 8841',
      '28 Jun 2024 · — · —',
    ]);
  });

  it('historial de estados: ACTIVE en vez de APPROVED, y "Automático" si no lo hizo un operador', () => {
    renderPanel();
    const lista = screen.getByRole('list', { name: 'Historial de estados' });
    expect(within(lista).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'SUSPENDED → ACTIVE · 1 Jul 2025 · Admin Principal',
      'ACTIVE → SUSPENDED · 1 Jun 2025 · Automático',
    ]);
  });

  it('sin historiales: los dos literales de vacío', () => {
    renderPanel({ payments: [], events: [] });
    expect(screen.getByText('Sin pagos confirmados.')).toBeInTheDocument();
    expect(screen.getByText('Sin cambios de estado.')).toBeInTheDocument();
  });

  it('mientras carga: "Cargando historial…" y el panel es aria-busy', () => {
    renderPanel({ loading: true, payments: [], events: [] });
    expect(screen.getAllByText('Cargando historial…').length).toBeGreaterThan(0);
    expect(screen.getByRole('complementary', { name: 'Detalle de organización' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('Sin pagos confirmados.')).not.toBeInTheDocument();
  });

  it('ACTIVE: Marcar pago recibido y Suspender manualmente, y nada más', async () => {
    const h = renderPanel();
    const nombres = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
      .filter((t) => t !== 'Cerrar detalle');
    expect(nombres).toEqual(['Marcar pago recibido', 'Suspender manualmente']);
    await userEvent.click(screen.getByRole('button', { name: 'Marcar pago recibido' }));
    expect(h.onMarkPaid).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Suspender manualmente' }));
    expect(h.onSuspend).toHaveBeenCalledTimes(1);
  });

  it('EN PRUEBA: solo Marcar pago recibido', () => {
    renderPanel({ row: row({ state: 'EN PRUEBA', lastPaymentDate: null }) });
    expect(screen.getByRole('button', { name: 'Marcar pago recibido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspender manualmente' })).not.toBeInTheDocument();
  });

  it('SUSPENDED: solo Reactivar', async () => {
    const h = renderPanel({ row: row({ state: 'SUSPENDED', suspendedSince: '2026-02-15T00:00:00Z' }) });
    expect(screen.queryByRole('button', { name: 'Marcar pago recibido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspender manualmente' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    expect(h.onReactivate).toHaveBeenCalledTimes(1);
  });

  it('CANDIDATA A BORRADO: solo Iniciar borrado, y deshabilitado (el borrado real no existe todavía)', () => {
    renderPanel({ row: row({ state: 'CANDIDATA A BORRADO', suspendedSince: '2025-12-28T00:00:00Z' }) });
    expect(screen.getByRole('button', { name: 'Iniciar borrado' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument();
  });

  it('con una acción en vuelo, los botones de acción se deshabilitan', () => {
    renderPanel({ actionBusy: true });
    expect(screen.getByRole('button', { name: 'Marcar pago recibido' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suspender manualmente' })).toBeDisabled();
  });

  it('el aviso de resultado va en role="status" y el error de acción en role="alert"', () => {
    renderPanel({ feedback: 'Nordic Bearings AB suspendida.', actionError: 'RLS: no eres el Operador' });
    expect(screen.getByRole('status')).toHaveTextContent('Nordic Bearings AB suspendida.');
    expect(screen.getByRole('alert')).toHaveTextContent('RLS: no eres el Operador');
  });
});
