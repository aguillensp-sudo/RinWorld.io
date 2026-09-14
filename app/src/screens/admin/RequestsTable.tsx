import {
  queueAgeLabel,
  queueAgeLevel,
  requestDateLabel,
  websiteHref,
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
 * Las OCHO columnas de la spec §3, en su orden fijo e inamovible.
 *
 * Ninguna es ordenable: a diferencia de DIR-01/SRCH-01, aquí el orden lo decide
 * la consulta («de más antigua a más reciente») y no hay `aria-sort` ni botón en
 * la cabecera. Son texto plano, y por eso no hay ningún `<button>` dentro de un
 * `<th>`.
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
];

/**
 * El valor es `string | undefined` a propósito: con `noUncheckedIndexedAccess`,
 * la declaración de los CSS Modules del repo es una firma de índice y cada
 * `styles.x` puede ser `undefined`. Se declara tal cual en vez de forzar un
 * `as string`, que sería mentir sobre lo que el tipo dice de verdad.
 */
const STATE_CLASS: Record<RequestState, string | undefined> = {
  PENDING_REVIEW: styles.statePending,
  INVITED_APPROVED: styles.stateApproved,
  REJECTED: styles.stateRejected,
  CANCELLED: styles.stateCancelled,
};

/**
 * Tabla de la cola de solicitudes de ADMIN-01.
 *
 * Presentacional: pinta las filas en el orden que recibe —el «más antigua
 * primero» ya lo resuelve `fetchRequests`— y no carga ni reordena nada. El
 * estado vacío vive aquí dentro porque «no hay filas» es un estado de la lista.
 *
 * `onSelect` recibe la fila ENTERA, no el id: la pantalla la guarda tal cual
 * para que el panel de detalle siga teniendo datos después de decidir, cuando la
 * fila ya no está en la lista filtrada.
 */
export function RequestsTable({ rows, now, selectedId, onSelect }: Props) {
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
              const ageClass =
                level === 'alert'
                  ? styles.ageAlert
                  : level === 'warn'
                    ? styles.ageWarn
                    : styles.ageNormal;

              return (
                <tr
                  key={row.id}
                  className={row.id === selectedId ? `${styles.row} ${styles.rowSelected}` : styles.row}
                >
                  <td className={styles.td}>
                    <button type="button" className={styles.orgButton} onClick={() => onSelect(row)}>
                      {row.orgName}
                    </button>
                  </td>
                  <td className={styles.td}>
                    {/* Código ISO, nunca el nombre del país: columna 2 de la spec. */}
                    <span className={styles.countryBadge}>{row.country}</span>
                  </td>
                  <td className={styles.td}>{row.email}</td>
                  <td className={styles.td}>{row.phone ? row.phone : '—'}</td>
                  <td className={styles.td}>
                    {row.website ? (
                      /*
                       * El `href` pasa por `websiteHref` porque el FSR admite el
                       * sitio sin esquema: sin él, `nordicbearings.se` sería una
                       * URL relativa a esta pantalla. El texto visible va SIN
                       * transformar: el esquema solo existe para el navegador.
                       */
                      <a
                        className={styles.webLink}
                        href={websiteHref(row.website)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.timestamp}>{requestDateLabel(row.submittedAt)}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={ageClass}>{queueAgeLabel(row.submittedAt, nowValue)}</span>
                  </td>
                  <td className={styles.td}>
                    {/* El literal del enum tal cual: la spec §3 lista los cuatro
                        (`PENDING_REVIEW`, `INVITED_APPROVED`, `REJECTED`,
                        `CANCELLED`), no una traducción. */}
                    <span className={`${styles.stateBadge} ${STATE_CLASS[row.state]}`}>{row.state}</span>
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
