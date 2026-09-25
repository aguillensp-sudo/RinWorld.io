import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  LIMIT_NOTICE,
  capacityDetail,
  capacityDots,
  capacityLabel,
  emailHasAccount,
  fetchInvitations,
  fetchTeam,
  inviteMember,
  isValidEmail,
  limitReached,
  removeMember,
  resendInvitation,
  type CapacityDot,
  type InvitationRow,
  type TeamMember,
} from '../../lib/invitations';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { InvitationTables } from './InvitationTables';
import { RemoveMemberDialog } from './RemoveMemberDialog';
import styles from './Invitations.module.css';

interface Props {
  profile: MemberProfile;
}

/** El acuse de una invitación es la INVITACIÓN REGISTRADA, no un correo enviado (F-212). */
const INVITE_REGISTERED =
  'Invitación registrada. El envío del correo de invitación llega con el flujo de registro por invitación.';
const EMAIL_TAKEN = 'Este email ya tiene cuenta en Bearingworld.io.';
const RESENT = 'Invitación reenviada.';

const DOT_USED_TITLE = 'Usuario activo';
const DOT_INV_TITLE = 'Invitación pendiente';
const DOT_FREE_TITLE = 'Plaza libre';

const NOT_ADMIN = 'Esta pantalla es solo para administradores.';
const LOADING = 'Cargando invitaciones…';

/** El resultado de la comprobación, JUNTO AL TEXTO al que corresponde. */
interface EmailCheck {
  email: string;
  hasAccount: boolean;
}

