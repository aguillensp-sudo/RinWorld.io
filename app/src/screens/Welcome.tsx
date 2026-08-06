import type { MemberProfile } from '../lib/session';
import styles from './Welcome.module.css';

export function formatToday(d: Date): string {
  const s = d.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `Hoy es ${s}`;
}

/** Primer nombre, para el saludo. */
function firstName(profile: MemberProfile): string {
  const full = (profile.fullName ?? '').trim();
  if (full) return full.split(/\s+/)[0] ?? full;
  return profile.email.split('@')[0] ?? profile.email;
}

interface Props {
  profile: MemberProfile;
}

/**
 * El shell aprobado trae "¡Bienvenido Walter!" y una coña como tagline. El nombre
 * pasa a venir de la sesión — §4 del sistema de diseño prohíbe datos de ejemplo en
 * `value` — y la coña se sustituye por la organización activa, que es lo que la
 * puerta del día 2 tiene que dejar ver.
 */
export function Welcome({ profile }: Props) {
  return (
    <div className={styles.welcomeBg}>
      <div className={styles.welcomeCenter}>
        <div className={styles.greeting} data-testid="welcome-greeting">
          ¡Bienvenido {firstName(profile)}!
        </div>
        <div className={styles.date}>{formatToday(new Date())}</div>
        <div className={styles.tagline} data-testid="welcome-org">
          {profile.orgName} · {profile.orgCountry}
        </div>
      </div>
    </div>
  );
}
