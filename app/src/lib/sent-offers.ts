import { supabase } from './supabase';
import type { OfferState } from './offers';

/**
 * Capa de datos de VND-01 · Mis Ofertas (vista del vendedor).
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3), y se entrega
 * escrita y probada, no declarada (F-057). Aquí hay dos cosas que fallan en
 * silencio: el embed de las dos organizaciones del hilo —que ya costó horas el
 * día 3 con una FK de más (F-020)— y **la frontera de RNG-VND-01**, que es la
 * razón entera de que esta pantalla exista.
 *
 * ── RNG-VND-01, Y ES LO PRIMERO QUE HAY QUE ENTENDER ────────────────────────
 *
 * *"Ningún campo de contenido E2EE (unit_price, quantity, currency,
 * lead_time_days, shipping_cost, valid_until, notes) es devuelto ni mostrado en
 * esta vista."*
 *
 * `SENT_OFFER_COLUMNS` **no pide `content_ciphertext` ni `content_iv`**, y eso
 * no es un ahorro de bytes: es la regla. La rebanada E2EE entró hoy mismo y
 * `decryptItem` funciona, así que a partir de ahora descifrar aquí es
 * *técnicamente posible* — y sigue estando prohibido. Una vista agregada que
 * descifra convierte la promesa del producto en una cuestión de disciplina del
 * cliente. Si algún día hace falta, se decide en el spec, no aquí.
 *
 * ── LO QUE ESTA PANTALLA NO PUEDE SABER, Y POR QUÉ ──────────────────────────
 *
 * **`valid_until` vive DENTRO del blob cifrado** (`0003:121` lo lista entre los
 * campos que van dentro de `content_ciphertext`; no hay columna en claro —
 * comprobado sobre las doce migraciones). O sea que VND-01 **no puede calcular
 * si una oferta ha caducado** sin descifrar, y descifrar es justo lo que
 * RNG-VND-01 prohíbe.
 *
 * De ahí se caen dos cosas de la spec de pantalla, y se caen por el esquema, no
 * por recorte de alcance:
 *
 * - **el badge `EXPIRADA` de la §5.2** — y da igual, porque D-07-03 ya lo había
 *   degradado a etiqueta de presentación: una oferta caducada **sigue siendo
 *   `Pendiente` y sigue siendo aceptable**;
 * - **la acción `Renovar` de la §5.3 y su RNG-VND-03**, que solo existía para el
 *   estado `EXPIRADA`.
 *
 * Y `Retirar oferta` tampoco entra, por **D-07-02**: `RETIRADA` no está en el
 * MVP. Entre las tres, la tabla de acciones de la §5.3 se queda en **una sola
 * acción para los cuatro estados**: abrir el hilo.
 */

// -----------------------------------------------------------------------------
// Los estados, y el caso que la spec de pantalla no contempla
// -----------------------------------------------------------------------------

/**
 * ⚠ LOS BADGES VAN CAPITALIZADOS, NO EN MAYÚSCULAS, y la §5.2 dice lo contrario.
 *
 * La spec de VND-01 escribe `PENDIENTE`, `ACEPTADA`, `RECHAZADA`. El literal
 * real es el del CHECK de `0003:132` y el de la capability `offer-card`:
 * `Pendiente`, `Aceptada`, `Rechazada`, `Superada por contraoferta`. **Manda el
 * esquema**, por lo mismo que en F-041: MSG-02 ya pinta esos cuatro literales, y
 * dos pantallas del mismo producto llamando de dos formas distintas al mismo
 * estado es peor que cualquiera de las dos opciones.
 *
 * Y hay un cuarto estado que la §5.2 **no menciona**: `Superada por
 * contraoferta`. Existe en el esquema, es terminal, y una oferta puede estar ahí
 * — así que VND-01 tiene que pintarlo o mentirá por omisión.
 */
export interface SentOffer {
  id: string;
  threadId: string;
  partNumber: string | null;
  brand: string | null;
  counterpartyId: string;
  counterpartyName: string;
  state: OfferState;
  createdAt: string;
}

