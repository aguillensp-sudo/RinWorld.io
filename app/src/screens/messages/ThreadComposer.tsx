import { CREATE_OFFER_DISABLED_REASON, SEND_DISABLED_REASON } from '../../lib/thread-detail';
import styles from './ThreadComposer.module.css';

/**
 * Pie de composición de MSG-02.
 *
 * Sin props a propósito: se pinta igual en los cinco estados del hilo. Quien
 * decide montarlo es la pantalla (D-07-01). El textarea se puede escribir; lo
 * que falta es el cifrado, no la redacción, y el botón lo explica en texto
 * visible.
 */
export function ThreadComposer() {
  return (
    <div className={styles.composer}>
      <div className={styles.inputRow}>
        <textarea
          className={styles.textarea}
          name="mensaje"
          aria-label="Escribe un mensaje"
          placeholder="Escribe un mensaje..."
          rows={1}
        />
        <button type="button" className={styles.sendButton} disabled aria-label="Enviar mensaje">
          →
        </button>
        <span className={styles.reason}>{SEND_DISABLED_REASON}</span>
      </div>
      <div className={styles.subRow}>
        <button type="button" className={styles.offerButton} disabled>
          Crear oferta
        </button>
        <span className={styles.reason}>{CREATE_OFFER_DISABLED_REASON}</span>
        <span className={styles.encryptHint}>Cifrado E2EE antes del envío</span>
      </div>
    </div>
  );
}
