import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ACCESS_REQUEST_FIELDS,
  COUNTRY_OPTIONS,
  EMPTY_ACCESS_REQUEST,
  FIELD_META,
  blurError,
  canSubmitAccessRequest,
  submitAccessRequest,
} from '../../lib/access-request';
import type { AccessRequestField, AccessRequestForm, SubmittedAccessRequest } from '../../lib/access-request';
import styles from './AccessRequest.module.css';

/**
 * REG-00 — FSR · Formulario de Solicitud de Registro (Módulo 01, Ruta 00.2).
 *
 * Página completa SIN shell: es lo que ve quien no tiene sesión ni enlace de
 * invitación, así que no hay sidebar, ni top nav, ni VERA (el asistente solo
 * responde con sesión). Solo barra de marca, cabecera mínima con el logo y la
 * tarjeta blanca centrada.
 *
 * Aquí vive TODO el estado del formulario (los seis valores, los errores ya
 * visibles, si está enviando y el error de envío) y aquí está la ÚNICA llamada a
 * la red: `submitAccessRequest`, una vez por intento. Nada de validación propia:
 * la verdad es `app/src/lib/access-request.ts`.
 *
 * El error de un campo se enseña SOLO al salir de él (`onBlur` → `blurError`),
 * que es la regla del HTML aprobado; como el botón está deshabilitado hasta que
 * los seis valen, no hay un "intentar enviar" que pueda sembrar errores de golpe.
 *
 * El estado "en vuelo" (`submitting`) se enciende de forma SÍNCRONA dentro del
 * propio `submit`, y el botón queda `disabled` en el mismo lote de React: quien
 * mire el DOM justo después del clic ya lo ve deshabilitado, sin esperar a que la
 * red conteste.
 */

/** Un mensaje de error visible por campo; `null` = ese campo no se queja. */
type FieldErrors = Record<AccessRequestField, string | null>;

const NO_ERRORS: FieldErrors = {
  email: null,
  fullName: null,
  orgName: null,
  country: null,
  phone: null,
  website: null,
};

/** El `type` del `<input>` de cada campo (`country` es un `<select>` y no lo usa). */
const INPUT_TYPES: Record<AccessRequestField, 'email' | 'text' | 'url'> = {
  email: 'email',
  fullName: 'text',
  orgName: 'text',
  country: 'text',
  phone: 'text',
  website: 'url',
};

/** El `autocomplete` del HTML aprobado, campo a campo. */
const AUTOCOMPLETE: Record<AccessRequestField, string> = {
  email: 'email',
  fullName: 'name',
  orgName: 'organization',
  country: 'country',
  phone: 'tel',
  website: 'url',
};

/**
 * Las 194 opciones de país se construyen UNA vez, al cargar el módulo, y no en
 * cada render. Son datos constantes: si se crearan dentro del render, cada tecla
 * de cualquiera de los otros cinco campos volvería a construir (y a reconciliar)
 * 194 nodos del `select`. Al ser siempre los mismos elementos, React reutiliza el
 * subárbol entero.
 */
const COUNTRY_OPTION_ELEMENTS = COUNTRY_OPTIONS.map(([code, text]) => (
  <option key={code} value={code}>
    {text}
  </option>
));

export function AccessRequest({
  onSubmitted,
  onHaveInvitation,
}: {
  onSubmitted: (request: SubmittedAccessRequest) => void;
  onHaveInvitation: () => void;
}) {
  const [form, setForm] = useState<AccessRequestForm>(EMPTY_ACCESS_REQUEST);
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange =
    (field: AccessRequestField) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setForm((previous) => ({ ...previous, [field]: value }));
    };

  const handleBlur = (field: AccessRequestField) => () => {
    setErrors((previous) => ({ ...previous, [field]: blurError(field, form[field]) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Intro dentro de un campo también pasa por aquí: se envía solo si los seis
    // valen y no hay ya un envío en vuelo.
    if (submitting || !canSubmitAccessRequest(form)) return;

    // Síncrono y antes de tocar la red: el botón se deshabilita ya.
    setSubmitting(true);
    // Un reintento empieza limpio: el alert del intento anterior se borra.
    setSubmitError(null);
    try {
      const result = await submitAccessRequest(form);
      onSubmitted(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !canSubmitAccessRequest(form);

  return (
    <main className={styles.page}>
      <div className={styles.brandBar}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>

      {/* Cabecera mínima: solo el logo. Sin menú, sin navegación, sin VERA. */}
      <header className={styles.header}>
        <img className={styles.logo} src="/intentologo.png" alt="Bearingworld.io" />
      </header>

      <div className={styles.body}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Módulo 01 · Onboarding</p>
          <h1 className={styles.title}>Solicita acceso a Bearingworld.io</h1>
          <p className={styles.subtitle}>
            Nuestro equipo revisará tu solicitud y te contactará en un plazo máximo de 48 horas.
          </p>

          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            {ACCESS_REQUEST_FIELDS.map((field) => {
              const meta = FIELD_META[field];
              const id = `access-request-${field}`;
              const errorId = `${id}-error`;
              const error = errors[field];

              return (
                <div key={field} className={styles.field}>
                  <label className={styles.label} htmlFor={id}>
                    {meta.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  {field === 'country' ? (
                    <select
                      id={id}
                      name={field}
                      className={error !== null ? `${styles.select} ${styles.inputError}` : styles.select}
                      autoComplete={AUTOCOMPLETE[field]}
                      value={form[field]}
                      onChange={handleChange(field)}
                      onBlur={handleBlur(field)}
                      aria-invalid={error !== null ? true : undefined}
                      aria-describedby={error !== null ? errorId : undefined}
                    >
                      <option value="" disabled>
                        Selecciona un país
                      </option>
                      {COUNTRY_OPTION_ELEMENTS}
                    </select>
                  ) : (
                    <input
                      id={id}
                      name={field}
                      className={error !== null ? `${styles.input} ${styles.inputError}` : styles.input}
                      type={INPUT_TYPES[field]}
                      placeholder={meta.placeholder}
                      maxLength={meta.maxLength}
                      autoComplete={AUTOCOMPLETE[field]}
                      value={form[field]}
                      onChange={handleChange(field)}
                      onBlur={handleBlur(field)}
                      aria-invalid={error !== null ? true : undefined}
                      aria-describedby={error !== null ? errorId : undefined}
                    />
                  )}
                  {error !== null && (
                    <span id={errorId} className={styles.error}>
                      {error}
                    </span>
                  )}
                </div>
              );
            })}

            {submitError !== null && (
              <p className={styles.alert} role="alert">
                {submitError}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={submitDisabled}>
              Enviar solicitud
            </button>
          </form>

          {/* Único cruce visible hacia la Ruta 00.1. La validación del token
              (REG-01) no existe todavía: solo se avisa al wiring. */}
          <button type="button" className={styles.invitation} onClick={onHaveInvitation}>
            ¿Tienes un enlace de invitación? Accede directamente →
          </button>
        </div>
      </div>
    </main>
  );
}
