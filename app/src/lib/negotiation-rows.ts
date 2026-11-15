/**
 * Soy cliente · Soy proveedor · Mensajes: lo que decide qué se ve en el hilo de una empresa.
 *
 * Change `amend-msg-hilos-pestanas-y-etiqueta` (`design.md` §2, §3 y §5). Sustituye a las
 * dos tablas de MSG-03 v1.2 (`negotiation-tables.ts`, que se retira cuando la pantalla
 * nueva deje de usarla). Escrito a mano antes de que el Coder pinte la pantalla: el
 * componente no calcula nada, pinta lo que sale de aquí.
 *
 * Tres reglas que no se escriben dos veces:
 *
 * - **Quién puede decidir una oferta lo sabe `offerActions`** (F-051, F-056): solo el
 *   receptor, solo `Pendiente`. Aquí se parte de lo que devuelve; esto decide qué se
 *   pinta, la base decide qué es legal.
 * - **Una oferta expirada se puede aceptar igualmente** (MSG-03 §4.1, «la fecha es
 *   orientativa»): expirar cambia `Aceptar` por `Aceptar igualmente` y quita
 *   `Contra-ofertar`. Vale para quien la recibe, sea cliente o proveedor.
 * - **Las cifras van cifradas** (E2EE): filtrar y ordenar se hace aquí, sobre lo
 *   descifrado. Sin contenido, la fila dice `Cifrado` y no cumple ningún rango.
 */
import { NEGOTIATION_TEXTS, type BadgeTone, type RowBadge, moneyLabel, quantityLabel } from './negotiation-tables';
import { asOfferCard, validUntilLabel, type ThreadItem } from './thread-detail';
import { isExpired, offerActions } from './offers';

const T = NEGOTIATION_TEXTS;

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

/** El papel del miembro en una negociación. Se fija en el primer elemento de la cadena. */
export type Role = 'cliente' | 'proveedor';

export type NegotiationStatus =
  | 'esperando-oferta'
  | 'por-decidir'
  | 'contraoferta-enviada'
  | 'por-responder'
  | 'esperando-al-cliente'
  | 'contraoferta-recibida'
  | 'aceptada'
  | 'rechazada'
  | 'expirada'
  | 'sin-stock';

export type NegotiationAction =
  | 'responder'
  | 'sin-stock'
  | 'aceptar'
  | 'aceptar-igualmente'
  | 'contraofertar'
  | 'rechazar';

/** Una referencia del hilo: lo que lleva una tarjeta y lo que puede llevar un mensaje. */
export interface ThreadReference {
  partNumber: string;
  brand: string;
}

export interface NegotiationRow {
  /** `rol|part_number|brand`: única dentro de su tabla. */
  key: string;
  role: Role;
  partNumber: string;
  brand: string;
  /** `6205-2RS · SKF`. */
  reference: string;
  /** El último elemento de la cadena: sobre él actúan las acciones. */
  itemId: string;
  itemType: 'CONSULTA' | 'OFERTA';
  /** El primero: la consulta, o la oferta directa. */
  rootId: string;

  // Lo que se pinta. `''` = no aplica (una consulta no tiene precio); `—` = no informado;
  // `Cifrado` = no se puede leer en esta sesión.
  quantity: string;
  price: string;
  leadTime: string;
  shipping: string;
  validUntil: string;
  /** Fecha del último movimiento, `12 nov 2026`. */
  date: string;
  /** Para el tooltip de la fila: notas de la oferta o comentario de la consulta. */
  notes: string | null;

  /** Con lo que se filtra y se ordena. `null` = vacío, no informado o cifrado. */
  values: {
    quantity: number | null;
    price: number | null;
    currency: string | null;
    leadTimeDays: number | null;
    shipping: number | null;
    validUntil: string | null;
    lastMovementAt: string;
  };

