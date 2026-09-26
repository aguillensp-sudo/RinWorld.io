import type { MemberProfile } from '../../lib/session';
import styles from './Welcome.module.css';

interface Props {
  profile: MemberProfile;
  /** `Sí, añadir un usuario ahora`: el wiring abre FRU. */
  onAddUser: () => void;
  /** `Ir al panel`: activa la cuenta (`activate_own_membership`) y recarga la sesión. Puede rechazar. */
  onGoToPanel: () => Promise<void>;
}

/**
 * MARCADOR de REG-09 · Bienvenida. La tarea del arnés (`harness/tasks/REG-09.json`)
 * sustituye este fichero y su `.module.css`. Existe para que `App.tsx` compile y el
 * e2e tenga una ruta real que visitar antes de la corrida.
 */
export function Welcome({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="reg09-placeholder" data-org={profile.orgId} />;
}
