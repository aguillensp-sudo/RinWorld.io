import { useEffect, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { fetchSeatsUsed, firstName, welcomeView } from '../../lib/onboarding';
import styles from './Welcome.module.css';

interface Props {
  profile: MemberProfile;
  /** Abre FRU (registro de usuario adicional). No es asíncrono: solo navega. */
  onAddUser: () => void;
  /** `Ir al panel`: `KEY_ACTIVE` → `ACTIVE` y navegación al panel. */
  onGoToPanel: () => Promise<void>;
}

/** Icono de verificación, en `currentColor`: lo tiñe quien lo envuelve. */
function CheckIcon({ size = 14 }: { size?: number }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AddUserIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

/**
 * REG-09 · Bienvenida, Usuarios Adicionales y Acceso al Dashboard.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red,
 * y solo una vez al montar (`fetchSeatsUsed`). La única otra acción de red es
 * la que le llega envuelta en `onGoToPanel`, que ejecuta el wiring.
 *
 * Tres estados excluyentes, en este orden:
 *
 * 1. **Cargando**: mientras no hay plazas ni error. Solo el mensaje: no se pinta
 *    una decisión con datos que aún no se tienen.
 * 2. **Error de carga**: `role="alert"` con el motivo y ningún botón. Sin saber
 *    cuántas plazas hay no se puede decir si cabe alguien más.
 * 3. **Cargada**: la vista que devuelve `welcomeView`, que es pura y decide
 *    título, pregunta, contador y si cabe otro usuario. Aquí no se reescribe
 *    ninguno de esos textos.
 *
 * `Ir al panel` se llama UNA vez y bloquea los dos botones mientras está en
 * vuelo; tanto si resuelve como si rechaza se rehabilitan —en el primer caso el
 * shell ya está sustituyendo la pantalla— para que un fallo se pueda reintentar.
 */
export function Welcome({ profile, onAddUser, onGoToPanel }: Props) {
  const [seats, setSeats] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  /** Las plazas ocupadas: una sola lectura, al montar. */
  useEffect(() => {
    let cancelled = false;

    fetchSeatsUsed()
      .then((used) => {
        if (!cancelled) setSeats(used);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(errorMessage(err instanceof Error ? err : new Error(String(err))));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const view =
    seats === null ? null : welcomeView(firstName(profile.fullName, profile.email), seats);

  /**
   * `Ir al panel` es lo único que se puede pulsar dos veces por accidente, así
   * que la guarda va aquí además del `disabled`. Si rechaza se queda el motivo
   * en pantalla y los botones vuelven a estar disponibles.
   */
  async function handleGoToPanel() {
    if (leaving) return;

    setLeaving(true);
    setPanelError(null);

    try {
      await onGoToPanel();
    } catch (err: unknown) {
      setPanelError(errorMessage(err instanceof Error ? err : new Error(String(err))));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className={styles.screen}>
      {loadError !== null ? (
        <p role="alert" className={styles.alert}>
          {loadError}
        </p>
      ) : view === null ? (
        <p role="status" className={styles.status}>
          Cargando…
        </p>
      ) : (
        <>
          {/* Los cuatro pasos del registro, todos completados: el ADMIN ya dejó
              la solicitud, la organización, la seguridad y la activación atrás. */}
          <ol className={styles.steps} aria-label="Pasos del registro">
            <li className={`${styles.step} ${styles.stepDone}`}>
              <CheckIcon />
              Solicitud
            </li>
            <li className={`${styles.step} ${styles.stepDone}`}>
              <CheckIcon />
              Organización
            </li>
            <li className={`${styles.step} ${styles.stepDone}`}>
              <CheckIcon />
              Seguridad
            </li>
            <li className={`${styles.step} ${styles.stepDone}`}>
              <CheckIcon />
              Activación
            </li>
          </ol>

          <div className={styles.banner}>
            <span className={styles.checkRing}>
              <CheckIcon size={20} />
            </span>
            <div>
              <h1 className={styles.title}>{view.title}</h1>
              <p className={styles.subtitle}>
                Tu organización <strong>{profile.orgName}</strong> ya está activa. Antes de ir al
                panel, ¿quieres registrar más usuarios de tu equipo?
              </p>
            </div>
          </div>

          {/* El contador solo existe cuando ya hay alguien más: con el ADMIN
              solo, `welcomeView` devuelve `null` y no se pinta nada. */}
          {view.counter !== null && (
            <div className={styles.counter} data-testid="user-counter">
              <PeopleIcon />
              {view.counter}
            </div>
          )}

          <p className={styles.question}>{view.question}</p>

          <div className={styles.buttons}>
            {view.canAdd && (
              <button
                type="button"
                className={styles.primary}
                disabled={leaving}
                onClick={onAddUser}
              >
                <AddUserIcon />
                Sí, añadir un usuario ahora
              </button>
            )}
            <button
              type="button"
              className={styles.secondary}
              disabled={leaving}
              onClick={handleGoToPanel}
            >
              Ir al panel
            </button>
          </div>

          {panelError !== null && (
            <p role="alert" className={styles.alert}>
              {panelError}
            </p>
          )}

          <p className={styles.note}>
            Podrás invitar más usuarios desde{' '}
            <strong>Configuración → Gestión de usuarios</strong> en cualquier momento.
          </p>
        </>
      )}
    </div>
  );
}
