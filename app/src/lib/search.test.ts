import { describe, expect, it } from 'vitest';
import {
  activeChips,
  consultSummary,
  countryName,
  DEFAULT_SORT,
  EMPTY_CRITERIA,
  leadTimeLabel,
  meetsMinQuantity,
  metaCounterLabel,
  nextSort,
  quantityLabel,
  sanitizeSearch,
  SORTABLE_COLUMNS,
  sortRows,
  withoutChip,
  ZONE_LABELS,
  type SearchCriteria,
  type SearchResultRow,
} from './search';

/**
 * La lógica pura de SRCH-01. Se prueba sin base ni React porque es donde viven
 * las decisiones que la pantalla luego solo pinta.
 *
 * Esta capa la escribe Claude Code, no el Coder (`CLAUDE.md` §3), así que estos
 * tests no son el contrato del arnés: son los míos. El contrato del arnés está en
 * `screens/search/*.test.tsx` y en `e2e/search.spec.ts`.
 */

const NOW = new Date('2026-08-11T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000).toISOString();

function row(over: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    partNumber: '6205-2RS',
    brand: 'SKF',
    quantity: 850,
    leadTimeDays: 3,
    orgId: 'b2000000-0000-4000-8000-000000000002',
    orgName: 'Nordwälz Lager',
    country: 'DE',
    lastUploadAt: hace(1),
    favoriteCount: 12,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

function criteria(over: Partial<SearchCriteria> = {}): SearchCriteria {
  return { ...EMPTY_CRITERIA, ...over };
}

// -----------------------------------------------------------------------------

describe('countryName · nombre completo, nunca el ISO', () => {
  it('traduce al idioma de sesión', () => {
    // `single-reference-search`: "el nombre completo del país en el idioma de
    // sesión del usuario (nunca código ISO)".
    expect(countryName('ES')).toBe('España');
    expect(countryName('DE')).toBe('Alemania');
    expect(countryName('IT')).toBe('Italia');
  });

  it('devuelve Francia, no France', () => {
    // La nota de la columna 7 de la spec escribe "España, Alemania, France...".
    // Es una errata del propio spec: su bloque "Datos de ejemplo" escribe
    // `Francia`, y eso es lo que da el CLDR de `es`. Manda el CLDR (F-024).
    expect(countryName('FR')).toBe('Francia');
  });

  it('aguanta un código vacío o desconocido sin romper la fila', () => {
    // `location_country` solo garantiza dos mayúsculas (`inventory_lines_country_chk`),
    // no que sean un país real. El contrato es: nunca lanza y nunca deja la celda
    // en blanco. No se fija QUÉ dice el CLDR de un código raro —`ZZ` es su código
    // oficial de "región desconocida" y tiene traducción propia—, solo que la
    // fila sobrevive.
    expect(countryName('')).toBe('');
    expect(() => countryName('ZZ')).not.toThrow();
    expect(countryName('ZZ')).not.toBe('');
  });
});

describe('quantityLabel · manda el CLDR, no el literal del mock', () => {
  it('no agrupa cuatro cifras en español', () => {
    // El mock escribe "1.200" en la fila 3. El CLDR de `es` no agrupa cuatro
    // cifras: son "1200". Misma trampa que el pie de INV-01 (F-024).
    expect(quantityLabel(1200)).toBe('1200');
    expect(quantityLabel(850)).toBe('850');
  });

  it('agrupa a partir de cinco', () => {
    expect(quantityLabel(12000)).toBe('12.000');
  });
});

describe('leadTimeLabel', () => {
  it('singular y plural', () => {
    expect(leadTimeLabel(1)).toBe('1 día');
    expect(leadTimeLabel(7)).toBe('7 días');
  });

  it('sin plazo publicado no es cero días', () => {
    expect(leadTimeLabel(null)).toBe('—');
  });
});

describe('metaCounterLabel', () => {
  it('lleva el umbral solo si hay chip de cantidad mínima', () => {
    expect(metaCounterLabel(5, 4, 500)).toBe('5 resultados · 4 con stock ≥ 500 u');
    expect(metaCounterLabel(5, 5, null)).toBe('5 resultados');
  });

  it('concuerda en singular', () => {
    expect(metaCounterLabel(1, 1, null)).toBe('1 resultado');
  });
});

describe('meetsMinQuantity · el color de la columna 4', () => {
  it('sin mínimo, ninguna fila está por debajo', () => {
    expect(meetsMinQuantity(20, null)).toBe(true);
  });

  it('el borde es "≥", no ">"', () => {
    // La metabarra dice "con stock ≥ 500 u": 500 exactas cuentan.
    expect(meetsMinQuantity(500, 500)).toBe(true);
    expect(meetsMinQuantity(499, 500)).toBe(false);
  });
});

// -----------------------------------------------------------------------------

describe('activeChips · derivados de los criterios, no estado propio', () => {
  it('sin filtros no hay chips', () => {
    expect(activeChips(EMPTY_CRITERIA)).toEqual([]);
  });

  it('el ejemplo de la spec §3, en el orden de su tabla', () => {
    const chips = activeChips(criteria({ partNumber: '6205-2RS', minQuantity: 500, zone: 'EU' }));
    expect(chips.map((c) => `${c.label}: ${c.value}`)).toEqual([
      'Ref: 6205-2RS',
      'Qty mín: 500 u',
      'Zona: Europa',
    ]);
  });

  it('zona y país comparten un solo chip', () => {
    const chips = activeChips(criteria({ zone: 'EU', country: 'ES' }));
    expect(chips).toHaveLength(1);
    expect(chips[0]!.value).toBe('Europa · España');
  });

  it('un país sin zona también pinta el chip', () => {
    expect(activeChips(criteria({ country: 'IT' }))[0]!.value).toBe('Italia');
  });

  it('una cantidad mínima de cero es un filtro, no la ausencia de uno', () => {
    // `0` es falsy y es justo donde un `if (c.minQuantity)` perdería el chip
    // dejando el filtro aplicado en la consulta: la tabla filtraría por algo que
    // no se ve. El campo es `number | null` por esto.
    expect(activeChips(criteria({ minQuantity: 0 }))).toHaveLength(1);
  });

  it('las etiquetas de zona cubren los siete continentes del CHECK', () => {
    expect(Object.keys(ZONE_LABELS)).toHaveLength(7);
    expect(ZONE_LABELS.AS).toBe('Asia');
  });
});

describe('withoutChip', () => {
  it('quitar el chip de zona se lleva zona y país, que son el mismo chip', () => {
    const c = withoutChip(criteria({ zone: 'EU', country: 'ES', brand: 'SKF' }), 'zone');
    expect(c.zone).toBeNull();
    expect(c.country).toBe('');
    expect(c.brand).toBe('SKF');
  });

  it('no muta los criterios de entrada', () => {
    const antes = criteria({ brand: 'SKF' });
    withoutChip(antes, 'brand');
    expect(antes.brand).toBe('SKF');
  });
});

// -----------------------------------------------------------------------------

describe('nextSort · el toggle de tres clics de la spec §3', () => {
  it('primer clic ascendente, segundo descendente, tercero al orden por defecto', () => {
    const uno = nextSort(null, 'brand');
    expect(uno).toEqual({ column: 'brand', direction: 'asc' });
    const dos = nextSort(uno, 'brand');
    expect(dos).toEqual({ column: 'brand', direction: 'desc' });
    expect(nextSort(dos, 'brand')).toBeNull();
  });

  it('cambiar de columna empieza el ciclo de nuevo', () => {
    expect(nextSort({ column: 'brand', direction: 'desc' }, 'quantity')).toEqual({
      column: 'quantity',
      direction: 'asc',
    });
  });

  it('el tercer clic sobre Cantidad devuelve null, no DEFAULT_SORT', () => {
    // El orden resultante coincide con el de por defecto, pero la cabecera tiene
    // que poder perder su indicador ↑/↓. Son dos cosas distintas.
    const desc = { column: 'quantity', direction: 'desc' } as const;
    expect(nextSort(desc, 'quantity')).toBeNull();
    expect(DEFAULT_SORT).toEqual(desc);
  });

  it('son seis columnas ordenables, ni una más', () => {
    // Checkbox, Referencia, Empresa y Acciones no lo son (spec §3).
    expect([...SORTABLE_COLUMNS]).toEqual(['brand', 'quantity', 'leadTime', 'country', 'age', 'favorites']);
  });
});

describe('sortRows', () => {
  it('sin orden explícito, cantidad descendente', () => {
    const rows = [row({ id: 'a', quantity: 200 }), row({ id: 'b', quantity: 1200 })];
    expect(sortRows(rows, null).map((r) => r.quantity)).toEqual([1200, 200]);
  });

  it('no muta el array de entrada', () => {
    const rows = [row({ id: 'a', quantity: 200 }), row({ id: 'b', quantity: 1200 })];
    sortRows(rows, { column: 'quantity', direction: 'asc' });
    expect(rows[0]!.quantity).toBe(200);
  });

  it('el país ordena por el nombre que se ve, no por el ISO', () => {
    // `AT` < `DE` por código; `Alemania` < `Austria` por nombre. Ordenar por el
    // código da una columna que se ve desordenada y no falla.
    const rows = [row({ id: 'a', country: 'AT' }), row({ id: 'b', country: 'DE' })];
    const orden = sortRows(rows, { column: 'country', direction: 'asc' });
    expect(orden.map((r) => countryName(r.country))).toEqual(['Alemania', 'Austria']);
  });

  it('la antigüedad ascendente es de más reciente a más viejo', () => {
    const rows = [row({ id: 'a', lastUploadAt: hace(9) }), row({ id: 'b', lastUploadAt: hace(1) })];
    expect(sortRows(rows, { column: 'age', direction: 'asc' }).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('una línea sin plazo publicado va al final en ascendente, no la primera', () => {
    const rows = [row({ id: 'a', leadTimeDays: null }), row({ id: 'b', leadTimeDays: 5 })];
    expect(sortRows(rows, { column: 'leadTime', direction: 'asc' }).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('desempata por id para que dos ordenaciones seguidas den lo mismo', () => {
    const rows = [
      row({ id: 'c', quantity: 100 }),
      row({ id: 'a', quantity: 100 }),
      row({ id: 'b', quantity: 100 }),
    ];
    const una = sortRows(rows, { column: 'quantity', direction: 'desc' }).map((r) => r.id);
    const otra = sortRows([...rows].reverse(), { column: 'quantity', direction: 'desc' }).map((r) => r.id);
    expect(una).toEqual(['a', 'b', 'c']);
    expect(otra).toEqual(una);
  });

  it('la marca ordena con la collation española', () => {
    const rows = [row({ id: 'a', brand: 'NSK' }), row({ id: 'b', brand: 'FAG' })];
    expect(sortRows(rows, { column: 'brand', direction: 'asc' }).map((r) => r.brand)).toEqual(['FAG', 'NSK']);
  });
});

describe('sanitizeSearch', () => {
  it('conserva guiones y barras: son parte de la referencia', () => {
    expect(sanitizeSearch(' 6205-2RS/C3 ')).toBe('6205-2RS/C3');
  });

  it('se lleva los separadores del mini-lenguaje de PostgREST', () => {
    expect(sanitizeSearch('6205,2RS')).toBe('62052RS');
  });
});

describe('consultSummary · GAP-004, el literal de "Consultar Seleccionados" ejecutado', () => {
  it('cuenta DISTRIBUIDORES, no líneas: dos filas de uno mismo son un distribuidor', () => {
    const resultado = consultSummary([
      { distributorOrgId: 'org-a', ok: true },
      { distributorOrgId: 'org-a', ok: true },
    ]);
    expect(resultado).toBe(
      'Consultas enviadas a 1 distribuidor. Las respuestas llegarán a tu bandeja de Hilos.',
    );
  });

  it('el literal es VERBATIM el de Rinworld_spec_SRCH-01.md, con dos o más en plural', () => {
    const resultado = consultSummary([
      { distributorOrgId: 'org-a', ok: true },
      { distributorOrgId: 'org-b', ok: true },
    ]);
    expect(resultado).toBe(
      'Consultas enviadas a 2 distribuidores. Las respuestas llegarán a tu bandeja de Hilos.',
    );
  });

  it('un fallo parcial se dice, no se tapa detrás del mensaje de éxito (F-023)', () => {
    const resultado = consultSummary([
      { distributorOrgId: 'org-a', ok: true },
      { distributorOrgId: 'org-b', ok: false, error: 'Límite diario alcanzado' },
    ]);
    expect(resultado).toMatch(/^Consultas enviadas a 1 distribuidor\./);
    expect(resultado).toMatch(/1 consulta no se pudo enviar: Límite diario alcanzado/);
  });

  it('todo fallado no dice "enviadas a 0 distribuidores": esa frase mentiría', () => {
    const resultado = consultSummary([{ distributorOrgId: 'org-a', ok: false, error: 'sin clave publicada' }]);
    expect(resultado).not.toMatch(/enviadas a 0/i);
    expect(resultado).toMatch(/1 consulta no se pudo enviar: sin clave publicada/);
  });

  it('dos fallos con el mismo motivo no lo repiten dos veces', () => {
    const resultado = consultSummary([
      { distributorOrgId: 'org-a', ok: false, error: 'Límite diario alcanzado' },
      { distributorOrgId: 'org-b', ok: false, error: 'Límite diario alcanzado' },
    ]);
    expect(resultado).toBe('2 consultas no se pudieron enviar: Límite diario alcanzado');
  });
});
