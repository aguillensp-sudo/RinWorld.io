/**
 * REC-01 y SET-SEC-01 · recuperar la clave en otro navegador y cambiar la frase
 * (ADR-001 §7.2 y §8). Capa de datos escrita a mano (criptografía, Plan §4.3): las
 * pantallas la llaman y pintan, no deciden nada de lo que hay aquí.
 *
 * Las dos empiezan igual —pedir el backup al servidor, que **cuenta un intento**
 * (`begin_key_recovery`, 0049) y a los cinco se calla durante 30 minutos— y abrirlo en
 * el navegador con la frase. Lo que hacen después es lo que las separa:
 *
 *   · `recoverKey`            guarda la privada en ESTE dispositivo (IndexedDB), la
 *                             pone de llavero y avisa al servidor de que se abrió.
 *   · `changeBackupPassphrase` re-cifra la MISMA privada con la frase nueva y sustituye
 *                             el backup (`replace_key_backup`). La pública no cambia.
 *   · `discardKeyBackup`      «He perdido mi frase»: el servidor borra el backup y la
 *                             cuenta vuelve a `REGISTERED` para generar un par nuevo.
 *
 * **Invariante server-blind (ADR-001 §8).** Igual que `key-backup.ts`: la frase, la
 * clave de envoltura y la privada en claro no salen de la pestaña, ni en un payload ni
 * en el texto de un error. Los bytes de la privada que se abren aquí se borran en un
 * `finally`, salga como salga.
 */
import { supabase } from './supabase';
import { type SessionKeyPair, fromBytea, keyPairFromPrivateBytes, toBytea } from './crypto';
import { saveDeviceKey } from './device-key';
import { adoptKeyring, clearKeyring } from './keys';
import {
  KDF_PARAMS,
  type Argon2Runner,
  deriveWrappingKey,
  openPrivateKey,
  protectPrivateKey,
  runArgon2,
} from './key-backup';

/** ADR-001 §7.2 y 0049: cinco peticiones del backup, y media hora de espera. */
export const MAX_RECOVERY_ATTEMPTS = 5;
export const RECOVERY_COOLDOWN_MINUTES = 30;

// -----------------------------------------------------------------------------
// Pedir y abrir el backup
// -----------------------------------------------------------------------------

export type OpenOutcome =
  /** El servidor no entrega nada: se agotaron los intentos. */
  | { kind: 'locked'; secondsLeft: number }
  /** La frase no abre el backup. `lockedSeconds` > 0 si este era el último intento. */
  | { kind: 'wrong'; attemptsLeft: number; lockedSeconds: number }
  /** Abierto. El llamante BORRA `privateBytes`. */
  | { kind: 'opened'; privateBytes: Uint8Array; publicKey: Uint8Array; attemptsLeft: number };

