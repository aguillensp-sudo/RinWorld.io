import { useEffect, useRef, useState } from 'react';

import type { MemberProfile } from '../../lib/session';
import {
  KEY_GENERATION_TEXTS as T,
  createKeyPair,
  protectPrivateKey,
  uploadKeyBackup,
  verifyKeyBackup,
} from '../../lib/key-backup';
import type { NewKeyPair, ProtectedKey } from '../../lib/key-backup';
import type { SessionKeyPair } from '../../lib/crypto';
import { saveDeviceKey } from '../../lib/device-key';
import { adoptKeyring } from '../../lib/keys';

import styles from './KeyGeneration.module.css';

interface Props {
  /** El miembro en registro: su id es la AAD del backup (ADR-001 §6.2). */
  profile: MemberProfile;
  /** La frase de REG-06, en memoria. Se lee una vez, al montar. */
  passphrase: string | null;
  /** El paso 2 ya la ha usado: quien la guardaba la suelta. */
  onPassphraseConsumed: () => void;
  /** No hay frase (no debería pasar): de vuelta a REG-06. */
  onPassphraseMissing: () => void;
  /** «Continuar», con la cuenta ya en `KEY_ACTIVE`: a REG-09. */
  onContinue: () => void;
}

type Step = 1 | 2 | 3 | 4;
type Phase = 'running' | 'done' | 'error';

