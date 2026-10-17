import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestEvent, RequestRow } from '../../lib/admin-requests';
import type { OperatorProfile } from '../../lib/session';

/**
 * operator-approval#3 · reversión de rechazo a revisión: la mitad de la UI.
 *
 * GIVEN una solicitud en estado REJECTED
 * WHEN  el operador revierte la decisión manualmente
 * THEN  el estado transiciona a PENDING_REVIEW
 * AND   la solicitud reaparece en la cola de ADMIN-01
 *
 * La capa de datos es un doble CON ESTADO (una «base» en memoria que filtra por estado y que
 * `returnToReview` muta), no valores fijos: así «reaparece en la cola» se mide mirando qué enseña
 * la cola de Pendientes ANTES y DESPUÉS, y no si se llamó a una función.
 *
 * ⚠ No caza que la transición la haga la base de verdad: eso es SQL (`0028`).
 */

const fetchRequests = vi.fn<(state: RequestRow['state'] | null) => Promise<RequestRow[]>>();
const fetchRequestHistory = vi.fn<(id: string) => Promise<RequestEvent[]>>();
const returnToReview = vi.fn<(id: string) => Promise<RequestRow>>();

vi.mock('../../lib/admin-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-requests')>()),
  fetchRequests: (s: RequestRow['state'] | null) => fetchRequests(s),
  fetchRequestHistory: (id: string) => fetchRequestHistory(id),
  returnToReview: (id: string) => returnToReview(id),
  fetchRegistrationLinkStatus: async () => null,
}));

const { AdminRequests } = await import('./AdminRequests');

const operator: OperatorProfile = {
  id: 'op-1000000-0000-4000-8000-000000000001',
  email: 'operador@bearingworld.test',
  fullName: 'Admin Principal',
};

const ID = '11110000-0000-4000-8000-000000000001';

function fila(state: RequestRow['state']): RequestRow {
  return {
    id: ID,
    orgName: 'Distribuciones Álvarez SL',
    country: 'ES',
    countryLabel: 'España',
    applicantName: 'Juan Álvarez García',
    email: 'jalvarez@distribalvarez.com',
    phone: '+34 91 234 56 78',
    website: '',
    submittedAt: '2026-06-28T08:14:00Z',
    state,
    rejectionReason: state === 'REJECTED' ? 'No pudimos verificar la empresa' : '',
    decidedBy: null,
    decidedAt: null,
  };
}

let base: RequestRow;

beforeEach(() => {
  base = fila('REJECTED');
  fetchRequests.mockReset().mockImplementation(async (state) => (state === null || base.state === state ? [{ ...base }] : []));
  fetchRequestHistory.mockReset().mockResolvedValue([]);
  returnToReview.mockReset().mockImplementation(async () => {
    base = { ...base, state: 'PENDING_REVIEW', rejectionReason: '' };
    return { ...base };
  });
});

describe('ADMIN-01 · reversión de rechazo a revisión', () => {
  it('operator-approval#3 · tras «Volver a revisión» la solicitud sale de Rechazadas y reaparece en la cola de Pendientes', async () => {
    const user = userEvent.setup();
    render(<AdminRequests operator={operator} />);

    // ANTES: la cola por defecto (Pendientes) está vacía; la solicitud está en Rechazadas.
    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('PENDING_REVIEW'));
    expect(screen.queryByRole('button', { name: 'Distribuciones Álvarez SL' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rechazadas' }));
    await user.click(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' }));
    await user.click(await screen.findByRole('button', { name: 'Volver a revisión' }));
    await waitFor(() => expect(returnToReview).toHaveBeenCalledWith(ID));

    // DESPUÉS: en Rechazadas ya no está, y en Pendientes sí.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Distribuciones Álvarez SL' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Pendientes' }));
    expect(await screen.findByRole('button', { name: 'Distribuciones Álvarez SL' })).toBeInTheDocument();
  });
});
