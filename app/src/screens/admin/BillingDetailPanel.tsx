import {
  billingDateLabel,
  type BillingPayment,
  type BillingRow,
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

/**
 * La base guarda `APPROVED` y la spec pinta `ACTIVE` (spec §3). Cualquier otro
 * valor se muestra tal cual.
 */
function displayStatus(value: string): string {
  return value === 'APPROVED' ? 'ACTIVE' : value;
}

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Panel lateral de detalle de organización de ADMIN-02.
 *
 * Totalmente controlado: no llama a la red ni decide cuándo se abre el modal de
 * pago. Toda la información que muestra le llega por props, de modo que tras un
 * refresco de la pantalla muestra el estado nuevo sin más.
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
  const stateSince =
    row.state === 'SUSPENDED' || row.state === 'CANDIDATA A BORRADO'
      ? row.suspendedSince
      : row.state === 'ACTIVE'
        ? row.lastPaymentDate
        : row.joinedAt;

  return (
    <aside aria-label="Detalle de organización" aria-busy={loading} className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Detalle de organización</p>
          <h2 className={styles.title}>{row.name}</h2>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className={styles.body}>
        <dl className={styles.dataList}>
          <dt className={styles.dt}>País</dt>
          <dd className={styles.dd}>{row.countryLabel} · {row.country}</dd>
          <dt className={styles.dt}>Email de contacto</dt>
          <dd className={styles.dd}>{contactEmail ?? '—'}</dd>
          <dt className={styles.dt}>Incorporada</dt>
          <dd className={styles.dd}>{billingDateLabel(row.joinedAt)}</dd>
          <dt className={styles.dt}>Estado actual</dt>
          <dd className={styles.dd}>{row.state}</dd>
          <dt className={styles.dt}>Estado desde</dt>
          <dd className={styles.dd}>{billingDateLabel(stateSince)}</dd>
          <dt className={styles.dt}>Fin del periodo de prueba</dt>
          <dd className={styles.dd}>{billingDateLabel(row.trialEndsAt)}</dd>
        </dl>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Historial de pagos</h3>
          {loading ? (
            <p className={styles.loadingText}>Cargando historial…</p>
          ) : (
            <ul aria-label="Historial de pagos" className={styles.list}>
              {payments.length === 0 ? (
                <li className={styles.emptyItem}>Sin pagos confirmados.</li>
              ) : (
                payments.map((p) => (
                  <li key={p.id} className={styles.listItem}>
                    {billingDateLabel(p.paymentDate)} · {p.operatorName ?? '—'} ·{' '}
                    {p.note || '—'}
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Historial de estados</h3>
          {loading ? (
            <p className={styles.loadingText}>Cargando historial…</p>
          ) : (
            <ul aria-label="Historial de estados" className={styles.list}>
              {events.length === 0 ? (
                <li className={styles.emptyItem}>Sin cambios de estado.</li>
              ) : (
                events.map((e) => (
                  <li key={e.id} className={styles.listItem}>
                    {displayStatus(e.fromStatus)} → {displayStatus(e.toStatus)} ·{' '}
                    {billingDateLabel(e.at)} ·{' '}
                    {e.automatic ? 'Automático' : (e.operatorName ?? '—')}
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        {feedback ? (
          <p role="status" className={styles.feedback}>
            {feedback}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className={styles.actionError}>
            {actionError}
          </p>
        ) : null}

        {row.state === 'ACTIVE' || row.state === 'EN PRUEBA' ? (
          <button
            type="button"
            className={cx(styles.btnPrimary, styles.btnPay)}
            disabled={actionBusy}
            onClick={onMarkPaid}
          >
            Marcar pago recibido
          </button>
        ) : null}
        {row.state === 'ACTIVE' ? (
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={actionBusy}
            onClick={onSuspend}
          >
            Suspender manualmente
          </button>
        ) : null}
        {row.state === 'SUSPENDED' ? (
          <button
            type="button"
            className={cx(styles.btnPrimary, styles.btnReactivate)}
            disabled={actionBusy}
            onClick={onReactivate}
          >
            Reactivar
          </button>
        ) : null}
        {row.state === 'CANDIDATA A BORRADO' ? (
          // El borrado no existe: deshabilitado, sin modal.
          <button type="button" className={styles.btnDanger} disabled>
            Iniciar borrado
          </button>
        ) : null}
      </footer>
    </aside>
  );
}