  status: NegotiationStatus;
  badge: RowBadge;
  encrypted: boolean;
  expired: boolean;
  actions: NegotiationAction[];
  /** Si hay `contraofertar` pero no contenido con que prerellenar el formulario. */
  counterDisabledReason: string | null;
}

export interface NegotiationRowContext {
  viewerOrgId: string;
  now: Date;
}

export interface NegotiationTables {
  cliente: NegotiationRow[];
  proveedor: NegotiationRow[];
}

// -----------------------------------------------------------------------------
// Literales
// -----------------------------------------------------------------------------

export const STATUS_LABELS: Record<NegotiationStatus, string> = {
  'esperando-oferta': 'ESPERANDO OFERTA',
  'por-decidir': 'POR DECIDIR',
  'contraoferta-enviada': 'CONTRAOFERTA ENVIADA',
  'por-responder': 'POR RESPONDER',
  'esperando-al-cliente': 'ESPERANDO AL CLIENTE',
  'contraoferta-recibida': 'CONTRAOFERTA RECIBIDA',
  aceptada: 'ACEPTADA',
  rechazada: 'RECHAZADA',
  expirada: 'EXPIRADA',
  'sin-stock': 'SIN STOCK',
};

/** El color del badge. `pendiente` = le toca al miembro; `espera` = le toca a la otra parte. */
const STATUS_TONES: Record<NegotiationStatus, BadgeTone> = {
  'esperando-oferta': 'espera',
  'por-decidir': 'pendiente',
  'contraoferta-enviada': 'espera',
  'por-responder': 'pendiente',
  'esperando-al-cliente': 'espera',
  'contraoferta-recibida': 'pendiente',
  aceptada: 'aceptada',
  rechazada: 'rechazada',
  expirada: 'expirada',
  'sin-stock': 'sin-stock',
};

/** Los estados que tiene cada tabla, en el orden de la spec: la lista del filtro Estado. */
export const STATUSES_BY_ROLE: Record<Role, NegotiationStatus[]> = {
  cliente: ['esperando-oferta', 'por-decidir', 'contraoferta-enviada', 'aceptada', 'rechazada', 'expirada', 'sin-stock'],
  proveedor: [
    'por-responder',
    'esperando-al-cliente',
    'contraoferta-recibida',
    'aceptada',
    'rechazada',
    'expirada',
    'sin-stock',
  ],
};

export const TAB_TEXTS = {
  messages: 'Mensajes',
  cliente: 'Soy cliente',
  proveedor: 'Soy proveedor',
  headers: ['Referencia', 'Cantidad', 'Precio', 'Estado', 'Fecha', 'Plazo', 'Transporte', 'Válida hasta', 'Acciones'],
  tagLabel: 'Sobre:',
  generalConversation: 'Conversación general',
  searchPlaceholder: 'Busca una referencia dentro de este hilo sobre la que quieras recuperar el contenido de la conversación',
  noMatches: (q: string) => `No hay ninguna referencia que coincida con «${q}» en este hilo`,
  filterChip: (ref: string) => `Referencia: ${ref}`,
} as const;

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

export function referenceLabel(ref: ThreadReference): string {
  return `${ref.partNumber} · ${ref.brand}`;
}

