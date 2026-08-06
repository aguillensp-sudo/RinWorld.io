import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VeraPanel } from './VeraPanel';

describe('VeraPanel', () => {
  it('saluda al abrir', () => {
    render(<VeraPanel />);
    expect(screen.getByText(/Soy VERA, tu asistente/)).toBeInTheDocument();
  });

  it('colapsa y expande', async () => {
    render(<VeraPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Colapsar VERA' }));
    // Colapsado: el chat y el input desaparecen y aparece la etiqueta vertical.
    expect(screen.getByRole('button', { name: 'Expandir VERA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VERA' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expandir VERA' }));
    expect(screen.getByRole('button', { name: 'Colapsar VERA' })).toBeInTheDocument();
  });

  /**
   * Este es el test que importa de VERA hoy. CLAUDE.md §7: el riesgo #1 del
   * proyecto es VERA afirmando con aplomo algo que no sabe. El shell aprobado
   * responde "Entendido. ¿Algo más?" a cualquier cosa; si eso llegara al
   * andamiaje, delante del socio se leería como un agente funcionando. Hasta el
   * día 9, VERA tiene que declarar que no está conectada.
   */
  it('no finge saber: declara que no está conectada', async () => {
    render(<VeraPanel />);
    await userEvent.type(screen.getByLabelText('Pregunta a VERA'), '¿tienes 6205 en Polonia?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(screen.getByText(/Todavía no estoy conectada/)).toBeInTheDocument();
    expect(screen.queryByText(/Entendido\. ¿Algo más\?/)).not.toBeInTheDocument();
  });

  it('devuelve el mensaje del usuario al hilo', async () => {
    render(<VeraPanel />);
    await userEvent.type(screen.getByLabelText('Pregunta a VERA'), 'hola{Enter}');
    expect(screen.getByText('hola')).toBeInTheDocument();
  });

  it('no envía nada en blanco', async () => {
    render(<VeraPanel />);
    const before = screen.getByTestId('vera-chat').children.length;
    await userEvent.type(screen.getByLabelText('Pregunta a VERA'), '   {Enter}');
    expect(screen.getByTestId('vera-chat').children.length).toBe(before);
  });
});
