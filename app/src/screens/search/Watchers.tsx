import { useEffect, useState } from 'react';
import type { SearchCriteria } from '../../lib/search';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  activeCounterLabel,
  counterTone,
  DEFAULT_WATCHER_FILTER,
  deleteWatcher,
  draftFromRow,
  fetchWatchers,
  filterWatchers,
  letWatcherExpire,
  renewWatcher,
  setWatcherPaused,
  updateWatcher,
  watcherFilterCount,
  watcherToCriteria,
  WATCHER_FILTERS,
  type WatcherDraft,
  type WatcherFilterKey,
  type WatcherRow,
} from '../../lib/watchers';
import { DeleteWatcherModal } from './DeleteWatcherModal';
import { WatcherCard } from './WatcherCard';
import { WatcherEditForm } from './WatcherEditForm';
import styles from './Watchers.module.css';

const EYEBROW = 'Módulo 03 · Búsqueda Conversacional';
const TITLE = 'Mis watchers';
const SUBTITLE =
  'Los watchers te avisan cuando aparece stock de una referencia que buscas. Cada watcher está activo durante 30 días y puedes renovarlo.';

/** Spec §6, primer acceso: los dos literales van en elementos distintos. */
const EMPTY_TITLE = 'Todavía no tienes ningún watcher activo.';
const EMPTY_HINT =
  'Crea un watcher desde la búsqueda cuando no encuentres stock de una referencia — te avisaremos cuando aparezca.';

/** Spec §3: hay filas, pero ninguna cae en el chip activo. */
const EMPTY_FILTER = 'No hay watchers en este estado.';

interface Props {
  /**
   * La sesión del miembro. SRCH-03 no la usa: la RLS de `0035` ya limita la
   * vista `watcher_list` a la organización de quien mira y la capa de datos no
   * tiene una sola consulta por organización. Va en la firma porque es el
   * contrato de las pantallas de miembro, igual que en el resto.
   */
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj (INV-01/SRCH-01/PANEL-01). */
  now?: Date;
  /** «Ver resultados»: abre SRCH-01 con los criterios del watcher precargados. */
  onViewResults: (criteria: SearchCriteria) => void;
}

/**
 * SRCH-03 — Gestión de Watchers. La pantalla posee TODO el estado: la lista
 * completa que devuelve `fetchWatchers()` una sola vez, el chip activo (que
 * filtra en cliente), la tarjeta en edición, el modal de borrado y el aviso.
 * Las tarjetas y el formulario son presentacionales y no tocan la red.
 */
