import type { TeamMember } from '../../lib/invitations';
import styles from './RemoveMemberDialog.module.css';

interface Props {
  member: TeamMember;
  /** La eliminación está en vuelo: los botones se deshabilitan. */
  busy: boolean;
  /** El motivo si el servidor la rechazó; `null` si no. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** MARCADOR de la confirmación de INVT-01; lo sustituye la corrida del arnés. */
export function RemoveMemberDialog({ member }: Props) {
  return <div className={styles.placeholder} data-testid="invt01-dialog-placeholder" data-member={member.id} />;
}
