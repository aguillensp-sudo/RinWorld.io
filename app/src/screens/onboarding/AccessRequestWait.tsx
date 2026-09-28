import type { SubmittedAccessRequest } from '../../lib/access-request';
import styles from './AccessRequestWait.module.css';

interface Props {
  /** Lo que REG-00 envió: el token (`id`) y los datos guardados. */
  request: SubmittedAccessRequest;
  /** `Cerrar y esperar el email`: el wiring borra la solicitud de la sesión y vuelve al login. */
  onClose: () => void;
}

/**
 * MARCADOR de REG-00-WAIT · Espera de aprobación. La tarea del arnés
 * (`harness/tasks/REG-00-WAIT.json`) sustituye este fichero y su `.module.css`.
 * Existe para que `App.tsx` compile y el e2e tenga una ruta real que visitar.
 */
export function AccessRequestWait({ request }: Props) {
  return <div className={styles.placeholder} data-testid="reg00wait-placeholder" data-request={request.id} />;
}
