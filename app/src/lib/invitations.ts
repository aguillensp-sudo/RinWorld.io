import { supabase } from './supabase';

/**
 * Capa de datos de INVT-01 · Panel de Gestión de Invitaciones.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3, y
 * `UMBRAL-FABRICA-V1.md` §1). La lógica pura arriba y suelta, para probarla sin
 * base ni React; lo que toca red, al final. El servidor manda: el límite de 5, la
 * regla de «email ya registrado» y quién puede qué las hacen cumplir las funciones
 * de `0037`. Aquí solo se calcula lo que la pantalla PINTA (plazas, etiquetas,
 * puntos) para que el cliente no tenga una segunda opinión sobre lo que el
 * servidor ya decidió.
 *
 * ⚠ **CUATRO COSAS QUE LA SPEC NO DICE COMO EL ESQUEMA**, descubiertas cruzando la
 * spec de INVT-01 con `organization-onboarding` y con el catálogo:
 *
 * 1. **La spec dice «5 usuarios activos» y el ejemplo de VERA cuenta las
 *    pendientes.** Manda el ejemplo (F-170, decisión del PO): una invitación
 *    pendiente ocupa plaza. `seatsUsed` las suma.
 * 2. **«Eliminar usuario» es revocar, no borrar.** `user-revocation`: el usuario
 *    pierde el acceso en el acto y su clave y su historial cifrado no se tocan. En
 *    la base es `members.state = 'CANCELLED'` (`remove_member`, 0037). Un
 *    `CANCELLED` ya no sale en la tabla ni ocupa plaza.
 * 3. **No se envía ningún correo.** El HTML aprobado dice *«El usuario recibirá un
 *    email con el enlace de registro»*; ni hay proveedor de correo en el proyecto
 *    ni existe el flujo de registro por invitación. La pantalla dice que la
 *    invitación se ha REGISTRADA (mismo criterio que `ADMIN-01`).
 * 4. **El estado `Expirada` no se guarda.** Es un hecho del reloj: lo calcula la
 *    vista `member_invitation_list` (mismo motivo que `watcher_list`, 0035).
 */

// -----------------------------------------------------------------------------
// Constantes y tipos
// -----------------------------------------------------------------------------

/** *«Límite: 5 usuarios por organización»* (spec §3, `additional-user-invitation`). */
export const MAX_USERS = 5;

export type InvitationStatus = 'Pendiente' | 'Aceptada' | 'Expirada';

export interface InvitationRow {
  id: string;
  email: string;
  status: InvitationStatus;
  /** ISO 8601, tal como lo devuelve la base. */
  sentAt: string;
  /** Solo las pendientes; `null` en las demás. */
  daysLeft: number | null;
}

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
  state: string;
}

/** Lo que devuelve PostgREST de `member_invitation_list`, antes de tocarlo. */
export interface InvitationRowRaw {
  id: string;
  email: string;
  status: string;
  sent_at: string;
  days_left: number | null;
}

/** Lo que devuelve PostgREST de `members`, antes de tocarlo. */
export interface TeamMemberRaw {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  state: string;
}

// -----------------------------------------------------------------------------
// El mapeo
// -----------------------------------------------------------------------------

function toStatus(raw: string): InvitationStatus {
  return raw === 'Aceptada' || raw === 'Expirada' ? raw : 'Pendiente';
}

export function toInvitationRow(raw: InvitationRowRaw): InvitationRow {
  return {
    id: raw.id,
    email: raw.email,
    status: toStatus(raw.status),
    sentAt: raw.sent_at,
    daysLeft: raw.days_left ?? null,
  };
}

export function toTeamMember(raw: TeamMemberRaw): TeamMember {
  return {
    id: raw.id,
    // Sin nombre, el email: la tabla nunca pinta una celda vacía.
    fullName: raw.full_name?.trim() ? raw.full_name.trim() : raw.email,
    email: raw.email,
    role: raw.role === 'ADMIN' ? 'ADMIN' : 'EDITOR',
    state: raw.state,
  };
}

// -----------------------------------------------------------------------------
// Plazas
// -----------------------------------------------------------------------------

/** Las pendientes: las únicas invitaciones que ocupan plaza. */
export function pendingCount(invitations: readonly InvitationRow[]): number {
  return invitations.filter((i) => i.status === 'Pendiente').length;
}

/** *«Una invitación pendiente ocupa plaza»* (spec §3, F-170): usuarios + pendientes. */
export function seatsUsed(members: readonly TeamMember[], invitations: readonly InvitationRow[]): number {
  return members.length + pendingCount(invitations);
}

export function freeSeats(members: readonly TeamMember[], invitations: readonly InvitationRow[]): number {
  return Math.max(0, MAX_USERS - seatsUsed(members, invitations));
}

