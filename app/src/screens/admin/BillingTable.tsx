import {
  billingDateLabel,
  daysRemainingLabel,
  dueTone,
  type BillingRow,
  type BillingState,
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
 * Las SIETE columnas de la spec §3, en orden fijo e inamovible. Ninguna es
 * ordenable: el orden («días restantes ascendente») lo resuelve `fetchBillingOrgs`
 * y aquí no hay `aria-sort` ni botón en la cabecera. Son texto plano.
 */
const COLUMNS = [
  'Nombre',
  'País',
  'Estado',
  'Último pago',
  'Vencimiento',
  'Días restantes',
  'Acciones',
];

/**
 * El valor es `string | undefined` a propósito: con `noUncheckedIndexedAccess`,
 * la declaración de los CSS Modules del repo es una firma de índice y cada
 * `styles.x` puede ser `undefined`.
 */
const STATE_CLASS: Record<BillingState, string | undefined> = {
  ACTIVE: styles.stateActive,
  SUSPENDED: styles.stateSuspended,
  'EN PRUEBA': styles.stateTrial,
  'CANDIDATA A BORRADO': styles.stateCandidate,
};

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Tabla principal de ADMIN-02.
 *
 * Presentacional: pinta las filas EN EL ORDEN QUE LAS RECIBE —el «días
 * restantes ascendente» ya lo resuelve la capa de datos— y no carga ni
 * reordena nada. El estado vacío vive aquí dentro porque «no hay filas» es un
 * estado de la lista, y las siete cabeceras siguen pintadas.
 */
export function BillingTable({
  rows,
  selectedId,
  emptyMessage,
  onSelect,
  onMarkPaid,
  onReactivate,
}: Props) {
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
              const toneClass =
                tone === 'danger'
                  ? styles.toneDanger
                  : tone === 'warn'
                    ? styles.toneWarn
                    : undefined;
              const selected = row.orgId === selectedId;

              return (
                <tr
                  key={row.orgId}
                  className={selected ? `${styles.row} ${styles.rowSelected}` : styles.row}
                  aria-current={selected ? 'true' : undefined}
                >
                  <td className={styles.td}>
                    <button
                      type="button"
                      className={styles.orgButton}
                      onClick={() => onSelect(row)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className={styles.td}>
                    {/* Código ISO, nunca `countryLabel`: columna 2 de la spec. */}
                    <span className={styles.countryBadge}>{row.country}</span>
                  </td>
                  <td className={styles.td}>
                    {/* El literal del enum tal cual: la spec §3 lista los cuatro. */}
                    <span className={cx(styles.stateBadge, STATE_CLASS[row.state])}>
                      {row.state}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.mono}>{billingDateLabel(row.lastPaymentDate)}</span>
                  </td>
                  <td className={styles.td} data-tone={tone}>
                    <span className={cx(styles.mono, toneClass)}>
                      {billingDateLabel(row.dueDate)}
                    </span>
                  </td>
                  <td className={styles.td} data-tone={tone}>
                    <span className={cx(styles.days, toneClass)}>
                      {daysRemainingLabel(row.daysRemaining)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actions}>
                      {row.state === 'ACTIVE' || row.state === 'EN PRUEBA' ? (
                        <button
                          type="button"
                          className={styles.btnPay}
                          aria-label={`Marcar pago recibido — ${row.name}`}
                          onClick={() => onMarkPaid(row)}
                        >
                          Marcar pago recibido
                        </button>
                      ) : null}
                      {row.state === 'SUSPENDED' ? (
                        <button
                          type="button"
                          className={styles.btnReactivate}
                          aria-label={`Reactivar — ${row.name}`}
                          onClick={() => onReactivate(row)}
                        >
                          Reactivar
                        </button>
                      ) : null}
                      {row.state === 'CANDIDATA A BORRADO' ? (
                        // El borrado no existe: deshabilitado, sin modal.
                        <button
                          type="button"
                          className={styles.btnDelete}
                          aria-label={`Iniciar borrado — ${row.name}`}
                          disabled
                        >
                          Iniciar borrado
                        </button>
                      ) : null}
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
