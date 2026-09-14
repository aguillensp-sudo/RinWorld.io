import type { DirectoryRow, DirectorySort, DirectorySortField } from '../../lib/directory';
import styles from './DirectoryTable.module.css';

interface Props {
  rows: DirectoryRow[];
  sort: DirectorySort;
  onSort: (field: DirectorySortField) => void;
  onOpenOrganization: (id: string) => void;
}

/**
 * Las cinco columnas de la spec §3, en el orden fijo e inamovible. Las tres
 * reordenables son las de `SORT_FIELDS`; Teléfono y Email no lo son, y no es un
 * olvido: ordenar un directorio por número de teléfono no significa nada.
 */
const COLUMNS: { label: string; field?: DirectorySortField }[] = [
  { label: 'Nombre', field: 'name' },
  { label: 'País', field: 'country' },
  { label: 'Teléfono' },
  { label: 'Email' },
  { label: 'Favoritos', field: 'favorite_count' },
];

/**
 * Tabla del directorio.
 *
 * Presentacional: pinta las filas **en el orden que las recibe** y no llama a
 * la red — ordenar es de `Directory`.
 *
 * El estado vacío vive aquí, dentro de la tabla, porque «no hay filas» es un
 * estado de la lista y no de la pantalla: sigue siendo una `<table>` de verdad
 * y el hueco va dentro, mismo patrón que `ResultsTable`.
 */
export function DirectoryTable({ rows, sort, onSort, onOpenOrganization }: Props) {
  return (
    <div className={styles.tableOuter}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const field = column.field;
              const active = field !== undefined && sort.field === field;

              /**
               * `aria-sort` va en el `<th>`, no en el botón, y SOLO en la
               * columna activa: las otras no llevan ni siquiera `'none'`.
               */
              const ariaSort = active ? (sort.ascending ? 'ascending' : 'descending') : undefined;

              return (
                <th key={column.label} scope="col" className={styles.th} aria-sort={ariaSort}>
                  {field !== undefined ? (
                    // La cabecera ordenable es un BOTÓN dentro del `<th>`: un
                    // `onClick` sobre la celda funciona con ratón y no existe
                    // con teclado. El botón manda el CAMPO, nunca la dirección.
                    <button type="button" className={styles.sortButton} onClick={() => onSort(field)}>
                      {column.label}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`${styles.td} ${styles.emptyCell}`} colSpan={5}>
                No hemos encontrado organizaciones que coincidan con los filtros aplicados.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className={styles.row}>
                <td className={styles.td}>
                  {/*
                   * DIR-02 (la ficha pública) no está construida todavía, así
                   * que el nombre es un control APAGADO con el motivo, no un
                   * enlace que no lleva a ninguna parte. `onOpenOrganization`
                   * se conserva aunque nunca vaya a dispararse: es el contrato
                   * del componente para cuando exista DIR-02 (mismo patrón que
                   * `Consultar`/`Contactar` en SRCH-01, F-100).
                   */}
                  <button
                    type="button"
                    className={styles.nameButton}
                    disabled
                    title="La ficha de organización (DIR-02) llega en una próxima versión."
                    onClick={() => onOpenOrganization(row.id)}
                  >
                    {row.name}
                  </button>
                </td>
                <td className={styles.td}>
                  {/* El CÓDIGO ISO que ya viene en mayúsculas, nunca
                      `countryLabel`: esa etiqueta es para el desplegable. */}
                  <span className={styles.countryBadge}>{row.country}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.contact}>{row.phone === '' ? '—' : row.phone}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.contact}>{row.email === '' ? '—' : row.email}</span>
                </td>
                <td className={styles.td}>
                  {/* La estrella es decorativa: el dato es el recuento. */}
                  <span className={styles.favorites}>
                    <span aria-hidden="true">★</span> {row.favoriteCount}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