export function Watchers({ now, onViewResults }: Props) {
  /** La lista COMPLETA, sin filtrar: el filtro es de cliente y no vuelve a pedir nada. */
  const [rows, setRows] = useState<WatcherRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WatcherFilterKey>(DEFAULT_WATCHER_FILTER);

  /** Error de una acción (pausar, renovar, guardar, borrar) — `role="alert"` de la pantalla. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Aviso de éxito: uno solo a la vez, `role="status"`. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Hay una llamada en vuelo: deshabilita todas las acciones. */
  const [busy, setBusy] = useState(false);

  /** Solo UNA tarjeta en edición a la vez: editar otra cierra la anterior. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WatcherDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  /** `Eliminar` nunca borra solo: guarda la fila y abre el modal de confirmación. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentTime = now ?? new Date();

  /*
   * Una sola vez al montar. `now` NO entra en el efecto: la capa de datos no lo
   * recibe (ordena por `created_at`), así que depender de él solo volvería a
   * consultar la base en cada render — el bucle que documenta `Panel.tsx` (F-079).
   */
  useEffect(() => {
    let active = true;

    fetchWatchers()
      .then((next) => {
        if (!active) return;
        setRows(next);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadError(errorMessage(e));
      });

    return () => {
      active = false;
    };
  }, []);

  /** Repide la lista después de una acción que ha ido bien. */
  async function reload(): Promise<void> {
    const next = await fetchWatchers();
    setRows(next);
  }

  /** Pausar / Reactivar / Renovar / Dejar expirar comparten el mismo envoltorio. */
  async function runAction(action: () => Promise<void>, message: string): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
      setNotice(message);
    } catch (e: unknown) {
      // Sin recarga y sin aviso: solo el error (spec §3, «si falla»).
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handlePause(row: WatcherRow): void {
    void runAction(() => setWatcherPaused(row.id, true), `Watcher de ${row.partNumber} pausado.`);
  }

  function handleResume(row: WatcherRow): void {
    void runAction(() => setWatcherPaused(row.id, false), `Watcher de ${row.partNumber} reactivado.`);
  }

  function handleRenew(row: WatcherRow): void {
    void runAction(() => renewWatcher(row.id), `Watcher de ${row.partNumber} renovado por 30 días más.`);
  }

  function handleLetExpire(row: WatcherRow): void {
    void runAction(() => letWatcherExpire(row.id), `Watcher de ${row.partNumber} expirado.`);
  }

  function handleViewResults(row: WatcherRow): void {
    onViewResults(watcherToCriteria(row));
  }

  function handleEdit(row: WatcherRow): void {
    // Solo una a la vez: la anterior se cierra sola al reemplazar `editingId`.
    setEditingId(row.id);
    setDraft(draftFromRow(row));
    setEditError(null);
  }

  function handleDraftChange(next: WatcherDraft): void {
    setDraft(next);
  }

  function handleEditCancel(): void {
    // Sin llamar a nada: el borrador se tira.
    setEditingId(null);
    setDraft(null);
    setEditError(null);
  }

  async function handleEditSave(): Promise<void> {
    if (editingId === null || draft === null) return;
    const row = rows.find((r) => r.id === editingId);
    const ref = row ? row.partNumber : draft.partNumber;

    setBusy(true);
    setEditError(null);
    try {
      await updateWatcher(editingId, draft);
      setEditingId(null);
      setDraft(null);
      await reload();
      setNotice(`Watcher de ${ref} actualizado.`);
    } catch (e: unknown) {
      // El formulario SIGUE abierto, con el mensaje dentro.
      setEditError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteRequest(row: WatcherRow): void {
    setDeletingId(row.id);
    setDeleteError(null);
  }

  function handleDeleteCancel(): void {
    setDeletingId(null);
    setDeleteError(null);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (deletingId === null) return;
    const row = rows.find((r) => r.id === deletingId);
    const ref = row ? row.partNumber : '';

    setBusy(true);
    setDeleteError(null);
    try {
      await deleteWatcher(deletingId);
      setDeletingId(null);
      await reload();
      setNotice(`Watcher de ${ref} eliminado.`);
    } catch (e: unknown) {
      // El modal SIGUE abierto, con el error dentro.
      setDeleteError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const visible = filterWatchers(rows, filter);
  const deletingRow = deletingId === null ? null : (rows.find((r) => r.id === deletingId) ?? null);

  return (
    <div className={styles.screen}>
      <div className={styles.eyebrow}>{EYEBROW}</div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {/* ── Aviso de la última acción: uno solo a la vez (spec §3). ── */}
      {notice !== null && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {/* ── Error de una acción: va aquí, sin recargar la lista ni dejar aviso. ── */}
      {actionError !== null && (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      )}

      <div className={styles.counterRow}>
        <span
          className={styles.counter}
          data-testid="watcher-counter"
          data-tone={counterTone(rows)}
        >
          {activeCounterLabel(rows)}
        </span>
      </div>

      {/* ── Los seis chips de la spec §3, en su orden. Filtran EN CLIENTE sobre la
          lista completa: pulsar uno NO vuelve a llamar a `fetchWatchers()`. El
          nombre accesible es «Etiqueta N», con el contador en su propio span. ── */}
      <div className={styles.chips}>
        {WATCHER_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={f.key === filter ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            aria-pressed={f.key === filter}
            onClick={() => setFilter(f.key)}
          >
            {f.label}{' '}
            <span className={styles.chipCount}>{watcherFilterCount(rows, f.key)}</span>
          </button>
        ))}
      </div>

      {loadError !== null ? (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        /* Spec §6: primer acceso. Los chips y el contador siguen pintados. */
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{EMPTY_TITLE}</p>
          <p className={styles.emptyHint}>{EMPTY_HINT}</p>
        </div>
      ) : visible.length === 0 ? (
        <p className={styles.emptyFilter}>{EMPTY_FILTER}</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de watchers">
          {visible.map((row) => (
            <li key={row.id} className={styles.listItem}>
              <WatcherCard
                row={row}
                now={currentTime}
                busy={busy}
                onPause={handlePause}
                onResume={handleResume}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                onRenew={handleRenew}
                onLetExpire={handleLetExpire}
                onViewResults={handleViewResults}
              />
              {/* El formulario va DENTRO del mismo `<li>`, justo tras la tarjeta. */}
              {editingId === row.id && draft !== null && (
                <WatcherEditForm
                  partNumber={row.partNumber}
                  draft={draft}
                  busy={busy}
                  error={editError}
                  onChange={handleDraftChange}
                  onSave={handleEditSave}
                  onCancel={handleEditCancel}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* El modal NO borra por su cuenta: confirma y la pantalla llama a `deleteWatcher`. */}
      {deletingRow !== null && (
        <DeleteWatcherModal
          partNumber={deletingRow.partNumber}
          busy={busy}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}
