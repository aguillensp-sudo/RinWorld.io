import { Fragment, useId } from 'react';
import { NEGOTIATION_TEXTS, type OfferRow } from '../../lib/negotiation-tables';
import styles from './OffersTable.module.css';

const T = NEGOTIATION_TEXTS;

/**
 * Un tono de badge por estado de oferta (spec §4.1) más `superada`, que es un
 * estado real de `estado_oferta` aunque la spec no le dé badge propio.
 */
const TONE_CLASS: Record<string, string | undefined> = {
  pendiente: styles.tonePendiente,
  aceptada: styles.toneAceptada,
  rechazada: styles.toneRechazada,
  superada: styles.toneSuperada,
  expirada: styles.toneExpirada,
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

/**
 * Aviso de oferta expirada: el icono de advertencia con el texto de
 * `NEGOTIATION_TEXTS.expiredWarning` como nombre accesible. No es una frase
 * visible — la celda no da para el párrafo entero y el aviso largo se lee, no se
 * amontona en la tabla.
 */
function ExpiredWarning() {
  return (
    <span role="img" aria-label={T.expiredWarning} className={styles.warning}>
      <svg
        aria-hidden="true"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    </span>
  );
}

interface OffersTableProps {
  rows: OfferRow[];
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onCounter: (offerId: string) => void;
  onOpenOrganization: (orgId: string) => void;
}

/**
 * MSG-03 v1.2 · Tabla de Ofertas.
 *
 * Presentacional: recibe las filas ya calculadas por `lib/negotiation-tables.ts`
 * (textos, orden, badges, acciones, formatos y el motivo de contraoferta
 * deshabilitada vienen decididos de allí) y solo pinta. No calcula nada, no
 * ordena, no filtra y no tiene estado propio.
 */
export function OffersTable({
  rows,
  onAccept,
  onReject,
  onCounter,
  onOpenOrganization,
}: OffersTableProps) {
  const id = useId();

  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {T.offersTitle}
      </h2>
      <div className={styles.wrap}>
        <table className={styles.table} aria-label={T.offersTitle}>
          <thead>
            <tr>
              {T.offerHeaders.map((header) => (
                <th key={header} scope="col" className={styles.th}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid="offer-row"
                data-row-id={row.id}
                data-expired={String(row.expired)}
                className={row.expired ? (styles.rowExpired ?? '') : undefined}
              >
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
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  <span data-testid="price" className={styles.price}>
                    {row.price}
                  </span>
                </td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  {row.quantity}
                </td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  {row.leadTime}
                </td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  {row.shipping}
                </td>
                <td className={styles.td} title={row.encrypted ? T.encryptedNotice : undefined}>
                  {row.expired ? (
                    <span data-testid="valid-until-expired" className={styles.expiredDate}>
                      {row.validUntil}
                    </span>
                  ) : (
                    row.validUntil
                  )}
                </td>
                <td className={styles.td}>
                  <span
                    data-testid="badge"
                    data-tone={row.badge.tone}
                    className={`${styles.badge ?? ''} ${TONE_CLASS[row.badge.tone] ?? ''}`.trim()}
                  >
                    {row.badge.label}
                  </span>
                  {row.expired && <ExpiredWarning />}
                </td>
                <td className={styles.td}>
                  <span className={styles.meta}>{row.date}</span>
                </td>
                <td className={styles.td}>
                  {row.actions.length === 0 ? (
                    T.none
                  ) : (
                    <div className={styles.actions}>
                      {row.actions.map((action) => {
                        if (action === 'aceptar') {
                          return (
                            <button
                              key={action}
                              type="button"
                              className={styles.primary}
                              onClick={() => onAccept(row.id)}
                            >
                              {T.accept}
                            </button>
                          );
                        }
                        if (action === 'aceptar-igualmente') {
                          return (
                            <button
                              key={action}
                              type="button"
                              className={styles.primary}
                              onClick={() => onAccept(row.id)}
                            >
                              {T.acceptAnyway}
                            </button>
                          );
                        }
                        if (action === 'contraofertar') {
                          return (
                            <Fragment key={action}>
                              <button
                                type="button"
                                className={styles.secondary}
                                onClick={() => onCounter(row.id)}
                                disabled={row.counterDisabledReason !== null}
                              >
                                {T.counter}
                              </button>
                              {row.counterDisabledReason !== null && (
                                <span className={styles.reason}>{row.counterDisabledReason}</span>
                              )}
                            </Fragment>
                          );
                        }
                        return (
                          <button
                            key={action}
                            type="button"
                            className={styles.danger}
                            onClick={() => onReject(row.id)}
                          >
                            {T.reject}
                          </button>
                        );
                      })}
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
