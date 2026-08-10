import type { ThreadState, ThreadSummary } from '../../lib/threads';
import { previewLabel, relativeTime } from '../../lib/threads';
import styles from './ThreadList.module.css';

/**
 * Lista de hilos de MSG-01.
 *
 * Componente de presentación: recibe los hilos ya cargados y avisa al abrir
 * el hilo. La carga, la búsqueda y la paginación viven en Messages.tsx; aquí
 * solo se pintan las filas, en el mismo orden en que llegan (actividad
 * descendente).
 *
 * La fila es un botón para que el lector de pantalla la anuncie como acción
 * navegable, igual que el HTML aprobado hacía toda la fila clicable.
 */

const BADGE_CLS: Record<ThreadState, string> = {
  ABIERTO: styles.abierto,
  'CON CONSULTA PENDIENTE': styles.consulta,
  'CON OFERTA PENDIENTE': styles.oferta,
  'ACUERDO ALCANZADO': styles.acuerdo,
  'CERRADO SIN ACUERDO': styles.cerrado,
};

interface Props {
  threads: ThreadSummary[];
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  onOpen: (thread: ThreadSummary) => void;
}

export function ThreadList({ threads, now, onOpen }: Props) {
  const nowDate = now ?? new Date();

  return (
    <div className={styles.list}>
      {threads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          className={styles.row}
          onClick={() => onOpen(thread)}
        >
          <span className={styles.topRow}>
            <span className={styles.org}>{thread.counterpartyName}</span>
            <span className={styles.country}>{thread.counterpartyCountry}</span>
            <span className={styles.ts}>{relativeTime(thread.lastItemAt, nowDate)}</span>
          </span>
          <span className={styles.botRow}>
            <span className={styles.preview}>{previewLabel(thread.lastItem)}</span>
            <span className={`${styles.badge} ${BADGE_CLS[thread.state]}`}>
              {thread.state}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
