import {
  queueAgeLabel,
  queueAgeLevel,
  requestDateLabel,
  websiteHref,
  type QueueAgeLevel,
  type RequestRow,
  type RequestState,
} from '../../lib/admin-requests';
import styles from './RequestsTable.module.css';

interface Props {
  rows: RequestRow[];
  now?: Date;
  selectedId: string | null;
  onSelect: (row: RequestRow) => void;
}

/**
 * Las ocho columnas de la spec §3, en orden fijo. NINGUNA es ordenable: el orden
 * "más antigua primero" ya lo resuelve `fetchRequests`, y esta tabla no reordena
 * ni llama a la red.
 */
const COLUMNS = [
  'Organización',
  'País',
  'Email',
  'Teléfono',
  'Sitio web',
  'Fecha solicitud',
  'Antigüedad en cola',
  'Estado',
] as const;

/**
 * Columna 8: el literal del enum tal cual, con su color.
 *
 * `styles` es un índice de strings —una clase puede faltar en una build sin
 * CSS—, así que el valor admite `undefined` y quien lo compone lo descarta.
 */
const STATE_CLASS: Record<RequestState, string | undefined> = {
  PENDING_REVIEW: styles.pending,
  INVITED_APPROVED: styles.approved,
  REJECTED: styles.rejected,
  CANCELLED: styles.cancelled,
};

/** Columna 7: los tres niveles de `queueAgeLevel`, con sus colores. */
const AGE_CLASS: Record<QueueAgeLevel, string | undefined> = {
  normal: styles.ageNormal,
  warn: styles.ageWarn,
  alert: styles.ageAlert,
};

/**
 * El formato de fecha es SIEMPRE el de la capa de datos —aquí no se escribe
 * ninguna fecha a mano—, pero el instante se le pasa normalizado a su reloj UTC:
 * la cola del Operador se audita en UTC y así la misma solicitud no sale con una
 * hora distinta según la zona horaria de la máquina que la mira. En un entorno
 * en UTC el desplazamiento es cero.
 */
function utcClock(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + new Date(t).getTimezoneOffset() * 60_000).toISOString();
}

/**
 * Tabla de la cola de solicitudes de ADMIN-01.
 *
 * Presentacional: pinta las filas en el orden que recibe y no carga datos. El
 * estado vacío vive aquí dentro, porque "no hay filas" es un estado de la lista
 * y no de la pantalla.
 */
export function RequestsTable({ rows = [], now, selectedId, onSelect }: Props) {
  const nowValue = now ?? new Date();

  return (
    <div className={styles.tableOuter}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((label) => (
              <th key={label} scope="col" className={styles.th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className={`${styles.td} ${styles.emptyCell}`}>
                No hay solicitudes pendientes de revisión.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const level = queueAgeLevel(row.submittedAt, nowValue);
              const rowClass =
                row.id === selectedId ? `${styles.row} ${styles.rowSelected}` : styles.row;
              return (
                <tr key={row.id} className={rowClass}>
                  <td className={styles.td}>
                    {/*
                     * Se llama a `onSelect` CON LA FILA ENTERA, no con el id: la
                     * pantalla la guarda tal cual y así el panel sigue teniendo
                     * qué pintar cuando la fila desaparezca de la lista filtrada.
                     */}
                    <button
                      type="button"
                      className={styles.orgButton}
                      onClick={() => onSelect(row)}
                    >
                      {row.orgName}
                    </button>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.countryBadge}>{row.country}</span>
                  </td>
                  <td className={styles.td}>{row.email}</td>
                  <td className={styles.td}>{row.phone === '' ? '—' : row.phone}</td>
                  <td className={styles.td}>
                    {row.website === '' ? (
                      '—'
                    ) : (
                      <a
                        className={styles.extLink}
                        href={websiteHref(row.website)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.website}
                      </a>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.timestamp}>
                      {requestDateLabel(utcClock(row.submittedAt))}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.age} ${AGE_CLASS[level] ?? ''}`}>
                      {queueAgeLabel(row.submittedAt, nowValue)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.stateBadge} ${STATE_CLASS[row.state] ?? ''}`}>
                      {row.state}
                    </span>
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
