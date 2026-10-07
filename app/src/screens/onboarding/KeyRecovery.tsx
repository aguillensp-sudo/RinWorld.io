import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import type { MemberProfile } from '../../lib/session';
import { KEY_RECOVERY_TEXTS as T, MAX_RECOVERY_ATTEMPTS, recoverKey } from '../../lib/key-recovery';

import styles from './KeyRecovery.module.css';

interface Props {
  /** El miembro que recupera: su id es la AAD del backup (ADR-001 §6.2). */
  profile: MemberProfile;
  /** «Volver al panel», con la clave ya recuperada en este navegador. */
  onRecovered: () => void;
  /** «Ahora no» y, con el bloqueo puesto, «Volver al panel»: seguir sin la clave. */
  onSkip: () => void;
  /**
   * «He perdido mi frase»: borra el backup y manda a generar claves nuevas. Solo lo
   * pasa quien tiene camino de vuelta (el ADMIN, F-217); sin esto no hay enlace.
   */
  onGenerateNew?: () => Promise<void>;
}

type Phase = 'form' | 'working' | 'locked' | 'done';

function ShieldIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <rect x="9" y="10" width="6" height="5" rx="1" />
      <path d="M10 10V8.5a2 2 0 0 1 4 0V10" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
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

/** `28:43`. */
function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * REC-01 · Recuperar acceso a tu historial cifrado. Escrita a mano (criptografía, Plan §4.3).
 *
 * Aparece cuando el miembro tiene backup (ADR-001) y este navegador no tiene su privada.
 * Una frase: se descifra el backup en local (`recoverKey`), la privada se queda en este
 * dispositivo y el llavero se monta. **La frase no sale de la pestaña** y no se pinta.
 *
 * Los cinco intentos y la media hora de espera los cuenta el SERVIDOR (0049): cada
 * pulsación pide el backup y esa petición es el intento. Esta pantalla solo lo enseña.
 * Si el servidor dice `locked`, no hay nada que descifrar.
 *
 * VERA, sin mensaje guionizado: solo habla desde sus herramientas (`CLAUDE.md` §7).
 */
