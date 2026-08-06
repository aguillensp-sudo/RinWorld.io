import { useState, type FormEvent } from 'react';
import styles from './Login.module.css';

interface Props {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  error: string | null;
}

export function Login({ onSubmit, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    await onSubmit(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={submit} aria-label="Iniciar sesión">
        <div>
          <div className={styles.eyebrow}>Bearingworld.io</div>
          <h1 className={styles.title}>Iniciar sesión</h1>
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Correo electrónico
          </label>
          {/* §4: los datos de ejemplo van en placeholder, nunca en value. */}
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="username"
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className={styles.hint}>Cifrado extremo a extremo · el servidor no ve tu contenido</div>
        </div>

        <button className={styles.submit} type="submit" disabled={!canSubmit}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
