import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberProfile } from './session';
import type { ToolContext } from './vera-tools';

/**
 * PARCIALES · conversational-search/single-reference-search#3, escrito desde la spec.
 *
 *   GIVEN una búsqueda que no devuelve ninguna línea con los filtros actuales
 *   WHEN  VERA presenta el resultado
 *   THEN  ofrece al menos una alternativa activa: ampliar región, relajar filtros,
 *         o crear un watcher con los criterios actuales
 *   AND   nunca responde solo con la ausencia de resultados sin alternativa
 *
 * El modelo real no se llama (CLAUDE.md §5). Lo que se puede probar sin él es lo que VERA
 * RECIBE cuando no hay filas: el retorno de la herramienta y las instrucciones del sistema
 * le dicen que tiene que proponer qué filtro quitar. Que el modelo lo cumpla queda para
 * `vera.real.test.ts` D2 (integración, sin asertos hoy).
 */

const PERFIL: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.io',
  fullName: 'Alpha Uno',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Alpha Rodamientos',
  orgCountry: 'ES',
};

const fetchOffers = vi.fn();
const fetchPartKeys = vi.fn();
vi.mock('./part-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('./part-search')>();
  return {
    ...original,
    fetchPartKeys: (...a: unknown[]) => fetchPartKeys(...a),
    fetchOffers: (...a: unknown[]) => fetchOffers(...a),
  };
});

/** Lista previa con una sola clave, la exacta de lo pedido: así la herramienta pide sus ofertas. */
async function listaPreviaExacta(c: { ref: string }) {
  const { normalizeRef } = await import('./part-search');
  const key = normalizeRef(c.ref);
  return { keys: [{ key, offers: 1 }], totalKeys: 1, totalOffers: 1, matchedRef: key, truncated: false, page: 1, pageCount: 1 };
}

const { runTool } = await import('./vera-tools');

const ctx = (): ToolContext => ({
  profile: PERFIL,
  navigate: () => {},
  setCriteria: () => {},
  threadOpen: false,
  prepareDraft: () => {},
});

beforeEach(() => {
  fetchOffers.mockReset();
  fetchPartKeys.mockReset().mockImplementation(listaPreviaExacta);
});

describe('conversational-search/single-reference-search', () => {
  it('conversational-search/single-reference-search#3 · sin filas, lo que recibe VERA dice que no hay nada Y le manda proponer qué filtro quitar', async () => {
    // Caso 1.4 de la búsqueda en dos fases (25-oct-2026): ninguna clave.
    fetchPartKeys.mockResolvedValue({ keys: [], totalKeys: 0, totalOffers: 0, matchedRef: null, truncated: false, page: 1, pageCount: 1 });

    const r = await runTool(
      'buscar_en_catalogo',
      { referencia: '6204-ZZ', marca: 'Timken', zona: 'OC' },
      ctx(),
    );

    expect(r.isError).toBe(false);
    // dice la ausencia con todas las letras (no devuelve un vacío ambiguo)...
    expect(r.content).toMatch(/^Ninguna referencia empieza por «6204ZZ» con estos filtros: no hay ofertas que enseñar\./m);
    // ...y no deja a VERA con solo eso: la instrucción de alternativa va en el mismo retorno
    expect(r.content).toContain('propón qué cambiar: quitar la zona o el país, quitar otros filtros si los hay, o revisar la referencia');
    expect(fetchOffers).not.toHaveBeenCalled();
    // los filtros que causaron el vacío le llegan, para que pueda decir cuál relajar
    expect(r.content).toContain('6204-ZZ');
    expect(r.content).toContain('Timken');
  });

  it('conversational-search/single-reference-search#3 · las instrucciones de VERA lo repiten: sin resultados se dice y se propone qué filtro quitar', () => {
    const sistema = readFileSync(resolve(process.cwd(), '..', 'supabase', 'functions', 'vera', 'index.ts'), 'utf8');
    expect(sistema).toMatch(/que no hay ningún resultado —y entonces propones qué filtro quitar/);
  });
});
