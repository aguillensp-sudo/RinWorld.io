import { supabase } from './supabase';
import { ageLabel, ageLevel, daysSince, type AgeLevel } from './inventory';

/**
 * Capa de datos de SRCH-01 · Panel de Resultados de Búsqueda.
 *
 * Mismo reparto que `inventory.ts` y `threads.ts`: la lógica pura se exporta
 * suelta para poder probarla sin base ni React, y lo que toca red son las
 * cuatro funciones del final.
 *
 * **Esta capa la escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3: se
 * reparte por coste del fallo). Aquí el fallo es doblemente silencioso: SRCH-01
 * es la única pantalla del MVP que lee **inventario ajeno**, y una consulta mal
 * filtrada no da error — da una tabla plausible con el catálogo equivocado.
 *
 * La antigüedad no se reimplementa: se reexporta la de `inventory.ts`, que es la
 * misma regla del mismo spec (`data-freshness`) y ya está probada. Dos
 * implementaciones del borde de los 7 días acabarían discrepando, y esa
 * discrepancia costó F-026.
 */

export { ageLabel, ageLevel, daysSince };
export type { AgeLevel };

// -----------------------------------------------------------------------------
// Criterios de búsqueda · los chips de la spec §3
// -----------------------------------------------------------------------------

/** Los siete continentes del CHECK de `organizations_continent_chk` (0001). */
export const ZONES = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  AF: 'África',
  AN: 'Antártida',
  AS: 'Asia',
  EU: 'Europa',
  NA: 'América del Norte',
  OC: 'Oceanía',
  SA: 'América del Sur',
};

/**
 * Los cinco filtros de la spec §3, tal cual los enumera la tabla de chips:
 * Ref · Marca · Qty mín · Zona/País · Lead time máx.
 *
 * `zone` y `country` son un solo chip en pantalla (`Europa · España`) y dos
 * campos aquí porque filtran **cosas distintas**: ver `fetchResults`.
 */
export interface SearchCriteria {
  partNumber: string;
  brand: string;
  minQuantity: number | null;
  zone: Zone | null;
  /** ISO-3166-1 alfa-2, como `organizations.country` y `location_country`. */
  country: string;
  maxLeadTimeDays: number | null;
}

export const EMPTY_CRITERIA: SearchCriteria = {
  partNumber: '',
  brand: '',
  minQuantity: null,
  zone: null,
  country: '',
  maxLeadTimeDays: null,
};

// -----------------------------------------------------------------------------
// Formato
// -----------------------------------------------------------------------------

const REGIONS = new Intl.DisplayNames(['es-ES'], { type: 'region' });

/**
 * El nombre completo del país en el idioma de sesión, **nunca el código ISO**
 * (`single-reference-search`: *"la columna País muestra el nombre completo del
 * país en el idioma de sesión del usuario (nunca código ISO)"*).
 *
 * Sale del CLDR y no de una tabla a mano, y los tests comparan contra esta
 * función y no contra el literal del mock (F-024). La nota de la columna 7 de la
 * spec escribe *"España, Alemania, France..."* — `France` en francés dentro de
 * una lista en español es una errata del propio spec; el bloque "Datos de
 * ejemplo" de la misma spec escribe `Francia`, que es lo que da el CLDR de `es`.
 */
export function countryName(iso: string): string {
  if (!iso) return '';
  try {
    return REGIONS.of(iso.toUpperCase()) ?? iso;
  } catch {
    return iso;
  }
}

const NUMBERS = new Intl.NumberFormat('es-ES');

/**
 * La cantidad disponible. Por `Intl`, nunca a mano: el CLDR de `es` **no agrupa
 * cuatro cifras**, así que 1200 es `1200` y no `1.200`. El mock escribe `1.200`
 * en la fila 3 y es la misma trampa que costó F-024 en el pie de INV-01.
 */
export function quantityLabel(n: number): string {
  return NUMBERS.format(n);
}

/** Columna 5. `null` es "el distribuidor no lo ha publicado", no "cero días". */
export function leadTimeLabel(days: number | null): string {
  if (days === null) return '—';
  return days === 1 ? '1 día' : `${days} días`;
}

