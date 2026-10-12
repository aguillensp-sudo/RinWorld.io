import { describe, expect, it } from 'vitest';
import {
  INQUIRY_FORM_TEXTS as T,
  NOTES_MAX,
  inquiryDraft,
  inquiryFormView,
  inquiryProgress,
  parseQuantity,
} from './inquiry-form';

describe('inquiry-form · parseQuantity', () => {
  it.each([
    ['300', 300],
    ['  42 ', 42],
    ['1', 1],
    ['2147483647', 2_147_483_647],
  ])('%j es un entero positivo', (texto, esperado) => {
    expect(parseQuantity(texto)).toBe(esperado);
  });

  it.each(['', ' ', '0', '-3', '2.5', '2,5', '1e3', '0x10', 'abc', '12abc', '2147483648'])(
    '%j no vale',
    (texto) => {
      expect(parseQuantity(texto)).toBeNull();
    },
  );
});

describe('inquiry-form · inquiryFormView', () => {
  const libre = { duplicate: false, busy: false };

  it('sin cantidad no se puede enviar y no se riñe a un campo vacío', () => {
    const v = inquiryFormView('', '', libre);
    expect(v.canSubmit).toBe(false);
    expect(v.quantityError).toBeNull();
  });

  it('una cantidad que no vale se explica; una que vale, no', () => {
    expect(inquiryFormView('0', '', libre).quantityError).toBe(T.quantityInvalid);
    expect(inquiryFormView('2.5', '', libre).canSubmit).toBe(false);
    expect(inquiryFormView('300', '', libre).quantityError).toBeNull();
    expect(inquiryFormView('300', '', libre).canSubmit).toBe(true);
  });

  it('el duplicado y el envío en curso bloquean aunque la cantidad valga', () => {
    expect(inquiryFormView('300', '', { duplicate: true, busy: false }).canSubmit).toBe(false);
    expect(inquiryFormView('300', '', { duplicate: false, busy: true }).canSubmit).toBe(false);
  });

  it('las notas llegan hasta 300 caracteres y ni uno más', () => {
    expect(NOTES_MAX).toBe(300);
    expect(inquiryFormView('5', 'x'.repeat(300), libre)).toMatchObject({ canSubmit: true, notesLeft: 0 });
    expect(inquiryFormView('5', 'x'.repeat(301), libre)).toMatchObject({ canSubmit: false, notesLeft: -1 });
  });
});

describe('inquiry-form · inquiryProgress', () => {
  it('cuenta desde 1 y solo habla si hay cola', () => {
    expect(inquiryProgress(0, 1)).toBeNull();
    expect(inquiryProgress(0, 3)).toBe('Consulta 1 de 3');
    expect(inquiryProgress(2, 3)).toBe('Consulta 3 de 3');
  });
});

describe('inquiry-form · inquiryDraft', () => {
  it('entrega la cantidad como número y las notas recortadas', () => {
    expect(inquiryDraft(' 300 ', '  Plazo de dos semanas  ')).toEqual({ quantity: 300, notes: 'Plazo de dos semanas' });
  });

  it('notas vacías o en blanco son null, nunca una cadena vacía', () => {
    expect(inquiryDraft('10', '')).toEqual({ quantity: 10, notes: null });
    expect(inquiryDraft('10', '   ')).toEqual({ quantity: 10, notes: null });
  });

  it('devuelve null si no se puede enviar', () => {
    expect(inquiryDraft('', 'hola')).toBeNull();
    expect(inquiryDraft('0', '')).toBeNull();
    expect(inquiryDraft('5', 'x'.repeat(301))).toBeNull();
  });

  it('el literal del duplicado es el de la spec §6', () => {
    expect(T.duplicateWarning).toBe('Ya tienes una consulta pendiente para esta referencia con este distribuidor.');
  });
});
