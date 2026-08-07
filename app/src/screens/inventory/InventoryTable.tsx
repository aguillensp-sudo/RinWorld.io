import { ageLabel, ageLevel, daysSince, type InventoryLine, type LineStatus } from '../../lib/inventory';
import styles from './InventoryTable.module.css';

/**
 * Tabla de inventario de INV-01, escrita a mano.
 *
 * Es la contrapartida directa del `InventoryTable.tsx` que generó el Coder en SP-1
 * (`openspec/mvp/spikes/SP-1/src/`): mismo componente, misma fuente de verdad, uno
 * a mano y otro del arnés. Esa comparación es el objetivo 4 del MVP, así que este
 * fichero se mantiene comparable a propósito — nombres de clase del HTML aprobado,
 * un solo componente, datos por props.
 *
 * Diferencia de fondo con el del spike: aquí las filas vienen de la base de datos,
 * no de un array de ejemplo, así que el componente tiene que aguantar los CUATRO
 * estados del spec y una tabla vacía.
 */

/** Las siete columnas, en el orden que la spec §3 llama "fijo inamovible". */
const COLUMNS = ['Referencia', 'Marca', 'Cantidad', 'País', 'Estado', 'Antigüedad'] as const;

/**
 * Etiqueta y clase por estado.
 *
 * `DELETED` está aquí aunque los cuatro chips de INV-01 no lo muestren nunca: si
 * algún día una línea eliminada llega a esta tabla, sale con su badge y no como
 * una celda en blanco. Un estado sin estilo se convierte en un hueco silencioso.
 */
const STATUS_META: Record<LineStatus, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Published', cls: 'pub' },
  DRAFT: { label: 'Draft', cls: 'dft' },
  ARCHIVED: { label: 'Archived', cls: 'arc' },
  DELETED: { label: 'Deleted', cls: 'deleted' },
};

interface Props {
  lines: InventoryLine[];
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  onArchive: (line: InventoryLine) => void;
  onDelete: (line: InventoryLine) => void;
  /** Deshabilita las acciones de la fila que está en vuelo. */
  busyId?: string | null;
}

export function InventoryTable({ lines, now, onArchive, onDelete, busyId }: Props) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th key={c}>{c}</th>
          ))}
          {/* La columna 7 va sin cabecera visible, como el HTML aprobado, pero
              con nombre accesible: una columna anónima es ilegible a ciegas. */}
          <th>
            <span className={styles.srOnly}>Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const days = daysSince(line.lastUploadAt, now);
          const level = ageLevel(days);
          const meta = STATUS_META[line.status];
          const busy = busyId === line.id;
          return (
            <tr key={line.id}>
              <td>
                <span className={styles.refCode}>{line.partNumber}</span>
              </td>
              <td>
                <span className={`${styles.badge} ${styles.brand}`}>{line.brand}</span>
              </td>
              <td>{line.quantity.toLocaleString('es-ES')}</td>
              <td>
                <span className={`${styles.badge} ${styles.iso}`}>{line.country}</span>
              </td>
              <td>
                <span className={`${styles.badge} ${styles[meta.cls]}`}>{meta.label}</span>
              </td>
              <td>
                <span className={`${styles.age} ${level !== 'fresh' ? styles[level] : ''}`}>
                  {ageLabel(days)}
                </span>
              </td>
              <td>
                {/* Los nombres accesibles llevan la referencia. Con 50 filas por
                    página, "Archivar" a secas aparece 50 veces y ninguna consulta
                    por rol es unívoca — ni para un test ni para un lector de
                    pantalla. Es la lección de F-017. */}
                <div className={styles.rowActs}>
                  <button
                    type="button"
                    className={styles.rowAct}
                    aria-label={`Archivar ${line.partNumber}`}
                    disabled={busy || line.status === 'ARCHIVED'}
                    onClick={() => onArchive(line)}
                  >
                    <i className="ti ti-archive" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.rowAct} ${styles.del}`}
                    aria-label={`Eliminar ${line.partNumber}`}
                    disabled={busy}
                    onClick={() => onDelete(line)}
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
