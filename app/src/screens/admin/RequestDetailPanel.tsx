import {
  isValidRejectionReason,
  requestDateLabel,
  websiteHref,
  type RequestEvent,
  type RequestRow,
  type RequestState,
} from '../../lib/admin-requests';
import styles from './RequestDetailPanel.module.css';

interface Props {
  row: RequestRow;
  history: RequestEvent[];
  historyLoading: boolean;
  rejecting: boolean;
  rejectReason: string;
  onRejectReasonChange: (v: string) => void;
  actionBusy: boolean;
  actionError: string | null;
  feedback: 'approved' | 'rejected' | null;
  onApprove: () => void;
  onStartReject: () => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  onReturnToReview: () => void;
  onClose: () => void;
}

/**
 * El valor es `string | undefined` a propósito: con `noUncheckedIndexedAccess`,
 * la declaración de los CSS Modules del repo es una firma de índice y cada
 * `styles.x` puede ser `undefined`. Se declara tal cual en vez de forzar un
 * `as string`, que sería mentir sobre lo que el tipo dice de verdad.
 */
const STATE_CLASS: Record<RequestState, string | undefined> = {
  PENDING_REVIEW: styles.statePending,
  INVITED_APPROVED: styles.stateApproved,
  REJECTED: styles.stateRejected,
  CANCELLED: styles.stateCancelled,
};

/**
 * Panel lateral de detalle de ADMIN-01.
 *
 * Totalmente controlado: no llama a la red, no decide cuándo se abre el
 * formulario de rechazo y **no guarda el texto del motivo** — su `value` es
 * `rejectReason` y cada tecla sube por `onRejectReasonChange`. La validación del
 * botón de confirmar sale de `isValidRejectionReason`, jamás de un `.length`
 * escrito a mano.
 *
 * El pie (`<footer>`) es una sola rama de las cinco posibles, en el orden de la
 * tarea: error → confirmación de aprobación → confirmación de rechazo →
 * formulario → decisión según el estado de la fila.
 */
export function RequestDetailPanel({
  row,
  history,
  historyLoading,
  rejecting,
  rejectReason,
  onRejectReasonChange,
  actionBusy,
  actionError,
  feedback,
  onApprove,
  onStartReject,
  onConfirmReject,
  onCancelReject,
  onReturnToReview,
  onClose,
}: Props) {
  const canConfirmReject = isValidRejectionReason(rejectReason);

  return (
    <aside className={styles.panel} aria-label="Detalle de solicitud">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>Detalle de solicitud</p>
          <h2 className={styles.title}>{row.orgName}</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Cerrar panel de detalle"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Datos FSR</div>

          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Empresa</span>
            <span className={styles.dataValue}>{row.orgName}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>País</span>
            <span className={styles.dataValue}>{`${row.countryLabel} · ${row.country}`}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Nombre solicitante</span>
            <span className={styles.dataValue}>{row.applicantName}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Email</span>
            <span className={`${styles.dataValue} ${styles.dataValueMono}`}>{row.email}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Teléfono</span>
            <span className={`${styles.dataValue} ${styles.dataValueMono}`}>
              {row.phone ? row.phone : '—'}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Sitio web</span>
            <span className={styles.dataValue}>
              {row.website ? (
                <a
                  className={styles.link}
                  href={websiteHref(row.website)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.website}
                </a>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataLabel}>Enviado</span>
            <span className={`${styles.dataValue} ${styles.dataValueMono}`}>
              {requestDateLabel(row.submittedAt)}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Historial de estado</div>
          {historyLoading ? (
            <p className={styles.historyLoading}>Cargando historial…</p>
          ) : (
            <ul className={styles.historyList}>
              {history.map((event) => (
                <li key={event.id} className={styles.historyItem}>
                  <span className={`${styles.stateBadge} ${STATE_CLASS[event.state]}`}>
                    {event.state}
                  </span>
                  <div className={styles.historyBody}>
                    <div className={styles.historyTime}>{requestDateLabel(event.at)}</div>
                    {event.note ? <div className={styles.historyNote}>{event.note}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        {/*
          El error no oculta lo que venga detrás: si el `UPDATE` falló, la fila
          sigue en su estado y los botones de decisión siguen ahí para reintentar.
        */}
        {actionError !== null && (
          <div role="alert" className={styles.actionError}>
            {actionError}
          </div>
        )}

        {feedback === 'approved' ? (
          /* No se menciona ningún email: no existe proveedor de correo en el
             proyecto y esta pantalla no puede afirmar un envío que no ocurre. */
          <div className={styles.feedbackApproved}>Aprobación registrada.</div>
        ) : feedback === 'rejected' ? (
          <div className={styles.feedbackRejected}>Solicitud rechazada.</div>
        ) : rejecting ? (
          <div className={styles.rejectForm}>
            <textarea
              className={styles.textarea}
              placeholder="Explica el motivo del rechazo — se enviará al solicitante"
              maxLength={500}
              value={rejectReason}
              onChange={(e) => onRejectReasonChange(e.target.value)}
            />
            <p className={styles.hint}>
              Este texto se incluirá en el email de rechazo (EML-08) · Mín 10 / máx 500 caracteres
            </p>
            <div className={styles.rejectButtons}>
              <button
                type="button"
                className={styles.primaryDanger}
                disabled={actionBusy || !canConfirmReject}
                onClick={onConfirmReject}
              >
                Confirmar rechazo
              </button>
              <button
                type="button"
                className={styles.plain}
                disabled={actionBusy}
                onClick={onCancelReject}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : row.state === 'PENDING_REVIEW' ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={actionBusy}
              onClick={onApprove}
            >
              Aprobar
            </button>
            {/* Abre el formulario; quien confirma el rechazo es `onConfirmReject`. */}
            <button
              type="button"
              className={styles.plain}
              disabled={actionBusy}
              onClick={onStartReject}
            >
              Rechazar
            </button>
          </div>
        ) : row.state === 'REJECTED' ? (
          <button
            type="button"
            className={styles.plain}
            disabled={actionBusy}
            onClick={onReturnToReview}
          >
            Volver a revisión
          </button>
        ) : null}
      </footer>
    </aside>
  );
}
