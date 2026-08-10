import { useEffect, useRef } from 'react';
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

export interface Props {
  rows: SearchResultRow[];
  sort: Sort | null;
  selected: ReadonlySet<string>;
  minQuantity: number | null;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  onSort(column: SortColumn): void;
  onToggleRow(lineId: string): void;
  onToggleFavorite(orgId: string): void;
  onConsult(lineId: string): void;
  onContact(orgId: string): void;
}

interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  sort: Sort | null;
  onSort(column: SortColumn): void;
}

function SortableHeader({ column, label, sort, onSort }: SortableHeaderProps) {
  const active = sort?.column === column;
  const direction = active ? sort?.direction ?? null : null;

  return (
    <th
      scope="col"
      className={styles.sortable}
      aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" className={styles.sortButton} onClick={() => onSort(column)}>
        {label}
        {direction ? (
          <span aria-hidden="true" className={styles.sortIcon}>
            {direction === 'asc' ? '↑' : '↓'}
          </span>
        ) : null}
      </button>
    </th>
  );
}

/**
 * Tabla de resultados de SRCH-01, presentacional.
 *
 * Pinta las filas exactamente en el orden que recibe; ordenar es de la pantalla.
 * El estado vacío vive aquí: "no hay filas" es un estado de la lista.
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
  const effectiveNow = now ?? new Date();
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someSelected = rows.some((row) => selected.has(row.id));
  const headerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const handleHeaderChange = () => {
    if (allSelected) {
      rows.filter((row) => selected.has(row.id)).forEach((row) => onToggleRow(row.id));
    } else {
      rows.filter((row) => !selected.has(row.id)).forEach((row) => onToggleRow(row.id));
    }
  };

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.chkTh}>
              <input
                ref={headerRef}
                type="checkbox"
                checked={allSelected}
                onChange={handleHeaderChange}
                aria-label="Seleccionar todos"
              />
            </th>
            <th scope="col">Referencia</th>
            <SortableHeader column="brand" label="Marca" sort={sort} onSort={onSort} />
            <SortableHeader column="quantity" label="Cantidad" sort={sort} onSort={onSort} />
            <SortableHeader column="leadTime" label="Plazo" sort={sort} onSort={onSort} />
            <th scope="col">Empresa</th>
            <SortableHeader column="country" label="País" sort={sort} onSort={onSort} />
            <SortableHeader column="age" label="Antigüedad" sort={sort} onSort={onSort} />
            <SortableHeader column="favorites" label="Favoritos" sort={sort} onSort={onSort} />
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={10}>
                No hemos encontrado stock con estos filtros.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const days = daysSince(row.lastUploadAt, effectiveNow);
              const quantityOk = meetsMinQuantity(row.quantity, minQuantity);
              return (
                <tr key={row.id} className={row.consulted ? styles.consulted : undefined}>
                  <td className={styles.chkTd}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => onToggleRow(row.id)}
                      aria-label={`Seleccionar ${row.partNumber}`}
                    />
                  </td>
                  <td>
                    <span className={styles.ref}>{row.partNumber}</span>
                  </td>
                  <td>
                    <span className={styles.brand}>{row.brand}</span>
                  </td>
                  <td>
                    <span className={`${styles.qty} ${quantityOk ? styles.qtyOk : styles.qtyLow}`}>
                      {quantityLabel(row.quantity)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.leadTime}>{leadTimeLabel(row.leadTimeDays)}</span>
                  </td>
                  <td>
                    <span className={styles.company}>{row.orgName}</span>
                  </td>
                  <td>
                    <span className={styles.country}>{countryName(row.country)}</span>
                  </td>
                  <td>
                    <span className={`${styles.age} ${days > 7 ? styles.ageStale : ''}`}>{ageLabel(days)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.favorite} ${row.isFavorite ? styles.favoriteActive : ''}`}
                      onClick={() => onToggleFavorite(row.orgId)}
                      aria-label={`${row.isFavorite ? 'Quitar favorita' : 'Añadir favorita'} ${row.orgName}`}
                    >
                      <span aria-hidden="true" className={styles.star}>
                        ★
                      </span>
                      <span>{quantityLabel(row.favoriteCount)}</span>
                    </button>
                  </td>
                  <td>
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