/**
 * El contador de la metabarra: `X resultados · Y con stock ≥ [qty mín]`.
 *
 * La segunda mitad **solo existe si hay chip de cantidad mínima**. Sin él, "Y con
 * stock ≥ " no tiene umbral que citar y el mock lo enseña siempre porque su
 * ejemplo siempre lo tiene.
 */
export function metaCounterLabel(total: number, withStock: number, minQuantity: number | null): string {
  const cabeza = total === 1 ? '1 resultado' : `${quantityLabel(total)} resultados`;
  if (minQuantity === null) return cabeza;
  return `${cabeza} · ${withStock} con stock ≥ ${quantityLabel(minQuantity)} u`;
}

// -----------------------------------------------------------------------------
// Chips
// -----------------------------------------------------------------------------

export type ChipKey = 'partNumber' | 'brand' | 'minQuantity' | 'zone' | 'maxLeadTimeDays';

export interface Chip {
  key: ChipKey;
  /** La etiqueta pequeña del chip: `Ref`, `Marca`, … */
  label: string;
  /** El valor ya formateado y listo para pintar. */
  value: string;
}

export const CHIP_LABELS: Record<ChipKey, string> = {
  partNumber: 'Ref',
  brand: 'Marca',
  minQuantity: 'Qty mín',
  zone: 'Zona',
  maxLeadTimeDays: 'Lead time máx',
};

/**
 * Los chips activos, en el orden fijo de la tabla de la spec §3.
 *
 * Es una **función pura derivada de los criterios**, no una lista con estado
 * propio. Si los chips fueran su propio estado habría dos verdades sobre qué se
 * está filtrando —la lista pintada y la consulta lanzada— y acabarían separándose
 * en cuanto VERA escriba sobre una de las dos el día 9. Quitar un chip es
 * blanquear su campo en los criterios, y la lista se recalcula sola.
 *
 * `zone` y `country` comparten chip: `Europa · España`.
 */
export function activeChips(c: SearchCriteria): Chip[] {
  const out: Chip[] = [];
  if (c.partNumber) out.push({ key: 'partNumber', label: CHIP_LABELS.partNumber, value: c.partNumber });
  if (c.brand) out.push({ key: 'brand', label: CHIP_LABELS.brand, value: c.brand });
  if (c.minQuantity !== null) {
    out.push({ key: 'minQuantity', label: CHIP_LABELS.minQuantity, value: `${quantityLabel(c.minQuantity)} u` });
  }
  if (c.zone || c.country) {
    const partes = [c.zone ? ZONE_LABELS[c.zone] : '', c.country ? countryName(c.country) : ''].filter(Boolean);
    out.push({ key: 'zone', label: CHIP_LABELS.zone, value: partes.join(' · ') });
  }
  if (c.maxLeadTimeDays !== null) {
    out.push({ key: 'maxLeadTimeDays', label: CHIP_LABELS.maxLeadTimeDays, value: leadTimeLabel(c.maxLeadTimeDays) });
  }
  return out;
}

/** Quitar un chip. El de zona se lleva por delante zona y país: es un solo chip. */
export function withoutChip(c: SearchCriteria, key: ChipKey): SearchCriteria {
  switch (key) {
    case 'partNumber':
      return { ...c, partNumber: '' };
    case 'brand':
      return { ...c, brand: '' };
    case 'minQuantity':
      return { ...c, minQuantity: null };
    case 'zone':
      return { ...c, zone: null, country: '' };
    case 'maxLeadTimeDays':
      return { ...c, maxLeadTimeDays: null };
  }
}

// -----------------------------------------------------------------------------
// Ordenación
// -----------------------------------------------------------------------------

/**
 * Las **seis** columnas ordenables de la spec §3. Checkbox, Referencia, Empresa y
 * Acciones no lo son, y el orden de las columnas es fijo e inamovible (§7): esto
 * ordena filas, nunca columnas.
 */
export const SORTABLE_COLUMNS = ['brand', 'quantity', 'leadTime', 'country', 'age', 'favorites'] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];

export interface Sort {
  column: SortColumn;
  direction: 'asc' | 'desc';
}

