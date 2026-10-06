/**
 * REG-06 · Establecer la frase de seguridad (backup passphrase, ADR-001). Capa de datos,
 * escrita a mano: la pantalla la importa y la pinta, no decide nada de lo que hay aquí.
 *
 * - **La frase no sale nunca del navegador** (ADR-001, invariante *server-blind*): aquí
 *   no hay una sola llamada a la red. Se mide en local y se entrega al wiring en memoria,
 *   que se la pasa a REG-07.
 * - **Fortaleza con zxcvbn** (spec REG-06 §3, decisión del PO del 6-oct): `@zxcvbn-ts`,
 *   cargado solo la primera vez que se mide una frase, para no engordar el resto de la app.
 *   Diccionarios común y español, y los datos del usuario (`userInputs`) penalizan una
 *   frase que los contenga.
 * - **Distinta de la contraseña de acceso** (ADR-001): contra la huella en memoria de
 *   `login-fingerprint.ts`.
 *
 * Textos: los del HTML aprobado (`REG-06 · EBP v1.0.html`) y, donde el HTML no pinta un
 * estado, los de la spec §6.
 */
import type { ZxcvbnFactory } from '@zxcvbn-ts/core';
import { matchesLoginPassword } from './login-fingerprint';

/** Spec §4: *«mín. 12 caracteres»*. */
export const MIN_PASSPHRASE_LENGTH = 12;

/** Spec §3: *«El botón de avance solo se habilita con nivel ≥ Fuerte (score ≥ 3)»*. */
export const MIN_STRONG_SCORE = 3;

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export type StrengthKey = 'muy-debil' | 'debil' | 'aceptable' | 'fuerte' | 'muy-fuerte';

export type StrengthLevel = {
  /** La puntuación de zxcvbn, 0 a 4. */
  score: StrengthScore;
  /** Cuántos de los cinco segmentos de la barra se encienden: `score + 1`. */
  segments: 1 | 2 | 3 | 4 | 5;
  key: StrengthKey;
  label: string;
};

/** Spec §3: los cinco niveles, de rojo a verde. Índice = puntuación de zxcvbn. */
export const STRENGTH_LEVELS: readonly StrengthLevel[] = [
  { score: 0, segments: 1, key: 'muy-debil', label: 'Muy débil' },
  { score: 1, segments: 2, key: 'debil', label: 'Débil' },
  { score: 2, segments: 3, key: 'aceptable', label: 'Aceptable' },
  { score: 3, segments: 4, key: 'fuerte', label: 'Fuerte' },
  { score: 4, segments: 5, key: 'muy-fuerte', label: 'Muy fuerte' },
];

export const PASSPHRASE_TEXTS = {
  eyebrow: 'Módulo 01 · Onboarding',
  title: 'Crea tu frase de seguridad',
  subtitle:
    'Esta frase protege tu clave privada. Es diferente a tu contraseña de acceso y debes guardarla en un lugar seguro.',
  passphraseLabel: 'Backup passphrase',
  passphrasePlaceholder: 'Mín. 12 caracteres',
  repeatLabel: 'Repetir backup passphrase',
  repeatPlaceholder: 'Repite la frase',
  noticeStrong: 'Anótala ahora.',
  noticeRest:
    'Si la pierdes y no tienes backup en la nube, perderás acceso a tu historial cifrado permanentemente.',
  acknowledgement:
    'Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente.',
  submit: 'Continuar',
  showPassphrase: 'Mostrar frase',
  hidePassphrase: 'Ocultar frase',
  /** Spec §6. */
  errorSameAsLogin: 'La frase de seguridad debe ser diferente a tu contraseña de acceso',
  errorTooWeak: 'La frase necesita ser más fuerte para continuar',
  errorMismatch: 'Las frases no coinciden',
} as const;

// -----------------------------------------------------------------------------
// Medir la frase
// -----------------------------------------------------------------------------

let factory: Promise<ZxcvbnFactory> | null = null;

