import { supabase } from './supabase';
import type { OfferCard, OfferState } from './offers';
import type { ItemType, ThreadState } from './threads';
import {
  type SessionKeyPair,
  decryptContent,
  encryptContent,
  fromBytea,
  generateCek,
  toHex,
  unwrapCek,
  wrapCekFor,
} from './crypto';
import { currentKeyPair, fetchThreadRecipients } from './keys';

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
 * `SEND_DISABLED_REASON` vivía aquí y **se ha retirado hoy (D-08-02)**. Decía
 * *"El cifrado en cliente llega en la rebanada E2EE"*, y la rebanada es hoy: un
 * literal que promete algo ya entregado envejece peor que no tenerlo.
 *
 * Queda anotado en vez de borrado en silencio porque el contrato de aceptación
 * de MSG-02 lo comprobaba en pantalla, y quien vea desaparecer ese aserto tiene
 * que poder saber si se cumplió o se tapó. Se cumplió: `sendMessage` está más
 * abajo y el pie de composición envía.
 */

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
 * La fecha de validez de una oferta, legible.
 *
 * `validUntil` llega ya descifrado y es un ISO. Pintarlo en crudo pone
 * `2026-07-15T00:00:00.000Z` en la cara del usuario — que es lo que hacía el
 * artefacto del Coder, y ningún check lo vio porque la rama descifrada no se
 * ejercita hasta el día 8.
 *
 * Va aquí y no en el componente por la regla de la casa: las fechas se formatean
 * con las funciones de la capa de datos, nunca a mano (F-024). Si la cadena no
 * es una fecha, se devuelve tal cual: inventarse un `—` taparía el dato.
 */
export function validUntilLabel(iso: string, locale = 'es-ES'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(t),
  );
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

/** La CEK de este elemento, envuelta para MÍ. `bytea` llega como `\x…`. */
export interface WrappedForMe {
  wrappedCek: string;
  wrapIv: string;
  ephemeralPublicKey: string;
}

/** Lo que sale de la fila y entra al descifrado. `bytea` llega como cadena hex
 *  (`\x…`) por PostgREST. */
export interface EncryptedBlob {
  type: ItemType;
  ciphertext: string | null;
  iv: string | null;
  /**
   * `null` = **no hay fila mía** en `thread_item_keys` para este elemento.
   *
   * Pasa de verdad y no es un error: `item_keys_select_own` (`0003:353`) reparte
   * por persona, así que un elemento escrito para la clave que yo tenía en otra
   * sesión llega aquí sin envoltura utilizable. Es el caso normal del MVP con
   * claves aleatorias (`CLAUDE.md` §4).
   */
  wrapped: WrappedForMe | null;
}

/**
 * ⚠ ESTA ES LA COSTURA. El día 7 devolvía `null` siempre; hoy descifra.
 *
 * **`null` sigue significando exactamente lo mismo que el día 7** —"cifrado y
 * sin clave en esta sesión"— y por eso la pantalla no cambia: lo que cambia es
 * cuántas veces se da ese caso, no qué se hace con él. D-07-05 puso la costura
 * aquí justo para que hoy no hubiera que tocar ni un `.tsx`.
 *
 * Devuelve `null`, sin distinguir, en los cuatro caminos que significan lo
 * mismo desde la pantalla:
 *
 *   1. no hay llavero en esta sesión;
 *   2. no hay fila de `thread_item_keys` para mí;
 *   3. la envoltura no abre — es lo que pasa **tras recargar** con claves
 *      aleatorias: la CEK se envolvió para mi clave anterior, que ya no existe;
 *   4. el contenido no cuadra con el tipo del elemento.
 *
 * ⚠ **El caso 4 no es paranoia de más.** Los metadatos van en claro y el
 * contenido va cifrado: nada obliga a que un elemento marcado `OFERTA` lleve
 * dentro cifras de oferta. Sin esta comprobación, un blob con `kind: 'MENSAJE'`
 * dentro de una fila `OFERTA` haría que la tarjeta pintara campos vacíos como si
 * fueran datos. Es el riesgo #1 de `CLAUDE.md` §7 —afirmar con aplomo un dato
 * falso— por la puerta de atrás.
 *
 * Lo que **no** se hace, y queda escrito para el día que corra prisa: no se lee
 * el ciphertext como si fuera texto y no se inventa contenido de relleno para
 * que la pantalla luzca.
 */
