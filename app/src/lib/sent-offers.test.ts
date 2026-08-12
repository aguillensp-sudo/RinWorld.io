import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DEFAULT_SORT,
  EMPTY_NO_MATCHES,
  EMPTY_NO_OFFERS,
  SEARCH_PLACEHOLDER,
  SUBTITLE,
  type SentOffer,
  fetchSentOffers,
  filterSentOffers,
  resultCountLabel,
  rowActionLabel,
  sentAtLabel,
  sortSentOffers,
} from './sent-offers';

/**
 * La lógica pura de VND-01 y su consulta. **Estos tests son los míos, no el
 * contrato del arnés** — el contrato vive en `screens/selling/SentOffers.test.tsx`
 * y el Coder no lo ve (`CLAUDE.md` §3).
 */

const consultas: { metodo: string; args: unknown[] }[] = [];
let filas: unknown[] = [];

vi.mock('./supabase', () => {
  const constructor = () => {
    const api = {
      select: (...a: unknown[]) => {
        consultas.push({ metodo: 'select', args: a });
        return api;
      },
      eq: (...a: unknown[]) => {
        consultas.push({ metodo: 'eq', args: a });
        return api;
      },
      order: (...a: unknown[]) => {
        consultas.push({ metodo: 'order', args: a });
        return Promise.resolve({ data: filas, error: null });
      },
    };
    return api;
  };
  return { supabase: { from: (t: string) => { consultas.push({ metodo: 'from', args: [t] }); return constructor(); } } };
});

beforeEach(() => {
  consultas.length = 0;
  filas = [];
});

const MIA = 'a1000000-0000-4000-8000-000000000001';

function oferta(over: Partial<SentOffer> = {}): SentOffer {
  return {
    id: 'of-1',
    threadId: 'h-1',
    partNumber: '6205-2RS',
    brand: 'NSK',
    counterpartyId: 'org-b',
    counterpartyName: 'Nordwälz Lager',
    state: 'Pendiente',
    createdAt: '2026-08-10T10:00:00Z',
    ...over,
  };
}

describe('RNG-VND-01 · la consulta no pide nada cifrado', () => {
  it('ANCLA · pide los metadatos, y NINGUNA columna de contenido', async () => {
    await fetchSentOffers(MIA);
    const select = consultas.find((c) => c.metodo === 'select');
    const cols = String(select?.args[0] ?? '');

    // Ancla: la consulta existe y trae lo que la tabla necesita.
    expect(cols).toContain('part_number');
    expect(cols).toContain('estado_oferta');
    expect(cols).toContain('created_at');

    // Y el ámbito: lo que no puede salir de aquí. Va contra la MISMA cadena que
    // el ancla acaba de comprobar que no está vacía (F-059).
    expect(cols).not.toContain('content_ciphertext');
    expect(cols).not.toContain('content_iv');
  });

  it('los embeds van con la clave ajena nombrada (F-020)', async () => {
    await fetchSentOffers(MIA);
    const cols = String(consultas.find((c) => c.metodo === 'select')?.args[0] ?? '');
    expect(cols).toContain('threads_org_low_id_fkey');
    expect(cols).toContain('threads_org_high_id_fkey');
  });
});

