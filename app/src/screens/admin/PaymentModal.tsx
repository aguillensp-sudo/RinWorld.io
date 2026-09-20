import { isValidPaymentDate, isValidPaymentNote, todayIso } from '../../lib/admin-billing';
import styles from './PaymentModal.module.css';

interface Props {
  orgName: string;
  date: string;
  note: string;
  busy: boolean;
  error: string | null;
  onDateChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Mismo id siempre: solo puede haber un modal de pago abierto a la vez. */
const TITLE_ID = 'bw-payment-modal-title';

/**
 * Modal `Marcar pago recibido` de ADMIN-02.
 *
 * Totalmente controlado y sin estado propio: `date` y `note` son los `value` de
 * sus campos y cada cambio se notifica hacia arriba. Sirve también para
 * `Reactivar` —es el mismo verbo en la base— y por eso su título es siempre
 * «Marcar pago recibido».
 *
 * No hay ningún campo de tarjeta ni referencia a pasarela alguna (spec §7): el
 * cobro es por transferencia bancaria confirmada a mano por el operador.
 */
export function PaymentModal({
  orgName,
  date,
  note,
  busy,
  error,
  onDateChange,
  onNoteChange,
  onConfirm,
  onCancel,
}: Props) {
  const canConfirm = isValidPaymentDate(date) && isValidPaymentNote(note) && !busy;

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className={styles.dialog}>
        <div className={styles.header}>
          <h2 id={TITLE_ID} className={styles.title}>
            Marcar pago recibido
          </h2>
          <p className={styles.orgName}>{orgName}</p>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bw-payment-date">
              Fecha del pago
            </label>
            <input
              id="bw-payment-date"
              type="date"
              className={styles.input}
              value={date}
              max={todayIso(new Date())}
              onChange={(e) => onDateChange(e.target.value)}
            />
            <p className={styles.hint}>Fecha en que se recibió la transferencia</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bw-payment-note">
              Nota interna
            </label>
            <textarea
              id="bw-payment-note"
              className={styles.textarea}
              value={note}
              maxLength={300}
              onChange={(e) => onNoteChange(e.target.value)}
            />
            <p className={styles.hint}>
              Máx 300 caracteres · ej: referencia de transferencia, banco emisor
            </p>
          </div>

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Confirmar pago recibido
          </button>
        </div>
      </div>
    </div>
  );
}