/** Las cuatro columnas ordenables de la §5.4. `Acciones` no lo es. */
export type SortColumn = 'referencia' | 'organizacion' | 'estado' | 'fecha';
export type SortDirection = 'asc' | 'desc';

/** §5.4: *"Orden por defecto: Fecha descendente"*. */
export const DEFAULT_SORT: { column: SortColumn; direction: SortDirection } = {
  column: 'fecha',
  direction: 'desc',
};

// -----------------------------------------------------------------------------
// Literales que ve el usuario · VERBATIM de la spec, con sus acentos (F-048)
// -----------------------------------------------------------------------------

export const EYEBROW = 'Vendiendo · VND-01';
export const TITLE = 'Mis ofertas';
export const SUBTITLE =
  'Resumen de las ofertas enviadas a compradores. Para ver precio y condiciones de una oferta, abre el hilo correspondiente.';
export const SEARCH_PLACEHOLDER = 'Buscar por referencia u organización…';

/** §5.5, los dos estados vacíos. Son distintos y dicen cosas distintas. */
export const EMPTY_NO_OFFERS = 'No tienes ofertas enviadas aún.';
export const EMPTY_NO_MATCHES = 'No hay ofertas que coincidan con la búsqueda.';

/**
 * §5.3. `Ver acuerdo` cuando la oferta está aceptada, `Ver hilo` en los otros
 * tres. Es la única diferencia que queda entre estados, porque `Retirar oferta`
 * (D-07-02) y `Renovar` (sin `EXPIRADA`) no entran.
 */
export function rowActionLabel(state: OfferState): string {
  return state === 'Aceptada' ? 'Ver acuerdo' : 'Ver hilo';
}

/**
 * §4: *"Conteo de resultados: `N ofertas`"*.
 *
 * El singular no está en la spec y hace falta igual: `1 ofertas` delante del
 * socio es la clase de detalle que le hace dudar del resto. Se resuelve aquí y
 * no en el componente para que haya un solo sitio donde mirarlo.
 */
export function resultCountLabel(n: number): string {
  return n === 1 ? '1 oferta' : `${n} ofertas`;
}

/**
 * §5.1, columna 4: *"Timestamp de envío de la oferta — `DD Mmm YYYY`"*.
 *
 * Va aquí y no en el componente por la regla de la casa: las fechas se formatean
 * con funciones de la capa de datos, nunca a mano (F-024) — y el día 7 ya costó
 * un defecto que ningún check vio, un ISO entero pintado en crudo (F-059). Si la
 * cadena no es una fecha se devuelve tal cual: inventarse un `—` taparía el dato.
 */
export function sentAtLabel(iso: string, locale = 'es-ES'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(t));
}

// -----------------------------------------------------------------------------
// Filtrado y ordenación · lógica pura
// -----------------------------------------------------------------------------

/**
 * §4: *"Filtra en tiempo real: Sí — sobre Referencia y Organización"*.
 *
 * En cliente y no en la base a propósito, y es una decisión con motivo: la §4
 * pide filtrado **en tiempo real**, y una pantalla que va al servidor en cada
 * tecla parpadea y gasta. Se puede permitir porque VND-01 no tiene paginador —
 * a diferencia de MSG-01— así que la lista completa ya está en memoria.
 *
 * `brand` entra en la búsqueda además de `part_number` porque la columna 1
 * enseña `part_number · brand` como una sola cosa, y quien lee `6205-2RS · NSK`
 * espera que buscar `NSK` encuentre esa fila.
 */
export function filterSentOffers(offers: SentOffer[], query: string): SentOffer[] {
  const q = query.trim().toLowerCase();
  if (!q) return offers;
  return offers.filter(
    (o) =>
      (o.partNumber ?? '').toLowerCase().includes(q) ||
      (o.brand ?? '').toLowerCase().includes(q) ||
      o.counterpartyName.toLowerCase().includes(q),
  );
}

/**
 * §5.4. Devuelve una lista NUEVA: ordenar en el sitio mutaría el array del
 * estado de React y el re-render se saltaría.
 *
 * El desempate siempre es por fecha descendente. Sin él, ordenar por `Estado`
 * —que tiene cuatro valores para N filas— dejaría el resto en un orden que
 * depende del motor de `sort`, y la tabla parecería barajarse sola al volver a
 * pulsar una cabecera distinta.
 */