/** Sin mayúsculas, espacios ni separadores: `6205 2rs` casa con `6205-2RS`. */
export function normalizeRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function time(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function lastMovement(items: ThreadItem[]): string {
  let best = items[0]?.createdAt ?? '';
  for (const i of items) {
    for (const c of [i.createdAt, i.estadoChangedAt]) {
      if (c && time(c) > time(best)) best = c;
    }
  }
  return best;
}

/** `YYYY-MM-DD` en hora local: la fecha que el miembro ve en la celda. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// -----------------------------------------------------------------------------
// §2.1 · Cadenas
// -----------------------------------------------------------------------------

/**
 * Agrupa las consultas y ofertas en negociaciones.
 *
 * Cómo las enlaza la base: la oferta que responde a una consulta lleva
 * `responds_to_item_id` = la consulta (`create_offer`); una contraoferta hereda el
 * `responds_to_item_id` de la oferta a la que contesta, y esa oferta pasa a apuntarle
 * con `superseded_by_item_id` (`counter_offer`). Una oferta directa no responde a nada.
 * Así que dos elementos son de la misma cadena si uno responde al otro o lo supera.
 */
function chains(items: ThreadItem[]): ThreadItem[][] {
  const cards = items.filter((i) => i.type === 'CONSULTA' || i.type === 'OFERTA');
  const parent = new Map<string, string>(cards.map((c) => [c.id, c.id]));
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(id, r);
    return r;
  };
  const join = (a: string | null, b: string) => {
    if (!a || !parent.has(a)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const c of cards) {
    join(c.respondsToItemId, c.id);
    join(c.supersededByItemId, c.id);
  }

  const groups = new Map<string, ThreadItem[]>();
  for (const c of cards) {
    const r = find(c.id);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...groups.values()].map((g) =>
    g.map((item, i) => ({ item, i })).sort((a, b) => time(a.item.createdAt) - time(b.item.createdAt) || a.i - b.i).map((x) => x.item),
  );
}

// -----------------------------------------------------------------------------
// §2.2 y §2.3 · Filas
// -----------------------------------------------------------------------------

function rowFromChain(chain: ThreadItem[], ctx: NegotiationRowContext): NegotiationRow | null {
  const root = chain[0];
  // El último elemento: la oferta viva, o la consulta si no hay oferta. Una oferta superada
  // nunca es la última, salvo que su sucesora no haya llegado (no se ve): entonces manda
  // la más reciente.
  const last = chain[chain.length - 1];
  if (!root || !last || !root.partNumber || !root.brand) return null;

  const clientOrgIsRootSender = root.type === 'CONSULTA';
  const viewerIsRootSender = root.senderOrgId === ctx.viewerOrgId;
  const role: Role = clientOrgIsRootSender === viewerIsRootSender ? 'cliente' : 'proveedor';

  const lastMovementAt = lastMovement(chain);
  const base = {
    key: `${role}|${root.partNumber}|${root.brand}`,
    role,
    partNumber: root.partNumber,
    brand: root.brand,
    reference: referenceLabel({ partNumber: root.partNumber, brand: root.brand }),
    itemId: last.id,
    itemType: last.type as 'CONSULTA' | 'OFERTA',
    rootId: root.id,
    date: validUntilLabel(lastMovementAt),
  };

  if (last.type === 'CONSULTA') {
    const content = last.content && last.content.kind === 'CONSULTA' ? last.content : null;
    const state = last.inquiryState ?? 'Pendiente';
    let status: NegotiationStatus;
    if (state === 'Sin stock') status = 'sin-stock';
    else status = role === 'cliente' ? 'esperando-oferta' : 'por-responder';
    // Responder o marcar sin stock solo quien la recibe y mientras está Pendiente (0055).
    const actions: NegotiationAction[] =
      state === 'Pendiente' && last.senderOrgId !== ctx.viewerOrgId ? ['responder', 'sin-stock'] : [];
    return {
      ...base,
      quantity: content ? quantityLabel(content.quantity) : T.encrypted,
      price: '',
      leadTime: '',
      shipping: '',
      validUntil: '',
      notes: content?.comment || null,
      values: {
        quantity: content?.quantity ?? null,
        price: null,
        currency: null,
        leadTimeDays: null,
        shipping: null,
        validUntil: null,
        lastMovementAt,
      },
      status,
      badge: { label: STATUS_LABELS[status], tone: STATUS_TONES[status] },
      encrypted: content === null,
      expired: false,
      actions,
      counterDisabledReason: null,
    };
  }

  const content = last.content && last.content.kind === 'OFERTA' ? last.content : null;
  const state = last.offerState ?? 'Pendiente';
  const expired = state === 'Pendiente' && content !== null && isExpired(content.validUntil, ctx.now);
  const sentByViewer = last.senderOrgId === ctx.viewerOrgId;
  // El cliente de esta cadena es quien envió la consulta, o quien recibió la oferta directa.
  const clientOrg = clientOrgIsRootSender ? root.senderOrgId : null;
  const sentByClient = clientOrg !== null ? last.senderOrgId === clientOrg : last.senderOrgId !== root.senderOrgId;

  let status: NegotiationStatus;
  if (state === 'Aceptada') status = 'aceptada';
  else if (state === 'Rechazada') status = 'rechazada';
  else if (expired) status = 'expirada';
  else if (role === 'cliente') status = sentByViewer ? 'contraoferta-enviada' : 'por-decidir';
  else status = sentByClient ? 'contraoferta-recibida' : 'esperando-al-cliente';

  const card = asOfferCard(last, '');
  const allowed = card ? offerActions(card, ctx.viewerOrgId) : [];
  const actions: NegotiationAction[] = [];
  if (allowed.includes('aceptar')) actions.push(expired ? 'aceptar-igualmente' : 'aceptar');
  if (allowed.includes('contraofertar') && !expired) actions.push('contraofertar');
  if (allowed.includes('rechazar')) actions.push('rechazar');

  return {
    ...base,
    quantity: content ? quantityLabel(content.quantity) : T.encrypted,
    price: content ? moneyLabel(content.unitPrice, content.currency) : T.encrypted,
    leadTime: content
      ? content.leadTimeDays !== null && content.leadTimeDays !== undefined
        ? `${content.leadTimeDays} días`
        : T.none
      : T.encrypted,
    shipping: content
      ? content.shippingCost !== null && content.shippingCost !== undefined
        ? moneyLabel(content.shippingCost, content.shippingCostCurrency ?? content.currency)
        : T.none
      : T.encrypted,
    validUntil: content ? (content.validUntil ? validUntilLabel(content.validUntil) : T.none) : T.encrypted,
    notes: content?.notes || null,
    values: {
      quantity: content?.quantity ?? null,
      price: content?.unitPrice ?? null,
      currency: content?.currency ?? null,
      leadTimeDays: content?.leadTimeDays ?? null,
      shipping: content?.shippingCost ?? null,
      validUntil: content?.validUntil ?? null,
      lastMovementAt,
    },
    status,
    badge: { label: STATUS_LABELS[status], tone: STATUS_TONES[status] },
    encrypted: content === null,
    expired,
    actions,
    counterDisabledReason: actions.includes('contraofertar') && content === null ? T.counterDisabledReason : null,
  };
}

/**
 * Las dos tablas del hilo. Una fila por `(referencia, marca, papel)`; si la misma
 * referencia tiene varias negociaciones con el mismo papel, sale la del último
 * movimiento (`design.md` §2.2). Orden por defecto: último movimiento primero.
 */
export function negotiationRows(items: ThreadItem[], ctx: NegotiationRowContext): NegotiationTables {
  const best = new Map<string, NegotiationRow>();
  for (const chain of chains(items)) {
    const row = rowFromChain(chain, ctx);
    if (!row) continue;
    const prev = best.get(row.key);
    if (!prev || time(row.values.lastMovementAt) > time(prev.values.lastMovementAt)) best.set(row.key, row);
  }
  const all = sortRows([...best.values()]);
  return {
    cliente: all.filter((r) => r.role === 'cliente'),
    proveedor: all.filter((r) => r.role === 'proveedor'),
  };
}

// -----------------------------------------------------------------------------
// §3 · Filtros y orden
// -----------------------------------------------------------------------------

export interface NumberRange {
  min?: number | null;
  max?: number | null;
}

/** Días `YYYY-MM-DD`, los dos incluidos. */
export interface DayRange {
  from?: string | null;
  to?: string | null;
}

export interface RowFilters {
  reference?: string;
  statuses?: NegotiationStatus[];
  quantity?: NumberRange;
  /** `currency`: si la tabla mezcla monedas, el precio se filtra dentro de una. */
  price?: NumberRange & { currency?: string | null };
  leadTime?: NumberRange;
  shipping?: NumberRange;
  date?: DayRange;
  validUntil?: DayRange;
}

function inRange(v: number | null, r: NumberRange | undefined): boolean {
  if (!r || ((r.min === null || r.min === undefined) && (r.max === null || r.max === undefined))) return true;
  if (v === null) return false;
  if (r.min !== null && r.min !== undefined && v < r.min) return false;
  if (r.max !== null && r.max !== undefined && v > r.max) return false;
  return true;
}

function inDays(iso: string | null, r: DayRange | undefined): boolean {
  if (!r || (!r.from && !r.to)) return true;
  if (!iso) return false;
  const k = dayKey(iso);
  if (r.from && k < r.from) return false;
  if (r.to && k > r.to) return false;
  return true;
}

export function filterRows(rows: NegotiationRow[], f: RowFilters): NegotiationRow[] {
  const ref = f.reference ? normalizeRef(f.reference) : '';
  return rows.filter(
    (r) =>
      (!ref || normalizeRef(`${r.partNumber}${r.brand}`).includes(ref)) &&
      (!f.statuses || f.statuses.length === 0 || f.statuses.includes(r.status)) &&
      inRange(r.values.quantity, f.quantity) &&
      inRange(r.values.price, f.price) &&
      (!f.price?.currency || r.values.currency === f.price.currency) &&
      inRange(r.values.leadTimeDays, f.leadTime) &&
      inRange(r.values.shipping, f.shipping) &&
      inDays(r.values.lastMovementAt, f.date) &&
      inDays(r.values.validUntil, f.validUntil),
  );
}

/** Las monedas de la columna Precio: si hay más de una, el filtro pide elegir (§3). */
export function currenciesOf(rows: NegotiationRow[]): string[] {
  return [...new Set(rows.map((r) => r.values.currency).filter((c): c is string => c !== null))].sort();
}

export type SortKey =
  | 'reference'
  | 'quantity'
  | 'price'
  | 'status'
  | 'date'
  | 'leadTime'
  | 'shipping'
  | 'validUntil';
export type SortDir = 'asc' | 'desc';

function sortValue(r: NegotiationRow, key: SortKey): number | string | null {
  switch (key) {
    case 'reference':
      return r.reference;
    case 'quantity':
      return r.values.quantity;
    case 'price':
      return r.values.price;
    case 'status':
      return r.badge.label;
    case 'date':
      return time(r.values.lastMovementAt);
    case 'leadTime':
      return r.values.leadTimeDays;
    case 'shipping':
      return r.values.shipping;
    case 'validUntil':
      return r.values.validUntil ? time(r.values.validUntil) : null;
  }
}

/** Orden por una columna; los vacíos siempre al final; empate, último movimiento primero. */
export function sortRows(rows: NegotiationRow[], key: SortKey = 'date', dir: SortDir = 'desc'): NegotiationRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
      if (c !== 0) return sign * c;
    }
    return time(b.values.lastMovementAt) - time(a.values.lastMovementAt);
  });
}

