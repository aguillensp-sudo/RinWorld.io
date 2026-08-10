import { useEffect, useState } from 'react';
import {
  EMPTY_CRITERIA,
  MAX_RESULTS,
  fetchResults,
  meetsMinQuantity,
  metaCounterLabel,
  nextSort,
  quantityLabel,
  sortRows,
  toggleFavorite,
  type SearchCriteria,
  type SearchPage,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import type { MemberProfile } from '../../lib/session';
import { FilterChips } from './FilterChips';
import { ResultsTable } from './ResultsTable';
import styles from './SearchResults.module.css';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
}

/**
 * SRCH-01 · Panel de Resultados de Búsqueda.
 *
 * Posee todo el estado de la pantalla: criterios, orden, selección, carga y
 * error. La tabla es presentacional; esta pantalla es la única que conversa con
 * la capa de datos.
 */
export function SearchResults({ profile, now }: Props) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [fallbackNow] = useState(() => new Date());
  const effectiveNow = now ?? fallbackNow;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchResults({ orgId: profile.orgId, memberId: profile.id, criteria })
      .then((next) => {
        if (cancelled) return;
        setPage(next);
        // Si los criterios cambian, las filas seleccionadas que ya no existen
        // dejan de poder contarse: no se puede consultar una línea invisible.
        setSelected((prev) => new Set([...prev].filter((id) => next.rows.some((r) => r.id === id))));
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudieron cargar los resultados. Inténtalo de nuevo.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile.orgId, profile.id, criteria, reloadKey]);

  const sortedRows = page ? sortRows(page.rows, sort) : [];
  const withStock = page ? page.rows.filter((r) => meetsMinQuantity(r.quantity, criteria.minQuantity)).length : 0;
  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(r.id));

  const handleSort = (column: SortColumn) => {
    setSort((current) => nextSort(current, column));
  };

  const handleToggleRow = (lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(sortedRows.map((r) => r.id)));
  };

  const handleConsult = (_lineId: string) => {
    // El destino de la consulta (creación de hilo) es la fila del día 10 del
    // Plan §3. Hoy el contrato es solo avisar por callback.
  };

  const handleContact = (_orgId: string) => {
    // Fuera del alcance de esta iteración; el botón avisa y no simula envíos.
  };

  const handleConsultSelected = () => {
    sortedRows.filter((r) => selected.has(r.id)).forEach((r) => handleConsult(r.id));
  };

  const handleToggleFavorite = async (orgId: string) => {
    if (favoriteBusy || !page) return;
    const row = page.rows.find((r) => r.orgId === orgId);
    if (!row) return;

    const next = !row.isFavorite;
    setFavoriteBusy(orgId);
    try {
      await toggleFavorite(profile.id, orgId, next);
      const refreshed = await fetchResults({ orgId: profile.orgId, memberId: profile.id, criteria });
      setPage(refreshed);
      setSelected((prev) => new Set([...prev].filter((id) => refreshed.rows.some((r) => r.id === id))));
    } catch {
      // El estado de favoritos es estrictamente manual; si falla, no se toca
      // la tabla ni se simula nada.
    } finally {
      setFavoriteBusy(null);
    }
  };

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>Módulo 03 · Búsqueda Conversacional</p>
      <h1 className={styles.title}>Resultados de búsqueda</h1>

      <FilterChips criteria={criteria} onChange={setCriteria} />

      {page ? (
        <div className={styles.metabar}>
          <p className={styles.metaCount}>{metaCounterLabel(page.total, withStock, criteria.minQuantity)}</p>
          <button type="button" className={styles.linkButton} onClick={handleSelectAll}>
            {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={selected.size === 0}
            onClick={handleConsultSelected}
          >
            Consultar seleccionados
          </button>
          <button
            type="button"
            className={styles.watcherButton}
            disabled
            title="Los watchers estarán disponibles en una próxima versión"
          >
            <i className="ti ti-bell-plus" aria-hidden="true" />
            Crear watcher con estos criterios
          </button>
        </div>
      ) : null}

      {page?.capped ? (
        <p className={styles.capped} role="status">
          Se muestran las primeras {MAX_RESULTS} de {quantityLabel(page.total)} resultados.
        </p>
      ) : null}

      <div className={styles.tableArea}>
        {error ? (
          <div className={styles.stateBox} role="alert">
            <p className={styles.stateText}>No se pudieron cargar los resultados. Inténtalo de nuevo.</p>
            <button type="button" className={styles.retryButton} onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className={styles.stateBox} role="status">
            <i className="ti ti-loader" aria-hidden="true" />
            <span>Buscando...</span>
          </div>
        ) : (
          <ResultsTable
            rows={sortedRows}
            sort={sort}
            selected={selected}
            minQuantity={criteria.minQuantity}
            now={effectiveNow}
            onSort={handleSort}
            onToggleRow={handleToggleRow}
            onToggleFavorite={handleToggleFavorite}
            onConsult={handleConsult}
            onContact={handleContact}
          />
        )}
      </div>
    </div>
  );
}
