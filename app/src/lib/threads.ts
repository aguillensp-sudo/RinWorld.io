import { supabase } from './supabase';

/**
 * Capa de datos de MSG-01 · Lista de Hilos.
 *
 * Mismo reparto que `inventory.ts`: la lógica pura se exporta suelta para poder
 * probarla sin base ni React, y lo que toca red es `fetchThreadPage`.
 *
 * **Esta capa la escribe Claude Code a mano, no el Coder.** No es por
 * desconfianza: `CLAUDE.md` §3 reparte por coste del fallo, y aquí el fallo es
 * silencioso — un embed mal escrito o un estado derivado a ojo no rompen nada
 * visible, solo enseñan lo que no toca. El Coder recibe estos tipos ya hechos.
 */

/** Los CINCO estados de `messaging-and-negotiation · thread-lifecycle`, literales
 *  del CHECK de la migración 0003. No se traducen ni se abrevian. */
export const THREAD_STATES = [
  'ABIERTO',
  'CON CONSULTA PENDIENTE',
  'CON OFERTA PENDIENTE',
  'ACUERDO ALCANZADO',
  'CERRADO SIN ACUERDO',
] as const;
export type ThreadState = (typeof THREAD_STATES)[number];

/** Los tres de `thread_items.item_type`. */
export type ItemType = 'MENSAJE' | 'CONSULTA' | 'OFERTA';

/**
 * El último elemento del hilo, **solo metadatos**.
 *
 * No hay aquí ningún campo que venga de descifrar nada, y no es una omisión: el
 * spec §7 lo pone como obligación de diseño E2EE — *"la vista previa nunca
 * muestra contenido descifrado"*. El texto del mensaje, la cantidad de la
 * consulta y las cifras de la oferta viven en `content_ciphertext` y no salen de
 * ahí en esta pantalla.
 */
export interface LastItem {
  type: ItemType;
  partNumber: string | null;
  /**
   * Si lo envió **mi** organización. Es metadato en claro (`sender_org_id`), no
   * sale de descifrar nada, así que no rompe la regla de arriba.
   *
   * ⚠ **Se deriva aquí y no en cada consumidor, y eso es todo el arreglo de
   * `F-102`.** Sin este campo, la única pista que le llegaba a VERA era el
   * estado del hilo, y `CON CONSULTA PENDIENTE` se lee como *"tienes una
   * consulta que responder"* cuando significa *"hay una consulta esperando
   * respuesta, de cualquiera de los dos lados"*. El modelo rellenó el hueco y
   * mandó al usuario a contestar una consulta que había enviado él mismo —
   * F-075 palabra por palabra, aplicado a un campo en vez de a unas filas.
   *
   * Va como `isOwn` y no como `senderOrgId` a propósito: un id suelto obliga a
   * cada consumidor a acordarse de compararlo contra el suyo, y olvidarlo es
   * exactamente el fallo que costó este hallazgo. Aquí `orgId` ya se conoce.
   * Quién es «el otro» no hace falta guardarlo: un hilo es por **pareja** de
   * organizaciones (`0014:167`), así que si no es mío es de la contraparte.
   */
  isOwn: boolean;
}

export interface ThreadSummary {
  id: string;
  /** La otra organización: la de `org_low_id` o la de `org_high_id`, la que no
   *  sea la mía. El par va en orden canónico en base, no por rol. */
  counterpartyName: string;
  counterpartyCountry: string;
  state: ThreadState;
  lastItemAt: string;
  lastItem: LastItem | null;
}

/** Spec §3: 30 hilos por página, server-side. */
export const PAGE_SIZE = 30;

// -----------------------------------------------------------------------------
// Lógica pura
// -----------------------------------------------------------------------------

export type StateTone = 'neutral' | 'info' | 'warn' | 'success' | 'closed';

/**
 * El tono del badge, no su color. La spec §3 da hex (`#2563EB`, `#d97706`,
 * `#16a34a`), pero un componente que reciba un hex no puede usar tokens, y C3
 * lo suspendería con razón. El mapeo hex→token vive en el CSS, que es su sitio.
 */