interface RecoveryRow {
  status: string;
  seconds_left: number;
  attempts_left: number;
  public_key: string | null;
  encrypted_key_blob: string | null;
  key_iv: string | null;
  argon2_salt: string | null;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Pide el backup (un intento) y lo abre con `passphrase`. Una frase mala NO lanza: es
 * el resultado normal de equivocarse. Lanza solo si no se ha podido preguntar al
 * servidor, y entonces no se sabe si el intento se contó.
 */
export async function openOwnBackup(
  passphrase: string,
  memberId: string,
  argon2: Argon2Runner = runArgon2,
): Promise<OpenOutcome> {
  const { data, error } = await supabase.rpc('begin_key_recovery');
  const row = (Array.isArray(data) ? data[0] : data) as RecoveryRow | null | undefined;
  if (error || !row) throw new Error('No se pudo comprobar tu frase de seguridad.');

  if (row.status === 'locked') return { kind: 'locked', secondsLeft: row.seconds_left };

  if (!row.public_key || !row.encrypted_key_blob || !row.key_iv || !row.argon2_salt) {
    throw new Error('El backup de tu clave no está completo.');
  }

  const wrongAnswer: OpenOutcome = {
    kind: 'wrong',
    attemptsLeft: row.attempts_left,
    lockedSeconds: row.attempts_left <= 0 ? row.seconds_left : 0,
  };

  let privateBytes: Uint8Array | null = null;
  try {
    const wrappingKey = await deriveWrappingKey(passphrase, fromBytea(row.argon2_salt), KDF_PARAMS, argon2);
    privateBytes = await openPrivateKey(fromBytea(row.encrypted_key_blob), fromBytea(row.key_iv), wrappingKey, memberId);
  } catch {
    return wrongAnswer;
  }

  // Abre, pero ¿es la clave de este miembro? Una privada que no da la pública publicada
  // no vale: no se instala. (Con GCM y la AAD no debería pasar; es la última guarda.)
  const publicKey = fromBytea(row.public_key);
  try {
    const pair = await keyPairFromPrivateBytes(privateBytes);
    if (!same(pair.publicKey, publicKey)) {
      privateBytes.fill(0);
      return wrongAnswer;
    }
  } catch {
    privateBytes.fill(0);
    return wrongAnswer;
  }
  return { kind: 'opened', privateBytes, publicKey, attemptsLeft: row.attempts_left };
}

async function endRecovery(publicKey: Uint8Array): Promise<void> {
  // Reiniciar el contador no es esencial: si falla, el siguiente intento cuenta uno de más.
  await supabase.rpc('end_key_recovery', { p_public_key: toBytea(publicKey) });
}

// -----------------------------------------------------------------------------
// REC-01 · recuperar en este navegador
// -----------------------------------------------------------------------------

export type RecoverOutcome = { kind: 'locked'; secondsLeft: number }
  | { kind: 'wrong'; attemptsLeft: number; lockedSeconds: number }
  | { kind: 'recovered' };

export async function recoverKey(
  passphrase: string,
  memberId: string,
  argon2: Argon2Runner = runArgon2,
): Promise<RecoverOutcome> {
  const opened = await openOwnBackup(passphrase, memberId, argon2);
  if (opened.kind !== 'opened') return opened;

  let pair: SessionKeyPair;
  try {
    pair = await keyPairFromPrivateBytes(opened.privateBytes);
  } finally {
    opened.privateBytes.fill(0);
  }
  // Si IndexedDB no deja, el llavero de la sesión sirve igual; en la siguiente se pedirá otra vez.
  await saveDeviceKey(memberId, pair);
  adoptKeyring(memberId, pair);
  await endRecovery(opened.publicKey);
  return { kind: 'recovered' };
}

/** «Generar nuevas claves»: borra el backup en el servidor y suelta el llavero. */
export async function discardKeyBackup(): Promise<void> {
  const { error } = await supabase.rpc('discard_key_backup');
  if (error) throw new Error('No se pudieron preparar las claves nuevas.');
  clearKeyring();
}

// -----------------------------------------------------------------------------
// SET-SEC-01 · cambiar la frase
// -----------------------------------------------------------------------------

export type ChangeOutcome = { kind: 'locked'; secondsLeft: number }
  | { kind: 'wrong'; attemptsLeft: number; lockedSeconds: number }
  | { kind: 'changed' };

/**
 * Abre el backup con la frase actual, re-cifra la misma privada con la nueva y sube el
 * resultado. Antes de subir lo abre otra vez con la clave nueva: un backup que no se
 * pudiera abrir sustituiría a uno que sí, y no hay histórico (SET-SEC-01 §3).
 */
export async function changeBackupPassphrase(
  currentPassphrase: string,
  newPassphrase: string,
  memberId: string,
  argon2: Argon2Runner = runArgon2,
): Promise<ChangeOutcome> {
  const opened = await openOwnBackup(currentPassphrase, memberId, argon2);
  if (opened.kind !== 'opened') return opened;

  let sealed: Awaited<ReturnType<typeof protectPrivateKey>>;
  try {
    const keyPair = await keyPairFromPrivateBytes(opened.privateBytes);
    // `protectPrivateKey` borra `privateBytes` salga bien o mal; el `finally` cubre el resto.
    sealed = await protectPrivateKey(newPassphrase, memberId, { privateBytes: opened.privateBytes, keyPair }, argon2);
  } finally {
    opened.privateBytes.fill(0);
  }
  const { payload, wrappingKey } = sealed;

  const check = await openPrivateKey(payload.encryptedKeyBlob, payload.keyIv, wrappingKey, memberId);
  try {
    const again = await keyPairFromPrivateBytes(check);
    if (!same(again.publicKey, opened.publicKey)) throw new Error('El backup nuevo no se puede abrir.');
  } finally {
    check.fill(0);
  }

  const { error } = await supabase.rpc('replace_key_backup', {
    p_public_key: toBytea(payload.publicKey),
    p_encrypted_key_blob: toBytea(payload.encryptedKeyBlob),
    p_key_iv: toBytea(payload.keyIv),
    p_argon2_salt: toBytea(payload.argon2Salt),
    p_kdf_params: payload.kdfParams,
  });
  if (error) throw new Error('No se pudo guardar la nueva frase.');
  return { kind: 'changed' };
}

// -----------------------------------------------------------------------------
// Textos
// -----------------------------------------------------------------------------

/**
 * REC-01. El HTML aprobado manda sobre la spec donde difieren (título, subtítulo, botón y
 * errores). De la spec vienen el enlace «He perdido…» y su aviso, que el HTML no dibuja.
 * El aviso del HTML para el bloqueo («puedes seguir… el contenido nuevo se cifrará con una
 * nueva clave») no es verdad en esta versión —sin clave no se escribe contenido cifrado— y
 * se sustituye por lo que sí ocurre (F-239).
 */
export const KEY_RECOVERY_TEXTS = {
  eyebrow: 'Seguridad · E2EE',
  title: 'Recuperar acceso a tu historial cifrado',
  subtitle:
    'Introduce tu frase de seguridad (backup passphrase) para descifrar tu clave privada y acceder a tu historial de mensajes.',
  info: 'Esta frase es la que estableciste al registrarte. No se almacena en ningún servidor — solo existe en tu memoria.',
  label: 'Frase de seguridad',
  placeholder: 'Introduce tu backup passphrase',
  submit: 'Desbloquear historial',
  working: 'Descifrando…',
  wrong: 'Frase incorrecta. Compruébala e inténtalo de nuevo.',
  connection: 'No hemos podido comprobar tu frase. Revisa tu conexión e inténtalo de nuevo.',
  attempts: (left: number) => `${left} de ${MAX_RECOVERY_ATTEMPTS} intentos restantes`,
  cooldownTitle: 'Demasiados intentos fallidos.',
  cooldownText: (minutes: number) =>
    `Podrás volver a intentarlo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
  cooldownNotice:
    'Si has olvidado tu frase, no es posible recuperar el historial cifrado anterior. Puedes seguir viendo el estado de tus conversaciones, pero no su contenido, hasta que la recuperes o generes claves nuevas.',
  done: 'Clave descifrada. Tu historial ya es accesible.',
  back: 'Volver al panel',
  skip: 'Ahora no, ir al panel',
  lost: 'He perdido mi frase de seguridad →',
  modalTitle: '¿Has perdido tu frase de seguridad?',
  modalText:
    'Generaremos un par de claves nuevo. Lo que está cifrado para tu clave actual no se podrá volver a leer, y tendrás que crear una frase nueva y activar de nuevo tu cuenta.',
  modalCheck: 'Entiendo que perderé permanentemente el acceso a mi historial cifrado anterior',
  modalCancel: 'Cancelar',
  modalConfirm: 'Generar nuevas claves',
  modalConfirming: 'Preparando…',
  modalError: 'No hemos podido preparar las claves nuevas. Inténtalo de nuevo.',
} as const;

/** SET-SEC-01. Mismo criterio: HTML aprobado primero. */
export const CHANGE_PASSPHRASE_TEXTS = {
  eyebrow: 'Módulo 07 · Seguridad',
  title: 'Cambiar backup passphrase',
  subtitle:
    'Actualiza la frase que protege tu clave privada. Al guardar, la clave se recifra de inmediato en tu dispositivo.',
  tag: 'E2EE · X25519 + Argon2id + AES-256-GCM',
  currentLabel: 'Passphrase actual',
  currentPlaceholder: 'Introduce tu passphrase actual',
  newLabel: 'Nueva passphrase',
  newPlaceholder: 'Mínimo 12 caracteres',
  newHint: 'Usa 4 o más palabras no relacionadas (ej. «cielo mesa tren verde»).',
  repeatLabel: 'Repetir nueva passphrase',
  repeatPlaceholder: 'Repite la nueva passphrase',
  noticeStrong: 'Guarda la nueva frase en un lugar seguro.',
  noticeRest: 'Si la olvidas, no es posible recuperarla. El backup anterior se sobrescribe: no hay histórico.',
  cancel: 'Cancelar',
  submit: 'Guardar cambios',
  working: 'Guardando…',
  wrongCurrent: 'La passphrase actual no es correcta.',
  locked: (minutes: number) =>
    `Demasiados intentos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
  connection: 'No hemos podido guardar la nueva frase. Tu frase anterior sigue siendo válida; inténtalo de nuevo.',
  done: 'Backup passphrase actualizada. Tu clave privada ha sido recifrada.',
} as const;