/** zxcvbn y sus diccionarios se cargan una sola vez, la primera vez que hacen falta. */
function loadZxcvbn(): Promise<ZxcvbnFactory> {
  factory ??= (async () => {
    const [core, common, es] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-es-es'),
    ]);
    // Sin Levenshtein, a propósito. Medido el 6-oct en Node: con ella cada medida tarda
    // 200 ms–1,4 s, en el hilo principal y en CADA pulsación; sin ella, 3–30 ms. Las
    // puntuaciones coinciden salvo `12345678Aa!!` (1 → 2), que sigue sin llegar a Fuerte.
    return new core.ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...es.dictionary },
      graphs: common.adjacencyGraphs,
      useLevenshteinDistance: false,
    });
  })();
  return factory;
}

/** Lo que REG-06 necesita saber de una frase para pintarse. */
export type PassphraseCheck = {
  /** La frase que se midió: la pantalla descarta un resultado que ya no es el de su campo. */
  passphrase: string;
  score: StrengthScore;
  sameAsLogin: boolean;
};

/**
 * Mide una frase: su puntuación zxcvbn y si es la contraseña de acceso de `email`.
 * `userInputs` son datos del usuario (email, nombre, organización) que no deberían
 * formar la frase: zxcvbn la penaliza si los contiene. Una frase vacía es 0 y no se
 * compara. **Nada de esto sale del navegador.**
 */
export async function checkPassphrase(
  email: string,
  passphrase: string,
  userInputs: readonly string[] = [],
): Promise<PassphraseCheck> {
  if (passphrase === '') return { passphrase, score: 0, sameAsLogin: false };
  const [zxcvbn, sameAsLogin] = await Promise.all([loadZxcvbn(), matchesLoginPassword(email, passphrase)]);
  const result = await zxcvbn.checkAsync(passphrase, [email, ...userInputs].filter((x) => x !== ''));
  return { passphrase, score: result.score as StrengthScore, sameAsLogin };
}

// -----------------------------------------------------------------------------
// Qué se pinta
// -----------------------------------------------------------------------------

export type PassphraseForm = {
  passphrase: string;
  repeat: string;
  acknowledged: boolean;
};

export const EMPTY_PASSPHRASE_FORM: PassphraseForm = { passphrase: '', repeat: '', acknowledged: false };

export type PassphraseView = {
  /** El nivel de la barra; `null` con el campo vacío o mientras no hay medida de ESTA frase. */
  strength: StrengthLevel | null;
  /** Bajo el campo 1: idéntica a la contraseña, o demasiado débil. Una a la vez. */
  passphraseError: string | null;
  /** Bajo el campo 2: no coincide. Solo cuando ya se ha escrito algo en él. */
  repeatError: string | null;
  /** Borde verde del campo 1 (HTML `.f-input.success`): la frase vale. */
  passphraseOk: boolean;
  /** Borde verde del campo 2: coincide con una frase no vacía. */
  repeatOk: boolean;
  /** El botón `Continuar`. */
  canContinue: boolean;
};

/**
 * Todo lo que REG-06 pinta, derivado del formulario y de la ÚLTIMA medida. Una medida de
 * otra frase (la respuesta de una pulsación anterior) se ignora: hasta que llega la de la
 * frase actual no hay barra ni error, y el botón está deshabilitado.
 */
export function passphraseView(form: PassphraseForm, check: PassphraseCheck | null): PassphraseView {
  const { passphrase, repeat, acknowledged } = form;
  const fresh = check !== null && check.passphrase === passphrase ? check : null;
  const longEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const strong = fresh !== null && fresh.score >= MIN_STRONG_SCORE && longEnough;
  const same = fresh?.sameAsLogin ?? false;

  let passphraseError: string | null = null;
  if (passphrase !== '' && fresh !== null) {
    if (same) passphraseError = PASSPHRASE_TEXTS.errorSameAsLogin;
    else if (!strong) passphraseError = PASSPHRASE_TEXTS.errorTooWeak;
  }

  const matches = repeat === passphrase;
  const repeatError = repeat !== '' && !matches ? PASSPHRASE_TEXTS.errorMismatch : null;
  const passphraseOk = strong && !same;

  return {
    strength: passphrase !== '' && fresh !== null ? STRENGTH_LEVELS[fresh.score] ?? null : null,
    passphraseError,
    repeatError,
    passphraseOk,
    repeatOk: repeat !== '' && matches,
    canContinue: passphraseOk && matches && acknowledged,
  };
}
