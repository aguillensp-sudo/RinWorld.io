import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InquiryDraft } from '../../lib/inquiry-form';
import type { OrgLine } from '../../lib/search';
import type { VeraDraft } from '../../lib/vera-tools';

/**
 * VERA prepara consultas y ofertas en el pie del hilo (MSG-03 §5, F-249). Escrito a mano.
 *
 * Lo que se sostiene: el formulario se ABRE relleno con lo que dijo el usuario, nada se envía solo, el
 * precio de una oferta queda VACÍO, y la elección de línea solo se automatiza cuando es inequívoca.
 */

const fetchOrgLines = vi.fn<(orgId: string, ownOrgId: string, term: string) => Promise<OrgLine[]>>();

vi.mock('../../lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/search')>()),
  fetchOrgLines: (o: string, own: string, t: string) => fetchOrgLines(o, own, t),
}));

const { ThreadComposer } = await import('./ThreadComposer');

const linea = (over: Partial<OrgLine> = {}): OrgLine => ({
  id: 'l-1',
  partNumber: '6205-2RS',
  brand: 'SKF',
  quantity: 850,
  country: 'DE',
  consulted: false,
  ...over,
});

beforeEach(() => {
  fetchOrgLines.mockReset();
  fetchOrgLines.mockResolvedValue([linea()]);
});

const consultaVera = (over: Partial<Extract<VeraDraft, { kind: 'consulta' }>> = {}): VeraDraft => ({
  kind: 'consulta',
  reference: '6205-2RS',
  brand: '',
  quantity: 300,
  notes: null,
  nonce: 1,
  ...over,
});

const ofertaVera = (over: Partial<Extract<VeraDraft, { kind: 'oferta' }>> = {}): VeraDraft => ({
  kind: 'oferta',
  reference: '',
  brand: '',
  quantity: null,
  leadTimeDays: null,
  currency: null,
  notes: null,
  nonce: 1,
  ...over,
});

function pinta(props: {
  veraDraft: VeraDraft | null;
  onSubmitConsulta?: (l: OrgLine, d: InquiryDraft) => Promise<string | null>;
  conInquiry?: boolean;
  conOferta?: boolean;
}) {
  const onVeraDraftHandled = vi.fn();
  const onSubmit = props.onSubmitConsulta ?? vi.fn(async () => null);
  const onCreateOffer = vi.fn(async () => true);
  const vista = render(
    <ThreadComposer
      onSend={async () => true}
      veraDraft={props.veraDraft}
      onVeraDraftHandled={onVeraDraftHandled}
      {...(props.conInquiry === false
        ? {}
        : { inquiry: { counterpartyId: 'org-b', counterpartyName: 'NSK Europe Ltd', ownOrgId: 'org-a', onSubmit } })}
      {...(props.conOferta === false ? {} : { onCreateOffer })}
    />,
  );
  return { onVeraDraftHandled, onSubmit, onCreateOffer, ...vista };
}

