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

type Feedback = 'approved' | 'rejected' | null;

/**
 * ADMIN-01 · Panel de Aprobación del Operador (cola de solicitudes).
 *
 * Es la pantalla: posee TODO el estado de la vista y es la única que habla con
 * la red. Los dos componentes que pinta (`RequestsTable`, `RequestDetailPanel`)
 * son presentacionales y controlados.
 *
 * Dos decisiones que no son de estilo:
 *
 * 1. **La fila seleccionada se guarda entera, nunca se deriva de la lista por
 *    `id`.** Tras aprobar o rechazar, el efecto de la lista vuelve a pedirla con
 *    el filtro activo; si el filtro era `Pendientes`, la fila ya no viene y un
 *    `rows.find(r => r.id === selectedId)` devolvería `undefined` justo cuando el
 *    panel tiene que enseñar la confirmación.
 * 2. **El estado de la decisión (aviso y error) vive separado del estado de la
 *    lista.** Un fallo de `fetchRequests` no borra el panel, y un fallo de
 *    `approveRequest` no borra la lista.
 */
export function AdminRequests({ operator }: { operator: OperatorProfile }) {
  // El operador llega del shell, y la pantalla no pinta nada suyo: quién firmó la
  // decisión lo sella el disparador de la base con `auth.uid()` (capa de datos,
  // `0028`). Se lee aquí para que el contrato de props quede completo sin
  // inventarle un hueco en la interfaz que nadie pidió.
  void operator;

  // ── La lista ────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<RequestState | null>(DEFAULT_FILTER);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // ── El panel de detalle ─────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = useState<RequestRow | null>(null);
  const [history, setHistory] = useState<RequestEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── La decisión en curso ────────────────────────────────────────────────────
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const selectedId = selectedRow ? selectedRow.id : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchRequests(filter)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(errorMessage(e));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, reloadToken]);

  useEffect(() => {
    if (selectedId === null) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    fetchRequestHistory(selectedId)
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        setHistoryLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]);
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function refreshList() {
    setReloadToken((t) => t + 1);
  }

  /** Cierra y vacía el panel entero: fila, historial, formulario, aviso y error. */
  function resetPanel() {
    setSelectedRow(null);
    setHistory([]);
    setHistoryLoading(false);
    setRejecting(false);
    setRejectReason('');
    setActionError(null);
    setFeedback(null);
  }

  function handleFilterChange(state: RequestState | null) {
    setFilter(state);
    // Cambiar de filtro cierra el detalle: la fila que estaba abierta puede no
    // pertenecer a la categoría nueva, y dejarla abierta sería mentir sobre lo
    // que la tabla tiene debajo.
    resetPanel();
  }

  /**
   * La fila se guarda TAL CUAL llega, no se busca por `id` en `rows`. Ver la
   * nota de cabecera: después de decidir, la lista ya no la trae.
   */
  function handleSelect(row: RequestRow) {
    setSelectedRow(row);
    setRejecting(false);
    setRejectReason('');
    setActionError(null);
    setFeedback(null);
  }

  function handleClose() {
    resetPanel();
  }

  function handleStartReject() {
    setRejecting(true);
    setRejectReason('');
  }

  function handleCancelReject() {
    setRejecting(false);
    setRejectReason('');
  }

  function handleRejectReasonChange(value: string) {
    setRejectReason(value);
  }

  async function handleApprove() {
    if (selectedRow === null) return;
    const id = selectedRow.id;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await approveRequest(id);
      setSelectedRow(updated);
      setFeedback('approved');
      refreshList();
    } catch (e: unknown) {
      setActionError(errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmReject() {
    if (selectedRow === null) return;
    const id = selectedRow.id;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await rejectRequest(id, rejectReason);
      setSelectedRow(updated);
      setFeedback('rejected');
      setRejecting(false);
      setRejectReason('');
      refreshList();
    } catch (e: unknown) {
      setActionError(errorMessage(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReturnToReview() {
    if (selectedRow === null) return;
    const id = selectedRow.id;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await returnToReview(id);
      setSelectedRow(updated);
      setFeedback(null);
      refreshList();
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
        Solicitudes de organizaciones que han completado el FSR y esperan aprobación manual. Ordenadas de más antigua a más reciente.
      </p>

      {/*
        Los cinco chips de `QUEUE_FILTERS`. Sin recuento: contar las cinco
        categorías a la vez exigiría una consulta que la capa de datos no tiene
        —`fetchRequests` trae solo la categoría filtrada— y ningún componente de
        la spec §3 lo pide.
      */}
      <div className={styles.filters} role="group" aria-label="Filtros por estado">
        {QUEUE_FILTERS.map((option) => {
          const active = filter === option.state;
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

      <div className={styles.body}>
        <div className={styles.tableArea}>
          {loading ? (
            <div className={styles.loading} aria-busy="true">
              Cargando solicitudes…
            </div>
          ) : loadError !== null ? (
            <div role="alert" className={styles.loadError}>
              {loadError}
            </div>
          ) : (
            <RequestsTable
              rows={rows}
              now={new Date()}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </div>

        {selectedRow !== null && (
          <RequestDetailPanel
            row={selectedRow}
            history={history}
            historyLoading={historyLoading}
            rejecting={rejecting}
            rejectReason={rejectReason}
            onRejectReasonChange={handleRejectReasonChange}
            actionBusy={actionBusy}
            actionError={actionError}
            feedback={feedback}
            onApprove={handleApprove}
            onStartReject={handleStartReject}
            onConfirmReject={handleConfirmReject}
            onCancelReject={handleCancelReject}
            onReturnToReview={handleReturnToReview}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