export async function decryptItem(
  blob: EncryptedBlob,
  keyPair: SessionKeyPair | null,
): Promise<ItemContent | null> {
  if (!keyPair || !blob.wrapped || !blob.ciphertext || !blob.iv) return null;

  try {
    const cek = await unwrapCek(
      {
        wrappedCek: fromBytea(blob.wrapped.wrappedCek),
        wrapIv: fromBytea(blob.wrapped.wrapIv),
        ephemeralPublicKey: fromBytea(blob.wrapped.ephemeralPublicKey),
      },
      keyPair,
    );
    const contenido = await decryptContent(fromBytea(blob.ciphertext), fromBytea(blob.iv), cek);
    return contenido !== null && typeof contenido === 'object' &&
      (contenido as { kind?: unknown }).kind === blob.type
      ? (contenido as ItemContent)
      : null;
  } catch {
    // Se traga a propósito y sin ruido: en el MVP, "no abre" es el estado normal
    // de todo lo cifrado antes de la recarga, y un `console.error` por elemento
    // llenaría la consola de la demo de rojo describiendo el funcionamiento
    // correcto. Lo que NO se hace es devolver algo distinto de `null`.
    return null;
  }
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
  thread_item_keys: { wrapped_cek: string; wrap_iv: string; ephemeral_pubkey: string }[] | null;
}

/**
 * ⚠ EL EMBED DE `thread_item_keys` DEVUELVE COMO MUCHO UNA FILA, Y NO ES SUERTE:
 * `item_keys_select_own` (`0003:353`) filtra por `recipient_member_id =
 * auth.uid()`. Aunque el elemento tenga una CEK envuelta por cada miembro de las
 * dos organizaciones, por aquí solo baja la mía. Es la política haciendo el
 * trabajo, no la consulta — y por eso no lleva `.eq()` de miembro: filtrar aquí
 * además sugeriría que sin el filtro se verían las ajenas.
 *
 * Va con la clave ajena SIN nombrar porque `thread_item_keys` tiene un único
 * camino hacia `thread_items` (`item_id`). Los de `threads` sí van nombrados, y
 * la diferencia es real: allí hay tres FK hacia `organizations` (F-020).
 */
const ITEM_COLUMNS =
  'id, item_type, sender_org_id, created_at, part_number, brand, ' +
  'estado_oferta, estado_consulta, responds_to_item_id, superseded_by_item_id, ' +
  'content_ciphertext, content_iv, ' +
  'thread_item_keys(wrapped_cek, wrap_iv, ephemeral_pubkey)';

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

  /**
   * ⚠ EL `Promise.all` ES LO QUE MANTIENE LA COSTURA EN SU SITIO. `decryptItem`
   * pasó a ser asíncrona hoy porque `crypto.subtle` lo es — no hay forma de que
   * no lo sea— pero `fetchThreadItems` **ya era asíncrona el día 7** y devuelve
   * lo mismo que devolvía. Por eso D-07-05 se sostiene y no se toca ni un
   * `.tsx`: quien llama no distingue una costura vacía de una llena.
   *
   * El llavero se lee aquí dentro, de `keys.ts`, y no entra por parámetro
   * justamente para eso: un parámetro nuevo habría subido hasta `Thread.tsx`.
   */
  const keyPair = currentKeyPair();

  return Promise.all(
    ((data ?? []) as unknown as ItemRow[]).map(async (r) => ({
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
      content: await decryptItem(
        {
          type: r.item_type,
          ciphertext: r.content_ciphertext,
          iv: r.content_iv,
          wrapped: toWrapped(r.thread_item_keys),
        },
        keyPair,
      ),
    })),
  );
}

