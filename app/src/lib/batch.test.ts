import { describe, expect, it, vi } from 'vitest';
import type { SearchPage, SearchResultRow } from './search';

const fetchResults = vi.fn();
vi.mock('./search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search')>()),
  fetchResults: (q: unknown) => fetchResults(q),
}));

const {
  batchMetaLabel,
  BATCH_CONCURRENCY,
  buildSummaryCsv,
  cardHeaderLabel,
  fetchBatchResults,
  hasNoResults,
  hasStock,
  MAX_BATCH,
  overLimitNotice,
  parseReferences,
  referenceCounterLabel,
  splitBatch,
  summarizeRows,
  summaryFileName,
  SUMMARY_CSV_HEADER,
} = await import('./batch');
type BatchResult = import('./batch').BatchResult;

/**
 * La lógica pura de SRCH-02, y la orquestación de `fetchBatchResults` con
 * `fetchResults` mockeado. Esta capa la escribe Claude Code, no el Coder
 * (`CLAUDE.md` §3): estos tests **no son el contrato del arnés**.
 */

function fila(over: Partial<SearchResultRow>): SearchResultRow {
  return {
    id: 'l1',
    partNumber: '6205-2RS',
    brand: 'NSK',
    quantity: 100,
    leadTimeDays: null,
    orgId: 'o1',
    orgName: 'Org',
    country: 'DE',
    lastUploadAt: '2026-09-20T00:00:00Z',
    favoriteCount: 0,
    isFavorite: false,
    consulted: false,
    ...over,
  };
}

const pagina = (rows: SearchResultRow[]): SearchPage => ({ rows, total: rows.length, capped: false });
const res = (reference: string, rows: SearchResultRow[] | null, error: string | null = null): BatchResult => ({
  reference,
  page: rows ? pagina(rows) : null,
  error,
});

describe('parseReferences · tolerante a formato', () => {
  it('una por línea, con CRLF de Windows', () => {
    expect(parseReferences('6205-2RS\r\nNU2210-E-TVP2\n22316-E')).toEqual(['6205-2RS', 'NU2210-E-TVP2', '22316-E']);
  });

  it('separadas por comas, puntos y comas y tabulaciones (pegado desde Excel)', () => {
    expect(parseReferences('6205-2RS, 6308-ZZ;22316-E\t7210-BECBP')).toEqual(['6205-2RS', '6308-ZZ', '22316-E', '7210-BECBP']);
  });

  it('formato mixto en la misma lista', () => {
    expect(parseReferences('A1,B2\nC3\tD4;E5\r\nF6')).toEqual(['A1', 'B2', 'C3', 'D4', 'E5', 'F6']);
  });

  it('el espacio NO separa: una referencia con espacios sigue entera', () => {
    expect(parseReferences('NU 2210 E\n6205-2RS')).toEqual(['NU 2210 E', '6205-2RS']);
  });

  it('descarta vacías y recorta', () => {
    expect(parseReferences('  A1  \n\n , ,\t\n B2 ')).toEqual(['A1', 'B2']);
    expect(parseReferences('   \n')).toEqual([]);
  });

  it('quita duplicados sin distinguir mayúsculas y conserva el orden', () => {
    expect(parseReferences('6205-2rs\n6308-ZZ\n6205-2RS')).toEqual(['6205-2rs', '6308-ZZ']);
  });

  it('conserva las barras y guiones de una referencia real', () => {
    expect(parseReferences('6205-2RS/C3')).toEqual(['6205-2RS/C3']);
  });
});

describe('tope de 50', () => {
  const muchas = Array.from({ length: 73 }, (_, i) => `R-${i}`);

  it('splitBatch reparte las primeras 50 y el resto', () => {
    const { now, rest } = splitBatch(muchas);
    expect(MAX_BATCH).toBe(50);
    expect(now).toHaveLength(50);
    expect(rest).toHaveLength(23);
    expect(now[0]).toBe('R-0');
    expect(rest[0]).toBe('R-50');
  });

  it('con 50 o menos no hay resto', () => {
    expect(splitBatch(muchas.slice(0, 50)).rest).toEqual([]);
    expect(splitBatch([]).now).toEqual([]);
  });

  it('el contador y el aviso literales de la spec', () => {
    expect(referenceCounterLabel(0)).toBe('0 / 50 referencias');
    expect(referenceCounterLabel(5)).toBe('5 / 50 referencias');
    expect(overLimitNotice(73)).toBe(
      'Tu lista tiene 73 referencias. Procesaremos las primeras 50. ¿Quieres continuar con el resto en una segunda tanda?',
    );
  });
});

