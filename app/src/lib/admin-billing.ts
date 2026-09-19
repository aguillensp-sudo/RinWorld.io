import { supabase } from './supabase';
import { countryName } from './search';

/**
 * Capa de datos de ADMIN-02 (Panel de Gestión de Cobros), escrita a mano por Claude
 * Code ANTES de la tarea del arnés (`UMBRAL-FABRICA-V1.md` §7, paso 2) sobre la
 * migración `0034`: la vista `billing_org_status` y los verbos
 * `billing_confirm_payment`/`billing_suspend_organization`.
 *
 * La lógica pura (filtros, fechas, tono de color) vive aquí para que las tres
 * pantallas de la tarea no la reimplementen: el Coder recibe estas funciones ya
 * hechas y solo pinta.
 */

// -----------------------------------------------------------------------------
// Estados y filtros
// -----------------------------------------------------------------------------

/** Los cuatro estados que pinta la columna `Estado` (spec §3). Los calcula la vista. */
export const BILLING_STATES = ['ACTIVE', 'SUSPENDED', 'EN PRUEBA', 'CANDIDATA A BORRADO'] as const;
export type BillingState = (typeof BILLING_STATES)[number];

/** La ventana de `Próximos a vencer` y el umbral del naranja (spec §3, "15 días"). */
export const EXPIRY_WARNING_DAYS = 15;

export type BillingFilterKey = 'ALL' | 'EXPIRING' | 'SUSPENDED' | 'DELETION' | 'TRIAL';

export const BILLING_FILTERS: { key: BillingFilterKey; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'EXPIRING', label: 'Próximos a vencer' },
  { key: 'SUSPENDED', label: 'Suspendidos' },
  { key: 'DELETION', label: 'Candidatas a borrado' },
  { key: 'TRIAL', label: 'En periodo de prueba' },
];

export const DEFAULT_BILLING_FILTER: BillingFilterKey = 'ALL';

/**
 * Qué filas deja pasar cada chip, literal de la spec §3:
 *  - `Próximos a vencer`: ACTIVE con vencimiento en los próximos 15 días (0..15).
 *    Una ACTIVE ya vencida (negativa) NO entra: la spec no la nombra y sale en
 *    `Todos` con el número en rojo.
 *  - `Suspendidos`: en estado SUSPENDED. Una candidata a borrado es también una
 *    organización suspendida, pero la spec le da su propio chip, y el ejemplo
 *    (`Suspendidos` = 1 con Ruiz y Timken en la tabla) la deja fuera.
 */
export function matchesBillingFilter(row: BillingRow, key: BillingFilterKey): boolean {
  switch (key) {
    case 'ALL':
      return true;
    case 'EXPIRING':
      return row.state === 'ACTIVE' && row.daysRemaining >= 0 && row.daysRemaining <= EXPIRY_WARNING_DAYS;
    case 'SUSPENDED':
      return row.state === 'SUSPENDED';
    case 'DELETION':
      return row.state === 'CANDIDATA A BORRADO';
    case 'TRIAL':
      return row.state === 'EN PRUEBA';
  }
}

export function filterBillingRows(rows: BillingRow[], key: BillingFilterKey): BillingRow[] {
  return rows.filter((r) => matchesBillingFilter(r, key));
}

/** El número que lleva cada chip. Spec: `Todos 5`, `Próximos a vencer 1`... */
export function billingFilterCount(rows: BillingRow[], key: BillingFilterKey): number {
  return filterBillingRows(rows, key).length;
}

// -----------------------------------------------------------------------------
// Fechas y números
// -----------------------------------------------------------------------------

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * `28 Dic 2025`. Manual, no `Intl`: el mes abreviado de `es-ES` cambia entre
 * versiones de ICU (con o sin punto, en minúscula) y la spec lo pinta así.
 * Acepta `YYYY-MM-DD` o un timestamp ISO; devuelve el original si no es una fecha.
 */
export function billingDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

