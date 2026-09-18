import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './SearchField.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  inputLabel?: string;
  submitLabel: string;
  clearLabel?: string;
}

/**
 * Campo de búsqueda estándar del proyecto (decisión del PO, 18-sep-2026, C5 de
 * FORO-02): input con la lupa dentro, a la derecha, y una "x" que aparece en
 * cuanto hay texto sin confirmar. La "x" solo BORRA el campo (`onChange('')`);
 * nunca dispara `onSubmit`, porque la búsqueda sigue siendo server-side —
 * teclear (incluida la propia "x") no consulta, Enter o la lupa sí.
 *
 * Toda pantalla NUEVA con buscador usa este componente. Las ya aprobadas se
 * migran una a una (DIR-01 y FORO-02 ya lo usan; INV-01/MSG-01/SentOffers
 * quedan como deuda en ESTADO-V1.md §5), independientemente de lo que diga su
 * spec original sobre el buscador — el estándar manda sobre el ejemplo viejo.
 */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputLabel,
  submitLabel,
  clearLabel = 'Borrar búsqueda',
}: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className={styles.wrap}>
      <input
        type="search"
        className={styles.input}
        aria-label={inputLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value !== '' && (
        <button type="button" className={styles.clearIcon} aria-label={clearLabel} onClick={() => onChange('')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <button type="button" className={styles.searchButton} aria-label={submitLabel} onClick={onSubmit}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <line x1="16.2" y1="16.2" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
