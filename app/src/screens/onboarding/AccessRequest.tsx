import type { SubmittedAccessRequest } from '../../lib/access-request';
import styles from './AccessRequest.module.css';

interface Props {
  /** La solicitud se guardó: el wiring la persiste y abre REG-00-WAIT. */
  onSubmitted: (request: SubmittedAccessRequest) => void;
  /** `¿Tienes un enlace de invitación? Accede directamente →`: el wiring vuelve al login. */
  onHaveInvitation: () => void;
}

/**
 * MARCADOR de REG-00 · FSR. La tarea del arnés (`harness/tasks/REG-00.json`)
 * sustituye este fichero y su `.module.css`. Existe para que `App.tsx` compile y el
 * e2e tenga una ruta real que visitar antes de la corrida.
 */
export function AccessRequest(_props: Props) {
  return <div className={styles.placeholder} data-testid="reg00-placeholder" />;
}
