import type { InquiryRow } from '../../lib/negotiation-tables';
import styles from './InquiriesTable.module.css';

interface Props {
  /** Ya calculadas por `inquiryRows` (`lib/negotiation-tables.ts`), en el orden en que se pintan. */
  rows: InquiryRow[];
  /** `Responder con oferta`: el wiring abre el formulario de oferta. */
  onRespond: (inquiryId: string) => void;
  /** `Sin stock`. */
  onOutOfStock: (inquiryId: string) => void;
  /** El nombre de la organización lleva a su ficha (DIR-02). */
  onOpenOrganization: (orgId: string) => void;
}

/**
 * MARCADOR de MSG-03 · tabla de consultas (v1.2). La tarea del arnés
 * (`harness/tasks/MSG-03.json`) sustituye este fichero y su `.module.css`. Existe para
 * que `ThreadHistory.tsx` compile antes de la corrida.
 */
export function InquiriesTable(props: Props) {
  return <div className={styles.placeholder} data-testid="msg03-inquiries-placeholder" data-rows={props.rows.length} />;
}
