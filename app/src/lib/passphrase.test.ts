import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkPassphrase,
  EMPTY_PASSPHRASE_FORM,
  MIN_PASSPHRASE_LENGTH,
  MIN_STRONG_SCORE,
  PASSPHRASE_TEXTS,
  passphraseView,
  STRENGTH_LEVELS,
  type PassphraseCheck,
} from './passphrase';
import { forgetLoginPassword, rememberLoginPassword } from './login-fingerprint';

/**
 * Capa de datos de REG-06. zxcvbn va DE VERDAD (es local y determinista): mockearlo
 * convertiría esto en una comprobación del mock, y lo que importa es que una frase
 * predecible no pase.
 */

const EMAIL = 'admin@julsa.es';
const FUERTE = 'correct-horse-battery-staple-2024';

afterEach(() => {
  forgetLoginPassword();
  vi.unstubAllGlobals();
});

describe('REG-06 · niveles y textos', () => {
  it('cinco niveles, de Muy débil a Muy fuerte, indexados por la puntuación de zxcvbn', () => {
    expect(STRENGTH_LEVELS.map((l) => l.label)).toEqual(['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte']);
    STRENGTH_LEVELS.forEach((l, i) => {
      expect(l.score).toBe(i);
      expect(l.segments).toBe(i + 1);
    });
  });

  it('el umbral es el de la spec: Fuerte (3) y 12 caracteres', () => {
    expect(MIN_STRONG_SCORE).toBe(3);
    expect(MIN_PASSPHRASE_LENGTH).toBe(12);
  });

  it('los textos de error son los de la spec §6, literales', () => {
    expect(PASSPHRASE_TEXTS.errorSameAsLogin).toBe('La frase de seguridad debe ser diferente a tu contraseña de acceso');
    expect(PASSPHRASE_TEXTS.errorTooWeak).toBe('La frase necesita ser más fuerte para continuar');
    expect(PASSPHRASE_TEXTS.errorMismatch).toBe('Las frases no coinciden');
  });

  it('la casilla dice exactamente lo de la spec §4 (§7: «el texto debe ser exacto»)', () => {
    expect(PASSPHRASE_TEXTS.acknowledgement).toBe(
      'Entiendo que si pierdo esta frase y no tengo backup en la nube, perderé mi historial cifrado permanentemente.',
    );
  });
});

