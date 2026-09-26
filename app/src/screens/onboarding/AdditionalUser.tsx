import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { emailHasAccount, isValidEmail } from '../../lib/invitations';
import {
  EMAIL_HINT,
  NAME_HINT,
  PASSWORD_HINT,
  PASSWORD_MISMATCH,
  canRegister,
  isValidName,
  isValidPassword,
  registerAdditionalMember,
} from '../../lib/onboarding';
import { errorMessage, type MemberProfile } from '../../lib/session';
import styles from './AdditionalUser.module.css';

interface Props {
  profile: MemberProfile;
  onGoToPanel: () => Promise<void>;
}

const EMAIL_TAKEN = 'Este email ya está registrado en la plataforma.';
const EMAIL_FREE = 'Email disponible.';
const EMAIL_CHECKING = 'Verificando disponibilidad…';
const PASSWORD_RULES = 'Mínimo 10 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.';
const REGISTERED = 'Usuario registrado correctamente.';

/** El resultado de la comprobación, JUNTO AL TEXTO al que corresponde. */
interface EmailCheck {
  email: string;
  hasAccount: boolean;
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * FRU · Registro de usuario adicional (Módulo 01 · Onboarding), desde REG-09.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red
 * (`emailHasAccount` y `registerAdditionalMember`). Va dentro del shell; su
 * raíz `screen` es hija directa de `.bwcnt` (que es `overflow: hidden`), así
 * que se declara con scroll propio.
 *
 * Cuatro decisiones que no se leen en el JSX:
 *
 * - **La comprobación del email guarda el TEXTO con el resultado.** Sin la
 *   pareja `{email, hasAccount}` no se puede distinguir una respuesta buena de
 *   la de un texto que el usuario ya ha borrado; con ella, una respuesta tardía
 *   se descarta sola. Un texto inválido no consulta nunca `emailHasAccount`, y
 *   un rechazo es «no se sabe»: no dice nada y NO bloquea el envío, porque la
 *   Edge Function lo volverá a comprobar.
 * - **No hay selector de rol ni campo de organización**, ni de solo lectura: el
 *   nuevo miembro se vincula solo y entra como Editor.
 * - **«Añadir otro usuario» vacía TODO**, incluida la casilla y el estado de la
 *   comprobación del email (con su secuencia invalidada), para que el segundo
 *   alta empiece limpia de verdad.
 * - **La contraseña no sale de aquí**: ni a consola, ni a un texto, ni a un
 *   mensaje de error. Solo viaja al servidor en el envío.
 */
export function AdditionalUser({ profile, onGoToPanel }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  /**
   * Sin debounce: cada texto válido consulta. La secuencia descarta lo tardío y
   * el texto sigue viajando con el resultado, que es lo que decide si se pinta.
   */
  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    setEmail(value);
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

  const emailTaken = check !== null && check.email === email && check.hasAccount;
  const emailFree = check !== null && check.email === email && !check.hasAccount;

  const nameInvalid = fullName.length > 0 && !isValidName(fullName);
  const emailInvalid = email.length > 0 && !isValidEmail(email);
  const passwordInvalid = password.length > 0 && !isValidPassword(password);
  const repeatMismatch = repeat.length > 0 && repeat !== password;

  const disabled =
    !canRegister({ fullName, email, password, repeat, acceptedTerms }, emailTaken) ||
    checking ||
    sending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) return;

    setSending(true);
    setSubmitError(null);

    registerAdditionalMember({ fullName, email, password })
      .then(() => {
        setSubmitted(true);
      })
      .catch((err: unknown) => {
        // El formulario NO se vacía: lo escrito es lo que hay que corregir.
        setSubmitError(errorMessage(asError(err)));
      })
      .finally(() => {
        setSending(false);
      });
  }

  /** Volver al formulario lo deja como recién abierto: campos, casilla y mensajes. */
  function handleAddAnother() {
    checkSeq.current += 1;
    setFullName('');
    setEmail('');
    setPassword('');
    setRepeat('');
    setAcceptedTerms(false);
    setCheck(null);
    setChecking(false);
    setSubmitError(null);
    setPanelError(null);
    setSubmitted(false);
  }

  function handleGoToPanel() {
    setPanelError(null);
    onGoToPanel().catch((err: unknown) => {
      setPanelError(errorMessage(asError(err)));
    });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>
        <h1 className={styles.title}>Registro de usuario adicional</h1>
        <p className={styles.subtitle}>
          Completa los datos del nuevo miembro. Tendrá acceso inmediato a la cuenta de{' '}
          <strong>{profile.orgName}</strong>.
        </p>

        <div className={styles.roleBadge}>
          <span className={styles.roleDot} aria-hidden="true" />
          <span>
            Se registrará con rol <strong>Editor</strong> — asignado automáticamente
          </span>
        </div>

        {submitted ? (
          <>
            <p className={styles.success} role="status">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {REGISTERED}
            </p>

            <button type="button" className={styles.successButton} onClick={handleAddAnother}>
              Añadir otro usuario
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleGoToPanel}>
              Ir al panel
            </button>

            {panelError !== null && (
              <p className={styles.alert} role="alert">
                {panelError}
              </p>
            )}
          </>
        ) : (
          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="fru-name">
                Nombre completo
              </label>
              <input
                id="fru-name"
                className={styles.input}
                type="text"
                autoComplete="name"
                placeholder="Ana García Martínez"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              {nameInvalid && <p className={styles.fieldError}>{NAME_HINT}</p>}
            </div>

            <div className={styles.row}>
              <label className={styles.label} htmlFor="fru-email">
                Email
              </label>
              <input
                id="fru-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="ana.garcia@rodamientosdelsur.com"
                value={email}
                onChange={handleEmailChange}
              />
              {emailInvalid && <p className={styles.fieldError}>{EMAIL_HINT}</p>}
              {checking && (
                <p className={styles.status} role="status">
                  {EMAIL_CHECKING}
                </p>
              )}
              {emailFree && <p className={styles.emailOk}>{EMAIL_FREE}</p>}
              {emailTaken && (
                <p className={styles.fieldError} role="alert">
                  {EMAIL_TAKEN}
                </p>
              )}
            </div>

            <div className={styles.row}>
              <label className={styles.label} htmlFor="fru-password">
                Contraseña
              </label>
              <input
                id="fru-password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 10 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className={styles.hint}>{PASSWORD_RULES}</p>
              {passwordInvalid && <p className={styles.fieldError}>{PASSWORD_HINT}</p>}
            </div>

            <div className={styles.row}>
              <label className={styles.label} htmlFor="fru-repeat">
                Repetir contraseña
              </label>
              <input
                id="fru-repeat"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
              />
              {repeatMismatch && <p className={styles.fieldError}>{PASSWORD_MISMATCH}</p>}
            </div>

            <label className={styles.check} htmlFor="fru-terms">
              <input
                id="fru-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Acepto los{' '}
                <a className={styles.termsLink} href="#">
                  Términos y Condiciones
                </a>{' '}
                de Bearingworld.io.
              </span>
            </label>

            <button type="submit" className={styles.button} disabled={disabled}>
              Registrar usuario
            </button>

            {submitError !== null && (
              <p className={styles.alert} role="alert">
                {submitError}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