describe('RNG-VND-02 · solo lo que YO he emitido', () => {
  it('filtra por sender_org_id, que es lo único que separa mis ofertas de las de mis hilos', async () => {
    await fetchSentOffers(MIA);
    const eqs = consultas.filter((c) => c.metodo === 'eq').map((c) => c.args);

    // RLS deja ver las dos direcciones —filtra por hilo, no por emisor—, así que
    // sin este `eq` la pantalla enseñaría las ofertas del comprador junto a las
    // mías y parecería que funciona.
    expect(eqs).toContainEqual(['sender_org_id', MIA]);
    expect(eqs).toContainEqual(['item_type', 'OFERTA']);
  });

  it('la contraparte es la organización que NO es la mía, en los dos órdenes del par', async () => {
    filas = [
      {
        id: 'of-1', thread_id: 'h-1', estado_oferta: 'Pendiente',
        part_number: '6205-2RS', brand: 'NSK', created_at: '2026-08-10T10:00:00Z',
        threads: {
          org_low_id: MIA, org_high_id: 'org-b',
          org_low: { id: MIA, name: 'Rodamientos Ibéricos' },
          org_high: { id: 'org-b', name: 'Nordwälz Lager' },
        },
      },
      {
        id: 'of-2', thread_id: 'h-2', estado_oferta: 'Aceptada',
        part_number: '22316-E', brand: 'Timken', created_at: '2026-08-09T10:00:00Z',
        threads: {
          org_low_id: 'org-c', org_high_id: MIA,
          org_low: { id: 'org-c', name: 'Cuscinetti Padana' },
          org_high: { id: MIA, name: 'Rodamientos Ibéricos' },
        },
      },
    ];

    const salida = await fetchSentOffers(MIA);
    expect(salida.map((o) => o.counterpartyName)).toEqual([
      'Nordwälz Lager',
      'Cuscinetti Padana',
    ]);
  });

  it('sin embed resuelto pone un guion, no una celda en blanco', async () => {
    filas = [
      {
        id: 'of-1', thread_id: 'h-1', estado_oferta: 'Pendiente',
        part_number: '6205-2RS', brand: 'NSK', created_at: '2026-08-10T10:00:00Z',
        threads: null,
      },
    ];
    const [uno] = await fetchSentOffers(MIA);
    expect(uno!.counterpartyName).toBe('—');
  });
});

describe('las acciones que quedan (D-07-02 y sin EXPIRADA)', () => {
  it('`Ver acuerdo` solo con la oferta aceptada; `Ver hilo` en los otros tres', () => {
    expect(rowActionLabel('Aceptada')).toBe('Ver acuerdo');
    expect(rowActionLabel('Pendiente')).toBe('Ver hilo');
    expect(rowActionLabel('Rechazada')).toBe('Ver hilo');
    expect(rowActionLabel('Superada por contraoferta')).toBe('Ver hilo');
  });

  it('los cuatro estados del esquema tienen etiqueta, incluido el que la §5.2 no menciona', () => {
    // `Superada por contraoferta` existe en el CHECK de 0003 y es terminal. La
    // §5.2 de VND-01 solo lista tres más `EXPIRADA`: si esta pantalla no lo
    // pintara, mentiría por omisión sobre una oferta que existe.
    for (const estado of ['Pendiente', 'Aceptada', 'Rechazada', 'Superada por contraoferta'] as const) {
      expect(rowActionLabel(estado).length).toBeGreaterThan(0);
    }
  });
});

describe('el filtro de la §4', () => {
  const lista = [
    oferta({ id: '1', partNumber: '6205-2RS', brand: 'NSK', counterpartyName: 'Nordwälz Lager' }),
    oferta({ id: '2', partNumber: '22316-E', brand: 'Timken', counterpartyName: 'Cuscinetti Padana' }),
  ];

  it('busca por referencia', () => {
    expect(filterSentOffers(lista, '6205').map((o) => o.id)).toEqual(['1']);
  });

  it('busca por marca, porque la columna 1 enseña referencia · marca como una sola cosa', () => {
    expect(filterSentOffers(lista, 'timken').map((o) => o.id)).toEqual(['2']);
  });

  it('busca por organización y no distingue mayúsculas', () => {
    expect(filterSentOffers(lista, 'NORDWÄLZ').map((o) => o.id)).toEqual(['1']);
  });

  it('una búsqueda vacía o de espacios devuelve todo', () => {
    expect(filterSentOffers(lista, '')).toHaveLength(2);
    expect(filterSentOffers(lista, '   ')).toHaveLength(2);
  });
});

