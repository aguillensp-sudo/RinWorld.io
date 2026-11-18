import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NegotiationTable } from './NegotiationTable';
import { NEGOTIATION_TEXTS, negotiationRows, TAB_TEXTS, type NegotiationRow } from '../../lib/negotiation-rows';
import type { OfferContent, ThreadItem } from '../../lib/thread-detail';

/**
 * CONTRATO DE ACEPTACIÓN · `NegotiationTable` (`amend-msg-hilos-pestanas-y-etiqueta`).
 *
 * Escrito por Claude Code antes de la corrida del arnés; el Coder no lo ve. Las filas salen
 * de la capa de datos de verdad (`negotiationRows`), no de objetos a mano: si la tabla pinta
 * lo que le llega, pinta lo que la base dice.
 */

const A = 'org-a';
const B = 'org-b';
const NOW = new Date('2026-11-15T12:00:00Z');
let n = 0;

function item(over: Partial<ThreadItem>): ThreadItem {
  n += 1;
  return {
    id: `i${n}`,
    type: 'OFERTA',
    senderOrgId: B,
    isOwn: false,
    createdAt: '2026-11-10T09:00:00Z',
    estadoChangedAt: null,
    partNumber: '6205-2RS',
    brand: 'SKF',
    offerState: 'Pendiente',
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
    ...over,
  };
}

const CIFRAS: OfferContent = {
  kind: 'OFERTA',
  unitPrice: 2.1,
  currency: 'EUR',
  quantity: 500,
  leadTimeDays: 14,
  shippingCost: 45,
  shippingCostCurrency: 'EUR',
  validUntil: '2026-12-15T00:00:00.000Z',
  notes: 'EXW, pago a 30 días',
};

function oferta(over: Partial<ThreadItem>, cifras: Partial<OfferContent> = {}) {
  return item({ type: 'OFERTA', content: { ...CIFRAS, ...cifras }, ...over });
}

/** Tres ofertas que A recibe (Soy cliente): distinta referencia, precio, fecha y estado. */
function filasCliente(): NegotiationRow[] {
  return negotiationRows(
    [
      oferta({ partNumber: '6205-2RS', createdAt: '2026-11-01T09:00:00Z' }, { unitPrice: 1 }),
      oferta({ partNumber: '6206-ZZ', createdAt: '2026-11-05T09:00:00Z' }, { unitPrice: 3, notes: null }),
      oferta({ partNumber: 'NU214', createdAt: '2026-11-12T09:00:00Z', offerState: 'Aceptada' }, { unitPrice: 5 }),
    ],
    { viewerOrgId: A, now: NOW },
  ).cliente;
}

function montar(rows: NegotiationRow[] = filasCliente()) {
  const onAction = vi.fn();
  const onWrite = vi.fn();
  render(<NegotiationTable role="cliente" rows={rows} onAction={onAction} onWrite={onWrite} />);
  return { onAction, onWrite };
}

const filas = () => screen.getAllByTestId('negotiation-row');
const refsEnPantalla = () => filas().map((f) => within(f).getAllByRole('cell')[0]!.textContent);

describe('la tabla', () => {
  it('una `table` con el nombre de su pestaña y las nueve cabeceras, en orden', () => {
    montar();
    const tabla = screen.getByRole('table', { name: TAB_TEXTS.cliente });
    expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([...TAB_TEXTS.headers]);
  });

  it('una fila por elemento de `rows`, con nueve celdas en el orden de las cabeceras', () => {
    montar();
    expect(filas()).toHaveLength(3);
    const celdas = within(filas().find((f) => f.textContent?.includes('6205-2RS'))!).getAllByRole('cell');
    expect(celdas).toHaveLength(9);
    expect(celdas.map((c) => c.textContent?.trim())).toEqual([
      '6205-2RS · SKF',
      '500 ud.',
      '1,00 EUR',
      'POR DECIDIR',
      '1 nov 2026',
      '14 días',
      '45,00 EUR',
      '15 dic 2026',
      `${NEGOTIATION_TEXTS.accept}${NEGOTIATION_TEXTS.counter}${NEGOTIATION_TEXTS.reject}`,
    ]);
  });

  it('el estado es el badge de la fila', () => {
    montar();
    const aceptada = filas().find((f) => f.textContent?.includes('NU214'))!;
    expect(within(aceptada).getByTestId('badge')).toHaveTextContent('ACEPTADA');
  });

  it('las notas no son columna: van en el `title` de la fila, y sin notas no hay `title`', () => {
    montar();
    expect(filas().find((f) => f.textContent?.includes('6205-2RS'))).toHaveAttribute('title', 'EXW, pago a 30 días');
    expect(filas().find((f) => f.textContent?.includes('6206-ZZ'))).not.toHaveAttribute('title');
  });

  it('sin filas, la tabla sigue con sus nueve cabeceras (las dos pestañas, mismas columnas) y un aviso dentro', () => {
    montar([]);
    const tabla = screen.getByRole('table', { name: TAB_TEXTS.cliente });
    expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([...TAB_TEXTS.headers]);
    expect(within(tabla).getByText(TAB_TEXTS.emptyTable)).toBeInTheDocument();
    expect(screen.queryAllByTestId('negotiation-row')).toHaveLength(0);
  });
});

