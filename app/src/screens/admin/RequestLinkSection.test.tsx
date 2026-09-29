import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestLinkSection, type LinkView } from './RequestLinkSection';

/**
 * F-223 · la sección «Enlace de acceso» de ADMIN-01. Presentacional: los tests son
 * de Claude Code (la escribe a mano), no el contrato de una tarea del arnés.
 */

const URL_ = `https://app.bearingworld.io/#registro?token=${'a'.repeat(64)}`;

function pinta(link: LinkView, over: { busy?: boolean; onGenerate?: () => void } = {}) {
  const onGenerate = over.onGenerate ?? vi.fn();
  render(<RequestLinkSection link={link} busy={over.busy ?? false} onGenerate={onGenerate} />);
  return { onGenerate };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RequestLinkSection · enlace recién generado', () => {
  const issued: LinkView = { kind: 'issued', url: URL_, expiresAt: '2026-10-06T08:00:00Z' };

  it('enseña el enlace completo en un campo de solo lectura, con su caducidad y el aviso de una sola vez', () => {
    pinta(issued);
    expect(screen.getByText('Enlace de acceso')).toBeInTheDocument();
    const campo = screen.getByRole('textbox', { name: 'Enlace de registro' });
    expect(campo).toHaveValue(URL_);
    expect(campo).toHaveAttribute('readonly');
    expect(screen.getByText(/Válido hasta .+ · un solo uso/)).toBeInTheDocument();
    expect(screen.getByText('Solo se muestra ahora. Si lo pierdes, genera otro.')).toBeInTheDocument();
  });

  it('Copiar enlace escribe el enlace en el portapapeles y avisa con «Copiado»', async () => {
    const user = userEvent.setup();
    // `userEvent.setup()` instala su propio portapapeles: se espía DESPUES.
    const escribir = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    pinta(issued);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    expect(escribir).toHaveBeenCalledWith(URL_);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('si el portapapeles falla, lo dice y deja el texto para copiarlo a mano', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'));
    pinta(issued);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    expect(await screen.findByText('No se pudo copiar: selecciónalo y cópialo a mano.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument();
  });

  it('no ofrece generar otro mientras se enseña este', () => {
    pinta(issued);
    expect(screen.queryByRole('button', { name: /Generar enlace/ })).not.toBeInTheDocument();
  });
});

describe('RequestLinkSection · sin enlace que enseñar', () => {
  it('sin enlace: lo dice y ofrece «Generar enlace»', async () => {
    const user = userEvent.setup();
    const { onGenerate } = pinta({ kind: 'status', status: null });
    expect(screen.getByText('Sin enlace')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generar enlace' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('vigente: enseña hasta cuándo, ofrece uno nuevo y avisa de que invalida el actual; NUNCA el enlace', () => {
    pinta({ kind: 'status', status: { status: 'Vigente', expiresAt: '2026-10-06T08:00:00Z', usedAt: null } });
    expect(screen.getByText(/^Enlace vigente hasta /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar enlace nuevo' })).toBeInTheDocument();
    expect(screen.getByText('Generar uno nuevo invalida el actual.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar enlace' })).not.toBeInTheDocument();
  });

  it('caducado y revocado: se puede generar uno nuevo', () => {
    const { unmount } = render(
      <RequestLinkSection
        link={{ kind: 'status', status: { status: 'Caducado', expiresAt: '2026-09-01T08:00:00Z', usedAt: null } }}
        busy={false}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Enlace caducado el /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar enlace nuevo' })).toBeInTheDocument();
    unmount();

    pinta({ kind: 'status', status: { status: 'Revocado', expiresAt: '2026-10-06T08:00:00Z', usedAt: null } });
    expect(screen.getByText('Enlace revocado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar enlace nuevo' })).toBeInTheDocument();
  });

  it('canjeado: lo dice y NO ofrece generar otro (la base no lo permite)', () => {
    pinta({
      kind: 'status',
      status: { status: 'Canjeado', expiresAt: '2026-10-06T08:00:00Z', usedAt: '2026-10-01T10:00:00Z' },
    });
    expect(screen.getByText(/^Enlace canjeado el /)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('el botón se deshabilita mientras hay una acción en curso', () => {
    pinta({ kind: 'status', status: null }, { busy: true });
    expect(screen.getByRole('button', { name: 'Generar enlace' })).toBeDisabled();
  });
});

describe('RequestLinkSection · carga y error', () => {
  it('cargando', () => {
    pinta({ kind: 'loading' });
    expect(screen.getByText('Cargando enlace…')).toBeInTheDocument();
  });

  it('error: lo enseña como alerta', () => {
    pinta({ kind: 'error', message: 'no hay red' });
    expect(screen.getByRole('alert')).toHaveTextContent('no hay red');
  });
});
