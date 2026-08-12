import type { SentOffer, SortColumn, SortDirection, [1m, [0m } from '../../lib/sent-offers';
import styles from './SentOffersTable.module.css';

interface Props {
  offers: SentOffer[];
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  onOpenThread: (threadId: string) => void;
  hasQuery: boolean;
}

/**
 * Presentacional: recibe las filas YA filtradas y YA ordenadas y no vuelve a
 * tocarlas. Los dos estados vacíos viven aquí, dentro de la tabla, porque "no
 * hay filas" es un estado de la lista — la misma lección que MSG-01 y SRCH-01.
 *
 * Cabeceras en orden fijo (CA-VND-01): Referencia, Organización, Estado, Fecha,
 * Acciones. Las cuatro primeras ordenables (`aria-sort` sobre el `<th>`), la
 * última no (sin `aria-sort` en absoluto).
 */
export function SentOffersTable({ offers, sort, onSort, onOpenThread, hasQuery }: Props) {
  if (offers.length === 0) {
    return (
      <div className={styles.tableOuter}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.th}>
                <span className={styles.thText}>Referencia</span>
              </th>
              <th scope="col" className={styles.th}>
                <span className={styles.thText}>Organización</span>
              </th>
              <th scope="col" className={styles.th}>
                <span className={styles.thText}>Estado</span>
              </th>
              <th scope="col" className={styles.th}>
                <span className={styles.thText}>Fecha</span>
              </th>
              <th scope="col" className={styles.th}>
                <span className={styles.thText}>Acciones</span>
              </th>
            </tr>
          </thead>
        </table>
        <div className={styles.emptyState}>
          <p>{hasQuery ? EMPTY_NO_MATCHES : EMPTY_NO_OFFERS}</p>
        </div>
      </div>
    );
  }

  const activeSort = (col: SortColumn) => (sort.column === col ? sort.direction : null);

  const headerAriaSort = (col: SortColumn): 'ascending' | 'descending' | 'none' => {
    const d = activeSort(col);
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  };

  return (
    <div className={styles.tableOuter}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.th} aria-sort={headerAriaSort('referencia')}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => onSort('referencia')}
              >
                Referencia
                <span className={styles.sortIndicator} aria-hidden="true">
                  {activeSort('referencia') === 'asc' ? '↑' : activeSort('referencia') === 'desc' ? '↓' : '↕'}
                </span>
              </button>
            </th>
            <th scope="col" className={styles.th} aria-sort={headerAriaSort('organizacion')}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => onSort('organizacion')}
              >
                Organización
                <span className={styles.sortIndicator} aria-hidden="true">
                  {activeSort('organizacion') === 'asc' ? '↑' : activeSort('organizacion') === 'desc' ? '↓' : '↕'}
                </span>
              </button>
            </th>
            <th scope="col" className={styles.th} aria-sort={headerAriaSort('estado')}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => onSort('estado')}
              >
                Estado
                <span className={styles.sortIndicator} aria-hidden="true">
                  {activeSort('estado') === 'asc' ? '↑' : activeSort('estado') === 'desc' ? '↓' : '↕'}
                </span>
              </button>
            </th>
            <th scope="col" className={styles.th} aria-sort={headerAriaSort('fecha')}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => onSort('fecha')}
              >
                Fecha
                <span className={styles.sortIndicator} aria-hidden="true">
                  {activeSort('fecha') === 'asc' ? '↑' : activeSort('fecha') === 'desc' ? '↓' : '↕'}
                </span>
              </button>
            </th>
            <th scope="col" className={styles.th}>
              <span className={styles.thText}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} data-testid="sent-offer-row" data-offer-id={offer.id} className={styles.row}>
              <td className={styles.td}>
                <span className={styles.ref}>{offer.partNumber}</span>
                {offer.brand !== null && offer.brand !== '' && (
                  <span className={styles.brand}>{offer.brand}</span>
                )}
              </td>
              <td className={styles.td}>
                <span className={styles.org}>{offer.counterpartyName}</span>
              </td>
              <td className={styles.td}>
                <span className={`${styles.badge} ${badgeClass(offer.state)}`}>{offer.state}</span>
              </td>
              <td className={styles.td}>
                <span className={styles.ts}>{sentAtLabel(offer.createdAt)}</span>
              </td>
              <td className={styles.td}>
                <button
                  type="button"
                  className={offer.state === 'Aceptada' ? styles.actPrimary : styles.actGhost}
                  onClick={() => onOpenThread(offer.threadId)}
                >
                  {rowActionLabel(offer.state)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const badgeClass = (state: SentOffer['state']): string => {
  switch (state) {
    case 'Pendiente':
      return styles.statePending;
    case 'Aceptada':
      return styles.stateAccepted;
    case 'Rechazada':
      return styles.stateRejected;
    case 'Superada por contraoferta':
      return styles.stateSuperseded;
    default:
      return styles.stateNeutral;
  }
};