/** Sin plazas: el formulario se deshabilita y sale el aviso de límite. */
export function limitReached(members: readonly TeamMember[], invitations: readonly InvitationRow[]): boolean {
  return seatsUsed(members, invitations) >= MAX_USERS;
}

/**
 * *«2/5»*. **Cuenta los usuarios, no las plazas ocupadas**: el ejemplo del diseño
 * (`2 activos y 1 invitación pendiente`) pinta `2/5`, y el detalle de al lado dice
 * cuántas pendientes y cuántas plazas libres quedan.
 */
export function capacityLabel(members: readonly TeamMember[]): string {
  return `${members.length}/${MAX_USERS}`;
}

/** *«· 1 invitación pendiente · 2 plazas libres»*, con singular y plural. */
export function capacityDetail(members: readonly TeamMember[], invitations: readonly InvitationRow[]): string {
  const p = pendingCount(invitations);
  const l = freeSeats(members, invitations);
  const pend = p === 1 ? '1 invitación pendiente' : `${p} invitaciones pendientes`;
  const libres = l === 1 ? '1 plaza libre' : `${l} plazas libres`;
  return `· ${pend} · ${libres}`;
}

export type CapacityDot = 'used' | 'inv' | 'free';

/** Los cinco puntos del indicador: usuarios, pendientes y libres, en ese orden. */
export function capacityDots(members: readonly TeamMember[], invitations: readonly InvitationRow[]): CapacityDot[] {
  const used = Math.min(members.length, MAX_USERS);
  const inv = Math.min(pendingCount(invitations), MAX_USERS - used);
  return Array.from({ length: MAX_USERS }, (_, i) => (i < used ? 'used' : i < used + inv ? 'inv' : 'free'));
}

/** El aviso de límite (spec §3), verbatim. */
export const LIMIT_NOTICE =
  'Tu organización ha alcanzado el límite de 5 usuarios, contando las invitaciones pendientes. Para añadir uno nuevo, elimina un usuario o espera a que caduque una invitación.';

// -----------------------------------------------------------------------------
// Etiquetas
// -----------------------------------------------------------------------------

/** El email como lo guarda la base: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** La forma mínima que también exige el CHECK de la base: algo, arroba, algo, punto, algo. */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(email));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * *«24 jun 2026 · 11:42»*. A mano y en hora LOCAL: la fecha de envío es la que el
 * ADMIN vio en su reloj. `Intl` da `24 jun 2026, 11:42` con coma y sin el punto
 * medio del diseño.
 */
export function sentAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

/** *«5 días»*, *«1 día»*. `—` si no hay (aceptadas y expiradas). */
export function expiresInLabel(daysLeft: number | null): string {
  if (daysLeft === null) return '—';
  return daysLeft === 1 ? '1 día' : `${daysLeft} días`;
}

export function roleLabel(role: TeamMember['role']): string {
  return role === 'ADMIN' ? 'Admin' : 'Editor';
}

/** `Activo` o `Suspendido`; un miembro que aún no ha terminado el alta, `En alta`. */
export function memberStateLabel(state: string): string {
  if (state === 'ACTIVE') return 'Activo';
  if (state === 'SUSPENDED') return 'Suspendido';
  return 'En alta';
}

/**
 * Solo un Editor, y nunca uno mismo. Lo cumple `remove_member` en el servidor; esto
 * decide si la fila lleva el botón `Eliminar` o el guion con su motivo.
 */
export function canRemove(member: TeamMember, selfId: string): boolean {
  return member.role === 'EDITOR' && member.id !== selfId;
}

/** El motivo del guion en la fila que no se puede eliminar (spec, HTML aprobado). */
export const CANNOT_REMOVE_OWN_ADMIN = 'No se puede eliminar al propio administrador';

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

const HIDDEN_STATES = '(CANCELLED,REJECTED)';

/** Los usuarios de la organización que ocupan plaza: sin revocados ni rechazados. */
export async function fetchTeam(orgId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, email, role, state')
    .eq('org_id', orgId)
    .not('state', 'in', HIDDEN_STATES)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toTeamMember(r as unknown as TeamMemberRaw));
}

/** Las invitaciones de la organización, las más recientes primero. */
export async function fetchInvitations(): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from('member_invitation_list')
    .select('id, email, status, sent_at, days_left')
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toInvitationRow(r as unknown as InvitationRowRaw));
}

/** *«Este email ya tiene cuenta»*, en tiempo real. Solo la puede llamar un ADMIN. */
export async function emailHasAccount(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_has_account', { p_email: normalizeEmail(email) });
  if (error) throw error;
  return data === true;
}

export async function inviteMember(email: string): Promise<void> {
  const { error } = await supabase.rpc('invite_member', { p_email: normalizeEmail(email) });
  if (error) throw error;
}

export async function resendInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('resend_invitation', { p_id: id });
  if (error) throw error;
}

export async function removeMember(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_member_id: id });
  if (error) throw error;
}
