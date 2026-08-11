import { supabase } from './supabase';
import type { OfferCard, OfferState } from './offers';
import type { ItemType, ThreadState } from './threads';

/**
 * Capa de datos de MSG-02 · Vista de un Hilo.
 *
 * **La escribe Claude Code a mano, no el Coder** — mismo reparto por coste del
 * fallo que `threads.ts` (`CLAUDE.md` §3). Aquí hay dos cosas que fallan en
 * silencio: el embed de las dos organizaciones del hilo, que ya costó horas el
 * día 3 con una FK de más (F-020), y **la frontera de lo cifrado**, que es el
 * argumento entero del producto.
 *
 * ── LA COSTURA (D-07-05) ────────────────────────────────────────────────────
 *
 * `ThreadItem.content` es `ItemContent | null`, y **`null` no significa "vacío":
 * significa "cifrado y sin clave en esta sesión"**. Es un estado de primera clase
 * de la pantalla, no un caso de error.
 *
 * Hoy `decryptItem` devuelve `null` siempre, porque hoy no hay con qué descifrar:
 * `app/src` no tiene criptografía —la rebanada E2EE es la fila del día 8 del
 * `Plan §3`— y la siembra lleva relleno a propósito (`demo_threads.sql:16`). La
 * pantalla pinta las dos ramas desde el primer commit; el día 8 se rellena esta
 * función y **la pantalla no se toca**. Si el día 8 alguien se encuentra editando
 * un `.tsx`, la costura estaba mal puesta.
 *
 * Los metadatos NO pasan por la costura: tipo, autor, timestamp, `part_number`,
 * `brand` y el estado de la tarjeta van en claro en `thread_items` desde el día 2
 * —la migración 0003 los comenta como "METADATO EN CLARO" para esto mismo—. Un
 * hilo sin passphrase no es una pantalla en blanco: es una pantalla con todo
 * salvo las cifras y el texto.
 */

// -----------------------------------------------------------------------------
// Lo que hay dentro del blob
// -----------------------------------------------------------------------------

/** Los dos estados de `thread_items.estado_consulta` (CHECK de 0003). */
export type InquiryState = 'Pendiente' | 'Respondida con oferta';

/**
 * El contenido descifrado de un elemento, por tipo.
 *
 * Es exactamente lo que la cabecera de `thread_items` en 0003 declara que va
 * dentro de `content_ciphertext`: *"el texto del mensaje libre, o la cantidad de
 * la consulta, o TODAS las cifras de la oferta"*. Ni un campo de aquí existe en
 * claro en el servidor, y por eso todo cuelga de la costura y no de la fila.
 */
export interface MessageContent {
  kind: 'MENSAJE';
  text: string;
}

export interface InquiryContent {
  kind: 'CONSULTA';
  quantity: number;
  /** `inquiry-card`: comentario opcional, máximo 300 caracteres. */
  comment: string | null;
}

export interface OfferContent {
  kind: 'OFERTA';
  unitPrice: number;
  currency: string;
  quantity: number;
  leadTimeDays: number | null;
  /** `null`, **nunca `0`**: un cero dice "portes gratis" (`offer-card`). */
  shippingCost: number | null;
  shippingCostCurrency: string | null;
  validUntil: string | null;
  notes: string | null;
}

export type ItemContent = MessageContent | InquiryContent | OfferContent;

// -----------------------------------------------------------------------------
// Los tipos de la pantalla
// -----------------------------------------------------------------------------

export interface ThreadItem {
  id: string;
  type: ItemType;
  senderOrgId: string;
  /** Si lo escribió mi organización. Decide el lado de la burbuja y nada más:
   *  quién puede *actuar* sobre una oferta lo decide `offerActions`. */
  isOwn: boolean;
  createdAt: string;
  partNumber: string | null;
  brand: string | null;
  offerState: OfferState | null;
  inquiryState: InquiryState | null;
  respondsToItemId: string | null;
  supersededByItemId: string | null;
  /** `null` = cifrado sin clave en esta sesión. Ver la costura, arriba. */
  content: ItemContent | null;
}

export interface ThreadDetail {
  id: string;
  /** La otra organización: la de `org_low_id` o la de `org_high_id`, la que no
   *  sea la mía. El par va en orden canónico en base, no por rol. */
  counterpartyId: string;
  counterpartyName: string;
  /** Código ISO de 2 letras, como en MSG-01. La spec §3 lo pide así; el HTML
   *  aprobado escribe "Alemania" y es el mock: manda el spec (F-041). */
  counterpartyCountry: string;
  state: ThreadState;
}

// -----------------------------------------------------------------------------
// Los literales que la pantalla enseña, y de dónde salen
// -----------------------------------------------------------------------------

