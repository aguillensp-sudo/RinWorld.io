import type { MemberProfile } from '../../lib/session';
import styles from './AdditionalUser.module.css';

interface Props {
  profile: MemberProfile;
  /** `Ir al panel` tras un alta: activa la cuenta y recarga la sesión. Puede rechazar. */
  onGoToPanel: () => Promise<void>;
}

/**
 * MARCADOR de FRU · Registro de usuario adicional. La tarea del arnés
 * (`harness/tasks/FRU.json`) sustituye este fichero y su `.module.css`. Existe para
 * que `App.tsx` compile y el e2e tenga una ruta real que visitar antes de la corrida.
 */
export function AdditionalUser({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="fru-placeholder" data-org={profile.orgId} />;
}
