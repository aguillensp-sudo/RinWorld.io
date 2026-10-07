import { supabase } from './supabase';
import { functionError } from './access-request';
import { rememberLoginPassword } from './login-fingerprint';
import { SIGN_IN_AFTER_ERROR } from './register-org';

/**
 * Capa de datos de INVT-02 (canje de invitación). El invitado llega con el enlace que su
 * administrador le pasó (`#invitacion?token=…`, `0050`) y crea su cuenta de EDITOR.
 *
 * **La escribe Claude Code a mano, no el Coder** (`CLAUDE.md` §3): autenticación y alta de
 * cuentas. Las dos llamadas de red van a la Edge Function `accept-invitation`, sin sesión y
 * con un solo permiso, el token. El token va en el `hash` de la URL: el navegador no lo manda
 * al servidor y no queda en sus registros.
 */

/** El formato lo genera `invitationUrl`: `#invitacion?token=<64 hex>`. */
export function invitationTokenFromHash(hash: string): string | null {
  const match = /^#invitacion\?token=([0-9a-f]{64})$/i.exec(hash.trim());
  return match && match[1] ? match[1].toLowerCase() : null;
}

/** La URL completa que el ADMIN copia en INVT-01. */
export function invitationUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}#invitacion?token=${token}`;
}

export type InvitationStatus = 'OK' | 'EXPIRED' | 'EXISTS' | 'FULL';

export type InvitationInfo = {
  status: InvitationStatus;
  orgName: string;
  /** `null` si quien invitó ya no tiene nombre en la base. */
  inviterName: string | null;
  email: string;
  expiresAt: string;
};

export const INVITATION_LINK_ERROR = 'Este enlace no es válido.';
export const ACCEPT_ERROR = 'No se pudo crear la cuenta.';

const STATUSES: ReadonlySet<string> = new Set(['OK', 'EXPIRED', 'EXISTS', 'FULL']);

function toInfo(raw: unknown): InvitationInfo | null {
  const r = raw as Record<string, unknown> | null;
  if (
    !r ||
    typeof r.status !== 'string' ||
    !STATUSES.has(r.status) ||
    typeof r.org_name !== 'string' ||
    typeof r.email !== 'string' ||
    typeof r.expires_at !== 'string'
  ) {
    return null;
  }
  return {
    status: r.status as InvitationStatus,
    orgName: r.org_name,
    inviterName: typeof r.inviter_name === 'string' ? r.inviter_name : null,
    email: r.email,
    expiresAt: r.expires_at,
  };
}

/** Comprueba el enlace. Lanza `INVITATION_LINK_ERROR` si no vale, sin decir por qué. */
export async function validateInvitationLink(token: string): Promise<InvitationInfo> {
  const { data, error } = await supabase.functions.invoke('accept-invitation', {
    body: { action: 'validate', token },
  });
  if (error) throw await functionError(error, INVITATION_LINK_ERROR);
  const info = toInfo((data as { invitation?: unknown } | null)?.invitation);
  if (!info) throw new Error(INVITATION_LINK_ERROR);
  return info;
}

/** Entre la validación y el alta alguien pudo ocupar el correo o la última plaza. */
export class InvitationBlocked extends Error {
  constructor(readonly status: 'EXISTS' | 'FULL') {
    super(status);
  }
}

async function blockedStatus(error: unknown): Promise<'EXISTS' | 'FULL' | null> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response && response.status === 409) {
    try {
      const body = (await response.clone().json()) as { status?: unknown };
      if (body.status === 'EXISTS' || body.status === 'FULL') return body.status;
    } catch {
      // Cuerpo que no era JSON: cae al mensaje genérico.
    }
  }
  return null;
}

/**
 * Crea la cuenta y, si sale bien, **inicia sesión** con ella: lo demás lo hace la sesión de
 * la app. La cuenta nace `REGISTERED` y cae en ACT-02. El correo es el de la invitación (el
 * servidor no acepta otro); aquí solo hace falta para iniciar sesión.
 */
