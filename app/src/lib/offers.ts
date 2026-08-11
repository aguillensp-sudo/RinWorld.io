import { supabase } from './supabase';
import type { ThreadState } from './threads';

/**
 * Máquina de estados de la oferta · mitad cliente.
 *
 * **La otra mitad vive en la base y es la que manda** (migraciones 0003, 0007 y
 * 0008): el CHECK de los cuatro estados, la guardia de terminales, la derivación
 * del estado del hilo y la prohibición de aceptar la propia oferta. Aquí no se
 * reimplementa ninguna — lo de aquí es *qué se le ofrece al usuario*, y eso es
 * una decisión de interfaz, no un invariante.
 *
 * La diferencia importa: si esto fuera la única defensa, bastaría una llamada
 * fuera de la pantalla para cerrar un acuerdo que nadie aceptó.
 *
 * ⚠ **Aquí no hay ni una cifra comercial.** `unit_price`, `quantity`,
 * `lead_time_days`, `shipping_cost` y `valid_until` viven dentro de
 * `content_ciphertext`, cifrados en un solo blob (0003), y descifrarlos es la
 * rebanada E2EE del día 8. Lo que este módulo toca son **metadatos en claro**:
 * estado, autoría y referencia. Las funciones que sí hablan de precio o de
 * validez reciben el valor **ya descifrado** por parámetro y no saben de dónde
 * salió.
 */

// -----------------------------------------------------------------------------
// Los estados
// -----------------------------------------------------------------------------

/**
 * Los CUATRO de `messaging-and-negotiation · offer-card`, literales del CHECK
 * `thread_items_estado_oferta_chk` de la migración 0003. No se traducen.
 *
 * El `Plan §7` dibuja otra máquina —BORRADOR, ENVIADA, CONTRAOFERTADA, ACEPTADA,
 * RECHAZADA, RETIRADA— de la que no coincide ni un literal. Es un boceto anterior
 * al SDD y manda el spec cerrado; `RETIRADA` en particular no existe en ninguna
 * capability y su única fuente aprobada es VND-01, que se construye el día 8.
 * Ver F-043 y F-043b.
 */
export const OFFER_STATES = ['Pendiente', 'Aceptada', 'Rechazada', 'Superada por contraoferta'] as const;
export type OfferState = (typeof OFFER_STATES)[number];

/**
 * Los tres terminales. "Terminal" aquí es literal y lo impone la base: el trigger
 * `app.guard_offer_terminal_state` levanta excepción ante cualquier intento de
 * moverlos. Es la mitad de *"sin eliminarse del historial"* que se olvida — no
 * basta con no borrar la fila, hay que no reescribirla.
 */
export const TERMINAL_OFFER_STATES = ['Aceptada', 'Rechazada', 'Superada por contraoferta'] as const;

export function isTerminal(state: OfferState): boolean {
  return (TERMINAL_OFFER_STATES as readonly string[]).includes(state);
}

/**
 * La tarjeta de oferta, **solo metadatos**. Ni un campo de aquí sale de descifrar
 * nada; ver la cabecera del fichero.
 */
export interface OfferCard {
  id: string;
  threadId: string;
  /** Quién la emitió. Es lo que decide quién puede aceptarla: el otro. */
  senderOrgId: string;
  state: OfferState;
  partNumber: string | null;
  brand: string | null;
  createdAt: string;
  /** La consulta a la que responde, si respondía a alguna. */
  respondsToItemId: string | null;
  /** La contraoferta que la superó. Apunta hacia adelante; esta fila ya no se toca. */
  supersededByItemId: string | null;
}

// -----------------------------------------------------------------------------
// Qué se puede hacer con una oferta
// -----------------------------------------------------------------------------

export type OfferAction = 'aceptar' | 'rechazar' | 'contraofertar';

/**
 * Las acciones que `viewerOrgId` puede ejecutar sobre esta oferta.
 *
 * **Dos reglas, y la segunda es la que no se ve venir.**
 *
 * 1. Solo se mueve una oferta `Pendiente`. Las otras tres son terminales.
 * 2. **Solo el RECEPTOR actúa.** `offer-card` lo dice en los tres escenarios —
 *    *"una tarjeta de oferta con estado_oferta=Pendiente, **recibida** y visible
 *    para el receptor, cuando **el receptor** pulsa…"*— y es lo único que hace
 *    que una negociación sea una negociación: quien pone el precio no cierra el
 *    trato solo.
 *
 * La regla 2 **no la impedía nada** hasta la migración 0008: `thread_items_
 * update_participant` deja escribir a las dos partes y ni el CHECK ni la guardia
 * de terminales miran quién firma. Una organización podía aceptar su propia
 * oferta y el hilo pasaba a ACUERDO ALCANZADO sin que la otra tocara nada. No lo
 * veía ningún test porque la pantalla nunca pinta ese botón — y eso es
 * exactamente lo que lo hacía peligroso. Ver F-051.
 *
 * El emisor se queda **sin ninguna acción**, y es correcto aunque incomode:
 * retirar una oferta enviada sería `RETIRADA`, que no existe en la capability.
 */
