/**
 * MSG-03 v1.2 · las filas de las dos tablas del hilo (consultas y ofertas).
 *
 * La spec de `MSG-03` v1.2 sustituye las tarjetas de `MSG-02` por **dos tablas**,
 * una por tipo. Las tablas las pinta el Coder (`InquiriesTable`, `OffersTable`);
 * **todo lo que decide qué se ve está aquí**, escrito a mano antes de la corrida:
 * los textos, el orden, la etiqueta de cada estado, qué acciones tiene cada fila
 * y cómo se formatea cada cifra. El componente no calcula nada: pinta `rows`.
 *
 * Por qué aquí y no en el componente, en tres reglas que ya costaron algo:
 *
 * - **Solo el receptor decide una oferta** y eso lo sabe `offerActions` (F-051,
 *   F-056). Aquí se parte de lo que devuelve, no de una condición paralela.
 * - **Una oferta expirada se puede aceptar igualmente** (spec §6: «la fecha es
 *   orientativa»). Expirar cambia el texto del botón y quita `Contra-ofertar`
 *   (spec §4.1, acciones de `EXPIRADA`); no quita `Aceptar`.
 * - **Las cifras se formatean en la capa de datos, nunca a mano** (F-024). Y un
 *   transporte no informado es `—`, nunca `0` (spec §6).
 */
import {
  ENCRYPTED_NOTICE,
  asOfferCard,
  authorLabel,
  validUntilLabel,
  type ThreadItem,
} from './thread-detail';
import { isExpired, offerActions } from './offers';
import { relativeTime } from './threads';
import { formatCount } from './format-count';

/** Los literales de las dos tablas, verbatim del HTML aprobado de `MSG-03`. */
export const NEGOTIATION_TEXTS = {
  inquiriesTitle: 'Consultas',
  offersTitle: 'Ofertas',
  inquiryHeaders: ['Referencia', 'Organización', 'País', 'Cantidad', 'Notas', 'Estado', 'Fecha', 'Acciones'],
  offerHeaders: [
    'Referencia',
    'Organización',
    'Precio/ud.',
    'Cantidad',
    'Plazo',
    'Transporte',
    'Válida hasta',
    'Estado',
    'Fecha',
    'Acciones',
  ],
  respond: 'Responder con oferta',
  outOfStock: 'Sin stock',
  accept: 'Aceptar',
  acceptAnyway: 'Aceptar igualmente',
  counter: 'Contra-ofertar',
  reject: 'Rechazar',
  /** Spec §6, «Oferta con valid_until expirada». */
  expiredWarning: 'Esta oferta ha expirado. Puedes aceptarla igualmente — la fecha es orientativa.',
  /** Celda de un dato que va cifrado y no se puede leer en esta sesión. */
  encrypted: 'Cifrado',
  /** El aviso largo, para el `title` de esa celda. */
  encryptedNotice: ENCRYPTED_NOTICE,
  /** Dato no informado (spec §4.1 y §6). */
  none: '—',
  /**
   * Sin contenido descifrado no hay con qué prerellenar la contraoferta (D-07-05).
   * Mismo literal que tenía la tarjeta de `MSG-02`.
   */
  counterDisabledReason: 'No se puede leer esta oferta en esta sesión, así que no se puede contraofertar.',
} as const;

/** El tono del badge: un color por estado (spec §3.1 y §4.1). */
export type BadgeTone =
  | 'pendiente'
  | 'respondida'
  | 'sin-stock'
  | 'aceptada'
  | 'rechazada'
  | 'superada'
  | 'expirada';

export interface RowBadge {
  label: string;
  tone: BadgeTone;
}

export type InquiryRowAction = 'responder' | 'sin-stock';
export type OfferRowAction = 'aceptar' | 'aceptar-igualmente' | 'contraofertar' | 'rechazar';

export interface InquiryRow {
  id: string;
  /** `part_number · brand`, o `—`. */
  reference: string;
  /** Quien envió la consulta: el comprador. */
  orgId: string;
  orgName: string;
  /** País de la línea consultada (ISO), o `—`. */
  country: string;
  /** `500 ud.`, o `Cifrado`. */
  quantity: string;
  /** Texto libre, `—` si no hay, o `Cifrado`. */
  notes: string;
  /** Si las cifras de la fila van cifradas sin clave en esta sesión. */
  encrypted: boolean;
  badge: RowBadge;
  /** Relativa (`relativeTime`): `hace 5 h`. */
  date: string;
  actions: InquiryRowAction[];
}

export interface OfferRow {
  id: string;
  reference: string;
  /** Quien envió la oferta (o la contraoferta). */
  orgId: string;
  orgName: string;
  /** `2,10 EUR`, o `Cifrado`. */
  price: string;
  quantity: string;
  /** `14 días`, `—` o `Cifrado`. */
  leadTime: string;
  /** `45,00 EUR`, `—` o `Cifrado`. */
  shipping: string;
  /** `15 jul 2026`, `—` o `Cifrado`. */
  validUntil: string;
  /** Pendiente y con la fecha de validez pasada. */
  expired: boolean;
  encrypted: boolean;
  badge: RowBadge;
  date: string;
  actions: OfferRowAction[];
  /**
   * Si `actions` incluye `contraofertar` pero no hay contenido con el que
   * prerellenar el formulario: el botón se pinta deshabilitado con este motivo.
   */
  counterDisabledReason: string | null;
}

export interface RowContext {
  viewerOrgId: string;
  ownOrgName: string;
  counterpartyName: string;
  now: Date;
}

const T = NEGOTIATION_TEXTS;

