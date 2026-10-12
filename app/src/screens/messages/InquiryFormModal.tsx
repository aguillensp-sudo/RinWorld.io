import { useEffect, type ComponentProps } from 'react';
import { INQUIRY_FORM_TEXTS, inquiryProgress } from '../../lib/inquiry-form';
import { InquiryForm } from './InquiryForm';
import styles from './InquiryFormModal.module.css';

type FormProps = ComponentProps<typeof InquiryForm>;

interface Props extends FormProps {
  /** Posición en la cola de formularios (uno por fila de SRCH-01, F-249). */
  index: number;
  total: number;
}

/**
 * MSG-03 §2: «el formulario de creación se abre como panel lateral o modal». Contenedor a mano del
 * `InquiryForm` que escribió el Coder: el diálogo, el contador de la cola y el scroll propio. El
 * formulario no sabe que está en un modal.
 *
 * `Escape` equivale a `Cancelar`. El `key` por fila lo pone quien lo monta, para que cada formulario
 * de la cola arranque vacío.
 */
export function InquiryFormModal({ index, total, ...form }: Props) {
  const { onCancel } = form;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const progress = inquiryProgress(index, total);
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={INQUIRY_FORM_TEXTS.title}>
        {progress !== null && <p className={styles.progress}>{progress}</p>}
        <InquiryForm {...form} />
      </div>
    </div>
  );
}
