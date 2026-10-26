import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import { initialPartCriteria, type PartKeysPage, type PartSearchCriteria } from './part-search';
import { describeCriteria, describeManualChanges, removedFilters, runTool, type InventoryView, type ToolContext } from './vera-tools';

/**
 * Cuando la pantalla ya enseña la respuesta, VERA no la repite (decisiones del PO del 14-oct-2026,
 * `DECISIONES-V1.md`). Aquí se prueba lo que le dicen las herramientas al modelo y qué pantalla mueven;
 * si el modelo hace caso solo lo dice una llamada real. La capa de datos va mockeada (`CLAUDE.md` §5).
 *
 * Desde el 25-oct-2026 `buscar_en_catalogo` va en dos fases (`amend-srch01-busqueda-en-dos-fases`): devuelve la
 * lista previa de claves y, si existe la referencia exacta, sus ofertas.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const tools = JSON.parse(readFileSync(resolve(aqui, '../../../supabase/functions/vera/tools.json'), 'utf8')) as {
  name: string;
  description: string;
  input_schema: { properties: Record<string, { type: string; description: string }>; required?: string[] };
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

const fetchPartKeys = vi.fn();
const fetchOffers = vi.fn();
const fetchPage = vi.fn();
const fetchThreadPage = vi.fn();

vi.mock('./part-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./part-search')>()),
  fetchPartKeys: (...a: unknown[]) => fetchPartKeys(...a),
  fetchOffers: (...a: unknown[]) => fetchOffers(...a),
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
let criterios: PartSearchCriteria[] = [];

function contexto(conInventario = true): ToolContext {
  return {
    profile: PERFIL,
    navigate: () => {},
    setCriteria: (c) => criterios.push(c),
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

/** La lista previa de «6204» en producción el 25-oct-2026 (como ALPHA), recortada a cinco claves. */
function lista(over: Partial<PartKeysPage> = {}): PartKeysPage {
  return {
    keys: [
      { key: '62042RS', offers: 11 },
      { key: '6204', offers: 8 },
      { key: '6204ZZ', offers: 8 },
      { key: '6204C3', offers: 7 },
      { key: '6204C4', offers: 6 },
    ],
    totalKeys: 5,
    totalOffers: 40,
    matchedRef: '6204',
    truncated: false,
    page: 1,
    pageCount: 1,
    ...over,
  };
}

beforeEach(() => {
  vistas = [];
  criterios = [];
  fetchPartKeys.mockReset().mockResolvedValue(lista());
  fetchOffers.mockReset().mockResolvedValue({ rows: [FILA], total: 1, page: 1, pageCount: 1 });
  fetchPage.mockReset().mockResolvedValue({ lines: [LINEA], total: 1 });
  fetchThreadPage.mockReset().mockResolvedValue({ threads: [], total: 0 });
});

const vacio = (over: Partial<PartSearchCriteria> = {}): PartSearchCriteria => ({ ...initialPartCriteria(null), ...over });

describe('describeCriteria · los filtros de Comprando dichos con los nombres de los parámetros', () => {
  it('sin filtros dice "ninguno"', () => {
    expect(describeCriteria(vacio())).toBe('ninguno');
  });

  it('con todos, en el orden de la herramienta y con los códigos que ella acepta', () => {
    expect(
      describeCriteria({
        ref: '6204-2RS',
        contains: true,
        brand: 'SKF',
        minQuantity: 500,
        include: 'C3',
        exclude: 'ZZ',
        area: { kind: 'zone', zone: 'EU' },
      }),
    ).toBe('referencia=6204-2RS · contiene=true · marca=SKF · cantidad_minima=500 · incluir=C3 · excluir=ZZ · zona=EU');
    expect(describeCriteria(vacio({ ref: '6204', area: { kind: 'country', country: 'ES' } }))).toBe('referencia=6204 · pais=ES');
  });

  it('cada nombre que usa es un parámetro real de buscar_en_catalogo, y el plazo ya no lo es', () => {
    const props = Object.keys(tools.find((t) => t.name === 'buscar_en_catalogo')!.input_schema.properties);
    for (const p of ['referencia', 'contiene', 'marca', 'cantidad_minima', 'incluir', 'excluir', 'zona', 'pais']) {
      expect(props).toContain(p);
    }
    expect(props).not.toContain('plazo_maximo_dias');
  });

  it('tools.json declara la referencia como obligatoria', () => {
    expect(tools.find((t) => t.name === 'buscar_en_catalogo')!.input_schema.required).toEqual(['referencia']);
  });
});

describe('describeManualChanges · lo que el usuario tocó a mano (F-258, B2)', () => {
  const vera = vacio({ ref: '6204', area: { kind: 'zone', zone: 'EU' }, brand: 'SKF' });

  it('sin cambios, o sin una de las dos, no dice nada', () => {
    expect(describeManualChanges(vera, { ...vera })).toBeNull();
    expect(describeManualChanges(null, vera)).toBeNull();
    expect(describeManualChanges(vera, null)).toBeNull();
  });

  it('distingue quitado, añadido y cambiado, con los nombres y en el orden de los parámetros', () => {
    expect(describeManualChanges(vera, { ...vera, area: null, brand: 'FAG', minQuantity: 500, contains: true })).toBe(
      'añadió contiene=true; cambió marca=SKF por marca=FAG; añadió cantidad_minima=500; quitó zona=EU',
    );
  });
});

