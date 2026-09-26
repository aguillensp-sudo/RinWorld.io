import { supabase } from './supabase';
import { MAX_USERS, isValidEmail } from './invitations';

/**
 * Capa de datos de REG-09 (Bienvenida) y FRU (Registro de usuario adicional).
 *
 * Las dos pantallas las ve un ADMIN que acaba de dejar su clave lista
 * (`KEY_ACTIVE`, 0038). Todo lo que necesitan de la base va por funciones
 * `security definer` (`onboarding_seats_used`, `activate_own_membership`,
 * `email_has_account`), porque un miembro `KEY_ACTIVE` no pasa
 * `app.is_active_member()` y la RLS no le deja leer nada de su organización.
 *
 * Decisiones que no se leen en el código (`DECISIONES-V1.md`, 26-sep-2026):
 *
 * 1. **El contador cuenta plazas ocupadas, el ADMIN incluido**, tal como lo dibuja
 *    el HTML aprobado: con un usuario añadido dice `2 de 5`. Con solo el ADMIN no
 *    se muestra. La spec decía «X de 5 usuarios registrados» sin decir si contaba
 *    al ADMIN; manda el HTML.
 * 2. **Los textos son los del HTML aprobado, no los de la spec** cuando difieren
 *    (`Ir al panel`, no `No, ir al panel`), por la misma regla que `F-170`.
 * 3. **No se manda ningún correo** (F-212): la cuenta se crea confirmada y quien la
 *    crea, el ADMIN, le entrega las credenciales.
 */

// -----------------------------------------------------------------------------
// REG-09 · la vista de la bienvenida, en función de las plazas ocupadas
// -----------------------------------------------------------------------------

export interface WelcomeView {
  title: string;
  /** La pregunta que hay sobre los botones, o el aviso del límite cuando no cabe nadie más. */
  question: string;
  /** `null` mientras el ADMIN está solo: el contador solo aparece cuando ya hay alguien más. */
  counter: string | null;
  /** `false` en el límite: el botón `Sí, añadir un usuario ahora` desaparece. */
  canAdd: boolean;
}

export const LIMIT_TITLE = '¡Equipo al completo!';
export const LIMIT_MESSAGE = 'Has alcanzado el límite de 5 usuarios por organización.';

/** «Juan Martínez» → «Juan». Sin nombre, cae al email antes de la arroba. */
export function firstName(fullName: string | null, email: string): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return first || (email.split('@')[0] ?? email);
}

export function welcomeView(name: string, seatsUsed: number): WelcomeView {
  if (seatsUsed >= MAX_USERS) {
    return {
      title: LIMIT_TITLE,
      question: LIMIT_MESSAGE,
      counter: `${MAX_USERS} de ${MAX_USERS} usuarios registrados`,
      canAdd: false,
    };
  }
  if (seatsUsed <= 1) {
    return {
      title: `¡Bienvenido a Bearingworld.io, ${name}!`,
      question: '¿Deseas añadir usuarios ahora?',
      counter: null,
      canAdd: true,
    };
  }
  return {
    title: '¿Quieres añadir otro usuario?',
    question: '¿Deseas añadir otro usuario?',
    counter: `${seatsUsed} de ${MAX_USERS} usuarios registrados`,
    canAdd: true,
  };
}

// -----------------------------------------------------------------------------
// FRU · validación del formulario (la misma que repite la Edge Function)
// -----------------------------------------------------------------------------

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const PASSWORD_MIN = 10;

export const NAME_HINT = 'Introduce al menos 2 caracteres.';
export const EMAIL_HINT = 'Introduce un email válido.';
export const PASSWORD_HINT = 'La contraseña no cumple los requisitos mínimos.';
export const PASSWORD_MISMATCH = 'Las contraseñas no coinciden.';

export function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length >= NAME_MIN && n.length <= NAME_MAX;
}

/** 10+ caracteres, mayúscula, minúscula, número y símbolo. */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export interface NewMemberForm {
  fullName: string;
  email: string;
  password: string;
  repeat: string;
  acceptedTerms: boolean;
}

/** El botón `Registrar usuario` se habilita solo con todo válido, sin email ya registrado y con T&C. */
export function canRegister(form: NewMemberForm, emailTaken: boolean): boolean {
  return (
    isValidName(form.fullName) &&
    isValidEmail(form.email) &&
    !emailTaken &&
    isValidPassword(form.password) &&
    form.password === form.repeat &&
    form.acceptedTerms
  );
}

// -----------------------------------------------------------------------------
// Red
// -----------------------------------------------------------------------------

/** Plazas ocupadas de mi organización: miembros no revocados más invitaciones pendientes. */
export async function fetchSeatsUsed(): Promise<number> {
  const { data, error } = await supabase.rpc('onboarding_seats_used');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** «Ir al panel»: `KEY_ACTIVE` → `ACTIVE`. Lo mueve el servidor, nunca el cliente. */
export async function activateOwnMembership(): Promise<void> {
  const { error } = await supabase.rpc('activate_own_membership');
  if (error) throw error;
}

/**
 * Da de alta al usuario adicional por la Edge Function `register-additional-member`.
 *
 * El motivo de un rechazo viene en el cuerpo de la respuesta (`{ error }`), no en
 * el `message` de `FunctionsHttpError`, que es genérico: se lee de ahí para que la
 * pantalla diga *por qué* (email ya registrado, límite de 5…).
 */
export async function registerAdditionalMember(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('register-additional-member', {
    body: { full_name: input.fullName.trim(), email: input.email.trim(), password: input.password },
  });
  if (!error) return;

  let reason: string | null = null;
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') reason = body.error;
    } catch {
      // El cuerpo no era JSON: se cae al mensaje genérico de abajo.
    }
  }
  throw new Error(reason ?? 'No se pudo registrar al usuario.');
}
