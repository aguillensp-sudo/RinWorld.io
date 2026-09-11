import { describe, expect, it } from 'vitest';
import { countryName } from './search';
import {
  clampPage,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  hasActiveFilters,
  nextSort,
  PAGE_SIZE,
  pageCountFor,
  SORT_FIELDS,
  toDirectoryRow,
  type DirectoryRowRaw,
} from './directory';

/**
 * La lógica pura de DIR-01. Sin base y sin React, como la de `search.test.ts`.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests **no son el contrato del arnés**: son los míos. El contrato de la
 * pantalla vivirá en `screens/directory/*.test.tsx`, lo escribe otra sesión y el
 * Coder no lo ve (`UMBRAL-FABRICA-V1.md` §1).
 */

function raw(over: Partial<DirectoryRowRaw> = {}): DirectoryRowRaw {
  return {
    id: 'c3000000-0000-4000-8000-000000000003',
    name: 'Cuscinetti Padana',
    country: 'IT',
    contact_phone: '+39 02 1234 5678',
    contact_email: 'info@cuscinettipadana.it',
    favorite_count: 7,
    ...over,
  };
}

describe('paginación en servidor', () => {
  it('cero resultados es UNA página vacía, no cero páginas', () => {
    expect(pageCountFor(0)).toBe(1);
  });

  it('la página se llena antes de abrir la siguiente', () => {
    expect(pageCountFor(PAGE_SIZE)).toBe(1);
    expect(pageCountFor(PAGE_SIZE + 1)).toBe(2);
    expect(pageCountFor(PAGE_SIZE * 2)).toBe(2);
    expect(pageCountFor(PAGE_SIZE * 2 + 1)).toBe(3);
  });

  it('encaja la página pedida en el rango que existe', () => {
    expect(clampPage(0, 500)).toBe(1);
    expect(clampPage(-3, 500)).toBe(1);
    expect(clampPage(99, 120)).toBe(3);
    expect(clampPage(2, 120)).toBe(2);
  });

  it('y no se rompe con una página que no es un número', () => {
    expect(clampPage(Number.NaN, 500)).toBe(1);
    expect(clampPage(2.7, 500)).toBe(2);
  });
});

describe('filtros', () => {
  it('sin filtros no hay nada que limpiar', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('un país o un nombre encienden el botón de limpiar', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, country: 'ES' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, name: 'Rodamientos' })).toBe(true);
  });

  it('pero un nombre de solo espacios NO cuenta como filtro', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, name: '   ' })).toBe(false);
  });
});

describe('orden', () => {
  it('arranca por nombre ascendente, como pide la spec', () => {
    expect(DEFAULT_SORT).toEqual({ field: 'name', ascending: true });
  });

  it('la misma cabecera invierte el sentido', () => {
    expect(nextSort({ field: 'name', ascending: true }, 'name'))
      .toEqual({ field: 'name', ascending: false });
  });

  it('y otra cabecera empieza de nuevo ascendente', () => {
    expect(nextSort({ field: 'name', ascending: false }, 'favorite_count'))
      .toEqual({ field: 'favorite_count', ascending: true });
  });

  it('⚠ los campos de orden son NOMBRES DE COLUMNA, no encabezados', () => {
    // Van directos al `.order()` de PostgREST. Si alguien los renombra a
    // `favoritos` o `pais` para que "se lean mejor", hace falta una tabla de
    // traducción en medio y el fallo sale en producción, no aquí: PostgREST
    // devuelve error 400 sobre una columna que no existe y la tabla se queda en
    // blanco. Esta fila del esquema es la que fija el vocabulario.
    const fila = raw();
    for (const campo of SORT_FIELDS) {
      expect(Object.keys(fila)).toContain(campo);
    }
  });
});

describe('el mapeo de la fila', () => {
  it('trae las cinco columnas de la tabla', () => {
    expect(toDirectoryRow(raw())).toEqual({
      id: 'c3000000-0000-4000-8000-000000000003',
      name: 'Cuscinetti Padana',
      country: 'IT',
      countryLabel: countryName('IT'),
      phone: '+39 02 1234 5678',
      email: 'info@cuscinettipadana.it',
      favoriteCount: 7,
    });
  });

  it('un contacto sin rellenar es hueco, nunca null', () => {
    const fila = toDirectoryRow(raw({ contact_phone: null, contact_email: null }));
    expect(fila.phone).toBe('');
    expect(fila.email).toBe('');
  });

  it('y una organización sin favoritos cuenta cero, no null', () => {
    expect(toDirectoryRow(raw({ favorite_count: null })).favoriteCount).toBe(0);
  });

  it('el país viaja DOS veces: el código para el badge y el nombre para el filtro', () => {
    // No es redundancia: la spec de DIR-01 pide un badge con el código ISO de dos
    // letras, mientras que la de SRCH-01 exige el nombre completo en el idioma de
    // sesión. Dos decisiones distintas para dos pantallas distintas.
    const fila = toDirectoryRow(raw({ country: 'de' }));
    expect(fila.country).toBe('DE');
    expect(fila.countryLabel).toBe(countryName('DE'));
    expect(fila.countryLabel).not.toBe('DE');
  });
});
