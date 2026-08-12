import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import type { SearchCriteria } from './search';
import {
  TOOL_NAMES,
  criteriaFromInput,
  leaksCiphertext,
  runTool,
  type Screen,
  type ToolContext,
} from './vera-tools';

/**
 * Contrato de aceptación de las cuatro herramientas de VERA (D-09-01).
 *
 * **Escrito ANTES que el código y verificado en rojo total** contra esqueletos
 * vacíos (F-058). Cada aserto negativo lleva ancla positiva y ámbito acotado
 * (F-059), y los que van sobre un literal llevan además su **control positivo**:
 * un caso construido donde ese literal SÍ aparece, para haber visto fallar al
 * detector (F-066, que nació de un `not.toContain('precio')` sin ámbito).
 *
 * El cliente LLM no aparece por ninguna parte: estas son las herramientas, y se
 * prueban contra la capa de datos mockeada (`CLAUDE.md` §5).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const TOOLS_JSON = resolve(aqui, '../../../supabase/functions/vera/tools.json');

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

let navegadoA: Screen[] = [];
let criteriosEscritos: SearchCriteria[] = [];

function contexto(): ToolContext {
  return {
    profile: PERFIL,
    navigate: (s) => navegadoA.push(s),
    setCriteria: (c) => criteriosEscritos.push(c),
  };
}

beforeEach(() => {
  navegadoA = [];
  criteriosEscritos = [];
  fetchResults.mockReset();
  fetchPage.mockReset();
  fetchThreadPage.mockReset();

  fetchResults.mockResolvedValue({
    rows: [
      {
        id: 'line-1',
        partNumber: '6205-2RS',
        brand: 'SKF',
        quantity: 1200,
        leadTimeDays: 5,
        orgId: 'org-nsk',
        orgName: 'NSK Europe Ltd',
        country: 'DE',
        lastUploadAt: '2026-08-11T10:00:00Z',
        favoriteCount: 3,
        isFavorite: false,
        consulted: false,
      },
    ],
    total: 1,
    capped: false,
  });
  fetchPage.mockResolvedValue({
    lines: [
      {
        id: 'own-1',
        partNumber: '6205-2RS',
        brand: 'SKF',
        quantity: 40,
        country: 'ES',
        productFamily: 'Rígidos de bolas',
        status: 'PUBLISHED',
        leadTimeDays: 2,
        lastUploadAt: '2026-08-12T10:00:00Z',
      },
    ],
    total: 1,
  });
  fetchThreadPage.mockResolvedValue({
    threads: [
      {
        id: 'thread-1',
        counterpartyName: 'Anadolu Rulman',
        counterpartyCountry: 'TR',
        state: 'CON OFERTA PENDIENTE',
        lastItemAt: '2026-08-12T09:00:00Z',
        lastItem: { type: 'OFERTA', partNumber: '6205-2RS' },
      },
    ],
    total: 1,
  });
});

// -----------------------------------------------------------------------------
// La fuente única de los nombres
// -----------------------------------------------------------------------------

describe('tools.json es la fuente única, y el cliente no puede desviarse', () => {
  it('declara exactamente las cuatro herramientas de D-09-01, con esos nombres', () => {
    const definiciones = JSON.parse(readFileSync(TOOLS_JSON, 'utf8')) as { name: string }[];
    expect(definiciones.map((d) => d.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('cada herramienta declarada tiene ejecutor en el cliente', async () => {
    const definiciones = JSON.parse(readFileSync(TOOLS_JSON, 'utf8')) as { name: string }[];
    for (const { name } of definiciones) {
      const r = await runTool(name, { pantalla: 'Panel' }, contexto());
      // Ancla positiva: no es el error de "no existe esa herramienta".
      expect(r.content).not.toMatch(/no existe/i);
    }
  });

  it('toda definición lleva descripción y esquema de entrada', () => {
    const definiciones = JSON.parse(readFileSync(TOOLS_JSON, 'utf8')) as {
      name: string;
      description?: string;
      input_schema?: { type?: string };
    }[];
    for (const d of definiciones) {
      expect(d.description ?? '').not.toHaveLength(0);
      expect(d.input_schema?.type).toBe('object');
    }
  });
});

// -----------------------------------------------------------------------------
// Herramienta desconocida: se dice, no se inventa
// -----------------------------------------------------------------------------

describe('una herramienta que no existe', () => {
  it('devuelve error explícito y no algo que parezca un dato', async () => {
    const r = await runTool('resumir_hilo', {}, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/no existe/i);
  });

  it('no ejecuta ningún efecto de interfaz', async () => {
    await runTool('resumir_hilo', { pantalla: 'Hilos' }, contexto());
    expect(navegadoA).toEqual([]);
    expect(criteriosEscritos).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// buscar_en_catalogo
// -----------------------------------------------------------------------------

describe('buscar_en_catalogo', () => {
  it('consulta con la organización y el miembro del perfil, nunca con otros', async () => {
    await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
    expect(fetchResults).toHaveBeenCalledTimes(1);
    const [arg] = fetchResults.mock.calls[0] as [{ orgId: string; memberId: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
    expect(arg.memberId).toBe(PERFIL.id);
  });

  it('traduce la entrada del modelo a criterios de SRCH-01', () => {
    const c = criteriaFromInput({
      referencia: '6205-2RS',
      marca: 'SKF',
      cantidad_minima: 500,
      zona: 'EU',
      pais: 'de',
      plazo_maximo_dias: 7,
    });
    expect(c.partNumber).toBe('6205-2RS');
    expect(c.brand).toBe('SKF');
    expect(c.minQuantity).toBe(500);
    expect(c.zone).toBe('EU');
    expect(c.country).toBe('DE');
    expect(c.maxLeadTimeDays).toBe(7);
  });

  it('un campo ausente es null, no cero ni cadena "undefined"', () => {
    const c = criteriaFromInput({ referencia: '6205' });
    expect(c.minQuantity).toBeNull();
    expect(c.maxLeadTimeDays).toBeNull();
    expect(c.zone).toBeNull();
    expect(c.brand).toBe('');
  });

  it('escribe los criterios en la pantalla — VERA escribe criterios, no chips', async () => {
    await runTool('buscar_en_catalogo', { referencia: '6205-2RS', zona: 'EU' }, contexto());
    expect(criteriosEscritos).toHaveLength(1);
    expect(criteriosEscritos[0]?.partNumber).toBe('6205-2RS');
    expect(criteriosEscritos[0]?.zone).toBe('EU');
  });

  it('devuelve al modelo la referencia, la cantidad y la contraparte', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
    expect(r.isError).toBe(false);
    expect(r.content).toContain('6205-2RS');
    expect(r.content).toContain('1200');
    expect(r.content).toContain('NSK Europe Ltd');
  });

  /**
   * F-040: el precio está FUERA de la parrilla de SRCH-01, y no se ordena ni se
   * filtra por él nunca. Ámbito acotado al `content` de ESTA herramienta —
   * no al contenedor entero, que fue el defecto del día 8.
   */
  it('no devuelve precio', async () => {
    const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
    expect(r.content.toLowerCase()).not.toContain('precio');
  });

  it('CONTROL POSITIVO de F-066: el mismo aserto SÍ falla cuando el literal aparece', () => {
    const conPrecio = 'referencia 6205-2RS · precio 12,40 €';
    expect(conPrecio.toLowerCase()).toContain('precio');
  });
});

