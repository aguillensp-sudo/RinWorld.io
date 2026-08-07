import { describe, expect, it } from 'vitest';
import { errorMessage, initials } from './session';

describe('initials', () => {
  it('toma la primera y la última de un nombre compuesto', () => {
    expect(initials('Juan Martínez', 'j@x.com')).toBe('JM');
  });

  it('con tres nombres usa el primero y el último, no el del medio', () => {
    expect(initials('Ana Belén Ruiz', 'a@x.com')).toBe('AR');
  });

  it('con un solo nombre devuelve una sola letra', () => {
    expect(initials('Walter', 'w@x.com')).toBe('W');
  });

  it('cae al email cuando no hay nombre', () => {
    expect(initials(null, 'beta@bearingworld.test')).toBe('B');
  });

  it('cae al email cuando el nombre es espacios en blanco', () => {
    expect(initials('   ', 'alpha@bearingworld.test')).toBe('A');
  });

  it('normaliza a mayúsculas', () => {
    expect(initials('ana ruiz', 'a@x.com')).toBe('AR');
  });
});

/**
 * F-020. Estos tests existen porque la pantalla de login enseñó "[object Object]"
 * en rojo durante todo el día 3 mientras tapaba un `PGRST201` que explicaba el
 * fallo entero. El caso que importa es el primero: un error de PostgREST NO es
 * una instancia de `Error`.
 */
describe('errorMessage', () => {
  it('saca el mensaje de un error de PostgREST, que no es instancia de Error', () => {
    const postgrestError = {
      message: "Could not embed because more than one relationship was found for 'members'",
      code: 'PGRST201',
      details: [],
      hint: "Try changing 'organizations' to 'organizations!members_org_id_fkey'",
    };
    const out = errorMessage(postgrestError);
    expect(out).not.toBe('[object Object]');
    expect(out).toContain('PGRST201');
    expect(out).toContain('more than one relationship');
    expect(out).toContain('members_org_id_fkey');
  });

  it('usa el message de un Error normal', () => {
    expect(errorMessage(new Error('sin red'))).toBe('sin red');
  });

  it('con un objeto que solo trae message no inventa corchetes vacíos', () => {
    expect(errorMessage({ message: 'Invalid login credentials' })).toBe(
      'Invalid login credentials',
    );
  });

  it('con algo que no es ni Error ni objeto útil no revienta', () => {
    expect(errorMessage('cadena pelada')).toBe('cadena pelada');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage({})).toBe('[object Object]');
  });
});
