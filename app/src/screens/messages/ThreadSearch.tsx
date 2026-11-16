import { useState } from 'react';
import {
  TAB_TEXTS,
  matchReferences,
  type ThreadReference,
  type ThreadReferenceOption,
} from '../../lib/negotiation-rows';
import styles from './ThreadSearch.module.css';

interface ThreadSearchProps {
  references: ThreadReferenceOption[];
  onPick: (reference: ThreadReference) => void;
}

/**
 * El buscador de referencias del hilo, la barra al pie de las tres pestañas.
 *
 * Presentacional: las coincidencias las decide `matchReferences`, no la pieza. Con
 * texto y coincidencias despliega la lista; elegir una lanza `onPick` y vacía el
 * campo (la lista desaparece). No hay botón Buscar (spec `thread-reference-search`).
 */
export function ThreadSearch({ references, onPick }: ThreadSearchProps) {
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const matches = matchReferences(references, text);
  const showList = trimmed !== '' && matches.length > 0;
  const showNone = trimmed !== '' && matches.length === 0;

  function pick(ref: ThreadReferenceOption) {
    onPick({ partNumber: ref.partNumber, brand: ref.brand });
    setText('');
  }

  return (
    <div role="search" className={styles.search}>
      <div className={styles.dropdown}>
        {showList && (
          <ul role="listbox" aria-label={TAB_TEXTS.searchResultsLabel} className={styles.results}>
            {matches.map((ref) => (
              <li
                key={ref.label}
                role="option"
                aria-selected={false}
                tabIndex={0}
                className={styles.option}
                onClick={() => pick(ref)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    pick(ref);
                  }
                }}
              >
                {ref.label}
              </li>
            ))}
          </ul>
        )}
        {showNone && <p className={styles.noMatches}>{TAB_TEXTS.noMatches(trimmed)}</p>}
      </div>

      <div className={styles.field}>
        <svg
          className={styles.icon}
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="11"
            y1="11"
            x2="15"
            y2="15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          className={styles.input}
          aria-label={TAB_TEXTS.searchPlaceholder}
          placeholder={TAB_TEXTS.searchPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
    </div>
  );
}