/** `2 días`, `1 día`, `-182 días`. */
export function daysRemainingLabel(days: number): string {
  return Math.abs(days) === 1 ? `${days} día` : `${days} días`;
}

export type DueTone = 'danger' | 'warn' | 'normal';

/** Spec §3: rojo si ya vencido, naranja si faltan menos de 15 días. */
export function dueTone(days: number): DueTone {
  if (days < 0) return 'danger';
  if (days < EXPIRY_WARNING_DAYS) return 'warn';
  return 'normal';
}

/** Meses completos entre dos instantes. `6 meses en SUSPENDED`. */
export function monthsSince(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1;
  return Math.max(0, m);
}

export function monthsSuspendedLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const n = monthsSince(iso, now);
  return n === 1 ? '1 mes en SUSPENDED' : `${n} meses en SUSPENDED`;
}

// -----------------------------------------------------------------------------
// Validación del modal `Marcar pago recibido` (spec §3)
// -----------------------------------------------------------------------------

export const PAYMENT_NOTE_MAX = 300;

/** `YYYY-MM-DD` en hora LOCAL de quien mira -- el default del selector de fecha. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Fecha pasada o presente, no futura". Una fecha vacía o imposible tampoco vale. */
export function isValidPaymentDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) return false;
  return value <= todayIso(now);
}

export function isValidPaymentNote(value: string): boolean {
  return value.length <= PAYMENT_NOTE_MAX;
}

