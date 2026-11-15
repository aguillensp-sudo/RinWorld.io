/**
 * Change `amend-msg-hilos-pestanas-y-etiqueta`, `design.md` §2, §3 y §5.
 * Escrito por Claude Code antes que el código; no es contrato del arnés.
 */
import { describe, expect, it } from 'vitest';
import type { OfferContent, ThreadItem } from './thread-detail';
import {
  type NegotiationRow,
  filterRows,
  initialTag,
  matchReferences,
  messageTimeline,
  negotiationRows,
  sortRows,
  threadReferences,
} from './negotiation-rows';

const A = 'org-a';
const B = 'org-b';
const NOW = new Date('2026-11-15T12:00:00Z');

let n = 0;
function item(over: Partial<ThreadItem>): ThreadItem {
  n += 1;
  return {
    id: `i${n}`,
    type: 'CONSULTA',
    senderOrgId: B,
    isOwn: false,
    createdAt: '2026-11-10T09:00:00Z',
    estadoChangedAt: null,
    partNumber: '6205-2RS',
    brand: 'SKF',
    offerState: null,
    inquiryState: null,
    respondsToItemId: null,
    supersededByItemId: null,
    content: null,
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
    ...over,
  };
}

function consulta(from: string, over: Partial<ThreadItem> = {}): ThreadItem {
  return item({
    type: 'CONSULTA',
    senderOrgId: from,
    inquiryState: 'Pendiente',
    content: { kind: 'CONSULTA', quantity: 500, comment: 'Urgente' },
    ...over,
  });
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

function oferta(from: string, over: Partial<ThreadItem> = {}, cifras: Partial<OfferContent> = {}): ThreadItem {
  return item({
    type: 'OFERTA',
    senderOrgId: from,
    inquiryState: null,
    offerState: 'Pendiente',
    content: { ...CIFRAS, ...cifras },
    ...over,
  });
}

/** `isOwn` sale del visor; aquí se recalcula para no repetirlo en cada caso. */
function as(viewer: string, items: ThreadItem[]): ThreadItem[] {
  return items.map((i) => ({ ...i, isOwn: i.senderOrgId === viewer }));
}

function rows(viewer: string, items: ThreadItem[]) {
  return negotiationRows(as(viewer, items), { viewerOrgId: viewer, now: NOW });
}

// -----------------------------------------------------------------------------
// §2.3 · estados y acciones
// -----------------------------------------------------------------------------
describe('negotiation-rows · consulta recibida sin responder', () => {
  const q = consulta(B);
  const r = rows(A, [q]);

  it('sale en Soy proveedor y no en Soy cliente', () => {
    expect(r.proveedor).toHaveLength(1);
    expect(r.cliente).toHaveLength(0);
  });
  it('POR RESPONDER, con cantidad y fecha, y el resto vacío', () => {
    const f = r.proveedor[0]!;
    expect(f.status).toBe('por-responder');
    expect(f.badge.label).toBe('POR RESPONDER');
    expect(f.reference).toBe('6205-2RS · SKF');
    expect(f.quantity).toBe('500 ud.');
    expect([f.price, f.leadTime, f.shipping, f.validUntil]).toEqual(['', '', '', '']);
    expect(f.date).toBe('10 nov 2026');
  });
  it('acciones Responder con oferta y Sin stock, sobre la consulta', () => {
    expect(r.proveedor[0]!.actions).toEqual(['responder', 'sin-stock']);
    expect(r.proveedor[0]!.itemId).toBe(q.id);
  });
  it('las notas de la consulta van al tooltip', () => {
    expect(r.proveedor[0]!.notes).toBe('Urgente');
  });
});

describe('negotiation-rows · consulta respondida', () => {
  const q = consulta(B, { inquiryState: 'Respondida con oferta' });
  const o = oferta(A, { respondsToItemId: q.id, createdAt: '2026-11-11T09:00:00Z' });
  const r = rows(A, [q, o]);

  it('una sola fila, llena con la oferta, ESPERANDO AL CLIENTE y sin acciones', () => {
    expect(r.proveedor).toHaveLength(1);
    expect(r.cliente).toHaveLength(0);
    const f = r.proveedor[0]!;
    expect(f.status).toBe('esperando-al-cliente');
    expect(f.price).toBe('2,10 EUR');
    expect(f.quantity).toBe('500 ud.');
    expect(f.leadTime).toBe('14 días');
    expect(f.shipping).toBe('45,00 EUR');
    expect(f.validUntil).toBe('15 dic 2026');
    expect(f.actions).toEqual([]);
    expect(f.itemId).toBe(o.id);
    expect(f.notes).toBe('EXW, pago a 30 días');
  });
  it('y el comprador la ve en Soy cliente, POR DECIDIR, con sus tres acciones', () => {
    const c = rows(B, [q, o]);
    expect(c.cliente).toHaveLength(1);
    expect(c.proveedor).toHaveLength(0);
    expect(c.cliente[0]!.status).toBe('por-decidir');
    expect(c.cliente[0]!.actions).toEqual(['aceptar', 'contraofertar', 'rechazar']);
  });
});

describe('negotiation-rows · consulta enviada', () => {
  it('sin respuesta: ESPERANDO OFERTA en Soy cliente, sin acciones', () => {
    const r = rows(A, [consulta(A)]);
    expect(r.cliente).toHaveLength(1);
    expect(r.proveedor).toHaveLength(0);
    expect(r.cliente[0]!.status).toBe('esperando-oferta');
    expect(r.cliente[0]!.actions).toEqual([]);
  });
  it('sin stock: SIN STOCK en Soy cliente, sin acciones', () => {
    const r = rows(A, [consulta(A, { inquiryState: 'Sin stock' })]);
    expect(r.cliente[0]!.status).toBe('sin-stock');
    expect(r.cliente[0]!.actions).toEqual([]);
  });
  it('sin stock, vista por el proveedor: SIN STOCK en su Soy proveedor', () => {
    const r = rows(B, [consulta(A, { inquiryState: 'Sin stock' })]);
    expect(r.proveedor[0]!.status).toBe('sin-stock');
  });
});

describe('negotiation-rows · contraoferta del cliente', () => {
  // A consulta, B oferta, A contraoferta: la oferta de B queda superada.
  const q = consulta(A, { inquiryState: 'Respondida con oferta' });
  const o2Id = 'contra';
  const o1 = oferta(B, {
    respondsToItemId: q.id,
    offerState: 'Superada por contraoferta',
    supersededByItemId: o2Id,
    createdAt: '2026-11-11T09:00:00Z',
  });
  const o2 = oferta(
    A,
    { id: o2Id, respondsToItemId: q.id, createdAt: '2026-11-12T09:00:00Z' },
    { unitPrice: 1.9 },
  );

  it('el cliente ve sus cifras, CONTRAOFERTA ENVIADA, sin acciones, en una sola fila', () => {
    const r = rows(A, [q, o1, o2]);
    expect(r.cliente).toHaveLength(1);
    expect(r.proveedor).toHaveLength(0);
    expect(r.cliente[0]!.status).toBe('contraoferta-enviada');
    expect(r.cliente[0]!.price).toBe('1,90 EUR');
    expect(r.cliente[0]!.actions).toEqual([]);
  });
  it('el proveedor la ve en la misma fila, CONTRAOFERTA RECIBIDA, con sus tres acciones', () => {
    const r = rows(B, [q, o1, o2]);
    expect(r.proveedor).toHaveLength(1);
    expect(r.cliente).toHaveLength(0);
    expect(r.proveedor[0]!.status).toBe('contraoferta-recibida');
    expect(r.proveedor[0]!.price).toBe('1,90 EUR');
    expect(r.proveedor[0]!.actions).toEqual(['aceptar', 'contraofertar', 'rechazar']);
    expect(r.proveedor[0]!.itemId).toBe(o2Id);
  });
  it('y si el proveedor contraoferta otra vez, vuelve a POR DECIDIR para el cliente', () => {
    const o3 = oferta(B, { respondsToItemId: q.id, createdAt: '2026-11-13T09:00:00Z' }, { unitPrice: 2 });
    const o2b = { ...o2, offerState: 'Superada por contraoferta' as const, supersededByItemId: o3.id };
    const r = rows(A, [q, o1, o2b, o3]);
    expect(r.cliente).toHaveLength(1);
    expect(r.cliente[0]!.status).toBe('por-decidir');
    expect(r.cliente[0]!.price).toBe('2,00 EUR');
  });
});

describe('negotiation-rows · oferta directa (sin consulta)', () => {
  const o = oferta(B);
  it('quien la recibe es el cliente: POR DECIDIR en Soy cliente', () => {
    const r = rows(A, [o]);
    expect(r.cliente).toHaveLength(1);
    expect(r.proveedor).toHaveLength(0);
    expect(r.cliente[0]!.status).toBe('por-decidir');
  });
  it('quien la envía es el proveedor: ESPERANDO AL CLIENTE en Soy proveedor', () => {
    const r = rows(B, [o]);
    expect(r.proveedor).toHaveLength(1);
    expect(r.proveedor[0]!.status).toBe('esperando-al-cliente');
  });
  it('una contraoferta a una oferta directa sigue en la misma fila', () => {
    const o1 = { ...o, offerState: 'Superada por contraoferta' as const, supersededByItemId: 'c1' };
    const c1 = oferta(A, { id: 'c1', createdAt: '2026-11-12T09:00:00Z' });
    const r = rows(A, [o1, c1]);
    expect(r.cliente).toHaveLength(1);
    expect(r.proveedor).toHaveLength(0);
    expect(r.cliente[0]!.status).toBe('contraoferta-enviada');
  });
});

describe('negotiation-rows · expirada, aceptada, rechazada', () => {
  it('pendiente con la validez pasada: EXPIRADA, y el receptor puede aceptarla igualmente', () => {
    const o = oferta(B, {}, { validUntil: '2026-11-01T00:00:00.000Z' });
    const r = rows(A, [o]);
    expect(r.cliente[0]!.status).toBe('expirada');
    expect(r.cliente[0]!.expired).toBe(true);
    expect(r.cliente[0]!.actions).toEqual(['aceptar-igualmente', 'rechazar']);
    expect(rows(B, [o]).proveedor[0]!).toMatchObject({ status: 'expirada', actions: [] });
  });
  it('aceptada y rechazada, en los dos papeles, sin acciones', () => {
    for (const offerState of ['Aceptada', 'Rechazada'] as const) {
      const o = oferta(B, { offerState });
      const status = offerState === 'Aceptada' ? 'aceptada' : 'rechazada';
      expect(rows(A, [o]).cliente[0]!).toMatchObject({ status, actions: [] });
      expect(rows(B, [o]).proveedor[0]!).toMatchObject({ status, actions: [] });
    }
  });
  it('sin contenido descifrado no se da por expirada y las cifras salen Cifrado', () => {
    const o = oferta(B, { content: null });
    const f = rows(A, [o]).cliente[0]!;
    expect(f.status).toBe('por-decidir');
    expect(f.encrypted).toBe(true);
    expect(f.price).toBe('Cifrado');
    expect(f.counterDisabledReason).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// §2.2 · una fila por referencia y papel
// -----------------------------------------------------------------------------
describe('negotiation-rows · claves de fila', () => {
  it('la misma referencia puede salir en las dos tablas, una vez en cada una', () => {
    const r = rows(A, [consulta(A), consulta(B)]);
    expect(r.cliente).toHaveLength(1);
    expect(r.proveedor).toHaveLength(1);
  });
  it('dos cadenas de la misma referencia y el mismo papel: sale la del último movimiento', () => {
    const vieja = oferta(B, { offerState: 'Aceptada', createdAt: '2026-10-01T09:00:00Z' });
    const nueva = consulta(A, { createdAt: '2026-11-14T09:00:00Z' });
    const r = rows(A, [vieja, nueva]);
    expect(r.cliente).toHaveLength(1);
    expect(r.cliente[0]!.status).toBe('esperando-oferta');
  });
  it('referencias distintas, filas distintas; la marca cuenta', () => {
    const r = rows(A, [consulta(A), consulta(A, { brand: 'FAG' }), consulta(A, { partNumber: '6206-ZZ' })]);
    expect(r.cliente.map((f) => f.reference).sort()).toEqual(['6205-2RS · FAG', '6205-2RS · SKF', '6206-ZZ · SKF']);
  });
  it('los mensajes no hacen filas, aunque lleven etiqueta', () => {
    const r = rows(A, [item({ type: 'MENSAJE', senderOrgId: A, content: { kind: 'MENSAJE', text: 'hola' } })]);
    expect(r.cliente).toHaveLength(0);
    expect(r.proveedor).toHaveLength(0);
  });
  it('la fecha es la del último movimiento, también un cambio de estado', () => {
    const o = oferta(B, {
      offerState: 'Aceptada',
      createdAt: '2026-11-10T09:00:00Z',
      estadoChangedAt: '2026-11-12T16:00:00Z',
    });
    expect(rows(A, [o]).cliente[0]!.date).toBe('12 nov 2026');
  });
});

// -----------------------------------------------------------------------------
// §3 · filtros y orden
// -----------------------------------------------------------------------------
describe('negotiation-rows · filtros', () => {
  const lista: NegotiationRow[] = rows(A, [
    oferta(B, { partNumber: '6205-2RS', createdAt: '2026-11-01T09:00:00Z' }, { unitPrice: 1 }),
    oferta(B, { partNumber: '6206-ZZ', createdAt: '2026-11-05T09:00:00Z' }, { unitPrice: 3, leadTimeDays: null }),
    oferta(B, { partNumber: 'NU214', createdAt: '2026-11-09T09:00:00Z', content: null }),
    oferta(B, { partNumber: '6205-ZZ', offerState: 'Aceptada', createdAt: '2026-11-12T09:00:00Z' }, { unitPrice: 5 }),
  ]).cliente;

  const refs = (fs: NegotiationRow[]) => fs.map((f) => f.partNumber).sort();

  it('sin filtros, todas', () => {
    expect(filterRows(lista, {})).toHaveLength(4);
  });
  it('referencia por texto, sin mayúsculas ni separadores', () => {
    expect(refs(filterRows(lista, { reference: '6205' }))).toEqual(['6205-2RS', '6205-ZZ']);
    expect(refs(filterRows(lista, { reference: '62052rs' }))).toEqual(['6205-2RS']);
    expect(refs(filterRows(lista, { reference: 'skf' }))).toHaveLength(4);
  });
  it('estado por lista', () => {
    expect(refs(filterRows(lista, { statuses: ['aceptada'] }))).toEqual(['6205-ZZ']);
  });
  it('rango numérico: Cifrado y vacío no cumplen ningún rango', () => {
    expect(refs(filterRows(lista, { price: { min: 2 } }))).toEqual(['6205-ZZ', '6206-ZZ']);
    expect(refs(filterRows(lista, { leadTime: { max: 20 } }))).toEqual(['6205-2RS', '6205-ZZ']);
  });
  it('rango de fechas, días incluidos', () => {
    expect(refs(filterRows(lista, { date: { from: '2026-11-05', to: '2026-11-09' } }))).toEqual(['6206-ZZ', 'NU214']);
  });
  it('los filtros se combinan', () => {
    expect(refs(filterRows(lista, { reference: '6205', price: { max: 2 } }))).toEqual(['6205-2RS']);
  });

  it('orden por defecto: último movimiento primero', () => {
    expect(sortRows(lista).map((f) => f.partNumber)).toEqual(['6205-ZZ', 'NU214', '6206-ZZ', '6205-2RS']);
  });
  it('por una columna, ascendente o descendente, con los vacíos al final', () => {
    expect(sortRows(lista, 'price', 'asc').map((f) => f.partNumber)).toEqual(['6205-2RS', '6206-ZZ', '6205-ZZ', 'NU214']);
    expect(sortRows(lista, 'price', 'desc').map((f) => f.partNumber)).toEqual(['6205-ZZ', '6206-ZZ', '6205-2RS', 'NU214']);
  });
});

// -----------------------------------------------------------------------------
// §5 · referencias del hilo, «Sobre:» y la vista filtrada de Mensajes
// -----------------------------------------------------------------------------
describe('negotiation-rows · referencias del hilo', () => {
  const items = [
    consulta(A, { partNumber: '6205-2RS', brand: 'SKF' }),
    oferta(B, { partNumber: '6205-2RS', brand: 'FAG' }),
    consulta(B, { partNumber: '6205-ZZ', brand: 'SKF' }),
    consulta(B, { partNumber: '6206-ZZ', brand: 'SKF' }),
    consulta(A, { partNumber: '6205-2RS', brand: 'SKF' }),
  ];
  const refs = threadReferences(items);

  it('una por par referencia + marca, sin repetir', () => {
    expect(refs.map((r) => r.label).sort()).toEqual(['6205-2RS · FAG', '6205-2RS · SKF', '6205-ZZ · SKF', '6206-ZZ · SKF']);
  });
  it('coincidencias parciales, sin mayúsculas ni separadores', () => {
    expect(matchReferences(refs, '6205').map((r) => r.label).sort()).toEqual([
      '6205-2RS · FAG',
      '6205-2RS · SKF',
      '6205-ZZ · SKF',
    ]);
    expect(matchReferences(refs, '6205 2rs')).toHaveLength(2);
    expect(matchReferences(refs, 'NU214')).toEqual([]);
    expect(matchReferences(refs, '  ')).toEqual([]);
  });
  it('«Sobre:» preelegido con una sola referencia; sin elegir con varias', () => {
    expect(initialTag(threadReferences([consulta(A)]))).toEqual({ partNumber: '6205-2RS', brand: 'SKF' });
    expect(initialTag(refs)).toBeUndefined();
    expect(initialTag([])).toBeNull();
  });
});

describe('negotiation-rows · línea de tiempo de Mensajes', () => {
  const m1 = item({ type: 'MENSAJE', senderOrgId: A, createdAt: '2026-11-10T09:00:00Z', partNumber: null, brand: null });
  const m2 = item({ type: 'MENSAJE', senderOrgId: B, createdAt: '2026-11-11T09:00:00Z' });
  const m3 = item({ type: 'MENSAJE', senderOrgId: A, createdAt: '2026-11-12T09:00:00Z', partNumber: '6206-ZZ' });
  const q = consulta(A, { createdAt: '2026-11-09T09:00:00Z', inquiryState: 'Respondida con oferta' });
  const o1 = oferta(B, {
    respondsToItemId: q.id,
    createdAt: '2026-11-13T09:00:00Z',
    offerState: 'Superada por contraoferta',
    supersededByItemId: 'c',
  });
  const c = oferta(A, { id: 'c', respondsToItemId: q.id, createdAt: '2026-11-14T09:00:00Z' }, { unitPrice: 1.9 });
  const todos = as(A, [m1, m2, m3, q, o1, c]);

  it('sin filtro: solo los mensajes, el más reciente primero', () => {
    expect(messageTimeline(todos, null).map((e) => e.item.id)).toEqual([m3.id, m2.id, m1.id]);
  });
  it('con referencia: sus mensajes y sus tarjetas, sin los de conversación general ni los de otra', () => {
    const t = messageTimeline(todos, { partNumber: '6205-2RS', brand: 'SKF' });
    expect(t.map((e) => e.item.id)).toEqual([c.id, o1.id, m2.id, q.id]);
  });
  it('las tarjetas llevan una línea compacta', () => {
    const t = messageTimeline(todos, { partNumber: '6205-2RS', brand: 'SKF' });
    expect(t.find((e) => e.item.id === q.id)?.summary).toBe('Consulta · 500 ud.');
    expect(t.find((e) => e.item.id === o1.id)?.summary).toBe('Oferta · 2,10 EUR · 500 ud.');
    expect(t.find((e) => e.item.id === c.id)?.summary).toBe('Contraoferta · 1,90 EUR · 500 ud.');
    expect(t.find((e) => e.item.id === m2.id)?.summary).toBeNull();
  });
});
