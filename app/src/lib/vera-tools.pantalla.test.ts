import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import { EMPTY_CRITERIA, MAX_RESULTS } from './search';
import { describeCriteria, runTool, type InventoryView, type ToolContext } from './vera-tools';

/**
 * Cuando la pantalla ya enseña la respuesta, VERA no la repite (decisiones del PO del 14-oct-2026,
 * `DECISIONES-V1.md`). Aquí se prueba lo que le dicen las herramientas al modelo y qué pantalla mueven;
 * si el modelo hace caso solo lo dice una llamada real. La capa de datos va mockeada (`CLAUDE.md` §5).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const tools = JSON.parse(readFileSync(resolve(aqui, '../../../supabase/functions/vera/tools.json'), 'utf8')) as {
  name: string;
  description: string;
  input_schema: { properties: Record<string, { type: string; description: string }> };
}[];

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
const fetchPage = vi.fn();
const fetchThreadPage = vi.fn();

vi.mock('./search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search')>()),
  fetchResults: (...a: unknown[]) => fetchResults(...a),
}));
vi.mock('./inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./inventory')>()),
  fetchPage: (...a: unknown[]) => fetchPage(...a),
}));
vi.mock('./threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./threads')>()),
  fetchThreadPage: (...a: unknown[]) => fetchThreadPage(...a),
}));

let vistas: InventoryView[] = [];

function contexto(conInventario = true): ToolContext {
  return {
    profile: PERFIL,
    navigate: () => {},
    setCriteria: () => {},
    threadOpen: false,
    prepareDraft: () => {},
    ...(conInventario ? { showInventory: (v: InventoryView) => vistas.push(v) } : {}),
  };
}

const FILA = {
  id: 'line-1',
  partNumber: '6204-2RS',
  brand: 'SKF',
  quantity: 1200,
  leadTimeDays: 5,
  orgId: 'org-nsk',
  orgName: 'NSK Europe Ltd',
  country: 'DE',
  lastUploadAt: '2026-10-12T10:00:00Z',
  favoriteCount: 0,
  isFavorite: false,
  consulted: false,
};

const LINEA = {
  id: 'inv-1',
  partNumber: '6204',
  brand: 'FAG',
  quantity: 40,
  status: 'PUBLISHED',
  lastUploadAt: '2026-09-01T10:00:00Z',
};

beforeEach(() => {
  vistas = [];
  fetchResults.mockReset();
  fetchPage.mockReset();
  fetchThreadPage.mockReset();
  fetchResults.mockResolvedValue({ rows: [FILA], total: 1, capped: false });
  fetchPage.mockResolvedValue({ lines: [LINEA], total: 1 });
  fetchThreadPage.mockResolvedValue({ threads: [], total: 0 });
});

describe('describeCriteria · los filtros de Comprando dichos con los nombres de los parámetros', () => {
  it('sin filtros dice "ninguno"', () => {
    expect(describeCriteria(EMPTY_CRITERIA)).toBe('ninguno');
  });

  it('con todos, en el orden de la herramienta y con los códigos que ella acepta', () => {
    expect(
      describeCriteria({
        partNumber: '6204-2RS',
        brand: 'SKF',
        minQuantity: 500,
        zone: 'EU',
        country: 'ES',
        maxLeadTimeDays: 14,
      }),
    ).toBe('referencia=6204-2RS · marca=SKF · cantidad_minima=500 · zona=EU · pais=ES · plazo_maximo_dias=14');
  });

  it('cada nombre que usa es un parámetro real de buscar_en_catalogo', () => {
    const props = Object.keys(tools.find((t) => t.name === 'buscar_en_catalogo')!.input_schema.properties);
    for (const p of ['referencia', 'marca', 'cantidad_minima', 'zona', 'pais', 'plazo_maximo_dias']) {
      expect(props).toContain(p);
    }
  });
});

describe('buscar_en_catalogo · la pantalla es la respuesta', () => {
  it('le dice qué filtros ha puesto y que NO repita las filas', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204-2RS', zona: 'EU' }, contexto());
    expect(r.isError).toBe(false);
    expect(r.content).toContain('filtros puestos: referencia=6204-2RS · zona=EU');
    expect(r.content).toContain('NO repitas las filas');
    // Las filas siguen llegando: las necesita si el usuario pregunta por ellas después.
    expect(r.content).toContain('NSK Europe Ltd');
  });

  it('ya no le pide que cuente la búsqueda (la regla vieja, sustituida el 14-oct)', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    expect(r.content).toContain('ha llevado al usuario a la pantalla Comprando');
    expect(r.content).not.toContain('dilo en tu respuesta, porque acaba de cambiar de pantalla');
  });

  it(`con más de ${MAX_RESULTS}, le dice que la pantalla solo enseña los primeros`, async () => {
    fetchResults.mockResolvedValueOnce({ rows: [FILA], total: 640, capped: true });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    expect(r.content).toContain(`solo enseña los ${MAX_RESULTS} primeros de estos 640`);
  });

  it('sin recorte, no lo menciona', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    // Ancla positiva en el mismo `it` (F-074).
    expect(r.content).toContain('ha llevado al usuario');
    expect(r.content).not.toContain('solo enseña los');
  });
});

describe('consultar_mi_inventario · solo mueve la pantalla cuando la respuesta es una lista', () => {
  it('con mostrar_en_pantalla, lleva a Inventario con el mismo filtro y búsqueda que ha consultado', async () => {
    const r = await runTool(
      'consultar_mi_inventario',
      { filtro: 'desactualizados', referencia: '6204', mostrar_en_pantalla: true },
      contexto(),
    );
    expect(vistas).toEqual([{ filter: 'desactualizados', search: '6204' }]);
    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ filter: 'desactualizados', search: '6204' }));
    expect(r.content).toContain('ha llevado al usuario a la pantalla Inventario');
    expect(r.content).toContain('NO las repitas');
  });

  it('sin él (un número, un sí o un no), la pantalla no se mueve y el texto es la respuesta', async () => {
    const r = await runTool('consultar_mi_inventario', { referencia: '6204', filtro: 'publicados' }, contexto());
    expect(r.isError).toBe(false);
    expect(vistas).toEqual([]);
    expect(r.content).toContain('La pantalla no se ha movido');
  });

  it('un "true" escrito como cadena no cuenta: solo el booleano mueve la pantalla', async () => {
    await runTool('consultar_mi_inventario', { mostrar_en_pantalla: 'true' }, contexto());
    expect(vistas).toEqual([]);
  });

  it('si no hay cómo abrir Inventario, lo dice en vez de prometerlo', async () => {
    const r = await runTool('consultar_mi_inventario', { mostrar_en_pantalla: true }, contexto(false));
    expect(r.content).toContain('No se ha podido abrir Inventario');
    expect(r.content).not.toContain('ha llevado al usuario');
  });

  it('con un filtro que no existe, no mueve nada', async () => {
    const r = await runTool('consultar_mi_inventario', { filtro: 'caducados', mostrar_en_pantalla: true }, contexto());
    expect(r.isError).toBe(true);
    expect(vistas).toEqual([]);
  });

  it('tools.json declara el parámetro como booleano y explica cuándo usarlo', () => {
    const p = tools.find((t) => t.name === 'consultar_mi_inventario')!.input_schema.properties.mostrar_en_pantalla!;
    expect(p.type).toBe('boolean');
    expect(p.description).toContain('LISTA');
  });
});

describe('listar_mis_hilos · no mueve la pantalla, así que el texto es la respuesta, breve', () => {
  it('se lo dice', async () => {
    const r = await runTool('listar_mis_hilos', {}, contexto());
    expect(r.content).toContain('tu respuesta es lo único que verá');
  });
});

describe('buscar_en_catalogo · afinar es mandar todos los filtros', () => {
  it('tools.json dice que cada llamada sustituye los filtros de Comprando', () => {
    expect(tools.find((t) => t.name === 'buscar_en_catalogo')!.description).toContain('SUSTITUYE todos los filtros');
  });
});
