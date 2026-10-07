import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  INVITATION_TEXTS as T,
  InvitationBlocked,
  acceptInvitation,
  expiryText,
  validateInvitationLink,
} from '../../lib/invitation-link';
import type { InvitationInfo } from '../../lib/invitation-link';
import { passwordStrength } from '../../lib/register-org';
import {
  NAME_HINT,
  PASSWORD_HINT,
  PASSWORD_MISMATCH,
  isValidName,
  isValidPassword,
} from '../../lib/onboarding';
import styles from './OrgRegistration.module.css';
import blocks from './InviteBlocks.module.css';

type Phase =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; info: InvitationInfo }
  | { kind: 'blocked'; info: InvitationInfo; status: 'EXPIRED' | 'EXISTS' | 'FULL' };

/**
 * INVT-02 — Aceptar invitación (Ruta 00.3, propuesta aprobada el 7-oct-2026).
 *
 * Pantalla completa SIN shell, igual que REG-01 (`F-226`): quien llega con el enlace
 * `#invitacion?token=…` no tiene sesión, y el shell y VERA solo responden con ella. El
 * maquetado de `openspec/v1/diseno/INVT-02` los dibuja; esta pantalla no, por el mismo
 * motivo que REG-01.
 *
 * El correo es el de la invitación y no se edita; el servidor tampoco acepta otro. Al
 * crear la cuenta se inicia sesión y la app entra en ACT-02 (la cuenta nace `REGISTERED`).
 * Los estados que no son el formulario salen de `status` (`0050`): caducada, correo ya
 * registrado, organización llena; y «no vale» (un solo mensaje para no existe, usada y
 * anulada).
 */
