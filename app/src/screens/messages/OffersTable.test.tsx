import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferContent, ThreadItem } from '../../lib/thread-detail';
import { NEGOTIATION_TEXTS as T, offerRows } from '../../lib/negotiation-tables';
import { OffersTable } from './OffersTable';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-03 v1.2 · tabla de ofertas.
 *
 * Escrito por Claude Code ANTES de la corrida (`CLAUDE.md` §3). El Coder no lo ve.
 * Las filas las construye `offerRows` (capa de datos a mano, probada aparte): aquí se
 * mide que el componente pinte cada campo en su columna, el badge, la oferta expirada
 * y que cada botón llame a su callback con su id. Ninguna regla de negocio se decide
 * en el componente: qué botones tiene una fila lo dice `row.actions`.
 */

const NOW = new Date('2026-10-11T12:00:00Z');
const CTX = { viewerOrgId: 'org-fulano', ownOrgName: 'Fulano S.A', counterpartyName: 'Rey Transmisiones', now: NOW };

const CONTENIDO: OfferContent = {
  kind: 'OFERTA',
  unitPrice: 2.1,
  currency: 'EUR',
  quantity: 500,
  leadTimeDays: 14,
  shippingCost: 45,
  shippingCostCurrency: 'EUR',
  validUntil: '2026-12-15T00:00:00.000Z',
  notes: null,
};

function oferta(over: Partial<ThreadItem>): ThreadItem {
  return {
    id: 'o',
    type: 'OFERTA',
    senderOrgId: 'org-rey',
    isOwn: false,
    createdAt: '2026-10-11T10:00:00Z',
    partNumber: '6204',
    brand: 'SKF',
    offerState: 'Pendiente',
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: CONTENIDO,
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 1 },
    ...over,
  };
}

const PENDIENTE = oferta({ id: 'o-pend' });
const ACEPTADA = oferta({
  id: 'o-acep',
  createdAt: '2026-10-08T12:00:00Z',
  offerState: 'Aceptada',
  content: { ...CONTENIDO, unitPrice: 18.5, quantity: 200, leadTimeDays: 7, shippingCost: null, validUntil: null },
});
const EXPIRADA = oferta({
  id: 'o-exp',
  createdAt: '2026-10-03T12:00:00Z',
  content: { ...CONTENIDO, unitPrice: 31, quantity: 100, leadTimeDays: null, shippingCost: null, validUntil: '2026-10-01T00:00:00.000Z' },
});
const CIFRADA = oferta({ id: 'o-cif', createdAt: '2026-10-01T12:00:00Z', content: null });

function renderTabla(items: ThreadItem[] = [PENDIENTE, ACEPTADA, EXPIRADA, CIFRADA]) {
  const handlers = { onAccept: vi.fn(), onReject: vi.fn(), onCounter: vi.fn(), onOpenOrganization: vi.fn() };
  render(<OffersTable rows={offerRows(items, CTX)} {...handlers} />);
  return handlers;
}

