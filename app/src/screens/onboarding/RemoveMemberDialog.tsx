import { useEffect, useRef } from 'react';
import type { TeamMember } from '../../lib/invitations';
import styles from './RemoveMemberDialog.module.css';

interface Props {
  member: TeamMember;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLE_ID = 'remove-member-title';

const WARNING = 'Esta acción es irreversible. El usuario perderá acceso inmediatamente.';

/**
 * La confirmación de INVT-01. Presentacional: NO elimina nada, solo pregunta.
 *
 * Dos cosas que el componente tiene que hacer por sí mismo porque nadie más
 * puede: llevarse el foco al botón `Cancelar` al abrirse (la acción segura es la
 * que menos se pulsa) y escuchar Escape en `document` mientras está montado.
 * Nada de `window.confirm`: el diálogo es este.
 */
export function RemoveMemberDialog({ member, busy, error, onConfirm, onCancel }: Props) {
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
          Eliminar usuario
        </h2>
        <div className={styles.person}>
          <span className={styles.name}>{member.fullName}</span>
          <span className={styles.email}>{member.email}</span>
        </div>
        <p className={styles.warning}>{WARNING}</p>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={busy}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
