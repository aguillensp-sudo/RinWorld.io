import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ACTIVATION_TEXTS as T, changeProvisionalPassword, hasProvisionalPassword } from '../../lib/activation';
import { PASSWORD_HINT, PASSWORD_MISMATCH, isValidPassword } from '../../lib/onboarding';
import { passwordStrength } from '../../lib/register-org';
import type { MemberProfile } from '../../lib/session';
import intro from './KeysIntro.module.css';
import form from './OrgRegistration.module.css';
import blocks from './InviteBlocks.module.css';

interface Props {
  /** Un miembro `REGISTERED` que no es el ADMIN: invitado por INVT-02 o dado de alta por FRU. */
  profile: MemberProfile;
  /** `Empezar la activación`: solo navega a REG-05. No es asíncrono. */
  onStart: () => void;
  /** `Ahora no, cerrar sesión`. */
  onSignOut: () => void;
  /** Para tests: decide la variante sin tocar la sesión. Sin él se lee de la sesión. */
  provisional?: boolean;
}

/**
 * ACT-02 — Activa tu cuenta (Fase B de un miembro invitado; propuesta aprobada el 7-oct-2026).
 *
 * Es la puerta a REG-05 → REG-06 → REG-07 para quien no es el ADMIN (`F-217`): hasta ahora el
 * wiring solo mandaba allí al ADMIN. Dentro del shell estándar con VERA `Asistente de registro`.
 *
 * Variante «contraseña provisional»: una cuenta de FRU la creó el ADMIN con la contraseña que
 * él puso. Antes de nada se pide cambiarla, y entonces sí se pasa a la pantalla normal. Solo la
 * decide `user_metadata.must_change_password` (un aviso de interfaz, no una barrera).
 *
 * Aquí no se genera ninguna clave ni se escribe en la base: eso lo hacen REG-06 y REG-07.
 */