const INQUIRY_BADGES: Record<string, RowBadge> = {
  Pendiente: { label: 'PENDIENTE', tone: 'pendiente' },
  'Respondida con oferta': { label: 'RESPONDIDA', tone: 'respondida' },
  'Sin stock': { label: 'SIN STOCK', tone: 'sin-stock' },
};

/**
 * `Superada por contraoferta` no está entre los badges de la spec §4.1, pero es un
 * estado real de `estado_oferta` (0013) y la tabla enseña todas las ofertas del
 * hilo: una fila sin badge mentiría por omisión. Mismo tono que `EXPIRADA`.
 */
const OFFER_BADGES: Record<string, RowBadge> = {
  Pendiente: { label: 'PENDIENTE', tone: 'pendiente' },
  Aceptada: { label: 'ACEPTADA', tone: 'aceptada' },
  Rechazada: { label: 'RECHAZADA', tone: 'rechazada' },
  'Superada por contraoferta': { label: 'SUPERADA', tone: 'superada' },
};
const EXPIRED_BADGE: RowBadge = { label: 'EXPIRADA', tone: 'expirada' };

function reference(item: ThreadItem): string {
  const ref = [item.partNumber, item.brand].filter(Boolean).join(' · ');
  return ref || T.none;
}

/** `500 ud.`. Millares con punto desde cuatro cifras (F-231): `1.247 ud.`. */
export function quantityLabel(quantity: number): string {
  return `${formatCount(quantity)} ud.`;
}

/** `2,10 EUR`: dos decimales y el código ISO detrás, como el HTML aprobado. */
export function moneyLabel(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${n} ${currency}`;
}

/** Las filas más nuevas arriba, como el HTML aprobado. Empate: el orden recibido. */
function newestFirst(items: ThreadItem[]): ThreadItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const d = new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
      return d !== 0 ? d : a.i - b.i;
    })
    .map(({ item }) => item);
}

/**
 * Las filas de la tabla de consultas.
 *
 * Las acciones solo las tiene quien RECIBIÓ la consulta y mientras está
 * `Pendiente` (0055: `estado_consulta` solo lo mueve el receptor, una vez). La
 * base lo garantiza; esto solo evita pintar un botón que fallaría.
 */
export function inquiryRows(items: ThreadItem[], ctx: RowContext): InquiryRow[] {
  return newestFirst(items.filter((i) => i.type === 'CONSULTA')).map((item) => {
    const content = item.content && item.content.kind === 'CONSULTA' ? item.content : null;
    const state = item.inquiryState ?? 'Pendiente';
    const decide = !item.isOwn && state === 'Pendiente';
    return {
      id: item.id,
      reference: reference(item),
      orgId: item.senderOrgId,
      orgName: authorLabel(item, ctx),
      country: item.locationCountry ?? T.none,
      quantity: content ? quantityLabel(content.quantity) : T.encrypted,
      notes: content ? content.comment || T.none : T.encrypted,
      encrypted: content === null,
      badge: INQUIRY_BADGES[state] ?? { label: state.toUpperCase(), tone: 'pendiente' },
      date: relativeTime(item.createdAt, ctx.now),
      actions: decide ? ['responder', 'sin-stock'] : [],
    };
  });
}

/**
 * Las filas de la tabla de ofertas.
 *
 * Las acciones salen de `offerActions` (solo el receptor, solo `Pendiente`). Si la
 * oferta expiró: `aceptar` pasa a `aceptar-igualmente` y `contraofertar` se va
 * (spec §4.1). La expiración solo se puede saber con el contenido descifrado: sin
 * él, la fila no se da por expirada.
 */
export function offerRows(items: ThreadItem[], ctx: RowContext): OfferRow[] {
  return newestFirst(items.filter((i) => i.type === 'OFERTA')).map((item) => {
    const content = item.content && item.content.kind === 'OFERTA' ? item.content : null;
    const card = asOfferCard(item, '');
    const base = card ? offerActions(card, ctx.viewerOrgId) : [];
    const state = item.offerState ?? 'Pendiente';
    const expired = state === 'Pendiente' && content !== null && isExpired(content.validUntil, ctx.now);

    const actions: OfferRowAction[] = [];
    if (base.includes('aceptar')) actions.push(expired ? 'aceptar-igualmente' : 'aceptar');
    if (base.includes('contraofertar') && !expired) actions.push('contraofertar');
    if (base.includes('rechazar')) actions.push('rechazar');

    const cifrado = T.encrypted;
    return {
      id: item.id,
      reference: reference(item),
      orgId: item.senderOrgId,
      orgName: authorLabel(item, ctx),
      price: content ? moneyLabel(content.unitPrice, content.currency) : cifrado,
      quantity: content ? quantityLabel(content.quantity) : cifrado,
      leadTime: content
        ? content.leadTimeDays !== null && content.leadTimeDays !== undefined
          ? `${content.leadTimeDays} días`
          : T.none
        : cifrado,
      shipping: content
        ? content.shippingCost !== null && content.shippingCost !== undefined
          ? moneyLabel(content.shippingCost, content.shippingCostCurrency ?? content.currency)
          : T.none
        : cifrado,
      validUntil: content ? (content.validUntil ? validUntilLabel(content.validUntil) : T.none) : cifrado,
      expired,
      encrypted: content === null,
      badge: expired ? EXPIRED_BADGE : (OFFER_BADGES[state] ?? { label: state.toUpperCase(), tone: 'pendiente' }),
      date: relativeTime(item.createdAt, ctx.now),
      actions,
      counterDisabledReason: actions.includes('contraofertar') && content === null ? T.counterDisabledReason : null,
    };
  });
}
