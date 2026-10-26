import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import type { PartKeysPage, PartSearchCriteria } from './part-search';
import { normalizeRef } from './part-search';
import { NAV_ITEMS } from '../shell/AppShell';
import {
  SCREENS,
  TOOL_NAMES,
  criteriaFromInput,
  leaksCiphertext,
  runTool,
  type DraftRequest,
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

const fetchOffers = vi.fn();
const fetchPartKeys = vi.fn();
const fetchPage = vi.fn();
const fetchThreadPage = vi.fn();

vi.mock('./part-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./part-search')>()),
  fetchPartKeys: (...a: unknown[]) => fetchPartKeys(...a),
  fetchOffers: (...a: unknown[]) => fetchOffers(...a),
}));

/**
 * La lista previa por defecto: una sola clave, la EXACTA de lo pedido. Así `buscar_en_catalogo` pide sus ofertas
 * (`fetchOffers`) y los tests de las filas siguen probando lo mismo que con la búsqueda plana de antes.
 */
function listaPreviaExacta(c: PartSearchCriteria): PartKeysPage {
  const key = normalizeRef(c.ref);
  return { keys: [{ key, offers: 1 }], totalKeys: 1, totalOffers: 1, matchedRef: key, truncated: false, page: 1, pageCount: 1 };
}
vi.mock('./inventory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./inventory')>()),
  fetchPage: (...a: unknown[]) => fetchPage(...a),
}));
vi.mock('./threads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./threads')>()),
  fetchThreadPage: (...a: unknown[]) => fetchThreadPage(...a),
}));

let navegadoA: Screen[] = [];
let criteriosEscritos: PartSearchCriteria[] = [];
let hiloAbierto = false;
let borradores: DraftRequest[] = [];

function contexto(): ToolContext {
  return {
    profile: PERFIL,
    navigate: (s) => navegadoA.push(s),
    setCriteria: (c) => criteriosEscritos.push(c),
    threadOpen: hiloAbierto,
    prepareDraft: (d) => borradores.push(d),
  };
}

