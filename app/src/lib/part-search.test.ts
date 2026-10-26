import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La búsqueda en dos fases (`part-search.ts`). Sin red: `supabase.rpc` es un doble que registra con qué se le
 * llama y devuelve lo que el test le pone en la cola.
 *
 * Escrito por Claude Code; no es contrato del arnés.
 */

let llamadas: { fn: string; args: Record<string, unknown> }[] = [];
let respuestas: { data: unknown; error: unknown }[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      llamadas.push({ fn, args });
      return Promise.resolve(respuestas.shift() ?? { data: [], error: null });
    },
  },
}));

const fetchFavoriteOrgIds = vi.fn(async () => new Set<string>());
const fetchConsultedLineIds = vi.fn(async () => new Set<string>());
vi.mock('./search', async (original) => ({
  ...(await original<typeof import('./search')>()),
  fetchFavoriteOrgIds: (...a: unknown[]) => fetchFavoriteOrgIds(...(a as [])),
  fetchConsultedLineIds: (...a: unknown[]) => fetchConsultedLineIds(...(a as [])),
}));

const {
  activePartChips,
  areaFromValue,
  areaLabel,
  areaOptions,
  areaValue,
  canSearch,
  fetchOffers,
  fetchPartKeys,
  initialPartCriteria,
  normalizeRef,
  OFFERS_PAGE_SIZE,
  PART_KEYS_PAGE_SIZE,
  rpcFilters,
  withoutPartChip,
} = await import('./part-search');
type PartSearchCriteria = import('./part-search').PartSearchCriteria;

beforeEach(() => {
  llamadas = [];
  respuestas = [];
  fetchFavoriteOrgIds.mockClear();
  fetchConsultedLineIds.mockClear();
});

function criterios(over: Partial<PartSearchCriteria> = {}): PartSearchCriteria {
  return { ...initialPartCriteria(null), ...over };
}

// -----------------------------------------------------------------------------

describe('normalizeRef · la misma regla que part_key y app.normalize_ref', () => {
  /**
   * La tabla de casos se lee de `supabase/tests/10_clave_normalizada.sql`, la que comprueba la columna generada.
   * Así no hay dos tablas que puedan separarse: si alguien añade un caso allí, aquí se prueba solo.
   */
  const sql = readFileSync(resolve(process.cwd(), '..', 'supabase', 'tests', '10_clave_normalizada.sql'), 'utf8');
  const bloque = sql.slice(sql.indexOf('select * from (values'), sql.indexOf(') as t(part_number, esperada)'));
  const casos = [...bloque.matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g)].map(
    ([, entrada = '', esperada = '']) => [entrada.replace(/''/g, "'"), esperada.replace(/''/g, "'")] as const,
  );

  it('lee la tabla de casos del test SQL (y no está vacía)', () => {
    // Si el fichero cambia de forma y la expresión deja de casar, esto lo dice en vez de pasar en vacío.
    expect(casos.length).toBeGreaterThanOrEqual(25);
    expect(casos).toContainEqual(['320/28X', '320/28X']);
    expect(casos).toContainEqual(['FRM 12,5/140', 'FRM12.5/140']);
  });

  it.each(casos)('%s → %s', (entrada, esperada) => {
    expect(normalizeRef(entrada)).toBe(esperada);
  });
});

// -----------------------------------------------------------------------------

describe('criterios iniciales · zona por defecto', () => {
  it('arranca en el continente de la propia organización', () => {
    expect(initialPartCriteria('EU').area).toEqual({ kind: 'zone', zone: 'EU' });
  });

  it('sin continente conocido, «Cualquiera»: no se inventa uno', () => {
    expect(initialPartCriteria(undefined).area).toBeNull();
    expect(initialPartCriteria('XX').area).toBeNull();
  });

  it('«Contiene» desmarcada por defecto: la búsqueda es «empieza por»', () => {
    expect(initialPartCriteria('EU').contains).toBe(false);
  });

  it('REF es obligatoria, también si queda vacía al normalizar', () => {
    expect(canSearch(criterios({ ref: '' }))).toBe(false);
    expect(canSearch(criterios({ ref: ' -- ' }))).toBe(false);
    expect(canSearch(criterios({ ref: 'nu214' }))).toBe(true);
  });
});

// -----------------------------------------------------------------------------

