import { useCallback, useEffect, useState } from 'react';
import type { MemberProfile } from '../../lib/session';
import {
  EMPTY_CRITERIA,
  fetchResults,
  meetsMinQuantity,
  metaCounterLabel,
  nextSort,
  sortRows,
  toggleFavorite,
  type SearchCriteria,
  type SearchPage,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import { FilterChips } from './FilterChips';
import { ResultsTable } from './ResultsTable';
import styles from './SearchResults.module.css';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
}

/**
 * Pantalla SRCH-01 · Panel de Resultados de Búsqueda.
 *
 * Es la pantalla, no un componente de presentación: posee los criterios, el
 * orden, la selección, la carga y el error, y es quien decide que al alternar
 * un favorito se vuelve a consultar la base (`toggleFavorite` + `fetchResults`).
 * La tabla y los chips son presentacionales y no guardan estado de datos.
 */
export function SearchResults({ profile, now }: Props) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (c: SearchCriteria) => {
      setLoading(true);
      setError(false);
      try {
        const p = await fetchResults({ orgId: profile.orgId, memberId: profile.id, criteria: c });
        setPage(p);
      } catch {
        setError(true);
        setPage(null);
      } finally {
        setLoading(false);
      }
    },
    [profile.orgId, profile.id],
  );

  useEffect(() => {
    void load(criteria);
  }, [criteria, load]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((current) => nextSort(current, column));
  }, []);

  const handleToggleRow = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(
    async (orgId: string) => {
      const row = page?.rows.find((r) => r.orgId === orgId);
      if (!row) return;
      try {
        // El recuento agregado lo mantiene el trigger de la base; al volver a
        // consultar vemos el número nuevo.
        await toggleFavorite(profile.id, orgId, !row.isFavorite);
        await load(criteria);
      } catch {
        setError(true);
      }
    },
    [page, profile.id, criteria, load],
  );

  // El destino de estos dos callbacks (abrir tarjeta de consulta / crear hilo)
  // es la fila del día 10 del Plan §3 (GAP-004). Hoy solo avisan, y el aviso lo
  // consume la pantalla cuando el wiring exista.
  const handleConsult = useCallback((_lineId: string) => {}, []);
  const handleContact = useCallback((_orgId: string) => {}, []);

  const handleConsultSelected = useCallback(() => {
    // GAP-004: crear/reutilizar hilos agrupados por distribuidor. Hoy no se
    // simula ningún envío ni cambio de fila en cliente.
  }, []);

  const allSelected = page !== null && page.rows.length > 0 && page.rows.every((r) => selected.has(r.id));

  const handleToggleSelectAll = useCallback(() => {
    if (!page) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(page.rows.map((r) => r.id)));
  }, [page, allSelected]);

  const rows = page ? sortRows(page.rows, sort) : [];
  const withStock = page ? page.rows.filter((r) => meetsMinQuantity(r.quantity, criteria.minQuantity)).length : 0;
  const reFetch = useCallback(() => {
    void load(criteria);
  }, [load, criteria]);

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>Módulo 03 · Búsqueda Conversacional</div>
      <h1 className={styles.title}>Resultados de búsqueda</h1>

      <FilterChips criteria={criteria} onChange={setCriteria} />

      {error ? (
        <div className={styles.error} role="alert">
          <p>No se pudieron cargar los resultados. Inténtalo de nuevo.</p>
          <button type="button" className={styles.retry} onClick={reFetch}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className={styles.metaBar}>
            {page && (
              <div className={styles.metaCount}>{metaCounterLabel(page.total, withStock, criteria.minQuantity)}</div>
            )}
            {page && page.rows.length > 0 && (
              <button type="button" className={styles.selectAll} onClick={handleToggleSelectAll}>
                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
            {/* F-039: la capability manda >=2, no el >=1 de la spec §3. Con una
                sola fila marcada la acción correcta es "Consultar" de esa fila. */}
            <button
              type="button"
              className={styles.consultSelected}
              disabled={selected.size < 2}
              onClick={handleConsultSelected}
            >
              Consultar seleccionados
            </button>
            {/* SRCH-03 está fuera del alcance (Plan §9): no existe tabla de
                watchers. El botón se pinta deshabilitado y con el motivo, como
                F-023 e. Un aviso que nadie va a mandar no es un botón vivo. */}
            <button
              type="button"
              className={styles.watcher}
              disabled
              title="Los watchers están fuera del alcance de esta versión"
            >
              <i className="ti ti-bell-plus" aria-hidden="true" />
              Crear watcher con estos criterios
            </button>
          </div>

          <div className={styles.resultsArea} aria-busy={loading}>
            {loading ? (
              <div className={styles.spinner} role="status">
                <span className={styles.srOnly}>Buscando...</span>
              </div>
            ) : page ? (
              <ResultsTable
                rows={rows}
                sort={sort}
                selected={selected}
                minQuantity={criteria.minQuantity}
                now={now ?? new Date()}
                onSort={handleSort}
                onToggleRow={handleToggleRow}
                onToggleFavorite={handleToggleFavorite}
                onConsult={handleConsult}
                onContact={handleContact}
              />
            ) : null}
          </div>

          {page?.capped && (
            <div className={styles.cappedNotice}>
              Mostrando los primeros 200 resultados. Afina los filtros para verlos todos.
            </div>
          )}
        </>
      )}
    </div>
  );
}