beforeEach(() => {
  navegadoA = [];
  criteriosEscritos = [];
  hiloAbierto = false;
  borradores = [];
  fetchOffers.mockReset();
  fetchPartKeys.mockReset().mockImplementation(async (c: PartSearchCriteria) => listaPreviaExacta(c));
  fetchPage.mockReset();
  fetchThreadPage.mockReset();

  fetchOffers.mockResolvedValue({
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
        lastItem: { type: 'OFERTA', partNumber: '6205-2RS', isOwn: false },
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
    expect(fetchOffers).toHaveBeenCalledTimes(1);
    const [arg] = fetchOffers.mock.calls[0] as [{ orgId: string; memberId: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
    expect(arg.memberId).toBe(PERFIL.id);
  });

  it('traduce la entrada del modelo a criterios de SRCH-01', () => {
    const c = criteriaFromInput({
      referencia: '6205-2RS',
      contiene: true,
      marca: 'SKF',
      cantidad_minima: 500,
      incluir: 'C3',
      excluir: 'ZZ',
      pais: 'de',
    });
    expect(c).toEqual({
      ref: '6205-2RS',
      contains: true,
      brand: 'SKF',
      minQuantity: 500,
      include: 'C3',
      exclude: 'ZZ',
      area: { kind: 'country', country: 'DE' },
    });
    expect(criteriaFromInput({ referencia: '6205', zona: 'eu' }).area).toEqual({ kind: 'zone', zone: 'EU' });
  });

  it('un campo ausente es null, no cero ni cadena "undefined"; «contiene» solo con el booleano', () => {
    const c = criteriaFromInput({ referencia: '6205', contiene: 'true' });
    expect(c.minQuantity).toBeNull();
    expect(c.area).toBeNull();
    expect(c.brand).toBe('');
    expect(c.contains).toBe(false);
  });

  it('escribe los criterios en la pantalla — VERA escribe criterios, no chips', async () => {
    await runTool('buscar_en_catalogo', { referencia: '6205-2RS', zona: 'EU' }, contexto());
    expect(criteriosEscritos).toHaveLength(1);
    expect(criteriosEscritos[0]?.ref).toBe('6205-2RS');
    expect(criteriosEscritos[0]?.area).toEqual({ kind: 'zone', zone: 'EU' });
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

  it('filtra por referencia en cualquier elemento del hilo y dice todas las coincidencias', async () => {
    fetchThreadPage.mockResolvedValueOnce({
      threads: [
        {
          id: 'thread-9',
          counterpartyName: 'Anadolu Rulman',
          counterpartyCountry: 'TR',
          state: 'CON OFERTA PENDIENTE',
          lastItemAt: '2026-08-11T10:00:00Z',
          lastItem: { type: 'OFERTA', partNumber: '7210-B', isOwn: false },
          referenceMatches: [
            { type: 'CONSULTA', partNumber: '6205-2RS', brand: 'NSK', isOwn: true, state: 'Sin stock' },
          ],
        },
      ],
      total: 1,
    });
    const r = await runTool('listar_mis_hilos', { referencia: '6205-2RS' }, contexto());
    const [arg] = fetchThreadPage.mock.calls.at(-1) as [{ reference?: string }];
    expect(arg.reference).toBe('6205-2RS');
    // La referencia buscada NO es la del último elemento: tiene que salir igual.
    expect(r.content).toContain('6205-2RS');
    expect(r.content).toContain('Sin stock');
  });

  it('filtra por contraparte cuando el modelo la pasa', async () => {
    await runTool('listar_mis_hilos', { contraparte: 'Anadolu' }, contexto());
    const [arg] = fetchThreadPage.mock.calls[0] as [{ orgId: string; search: string }];
    expect(arg.orgId).toBe(PERFIL.orgId);
    expect(arg.search).toBe('Anadolu');
  });

  /*
   * F-102 · EL ASERTO QUE FALTABA, Y SU AUSENCIA ERA EXACTAMENTE EL FALLO.
   *
   * Los tres asertos de arriba comprueban que la herramienta no deja salir
   * contenido cifrado —lo que NO debe decir— y ninguno comprobaba si lo que sí
   * dice basta para contestar la pregunta que el usuario hace de verdad:
   * «¿tengo algo pendiente de responder?». No bastaba. Faltaba la dirección del
   * último elemento, y el modelo la rellenó mandando a responder una CONSULTA
   * que había enviado el propio usuario. Un hueco no se ve mirando lo que hay.
   */
  describe('la dirección del último elemento va en la fila (F-102)', () => {
    it('nombra a la contraparte cuando el último elemento lo envió ella', async () => {
      const r = await runTool('listar_mis_hilos', {}, contexto());
      expect(r.content).toContain('lo envió Anadolu Rulman');
      expect(r.content).not.toContain('lo enviaste tú');
    });

    it('dice «lo enviaste tú» cuando el último elemento es mío', async () => {
      // La reproducción literal del hallazgo: esa CONSULTA la emitió Rodamientos
      // Ibéricos —el propio usuario—, así que ahí no hay nada que responder; se
      // está esperando respuesta. VERA afirmaba lo contrario.
      fetchThreadPage.mockResolvedValueOnce({
        threads: [
          {
            id: 'thread-2',
            counterpartyName: 'Cuscinetti Padana',
            counterpartyCountry: 'IT',
            state: 'CON CONSULTA PENDIENTE',
            lastItemAt: '2026-08-12T09:00:00Z',
            lastItem: { type: 'CONSULTA', partNumber: 'NU2210-E-TVP2', isOwn: true },
          },
        ],
        total: 1,
      });
      const r = await runTool('listar_mis_hilos', {}, contexto());
      expect(r.content).toContain('lo enviaste tú');
      expect(r.content).not.toContain('lo envió Cuscinetti Padana');
    });

    it('NINGUNA fila con último elemento se queda sin dirección', async () => {
      // Estructural a propósito: no ancla un literal, ancla que el hueco no
      // pueda reabrirse en una fila cualquiera de una página cualquiera.
      fetchThreadPage.mockResolvedValueOnce({
        threads: [
          {
            id: 'thread-1',
            counterpartyName: 'Nordwälz Lager',
            counterpartyCountry: 'DE',
            state: 'CON OFERTA PENDIENTE',
            lastItemAt: '2026-08-12T09:00:00Z',
            lastItem: { type: 'OFERTA', partNumber: '6205-2RS', isOwn: false },
          },
          {
            id: 'thread-2',
            counterpartyName: 'Cuscinetti Padana',
            counterpartyCountry: 'IT',
            state: 'CON CONSULTA PENDIENTE',
            lastItemAt: '2026-08-11T09:00:00Z',
            lastItem: { type: 'CONSULTA', partNumber: 'NU2210-E-TVP2', isOwn: true },
          },
        ],
        total: 2,
      });
      const r = await runTool('listar_mis_hilos', {}, contexto());
      const filas = r.content.split('\n').filter((l) => l.includes('último:'));
      expect(filas).toHaveLength(2);
      for (const fila of filas) expect(fila).toMatch(/lo enviaste tú|lo envió \S/);
    });

    it('desactiva el nombre del estado, que por sí solo empuja al error', async () => {
      // `CON CONSULTA PENDIENTE` se lee como "tienes una consulta que responder".
      const r = await runTool('listar_mis_hilos', {}, contexto());
      expect(r.content).toContain('no de quién es el turno');
    });
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
   * `Contacto` SÍ está en `NAV_ITEMS` pero no tiene pantalla. Sin este corte,
   * "llévame a Contacto" aterrizaría en Panel sin decir nada: el patrón de
   * recorte silencioso de F-023, que es el riesgo #1 con otra cara. Hasta el
   * 14-oct-2026 este caso era Empresas; desde ese día Empresas y Foros sí se abren.
   */
  it('una pantalla del nav que no está construida se rechaza, no aterriza en Panel', async () => {
    const r = await runTool('navegar', { pantalla: 'Contacto' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('«Contacto» está en el menú pero todavía no está construida');
    expect(navegadoA).toEqual([]);
  });

  it('Empresas y Foros se abren (14-oct-2026, decisión del PO)', async () => {
    for (const pantalla of ['Empresas', 'Foros'] as const) {
      const r = await runTool('navegar', { pantalla }, contexto());
      expect(r.isError).toBe(false);
      expect(r.content).toBe(`Abierta la pantalla ${pantalla}.`);
    }
    expect(navegadoA).toEqual(['Empresas', 'Foros']);
  });

  it('un nombre que no es ninguna pantalla se rechaza sin decir que está en el menú', async () => {
    const r = await runTool('navegar', { pantalla: 'Ajustes' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('no es una pantalla a la que puedas llevar');
    expect(r.content).not.toContain('está en el menú');
    expect(navegadoA).toEqual([]);
  });

  it('el enum de tools.json y SCREENS dicen lo mismo, en el mismo orden', () => {
    const navegar = (JSON.parse(readFileSync(TOOLS_JSON, 'utf8')) as {
      name: string;
      input_schema: { properties: { pantalla?: { enum: string[] } } };
    }[]).find((t) => t.name === 'navegar')!;
    expect(navegar.input_schema.properties.pantalla!.enum).toEqual([...SCREENS]);
  });

  it('cada destino de navegar es un ítem real del menú (si no, navIndexOf lo llevaría al Panel)', () => {
    const etiquetas = NAV_ITEMS.map((n) => n.label as string);
    for (const s of SCREENS) expect(etiquetas).toContain(s);
  });

  it('sin pantalla no navega a ninguna parte', async () => {
    const r = await runTool('navegar', {}, contexto());
    expect(r.isError).toBe(true);
    expect(navegadoA).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// La revisión de F-102 aplicada a las otras tres herramientas
// -----------------------------------------------------------------------------

/**
 * ⚠ MISMO CRITERIO QUE DESTAPÓ `F-102`, PASADO A LAS DEMÁS: *¿qué pregunta
 * razonable no puede contestarse con lo que devuelvo, y qué va a inventar el
 * modelo para taparlo?*
 *
 * Los huecos encontrados el 17-ago no eran de datos que faltaran en la base:
 * los cuatro campos ya venían en la fila, se pagaban a PostgREST y se pintaban
 * en pantalla — y se tiraban antes de llegar al modelo. Un dato que existe y no
 * se propaga es peor que uno que no existe: el modelo no sabe que le falta.
 */
describe('los huecos de las otras tres herramientas (revisión de F-102)', () => {
  /** Una fecha a N días exactos de ahora: la frescura es relativa al reloj, así
   *  que el test la fija por diferencia y no por literal. */
  const haceDias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  describe('buscar_en_catalogo · «¿ese stock está actualizado?»', () => {
    it('toda fila dice de cuándo es el dato y si eso es un aviso', async () => {
      const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
      // La última línea repite los filtros aplicados («referencia=6205-2RS», 14-oct): no es una fila.
      const filas = r.content.split('\n').filter((l) => l.includes('6205-2RS') && !l.startsWith('Esta búsqueda'));
      expect(filas.length).toBeGreaterThan(0);
      for (const fila of filas) {
        expect(fila).toMatch(/actualizada /);
        expect(fila).toMatch(/al día|desactualizada/);
      }
    });

    it('una línea de 12 días sale como desactualizada, no como una fecha suelta', async () => {
      // El umbral (>7 naranja, >30 rojo) es del proyecto. Sin él, "hace 12 días"
      // obliga al modelo a decidir por su cuenta si eso es mucho.
      fetchOffers.mockResolvedValueOnce({
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
            lastUploadAt: haceDias(12),
            favoriteCount: 3,
            isFavorite: false,
            consulted: false,
          },
        ],
        total: 1,
        capped: false,
      });
      const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
      expect(r.content).toContain('desactualizada');
      expect(r.content).not.toContain('al día');
    });

    it('dice cuál es la más reciente y cuál la más antigua, y el plazo no se confunde con la frescura (F-279, B7)', async () => {
      const fila = (id: string, orgName: string, dias: number, plazo: number) => ({
        id,
        partNumber: '22210',
        brand: 'FAG',
        quantity: 100,
        leadTimeDays: plazo,
        orgId: `org-${id}`,
        orgName,
        country: 'ES',
        lastUploadAt: haceDias(dias),
        favoriteCount: 0,
        isFavorite: false,
        consulted: false,
      });
      fetchOffers.mockResolvedValueOnce({
        rows: [fila('a', 'JULSA INDUSTRIAL S.A', 9, 0), fila('b', 'Roulements Rhône', 16, 6)],
        total: 2,
        capped: false,
      });
      const r = await runTool('buscar_en_catalogo', { referencia: '22210' }, contexto());
      expect(r.content).toContain('la más reciente es la de JULSA INDUSTRIAL S.A (hace 9 días)');
      expect(r.content).toContain('la más antigua la de Roulements Rhône (hace 16 días)');
      expect(r.content).toContain('plazo 6 días');
    });

    it('marca la fila ya consultada Y explica qué significa que otra no lo lleve', async () => {
      fetchOffers.mockResolvedValueOnce({
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
            lastUploadAt: haceDias(1),
            favoriteCount: 3,
            isFavorite: false,
            consulted: true,
          },
        ],
        total: 1,
        capped: false,
      });
      const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
      expect(r.content).toContain('YA CONSULTADA');
      // La leyenda importa tanto como la marca: sin ella, la AUSENCIA de la
      // marca no dice nada y el modelo la interpretaría como quisiera.
      expect(r.content).toMatch(/no llevan «YA CONSULTADA»/);
    });

    it('avisa de que la búsqueda ha movido al usuario de pantalla', async () => {
      // `App.tsx:157`: escribir criterios navega a Comprando. La herramienta
      // tenía ese efecto y no lo contaba.
      const r = await runTool('buscar_en_catalogo', { referencia: '6205-2RS' }, contexto());
      expect(r.content).toContain('Comprando');
      expect(criteriosEscritos).toHaveLength(1);
    });
  });

  describe('consultar_mi_inventario · «¿14 líneas de qué?»', () => {
    it('dice a qué filtro pertenece el recuento, que sin eso es ambiguo', async () => {
      const r = await runTool('consultar_mi_inventario', { filtro: 'publicados' }, contexto());
      expect(r.content).toContain('publicados');
      expect(r.content).toMatch(/SOLO de lo que cumple ese filtro/);
    });

    it('sin filtro explícito declara «todos», no se calla el criterio', async () => {
      const r = await runTool('consultar_mi_inventario', {}, contexto());
      expect(r.content).toContain('todos');
    });

    it('toda línea propia dice de cuándo es, que es lo que se pregunta al mirarlo', async () => {
      const r = await runTool('consultar_mi_inventario', {}, contexto());
      // La última línea repite los filtros aplicados («referencia=6205-2RS», 14-oct): no es una fila.
      const filas = r.content.split('\n').filter((l) => l.includes('6205-2RS') && !l.startsWith('Esta búsqueda'));
      expect(filas.length).toBeGreaterThan(0);
      for (const fila of filas) expect(fila).toMatch(/actualizada .*(al día|desactualizada)/);
    });
  });
});
