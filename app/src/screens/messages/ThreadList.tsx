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
/**
 * El tono → su clase. Va tipado con `| undefined` porque con
 * `noUncheckedIndexedAccess` un módulo CSS devuelve `string | undefined`: la
 * clase podría no existir en el fichero. El `??` se resuelve en el único sitio
 * donde se usa, y así una clase que falte deja la fila sin adorno en vez de
 * escribir la palabra `undefined` en el atributo.
 */
const TONE_CLASS: Record<StateTone, string | undefined> = {
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
  // Sin hilos no se pinta una lista vacía: se pinta el estado de la spec §6. Es
  // de este componente y no de la pantalla porque "no hay filas" es un estado de
  // la lista — si lo decidieran los dos, acabarían discrepando.
  if (threads.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          Todavía no tienes ninguna conversación. Usa el Directorio para contactar con otras
          organizaciones.
        </p>
        <button type="button" className={styles.emptyBtn} disabled>
          <i className="ti ti-address-book" aria-hidden="true" />
          Ir al Directorio
        </button>
        <p className={styles.emptyReason}>El Directorio (DIR-01) queda fuera del MVP.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {threads.map((thread) => (
        <li key={thread.id} className={styles.item}>
          <button
            type="button"
            className={styles.row}
            aria-label={`Abrir hilo con ${thread.counterpartyName}`}
            onClick={() => onOpen(thread.id)}
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
              <span className={`${styles.stateBadge} ${TONE_CLASS[stateTone(thread.state)] ?? ''}`}>
                {thread.state}
              </span>
            </div>
            {/* Celda inferior derecha del grid del mock: sin ella el badge de
                estado ocuparía la columna derecha. */}
            <div aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