/** Spec §3: *"Por defecto: cantidad disponible descendente"*. */
export const DEFAULT_SORT: Sort = { column: 'quantity', direction: 'desc' };

/**
 * El toggle de tres clics de la spec §3: *"primer clic → ascendente, segundo clic
 * → descendente, tercer clic → restaura orden por defecto"*.
 *
 * `null` significa "vuelta al orden por defecto", que no es lo mismo que
 * `DEFAULT_SORT`: la cabecera de Cantidad tiene que poder perder su indicador
 * aunque el orden resultante coincida.
 */
export function nextSort(current: Sort | null, column: SortColumn): Sort | null {
  if (!current || current.column !== column) return { column, direction: 'asc' };
  if (current.direction === 'asc') return { column, direction: 'desc' };
  return null;
}

function compareBy(column: SortColumn, a: SearchResultRow, b: SearchResultRow): number {
  switch (column) {
    case 'brand':
      return a.brand.localeCompare(b.brand, 'es-ES');
    case 'quantity':
      return a.quantity - b.quantity;
    case 'leadTime':
      // Sin plazo publicado va al final en ascendente. `null` no es 0: una línea
      // sin plazo no es la más rápida.
      return (a.leadTimeDays ?? Number.POSITIVE_INFINITY) - (b.leadTimeDays ?? Number.POSITIVE_INFINITY);
    case 'country':
      // Por el NOMBRE que se ve, no por el ISO. No es lo mismo: `AT` < `DE` por
      // código, y `Alemania` < `Austria` por nombre. Ordenar por el código daría
      // una columna que se ve desordenada y no falla.
      return countryName(a.country).localeCompare(countryName(b.country), 'es-ES');
    case 'age':
      // Más reciente primero en ascendente: "antigüedad ascendente" es menos días.
      return new Date(b.lastUploadAt).getTime() - new Date(a.lastUploadAt).getTime();
    case 'favorites':
      return a.favoriteCount - b.favoriteCount;
  }
}

/**
 * Ordena una copia, nunca el array de entrada.
 *
 * **El desempate por `id` no es cosmético.** Con 215 líneas sembradas hay marcas
 * y cantidades repetidas; sin desempate estable, dos ordenaciones seguidas por la
 * misma columna pueden devolver órdenes distintos y las filas saltan en pantalla
 * al re-renderizar.
 */
export function sortRows(rows: SearchResultRow[], sort: Sort | null): SearchResultRow[] {
  const s = sort ?? DEFAULT_SORT;
  const factor = s.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const c = compareBy(s.column, a, b);
    return c !== 0 ? c * factor : a.id.localeCompare(b.id);
  });
}

