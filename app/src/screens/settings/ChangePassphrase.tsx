import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import type { MemberProfile } from '../../lib/session';
import { CHANGE_PASSPHRASE_TEXTS as T, changeBackupPassphrase } from '../../lib/key-recovery';
import { checkPassphrase, passphraseView } from '../../lib/passphrase';
import type { PassphraseCheck } from '../../lib/passphrase';

import styles from './ChangePassphrase.module.css';

interface Props {
  /** El miembro: su id es la AAD del backup y sus datos penalizan la frase nueva. */
  profile: MemberProfile;
}

type Notice = { kind: 'error' | 'success'; text: string } | null;

function LockIcon() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/**
 * SET-SEC-01 · Cambiar backup passphrase. Escrita a mano (criptografía, Plan §4.3).
 *
 * Tres campos: la frase actual, la nueva y su repetición. La nueva sigue la política de
 * REG-06 (zxcvbn ≥ 3, 12 caracteres, distinta de la contraseña de acceso) y se mide con
 * el mismo `passphraseView`. Al guardar, `changeBackupPassphrase` abre el backup con la
 * actual, re-cifra LA MISMA privada con la nueva y sustituye el del servidor (0049):
 * la clave pública no cambia, así que nada de lo cifrado se pierde.
 *
 * **Las frases no salen de la pestaña** y no se pintan. Verificar la actual cuenta un
 * intento del límite de REC-01 (5 y media hora): es el mismo backup y el mismo guardián.
 * VERA, sin mensaje guionizado (`CLAUDE.md` §7).
 */
export function ChangePassphrase({ profile }: Props) {
  const [current, setCurrent] = useState('');
  const [fresh, setFresh] = useState('');
  const [repeat, setRepeat] = useState('');
  const [check, setCheck] = useState<PassphraseCheck | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  /** La última frase nueva tecleada: descarta la medida de una pulsación anterior. */
  const latest = useRef('');

  const view = passphraseView({ passphrase: fresh, repeat, acknowledged: true }, check);
  const strength = view.strength;
  const canSave = current !== '' && view.canContinue && !busy;

  function handleFreshChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    latest.current = value;
    setFresh(value);
    setNotice(null);
    checkPassphrase(profile.email, value, [profile.fullName ?? '', profile.orgName])
      .then((result) => {
        if (result.passphrase === latest.current) setCheck(result);
      })
      .catch(() => {
        // Medida local que no ha llegado: sin barra y con el botón bloqueado.
      });
  }

  function reset() {
    setCurrent('');
    setFresh('');
    setRepeat('');
    setCheck(null);
    latest.current = '';
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await changeBackupPassphrase(current, fresh, profile.id);
      if (outcome.kind === 'changed') {
        reset();
        setNotice({ kind: 'success', text: T.done });
      } else if (outcome.kind === 'locked' || outcome.lockedSeconds > 0) {
        const seconds = outcome.kind === 'locked' ? outcome.secondsLeft : outcome.lockedSeconds;
        setCurrent('');
        setNotice({ kind: 'error', text: T.locked(Math.max(1, Math.ceil(seconds / 60))) });
      } else {
        setCurrent('');
        setNotice({ kind: 'error', text: T.wrongCurrent });
      }
    } catch {
      setNotice({ kind: 'error', text: T.connection });
    } finally {
      setBusy(false);
    }
  }

  const freshClass = view.passphraseError ? styles.inputError : view.passphraseOk ? styles.inputOk : '';
  const repeatClass = view.repeatError ? styles.inputError : view.repeatOk ? styles.inputOk : '';

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <p className={styles.eyebrow}>{T.eyebrow}</p>
        <h1 className={styles.title}>{T.title}</h1>
        <p className={styles.subtitle}>{T.subtitle}</p>

        <p className={styles.e2eeTag}>
          <LockIcon />
          {T.tag}
        </p>

        {notice?.kind === 'error' && (
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <span className={styles.noticeIcon}>
              <WarningIcon />
            </span>
            <p>{notice.text}</p>
          </div>
        )}
        {notice?.kind === 'success' && (
          <p className={styles.success} role="status">
            <span className={styles.successIcon}>
              <SuccessIcon />
            </span>
            {notice.text}
          </p>
        )}

        <form noValidate onSubmit={(e) => void handleSubmit(e)}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="current-passphrase">
              {T.currentLabel}
            </label>
            <input
              id="current-passphrase"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder={T.currentPlaceholder}
              value={current}
              disabled={busy}
              onChange={(e) => {
                setCurrent(e.target.value);
                setNotice(null);
              }}
            />
          </div>

          <hr className={styles.sep} />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-passphrase">
              {T.newLabel}
            </label>
            <input
              id="new-passphrase"
              className={`${styles.input} ${freshClass}`}
              type="password"
              autoComplete="new-password"
              placeholder={T.newPlaceholder}
              value={fresh}
              disabled={busy}
              onChange={handleFreshChange}
              aria-invalid={view.passphraseError ? 'true' : 'false'}
              aria-describedby={view.passphraseError ? 'new-passphrase-error' : undefined}
            />
            {strength && (
              <div className={styles.strength}>
                <div className={styles.strengthBar}>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <span
                      key={index}
                      data-testid="strength-segment"
                      data-on={index < strength.segments ? 'true' : 'false'}
                      data-level={strength.key}
                      className={styles.segment}
                    />
                  ))}
                </div>
                <span data-testid="strength-label" data-level={strength.key} className={styles.strengthLabel}>
                  {strength.label}
                </span>
              </div>
            )}
            <p className={styles.hint}>{T.newHint}</p>
            {view.passphraseError && (
              <p id="new-passphrase-error" className={styles.error}>
                {view.passphraseError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="repeat-passphrase">
              {T.repeatLabel}
            </label>
            <input
              id="repeat-passphrase"
              className={`${styles.input} ${repeatClass}`}
              type="password"
              autoComplete="new-password"
              placeholder={T.repeatPlaceholder}
              value={repeat}
              disabled={busy}
              onChange={(e) => setRepeat(e.target.value)}
              aria-invalid={view.repeatError ? 'true' : 'false'}
              aria-describedby={view.repeatError ? 'repeat-passphrase-error' : undefined}
            />
            {view.repeatError && (
              <p id="repeat-passphrase-error" className={styles.error}>
                {view.repeatError}
              </p>
            )}
          </div>

          <div className={styles.notice}>
            <span className={styles.noticeIcon}>
              <WarningIcon />
            </span>
            <p>
              <strong>{T.noticeStrong}</strong> {T.noticeRest}
            </p>
          </div>

          <div className={styles.btnRow}>
            <button type="button" className={styles.secondary} disabled={busy} onClick={reset}>
              {T.cancel}
            </button>
            <button type="submit" className={styles.primary} disabled={!canSave}>
              {busy ? T.working : T.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
