import { supabase } from './supabase';
import { countryName, ZONE_LABELS, type Zone } from './search';

/**
 * Capa de datos de INV-07 (Configuración de Visibilidad del Inventario), escrita a
 * mano por Claude Code ANTES de la tarea del arnés (`UMBRAL-FABRICA-V1.md` §7,
 * paso 2) sobre el esquema que YA existía desde `0002`: la columna
 * `organizations.inventory_visibility_mode` y la tabla `inventory_exclusions`.
 * **INV-07 no lleva migración.**
 *
 * La lógica pura (modos, etiquetas, agrupación de exclusiones, candidatos de la
 * búsqueda de organizaciones) vive aquí para que las dos piezas de la tarea no la
 * reimplementen: el Coder recibe estas funciones ya hechas y solo pinta.
 *
 * ⚠ **Quién puede escribir lo decide la base, no esta capa.** `inventory_exclusions`
 * solo admite escritura al ADMIN de la organización (`exclusions_write_admin`,
 * `0002`) y `organizations` solo deja cambiar `inventory_visibility_mode` y
 * `visibility_scope_enabled` desde el cliente. `canManageVisibility` existe para
 * que la pantalla no ofrezca lo que la base va a rechazar.
 */

// -----------------------------------------------------------------------------
// Modos (spec §3)
// -----------------------------------------------------------------------------

export type VisibilityMode = 'VISIBLE_TODOS' | 'RESTRINGIDA';

export const DEFAULT_VISIBILITY_MODE: VisibilityMode = 'VISIBLE_TODOS';

export const VISIBILITY_MODES: { value: VisibilityMode; label: string; description: string }[] = [
  {
    value: 'VISIBLE_TODOS',
    label: 'Visible para todos los miembros',
    description: 'Cualquier distribuidor verificado en la plataforma puede consultar tu stock',
  },
  {
    value: 'RESTRINGIDA',
    label: 'Visibilidad restringida',
    description: 'Solo miembros no excluidos explícitamente pueden ver tu inventario',
  },
];

/** Spec §6: al volver a «Visible para todos» con exclusiones guardadas. */
export const KEPT_LIST_NOTICE =
  'Tu lista de exclusión se conserva — si vuelves al modo restringido, se reactivará automáticamente.';

/** Spec §6: guardado con éxito. */
export const SAVED_MESSAGE = 'Configuración guardada. Los cambios tienen efecto inmediato.';

/** El bloque informativo brass de la spec §3. */
export const IMMEDIATE_EFFECT_NOTICE =
  'Los cambios en la visibilidad tienen efecto inmediato — las organizaciones excluidas dejarán de ver tu stock en su próxima búsqueda.';

export const READ_ONLY_NOTICE = 'Solo un administrador de tu organización puede cambiar la visibilidad del inventario.';

/** Solo el ADMIN escribe (`exclusions_write_admin`); un EDITOR solo lee. */
export function canManageVisibility(role: 'ADMIN' | 'EDITOR'): boolean {
  return role === 'ADMIN';
}

// -----------------------------------------------------------------------------
// Geografía (spec §3): seis continentes, sin Antártida
// -----------------------------------------------------------------------------

/** El orden de la spec: Europa · Asia · América del Norte · América del Sur · África · Oceanía. */
export const CONTINENT_OPTIONS: { code: Zone; label: string }[] = (['EU', 'AS', 'NA', 'SA', 'AF', 'OC'] as const).map(
  (code) => ({ code, label: ZONE_LABELS[code] }),
);

// -----------------------------------------------------------------------------
// Exclusiones
// -----------------------------------------------------------------------------

export type ExclusionKind = 'ORG' | 'CONTINENT' | 'COUNTRY';

export interface Exclusion {
  id: string;
  kind: ExclusionKind;
  /** Solo en `ORG`. */
  orgId: string | null;
  /** Lo que lleva la etiqueta: el nombre de la organización, el continente o el país. */
  label: string;
  continent: Zone | null;
  /** ISO alfa-2, solo en `COUNTRY`. */
  country: string | null;
}

export interface ExclusionRowRaw {
  id: string;
  excluded_org_id: string | null;
  excluded_country: string | null;
  excluded_continent: string | null;
  organizations: { name: string } | null;
}

export function toExclusion(raw: ExclusionRowRaw): Exclusion {
  if (raw.excluded_org_id) {
    return {
      id: raw.id,
      kind: 'ORG',
      orgId: raw.excluded_org_id,
      label: raw.organizations?.name ?? 'Organización desconocida',
      continent: null,
      country: null,
    };
  }
  if (raw.excluded_country) {
    return {
      id: raw.id,
      kind: 'COUNTRY',
      orgId: null,
      label: countryName(raw.excluded_country),
      continent: null,
      country: raw.excluded_country.toUpperCase(),
    };
  }
  const code = (raw.excluded_continent ?? '') as Zone;
  return { id: raw.id, kind: 'CONTINENT', orgId: null, label: ZONE_LABELS[code] ?? code, continent: code, country: null };
}

/**
 * Las dos subsecciones de la spec §3: `Exclusión por organización` y `Exclusión por
 * geografía` (continentes y países juntos, como en el ejemplo `[Asia ×] [Rusia ×]`).
 * Cada una ordenada por etiqueta.
 */