/** Icono de verificación, en `currentColor`. */
function CheckIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Aspa del paso que ha fallado. */
function CrossIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** El rodamiento que gira mientras un paso está en curso (elemento firma del sistema). */
function BearingSpinner() {
  return (
    <svg
      className={styles.spinner}
      data-testid="bearing-spinner"
      role="img"
      aria-label="Procesando"
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
    >
      <circle cx="13" cy="13" r="11.5" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
      <circle cx="13" cy="13" r="7" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <circle cx="13" cy="13" r="2.5" fill="currentColor" opacity="0.6" />
      <circle cx="13" cy="3" r="2.2" fill="currentColor" />
      <circle cx="23" cy="13" r="2.2" fill="currentColor" />
      <circle cx="13" cy="23" r="2.2" fill="currentColor" />
      <circle cx="3" cy="13" r="2.2" fill="currentColor" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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
 * REG-07 · Generando tus claves de seguridad. Escrita a mano (criptografía, Plan §4.3).
 *
 * Pantalla de proceso, sin campos: al montar recorre los cuatro pasos de
 * `key-backup.ts` —par, Argon2id + AES-256-GCM, subida y verificación— y termina con
 * la cuenta en `KEY_ACTIVE`, la privada guardada en este dispositivo y el llavero de
 * la sesión puesto. «Continuar» lleva a REG-09.
 *
 * **Reintentar.** Un fallo en los pasos 3–4 (red) reintenta desde el 3 con el MISMO
 * backup: no se vuelve a generar el par (spec §6) y el servidor acepta la repetición
 * (`0048`). Un fallo en los pasos 1–2 (este navegador) empieza de nuevo: la frase
 * sigue aquí, porque solo se suelta cuando el paso 2 ha salido bien.
 *
 * La frase no se pinta en ningún sitio ni sale de la pestaña (ADR-001 §8). VERA, sin
 * mensajes guionizados: precedente de REG-05/REG-06 (`CLAUDE.md` §7).
 */
export function KeyGeneration({ profile, passphrase, onPassphraseConsumed, onPassphraseMissing, onContinue }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [phase, setPhase] = useState<Phase>('running');

  /** La frase, leída una vez al montar; se suelta tras el paso 2. */
  const passphraseRef = useRef(passphrase);
  const generated = useRef<NewKeyPair | null>(null);
  const protectedKey = useRef<ProtectedKey | null>(null);
  const keyPair = useRef<SessionKeyPair | null>(null);
  /** StrictMode monta dos veces en desarrollo: el proceso arranca una sola. */
  const started = useRef(false);
  const mounted = useRef(false);

  const callbacks = useRef({ onPassphraseConsumed, onPassphraseMissing });
  callbacks.current = { onPassphraseConsumed, onPassphraseMissing };

  async function run(from: 1 | 3) {
    let current: Step = from;
    const enter = (s: Step) => {
      current = s;
      if (mounted.current) {
        setStep(s);
        setPhase('running');
      }
    };
    try {
      if (from === 1) {
        enter(1);
        generated.current = await createKeyPair();
        keyPair.current = generated.current.keyPair;

        enter(2);
        const phrase = passphraseRef.current;
        if (phrase === null) {
          callbacks.current.onPassphraseMissing();
          return;
        }
        protectedKey.current = await protectPrivateKey(phrase, profile.id, generated.current);
        generated.current = null;
        passphraseRef.current = null;
        callbacks.current.onPassphraseConsumed();
      }

      const sealed = protectedKey.current;
      const pair = keyPair.current;
      if (!sealed || !pair) throw new Error('Sin backup que subir.');

      enter(3);
      await uploadKeyBackup(sealed.payload);

      enter(4);
      await verifyKeyBackup(profile.id, sealed);
      await saveDeviceKey(profile.id, pair);
      adoptKeyring(profile.id, pair);
      protectedKey.current = null;

      if (mounted.current) setPhase('done');
    } catch {
      if (mounted.current) {
        setStep(current);
        setPhase('error');
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      void run(1);
    }
    return () => {
      mounted.current = false;
    };
    // El proceso arranca una vez por montaje; `run` lee lo demás de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localFailure = phase === 'error' && step <= 2;

  function retry() {
    void run(step <= 2 ? 1 : 3);
  }

  function stateOf(s: Step): 'done' | 'active' | 'pending' | 'error' {
    if (phase === 'done' || s < step) return 'done';
    if (s > step) return 'pending';
    return phase === 'error' ? 'error' : 'active';
  }

  const stateClass = {
    done: styles.procDone,
    active: styles.procActive,
    pending: styles.procPending,
    error: styles.procError,
  } as const;

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        {/* Los cuatro pasos del registro: este es el de Seguridad. */}
        <ol className={styles.steps} aria-label="Pasos del registro">
          <li className={`${styles.step} ${styles.stepDone}`}>
            <span className={styles.stepDot}>
              <CheckIcon size={11} />
            </span>
            <span className={styles.stepLabel}>Solicitud</span>
            <span aria-hidden="true" className={styles.stepLine} />
          </li>
          <li className={`${styles.step} ${styles.stepDone}`}>
            <span className={styles.stepDot}>
              <CheckIcon size={11} />
            </span>
            <span className={styles.stepLabel}>Organización</span>
            <span aria-hidden="true" className={styles.stepLine} />
          </li>
          <li className={`${styles.step} ${styles.stepActive}`} aria-current="step">
            <span className={styles.stepDot}>3</span>
            <span className={styles.stepLabel}>Seguridad</span>
            <span aria-hidden="true" className={styles.stepLine} />
          </li>
          <li className={`${styles.step} ${styles.stepPending}`}>
            <span className={styles.stepDot}>4</span>
            <span className={styles.stepLabel}>Activación</span>
          </li>
        </ol>

        <p className={styles.eyebrow}>{T.eyebrow}</p>
        <h1 className={styles.title}>{T.title}</h1>
        <p className={styles.subtitle}>{T.subtitle}</p>

        <ol className={styles.procList} aria-label="Progreso de la generación de claves" aria-live="polite">
          {T.steps.map((label, index) => {
            const s = (index + 1) as Step;
            const state = stateOf(s);
            return (
              <li key={label} className={`${styles.proc} ${stateClass[state]}`} data-testid="proc-step" data-state={state}>
                <span className={styles.procIndicator}>
                  {state === 'done' ? <CheckIcon size={13} /> : state === 'error' ? <CrossIcon /> : s}
                </span>
                <div className={styles.procBody}>
                  <div className={styles.procLabel}>{label}</div>
                  {state === 'active' && s === 2 && <div className={styles.procDesc}>{T.protecting}</div>}
                  {state === 'error' && (
                    <div className={styles.procDesc}>{s <= 2 ? T.localError : T.connectionError}</div>
                  )}
                </div>
                <div className={styles.procRight}>{state === 'active' && <BearingSpinner />}</div>
              </li>
            );
          })}
        </ol>

        {phase === 'running' && (
          <div className={styles.notice}>
            <span className={styles.noticeIcon}>
              <WarningIcon />
            </span>
            <p>{T.notice}</p>
          </div>
        )}

        {phase === 'done' && (
          <>
            <p className={styles.success} role="status">
              <span className={styles.successIcon}>
                <SuccessIcon />
              </span>
              {T.done}
            </p>
            <button type="button" className={styles.primary} onClick={onContinue}>
              {T.continue}
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
              <span className={styles.noticeIcon}>
                <ErrorIcon />
              </span>
              <p>
                <strong>{localFailure ? T.localErrorStrong : T.backupErrorStrong}</strong>{' '}
                {localFailure ? T.localErrorRest : T.backupErrorRest}
              </p>
            </div>
            <button type="button" className={styles.primary} onClick={retry}>
              {T.retry}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
