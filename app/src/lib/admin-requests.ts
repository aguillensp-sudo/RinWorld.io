import { supabase } from './supabase';
import { countryName } from './search';

/**
 * Capa de datos de ADMIN-01 · Panel de Aprobación del Operador.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3, y
 * `UMBRAL-FABRICA-V1.md` §1). Segunda de las tres pantallas del H1.
 *
 * Todo lo que hay debajo es de `0028`, que estrenó tres tablas y un actor: el
 * **Operador de Plataforma**, que no pertenece a ninguna organización y es el
 * único que ve esta cola. Dos cosas que conviene saber antes de tocar nada:
 *
 * 1. **Las escrituras de aquí no llevan firma.** Quién decidió y cuándo los pone
 *    el disparador `app.guard_registration_request` con `auth.uid()` y `now()`,
 *    y **pisa lo que mande el cliente**. Por eso `approveRequest` manda solo el
 *    estado: mandar `decided_by` sería escribir algo que la base va a ignorar, y
 *    el día que alguien lea ese código creería que el cliente firma.
 * 2. **Un `UPDATE` que la RLS no deja pasar no da error: afecta a cero filas.**
 *    Es la forma de `F-148`. Por eso las tres acciones piden la fila de vuelta
 *    (`.select().single()`) y fallan en voz alta si no vuelve nada, en vez de
 *    dejar que la pantalla pinte un éxito que no ocurrió.
 */

// -----------------------------------------------------------------------------
// Los estados, que son los mismos que los de `members.state`
// -----------------------------------------------------------------------------

export const REQUEST_STATES = [
  'PENDING_REVIEW',
  'INVITED_APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

/** Los cinco chips de la spec §3, en su orden, con `null` para `Todas`. */
export const QUEUE_FILTERS: { label: string; state: RequestState | null }[] = [
  { label: 'Pendientes', state: 'PENDING_REVIEW' },
  { label: 'Aprobadas', state: 'INVITED_APPROVED' },
  { label: 'Rechazadas', state: 'REJECTED' },
  { label: 'Canceladas', state: 'CANCELLED' },
  { label: 'Todas', state: null },
];

/** *"`Pendientes` (activo por defecto)"*. */
export const DEFAULT_FILTER: RequestState | null = 'PENDING_REVIEW';

// -----------------------------------------------------------------------------
// Antigüedad en cola
// -----------------------------------------------------------------------------

/** `normal` · `warn` (> 24 h, naranja) · `alert` (> 48 h, rojo). */
export type QueueAgeLevel = 'normal' | 'warn' | 'alert';

const HORA = 3_600_000;

export function hoursSince(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now.getTime() - t) / HORA);
}

/**
 * ⚠ **No reusa `ageLevel` de `inventory.ts`, y no es un descuido.** Aquella mide
 * la frescura de una línea de catálogo en DÍAS (7 y 30) y responde a otra
 * pregunta de otro spec. Aquí la spec dice *"naranja si > 24h, rojo si > 48h"*
 * sobre horas. Compartir la función obligaría a parametrizar los umbrales, y
 * entonces el borde de los 7 días y el de las 24 horas pasarían a depender del
 * mismo código: exactamente la discrepancia que costó `F-026`, pero al revés.
 *
 * ⚠ **Y los umbrales son los de la REGLA de la spec, no los de su ejemplo
 * (`F-158`).** El bloque "Datos de ejemplo" pinta en naranja una solicitud de
 * *"Hace 18 horas"*, y su propia tabla de columnas dice *"en naranja si > 24h"*.
 * Las dos cosas no pueden ser ciertas. Manda la regla. Si alguien ve la fila de
 * ejemplo y "arregla" esto para que 18 horas salga naranja, rompe la regla que
 * la misma spec escribe dos párrafos más arriba.
 */
export function queueAgeLevel(iso: string, now: Date = new Date()): QueueAgeLevel {
  const horas = hoursSince(iso, now);
  if (horas > 48) return 'alert';
  if (horas > 24) return 'warn';
  return 'normal';
}

