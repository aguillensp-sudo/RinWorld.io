import { useEffect, useRef, useState } from 'react';
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
import type { OperatorProfile } from '../../lib/session';
import { BillingDetailPanel } from './BillingDetailPanel';
import { BillingTable } from './BillingTable';
import { PaymentModal } from './PaymentModal';
import styles from './AdminBilling.module.css';

interface Props {
  operator: OperatorProfile;
}

/**
 * El texto de la tabla cuando el chip activo no deja pasar ninguna fila. Son
 * literales de la spec §6 y del contrato de la pantalla: no se construyen.
 */
const EMPTY_MESSAGES: Record<BillingFilterKey, string> = {
  ALL: 'No hay organizaciones.',
  EXPIRING: 'No hay organizaciones con vencimiento en los próximos 15 días.',
  SUSPENDED: 'No hay organizaciones suspendidas.',
  DELETION: 'No hay organizaciones candidatas a borrado.',
  TRIAL: 'No hay organizaciones en periodo de prueba.',
};

/** `unknown` es lo que entrega un `catch`; la pantalla solo pinta el mensaje. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * ADMIN-02 · Panel de Gestión de Cobros.
 *
 * Es la pantalla: posee TODO el estado y habla con `admin-billing`. La lista
 * completa se pide UNA vez al montar y los chips filtran en cliente con
 * `filterBillingRows`, sin volver a la red — son decenas de filas, no miles.
 *
 * El panel lateral no guarda su propia copia de la fila: la DERIVA de la lista
 * actual por `orgId`, así que después de un pago o de una suspensión muestra el
 * estado nuevo sin que nadie lo sincronice a mano, y si la organización ya no
 * está, el panel se cierra solo.
 *
 * `Marcar pago recibido` y `Reactivar` abren el MISMO modal porque en la base
 * son el mismo verbo (`billing_confirm_payment`): sobre una suspendida, el pago
 * además la reactiva.
 */
