import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import {
  DIAL_OPTIONS,
  EMAIL_TAKEN_ERROR,
  EMPTY_REGISTRATION_FORM,
  FIELD_META,
  INVALID_LINK_TEXTS,
  REGISTER_ERROR,
  REGISTRATION_COUNTRIES,
  REGISTRATION_FIELDS,
  REGISTRATION_TEXTS,
  VISIBILITY_OPTIONS,
  addBrand,
  addOperatingCountry,
  availableCountries,
  blurError,
  canSubmitRegistration,
  formFromPrefill,
  isAdminEmailAvailable,
  isFieldValid,
  missingRequiredText,
  passwordStrength,
  removeAt,
  submitErrors,
  submitRegistration,
  validateRegistrationLink,
  withHeadquarters,
} from '../../lib/register-org';
import type { RegistrationField, RegistrationForm } from '../../lib/register-org';
import styles from './OrgRegistration.module.css';

/**
 * REG-01 — FRO · Formulario de Registro de Organización (Ruta 00.2).
 *
 * Pantalla completa SIN shell: la ve quien llega con el enlace que el Operador
 * aprobó (`#registro?token=…`) y todavía no tiene sesión. Por eso es hija directa
 * de `#root` (ver el comentario de `.page` en el CSS Module: sin `overflow-y:
 * auto` propio, un formulario de 17 campos se recortaría sin barra).
 *
 * Sólo se pinta lo que el MVP tiene: barra de marca, cabecera mínima con el logo
 * y la tarjeta. Ni panel de VERA (sólo responde con sesión), ni shell, ni eyebrow,
 * ni referencia de pantalla, ni Google SSO ni subida de logo (los dos últimos se
 * enseñan desactivados con 'Próximamente': no hay proveedor ni almacenamiento).
 *
 * Posee todo el estado —la fase, los diecisiete valores, qué campos enseñan ya su
 * error, si está enviando, el error de envío y el email que se sabe ocupado— y es
 * el único sitio que llama a la red, con las tres funciones de `lib/register-org`.
 * Ni una regla de validación, ni un texto, ni la lista de países viven aquí.
 *
 * Fases: `loading` (el cuerpo es un `<div aria-busy>` sin nada más), `invalid`
 * (el enlace no vale: un `<h1>`, un `<p>` y el botón de volver) y `ready` (el
 * formulario). El alta la escribe la Edge Function `register-organization`: si
 * resuelve, `submitRegistration` deja la sesión iniciada y aquí sólo se llama a
 * `onRegistered()`.
 */
