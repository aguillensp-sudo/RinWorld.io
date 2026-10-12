import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INQUIRY_FORM_TEXTS as F, INQUIRY_PICKER_TEXTS as P, type InquiryDraft } from '../../lib/inquiry-form';
import type { OrgLine } from '../../lib/search';

/**
 * `Crear consulta` en el pie del hilo (MSG-03 §3.2, F-249): selector → formulario → envío. Escrito a
 * mano. El selector hace su consulta de red y se mockea; el formulario es el del Coder, de verdad.
 */

const fetchOrgLines = vi.fn<(orgId: string, ownOrgId: string, term: string) => Promise<OrgLine[]>>();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchOrgLines: (o: string, own: string, t: string) => fetchOrgLines(o, own, t),
}));

const { ThreadComposer } = await import('./ThreadComposer');

const LINEA: OrgLine = { id: 'l-1', partNumber: '6205-2RS', brand: 'SKF', quantity: 850, country: 'DE', consulted: false };

beforeEach(() => {
  fetchOrgLines.mockReset();
  fetchOrgLines.mockResolvedValue([LINEA]);
});

function pinta(onSubmit: (l: OrgLine, d: InquiryDraft) => Promise<string | null>) {
  render(
    <ThreadComposer
      onSend={async () => true}
      inquiry={{ counterpartyId: 'org-b', counterpartyName: 'NSK Europe Ltd', ownOrgId: 'org-a', onSubmit }}
    />,
  );
}

async function hastaElFormulario() {
  await userEvent.click(screen.getByRole('button', { name: P.button }));
  await userEvent.click(await screen.findByRole('button', { name: /6205-2RS/ }));
  return screen.findByRole('dialog', { name: F.title });
}

async function rellenar(dialogo: HTMLElement, cantidad: string) {
  await userEvent.type(within(dialogo).getByLabelText(/Cantidad solicitada/i), cantidad);
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar consulta' }));
}

describe('ThreadComposer · Crear consulta', () => {
  it('sin la prop `inquiry` el botón no se pinta (no hay control inerte)', () => {
    render(<ThreadComposer onSend={async () => true} />);
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: P.button })).not.toBeInTheDocument();
  });

  it('el botón abre el selector de línea de la contraparte', async () => {
    pinta(async () => null);
    await userEvent.click(screen.getByRole('button', { name: P.button }));
    expect(await screen.findByRole('dialog', { name: P.title })).toBeInTheDocument();
    expect(fetchOrgLines).toHaveBeenCalledWith('org-b', 'org-a', '');
  });

  it('elegir una línea cierra el selector y abre el formulario con la referencia heredada', async () => {
    pinta(async () => null);
    const formulario = await hastaElFormulario();
    expect(within(formulario).getByLabelText(/Referencia/)).toHaveValue('6205-2RS');
    expect(within(formulario).getByLabelText(/Marca/)).toHaveValue('SKF');
    expect(within(formulario).getByLabelText(/País del distribuidor/)).toHaveValue('Alemania');
    expect(screen.queryByRole('dialog', { name: P.title })).not.toBeInTheDocument();
  });

  it('enviar entrega la línea y la cantidad y las notas tecleadas, y cierra si salió bien', async () => {
    const onSubmit = vi.fn(async (_l: OrgLine, _d: InquiryDraft) => null);
    pinta(onSubmit);
    const formulario = await hastaElFormulario();
    await userEvent.type(within(formulario).getByLabelText('Notas adicionales'), 'Urgente');
    await rellenar(formulario, '60');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(LINEA, { quantity: 60, notes: 'Urgente' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('si el envío falla, el motivo sale DENTRO del formulario, que sigue abierto con lo escrito', async () => {
    pinta(async () => 'No se puede cifrar todavía');
    const formulario = await hastaElFormulario();
    await rellenar(formulario, '60');

    expect(await within(formulario).findByRole('alert')).toHaveTextContent('No se puede cifrar todavía');
    expect(within(formulario).getByLabelText(/Cantidad solicitada/i)).toHaveValue(60);
    expect(screen.getByRole('dialog', { name: F.title })).toBeInTheDocument();
  });

  it('si el servidor dice que ya hay una consulta pendiente, enseña el aviso de la spec y bloquea el envío', async () => {
    pinta(async () => F.duplicateWarning);
    const formulario = await hastaElFormulario();
    await rellenar(formulario, '60');

    expect(await within(formulario).findByRole('alert')).toHaveTextContent(F.duplicateWarning);
    expect(within(formulario).getAllByRole('alert')).toHaveLength(1);
    expect(within(formulario).getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
  });

  it('Cancelar cierra el formulario sin enviar nada', async () => {
    const onSubmit = vi.fn(async () => null);
    pinta(onSubmit);
    const formulario = await hastaElFormulario();
    await userEvent.click(within(formulario).getByRole('button', { name: F.cancel }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('tras cancelar se puede volver a abrir y el formulario arranca vacío', async () => {
    pinta(async () => null);
    const primero = await hastaElFormulario();
    await userEvent.type(within(primero).getByLabelText(/Cantidad solicitada/i), '99');
    await userEvent.click(within(primero).getByRole('button', { name: F.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const segundo = await hastaElFormulario();
    expect(within(segundo).getByLabelText(/Cantidad solicitada/i)).toHaveValue(null);
  });
});
