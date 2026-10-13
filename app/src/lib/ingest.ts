import { supabase } from './supabase';

/**
 * Capa de datos de INV-04 (Canal de ingestión por email), escrita a mano por Claude Code.
 *
 * El canal vive en la base desde `0057` (tablas `ingest_addresses`, `ingest_senders`,
 * `ingest_events` y las funciones `ensure_ingest_channel`, `rotate_ingest_address`,
 * `add_ingest_sender`, `remove_ingest_sender`) y la función de borde `ingest-email` lo
 * alimenta desde la fase 2. **Todo es del ADMIN**: las tablas solo admiten `select` a su
 * ADMIN (RLS) y las funciones comprueban el rol; `canManageIngest` existe para que la pantalla
 * no ofrezca lo que la base va a rechazar.
 *
 * Las funciones SQL devuelven el token (12 caracteres), no la dirección: el dominio es de
 * despliegue (`VITE_INGEST_DOMAIN`, por defecto el de producción) y no de la base.
 */

export const DEFAULT_INGEST_DOMAIN = 'ingest.nortexsys.com';

/** `ingest-<token>@<dominio>`. */
export function ingestAddress(token: string, domain: string = ingestDomain()): string {
  return `ingest-${token}@${domain}`;
}

export function ingestDomain(): string {
  const fromEnv = import.meta.env.VITE_INGEST_DOMAIN as string | undefined;
  return fromEnv && fromEnv.trim() !== '' ? fromEnv.trim() : DEFAULT_INGEST_DOMAIN;
}

/** Solo el ADMIN abre, rota y gestiona remitentes (`app.ingest_admin_context`). */
export function canManageIngest(role: 'ADMIN' | 'EDITOR'): boolean {
  return role === 'ADMIN';
}

/** Lo que dice la spec (§3) y lo que el canal admite de verdad en la fase 2. */
export const ACCEPTED_FORMATS_NOTICE =
  'Esta dirección acepta archivos CSV, TSV y TXT adjuntos. Tamaño máximo 5 MB por correo (hasta 20.000 líneas). ' +
  'El formato debe coincidir con uno que ya hayas subido a mano y guardado como perfil de columnas.';

export const READ_ONLY_NOTICE = 'Solo un administrador de tu organización gestiona el canal de ingestión por email.';
export const REJECTED_SILENTLY_HINT = 'EMAILS QUE NO ESTÁN EN LA LISTA SE RECHAZAN SILENCIOSAMENTE POR NUESTRO SISTEMA';
export const ROTATED_MESSAGE = 'Dirección rotada. La anterior ya no es válida — actualiza cualquier sistema que la estuviera usando.';

/** Hasta aquí llega la lista de remitentes (`add_ingest_sender`). */
export const MAX_INGEST_SENDERS = 20;

// -----------------------------------------------------------------------------
// Historial
// -----------------------------------------------------------------------------

export type IngestResult = 'PROCESADO' | 'RECHAZADO' | 'ERROR';

export const RESULT_LABELS: Record<IngestResult, string> = {
  PROCESADO: 'Procesado con éxito',
  RECHAZADO: 'Rechazado',
  ERROR: 'Error',
};

/** Los códigos de motivo de `ingest_events_reason_chk`, en lenguaje de quien lee el historial. */
export const REASON_LABELS: Record<string, string> = {
  DIRECCION_INEXISTENTE: 'La dirección no existe o fue rotada',
  AUTENTICACION: 'No se pudo comprobar quién envía el correo (SPF/DKIM/DMARC)',
  VIRUS: 'El correo no pasó el análisis antivirus',
  REMITENTE_NO_AUTORIZADO: 'El remitente no está en la lista',
  TAMANO: 'Supera el tamaño máximo',
  EXTENSION: 'Sin adjunto CSV, TSV o TXT',
  FORMATO_NO_RECONOCIDO: 'Formato de columnas no reconocido: súbelo a mano una vez',
  SIN_FILAS_VALIDAS: 'Ninguna fila válida',
  ERROR_INTERNO: 'Error interno',
};

export function reasonLabel(reason: string | null): string | null {
  if (reason === null) return null;
  return REASON_LABELS[reason] ?? 'Motivo desconocido';
}

export interface IngestSender {
  id: string;
  email: string;
  /** El del ADMIN que abre el canal: no se puede quitar. */
  isProtected: boolean;
}

export interface IngestEventRow {
  id: string;
  receivedAt: string;
  senderEmail: string;
  fileName: string | null;
  result: IngestResult;
  reason: string | null;
  rowsImported: number | null;
}

/** Spec §3: las últimas 10. */
export const HISTORY_LIMIT = 10;

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/** Idempotente: abre el canal si no existe y devuelve el token vigente. Lo llama la pantalla al entrar. */
export async function ensureIngestChannel(): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_ingest_channel');
  if (error) throw error;
  return data as string;
}

/** Irreversible e inmediata: la anterior deja de valer en la misma transacción. */
export async function rotateIngestAddress(): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_ingest_address');
  if (error) throw error;
  return data as string;
}

export async function fetchIngestSenders(): Promise<IngestSender[]> {
  const { data, error } = await supabase
    .from('ingest_senders')
    .select('id, email, is_protected')
    .order('is_protected', { ascending: false })
    .order('email', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as { id: string; email: string; is_protected: boolean };
    return { id: row.id, email: row.email, isProtected: row.is_protected };
  });
}

export async function addIngestSender(email: string): Promise<void> {
  const { error } = await supabase.rpc('add_ingest_sender', { p_email: email });
  if (error) throw error;
}

export async function removeIngestSender(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_ingest_sender', { p_id: id });
  if (error) throw error;
}

export async function fetchIngestEvents(): Promise<IngestEventRow[]> {
  const { data, error } = await supabase
    .from('ingest_events')
    .select('id, received_at, sender_email, file_name, result, reason, rows_imported')
    .order('received_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      received_at: string;
      sender_email: string;
      file_name: string | null;
      result: IngestResult;
      reason: string | null;
      rows_imported: number | null;
    };
    return {
      id: row.id,
      receivedAt: row.received_at,
      senderEmail: row.sender_email,
      fileName: row.file_name,
      result: row.result,
      reason: row.reason,
      rowsImported: row.rows_imported,
    };
  });
}

/** Valida en el cliente lo mismo que `add_ingest_sender`, para no ir a la red con un error seguro. */
export function isValidSenderEmail(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v !== '' && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}