describe('resumen por referencia', () => {
  it('cuenta distribuidores DISTINTOS y toma la mayor cantidad con su marca y país', () => {
    const rows = [
      fila({ id: 'a', orgId: 'o1', quantity: 1200, brand: 'NSK', country: 'de' }),
      fila({ id: 'b', orgId: 'o1', quantity: 300, brand: 'FAG', country: 'ES' }),
      fila({ id: 'c', orgId: 'o2', quantity: 450, brand: 'SKF', country: 'FR' }),
    ];
    expect(summarizeRows(rows)).toEqual({ distributors: 2, maxQuantity: 1200, maxBrand: 'NSK', maxCountry: 'DE' });
  });

  it('sin filas: cero distribuidores y nada más', () => {
    expect(summarizeRows([])).toEqual({ distributors: 0, maxQuantity: null, maxBrand: null, maxCountry: null });
  });

  it('cardHeaderLabel: el ejemplo de la spec, y 1200 SIN separador de miles (F-024)', () => {
    const rows = [fila({ orgId: 'o1', quantity: 1200 }), fila({ id: 'b', orgId: 'o2', quantity: 5 })];
    expect(cardHeaderLabel(res('6205-2RS', rows))).toBe('Distribuidores: 2 · Máx: 1200 u (NSK, DE)');
    expect(cardHeaderLabel(res('X', [fila({ quantity: 12500 })]))).toBe('Distribuidores: 1 · Máx: 12.500 u (NSK, DE)');
  });

  it('sin resultados, y una consulta fallida NO se confunde con ello', () => {
    expect(cardHeaderLabel(res('6308-ZZ', []))).toBe('Sin resultados');
    expect(cardHeaderLabel(res('6308-ZZ', null, 'boom'))).toBe('No se pudo consultar');
    expect(hasNoResults(res('a', []))).toBe(true);
    expect(hasNoResults(res('a', null, 'boom'))).toBe(false);
    expect(hasStock(res('a', null, 'boom'))).toBe(false);
  });
});

describe('metabarra global', () => {
  it('«5 referencias · 4 con stock · 1 sin resultados» (spec §3)', () => {
    const r = [
      res('a', [fila({})]),
      res('b', [fila({})]),
      res('c', [fila({})]),
      res('d', []),
      res('e', [fila({})]),
    ];
    expect(batchMetaLabel(r)).toBe('5 referencias · 4 con stock · 1 sin resultados');
  });

  it('singular, y las consultas fallidas no cuentan ni como con stock ni como sin resultados', () => {
    expect(batchMetaLabel([res('a', [fila({})])])).toBe('1 referencia · 1 con stock · 0 sin resultados');
    expect(batchMetaLabel([res('a', null, 'x'), res('b', [])])).toBe('2 referencias · 0 con stock · 1 sin resultados');
  });
});

describe('Exportar resumen (CSV)', () => {
  it('cabecera, una fila por referencia en orden, y el país con su nombre en español', () => {
    const csv = buildSummaryCsv([
      res('6205-2RS', [fila({ orgId: 'o1', quantity: 1200, country: 'DE' }), fila({ id: 'b', orgId: 'o2', quantity: 5, country: 'ES' })]),
      res('6308-ZZ', []),
    ]);
    expect(csv).toBe(`${SUMMARY_CSV_HEADER}\n6205-2RS,2,1200,Alemania\n6308-ZZ,0,,\n`);
  });

  it('escapa comas y comillas de una referencia', () => {
    const csv = buildSummaryCsv([res('A,"B"', [])]);
    expect(csv.split('\n')[1]).toBe('"A,""B""",0,,');
  });

  it('el nombre del fichero lleva la fecha local', () => {
    expect(summaryFileName(new Date(2026, 8, 4))).toBe('resumen-busqueda-por-lotes-2026-09-04.csv');
  });
});

describe('fetchBatchResults', () => {
  it('busca cada referencia por su part_number, en el orden de la lista', async () => {
    fetchResults.mockReset().mockImplementation(async (q: { criteria: { partNumber: string } }) =>
      pagina([fila({ partNumber: q.criteria.partNumber })]),
    );
    const out = await fetchBatchResults(['A1', 'B2', 'C3'], { orgId: 'me', memberId: 'm1' });
    expect(out.map((r) => r.reference)).toEqual(['A1', 'B2', 'C3']);
    expect(fetchResults).toHaveBeenCalledTimes(3);
    expect(fetchResults.mock.calls.map((c) => c[0].criteria.partNumber).sort()).toEqual(['A1', 'B2', 'C3']);
    expect(fetchResults.mock.calls[0]![0]).toMatchObject({ orgId: 'me', memberId: 'm1' });
  });

  it('un fallo en una referencia no tumba las demás', async () => {
    fetchResults.mockReset().mockImplementation(async (q: { criteria: { partNumber: string } }) => {
      if (q.criteria.partNumber === 'B2') throw new Error('boom');
      return pagina([]);
    });
    const out = await fetchBatchResults(['A1', 'B2', 'C3'], { orgId: 'me', memberId: 'm1' });
    expect(out[0]).toMatchObject({ reference: 'A1', error: null });
    expect(out[1]).toMatchObject({ reference: 'B2', page: null, error: 'boom' });
    expect(out[2]).toMatchObject({ reference: 'C3', error: null });
  });

  it('respeta la concurrencia máxima', async () => {
    let vivas = 0;
    let pico = 0;
    fetchResults.mockReset().mockImplementation(async () => {
      vivas++;
      pico = Math.max(pico, vivas);
      await new Promise((r) => setTimeout(r, 5));
      vivas--;
      return pagina([]);
    });
    await fetchBatchResults(Array.from({ length: 20 }, (_, i) => `R${i}`), { orgId: 'me', memberId: 'm1' });
    expect(pico).toBeLessThanOrEqual(BATCH_CONCURRENCY);
    expect(pico).toBeGreaterThan(1);
  });

  it('sin referencias no llama a nada', async () => {
    fetchResults.mockReset();
    expect(await fetchBatchResults([], { orgId: 'me', memberId: 'm1' })).toEqual([]);
    expect(fetchResults).not.toHaveBeenCalled();
  });
});