export function offerActions(offer: OfferCard, viewerOrgId: string): OfferAction[] {
  if (offer.state !== 'Pendiente') return [];
  if (offer.senderOrgId === viewerOrgId) return [];
  return ['aceptar', 'rechazar', 'contraofertar'];
}

export function canAccept(offer: OfferCard, viewerOrgId: string): boolean {
  return offerActions(offer, viewerOrgId).includes('aceptar');
}

// -----------------------------------------------------------------------------
// Validez
// -----------------------------------------------------------------------------

/** `offer-card` §"oferta con fecha de validez expirada". El literal es del spec. */
export const EXPIRED_NOTICE = 'Esta oferta ha expirado';

/**
 * Si la fecha de validez ya pasó.
 *
 * `validUntil` llega **ya descifrado** —vive dentro del blob (0003)— y puede ser
 * `null`, que es el caso normal: es un campo opcional de `offer-card`.
 */
export function isExpired(validUntil: string | null, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const t = new Date(validUntil).getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}

/**
 * ⚠ EXPIRAR NO QUITA NINGUNA ACCIÓN, y por eso esto es una función aparte de
 * `offerActions` en vez de una condición dentro.
 *
 * El spec es explícito y va contra la intuición: *"se muestra el aviso 'Esta
 * oferta ha expirado' de forma **local** — y el receptor **puede aceptarla
 * igualmente**, la fecha es orientativa, no contractual en V1"*. Una oferta
 * caducada que deshabilita el botón parece más correcta y es una regla de negocio
 * inventada: en V1 la fecha informa, no vincula.
 *
 * VND-01 trata `EXPIRADA` como un estado propio, y tampoco lo es — no está entre
 * los cuatro de `offer-card`. Se decide antes del día 8 (F-043b).
 */
export function expiryNotice(validUntil: string | null, now: Date = new Date()): string | null {
  return isExpired(validUntil, now) ? EXPIRED_NOTICE : null;
}

/**
 * La línea de transporte de la tarjeta, o `null` si no se informó.
 *
 * `offer-card` tiene un escenario entero para esto: *"shipping_cost no recibió
 * valor → no aparece ninguna línea de coste de transporte **y no se muestra un
 * importe '0' engañoso**"*. Un cero ahí no dice "no informado", dice "portes
 * gratis", que es una afirmación comercial que nadie hizo.
 *
 * Los dos valores llegan descifrados. La divisa por defecto es la de la oferta.
 */
export function shippingLine(
  cost: number | null | undefined,
  currency: string,
  locale = 'es-ES',
): string | null {
  if (cost === null || cost === undefined) return null;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cost);
}

// -----------------------------------------------------------------------------
// El hilo: las dos transiciones que NO deriva la base
// -----------------------------------------------------------------------------

/**
 * `thread-lifecycle` tiene cinco estados y la migración 0007 deriva cuatro desde
 * los metadatos de los elementos. Estas dos son manuales y por eso viven aquí.
 */

/**
 * Cerrar sin acuerdo. Sigue pidiendo confirmación explícita y sigue sin poder
 * aplicarse a un hilo ya cerrado, que es lo único que esta función decide.
 *
 * **Lo que ha cambiado es lo de después (F-045, decisión del PO del 11-ago):**
 * *"un hilo cerrado sólo se reabre cuando uno de los dos usuarios vuelve a
 * escribir en él"*. Lo implementa la migración 0009 en la base, no el cliente —
 * el estado del hilo es una función de sus filas (0007) y no un valor que la
 * pantalla escriba.
 *
 * Consecuencia para MSG-02, que va contra su spec y es deliberado: **el campo de
 * mensaje NO desaparece en un hilo cerrado.** Si desapareciera, nadie podría
 * volver a escribir y la reapertura no ocurriría nunca. Ver
 * `openspec/mvp/Dia-07_decisiones_producto.md`.
 */
export function canCloseThread(state: ThreadState): boolean {
  return state !== 'CERRADO SIN ACUERDO';
}

