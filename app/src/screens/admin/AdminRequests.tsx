import { useEffect, useState } from 'react';

import {
  DEFAULT_FILTER,
  QUEUE_FILTERS,
  approveRequest,
  fetchRequestHistory,
  fetchRequests,
  rejectRequest,
  returnToReview,
  type RequestEvent,
  type RequestRow,
  type RequestState,
} from '../../lib/admin-requests';
import { errorMessage, type OperatorProfile } from '../../lib/session';

import { RequestDetailPanel } from './RequestDetailPanel';
import { RequestsTable } from './RequestsTable';
import styles from './AdminRequests.module.css';

interface Props {
  operator: OperatorProfile;
}

/**
 * ADMIN-01 · Cola de solicitudes de registro (Operador de Plataforma).
 *
 * La pantalla posee TODO el estado: quién carga, quién decide y quién falla vive
 * aquí, y los dos hijos son presentacionales. Tres decisiones que conviene no
 * deshacer sin leer el porqué:
 *
 * 1. **La fila seleccionada se guarda entera, no su `id`.** Tras Aprobar o
 *    Rechazar con el filtro `Pendientes` activo, la lista se vuelve a pedir y esa
 *    fila ya no viene. Si el panel derivara la fila de la lista por `id`, se
 *    quedaría sin datos justo cuando tiene que enseñar la confirmación.
 * 2. **Se sustituye la fila seleccionada por la que devuelve la llamada**, no por
 *    la vieja: el panel tiene que pintar el estado nuevo.
 * 3. **Ni recuentos por chip ni barra de resumen.** La capa de datos solo trae la
 *    categoría filtrada; contar las cinco a la vez sería inventar una consulta
 *    que nadie pidió y que la spec §3 no lista entre sus componentes.
 */
export function AdminRequests({ operator }: Props) {
  // El Operador ya lo pinta `OperatorShell` en la barra de nav: la pantalla lo
  // recibe como contrato y no lo vuelve a mostrar. Se referencia de forma
  // explícita para que se lea como algo a propósito y no como un prop olvidado.
  void operator;

  const [filter, setFilter] = useState<RequestState | null>(DEFAULT_FILTER);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [history, setHistory] = useState<RequestEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'approved' | 'rejected' | null>(null);

  /** Sube cada vez que hay que volver a pedir la lista sin cambiar de filtro. */
  const [reloadKey, setReloadKey] = useState(0);

  // El reloj se construye aquí y se pasa hacia abajo: la pantalla no lo recibe
  // del shell (a diferencia de SRCH-01/MSG-01, ninguna decisión de wiring lo
  // exige en ADMIN-01).
  const now = new Date();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRequests(filter)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  /** Cierra el panel y limpia todo lo suyo. No toca la lista. */
  function resetPanel() {
    setSelected(null);
    setHistory([]);
    setHistoryLoading(false);
    setRejecting(false);
    setRejectReason('');
    setActionError(null);
    setFeedback(null);
  }

  function handleFilterChange(state: RequestState | null) {
    setFilter(state);
    resetPanel();
  }

  function handleSelect(row: RequestRow) {
    // Se guarda LA FILA, no su id: ver la nota de cabecera.
    setSelected(row);
    setHistory([]);
    setHistoryLoading(true);
    setRejecting(false);
    setRejectReason('');
    setActionError(null);
    setFeedback(null);
    fetchRequestHistory(row.id)
      .then((events) => setHistory(events))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  async function handleApprove() {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await approveRequest(selected.id);
      setSelected(updated);
      setFeedback('approved');
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setActionError(errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  }

  function handleStartReject() {
    setRejecting(true);
    setRejectReason('');
  }

  function handleCancelReject() {
    setRejecting(false);
    setRejectReason('');
  }

  async function handleConfirmReject() {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await rejectRequest(selected.id, rejectReason);
      setSelected(updated);
      setFeedback('rejected');
      setRejecting(false);
      setRejectReason('');
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setActionError(errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReturnToReview() {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await returnToReview(selected.id);
      setSelected(updated);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setActionError(errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>Operador de Plataforma · Módulo 01</p>
      <h1 className={styles.title}>Cola de solicitudes de registro</h1>
      <p className={styles.subtitle}>
        Solicitudes de organizaciones que han completado el FSR y esperan aprobación manual.
        Ordenadas de más antigua a más reciente.
      </p>

      <div className={styles.chips}>
        {QUEUE_FILTERS.map((option) => {
          const active = option.state === filter;
          return (
            <button
              key={option.label}
              type="button"
              className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              aria-pressed={active}
              onClick={() => handleFilterChange(option.state)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className={styles.layout}>
        <div className={styles.tableArea}>
          {loading ? (
            <div className={styles.loading} aria-busy="true">
              Cargando solicitudes…
            </div>
          ) : error !== null ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : (
            <RequestsTable
              rows={rows}
              now={now}
              selectedId={selected !== null ? selected.id : null}
              onSelect={handleSelect}
            />
          )}
        </div>

        {selected !== null && (
          <RequestDetailPanel
            row={selected}
            history={history}
            historyLoading={historyLoading}
            rejecting={rejecting}
            rejectReason={rejectReason}
            onRejectReasonChange={setRejectReason}
            actionBusy={actionBusy}
            actionError={actionError}
            feedback={feedback}
            onApprove={handleApprove}
            onStartReject={handleStartReject}
            onConfirmReject={handleConfirmReject}
            onCancelReject={handleCancelReject}
            onReturnToReview={handleReturnToReview}
            onClose={resetPanel}
          />
        )}
      </div>
    </div>
  );
}
