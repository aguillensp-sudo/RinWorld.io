import { supabase } from './supabase';

/**
 * Capa de datos de INV-01 · Panel de Inventario.
 *
 * La lógica pura (antigüedad, paginación, saneado de búsqueda) vive aquí y se
 * exporta suelta para poder probarla sin base de datos ni React. Lo que toca red
 * son las cuatro funciones `fetch*` / `set*` del final.
 */

/** Los CUATRO estados de `inventory-management · inventory-line-lifecycle`. */
export type LineStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

export interface InventoryLine {
  id: string;
  partNumber: string;
  brand: string;
  quantity: number;
  country: string;
  productFamily: string;
  status: LineStatus;
  leadTimeDays: number | null;
  lastUploadAt: string;
}

/** Los cuatro chips de la spec, en su orden fijo. No se añaden ni se reordenan. */
export const FILTERS = ['todos', 'publicados', 'desactualizados', 'archivados'] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_LABELS: Record<Filter, string> = {
  todos: 'Todos',
  publicados: 'Publicados',
  desactualizados: 'Desactualizados',
  archivados: 'Archivados',
};

/** `data-freshness`: los indicadores se derivan de `last_upload_at`. */
export const STALE_DAYS = 7;
export const CRITICAL_DAYS = 30;

/** Spec §3: paginación server-side, 50 líneas por página. */
export const PAGE_SIZE = 50;

// -----------------------------------------------------------------------------
// Antigüedad
// -----------------------------------------------------------------------------

/** Días naturales completos transcurridos. `now` entra por parámetro para que
 *  los tests no dependan del reloj. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export type AgeLevel = 'fresh' | 'stale' | 'critical';

/**
 * `inventory-management · data-freshness` y spec §3 columna 6: naranja **> 7**
 * días, rojo **> 30**. Estrictamente mayor: a los 7 días exactos la línea
 * todavía no está desactualizada, y ese borde es el que decide de qué color sale
 * un tercio de la tabla.
 */
export function ageLevel(days: number): AgeLevel {
  if (days > CRITICAL_DAYS) return 'critical';
  if (days > STALE_DAYS) return 'stale';
  return 'fresh';
}

