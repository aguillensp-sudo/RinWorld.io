import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './ThreadList.module.css';

export type ThreadState =
  | 'ABIERTO'
  | 'CON_CONSULTA_PENDIENTE'
  | 'CON_OFERTA_PENDIENTE'
  | 'ACUERDO_ALCANZADO'
  | 'CERRADO_SIN_ACUERDO';

export interface Thread {
  id?: string | number;
  organizationName?: string;
  organization?: string;
  orgName?: string;
  counterparty?: string;
  counterpartyName?: string;
  name?: string;
  countryCode?: string;
  country?: string;
  iso?: string;
  countryName?: string;
  state?: ThreadState | string;
  status?: ThreadState | string;
  lastActivityAt?: string | Date;
  lastActivity?: string | Date;
  lastActiveAt?: string | Date;
  lastUpdatedAt?: string | Date;
  updatedAt?: string | Date;
  preview?: string;
  lastItemPreview?: string;
  lastElementPreview?: string;
  [key: string]: unknown;
}

export interface ThreadListProps {
  threads: Thread[];
  page?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onOpenThread: (thread: Thread) => void;
  now?: Date;
}

const STATE_ALIASES: Record<string, ThreadState> = {
  ABIERTO: 'ABIERTO',
  OPEN: 'ABIERTO',
  CON_CONSULTA_PENDIENTE: 'CON_CONSULTA_PENDIENTE',
  'CON CONSULTA PENDIENTE': 'CON_CONSULTA_PENDIENTE',
  CONSULTA_PENDIENTE: 'CON_CONSULTA_PENDIENTE',
  PENDING_CONSULTATION: 'CON_CONSULTA_PENDIENTE',
  CON_OFERTA_PENDIENTE: 'CON_OFERTA_PENDIENTE',
  'CON OFERTA PENDIENTE': 'CON_OFERTA_PENDIENTE',
  OFERTA_PENDIENTE: 'CON_OFERTA_PENDIENTE',
  PENDING_OFFER: 'CON_OFERTA_PENDIENTE',
  PENDING_QUOTE: 'CON_OFERTA_PENDIENTE',
  ACUERDO_ALCANZADO: 'ACUERDO_ALCANZADO',
  'ACUERDO ALCANZADO': 'ACUERDO_ALCANZADO',
  AGREEMENT_REACHED: 'ACUERDO_ALCANZADO',
  CERRADO_SIN_ACUERDO: 'CERRADO_SIN_ACUERDO',
  'CERRADO SIN ACUERDO': 'CERRADO_SIN_ACUERDO',
  CLOSED_NO_AGREEMENT: 'CERRADO_SIN_ACUERDO',
  CLOSED_WITHOUT_AGREEMENT: 'CERRADO_SIN_ACUERDO',
};

const STATE_LABELS: Record<ThreadState, string> = {
  ABIERTO: 'ABIERTO',
  CON_CONSULTA_PENDIENTE: 'CON CONSULTA PENDIENTE',
  CON_OFERTA_PENDIENTE: 'CON OFERTA PENDIENTE',
  ACUERDO_ALCANZADO: 'ACUERDO ALCANZADO',
  CERRADO_SIN_ACUERDO: 'CERRADO SIN ACUERDO',
};

function normalizeState(value: ThreadState | string | undefined): ThreadState {
  if (!value) return 'ABIERTO';
  const key = String(value).trim().toUpperCase();
  return STATE_ALIASES[key] ?? 'ABIERTO';
}

function getState(thread: Thread): ThreadState {
  return normalizeState(thread.state ?? thread.status);
}

function stateClass(state: ThreadState): string {
  switch (state) {
    case 'ABIERTO':
      return styles.abierto;
    case 'CON_CONSULTA_PENDIENTE':
      return styles.consulta;
    case 'CON_OFERTA_PENDIENTE':
      return styles.oferta;
    case 'ACUERDO_ALCANZADO':
      return styles.acuerdo;
    case 'CERRADO_SIN_ACUERDO':
      return styles.cerrado;
    default:
      return styles.abierto;
  }
}

function organizationName(thread: Thread): string {
  return (
    thread.organizationName ??
    thread.organization ??
    thread.orgName ??
    thread.counterparty ??
    thread.counterpartyName ??
    thread.name ??
    'Organización'
  );
}

function countryCode(thread: Thread): string {
  const code =
    thread.countryCode ??
    thread.iso ??
    (thread.country && thread.country.length <= 2 ? thread.country : undefined);
  return (code ?? '').toUpperCase();
}

function previewText(thread: Thread): string {
  return thread.preview ?? thread.lastItemPreview ?? thread.lastElementPreview ?? 'Mensaje libre';
}

function activityDate(thread: Thread): string | Date {
  return (
    thread.lastActivityAt ??
    thread.lastActivity ??
    thread.lastActiveAt ??
    thread.lastUpdatedAt ??
    thread.updatedAt ??
    new Date(0)
  );
}