/** *"Hace 52 horas"*, como el bloque de datos de ejemplo de la spec. */
export function queueAgeLabel(iso: string, now: Date = new Date()): string {
  const horas = Math.floor(hoursSince(iso, now));
  if (horas < 1) return 'Hace menos de una hora';
  if (horas === 1) return 'Hace 1 hora';
  return `Hace ${horas} horas`;
}

// -----------------------------------------------------------------------------
// La fecha de solicitud, columna 6 · "DD Mmm YYYY · HH:MM" (spec §3)
// -----------------------------------------------------------------------------

/**
 * *"28 Jun 2026 · 08:14"* en el bloque de ejemplo de la spec. Va aquí y no en
 * el componente por la regla de la casa (F-024/F-059): las fechas se formatean
 * en la capa de datos, nunca a mano.
 *
 * ⚠ **El mes sale en minúscula y sin punto** (`28 jun 2026`), no como el
 * literal del mock. Es el mismo `Intl.DateTimeFormat('es-ES', {day, month:
 * 'short', year})` que ya usan `sentAtLabel` (`sent-offers.ts`) y `dateLabel`
 * (`panel.ts`) para el mismo formato "DD Mmm YYYY" -- comprobado con
 * `dateLabel('...') === '11 ago 2026'` en `panel.test.ts`, no adivinado -- así
 * que esta función no inventa un tercer formato, reusa el que ya hay y le suma
 * la hora que ADMIN-01 pide y las otras dos pantallas no.
 *
 * Sin fecha válida se devuelve el propio `iso` tal cual, igual que
 * `sentAtLabel`: un `—` inventado taparía el dato malo en vez de mostrarlo.
 */
export function requestDateLabel(iso: string, locale = 'es-ES'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const fecha = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(t);
  const hora = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(t);
  return `${fecha} · ${hora}`;
}

// -----------------------------------------------------------------------------
// El motivo del rechazo
// -----------------------------------------------------------------------------

export const REASON_MIN = 10;
export const REASON_MAX = 500;

/**
 * *"Mín 10 / máx 500 caracteres"*.
 *
 * **Sí, esto duplica el `CHECK` de la base, y es deliberado.** El de la base es
 * el que manda y el que impide el dato malo; este existe para que el campo diga
 * que faltan caracteres ANTES de mandar, que es lo que pide el `field hint` de
 * la spec. Lo que no puede pasar es que discrepen, así que los dos números viven
 * aquí con nombre y el `CHECK` de `0028` los cita en su comentario.
 */
export function isValidRejectionReason(raw: string): boolean {
  const limpio = raw.trim();
  return limpio.length >= REASON_MIN && limpio.length <= REASON_MAX;
}

// -----------------------------------------------------------------------------
// Las filas
// -----------------------------------------------------------------------------