/**
 * VERBATIM de la capability, no una redacción de la casa:
 * `messaging-and-negotiation/spec.md:68`, escenario *"contenido cifrado sin
 * passphrase activa"*. Es contrato, no elección de copy.
 *
 * **Se pinta sin botón** (D-07-05). La §3 de MSG-02 pide un bloque brass con
 * `Introducir frase de seguridad`; en el MVP las claves viven en memoria de
 * sesión y se pierden al recargar (`CLAUDE.md` §4), así que ese botón pediría una
 * frase que no existe y prometería recuperación de claves que no hay. Es F-027
 * otra vez: el indicador informa, no ofrece.
 */
export const ENCRYPTED_NOTICE = 'Contenido cifrado — introduce tu frase de seguridad para ver';

/**
 * D-07-05. El motivo va en **texto visible**, no en un `title` ni en un
 * `aria-describedby`: un control inerte sin explicación se lee como avería
 * (F-023 e, y `Messages.tsx:107` ya lo resolvió así).
 */
export const SEND_DISABLED_REASON = 'El cifrado en cliente llega en la rebanada E2EE.';

/**
 * D-07-04. Dice la verdad y no promete nada: no es una función que falte, es que
 * el estado **no se marca a mano por diseño**. `thread-lifecycle` lo alcanza
 * aceptando una oferta (`spec.md:195`) y `app.guard_thread_state` levanta
 * excepción ante cualquier otro valor puesto desde el cliente (`0007:246`).
 */
export const AGREEMENT_DISABLED_REASON = 'El acuerdo se alcanza aceptando una oferta.';

/** `Crear oferta` abre MSG-03, que no está construida. */
export const CREATE_OFFER_DISABLED_REASON = 'La tarjeta de oferta (MSG-03) queda fuera del MVP.';

// -----------------------------------------------------------------------------
// Lógica pura
// -----------------------------------------------------------------------------

/**
 * El nombre de la organización que firma el elemento.
 *
 * Existe como función y no como ternario suelto porque lo necesitan la burbuja y
 * la tarjeta, y dos componentes que lo calculen aparte acaban discrepando — que
 * es literalmente la lección del estado vacío de MSG-01.
 */
export function authorLabel(
  item: ThreadItem,
  names: { ownOrgName: string; counterpartyName: string },
): string {
  return item.isOwn ? names.ownOrgName : names.counterpartyName;
}

/**
 * La etiqueta del tipo de elemento. Las dos de tarjeta salen del HTML aprobado
 * (`card-type-badge`); `MENSAJE` no lleva badge en el mock y su etiqueta existe
 * para el nombre accesible, no para pintarla.
 */
export function itemTypeLabel(type: ItemType): string {
  switch (type) {
    case 'CONSULTA':
      return 'Consulta';
    case 'OFERTA':
      return 'Oferta';
    default:
      return 'Mensaje';
  }
}

/**
 * Un elemento de tipo OFERTA visto como `OfferCard`, para poder pasárselo a
 * `offerActions()` sin reconstruirlo a mano.
 *
 * **Esto no es azúcar sintáctico.** `offerActions` es lo único que sabe que
 * *sólo el receptor decide* —regla que la base tardó dos migraciones y un F-056
 * en sostener de verdad—, y si la pantalla se monta la condición por su cuenta
 * (`item.isOwn`, `item.offerState === 'Pendiente'`…) esa regla pasa a estar
 * escrita en dos sitios. Devuelve `null` para lo que no es una oferta.
 */
export function asOfferCard(item: ThreadItem, threadId: string): OfferCard | null {
  if (item.type !== 'OFERTA' || item.offerState === null) return null;
  return {
    id: item.id,
    threadId,
    senderOrgId: item.senderOrgId,
    state: item.offerState,
    partNumber: item.partNumber,
    brand: item.brand,
    createdAt: item.createdAt,
    respondsToItemId: item.respondsToItemId,
    supersededByItemId: item.supersededByItemId,
  };
}

// -----------------------------------------------------------------------------
// La costura
// -----------------------------------------------------------------------------

/** Lo que sale de la fila y entra al descifrado. `bytea` llega como cadena hex
 *  (`\x…`) por PostgREST. */
export interface EncryptedBlob {
  type: ItemType;
  ciphertext: string | null;
  iv: string | null;
}

