import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { MemberProfile } from './session';
import type { Screen, ToolContext } from './vera-tools';
import { MAX_STEPS, ask, proxyUrl, type ProxyCall, type ProxyTurn } from './vera';

/**
 * Contrato del bucle de VERA (D-09-05: el proxy no toca la base; las
 * herramientas se ejecutan aquí, con el JWT del usuario).
 *
 * **El cliente LLM va mockeado siempre** (`CLAUDE.md` §5): estos tests no hacen
 * ni una llamada real, y por eso pueden correr en CI.
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

let navegadoA: Screen[] = [];

function contexto(): ToolContext {
  return {
    profile: PERFIL,
    navigate: (s) => navegadoA.push(s),
    setCriteria: () => {},
  };
}

function turno(p: Partial<ProxyTurn>): ProxyTurn {
  return { stopReason: 'end_turn', text: '', toolUses: [], raw: {}, ...p };
}

beforeEach(() => {
  navegadoA = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// -----------------------------------------------------------------------------
// La URL del proxy
// -----------------------------------------------------------------------------

describe('proxyUrl', () => {
  it('sale del proyecto Supabase configurado y apunta a la función `vera`', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://troxminloxkjwihwfevs.supabase.co');
    expect(proxyUrl()).toBe('https://troxminloxkjwihwfevs.supabase.co/functions/v1/vera');
  });

  it('tolera la barra final sin duplicarla', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://troxminloxkjwihwfevs.supabase.co/');
    expect(proxyUrl()).not.toContain('//functions');
  });
});

// -----------------------------------------------------------------------------
// El bucle
// -----------------------------------------------------------------------------

describe('ask', () => {
  it('devuelve el texto del modelo cuando no pide herramientas', async () => {
    const call: ProxyCall = async () => turno({ text: 'Tienes tres hilos abiertos.' });
    const r = await ask('¿cuántos hilos tengo?', contexto(), call);
    expect(r.text).toBe('Tienes tres hilos abiertos.');
    expect(r.toolsUsed).toEqual([]);
    expect(r.steps).toBe(1);
  });

  it('ejecuta la herramienta que pide el modelo y le devuelve el resultado', async () => {
    const cuerpos: unknown[] = [];
    const call: ProxyCall = async (body) => {
      cuerpos.push(body.messages);
      if (cuerpos.length === 1) {
        return turno({
          stopReason: 'tool_use',
          toolUses: [{ id: 'tu_1', name: 'navegar', input: { pantalla: 'Hilos' } }],
        });
      }
      return turno({ text: 'Ya estás en Hilos.' });
    };

    const r = await ask('llévame a los hilos', contexto(), call);
    expect(navegadoA).toEqual(['Hilos']);
    expect(r.toolsUsed).toEqual(['navegar']);
    expect(r.text).toBe('Ya estás en Hilos.');
    expect(r.steps).toBe(2);
    // La segunda vuelta lleva más mensajes que la primera: el resultado volvió.
    const primera = cuerpos[0] as unknown[];
    const segunda = cuerpos[1] as unknown[];
    expect(segunda.length).toBeGreaterThan(primera.length);
  });

  it('ejecuta varias herramientas de un mismo turno y devuelve TODOS los resultados juntos', async () => {
    let vuelta = 0;
    const call: ProxyCall = async () => {
      vuelta += 1;
      if (vuelta === 1) {
        return turno({
          stopReason: 'tool_use',
          toolUses: [
            { id: 'tu_1', name: 'navegar', input: { pantalla: 'Comprando' } },
            { id: 'tu_2', name: 'navegar', input: { pantalla: 'Inventario' } },
          ],
        });
      }
      return turno({ text: 'Hecho.' });
    };
    const r = await ask('abre las dos', contexto(), call);
    expect(r.toolsUsed).toEqual(['navegar', 'navegar']);
    expect(navegadoA).toEqual(['Comprando', 'Inventario']);
  });

  /**
   * Un modelo que pide herramienta indefinidamente no puede dejar el bucle
   * girando: sale por el tope y lo dice. `MAX_STEPS` llamadas, ni una más.
   */
  it('para en MAX_STEPS aunque el modelo siga pidiendo herramientas', async () => {
    let llamadas = 0;
    const call: ProxyCall = async () => {
      llamadas += 1;
      return turno({
        stopReason: 'tool_use',
        toolUses: [{ id: `tu_${llamadas}`, name: 'navegar', input: { pantalla: 'Panel' } }],
      });
    };
    const r = await ask('gira para siempre', contexto(), call);
    expect(llamadas).toBe(MAX_STEPS);
    expect(r.steps).toBe(MAX_STEPS);
  });

  /**
   * El fallo de una herramienta le llega al modelo COMO FALLO. Si se le
   * devolviera vacío, no podría distinguir "no hay resultados" de "no se pudo
   * consultar" — y responder con aplomo sobre lo segundo es el riesgo #1.
   */
  it('un fallo de herramienta viaja al modelo marcado como error', async () => {
    let recibido: string | null = null;
    const call: ProxyCall = async (body) => {
      const ultimo = body.messages[body.messages.length - 1];
      if (ultimo && JSON.stringify(ultimo).includes('is_error')) {
        recibido = JSON.stringify(ultimo);
        return turno({ text: 'No he podido consultarlo.' });
      }
      return turno({
        stopReason: 'tool_use',
        toolUses: [{ id: 'tu_1', name: 'herramienta_que_no_existe', input: {} }],
      });
    };

    const r = await ask('haz algo imposible', contexto(), call);
    expect(recibido).not.toBeNull();
    expect(recibido).toContain('"is_error":true');
    expect(r.text).toBe('No he podido consultarlo.');
  });

  it('no inventa texto cuando el modelo no devuelve ninguno', async () => {
    const call: ProxyCall = async () => turno({ text: '' });
    const r = await ask('…', contexto(), call);
    expect(r.text).toHaveLength(0);
  });
});
