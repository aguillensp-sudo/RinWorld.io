import { useState } from 'react';
import type { OfferContent } from '../../lib/thread-detail';
import styles from './OfferCounterForm.module.css';

/**
 * Formulario de contraoferta · MSG-03 §4.2, prerellenado (`Plan §3`, día 10).
 *
 * **No es MSG-03 entero.** MSG-03 es una tabla de consultas y ofertas que no
 * está en las 8 pantallas de `Plan §9` — solo entra el formulario de creación
 * de oferta (§4.2), en modal, sobre la tarjeta que ya está en el hilo. El HTML
 * aprobado de MSG-02 abre este mismo formulario navegando a MSG-03; aquí se
 * abre inline porque MSG-03 como pantalla no se construye este MVP.
 *
 * **`part_number` y `brand` no son campos del formulario.** MSG-03 §4.2 dice
 * "heredado... editable si es oferta directa" — y una contraoferta nunca lo es:
 * `offer-card` exige que se hereden salvo "cambio explícito de referencia", que
 * este flujo no ofrece. La RPC `counter_offer` (0013) los toma de la oferta
 * anterior en la base pase lo que pase por aquí, así que un campo editable
 * sería mentira: parecería que cambia algo que no cambia.
 */

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN'] as const;

export interface OfferDraft {
  unitPrice: string;
  currency: string;
  quantity: string;
  leadTimeDays: string;
  shippingCost: string;
  shippingCostCurrency: string;
  validUntil: string;
  notes: string;
}

/** El borrador arranca con los valores de la oferta que se está superando. */
export function draftFromOffer(o: OfferContent): OfferDraft {
  return {
    unitPrice: String(o.unitPrice),
    currency: o.currency,
    quantity: String(o.quantity),
    leadTimeDays: o.leadTimeDays !== null && o.leadTimeDays !== undefined ? String(o.leadTimeDays) : '',
    shippingCost: o.shippingCost !== null && o.shippingCost !== undefined ? String(o.shippingCost) : '',
    shippingCostCurrency: o.shippingCostCurrency ?? o.currency,
    validUntil: o.validUntil ? o.validUntil.slice(0, 10) : '',
    notes: o.notes ?? '',
  };
}

function numero(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

/**
 * Las validaciones de MSG-03 §4.2, campo a campo. Devuelve el primer motivo
 * por el que no se puede enviar, o `null` si el borrador ya es una oferta
 * válida.
 */
export function offerDraftError(d: OfferDraft, now: Date = new Date()): string | null {
  const precio = numero(d.unitPrice);
  if (!d.unitPrice.trim() || !Number.isFinite(precio) || precio <= 0) {
    return 'El precio unitario tiene que ser un número positivo.';
  }
  if (!d.currency.trim()) return 'Falta la divisa.';

  const cantidad = Number(d.quantity.trim());
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return 'La cantidad tiene que ser un entero positivo.';
  }

  if (d.leadTimeDays.trim()) {
    const plazo = Number(d.leadTimeDays.trim());
    if (!Number.isInteger(plazo) || plazo <= 0) {
      return 'El plazo de entrega tiene que ser un entero positivo.';
    }
  }

  if (d.shippingCost.trim()) {
    const transporte = numero(d.shippingCost);
    if (!Number.isFinite(transporte) || transporte < 0) {
      return 'El coste de transporte tiene que ser un número positivo.';
    }
    // MSG-03 §4.2, fila 8: obligatoria SI el campo 7 tiene valor.
    if (!d.shippingCostCurrency.trim()) return 'Falta la divisa del transporte.';
  }

  if (d.validUntil.trim()) {
    const t = new Date(d.validUntil).getTime();
    if (Number.isNaN(t)) return 'La fecha de validez no es válida.';
    if (t < now.getTime()) return 'La fecha de validez tiene que ser futura.';
  }

  // offer-card: notes, máximo 500 caracteres.
  if (d.notes.length > 500) return 'Las notas no pueden superar los 500 caracteres.';

  return null;
}