describe('ARE · un continente o un país', () => {
  it('primero los continentes y después los países, cada grupo por nombre', () => {
    const ops = areaOptions();
    const primerPais = ops.findIndex((o) => o.group === 'Países');
    expect(primerPais).toBe(7);
    expect(ops.slice(0, 7).every((o) => o.group === 'Continentes')).toBe(true);
    expect(ops[0]?.label).toBe('África');
    const paises = ops.slice(7).map((o) => o.label);
    expect(paises).toEqual([...paises].sort((a, b) => a.localeCompare(b, 'es-ES')));
    expect(ops).toContainEqual({ value: 'country:ES', label: 'España', group: 'Países' });
  });

  it('el valor del desplegable va y vuelve', () => {
    for (const a of [{ kind: 'zone', zone: 'AS' } as const, { kind: 'country', country: 'TR' } as const, null]) {
      expect(areaFromValue(areaValue(a))).toEqual(a);
    }
    expect(areaFromValue('zone:XX')).toBeNull();
    expect(areaFromValue('country:esp')).toBeNull();
  });

  it('país por nombre, nunca el ISO', () => {
    expect(areaLabel({ kind: 'country', country: 'DE' })).toBe('Alemania');
    expect(areaLabel(null)).toBe('Cualquiera');
  });
});

// -----------------------------------------------------------------------------

describe('chips', () => {
  it('en el orden de los campos, y el de REF no se quita', () => {
    const c = criterios({
      ref: '6205-2RS',
      contains: true,
      brand: 'SKF',
      minQuantity: 1200,
      include: 'C3',
      exclude: 'ZZ',
      area: { kind: 'zone', zone: 'EU' },
    });
    expect(activePartChips(c).map((ch) => [ch.key, ch.value, ch.removable])).toEqual([
      ['ref', '6205-2RS', false],
      ['contains', 'Sí', true],
      ['brand', 'SKF', true],
      ['minQuantity', '1200 u', true],
      ['include', 'C3', true],
      ['exclude', 'ZZ', true],
      ['area', 'Europa', true],
    ]);
    expect(withoutPartChip(c, 'ref')).toBe(c);
  });

  it('un país se rotula «País», no «Zona»: filtra por dónde está el stock', () => {
    const [chip] = activePartChips(criterios({ area: { kind: 'country', country: 'ES' } }));
    expect(chip).toMatchObject({ key: 'area', label: 'País', value: 'España' });
  });

  it('quitar un chip blanquea solo su campo', () => {
    const c = criterios({ ref: 'X', brand: 'SKF', area: { kind: 'zone', zone: 'EU' } });
    expect(withoutPartChip(c, 'area')).toEqual({ ...c, area: null });
    expect(withoutPartChip(c, 'brand')).toEqual({ ...c, brand: '' });
  });
});

// -----------------------------------------------------------------------------

describe('rpcFilters · lo que espera app.search_where', () => {
  it('vacío es null, y zona y país nunca van juntos', () => {
    expect(rpcFilters(criterios({ brand: '  ', area: { kind: 'zone', zone: 'EU' } }))).toEqual({
      p_brand: null,
      p_min_quantity: null,
      p_include: null,
      p_exclude: null,
      p_zone: 'EU',
      p_country: null,
    });
    expect(rpcFilters(criterios({ area: { kind: 'country', country: 'TR' } }))).toMatchObject({
      p_zone: null,
      p_country: 'TR',
    });
  });

  it('INC y EXC van sin normalizar: los normaliza el servidor', () => {
    expect(rpcFilters(criterios({ include: 'c-3' })).p_include).toBe('c-3');
  });
});

// -----------------------------------------------------------------------------

describe('fetchPartKeys · fase A', () => {
  const fila = (part_key: string, offers: number, matched_ref = '62052RS') => ({
    part_key,
    offers,
    total_keys: 2,
    total_offers: 4,
    matched_ref,
  });

  it('llama a search_part_keys con REF tal cual, «contiene», los filtros y la página', async () => {
    respuestas.push({ data: [fila('62052RS', 3), fila('62052RSC3', 1)], error: null });
    const page = await fetchPartKeys(
      criterios({ ref: '6205-2rs', brand: 'SKF', area: { kind: 'zone', zone: 'EU' } }),
      2,
    );
    expect(llamadas).toEqual([
      {
        fn: 'search_part_keys',
        args: {
          p_ref: '6205-2rs',
          p_contains: false,
          p_brand: 'SKF',
          p_min_quantity: null,
          p_include: null,
          p_exclude: null,
          p_zone: 'EU',
          p_country: null,
          p_page: 2,
          p_page_size: PART_KEYS_PAGE_SIZE,
        },
      },
    ]);
    expect(page).toEqual({
      keys: [
        { key: '62052RS', offers: 3 },
        { key: '62052RSC3', offers: 1 },
      ],
      totalKeys: 2,
      totalOffers: 4,
      matchedRef: '62052RS',
      truncated: false,
      page: 2,
      pageCount: 1,
    });
  });

  it('caso 1.3: si se encontró con una cadena más corta, lo dice', async () => {
    respuestas.push({ data: [fila('62052RS', 3, '62052R')], error: null });
    const page = await fetchPartKeys(criterios({ ref: '6205-2RX' }));
    expect(page).toMatchObject({ matchedRef: '62052R', truncated: true });
  });

  it('caso 1.4: cero claves, sin cadena encontrada', async () => {
    const page = await fetchPartKeys(criterios({ ref: 'XQXQ' }));
    expect(page).toMatchObject({ keys: [], totalKeys: 0, matchedRef: null, truncated: false, pageCount: 1 });
  });

  it('los totales de la RPC llegan como bigint en texto y salen como número', async () => {
    respuestas.push({
      data: [{ part_key: 'A', offers: '61', total_keys: '61', total_offers: '61', matched_ref: 'A' }],
      error: null,
    });
    const page = await fetchPartKeys(criterios({ ref: 'A' }));
    expect(page).toMatchObject({ totalKeys: 61, pageCount: 2, keys: [{ key: 'A', offers: 61 }] });
  });

  it('un error de la RPC no se traga', async () => {
    respuestas.push({ data: null, error: { code: '22023', message: 'La referencia es obligatoria' } });
    await expect(fetchPartKeys(criterios({ ref: '--' }))).rejects.toMatchObject({ code: '22023' });
  });
});

