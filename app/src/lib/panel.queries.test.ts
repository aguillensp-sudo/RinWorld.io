import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchMonth, fetchPendingQueries, monthStart } from './panel';

/**
 * Las CONSULTAS de PANEL-01, no su lógica pura.
 *
 * Aquí se prueba lo que no da error cuando está mal: un filtro que falta, una
 * columna de fecha equivocada, un `.eq` donde tenía que ir un `.neq`. Nada de
 * eso rompe — devuelve otro número, y un dashboard con otro número es
 * indistinguible de uno correcto.
 *
 * El mock encadena por `Proxy` porque las tres consultas terminan en métodos
 * distintos (`limit`, `gte`): un mock que resolviera solo en `order`, como el de
 * `sent-offers.test.ts`, no serviría para las tres.
 */

interface Llamada {
  metodo: string;
  args: unknown[];
}

let llamadas: Llamada[] = [];
let respuestas: unknown[] = [];

function cadena(): unknown {
  const api: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const r = respuestas.shift() ?? { data: [], error: null, count: 0 };
          return (res: (v: unknown) => void) => res(r);
        }
        return (...args: unknown[]) => {
          llamadas.push({ metodo: prop, args });
          return api;
        };
      },
    },
  );
  return api;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      llamadas.push({ metodo: 'from', args: [tabla] });
      return cadena();
    },
  },
}));

const ORG = 'org-alpha';

/** ¿Se llamó a `metodo` con estos argumentos, en cualquier punto de la cadena? */
function seLlamo(metodo: string, ...args: unknown[]): boolean {
  return llamadas.some(
    (l) => l.metodo === metodo && args.every((a, i) => JSON.stringify(l.args[i]) === JSON.stringify(a)),
  );
}

beforeEach(() => {
  llamadas = [];
  respuestas = [];
});

// -----------------------------------------------------------------------------

describe('fetchPendingQueries · las consultas sin respuesta en firme', () => {
  const FILA = {
    part_number: '6205-2RS',
    created_at: '2026-08-11T10:00:00Z',
    threads: {
      org_low_id: ORG,
      org_high_id: 'org-nsk',
      org_low: { name: 'Alpha Rodamientos' },
      org_high: { name: 'NSK Europe Ltd' },
    },
  };

  it('filtra por CONSULTA, por mi organización y por estado_consulta Pendiente', async () => {
    respuestas = [{ data: [FILA], error: null, count: 4 }];
    await fetchPendingQueries(ORG);

    expect(seLlamo('from', 'thread_items')).toBe(true);
    expect(seLlamo('eq', 'item_type', 'CONSULTA')).toBe(true);
    expect(seLlamo('eq', 'sender_org_id', ORG)).toBe(true);
    expect(seLlamo('eq', 'estado_consulta', 'Pendiente')).toBe(true);
  });

  /**
   * La definición es la del esquema, no una inventada. Si alguien la cambiara a
   * "nadie escribió después", este aserto es el que lo detendría.
   */
  it('NO cuenta por ausencia de elementos posteriores: usa el estado del esquema', async () => {
    respuestas = [{ data: [FILA], error: null, count: 4 }];
    await fetchPendingQueries(ORG);

    expect(seLlamo('eq', 'estado_consulta', 'Pendiente')).toBe(true);
    expect(seLlamo('eq', 'estado_consulta', 'Respondida con oferta')).toBe(false);
  });

  it('trae una sola fila pero el recuento es de todas', async () => {
    respuestas = [{ data: [FILA], error: null, count: 4 }];
    const r = await fetchPendingQueries(ORG);

    expect(seLlamo('limit', 1)).toBe(true);
    expect(seLlamo('order', 'created_at', { ascending: false })).toBe(true);
    expect(r.count).toBe(4);
  });

  it('la contraparte es la organización que NO soy yo', async () => {
    respuestas = [{ data: [FILA], error: null, count: 1 }];
    const r = await fetchPendingQueries(ORG);
    expect(r.latest?.orgName).toBe('NSK Europe Ltd');
  });

  /**
   * El par va en orden canónico en base, no por rol: yo puedo ser el `org_high`.
   * Sin este caso, la mitad de los hilos enseñarían mi propio nombre como
   * contraparte — plausible y absurdo, y sin error.
   */
  it('y también cuando soy yo el org_high', async () => {
    respuestas = [
      {
        data: [{ ...FILA, threads: { ...FILA.threads, org_low_id: 'org-nsk', org_high_id: ORG } }],
        error: null,
        count: 1,
      },
    ];
    const r = await fetchPendingQueries(ORG);
    expect(r.latest?.orgName).toBe('Alpha Rodamientos');
  });

  it('sin filas no hay línea de detalle, pero el recuento se conserva', async () => {
    respuestas = [{ data: [], error: null, count: 0 }];
    const r = await fetchPendingQueries(ORG);
    expect(r.latest).toBeNull();
    expect(r.count).toBe(0);
  });

  it('un error de la base se propaga, no se convierte en cero', async () => {
    respuestas = [{ data: null, error: { message: 'PGRST200' }, count: null }];
    await expect(fetchPendingQueries(ORG)).rejects.toBeTruthy();
  });
});

