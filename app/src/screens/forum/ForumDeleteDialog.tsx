import { useEffect, useRef } from 'react';
import styles from './ForumDeleteDialog.module.css';

interface Props {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLE_ID = 'forum-delete-title';

/**
 * La confirmación de FORO-03 al eliminar una publicación propia (spec §6, CA-FORO-06).
 * Presentacional: NO elimina nada, solo pregunta. El foco va al botón `Cancelar` (la acción
 * segura es la que menos se pulsa) y Escape cancela, como en `RemoveMemberDialog`.
 */
export function ForumDeleteDialog({ busy, error, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className={styles.dialog}>
        <h2 id={TITLE_ID} className={styles.title}>
          ¿Eliminar esta publicación? Esta acción es irreversible.
        </h2>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
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
