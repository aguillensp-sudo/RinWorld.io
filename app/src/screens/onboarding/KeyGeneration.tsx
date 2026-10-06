import type { MemberProfile } from '../../lib/session';
import styles from './KeyGeneration.module.css';

interface Props {
  profile: MemberProfile;
}

/**
 * MARCADOR de REG-07 · Generación de claves y almacenamiento del backup. Se escribe A
 * MANO (criptografía, Plan §4.3), con ADR-001 y ADR-002 §10 delante. Existe para que el
 * `Continuar` de REG-06 lleve a algún sitio y el e2e de REG-06 pueda comprobar que se
 * avanza. No recibe la frase: la guarda el wiring en memoria hasta que exista REG-07.
 */
export function KeyGeneration({ profile }: Props) {
  return <div className={styles.placeholder} data-testid="reg07-placeholder" data-org={profile.orgId} />;
}
