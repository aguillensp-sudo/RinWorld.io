import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestEvent, RequestLinkStatus, RequestRow } from '../../lib/admin-requests';
import type { OperatorProfile } from '../../lib/session';

/**
 * F-223 · el enlace de acceso en la pantalla `AdminRequests`. Lo escribe Claude Code
 * a mano; no es el contrato de una tarea del arnés. Se mockean las funciones de red
 * y `registrationLinkUrl` sigue siendo el de verdad.
 *
 * ⚠ Lo que esto NO caza, y mide `app/e2e/admin-requests.spec.ts` y el banco de
 * esquema: que la base genere de verdad el token y que solo lo haga un Operador.
 */

const fetchRequests = vi.fn<(state: RequestRow['state'] | null) => Promise<RequestRow[]>>();
const fetchRequestHistory = vi.fn<(id: string) => Promise<RequestEvent[]>>();
const approveRequest = vi.fn<(id: string) => Promise<RequestRow>>();
const issueRegistrationLink = vi.fn<(id: string) => Promise<{ token: string; expiresAt: string }>>();
const fetchRegistrationLinkStatus = vi.fn<(id: string) => Promise<RequestLinkStatus | null>>();

vi.mock('../../lib/admin-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-requests')>()),
  fetchRequests: (s: RequestRow['state'] | null) => fetchRequests(s),
  fetchRequestHistory: (id: string) => fetchRequestHistory(id),
  approveRequest: (id: string) => approveRequest(id),
  issueRegistrationLink: (id: string) => issueRegistrationLink(id),
  fetchRegistrationLinkStatus: (id: string) => fetchRegistrationLinkStatus(id),
}));

const { AdminRequests } = await import('./AdminRequests');

const operator: OperatorProfile = {
  id: 'op-1000000-0000-4000-8000-000000000001',
  email: 'operador@bearingworld.test',
  fullName: 'Admin Principal',
};

const TOKEN = 'b'.repeat(64);
const ID = '11110000-0000-4000-8000-000000000001';

function row(over: Partial<RequestRow> = {}): RequestRow {
  return {
    id: ID,
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    countryLabel: 'España',
    applicantName: 'Juan Álvarez García',
    email: 'jalvarez@distribalvarez.com',
    phone: '',
    website: '',
    submittedAt: '2026-06-28T08:14:00Z',
    state: 'PENDING_REVIEW',
    rejectionReason: '',
    decidedBy: null,
    decidedAt: null,
    ...over,
  };
}

beforeEach(() => {
  fetchRequests.mockReset().mockResolvedValue([row()]);
  fetchRequestHistory.mockReset().mockResolvedValue([]);
  approveRequest.mockReset().mockResolvedValue(row({ state: 'INVITED_APPROVED' }));
  issueRegistrationLink.mockReset().mockResolvedValue({ token: TOKEN, expiresAt: '2026-10-06T08:00:00Z' });
  fetchRegistrationLinkStatus.mockReset().mockResolvedValue(null);
});

async function abre(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
  await screen.findByText('Detalle de solicitud');
}

describe('AdminRequests · enlace de acceso', () => {
  it('Aprobar genera el enlace y lo enseña entero, sin pedir el estado después', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);
    await abre(user);
    expect(screen.queryByText('Enlace de acceso')).not.toBeInTheDocument(); // aún pendiente

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => expect(issueRegistrationLink).toHaveBeenCalledWith(ID));
    const campo = await screen.findByRole('textbox', { name: 'Enlace de registro' });
    expect(campo).toHaveValue(`${window.location.origin}/#registro?token=${TOKEN}`);
    expect(screen.getByText('Aprobación registrada.')).toBeInTheDocument();
    // El enlace en claro manda: no se pisa pidiendo un estado que no lo lleva.
    expect(fetchRegistrationLinkStatus).not.toHaveBeenCalled();
  });

  it('si el enlace falla, la solicitud sigue aprobada y se puede generar desde la sección', async () => {
    const user = userEvent.setup();
    issueRegistrationLink.mockRejectedValueOnce(new Error('sin red'));
    render(<AdminRequests operator={operator} />);
    await abre(user);

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Aprobada, pero no se pudo generar el enlace: sin red');
    expect(screen.getByText('Aprobación registrada.')).toBeInTheDocument();
    expect(await screen.findByText('Sin enlace')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generar enlace' }));

    expect(await screen.findByRole('textbox', { name: 'Enlace de registro' })).toHaveValue(
      `${window.location.origin}/#registro?token=${TOKEN}`,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('al abrir una solicitud ya aprobada pide el ESTADO del enlace y no enseña ningún enlace', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue([row({ state: 'INVITED_APPROVED' })]);
    fetchRegistrationLinkStatus.mockResolvedValue({
      status: 'Vigente',
      expiresAt: '2026-10-06T08:00:00Z',
      usedAt: null,
    });
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Todas' }));
    await abre(user);

    expect(await screen.findByText(/^Enlace vigente hasta /)).toBeInTheDocument();
    expect(fetchRegistrationLinkStatus).toHaveBeenCalledWith(ID);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(issueRegistrationLink).not.toHaveBeenCalled();
  });

  it('«Generar enlace nuevo» sustituye el estado por el enlace nuevo', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue([row({ state: 'INVITED_APPROVED' })]);
    fetchRegistrationLinkStatus.mockResolvedValue({
      status: 'Caducado',
      expiresAt: '2026-09-01T08:00:00Z',
      usedAt: null,
    });
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Todas' }));
    await abre(user);

    await user.click(await screen.findByRole('button', { name: 'Generar enlace nuevo' }));

    expect(await screen.findByRole('textbox', { name: 'Enlace de registro' })).toBeInTheDocument();
    expect(issueRegistrationLink).toHaveBeenCalledWith(ID);
  });

  it('un enlace generado no se ve en otra solicitud: cambiar de fila lo suelta', async () => {
    const user = userEvent.setup();
    const otra = row({ id: '22220000-0000-4000-8000-000000000002', orgName: 'Otra SL', state: 'INVITED_APPROVED' });
    fetchRequests.mockResolvedValue([row(), otra]);
    render(<AdminRequests operator={operator} />);
    await abre(user);
    await user.click(screen.getByRole('button', { name: 'Aprobar' }));
    await screen.findByRole('textbox', { name: 'Enlace de registro' });

    await user.click(await screen.findByRole('button', { name: 'Otra SL' }));

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(fetchRegistrationLinkStatus).toHaveBeenCalledWith(otra.id);
  });

  it('si el estado del enlace no carga, lo dice', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue([row({ state: 'INVITED_APPROVED' })]);
    fetchRegistrationLinkStatus.mockRejectedValue(new Error('RLS: no eres el Operador'));
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Todas' }));
    await abre(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('RLS: no eres el Operador');
  });
});

describe('RequestDetailPanel · la sección solo va en solicitudes aprobadas', () => {
  it('pendiente y rechazada no tienen sección de enlace', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue([row({ state: 'REJECTED', rejectionReason: 'Motivo de prueba largo' })]);
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Todas' }));
    await abre(user);

    expect(screen.queryByText('Enlace de acceso')).not.toBeInTheDocument();
    expect(fetchRegistrationLinkStatus).not.toHaveBeenCalled();
  });
});
