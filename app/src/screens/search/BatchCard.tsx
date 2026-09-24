import { cardHeaderLabel, hasNoResults, hasStock, type BatchResult } from '../../lib/batch';
import { sortRows, type Sort, type SortColumn } from '../../lib/search';
import { ResultsTable } from './ResultsTable';
import styles from './BatchCard.module.css';

interface Props {
  result: BatchResult;
  expanded: boolean;
  sort: Sort | null;
  selected: ReadonlySet<string>;
  now: Date;
  onToggle: () => void;
  onSort: (column: SortColumn) => void;
  onToggleRow: (lineId: string) => void;
  onToggleFavorite: (orgId: string) => void;
  onConsult: (lineId: string) => void;
  onContact: (orgId: string) => void;
}

/**
 * Una tarjeta colapsable de SRCH-02: cabecera con la referencia, el resumen
 * (`cardHeaderLabel`) y el botón de expandir/contraer; cuerpo con la MISMA
 * tabla de SRCH-01 (`ResultsTable`, sin tocarla).
 *
 * Es presentacional: no hace red y no guarda estado. Todo —expansión, orden,
 * selección, favorito— lo posee `BatchSearch`.
 */
export function BatchCard({
  result,
  expanded,
  sort,
  selected,
  now,
  onToggle,
  onSort,
  onToggleRow,
  onToggleFavorite,
  onConsult,
  onContact,
}: Props) {
  const failed = result.page === null;
  const empty = hasNoResults(result);
  const stock = hasStock(result);

  return (
    <article className={styles.card} aria-label={'Referencia ' + result.reference}>
      <div className={styles.head}>
        <span className={styles.reference}>{result.reference}</span>
        <span className={styles.summary}>{cardHeaderLabel(result)}</span>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-label={(expanded ? 'Contraer ' : 'Expandir ') + result.reference}
          onClick={onToggle}
        >
          <i className={expanded ? 'ti ti-chevron-down' : 'ti ti-chevron-right'} aria-hidden="true" />
        </button>
        {/* Sin resultados no hay nada que expandir: lo que ofrece la spec es un
            watcher, y los watchers exigen la confirmación de VERA (spec §5). */}
        {empty && (
          <button
            type="button"
            className={styles.watcher}
            disabled
            aria-label={'Crear watcher — ' + result.reference}
            title="La creación de watchers necesita la confirmación de VERA, que todavía no está conectada."
          >
            <i className="ti ti-bell-plus" aria-hidden="true" />
            Crear watcher
          </button>
        )}
      </div>

      {/* Consulta fallida: el error es de ESTA referencia, no de la pantalla, y
          la cabecera ya dice 'No se pudo consultar'. Ni tabla ni watcher. */}
      {failed && (
        <p className={styles.alert} role="alert">
          {result.error}
        </p>
      )}

      {expanded && stock && result.page !== null && (
        <div className={styles.body}>
          <ResultsTable
            rows={sortRows(result.page.rows, sort)}
            sort={sort}
            selected={selected}
            minQuantity={null}
            now={now}
            onSort={onSort}
            onToggleRow={onToggleRow}
            onToggleFavorite={onToggleFavorite}
            onConsult={onConsult}
            onContact={onContact}
          />
        </div>
      )}
    </article>
  );
}
