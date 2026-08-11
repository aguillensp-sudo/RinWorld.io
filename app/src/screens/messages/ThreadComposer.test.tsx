import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CREATE_OFFER_DISABLED_REASON, SEND_DISABLED_REASON } from '../../lib/thread-detail';
import { ThreadComposer } from './ThreadComposer';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-02 · pie de composición.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). El Coder no lo ve.
 *
 * El componente **no recibe props**, y eso es el contrato, no una omisión: el pie
 * se pinta igual en los cinco estados del hilo. Que siga visible en un hilo
 * CERRADO SIN ACUERDO lo exige D-07-01 y lo comprueba `Thread.test.tsx`, que es
 * quien decide si montarlo.
 */

describe('el campo de mensaje', () => {
  it('tiene nombre accesible y el placeholder del HTML aprobado', () => {
    render(<ThreadComposer />);
    const ta = screen.getByRole('textbox', { name: 'Escribe un mensaje' });
    expect(ta).toHaveAttribute('placeholder', 'Escribe un mensaje...');
  });

  it('se puede escribir en él aunque no se pueda enviar', () => {
    // Deshabilitar el textarea además del botón sería pasarse: lo que falta es el
    // cifrado, no la redacción. Y un textarea inerte no se distingue de uno roto.
    render(<ThreadComposer />);
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje' })).not.toBeDisabled();
  });
});

describe('lo que hoy no se puede hacer, y por qué (D-07-05)', () => {
  it('el botón de enviar está deshabilitado', () => {
    render(<ThreadComposer />);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });

  it('el motivo del envío va en TEXTO VISIBLE, no en un title (F-023 e)', () => {
    // Un control inerte sin explicación se lee como avería. `Messages.tsx:107` ya
    // lo resolvió así para `Nuevo contacto`: el motivo se ve, no se descubre
    // pasando el ratón por encima.
    render(<ThreadComposer />);
    expect(screen.getByText(SEND_DISABLED_REASON)).toBeInTheDocument();
  });

  it('`Crear oferta` está deshabilitado y dice que MSG-03 queda fuera', () => {
    render(<ThreadComposer />);
    expect(screen.getByRole('button', { name: 'Crear oferta' })).toBeDisabled();
    expect(screen.getByText(CREATE_OFFER_DISABLED_REASON)).toBeInTheDocument();
  });

  it('el aviso de cifrado del HTML aprobado se queda', () => {
    render(<ThreadComposer />);
    expect(screen.getByText('Cifrado E2EE antes del envío')).toBeInTheDocument();
  });
});

describe('lo que el pie NO puede prometer', () => {
  /**
   * ⚠ LOS DOS TESTS DE ESTE BLOQUE LLEVAN ANCLA, y no es adorno.
   *
   * Un aserto que solo dice "esto NO está" lo cumple un componente que no pinta
   * nada. Los dos pasaban en verde contra el esqueleto vacío antes de anclarlos —
   * es F-047 llevado a su conclusión: no basta con que el contrato compile y se
   * ejecute, hay que mirar **qué pasa en verde** contra una implementación vacía.
   * Lo que pase ahí no está midiendo nada.
   */
  it('no anuncia una fecha que nadie se ha comprometido a cumplir', () => {
    const { container } = render(<ThreadComposer />);
    expect(screen.getByText(SEND_DISABLED_REASON)).toBeInTheDocument(); // ancla
    expect(container.textContent ?? '').not.toMatch(/próximamente|pronto|en breve|muy pronto/i);
  });

  it('no pinta ningún bloque de passphrase con botón (F-027)', () => {
    // En el MVP las claves viven en memoria de sesión y se pierden al recargar. Un
    // botón que pide una frase de seguridad promete recuperación de claves que no
    // existe. El indicador de cifrado del historial informa; no ofrece.
    render(<ThreadComposer />);
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje' })).toBeInTheDocument(); // ancla
    expect(
      screen.queryByRole('button', { name: /frase de seguridad|passphrase/i }),
    ).not.toBeInTheDocument();
  });
});
