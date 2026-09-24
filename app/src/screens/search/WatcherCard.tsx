import {
  conditionsLabel,
  daysLeftLabel,
  daysTone,
  expiresInLabel,
  sinceLabel,
  triggeredLabel,
  type WatcherRow,
  type WatcherState,
} from '../../lib/watchers';
import styles from './WatcherCard.module.css';

/**
 * El badge de estado pinta `row.state` TAL CUAL (spec §3): el literal viene de
 * la base y la capa de datos ya traduce `PENDIENTE RENOVACION` -> `PENDIENTE RENOVACIÓN`.
 * El color sí sale de aquí, que es presentación.
 *
 * Los valores del mapa son `string | undefined` (los tipos de CSS Module se leen
 * con índice), así que el mapa se declara `Record<WatcherState, string | undefined>`
 * y quien lo consulta cae al estilo PAUSED si faltara la clase. Nunca pasa, pero
 * el tipo no miente.
 */
const STATE_CLASS: Record<WatcherState, string | undefined> = {
  ACTIVE: styles.stateActive,
  PAUSED: styles.statePaused,
  TRIGGERED: styles.stateTriggered,
  'PENDIENTE RENOVACIÓN': styles.stateRenewal,
  EXPIRED: styles.stateExpired,
};

interface Props {
  row: WatcherRow;
  /** Inyectable para que los tests no dependan del reloj. */
  now: Date;
  /** Hay una llamada en vuelo: TODOS los botones van deshabilitados. */
  busy: boolean;
  onPause: (row: WatcherRow) => void;
  onResume: (row: WatcherRow) => void;
  onEdit: (row: WatcherRow) => void;
  onDelete: (row: WatcherRow) => void;
  onRenew: (row: WatcherRow) => void;
  onLetExpire: (row: WatcherRow) => void;
  onViewResults: (row: WatcherRow) => void;
}

/**
 * Tarjeta de un watcher (spec §3). Presentacional: sin red y sin estado. Las
 * acciones disponibles dependen del estado — ninguna otra combinación existe.
 */
export function WatcherCard({
  row,
  now,
  busy,
  onPause,
  onResume,
  onEdit,
  onDelete,
  onRenew,
  onLetExpire,
  onViewResults,
}: Props) {
  const isActive = row.state === 'ACTIVE';
  const isPaused = row.state === 'PAUSED';
  const isTriggered = row.state === 'TRIGGERED';
  const isRenewal = row.state === 'PENDIENTE RENOVACIÓN';

  const triggered = triggeredLabel(row);
  const stateClass = STATE_CLASS[row.state] ?? styles.statePaused;

  return (
    <article className={styles.card} aria-label={'Watcher ' + row.partNumber} data-state={row.state}>
      <div className={styles.head}>
        <span className={styles.ref}>{row.partNumber}</span>
        <span className={`${styles.badge} ${stateClass}`}>{row.state}</span>
      </div>

      <p className={styles.conditions}>{conditionsLabel(row)}</p>

      <div className={styles.meta}>
        <span className={styles.created}>{'Creado: ' + sinceLabel(row.createdAt, now)}</span>

        {/* Días restantes: SOLO en ACTIVE y PAUSED (spec §3). Naranja si < 5. */}
        {(isActive || isPaused) && (
          <span className={styles.days} data-tone={daysTone(row.daysRemaining ?? 0)}>
            {daysLeftLabel(row.daysRemaining ?? 0, isPaused)}
          </span>
        )}

        {/* PENDIENTE RENOVACIÓN: cuenta atrás para decidir, no «días restantes». */}
        {isRenewal && (
          <span className={styles.days} data-tone={daysTone(row.renewalDaysLeft ?? 0)}>
            {expiresInLabel(row.renewalDaysLeft ?? 0)}
          </span>
        )}
      </div>

      {/* Canales: in-app siempre, email solo si el watcher lo tiene activado. */}
      <div className={styles.channels}>
        <span className={styles.channel}>
          <i className="ti ti-bell" aria-hidden="true" />
          In-app
        </span>
        {row.emailChannel && (
          <span className={styles.channel}>
            <i className="ti ti-mail" aria-hidden="true" />
            Email
          </span>
        )}
      </div>

      {/* TRIGGERED: resumen del disparo + «Ver resultados» (spec §3). */}
      {isTriggered && triggered !== null && <p className={styles.triggeredInfo}>{triggered}</p>}

      <div className={styles.actions}>
        {isTriggered && (
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy}
            onClick={() => onViewResults(row)}
          >
            Ver resultados
          </button>
        )}

        {isRenewal && (
          <>
            <button
              type="button"
              className={styles.renewBtn}
              disabled={busy}
              onClick={() => onRenew(row)}
            >
              Mantener activo 30 días más
            </button>
            <button
              type="button"
              className={styles.plainBtn}
              disabled={busy}
              onClick={() => onLetExpire(row)}
            >
              Dejar que expire
            </button>
          </>
        )}

        {isActive && (
          <button
            type="button"
            className={styles.actionBtn}
            aria-label={`Pausar — ${row.partNumber}`}
            disabled={busy}
            onClick={() => onPause(row)}
          >
            Pausar
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            className={styles.actionBtn}
            aria-label={`Reactivar — ${row.partNumber}`}
            disabled={busy}
            onClick={() => onResume(row)}
          >
            Reactivar
          </button>
        )}

        {(isActive || isPaused) && (
          <button
            type="button"
            className={styles.actionBtn}
            aria-label={`Editar — ${row.partNumber}`}
            disabled={busy}
            onClick={() => onEdit(row)}
          >
            Editar
          </button>
        )}

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.dangerBtn}`}
          aria-label={`Eliminar — ${row.partNumber}`}
          disabled={busy}
          onClick={() => onDelete(row)}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}
