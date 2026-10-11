import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadItem } from '../../lib/thread-detail';
import { NEGOTIATION_TEXTS as T, inquiryRows } from '../../lib/negotiation-tables';
import { InquiriesTable } from './InquiriesTable';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-03 v1.2 · tabla de consultas.
 *
 * Escrito por Claude Code ANTES de la corrida (`CLAUDE.md` §3). El Coder no lo ve.
 * Las filas las construye `inquiryRows` (la capa de datos, a mano y ya probada en
 * `lib/negotiation-tables.test.ts`): aquí solo se mide que el componente pinte lo que
 * recibe, en su sitio, y que cada botón llame a su callback con su id.
 *
 * Los asertos negativos («esta fila no tiene botones») van ANCLADOS a algo que solo
 * existe si la tabla se pintó: un componente vacío no los cumple.
 */

const NOW = new Date('2026-10-11T12:00:00Z');
const CTX = { viewerOrgId: 'org-rey', ownOrgName: 'Rey Transmisiones', counterpartyName: 'Fulano S.A', now: NOW };

function consulta(over: Partial<ThreadItem>): ThreadItem {
  return {
    id: 'q',
    type: 'CONSULTA',
    senderOrgId: 'org-fulano',
    isOwn: false,
    createdAt: '2026-10-11T07:00:00Z',
    partNumber: '6204',
    brand: 'SKF',
    locationCountry: 'CU',
    offerState: null,
    inquiryState: 'Pendiente',
    respondsToItemId: null,
    supersededByItemId: null,
    content: { kind: 'CONSULTA', quantity: 500, comment: 'Confirmación plazo de entrega' },
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 1 },
    ...over,
  };
}

const PENDIENTE = consulta({ id: 'q-pend' });
const RESPONDIDA = consulta({
  id: 'q-resp',
  createdAt: '2026-10-09T12:00:00Z',
  partNumber: '22316-E',
  locationCountry: 'SE',
  inquiryState: 'Respondida con oferta',
  content: { kind: 'CONSULTA', quantity: 200, comment: null },
});
const CIFRADA = consulta({ id: 'q-cif', createdAt: '2026-10-08T12:00:00Z', content: null, inquiryState: 'Sin stock' });

