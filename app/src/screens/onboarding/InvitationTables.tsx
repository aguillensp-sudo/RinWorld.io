import type { InvitationRow, TeamMember } from '../../lib/invitations';
import styles from './InvitationTables.module.css';

interface Props {
  invitations: InvitationRow[];
  team: TeamMember[];
  /** El miembro que mira: su fila no lleva `Eliminar`. */
  selfId: string;
  /** Hay una petición en vuelo: las acciones se deshabilitan. */
  busy: boolean;
  onResend: (invitationId: string) => void;
  onRemove: (member: TeamMember) => void;
}

/** MARCADOR de las dos tablas de INVT-01; lo sustituye la corrida del arnés. */
export function InvitationTables({ invitations, team }: Props) {
  return (
    <div className={styles.placeholder} data-testid="invt01-tables-placeholder" data-n={invitations.length + team.length} />
  );
}
