import styles from './FavoriteConfirmDialog.module.css';

const TITLE_ID = 'favorite-confirm-title';

interface Props {
  orgName: string;
  /** `true` pregunta si se añade; `false`, si se quita. */
  adding: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación de favoritos (PO, 24-oct-2026): marcar y desmarcar una organización como favorita nunca es
 * un solo clic —ni desde Comprando ni desde la ficha—, porque un clic suelto sobre la estrella de una fila
 * quitaba el favorito sin avisar. Totalmente controlado: la pantalla es quien llama a `toggleFavorite`
 * cuando aquí se confirma, y se cierra con `Cancelar`, no con un clic fuera.
 */
export function FavoriteConfirmDialog({ orgName, adding, busy, error, onConfirm, onCancel }: Props) {
  const title = adding
    ? `¿Añadir a ${orgName} a tus favoritos?`
    : `¿Quitar a ${orgName} de tus favoritos?`;

  return (
    <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={TITLE_ID}>
      <div className={styles.panel}>
        <p className={styles.title} id={TITLE_ID}>
          {title}
        </p>
        <p className={styles.note}>
          Los favoritos son tuyos: no los ven los demás miembros de tu organización ni cambian el orden de los resultados.
        </p>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.buttons}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>
            {adding ? 'Añadir a favoritos' : 'Quitar de favoritos'}
          </button>
        </div>
      </div>
    </div>
  );
}