export function stateTone(state: ThreadState): StateTone {
  switch (state) {
    case 'CON CONSULTA PENDIENTE':
      return 'info';
    case 'CON OFERTA PENDIENTE':
      return 'warn';
    case 'ACUERDO ALCANZADO':
      return 'success';
    case 'CERRADO SIN ACUERDO':
      return 'closed';
    default:
      return 'neutral';
  }
}

/**
 * La vista previa del último elemento. Metadatos y nada más.
 *
 * ⚠ La spec se contradice consigo misma aquí, y se resuelve a favor de §7. La §3
 * dice que si la passphrase no está activa la vista previa muestra `• • • • • •`;
 * la §7 dice que la vista previa **nunca** muestra contenido descifrado. Si nunca
 * lo muestra, no hay nada que ocultar cuando falta la clave: el tipo de elemento
 * y la referencia son metadatos en claro en `thread_items` (columnas
 * `item_type`, `part_number`, `brand`, comentadas en la migración 0003 como
 * "METADATO EN CLARO" precisamente para que VND-01 y VERA puedan usarlas). Los
 * puntitos ocultarían un dato que ya es público en la base y que la pantalla
 * necesita para ser útil. Ver F-027.
 */
export function previewLabel(item: LastItem | null): string {
  if (!item) return 'Sin actividad';
  if (item.type === 'MENSAJE') return 'Mensaje libre';
  const cabeza = item.type === 'CONSULTA' ? 'Tarjeta de consulta' : 'Tarjeta de oferta';
  return item.partNumber ? `${cabeza} · ${item.partNumber}` : cabeza;
}

const RELATIVE = new Intl.RelativeTimeFormat('es-ES', { numeric: 'always', style: 'narrow' });

/**
 * El timestamp relativo del último elemento.
 *
 * Sale de `Intl.RelativeTimeFormat`, no de una tabla de cadenas a mano, **y los
 * tests comparan contra esta función, nunca contra el literal del mock** (F-024).
 * El bloque "Datos de ejemplo" de la spec escribe `hace 2h` y `hace 1d` en el uso
 * informal; lo que el CLDR de `es` produce en estilo estrecho es `hace 2 h` y
 * `hace 1 d`. Manda el CLDR: se mantiene solo y es correcto en español.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const secs = Math.round((ms - now.getTime()) / 1000);
  const abs = Math.abs(secs);
  if (abs < 60) return RELATIVE.format(Math.round(secs), 'second');
  if (abs < 3600) return RELATIVE.format(Math.round(secs / 60), 'minute');
  if (abs < 86_400) return RELATIVE.format(Math.round(secs / 3600), 'hour');
  return RELATIVE.format(Math.round(secs / 86_400), 'day');
}

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
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
  last_item_at: string;
  org_low: OrgRow | null;
  org_high: OrgRow | null;
}

/**
 * ⚠ LOS DOS EMBEDS VAN CON LA CLAVE AJENA NOMBRADA, Y AQUÍ NO ES OPCIONAL.
 *
 * `threads` tiene **tres** claves ajenas hacia `organizations` — `org_low_id`,
 * `org_high_id` y `created_by_org_id` —, así que `organizations(name)` a secas
 * devuelve `PGRST201` *"more than one relationship was found"* y la pantalla se
 * queda en blanco. Es exactamente lo que dejó el login roto varias horas el día 3
 * con una sola FK de más (F-020), y aquí hay tres desde el primer minuto.
 */
const COLUMNS =
  'id, org_low_id, org_high_id, state, last_item_at, ' +
  'org_low:organizations!threads_org_low_id_fkey(id, name, country), ' +
  'org_high:organizations!threads_org_high_id_fkey(id, name, country)';

export interface ThreadPage {
  threads: ThreadSummary[];
  total: number;
}

export interface ThreadQuery {
  orgId: string;
  search: string;
  page: number;
}