export function OrgRegistration({
  token,
  onRegistered,
  onBackToLogin,
}: {
  token: string;
  onRegistered: () => void;
  onBackToLogin: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [form, setForm] = useState<RegistrationForm>(EMPTY_REGISTRATION_FORM);
  const [errors, setErrors] = useState<Partial<Record<RegistrationField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [takenEmail, setTakenEmail] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState('');

  // El enlace se comprueba UNA vez al montar. Si el componente se va antes de
  // que conteste, la respuesta no toca el estado.
  useEffect(() => {
    let cancelled = false;
    validateRegistrationLink(token).then(
      (prefill) => {
        if (cancelled) return;
        setForm(formFromPrefill(prefill));
        setPhase('ready');
      },
      () => {
        if (cancelled) return;
        setPhase('invalid');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setValue = (patch: Partial<RegistrationForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const inputClass = (field: RegistrationField) =>
    errors[field] ? `${styles.input} ${styles.inputError}` : styles.input;

  // Un solo `<span>` de ayuda por campo: el error si lo hay, si no el hint. Con
  // error va en rojo y el campo lleva `aria-invalid` y borde rojo.
  const hintFor = (field: RegistrationField) => {
    const error = errors[field];
    return (
      <span
        id={`${field}-hint`}
        className={error ? `${styles.hint} ${styles.hintError}` : styles.hint}
      >
        {error ?? FIELD_META[field].hint}
      </span>
    );
  };

  const applyBlurError = (field: RegistrationField) => {
    const error = blurError(field, form);
    setErrors((current) => {
      const next = { ...current };
      if (error === null) {
        delete next[field];
      } else {
        next[field] = error;
      }
      return next;
    });
  };

  // Al salir de un campo, su error. Un campo vacío no se queja (`blurError`).
  // En `adminEmail`, además, se pregunta una vez si el email está libre: si ya
  // se sabe ocupado, el error se queda y no se vuelve a preguntar.
  const handleBlur = (field: RegistrationField) => {
    applyBlurError(field);
    if (field !== 'adminEmail') return;

    const email = form.adminEmail.trim().toLowerCase();
    if (email === '' || !isFieldValid('adminEmail', form)) return;
    if (email === takenEmail) {
      setErrors((current) => ({ ...current, adminEmail: EMAIL_TAKEN_ERROR }));
      return;
    }
    void isAdminEmailAvailable(token, form.adminEmail).then((available) => {
      if (available) return;
      setTakenEmail(email);
      setErrors((current) => ({ ...current, adminEmail: EMAIL_TAKEN_ERROR }));
    });
  };

  // Los países de operación se eligen de una lista: cada elección se añade a la caja y el
  // desplegable vuelve a su texto de ayuda (siempre `value=""`).
  const handleCountryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setValue({ operatingCountries: addOperatingCountry(form.operatingCountries, event.target.value) });
  };

  const handleBrandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    setValue({ brands: addBrand(form.brands, brandDraft) });
    setBrandDraft('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !canSubmitRegistration(form)) return;

    const nextErrors = submitErrors(form);
    if (takenEmail !== null && form.adminEmail.trim().toLowerCase() === takenEmail) {
      nextErrors.adminEmail = EMAIL_TAKEN_ERROR;
    }

    const firstError = REGISTRATION_FIELDS.find((field) => nextErrors[field] !== undefined);
    if (firstError !== undefined) {
      setErrors(nextErrors);
      document.getElementById(firstError)?.focus();
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitRegistration(token, form);
      onRegistered();
    } catch (error) {
      const message = error instanceof Error ? error.message : REGISTER_ERROR;
      setSubmitError(message);
      if (message.toLowerCase().includes('ya tiene cuenta')) {
        setTakenEmail(form.adminEmail.trim().toLowerCase());
        setErrors({ adminEmail: EMAIL_TAKEN_ERROR });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const strength = passwordStrength(form.password);
  const canSubmit = canSubmitRegistration(form);
  const missingRequired = missingRequiredText(form);

  const countryLabel = (code: string) =>
    REGISTRATION_COUNTRIES.find((option) => option.code === code)?.label ?? code;

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
        {phase === 'loading' && <div aria-busy="true" />}

        {phase === 'invalid' && (
          <div className={styles.card}>
            <h1 className={styles.title}>{INVALID_LINK_TEXTS.title}</h1>
            <p className={styles.subtitle}>{INVALID_LINK_TEXTS.message}</p>
            <button type="button" className={styles.submit} onClick={onBackToLogin}>
              {INVALID_LINK_TEXTS.back}
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <div className={styles.card}>
            <span className={styles.corner} aria-hidden="true" />
            <span className={styles.corner} aria-hidden="true" />
            <span className={styles.corner} aria-hidden="true" />
            <span className={styles.corner} aria-hidden="true" />

            <form noValidate onSubmit={handleSubmit}>
              <h1 className={styles.title}>{REGISTRATION_TEXTS.title}</h1>
              <p className={styles.subtitle}>
                {REGISTRATION_TEXTS.subtitleLine1}
                <br />
                {REGISTRATION_TEXTS.subtitleLine2}
              </p>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>{REGISTRATION_TEXTS.section1}</span>
              </div>

              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="legalName">
                    {FIELD_META.legalName.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="legalName"
                    className={inputClass('legalName')}
                    type="text"
                    placeholder={FIELD_META.legalName.placeholder}
                    maxLength={FIELD_META.legalName.maxLength}
                    value={form.legalName}
                    aria-invalid={errors.legalName ? true : undefined}
                    aria-describedby="legalName-hint"
                    onChange={(event) => setValue({ legalName: event.target.value })}
                    onBlur={() => handleBlur('legalName')}
                  />
                  {hintFor('legalName')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="taxId">
                    <span className={styles.lockIcon} aria-hidden="true">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    {FIELD_META.taxId.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                    <span className={styles.sensitiveTag}>{REGISTRATION_TEXTS.sensitiveTag}</span>
                  </label>
                  <input
                    id="taxId"
                    className={inputClass('taxId')}
                    type="text"
                    placeholder={FIELD_META.taxId.placeholder}
                    maxLength={FIELD_META.taxId.maxLength}
                    value={form.taxId}
                    aria-invalid={errors.taxId ? true : undefined}
                    aria-describedby="taxId-hint"
                    onChange={(event) => setValue({ taxId: event.target.value })}
                    onBlur={() => handleBlur('taxId')}
                  />
                  {hintFor('taxId')}
                </div>

                <div className={styles.addrRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="address">
                      {FIELD_META.address.label}
                      <span className={styles.required} aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="address"
                      className={inputClass('address')}
                      type="text"
                      placeholder={FIELD_META.address.placeholder}
                      maxLength={FIELD_META.address.maxLength}
                      value={form.address}
                      aria-invalid={errors.address ? true : undefined}
                      aria-describedby="address-hint"
                      onChange={(event) => setValue({ address: event.target.value })}
                      onBlur={() => handleBlur('address')}
                    />
                    {hintFor('address')}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="postalCode">
                      {FIELD_META.postalCode.label}
                      <span className={styles.required} aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="postalCode"
                      className={inputClass('postalCode')}
                      type="text"
                      placeholder={FIELD_META.postalCode.placeholder}
                      maxLength={FIELD_META.postalCode.maxLength}
                      value={form.postalCode}
                      aria-invalid={errors.postalCode ? true : undefined}
                      aria-describedby="postalCode-hint"
                      onChange={(event) => setValue({ postalCode: event.target.value })}
                      onBlur={() => handleBlur('postalCode')}
                    />
                    {hintFor('postalCode')}
                  </div>
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="country">
                    {FIELD_META.country.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <select
                    id="country"
                    className={
                      errors.country
                        ? `${styles.select} ${styles.inputError}`
                        : styles.select
                    }
                    value={form.country}
                    aria-invalid={errors.country ? true : undefined}
                    aria-describedby="country-hint"
                    onChange={(event) =>
                      setForm((current) => withHeadquarters(current, event.target.value))
                    }
                    onBlur={() => handleBlur('country')}
                  >
                    <option value="" disabled>
                      {FIELD_META.country.placeholder}
                    </option>
                    {REGISTRATION_COUNTRIES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {hintFor('country')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="contactEmail">
                    {FIELD_META.contactEmail.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="contactEmail"
                    className={inputClass('contactEmail')}
                    type="email"
                    placeholder={FIELD_META.contactEmail.placeholder}
                    maxLength={FIELD_META.contactEmail.maxLength}
                    value={form.contactEmail}
                    aria-invalid={errors.contactEmail ? true : undefined}
                    aria-describedby="contactEmail-hint"
                    onChange={(event) => setValue({ contactEmail: event.target.value })}
                    onBlur={() => handleBlur('contactEmail')}
                  />
                  {hintFor('contactEmail')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="phoneNumber">
                    {FIELD_META.phoneNumber.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className={styles.telRow}>
                    <select
                      className={styles.select}
                      aria-label="Prefijo telefónico"
                      value={form.phoneDial}
                      onChange={(event) => setValue({ phoneDial: event.target.value })}
                    >
                      {form.phoneDial === '' && <option value="" disabled />}
                      {DIAL_OPTIONS.map(({ code, label }) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      id="phoneNumber"
                      className={inputClass('phoneNumber')}
                      type="tel"
                      placeholder={FIELD_META.phoneNumber.placeholder}
                      value={form.phoneNumber}
                      aria-invalid={errors.phoneNumber ? true : undefined}
                      aria-describedby="phoneNumber-hint"
                      onChange={(event) => setValue({ phoneNumber: event.target.value })}
                      onBlur={() => handleBlur('phoneNumber')}
                    />
                  </div>
                  {hintFor('phoneNumber')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="website">
                    {FIELD_META.website.label}
                  </label>
                  <input
                    id="website"
                    className={inputClass('website')}
                    type="url"
                    placeholder={FIELD_META.website.placeholder}
                    value={form.website}
                    aria-invalid={errors.website ? true : undefined}
                    aria-describedby="website-hint"
                    onChange={(event) => setValue({ website: event.target.value })}
                    onBlur={() => handleBlur('website')}
                  />
                  {hintFor('website')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="operatingCountries">
                    {FIELD_META.operatingCountries.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <select
                    id="operatingCountries"
                    className={
                      errors.operatingCountries
                        ? `${styles.input} ${styles.select} ${styles.inputError}`
                        : `${styles.input} ${styles.select}`
                    }
                    value=""
                    aria-invalid={errors.operatingCountries ? true : undefined}
                    aria-describedby="operatingCountries-hint"
                    onChange={handleCountryChange}
                    onBlur={() => handleBlur('operatingCountries')}
                  >
                    <option value="" disabled>
                      {FIELD_META.operatingCountries.placeholder}
                    </option>
                    {availableCountries(form.operatingCountries).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div
                    className={
                      errors.operatingCountries
                        ? `${styles.tagsBox} ${styles.inputError}`
                        : styles.tagsBox
                    }
                    role="group"
                    aria-label="Países añadidos"
                  >
                    {form.operatingCountries.map((code, index) => {
                      const label = countryLabel(code);
                      return (
                        <span key={code} className={styles.tag}>
                          {label}
                          <button
                            type="button"
                            className={styles.tagRemove}
                            aria-label={`Eliminar ${label}`}
                            onClick={() =>
                              setValue({
                                operatingCountries: removeAt(form.operatingCountries, index),
                              })
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {hintFor('operatingCountries')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="brands">
                    {FIELD_META.brands.label}
                  </label>
                  <div className={styles.tagsBox}>
                    {form.brands.map((brand, index) => (
                      <span key={brand} className={styles.tag}>
                        {brand}
                        <button
                          type="button"
                          className={styles.tagRemove}
                          aria-label={`Eliminar ${brand}`}
                          onClick={() =>
                            setValue({ brands: removeAt(form.brands, index) })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      id="brands"
                      className={styles.tagInput}
                      type="text"
                      placeholder={FIELD_META.brands.placeholder}
                      maxLength={FIELD_META.brands.maxLength}
                      value={brandDraft}
                      aria-describedby="brands-hint"
                      onChange={(event) => setBrandDraft(event.target.value)}
                      onKeyDown={handleBrandKeyDown}
                    />
                  </div>
                  <span id="brands-hint" className={styles.hint}>
                    {FIELD_META.brands.hint}
                  </span>
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label}>{FIELD_META.logo.label}</label>
                  <input type="file" disabled hidden />
                  <div className={styles.fileBlock}>
                    <span className={styles.fileIcon} aria-hidden="true">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </span>
                    <span className={styles.fileText}>
                      <span className={styles.fileTitle}>{REGISTRATION_TEXTS.logoTitle}</span>
                      <span className={styles.fileHint}>{REGISTRATION_TEXTS.logoHint}</span>
                    </span>
                    <span className={styles.soon}>{REGISTRATION_TEXTS.soon}</span>
                  </div>
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <span className={styles.label}>{REGISTRATION_TEXTS.visibilityLabel}</span>
                  <div
                    className={styles.radio}
                    role="radiogroup"
                    aria-label={REGISTRATION_TEXTS.visibilityLabel}
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <label key={option.value} className={styles.radioOption}>
                        <input
                          type="radio"
                          name="visibility"
                          value={option.value}
                          checked={form.visibility === option.value}
                          onChange={() => setValue({ visibility: option.value })}
                        />
                        <span className={styles.radioLabel}>{option.label}</span>
                        <span className={styles.radioDesc}>{option.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>{REGISTRATION_TEXTS.section2}</span>
              </div>

              <div className={styles.notice}>
                <svg
                  className={styles.noticeIcon}
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  {REGISTRATION_TEXTS.roleNoticeBefore}
                  <strong>{REGISTRATION_TEXTS.roleNoticeStrong}</strong>
                  {REGISTRATION_TEXTS.roleNoticeAfter}
                </div>
              </div>

              <button type="button" className={styles.google} disabled>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    style={{ fill: 'var(--bw-calibration-blue)' }}
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  />
                  <path
                    style={{ fill: 'var(--bw-signal-green)' }}
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                  />
                  <path
                    style={{ fill: 'var(--bw-warning)' }}
                    d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V6.958H.957C.347 8.173 0 9.548 0 11s.348 2.827.957 4.042l3.007-2.332z"
                  />
                  <path
                    style={{ fill: 'var(--bw-danger)' }}
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  />
                </svg>
                {REGISTRATION_TEXTS.google}
                <span className={styles.soon}>{REGISTRATION_TEXTS.soon}</span>
              </button>

              <div className={styles.or}>{REGISTRATION_TEXTS.or}</div>

              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="adminName">
                    {FIELD_META.adminName.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="adminName"
                    className={inputClass('adminName')}
                    type="text"
                    placeholder={FIELD_META.adminName.placeholder}
                    maxLength={FIELD_META.adminName.maxLength}
                    value={form.adminName}
                    aria-invalid={errors.adminName ? true : undefined}
                    aria-describedby="adminName-hint"
                    onChange={(event) => setValue({ adminName: event.target.value })}
                    onBlur={() => handleBlur('adminName')}
                  />
                  {hintFor('adminName')}
                </div>

                <div className={`${styles.field} ${styles.full}`}>
                  <label className={styles.label} htmlFor="adminEmail">
                    {FIELD_META.adminEmail.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="adminEmail"
                    className={inputClass('adminEmail')}
                    type="email"
                    placeholder={FIELD_META.adminEmail.placeholder}
                    value={form.adminEmail}
                    aria-invalid={errors.adminEmail ? true : undefined}
                    aria-describedby="adminEmail-hint"
                    onChange={(event) => setValue({ adminEmail: event.target.value })}
                    onBlur={() => handleBlur('adminEmail')}
                  />
                  {hintFor('adminEmail')}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="password">
                    {FIELD_META.password.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="password"
                    className={inputClass('password')}
                    type="password"
                    placeholder={FIELD_META.password.placeholder}
                    value={form.password}
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby="password-hint"
                    onChange={(event) => setValue({ password: event.target.value })}
                    onBlur={() => handleBlur('password')}
                  />
                  <div
                    className={styles.meter}
                    role="meter"
                    aria-label="Fuerza de la contraseña"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={strength}
                  >
                    {[0, 1, 2, 3].map((index) => {
                      const lit = index < strength;
                      const className = lit
                        ? [styles.bar, styles.barOn, strength >= 4 ? styles.barHot : '']
                            .filter(Boolean)
                            .join(' ')
                        : styles.bar;
                      return <span key={index} className={className} />;
                    })}
                  </div>
                  {hintFor('password')}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="passwordRepeat">
                    {FIELD_META.passwordRepeat.label}
                    <span className={styles.required} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="passwordRepeat"
                    className={inputClass('passwordRepeat')}
                    type="password"
                    placeholder={FIELD_META.passwordRepeat.placeholder}
                    value={form.passwordRepeat}
                    aria-invalid={errors.passwordRepeat ? true : undefined}
                    aria-describedby="passwordRepeat-hint"
                    onChange={(event) => setValue({ passwordRepeat: event.target.value })}
                    onBlur={() => handleBlur('passwordRepeat')}
                  />
                  {hintFor('passwordRepeat')}
                </div>

                <label className={styles.terms}>
                  <input
                    className={styles.termsInput}
                    type="checkbox"
                    checked={form.acceptedTerms}
                    onChange={(event) => setValue({ acceptedTerms: event.target.checked })}
                  />
                  <span className={styles.termsText}>
                    {REGISTRATION_TEXTS.termsBefore}
                    <strong>{REGISTRATION_TEXTS.termsLink}</strong>
                    {REGISTRATION_TEXTS.termsAfter}
                  </span>
                </label>
              </div>

              {missingRequired !== null && (
                <p className={styles.missing} role="status">
                  {missingRequired}
                </p>
              )}

              {submitError !== null && (
                <p className={styles.alert} role="alert">
                  {submitError}
                </p>
              )}

              <button type="submit" className={styles.submit} disabled={!canSubmit || submitting}>
                {submitting ? REGISTRATION_TEXTS.submitting : REGISTRATION_TEXTS.submit}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
