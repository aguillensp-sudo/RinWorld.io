import styles from './DeleteWatcherModal.module.css';

const TITLE_ID = 'delete-watcher-title';

interface Props {
  partNumber: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación del borrado (spec §6). El borrado es irreversible — no hay
 * papelera — así que `Eliminar` de la tarjeta solo abre esto: la pantalla es
 * quien llama a `deleteWatcher` cuando aquí se confirma. Totalmente controlado,
 * y se cierra con `Cancelar`, no con un clic fuera.
 */
export function DeleteWatcherModal({ partNumber, busy, error, onConfirm, onCancel }: Props) {
  return (
    <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={TITLE_ID}>
      <div className={styles.panel}>
        <p className={styles.title} id={TITLE_ID}>
          {'¿Eliminar el watcher de ' + partNumber + '? Esta acción no se puede deshacer.'}
        </p>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.buttons}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