// -----------------------------------------------------------------------------
// consultar_mi_inventario
// -----------------------------------------------------------------------------

describe('consultar_mi_inventario', () => {
  it('pide el inventario de la organización propia', async () => {
    await runTool('consultar_mi_inventario', {}, contexto());
    expect(fetchPage).toHaveBeenCalledTimes(1);
    const [arg] = fetchPage.mock.calls[0] as [{ orgId: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
  });

  it('acepta el filtro de los cuatro chips de INV-01', async () => {
    await runTool('consultar_mi_inventario', { filtro: 'desactualizados' }, contexto());
    const [arg] = fetchPage.mock.calls[0] as [{ filter: string }];
    expect(arg.filter).toBe('desactualizados');
  });

  it('un filtro que no existe no se cuela como si existiera', async () => {
    const r = await runTool('consultar_mi_inventario', { filtro: 'vendidos' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('vendidos');
  });

  it('devuelve la referencia y la cantidad propias', async () => {
    const r = await runTool('consultar_mi_inventario', {}, contexto());
    expect(r.isError).toBe(false);
    expect(r.content).toContain('6205-2RS');
    expect(r.content).toContain('40');
  });
});

// -----------------------------------------------------------------------------
// listar_mis_hilos · la que hace visible el zero-knowledge
// -----------------------------------------------------------------------------

describe('listar_mis_hilos es metadata-only, y eso es la mitad del producto', () => {
  it('devuelve contraparte, estado y tipo del último elemento', async () => {
    const r = await runTool('listar_mis_hilos', {}, contexto());
    expect(r.isError).toBe(false);
    expect(r.content).toContain('Anadolu Rulman');
    expect(r.content).toContain('CON OFERTA PENDIENTE');
    expect(r.content).toContain('OFERTA');
  });

  it('no deja salir ningún campo cifrado', async () => {
    const r = await runTool('listar_mis_hilos', {}, contexto());
    expect(leaksCiphertext(r.content)).toBe(false);
  });

  it('CONTROL POSITIVO de F-066: el detector SÍ marca un contenido con ciphertext', () => {
    expect(leaksCiphertext({ content_ciphertext: 'yGh8=' })).toBe(true);
    expect(leaksCiphertext('…wrapped_cek: yGh8=…')).toBe(true);
  });

  it('filtra por contraparte cuando el modelo la pasa', async () => {
    await runTool('listar_mis_hilos', { contraparte: 'Anadolu' }, contexto());
    const [arg] = fetchThreadPage.mock.calls[0] as [{ orgId: string; search: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
    expect(arg.search).toBe('Anadolu');
  });
});

// -----------------------------------------------------------------------------
// navegar
// -----------------------------------------------------------------------------

describe('navegar', () => {
  it('navega a una pantalla que existe, sin pedir confirmación', async () => {
    const r = await runTool('navegar', { pantalla: 'Inventario' }, contexto());
    expect(r.isError).toBe(false);
    expect(navegadoA).toEqual(['Inventario']);
  });

  /**
   * `navIndexOf` devuelve 0 (Panel) para cualquier etiqueta que no encuentre, y
   * `Empresas` SÍ está en `NAV_ITEMS` pero no tiene pantalla en el MVP. Sin este
   * corte, "llévame a Empresas" aterrizaría en Panel sin decir nada: el patrón
   * de recorte silencioso de F-023, que es el riesgo #1 con otra cara.
   */
  it('una pantalla del nav que no está construida se rechaza, no aterriza en Panel', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('Empresas');
    expect(navegadoA).toEqual([]);
  });

  it('sin pantalla no navega a ninguna parte', async () => {
    const r = await runTool('navegar', {}, contexto());
    expect(r.isError).toBe(true);
    expect(navegadoA).toEqual([]);
  });
});
