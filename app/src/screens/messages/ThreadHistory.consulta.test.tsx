import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThreadItem } from '../../lib/thread-detail';
import { ThreadHistory } from './ThreadHistory';
import { HILO, NOW, SUYA, profile } from './Thread.fixtures';

/**
 * D2 · 0055 · las acciones de una consulta recibida: «Responder con oferta» y
 * «Sin stock». Las decide quien la recibe, una sola vez.
 */

function consulta(over: Partial<ThreadItem> = {}): ThreadItem {
  return {
    id: 'q-1',
    type: 'CONSULTA',
    senderOrgId: SUYA,
    isOwn: false,
    createdAt: '2026-08-11T10:00:00Z',
    partNumber: '6205-2RS',
    brand: 'NSK',
    offerState: null,
    inquiryState: 'Pendiente',
    respondsToItemId: null,
    supersededByItemId: null,
    content: { kind: 'CONSULTA', quantity: 250, comment: null },
    raw: { ciphertext: null, iv: null, wrappedKeyCount: 0 },
    ...over,
  };
}

function pinta(items: ThreadItem[], extra: Partial<Parameters<typeof ThreadHistory>[0]> = {}) {
  const onRespondWithOffer = vi.fn().mockResolvedValue(true);
  const onOutOfStock = vi.fn();
  render(
    <ThreadHistory
      items={items}
      threadId={HILO}
      viewerOrgId={profile.orgId}
      ownOrgName={profile.orgName}
      counterpartyName="NSK Europe Ltd"
      now={NOW}
      onAcceptOffer={vi.fn()}
      onRejectOffer={vi.fn()}
      onCounterOffer={vi.fn().mockResolvedValue(true)}
      onRespondWithOffer={onRespondWithOffer}
      onOutOfStock={onOutOfStock}
      {...extra}
    />,
  );
  return { onRespondWithOffer, onOutOfStock };
}

describe('consulta recibida Pendiente', () => {
  it('ofrece «Responder con oferta» y «Sin stock»', () => {
    pinta([consulta()]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument(); // ancla
    expect(screen.getByRole('button', { name: 'Responder con oferta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin stock' })).toBeInTheDocument();
  });

  it('«Sin stock» llama a onOutOfStock con la consulta', async () => {
    const user = userEvent.setup();
    const { onOutOfStock } = pinta([consulta()]);
    await user.click(screen.getByRole('button', { name: 'Sin stock' }));
    expect(onOutOfStock).toHaveBeenCalledWith('q-1');
  });

  it('«Responder con oferta» abre el formulario con la cantidad de la consulta y envía', async () => {
    const user = userEvent.setup();
    const { onRespondWithOffer } = pinta([consulta()]);
    await user.click(screen.getByRole('button', { name: 'Responder con oferta' }));
    expect(screen.getByLabelText('Cantidad')).toHaveValue('250');
    await user.type(screen.getByLabelText('Precio unitario'), '3');
    await user.click(screen.getByRole('button', { name: 'Enviar oferta' }));
    await vi.waitFor(() => expect(onRespondWithOffer).toHaveBeenCalledTimes(1));
    expect(onRespondWithOffer).toHaveBeenCalledWith(
      'q-1',
      expect.objectContaining({ kind: 'OFERTA', unitPrice: 3, quantity: 250 }),
    );
  });
});

describe('consulta sin acciones', () => {
  it('la que envié yo no se puede decidir', () => {
    pinta([consulta({ isOwn: true, senderOrgId: profile.orgId })]);
    expect(screen.getByTestId('thread-item')).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Responder con oferta|Sin stock/ })).toBeNull();
  });

  it('una ya decidida es terminal y enseña su estado', () => {
    pinta([consulta({ inquiryState: 'Sin stock' })]);
    expect(screen.getByText('Sin stock')).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('button', { name: /Responder con oferta|Sin stock/ })).toBeNull();
  });
});
