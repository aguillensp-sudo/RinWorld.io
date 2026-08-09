import { describe, expect, it } from 'vitest';
import {
  pageCount,
  previewLabel,
  relativeTime,
  sanitizeSearch,
  stateTone,
  THREAD_STATES,
  PAGE_SIZE,
  type LastItem,
} from './threads';

/**
 * La lógica pura de MSG-01. Se prueba sin base ni React porque es donde viven las
 * decisiones que la pantalla luego solo pinta.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests no son el contrato del arnés: son los míos. El contrato del arnés está en
 * `screens/messages/*.test.tsx` y en `e2e/messages.spec.ts`.
 */

const NOW = new Date('2026-08-08T12:00:00Z');
const hace = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('previewLabel · solo metadatos', () => {
  it('un mensaje libre no dice nada de su contenido', () => {
    expect(previewLabel({ type: 'MENSAJE', partNumber: null })).toBe('Mensaje libre');
  });

  it('una consulta lleva tipo y referencia', () => {
    expect(previewLabel({ type: 'CONSULTA', partNumber: 'NU2210-E-TVP2' })).toBe(
      'Tarjeta de consulta · NU2210-E-TVP2',
    );
  });

  it('una oferta lleva tipo y referencia', () => {
    expect(previewLabel({ type: 'OFERTA', partNumber: '6205-2RS' })).toBe(
      'Tarjeta de oferta · 6205-2RS',
    );
  });

  it('sin referencia se queda en el tipo, no cuelga un separador suelto', () => {
    expect(previewLabel({ type: 'OFERTA', partNumber: null })).toBe('Tarjeta de oferta');
  });

  it('un hilo sin elementos lo dice, no finge actividad', () => {
    expect(previewLabel(null)).toBe('Sin actividad');
  });

  it('ninguna etiqueta contiene puntitos de ocultación', () => {
    // La §3 los pide si la passphrase no está activa; la §7 dice que la vista
    // previa nunca muestra contenido descifrado. Si nunca lo muestra, no hay nada
    // que tapar. Se resuelve a favor de §7 — ver F-027.
    const casos: (LastItem | null)[] = [
      null,
      { type: 'MENSAJE', partNumber: null },
      { type: 'CONSULTA', partNumber: '6205-2RS' },
      { type: 'OFERTA', partNumber: '6205-2RS' },
    ];
    for (const c of casos) expect(previewLabel(c)).not.toMatch(/•/);
  });
});

describe('stateTone · los cinco estados del esquema', () => {
  it('cubre los cinco sin caer en el default por accidente', () => {
    const tonos = THREAD_STATES.map(stateTone);
    expect(new Set(tonos).size).toBe(5);
  });

  it.each([
    ['ABIERTO', 'neutral'],
    ['CON CONSULTA PENDIENTE', 'info'],
    ['CON OFERTA PENDIENTE', 'warn'],
    ['ACUERDO ALCANZADO', 'success'],
    ['CERRADO SIN ACUERDO', 'closed'],
  ] as const)('%s → %s', (state, tone) => {
    expect(stateTone(state)).toBe(tone);
  });
});

describe('relativeTime · manda el CLDR, no el literal del mock', () => {
  it('horas', () => {
    // La spec escribe "hace 2h" en el bloque informal de datos de ejemplo. Lo que
    // el CLDR de `es` produce en estilo estrecho es "hace 2 h", y es lo correcto.
    // F-024: se compara contra la función, nunca contra la cifra del mock.
    expect(relativeTime(hace(2 * 3600_000), NOW)).toBe('hace 2 h');
  });

  it('días', () => {
    expect(relativeTime(hace(3 * 86_400_000), NOW)).toBe('hace 3 d');
  });

  it('minutos', () => {
    expect(relativeTime(hace(20 * 60_000), NOW)).toBe('hace 20 min');
  });

  it('una fecha ilegible no revienta la fila entera', () => {
    expect(relativeTime('no-es-una-fecha', NOW)).toBe('');
  });
});

describe('paginación', () => {
  it('30 por página, como pide la spec §3', () => {
    expect(PAGE_SIZE).toBe(30);
  });

  it('cero hilos siguen siendo una página', () => {
    expect(pageCount(0)).toBe(1);
  });

  it('30 caben en una y 31 no', () => {
    expect(pageCount(30)).toBe(1);
    expect(pageCount(31)).toBe(2);
  });
});

describe('sanitizeSearch', () => {
  it('quita los separadores del mini-lenguaje de PostgREST', () => {
    // Una coma no da error: da OTRO filtro. El usuario buscaría una cosa y la
    // lista respondería a otra.
    expect(sanitizeSearch('Nordwälz, Lager')).toBe('Nordwälz Lager');
    expect(sanitizeSearch('a(b)c*')).toBe('abc');
  });

  it('conserva los diacríticos, que son parte del nombre', () => {
    expect(sanitizeSearch('  Roulements Rhône  ')).toBe('Roulements Rhône');
  });

  it('corta a 80 caracteres', () => {
    expect(sanitizeSearch('x'.repeat(200))).toHaveLength(80);
  });
});
