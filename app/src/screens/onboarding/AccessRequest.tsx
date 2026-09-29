import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ACCESS_REQUEST_FIELDS,
  COUNTRY_OPTIONS,
  EMPTY_ACCESS_REQUEST,
  FIELD_META,
  blurError,
  canSubmitAccessRequest,
  phoneForCountry,
  submitAccessRequest,
} from '../../lib/access-request';
import type { AccessRequestField, AccessRequestForm, SubmittedAccessRequest } from '../../lib/access-request';
import styles from './AccessRequest.module.css';

/**
 * REG-00 — FSR · Formulario de Solicitud de Registro (Ruta 00.2).
 *
 * Pantalla completa sin shell: la ve quien no tiene sesión ni invitación, y por
 * eso es hija directa de `#root` (ver el comentario de `.page` en el CSS Module:
 * sin `overflow-y: auto` propio un formulario más alto que la ventana se
 * recortaría sin barra).
 *
 * Posee todo el estado del formulario —los seis valores, qué campos enseñan ya su
 * error, si está enviando y el error de envío— y es el único sitio que llama a la
 * red, con `submitAccessRequest(form)`. Ni la validación, ni los textos de error,
 * ni la lista de países, ni el recorte de los datos viven aquí: todo eso es
 * `lib/access-request.ts`, que se importa tal cual.
 *
 * El error de un campo se enseña SOLO al salir de él (`onBlur`, con
 * `blurError`): al abrir no hay ningún error visible, y el botón está
 * deshabilitado hasta que los seis valen, así que no hay un "intentar enviar"
 * con huecos.
 *
 * Lo que el HTML aprobado enseña y el MVP no tiene (y por eso NO se pinta): el
 * panel de VERA (spec §5 — VERA solo responde con sesión), la Ruta 00.1 (el
 * enlace solo llama a `onHaveInvitation()`) y REG-00-WAIT (aquí el éxito solo
 * llama a `onSubmitted(resultado)`).
 */
export function AccessRequest({
  onSubmitted,
  onHaveInvitation,
}: {
  onSubmitted: (request: SubmittedAccessRequest) => void;
  onHaveInvitation: () => void;
}) {
  const [form, setForm] = useState<AccessRequestForm>(EMPTY_ACCESS_REQUEST);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AccessRequestField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = canSubmitAccessRequest(form);

  const setField = (field: AccessRequestField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // El error se calcula con el helper de la capa de datos y se guarda: si es
  // `null` no se pinta nada y el campo no lleva `aria-invalid`.
  const handleBlur = (field: AccessRequestField) => {
    const error = blurError(field, form[field]);
    setFieldErrors((current) => {
      const next = { ...current };
      if (error === null) {
        delete next[field];
      } else {
        next[field] = error;
      }
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    // Un reintento borra el alert anterior.
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

  return (
    <div className={styles.page}>
      <div className={styles.brandBar}>
        <div>ZERO KNOWLEDGE ARCHITECTURE · CRYPTOGRAPHIC SECURITY</div>
        <div>CONNECT · TRADE · SECURE</div>
        <div>INDUSTRIAL INTELLIGENCE NETWORK</div>
      </div>

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
              const error = fieldErrors[field];
              const inputId = `access-request-${field}`;
              const errorId = `${inputId}-error`;
              const invalid = error !== undefined;
              return (
                <div key={field} className={styles.field}>
                  <label className={styles.label} htmlFor={inputId}>
                    {meta.label}
                    <span className={styles.required} aria-hidden="true">*</span>
                  </label>
                  {field === 'country' ? (
                    <select
                      id={inputId}
                      className={[
                        styles.input,
                        styles.select,
                        form.country === '' ? styles.selectEmpty : '',
                        invalid ? styles.inputError : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      name={field}
                      value={form.country}
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={invalid ? errorId : undefined}
                      onChange={(event) => {
                        // Petición del PO en la C5 (29-sep): al elegir país, el teléfono
                        // muestra su prefijo (`+34 `) y sigue siendo editable.
                        const country = event.target.value;
                        setForm((current) => ({
                          ...current,
                          country,
                          phone: phoneForCountry(current.phone, current.country, country),
                        }));
                      }}
                      onBlur={() => handleBlur(field)}
                    >
                      <option value="" disabled>
                        Selecciona un país
                      </option>
                      {COUNTRY_OPTIONS.map(([code, text]) => (
                        <option key={code} value={code}>
                          {text}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      className={[styles.input, invalid ? styles.inputError : ''].filter(Boolean).join(' ')}
                      type={field === 'email' ? 'email' : field === 'website' ? 'url' : 'text'}
                      name={field}
                      placeholder={meta.placeholder}
                      maxLength={meta.maxLength}
                      value={form[field]}
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={invalid ? errorId : undefined}
                      onChange={(event) => setField(field, event.target.value)}
                      onBlur={() => handleBlur(field)}
                    />
                  )}
                  {invalid && (
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

            <button type="submit" className={styles.submit} disabled={!canSubmit || submitting}>
              Enviar solicitud
            </button>
          </form>

          <div className={styles.invitation}>
            <button type="button" onClick={onHaveInvitation}>
              ¿Tienes un enlace de invitación? Accede directamente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
