import { describe, expect, it } from 'vitest';
import {
  ageLabel,
  ageLevel,
  CRITICAL_DAYS,
  daysSince,
  FILTERS,
  pageButtons,
  pageCount,
  PAGE_SIZE,
  sanitizeSearch,
  STALE_DAYS,
} from './inventory';

const NOW = new Date('2026-08-07T12:00:00Z');

/** `d` días antes de NOW, en ISO. */
function ago(d: number, hours = 0): string {
  return new Date(NOW.getTime() - d * 86_400_000 - hours * 3_600_000).toISOString();
}

describe('daysSince', () => {
  it('cuenta días completos, no fracciones', () => {
    expect(daysSince(ago(0), NOW)).toBe(0);
    expect(daysSince(ago(1), NOW)).toBe(1);
    expect(daysSince(ago(45), NOW)).toBe(45);
  });

  it('23 horas siguen siendo 0 días', () => {
    expect(daysSince(ago(0, 23), NOW)).toBe(0);
  });

  it('no revienta con una fecha ilegible', () => {
    expect(daysSince('no es una fecha', NOW)).toBe(0);
  });
});

/**
 * El borde de estos dos umbrales decide de qué color sale un tercio de la tabla,
 * y la spec dice "> 7" y "> 30", no ">=". A los 7 días exactos la línea todavía
 * NO está desactualizada. Con `>=` el catálogo del día 3 pintaría en naranja
 * líneas subidas esta semana.
 */
describe('ageLevel', () => {
  it('a los 7 días exactos todavía está fresca', () => {
    expect(ageLevel(STALE_DAYS)).toBe('fresh');
  });

  it('al octavo día pasa a aviso', () => {
    expect(ageLevel(STALE_DAYS + 1)).toBe('stale');
  });

  it('a los 30 días exactos sigue en aviso, no en crítico', () => {
    expect(ageLevel(CRITICAL_DAYS)).toBe('stale');
  });

  it('al día 31 pasa a crítico', () => {
    expect(ageLevel(CRITICAL_DAYS + 1)).toBe('critical');
  });

  it('recién subida es fresca', () => {
    expect(ageLevel(0)).toBe('fresh');
  });
});

describe('ageLabel', () => {
  it('usa singular con un día', () => {
    expect(ageLabel(1)).toBe('Hace 1 día');
  });

  it('usa plural a partir de dos', () => {
    expect(ageLabel(2)).toBe('Hace 2 días');
    expect(ageLabel(45)).toBe('Hace 45 días');
  });

  it('hoy no dice "Hace 0 días"', () => {
    expect(ageLabel(0)).toBe('Hoy');
  });
});

describe('pageCount', () => {
  it('un inventario vacío sigue siendo una página', () => {
    expect(pageCount(0)).toBe(1);
  });

  it('exactamente PAGE_SIZE cabe en una', () => {
    expect(pageCount(PAGE_SIZE)).toBe(1);
  });

  it('una línea más ya son dos', () => {
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });

  it('las 1.247 líneas del ejemplo de la spec dan 25 páginas', () => {
    // Es el número que el HTML aprobado pinta en el pie: "1.247 líneas · pág. 1/25".
    expect(pageCount(1247)).toBe(25);
  });
});

describe('pageButtons', () => {
  it('con pocas páginas las pinta todas y sin elipsis', () => {
    expect(pageButtons(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageButtons(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('al principio de un rango largo, elipsis solo a la derecha', () => {
    expect(pageButtons(1, 25)).toEqual([1, 2, null, 25]);
  });

  it('en el medio, elipsis a los dos lados', () => {
    expect(pageButtons(12, 25)).toEqual([1, null, 11, 12, 13, null, 25]);
  });

  it('al final, elipsis solo a la izquierda', () => {
    expect(pageButtons(25, 25)).toEqual([1, null, 24, 25]);
  });

  it('nunca pone dos elipsis seguidas', () => {
    for (let p = 1; p <= 25; p++) {
      const out = pageButtons(p, 25);
      for (let i = 1; i < out.length; i++) {
        expect(out[i] === null && out[i - 1] === null).toBe(false);
      }
    }
  });

  it('siempre incluye la actual, la primera y la última', () => {
    for (let p = 1; p <= 25; p++) {
      const out = pageButtons(p, 25);
      expect(out).toContain(p);
      expect(out).toContain(1);
      expect(out).toContain(25);
    }
  });
});

/**
 * `or=(part_number.ilike.*x*,brand.ilike.*x*)` es un mini-lenguaje de PostgREST.
 * Un término con una coma no da error: da OTRO filtro. El usuario buscaría una
 * cosa y la tabla contestaría a otra, sin nada en rojo que lo delate.
 */
describe('sanitizeSearch', () => {
  it('conserva guiones, barras y puntos: son parte de las referencias reales', () => {
    expect(sanitizeSearch('NU2210-E-TVP2')).toBe('NU2210-E-TVP2');
    expect(sanitizeSearch('6205-2RS/C3')).toBe('6205-2RS/C3');
    expect(sanitizeSearch('30206.A')).toBe('30206.A');
  });

  it('quita los separadores del propio lenguaje de filtros', () => {
    expect(sanitizeSearch('6205,brand.eq.SKF')).toBe('6205brand.eq.SKF');
    expect(sanitizeSearch('6205)')).toBe('6205');
    expect(sanitizeSearch('a"b')).toBe('ab');
    expect(sanitizeSearch('a\\b')).toBe('ab');
  });

  it('quita el comodín, que si no lo pone el usuario donde quiere', () => {
    expect(sanitizeSearch('*')).toBe('');
    expect(sanitizeSearch('62*05')).toBe('6205');
  });

  it('recorta espacios y limita la longitud', () => {
    expect(sanitizeSearch('  SKF  ')).toBe('SKF');
    expect(sanitizeSearch('x'.repeat(200))).toHaveLength(80);
  });

  it('un término que era solo basura queda vacío, y vacío significa sin filtro', () => {
    expect(sanitizeSearch('  ,,()  ')).toBe('');
  });
});

describe('FILTERS', () => {
  /**
   * La spec §3 llama al orden de los chips "orden fijo" y §7 dice que la tabla no
   * se toca. Añadir un quinto chip (por ejemplo "Eliminados") sería cambiar un
   * contrato aprobado, así que este test es la valla.
   */
  it('son cuatro y en el orden de la spec', () => {
    expect(FILTERS).toEqual(['todos', 'publicados', 'desactualizados', 'archivados']);
  });
});
