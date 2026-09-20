import {
  billingDateLabel,
  type BillingPayment,
  type BillingRow,
  type BillingState,
  type BillingStatusEvent,
} from '../../lib/admin-billing';
import styles from './BillingDetailPanel.module.css';

interface Props {
  row: BillingRow;
  contactEmail: string | null;
  payments: BillingPayment[];
  events: BillingStatusEvent[];
  loading: boolean;
  actionBusy: boolean;
  actionError: string | null;
  feedback: string | null;
  onClose: () => void;
  onMarkPaid: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}

const STATE_CLASS: Record<BillingState, string | undefined> = {
  ACTIVE: styles.stateActive,
  SUSPENDED: styles.stateSuspended,
  'EN PRUEBA': styles.stateTrial,
  'CANDIDATA A BORRADO': styles.stateCandidate,
};

/**
 * La base guarda `APPROVED` en el historial; la spec nombra ese estado `ACTIVE`.
 * Cualquier otro valor se pinta tal cual.
 */
function displayStatus(status: string): string {
  return status === 'APPROVED' ? 'ACTIVE' : status;
}

/**
 * El inicio del estado actual no es una columna: se deduce del estado vigente,
 * porque la vista no guarda «desde cuándo» de forma genérica.
 */
function stateSince(row: BillingRow): string | null {
  switch (row.state) {
    case 'SUSPENDED':
    case 'CANDIDATA A BORRADO':
      return row.suspendedSince;
    case 'ACTIVE':
      return row.lastPaymentDate;
    case 'EN PRUEBA':
      return row.joinedAt;
    default:
      return null;
  }
}

/**
 * Panel lateral de detalle de ADMIN-02.
 *
 * Totalmente controlado: no llama a la red y no decide cuándo se abre el modal
 * de pago — solo avisa con sus callbacks. Mientras `loading`, las dos listas se
 * sustituyen por el texto de carga; mientras `actionBusy`, los botones de acción
 * se deshabilitan (el de cerrar, no).
 */
export function BillingDetailPanel({
  row,
  contactEmail,
  payments,
  events,
  loading,
  actionBusy,
  actionError,
  feedback,
  onClose,
  onMarkPaid,
  onSuspend,
  onReactivate,
}: Props) {
  return (
    <aside aria-label="Detalle de organización" aria-busy={loading} className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Detalle de organización</p>
          <h2 className={styles.title}>{row.name}</h2>
        </div>
        <button type="button" className={styles.close} aria-label="Cerrar detalle" onClick={onClose}>
          ×
        </button>
      </header>

      <div className={styles.body}>
        <dl className={styles.defs}>
          <dt className={styles.dt}>País</dt>
          <dd className={styles.dd}>{`${row.countryLabel} · ${row.country}`}</dd>
          <dt className={styles.dt}>Email de contacto</dt>
          <dd className={styles.dd}>{contactEmail ?? '—'}</dd>
          <dt className={styles.dt}>Incorporada</dt>
          <dd className={styles.dd}>{billingDateLabel(row.joinedAt)}</dd>
          <dt className={styles.dt}>Estado actual</dt>
          <dd className={styles.dd}>
            <span className={`${styles.stateBadge} ${STATE_CLASS[row.state]}`}>{row.state}</span>
          </dd>
          <dt className={styles.dt}>Estado desde</dt>
          <dd className={styles.dd}>{billingDateLabel(stateSince(row))}</dd>
          <dt className={styles.dt}>Fin del periodo de prueba</dt>
          <dd className={styles.dd}>{billingDateLabel(row.trialEndsAt)}</dd>
        </dl>

        <h3 className={styles.sectionTitle}>Historial de pagos</h3>
        {loading ? (
          <p className={styles.hint}>Cargando historial…</p>
        ) : payments.length === 0 ? (
          <p className={styles.hint}>Sin pagos confirmados.</p>
        ) : (
          <ul aria-label="Historial de pagos" className={styles.history}>
            {payments.map((payment) => (
              <li key={payment.id} className={styles.historyItem}>
                {`${billingDateLabel(payment.paymentDate)} · ${payment.operatorName ?? '—'} · ${payment.note || '—'}`}
              </li>
            ))}
          </ul>
        )}

        <h3 className={styles.sectionTitle}>Historial de estados</h3>
        {loading ? (
          <p className={styles.hint}>Cargando historial…</p>
        ) : events.length === 0 ? (
          <p className={styles.hint}>Sin cambios de estado.</p>
        ) : (
          <ul aria-label="Historial de estados" className={styles.history}>
            {events.map((event) => (
              <li key={event.id} className={styles.historyItem}>
                {`${displayStatus(event.fromStatus)} → ${displayStatus(event.toStatus)} · ${billingDateLabel(event.at)} · ${
                  event.automatic ? 'Automático' : (event.operatorName ?? '—')
                }`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className={styles.footer}>
        {feedback !== null ? (
          <p role="status" className={styles.feedback}>
            {feedback}
          </p>
        ) : null}
        {actionError !== null ? (
          <p role="alert" className={styles.error}>
            {actionError}
          </p>
        ) : null}

        <div className={styles.actions}>
          {row.state === 'ACTIVE' || row.state === 'EN PRUEBA' ? (
            <button type="button" className={styles.primary} disabled={actionBusy} onClick={onMarkPaid}>
              Marcar pago recibido
            </button>
          ) : null}
          {row.state === 'ACTIVE' ? (
            <button type="button" className={styles.secondary} disabled={actionBusy} onClick={onSuspend}>
              Suspender manualmente
            </button>
          ) : null}
          {row.state === 'SUSPENDED' ? (
            <button type="button" className={styles.primary} disabled={actionBusy} onClick={onReactivate}>
              Reactivar
            </button>
          ) : null}
          {row.state === 'CANDIDATA A BORRADO' ? (
            /* El borrado no existe todavía: se pinta deshabilitado y no abre nada. */
            <button
              type="button"
              className={styles.danger}
              title="El borrado de una organización todavía no está disponible."
              disabled
            >
              Iniciar borrado
            </button>
          ) : null}
        </div>
      </footer>
    </aside>
  );
}