// -----------------------------------------------------------------------------

describe('fetchOffers · fase C', () => {
  const oferta = (id: string, org_id: string, total = 2) => ({
    id,
    part_number: '6205-2RS',
    part_key: '62052RS',
    brand: 'SKF',
    quantity: 10,
    lead_time_days: null,
    location_country: 'DE',
    last_upload_at: '2026-10-24T10:00:00Z',
    org_id,
    org_name: 'Nordwälz Lager',
    org_country: 'DE',
    org_continent: 'EU',
    favorite_count: 3,
    total,
  });

  it('por claves: manda p_keys y no p_ref', async () => {
    respuestas.push({ data: [], error: null });
    await fetchOffers({
      orgId: 'yo',
      memberId: 'm',
      criteria: criterios({ ref: '6205', contains: true, minQuantity: 5 }),
      selection: { kind: 'keys', keys: ['62052RS', '6205 ZZ'] },
    });
    expect(llamadas[0]).toEqual({
      fn: 'search_offers',
      args: {
        p_keys: ['62052RS', '6205 ZZ'],
        p_brand: null,
        p_min_quantity: 5,
        p_include: null,
        p_exclude: null,
        p_zone: null,
        p_country: null,
        p_page: 1,
        p_page_size: OFFERS_PAGE_SIZE,
      },
    });
  });

  it('todas: manda la cadena con la que se encontró, no la que se escribió', async () => {
    respuestas.push({ data: [], error: null });
    await fetchOffers({
      orgId: 'yo',
      memberId: 'm',
      criteria: criterios({ ref: '6205-2RX', contains: true }),
      selection: { kind: 'all', matchedRef: '62052R' },
      page: 3,
    });
    expect(llamadas[0]?.args).toMatchObject({ p_ref: '62052R', p_contains: true, p_page: 3 });
    expect(llamadas[0]?.args).not.toHaveProperty('p_keys');
  });

  it('las filas salen con la forma de SearchResultRow, con favoritos y consultadas', async () => {
    respuestas.push({ data: [oferta('l1', 'o1'), oferta('l2', 'o2')], error: null });
    fetchFavoriteOrgIds.mockResolvedValueOnce(new Set(['o2']));
    fetchConsultedLineIds.mockResolvedValueOnce(new Set(['l1']));

    const page = await fetchOffers({
      orgId: 'yo',
      memberId: 'm',
      criteria: criterios({ ref: '6205' }),
      selection: { kind: 'keys', keys: ['62052RS'] },
    });

    expect(fetchConsultedLineIds).toHaveBeenCalledWith('yo', ['l1', 'l2']);
    expect(page.total).toBe(2);
    expect(page.pageCount).toBe(1);
    expect(page.rows[0]).toEqual({
      id: 'l1',
      partNumber: '6205-2RS',
      brand: 'SKF',
      quantity: 10,
      leadTimeDays: null,
      orgId: 'o1',
      orgName: 'Nordwälz Lager',
      country: 'DE',
      lastUploadAt: '2026-10-24T10:00:00Z',
      favoriteCount: 3,
      isFavorite: false,
      consulted: true,
    });
    expect(page.rows[1]).toMatchObject({ isFavorite: true, consulted: false });
  });

  it('usa los favoritos ya pedidos si se los pasan', async () => {
    respuestas.push({ data: [oferta('l1', 'o1', 1)], error: null });
    const page = await fetchOffers({
      orgId: 'yo',
      memberId: 'm',
      criteria: criterios({ ref: '6205' }),
      selection: { kind: 'keys', keys: ['62052RS'] },
      favoritos: Promise.resolve(new Set(['o1'])),
    });
    expect(fetchFavoriteOrgIds).not.toHaveBeenCalled();
    expect(page.rows[0]?.isFavorite).toBe(true);
  });
});
