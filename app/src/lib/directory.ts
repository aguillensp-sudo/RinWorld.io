import { supabase } from './supabase';
import { countryName, sanitizeSearch } from './search';

/**
 * Capa de datos de DIR-01 · Directorio de Organizaciones.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3, y
 * `UMBRAL-FABRICA-V1.md` §1: la capa de datos es precondición de la pantalla, no
 * producto de la fábrica). DIR-01 es la primera de las tres pantallas con las que
 * se mide el H1, así que esta capa es además la referencia contra la que se leerá
 * su coste: cuanto más se decida aquí, menos decide el generador.
 *
 * Mismo reparto que `search.ts` e `inventory.ts`: la lógica pura arriba y suelta,
 * para probarla sin base ni React, y lo que toca red al final.
 *
 * ⚠ **TRES COSAS QUE EL ESQUEMA NO DICE COMO LA SPEC.** Las tres se descubrieron
 * cruzando la spec con el catálogo de la base, no leyendo una de las dos:
 *
 * 1. **La spec dice `ACTIVE` y ese estado NO EXISTE.**
 *    `organizations_status_chk` admite exactamente `PENDING_REVIEW`, `APPROVED`,
 *    `REJECTED` y `SUSPENDED`. Lo que la spec llama *"organizaciones activas"* es
 *    `APPROVED`, y así se filtra aquí. Quien lea la spec y busque `ACTIVE` en el
 *    esquema no lo va a encontrar.
 * 2. **El filtro por estado va explícito aunque la RLS ya filtre.**
 *    `organizations_select_approved` deja ver `status = 'APPROVED'` **o la
 *    propia organización, en el estado que sea**. Sin el `.eq` de abajo, una
 *    organización propia en `PENDING_REVIEW` se vería a sí misma en el directorio
 *    público. No falla nada: sale una fila plausible que no debería estar. Es la
 *    misma forma del `.neq` de `search.ts`, y por la misma razón.
 * 3. **La columna País es el CÓDIGO ISO, no el nombre.** Al revés que en
 *    SRCH-01, donde la spec exige el nombre completo en el idioma de sesión
 *    (`countryName`). Aquí la spec pide *"badge monoespaciado · código ISO 2
 *    letras"*. No es una incoherencia que haya que arreglar: son dos decisiones
 *    de diseño distintas para dos pantallas distintas, y por eso `country` y
 *    `countryLabel` viajan las dos en la fila -- el código para el badge, el
 *    nombre para el desplegable de filtro y para el nombre accesible.
 */

// -----------------------------------------------------------------------------
// Paginación · la spec §3 la quiere en servidor
// -----------------------------------------------------------------------------

/** *"Paginación bajo la tabla: 50 organizaciones por página… Server-side."* */
export const PAGE_SIZE = 50;

/** Cuántas páginas hay. Siempre al menos una: cero resultados es una página vacía, no cero páginas. */
export function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
}

/**
 * La página pedida, encajada en el rango que existe. Las páginas son 1-based
 * porque la navegación de la spec es numérica y empieza en 1: convertir a
 * 0-based solo en el borde, justo antes del `range()`.
 */
export function clampPage(page: number, total: number): number {
  const paginas = pageCountFor(total);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), paginas);
}

// -----------------------------------------------------------------------------
// Filtros · los dos controles de la spec §3
// -----------------------------------------------------------------------------

export interface DirectoryFilters {
  /** ISO-3166-1 alfa-2, como `organizations.country`. Vacío = todos los países. */
  country: string;
  /** Coincidencia parcial sobre el nombre, en servidor. Vacío = todas. */
  name: string;
}

export const EMPTY_FILTERS: DirectoryFilters = { country: '', name: '' };

/**
 * Si hay algún filtro puesto. Lo usa el botón `Limpiar filtros`, que la spec
 * quiere **visible solo cuando hay algo que limpiar**.
 */
export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return filters.country !== '' || filters.name.trim() !== '';
}

// -----------------------------------------------------------------------------
// Orden · tres de las cinco columnas
// -----------------------------------------------------------------------------

/**
 * Las tres columnas reordenables de la spec: Nombre, País y Favoritos. Teléfono
 * y Email no lo son, y no es un olvido de la spec: ordenar un directorio por
 * número de teléfono no significa nada.
 *
 * Los nombres son los de la COLUMNA EN LA BASE, no los del encabezado, porque
 * van directos al `.order()`. Un `SORT_FIELDS` con `favoritos` en vez de
 * `favorite_count` obligaría a una tabla de traducción en medio, que es una
 * fuente de fallos silenciosos a cambio de nada.
 */
export const SORT_FIELDS = ['name', 'country', 'favorite_count'] as const;
export type DirectorySortField = (typeof SORT_FIELDS)[number];

export interface DirectorySort {
  field: DirectorySortField;
  ascending: boolean;
}

/** *"Orden por defecto: alfabético ascendente"* sobre Nombre. */
export const DEFAULT_SORT: DirectorySort = { field: 'name', ascending: true };

/**
 * Pulsar una cabecera: si ya ordenaba por ella, invierte; si no, ordena por ella
 * ascendente. Misma regla que `search.ts`, y a propósito la misma función: dos
 * tablas que se comportan distinto al pulsar la cabecera es de las cosas que
 * nadie reporta como fallo y todo el mundo nota.
 */