/** Columna 4: verde si llega al mínimo pedido, Steel Mist si no (spec §3). */
export function meetsMinQuantity(quantity: number, minQuantity: number | null): boolean {
  return minQuantity === null || quantity >= minQuantity;
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export interface SearchResultRow {
  /** `inventory_lines.id`. Es la unidad de selección y de consulta. */
  id: string;
  partNumber: string;
  brand: string;
  quantity: number;
  leadTimeDays: number | null;
  /** La organización distribuidora, que es de quien es el favorito. */
  orgId: string;
  orgName: string;
  /** ISO-2 de `inventory_lines.location_country`: dónde está el stock. */
  country: string;
  lastUploadAt: string;
  favoriteCount: number;
  isFavorite: boolean;
  /** Ya consultada por mi organización. Spec §3, "Estado de fila ya consultada". */
  consulted: boolean;
}

/**
 * SRCH-01 **no pagina** — su spec §3 no tiene paginador, a diferencia de INV-01.
 * El resultado se trae entero y se ordena en cliente, que es lo único que hace
 * correcta la ordenación por cabecera: ordenar una página de un conjunto
 * paginado reordena 50 filas y miente sobre las demás.
 *
 * El tope existe porque "entero" sin límite es una promesa que no se puede
 * cumplir. Si se alcanza, la pantalla **lo dice** (`capped`) en vez de enseñar
 * 200 filas como si fueran todas: un recorte silencioso es el patrón de F-023.
 */
export const MAX_RESULTS = 200;

/**
 * El embed **no lleva alias**, y es deliberado. Con alias, el filtro de zona
 * tendría que escribirse contra el alias (`org.continent`) y no contra la tabla;
 * un filtro sobre un embed mal nombrado no es un error de sintaxis, es un filtro
 * que PostgREST ignora — y un chip "Europa" que no corta nada devuelve Turquía
 * en una búsqueda europea sin que nada falle. Se deja el nombre real para que la
 * ruta del filtro y la del embed sean la misma cadena.
 *
 * `organizations` es legible: `organizations_select_approved` permite
 * `status = 'APPROVED'`, y las seis distribuidoras del guion lo están. Si no lo
 * fuera, el `!inner` haría desaparecer filas de inventario perfectamente
 * visibles — de ahí que se compruebe en el e2e y no solo aquí.
 */
const COLUMNS =
  'id, part_number, brand, quantity, location_country, lead_time_days, last_upload_at, org_id, ' +
  'organizations!inventory_lines_org_id_fkey!inner(id, name, country, continent, favorite_count)';

interface Row {
  id: string;
  part_number: string;
  brand: string;
  quantity: number;
  location_country: string;
  lead_time_days: number | null;
  last_upload_at: string;
  org_id: string;
  organizations: { id: string; name: string; country: string; continent: string; favorite_count: number } | null;
}

export interface SearchPage {
  rows: SearchResultRow[];
  /** Cuántas cumplen los filtros en total, con tope o sin él. */
  total: number;
  /** `total > MAX_RESULTS`: lo que se ve es un recorte y hay que decirlo. */
  capped: boolean;
}

export interface SearchQuery {
  /** Mi organización: la que NO se busca. */
  orgId: string;
  /** Mi miembro: los favoritos son suyos, no de la organización. */
  memberId: string;
  criteria: SearchCriteria;
}

/**
 * Los resultados de búsqueda: inventario **de las demás organizaciones**.
 *
 * ⚠ TRES COSAS QUE NO SON REDUNDANTES, Y LAS TRES SON SILENCIOSAS SI FALTAN.
 *
 * 1. **`.neq('org_id', orgId)`** — es el espejo exacto del `.eq` de INV-01
 *    (F de `inventory.ts`): `inventory_lines` tiene DOS políticas de lectura
 *    permisivas que **se suman**, y `inventory_select_own` devuelve todo mi
 *    inventario en cualquier estado. Sin este filtro, "busco 6205-2RS" me
 *    encuentra a mí mismo entre los proveedores. No falla nada; sale una fila
 *    plausible y absurda delante del socio.
 * 2. **`.eq('status','PUBLISHED')`** — RLS ya lo impone para las ajenas, pero no
 *    para las propias; y el catálogo sembrado tiene líneas `DRAFT`, `ARCHIVED` y
 *    `DELETED` a propósito.
 * 3. **El embed va con la clave ajena nombrada** aunque `inventory_lines` solo
 *    tenga una FK hacia `organizations`. Es la decisión viva de F-020, y el
 *    día que alguien añada una segunda FK esto seguirá funcionando en vez de
 *    devolver `PGRST201` con la pantalla en blanco.
 *
 * Y una que sí es sutil: **la zona filtra por el continente de la ORGANIZACIÓN,
 * el país por dónde está el STOCK.** Son cosas distintas y el guion de demo
 * depende de ello: Anadolu Rulman lleva `continent = 'AS'` justamente para que el
 * chip "Europa" la corte (`guion-demo-y-siembra.md` §3), mientras que
 * `location_country` dice dónde está la mercancía, que puede no ser la sede.
 */
export async function fetchResults({ orgId, memberId, criteria }: SearchQuery): Promise<SearchPage> {
  let q = supabase
    .from('inventory_lines')
    .select(COLUMNS, { count: 'exact' })
    .eq('status', 'PUBLISHED')
    .neq('org_id', orgId);

  const ref = sanitizeSearch(criteria.partNumber);
  if (ref) q = q.ilike('part_number', `%${ref}%`);

  const brand = sanitizeSearch(criteria.brand);
  if (brand) q = q.ilike('brand', `%${brand}%`);

  if (criteria.minQuantity !== null) q = q.gte('quantity', criteria.minQuantity);
  if (criteria.maxLeadTimeDays !== null) q = q.lte('lead_time_days', criteria.maxLeadTimeDays);
  if (criteria.country) q = q.eq('location_country', criteria.country.toUpperCase());
  if (criteria.zone) q = q.eq('organizations.continent', criteria.zone);

  const { data, error, count } = await q
    .order('quantity', { ascending: false })
    .order('id', { ascending: true })
    .range(0, MAX_RESULTS - 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Row[];
  const [favoritos, consultadas] = await Promise.all([
    fetchFavoriteOrgIds(memberId),
    fetchConsultedLineIds(orgId, rows.map((r) => r.id)),
  ]);

  const total = count ?? rows.length;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      partNumber: r.part_number,
      brand: r.brand,
      quantity: r.quantity,
      leadTimeDays: r.lead_time_days,
      orgId: r.org_id,
      orgName: r.organizations?.name ?? '—',
      country: r.location_country,
      lastUploadAt: r.last_upload_at,
      favoriteCount: r.organizations?.favorite_count ?? 0,
      isFavorite: favoritos.has(r.org_id),
      consulted: consultadas.has(r.id),
    })),
    total,
    capped: total > MAX_RESULTS,
  };
}