export function groupExclusions(list: Exclusion[]): { orgs: Exclusion[]; geo: Exclusion[] } {
  const porEtiqueta = (a: Exclusion, b: Exclusion) => a.label.localeCompare(b.label, 'es');
  return {
    orgs: list.filter((e) => e.kind === 'ORG').sort(porEtiqueta),
    geo: list.filter((e) => e.kind !== 'ORG').sort(porEtiqueta),
  };
}

/** Sin tildes ni mayúsculas, para que `nordwalz` encuentre `Nordwälz Lager`. */
function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface OrgCandidate {
  id: string;
  name: string;
  country: string;
}

export const ORG_CANDIDATES_MAX = 8;

/**
 * Los candidatos que ofrece el autocompletado (spec §3: `Buscar organización por
 * nombre...`): coinciden con lo escrito, no son la propia organización y no están
 * ya excluidos. Función pura, sin red: el cliente ya tiene la lista del directorio.
 */
export function filterOrgCandidates(
  all: OrgCandidate[],
  query: string,
  excluded: Exclusion[],
  ownOrgId: string,
): OrgCandidate[] {
  const q = plain(query);
  if (q === '') return [];
  const ya = new Set(excluded.filter((e) => e.orgId).map((e) => e.orgId));
  return all
    .filter((o) => o.id !== ownOrgId && !ya.has(o.id) && plain(o.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, ORG_CANDIDATES_MAX);
}

/** Si el continente/país ya está excluido, el select no debería ofrecerlo otra vez. */
export function isAlreadyExcluded(list: Exclusion[], target: { continent?: Zone; country?: string; orgId?: string }): boolean {
  return list.some(
    (e) =>
      (target.orgId !== undefined && e.orgId === target.orgId) ||
      (target.continent !== undefined && e.kind === 'CONTINENT' && e.continent === target.continent) ||
      (target.country !== undefined && e.kind === 'COUNTRY' && e.country === target.country),
  );
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

export interface VisibilityState {
  mode: VisibilityMode;
  exclusions: Exclusion[];
}

/** El modo y TODAS las exclusiones de la organización (también con el modo abierto: se conservan). */
export async function fetchVisibility(orgId: string): Promise<VisibilityState> {
  const [org, exc] = await Promise.all([
    supabase.from('organizations').select('inventory_visibility_mode').eq('id', orgId).maybeSingle(),
    supabase
      .from('inventory_exclusions')
      .select('id, excluded_org_id, excluded_country, excluded_continent, organizations:excluded_org_id(name)')
      .eq('owner_org_id', orgId)
      .order('created_at', { ascending: true }),
  ]);
  if (org.error) throw org.error;
  if (exc.error) throw exc.error;
  const mode = (org.data as { inventory_visibility_mode: string } | null)?.inventory_visibility_mode;
  return {
    mode: mode === 'RESTRINGIDA' ? 'RESTRINGIDA' : DEFAULT_VISIBILITY_MODE,
    exclusions: (exc.data ?? []).map((r) => toExclusion(r as unknown as ExclusionRowRaw)),
  };
}

/** Todas las organizaciones visibles, para el autocompletado. Decenas de filas, no miles. */
export async function fetchOrgCandidates(): Promise<OrgCandidate[]> {
  const { data, error } = await supabase.from('organizations').select('id, name, country').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrgCandidate[];
}

export interface CountryOption {
  code: string;
  label: string;
}

/** Los países de un continente que tienen alguna organización (los únicos que tiene sentido excluir). */
export async function fetchContinentCountries(continent: Zone): Promise<CountryOption[]> {
  const { data, error } = await supabase.from('organizations').select('country').eq('continent', continent);
  if (error) throw error;
  const codes = Array.from(new Set((data ?? []).map((r) => (r as { country: string }).country.toUpperCase())));
  return codes.map((code) => ({ code, label: countryName(code) })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export type ExclusionTarget = { orgId: string } | { continent: Zone } | { country: string };

const DUPLICATE_MESSAGE = 'Ya está en tu lista de exclusión.';

/** Añade una exclusión. Efecto inmediato, sin pasar por `Guardar configuración` (spec §3). */
export async function addExclusion(ownerOrgId: string, target: ExclusionTarget): Promise<void> {
  const row: Record<string, string> = { owner_org_id: ownerOrgId };
  if ('orgId' in target) row.excluded_org_id = target.orgId;
  else if ('continent' in target) row.excluded_continent = target.continent;
  else row.excluded_country = target.country.toUpperCase();
  const { error } = await supabase.from('inventory_exclusions').insert(row);
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error(DUPLICATE_MESSAGE);
    throw error;
  }
}

export async function removeExclusion(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_exclusions').delete().eq('id', id);
  if (error) throw error;
}

/** `Guardar configuración`: solo el modo. La lista ya se escribió al añadir o quitar. */
export async function saveVisibilityMode(orgId: string, mode: VisibilityMode): Promise<void> {
  const { error } = await supabase.from('organizations').update({ inventory_visibility_mode: mode }).eq('id', orgId);
  if (error) throw error;
}