export function sortSentOffers(
  offers: SentOffer[],
  column: SortColumn,
  direction: SortDirection,
): SentOffer[] {
  const signo = direction === 'asc' ? 1 : -1;
  const texto = (o: SentOffer): string => {
    switch (column) {
      case 'referencia':
        return `${o.partNumber ?? ''} ${o.brand ?? ''}`.trim();
      case 'organizacion':
        return o.counterpartyName;
      case 'estado':
        return o.state;
      default:
        return '';
    }
  };

  return [...offers].sort((a, b) => {
    if (column === 'fecha') {
      const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return d * signo;
    }
    // `localeCompare` y no `<`: con acentos y mayúsculas, el orden de los puntos
    // de código pone `Ácido` detrás de `Zinc`, y la columna Organización lleva
    // nombres como `Nordwälz Lager` y `Łożyska Wschód`.
    const c = texto(a).localeCompare(texto(b), 'es');
    return c !== 0 ? c * signo : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// -----------------------------------------------------------------------------
// Consulta
// -----------------------------------------------------------------------------

interface OrgRow {
  id: string;
  name: string;
}

interface Row {
  id: string;
  thread_id: string;
  estado_oferta: OfferState;
  part_number: string | null;
  brand: string | null;
  created_at: string;
  threads: {
    org_low_id: string;
    org_high_id: string;
    org_low: OrgRow | null;
    org_high: OrgRow | null;
  } | null;
}

/**
 * ⚠ NI `content_ciphertext` NI `content_iv`. Es RNG-VND-01 escrito como consulta:
 * lo que no se pide no se puede pintar por descuido.
 *
 * ⚠ Y LOS DOS EMBEDS DE ORGANIZACIÓN VAN CON LA CLAVE AJENA NOMBRADA, igual que
 * en `threads.ts` y `thread-detail.ts`: `threads` tiene **tres** FK hacia
 * `organizations` y `organizations(name)` a secas devuelve `PGRST201` (F-020).
 */
const SENT_OFFER_COLUMNS =
  'id, thread_id, estado_oferta, part_number, brand, created_at, ' +
  'threads!thread_items_thread_id_fkey(' +
  'org_low_id, org_high_id, ' +
  'org_low:organizations!threads_org_low_id_fkey(id, name), ' +
  'org_high:organizations!threads_org_high_id_fkey(id, name))';

/**
 * Las ofertas que **ha emitido** mi organización.
 *
 * ⚠ `sender_org_id = orgId` ES RNG-VND-02, NO UNA OPTIMIZACIÓN: *"Solo se
 * muestran ofertas en las que la organización activa es la emisora (vendedor).
 * Las ofertas recibidas como comprador no aparecen en esta vista."* RLS deja ver
 * las dos direcciones —`thread_items_select_participant` filtra por hilo, no por
 * emisor— así que **este filtro es lo único que separa "mis ofertas" de "las
 * ofertas de mis hilos"**. Sin él la pantalla enseñaría las del comprador junto a
 * las suyas y parecería que funciona.
 *
 * El orden por defecto de la §5.4 se pide ya al servidor; la ordenación por
 * cabecera vuelve a ordenar en cliente sobre la lista completa.
 */
export async function fetchSentOffers(orgId: string): Promise<SentOffer[]> {
  const { data, error } = await supabase
    .from('thread_items')
    .select(SENT_OFFER_COLUMNS)
    .eq('item_type', 'OFERTA')
    .eq('sender_org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const t = r.threads;
    const otra = t && t.org_low_id === orgId ? t.org_high : t?.org_low;
    return {
      id: r.id,
      threadId: r.thread_id,
      partNumber: r.part_number,
      brand: r.brand,
      counterpartyId: otra?.id ?? '',
      // El guion es el mismo que usa MSG-02 cuando el embed no resuelve. No se
      // deja vacío: una celda en blanco se lee como un fallo de carga.
      counterpartyName: otra?.name ?? '—',
      state: r.estado_oferta,
      createdAt: r.created_at,
    };
  });
}
