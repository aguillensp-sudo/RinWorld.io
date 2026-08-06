import { describe, expect, it } from 'vitest';
import { initials } from './session';

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
