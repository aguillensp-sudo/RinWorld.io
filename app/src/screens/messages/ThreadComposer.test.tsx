import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CREATE_OFFER_DISABLED_REASON } from '../../lib/thread-detail';
import { ThreadComposer } from './ThreadComposer';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-02 · pie de composición.
 *
 * Escrito por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * ⚠ ESTE CONTRATO CAMBIÓ EL DÍA 8, Y CONVIENE SABER QUÉ SE CAYÓ Y POR QUÉ.
 *
 * El del día 7 decía: *"El componente **no recibe props**, y eso es el contrato,
 * no una omisión"*, y comprobaba que el botón de enviar estuviera deshabilitado
 * con su motivo a la vista. **Las dos cosas eran ciertas mientras no hubiera
 * cifrado en cliente.** D-08-02 lo metió, así que el pie envía y recibe una
 * prop.
 *
 * Lo que NO cambió, y sigue verificado abajo: el pie se pinta igual en los cinco
 * estados del hilo (quien decide montarlo es la pantalla, D-07-01, y eso lo
 * comprueba `Thread.test.tsx`), `Crear oferta` sigue fuera del MVP con su motivo
 * en texto visible, y no hay ningún botón de frase de seguridad (F-027).
 */

/** Un `onSend` que dice que sí y anota lo que le llegó. */
function envioOk() {
  return vi.fn(async (_text: string) => true);
}

describe('el campo de mensaje', () => {
  it('tiene nombre accesible y el placeholder del HTML aprobado', () => {
    render(<ThreadComposer onSend={envioOk()} />);
    const ta = screen.getByRole('textbox', { name: 'Escribe un mensaje' });
    expect(ta).toHaveAttribute('placeholder', 'Escribe un mensaje...');
  });

  it('el botón nace deshabilitado y se habilita al escribir', async () => {
    // ANCLA Y ÁMBITO EN EL MISMO TEST (F-059): "está deshabilitado" lo cumple
    // también un botón que nunca se habilita. Lo que se mide es la transición.
    const user = userEvent.setup();
    render(<ThreadComposer onSend={envioOk()} />);

    const boton = screen.getByRole('button', { name: 'Enviar mensaje' });
    expect(boton).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), 'Hola');
    expect(boton).toBeEnabled();
  });

  it('un mensaje de solo espacios no habilita el envío', async () => {
    const user = userEvent.setup();
    render(<ThreadComposer onSend={envioOk()} />);
    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), '   ');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });
});

describe('el envío (D-08-02)', () => {
  it('manda el texto recortado y vacía el campo', async () => {
    const user = userEvent.setup();
    const onSend = envioOk();
    render(<ThreadComposer onSend={onSend} />);

    const ta = screen.getByRole('textbox', { name: 'Escribe un mensaje' });
    await user.type(ta, '  ¿Tenéis 800 unidades?  ');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(onSend).toHaveBeenCalledWith('¿Tenéis 800 unidades?');
    expect(ta).toHaveValue('');
  });

  it('⚠ si el envío falla, el texto NO se pierde', async () => {
    // Vaciar el campo pase lo que pase es la forma más cara de gestionar un
    // error: se borra lo que el usuario escribió para tapar un fallo que no fue
    // suyo. Con E2EE hay motivos reales de rechazo —falta la clave pública de
    // alguien (0012 §3)— así que este camino se recorre de verdad.
    const user = userEvent.setup();
    const onSend = vi.fn(async (_text: string) => false);
    render(<ThreadComposer onSend={onSend} />);

    const ta = screen.getByRole('textbox', { name: 'Escribe un mensaje' });
    await user.type(ta, 'Un mensaje que costó escribir');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(ta).toHaveValue('Un mensaje que costó escribir');
  });

  it('dos clics seguidos no mandan dos veces', async () => {
    // Mismo problema que el `busy` que el artefacto de MSG-02 declaraba y no leía
    // (TS6133): cero protección contra doble clic. Aquí duplicaría un elemento
    // del historial, que no se puede borrar.
    const user = userEvent.setup();
    let resolver: ((v: boolean) => void) | undefined;
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          resolver = r;
        }),
    );
    render(<ThreadComposer onSend={onSend} />);

    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), 'Hola');
    const boton = screen.getByRole('button', { name: 'Enviar mensaje' });
    await user.click(boton);

    expect(boton).toBeDisabled();
    expect(onSend).toHaveBeenCalledTimes(1);
    resolver?.(true);
  });
});

describe('lo que sigue fuera del MVP, y lo dice', () => {
  it('`Crear oferta` está deshabilitado y dice que MSG-03 queda fuera', () => {
    render(<ThreadComposer onSend={envioOk()} />);
    expect(screen.getByRole('button', { name: 'Crear oferta' })).toBeDisabled();
    expect(screen.getByText(CREATE_OFFER_DISABLED_REASON)).toBeInTheDocument();
  });

  it('el aviso de cifrado del HTML aprobado se queda, y desde hoy es verdad', () => {
    render(<ThreadComposer onSend={envioOk()} />);
    expect(screen.getByText('Cifrado E2EE antes del envío')).toBeInTheDocument();
  });
});

describe('lo que el pie NO puede prometer', () => {
  /**
   * ⚠ LOS DOS TESTS DE ESTE BLOQUE LLEVAN ANCLA, y no es adorno.
   *
   * Un aserto que solo dice "esto NO está" lo cumple un componente que no pinta
   * nada. Los dos pasaban en verde contra el esqueleto vacío antes de anclarlos
   * (F-058, F-059).
   */
  it('no anuncia una fecha que nadie se ha comprometido a cumplir', () => {
    const { container } = render(<ThreadComposer onSend={envioOk()} />);
    expect(screen.getByText(CREATE_OFFER_DISABLED_REASON)).toBeInTheDocument(); // ancla
    expect(container.textContent ?? '').not.toMatch(/próximamente|pronto|en breve|muy pronto/i);
  });

  it('no pinta ningún bloque de passphrase con botón (F-027)', () => {
    // En el MVP las claves viven en memoria de sesión y se pierden al recargar. Un
    // botón que pide una frase de seguridad promete recuperación de claves que no
    // existe — y sigue sin existir después de la rebanada E2EE.
    render(<ThreadComposer onSend={envioOk()} />);
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje' })).toBeInTheDocument(); // ancla
    expect(
      screen.queryByRole('button', { name: /frase de seguridad|passphrase/i }),
    ).not.toBeInTheDocument();
  });
});
