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
 * El color del badge de estado. `styles` es un índice de strings —una clase
 * puede faltar en una build sin CSS—, así que el valor admite `undefined` y
 * quien lo compone lo descarta.
 */
const STATE_CLASS: Record<RequestState, string | undefined> = {
  PENDING_REVIEW: styles.pending,
  INVITED_APPROVED: styles.approved,
  REJECTED: styles.rejected,
  CANCELLED: styles.cancelled,
};

/**
 * El formato de fecha es SIEMPRE el de la capa de datos —aquí no se escribe
 * ninguna fecha a mano—, pero el instante se le pasa normalizado a su reloj UTC:
 * la cola del Operador se audita en UTC y así la misma solicitud no sale con una
 * hora distinta según la zona horaria de la máquina que la mira. En un entorno
 * en UTC el desplazamiento es cero.
 */
function utcClock(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + new Date(t).getTimezoneOffset() * 60_000).toISOString();
}

/**
 * Panel lateral de detalle de ADMIN-01.
 *
 * Totalmente controlado: no llama a ninguna función de red, no decide cuándo se
 * abre el formulario de rechazo —eso es de `AdminRequests`— y el textarea del
 * motivo no guarda su propio estado: su `value` es `rejectReason` y cada tecla
 * sale por `onRejectReasonChange`.
 */
export function RequestDetailPanel({
  row,
  history = [],
  historyLoading = false,
  rejecting,
  rejectReason = '',
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
  /**
   * El pie: SOLO UNA de las ramas de decisión a la vez, en el orden de prioridad
   * de la spec. El `actionError` va aparte, encima: avisa y NO oculta la rama
   * que toque, para que el operador pueda reintentar sin perder los botones.
   */
  let decision: JSX.Element | null = null;

  if (feedback === 'approved') {
    // Texto literal de la tarea: NINGUNA mención a un email. El proveedor de
    // correo de EML-07/EML-08 no existe en el proyecto y esta pantalla no puede
    // afirmar un envío que no ocurre.
    decision = <p className={styles.feedbackApprove}>Aprobación registrada.</p>;
  } else if (feedback === 'rejected') {
    decision = <p className={styles.feedbackReject}>Solicitud rechazada.</p>;
  } else if (rejecting) {
    decision = (
      <div className={styles.rejectForm}>
        <textarea
          className={styles.reason}
          placeholder="Explica el motivo del rechazo — se enviará al solicitante"
          maxLength={500}
          value={rejectReason}
          onChange={(e) => onRejectReasonChange(e.target.value)}
        />
        <p className={styles.hint}>
          Este texto se incluirá en el email de rechazo (EML-08) · Mín 10 / máx 500 caracteres
        </p>
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.confirm}
            // La validación sale de la capa de datos: el `CHECK` de la base y
            // este botón no pueden discrepar (F-148).
            disabled={actionBusy || !isValidRejectionReason(rejectReason)}
            onClick={onConfirmReject}
          >
            Confirmar rechazo
          </button>
          <button
            type="button"
            className={styles.cancel}
            disabled={actionBusy}
            onClick={onCancelReject}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  } else if (row.state === 'PENDING_REVIEW') {
    decision = (
      <div className={styles.actions}>
        <button type="button" className={styles.approve} disabled={actionBusy} onClick={onApprove}>
          Aprobar
        </button>
        <button type="button" className={styles.reject} disabled={actionBusy} onClick={onStartReject}>
          Rechazar
        </button>
      </div>
    );
  } else if (row.state === 'REJECTED') {
    decision = (
      <button
        type="button"
        className={styles.return}
        disabled={actionBusy}
        onClick={onReturnToReview}
      >
        Volver a revisión
      </button>
    );
  }
  // INVITED_APPROVED y CANCELLED son estados de solo lectura: sin botones.

  return (
    <aside className={styles.panel} aria-label="Detalle de solicitud">
      <header className={styles.header}>
        <div>
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
      </header>

      <div className={styles.body}>
        <section>
          <h3 className={styles.sectionLabel}>Datos FSR</h3>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Empresa</span>
            <span className={styles.fieldValue}>{row.orgName}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>País</span>
            <span className={styles.fieldValue}>{`${row.countryLabel} · ${row.country}`}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Nombre solicitante</span>
            <span className={styles.fieldValue}>{row.applicantName}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={`${styles.fieldValue} ${styles.valueMono}`}>{row.email}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Teléfono</span>
            <span className={`${styles.fieldValue} ${styles.valueMono}`}>
              {row.phone === '' ? '—' : row.phone}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Sitio web</span>
            <span className={styles.fieldValue}>
              {row.website === '' ? (
                '—'
              ) : (
                <a
                  className={styles.extLink}
                  href={websiteHref(row.website)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.website}
                </a>
              )}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Enviado</span>
            <span className={`${styles.fieldValue} ${styles.valueMono}`}>
              {requestDateLabel(utcClock(row.submittedAt))}
            </span>
          </div>
        </section>

        <section>
          <h3 className={styles.sectionLabel}>Historial de estado</h3>
          {historyLoading ? (
            <p className={styles.historyLoading}>Cargando historial…</p>
          ) : (
            <ul className={styles.history}>
              {history.map((event) => (
                <li key={event.id} className={styles.historyItem}>
                  <span className={`${styles.stateBadge} ${STATE_CLASS[event.state] ?? ''}`}>
                    {event.state}
                  </span>
                  <span className={styles.historyDate}>
                    {requestDateLabel(utcClock(event.at))}
                  </span>
                  {event.note !== '' && <span className={styles.historyNote}>{event.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        {actionError !== null && (
          <div className={styles.alert} role="alert">
            {actionError}
          </div>
        )}
        {decision}
      </footer>
    </aside>
  );
}