// -----------------------------------------------------------------------------
// §5 · Referencias del hilo, «Sobre:» y la vista de Mensajes
// -----------------------------------------------------------------------------

export interface ThreadReferenceOption extends ThreadReference {
  label: string;
}

/**
 * Las referencias del hilo: las de sus consultas y ofertas, sin repetir. Son las únicas
 * que puede llevar un mensaje (la base rechaza las demás, `0080`). La más reciente primero.
 */
export function threadReferences(items: ThreadItem[]): ThreadReferenceOption[] {
  const seen = new Map<string, { opt: ThreadReferenceOption; at: number }>();
  for (const i of items) {
    if ((i.type !== 'CONSULTA' && i.type !== 'OFERTA') || !i.partNumber || !i.brand) continue;
    const k = `${i.partNumber}|${i.brand}`;
    const at = time(i.createdAt);
    const prev = seen.get(k);
    if (!prev || at > prev.at) {
      seen.set(k, { opt: { partNumber: i.partNumber, brand: i.brand, label: referenceLabel(i as ThreadReference) }, at });
    }
  }
  return [...seen.values()].sort((a, b) => b.at - a.at).map((x) => x.opt);
}

/** El buscador del hilo: coincidencias parciales con lo escrito, sin mayúsculas ni separadores. */
export function matchReferences(refs: ThreadReferenceOption[], query: string): ThreadReferenceOption[] {
  const q = normalizeRef(query);
  if (!q) return [];
  return refs.filter((r) => normalizeRef(r.partNumber).includes(q) || normalizeRef(r.label).includes(q));
}

