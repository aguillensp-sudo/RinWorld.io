import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RequestEvent, RequestRow } from '../../lib/admin-requests';

/**
 * CONTRATO DE ACEPTACIÓN · ADMIN-01 · `RequestDetailPanel` (presentacional).
 *
 * Escrito antes que el código y por Claude Code. El Coder no lo ve. Totalmente
 * controlado: ni llama a `approveRequest`/`rejectRequest`/`returnToReview`, ni
 * decide cuándo se abre el formulario de rechazo -- eso es de `AdminRequests`.
 */

const { RequestDetailPanel } = await import('./RequestDetailPanel');

const ROW: RequestRow = {
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
};

function base() {
  return {
    row: ROW,
    history: [] as RequestEvent[],
    historyLoading: false,
    rejecting: false,
    rejectReason: '',
    onRejectReasonChange: vi.fn(),
    actionBusy: false,
    actionError: null as string | null,
    feedback: null as 'approved' | 'rejected' | null,
    onApprove: vi.fn(),
    onStartReject: vi.fn(),
    onConfirmReject: vi.fn(),
    onCancelReject: vi.fn(),
    onReturnToReview: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('RequestDetailPanel', () => {
  it('pinta los siete datos del FSR de la spec §3', () => {
    render(<RequestDetailPanel {...base()} />);
    expect(screen.getByText('Distribuciones Álvarez SL')).toBeInTheDocument();
    expect(screen.getByText('España · ES')).toBeInTheDocument();
    expect(screen.getByText('Juan Álvarez García')).toBeInTheDocument();
    expect(screen.getByText('jalvarez@distribalvarez.com')).toBeInTheDocument();
    expect(screen.getByText('+34 91 234 56 78')).toBeInTheDocument();
    expect(screen.getByText('28 jun 2026 · 08:14')).toBeInTheDocument();
  });

  it('sitio web vacío se pinta con un guión', () => {
    render(<RequestDetailPanel {...base()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('PENDING_REVIEW muestra Aprobar y Rechazar, y ningún otro botón de decisión', () => {
    render(<RequestDetailPanel {...base()} />);
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver a revisión' })).not.toBeInTheDocument();
  });

  it('Aprobar llama a onApprove', async () => {
    const user = userEvent.setup();
    const props = base();
    render(<RequestDetailPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Aprobar' }));
    expect(props.onApprove).toHaveBeenCalledOnce();
  });

  it('Rechazar llama a onStartReject, no a onConfirmReject', async () => {
    const user = userEvent.setup();
    const props = base();
    render(<RequestDetailPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(props.onStartReject).toHaveBeenCalledOnce();
    expect(props.onConfirmReject).not.toHaveBeenCalled();
  });

  it('REJECTED muestra solo "Volver a revisión"', () => {
    render(<RequestDetailPanel {...base()} row={{ ...ROW, state: 'REJECTED', rejectionReason: 'Motivo' }} />);
    expect(screen.getByRole('button', { name: 'Volver a revisión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('Volver a revisión llama a onReturnToReview', async () => {
    const user = userEvent.setup();
    const props = { ...base(), row: { ...ROW, state: 'REJECTED' as const } };
    render(<RequestDetailPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Volver a revisión' }));
    expect(props.onReturnToReview).toHaveBeenCalledOnce();
  });

  it('INVITED_APPROVED y CANCELLED no muestran ningún botón de decisión', () => {
    const { rerender } = render(<RequestDetailPanel {...base()} row={{ ...ROW, state: 'INVITED_APPROVED' }} />);
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar|Volver a revisión/ })).not.toBeInTheDocument();
    rerender(<RequestDetailPanel {...base()} row={{ ...ROW, state: 'CANCELLED' }} />);
    expect(screen.queryByRole('button', { name: /Aprobar|Rechazar|Volver a revisión/ })).not.toBeInTheDocument();
  });

  it('el formulario de rechazo, abierto: el textarea es controlado y "Confirmar rechazo" nace deshabilitado', () => {
    render(<RequestDetailPanel {...base()} rejecting={true} rejectReason="" />);
    expect(
      screen.getByPlaceholderText('Explica el motivo del rechazo — se enviará al solicitante'),
    ).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('escribir en el textarea llama a onRejectReasonChange, no gestiona su propio estado', async () => {
    const user = userEvent.setup();
    const props = { ...base(), rejecting: true };
    render(<RequestDetailPanel {...props} />);
    await user.type(
      screen.getByPlaceholderText('Explica el motivo del rechazo — se enviará al solicitante'),
      'x',
    );
    expect(props.onRejectReasonChange).toHaveBeenCalledWith('x');
  });

  it('con 10 o más caracteres, "Confirmar rechazo" se habilita; con menos, no', () => {
    const { rerender } = render(
      <RequestDetailPanel {...base()} rejecting={true} rejectReason="corto" />,
    );
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    rerender(<RequestDetailPanel {...base()} rejecting={true} rejectReason="Diez caracteres o más" />);
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeEnabled();
  });

  it('Confirmar rechazo llama a onConfirmReject; Cancelar llama a onCancelReject', async () => {
    const user = userEvent.setup();
    const props = { ...base(), rejecting: true, rejectReason: 'Motivo suficientemente largo' };
    render(<RequestDetailPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelReject).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(props.onConfirmReject).toHaveBeenCalledOnce();
  });

  it('mientras hay una acción en vuelo, los botones de decisión se deshabilitan', () => {
    render(<RequestDetailPanel {...base()} actionBusy={true} />);
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
  });

  it('un error de acción se pinta en `role="alert"`, sin ocultar los botones de decisión', () => {
    render(<RequestDetailPanel {...base()} actionError="la base no responde" />);
    expect(screen.getByRole('alert')).toHaveTextContent('la base no responde');
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('aprobado: el texto de confirmación sustituye a los botones, y no promete un correo que nadie manda', () => {
    render(<RequestDetailPanel {...base()} feedback="approved" />);
    expect(screen.getByText('Aprobación registrada.')).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
  });

  it('rechazado: el texto de confirmación sustituye al formulario', () => {
    render(<RequestDetailPanel {...base()} feedback="rejected" />);
    expect(screen.getByText('Solicitud rechazada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar rechazo' })).not.toBeInTheDocument();
  });

  it('el historial se pinta con el estado y la fecha de cada evento', () => {
    render(
      <RequestDetailPanel
        {...base()}
        history={[{ id: 1, state: 'PENDING_REVIEW', at: '2026-06-28T08:14:00Z', operatorId: null, note: 'Envío FSR' }]}
      />,
    );
    expect(screen.getByText('Envío FSR')).toBeInTheDocument();
    expect(screen.getAllByText('28 jun 2026 · 08:14').length).toBeGreaterThan(0);
  });

  it('cerrar llama a onClose', async () => {
    const user = userEvent.setup();
    const props = base();
    render(<RequestDetailPanel {...props} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar panel de detalle' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