interface Feedback {
  kind: 'ok' | 'error';
  text: string;
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function dotClass(dot: CapacityDot): string {
  if (dot === 'used') return `${styles.dot} ${styles.dotUsed}`;
  if (dot === 'inv') return `${styles.dot} ${styles.dotInv}`;
  return `${styles.dot} ${styles.dotFree}`;
}

function dotTitle(dot: CapacityDot): string {
  if (dot === 'used') return DOT_USED_TITLE;
  if (dot === 'inv') return DOT_INV_TITLE;
  return DOT_FREE_TITLE;
}

/**
 * INVT-01 · Panel de Gestión de Invitaciones.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red.
 * `InvitationTables` y `RemoveMemberDialog` son presentacionales.
 *
 * Tres decisiones que no se leen en el JSX:
 *
 * - **Solo el ADMIN.** Los ganchos se declaran siempre (regla de los ganchos) y
 *   el efecto de carga sale por su cuenta si el rol no es `ADMIN`: así el
 *   `render` sin permiso no dispara ni una petición.
 * - **La comprobación del email guarda el TEXTO con el resultado.** Sin pareja
 *   `{email, hasAccount}` no se puede distinguir una respuesta buena de la de un
 *   texto que el usuario ya ha borrado; con ella, una respuesta tardía se
 *   descarta sola. Y un rechazo es «no se sabe»: no bloquea el envío, el
 *   servidor lo volverá a comprobar.
 * - **`busy` es una sola bandera** para reenviar y eliminar: mientras una está
 *   en vuelo, los botones de las dos tablas se deshabilitan.
 */
export function Invitations({ profile }: Props) {
  const isAdmin = profile.role === 'ADMIN';

  const [reloadKey, setReloadKey] = useState(0);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  /**
   * Las dos listas, en paralelo y en el mismo efecto. Si CUALQUIERA de las dos
   * rechaza, no se pinta ni una tabla: media verdad sobre quién ocupa plaza es
   * peor que ninguna. `cancelado` evita pintar respuestas de una carga vieja.
   */
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    Promise.all([fetchTeam(profile.orgId), fetchInvitations()])
      .then(([members, rows]) => {
        if (cancelled) return;
        setTeam(members);
        setInvitations(rows);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTeam([]);
        setInvitations([]);
        setLoadError(errorMessage(asError(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, profile.orgId, reloadKey]);

  /** Volver a leer las dos listas es como se refresca todo lo que se ve. */
  function reload() {
    setReloadKey((key) => key + 1);
  }

  /**
   * Sin debounce: cada texto válido consulta. La secuencia descarta lo tardío y
   * el texto sigue viajando con el resultado, que es lo que decide si se pinta.
   */
  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    setEmail(value);
    setFeedback(null);
    setCheck(null);

    if (!isValidEmail(value)) {
      checkSeq.current += 1;
      setChecking(false);
      return;
    }

    const seq = checkSeq.current + 1;
    checkSeq.current = seq;
    setChecking(true);

    emailHasAccount(value)
      .then((hasAccount) => {
        if (seq !== checkSeq.current) return;
        setCheck({ email: value, hasAccount });
      })
      .catch(() => {
        // «No se sabe» no es «sí»: el envío sigue disponible y decide el servidor.
        if (seq !== checkSeq.current) return;
        setCheck(null);
      })
      .finally(() => {
        if (seq === checkSeq.current) setChecking(false);
      });
  }

  const atLimit = limitReached(team, invitations);
  const alreadyHasAccount = check !== null && check.email === email && check.hasAccount;
  const canSubmit = isValidEmail(email) && !atLimit && !sending && !checking && !alreadyHasAccount;

  function handleSend() {
    if (!canSubmit) return;

    setSending(true);
    setFeedback(null);

    inviteMember(email)
      .then(() => {
        setEmail('');
        setCheck(null);
        setFeedback({ kind: 'ok', text: INVITE_REGISTERED });
        reload();
      })
      .catch((err: unknown) => {
        // El campo NO se vacía: lo escrito es lo que hay que corregir.
        setFeedback({ kind: 'error', text: errorMessage(asError(err)) });
      })
      .finally(() => {
        setSending(false);
      });
  }

  function handleResend(invitationId: string) {
    setBusy(true);
    setFeedback(null);

    resendInvitation(invitationId)
      .then(() => {
        setFeedback({ kind: 'ok', text: RESENT });
        reload();
      })
      .catch((err: unknown) => {
        setFeedback({ kind: 'error', text: errorMessage(asError(err)) });
      })
      .finally(() => {
        setBusy(false);
      });
  }

  /** Abrir el diálogo borra el error anterior: el que se ve es siempre el de este intento. */
  function handleRemove(member: TeamMember) {
    setRemoveError(null);
    setPendingRemove(member);
  }

  function handleCancelRemove() {
    setRemoveError(null);
    setPendingRemove(null);
  }

  function handleConfirmRemove() {
    if (pendingRemove === null) return;

    const member = pendingRemove;
    setBusy(true);
    setRemoveError(null);

    removeMember(member.id)
      .then(() => {
        setPendingRemove(null);
        reload();
      })
      .catch((err: unknown) => {
        // El diálogo SIGUE abierto con el motivo: cerrarlo parecería un éxito.
        setRemoveError(errorMessage(asError(err)));
      })
      .finally(() => {
        setBusy(false);
      });
  }

  if (!isAdmin) {
    return (
      <div className={styles.screen}>
        <p className={styles.alert}>{NOT_ADMIN}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.status} role="status">
          {LOADING}
        </p>
      </div>
    );
  }

  if (loadError !== null) {
    return (
      <div className={styles.screen}>
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>
      <h1 className={styles.title}>Gestión de invitaciones</h1>
      <p className={styles.subtitle}>Invita a los usuarios de tu organización. Cada nuevo usuario se incorporará con rol <strong>Editor</strong>. Límite: 5 usuarios por organización.</p>

      <div className={styles.capacityRow}>
        <div className={styles.dots} data-testid="capacity-dots">
          {capacityDots(team, invitations).map((dot, index) => (
            <span key={index} className={dotClass(dot)} title={dotTitle(dot)} />
          ))}
        </div>
        <span className={styles.count} data-testid="capacity-count">
          {capacityLabel(team)}
        </span>
        <span className={styles.detail} data-testid="capacity-detail">
          {capacityDetail(team, invitations)}
        </span>
      </div>

      {atLimit && (
        <p className={styles.notice} role="note">
          <svg
            className={styles.noticeIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{LIMIT_NOTICE}</span>
        </p>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Invitar nuevo usuario</h2>
        <div className={styles.inviteRow}>
          <div className={styles.field}>
            <input
              type="email"
              className={styles.input}
              aria-label="Email del nuevo usuario"
              placeholder="email@empresa.com"
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
              disabled={atLimit || sending}
            />
            {alreadyHasAccount && (
              <p className={styles.fieldError} role="alert">
                {EMAIL_TAKEN}
              </p>
            )}
            {feedback !== null && (
              <p
                className={feedback.kind === 'ok' ? styles.feedbackOk : styles.feedbackError}
                role={feedback.kind === 'ok' ? 'status' : 'alert'}
              >
                {feedback.text}
              </p>
            )}
          </div>
          <button type="button" className={styles.button} onClick={handleSend} disabled={!canSubmit}>
            Enviar invitación
          </button>
        </div>
      </div>

      <InvitationTables
        invitations={invitations}
        team={team}
        selfId={profile.id}
        busy={busy}
        onResend={handleResend}
        onRemove={handleRemove}
      />

      {pendingRemove !== null && (
        <RemoveMemberDialog
          member={pendingRemove}
          busy={busy}
          error={removeError}
          onConfirm={handleConfirmRemove}
          onCancel={handleCancelRemove}
        />
      )}
    </div>
  );
}
