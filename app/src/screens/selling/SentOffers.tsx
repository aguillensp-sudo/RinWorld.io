import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../lib/session';
import type { MemberProfile } from '../../lib/session';
import {
  DEFAULT_SORT,
  EYEBROW,
  SEARCH_PLACEHOLDER,
  SUBTITLE,
  TITLE,
  fetchSentOffers,
  filterSentOffers,
  resultCountLabel,
  sortSentOffers,
  type SentOffer,
  type SortColumn,
} from '../../lib/sent-offers';
import { SentOffersTable } from './SentOffersTable';
import styles from './SentOffers.module.css';
import { SearchField } from '../../components/SearchField';

/**
 * VND-01 · Mis Ofertas (vista del vendedor).
 *
 * La pantalla posee todo el estado: ofertas, carga, error, texto de búsqueda y
 * ordenación. La carga se hace exactamente una vez al montar; `orgId` no cambia
 * durante la vida de la pantalla, así que incluirlo en las dependencias solo
 * provocaría un refetch.
 */
export function SentOffers({
  profile,
  onOpenThread,
}: {
  profile: MemberProfile;
  onOpenThread?: (threadId: string) => void;
}) {
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);

  useEffect(() => {
    let cancelled = false;

    fetchSentOffers(profile.orgId)
      .then((data) => {
        if (cancelled) return;
        setOffers(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => filterSentOffers(offers, query), [offers, query]);
  const sorted = useMemo(
    () => sortSentOffers(filtered, sort.column, sort.direction),
    [filtered, sort],
  );

  const handleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    );
  };

  const handleOpenThread = (threadId: string) => {
    onOpenThread?.(threadId);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={styles.content}
      data-testid="selling-body"
      aria-busy={loading ? 'true' : 'false'}
    >
      <p className={styles.eyebrow}>{EYEBROW}</p>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {loading && <p className={styles.loading}>Cargando ofertas…</p>}

      {!loading && error != null && (
        <div className={styles.alert} role="alert">
          {errorMessage(error as Error)}
        </div>
      )}

      {!loading && error == null && (
        <>
          <div className={styles.searchBar}>
            <SearchField
              value={draft}
              onChange={setDraft}
              onSubmit={() => setQuery(draft.trim())}
              placeholder={SEARCH_PLACEHOLDER}
              inputLabel="Buscar en ofertas enviadas"
              submitLabel="Buscar"
            />
            <span className={styles.resultCount}>{resultCountLabel(filtered.length)}</span>
          </div>

          <SentOffersTable
            offers={sorted}
            sort={sort}
            onSort={handleSort}
            onOpenThread={handleOpenThread}
            hasQuery={hasQuery}
          />
        </>
      )}
    </div>
  );
}
