import { useEffect, useMemo, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  DEFAULT_SORT,
  EYEBROW,
  fetchSentOffers,
  filterSentOffers,
  resultCountLabel,
  SEARCH_PLACEHOLDER,
  sortSentOffers,
  SUBTITLE,
  TITLE,
  type SentOffer,
  type SortColumn,
  type SortDirection,
} from '../../lib/sent-offers';
import { SentOffersTable } from './SentOffersTable';
import styles from './SentOffers.module.css';

interface Props {
  profile: MemberProfile;
  onOpenThread?: (threadId: string) => void;
}

/**
 * VND-01 · Mis Ofertas (vista del vendedor).
 *
 * Posee TODO el estado — ofertas, carga, error, texto de búsqueda y ordenación.
 * El orden de operaciones es FILTRAR y luego ORDENAR (§4 / §5.4). La ordenación
 * arranca en `DEFAULT_SORT` (Fecha descendente) y se aplica SIEMPRE desde aquí.
 * El panel VERA es wiring del shell (contrato propio desde el día 2) y no es de
 * esta pantalla.
 */
export function SentOffers({ profile, onOpenThread }: Props) {
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>(DEFAULT_SORT);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSentOffers(profile.orgId)
      .then((data) => {
        if (cancelled) return;
        setOffers(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.orgId]);

  const filtered = useMemo(() => filterSentOffers(offers, query), [offers, query]);
  const sorted = useMemo(() => sortSentOffers(filtered, sort.column, sort.direction), [filtered, sort]);

  const hasQuery = query.trim().length > 0;

  const handleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    );
  };

  return (
    <div className={styles.page} data-testid="selling-body" aria-busy={loading}>
      <p className={styles.eyebrow}>{EYEBROW}</p>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : loading ? (
        <div className={styles.loading}>Cargando ofertas…</div>
      ) : (
        <>
          <div className={styles.searchBar}>
            <div className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={SEARCH_PLACEHOLDER}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={SEARCH_PLACEHOLDER}
              />
              {hasQuery && (
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
            <span className={styles.resultCount}>{resultCountLabel(filtered.length)}</span>
          </div>

          <SentOffersTable
            offers={sorted}
            sort={sort}
            onSort={handleSort}
            onOpenThread={(threadId) => onOpenThread?.(threadId)}
            hasQuery={hasQuery}
          />
        </>
      )}
    </div>
  );
}