describe('VERA prepara una CONSULTA', () => {
  it('con una sola línea elegible, abre ya el formulario relleno con la cantidad, sin enviar nada', async () => {
    const { onVeraDraftHandled, onSubmit } = pinta({ veraDraft: consultaVera({ notes: 'Entrega urgente' }) });

    const formulario = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    expect(within(formulario).getByLabelText(/Referencia/)).toHaveValue('6205-2RS');
    expect(within(formulario).getByLabelText(/Cantidad solicitada/i)).toHaveValue(300);
    expect(within(formulario).getByLabelText('Notas adicionales')).toHaveValue('Entrega urgente');
    // La búsqueda se hizo con la referencia que dijo el usuario.
    expect(fetchOrgLines).toHaveBeenCalledWith('org-b', 'org-a', '6205-2RS');
    // Nada se ha enviado: lo envía el usuario.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onVeraDraftHandled).toHaveBeenCalledTimes(1);
  });

  it('el usuario revisa y envía: se entrega la línea con LO PREPARADO, y lo puede cambiar antes', async () => {
    const onSubmitConsulta = vi.fn(async (_l: OrgLine, _d: InquiryDraft) => null);
    pinta({ veraDraft: consultaVera(), onSubmitConsulta });

    const formulario = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    const cantidad = within(formulario).getByLabelText(/Cantidad solicitada/i);
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '250');
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar consulta' }));

    await waitFor(() => expect(onSubmitConsulta).toHaveBeenCalledTimes(1));
    expect(onSubmitConsulta).toHaveBeenCalledWith(linea(), { quantity: 250, notes: null });
  });

  it('con varias líneas que coinciden, NO elige: abre el selector con la búsqueda y la cantidad se conserva al elegir', async () => {
    fetchOrgLines.mockResolvedValue([linea({ id: 'a', partNumber: '6205-2RS', brand: 'SKF' }), linea({ id: 'b', partNumber: '6205-ZZ', brand: 'FAG' })]);
    pinta({ veraDraft: consultaVera({ reference: '6205' }) });

    const selector = await screen.findByRole('dialog', { name: 'Crear consulta' });
    expect(within(selector).getByRole('searchbox')).toHaveValue('6205');
    expect(screen.queryByRole('dialog', { name: 'Nueva tarjeta de consulta' })).not.toBeInTheDocument();

    await userEvent.click(within(selector).getByRole('button', { name: /6205-ZZ/ }));
    const formulario = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    expect(within(formulario).getByLabelText(/Referencia/)).toHaveValue('6205-ZZ');
    expect(within(formulario).getByLabelText(/Cantidad solicitada/i)).toHaveValue(300);
  });

  it('si el usuario dijo la marca, elige la línea de esa marca entre varias', async () => {
    fetchOrgLines.mockResolvedValue([
      linea({ id: 'a', brand: 'SKF' }),
      linea({ id: 'b', brand: 'FAG' }),
    ]);
    pinta({ veraDraft: consultaVera({ brand: 'fag' }) });

    const formulario = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    expect(within(formulario).getByLabelText(/Marca/)).toHaveValue('FAG');
  });

  it('si la única línea ya tiene una consulta pendiente, no la elige: deja el selector con ella apagada', async () => {
    fetchOrgLines.mockResolvedValue([linea({ consulted: true })]);
    pinta({ veraDraft: consultaVera() });

    const selector = await screen.findByRole('dialog', { name: 'Crear consulta' });
    expect(await within(selector).findByRole('button', { name: /6205-2RS/ })).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: 'Nueva tarjeta de consulta' })).not.toBeInTheDocument();
  });

  it('si ninguna línea coincide, el selector lo dice y no se abre ningún formulario', async () => {
    fetchOrgLines.mockResolvedValue([]);
    pinta({ veraDraft: consultaVera({ reference: 'ZZZ' }) });

    const selector = await screen.findByRole('dialog', { name: 'Crear consulta' });
    expect(await within(selector).findByText(/No hay referencias publicadas|Ninguna referencia coincide/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Nueva tarjeta de consulta' })).not.toBeInTheDocument();
  });

  it('un borrador que llega sin que el pie pueda consultar (sin `inquiry`) se consume sin abrir nada', async () => {
    const { onVeraDraftHandled } = pinta({ veraDraft: consultaVera(), conInquiry: false });
    await waitFor(() => expect(onVeraDraftHandled).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelar y volver a abrir NO repite el borrador anterior (se consume una vez)', async () => {
    const { rerender } = pinta({ veraDraft: consultaVera() });
    const formulario = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    await userEvent.click(within(formulario).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // El padre sigue pasando el MISMO borrador (mismo nonce): no se reabre.
    rerender(
      <ThreadComposer
        onSend={async () => true}
        veraDraft={consultaVera()}
        inquiry={{ counterpartyId: 'org-b', counterpartyName: 'NSK', ownOrgId: 'org-a', onSubmit: async () => null }}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Pero una petición nueva (otro nonce) sí.
    rerender(
      <ThreadComposer
        onSend={async () => true}
        veraDraft={consultaVera({ nonce: 2, quantity: 77 })}
        inquiry={{ counterpartyId: 'org-b', counterpartyName: 'NSK', ownOrgId: 'org-a', onSubmit: async () => null }}
      />,
    );
    const otra = await screen.findByRole('dialog', { name: 'Nueva tarjeta de consulta' });
    expect(within(otra).getByLabelText(/Cantidad solicitada/i)).toHaveValue(77);
  });
});

describe('VERA prepara una OFERTA', () => {
  it('abre el formulario de oferta con lo dicho y el PRECIO VACÍO; enviar sigue deshabilitado hasta que el usuario lo escribe', async () => {
    const { onCreateOffer } = pinta({
      veraDraft: ofertaVera({ reference: '6205-2RS', brand: 'SKF', quantity: 500, leadTimeDays: 14, currency: 'EUR', notes: 'FOB Valencia' }),
    });

    const formulario = await screen.findByRole('dialog', { name: 'Crear oferta' });
    expect(within(formulario).getByLabelText('Referencia')).toHaveValue('6205-2RS');
    expect(within(formulario).getByLabelText('Marca')).toHaveValue('SKF');
    expect(within(formulario).getByLabelText('Cantidad')).toHaveValue('500');
    expect(within(formulario).getByLabelText(/Plazo de entrega/)).toHaveValue('14');
    expect(within(formulario).getByLabelText('Divisa')).toHaveValue('EUR');
    expect(within(formulario).getByLabelText('Precio unitario')).toHaveValue('');
    expect(within(formulario).getByRole('button', { name: 'Enviar oferta' })).toBeDisabled();
    expect(onCreateOffer).not.toHaveBeenCalled();
  });

  it('con otra divisa, la del transporte arranca igual', async () => {
    pinta({ veraDraft: ofertaVera({ currency: 'USD' }) });
    const formulario = await screen.findByRole('dialog', { name: 'Crear oferta' });
    expect(within(formulario).getByLabelText('Divisa')).toHaveValue('USD');
  });

  it('lo que VERA no dijo se queda sin rellenar', async () => {
    pinta({ veraDraft: ofertaVera({ quantity: 500 }) });
    const formulario = await screen.findByRole('dialog', { name: 'Crear oferta' });
    expect(within(formulario).getByLabelText(/Plazo de entrega/)).toHaveValue('');
    expect(within(formulario).getByLabelText('Referencia')).toHaveValue('');
  });

  it('el usuario teclea el precio y envía: la oferta lleva SU precio', async () => {
    const { onCreateOffer } = pinta({
      veraDraft: ofertaVera({ reference: '6205-2RS', brand: 'SKF', quantity: 500, currency: 'EUR' }),
    });
    const formulario = await screen.findByRole('dialog', { name: 'Crear oferta' });
    await userEvent.type(within(formulario).getByLabelText('Precio unitario'), '2,10');
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar oferta' }));

    await waitFor(() => expect(onCreateOffer).toHaveBeenCalledTimes(1));
    const [referencia, contenido] = onCreateOffer.mock.calls[0] as unknown as [{ partNumber: string }, { unitPrice: number; quantity: number }];
    expect(referencia.partNumber).toBe('6205-2RS');
    expect(contenido).toMatchObject({ unitPrice: 2.1, quantity: 500 });
  });

  it('un borrador de oferta sin `onCreateOffer` se consume sin abrir nada', async () => {
    const { onVeraDraftHandled } = pinta({ veraDraft: ofertaVera({ quantity: 5 }), conOferta: false });
    await waitFor(() => expect(onVeraDraftHandled).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
