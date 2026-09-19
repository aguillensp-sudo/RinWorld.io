import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BillingRow } from '../../lib/admin-billing';
import { BillingTable } from './BillingTable';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-02 · tabla (`BillingTable`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Presentacional
 * puro: pinta las filas EN EL ORDEN QUE LAS RECIBE (el orden "días restantes
 * ascendente" ya lo resuelve `fetchBillingOrgs`) y no llama a la red.
 */

function row(over: Partial<BillingRow> = {}): BillingRow {
  return {
    orgId: 'org-nordic',
    name: 'Nordic Bearings AB',
    country: 'SE',
    countryLabel: 'Suecia',
    state: 'ACTIVE',
    joinedAt: '2025-06-30T00:00:00Z',
    suspendedSince: null,
    lastPaymentDate: '2025-06-30',
    trialEndsAt: '2025-09-28',
    dueDate: '2026-06-30',
    daysRemaining: 2,
    ...over,
  };
}

const TIMKEN = row({
  orgId: 'org-timken',
  name: 'Timken Europe GmbH',
  country: 'DE',
  countryLabel: 'Alemania',
  state: 'CANDIDATA A BORRADO',
  lastPaymentDate: null,
  dueDate: '2025-12-28',
  daysRemaining: -182,
  suspendedSince: '2025-12-28T00:00:00Z',
});
const RUIZ = row({
  orgId: 'org-ruiz',
  name: 'Distribuciones Ruiz SL',
  country: 'ES',
  countryLabel: 'España',
  state: 'SUSPENDED',
  lastPaymentDate: null,
  dueDate: '2026-02-15',
  daysRemaining: -133,
  suspendedSince: '2026-02-15T00:00:00Z',
});
const NORDIC = row();
const SUR = row({
  orgId: 'org-sur',
  name: 'Rodamientos del Sur SL',
  country: 'ES',
  countryLabel: 'España',
  state: 'EN PRUEBA',
  lastPaymentDate: null,
  dueDate: '2026-09-27',
  daysRemaining: 91,
});
const NSK = row({
  orgId: 'org-nsk',
  name: 'NSK Europe Ltd',
  country: 'DE',
  countryLabel: 'Alemania',
  lastPaymentDate: '2026-03-01',
  dueDate: '2027-03-01',
  daysRemaining: 246,
});
const EJEMPLO = [TIMKEN, RUIZ, NORDIC, SUR, NSK];

function handlers() {
  return {
    onSelect: vi.fn(),
    onMarkPaid: vi.fn(),
    onReactivate: vi.fn(),
  };
}

function renderTable(rows: BillingRow[] = EJEMPLO, over: Partial<Parameters<typeof BillingTable>[0]> = {}) {
  const h = handlers();
  render(<BillingTable rows={rows} selectedId={null} emptyMessage="No hay organizaciones." {...h} {...over} />);
  return h;
}

const cuerpo = () => screen.getAllByRole('row').slice(1);
const celdas = (r: HTMLElement) => within(r).getAllByRole('cell');

describe('BillingTable', () => {
  it('es una tabla con siete cabeceras en el orden fijo de la spec §3, ninguna ordenable', () => {
    renderTable();
    const cabeceras = screen.getAllByRole('columnheader');
    expect(cabeceras.map((c) => c.textContent)).toEqual([
      'Nombre',
      'País',
      'Estado',
      'Último pago',
      'Vencimiento',
      'Días restantes',
      'Acciones',
    ]);
    for (const c of cabeceras) {
      expect(c).toHaveAttribute('scope', 'col');
      expect(within(c).queryByRole('button')).toBeNull();
    }
  });

  it('pinta las filas en el orden que las recibe, sin reordenar', () => {
    renderTable([NSK, TIMKEN, NORDIC]);
    expect(cuerpo().map((r) => celdas(r)[0]?.textContent)).toEqual([
      'NSK Europe Ltd',
      'Timken Europe GmbH',
      'Nordic Bearings AB',
    ]);
  });

  it('el nombre es un botón que llama a onSelect con la fila entera', async () => {
    const h = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Nordic Bearings AB' }));
    expect(h.onSelect).toHaveBeenCalledTimes(1);
    expect(h.onSelect).toHaveBeenCalledWith(NORDIC);
  });

  it('País pinta el código ISO tal cual, no el nombre', () => {
    renderTable();
    const nordic = cuerpo().find((r) => within(r).queryByText('Nordic Bearings AB'));
    expect(celdas(nordic as HTMLElement)[1]).toHaveTextContent(/^SE$/);
  });

  it('Estado pinta el literal de cada uno de los cuatro estados', () => {
    renderTable([TIMKEN, RUIZ, NORDIC, SUR]);
    expect(cuerpo().map((r) => celdas(r)[2]?.textContent)).toEqual([
      'CANDIDATA A BORRADO',
      'SUSPENDED',
      'ACTIVE',
      'EN PRUEBA',
    ]);
  });

  it('Último pago: la fecha de la spec (30 Jun 2025) o un guion largo si nunca pagó', () => {
    renderTable([RUIZ, NORDIC]);
    const [ruiz, nordic] = cuerpo();
    expect(celdas(ruiz as HTMLElement)[3]).toHaveTextContent(/^—$/);
    expect(celdas(nordic as HTMLElement)[3]).toHaveTextContent(/^30 Jun 2025$/);
  });

  it('Vencimiento y Días restantes con el formato de la spec, y el color por tono', () => {
    renderTable([TIMKEN, NORDIC, NSK]);
    const [timken, nordic, nsk] = cuerpo().map(celdas);
    expect(timken?.[4]).toHaveTextContent(/^28 Dic 2025$/);
    expect(timken?.[5]).toHaveTextContent(/^-182 días$/);
    expect(nordic?.[5]).toHaveTextContent(/^2 días$/);
    expect(nsk?.[4]).toHaveTextContent(/^1 Mar 2027$/);
    // rojo si vencido, naranja si < 15 días, normal en el resto
    expect(timken?.[4]).toHaveAttribute('data-tone', 'danger');
    expect(timken?.[5]).toHaveAttribute('data-tone', 'danger');
    expect(nordic?.[4]).toHaveAttribute('data-tone', 'warn');
    expect(nordic?.[5]).toHaveAttribute('data-tone', 'warn');
    expect(nsk?.[5]).toHaveAttribute('data-tone', 'normal');
  });

  it('las acciones dependen del estado (spec §3, columna Acciones)', () => {
    renderTable();
    const acciones = (nombre: string) =>
      within(cuerpo().find((r) => within(r).queryByText(nombre)) as HTMLElement)
        .queryAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .filter((t) => t !== nombre);

    expect(acciones('Timken Europe GmbH')).toEqual(['Iniciar borrado — Timken Europe GmbH']);
    expect(acciones('Distribuciones Ruiz SL')).toEqual(['Reactivar — Distribuciones Ruiz SL']);
    expect(acciones('Nordic Bearings AB')).toEqual(['Marcar pago recibido — Nordic Bearings AB']);
    expect(acciones('Rodamientos del Sur SL')).toEqual(['Marcar pago recibido — Rodamientos del Sur SL']);
    expect(acciones('NSK Europe Ltd')).toEqual(['Marcar pago recibido — NSK Europe Ltd']);
  });

  it('Marcar pago recibido y Reactivar llaman a su callback con la fila', async () => {
    const h = renderTable();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar pago recibido — Nordic Bearings AB' }));
    expect(h.onMarkPaid).toHaveBeenCalledWith(NORDIC);
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar — Distribuciones Ruiz SL' }));
    expect(h.onReactivate).toHaveBeenCalledWith(RUIZ);
  });

  it('Iniciar borrado está deshabilitado: el borrado real todavía no existe (0034)', async () => {
    const h = renderTable();
    const boton = screen.getByRole('button', { name: 'Iniciar borrado — Timken Europe GmbH' });
    expect(boton).toBeDisabled();
    await userEvent.click(boton);
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it('marca como actual EXACTAMENTE la fila seleccionada, no otra (F-179)', () => {
    renderTable(EJEMPLO, { selectedId: 'org-timken' });
    const actuales = cuerpo().filter((r) => r.getAttribute('aria-current') === 'true');
    expect(actuales).toHaveLength(1);
    expect(celdas(actuales[0] as HTMLElement)[0]).toHaveTextContent('Timken Europe GmbH');
  });

  it('sin selección, ninguna fila es la actual', () => {
    renderTable();
    expect(cuerpo().filter((r) => r.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('sin filas: el mensaje va DENTRO de la tabla, en una celda que ocupa las siete columnas', () => {
    renderTable([], { emptyMessage: 'No hay organizaciones con vencimiento en los próximos 15 días.' });
    const celda = screen.getByText('No hay organizaciones con vencimiento en los próximos 15 días.');
    expect(celda.closest('td')).toHaveAttribute('colspan', '7');
    expect(screen.getByRole('table')).toContainElement(celda);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });
});
