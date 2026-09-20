import {
  billingDateLabel,
  daysRemainingLabel,
  dueTone,
  type BillingRow,
  type BillingState,
  type DueTone,
} from '../../lib/admin-billing';
import styles from './BillingTable.module.css';

interface Props {
  rows: BillingRow[];
  selectedId: string | null;
  emptyMessage: string;
  onSelect: (row: BillingRow) => void;
  onMarkPaid: (row: BillingRow) => void;
  onReactivate: (row: BillingRow) => void;
}

/**
 * Las SIETE columnas de la spec §3, en su orden fijo e inamovible.
 *
 * Ninguna es ordenable: el orden por defecto («días restantes ascendente») ya lo
 * resuelve `fetchBillingOrgs`, así que aquí no hay `aria-sort` ni botón dentro de
 * un `<th>` — la cabecera es texto plano.
 */
const COLUMNS = ['Nombre', 'País', 'Estado', 'Último pago', 'Vencimiento', 'Días restantes', 'Acciones'];

/**
 * El valor es `string | undefined` a propósito: con `noUncheckedIndexedAccess`,
 * la declaración de los CSS Modules del repo es una firma de índice y cada
 * `styles.x` puede ser `undefined`. Se declara tal cual en vez de forzar un
 * `as string`, que sería mentir sobre lo que el tipo dice de verdad.
 */
const STATE_CLASS: Record<BillingState, string | undefined> = {
  ACTIVE: styles.stateActive,
  SUSPENDED: styles.stateSuspended,
  'EN PRUEBA': styles.stateTrial,
  'CANDIDATA A BORRADO': styles.stateCandidate,
};

const TONE_CLASS: Record<DueTone, string | undefined> = {
  danger: styles.toneDanger,
  warn: styles.toneWarn,
  normal: styles.toneNormal,
};

/**
 * Tabla de organizaciones de ADMIN-02.
 *
 * Presentacional: pinta las filas EN EL ORDEN QUE LAS RECIBE y no carga ni
 * reordena nada. La fila seleccionada se compara por `orgId`, nunca por posición
 * (F-179: el mock la sombreaba por índice y marcaba una fila que no era).
 *
 * `onSelect` recibe la fila ENTERA, no el id.
 */
export function BillingTable({ rows, selectedId, emptyMessage, onSelect, onMarkPaid, onReactivate }: Props) {
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
              <td colSpan={7} className={`${styles.td} ${styles.emptyCell}`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const tone = dueTone(row.daysRemaining);
              const toneClass = TONE_CLASS[tone];
              const selected = row.orgId === selectedId;

              return (
                <tr
                  key={row.orgId}
                  className={selected ? `${styles.row} ${styles.rowSelected}` : styles.row}
                  aria-current={selected ? 'true' : undefined}
                >
                  <td className={styles.td}>
                    <button type="button" className={styles.orgButton} onClick={() => onSelect(row)}>
                      {row.name}
                    </button>
                  </td>
                  <td className={styles.td}>
                    {/* Código ISO en mayúsculas, nunca `countryLabel`: columna 2 de la spec. */}
                    <span className={styles.countryBadge}>{row.country}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.stateBadge} ${STATE_CLASS[row.state]}`}>{row.state}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dateCell}>{billingDateLabel(row.lastPaymentDate)}</span>
                  </td>
                  <td className={`${styles.td} ${styles.dueCell} ${toneClass}`} data-tone={tone}>
                    {billingDateLabel(row.dueDate)}
                  </td>
                  <td className={`${styles.td} ${styles.dueCell} ${toneClass}`} data-tone={tone}>
                    {daysRemainingLabel(row.daysRemaining)}
                  </td>
                  <td className={styles.td}>
                    {row.state === 'SUSPENDED' ? (
                      <button
                        type="button"
                        className={styles.actionSecondary}
                        aria-label={`Reactivar — ${row.name}`}
                        onClick={() => onReactivate(row)}
                      >
                        Reactivar
                      </button>
                    ) : row.state === 'CANDIDATA A BORRADO' ? (
                      /*
                       * El borrado no existe en la base (0034, cabecera): el botón
                       * se pinta deshabilitado y no llama a nada.
                       */
                      <button
                        type="button"
                        className={styles.actionDanger}
                        aria-label={`Iniciar borrado — ${row.name}`}
                        title="El borrado de una organización todavía no está disponible."
                        disabled
                      >
                        Iniciar borrado
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.actionPrimary}
                        aria-label={`Marcar pago recibido — ${row.name}`}
                        onClick={() => onMarkPaid(row)}
                      >
                        Marcar pago recibido
                      </button>
                    )}
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
