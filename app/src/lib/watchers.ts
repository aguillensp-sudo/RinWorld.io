import { supabase } from './supabase';
import { countryName, EMPTY_CRITERIA, ZONE_LABELS, ZONES, type SearchCriteria, type Zone } from './search';

/**
 * Capa de datos de SRCH-03 (Gestión de Watchers), escrita a mano por Claude Code
 * ANTES de la tarea del arnés (`UMBRAL-FABRICA-V1.md` §7, paso 2) sobre la
 * migración `0035`: la vista `watcher_list` y las cuatro acciones
 * `watcher_set_paused`/`watcher_update`/`watcher_renew`/`watcher_let_expire`, más
 * el DELETE por RLS.
 *
 * La lógica pura (filtros, contador, etiquetas de fecha, tono de color, validación
 * del formulario) vive aquí para que las pantallas de la tarea no la reimplementen:
 * el Coder recibe estas funciones ya hechas y solo pinta.
 */

// -----------------------------------------------------------------------------
// Estados y filtros
// -----------------------------------------------------------------------------

/**
 * Los cinco estados de la spec §3, con el literal con el que se PINTAN. La base
 * guarda `PENDIENTE RENOVACION` sin tilde (ver `0035`); `toWatcherRow` lo traduce.
 */
export const WATCHER_STATES = ['ACTIVE', 'PAUSED', 'TRIGGERED', 'PENDIENTE RENOVACIÓN', 'EXPIRED'] as const;
export type WatcherState = (typeof WATCHER_STATES)[number];

/** `watcher-lifecycle`: «un límite de 50 watchers ACTIVE por organización». */
export const WATCHER_LIMIT = 50;

/** El naranja de «Días restantes» (spec §3: «En naranja si < 5 días»). */
export const WATCHER_WARN_DAYS = 5;

export type WatcherFilterKey = 'ALL' | 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'RENEWAL' | 'EXPIRED';

/** Los seis chips de la spec §3, en su orden. */
export const WATCHER_FILTERS: { key: WatcherFilterKey; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'ACTIVE', label: 'Activos' },
  { key: 'PAUSED', label: 'Pausados' },
  { key: 'TRIGGERED', label: 'Disparados' },
  { key: 'RENEWAL', label: 'Pendientes de renovación' },
  { key: 'EXPIRED', label: 'Expirados' },
];

export const DEFAULT_WATCHER_FILTER: WatcherFilterKey = 'ALL';

const FILTER_STATE: Record<Exclude<WatcherFilterKey, 'ALL'>, WatcherState> = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TRIGGERED: 'TRIGGERED',
  RENEWAL: 'PENDIENTE RENOVACIÓN',
  EXPIRED: 'EXPIRED',
};

export function matchesWatcherFilter(row: WatcherRow, key: WatcherFilterKey): boolean {
  return key === 'ALL' ? true : row.state === FILTER_STATE[key];
}

export function filterWatchers(rows: WatcherRow[], key: WatcherFilterKey): WatcherRow[] {
  return rows.filter((r) => matchesWatcherFilter(r, key));
}

/** El número que lleva cada chip. */
export function watcherFilterCount(rows: WatcherRow[], key: WatcherFilterKey): number {
  return filterWatchers(rows, key).length;
}

// -----------------------------------------------------------------------------
// El contador `X / 50 watchers activos`
// -----------------------------------------------------------------------------

/** Solo cuentan los ACTIVE: un PAUSED no entra en el límite (`0035`, sección 6). */
export function activeWatcherCount(rows: WatcherRow[]): number {
  return rows.filter((r) => r.state === 'ACTIVE').length;
}

export function activeCounterLabel(rows: WatcherRow[]): string {
  return `${activeWatcherCount(rows)} / ${WATCHER_LIMIT} watchers activos`;
}

/** Spec §6: con 50 / 50 el badge pasa a rojo; hasta entonces es el brass normal. */
export function counterTone(rows: WatcherRow[]): 'brass' | 'danger' {
  return activeWatcherCount(rows) >= WATCHER_LIMIT ? 'danger' : 'brass';
}

// -----------------------------------------------------------------------------
// Etiquetas
// -----------------------------------------------------------------------------

/** `Hace 3 días`, `Hace 2 horas`, `Hace 1 hora`, `Hace unos minutos`. */
export function sinceLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const min = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (min < 60) return 'Hace unos minutos';
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'Hace 1 hora' : `Hace ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** `28 Dic 2025`. Manual, no `Intl` (mismo criterio que `billingDateLabel`). */
export function watcherDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} ${mes} ${m[1]}` : iso;
}

/** `27 días restantes`, `1 día restante`; en pausa lleva ` (pausado)` (spec §3). */
export function daysLeftLabel(days: number, paused: boolean): string {
  const base = days === 1 ? '1 día restante' : `${days} días restantes`;
  return paused ? `${base} (pausado)` : base;
}

