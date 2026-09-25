import type { MemberProfile } from '../../lib/session';
import styles from './OrganizationProfile.module.css';

interface Props {
  profile: MemberProfile;
  /** La organización cuya ficha se abre. */
  organizationId: string;
  /** El breadcrumb `Empresas` vuelve al directorio. */
  onBack: () => void;
  /** `Contactar`, con un hilo ya existente, lo abre (MSG-02). */
  onOpenThread: (threadId: string) => void;
}

/**
 * MARCADOR de DIR-02 · Ficha Pública de Organización. La tarea del arnés
 * (`harness/tasks/DIR-02.json`) sustituye este fichero entero y su `.module.css`.
 * Existe para que `App.tsx` compile y el e2e tenga una ruta real que visitar
 * antes de la corrida (mismo patrón que `BatchSearch` en SRCH-02).
 */
export function OrganizationProfile({ organizationId }: Props) {
  return <div className={styles.placeholder} data-testid="dir02-placeholder" data-org={organizationId} />;
}
