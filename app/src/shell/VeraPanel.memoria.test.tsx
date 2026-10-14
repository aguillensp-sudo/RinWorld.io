import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VeraPanel, type VeraAgent } from './VeraPanel';
import type { MemberProfile } from '../lib/session';
import { HISTORY_TTL_MS, type ProxyCall, type ProxyRequest, type ProxyTurn } from '../lib/vera';

/**
 * El panel recuerda la conversación (`F-101`, decisión del PO del 14-oct-2026). Cliente LLM mockeado
 * (`CLAUDE.md` §5): se prueba lo que el panel le manda, no lo que el modelo hace con ello.
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

function turno(p: Partial<ProxyTurn>): ProxyTurn {
  return { stopReason: 'end_turn', text: '', toolUses: [], raw: [], ...p };
}

function agente(call: ProxyCall, extra: Partial<VeraAgent> = {}): VeraAgent {
  return { profile: PERFIL, navigate: vi.fn(), setCriteria: vi.fn(), threadOpen: false, prepareDraft: vi.fn(), call, ...extra };
}

async function preguntar(texto: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Pregunta a VERA'), texto);
  await user.click(screen.getByLabelText('Enviar'));
}

describe('VeraPanel · memoria de la conversación', () => {
  it('la segunda pregunta lleva la primera y su respuesta', async () => {
    const pedidas: ProxyRequest[] = [];
    const respuestas = ['Te he puesto en Comprando 6204-2RS: 11 resultados.', 'Ahora 4 en Europa.'];
    const call: ProxyCall = async (b) => (pedidas.push(b), turno({ text: respuestas[pedidas.length - 1] ?? '' }));
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('busca 6204-2RS');
    await screen.findByText(respuestas[0]!);
    await preguntar('solo en Europa');
    await screen.findByText(respuestas[1]!);

    expect(pedidas[1]!.messages).toEqual([
      { role: 'user', content: 'busca 6204-2RS' },
      { role: 'assistant', content: respuestas[0] },
      { role: 'user', content: 'solo en Europa' },
    ]);
  });

  it('un fallo se pinta pero no se recuerda: no es una respuesta de VERA', async () => {
    const pedidas: ProxyRequest[] = [];
    const call: ProxyCall = async (b) => {
      pedidas.push(b);
      if (pedidas.length === 1) throw new Error('El proxy de VERA respondió 502.');
      return turno({ text: 'Bien.' });
    };
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('primera');
    expect(await screen.findByText('El proxy de VERA respondió 502.')).toBeInTheDocument();
    await preguntar('segunda');
    await screen.findByText('Bien.');

    expect(pedidas[1]!.messages).toEqual([{ role: 'user', content: 'segunda' }]);
  });

  it('el saludo no viaja como si lo hubiera dicho el modelo', async () => {
    const pedidas: ProxyRequest[] = [];
    const call: ProxyCall = async (b) => (pedidas.push(b), turno({ text: 'Hola.' }));
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('hola');
    await screen.findByText('Hola.');

    expect(JSON.stringify(pedidas[0]!.messages)).not.toContain('Soy VERA');
  });

  it('pasadas 24 h desde el inicio de sesión, se purga todo: lo pintado y lo que ve el modelo', async () => {
    const pedidas: ProxyRequest[] = [];
    const call: ProxyCall = async (b) => (pedidas.push(b), turno({ text: `respuesta ${pedidas.length}` }));
    let inicio = Date.now();
    render(<VeraPanel agent={agente(call, { sessionStartedAt: async () => inicio })} />);

    await preguntar('antes de caducar');
    await screen.findByText('respuesta 1');

    inicio = Date.now() - HISTORY_TTL_MS - 1000;
    await preguntar('después de caducar');
    await screen.findByText('respuesta 2');

    expect(pedidas[1]!.messages).toEqual([{ role: 'user', content: 'después de caducar' }]);
    expect(screen.queryByText('antes de caducar')).not.toBeInTheDocument();
    expect(screen.queryByText('respuesta 1')).not.toBeInTheDocument();
    // Ancla positiva: la pregunta nueva sí sigue pintada.
    expect(screen.getByText('después de caducar')).toBeInTheDocument();
  });

  it('antes de las 24 h no se purga nada', async () => {
    const pedidas: ProxyRequest[] = [];
    const call: ProxyCall = async (b) => (pedidas.push(b), turno({ text: `respuesta ${pedidas.length}` }));
    render(<VeraPanel agent={agente(call, { sessionStartedAt: async () => Date.now() - HISTORY_TTL_MS + 60_000 })} />);

    await preguntar('uno');
    await screen.findByText('respuesta 1');
    await preguntar('dos');
    await screen.findByText('respuesta 2');

    expect(pedidas[1]!.messages).toHaveLength(3);
  });
});