export function ActivateAccount({ profile, onStart, onSignOut, provisional }: Props) {
  const [mustChange, setMustChange] = useState<boolean | null>(provisional ?? null);

  useEffect(() => {
    if (provisional !== undefined) return;
    let cancelled = false;
    hasProvisionalPassword().then(
      (value) => {
        if (!cancelled) setMustChange(value);
      },
      () => {
        if (!cancelled) setMustChange(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provisional]);

  if (mustChange === null) return <div className={intro.screen} aria-busy="true" />;
  if (mustChange) {
    return <ChangePassword email={profile.email} onSignOut={onSignOut} onDone={() => setMustChange(false)} />;
  }

  return (
    <div className={intro.screen}>
      <div className={intro.column}>
        <p className={intro.eyebrow}>{T.eyebrow}</p>
        <h1 className={intro.title}>{T.title}</h1>
        <p className={blocks.lead}>
          {T.subtitleLine1(profile.orgName)}
          <br />
          {T.subtitleLine2}
        </p>

        <dl className={blocks.kv}>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowUser}</dt>
            <dd className={blocks.kvValue}>
              {profile.fullName ?? profile.email} <small>· {profile.email}</small>
            </dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowOrg}</dt>
            <dd className={blocks.kvValue}>{profile.orgName}</dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowRole}</dt>
            <dd className={blocks.kvValue}>{T.roleName}</dd>
          </div>
          <div className={blocks.kvRow}>
            <dt className={blocks.kvKey}>{T.rowState}</dt>
            <dd className={blocks.kvValue}>
              <span className={blocks.badge}>{T.stateBadge}</span>
            </dd>
          </div>
        </dl>

        <ol className={blocks.steps} aria-label={T.stepsLabel}>
          {T.steps.map((step) => (
            <li key={step.n} className={blocks.step}>
              <span className={blocks.stepNum}>{step.n}</span>
              <strong>{step.title}</strong>
              {step.text}
            </li>
          ))}
        </ol>

        <div className={blocks.two}>
          <div>
            <h2>{T.beforeTitle}</h2>
            <ul>
              {T.before.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>{T.afterTitle}</h2>
            <ul>
              {T.after.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className={blocks.notice} style={{ marginTop: 0, marginBottom: 20 }}>
          <strong>{T.noticeStrong}</strong>
          {T.notice}
        </p>

        <button type="button" className={intro.primary} onClick={onStart}>
          {T.start}
        </button>
        <button type="button" className={blocks.ghost} onClick={onSignOut}>
          {T.later}
        </button>
      </div>
    </div>
  );
}

function ChangePassword({ email, onSignOut, onDone }: { email: string; onSignOut: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState({ next: false, repeat: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextOk = isValidPassword(next);
  const repeatOk = repeat === next && repeat !== '';
  const canSubmit = current !== '' && nextOk && repeatOk;
  const strength = passwordStrength(next);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await changeProvisionalPassword(email, current, next);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
      setSubmitting(false);
    }
  };

  return (
    <div className={intro.screen}>
      <div className={intro.column}>
        <p className={intro.eyebrow}>{T.eyebrow}</p>
        <h1 className={intro.title}>{T.tempTitle}</h1>
        <p className={blocks.lead}>
          {T.tempLine1}
          <br />
          {T.tempLine2}
        </p>

        <form noValidate onSubmit={submit}>
          <div className={form.grid} style={{ gridTemplateColumns: '1fr' }}>
            <div className={`${form.field} ${form.full}`}>
              <label className={form.label} htmlFor="current">
                {T.tempCurrent}
                <span className={form.required} aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="current"
                className={form.input}
                type="password"
                autoComplete="current-password"
                placeholder={T.tempCurrentPlaceholder}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>

            <div className={form.field}>
              <label className={form.label} htmlFor="newPassword">
                {T.newLabel}
                <span className={form.required} aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="newPassword"
                className={touched.next && !nextOk ? `${form.input} ${form.inputError}` : form.input}
                type="password"
                autoComplete="new-password"
                placeholder={T.newPlaceholder}
                value={next}
                aria-invalid={touched.next && !nextOk ? true : undefined}
                onChange={(e) => setNext(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, next: true }))}
              />
              <div
                className={form.meter}
                role="meter"
                aria-label="Fuerza de la contraseña"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={strength}
              >
                {[0, 1, 2, 3].map((index) => {
                  const lit = index < strength;
                  const className = lit
                    ? [form.bar, form.barOn, strength >= 4 ? form.barHot : ''].filter(Boolean).join(' ')
                    : form.bar;
                  return <span key={index} className={className} />;
                })}
              </div>
              <span className={touched.next && !nextOk ? `${form.hint} ${form.hintError}` : form.hint}>
                {touched.next && !nextOk ? PASSWORD_HINT : T.newHint}
              </span>
            </div>

            <div className={form.field}>
              <label className={form.label} htmlFor="repeatPassword">
                {T.repeatLabel}
                <span className={form.required} aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="repeatPassword"
                className={touched.repeat && !repeatOk ? `${form.input} ${form.inputError}` : form.input}
                type="password"
                autoComplete="new-password"
                placeholder={T.repeatPlaceholder}
                value={repeat}
                aria-invalid={touched.repeat && !repeatOk ? true : undefined}
                onChange={(e) => setRepeat(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, repeat: true }))}
              />
              <span className={touched.repeat && !repeatOk ? `${form.hint} ${form.hintError}` : form.hint}>
                {touched.repeat && !repeatOk ? PASSWORD_MISMATCH : T.repeatHint}
              </span>
            </div>
          </div>

          {error !== null && (
            <p className={form.alert} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={intro.primary} style={{ marginTop: 20 }} disabled={!canSubmit || submitting}>
            {submitting ? T.tempSubmitting : T.tempSubmit}
          </button>
          <button type="button" className={blocks.ghost} onClick={onSignOut}>
            {T.tempSignOut}
          </button>
        </form>
      </div>
    </div>
  );
}