export function KeyRecovery({ profile, onRecovered, onSkip, onGenerateNew }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** `null` = el servidor aún no ha dicho cuántos quedan. */
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  /** Cuándo termina el bloqueo (ms) y qué hora es, para la cuenta atrás. */
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [lostOpen, setLostOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [lostError, setLostError] = useState<string | null>(null);

  // La cuenta atrás del bloqueo. Al llegar a cero el servidor ya empieza de cero.
  const locked = phase === 'locked';
  const secondsLeft = locked ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [locked]);
  useEffect(() => {
    if (locked && secondsLeft <= 0) {
      setPhase('form');
      setAttemptsLeft(null);
      setError(null);
    }
  }, [locked, secondsLeft]);

  function lockFor(seconds: number) {
    const t = Date.now();
    setNow(t);
    setDeadline(t + Math.max(1, seconds) * 1000);
    setPassphrase('');
    setPhase('locked');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== 'form' || passphrase === '') return;
    setPhase('working');
    setError(null);
    try {
      const outcome = await recoverKey(passphrase, profile.id);
      if (outcome.kind === 'recovered') {
        setPassphrase('');
        setPhase('done');
      } else if (outcome.kind === 'locked') {
        lockFor(outcome.secondsLeft);
      } else {
        setAttemptsLeft(outcome.attemptsLeft);
        if (outcome.lockedSeconds > 0) {
          lockFor(outcome.lockedSeconds);
        } else {
          setError(T.wrong);
          setPhase('form');
        }
      }
    } catch {
      setError(T.connection);
      setPhase('form');
    }
  }

  async function handleGenerate() {
    if (!onGenerateNew) return;
    setDiscarding(true);
    setLostError(null);
    try {
      await onGenerateNew();
    } catch {
      setLostError(T.modalError);
      setDiscarding(false);
    }
  }

  // El contador se enseña desde el segundo intento fallido (spec §3): con 3 o menos quedan.
  const showAttempts = attemptsLeft !== null && attemptsLeft <= MAX_RECOVERY_ATTEMPTS - 2 && phase !== 'done';
  const lostLink = onGenerateNew ? (
    <button type="button" className={styles.link} onClick={() => setLostOpen(true)}>
      {T.lost}
    </button>
  ) : null;

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <span className={styles.noticeIcon} style={{ marginBottom: 14 }}>
          <ShieldIcon />
        </span>
        <p className={styles.eyebrow}>{T.eyebrow}</p>
        <h1 className={styles.title}>{T.title}</h1>
        <p className={styles.subtitle}>{T.subtitle}</p>

        {phase === 'done' ? (
          <>
            <p className={styles.success} role="status">
              <span className={styles.successIcon}>
                <SuccessIcon />
              </span>
              {T.done}
            </p>
            <button type="button" className={styles.primary} onClick={onRecovered}>
              {T.back}
            </button>
          </>
        ) : phase === 'locked' ? (
          <>
            <div className={styles.cooldown} role="alert">
              <div className={styles.timer} data-testid="cooldown-timer">
                {clock(secondsLeft)}
              </div>
              <p className={styles.cooldownText}>
                <strong>{T.cooldownTitle}</strong>
                <br />
                {T.cooldownText(Math.max(1, Math.ceil(secondsLeft / 60)))}
              </p>
            </div>
            <div className={styles.notice}>
              <span className={styles.noticeIcon}>
                <InfoIcon />
              </span>
              <p>{T.cooldownNotice}</p>
            </div>
            <button type="button" className={styles.primary} onClick={onSkip}>
              {T.back}
            </button>
            <div className={styles.links}>{lostLink}</div>
          </>
        ) : (
          <form noValidate onSubmit={(e) => void handleSubmit(e)}>
            <div className={styles.notice}>
              <span className={styles.noticeIcon}>
                <InfoIcon />
              </span>
              <p>{T.info}</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="recovery-passphrase">
                {T.label}
              </label>
              <input
                id="recovery-passphrase"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                type="password"
                autoComplete="current-password"
                placeholder={T.placeholder}
                value={passphrase}
                disabled={phase === 'working'}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'recovery-error' : undefined}
              />
              {showAttempts && attemptsLeft !== null && (
                <div className={styles.attemptRow} data-testid="attempts">
                  <div className={styles.dots} aria-hidden="true">
                    {Array.from({ length: MAX_RECOVERY_ATTEMPTS }, (_, i) => (
                      <span
                        key={i}
                        className={styles.dot}
                        data-on={i < attemptsLeft ? 'true' : 'false'}
                        data-low={attemptsLeft <= 1 && i < attemptsLeft ? 'true' : 'false'}
                      />
                    ))}
                  </div>
                  <span className={styles.attemptLabel}>{T.attempts(attemptsLeft)}</span>
                </div>
              )}
            </div>

            {error && (
              <div id="recovery-error" className={`${styles.notice} ${styles.noticeError}`} role="alert">
                <span className={styles.noticeIcon}>
                  <InfoIcon />
                </span>
                <p>{error}</p>
              </div>
            )}

            <button type="submit" className={styles.primary} disabled={passphrase === '' || phase === 'working'}>
              {phase === 'working' ? T.working : T.submit}
            </button>

            <div className={styles.links}>
              {lostLink}
              <button type="button" className={styles.link} onClick={onSkip}>
                {T.skip}
              </button>
            </div>
          </form>
        )}
      </div>

      {lostOpen && onGenerateNew && (
        <div className={styles.backdrop}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="lost-title">
            <h2 id="lost-title" className={styles.modalTitle}>
              {T.modalTitle}
            </h2>
            <p className={styles.modalText}>{T.modalText}</p>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              {T.modalCheck}
            </label>
            {lostError && (
              <p className={styles.error} role="alert">
                {lostError}
              </p>
            )}
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.secondary}
                disabled={discarding}
                onClick={() => {
                  setLostOpen(false);
                  setUnderstood(false);
                  setLostError(null);
                }}
              >
                {T.modalCancel}
              </button>
              <button type="button" className={styles.primary} disabled={!understood || discarding} onClick={() => void handleGenerate()}>
                {discarding ? T.modalConfirming : T.modalConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
