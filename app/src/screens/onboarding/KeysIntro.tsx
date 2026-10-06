import styles from './KeysIntro.module.css';

interface Props {
  /** `Entendido, crear mi frase de seguridad`: solo navega a REG-06. No es asíncrono. */
  onContinue: () => void;
}

/** Icono de verificación, en `currentColor`: lo tiñe el círculo que lo envuelve. */
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/** Candado: la privacidad de lo que se negocia. */
function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Llave: el par de claves criptográficas del usuario. */
function KeyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3L22 7l-3-3" />
    </svg>
  );
}

/** Escudo: la copia cifrada protegida por la frase de seguridad. */
function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
 * REG-05 · Introducción a las claves E2EE.
 *
 * Pantalla EXPLICATIVA de la Fase B: cuenta qué va a pasar y por qué antes de
 * crear la frase de seguridad. Es presentación pura: no lee ni escribe en la
 * base, no llama a la red y no toca criptografía — el par de claves y la copia
 * cifrada los crea REG-07. No tiene estado de carga ni de error: se pinta entera
 * al montar.
 *
 * El único botón de la pantalla, `Entendido, crear mi frase de seguridad`, no
 * hace nada por su cuenta: llama a `onContinue()` una vez y es el wiring quien
 * lleva a REG-06.
 */
export function KeysIntro({ onContinue }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.column}>
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

        <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>

        <h1 className={styles.title}>
          Antes de continuar,{' '}
          <br />
          una cosa importante
        </h1>

        <div className={styles.blocks}>
          <div className={styles.block}>
            <span className={styles.blockIcon}>
              <LockIcon />
            </span>
            <div className={styles.blockBody}>
              <h2 className={styles.blockTitle}>Tus negociaciones son privadas</h2>
              <p className={styles.blockDesc}>
                Los precios y condiciones que intercambies en Bearingworld.io se cifran en tu
                dispositivo. Ni nosotros ni nadie puede leerlos.
              </p>
            </div>
          </div>

          <div className={styles.block}>
            <span className={styles.blockIcon}>
              <KeyIcon />
            </span>
            <div className={styles.blockBody}>
              <h2 className={styles.blockTitle}>Tú tienes la llave</h2>
              <p className={styles.blockDesc}>
                Para garantizar esa privacidad, vamos a generar un par de claves criptográficas
                únicas para ti.
              </p>
            </div>
          </div>

          <div className={styles.block}>
            <span className={styles.blockIcon}>
              <ShieldIcon />
            </span>
            <div className={styles.blockBody}>
              <h2 className={styles.blockTitle}>Necesitas una frase de seguridad</h2>
              <p className={styles.blockDesc}>
                Guardaremos una copia cifrada de tu clave en nuestros servidores, protegida con una
                frase que solo tú conocerás. Si la pierdes, perderás el acceso a tu historial
                cifrado.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}>
            <WarningIcon />
          </span>
          <p className={styles.noticeText}>
            <strong>Anota tu frase de seguridad en un lugar seguro.</strong>{' '}
            No podemos recuperarla por ti.
          </p>
        </div>

        <button type="button" className={styles.primary} onClick={onContinue}>
          Entendido, crear mi frase de seguridad
        </button>
      </div>
    </div>
  );
}