function renderTabla(items: ThreadItem[] = [PENDIENTE, RESPONDIDA, CIFRADA]) {
  const handlers = { onRespond: vi.fn(), onOutOfStock: vi.fn(), onOpenOrganization: vi.fn() };
  render(<InquiriesTable rows={inquiryRows(items, CTX)} {...handlers} />);
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

describe('MSG-03 · InquiriesTable', () => {
  it('título «Consultas» en un h2 y una tabla con ese nombre accesible', () => {
    renderTabla();
    expect(screen.getByRole('heading', { level: 2, name: T.inquiriesTitle })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: T.inquiriesTitle })).toBeInTheDocument();
  });

  it('las ocho cabeceras, verbatim y en orden, como th de columna', () => {
    renderTabla();
    const ths = screen.getAllByRole('columnheader');
    expect(ths.map((th) => th.textContent?.trim())).toEqual([...T.inquiryHeaders]);
    for (const th of ths) expect(th).toHaveAttribute('scope', 'col');
  });

  it('una fila por consulta, en el orden recibido, marcada con data-testid y data-row-id', () => {
    renderTabla();
    const rows = screen.getAllByTestId('inquiry-row');
    expect(rows.map((r) => r.getAttribute('data-row-id'))).toEqual(['q-pend', 'q-resp', 'q-cif']);
  });

  it('cada celda pinta su campo de la fila', () => {
    renderTabla();
    const c = celdas('q-pend');
    expect(c).toHaveLength(8);
    expect(c.slice(0, 7)).toEqual([
      '6204 · SKF',
      'Fulano S.A',
      'CU',
      '500 ud.',
      'Confirmación plazo de entrega',
      'PENDIENTE',
      'hace 5 h',
    ]);
    expect(celdas('q-resp').slice(0, 7)).toEqual(['22316-E · SKF', 'Fulano S.A', 'SE', '200 ud.', '—', 'RESPONDIDA', 'hace 2 d']);
  });

  it('el estado es un badge con su tono en data-tone', () => {
    renderTabla();
    const badges = screen.getAllByTestId('badge');
    expect(badges.map((b) => [b.textContent?.trim(), b.getAttribute('data-tone')])).toEqual([
      ['PENDIENTE', 'pendiente'],
      ['RESPONDIDA', 'respondida'],
      ['SIN STOCK', 'sin-stock'],
    ]);
  });

  it('una consulta sin clave dice «Cifrado» en cantidad y notas, con el aviso largo en title', () => {
    renderTabla();
    const tds = within(fila('q-cif')).getAllByRole('cell');
    expect(tds[3]).toHaveTextContent(T.encrypted);
    expect(tds[4]).toHaveTextContent(T.encrypted);
    expect(tds[3]).toHaveAttribute('title', T.encryptedNotice);
    expect(tds[4]).toHaveAttribute('title', T.encryptedNotice);
    // Anclado: la fila de al lado SÍ enseña su cantidad y no lleva el aviso.
    expect(within(fila('q-pend')).getAllByRole('cell')[3]).not.toHaveAttribute('title');
  });

  it('la pendiente recibida tiene «Responder con oferta» y «Sin stock», que llaman con su id', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    const acciones = within(fila('q-pend')).getAllByRole('button').filter((b) => b.textContent?.trim() !== 'Fulano S.A');
    expect(acciones.map((b) => b.textContent?.trim())).toEqual([T.respond, T.outOfStock]);
    for (const b of acciones) expect(b).toHaveAttribute('type', 'button');
    await user.click(within(fila('q-pend')).getByRole('button', { name: T.respond }));
    expect(h.onRespond).toHaveBeenCalledWith('q-pend');
    await user.click(within(fila('q-pend')).getByRole('button', { name: T.outOfStock }));
    expect(h.onOutOfStock).toHaveBeenCalledWith('q-pend');
  });

  it('una consulta decidida no tiene acciones: la celda dice «—»', () => {
    renderTabla();
    // Anclado a la fila pintada: su organización es un botón y su celda de acciones existe.
    expect(within(fila('q-resp')).getByRole('button', { name: 'Fulano S.A' })).toBeInTheDocument();
    expect(within(fila('q-resp')).queryByRole('button', { name: T.respond })).toBeNull();
    expect(within(fila('q-resp')).queryByRole('button', { name: T.outOfStock })).toBeNull();
    expect(celdas('q-resp')[7]).toBe(T.none);
  });

  it('la consulta enviada por mí tampoco tiene acciones', () => {
    renderTabla([consulta({ id: 'q-mia', isOwn: true, senderOrgId: 'org-rey' })]);
    expect(within(fila('q-mia')).getByRole('button', { name: 'Rey Transmisiones' })).toBeInTheDocument();
    expect(within(fila('q-mia')).queryByRole('button', { name: T.respond })).toBeNull();
  });

  it('el nombre de la organización es un botón que lleva a su ficha', async () => {
    const h = renderTabla();
    const user = userEvent.setup();
    const org = within(fila('q-pend')).getByRole('button', { name: 'Fulano S.A' });
    expect(org).toHaveAttribute('type', 'button');
    await user.click(org);
    expect(h.onOpenOrganization).toHaveBeenCalledWith('org-fulano');
  });

  it('los svg son decorativos (aria-hidden)', () => {
    const { container } = render(
      <InquiriesTable rows={inquiryRows([PENDIENTE], CTX)} onRespond={vi.fn()} onOutOfStock={vi.fn()} onOpenOrganization={vi.fn()} />,
    );
    const svgs = container.querySelectorAll('svg');
    // Ancla: el icono de edificio del botón de organización (HTML aprobado) existe.
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('no pinta otra cosa que lo que recibe: nada de los datos de ejemplo del HTML aprobado', () => {
    renderTabla();
    expect(fila('q-pend')).toBeInTheDocument(); // ancla
    expect(screen.queryByText(/Rodamientos del Sur/)).toBeNull();
    expect(screen.queryByText(/6205-2RS/)).toBeNull();
  });
});
