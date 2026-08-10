import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import {
  fetchThreadPage,
  pageCount,
  type ThreadPage,
  type ThreadSummary,
} from '../../lib/threads';
import { ThreadList } from './ThreadList';
import styles from './Messages.module.css';

const NOOP = () => undefined;

interface MessagesProps {
  /** Organización actual, inyectada por el shell. */
  orgId: string;
  /** Abre MSG-02. Si el shell no la inyecta, la acción queda deshabilitada. */
  onOpenThread?: (thread: ThreadSummary) => void;
}

export function Messages({ orgId, onOpenThread }: MessagesProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [data, setData] = useState<ThreadPage>({ threads: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchThreadPage({ orgId, search: submittedSearch, page })
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los hilos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId, submittedSearch, page]);

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setSubmittedSearch(search);
        setPage(1);
      }
    },
    [search],
  );

  const pages = pageCount(data.total);

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Módulo 04 · Mensajería E2EE</p>
      <h1 className={styles.title}>Hilos</h1>
      <p className={styles.subtitle}>
        Tus conversaciones con otros distribuidores. Todo el contenido está cifrado de
        extremo a extremo.
      </p>

      <div className={styles.e2eeBar}>
        <i className="ti ti-lock" aria-hidden="true" />
        E2EE activo · contenido cifrado en local
      </div>

      <div className={styles.actionsBar}>
        <div className={styles.searchWrap}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre de organización..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <button
          type="button"
          className={`${styles.primaryBtn} ${styles.primaryBtnDisabled}`}
          disabled
          title="El Directorio estará disponible en una próxima versión"
        >
          <i className="ti ti-address-book" aria-hidden="true" />
          Nuevo contacto
        </button>
        <span className={styles.threadCount}>
          {data.total.toLocaleString('es-ES')} hilos · Página {page} de {pages}
        </span>
      </div>

      {loading ? (
        <div className={styles.stateMessage}>Cargando hilos…</div>
      ) : error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : data.threads.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {submittedSearch
              ? 'No se encontraron hilos para esa búsqueda.'
              : 'Todavía no tienes ninguna conversación. Usa el Directorio para contactar con otras organizaciones.'}
          </p>
          {!submittedSearch && (
            <button
              type="button"
              className={`${styles.primaryBtn} ${styles.primaryBtnDisabled}`}
              disabled
              title="El Directorio estará disponible en una próxima versión"
            >
              <i className="ti ti-address-book" aria-hidden="true" />
              Ir al Directorio
            </button>
          )}
        </div>
      ) : (
        <>
          <ThreadList threads={data.threads} onOpen={onOpenThread ?? NOOP} />
          {pages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={`${styles.pageBtn} ${page <= 1 ? styles.pageBtnDisabled : ''}`}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.pageBtn} ${page >= pages ? styles.pageBtnDisabled : ''}`}
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