function formatRelativeTime(value: string | Date, now: Date): string {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return '';

  const seconds = Math.round((time - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'ahora';

  const prefix = seconds < 0 ? 'hace ' : 'en ';
  const minutes = Math.round(abs / 60);
  if (minutes < 60) return `${prefix}${minutes}m`;

  const hours = Math.round(abs / 3600);
  if (hours < 24) return `${prefix}${hours}h`;

  const days = Math.round(abs / 86400);
  if (days < 30) return `${prefix}${days}d`;

  const months = Math.round(days / 30);
  if (months < 12) return `${prefix}${months}mes`;

  return `${prefix}${Math.round(days / 365)}a`;
}

export function ThreadList({
  threads,
  page = 1,
  totalPages = 1,
  onPageChange,
  onOpenThread,
  now = new Date(),
}: ThreadListProps) {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const sortedThreads = useMemo(() => {
    return [...threads].sort(
      (a, b) => new Date(activityDate(b)).getTime() - new Date(activityDate(a)).getTime(),
    );
  }, [threads]);

  const visibleThreads = useMemo(() => {
    const term = appliedQuery.trim().toLowerCase();
    if (!term) return sortedThreads;
    return sortedThreads.filter((thread) =>
      organizationName(thread).toLowerCase().includes(term),
    );
  }, [sortedThreads, appliedQuery]);

  const effectiveTotalPages = Math.max(1, totalPages);
  const effectivePage = Math.min(Math.max(1, page), effectiveTotalPages);
  const pageNumbers = Array.from({ length: effectiveTotalPages }, (_, index) => index + 1);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setAppliedQuery(query);
    }
  };

  return (
    <section aria-label="Lista de hilos">
      <div className={styles.e2eeStatus} role="status">
        <i className="ti ti-lock" aria-hidden="true" />
        E2EE activo · claves en memoria de sesión
      </div>

      <div className={styles.actionsBar}>
        <div className={styles.searchWrap}>
          <i className={`ti ti-search ${styles.searchIcon}`} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar por nombre de organización..."
            aria-label="Buscar por nombre de organización"
          />
        </div>

        {/* F-023 e: DIR-01 no está entre las pantallas del alcance; el control
            existe pero no lleva a ninguna parte. Se pinta deshabilitado. */}
        <button
          type="button"
          className={styles.primaryButton}
          disabled
          title="DIR-01 no está disponible en esta versión."
        >
          <i className="ti ti-address-book" aria-hidden="true" />
          Nuevo contacto
        </button>

        <span className={styles.threadCount} aria-live="polite">
          {threads.length} hilos · Página {effectivePage} de {effectiveTotalPages}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="ti ti-messages-off" aria-hidden="true" />
          <p className={styles.emptyTitle}>Todavía no tienes ninguna conversación.</p>
          <p className={styles.emptyText}>
            Usa el Directorio para contactar con otras organizaciones.
          </p>
          <button
            type="button"
            className={`${styles.primaryButton} ${styles.emptyButton}`}
            disabled
            title="DIR-01 no está disponible en esta versión."
          >
            <i className="ti ti-address-book" aria-hidden="true" />
            Ir al Directorio
          </button>
        </div>
      ) : visibleThreads.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <i className="ti ti-search-off" aria-hidden="true" />
          <p className={styles.emptyTitle}>No hay hilos que coincidan con «{appliedQuery}».</p>
          <p className={styles.emptyText}>Prueba con otro nombre de organización.</p>
        </div>
      ) : (
        <>
          <div className={styles.threadList}>
            {visibleThreads.map((thread, index) => {
              const state = getState(thread);
              return (
                <div
                  key={thread.id ?? index}
                  className={styles.threadRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenThread(thread)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenThread(thread);
                    }
                  }}
                  aria-label={`Abrir hilo con ${organizationName(thread)}`}
                >
                  <div className={styles.threadTop}>
                    <span className={styles.orgName}>{organizationName(thread)}</span>
                    <span
                      className={styles.countryBadge}
                      title={thread.countryName ? thread.countryName : undefined}
                    >
                      {countryCode(thread)}
                    </span>
                  </div>

                  <span className={styles.timestamp}>
                    {formatRelativeTime(activityDate(thread), now)}
                  </span>

                  {/* F-027: la vista previa solo contiene metadatos en claro
                      (tipo de elemento + referencia). Nunca contenido cifrado. */}
                  <span className={styles.preview}>{previewText(thread)}</span>

                  <span className={`${styles.stateBadge} ${stateClass(state)}`}>
                    {STATE_LABELS[state]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.pagination}>
            <button
              type="button"
              className={`${styles.pageButton} ${styles.pageCtrl}`}
              disabled={effectivePage <= 1}
              onClick={() => onPageChange(effectivePage - 1)}
              aria-label="Página anterior"
            >
              ‹
            </button>

            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={
                  pageNumber === effectivePage
                    ? `${styles.pageButton} ${styles.pageActive}`
                    : styles.pageButton
                }
                disabled={pageNumber === effectivePage}
                onClick={() => onPageChange(pageNumber)}
                aria-current={pageNumber === effectivePage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              className={`${styles.pageButton} ${styles.pageCtrl}`}
              disabled={effectivePage >= effectiveTotalPages}
              onClick={() => onPageChange(effectivePage + 1)}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default ThreadList;
