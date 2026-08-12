import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VeraPanel } from './VeraPanel';
import type { MemberProfile } from '../lib/session';
import type { ProxyCall, ProxyTurn } from '../lib/vera';

/**
 * VERA conectada · el cableado del día 9.
 *
 * **Fichero aparte a propósito.** `VeraPanel.test.tsx` es el contrato del panel
 * tal como se construyó el día 2 y monta siempre `<VeraPanel />` sin props: ese
 * caso sigue existiendo —panel sin agente, que declara que no está conectado— y
 * no se toca. Aquí se prueba lo que hoy es nuevo: el panel CON agente.
 *
 * El cliente LLM va mockeado (`CLAUDE.md` §5).
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

function agente(call: ProxyCall) {
  return { profile: PERFIL, navigate: vi.fn(), setCriteria: vi.fn(), call };
}

async function preguntar(texto: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Pregunta a VERA'), texto);
  await user.click(screen.getByLabelText('Enviar'));
}

describe('VeraPanel con agente', () => {
  it('pinta la respuesta del modelo en el hilo', async () => {
    const call: ProxyCall = async () => turno({ text: 'Tienes 3 negociaciones abiertas.' });
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('¿cuántas negociaciones tengo?');

    expect(await screen.findByText('Tienes 3 negociaciones abiertas.')).toBeInTheDocument();
  });

  /**
   * Ancla positiva y aserto negativo EN EL MISMO `it`, que es lo que costó
   * F-074: separados, el negativo lo pasa una pantalla que no ha pintado nada.
   */
  it('conectada, ya no dice que no está conectada', async () => {
    const call: ProxyCall = async () => turno({ text: 'Listo.' });
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('hola');

    expect(await screen.findByText('Listo.')).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no estoy conectada/)).not.toBeInTheDocument();
  });

  it('mientras espera lo dice, y no deja reenviar', async () => {
    // `!` y una sola promesa: con `let x: F | null = null` dentro del ejecutor,
    // el análisis de flujo de TS estrecha la variable a `never` en el `?.()`.
    let resolver!: (t: ProxyTurn) => void;
    const enVuelo = new Promise<ProxyTurn>((res) => {
      resolver = res;
    });
    const call: ProxyCall = () => enVuelo;
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('busca 6205-2RS');

    expect(await screen.findByTestId('vera-pensando')).toBeInTheDocument();
    expect(screen.getByLabelText('Enviar')).toBeDisabled();

    resolver(turno({ text: 'Ya está.' }));
    expect(await screen.findByText('Ya está.')).toBeInTheDocument();
    expect(screen.queryByTestId('vera-pensando')).not.toBeInTheDocument();
  });

  /**
   * Un fallo del proxy se dice. Si se tragara la excepción, el panel se quedaría
   * con el mensaje del usuario y sin respuesta — indistinguible de que VERA haya
   * decidido no contestar, que es la peor lectura posible.
   */
  it('un fallo del proxy se cuenta, no se traga', async () => {
    const call: ProxyCall = async () => {
      throw new Error('VERA no está configurada: falta ANTHROPIC_API_KEY en el entorno de la función.');
    };
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('¿qué tal?');

    expect(await screen.findByText(/falta ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  it('el mensaje del usuario aparece aunque la respuesta tarde', async () => {
    const call: ProxyCall = () => new Promise<ProxyTurn>(() => {});
    render(<VeraPanel agent={agente(call)} />);

    await preguntar('6205-2RS en Europa');

    await waitFor(() => {
      expect(screen.getByText('6205-2RS en Europa')).toBeInTheDocument();
    });
  });
});
