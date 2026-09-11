import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestEvent, RequestRow } from '../../lib/admin-requests';
import type { OperatorProfile } from '../../lib/session';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-01 · pantalla (`AdminRequests`).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Se mockean
 * **solo** las cinco funciones de `lib/admin-requests` que tocan red; el resto
 * del módulo -`QUEUE_FILTERS`, `DEFAULT_FILTER`, `isValidRejectionReason`,
 * `toRequestRow`, `requestDateLabel`, `websiteHref`- sigue siendo el de verdad.
 *
 * ⚠ Lo que este fichero NO puede cazar, y por eso existe `app/e2e/admin-requests.spec.ts`:
 * que la RLS de verdad esconda la cola a cualquiera que no sea Operador, y que
 * las tres acciones (`approveRequest`/`rejectRequest`/`returnToReview`) muevan
 * de verdad el estado en la base -aquí están mockeadas y siempre "funcionan".
 */

const fetchRequests = vi.fn<(state: RequestRow['state'] | null) => Promise<RequestRow[]>>();
const fetchRequestHistory = vi.fn<(id: string) => Promise<RequestEvent[]>>();
const approveRequest = vi.fn<(id: string) => Promise<RequestRow>>();
const rejectRequest = vi.fn<(id: string, reason: string) => Promise<RequestRow>>();
const returnToReview = vi.fn<(id: string) => Promise<RequestRow>>();

vi.mock('../../lib/admin-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-requests')>()),
  fetchRequests: (s: RequestRow['state'] | null) => fetchRequests(s),
  fetchRequestHistory: (id: string) => fetchRequestHistory(id),
  approveRequest: (id: string) => approveRequest(id),
  rejectRequest: (id: string, reason: string) => rejectRequest(id, reason),
  returnToReview: (id: string) => returnToReview(id),
}));

const { AdminRequests } = await import('./AdminRequests');

const operator: OperatorProfile = {
  id: 'op-1000000-0000-4000-8000-000000000001',
  email: 'operador@bearingworld.test',
  fullName: 'Admin Principal',
};

function row(over: Partial<RequestRow> = {}): RequestRow {
  return {
    id: '11110000-0000-4000-8000-000000000001',
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    countryLabel: 'España',
    applicantName: 'Juan Álvarez García',
    email: 'jalvarez@distribalvarez.com',
    phone: '+34 91 234 56 78',
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
  approveRequest.mockReset();
  rejectRequest.mockReset();
  returnToReview.mockReset();
});

describe('AdminRequests', () => {
  it('pinta el eyebrow, el título y el subtítulo literales de la spec §3', async () => {
    render(<AdminRequests operator={operator} />);
    expect(screen.getByText('Operador de Plataforma · Módulo 01')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Cola de solicitudes de registro' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Solicitudes de organizaciones que han completado el FSR y esperan aprobación manual. Ordenadas de más antigua a más reciente.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchRequests).toHaveBeenCalled());
  });

  it('al montar pide la cola con el filtro por defecto, Pendientes', async () => {
    render(<AdminRequests operator={operator} />);
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('PENDING_REVIEW'));
  });

  it('tiene los cinco chips de la spec §3, con Pendientes activo', async () => {
    render(<AdminRequests operator={operator} />);
    await waitFor(() => expect(fetchRequests).toHaveBeenCalled());
    const chips = ['Pendientes', 'Aprobadas', 'Rechazadas', 'Canceladas', 'Todas'];
    for (const c of chips) expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pulsar un chip repide con el estado de esa columna y desactiva el anterior', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Rechazadas' }));
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('REJECTED'));
    expect(screen.getByRole('button', { name: 'Rechazadas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Todas" pide sin filtro de estado (null)', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith(null));
  });

  it('pulsar una fila abre el panel de detalle y pide su historial', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);
    await waitFor(() => expect(fetchRequests).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    expect(await screen.findByText('Detalle de solicitud')).toBeInTheDocument();
    expect(fetchRequestHistory).toHaveBeenCalledWith('11110000-0000-4000-8000-000000000001');
  });

  it('cambiar de chip cierra el panel de detalle que estuviera abierto', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    expect(await screen.findByText('Detalle de solicitud')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.queryByText('Detalle de solicitud')).not.toBeInTheDocument();
  });

  it('Aprobar llama a approveRequest, repide la cola con el filtro activo y no pierde el detalle', async () => {
    const user = userEvent.setup();
    approveRequest.mockResolvedValue(row({ state: 'INVITED_APPROVED' }));
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    await screen.findByText('Detalle de solicitud');

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => expect(approveRequest).toHaveBeenCalledWith('11110000-0000-4000-8000-000000000001'));
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledTimes(2)); // montaje + tras aprobar
    expect(fetchRequests).toHaveBeenLastCalledWith('PENDING_REVIEW');
    expect(await screen.findByText('Aprobación registrada.')).toBeInTheDocument();
  });

  it('Rechazar abre el formulario; Confirmar rechazo llama a rejectRequest con el motivo escrito', async () => {
    const user = userEvent.setup();
    rejectRequest.mockResolvedValue(row({ state: 'REJECTED' }));
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }));

    const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo — se enviará al solicitante');
    await user.type(textarea, 'Sin actividad comprobable en el sector.');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() =>
      expect(rejectRequest).toHaveBeenCalledWith(
        '11110000-0000-4000-8000-000000000001',
        'Sin actividad comprobable en el sector.',
      ),
    );
    expect(await screen.findByText('Solicitud rechazada.')).toBeInTheDocument();
  });

  it('un fallo al aprobar deja los botones y muestra el error, sin cerrar el panel', async () => {
    const user = userEvent.setup();
    approveRequest.mockRejectedValue(new Error('RLS: no eres el Operador'));
    render(<AdminRequests operator={operator} />);
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('RLS: no eres el Operador');
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('Volver a revisión llama a returnToReview', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue([row({ state: 'REJECTED' })]);
    returnToReview.mockResolvedValue(row({ state: 'PENDING_REVIEW' }));
    render(<AdminRequests operator={operator} />);
    await user.click(screen.getByRole('button', { name: 'Rechazadas' }));
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    await user.click(await screen.findByRole('button', { name: 'Volver a revisión' }));
    await waitFor(() =>
      expect(returnToReview).toHaveBeenCalledWith('11110000-0000-4000-8000-000000000001'),
    );
  });

  it('cola vacía: pinta el literal de la spec §6', async () => {
    fetchRequests.mockResolvedValue([]);
    render(<AdminRequests operator={operator} />);
    expect(await screen.findByText('No hay solicitudes pendientes de revisión.')).toBeInTheDocument();
  });

  it('un fallo al cargar la cola se pinta en `role="alert"`', async () => {
    fetchRequests.mockRejectedValue(new Error('la base no responde'));
    render(<AdminRequests operator={operator} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('la base no responde');
  });
});