describe('las acciones', () => {
  it('un botón por acción de la fila, con el literal de MSG-03, y cada uno avisa con su fila', async () => {
    const user = userEvent.setup();
    const { onAction } = montar();
    const fila = filas().find((f) => f.textContent?.includes('6205-2RS'))!;
    await user.click(within(fila).getByRole('button', { name: NEGOTIATION_TEXTS.counter }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ partNumber: '6205-2RS' }), 'contraofertar');
    await user.click(within(fila).getByRole('button', { name: NEGOTIATION_TEXTS.reject }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ partNumber: '6205-2RS' }), 'rechazar');
  });

  it('una fila sin acciones no tiene más botón que su referencia', () => {
    montar();
    const aceptada = filas().find((f) => f.textContent?.includes('NU214'))!;
    expect(within(aceptada).getAllByRole('button').map((b) => b.textContent)).toEqual(['NU214 · SKF']);
  });

  it('`Contra-ofertar` sin contenido con que prerellenar va deshabilitado y dice por qué', () => {
    const rows = negotiationRows([oferta({ content: null })], { viewerOrgId: A, now: NOW }).cliente;
    montar(rows);
    const boton = screen.getByRole('button', { name: NEGOTIATION_TEXTS.counter });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('title', NEGOTIATION_TEXTS.counterDisabledReason);
  });

  it('la Referencia es un botón que avisa para escribir sobre esa fila', async () => {
    const user = userEvent.setup();
    const { onWrite } = montar();
    await user.click(screen.getByRole('button', { name: '6206-ZZ · SKF' }));
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ partNumber: '6206-ZZ' }));
  });
});

describe('el orden', () => {
  it('al abrir, Fecha descendente: lo más reciente arriba, y su cabecera lo dice con `aria-sort`', () => {
    montar();
    expect(refsEnPantalla()).toEqual(['NU214 · SKF', '6206-ZZ · SKF', '6205-2RS · SKF']);
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending');
  });

  it('pulsar una cabecera ordena por ella; pulsarla otra vez, al revés', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Precio' }));
    expect(screen.getByRole('columnheader', { name: 'Precio' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).not.toHaveAttribute('aria-sort');
    expect(refsEnPantalla()).toEqual(['6205-2RS · SKF', '6206-ZZ · SKF', 'NU214 · SKF']);
    await user.click(screen.getByRole('button', { name: 'Precio' }));
    expect(screen.getByRole('columnheader', { name: 'Precio' })).toHaveAttribute('aria-sort', 'descending');
    expect(refsEnPantalla()).toEqual(['NU214 · SKF', '6206-ZZ · SKF', '6205-2RS · SKF']);
  });

  it('Acciones no se ordena', () => {
    montar();
    expect(within(screen.getByRole('columnheader', { name: 'Acciones' })).queryByRole('button')).toBeNull();
  });
});

describe('los filtros', () => {
  it('Referencia por texto, sin mayúsculas ni separadores', async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByRole('textbox', { name: TAB_TEXTS.filterReference }), '6205 2rs');
    expect(refsEnPantalla()).toEqual(['6205-2RS · SKF']);
  });

  it('Estado por lista, con los estados de la pestaña', async () => {
    const user = userEvent.setup();
    montar();
    const estado = screen.getByRole('combobox', { name: TAB_TEXTS.filterStatus });
    expect(within(estado).getAllByRole('option').map((o) => o.textContent)).toEqual([
      TAB_TEXTS.filterAnyStatus,
      'ESPERANDO OFERTA',
      'POR DECIDIR',
      'CONTRAOFERTA ENVIADA',
      'ACEPTADA',
      'RECHAZADA',
      'EXPIRADA',
      'SIN STOCK',
    ]);
    await user.selectOptions(estado, 'ACEPTADA');
    expect(refsEnPantalla()).toEqual(['NU214 · SKF']);
  });

  it('desde/hasta en las cifras, combinable con los demás', async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByRole('spinbutton', { name: TAB_TEXTS.filterFrom('Precio') }), '2');
    expect(refsEnPantalla()).toEqual(['NU214 · SKF', '6206-ZZ · SKF']);
    await user.type(screen.getByRole('spinbutton', { name: TAB_TEXTS.filterTo('Precio') }), '4');
    expect(refsEnPantalla()).toEqual(['6206-ZZ · SKF']);
    await user.type(screen.getByRole('textbox', { name: TAB_TEXTS.filterReference }), 'NU');
    expect(screen.queryAllByTestId('negotiation-row')).toHaveLength(0);
    expect(screen.getByText(TAB_TEXTS.noFilterMatches)).toBeInTheDocument();
  });

  it('hay desde/hasta para Cantidad, Plazo, Transporte, Fecha y Válida hasta', () => {
    montar();
    for (const col of ['Cantidad', 'Plazo', 'Transporte', 'Fecha', 'Válida hasta']) {
      expect(screen.getByLabelText(TAB_TEXTS.filterFrom(col))).toBeInTheDocument();
      expect(screen.getByLabelText(TAB_TEXTS.filterTo(col))).toBeInTheDocument();
    }
  });
});