/** El embed llega como lista de 0 o 1 por RLS. Aquí se le pone nombre. */
function toWrapped(filas: ItemRow['thread_item_keys']): WrappedForMe | null {
  const fila = filas?.[0];
  if (!fila) return null;
  return {
    wrappedCek: fila.wrapped_cek,
    wrapIv: fila.wrap_iv,
    ephemeralPublicKey: fila.ephemeral_pubkey,
  };
}

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

/**
 * Escribe un mensaje libre cifrado en el hilo (D-08-02).
 *
 * El `Plan §3` del día 8 dice *"cifrado de campos de **oferta** en cliente"*, y
 * el mensaje libre entra por decisión del PO del 12-ago: es el caso más simple
 * del mismo blob y el mismo algoritmo, y **es lo único que hace observable en la
 * interfaz la reapertura del hilo de D-07-01**, que hasta hoy solo sostenían dos
 * asertos de SQL.
 *
 * ── EL ORDEN DE LOS PASOS ES EL CONTRATO ────────────────────────────────────
 *
 * 1. **Se piden los destinatarios ANTES de cifrar.** Si falta la clave de
 *    alguien, no se ha gastado nada y no hay nada que deshacer.
 * 2. **Si falta una sola clave, no se envía.** Se podría envolver para quien sí
 *    la tiene y el `insert` funcionaría — y la otra persona vería `Contenido
 *    cifrado` para siempre sin nada que lo explicara. Es el fallo silencioso que
 *    0012 §3 se negó a esconder en la base; esconderlo aquí sería lo mismo.
 * 3. **Una CEK nueva por elemento**, envuelta una vez por destinatario, incluido
 *    quien escribe: sin su copia no podría releerse (`0003:263`).
 * 4. **Una sola llamada** a `create_thread_item`, que mete el elemento y sus
 *    claves en la misma transacción. Dos escrituras sueltas podrían dejar un
 *    elemento sin claves, que es ilegible para siempre y no se puede reparar
 *    (0012 §5).
 */
export async function sendMessage(threadId: string, text: string): Promise<void> {
  const cuerpo = text.trim();
  if (!cuerpo) throw new Error('El mensaje está vacío.');

  const keyPair = currentKeyPair();
  if (!keyPair) {
    throw new Error(
      'Tu clave de cifrado no está lista en esta sesión. Vuelve a entrar antes de escribir.',
    );
  }

  const destinatarios = await fetchThreadRecipients(threadId);
  const sinClave = destinatarios.filter((d) => d.publicKey === null);
  if (sinClave.length > 0) {
    throw new Error(
      `No se puede cifrar todavía: ${sinClave.length} ${
        sinClave.length === 1 ? 'destinatario no ha' : 'destinatarios no han'
      } publicado su clave pública. Tienen que entrar una vez en la aplicación.`,
    );
  }
  if (destinatarios.length === 0) {
    throw new Error('Este hilo no tiene destinatarios: vuelve a cargarlo.');
  }

  const cek = await generateCek();
  const { ciphertext, iv } = await encryptContent({ kind: 'MENSAJE', text: cuerpo }, cek);

  const claves = await Promise.all(
    destinatarios.map(async (d) => {
      const w = await wrapCekFor(cek, d.publicKey!);
      return {
        member_id: d.memberId,
        wrapped_cek: toHex(w.wrappedCek),
        wrap_iv: toHex(w.wrapIv),
        ephemeral_pubkey: toHex(w.ephemeralPublicKey),
      };
    }),
  );

  const { error } = await supabase.rpc('create_thread_item', {
    p_thread_id: threadId,
    p_item_type: 'MENSAJE',
    // Hex pelado, sin `\x`: es el contrato de 0012 §5, porque PostgREST no
    // transporta `bytea` dentro de un JSON.
    p_ciphertext: toHex(ciphertext),
    p_iv: toHex(iv),
    p_keys: claves,
  });
  if (error) throw error;
}
