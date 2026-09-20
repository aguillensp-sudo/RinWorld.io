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

/**
 * Ids estables: el diálogo toma su nombre accesible del título por
 * `aria-labelledby`, y hay un solo modal en pantalla a la vez.
 */
const TITLE_ID = 'bw-payment-modal-title';
const DATE_ID = 'bw-payment-modal-date';
const NOTE_ID = 'bw-payment-modal-note';

/**
 * Modal `Marcar pago recibido` de ADMIN-02.
 *
 * Es el mismo diálogo cuando se abre por `Reactivar`: en la base los dos verbos
 * son `billing_confirm_payment`. Totalmente controlado, sin estado propio, y sin
 * ningún campo de tarjeta ni redirección a pasarela (spec §7): el cobro es por
 * transferencia confirmada a mano. Solo se cierra con Cancelar.
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
    <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 id={TITLE_ID} className={styles.title}>
            Marcar pago recibido
          </h2>
          <p className={styles.orgName}>{orgName}</p>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={DATE_ID}>
              Fecha del pago
            </label>
            <input
              id={DATE_ID}
              type="date"
              className={styles.input}
              value={date}
              max={todayIso(new Date())}
              onChange={(e) => onDateChange(e.target.value)}
            />
            <p className={styles.hint}>Fecha en que se recibió la transferencia</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={NOTE_ID}>
              Nota interna
            </label>
            <textarea
              id={NOTE_ID}
              className={styles.textarea}
              value={note}
              maxLength={300}
              onChange={(e) => onNoteChange(e.target.value)}
            />
            <p className={styles.hint}>Máx 300 caracteres · ej: referencia de transferencia, banco emisor</p>
          </div>

          {error !== null ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} disabled={!canConfirm} onClick={onConfirm}>
            Confirmar pago recibido
          </button>
        </footer>
      </div>
    </div>
  );
}