/** Solo se llama cuando `offerDraftError` ya dio `null`. */
export function draftToOfferContent(d: OfferDraft): OfferContent {
  const conTransporte = d.shippingCost.trim().length > 0;
  return {
    kind: 'OFERTA',
    unitPrice: numero(d.unitPrice),
    currency: d.currency,
    quantity: Number(d.quantity.trim()),
    leadTimeDays: d.leadTimeDays.trim() ? Number(d.leadTimeDays.trim()) : null,
    // shipping_cost null, NUNCA 0, si no se informó (offer-card): el cero
    // engañoso ya lo resolvió `shippingLine` en `offers.ts` para la lectura;
    // aquí es la misma regla en la escritura.
    shippingCost: conTransporte ? numero(d.shippingCost) : null,
    shippingCostCurrency: conTransporte ? d.shippingCostCurrency : null,
    validUntil: d.validUntil.trim() ? new Date(d.validUntil).toISOString() : null,
    notes: d.notes.trim() ? d.notes.trim() : null,
  };
}

export function OfferCounterForm({
  partNumber,
  brand,
  original,
  onCancel,
  onSubmit,
}: {
  partNumber: string;
  brand: string;
  /** La oferta que se está superando, ya descifrada: es el prerelleno. */
  original: OfferContent;
  onCancel: () => void;
  /** Devuelve si el envío salió bien. Igual criterio que `ThreadComposer`. */
  onSubmit: (content: OfferContent) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<OfferDraft>(() => draftFromOffer(original));
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const error = offerDraftError(draft);
  const referencia = [partNumber, brand].filter(Boolean).join(' · ');

  const campo =
    <K extends keyof OfferDraft>(clave: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setTocado(true);
      setDraft((d) => ({ ...d, [clave]: e.target.value }));
    };

  const enviar = async () => {
    if (error || enviando) return;
    setEnviando(true);
    try {
      await onSubmit(draftToOfferContent(draft));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="counter-offer-title">
        <h2 className={styles.title} id="counter-offer-title">
          Contra-oferta
        </h2>
        <p className={styles.hint}>
          Datos de la oferta original, pre-rellenados. Modifícalos y envía tu contraoferta.
        </p>
        <p className={styles.reference}>{referencia}</p>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-price">
              Precio unitario
            </label>
            <input
              id="co-price"
              className={styles.input}
              inputMode="decimal"
              value={draft.unitPrice}
              onChange={campo('unitPrice')}
              disabled={enviando}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-currency">
              Divisa
            </label>
            <select
              id="co-currency"
              className={styles.input}
              value={draft.currency}
              onChange={campo('currency')}
              disabled={enviando}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-quantity">
              Cantidad
            </label>
            <input
              id="co-quantity"
              className={styles.input}
              inputMode="numeric"
              value={draft.quantity}
              onChange={campo('quantity')}
              disabled={enviando}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-lead-time">
              Plazo de entrega (días)
            </label>
            <input
              id="co-lead-time"
              className={styles.input}
              inputMode="numeric"
              value={draft.leadTimeDays}
              onChange={campo('leadTimeDays')}
              disabled={enviando}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-shipping">
              Coste de transporte
            </label>
            <input
              id="co-shipping"
              className={styles.input}
              inputMode="decimal"
              value={draft.shippingCost}
              onChange={campo('shippingCost')}
              disabled={enviando}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-shipping-currency">
              Divisa del transporte
            </label>
            <select
              id="co-shipping-currency"
              className={styles.input}
              value={draft.shippingCostCurrency}
              onChange={campo('shippingCostCurrency')}
              disabled={enviando}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="co-valid-until">
              Válida hasta
            </label>
            <input
              id="co-valid-until"
              type="date"
              className={styles.input}
              value={draft.validUntil}
              onChange={campo('validUntil')}
              disabled={enviando}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="co-notes">
              Notas
            </label>
            <textarea
              id="co-notes"
              className={styles.textarea}
              rows={3}
              maxLength={500}
              value={draft.notes}
              onChange={campo('notes')}
              disabled={enviando}
            />
          </div>
        </div>

        {tocado && error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.submitButton}
            disabled={!!error || enviando}
            onClick={() => {
              void enviar();
            }}
          >
            Enviar contraoferta
          </button>
        </div>
      </div>
    </div>
  );
}
