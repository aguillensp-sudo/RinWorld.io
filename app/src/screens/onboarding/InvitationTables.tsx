import {
  CANNOT_REMOVE_OWN_ADMIN,
  canRemove,
  expiresInLabel,
  memberStateLabel,
  roleLabel,
  sentAtLabel,
  type InvitationRow,
  type InvitationStatus,
  type TeamMember,
} from '../../lib/invitations';
import styles from './InvitationTables.module.css';

interface Props {
  invitations: InvitationRow[];
  team: TeamMember[];
  selfId: string;
  busy: boolean;
  onResend: (invitationId: string) => void;
  onRemove: (member: TeamMember) => void;
}

/** El otro motivo del guion: el rol que no se puede eliminar (spec, HTML aprobado). */
const CANNOT_REMOVE_ROLE = 'Solo se pueden eliminar usuarios con rol Editor';

const EMPTY_INVITATIONS = 'Todavía no has enviado ninguna invitación.';

/**
 * Las dos tablas de INVT-01. Presentacional: no llama a la red y no guarda
 * estado. Decide a quién le toca botón y a quién le toca guion con las funciones
 * puras de la capa de datos — `canRemove` sobre todo, para que la fila del propio
 * ADMIN y la del que no es Editor se expliquen solas.
 */
export function InvitationTables({ invitations, team, selfId, busy, onResend, onRemove }: Props) {
  return (
    <>
      <section>
        <h2 className={styles.sectionTitle}>Invitaciones enviadas</h2>
        <div className={styles.wrap}>
          <table className={styles.table} aria-label="Invitaciones enviadas">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>
                  Email
                </th>
                <th scope="col" className={styles.th}>
                  Estado
                </th>
                <th scope="col" className={styles.th}>
                  Fecha de envío
                </th>
                <th scope="col" className={styles.th}>
                  Expira en
                </th>
                <th scope="col" className={styles.th}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={5}>
                    {EMPTY_INVITATIONS}
                  </td>
                </tr>
              ) : (
                invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className={`${styles.td} ${styles.mono}`}>{invitation.email}</td>
                    <td className={styles.td}>
                      <span className={statusClass(invitation.status)}>{invitation.status}</span>
                    </td>
                    <td className={`${styles.td} ${styles.mono}`}>{sentAtLabel(invitation.sentAt)}</td>
                    <td className={expiresClass(invitation.status)}>{expiresInLabel(invitation.daysLeft)}</td>
                    <td className={styles.td}>
                      {invitation.status === 'Expirada' ? (
                        <button
                          type="button"
                          className={styles.actionButton}
                          aria-label={`Reenviar ${invitation.email}`}
                          disabled={busy}
                          onClick={() => onResend(invitation.id)}
                        >
                          Reenviar
                        </button>
                      ) : (
                        <span className={styles.none}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Usuarios activos</h2>
        <div className={styles.wrap}>
          <table className={styles.table} aria-label="Usuarios activos">
            <thead>
              <tr>
                <th scope="col" className={styles.th}>
                  Nombre
                </th>
                <th scope="col" className={styles.th}>
                  Email
                </th>
                <th scope="col" className={styles.th}>
                  Rol
                </th>
                <th scope="col" className={styles.th}>
                  Estado
                </th>
                <th scope="col" className={styles.th}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <td className={styles.td}>{member.fullName}</td>
                  <td className={`${styles.td} ${styles.mono}`}>{member.email}</td>
                  <td className={styles.td}>
                    <span className={roleClass(member.role)}>{roleLabel(member.role)}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={stateClass(member.state)}>{memberStateLabel(member.state)}</span>
                  </td>
                  <td className={styles.td}>
                    {canRemove(member, selfId) ? (
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionDanger}`}
                        aria-label={`Eliminar ${member.fullName}`}
                        disabled={busy}
                        onClick={() => onRemove(member)}
                      >
                        Eliminar
                      </button>
                    ) : (
                      <span
                        className={styles.none}
                        title={member.id === selfId ? CANNOT_REMOVE_OWN_ADMIN : CANNOT_REMOVE_ROLE}
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function statusClass(status: InvitationStatus): string {
  if (status === 'Aceptada') return `${styles.badge} ${styles.badgeAccepted}`;
  if (status === 'Expirada') return `${styles.badge} ${styles.badgeExpired}`;
  return `${styles.badge} ${styles.badgePending}`;
}

/** El plazo en brass SOLO en las pendientes: en las demás la celda es un guion. */
function expiresClass(status: InvitationStatus): string {
  const base = `${styles.td} ${styles.mono}`;
  return status === 'Pendiente' ? `${base} ${styles.expiresPending}` : base;
}

function roleClass(role: TeamMember['role']): string {
  return role === 'ADMIN' ? `${styles.badge} ${styles.badgeAdmin}` : `${styles.badge} ${styles.badgeEditor}`;
}

function stateClass(state: string): string {
  if (state === 'ACTIVE') return `${styles.badge} ${styles.badgeActive}`;
  if (state === 'SUSPENDED') return `${styles.badge} ${styles.badgeSuspended}`;
  return `${styles.badge} ${styles.badgeNeutral}`;
}