/** `Expira en: 2 días` (tarjeta PENDIENTE RENOVACIÓN). */
export function expiresInLabel(days: number): string {
  return `Expira en: ${days === 1 ? '1 día' : `${days} días`}`;
}

/** Naranja si quedan menos de 5 días (spec §3). */
export function daysTone(days: number): 'warn' | 'normal' {
  return days < WATCHER_WARN_DAYS ? 'warn' : 'normal';
}

/**
 * `Cantidad mín: 100 u · Marca: cualquiera · País: Europa` (spec §3, «Datos de
 * ejemplo»). El país gana a la zona; sin ninguno de los dos, `cualquiera`.
 */
export function conditionsLabel(row: Pick<WatcherRow, 'minQuantity' | 'brand' | 'country' | 'zone'>): string {
  const pais = row.country ? countryName(row.country) : row.zone ? ZONE_LABELS[row.zone] : 'cualquiera';
  return `Cantidad mín: ${row.minQuantity} u · Marca: ${row.brand ?? 'cualquiera'} · País: ${pais}`;
}

/**
 * `Stock detectado el 12 Sep 2026 — Schaeffler Iberia SL · 120 u · ES` (spec §3,
 * tarjeta TRIGGERED). Sin datos del disparo devuelve `null`.
 */
export function triggeredLabel(row: WatcherRow): string | null {
  if (row.state !== 'TRIGGERED' || !row.triggeredAt) return null;
  const partes = [
    row.triggeredDistributor ?? '—',
    row.triggeredQuantity === null ? '—' : `${row.triggeredQuantity} u`,
    row.triggeredCountry ?? '—',
  ];
  return `Stock detectado el ${watcherDateLabel(row.triggeredAt)} — ${partes.join(' · ')}`;
}

/** Los criterios con los que «Ver resultados» precarga SRCH-01. */
export function watcherToCriteria(row: Pick<WatcherRow, 'partNumber' | 'brand' | 'minQuantity' | 'zone' | 'country'>): SearchCriteria {
  return {
    ...EMPTY_CRITERIA,
    partNumber: row.partNumber,
    brand: row.brand ?? '',
    minQuantity: row.minQuantity,
    zone: row.zone,
    country: row.country ?? '',
  };
}

// -----------------------------------------------------------------------------
// El desplegable `País` del formulario (spec §4: «Lista ISO 3166-1»)
// -----------------------------------------------------------------------------

const ISO_COUNTRIES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

export interface WatcherCountryOption {
  code: string;
  label: string;
}

/**
 * Los países de ISO 3166-1 alfa-2 con su nombre en español, ordenados por nombre.
 * Va entera y NO se limita a los países con distribuidores (a diferencia de
 * `fetchDirectoryCountries` en DIR-01): un watcher puede vigilar un origen donde
 * hoy no hay ninguna organización. El nombre sale del CLDR (`countryName`), nunca
 * de una tabla a mano.
 */
export const WATCHER_COUNTRY_OPTIONS: WatcherCountryOption[] = ISO_COUNTRIES.map((code) => ({
  code,
  label: countryName(code),
})).sort((a, b) => a.label.localeCompare(b.label, 'es'));

// -----------------------------------------------------------------------------
// Validación del formulario `Editar watcher` (spec §4)
// -----------------------------------------------------------------------------

export const WATCHER_REF_MIN = 2;

export interface WatcherDraft {
  partNumber: string;
  minQuantity: string;
  brand: string;
  country: string;
  emailChannel: boolean;
}

export function draftFromRow(row: WatcherRow): WatcherDraft {
  return {
    partNumber: row.partNumber,
    minQuantity: String(row.minQuantity),
    brand: row.brand ?? '',
    country: row.country ?? '',
    emailChannel: row.emailChannel,
  };
}

export function isValidWatcherRef(value: string): boolean {
  return value.trim().length >= WATCHER_REF_MIN;
}

/** «Entero positivo». `1.5`, `0`, `-3` y `abc` no valen. */
export function isValidWatcherQuantity(value: string): boolean {
  const v = value.trim();
  return /^\d+$/.test(v) && Number(v) > 0;
}

export function isValidWatcherDraft(d: WatcherDraft): boolean {
  return isValidWatcherRef(d.partNumber) && isValidWatcherQuantity(d.minQuantity);
}

// -----------------------------------------------------------------------------
// Filas
// -----------------------------------------------------------------------------

export interface WatcherRowRaw {
  id: string;
  part_number: string;
  min_quantity: number;
  brand: string | null;
  zone: string | null;
  country: string | null;
  email_channel: boolean;
  status: string;
  created_at: string;
  expires_at: string;
  days_remaining: number | null;
  renewal_days_left: number | null;
  triggered_at: string | null;
  triggered_distributor: string | null;
  triggered_quantity: number | null;
  triggered_country: string | null;
}

