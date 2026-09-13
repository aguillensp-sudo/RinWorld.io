import type {
  DirectoryRow,
  DirectorySort,
  DirectorySortField,
} from '../../lib/directory';
import styles from './DirectoryTable.module.css';

interface Props {
  rows: DirectoryRow[];
  sort: DirectorySort;
  onSort: (field: DirectorySortField) => void;
  onOpenOrganization: (id: string) => void;
}

interface Column {
  label: string;
  /** Ausente = la columna no es reordenable (Teléfono y Email, spec §3). */
  sortField?: DirectorySortField;
}

/**
 * Las CINCO columnas de la spec §3, en orden fijo e inamovible. Se ordenan filas,
 * nunca columnas. Nombre, País y Favoritos son reordenables; Teléfono y Email no,
 * y no es un olvido de la spec: ordenar un directorio por número de teléfono no
 * significa nada.
 *
 * Los `sortField` son los nombres de la COLUMNA EN LA BASE (`name`, `country`,
 * `favorite_count`), no los del encabezado, porque van directos al `.order()` de
 * la capa de datos.
 */
const COLUMNS: readonly Column[] = [
  { label: 'Nombre', sortField: 'name' },
  { label: 'País', sortField: 'country' },
  { label: 'Teléfono' },
  { label: 'Email' },
  { label: 'Favoritos', sortField: 'favorite_count' },
];

/**
 * Tabla del directorio.
 *
 * Presentacional: pinta las filas EN EL ORDEN QUE LAS RECIBE y no llama a la red
 * —ordenar y paginar es cosa de `Directory`—. El estado vacío vive aquí dentro,
 * porque «no hay filas» es un estado de la lista y no de la pantalla: sigue
 * siendo una `<table>` de verdad y el hueco va en una fila con `colSpan`.
 */
export function DirectoryTable({ rows, sort, onSort, onOpenOrganization }: Props) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const field = column.sortField;
              const active = field !== undefined && sort.field === field;

              const cellClass = [styles.th];
              if (field !== undefined) {
                cellClass.push(styles.sortable);
                if (active) cellClass.push(sort.ascending ? styles.sortAsc : styles.sortDesc);
              }

              // `aria-sort` va en el `<th>` —no en el botón— y SOLO en la columna
              // activa: las otras no llevan el atributo en absoluto, ni 'none'.
              const ariaSort = active
                ? sort.ascending
                  ? 'ascending'
                  : 'descending'
                : undefined;

              return (
                <th
                  key={column.label}
                  scope="col"
                  className={cellClass.join(' ')}
                  aria-sort={ariaSort}
                >
                  {field !== undefined ? (
                    // La cabecera ordenable es un BOTÓN dentro del `<th>`: con el
                    // manejador en la celda, ordenar no existiría con teclado —no
                    // recibe foco y ningún lector lo anuncia como accionable—.
                    // La dirección no viaja nunca desde aquí: la decide `nextSort`
                    // en `Directory`.
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => onSort(field)}
                    >
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
              <td colSpan={5} className={styles.emptyCell}>
                No hemos encontrado organizaciones que coincidan con los filtros aplicados.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className={styles.row}>
                <td className={styles.td}>
                  {/*
                   * DIR-02 (la ficha pública de la organización) no está
                   * construida todavía y no es una de las tres pantallas del H1.
                   * El nombre se pinta como control apagado y con el motivo a la
                   * vista: un enlace que no lleva a ninguna parte, delante de
                   * alguien que no conoce la aplicación, parece una aplicación
                   * rota. `onOpenOrganization(row.id)` se conserva en el `onClick`
                   * —un botón deshabilitado no lo dispara— porque es el contrato
                   * del componente para cuando exista DIR-02, mismo patrón que
                   * `Consultar`/`Contactar` en SRCH-01.
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
                  {/* El CÓDIGO ISO tal cual (dos letras, ya en mayúsculas). Aquí
                      no va `row.countryLabel`, que es la etiqueta larga y solo
                      sirve para el desplegable de filtro. */}
                  <span className={styles.countryBadge}>{row.country}</span>
                </td>
                <td className={styles.td}>
                  {/* Cadena vacía = hueco visible, nunca una celda en blanco ni
                      la palabra «null». */}
                  <span className={styles.contact}>{row.phone === '' ? '—' : row.phone}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.contact}>{row.email === '' ? '—' : row.email}</span>
                </td>
                <td className={styles.td}>
                  {/* Solo lectura: marcar favorito es acción de otras pantallas. */}
                  <span className={styles.favorite}>
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
