import type { MemberProfile } from '../../lib/session';
import styles from './BackupPassphrase.module.css';

interface Props {
  profile: MemberProfile;
}

/**
 * MARCADOR de REG-06 · Establecer la frase de seguridad. Lo sustituirá su propia
 * tarea del arnés, que fijará su API definitiva. Existe para que el botón de REG-05
 * lleve a algún sitio y el e2e de REG-05 pueda comprobar que se avanza.
 */
export function BackupPassphrase({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="reg06-placeholder" data-org={profile.orgId} />;
}