describe('buscar_en_catalogo · no repone un filtro que el usuario quitó a mano (F-258, B2; PO, 15-oct)', () => {
  const vera = vacio({ ref: '6204', area: { kind: 'zone', zone: 'EU' }, brand: 'SKF' });
  const conQuitados = (vivos: PartSearchCriteria): ToolContext => ({ ...contexto(), removedFilters: removedFilters(vera, vivos) });

  it('removedFilters: lo quitado y lo sustituido, con el valor que ya no quiere; lo añadido no', () => {
    expect(removedFilters(vera, { ...vera, area: null, brand: 'FAG', minQuantity: 500 })).toEqual([
      { param: 'marca', value: 'SKF' },
      { param: 'zona', value: 'EU' },
    ]);
    expect(removedFilters(vera, vera)).toEqual([]);
    expect(removedFilters(null, vera)).toEqual([]);
  });

  it('«contiene» desmarcado a mano cuenta como quitado', () => {
    const conContiene = { ...vera, contains: true };
    expect(removedFilters(conContiene, vera)).toEqual([{ param: 'contiene', value: 'true' }]);
  });

  it('si vuelve a poner la zona quitada, NO busca ni mueve la pantalla, y dice qué hacer', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', marca: 'FAG' }, conQuitados({ ...vera, area: null }));
    expect(r.isError).toBe(true);
    expect(r.content).toContain('NO se ha buscado: vuelves a poner zona=EU');
    expect(r.content).toContain('confirmar_filtros_quitados: true');
    expect(criterios).toEqual([]);
    expect(fetchPartKeys).not.toHaveBeenCalled();
  });

  it('sin ese filtro, busca con normalidad', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', marca: 'FAG' }, conQuitados({ ...vera, area: null }));
    expect(r.isError).toBe(false);
    expect(fetchPartKeys).toHaveBeenCalledTimes(1);
  });

  it('con confirmar_filtros_quitados (el usuario lo pidió), lo repone', async () => {
    const r = await runTool(
      'buscar_en_catalogo',
      { referencia: '6204', zona: 'EU', confirmar_filtros_quitados: true },
      conQuitados({ ...vera, area: null }),
    );
    expect(r.isError).toBe(false);
    expect(r.content).toContain('filtros puestos: referencia=6204 · zona=EU');
  });

  it('otra zona distinta de la quitada no es reponer: busca', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'AS' }, conQuitados({ ...vera, area: null }));
    expect(r.isError).toBe(false);
  });

  it('una marca sustituida a mano tampoco se repone sin confirmar, aunque cambie la mayúscula', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', marca: 'skf' }, conQuitados({ ...vera, brand: 'FAG' }));
    expect(r.isError).toBe(true);
    expect(r.content).toContain('marca=SKF');
  });

  it('tools.json declara el parámetro y lo limita a una petición del último mensaje', () => {
    const p = tools.find((t) => t.name === 'buscar_en_catalogo')!.input_schema.properties.confirmar_filtros_quitados!;
    expect(p.type).toBe('boolean');
    expect(p.description).toContain('EN SU ÚLTIMO MENSAJE');
  });
});

describe('buscar_en_catalogo · lo que no busca', () => {
  it('sin referencia no busca, no mueve la pantalla y pide que la pregunte', async () => {
    const r = await runTool('buscar_en_catalogo', { marca: 'SKF', zona: 'EU' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('necesita una referencia');
    expect(r.content).toContain('pregúntale');
    expect(criterios).toEqual([]);
    expect(fetchPartKeys).not.toHaveBeenCalled();
  });

  it('una referencia que queda vacía al normalizar tampoco', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: ' -/- ' }, contexto());
    expect(r.isError).toBe(true);
    expect(criterios).toEqual([]);
  });

  it('zona y país a la vez no: son un solo filtro en pantalla', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU', pais: 'DE' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('zona y pais son excluyentes');
    expect(criterios).toEqual([]);
    expect(fetchPartKeys).not.toHaveBeenCalled();
  });
});

