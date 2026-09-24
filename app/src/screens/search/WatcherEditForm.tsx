import {
  isValidWatcherDraft,
  WATCHER_COUNTRY_OPTIONS,
  type WatcherDraft,
} from '../../lib/watchers';
import styles from './WatcherEditForm.module.css';

interface Props {
  partNumber: string;
  draft: WatcherDraft;
  busy: boolean;
  error: string | null;
  onChange: (draft: WatcherDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * `Editar watcher` (spec §4). Totalmente controlado: no guarda ni un campo, cada
 * cambio devuelve el borrador ENTERO a quien lo posee (la pantalla). Solo hay uno
 * abierto a la vez y vive dentro del `<li>` de su tarjeta.
 */
export function WatcherEditForm({
  partNumber,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onCancel,
}: Props) {
  return (
    <form
      className={styles.form}
      aria-label={'Editar watcher ' + partNumber}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="watcher-edit-ref">
            Referencia
          </label>
          <input
            id="watcher-edit-ref"
            className={styles.input}
            type="text"
            placeholder="Ej: 6308-ZZ"
            value={draft.partNumber}
            onChange={(event) => onChange({ ...draft, partNumber: event.target.value })}
          />
          <span className={styles.hint}>Código exacto del rodamiento</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="watcher-edit-quantity">
            Cantidad mínima
          </label>
          <input
            id="watcher-edit-quantity"
            className={styles.input}
            type="number"
            placeholder="Ej: 100"
            value={draft.minQuantity}
            onChange={(event) => onChange({ ...draft, minQuantity: event.target.value })}
          />
          <span className={styles.hint}>Unidades mínimas para que se dispare</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="watcher-edit-brand">
            Marca
          </label>
          <input
            id="watcher-edit-brand"
            className={styles.input}
            type="text"
            placeholder="Cualquier marca"
            value={draft.brand}
            onChange={(event) => onChange({ ...draft, brand: event.target.value })}
          />
          <span className={styles.hint}>Opcional — deja vacío para cualquier fabricante</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="watcher-edit-country">
            País
          </label>
          <select
            id="watcher-edit-country"
            className={styles.select}
            value={draft.country}
            onChange={(event) => onChange({ ...draft, country: event.target.value })}
          >
            <option value="">Cualquier país</option>
            {WATCHER_COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <span className={styles.hint}>Opcional — deja vacío para cualquier origen</span>
        </div>
      </div>

      <div className={styles.checkField}>
        <label className={styles.checkLabel} htmlFor="watcher-edit-email">
          <input
            id="watcher-edit-email"
            type="checkbox"
            checked={draft.emailChannel}
            onChange={(event) => onChange({ ...draft, emailChannel: event.target.checked })}
          />
          Canal email
        </label>
        <span className={styles.hint}>Recibirás también una notificación por email</span>
      </div>

      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.buttons}>
        <button
          type="submit"
          className={styles.save}
          disabled={!isValidWatcherDraft(draft) || busy}
        >
          Guardar cambios
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
