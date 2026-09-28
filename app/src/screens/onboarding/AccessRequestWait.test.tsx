import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccessRequestStatus, SubmittedAccessRequest } from '../../lib/access-request';

/**
 * CONTRATO DE ACEPTACIÓN · REG-00-WAIT · Espera de aprobación del Operador
 * (`AccessRequestWait`).
 *
 * Escrito antes que el código y por Claude Code (`harness/README.md`). El Coder no
 * lo ve. Se mockea **solo** la función de red, `fetchAccessRequestStatus` (de
 * `lib/access-request`). `waitView`, `requestSummary`, `isFinalState` y
 * `POLL_INTERVAL_MS` son los de verdad: qué se pinta en cada estado lo decide la
 * capa de datos, no la pantalla.
 *
 * Los textos son los del `setStatus` del HTML aprobado, que manda sobre la spec
 * (`F-170`). El ejemplo es el suyo: Carlos Ruiz, Distribuciones Ruiz SL.
 */

const fetchAccessRequestStatus = vi.fn<(id: string) => Promise<AccessRequestStatus>>();

vi.mock('../../lib/access-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/access-request')>()),
  fetchAccessRequestStatus: (id: string) => fetchAccessRequestStatus(id),
}));

const { AccessRequestWait } = await import('./AccessRequestWait');

/**
 * Con la suite entera en paralelo, el `waitFor` de 1 s por defecto y el límite de
 * 5 s por test se quedaban cortos a ratos (lo mismo que midió el contrato de
 * REG-00 el 28-sep). Holgura de reloj, ningún aserto distinto.
 */
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });
const { POLL_INTERVAL_MS } = await import('../../lib/access-request');

const onClose = vi.fn<() => void>();

const REQUEST: SubmittedAccessRequest = {
  id: 'fff5a901-bab2-4040-9d71-86da3fb02ff8',
  submittedAt: '2026-09-28T11:23:00Z',
  form: {
    email: 'carlos.ruiz@distribucionesruiz.com',
    fullName: 'Carlos Ruiz',
    orgName: 'Distribuciones Ruiz SL',
    country: 'ES',
    phone: '+34 963 456 789',
    website: 'https://www.distribucionesruiz.com',
  },
};

const PENDIENTE: AccessRequestStatus = { state: 'PENDING_REVIEW', rejectionReason: null };
const APROBADA: AccessRequestStatus = { state: 'INVITED_APPROVED', rejectionReason: null };
const RECHAZADA: AccessRequestStatus = {
  state: 'REJECTED',
  rejectionReason: 'La organización no cumple los requisitos de membresía actuales.',
};

function mount() {
  return render(<AccessRequestWait request={REQUEST} onClose={onClose} />);
}