describe('REG-06 · checkPassphrase (zxcvbn real)', () => {
  it('la frase del ejemplo del HTML aprobado es Muy fuerte', async () => {
    const r = await checkPassphrase(EMAIL, FUERTE);
    expect(r.score).toBe(4);
    expect(r.passphrase).toBe(FUERTE);
  });

  // Contraseñas predecibles que la heurística del HTML aprobado daba por buenas y zxcvbn no
  // (medido el 6-oct). Ojo: zxcvbn NO es un muro; `Aaaaaaaaaaaa1!` saca 3 (10^8 intentos),
  // que es justo el umbral de la spec.
  it.each(['Password2024!', 'Qwerty123456!', '12345678Aa!!', 'contraseña123456', 'qwertyuiop1234', '123456789012'])(
    '«%s» no llega a Fuerte aunque tenga 12 caracteres o más',
    async (frase) => {
      expect((await checkPassphrase(EMAIL, frase)).score).toBeLessThan(MIN_STRONG_SCORE);
    },
  );

  it('cuatro palabras al azar, lo que recomienda VERA, sí llegan (la heurística del HTML las rechazaba)', async () => {
    expect((await checkPassphrase(EMAIL, 'mesa perro azul lluvia')).score).toBeGreaterThanOrEqual(MIN_STRONG_SCORE);
  });

  it('una frase hecha con el email del usuario puntúa peor que sin él', async () => {
    const conDatos = await checkPassphrase('rodamientosjulsa@julsa.es', 'rodamientosjulsa2026', ['JULSA INDUSTRIAL']);
    const sinDatos = await checkPassphrase('otro@otro.es', 'rodamientosjulsa2026');
    expect(conDatos.score).toBeLessThanOrEqual(sinDatos.score);
  });

  it('una frase vacía es 0 y no se compara con nada', async () => {
    expect(await checkPassphrase(EMAIL, '')).toEqual({ passphrase: '', score: 0, sameAsLogin: false });
  });

  it('detecta la contraseña de acceso de ESTA cuenta, y solo de esta', async () => {
    await rememberLoginPassword(EMAIL, FUERTE);
    expect((await checkPassphrase(EMAIL, FUERTE)).sameAsLogin).toBe(true);
    expect((await checkPassphrase(EMAIL, FUERTE + 'x')).sameAsLogin).toBe(false);
    expect((await checkPassphrase('otra@cuenta.es', FUERTE)).sameAsLogin).toBe(false);
  });

  it('no llama a la red: la frase no sale del navegador (ADR-001)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await rememberLoginPassword(EMAIL, 'otra-cosa-distinta-99');
    await checkPassphrase(EMAIL, FUERTE, ['JULSA']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('REG-06 · passphraseView', () => {
  const medida = (passphrase: string, score: 0 | 1 | 2 | 3 | 4, sameAsLogin = false): PassphraseCheck => ({
    passphrase,
    score,
    sameAsLogin,
  });
  let form = { ...EMPTY_PASSPHRASE_FORM };
  beforeEach(() => {
    form = { passphrase: FUERTE, repeat: FUERTE, acknowledged: true };
  });

  it('el formulario vacío no pinta barra ni errores y no deja continuar', () => {
    const v = passphraseView(EMPTY_PASSPHRASE_FORM, null);
    expect(v).toEqual({
      strength: null,
      passphraseError: null,
      repeatError: null,
      passphraseOk: false,
      repeatOk: false,
      canContinue: false,
    });
  });

  it('todo bien: Muy fuerte, sin errores, los dos campos en verde y el botón habilitado', () => {
    const v = passphraseView(form, medida(FUERTE, 4));
    expect(v.strength?.label).toBe('Muy fuerte');
    expect(v.passphraseError).toBeNull();
    expect(v.repeatError).toBeNull();
    expect(v.passphraseOk).toBe(true);
    expect(v.repeatOk).toBe(true);
    expect(v.canContinue).toBe(true);
  });

  it('Fuerte (3) basta', () => {
    expect(passphraseView(form, medida(FUERTE, 3)).canContinue).toBe(true);
  });

  it.each([0, 1, 2] as const)('con puntuación %i: «más fuerte» y sin botón', (score) => {
    const v = passphraseView(form, medida(FUERTE, score));
    expect(v.strength?.score).toBe(score);
    expect(v.passphraseError).toBe(PASSPHRASE_TEXTS.errorTooWeak);
    expect(v.passphraseOk).toBe(false);
    expect(v.canContinue).toBe(false);
  });

  it('menos de 12 caracteres no pasa aunque zxcvbn diga Muy fuerte', () => {
    const corta = 'Zq#8vL!2pW0';
    expect(corta.length).toBe(11);
    const v = passphraseView({ passphrase: corta, repeat: corta, acknowledged: true }, medida(corta, 4));
    expect(v.passphraseError).toBe(PASSPHRASE_TEXTS.errorTooWeak);
    expect(v.canContinue).toBe(false);
  });

  it('igual a la contraseña: ese error, y no el de «más fuerte», aunque además sea débil', () => {
    expect(passphraseView(form, medida(FUERTE, 4, true)).passphraseError).toBe(PASSPHRASE_TEXTS.errorSameAsLogin);
    expect(passphraseView(form, medida(FUERTE, 1, true)).passphraseError).toBe(PASSPHRASE_TEXTS.errorSameAsLogin);
    expect(passphraseView(form, medida(FUERTE, 4, true)).canContinue).toBe(false);
  });

  it('no coinciden: el error va bajo el campo 2 y solo cuando ya se ha escrito en él', () => {
    expect(passphraseView({ ...form, repeat: '' }, medida(FUERTE, 4)).repeatError).toBeNull();
    const v = passphraseView({ ...form, repeat: FUERTE.slice(0, -1) }, medida(FUERTE, 4));
    expect(v.repeatError).toBe(PASSPHRASE_TEXTS.errorMismatch);
    expect(v.repeatOk).toBe(false);
    expect(v.canContinue).toBe(false);
  });

  it('sin marcar la casilla no se continúa', () => {
    expect(passphraseView({ ...form, acknowledged: false }, medida(FUERTE, 4)).canContinue).toBe(false);
  });

  it('una medida de OTRA frase (una pulsación anterior) se ignora: sin barra, sin error y sin botón', () => {
    const v = passphraseView(form, medida(FUERTE.slice(0, -1), 4));
    expect(v.strength).toBeNull();
    expect(v.passphraseError).toBeNull();
    expect(v.canContinue).toBe(false);
  });
});