/**
 * Mismo saneado que en `inventory.ts` y `threads.ts`, y por la misma razón: los
 * guiones y las barras SÍ se conservan porque `6205-2RS/C3` es justo lo que se
 * busca aquí.
 */
export function sanitizeSearch(raw: string): string {
  return raw.trim().replace(/[,()"*\\]/g, '').slice(0, 80);
}

/**
 * Qué organizaciones tengo marcadas como favoritas.
 *
 * Es **por miembro**, no por organización: `favorites_select_own` restringe a
 * `member_id = auth.uid()`. El recuento agregado que se ve en la columna 9 es
 * otra cosa y viene de `organizations.favorite_count` (migración 0006): la
 * estrella la marca cada uno, el número es de toda la plataforma.
 */
export async function fetchFavoriteOrgIds(memberId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorite_distributors')
    .select('distributor_org_id')
    .eq('member_id', memberId);
  if (error) throw error;
  return new Set(((data ?? []) as { distributor_org_id: string }[]).map((r) => r.distributor_org_id));
}

/**
 * Qué líneas de las que se ven ya ha consultado mi organización.
 *
 * Sostiene el "Estado de fila ya consultada" de la spec §3. `sender_org_id` es
 * mío porque la consulta la envié yo: una consulta que me enviaron a mí sobre mi
 * propia línea no marca nada aquí — y por el `.neq` de `fetchResults` esas líneas
 * ni siquiera están en la tabla.
 */
export async function fetchConsultedLineIds(orgId: string, lineIds: string[]): Promise<Set<string>> {
  if (lineIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('thread_items')
    .select('inventory_line_id')
    .eq('item_type', 'CONSULTA')
    .eq('sender_org_id', orgId)
    .in('inventory_line_id', lineIds);
  if (error) throw error;
  return new Set(
    ((data ?? []) as { inventory_line_id: string | null }[])
      .map((r) => r.inventory_line_id)
      .filter((id): id is string => id !== null),
  );
}

/**
 * Marcar o desmarcar favorita a una distribuidora.
 *
 * El recuento de `organizations.favorite_count` lo mantiene el trigger
 * `favorite_distributors_sync_count`, así que **no se escribe desde aquí** — el
 * guardia `guard_organization_columns` lo rechazaría, y con razón: es un derivado.
 * Quien llama vuelve a consultar para ver el número nuevo.
 */
export async function toggleFavorite(memberId: string, distributorOrgId: string, next: boolean): Promise<void> {
  if (next) {
    const { error } = await supabase
      .from('favorite_distributors')
      .insert({ member_id: memberId, distributor_org_id: distributorOrgId });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('favorite_distributors')
    .delete()
    .eq('member_id', memberId)
    .eq('distributor_org_id', distributorOrgId);
  if (error) throw error;
}
