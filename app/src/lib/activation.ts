import { supabase } from './supabase';
import { rememberLoginPassword } from './login-fingerprint';
import { isValidPassword } from './onboarding';

/**
 * Capa de datos de ACT-02 (activar la cuenta de un miembro invitado). **La escribe Claude Code
 * a mano** (`CLAUDE.md` §3): cambio de contraseña y arranque de la Fase B.
 *
 * Una cuenta creada por FRU lleva `user_metadata.must_change_password = true` (la contraseña la
 * puso el ADMIN: sin cambiarla, el ADMIN la conocería para siempre). **Es solo un aviso de
 * interfaz**: el cliente puede tocar su propio `user_metadata`, así que no protege nada. Lo que
 * protege es lo de siempre: la contraseña de acceso no es la frase de seguridad (ADR-001) y
 * la privada no sale del navegador.
 */

export async function hasProvisionalPassword(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.user_metadata?.must_change_password === true;
}

export const WRONG_PROVISIONAL = 'La contraseña provisional no es correcta.';
export const SAME_PASSWORD = 'La nueva contraseña debe ser distinta de la provisional.';
export const CHANGE_ERROR = 'No se pudo cambiar la contraseña.';

/**
 * Comprueba la provisional iniciando sesión con ella, cambia la contraseña y apaga el aviso.
 * `rememberLoginPassword` va con la NUEVA: REG-06 la compara con la frase de seguridad.
 */
export async function changeProvisionalPassword(
  email: string,
  current: string,
  next: string,
): Promise<void> {
  if (!isValidPassword(next)) throw new Error(CHANGE_ERROR);
  if (next === current) throw new Error(SAME_PASSWORD);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: current,
  });
  if (signInError) throw new Error(WRONG_PROVISIONAL);

  const { error } = await supabase.auth.updateUser({
    password: next,
    data: { must_change_password: false },
  });
  if (error) throw new Error(CHANGE_ERROR);

  await rememberLoginPassword(email, next);
}

/** Textos de ACT-02 (`openspec/v1/diseno/PROPUESTA-INVT-02-ACT-02.md`, aprobada el 7-oct-2026). */
export const ACTIVATION_TEXTS = {
  eyebrow: 'Módulo 01 · Onboarding',
  title: 'Activa tu cuenta',
  subtitleLine1: (org: string) => `Ya formas parte de ${org}.`,
  subtitleLine2: 'Para escribir mensajes, consultas y ofertas necesitas tu propia clave de cifrado.',
  rowUser: 'Usuario',
  rowOrg: 'Organización',
  rowRole: 'Rol',
  rowState: 'Estado',
  roleName: 'Editor',
  stateBadge: 'Pendiente de activar',
  stepsLabel: 'Pasos de la activación',
  steps: [
    { n: 'PASO 1', title: 'Entender tu clave', text: 'Qué es y por qué solo tú la tienes.' },
    { n: 'PASO 2', title: 'Elegir tu frase', text: 'La que protege tu copia de seguridad.' },
    { n: 'PASO 3', title: 'Guardar tu clave', text: 'Se genera en este navegador.' },
  ],
  beforeTitle: 'Hasta que la actives',
  before: ['Puedes ver la información de tu organización.', 'No puedes enviar mensajes, consultas ni ofertas.'],
  afterTitle: 'Cuando la actives',
  after: [
    'Tendrás acceso completo como Editor.',
    'Tu clave quedará en este navegador y tu copia cifrada en el servidor.',
  ],
  noticeStrong: 'La frase es solo tuya.',
  notice:
    ' Tu administrador no puede restablecerla. Si la pierdes y no tienes otro navegador con tu clave, podrás empezar con una clave nueva, pero perderás el acceso al contenido cifrado anterior.',
  start: 'Empezar la activación',
  later: 'Ahora no, cerrar sesión',
  // Variante: contraseña provisional (alta por FRU).
  tempTitle: 'Antes de empezar, elige tu contraseña',
  tempLine1: 'Tu administrador creó tu cuenta con una contraseña provisional.',
  tempLine2: 'Cámbiala ahora: desde este momento solo la conocerás tú.',
  tempCurrent: 'Contraseña provisional',
  tempCurrentPlaceholder: 'La que te dio tu administrador',
  newLabel: 'Contraseña',
  newPlaceholder: 'Mín. 10 caracteres',
  newHint: '1 may · 1 min · 1 número · 1 símbolo',
  repeatLabel: 'Repetir contraseña',
  repeatPlaceholder: 'Repite la contraseña',
  repeatHint: 'Debe coincidir exactamente',
  tempSubmit: 'Cambiar contraseña y continuar',
  tempSubmitting: 'Cambiando…',
  tempSignOut: 'Cerrar sesión',
} as const;
