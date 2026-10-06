import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetLoginPassword,
  hasLoginFingerprint,
  matchesLoginPassword,
  rememberLoginPassword,
} from './login-fingerprint';

afterEach(() => {
  forgetLoginPassword();
  vi.restoreAllMocks();
});

describe('huella de la contraseña de acceso (REG-06, ADR-001)', () => {
  it('sin huella no hay nada que comparar', async () => {
    expect(hasLoginFingerprint('a@b.es')).toBe(false);
    expect(await matchesLoginPassword('a@b.es', 'lo-que-sea')).toBe(false);
  });

  it('reconoce la contraseña recordada y nada más', async () => {
    await rememberLoginPassword('a@b.es', 'Secreta-2026!');
    expect(hasLoginFingerprint('a@b.es')).toBe(true);
    expect(await matchesLoginPassword('a@b.es', 'Secreta-2026!')).toBe(true);
    expect(await matchesLoginPassword('a@b.es', 'secreta-2026!')).toBe(false);
    expect(await matchesLoginPassword('a@b.es', 'Secreta-2026! ')).toBe(false);
    expect(await matchesLoginPassword('a@b.es', '')).toBe(false);
  });

  it('va atada al email (sin distinguir mayúsculas ni espacios del email)', async () => {
    await rememberLoginPassword(' A@B.es ', 'Secreta-2026!');
    expect(hasLoginFingerprint('a@b.es')).toBe(true);
    expect(hasLoginFingerprint('otro@b.es')).toBe(false);
    expect(await matchesLoginPassword('otro@b.es', 'Secreta-2026!')).toBe(false);
  });

  it('la última sesión manda: recordar otra cuenta sustituye a la anterior', async () => {
    await rememberLoginPassword('a@b.es', 'Uno-1111111');
    await rememberLoginPassword('c@d.es', 'Dos-2222222');
    expect(hasLoginFingerprint('a@b.es')).toBe(false);
    expect(await matchesLoginPassword('c@d.es', 'Dos-2222222')).toBe(true);
  });

  it('olvidar la borra', async () => {
    await rememberLoginPassword('a@b.es', 'Secreta-2026!');
    forgetLoginPassword();
    expect(hasLoginFingerprint('a@b.es')).toBe(false);
  });

  it('no guarda nada en localStorage ni en sessionStorage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    await rememberLoginPassword('a@b.es', 'Secreta-2026!');
    expect(local).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain('Secreta');
  });
});