export function AdminBilling({ operator }: Props) {
  // El shell ya garantiza que quien llega aquí es el Operador; su identidad no
  // cambia lo que se pinta, pero el contrato de la pantalla la recibe.
  void operator;

  const [rows, setRows] = useState<BillingRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillingFilterKey>(DEFAULT_BILLING_FILTER);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [statusEvents, setStatusEvents] = useState<BillingStatusEvent[]>([]);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<{ orgId: string; name: string } | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => todayIso(new Date()));
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Descarta respuestas de una selección que ya no es la actual.
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchBillingOrgs()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setListError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRow = selectedId === null ? null : (rows.find((row) => row.orgId === selectedId) ?? null);

  const reloadDetail = async (orgId: string) => {
    try {
      const [nextPayments, nextEvents] = await Promise.all([
        fetchBillingPayments(orgId),
        fetchBillingStatusEvents(orgId),
      ]);
      setPayments(nextPayments);
      setStatusEvents(nextEvents);
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    }
  };

  const reloadRows = async () => {
    try {
      setRows(await fetchBillingOrgs());
    } catch (error: unknown) {
      setListError(errorMessage(error));
    }
  };

  const handleSelect = (row: BillingRow) => {
    const seq = requestRef.current + 1;
    requestRef.current = seq;
    setSelectedId(row.orgId);
    setPayments([]);
    setStatusEvents([]);
    setContactEmail(null);
    setActionError(null);
    setDetailLoading(true);

    Promise.all([
      fetchBillingPayments(row.orgId),
      fetchBillingStatusEvents(row.orgId),
      fetchBillingContactEmail(row.orgId),
    ])
      .then(([nextPayments, nextEvents, nextEmail]) => {
        if (requestRef.current !== seq) return;
        setPayments(nextPayments);
        setStatusEvents(nextEvents);
        setContactEmail(nextEmail);
        setDetailLoading(false);
      })
      .catch((error: unknown) => {
        if (requestRef.current !== seq) return;
        setActionError(errorMessage(error));
        setDetailLoading(false);
      });
  };

  const handleCloseDetail = () => {
    requestRef.current += 1;
    setSelectedId(null);
    setDetailLoading(false);
    setActionError(null);
  };

  const openPaymentModal = (row: BillingRow) => {
    setPaymentTarget({ orgId: row.orgId, name: row.name });
    setPaymentDate(todayIso(new Date()));
    setPaymentNote('');
    setPaymentError(null);
  };

  const handleConfirmPayment = async () => {
    if (paymentTarget === null) return;
    const target = paymentTarget;
    const dueLabel = billingDateLabel(renewalDate(paymentDate));

    setPaymentBusy(true);
    setActionBusy(true);
    setPaymentError(null);

    try {
      await confirmPayment(target.orgId, paymentDate, paymentNote);
    } catch (error: unknown) {
      // El modal sigue abierto y la lista NO se repide: nada cambió en la base.
      setPaymentError(errorMessage(error));
      setPaymentBusy(false);
      setActionBusy(false);
      return;
    }

    setPaymentTarget(null);
    setPaymentBusy(false);
    setFeedback(`Pago de ${target.name} confirmado. Nuevo vencimiento: ${dueLabel}.`);

    await reloadRows();
    if (selectedId !== null) await reloadDetail(selectedId);

    setActionBusy(false);
  };

  const handleSuspend = async () => {
    if (selectedRow === null) return;
    const orgId = selectedRow.orgId;
    const name = selectedRow.name;

    setActionBusy(true);
    setActionError(null);

    try {
      await suspendOrganization(orgId);
    } catch (error: unknown) {
      setActionError(errorMessage(error));
      setActionBusy(false);
      return;
    }

    setFeedback(`${name} suspendida.`);
    await reloadRows();
    await reloadDetail(orgId);
    setActionBusy(false);
  };

  const visibleRows = filterBillingRows(rows, filter);
  // El mismo predicado del chip «Candidatas a borrado», reutilizado: la sección
  // mira la lista COMPLETA, no la filtrada.
  const deletionCandidates = filterBillingRows(rows, 'DELETION');
  const now = new Date();

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Operador de Plataforma · Módulo 07</p>
        <h1 className={styles.title}>Gestión de cobros</h1>
        <p className={styles.subtitle}>
          Suscripciones anuales de todas las organizaciones miembro. Sin pasarela de pago — cobro por
          transferencia bancaria confirmada manualmente.
        </p>

        {/* Un solo `role="status"` a la vez: con el panel abierto, el aviso vive dentro del panel. */}
        {selectedRow === null && feedback !== null ? (
          <p role="status" className={styles.feedback}>
            {feedback}
          </p>
        ) : null}

        {listError !== null ? (
          <p role="alert" className={styles.alert}>
            {listError}
          </p>
        ) : null}

        <div className={styles.chips}>
          {BILLING_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === filter}
              className={key === filter ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => setFilter(key)}
            >
              {label}
              {' '}
              <span className={styles.chipCount}>{billingFilterCount(rows, key)}</span>
            </button>
          ))}
        </div>

        {deletionCandidates.length > 0 ? (
          <section aria-label="Candidatas a borrado" className={styles.deletionSection}>
            {deletionCandidates.map((row) => (
              <div key={row.orgId} className={styles.deletionRow}>
                <span className={styles.deletionName}>{row.name}</span>
                <span className={styles.countryBadge}>{row.country}</span>
                <span className={styles.deletionMeta}>
                  {`Suspendida desde: ${billingDateLabel(row.suspendedSince)}`}
                </span>
                <span className={styles.deletionMeta}>{monthsSuspendedLabel(row.suspendedSince, now)}</span>
                {/*
                  El borrado real no existe (0034, cabecera; ESTADO-V1 §3): la base
                  no tiene ninguna función que borre. El botón se pinta
                  deshabilitado y no abre ningún modal — construir el modal de doble
                  confirmación del mock sería prometer algo que nada cumple.
                */}
                <button
                  type="button"
                  className={styles.deletionButton}
                  aria-label={`Iniciar borrado — ${row.name}`}
                  title="El borrado de una organización todavía no está disponible."
                  disabled
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
      </div>

      {selectedRow !== null ? (
        <BillingDetailPanel
          row={selectedRow}
          contactEmail={contactEmail}
          payments={payments}
          events={statusEvents}
          loading={detailLoading}
          actionBusy={actionBusy}
          actionError={actionError}
          feedback={feedback}
          onClose={handleCloseDetail}
          onMarkPaid={() => openPaymentModal(selectedRow)}
          onSuspend={handleSuspend}
          onReactivate={() => openPaymentModal(selectedRow)}
        />
      ) : null}

      {paymentTarget !== null ? (
        <PaymentModal
          orgName={paymentTarget.name}
          date={paymentDate}
          note={paymentNote}
          busy={paymentBusy}
          error={paymentError}
          onDateChange={setPaymentDate}
          onNoteChange={setPaymentNote}
          onConfirm={handleConfirmPayment}
          onCancel={() => {
            setPaymentTarget(null);
            setPaymentError(null);
            setPaymentBusy(false);
          }}
        />
      ) : null}
    </div>
  );
}

/*
 * Exportación por defecto, además de la nombrada: el shell monta cada pantalla
 * del Operador desde su propia tabla de pantallas, y con las dos formas el
 * wiring funciona igual.
 */
export default AdminBilling;