// -----------------------------------------------------------------------------

describe('fetchMonth · las tres cifras del Resumen mes', () => {
  const NOW = new Date(2026, 7, 13, 18, 0);
  const DESDE = monthStart(NOW);
  const OK = { data: null, error: null, count: 3 };

  beforeEach(() => {
    respuestas = [OK, { ...OK, count: 5 }, { ...OK, count: 9 }];
  });

  /**
   * ⚠ EL ASERTO QUE MÁS IMPORTA DE ESTE FICHERO. Una oferta enviada en julio y
   * aceptada en agosto se aceptó EN AGOSTO. Contarla por `created_at` la sacaría
   * del mes, y el número saldría más bajo sin que nada fallara. `0007:56` añadió
   * `estado_changed_at` exactamente para esto.
   */
  it('las aceptadas se cuentan por estado_changed_at, no por created_at', async () => {
    await fetchMonth(ORG, NOW);
    expect(seLlamo('gte', 'estado_changed_at', DESDE)).toBe(true);
  });

  it('las realizadas sí van por created_at, que es cuando se enviaron', async () => {
    await fetchMonth(ORG, NOW);
    expect(seLlamo('gte', 'created_at', DESDE)).toBe(true);
    expect(seLlamo('eq', 'estado_oferta', 'Aceptada')).toBe(true);
  });

  /**
   * Las recibidas son "las que no envié yo": RLS ya limita `thread_items` a los
   * hilos en los que participo, así que un `.neq` sobre el emisor es exacto. Un
   * `.eq` sobre mi organización contaría justo las contrarias.
   */
  it('las consultas recibidas se filtran con neq sobre el emisor, no con eq', async () => {
    await fetchMonth(ORG, NOW);
    expect(seLlamo('neq', 'sender_org_id', ORG)).toBe(true);
  });

  it('las tres cuentan sin descargar filas', async () => {
    await fetchMonth(ORG, NOW);
    const conteos = llamadas.filter(
      (l) => l.metodo === 'select' && JSON.stringify(l.args[1]) === JSON.stringify({ count: 'exact', head: true }),
    );
    expect(conteos).toHaveLength(3);
  });

  it('devuelve las tres cifras en su sitio', async () => {
    const m = await fetchMonth(ORG, NOW);
    expect(m.acceptedOffers).toBe(3);
    expect(m.madeOffers).toBe(5);
    expect(m.receivedQueries).toBe(9);
  });

  it('un error en cualquiera de las tres se propaga', async () => {
    respuestas = [OK, { data: null, error: { message: 'boom' }, count: null }, OK];
    await expect(fetchMonth(ORG, NOW)).rejects.toBeTruthy();
  });
});
