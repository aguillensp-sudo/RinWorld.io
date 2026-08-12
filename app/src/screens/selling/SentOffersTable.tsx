import type { OfferState } from '../../lib/offers';
import {
  EMPTY_NO_MATCHES,
  EMPTY_NO_OFFERS,
  rowActionLabel,
  sentAtLabel,
  type SentOffer,
  type SortColumn,
  type SortDirection,
} from '../../lib/sent-offers';
import styles from './SentOffersTable.module.css';

interface SentOffersTableProps {
  offers: SentOffer[];
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  onOpenThread: (threadId: string) => void;
  hasQuery: boolean;
}

/** Las cuatro columnas ordenables de la §5.4. `Acciones` no lo es. */
const SORTABLE_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'referencia', label: 'Referencia' },
  { key: 'organizacion', label: 'Organización' },
  { key: 'estado', label: 'Estado' },
  { key: 'fecha', label: 'Fecha' },
];

/**
 * Los cuatro estados del CHECK `thread_items_estado_oferta_chk` (0003), cada uno
 * con su tono. El Record está tipado contra `OfferState`: si el esquema ganara
 * un quinto estado, TS obliga a decidir su clase en vez de dejar la celda sin
 * adorno o con el tono de otro.
 *
 * `?? ''` porque los CSS Modules tipados con `noUncheckedIndexedAccess`
 * devuelven `string | undefined`; la clase existe en el módulo, pero TS no lo
 * sabe.
 */
const STATE_CLASS: Record<OfferState, string> = {
  Pendiente: styles.statusPending ?? '',
  Aceptada: styles.statusAccepted ?? '',
  Rechazada: styles.statusRejected ?? '',
  'Superada por contraoferta': styles.statusSuperseded ?? '',
};

/**
 * Tabla de VND-01 · Mis Ofertas.
 *
 * Presentacional: recibe las filas ya filtradas y ya ordenadas y no vuelve a
 * tocarlas. El estado vacío vive aquí y no en la pantalla — "no hay filas" es
 * un estado de la lista, igual que en SRCH-01 y MSG-01.
 */
export function SentOffersTable({
  offers,
  sort,
  onSort,
  onOpenThread,
  hasQuery,
}: SentOffersTableProps) {
  return (
    <div className={styles.tableOuter}>
      <table className={styles.table}>
        <thead>
          <tr>
            {SORTABLE_COLUMNS.map((column) => {
              const isActive = sort.column === column.key;
              const directionClass = isActive
                ? sort.direction === 'asc'
                  ? styles.sortAsc ?? ''
                  : styles.sortDesc ?? ''
                : '';
              const thClass = `${styles.th ?? ''} ${directionClass}`.trim();
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={thClass}
                  aria-sort={
                    isActive
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    <span className={styles.sortIcon} aria-hidden="true">
                      {isActive ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
            <th scope="col" className={styles.th}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {offers.length === 0 ? (
            <tr>
              <td colSpan={5} className={`${styles.td} ${styles.emptyCell}`}>
                {hasQuery ? EMPTY_NO_MATCHES : EMPTY_NO_OFFERS}
              </td>
            </tr>
          ) : (
            offers.map((offer) => (
              <tr
                key={offer.id}
                className={styles.row}
                data-testid="sent-offer-row"
                data-offer-id={offer.id}
              >
                <td className={styles.td}>
                  <span className={styles.ref}>{offer.partNumber ?? '—'}</span>
                  {offer.brand && <span className={styles.brand}>{offer.brand}</span>}
                </td>
                <td className={styles.td}>
                  <span className={styles.org}>{offer.counterpartyName}</span>
                </td>
                <td className={styles.td}>
                  <span className={STATE_CLASS[offer.state]}>{offer.state}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.ts}>{sentAtLabel(offer.createdAt)}</span>
                </td>
                <td className={styles.td}>
                  <button
                    type="button"
                    className={
                      offer.state === 'Aceptada'
                        ? styles.actionPrimary ?? ''
                        : styles.actionGhost ?? ''
                    }
                    onClick={() => onOpenThread(offer.threadId)}
                  >
                    {rowActionLabel(offer.state)}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
