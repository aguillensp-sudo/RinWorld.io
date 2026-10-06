/**
 * Huella de la contraseña de acceso, SOLO EN MEMORIA, para que REG-06 pueda comprobar que
 * la frase de seguridad es distinta (ADR-001: *«the backup passphrase must be a different
 * secret from the login password»*).
 *
 * Por qué así (decisión del PO, 6-oct-2026, `DECISIONES-V1.md`):
 * - Tras iniciar sesión la app ya no tiene la contraseña, y comprobarlo contra el servidor
 *   obligaría a mandar la frase por la red, que ADR-001 prohíbe (*«never transmitted»*).
 * - Así que, en el momento en que la contraseña pasa por el navegador (`signIn` de
 *   `session.ts` y el alta de REG-01), se guarda `SHA-256(sal ‖ contraseña)` con una sal
 *   aleatoria de esta pestaña. Ni la contraseña ni la huella salen de la memoria: nada va a
 *   `localStorage`, ni a la red, ni a un log.
 * - Una recarga la pierde. Sin huella no se puede comprobar, y el wiring cierra la sesión y
 *   pide entrar de nuevo antes de dejar crear la frase (`hasLoginFingerprint`).
 *
 * La huella va atada al email: la de una cuenta no vale para comparar la de otra.
 */

type Fingerprint = { email: string; salt: Uint8Array; hash: Uint8Array };

let current: Fingerprint | null = null;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function digest(salt: Uint8Array, secret: string): Promise<Uint8Array> {
  const text = new TextEncoder().encode(secret);
  const data = new Uint8Array(salt.length + text.length);
  data.set(salt, 0);
  data.set(text, salt.length);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

/** Se llama con la contraseña recién usada para iniciar sesión con éxito. */
export async function rememberLoginPassword(email: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  current = { email: normalizeEmail(email), salt, hash: await digest(salt, password) };
}

/** Al cerrar sesión, o cuando la sesión desaparece. */
export function forgetLoginPassword(): void {
  current = null;
}

/** ¿Hay huella de la contraseña de ESTA cuenta? Sin ella, REG-06 no puede comprobar nada. */
export function hasLoginFingerprint(email: string): boolean {
  return current !== null && current.email === normalizeEmail(email);
}

/**
 * ¿Es `candidate` la contraseña de acceso de `email`? `false` también cuando no hay huella
 * de esa cuenta: quien llame tiene que haber exigido `hasLoginFingerprint` antes.
 * Comparación en tiempo constante sobre los 32 bytes.
 */
export async function matchesLoginPassword(email: string, candidate: string): Promise<boolean> {
  const fp = current;
  if (!fp || fp.email !== normalizeEmail(email) || candidate === '') return false;
  const hash = await digest(fp.salt, candidate);
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= (hash[i] ?? 0) ^ (fp.hash[i] ?? 0);
  return diff === 0 && hash.length === fp.hash.length;
}
