import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchPage, SearchQuery } from './search';

/**
 * PARCIALES · conversational-search/batch-search#1, escrito desde la spec.
 *
 *   GIVEN un miembro que pega una lista de referencias en distintos formatos mezclados
 *   WHEN  VERA procesa la lista
 *   THEN  interpreta correctamente todas las referencias sin requerir reformateo
 *   AND   el tiempo total de respuesta para 50 referencias no supera los 5 segundos
 *
 * El unit no puede medir los 5 s contra la base real. Lo que sí puede probar es la parte que
 * es de este código: que 50 referencias de formatos mezclados salen enteras y en orden, y que la
 * orquestación las lanza con concurrencia (no una tras otra), de modo que el tiempo total es
 * ~ (50 / concurrencia) x latencia de UNA consulta y no 50 x latencia.
 */

const fetchResults = vi.fn<(q: SearchQuery) => Promise<SearchPage>>();
vi.mock('./search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search')>()),
  fetchResults: (q: SearchQuery) => fetchResults(q),
}));

const { parseReferences, fetchBatchResults, MAX_BATCH } = await import('./batch');

beforeEach(() => {
  fetchResults.mockReset();
});

describe('conversational-search/batch-search', () => {
  it('conversational-search/batch-search#1 · 50 referencias pegadas con comas, tabulaciones, saltos de línea y punto y coma se interpretan todas, y se buscan en paralelo', async () => {
    // 50 referencias distintas; el separador rota entre los formatos de la spec
    const refs = Array.from({ length: 50 }, (_, i) => `REF-${String(i + 1).padStart(2, '0')}/C3`);
    const separadores = [',', '\t', '\n', ';', '\r\n', ', ', '\t\t'];
    const pegado = refs.map((r, i) => r + (i < 49 ? separadores[i % separadores.length] : '')).join('');

    // THEN 1: todas, sin reformatear, en su orden
    const parseadas = parseReferences(pegado);
    expect(parseadas).toHaveLength(50);
    expect(parseadas).toEqual(refs);
    expect(parseadas.length).toBeLessThanOrEqual(MAX_BATCH);

    // THEN 2: se lanzan a la vez (acotado), no en serie
    let enVuelo = 0;
    let maxEnVuelo = 0;
    const LATENCIA_MS = 40;
    fetchResults.mockImplementation(async () => {
      enVuelo++;
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      await new Promise((r) => setTimeout(r, LATENCIA_MS));
      enVuelo--;
      return { rows: [], total: 0, capped: false } satisfies SearchPage;
    });

    const t0 = Date.now();
    const out = await fetchBatchResults(parseadas, { orgId: 'org-a', memberId: 'm-a' });
    const ms = Date.now() - t0;

    expect(out.map((r) => r.reference)).toEqual(refs);
    expect(out.every((r) => r.error === null && r.page !== null)).toBe(true);
    expect(fetchResults).toHaveBeenCalledTimes(50);
    expect(maxEnVuelo).toBeGreaterThan(1);
    // en serie serían 50 x 40 = 2000 ms; en paralelo acotado, bastante menos
    expect(ms).toBeLessThan(50 * LATENCIA_MS * 0.6);
  });
});