/**
 * Lo que sale elegido en «Sobre:» al abrir el campo de escribir sin venir de una fila.
 * - Una sola referencia en el hilo: esa.
 * - Ninguna: `null`, conversación general (no hay nada que elegir).
 * - Varias: `undefined`, sin elegir; no se puede enviar hasta que se elija una opción,
 *   aunque sea «Conversación general».
 */
export function initialTag(refs: ThreadReference[]): ThreadReference | null | undefined {
  if (refs.length === 0) return null;
  const [only] = refs;
  if (refs.length === 1 && only) return { partNumber: only.partNumber, brand: only.brand };
  return undefined;
}

export function sameReference(a: ThreadReference | null, b: { partNumber: string | null; brand: string | null }): boolean {
  if (!a) return b.partNumber === null && b.brand === null;
  return a.partNumber === b.partNumber && a.brand === b.brand;
}

export interface TimelineEntry {
  item: ThreadItem;
  /** Línea compacta de una tarjeta (`Oferta · 2,10 EUR · 500 ud.`); `null` en un mensaje. */
  summary: string | null;
  /** Estado de la tarjeta tal como está en base; `null` en un mensaje. */
  stateLabel: string | null;
}

function cardSummary(item: ThreadItem, items: ThreadItem[]): string {
  if (item.type === 'CONSULTA') {
    const c = item.content && item.content.kind === 'CONSULTA' ? item.content : null;
    return `Consulta · ${c ? quantityLabel(c.quantity) : T.encrypted}`;
  }
  const isCounter = items.some((o) => o.type === 'OFERTA' && o.supersededByItemId === item.id);
  const o = item.content && item.content.kind === 'OFERTA' ? item.content : null;
  const cifras = o ? `${moneyLabel(o.unitPrice, o.currency)} · ${quantityLabel(o.quantity)}` : T.encrypted;
  return `${isCounter ? 'Contraoferta' : 'Oferta'} · ${cifras}`;
}

/**
 * La pestaña Mensajes, el más reciente primero.
 * - Sin referencia: solo los mensajes (las tarjetas están en las tablas).
 * - Con referencia (la búsqueda del hilo): los mensajes con esa etiqueta y todas las
 *   consultas y ofertas de esa referencia, también de negociaciones antiguas. Los de
 *   conversación general no salen.
 */
export function messageTimeline(items: ThreadItem[], ref: ThreadReference | null): TimelineEntry[] {
  const chosen = ref
    ? items.filter((i) => i.partNumber === ref.partNumber && i.brand === ref.brand)
    : items.filter((i) => i.type === 'MENSAJE');
  return chosen
    .map((item, i) => ({ item, i }))
    .sort((a, b) => time(b.item.createdAt) - time(a.item.createdAt) || b.i - a.i)
    .map(({ item }) => ({
      item,
      summary: item.type === 'MENSAJE' ? null : cardSummary(item, items),
      stateLabel:
        item.type === 'MENSAJE' ? null : ((item.type === 'CONSULTA' ? item.inquiryState : item.offerState) ?? null),
    }));
}
