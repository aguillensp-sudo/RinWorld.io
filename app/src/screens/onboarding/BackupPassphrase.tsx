import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import type { MemberProfile } from '../../lib/session';
import {
  EMPTY_PASSPHRASE_FORM,
  PASSPHRASE_TEXTS as T,
  checkPassphrase,
  passphraseView,
} from '../../lib/passphrase';
import type { PassphraseCheck, PassphraseForm } from '../../lib/passphrase';

import styles from './BackupPassphrase.module.css';

interface Props {
  /** El miembro en registro: su email compara contra la contraseña de acceso y sus datos penalizan la frase. */
  profile: MemberProfile;
  /** Entrega la frase al wiring de REG-07, en memoria. La frase no sale del navegador. */
  onContinue: (passphrase: string) => void;
}

/** Icono de verificación, en `currentColor`: lo tiñe el disco de latón que lo envuelve. */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
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

/** Ojo abierto: la frase está oculta — pulsarlo la revela. */
function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Ojo tachado: la frase está a la vista — pulsarlo la vuelve a ocultar. */
function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Triángulo de advertencia del aviso. */
function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * REG-06 · Crea tu frase de seguridad (backup passphrase).
 *
 * Segunda pantalla de la Fase B: recoge la frase que protegerá la copia cifrada de
 * la clave privada. La mide en local con `checkPassphrase` (zxcvbn + huella de la
 * contraseña de acceso, ambas en memoria) y la entrega al wiring en el `onContinue`.
 *
 * Invariante *server-blind* (ADR-001): aquí no hay una sola llamada a la red. La
 * frase vive en el estado de React y en los `<input>`: no se pinta en ningún texto,
 * ni en un `title`, ni en un `data-*`, ni se persiste en storage ni en cookies. El
 * par de claves y el backup cifrado son REG-07.
 *
 * Toda la vista se deriva de `passphraseView(form, check)`: el botón sólo avanza con
 * frase fuerte (score ≥ 3 y 12 caracteres), repetición coincidente y casilla marcada.
 */
export function BackupPassphrase({ profile, onContinue }: Props) {
  const [form, setForm] = useState<PassphraseForm>(EMPTY_PASSPHRASE_FORM);
  const [check, setCheck] = useState<PassphraseCheck | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  /** La última frase tecleada: descarta la medida de una pulsación anterior. */
  const latestPassphrase = useRef('');

  const view = passphraseView(form, check);
  const strength = view.strength;

  function handlePassphraseChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    latestPassphrase.current = value;
    setForm((previous) => ({ ...previous, passphrase: value }));
    checkPassphrase(profile.email, value, [profile.fullName ?? '', profile.orgName])
      .then((result) => {
        // Una respuesta desordenada no puede pisar la medida de la frase actual.
        if (result.passphrase === latestPassphrase.current) setCheck(result);
      })
      .catch(() => {
        // Medida local que no ha llegado: sin barra y con el botón bloqueado, nada más que hacer.
      });
  }

  function handleRepeatChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setForm((previous) => ({ ...previous, repeat: value }));
  }

  function handleAcknowledgedChange(event: ChangeEvent<HTMLInputElement>) {
    const acknowledged = event.target.checked;
    setForm((previous) => ({ ...previous, acknowledged }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.canContinue) onContinue(form.passphrase);
  }

  const passphraseClass = view.passphraseError
    ? styles.inputError
    : view.passphraseOk
      ? styles.inputOk
      : '';
  const repeatClass = view.repeatError ? styles.inputError : view.repeatOk ? styles.inputOk : '';

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <form noValidate onSubmit={handleSubmit}>
          {/* Los cuatro pasos del registro: los dos primeros ya están hechos, este
              es el de Seguridad y la Activación todavía está pendiente. */}
          <ol className={styles.steps} aria-label="Pasos del registro">
            <li className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepDot}>
                <CheckIcon />
              </span>
              <span className={styles.stepLabel}>Solicitud</span>
              <span aria-hidden="true" className={styles.stepLine} />
            </li>
            <li className={`${styles.step} ${styles.stepDone}`}>
              <span className={styles.stepDot}>
                <CheckIcon />
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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="passphrase">
              {T.passphraseLabel}
            </label>
            <div className={styles.inputWrap}>
              <input
                id="passphrase"
                className={`${styles.input} ${passphraseClass}`}
                type={showPassphrase ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={T.passphrasePlaceholder}
                value={form.passphrase}
                onChange={handlePassphraseChange}
                aria-invalid={view.passphraseError ? 'true' : 'false'}
                aria-describedby={view.passphraseError ? 'passphrase-error' : undefined}
              />
              <button
                type="button"
                className={styles.eye}
                aria-label={showPassphrase ? T.hidePassphrase : T.showPassphrase}
                onClick={() => setShowPassphrase((visible) => !visible)}
              >
                {showPassphrase ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

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
                <span
                  data-testid="strength-label"
                  data-level={strength.key}
                  className={styles.strengthLabel}
                >
                  {strength.label}
                </span>
              </div>
            )}

            {view.passphraseError && (
              <p id="passphrase-error" className={styles.error}>
                {view.passphraseError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="repeat">
              {T.repeatLabel}
            </label>
            <div className={styles.inputWrap}>
              <input
                id="repeat"
                className={`${styles.input} ${repeatClass}`}
                type={showRepeat ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={T.repeatPlaceholder}
                value={form.repeat}
                onChange={handleRepeatChange}
                aria-invalid={view.repeatError ? 'true' : 'false'}
                aria-describedby={view.repeatError ? 'repeat-error' : undefined}
              />
              <button
                type="button"
                className={styles.eye}
                aria-label={showRepeat ? T.hidePassphrase : T.showPassphrase}
                onClick={() => setShowRepeat((visible) => !visible)}
              >
                {showRepeat ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {view.repeatError && (
              <p id="repeat-error" className={styles.error}>
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

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={form.acknowledged}
              onChange={handleAcknowledgedChange}
            />
            {T.acknowledgement}
          </label>

          <button type="submit" className={styles.primary} disabled={!view.canContinue}>
            {T.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
