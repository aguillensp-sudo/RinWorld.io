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

const fetchResults = vi.fn();
vi.mock('./search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search')>()),
  fetchResults: (...a: unknown[]) => fetchResults(...a),
}));

const { runTool } = await import('./vera-tools');

const ctx = (): ToolContext => ({
  profile: PERFIL,
  navigate: () => {},
  setCriteria: () => {},
  threadOpen: false,
  prepareDraft: () => {},
});

beforeEach(() => {
  fetchResults.mockReset();
});

describe('conversational-search/single-reference-search', () => {
  it('conversational-search/single-reference-search#3 · sin filas, lo que recibe VERA dice que no hay nada Y le manda proponer qué filtro quitar', async () => {
    fetchResults.mockResolvedValue({ rows: [], total: 0, capped: false });

    const r = await runTool(
      'buscar_en_catalogo',
      { referencia: '6204-ZZ', marca: 'Timken', zona: 'OC' },
      ctx(),
    );

    expect(r.isError).toBe(false);
    // dice la ausencia con todas las letras (no devuelve un vacío ambiguo)...
    expect(r.content).toMatch(/^Ninguna coincidencia\./m);
    // ...y no deja a VERA con solo eso: la instrucción de alternativa va en el mismo retorno
    expect(r.content).toMatch(/no hay resultados \(entonces propón qué filtro quitar\)/);
    // los filtros que causaron el vacío le llegan, para que pueda decir cuál relajar
    expect(r.content).toContain('6204-ZZ');
    expect(r.content).toContain('Timken');
  });

  it('conversational-search/single-reference-search#3 · las instrucciones de VERA lo repiten: sin resultados se dice y se propone qué filtro quitar', () => {
    const sistema = readFileSync(resolve(process.cwd(), '..', 'supabase', 'functions', 'vera', 'index.ts'), 'utf8');
    expect(sistema).toMatch(/que no hay ningún resultado —y entonces propones qué filtro quitar/);
  });
});
