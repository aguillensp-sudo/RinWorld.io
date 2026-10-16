import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import { EMPTY_CRITERIA, MAX_RESULTS, type SearchCriteria } from './search';
import { describeCriteria, describeManualChanges, removedFilters, runTool, type InventoryView, type ToolContext } from './vera-tools';

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

describe('describeManualChanges · lo que el usuario tocó a mano (F-258, B2)', () => {
  const vera = { ...EMPTY_CRITERIA, partNumber: '6204', zone: 'EU' as const, brand: 'SKF' };

  it('sin cambios, o sin una de las dos, no dice nada', () => {
    expect(describeManualChanges(vera, { ...vera })).toBeNull();
    expect(describeManualChanges(null, vera)).toBeNull();
    expect(describeManualChanges(vera, null)).toBeNull();
  });

  it('distingue quitado, añadido y cambiado, con los nombres y en el orden de los parámetros', () => {
    expect(describeManualChanges(vera, { ...vera, zone: null, brand: 'FAG', minQuantity: 500 })).toBe(
      'cambió marca=SKF por marca=FAG; añadió cantidad_minima=500; quitó zona=EU',
    );
  });
});

describe('buscar_en_catalogo · no repone un filtro que el usuario quitó a mano (F-258, B2; PO, 15-oct)', () => {
  const vera: SearchCriteria = { ...EMPTY_CRITERIA, partNumber: '6204', zone: 'EU', brand: 'SKF' };
  const conQuitados = (vivos: SearchCriteria): ToolContext => {
    const criterios: unknown[] = [];
    return { ...contexto(), setCriteria: (c) => criterios.push(c), removedFilters: removedFilters(vera, vivos), _criterios: criterios } as ToolContext;
  };

  it('removedFilters: lo quitado y lo sustituido, con el valor que ya no quiere; lo añadido no', () => {
    expect(removedFilters(vera, { ...vera, zone: null, brand: 'FAG', minQuantity: 500 })).toEqual([
      { param: 'marca', value: 'SKF' },
      { param: 'zona', value: 'EU' },
    ]);
    expect(removedFilters(vera, vera)).toEqual([]);
    expect(removedFilters(null, vera)).toEqual([]);
  });

  it('si vuelve a poner la zona quitada, NO busca ni mueve la pantalla, y dice qué hacer', async () => {
    const ctx = conQuitados({ ...vera, zone: null });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', marca: 'FAG' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content).toContain('NO se ha buscado: vuelves a poner zona=EU');
    expect(r.content).toContain('confirmar_filtros_quitados: true');
    expect((ctx as unknown as { _criterios: unknown[] })._criterios).toEqual([]);
    expect(fetchResults).not.toHaveBeenCalled();
  });

  it('sin ese filtro, busca con normalidad', async () => {
    const ctx = conQuitados({ ...vera, zone: null });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', marca: 'FAG' }, ctx);
    expect(r.isError).toBe(false);
    expect(fetchResults).toHaveBeenCalledTimes(1);
  });

  it('con confirmar_filtros_quitados (el usuario lo pidió), lo repone', async () => {
    const ctx = conQuitados({ ...vera, zone: null });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', confirmar_filtros_quitados: true }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain('filtros puestos: referencia=6204 · zona=EU');
  });

  it('otra zona distinta de la quitada no es reponer: busca', async () => {
    const ctx = conQuitados({ ...vera, zone: null });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'AS' }, ctx);
    expect(r.isError).toBe(false);
  });

  it('una marca sustituida a mano tampoco se repone sin confirmar, aunque cambie la mayúscula', async () => {
    const ctx = conQuitados({ ...vera, brand: 'FAG' });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', marca: 'skf' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content).toContain('marca=SKF');
  });

  it('tools.json declara el parámetro y lo limita a una petición del último mensaje', () => {
    const p = tools.find((t) => t.name === 'buscar_en_catalogo')!.input_schema.properties.confirmar_filtros_quitados!;
    expect(p.type).toBe('boolean');
    expect(p.description).toContain('EN SU ÚLTIMO MENSAJE');
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

  // 16-oct-2026: la pantalla ordena por antigüedad; VERA sigue pidiendo por cantidad y se le dice.
  it('pide las filas por cantidad y le avisa de que la tabla del usuario va por antigüedad', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    expect(fetchResults).toHaveBeenCalledWith(expect.objectContaining({ orden: 'cantidad' }));
    expect(r.content).toContain('Estas filas te llegan ordenadas por cantidad');
    expect(r.content).toContain('La tabla del usuario las ordena por antigüedad');
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

  // F-258: contestó seis veces «91 resultados, se muestran 25», y la tabla los enseña todos.
  it('con más filas de las que ve el modelo, le dice que la tabla las enseña todas', async () => {
    fetchResults.mockResolvedValueOnce({ rows: Array.from({ length: 30 }, (_, i) => ({ ...FILA, id: `l${i}` })), total: 91, capped: false });
    const r = await runTool('buscar_en_catalogo', { referencia: '6205' }, contexto());
    expect(r.content).toContain('La tabla de Comprando le enseña al usuario TODAS estas coincidencias');
    expect(r.content).toContain('No le digas que en pantalla se muestran 25');
  });

  it('si ve todas las filas, no añade esa aclaración', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    expect(r.content).toContain('ha llevado al usuario');
    expect(r.content).not.toContain('le enseña al usuario TODAS');
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
