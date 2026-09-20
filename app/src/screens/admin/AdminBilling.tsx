import { useEffect, useState } from 'react';
import type { OperatorProfile } from '../../lib/session';
import {
  BILLING_FILTERS,
  DEFAULT_BILLING_FILTER,
  billingDateLabel,
  billingFilterCount,
  confirmPayment,
  fetchBillingContactEmail,
  fetchBillingOrgs,
  fetchBillingPayments,
  fetchBillingStatusEvents,
  filterBillingRows,
  monthsSuspendedLabel,
  renewalDate,
  suspendOrganization,
  todayIso,
  type BillingFilterKey,
  type BillingPayment,
  type BillingRow,
  type BillingStatusEvent,
} from '../../lib/admin-billing';
import { BillingTable } from './BillingTable';
import { BillingDetailPanel } from './BillingDetailPanel';
import { PaymentModal } from './PaymentModal';
import styles from './AdminBilling.module.css';

/**
 * El mensaje de "lista vacía" de cada chip, literal de la spec §6. Le llega a
 * `BillingTable` como `emptyMessage` y lo pinta dentro de la tabla.
 */
const EMPTY_MESSAGES: Record<BillingFilterKey, string> = {
  ALL: 'No hay organizaciones.',
  EXPIRING: 'No hay organizaciones con vencimiento en los próximos 15 días.',
  SUSPENDED: 'No hay organizaciones suspendidas.',
  DELETION: 'No hay organizaciones candidatas a borrado.',
  TRIAL: 'No hay organizaciones en periodo de prueba.',
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * ADMIN-02 · Panel de Gestión de Cobros.
 *
 * Posee todo el estado: la lista COMPLETA de organizaciones (sin filtrar, tal
 * como la devuelve `fetchBillingOrgs`), el chip activo, la fila seleccionada y
 * los historiales de su panel. Los chips filtran en cliente con
 * `filterBillingRows` — nunca vuelven a la red.
 */
export function AdminBilling({ operator }: { operator: OperatorProfile }) {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillingFilterKey>(DEFAULT_BILLING_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [events, setEvents] = useState<BillingStatusEvent[]>([]);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalRow, setModalRow] = useState<BillingRow | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  void operator;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchBillingOrgs();
        if (!cancelled) {
          setRows(list);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** La fila del panel se DERIVA de la lista actual: tras un refresco muestra el
   * estado nuevo, y si ya no está, el panel se cierra solo. */
  const selectedRow = selectedId ? (rows.find((r) => r.orgId === selectedId) ?? null) : null;

  /** Candidatas a borrado: se calculan sobre la lista COMPLETA, no la filtrada. */
  const candidatas = rows.filter((r) => r.state === 'CANDIDATA A BORRADO');

  const visibleRows = filterBillingRows(rows, filter);

  async function loadDetail(orgId: string): Promise<void> {
    setDetailLoading(true);
    setPayments([]);
    setEvents([]);
    setContactEmail(null);
    try {
      const [p, ev, mail] = await Promise.all([
        fetchBillingPayments(orgId),
        fetchBillingStatusEvents(orgId),
        fetchBillingContactEmail(orgId),
      ]);
      setPayments(p);
      setEvents(ev);
      setContactEmail(mail);
      setActionError(null);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  /** Refresco de los historiales del panel tras una acción, sin volver a poner
   * `loading` (el panel ya tiene datos y no debe parpadear). */
  async function refreshDetail(orgId: string): Promise<void> {
    try {
      const [p, ev] = await Promise.all([
        fetchBillingPayments(orgId),
        fetchBillingStatusEvents(orgId),
      ]);
      setPayments(p);
      setEvents(ev);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function handleSelect(row: BillingRow): void {
    setSelectedId(row.orgId);
    setFeedback(null);
    setActionError(null);
    void loadDetail(row.orgId);
  }

  function handleClosePanel(): void {
    setSelectedId(null);
  }

  /** `Marcar pago recibido` y `Reactivar` son el MISMO verbo en la base
   * (`billing_confirm_payment`): los dos abren este modal. */
  function openPaymentModal(row: BillingRow): void {
    setModalRow(row);
    setModalDate(todayIso(new Date()));
    setModalNote('');
    setModalError(null);
    setFeedback(null);
  }

  function handleModalCancel(): void {
    setModalRow(null);
    setModalError(null);
  }

  async function handleConfirmPayment(): Promise<void> {
    const row = modalRow;
    if (!row) return;
    setActionBusy(true);
    setModalError(null);
    try {
      const fecha = modalDate;
      await confirmPayment(row.orgId, fecha, modalNote);
      setModalRow(null);
      setModalError(null);
      setActionError(null);
      const fresh = await fetchBillingOrgs();
      setRows(fresh);
      if (selectedId === row.orgId) {
        void refreshDetail(row.orgId);
      }
      setFeedback(
        `Pago de ${row.name} confirmado. Nuevo vencimiento: ${billingDateLabel(renewalDate(fecha))}.`,
      );
    } catch (err) {
      // El modal sigue abierto y la lista no se repite.
      setModalError(errorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSuspend(): Promise<void> {
    const row = selectedRow;
    if (!row) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await suspendOrganization(row.orgId);
      const fresh = await fetchBillingOrgs();
      setRows(fresh);
      void refreshDetail(row.orgId);
      setFeedback(`${row.name} suspendida.`);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Operador de Plataforma · Módulo 07</p>
        <h1 className={styles.title}>Gestión de cobros</h1>
        <p className={styles.subtitle}>
          Suscripciones anuales de todas las organizaciones miembro. Sin pasarela de pago — cobro por
          transferencia bancaria confirmada manualmente.
        </p>
        {selectedRow ? null : (
          feedback ? (
            <p role="status" className={styles.feedback}>
              {feedback}
            </p>
          ) : null
        )}
      </header>

      {loadError ? (
        <p role="alert" className={styles.loadError}>
          {loadError}
        </p>
      ) : null}

      <div className={styles.chips} role="group" aria-label="Filtros de cobros">
        {BILLING_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className={styles.chipCount}>{billingFilterCount(rows, f.key)}</span>
            </button>
          );
        })}
      </div>

      {candidatas.length > 0 ? (
        <section aria-label="Candidatas a borrado" className={styles.deletionSection}>
          <h2 className={styles.deletionTitle}>Candidatas a borrado</h2>
          {candidatas.map((row) => (
            <div key={row.orgId} className={styles.candidateRow}>
              <span className={styles.candidateName}>{row.name}</span>
              <span className={styles.candidateCountry}>{row.country}</span>
              <span className={styles.candidateMeta}>
                Suspendida desde: {billingDateLabel(row.suspendedSince)}
              </span>
              <span className={styles.candidateMeta}>
                {monthsSuspendedLabel(row.suspendedSince, new Date())}
              </span>
              {/*
                El borrado real no existe (0034): el botón se pinta, deshabilitado,
                y no abre ningún modal. Construir el modal de doble confirmación del
                mock sería ofrecer un borrado que nada cumple.
              */}
              <button
                type="button"
                className={styles.deleteButton}
                disabled
                aria-label={`Iniciar borrado — ${row.name}`}
                title="El borrado de una organización todavía no está disponible."
              >
                Iniciar borrado
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <BillingTable
        rows={visibleRows}
        selectedId={selectedId}
        emptyMessage={EMPTY_MESSAGES[filter]}
        onSelect={handleSelect}
        onMarkPaid={openPaymentModal}
        onReactivate={openPaymentModal}
      />

      {selectedRow ? (
        <BillingDetailPanel
          row={selectedRow}
          contactEmail={contactEmail}
          payments={payments}
          events={events}
          loading={detailLoading}
          actionBusy={actionBusy}
          actionError={actionError}
          feedback={feedback}
          onClose={handleClosePanel}
          onMarkPaid={() => openPaymentModal(selectedRow)}
          onSuspend={handleSuspend}
          onReactivate={() => openPaymentModal(selectedRow)}
        />
      ) : null}

      {modalRow ? (
        <PaymentModal
          orgName={modalRow.name}
          date={modalDate}
          note={modalNote}
          busy={actionBusy}
          error={modalError}
          onDateChange={setModalDate}
          onNoteChange={setModalNote}
          onConfirm={handleConfirmPayment}
          onCancel={handleModalCancel}
        />
      ) : null}
    </div>
  );
}