/**
 * Revertir el acuerdo. *"Siempre disponible, sin restricciones ni periodo de
 * gracia, y sin valor contractual"* (`thread-lifecycle`).
 */
export function canRevertAgreement(state: ThreadState): boolean {
  return state === 'ACUERDO ALCANZADO';
}

// -----------------------------------------------------------------------------
// Escrituras
// -----------------------------------------------------------------------------

const COLUMNS =
  'id, thread_id, sender_org_id, estado_oferta, part_number, brand, created_at, ' +
  'responds_to_item_id, superseded_by_item_id';

interface Row {
  id: string;
  thread_id: string;
  sender_org_id: string;
  estado_oferta: OfferState;
  part_number: string | null;
  brand: string | null;
  created_at: string;
  responds_to_item_id: string | null;
  superseded_by_item_id: string | null;
}

function toCard(r: Row): OfferCard {
  return {
    id: r.id,
    threadId: r.thread_id,
    senderOrgId: r.sender_org_id,
    state: r.estado_oferta,
    partNumber: r.part_number,
    brand: r.brand,
    createdAt: r.created_at,
    respondsToItemId: r.responds_to_item_id,
    supersededByItemId: r.superseded_by_item_id,
  };
}

/**
 * Mueve una oferta `Pendiente` a un terminal.
 *
 * ⚠ LOS DOS FILTROS EXTRA NO SON REDUNDANTES, y es la lección de `inventory.ts`
 * aplicada aquí: **un `update` que la política rechaza afecta a cero filas y no
 * da error** — silencio en vez de fallo. Con `.eq('estado_oferta','Pendiente')` y
 * `.neq('sender_org_id', viewerOrgId)` explícitos, la fila devuelta *es* la
 * respuesta: si vuelve vacía, la operación no ocurrió y se dice.
 *
 * La condición de carrera que tapan es real y llega el día 7 con Realtime: dos
 * pestañas abiertas sobre la misma oferta, una acepta y la otra rechaza. Sin el
 * filtro de estado, la segunda escribe encima; con él, la base rechaza el
 * movimiento por terminal y aquí se ve.
 */
async function setOfferState(
  itemId: string,
  viewerOrgId: string,
  state: Extract<OfferState, 'Aceptada' | 'Rechazada'>,
): Promise<OfferCard> {
  const { data, error } = await supabase
    .from('thread_items')
    .update({ estado_oferta: state })
    .eq('id', itemId)
    .eq('item_type', 'OFERTA')
    .eq('estado_oferta', 'Pendiente')
    .neq('sender_org_id', viewerOrgId)
    .select(COLUMNS);

  if (error) throw error;

  const filas = (data ?? []) as unknown as Row[];
  if (filas.length === 0) {
    throw new Error(
      'La oferta ya no estaba pendiente, o es tuya. Vuelve a cargar el hilo para ver su estado actual.',
    );
  }
  return toCard(filas[0]!);
}

export const acceptOffer = (itemId: string, viewerOrgId: string) =>
  setOfferState(itemId, viewerOrgId, 'Aceptada');

export const rejectOffer = (itemId: string, viewerOrgId: string) =>
  setOfferState(itemId, viewerOrgId, 'Rechazada');

/**
 * Las dos transiciones manuales del hilo.
 *
 * El estado nuevo lo acota `app.guard_thread_state` (0007): desde el cliente solo
 * caben estas dos, y la reversión sella `agreement_reverted_at` ella sola. No se
 * le pide a quien llama que se acuerde — un invariante que depende de eso no es
 * un invariante.
 */
async function setThreadState(threadId: string, state: ThreadState): Promise<void> {
  const { error } = await supabase.from('threads').update({ state }).eq('id', threadId);
  if (error) throw error;
}

export const closeThreadWithoutAgreement = (threadId: string) =>
  setThreadState(threadId, 'CERRADO SIN ACUERDO');

export const revertAgreement = (threadId: string) => setThreadState(threadId, 'ABIERTO');

/**
 * La contraoferta **no está aquí a propósito**: es la fila del día 10 del
 * `Plan §3` ("Contraoferta / modificación de oferta"), y además es la primera
 * candidata del orden de recorte de `Plan §9`.
 *
 * Cuando entre, no es un cambio de estado: es **una fila nueva** que nace
 * `Pendiente` más la anterior a `Superada por contraoferta` con su
 * `superseded_by_item_id` apuntando a la nueva — el CHECK
 * `thread_items_superseded_pair_chk` de 0003 obliga a que esas dos cosas ocurran
 * juntas. Son dos escrituras que tienen que ser atómicas, así que llegará como
 * función en la base, no como dos `update` seguidos desde el navegador.
 */