export async function acceptInvitation(
  token: string,
  input: { fullName: string; password: string; email: string },
): Promise<void> {
  const { error } = await supabase.functions.invoke('accept-invitation', {
    body: { action: 'accept', token, full_name: input.fullName.trim(), password: input.password },
  });
  if (error) {
    const blocked = await blockedStatus(error);
    if (blocked) throw new InvitationBlocked(blocked);
    throw await functionError(error, ACCEPT_ERROR);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (signInError) throw new Error(SIGN_IN_AFTER_ERROR);
  // REG-06 compara la frase con la huella de esta contraseña (ADR-001): la cuenta va derecha a ACT-02.
  await rememberLoginPassword(input.email, input.password);
}

/** `14 oct 2026 · dentro de 5 días` — nunca «0 días»: una que vence en dos horas dice «1 día». */
export function expiryText(expiresAt: string, now: Date = new Date()): { date: string; left: string } {
  const exp = new Date(expiresAt);
  const date = exp.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  const days = Math.max(1, Math.ceil((exp.getTime() - now.getTime()) / 86_400_000));
  return { date, left: `dentro de ${days} ${days === 1 ? 'día' : 'días'}` };
}

/** Textos de INVT-02 (`openspec/v1/diseno/PROPUESTA-INVT-02-ACT-02.md`, aprobada el 7-oct-2026). */
export const INVITATION_TEXTS = {
  title: 'Te han invitado a Bearingworld.io',
  subtitleLine1: 'Crea tu usuario para unirte a la organización que te ha invitado.',
  subtitleLine2: 'Tu administrador ya ha hecho el resto.',
  rowOrg: 'Organización',
  rowInviter: 'Invitado por',
  rowRole: 'Tu rol',
  rowEmail: 'Tu correo',
  rowExpires: 'Caduca',
  roleName: 'Editor',
  inviterRole: 'Administrador',
  inviterFallback: 'Tu administrador',
  section: '— Tus datos —',
  fullNameLabel: 'Nombre completo',
  fullNamePlaceholder: 'Nombre y apellidos',
  fullNameHint: 'Mín 2 / máx 100 caracteres',
  emailLabel: 'Correo electrónico',
  emailHint: 'El de la invitación · no editable',
  passwordLabel: 'Contraseña',
  passwordPlaceholder: 'Mín. 10 caracteres',
  passwordHint: '1 may · 1 min · 1 número · 1 símbolo',
  repeatLabel: 'Repetir contraseña',
  repeatPlaceholder: 'Repite la contraseña',
  repeatHint: 'Debe coincidir exactamente',
  termsBefore: 'Acepto los ',
  termsLink: 'Términos y Condiciones',
  termsAfter: ' de Bearingworld.io.',
  notice:
    'Al terminar tendrás que activar tu cuenta con tu propia frase de seguridad. Solo tú la conoces: ni tu administrador ni Bearingworld.io pueden recuperarla.',
  submit: 'Crear mi cuenta y unirme',
  submitting: 'Creando tu cuenta…',
  toLogin: 'Ir al inicio de sesión',
  expired: {
    title: 'Esta invitación ha caducado',
    strong: 'Las invitaciones valen 7 días.',
    text: 'Pide a tu administrador que genere una nueva y te envíe el enlace. La anterior ya no sirve.',
  },
  invalid: {
    title: 'Este enlace no es válido',
    strong: 'No hemos podido abrir la invitación.',
    text: 'Puede que ya se haya usado, que tu administrador la haya anulado o que el enlace esté incompleto. Si crees que es un error, pide otro enlace a tu administrador.',
  },
  full: {
    title: 'La organización ha llegado a su límite de usuarios',
    strong: (org: string) => `${org} ya tiene 5 usuarios activos.`,
    text: (date: string) =>
      `Tu administrador debe dar de baja a alguno antes de que puedas unirte. Tu invitación sigue vigente hasta el ${date}.`,
  },
  exists: {
    title: 'Este correo ya tiene una cuenta',
    strong: (email: string) => `${email} ya está registrado en Bearingworld.io.`,
    text: 'Una cuenta solo puede pertenecer a una organización. Si es la tuya, inicia sesión. Si necesitas cambiar de organización, escribe a soporte.',
    action: 'Iniciar sesión',
  },
} as const;
