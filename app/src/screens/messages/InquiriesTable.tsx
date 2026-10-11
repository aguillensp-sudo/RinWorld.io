import { useId } from 'react';
import { NEGOTIATION_TEXTS, type InquiryRow } from '../../lib/negotiation-tables';
import styles from './InquiriesTable.module.css';

const T = NEGOTIATION_TEXTS;

/**
 * Un tono de badge por estado de consulta (spec §3.1). Un `Record` plano, no un
 * `Record<BadgeTone, …>`: la tabla de consultas solo usa tres de los siete tonos
 * del vocabulario compartido y una clave de más no debe obligar a inventarse una
 * clase para un estado que aquí nunca llega.
 */
const TONE_CLASS: Record<string, string | undefined> = {
  pendiente: styles.tonePendiente,
  respondida: styles.toneRespondida,
  'sin-stock': styles.toneSinStock,
};

/** Icono de edificio del botón de organización. En línea, `aria-hidden`. */
function BuildingIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18" />
      <path d="M5 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" />
      <path d="M13 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
      <path d="M8 9h1M8 13h1M8 17h1M16 13h1M16 17h1" />
    </svg>
  );
}

interface InquiriesTableProps {
  rows: InquiryRow[];
  onRespond: (inquiryId: string) => void;
  onOutOfStock: (inquiryId: string) => void;
  onOpenOrganization: (orgId: string) => void;
}

/**
 * MSG-03 v1.2 · Tabla de Consultas.
 *
 * Presentacional: recibe las filas ya calculadas por `lib/negotiation-tables.ts`
 * (textos, orden, badges, acciones y formatos vienen decididos de allí) y solo
 * pinta. No calcula nada, no ordena, no filtra y no tiene estado propio.
 */
export function InquiriesTable({
  rows,
  onRespond,
  onOutOfStock,
  onOpenOrganization,
}: InquiriesTableProps) {
  const id = useId();

  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {T.inquiriesTitle}
      </h2>
      <div className={styles.wrap}>
        <table className={styles.table} aria-label={T.inquiriesTitle}>
          <thead>
            <tr>
              {T.inquiryHeaders.map((header) => (
                <th key={header} scope="col" className={styles.th}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid="inquiry-row" data-row-id={row.id}>
                <td className={styles.td}>
                  <span className={styles.ref}>{row.reference}</span>
                </td>
                <td className={styles.td}>
                  <button
                    type="button"
                    className={styles.org}
                    onClick={() => onOpenOrganization(row.orgId)}
                  >
                    <BuildingIcon />
                    {row.orgName}
                  </button>
                </td>
                <td className={styles.td}>{row.country}</td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  {row.quantity}
                </td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  <span className={styles.meta}>{row.notes}</span>
                </td>
                <td className={styles.td}>
                  <span
                    data-testid="badge"
                    data-tone={row.badge.tone}
                    className={`${styles.badge ?? ''} ${TONE_CLASS[row.badge.tone] ?? ''}`.trim()}
                  >
                    {row.badge.label}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={styles.meta}>{row.date}</span>
                </td>
                <td className={styles.td}>
                  {row.actions.length === 0 ? (
                    T.none
                  ) : (
                    <div className={styles.actions}>
                      {row.actions.map((action) =>
                        action === 'responder' ? (
                          <button
                            key={action}
                            type="button"
                            className={styles.primary}
                            onClick={() => onRespond(row.id)}
                          >
                            {T.respond}
                          </button>
                        ) : (
                          <button
                            key={action}
                            type="button"
                            className={styles.secondary}
                            onClick={() => onOutOfStock(row.id)}
                          >
                            {T.outOfStock}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