/**
 * ⚠ ESTA ES LA COSTURA, Y HOY DEVUELVE `null` SIEMPRE. Es deliberado (D-07-05).
 *
 * No hay clave con la que abrir nada: la rebanada E2EE es la fila del **día 8**
 * del `Plan §3` y `app/src` no tiene una sola línea de criptografía. Devolver
 * `null` es la respuesta correcta y honesta a *"¿qué dice este elemento?"* cuando
 * la respuesta es "no lo sé y el servidor tampoco".
 *
 * Lo que **no** se hace, y queda escrito para que nadie lo intente el día que
 * corra prisa: no se lee el ciphertext como si fuera texto, y no se inventa
 * contenido de relleno para que la pantalla luzca. Una pantalla que enseña cifras
 * que nadie escribió es el riesgo #1 de `CLAUDE.md` §7 llevado al historial.
 *
 * El día 8 esto se rellena —AES-256-GCM con el `iv` de la fila y la clave de
 * sesión— y **no se toca nada más**.
 */
export function decryptItem(_blob: EncryptedBlob): ItemContent | null {
  return null;
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

interface OrgRow {
  id: string;
  name: string;
  country: string;
}

interface ThreadRow {
  id: string;
  org_low_id: string;
  org_high_id: string;
  state: ThreadState;
  org_low: OrgRow | null;
  org_high: OrgRow | null;
}

/**
 * ⚠ LOS DOS EMBEDS VAN CON LA CLAVE AJENA NOMBRADA. Igual que en `threads.ts` y
 * por lo mismo: `threads` tiene **tres** FK hacia `organizations` y
 * `organizations(name)` a secas devuelve `PGRST201`. Ver F-020.
 */
const THREAD_COLUMNS =
  'id, org_low_id, org_high_id, state, ' +
  'org_low:organizations!threads_org_low_id_fkey(id, name, country), ' +
  'org_high:organizations!threads_org_high_id_fkey(id, name, country)';

export async function fetchThreadDetail(threadId: string, orgId: string): Promise<ThreadDetail> {
  const { data, error } = await supabase
    .from('threads')
    .select(THREAD_COLUMNS)
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  // `maybeSingle` devuelve `null` sin error cuando la política de lectura no deja
  // ver la fila, que es indistinguible de "no existe" — y así debe ser: decir
  // "existe pero no es tuyo" ya sería filtrar. Se trata como no encontrado.
  if (!data) throw new Error('Este hilo no existe o no es de tu organización.');

  const row = data as unknown as ThreadRow;
  const other = row.org_low_id === orgId ? row.org_high : row.org_low;

  return {
    id: row.id,
    counterpartyId: other?.id ?? '',
    counterpartyName: other?.name ?? '—',
    counterpartyCountry: other?.country ?? '',
    state: row.state,
  };
}

interface ItemRow {
  id: string;
  item_type: ItemType;
  sender_org_id: string;
  created_at: string;
  part_number: string | null;
  brand: string | null;
  estado_oferta: OfferState | null;
  estado_consulta: InquiryState | null;
  responds_to_item_id: string | null;
  superseded_by_item_id: string | null;
  content_ciphertext: string | null;
  content_iv: string | null;
}

const ITEM_COLUMNS =
  'id, item_type, sender_org_id, created_at, part_number, brand, ' +
  'estado_oferta, estado_consulta, responds_to_item_id, superseded_by_item_id, ' +
  'content_ciphertext, content_iv';

/**
 * El historial completo del hilo, **ascendente** — el más antiguo arriba, como
 * pide la §3. No hay paginación: la §3 de MSG-02 no tiene paginador, a diferencia
 * de la de MSG-01.
 *
 * ⚠ AQUÍ SÍ SE TRAE `content_ciphertext`, y `threads.ts` decidió lo contrario a
 * propósito. No es una incoherencia: en MSG-01 el blob no se puede enseñar
 * *nunca* —la vista previa jamás muestra contenido descifrado (§7)—, así que
 * traerlo sería mover bytes inútiles. En MSG-02 el contenido **es** la pantalla,
 * y traer el blob desde hoy es lo que hace que la costura sea real: el día 8 se
 * rellena `decryptItem` y no se toca ni esta consulta ni el `.tsx`.
 */
export async function fetchThreadItems(threadId: string, orgId: string): Promise<ThreadItem[]> {
  const { data, error } = await supabase
    .from('thread_items')
    .select(ITEM_COLUMNS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    type: r.item_type,
    senderOrgId: r.sender_org_id,
    isOwn: r.sender_org_id === orgId,
    createdAt: r.created_at,
    partNumber: r.part_number,
    brand: r.brand,
    offerState: r.estado_oferta,
    inquiryState: r.estado_consulta,
    respondsToItemId: r.responds_to_item_id,
    supersededByItemId: r.superseded_by_item_id,
    content: decryptItem({
      type: r.item_type,
      ciphertext: r.content_ciphertext,
      iv: r.content_iv,
    }),
  }));
}
