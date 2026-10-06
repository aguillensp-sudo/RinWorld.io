import type { MemberProfile } from '../../lib/session';
import styles from './BackupPassphrase.module.css';

interface Props {
  profile: MemberProfile;
  /** `Continuar`: entrega la frase al wiring (en memoria), que pasa a REG-07. */
  onContinue: (passphrase: string) => void;
}

/**
 * MARCADOR de REG-06 · Establecer la frase de seguridad. La tarea del arnés
 * (`harness/tasks/REG-06.json`) sustituye este fichero y su `.module.css`. Existe para
 * que `App.tsx` compile y el e2e tenga una ruta real que visitar antes de la corrida.
 */
export function BackupPassphrase({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="reg06-placeholder" data-org={profile.orgId} />;
}
