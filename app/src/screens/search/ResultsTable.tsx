import {
  ageLabel,
  countryName,
  daysSince,
  leadTimeLabel,
  meetsMinQuantity,
  quantityLabel,
  type SearchResultRow,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import styles from './ResultsTable.module.css';

interface Props {
  rows: SearchResultRow[];
  sort: Sort | null;
  selected: ReadonlySet<string>;
  minQuantity: number | null;
  now?: Date;
  onSort: (column: SortColumn) => void;
  onToggleRow: (lineId: string) => void;
  onToggleFavorite: (orgId: string) => void;
  onConsult: (lineId: string) => void;
  onContact: (orgId: string) => void;
}

/**
 * Las diez columnas de la spec §3, en el orden fijo e inamovible (§7).
 * Las ordenables son las seis de `SORTABLE_COLUMNS`; Checkbox, Referencia,
 * Empresa y Acciones no lo son.
 */
const COLUMNS: { key?: SortColumn; label: string; sortable: boolean; isControl?: boolean }[] = [
  { label: 'Seleccionar fila', sortable: false, isControl: true },
  { label: 'Referencia', sortable: false },
  { label: 'Marca', key: 'brand', sortable: true },
  { label: 'Cantidad', key: 'quantity', sortable: true },
  { label: 'Plazo', key: 'leadTime', sortable: true },
  { label: 'Empresa', sortable: false },
  { label: 'País', key: 'country', sortable: true },
  { label: 'Antigüedad', key: 'age', sortable: true },
  { label: 'Favoritos', key: 'favorites', sortable: true },
  { label: 'Acciones', sortable: false, isControl: true },
];

/**
 * Tabla de resultados de SRCH-01.
 *
 * Presentacional: pinta las filas en el orden que recibe y no carga datos.
 * El estado vacío vive aquí, dentro de la tabla, porque "no hay filas" es un
 * estado de la lista y no de la pantalla.
 */
export function ResultsTable({
  rows,
  sort,
  selected,
  minQuantity,
  now,
  onSort,
  onToggleRow,
  onToggleFavorite,
  onConsult,
  onContact,
}: Props) {
  const nowValue = now ?? new Date();

  return (
    <div className={styles.tableOuter}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((col, i) => {
              /**
               * Las dos cosas se calculan UNA vez y ya estrechadas, y esa es la
               * corrección: el artefacto comprobaba `col.sortable && col.key` en
               * la clase y en el `onClick`, pero no en `aria-sort`, y ahí
               * `sort?.column === col.key` con `sort` a null y `col.key`
               * `undefined` compara `undefined === undefined` — da **true** y
               * entra a leer `sort.direction` de un null. No era un aviso de
               * tipos: la tabla reventaba al primer render sin ordenación, que
               * es el estado inicial de la pantalla.
               */
              const sortKey = col.sortable ? col.key : undefined;
              const activeSort =
                sort !== null && sortKey !== undefined && sort.column === sortKey ? sort : null;

              const cls = [styles.th];
              if (i === 0) cls.push(styles.thChk);
              if (sortKey) {
                cls.push(styles.sortable);
                if (activeSort) {
                  cls.push(activeSort.direction === 'asc' ? styles.sortAsc : styles.sortDesc);
                }
              }
              const ariaSort = activeSort
                ? activeSort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined;
              return (
                <th key={col.label} className={cls.join(' ')} aria-sort={ariaSort} scope="col">
                  {/*
                   * La cabecera ordenable es un BOTÓN dentro del `<th>`, no un
                   * `onClick` sobre la celda. El artefacto ponía el manejador en
                   * el `<th>`: funciona con ratón y no existe con teclado — no
                   * recibe foco, no responde a Enter ni a Espacio y ningún lector
                   * de pantalla lo anuncia como accionable. La spec §3 pide
                   * ordenar «clic en cabecera», y el `aria-sort` que ya estaba
                   * puesto promete precisamente un control que aquí no lo era.
                   */}
                  {sortKey ? (
                    <button type="button" className={styles.sortButton} onClick={() => onSort(sortKey)}>
                      {col.label}
                    </button>
                  ) : col.isControl ? (
                    <span className={styles.srOnly}>{col.label}</span>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className={`${styles.td} ${styles.emptyCell}`}>
                No hemos encontrado stock con estos filtros.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const days = daysSince(row.lastUploadAt, nowValue);
              return (
                <tr key={row.id} className={row.consulted ? `${styles.row} ${styles.consulted}` : styles.row}>
                  <td className={`${styles.td} ${styles.tdChk}`}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selected.has(row.id)}
                      onChange={() => onToggleRow(row.id)}
                      aria-label={`Seleccionar ${row.partNumber}`}
                    />
                  </td>
                  <td className={styles.td}>
                    <span className={styles.ref}>{row.partNumber}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.brandBadge}>{row.brand}</span>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={`${styles.qty} ${meetsMinQuantity(row.quantity, minQuantity) ? styles.ok : styles.low}`}
                    >
                      {quantityLabel(row.quantity)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.leadTime}>{leadTimeLabel(row.leadTimeDays)}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.company}>{row.orgName}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.countryBadge}>{countryName(row.country)}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.age} ${days > 7 ? styles.stale : ''}`}>{ageLabel(days)}</span>
                  </td>
                  <td className={styles.td}>
                    {/* F-038: el estado de favorito se distingue por aria-pressed,
                        no solo por color. El recuento agregado es texto visible. */}
                    <button
                      type="button"
                      className={styles.favButton}
                      aria-pressed={row.isFavorite}
                      aria-label={`${row.isFavorite ? 'Quitar' : 'Marcar'} favorito de ${row.orgName}`}
                      onClick={() => onToggleFavorite(row.orgId)}
                    >
                      <span className={styles.favStar} aria-hidden="true">
                        ★
                      </span>
                      <span>{row.favoriteCount}</span>
                    </button>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.consult}
                        disabled={row.consulted}
                        title={row.consulted ? 'Ya consultada anteriormente' : undefined}
                        onClick={() => onConsult(row.id)}
                      >
                        Consultar
                      </button>
                      <button type="button" className={styles.contact} onClick={() => onContact(row.orgId)}>
                        Contactar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