export function ageLabel(days: number): string {
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

// -----------------------------------------------------------------------------
// Paginación
// -----------------------------------------------------------------------------

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * Los botones de página que se pintan, con `null` por cada elipsis. Siempre la
 * primera, la última, y la actual con un vecino a cada lado.
 */
export function pageButtons(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current, current - 1, current + 1]);
  const out: (number | null)[] = [];
  for (let p = 1; p <= total; p++) {
    if (keep.has(p)) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Búsqueda
// -----------------------------------------------------------------------------

/**
 * Sanea el término antes de meterlo en un `or()` de PostgREST.
 *
 * `or=(part_number.ilike.*x*,brand.ilike.*x*)` es un mini-lenguaje, y la coma, el
 * paréntesis y la comilla son sus separadores: un término con una coma no da un
 * error, da **otro filtro** — el usuario buscaría una cosa y la tabla respondería
 * a otra. Los guiones y puntos SÍ se conservan: `NU2210-E-TVP2` y `6205-2RS/C3`
 * son referencias reales y son justo lo que se busca aquí.
 */
export function sanitizeSearch(raw: string): string {
  return raw.trim().replace(/[,()"*\\]/g, '').slice(0, 80);
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

const COLUMNS =
  'id, part_number, brand, quantity, location_country, product_family, status, lead_time_days, last_upload_at';

interface Row {
  id: string;
  part_number: string;
  brand: string;
  quantity: number;
  location_country: string;
  product_family: string;
  status: LineStatus;
  lead_time_days: number | null;
  last_upload_at: string;
}

function toLine(r: Row): InventoryLine {
  return {
    id: r.id,
    partNumber: r.part_number,
    brand: r.brand,
    quantity: r.quantity,
    country: r.location_country,
    productFamily: r.product_family,
    status: r.status,
    leadTimeDays: r.lead_time_days,
    lastUploadAt: r.last_upload_at,
  };
}

/**
 * El instante a partir del cual una línea cuenta como desactualizada, tanto en la
 * tarjeta "Desactualizadas" como en el chip y en su filtro.
 *
 * ⚠ RESTA `STALE_DAYS + 1` DÍAS, Y NO ES UN ERROR DE ÍNDICE. La regla del spec es
 * "> 7 días", y la columna Antigüedad la aplica sobre días **enteros**: una línea
 * de 7,6 días enseña "Hace 7 días" y sale sin colorear, porque `ageLevel` evalúa
 * `7 > 7`. Con el corte en `now - 7d` esa misma línea sí entraba en el recuento, y
 * el resultado era un chip que decía `Desactualizados (3)` sobre una tabla con dos
 * filas en naranja. Recuento y color tienen que salir del mismo borde, y el borde
 * es el número entero que el usuario ve.
 *
 * Con `lte` la equivalencia es exacta y no aproximada:
 *   `last_upload_at <= now - 8d`  ⟺  `edad >= 8d`  ⟺  `floor(edad) > 7`  ⟺  `ageLevel != 'fresh'`
 *
 * Ver F-026.
 */
export function staleCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - (STALE_DAYS + 1) * 86_400_000).toISOString();
}

export interface Page {
  lines: InventoryLine[];
  total: number;
}

export interface PageQuery {
  orgId: string;
  filter: Filter;
  search: string;
  page: number;
}

/**
 * Una página del inventario **propio**.
 *
 * ⚠ EL `.eq('org_id', orgId)` NO ES REDUNDANTE, y esto es lo más fácil de
 * equivocar de todo el fichero. `inventory_lines` tiene DOS políticas de lectura
 * permisivas: `inventory_select_own` (todo el inventario propio, en cualquier
 * estado) y `inventory_select_cross_org` (el PUBLISHED de las demás). Se suman.
 * Sin el filtro explícito, "Mi inventario" mostraría también el stock publicado
 * de las otras cinco organizaciones — y con el catálogo del día 3 sembrado, eso
 * son 196 líneas ajenas mezcladas con las propias, sin que nada falle ni avise.
 * RLS protege de leer lo que no toca; no elige por ti qué quieres leer.
 */
export async function fetchPage({ orgId, filter, search, page }: PageQuery): Promise<Page> {
  let q = supabase
    .from('inventory_lines')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', orgId);

  // `DELETED` es una lápida: fuera de los cuatro chips, siempre. Ver el
  // comentario largo en `Inventory.tsx`.
  if (filter === 'todos') q = q.neq('status', 'DELETED');
  if (filter === 'publicados') q = q.eq('status', 'PUBLISHED');
  if (filter === 'archivados') q = q.eq('status', 'ARCHIVED');
  if (filter === 'desactualizados') {
    q = q.eq('status', 'PUBLISHED').lte('last_upload_at', staleCutoff());
  }

  const term = sanitizeSearch(search);
  if (term) q = q.or(`part_number.ilike.*${term}*,brand.ilike.*${term}*`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await q
    .order('last_upload_at', { ascending: false })
    .order('part_number', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;
  return { lines: (data ?? []).map((r) => toLine(r as unknown as Row)), total: count ?? 0 };
}

export interface Stats {
  published: number;
  stale: number;
  lastUploadAt: string | null;
  /** Sin instrumentar. Ver el comentario de `fetchStats`. */
  visits: null;
}

/**
 * Las cuatro tarjetas de resumen de la spec §3.
 *
 * La cuarta, "Visitas recibidas (30 días)", **devuelve `null` a propósito**. No
 * hay ninguna tabla de visitas en el esquema y no está en el plan del MVP;
 * inventar un número, o derivarlo de algo que no lo mide, sería exactamente el
 * riesgo #1 de `CLAUDE.md` §7 aplicado a la interfaz: una cifra con aplomo que no
 * significa nada, delante del socio. La tarjeta se pinta con un guion.
 */
export async function fetchStats(orgId: string, now: Date = new Date()): Promise<Stats> {
  const base = () => supabase.from('inventory_lines').select('id', { count: 'exact', head: true }).eq('org_id', orgId);

  const [pub, stale, last] = await Promise.all([
    base().eq('status', 'PUBLISHED'),
    base().eq('status', 'PUBLISHED').lte('last_upload_at', staleCutoff(now)),
    supabase
      .from('inventory_lines')
      .select('last_upload_at')
      .eq('org_id', orgId)
      .neq('status', 'DELETED')
      .order('last_upload_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const r of [pub, stale, last]) if (r.error) throw r.error;

  return {
    published: pub.count ?? 0,
    stale: stale.count ?? 0,
    lastUploadAt: (last.data as { last_upload_at: string } | null)?.last_upload_at ?? null,
    visits: null,
  };
}

/**
 * Archivar y eliminar, las dos acciones de la columna 7.
 *
 * Eliminar es un cambio de estado a `DELETED`, no un `delete`: el spec define
 * cuatro estados y la línea puede estar referenciada por una tarjeta de consulta
 * de un hilo abierto. Un borrado físico se llevaría por delante la trazabilidad
 * de una negociación en curso.
 *
 * El `.eq('org_id', orgId)` tampoco es redundante aquí: `inventory_write_own` ya
 * lo impone, pero un `update` que la política rechaza afecta a **cero filas y no
 * da error** — silencio en vez de fallo. Con el filtro explícito, el recuento de
 * filas afectadas es la respuesta.
 */
async function setStatus(id: string, orgId: string, status: LineStatus): Promise<void> {
  const { error } = await supabase
    .from('inventory_lines')
    .update({ status })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

export const archiveLine = (id: string, orgId: string) => setStatus(id, orgId, 'ARCHIVED');
export const deleteLine = (id: string, orgId: string) => setStatus(id, orgId, 'DELETED');