export function InvitationAcceptance({
  token,
  onAccepted,
  onBackToLogin,
  now,
}: {
  token: string;
  onAccepted: () => void;
  onBackToLogin: () => void;
  now?: Date;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState({ name: false, password: false, repeat: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    validateInvitationLink(token).then(
      (info) => {
        if (cancelled) return;
        setPhase(info.status === 'OK' ? { kind: 'ready', info } : { kind: 'blocked', info, status: info.status });
      },
      () => {
        if (!cancelled) setPhase({ kind: 'invalid' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <div className={styles.page}>
      <div className={styles.brandBar}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>
      <header className={styles.header}>
        <img className={styles.logo} src="/intentologo.png" alt="Bearingworld.io" />
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );

  if (phase.kind === 'loading') return shell(<div aria-busy="true" />);

  const toLogin = (label: string) => (
    <button type="button" className={blocks.ghost} onClick={onBackToLogin}>
      {label}
    </button>
  );

  if (phase.kind === 'invalid') {
    return shell(
      <div className={styles.card}>
        <h1 className={styles.title}>{T.invalid.title}</h1>
        <div className={blocks.banner} role="alert">
          <strong>{T.invalid.strong}</strong>
          {T.invalid.text}
        </div>
        {toLogin(T.toLogin)}
      </div>,
    );
  }

  if (phase.kind === 'blocked') {
    const { info, status } = phase;
    const { date } = expiryText(info.expiresAt, now);
    const copy =
      status === 'EXPIRED'
        ? { title: T.expired.title, strong: T.expired.strong, text: T.expired.text }
        : status === 'FULL'
          ? { title: T.full.title, strong: T.full.strong(info.orgName), text: T.full.text(date) }
          : { title: T.exists.title, strong: T.exists.strong(info.email), text: T.exists.text };
    return shell(
      <div className={styles.card}>
        <h1 className={styles.title}>{copy.title}</h1>
        <div className={`${blocks.banner} ${blocks.bannerWarn}`} role="alert">
          <strong>{copy.strong}</strong>
          {copy.text}
        </div>
        {status === 'EXISTS' ? (
          <button type="button" className={styles.submit} onClick={onBackToLogin}>
            {T.exists.action}
          </button>
        ) : (
          toLogin(T.toLogin)
        )}
      </div>,
    );
  }

  const { info } = phase;
  const expiry = expiryText(info.expiresAt, now);
  const strength = passwordStrength(password);
  const nameOk = isValidName(fullName);
  const passwordOk = isValidPassword(password);
  const repeatOk = repeat === password && repeat !== '';
  const canSubmit = nameOk && passwordOk && repeatOk && accepted;

  const fieldHint = (id: string, shown: boolean, error: string, hint: string) => (
    <span id={id} className={shown ? `${styles.hint} ${styles.hintError}` : styles.hint}>
      {shown ? error : hint}
    </span>
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await acceptInvitation(token, { fullName, password, email: info.email });
      onAccepted();
    } catch (error) {
      if (error instanceof InvitationBlocked) {
        setPhase({ kind: 'blocked', info, status: error.status });
      } else {
        setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
      }
      setSubmitting(false);
    }
  };

  return shell(
    <div className={styles.card}>
      <span className={styles.corner} aria-hidden="true" />
      <span className={styles.corner} aria-hidden="true" />
      <span className={styles.corner} aria-hidden="true" />
      <span className={styles.corner} aria-hidden="true" />

      <form noValidate onSubmit={handleSubmit}>
        <h1 className={styles.title}>{T.title}</h1>
        <p className={styles.subtitle}>
          {T.subtitleLine1}
          <br />
          {T.subtitleLine2}
        </p>

        <dl className={blocks.kv}>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowOrg}</dt>
            <dd className={blocks.kvValue}>{info.orgName}</dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowInviter}</dt>
            <dd className={blocks.kvValue}>
              {info.inviterName ?? T.inviterFallback} <small>· {T.inviterRole}</small>
            </dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowRole}</dt>
            <dd className={blocks.kvValue}>{T.roleName}</dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowEmail}</dt>
            <dd className={blocks.kvValue}>{info.email}</dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowExpires}</dt>
            <dd className={blocks.kvValue}>
              {expiry.date} <small>· {expiry.left}</small>
            </dd>
          </div>
        </dl>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>{T.section}</span>
        </div>

        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor="fullName">
              {T.fullNameLabel}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="fullName"
              className={touched.name && !nameOk ? `${styles.input} ${styles.inputError}` : styles.input}
              type="text"
              maxLength={100}
              placeholder={T.fullNamePlaceholder}
              value={fullName}
              aria-invalid={touched.name && !nameOk ? true : undefined}
              aria-describedby="fullName-hint"
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {fieldHint('fullName-hint', touched.name && !nameOk, NAME_HINT, T.fullNameHint)}
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor="email">
              {T.emailLabel}
            </label>
            <input id="email" className={`${styles.input} ${blocks.readonly}`} type="email" value={info.email} readOnly />
            <span className={styles.hint}>{T.emailHint}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              {T.passwordLabel}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="password"
              className={touched.password && !passwordOk ? `${styles.input} ${styles.inputError}` : styles.input}
              type="password"
              placeholder={T.passwordPlaceholder}
              value={password}
              aria-invalid={touched.password && !passwordOk ? true : undefined}
              aria-describedby="password-hint"
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            <div
              className={styles.meter}
              role="meter"
              aria-label="Fuerza de la contraseña"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={strength}
            >
              {[0, 1, 2, 3].map((index) => {
                const lit = index < strength;
                const className = lit
                  ? [styles.bar, styles.barOn, strength >= 4 ? styles.barHot : ''].filter(Boolean).join(' ')
                  : styles.bar;
                return <span key={index} className={className} />;
              })}
            </div>
            {fieldHint('password-hint', touched.password && !passwordOk, PASSWORD_HINT, T.passwordHint)}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="passwordRepeat">
              {T.repeatLabel}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="passwordRepeat"
              className={touched.repeat && !repeatOk ? `${styles.input} ${styles.inputError}` : styles.input}
              type="password"
              placeholder={T.repeatPlaceholder}
              value={repeat}
              aria-invalid={touched.repeat && !repeatOk ? true : undefined}
              aria-describedby="passwordRepeat-hint"
              onChange={(e) => setRepeat(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, repeat: true }))}
            />
            {fieldHint('passwordRepeat-hint', touched.repeat && !repeatOk, PASSWORD_MISMATCH, T.repeatHint)}
          </div>

          <label className={styles.terms}>
            <input
              className={styles.termsInput}
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className={styles.termsText}>
              {T.termsBefore}
              <strong>{T.termsLink}</strong>
              {T.termsAfter}
            </span>
          </label>
        </div>

        <p className={blocks.notice}>{T.notice}</p>

        {submitError !== null && (
          <p className={styles.alert} role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={!canSubmit || submitting}>
          {submitting ? T.submitting : T.submit}
        </button>
      </form>
    </div>,
  );
}
