import { supabase } from './supabase';
import { COUNTRY_OPTIONS } from './access-request';
import {
  countryName,
  fetchConsultedLineIds,
  fetchFavoriteOrgIds,
  quantityLabel,
  ZONE_LABELS,
  ZONES,
  type SearchResultRow,
  type Zone,
} from './search';

/**
 * Capa de datos de la búsqueda en dos fases de SRCH-01 (`openspec/changes/amend-srch01-busqueda-en-dos-fases/`).
 *
 * Fase A: la lista previa de claves (`search_part_keys`). Fase B: el usuario elige claves. Fase C: las ofertas
 * de las claves elegidas (`search_offers`). Las dos RPC son de `0076`.
 *
 * Sustituye al modelo de una sola tabla (`SearchCriteria` y `fetchResults` de `search.ts`), retirado el 25-oct-2026
 * cuando la pantalla, VERA, los lotes y los watchers pasaron a este. No va dentro de `search.ts` porque necesita
 * `COUNTRY_OPTIONS`, y `access-request.ts` ya importa de `search.ts`: sería un import circular.
 *
 * Como `search.ts`, **la escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3): una búsqueda mal filtrada
 * no da error, da una tabla plausible con el catálogo equivocado.
 */

// -----------------------------------------------------------------------------
// Normalización de la referencia (`reference-normalization`)
// -----------------------------------------------------------------------------

/**
 * La clave normalizada: la misma regla que `inventory_lines.part_key` (`0073`-`0075`) y `app.normalize_ref`
 * (`0076`), en el mismo orden:
 *   1. fuera todo lo que no sea letra, número, barra, punto o coma;
 *   2. fuera la barra, el punto o la coma sin un dígito a cada lado (entre dígitos son diámetro o decimal:
 *      `320/28X`, `12.5`);
 *   3. la coma que queda pasa a punto.
 *
 * **No decide qué se busca:** las RPC normalizan en el servidor con `app.normalize_ref`. Esto es para validar
 * (una REF que queda vacía no se lanza) y para pintar. Si se cambia la regla, se cambia en los tres sitios; el
 * test de paridad de `part-search.test.ts` usa la misma tabla de casos que `supabase/tests/10_clave_normalizada.sql`.
 *
 * Los dos `replace` de lookaround miran la cadena del paso anterior entera, igual que `regexp_replace(…, 'g')`
 * en Postgres: no se encadenan carácter a carácter.
 */
export function normalizeRef(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9/.,]/g, '')
    .replace(/(?<![0-9])[/.,]|[/.,](?![0-9])/g, '')
    .replace(/,/g, '.')
    .toUpperCase();
}

// -----------------------------------------------------------------------------
// Zona (ARE): un continente o un país, nunca los dos
// -----------------------------------------------------------------------------

/**
 * El continente filtra por la **sede** de la organización vendedora; el país, por **dónde está el stock**
 * (`DECISIONES-V1.md`, 25-oct-2026). Es lo mismo que hacía la búsqueda vieja con zona y país; lo que cambia es que
 * ya no van juntos, porque ARE es un solo desplegable.
 */
export type Area = { kind: 'zone'; zone: Zone } | { kind: 'country'; country: string } | null;

export function isZone(v: string | null | undefined): v is Zone {
  return !!v && (ZONES as readonly string[]).includes(v);
}

export interface AreaOption {
  /** `zone:EU` o `country:ES`: el `value` del `<option>`. */
  value: string;
  label: string;
  group: 'Continentes' | 'Países';
}

/** `''` es «Cualquiera». */
export function areaValue(a: Area): string {
  if (!a) return '';
  return a.kind === 'zone' ? `zone:${a.zone}` : `country:${a.country}`;
}

export function areaFromValue(v: string): Area {
  const [kind, code] = v.split(':');
  if (kind === 'zone' && isZone(code)) return { kind: 'zone', zone: code };
  if (kind === 'country' && code && /^[A-Z]{2}$/.test(code)) return { kind: 'country', country: code };
  return null;
}

export function areaLabel(a: Area): string {
  if (!a) return 'Cualquiera';
  return a.kind === 'zone' ? ZONE_LABELS[a.zone] : countryName(a.country);
}