/**
 * Mismo saneado que en `inventory.ts` y por la misma razón: el `or()` de
 * PostgREST es un mini-lenguaje donde la coma y el paréntesis son separadores, y
 * un término con una coma no da error — da **otro filtro**.
 */
export function sanitizeSearch(raw: string): string {
  return raw.trim().replace(/[,()"*\\]/g, '').slice(0, 80);
}

/**
 * La búsqueda del spec §3 es *"por nombre de organización"*, y se resuelve en dos
 * pasos: primero los ids de las organizaciones que casan, después los hilos que
 * las tienen de contraparte.
 *
 * La alternativa era filtrar en el cliente sobre la página ya cargada, y es la
 * mala: con más de 30 hilos, buscar solo miraría la página actual y devolvería
 * "no hay resultados" sobre un hilo que existe. Un resultado vacío y falso no se
 * distingue de uno vacío y cierto, y ese es el patrón de fallo silencioso que
 * este proyecto lleva cuatro hallazgos persiguiendo.
 */
async function orgIdsMatching(term: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', `%${term}%`);
  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map((o) => o.id);
}

/**
 * Una página de hilos de mi organización, más reciente primero.
 *
 * A diferencia de `inventory_lines`, aquí **no hace falta un `.eq` defensivo**:
 * `threads` tiene una sola política de lectura (`threads_select_participant`, con
 * `app.current_org_id() in (org_low_id, org_high_id)`), no dos permisivas que se
 * sumen. La diferencia está comprobada en `messages.spec.ts` contra la base real,
 * porque es justo la clase de cosa que un test de unidad con mock no puede ver.
 */
export async function fetchThreadPage({ orgId, search, page }: ThreadQuery): Promise<ThreadPage> {
  let q = supabase.from('threads').select(COLUMNS, { count: 'exact' });

  const term = sanitizeSearch(search);
  if (term) {
    const ids = await orgIdsMatching(term);
    // Ninguna organización casa: no hay hilos que buscar. Se devuelve vacío sin
    // preguntar, porque un `in.()` vacío es sintaxis inválida en PostgREST.
    if (ids.length === 0) return { threads: [], total: 0 };
    q = q.or(`org_low_id.in.(${ids.join(',')}),org_high_id.in.(${ids.join(',')})`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await q
    .order('last_item_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as ThreadRow[];
  const lastItems = await fetchLastItems(rows.map((r) => r.id), orgId);

  return {
    threads: rows.map((r) => {
      const other = r.org_low_id === orgId ? r.org_high : r.org_low;
      return {
        id: r.id,
        counterpartyName: other?.name ?? '—',
        counterpartyCountry: other?.country ?? '',
        state: r.state,
        lastItemAt: r.last_item_at,
        lastItem: lastItems.get(r.id) ?? null,
      };
    }),
    total: count ?? 0,
  };
}

/**
 * El último elemento de cada hilo de la página, en una sola consulta.
 *
 * Se piden solo las cuatro columnas de metadatos. `content_ciphertext` no se
 * trae: no se puede enseñar, así que traerlo solo sería mover bytes cifrados a un
 * navegador que no tiene con qué abrirlos.
 *
 * `sender_org_id` entra el 17-ago por `F-102` y `orgId` con ella: sin comparar
 * las dos aquí, la dirección del último elemento no llega a ningún consumidor.
 */
async function fetchLastItems(
  threadIds: string[],
  orgId: string,
): Promise<Map<string, LastItem>> {
  const out = new Map<string, LastItem>();
  if (threadIds.length === 0) return out;

  const { data, error } = await supabase
    .from('thread_items')
    .select('thread_id, item_type, part_number, sender_org_id, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as unknown as {
    thread_id: string;
    item_type: ItemType;
    part_number: string | null;
    sender_org_id: string;
  }[]) {
    // Vienen ordenados descendente: el primero de cada hilo es el último elemento.
    if (!out.has(row.thread_id)) {
      out.set(row.thread_id, {
        type: row.item_type,
        partNumber: row.part_number,
        isOwn: row.sender_org_id === orgId,
      });
    }
  }
  return out;
}
