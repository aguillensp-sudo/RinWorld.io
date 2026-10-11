import type { OfferRow } from '../../lib/negotiation-tables';
import styles from './OffersTable.module.css';

interface Props {
  /** Ya calculadas por `offerRows` (`lib/negotiation-tables.ts`), en el orden en que se pintan. */
  rows: OfferRow[];
  /** `Aceptar` y `Aceptar igualmente`. */
  onAccept: (offerId: string) => void;
  /** `Rechazar`. */
  onReject: (offerId: string) => void;
  /** `Contra-ofertar`: el wiring abre el formulario de contraoferta. */
  onCounter: (offerId: string) => void;
  /** El nombre de la organización lleva a su ficha (DIR-02). */
  onOpenOrganization: (orgId: string) => void;
}

/**
 * MARCADOR de MSG-03 · tabla de ofertas (v1.2). La tarea del arnés
 * (`harness/tasks/MSG-03.json`) sustituye este fichero y su `.module.css`. Existe para
 * que `ThreadHistory.tsx` compile antes de la corrida.
 */
export function OffersTable(props: Props) {
  return <div className={styles.placeholder} data-testid="msg03-offers-placeholder" data-rows={props.rows.length} />;
}
