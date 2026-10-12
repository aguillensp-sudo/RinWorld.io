import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INQUIRY_PICKER_TEXTS as T } from '../../lib/inquiry-form';
import { ORG_LINES_LIMIT, type OrgLine } from '../../lib/search';

/**
 * `Crear consulta` en el hilo · el selector de línea (MSG-03 §3.2, F-249). Escrito a mano, con su
 * test a mano. Se mockea solo la consulta de red; el resto es el componente de verdad.
 */

const fetchOrgLines = vi.fn<(orgId: string, ownOrgId: string, term: string) => Promise<OrgLine[]>>();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchOrgLines: (o: string, own: string, t: string) => fetchOrgLines(o, own, t),
}));

const { InquiryLinePicker } = await import('./InquiryLinePicker');

const LIBRE: OrgLine = { id: 'l-1', partNumber: '6205-2RS', brand: 'SKF', quantity: 850, country: 'DE', consulted: false };
const PENDIENTE: OrgLine = { id: 'l-2', partNumber: '22316-E', brand: 'FAG', quantity: 40, country: 'SE', consulted: true };

function pinta() {
  const handlers = { onPick: vi.fn(), onCancel: vi.fn() };
  render(
    <InquiryLinePicker counterpartyId="org-b" counterpartyName="NSK Europe Ltd" ownOrgId="org-a" {...handlers} />,
  );
  return handlers;
}

beforeEach(() => {
  fetchOrgLines.mockReset();
  fetchOrgLines.mockResolvedValue([LIBRE, PENDIENTE]);
});

describe('InquiryLinePicker', () => {
  it('pide las líneas de la contraparte con mi organización, y dice a quién se pregunta', async () => {
    pinta();
    await waitFor(() => expect(fetchOrgLines).toHaveBeenCalledWith('org-b', 'org-a', ''));
    const dialogo = screen.getByRole('dialog', { name: T.title });
    expect(within(dialogo).getByText(T.hint('NSK Europe Ltd'))).toBeInTheDocument();
  });

  it('pinta cada línea con su referencia, marca, país y existencias', async () => {
    pinta();
    const boton = await screen.findByRole('button', { name: /6205-2RS/ });
    expect(boton).toHaveTextContent('SKF');
    expect(boton).toHaveTextContent('Alemania');
    expect(boton).toHaveTextContent('850 u');
  });

  it('elegir una línea llama a onPick con ella', async () => {
    const { onPick } = pinta();
    await userEvent.click(await screen.findByRole('button', { name: /6205-2RS/ }));
    expect(onPick).toHaveBeenCalledWith(LIBRE);
  });

  it('una línea con consulta pendiente sale apagada, con su motivo y sin poder elegirse', async () => {
    const { onPick } = pinta();
    const apagada = await screen.findByRole('button', { name: /22316-E/ });
    expect(apagada).toBeDisabled();
    expect(apagada).toHaveAttribute('title', T.pendingWhy);
    expect(within(apagada).getByText(T.pending)).toBeInTheDocument();
    await userEvent.click(apagada);
    expect(onPick).not.toHaveBeenCalled();
    // Y la libre no lleva etiqueta: el aviso es de la fila, no de la lista.
    expect(within(screen.getByRole('button', { name: /6205-2RS/ })).queryByText(T.pending)).not.toBeInTheDocument();
  });

  it('buscar (Intro) vuelve a pedir con el término, saneado por la capa de datos', async () => {
    pinta();
    await screen.findByRole('button', { name: /6205-2RS/ });
    await userEvent.type(screen.getByRole('searchbox', { name: T.searchLabel }), '6205{Enter}');
    await waitFor(() => expect(fetchOrgLines).toHaveBeenLastCalledWith('org-b', 'org-a', '6205'));
  });

  it('teclear sin confirmar no consulta: la búsqueda es server-side', async () => {
    pinta();
    await screen.findByRole('button', { name: /6205-2RS/ });
    await userEvent.type(screen.getByRole('searchbox', { name: T.searchLabel }), '62');
    expect(fetchOrgLines).toHaveBeenCalledTimes(1);
  });

  it('sin líneas y sin búsqueda dice que no hay referencias que puedas ver; con búsqueda, que no coincide', async () => {
    fetchOrgLines.mockResolvedValue([]);
    pinta();
    expect(await screen.findByText(T.empty)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: T.searchLabel }), 'zzz{Enter}');
    expect(await screen.findByText(T.noMatches)).toBeInTheDocument();
  });

  it('un fallo de carga se dice en un role=alert', async () => {
    fetchOrgLines.mockRejectedValue(new Error('Sin conexión'));
    pinta();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  });

  it('avisa del tope si la lista llega al máximo', async () => {
    fetchOrgLines.mockResolvedValue(
      Array.from({ length: ORG_LINES_LIMIT }, (_, i) => ({ ...LIBRE, id: `l-${i}`, partNumber: `R-${i}` })),
    );
    pinta();
    expect(await screen.findByText(T.limit(ORG_LINES_LIMIT))).toBeInTheDocument();
  });

  it('sin tope alcanzado no avisa de ningún tope (anclado a que la lista existe)', async () => {
    pinta();
    await screen.findByRole('button', { name: /6205-2RS/ });
    expect(screen.queryByText(T.limit(ORG_LINES_LIMIT))).not.toBeInTheDocument();
  });

  it('Cancelar y Escape llaman a onCancel', async () => {
    const { onCancel } = pinta();
    await screen.findByRole('button', { name: /6205-2RS/ });
    await userEvent.click(screen.getByRole('button', { name: T.cancel }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