export interface RequestRowRaw {
  id: string;
  org_name: string;
  country: string;
  applicant_full_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  website: string | null;
  submitted_at: string;
  state: RequestState;
  rejection_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

export interface RequestRow {
  id: string;
  orgName: string;
  /** Código ISO para el badge; el nombre va aparte, igual que en DIR-01. */
  country: string;
  countryLabel: string;
  applicantName: string;
  email: string;
  phone: string;
  website: string;
  submittedAt: string;
  state: RequestState;
  rejectionReason: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

/**
 * Columna 5, "Sitio web": `row.website` puede venir sin esquema -- el FSR lo
 * pide como texto libre, no como `<input type="url">"` (Módulo 01 v1.5), así
 * que `nordicbearings.se` es una entrada tan válida como
 * `https://nordicbearings.se`. Un `<a href="nordicbearings.se">` sin esquema
 * es una URL RELATIVA a la propia pantalla, no un enlace externo: se antepone
 * `https://` solo cuando hace falta, nunca se duplica.
 */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function toRequestRow(raw: RequestRowRaw): RequestRow {
  return {
    id: raw.id,
    orgName: raw.org_name,
    country: (raw.country ?? '').toUpperCase(),
    countryLabel: countryName(raw.country ?? ''),
    applicantName: raw.applicant_full_name,
    email: raw.applicant_email,
    phone: raw.applicant_phone ?? '',
    website: raw.website ?? '',
    submittedAt: raw.submitted_at,
    state: raw.state,
    rejectionReason: raw.rejection_reason ?? '',
    decidedBy: raw.decided_by,
    decidedAt: raw.decided_at,
  };
}

/** Una línea del historial del panel lateral. */
export interface RequestEvent {
  id: number;
  state: RequestState;
  at: string;
  operatorId: string | null;
  note: string;
}

export interface RequestEventRaw {
  id: number;
  state: RequestState;
  at: string;
  operator_id: string | null;
  note: string | null;
}

export function toRequestEvent(raw: RequestEventRaw): RequestEvent {
  return {
    id: raw.id,
    state: raw.state,
    at: raw.at,
    operatorId: raw.operator_id,
    note: raw.note ?? '',
  };
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

const COLUMNS =
  'id, org_name, country, applicant_full_name, applicant_email, applicant_phone, website, submitted_at, state, rejection_reason, decided_by, decided_at';

/**
 * La cola. *"Ordenadas de más antigua a más reciente"*, que es ascendente por
 * fecha de envío -- la solicitud que lleva más tiempo esperando, arriba.
 *
 * No hay paginación en la spec de ADMIN-01, al contrario que en DIR-01: una cola
 * de aprobación que necesita paginarse es una cola que ya se fue de las manos, y
 * el problema entonces no es la tabla.
 */
export async function fetchRequests(state: RequestState | null = DEFAULT_FILTER): Promise<RequestRow[]> {
  let q = supabase.from('registration_requests').select(COLUMNS);
  if (state) q = q.eq('state', state);

  const { data, error } = await q
    .order('submitted_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => toRequestRow(r as unknown as RequestRowRaw));
}

/** El historial de una solicitud, de más antiguo a más reciente. */
export async function fetchRequestHistory(requestId: string): Promise<RequestEvent[]> {
  const { data, error } = await supabase
    .from('registration_request_events')
    .select('id, state, at, operator_id, note')
    .eq('request_id', requestId)
    .order('at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => toRequestEvent(r as unknown as RequestEventRaw));
}

/**
 * El común de las tres acciones.
 *
 * Pide la fila de vuelta a propósito: si la RLS no deja pasar el `UPDATE` -- por
 * ejemplo porque quien llama no es Operador -- PostgREST no devuelve error,
 * devuelve cero filas, y `.single()` lo convierte en un fallo ruidoso. Sin esto,
 * el panel pintaría "Aprobada" sobre una fila que no se movió.
 */
async function decidir(id: string, cambios: Record<string, unknown>): Promise<RequestRow> {
  const { data, error } = await supabase
    .from('registration_requests')
    .update(cambios)
    .eq('id', id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return toRequestRow(data as unknown as RequestRowRaw);
}

/** `Aprobar`. La firma (quién y cuándo) la pone la base, no esta llamada. */
export function approveRequest(id: string): Promise<RequestRow> {
  return decidir(id, { state: 'INVITED_APPROVED' });
}

/** `Rechazar`, con el motivo que va al correo EML-08 y al historial. */
export function rejectRequest(id: string, reason: string): Promise<RequestRow> {
  const limpio = reason.trim();
  if (!isValidRejectionReason(limpio)) {
    throw new Error(
      `El motivo del rechazo tiene que tener entre ${REASON_MIN} y ${REASON_MAX} caracteres.`,
    );
  }
  return decidir(id, { state: 'REJECTED', rejection_reason: limpio });
}

/**
 * `Volver a revisión`. No manda `rejection_reason: null` aunque la solicitud
 * vuelva sin motivo: lo limpia el disparador, y mandarlo desde aquí haría creer
 * que es el cliente quien lo decide.
 */
export function returnToReview(id: string): Promise<RequestRow> {
  return decidir(id, { state: 'PENDING_REVIEW' });
}
