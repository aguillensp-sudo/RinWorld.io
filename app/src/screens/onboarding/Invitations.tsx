import type { MemberProfile } from '../../lib/session';
import styles from './Invitations.module.css';

interface Props {
  profile: MemberProfile;
}

/**
 * MARCADOR de INVT-01 · Panel de Gestión de Invitaciones. La tarea del arnés
 * (`harness/tasks/INVT-01.json`) sustituye este fichero entero, sus dos
 * componentes hermanos y los tres `.module.css`. Existe para que `App.tsx`
 * compile y el e2e tenga una ruta real que visitar antes de la corrida.
 */
export function Invitations({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="invt01-placeholder" data-org={profile.orgId} />;
}