const badge = () => screen.getByTestId('status-badge');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchAccessRequestStatus.mockReset();
  onClose.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('REG-00-WAIT · en revisión', () => {
  it('cabecera, título, subtítulo y distintivo EN REVISIÓN', async () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    expect(screen.getByText('Módulo 01 · Onboarding')).toBeInTheDocument();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Tu solicitud está en revisión');
    expect(
      screen.getByText(
        'Nuestro equipo está analizando los datos de tu organización. Te avisaremos por email en cuanto tengamos una respuesta.',
      ),
    ).toBeInTheDocument();
    expect(badge()).toHaveTextContent('EN REVISIÓN');
    expect(screen.getByText('Revisando solicitud...')).toBeInTheDocument();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledWith(REQUEST.id));
  });

  it('el logo de la cabecera mínima', () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    expect(screen.getByRole('img', { name: 'Bearingworld.io' })).toHaveAttribute('src', expect.stringContaining('intentologo.png'));
  });

  it('los datos enviados, con el país en español', () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    const datos = screen.getByRole('region', { name: 'Datos enviados' });
    for (const [etiqueta, valor] of [
      ['Email', 'carlos.ruiz@distribucionesruiz.com'],
      ['Nombre y apellidos', 'Carlos Ruiz'],
      ['Organización', 'Distribuciones Ruiz SL'],
      ['País', 'España'],
      ['Teléfono', '+34 963 456 789'],
      ['Sitio web', 'https://www.distribucionesruiz.com'],
    ]) {
      expect(within(datos).getByText(etiqueta as string)).toBeInTheDocument();
      expect(within(datos).getByText(valor as string)).toBeInTheDocument();
    }
  });

  it('el aviso de un solo uso', () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    expect(screen.getByText('Pantalla de un solo uso.')).toBeInTheDocument();
    expect(
      screen.getByText(/Una vez cierres el navegador o recibas respuesta por email, no podrás volver a acceder a esta pantalla\./),
    ).toBeInTheDocument();
  });

  it('sin aviso de aprobada ni de rechazada', async () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('status-notice')).toBeNull();
  });

  it('Cerrar y esperar el email llama a onClose', async () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y esperar el email' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('REG-00-WAIT · el sondeo', () => {
  it('pregunta al montar y otra vez a cada intervalo mientras sigue pendiente', async () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    mount();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(3));
  });

  it('deja de preguntar en cuanto la solicitud se resuelve', async () => {
    fetchAccessRequestStatus.mockResolvedValue(APROBADA);
    mount();
    await waitFor(() => expect(badge()).toHaveTextContent('APROBADO'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red es silencioso: sigue en revisión, sin alert, y vuelve a preguntar', async () => {
    fetchAccessRequestStatus.mockRejectedValueOnce(new Error('sin red')).mockResolvedValue(PENDIENTE);
    mount();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(badge()).toHaveTextContent('EN REVISIÓN');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(2));
  });

  it('al desmontar no sigue preguntando', async () => {
    fetchAccessRequestStatus.mockResolvedValue(PENDIENTE);
    const { unmount } = mount();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1);
  });

  it('pasa de revisión a aprobada cuando el sondeo lo trae', async () => {
    fetchAccessRequestStatus.mockResolvedValueOnce(PENDIENTE).mockResolvedValue(APROBADA);
    mount();
    await waitFor(() => expect(fetchAccessRequestStatus).toHaveBeenCalledTimes(1));
    expect(badge()).toHaveTextContent('EN REVISIÓN');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(badge()).toHaveTextContent('APROBADO'));
  });
});

describe('REG-00-WAIT · resuelta', () => {
  it('aprobada: título, distintivo, etiqueta del rodamiento y aviso', async () => {
    fetchAccessRequestStatus.mockResolvedValue(APROBADA);
    mount();
    await waitFor(() => expect(badge()).toHaveTextContent('APROBADO'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¡Tu solicitud ha sido aprobada!');
    expect(screen.getByText('¡Solicitud aprobada!')).toBeInTheDocument();
    const aviso = screen.getByTestId('status-notice');
    expect(aviso).toHaveTextContent('¡Tu solicitud ha sido aprobada!');
    expect(aviso).toHaveTextContent('Revisa tu email para continuar con el proceso de registro de tu organización.');
  });

  it('rechazada: título, distintivo y el motivo del Operador en el aviso', async () => {
    fetchAccessRequestStatus.mockResolvedValue(RECHAZADA);
    mount();
    await waitFor(() => expect(badge()).toHaveTextContent('NO APROBADO'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu solicitud no ha sido aprobada');
    expect(
      screen.getByText('En este momento no podemos darte acceso. Puedes iniciar una nueva solicitud si crees que hay un error.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Solicitud no aprobada')).toBeInTheDocument();
    const aviso = screen.getByTestId('status-notice');
    expect(aviso).toHaveTextContent('Tu solicitud no ha sido aprobada en este momento.');
    expect(aviso).toHaveTextContent('La organización no cumple los requisitos de membresía actuales.');
  });

  it('el botón de cerrar sigue ahí cuando está resuelta', async () => {
    fetchAccessRequestStatus.mockResolvedValue(RECHAZADA);
    mount();
    await waitFor(() => expect(badge()).toHaveTextContent('NO APROBADO'));
    expect(screen.getByRole('button', { name: 'Cerrar y esperar el email' })).toBeEnabled();
  });
});
