import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberProfile } from './session';
import type { ToolContext } from './vera-tools';
import {
  HISTORY_TTL_MS,
  HISTORY_WINDOW,
  ask,
  createProxyCall,
  historyExpired,
  historyMessages,
  type Exchange,
  type ProxyRequest,
  type ProxyTurn,
} from './vera';

/**
 * La memoria de VERA (`F-101`, decisión del PO del 14-oct-2026, `DECISIONES-V1.md`): el texto de los
 * últimos 20 intercambios, nunca sus herramientas, con lo que queda fuera dicho al modelo.
 *
 * El cliente LLM va mockeado (`CLAUDE.md` §5): aquí se prueba QUÉ SE LE MANDA, no qué contesta. Si
 * el modelo usa bien la memoria solo lo dice una llamada real (plan de pruebas de VERA).
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

const ctx: ToolContext = {
  profile: PERFIL,
  navigate: () => {},
  setCriteria: () => {},
  threadOpen: false,
  prepareDraft: () => {},
};

function turno(p: Partial<ProxyTurn>): ProxyTurn {
  return { stopReason: 'end_turn', text: '', toolUses: [], raw: [], ...p };
}

function intercambios(n: number): Exchange[] {
  return Array.from({ length: n }, (_, i) => ({ question: `pregunta ${i + 1}`, answer: `respuesta ${i + 1}` }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VERA · la memoria que ve el modelo', () => {
  it('sin historial, la conversación es solo la pregunta (lo de antes del 14-oct sigue igual)', async () => {
    const pedidas: ProxyRequest[] = [];
    await ask('¿quién tiene 6204?', ctx, async (b) => (pedidas.push(b), turno({ text: 'ok' })));

    expect(pedidas[0]!.messages).toEqual([{ role: 'user', content: '¿quién tiene 6204?' }]);
    expect(pedidas[0]!.omittedExchanges).toBeUndefined();
  });

  it('con historial, le llegan las preguntas y respuestas anteriores, en orden, antes de la nueva', async () => {
    const pedidas: ProxyRequest[] = [];
    const previo: Exchange[] = [{ question: 'busca 6204-2RS', answer: 'Te he puesto en Comprando 6204-2RS: 11 resultados.' }];

    await ask('ahora solo en Europa', ctx, async (b) => (pedidas.push(b), turno({ text: 'ok' })), previo);

    expect(pedidas[0]!.messages).toEqual([
      { role: 'user', content: 'busca 6204-2RS' },
      { role: 'assistant', content: 'Te he puesto en Comprando 6204-2RS: 11 resultados.' },
      { role: 'user', content: 'ahora solo en Europa' },
    ]);
  });

  it('del historial solo viaja TEXTO: ningún tool_use ni tool_result de preguntas anteriores', () => {
    const { messages } = historyMessages(intercambios(3));
    // Ancla positiva: hay seis mensajes y todos son texto plano.
    expect(messages).toHaveLength(6);
    for (const m of messages) expect(typeof (m as { content: unknown }).content).toBe('string');
    expect(JSON.stringify(messages)).not.toContain('tool_result');
  });

  it(`recorta a los últimos ${HISTORY_WINDOW} intercambios y dice cuántos se han quedado fuera`, async () => {
    const pedidas: ProxyRequest[] = [];
    await ask('y la 6304?', ctx, async (b) => (pedidas.push(b), turno({ text: 'ok' })), intercambios(HISTORY_WINDOW + 5));

    const m = pedidas[0]!.messages as { content: string }[];
    expect(m).toHaveLength(HISTORY_WINDOW * 2 + 1);
    expect(m[0]!.content).toBe('pregunta 6');
    expect(m[m.length - 1]!.content).toBe('y la 6304?');
    expect(pedidas[0]!.omittedExchanges).toBe(5);
  });

  it('justo en la ventana no se omite nada', () => {
    expect(historyMessages(intercambios(HISTORY_WINDOW)).omitted).toBe(0);
  });

  it('el aviso de lo omitido viaja también en las vueltas de herramienta de la misma pregunta', async () => {
    const pedidas: ProxyRequest[] = [];
    let n = 0;
    await ask(
      'llévame a Hilos',
      ctx,
      async (b) => {
        pedidas.push(b);
        n += 1;
        return n === 1
          ? turno({ stopReason: 'tool_use', toolUses: [{ id: 't1', name: 'navegar', input: { pantalla: 'Hilos' } }] })
          : turno({ text: 'Hecho.' });
      },
      intercambios(HISTORY_WINDOW + 1),
    );

    expect(pedidas).toHaveLength(2);
    expect(pedidas.map((p) => p.omittedExchanges)).toEqual([1, 1]);
  });

  it('caduca a las 24 h del inicio de sesión, no antes; sin hora de inicio, no caduca', () => {
    const inicio = Date.UTC(2026, 9, 14, 8, 0, 0);
    expect(historyExpired(inicio, inicio + HISTORY_TTL_MS - 1)).toBe(false);
    expect(historyExpired(inicio, inicio + HISTORY_TTL_MS)).toBe(true);
    expect(historyExpired(null, inicio + 10 * HISTORY_TTL_MS)).toBe(false);
  });
});

describe('VERA · lo que llega al proxy', () => {
  function capturarFetch() {
    const cuerpos: { contexto: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        cuerpos.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }), {
          status: 200,
        });
      }),
    );
    return cuerpos;
  }

  it('los filtros de Comprando viajan en el contexto tal cual', async () => {
    const cuerpos = capturarFetch();
    const call = createProxyCall(async () => 'token', {
      orgName: 'Alpha',
      fullName: null,
      pantalla: 'Comprando (Resultados de búsqueda)',
      filtros: 'referencia=6204 · zona=EU',
    });

    await call({ messages: [{ role: 'user', content: 'solo SKF' }] });

    expect(cuerpos[0]!.contexto.filtros).toBe('referencia=6204 · zona=EU');
    expect(cuerpos[0]!.contexto.intercambiosOmitidos).toBeUndefined();
  });

  it('los intercambios omitidos se dicen en el contexto, no en los mensajes', async () => {
    const cuerpos = capturarFetch();
    const call = createProxyCall(async () => 'token', { orgName: 'Alpha', fullName: null });

    await call({ messages: [{ role: 'user', content: 'hola' }], omittedExchanges: 3 });

    expect(cuerpos[0]!.contexto.intercambiosOmitidos).toBe(3);
  });
});
