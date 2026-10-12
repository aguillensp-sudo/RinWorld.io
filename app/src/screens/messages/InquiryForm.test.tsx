import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INQUIRY_FORM_TEXTS as T } from '../../lib/inquiry-form';
import { InquiryForm } from './InquiryForm';

/**
 * CONTRATO DE ACEPTACIÓN · MSG-03 §3.2 · formulario de consulta.
 *
 * Escrito por Claude Code ANTES de la corrida (`CLAUDE.md` §3). El Coder no lo ve. El componente es
 * presentacional: los textos y la validación vienen de `lib/inquiry-form.ts` (a mano y probada en
 * `inquiry-form.test.ts`); aquí solo se mide que el formulario los pinte, los use y llame a sus
 * callbacks con lo que toca.
 *
 * Los asertos negativos («no hay aviso») van ANCLADOS a algo que solo existe si el formulario se
 * pintó: un componente vacío no los cumple.
 */

function renderForm(over: Partial<React.ComponentProps<typeof InquiryForm>> = {}) {
  const handlers = { onSubmit: vi.fn(), onCancel: vi.fn() };
  render(
    <InquiryForm
      reference="6205-2RS"
      brand="FAG"
      country="Alemania"
      duplicate={false}
      busy={false}
      error={null}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

const cantidad = () => screen.getByLabelText(T.quantityLabel, { exact: false });
const notas = () => screen.getByLabelText(T.notesLabel);
const enviar = () => screen.getByRole('button', { name: /Enviar consulta|Enviando/ });

describe('MSG-03 · formulario de consulta · lo que pinta', () => {
  it('un solo h2 con el título y ningún h1', () => {
    renderForm();
    expect(screen.getByRole('heading', { level: 2, name: T.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText(T.subtitle)).toBeInTheDocument();
  });

  it('referencia, marca y país vienen heredados y son de solo lectura', () => {
    renderForm();
    for (const [etiqueta, valor] of [
      [T.referenceLabel, '6205-2RS'],
      [T.brandLabel, 'FAG'],
      [T.countryLabel, 'Alemania'],
    ] as const) {
      const campo = screen.getByLabelText(etiqueta, { exact: false });
      expect(campo).toHaveValue(valor);
      expect(campo).toHaveAttribute('readonly');
    }
    expect(screen.getAllByText(T.inheritedHint)).toHaveLength(2);
    expect(screen.getByText(T.countryHint)).toBeInTheDocument();
  });

  it('la cantidad y las notas son editables y llevan su ayuda', () => {
    renderForm();
    expect(cantidad()).not.toHaveAttribute('readonly');
    expect(cantidad()).toHaveValue(null);
    expect(notas()).not.toHaveAttribute('readonly');
    expect(notas()).toHaveAttribute('placeholder', T.notesPlaceholder);
    expect(screen.getByText(T.quantityHint)).toBeInTheDocument();
  });

  it('el campo de notas tope en 300 caracteres', () => {
    renderForm();
    expect(notas()).toHaveAttribute('maxlength', '300');
  });

  it('dice que se cifra antes de enviar', () => {
    renderForm();
    expect(screen.getByText(T.encryptHint)).toBeInTheDocument();
  });

  it('los botones son type=button salvo el de enviar, que es type=submit', () => {
    renderForm();
    expect(enviar()).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: T.cancel })).toHaveAttribute('type', 'button');
  });
});

describe('MSG-03 · formulario de consulta · cuándo se puede enviar', () => {
  it('sin cantidad el botón está deshabilitado y no hay reproche', () => {
    renderForm();
    expect(enviar()).toBeDisabled();
    expect(screen.queryByText(T.quantityInvalid)).not.toBeInTheDocument();
  });

  it('con una cantidad válida se habilita', async () => {
    renderForm();
    await userEvent.type(cantidad(), '300');
    expect(enviar()).toBeEnabled();
  });

  it.each(['0', '-3', '2.5'])('con %j se queda deshabilitado y explica por qué', async (texto) => {
    renderForm();
    await userEvent.type(cantidad(), texto);
    expect(enviar()).toBeDisabled();
    expect(screen.getByText(T.quantityInvalid)).toBeInTheDocument();
  });

  it('con una consulta duplicada pendiente: aviso en un role=alert y envío bloqueado aunque la cantidad valga', async () => {
    renderForm({ duplicate: true });
    await userEvent.type(cantidad(), '300');
    expect(screen.getByRole('alert')).toHaveTextContent(T.duplicateWarning);
    expect(enviar()).toBeDisabled();
  });

  it('sin duplicado y sin error no hay ningún aviso (anclado a que el formulario existe)', () => {
    renderForm();
    expect(cantidad()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(T.duplicateWarning)).not.toBeInTheDocument();
  });

  it('mientras envía: botón deshabilitado y con el texto de envío', async () => {
    renderForm({ busy: true });
    await userEvent.type(cantidad(), '300');
    expect(enviar()).toBeDisabled();
    expect(enviar()).toHaveTextContent(T.sending);
  });

  it('un fallo de envío se pinta en un role=alert', () => {
    renderForm({ error: 'No se puede cifrar todavía' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se puede cifrar todavía');
  });
});

describe('MSG-03 · formulario de consulta · lo que entrega', () => {
  it('Enviar entrega la cantidad como número y las notas recortadas', async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(cantidad(), '300');
    await userEvent.type(notas(), '  Plazo de dos semanas ');
    await userEvent.click(enviar());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ quantity: 300, notes: 'Plazo de dos semanas' });
  });

  it('sin notas entrega notes null, no una cadena vacía', async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(cantidad(), '25');
    await userEvent.click(enviar());
    expect(onSubmit).toHaveBeenCalledWith({ quantity: 25, notes: null });
  });

  it('Intro en la cantidad envía si vale y no envía si no vale', async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(cantidad(), '0{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.clear(cantidad());
    await userEvent.type(cantidad(), '40{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ quantity: 40, notes: null });
  });

  it('con duplicado, Intro tampoco envía', async () => {
    const { onSubmit } = renderForm({ duplicate: true });
    await userEvent.type(cantidad(), '40{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Cancelar llama a onCancel y no envía', async () => {
    const { onSubmit, onCancel } = renderForm();
    await userEvent.type(cantidad(), '300');
    await userEvent.click(screen.getByRole('button', { name: T.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
