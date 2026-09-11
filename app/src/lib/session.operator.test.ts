import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProfile } from './session';

/**
 * La bifurcación del arranque de sesión: miembro, Operador de Plataforma, o
 * cuenta a medio provisionar.
 *
 * Se prueba aquí y no en `session.test.ts` porque esto necesita mock de la capa
 * de red y aquel fichero es de lógica pura. El mock encadena por `Proxy`, igual
 * que `panel.queries.test.ts`, y por la misma razón: la cadena termina en
 * `maybeSingle()`, no en `order()`.
 *
 * **Lo que se pone a prueba es lo que NO daría error si estuviera mal.** Un
 * nombre de tabla equivocado, una columna que no existe o un `select` de más no
 * rompen nada visible: devuelven cero filas, y cero filas aquí significa "no es
 * Operador" -- que es exactamente el fallo que este código viene a arreglar, con
 * el Operador rebotado al login. Por eso los asertos miran la consulta, no solo
 * el resultado.
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
          const r = respuestas.shift() ?? { data: null, error: null };
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

const UID = '0e000001-0000-0000-0000-000000000001';
const EMAIL = 'operador@bearingworld.test';

function tablasConsultadas(): string[] {
  return llamadas.filter((l) => l.metodo === 'from').map((l) => String(l.args[0]));
}

beforeEach(() => {
  llamadas = [];
  respuestas = [];
});

describe('quien entra es miembro', () => {
  it('sale con su organización y NO se pregunta por operadores', async () => {
    respuestas = [
      {
        data: {
          id: UID,
          email: 'alpha@bearingworld.test',
          full_name: 'Ana Alpha',
          role: 'ADMIN',
          state: 'ACTIVE',
          org_id: 'a1000000-0000-4000-8000-000000000001',
          organizations: { name: 'Rodamientos Ibéricos', country: 'ES' },
        },
        error: null,
      },
    ];

    const estado = await loadProfile(UID, 'alpha@bearingworld.test');

    expect(estado.status).toBe('authenticated');
    // El camino normal es el de los miembros, que son todos menos un puñado: no
    // puede pagar una consulta de más en cada arranque de sesión.
    expect(tablasConsultadas()).toEqual(['members']);
  });
});

describe('quien entra es Operador de Plataforma', () => {
  it('entra como operador en vez de rebotar al login', async () => {
    respuestas = [
      { data: null, error: null }, // no hay fila en `members`
      { data: { id: UID, full_name: 'Operadora de Plataforma' }, error: null },
    ];

    const estado = await loadProfile(UID, EMAIL);

    expect(estado.status).toBe('operator');
    if (estado.status !== 'operator') throw new Error('rama imposible');
    expect(estado.profile.id).toBe(UID);
    expect(estado.profile.fullName).toBe('Operadora de Plataforma');
    // El correo sale de la SESIÓN, no de la tabla: `platform_operators` no lo
    // guarda, y duplicarlo allí sería un segundo sitio donde puede quedarse viejo.
    expect(estado.profile.email).toBe(EMAIL);
  });

  it('pregunta por la tabla y las columnas que existen de verdad', async () => {
    respuestas = [
      { data: null, error: null },
      { data: { id: UID, full_name: null }, error: null },
    ];

    await loadProfile(UID, EMAIL);

    expect(tablasConsultadas()).toEqual(['members', 'platform_operators']);
    expect(llamadas).toContainEqual({ metodo: 'select', args: ['id, full_name'] });
    expect(llamadas).toContainEqual({ metodo: 'eq', args: ['id', UID] });
    // `maybeSingle` y no `single`: cero filas es la respuesta normal para quien
    // no es Operador, y `single` lo convertiría en un error que tumbaría el
    // login de cualquier cuenta a medio provisionar.
    expect(llamadas.some((l) => l.metodo === 'maybeSingle')).toBe(true);
  });

  it('un Operador sin nombre sigue siendo Operador', async () => {
    respuestas = [
      { data: null, error: null },
      { data: { id: UID, full_name: null }, error: null },
    ];

    const estado = await loadProfile(UID, EMAIL);

    expect(estado.status).toBe('operator');
    if (estado.status !== 'operator') throw new Error('rama imposible');
    expect(estado.profile.fullName).toBeNull();
  });
});

describe('quien entra no es ni una cosa ni la otra', () => {
  it('sigue siendo una cuenta a medio provisionar', async () => {
    respuestas = [
      { data: null, error: null },
      { data: null, error: null },
    ];

    const estado = await loadProfile(UID, EMAIL);

    expect(estado.status).toBe('orphan');
  });

  it('y un fallo de la consulta de operadores NO se traga', async () => {
    // Cero filas significa "no es Operador"; un error significa otra cosa muy
    // distinta y no se puede confundir con ella. Si esto se tragara, un problema
    // de red o de permisos se vería como "esta cuenta no está asignada a ninguna
    // organización" -- un mensaje que manda a quien lo lee a buscar por el sitio
    // equivocado.
    respuestas = [
      { data: null, error: null },
      { data: null, error: { message: 'permission denied for table platform_operators' } },
    ];

    await expect(loadProfile(UID, EMAIL)).rejects.toBeTruthy();
  });
});
