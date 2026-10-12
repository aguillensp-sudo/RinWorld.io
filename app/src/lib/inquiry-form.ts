/**
 * MSG-03 §3.2 · el formulario de consulta: sus textos, su validación y lo que envía.
 *
 * Capa de datos escrita a mano (precondición de la tarea `MSG-03-FORM` del arnés). El componente
 * `InquiryForm` es presentacional: pinta estos textos y llama a estas funciones; no escribe ni un
 * literal ni decide cuándo se puede enviar. Los textos son los del HTML aprobado de `MSG-03` y los
 * de la spec (§3.2 y §6); donde discrepan manda el HTML en lo visual (F-170).
 */

/** Spec §3.2, campo 5: «Máx 300 caracteres». */
export const NOTES_MAX = 300;

/** `thread_items.quantity` es `integer` (0020): por encima de esto la base lo rechazaría. */
const QUANTITY_MAX = 2_147_483_647;

export const INQUIRY_FORM_TEXTS = {
  title: 'Nueva tarjeta de consulta',
  subtitle: 'Campos de referencia heredados del resultado de búsqueda',
  referenceLabel: 'Referencia (part_number)',
  brandLabel: 'Marca (brand)',
  countryLabel: 'País del distribuidor',
  inheritedHint: 'Heredado de la búsqueda · no editable',
  countryHint: 'País de stock del distribuidor · no editable',
  quantityLabel: 'Cantidad solicitada (quantity)',
  quantityHint: 'Número de unidades que necesitas',
  quantityInvalid: 'La cantidad tiene que ser un entero positivo.',
  notesLabel: 'Notas adicionales',
  notesPlaceholder: 'Máx 300 caracteres · condiciones, plazos, preguntas adicionales',
  /** Spec §6, literal. */
  duplicateWarning: 'Ya tienes una consulta pendiente para esta referencia con este distribuidor.',
  submit: 'Enviar consulta',
  sending: 'Enviando…',
  cancel: 'Cancelar',
  encryptHint: 'Cifrado E2EE antes del envío',
} as const;

/**
 * La cantidad escrita como número, o `null` si no es un entero positivo que quepa en la base.
 * Se rechaza lo que `Number()` aceptaría de más: `1e3`, `0x10`, `2.5`, `-3`, `' '`.
 */
export function parseQuantity(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= QUANTITY_MAX ? n : null;
}

export interface InquiryFormView {
  /** La cantidad ya validada; `null` mientras no sea un entero positivo. */
  quantity: number | null;
  /** Solo cuando hay algo escrito y no vale: un campo vacío explica su propio botón gris. */
  quantityError: string | null;
  /** Caracteres que quedan en las notas (negativo si se pasa). */
  notesLeft: number;
  /** El botón de enviar: cantidad válida, notas dentro del tope, sin duplicado y sin envío en curso. */
  canSubmit: boolean;
}

export function inquiryFormView(
  quantityText: string,
  notesText: string,
  state: { duplicate: boolean; busy: boolean },
): InquiryFormView {
  const quantity = parseQuantity(quantityText);
  const notesLeft = NOTES_MAX - notesText.length;
  return {
    quantity,
    quantityError: quantityText.trim() !== '' && quantity === null ? INQUIRY_FORM_TEXTS.quantityInvalid : null,
    notesLeft,
    canSubmit: quantity !== null && notesLeft >= 0 && !state.duplicate && !state.busy,
  };
}

/** Lo que el formulario entrega al wiring. */
export interface InquiryDraft {
  quantity: number;
  /** Recortadas; `null` si están vacías (nunca una cadena vacía cifrada). */
  notes: string | null;
}

/** `null` si el formulario no se puede enviar tal cual está. */
export function inquiryDraft(quantityText: string, notesText: string): InquiryDraft | null {
  const quantity = parseQuantity(quantityText);
  if (quantity === null || notesText.length > NOTES_MAX) return null;
  const notes = notesText.trim();
  return { quantity, notes: notes === '' ? null : notes };
}
