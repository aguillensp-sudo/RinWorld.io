import { useState } from 'react';
import type { FormEvent } from 'react';
import styles from './Login.module.css';

/**
 * LOGIN-01 — Iniciar sesión.
 *
 * Pantalla completa sin shell: es la primera que ve el socio. Recoge correo y
 * contraseña y delega la autenticación en `onSubmit` (lo monta `useSession`);
 * aquí no hay red, ni enlaces, ni flujos que el MVP no tenga.
 *
 * La contraseña se lee solo en el submit (`email.trim()`, `password` tal cual) y
 * nunca en un efecto posterior: el helper e2e vacía el campo después de rellenarlo
 * (F-038) y el volcado del DOM que Playwright sube a la CI no debe arrastrar
 * credenciales.
 */
export function Login({
  onSubmit,
  error,
}: {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Un correo de solo espacios no cuenta como contenido (RNG-LOG-01). La
  // contraseña no se recorta: un espacio al final puede ser parte de ella.
  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Bearingworld.io</p>
        <h1 id="login-title" className={styles.title}>Iniciar sesión</h1>
        <form
          className={styles.form}
          aria-labelledby="login-title"
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.label}>Correo electrónico</label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              name="email"
              autoComplete="username"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.label}>Contraseña</label>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              aria-describedby="login-encrypt-hint"
            />
            <p id="login-encrypt-hint" className={styles.encryptHint}>
              Cifrado extremo a extremo · el servidor no ve tu contenido
            </p>
          </div>
          {error !== null && (
            <div className={styles.error} role="alert">{error}</div>
          )}
          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