/** El nuevo vencimiento tras un pago: fecha de pago + 365 días (RNG-BILL-02). */
export function renewalDate(paymentDate: string): string {
  const d = new Date(`${paymentDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 365);
  return d.toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// Filas
// -----------------------------------------------------------------------------

export interface BillingRowRaw {
  org_id: string;
  name: string;
  country: string;
  status: string;
  org_created_at: string;
  suspended_since: string | null;
  last_payment_date: string | null;
  trial_ends_at: string;
  current_period_ends_at: string;
  days_remaining: number;
  billing_state: string;
}

export interface BillingRow {
  orgId: string;
  name: string;
  /** ISO de dos letras, mayúsculas. */
  country: string;
  countryLabel: string;
  state: BillingState;
  joinedAt: string;
  suspendedSince: string | null;
  lastPaymentDate: string | null;
  trialEndsAt: string;
  dueDate: string;
  daysRemaining: number;
}

export function toBillingRow(raw: BillingRowRaw): BillingRow {
  return {
    orgId: raw.org_id,
    name: raw.name,
    country: (raw.country ?? '').toUpperCase(),
    countryLabel: countryName(raw.country ?? ''),
    state: raw.billing_state as BillingState,
    joinedAt: raw.org_created_at,
    suspendedSince: raw.suspended_since,
    lastPaymentDate: raw.last_payment_date,
    trialEndsAt: raw.trial_ends_at,
    dueDate: raw.current_period_ends_at,
    daysRemaining: raw.days_remaining,
  };
}

/** Días restantes ascendente (la más vencida primero), desempate por nombre. */
export function sortBillingRows(rows: BillingRow[]): BillingRow[] {
  return [...rows].sort((a, b) => a.daysRemaining - b.daysRemaining || a.name.localeCompare(b.name, 'es'));
}

export interface BillingPayment {
  id: string;
  paymentDate: string;
  note: string;
  /** `null` si el operador ya no existe; el panel pinta `—`. */
  operatorName: string | null;
}

export interface BillingPaymentRaw {
  id: string;
  payment_date: string;
  note: string | null;
  platform_operators: { full_name: string | null } | null;
}

export function toBillingPayment(raw: BillingPaymentRaw): BillingPayment {
  return {
    id: raw.id,
    paymentDate: raw.payment_date,
    note: raw.note ?? '',
    operatorName: raw.platform_operators?.full_name ?? null,
  };
}

export interface BillingStatusEvent {
  id: number;
  fromStatus: string;
  toStatus: string;
  at: string;
  /** `null` = transición automática por vencimiento, no un operador. */
  operatorName: string | null;
  automatic: boolean;
}

export interface BillingStatusEventRaw {
  id: number;
  from_status: string;
  to_status: string;
  created_at: string;
  changed_by: string | null;
  platform_operators: { full_name: string | null } | null;
}

export function toBillingStatusEvent(raw: BillingStatusEventRaw): BillingStatusEvent {
  return {
    id: raw.id,
    fromStatus: raw.from_status,
    toStatus: raw.to_status,
    at: raw.created_at,
    operatorName: raw.platform_operators?.full_name ?? null,
    automatic: raw.changed_by === null,
  };
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/**
 * Todas las organizaciones, ya en el orden por defecto. Sin paginación: la spec no
 * la pide y el filtrado de los chips es en cliente (son decenas de filas, no miles).
 * El Operador es el único al que la RLS de `0034` deja ver alguna fila.
 */
export async function fetchBillingOrgs(): Promise<BillingRow[]> {
  const { data, error } = await supabase
    .from('billing_org_status')
    .select(
      'org_id, name, country, status, org_created_at, suspended_since, last_payment_date, trial_ends_at, current_period_ends_at, days_remaining, billing_state',
    )
    .order('days_remaining', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return sortBillingRows((data ?? []).map((r) => toBillingRow(r as unknown as BillingRowRaw)));
}

/** El historial de pagos, del más reciente al más antiguo. */
export async function fetchBillingPayments(orgId: string): Promise<BillingPayment[]> {
  const { data, error } = await supabase
    .from('billing_payments')
    .select('id, payment_date, note, platform_operators(full_name)')
    .eq('org_id', orgId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => toBillingPayment(r as unknown as BillingPaymentRaw));
}

/** El historial de cambios de estado, del más reciente al más antiguo. */
export async function fetchBillingStatusEvents(orgId: string): Promise<BillingStatusEvent[]> {
  const { data, error } = await supabase
    .from('billing_status_events')
    .select('id, from_status, to_status, created_at, changed_by, platform_operators(full_name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => toBillingStatusEvent(r as unknown as BillingStatusEventRaw));
}

/**
 * `Marcar pago recibido` y `Reactivar` son el MISMO verbo (ver el comentario de
 * `billing_confirm_payment` en `0034`): sobre una suspendida, además del pago, la
 * reactiva. Valida aquí lo mismo que la base, para no ir a la red con un dato malo.
 */
export async function confirmPayment(orgId: string, paymentDate: string, note: string): Promise<void> {
  const limpia = note.trim();
  if (!isValidPaymentDate(paymentDate)) throw new Error('La fecha del pago no puede ser futura.');
  if (!isValidPaymentNote(limpia)) {
    throw new Error(`La nota interna no puede superar los ${PAYMENT_NOTE_MAX} caracteres.`);
  }
  const { error } = await supabase.rpc('billing_confirm_payment', {
    p_org_id: orgId,
    p_payment_date: paymentDate,
    p_note: limpia === '' ? null : limpia,
  });
  if (error) throw error;
}

/** `Suspender manualmente` (panel lateral, solo si ACTIVE o EN PRUEBA). */
export async function suspendOrganization(orgId: string): Promise<void> {
  const { error } = await supabase.rpc('billing_suspend_organization', { p_org_id: orgId });
  if (error) throw error;
}

/**
 * El email de contacto del panel lateral (spec §3). No está en la vista
 * `billing_org_status`: es `organizations.contact_email` (`0027`), que el Operador
 * lee por `organizations_select_operator` (`0034`). `null` si la organización no lo
 * ha informado; el panel pinta `—`.
 */
export async function fetchBillingContactEmail(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('contact_email')
    .eq('id', orgId)
    .maybeSingle();

  if (error) throw error;
  return (data as { contact_email: string | null } | null)?.contact_email ?? null;
}