function fila(id: string): HTMLElement {
  const tr = document.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`);
  if (!tr) throw new Error(`no hay fila ${id}`);
  return tr;
}

function celdas(id: string): string[] {
  return within(fila(id))
    .getAllByRole('cell')
    .map((c) => (c.textContent ?? '').trim());
}

function acciones(id: string): string[] {
  return within(within(fila(id)).getAllByRole('cell')[9]!)
    .queryAllByRole('button')
    .map((b) => (b.textContent ?? '').trim());
}

describe('MSG-03 · OffersTable', () => {
  it('título «Ofertas» en un h2 y una tabla con ese nombre accesible', () => {
    renderTabla();
    expect(screen.getByRole('heading', { level: 2, name: T.offersTitle })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: T.offersTitle })).toBeInTheDocument();
  });

  it('las diez cabeceras, verbatim y en orden, como th de columna', () => {
    renderTabla();
    const ths = screen.getAllByRole('columnheader');
    expect(ths.map((th) => th.textContent?.trim())).toEqual([...T.offerHeaders]);
    for (const th of ths) expect(th).toHaveAttribute('scope', 'col');
  });

  it('una fila por oferta, en el orden recibido', () => {
    renderTabla();
    expect(screen.getAllByTestId('offer-row').map((r) => r.getAttribute('data-row-id'))).toEqual([
      'o-pend',
      'o-acep',
      'o-exp',
      'o-cif',
    ]);
  });

  it('cada celda pinta su campo de la fila', () => {
    renderTabla();
    expect(celdas('o-pend').slice(0, 9)).toEqual([
      '6204 · SKF',
      'Rey Transmisiones',
      '2,10 EUR',
      '500 ud.',
      '14 días',
      '45,00 EUR',
      '15 dic 2026',
      'PENDIENTE',
      'hace 2 h',
    ]);
    expect(celdas('o-acep').slice(0, 8)).toEqual([
      '6204 · SKF',
      'Rey Transmisiones',
      '18,50 EUR',
      '200 ud.',
      '7 días',
      '—',
      '—',
      'ACEPTADA',
    ]);
  });

  it('el estado es un badge con su tono en data-tone', () => {
    renderTabla();
    expect(
      screen.getAllByTestId('badge').map((b) => [b.textContent?.trim(), b.getAttribute('data-tone')]),
    ).toEqual([
      ['PENDIENTE', 'pendiente'],
      ['ACEPTADA', 'aceptada'],
      ['EXPIRADA', 'expirada'],
      ['PENDIENTE', 'pendiente'],
    ]);
  });

  it('la pendiente recibida: Aceptar, Contra-ofertar y Rechazar, en ese orden y cada uno con su id', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    expect(acciones('o-pend')).toEqual([T.accept, T.counter, T.reject]);
    await user.click(within(fila('o-pend')).getByRole('button', { name: T.accept }));
    expect(h.onAccept).toHaveBeenCalledWith('o-pend');
    await user.click(within(fila('o-pend')).getByRole('button', { name: T.counter }));
    expect(h.onCounter).toHaveBeenCalledWith('o-pend');
    await user.click(within(fila('o-pend')).getByRole('button', { name: T.reject }));
    expect(h.onReject).toHaveBeenCalledWith('o-pend');
    for (const b of within(fila('o-pend')).getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
  });

  it('una oferta terminal no tiene botones de acción: la celda dice «—»', () => {
    renderTabla();
    expect(within(fila('o-acep')).getByRole('button', { name: 'Rey Transmisiones' })).toBeInTheDocument();
    expect(acciones('o-acep')).toEqual([]);
    expect(celdas('o-acep')[9]).toBe(T.none);
  });

  it('la oferta que envié yo no tiene botones', () => {
    renderTabla([oferta({ id: 'o-mia', isOwn: true, senderOrgId: 'org-fulano' })]);
    expect(within(fila('o-mia')).getByRole('button', { name: 'Fulano S.A' })).toBeInTheDocument();
    expect(acciones('o-mia')).toEqual([]);
  });

  it('expirada: fila marcada, fecha marcada, aviso accesible y «Aceptar igualmente» + «Rechazar»', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    expect(fila('o-exp')).toHaveAttribute('data-expired', 'true');
    expect(fila('o-pend')).toHaveAttribute('data-expired', 'false');
    expect(within(fila('o-exp')).getByRole('img', { name: T.expiredWarning })).toBeInTheDocument();
    expect(within(fila('o-pend')).queryByRole('img', { name: T.expiredWarning })).toBeNull();
    expect(within(fila('o-exp')).getAllByRole('cell')[6]).toHaveTextContent('1 oct 2026');
    expect(within(fila('o-exp')).getByTestId('valid-until-expired')).toHaveTextContent('1 oct 2026');
    expect(within(fila('o-pend')).queryByTestId('valid-until-expired')).toBeNull();
    expect(acciones('o-exp')).toEqual([T.acceptAnyway, T.reject]);
    await user.click(within(fila('o-exp')).getByRole('button', { name: T.acceptAnyway }));
    expect(h.onAccept).toHaveBeenCalledWith('o-exp');
  });

  it('sin clave: «Cifrado» con el aviso largo en title, y Contra-ofertar deshabilitado con su motivo visible', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    const tds = within(fila('o-cif')).getAllByRole('cell');
    for (const i of [2, 3, 4, 5, 6]) {
      expect(tds[i]).toHaveTextContent(T.encrypted);
      expect(tds[i]).toHaveAttribute('title', T.encryptedNotice);
    }
    expect(within(fila('o-pend')).getAllByRole('cell')[2]).not.toHaveAttribute('title');
    const contra = within(fila('o-cif')).getByRole('button', { name: T.counter });
    expect(contra).toBeDisabled();
    expect(within(fila('o-cif')).getByText(T.counterDisabledReason)).toBeInTheDocument();
    expect(within(fila('o-pend')).getByRole('button', { name: T.counter })).toBeEnabled();
    expect(within(fila('o-pend')).queryByText(T.counterDisabledReason)).toBeNull();
    await user.click(contra);
    expect(h.onCounter).not.toHaveBeenCalled();
    // Aceptar y Rechazar sí funcionan: decidir no exige leer las cifras.
    await user.click(within(fila('o-cif')).getByRole('button', { name: T.accept }));
    expect(h.onAccept).toHaveBeenCalledWith('o-cif');
  });

  it('el nombre de la organización es un botón que lleva a su ficha', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    const org = within(fila('o-pend')).getByRole('button', { name: 'Rey Transmisiones' });
    expect(org).toHaveAttribute('type', 'button');
    await user.click(org);
    expect(h.onOpenOrganization).toHaveBeenCalledWith('org-rey');
  });

  it('el precio va en su elemento propio (negrita), y los svg son decorativos', () => {
    renderTabla();
    expect(within(fila('o-pend')).getByTestId('price')).toHaveTextContent('2,10 EUR');
    for (const svg of document.querySelectorAll('svg')) expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('no pinta los datos de ejemplo del HTML aprobado', () => {
    renderTabla();
    expect(fila('o-pend')).toBeInTheDocument(); // ancla
    expect(screen.queryByText(/NSK Europe/)).toBeNull();
    expect(screen.queryByText(/Timken/)).toBeNull();
  });
});
