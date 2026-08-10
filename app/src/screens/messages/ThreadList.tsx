import {
  previewLabel,
  relativeTime,
  stateTone,
  type StateTone,
  type ThreadSummary,
} from '../../lib/threads';
import styles from './ThreadList.module.css';

/**
 * Fila de la lista de hilos de MSG-01, puramente presentacional.
 *
 * No carga datos ni pagina: recibe las filas ya ordenadas por el servidor y
 * avisa con el ID del hilo cuando el usuario abre una. La vista previa sale de
 * `previewLabel`, que solo usa metadatos en claro (tipo de elemento y
 * referencia) — nunca contenido descifrado (spec §7, F-027).
 *
 * El indicador de no leídos del mock no se pinta: el esquema no tiene ningún
 * seguimiento de lectura y un recuento inventado delante del socio sería F-023.
 */
const TONE_CLASS: Record<StateTone, string> = {
  neutral: styles.neutral,
  info: styles.info,
  warn: styles.warn,
  success: styles.success,
  closed: styles.closed,
};

export function ThreadList({
  threads,
  now,
  onOpen,
}: {
  threads: ThreadSummary[];
  now?: Date | undefined;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.list}>
      {threads.map((thread) => (
        <div
          key={thread.id}
          role="button"
          tabIndex={0}
          className={styles.row}
          aria-label={`Abrir hilo con ${thread.counterpartyName}`}
          onClick={() => onOpen(thread.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(thread.id);
            }
          }}
        >
          <div className={styles.top}>
            <span className={styles.org}>{thread.counterpartyName}</span>
            <span className={styles.country}>{thread.counterpartyCountry}</span>
          </div>
          <div className={styles.tsRow}>
            <span className={styles.ts}>{relativeTime(thread.lastItemAt, now)}</span>
          </div>
          <div className={styles.bot}>
            <span className={styles.preview}>{previewLabel(thread.lastItem)}</span>
            <span className={`${styles.stateBadge} ${TONE_CLASS[stateTone(thread.state)]}`}>
              {thread.state}
            </span>
          </div>
          {/* Celda inferior derecha del grid del mock: sin ella el badge de
              estado ocuparía la columna derecha. */}
          <div aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
