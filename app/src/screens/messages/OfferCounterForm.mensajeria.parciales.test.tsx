import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfferCounterForm, emptyDraft, offerDraftError } from './OfferCounterForm';

/**
 * `messaging-and-negotiation/offer-card#2` · oferta directa sin consulta previa.
 *
 *   GIVEN un hilo ya existente entre dos organizaciones
 *   WHEN  cualquiera de las dos partes pulsa «Crear oferta» sin consulta previa pendiente
 *   THEN  el sistema permite crear la tarjeta de oferta directamente
 *   AND   requiere como minimo part_number, brand, unit_price, currency y quantity
 *
 * Precio, divisa y cantidad van cifrados, asi que el servidor no puede exigirlos: el formulario es
 * la unica puerta. Escrito por Claude Code; no es contrato del arnes.
 */

function montar() {
  const onSubmit = vi.fn(async () => true);
  render(
    <OfferCounterForm
      partNumber=""
      brand=""
      referenceEditable
      title="Crear oferta"
      submitLabel="Enviar oferta"
      onCancel={() => {}}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, boton: () => screen.getByRole('button', { name: 'Enviar oferta' }) };
}

describe('messaging-and-negotiation/offer-card', () => {
  it('messaging-and-negotiation/offer-card#2 · una oferta directa no se puede enviar hasta tener referencia, marca, precio y cantidad (y la divisa) y entonces sale con esos valores', async () => {
    const user = userEvent.setup();
    const { onSubmit, boton } = montar();
    expect(boton()).toBeDisabled();

    await user.type(screen.getByLabelText('Referencia'), '6207-2RS');
    expect(boton()).toBeDisabled(); // falta marca, precio y cantidad
    await user.type(screen.getByLabelText('Marca'), 'NSK');
    expect(boton()).toBeDisabled(); // faltan precio y cantidad
    await user.type(screen.getByLabelText('Precio unitario'), '2,10');
    expect(boton()).toBeDisabled(); // falta cantidad
    await user.type(screen.getByLabelText('Cantidad'), '500');
    expect(boton()).toBeEnabled();

    // Quitar cualquiera de los cinco obligatorios lo vuelve a bloquear.
    await user.clear(screen.getByLabelText('Marca'));
    expect(boton()).toBeDisabled();
    await user.type(screen.getByLabelText('Marca'), 'NSK');
    expect(boton()).toBeEnabled();
    await user.clear(screen.getByLabelText('Referencia'));
    expect(boton()).toBeDisabled();
    await user.type(screen.getByLabelText('Referencia'), '6207-2RS');
    await user.clear(screen.getByLabelText('Precio unitario'));
    expect(boton()).toBeDisabled();
    await user.type(screen.getByLabelText('Precio unitario'), '2,10');
    await user.clear(screen.getByLabelText('Cantidad'));
    expect(boton()).toBeDisabled();
    await user.type(screen.getByLabelText('Cantidad'), '500');
    expect(boton()).toBeEnabled();

    await user.click(boton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [contenido, referencia] = onSubmit.mock.calls[0] as unknown as [
      { unitPrice: number; currency: string; quantity: number },
      { partNumber: string; brand: string },
    ];
    expect(contenido).toMatchObject({ unitPrice: 2.1, currency: 'EUR', quantity: 500 });
    expect(referencia).toEqual({ partNumber: '6207-2RS', brand: 'NSK' });
  });

  it('messaging-and-negotiation/offer-card#2 · la validacion exige cada cifra por separado: sin precio, sin divisa o sin cantidad hay motivo; con las tres, no', () => {
    const base = { ...emptyDraft(), unitPrice: '2,10', currency: 'EUR', quantity: '500' };
    expect(offerDraftError(base)).toBeNull();
    expect(offerDraftError({ ...base, unitPrice: '' })).not.toBeNull();
    expect(offerDraftError({ ...base, unitPrice: '0' })).not.toBeNull();
    expect(offerDraftError({ ...base, currency: '' })).toBe('Falta la divisa.');
    expect(offerDraftError({ ...base, quantity: '' })).not.toBeNull();
    expect(offerDraftError({ ...base, quantity: '0' })).not.toBeNull();
  });
});