export interface WatcherRow {
  id: string;
  partNumber: string;
  minQuantity: number;
  brand: string | null;
  zone: Zone | null;
  /** ISO de dos letras, mayúsculas. */
  country: string | null;
  emailChannel: boolean;
  state: WatcherState;
  createdAt: string;
  expiresAt: string;
  /** Solo en ACTIVE y PAUSED; `null` en el resto. */
  daysRemaining: number | null;
  /** Solo en PENDIENTE RENOVACIÓN. */
  renewalDaysLeft: number | null;
  triggeredAt: string | null;
  triggeredDistributor: string | null;
  triggeredQuantity: number | null;
  triggeredCountry: string | null;
}

/** La base dice `PENDIENTE RENOVACION`; la spec pinta `PENDIENTE RENOVACIÓN`. */
export function toWatcherState(dbStatus: string): WatcherState {
  return (dbStatus === 'PENDIENTE RENOVACION' ? 'PENDIENTE RENOVACIÓN' : dbStatus) as WatcherState;
}

export function toWatcherRow(raw: WatcherRowRaw): WatcherRow {
  return {
    id: raw.id,
    partNumber: raw.part_number,
    minQuantity: raw.min_quantity,
    brand: raw.brand,
    zone: raw.zone && (ZONES as readonly string[]).includes(raw.zone) ? (raw.zone as Zone) : null,
    country: raw.country ? raw.country.toUpperCase() : null,
    emailChannel: raw.email_channel,
    state: toWatcherState(raw.status),
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    daysRemaining: raw.days_remaining,
    renewalDaysLeft: raw.renewal_days_left,
    triggeredAt: raw.triggered_at,
    triggeredDistributor: raw.triggered_distributor,
    triggeredQuantity: raw.triggered_quantity,
    triggeredCountry: raw.triggered_country ? raw.triggered_country.toUpperCase() : null,
  };
}

/** Los más recientes primero; desempate por referencia. */
export function sortWatchers(rows: WatcherRow[]): WatcherRow[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.partNumber.localeCompare(b.partNumber));
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/**
 * Todos los watchers de la organización de quien mira (la RLS de `0035` no deja
 * ver otros), con el estado EFECTIVO. Sin paginación: el tope es de 50 ACTIVE y la
 * spec no pide paginar.
 */
export async function fetchWatchers(): Promise<WatcherRow[]> {
  const { data, error } = await supabase
    .from('watcher_list')
    .select(
      'id, part_number, min_quantity, brand, zone, country, email_channel, status, created_at, expires_at, days_remaining, renewal_days_left, triggered_at, triggered_distributor, triggered_quantity, triggered_country',
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return sortWatchers((data ?? []).map((r) => toWatcherRow(r as unknown as WatcherRowRaw)));
}

/** `Pausar` y `Reactivar`: el mismo verbo con el booleano al revés. */
export async function setWatcherPaused(id: string, paused: boolean): Promise<void> {
  const { error } = await supabase.rpc('watcher_set_paused', { p_id: id, p_paused: paused });
  if (error) throw error;
}

/** `Guardar cambios` del formulario. Valida lo mismo que la base antes de ir a la red. */
export async function updateWatcher(id: string, draft: WatcherDraft): Promise<void> {
  if (!isValidWatcherRef(draft.partNumber)) {
    throw new Error(`La referencia necesita al menos ${WATCHER_REF_MIN} caracteres.`);
  }
  if (!isValidWatcherQuantity(draft.minQuantity)) {
    throw new Error('La cantidad mínima tiene que ser un entero positivo.');
  }
  const { error } = await supabase.rpc('watcher_update', {
    p_id: id,
    p_part_number: draft.partNumber.trim(),
    p_min_quantity: Number(draft.minQuantity.trim()),
    p_brand: draft.brand.trim() === '' ? null : draft.brand.trim(),
    p_country: draft.country.trim() === '' ? null : draft.country.trim().toUpperCase(),
    p_email_channel: draft.emailChannel,
  });
  if (error) throw error;
}

/** `Mantener activo 30 días más`. */
export async function renewWatcher(id: string): Promise<void> {
  const { error } = await supabase.rpc('watcher_renew', { p_id: id });
  if (error) throw error;
}

/** `Dejar que expire`. */
export async function letWatcherExpire(id: string): Promise<void> {
  const { error } = await supabase.rpc('watcher_let_expire', { p_id: id });
  if (error) throw error;
}

/** `Eliminar` — irreversible (spec §6): DELETE por RLS, sin papelera. */
export async function deleteWatcher(id: string): Promise<void> {
  const { error } = await supabase.from('watchers').delete().eq('id', id);
  if (error) throw error;
}