describe('buscar_en_catalogo · la lista previa (F-254)', () => {
  it('pone los criterios en Comprando y devuelve las claves con su número de ofertas, separadas', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU' }, contexto());
    expect(r.isError).toBe(false);
    expect(criterios).toEqual([vacio({ ref: '6204', area: { kind: 'zone', zone: 'EU' } })]);
    expect(fetchPartKeys).toHaveBeenCalledWith(criterios[0], 1);
    expect(r.content).toContain('5 referencias distintas con 40 ofertas en total.');
    expect(r.content).toContain('62042RS · 11 ofertas');
    expect(r.content).toContain('6204C4 · 6 ofertas');
    expect(r.content).toContain('designación DISTINTA');
    expect(r.content).toContain('no las sumes ni las presentes como un solo producto');
  });

  it('le dice que el usuario está en la lista, que la marca él, y que NO la repita', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204', zona: 'EU' }, contexto());
    expect(r.content).toContain('filtros puestos: referencia=6204 · zona=EU');
    expect(r.content).toContain('LISTA DE REFERENCIAS');
    expect(r.content).toContain('tú no las marcas ni las eliges por él');
    expect(r.content).toContain('NO repitas la lista');
  });

  it('con más claves de las que ve, le prohíbe hablar de las demás', async () => {
    fetchPartKeys.mockResolvedValueOnce(lista({ totalKeys: 94, pageCount: 2 }));
    const r = await runTool('buscar_en_catalogo', { referencia: '6' }, contexto());
    expect(r.content).toContain('las otras 89 NO se te han mostrado');
    expect(r.content).toContain('en páginas de 60');
  });

  it('sin recorte de claves, no lo menciona', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6204' }, contexto());
    expect(r.content).toContain('referencias distintas');
    expect(r.content).not.toContain('NO se te han mostrado');
  });

  it('caso 1.3: le dice que no hubo coincidencia completa y con qué se buscó, y no le da ofertas', async () => {
    fetchPartKeys.mockResolvedValueOnce(lista({ matchedRef: '62042R', truncated: true, keys: [{ key: '62042RS', offers: 11 }], totalKeys: 1, totalOffers: 11 }));
    const r = await runTool('buscar_en_catalogo', { referencia: '6204-2RX' }, contexto());
    expect(r.content).toContain('NO hay ninguna referencia que empiece por «62042RX»');
    // Nombra a qué se recortó, y le pide decir las dos (`vera.real` D1, 26-oct-2026).
    expect(r.content).toContain('se ha recortado por el final a «62042R»');
    expect(r.content).toContain('nombrando las dos');
    expect(fetchOffers).not.toHaveBeenCalled();
  });

  it('caso 1.4: sin coincidencias lo dice, propone quitar la zona y no inventa referencias', async () => {
    fetchPartKeys.mockResolvedValueOnce(lista({ keys: [], totalKeys: 0, totalOffers: 0, matchedRef: null }));
    const r = await runTool('buscar_en_catalogo', { referencia: 'XQXQ', zona: 'EU' }, contexto());
    expect(r.isError).toBe(false);
    expect(r.content).toContain('Ninguna referencia empieza por «XQXQ» con estos filtros');
    expect(r.content).toContain('quitar la zona o el país');
    expect(r.content).toContain('No sugieras una referencia que no te haya devuelto ninguna herramienta');
    expect(fetchOffers).not.toHaveBeenCalled();
  });
});

describe('buscar_en_catalogo · las ofertas, solo de la referencia exacta', () => {
  it('si la exacta está en la lista, pide sus ofertas (y solo las suyas), hasta 200, y se las da por cantidad', async () => {
    fetchOffers.mockResolvedValueOnce({
      rows: [
        { ...FILA, id: 'a', quantity: 10, orgName: 'Poca SL' },
        { ...FILA, id: 'b', quantity: 900, orgName: 'Mucha SA' },
      ],
      total: 2,
      page: 1,
      pageCount: 1,
    });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204-2RS' }, contexto());
    expect(fetchOffers).toHaveBeenCalledWith(
      expect.objectContaining({ selection: { kind: 'keys', keys: ['62042RS'] }, pageSize: 200, orgId: PERFIL.orgId, memberId: PERFIL.id }),
    );
    expect(r.content).toContain('Ofertas de la referencia exacta 62042RS (SOLO de esa');
    expect(r.content.indexOf('Mucha SA')).toBeLessThan(r.content.indexOf('Poca SL'));
    expect(r.content).toContain('Estas filas te llegan ordenadas por cantidad');
    expect(r.content).toContain('El usuario todavía no las ve');
    // Lo que no ve, con su número (`vera.real` C04, 26-oct-2026): 40 ofertas en 5 referencias, 11 de la exacta.
    expect(r.content).toContain('Además hay 29 ofertas de las otras 4 referencias de la lista que NO se te muestran');
  });

  it('con más de 25 ofertas de la exacta, le dice cuántas no ve y le prohíbe suponerlas', async () => {
    fetchOffers.mockResolvedValueOnce({
      rows: Array.from({ length: 30 }, (_, i) => ({ ...FILA, id: `l${String(i).padStart(2, '0')}` })),
      total: 30,
      page: 1,
      pageCount: 1,
    });
    const r = await runTool('buscar_en_catalogo', { referencia: '6204-2RS' }, contexto());
    expect(r.content).toContain('30 ofertas, y AQUÍ SOLO VES 25');
  });

  it('si la exacta no está, no pide ofertas, y deja claro que eso no es que no haya stock', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '620' }, contexto());
    expect(fetchOffers).not.toHaveBeenCalled();
    expect(r.content).toContain('no hay ninguna referencia que sea exactamente «620»');
    // «no tienes ofertas de ninguna» se leía como «no hay stock» (`vera.real` D1, 26-oct-2026).
    expect(r.content).not.toContain('no tienes ofertas');
    expect(r.content).toContain('Eso NO quiere decir que no haya stock');
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