describe('la ordenación de la §5.4', () => {
  const lista = [
    oferta({ id: 'a', counterpartyName: 'Zaragoza Rodamientos', createdAt: '2026-08-01T10:00:00Z' }),
    oferta({ id: 'b', counterpartyName: 'Ácido Bearings', createdAt: '2026-08-10T10:00:00Z' }),
    oferta({ id: 'c', counterpartyName: 'Nordwälz Lager', createdAt: '2026-08-05T10:00:00Z' }),
  ];

  it('el orden por defecto es fecha descendente', () => {
    expect(DEFAULT_SORT).toEqual({ column: 'fecha', direction: 'desc' });
    expect(sortSentOffers(lista, 'fecha', 'desc').map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('invertir el sentido invierte la lista', () => {
    expect(sortSentOffers(lista, 'fecha', 'asc').map((o) => o.id)).toEqual(['a', 'c', 'b']);
  });

  it('⚠ la organización se ordena con acentos, no por punto de código', () => {
    // Con `<` a secas, `Ácido` se va detrás de `Zaragoza`. La columna lleva
    // nombres como `Nordwälz Lager` y `Łożyska Wschód`: no es un caso raro.
    expect(sortSentOffers(lista, 'organizacion', 'asc').map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('no muta la lista que recibe', () => {
    const original = [...lista];
    sortSentOffers(lista, 'organizacion', 'asc');
    expect(lista).toEqual(original);
  });

  it('el desempate es siempre por fecha descendente', () => {
    // Ordenar por Estado con cuatro valores y N filas dejaría el resto al albur
    // del motor de `sort`, y la tabla parecería barajarse sola.
    const mismas = [
      oferta({ id: 'x', state: 'Pendiente', createdAt: '2026-08-01T10:00:00Z' }),
      oferta({ id: 'y', state: 'Pendiente', createdAt: '2026-08-09T10:00:00Z' }),
    ];
    expect(sortSentOffers(mismas, 'estado', 'asc').map((o) => o.id)).toEqual(['y', 'x']);
    expect(sortSentOffers([...mismas].reverse(), 'estado', 'asc').map((o) => o.id)).toEqual(['y', 'x']);
  });
});

describe('los literales que ve el usuario', () => {
  it('el conteo dice `1 oferta` en singular', () => {
    // `1 ofertas` delante del socio es la clase de detalle que le hace dudar del
    // resto de la pantalla.
    expect(resultCountLabel(1)).toBe('1 oferta');
    expect(resultCountLabel(0)).toBe('0 ofertas');
    expect(resultCountLabel(7)).toBe('7 ofertas');
  });

  it('la fecha sale como DD Mmm YYYY y nunca como un ISO en crudo', () => {
    // El defecto que la revisión a mano del día 7 encontró y ningún check vio.
    const salida = sentAtLabel('2026-08-10T10:00:00Z');
    expect(salida).not.toContain('T');
    expect(salida).toMatch(/^\d{2} \w+\.? 2026$/);
  });

  it('una fecha ilegible se devuelve tal cual, sin inventar un guion', () => {
    expect(sentAtLabel('no soy una fecha')).toBe('no soy una fecha');
  });

  it('los dos estados vacíos dicen cosas distintas', () => {
    // Uno es "no has enviado ninguna" y el otro "tu búsqueda no encuentra". Si
    // fueran el mismo texto, buscar mal parecería no tener ofertas.
    expect(EMPTY_NO_OFFERS).not.toBe(EMPTY_NO_MATCHES);
    expect(EMPTY_NO_OFFERS).toBe('No tienes ofertas enviadas aún.');
    expect(EMPTY_NO_MATCHES).toBe('No hay ofertas que coincidan con la búsqueda.');
  });

  it('el subtítulo dice dónde SÍ se ven el precio y las condiciones', () => {
    // Es RNG-VND-01 explicado al usuario en vez de una ausencia sin motivo.
    expect(SUBTITLE).toContain('abre el hilo correspondiente');
    expect(SEARCH_PLACEHOLDER).toBe('Buscar por referencia u organización…');
  });
});
