import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InquiryOutcome, ThreadDetail, ThreadItem } from '../../lib/thread-detail';
import type { OrgLine } from '../../lib/search';
import { HILO, NOW, SUYA, detail, ofertaRecibida, profile } from './Thread.fixtures';

/**
 * `Crear consulta` desde el hilo, de extremo a extremo con la pantalla (MSG-03 §3.2, F-249). Escrito a
 * mano: el contrato de MSG-02 (`Thread.test.tsx`) no se toca para otra cosa. Se mockea solo la red.
 */

const fetchThreadDetail = vi.fn<(t: string, o: string) => Promise<ThreadDetail>>();
const fetchThreadItems = vi.fn<(t: string, o: string) => Promise<ThreadItem[]>>();
const sendInquiries =
  vi.fn<(lines: { lineId: string; distributorOrgId: string; quantity: number; notes?: string | null }[], own: string) => Promise<InquiryOutcome[]>>();
const fetchOrgLines = vi.fn<(o: string, own: string, t: string) => Promise<OrgLine[]>>();

vi.mock('../../lib/thread-detail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/thread-detail')>()),
  fetchThreadDetail: (t: string, o: string) => fetchThreadDetail(t, o),
  fetchThreadItems: (t: string, o: string) => fetchThreadItems(t, o),
  sendInquiries: (l: never, o: string) => sendInquiries(l, o),
}));

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchOrgLines: (o: string, own: string, t: string) => fetchOrgLines(o, own, t),
}));

vi.mock('../../lib/realtime', () => ({ onThreadChanged: () => () => {} }));

const { Thread } = await import('./Thread');

const LINEA: OrgLine = { id: 'l-1', partNumber: '6205-2RS', brand: 'SKF', quantity: 850, country: 'DE', consulted: false };

beforeEach(() => {
  for (const m of [fetchThreadDetail, fetchThreadItems, sendInquiries, fetchOrgLines]) m.mockReset();
  fetchThreadDetail.mockResolvedValue(detail());
  fetchThreadItems.mockResolvedValue([ofertaRecibida]);
  fetchOrgLines.mockResolvedValue([LINEA]);
  sendInquiries.mockImplementation(async (lines) =>
    lines.map((l) => ({ lineId: l.lineId, distributorOrgId: l.distributorOrgId, ok: true })),
  );
});

async function abrirFormulario() {
  render(<Thread profile={profile} threadId={HILO} now={NOW} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Crear consulta' }));
  await userEvent.click(await screen.findByRole('button', { name: /6205-2RS/ }));
  return screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
}

async function enviar(formulario: HTMLElement, cantidad: string) {
  await userEvent.type(within(formulario).getByLabelText(/Cantidad solicitada/i), cantidad);
  await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar consulta' }));
}

describe('Thread · Crear consulta', () => {
  it('el selector pide las líneas de la CONTRAPARTE del hilo, no las propias', async () => {
    await abrirFormulario();
    expect(fetchOrgLines).toHaveBeenCalledWith(SUYA, profile.orgId, '');
  });

  it('envía a la contraparte con la cantidad y notas tecleadas, con mi organización, y relee el hilo', async () => {
    const formulario = await abrirFormulario();
    await userEvent.type(within(formulario).getByLabelText('Notas adicionales'), 'Entrega en dos semanas');
    await enviar(formulario, '25');

    await waitFor(() => expect(sendInquiries).toHaveBeenCalledTimes(1));
    expect(sendInquiries.mock.calls[0]![0]).toEqual([
      { lineId: 'l-1', distributorOrgId: SUYA, quantity: 25, notes: 'Entrega en dos semanas' },
    ]);
    expect(sendInquiries.mock.calls[0]![1]).toBe(profile.orgId);
    // La relectura: el estado del hilo lo deriva la base, nunca el cliente (F-044).
    await waitFor(() => expect(fetchThreadDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('si la consulta falla, el motivo va en el formulario y NO se relee ni se pinta en el banner del hilo', async () => {
    sendInquiries.mockResolvedValue([{ lineId: 'l-1', distributorOrgId: SUYA, ok: false, error: 'Límite diario alcanzado' }]);
    const formulario = await abrirFormulario();
    await enviar(formulario, '25');

    expect(await within(formulario).findByRole('alert')).toHaveTextContent('Límite diario alcanzado');
    expect(fetchThreadDetail).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId('thread-body')).queryAllByRole('alert')).toHaveLength(1);
  });

  it('si el envío lanza (p. ej. sin clave de sesión), también se dice en el formulario', async () => {
    sendInquiries.mockRejectedValue(new Error('Tu clave de cifrado no está lista en esta sesión.'));
    const formulario = await abrirFormulario();
    await enviar(formulario, '25');

    expect(await within(formulario).findByRole('alert')).toHaveTextContent('Tu clave de cifrado no está lista');
    expect(screen.getByRole('dialog', { name: 'Nueva tarjeta de consulta' })).toBeInTheDocument();
  });
});