/**
 * Las opciones de ARE: primero los continentes y después los países (`SRCH-01_cambios.md` §4), cada grupo por su
 * nombre en español. Los países son los 194 de `COUNTRY_OPTIONS` (REG-00), no solo los que tienen stock: una
 * lista que cambia según el catálogo haría desaparecer la opción que el usuario eligió ayer.
 */
export function areaOptions(): AreaOption[] {
  const continentes = [...ZONES]
    .map((z) => ({ value: `zone:${z}`, label: ZONE_LABELS[z], group: 'Continentes' as const }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es-ES'));
  const paises = COUNTRY_OPTIONS.map(([code]) => ({
    value: `country:${code}`,
    label: countryName(code),
    group: 'Países' as const,
  })).sort((a, b) => a.label.localeCompare(b.label, 'es-ES'));
  return [...continentes, ...paises];
}

// -----------------------------------------------------------------------------
// Criterios
// -----------------------------------------------------------------------------

/** Los campos de `SRCH-01_cambios.md` §2: REF, CHK, MAR, CAN, INC, EXC y ARE. */
export interface PartSearchCriteria {
  /** REF, tal como lo escribe el usuario. Obligatorio. */
  ref: string;
  /** CHK: «contiene». Desmarcado (por defecto) es «empieza por». */
  contains: boolean;
  /** MAR. */
  brand: string;
  /** CAN: cantidad ≥. */
  minQuantity: number | null;
  /** INC y EXC, sobre la clave normalizada. */
  include: string;
  exclude: string;
  /** ARE. */
  area: Area;
}

/**
 * Los criterios al entrar en SRCH-01: todo vacío salvo la zona, que arranca en el continente de la propia
 * organización (`SRCH-01_cambios.md` §4: «solo si el usuario la quita se traerán los resultados de fuera»).
 *
 * Sin continente conocido (una sesión sin él) no se inventa uno: «Cualquiera».
 */
export function initialPartCriteria(orgContinent?: string | null): PartSearchCriteria {
  return {
    ref: '',
    contains: false,
    brand: '',
    minQuantity: null,
    include: '',
    exclude: '',
    area: isZone(orgContinent) ? { kind: 'zone', zone: orgContinent } : null,
  };
}

/** REF obligatorio: vacío o vacío al normalizar (`--`) no se lanza (`single-reference-search`). */
export function canSearch(c: PartSearchCriteria): boolean {
  return normalizeRef(c.ref) !== '';
}

// -----------------------------------------------------------------------------
// Chips (migas de pan)
// -----------------------------------------------------------------------------

export type PartChipKey = 'ref' | 'contains' | 'brand' | 'minQuantity' | 'include' | 'exclude' | 'area';

export interface PartChip {
  key: PartChipKey;
  label: string;
  value: string;
  /** El de REF no se quita: la referencia es obligatoria y se cambia en su campo. */
  removable: boolean;
}

export const PART_CHIP_LABELS: Record<PartChipKey, string> = {
  ref: 'Ref',
  contains: 'Contiene',
  brand: 'Marca',
  minQuantity: 'Cantidad ≥',
  include: 'Incluir',
  exclude: 'Excluir',
  area: 'Zona',
};

/**
 * Los chips activos, en el orden de los campos. Como en `search.ts`, es una función pura de los criterios y no
 * un estado propio: quitar un chip es blanquear su campo.
 *
 * «Contiene» lleva chip porque cambia lo que se busca y, con *Filtros* desmarcada, la casilla no se ve.
 */
export function activePartChips(c: PartSearchCriteria): PartChip[] {
  const out: PartChip[] = [];
  const t = (s: string) => s.trim();
  if (t(c.ref)) out.push({ key: 'ref', label: PART_CHIP_LABELS.ref, value: t(c.ref), removable: false });
  if (c.contains) out.push({ key: 'contains', label: PART_CHIP_LABELS.contains, value: 'Sí', removable: true });
  if (t(c.brand)) out.push({ key: 'brand', label: PART_CHIP_LABELS.brand, value: t(c.brand), removable: true });
  if (c.minQuantity !== null) {
    out.push({
      key: 'minQuantity',
      label: PART_CHIP_LABELS.minQuantity,
      value: `${quantityLabel(c.minQuantity)} u`,
      removable: true,
    });
  }
  if (t(c.include)) out.push({ key: 'include', label: PART_CHIP_LABELS.include, value: t(c.include), removable: true });
  if (t(c.exclude)) out.push({ key: 'exclude', label: PART_CHIP_LABELS.exclude, value: t(c.exclude), removable: true });
  if (c.area) {
    // Un país filtra por dónde está el stock: «Zona España» mentiría.
    out.push({
      key: 'area',
      label: c.area.kind === 'zone' ? PART_CHIP_LABELS.area : 'País',
      value: areaLabel(c.area),
      removable: true,
    });
  }
  return out;
}

export function withoutPartChip(c: PartSearchCriteria, key: PartChipKey): PartSearchCriteria {
  switch (key) {
    case 'ref':
      return c;
    case 'contains':
      return { ...c, contains: false };
    case 'brand':
      return { ...c, brand: '' };
    case 'minQuantity':
      return { ...c, minQuantity: null };
    case 'include':
      return { ...c, include: '' };
    case 'exclude':
      return { ...c, exclude: '' };
    case 'area':
      return { ...c, area: null };
  }
}

// -----------------------------------------------------------------------------
// Parámetros de las RPC
// -----------------------------------------------------------------------------

export interface RpcFilters {
  p_brand: string | null;
  p_min_quantity: number | null;
  p_include: string | null;
  p_exclude: string | null;
  p_zone: string | null;
  p_country: string | null;
}

/**
 * Los filtros comunes, tal como los espera `app.search_where` (`0076`): vacío es `null`, nunca `''`. INC y EXC
 * van sin normalizar a propósito: los normaliza el servidor, que es la única fuente de la regla.
 */
export function rpcFilters(c: PartSearchCriteria): RpcFilters {
  const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    p_brand: orNull(c.brand),
    p_min_quantity: c.minQuantity,
    p_include: orNull(c.include),
    p_exclude: orNull(c.exclude),
    p_zone: c.area?.kind === 'zone' ? c.area.zone : null,
    p_country: c.area?.kind === 'country' ? c.area.country : null,
  };
}

// -----------------------------------------------------------------------------
// Fase A · lista previa
// -----------------------------------------------------------------------------

/** 4 columnas × 15 filas (`design.md` §3). Es el `p_page_size` por defecto de la RPC; se manda igual. */
export const PART_KEYS_PAGE_SIZE = 60;

export interface PartKey {
  key: string;
  /** Líneas de oferta, no empresas (`DECISIONES-V1.md`, 25-oct-2026). */
  offers: number;
}

export interface PartKeysPage {
  keys: PartKey[];
  totalKeys: number;
  totalOffers: number;
  /**
   * Con qué cadena se encontró. Si es más corta que la referencia normalizada, hubo recorte (caso 1.3) y la
   * pantalla tiene que decirlo. `null` con cero claves es el caso 1.4.
   */
  matchedRef: string | null;
  /** `matchedRef` es un recorte de lo buscado (caso 1.3). */
  truncated: boolean;
  page: number;
  pageCount: number;
}

interface PartKeyRow {
  part_key: string;
  offers: number;
  total_keys: number;
  total_offers: number;
  matched_ref: string;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * La lista previa de una búsqueda, página `page` (desde 1).
 *
 * ⚠ Una página fuera de rango vuelve vacía y sin totales (los totales viajan en cada fila): eso NO es el caso
 * 1.4. Solo la página 1 vacía lo es, y por eso `matchedRef` y los totales se fían únicamente de lo que llega.
 */
export async function fetchPartKeys(criteria: PartSearchCriteria, page = 1): Promise<PartKeysPage> {
  const { data, error } = await supabase.rpc('search_part_keys', {
    p_ref: criteria.ref,
    p_contains: criteria.contains,
    ...rpcFilters(criteria),
    p_page: page,
    p_page_size: PART_KEYS_PAGE_SIZE,
  });
  if (error) throw error;

  const rows = (data ?? []) as PartKeyRow[];
  const first = rows[0];
  const totalKeys = Number(first?.total_keys ?? 0);
  const matchedRef = first?.matched_ref ?? null;
  return {
    keys: rows.map((r) => ({ key: r.part_key, offers: Number(r.offers) })),
    totalKeys,
    totalOffers: Number(first?.total_offers ?? 0),
    matchedRef,
    truncated: matchedRef !== null && matchedRef !== normalizeRef(criteria.ref),
    page,
    pageCount: pageCount(totalKeys, PART_KEYS_PAGE_SIZE),
  };
}

// -----------------------------------------------------------------------------
// Fase C · ofertas
// -----------------------------------------------------------------------------

export const OFFERS_PAGE_SIZE = 50;

/**
 * Qué ofertas se piden: las de unas claves (selección manual o «las de esta página»), o las de toda la búsqueda
 * («Ver ofertas de todas»). Para «todas» viaja la cadena con la que se encontró (`matchedRef`), no la que
 * escribió el usuario: si hubo recorte, la lista previa es la del recorte y las ofertas tienen que ser las mismas.
 */
export type OffersSelection = { kind: 'keys'; keys: string[] } | { kind: 'all'; matchedRef: string };

export interface OffersQuery {
  /** Mi organización: para marcar las líneas ya consultadas. La RPC ya excluye las mías. */
  orgId: string;
  /** Mi miembro: los favoritos son suyos. */
  memberId: string;
  criteria: PartSearchCriteria;
  selection: OffersSelection;
  page?: number;
  /**
   * Filas por página. Por defecto `OFFERS_PAGE_SIZE` (la tabla). VERA pide más de una vez (hasta 200, el tope de la
   * RPC) para poder ordenar por cantidad las de una clave sin quedarse solo con las 50 más recientes.
   */
  pageSize?: number;
  /** Los favoritos de `memberId`, ya pedidos: los lotes los piden una vez para todas sus referencias (`F-274`). */
  favoritos?: Promise<Set<string>>;
}

export interface OffersPage {
  rows: SearchResultRow[];
  total: number;
  page: number;
  pageCount: number;
}

interface OfferRow {
  id: string;
  part_number: string;
  part_key: string;
  brand: string;
  quantity: number;
  lead_time_days: number | null;
  location_country: string;
  last_upload_at: string;
  org_id: string;
  org_name: string;
  org_country: string;
  org_continent: string;
  favorite_count: number;
  total: number;
}

/**
 * Una página de ofertas, de la más reciente a la más antigua (`offers-list`). Las filas son `SearchResultRow`,
 * la forma que ya pintaba `ResultsTable`, así que la tabla no ha cambiado.
 */
export async function fetchOffers({
  orgId,
  memberId,
  criteria,
  selection,
  page = 1,
  pageSize = OFFERS_PAGE_SIZE,
  favoritos: favoritosYaPedidos,
}: OffersQuery): Promise<OffersPage> {
  const params =
    selection.kind === 'keys'
      ? { p_keys: selection.keys }
      : { p_ref: selection.matchedRef, p_contains: criteria.contains };

  const { data, error } = await supabase.rpc('search_offers', {
    ...params,
    ...rpcFilters(criteria),
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as OfferRow[];
  const [favoritos, consultadas] = await Promise.all([
    favoritosYaPedidos ?? fetchFavoriteOrgIds(memberId),
    fetchConsultedLineIds(
      orgId,
      rows.map((r) => r.id),
    ),
  ]);

  const total = Number(rows[0]?.total ?? 0);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      partNumber: r.part_number,
      brand: r.brand,
      quantity: r.quantity,
      leadTimeDays: r.lead_time_days,
      orgId: r.org_id,
      orgName: r.org_name ?? '—',
      country: r.location_country,
      lastUploadAt: r.last_upload_at,
      favoriteCount: r.favorite_count ?? 0,
      isFavorite: favoritos.has(r.org_id),
      consulted: consultadas.has(r.id),
    })),
    total,
    page,
    pageCount: pageCount(total, pageSize),
  };
}