export function nextSort(current: DirectorySort, field: DirectorySortField): DirectorySort {
  return current.field === field
    ? { field, ascending: !current.ascending }
    : { field, ascending: true };
}

// -----------------------------------------------------------------------------
// La fila
// -----------------------------------------------------------------------------

export interface DirectoryRow {
  id: string;
  name: string;
  /** El código ISO tal cual, que es lo que pinta el badge (ver cabecera, punto 3). */
  country: string;
  /** El nombre del país en el idioma de sesión: desplegable de filtro y nombre accesible. */
  countryLabel: string;
  /** Cadena vacía si no hay: la tabla pinta un hueco, nunca `null` ni `undefined`. */
  phone: string;
  email: string;
  favoriteCount: number;
}

/** Lo que devuelve PostgREST, antes de tocarlo. */
export interface DirectoryRowRaw {
  id: string;
  name: string;
  country: string;
  contact_phone: string | null;
  contact_email: string | null;
  favorite_count: number | null;
}

/**
 * El mapeo, suelto y puro para poder probarlo sin base.
 *
 * `contact_phone`, `contact_email` y `favorite_count` pueden venir a `null` --
 * las dos primeras porque son nuevas (`0027`) y nadie obliga a rellenarlas, la
 * tercera porque el contador lo mantiene un disparador y una organización recién
 * creada puede no haberlo tocado. Se normalizan aquí, UNA vez, y no en cada
 * celda de la tabla.
 */
export function toDirectoryRow(raw: DirectoryRowRaw): DirectoryRow {
  return {
    id: raw.id,
    name: raw.name,
    country: (raw.country ?? '').toUpperCase(),
    countryLabel: countryName(raw.country ?? ''),
    phone: raw.contact_phone ?? '',
    email: raw.contact_email ?? '',
    favoriteCount: raw.favorite_count ?? 0,
  };
}

export interface DirectoryPage {
  rows: DirectoryRow[];
  /** Cuántas cumplen los filtros en total, no cuántas caben en esta página. */
  total: number;
  /** 1-based, ya encajada en el rango que existe. */
  page: number;
  pageCount: number;
}

export interface DirectoryQuery {
  filters: DirectoryFilters;
  sort: DirectorySort;
  /** 1-based, como la navegación numérica de la spec. */
  page: number;
}

const COLUMNS = 'id, name, country, contact_phone, contact_email, favorite_count';

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/**
 * Una página del directorio.
 *
 * El segundo `.order('id')` no es decorativo: sin un criterio de desempate
 * estable, dos organizaciones con el mismo nombre -- o el mismo país, o el mismo
 * número de favoritos, que es mucho más probable -- pueden salir en distinto
 * orden en dos peticiones seguidas, y con paginación en servidor eso significa
 * **la misma fila en dos páginas y otra en ninguna**. Es el mismo desempate que
 * usa `fetchResults`.
 *
 * El nombre se lava con `sanitizeSearch` antes del `ilike` por la misma razón
 * que en SRCH-01: la sintaxis de filtros de PostgREST usa comas y paréntesis, y
 * un nombre con una coma se convierte en otro filtro.
 */
export async function fetchOrganizations(
  { filters, sort, page }: DirectoryQuery,
): Promise<DirectoryPage> {
  let q = supabase
    .from('organizations')
    .select(COLUMNS, { count: 'exact' })
    .eq('status', 'APPROVED');

  if (filters.country) q = q.eq('country', filters.country.toUpperCase());

  const nombre = sanitizeSearch(filters.name);
  if (nombre) q = q.ilike('name', `%${nombre}%`);

  const pedida = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const desde = (pedida - 1) * PAGE_SIZE;

  const { data, error, count } = await q
    .order(sort.field, { ascending: sort.ascending })
    .order('id', { ascending: true })
    .range(desde, desde + PAGE_SIZE - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    rows: (data ?? []).map((r) => toDirectoryRow(r as unknown as DirectoryRowRaw)),
    total,
    page: clampPage(pedida, total),
    pageCount: pageCountFor(total),
  };
}

/** Una opción del desplegable de país: el código que filtra y el nombre que se lee. */
export interface CountryOption {
  code: string;
  label: string;
}

/**
 * Los países que de verdad hay en el directorio, para el desplegable.
 *
 * ⚠ **No son los ~250 de la ISO 3166-1, y es deliberado.** Un desplegable con
 * todos los países del mundo obliga a buscar entre doscientos cuarenta y nueve
 * opciones que no devuelven ni una fila. Se ofrecen las que existen.
 *
 * PostgREST no tiene `DISTINCT`, así que esto trae una columna de todas las
 * organizaciones aprobadas y deduplica aquí. Con el tamaño de V1 -- miles de
 * organizaciones en el peor caso -- es una columna corta y una petición; el día
 * que sean decenas de miles, esto pasa a ser una vista materializada o un RPC
 * `security definer`, y **ese día se nota en el perfil, no en la corrección**.
 */
export async function fetchDirectoryCountries(): Promise<CountryOption[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('country')
    .eq('status', 'APPROVED');

  if (error) throw error;

  const codigos = new Set<string>();
  for (const fila of (data ?? []) as { country: string | null }[]) {
    const code = (fila.country ?? '').toUpperCase();
    if (code) codigos.add(code);
  }

  return [...codigos]
    .map((code) => ({ code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es-ES'));
}
