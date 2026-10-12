import type { InquiryDraft } from '../../lib/inquiry-form';
import styles from './InquiryForm.module.css';

interface Props {
  /** `part_number` heredado de la búsqueda (solo lectura). */
  reference: string;
  brand: string;
  /** Nombre del país del distribuidor, ya formateado. */
  country: string;
  /** Ya hay una consulta pendiente sobre esta línea: el envío se bloquea con el aviso de la spec §6. */
  duplicate: boolean;
  /** Hay un envío en curso. */
  busy: boolean;
  /** Fallo del último envío; `null` si no lo hay. */
  error: string | null;
  onSubmit: (draft: InquiryDraft) => void;
  onCancel: () => void;
}

/**
 * MARCADOR de MSG-03 · formulario de consulta (§3.2). La tarea del arnés
 * (`harness/tasks/MSG-03-FORM.json`) sustituye este fichero y su `.module.css`. Existe para que el
 * contrato compile antes de la corrida.
 */
export function InquiryForm(props: Props) {
  return <div className={styles.placeholder} data-testid="msg03-form-placeholder" data-reference={props.reference} />;
}
