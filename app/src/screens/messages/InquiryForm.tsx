import { useId, useState, type FormEvent } from 'react';

import {
  INQUIRY_FORM_TEXTS,
  NOTES_MAX,
  inquiryDraft,
  inquiryFormView,
  type InquiryDraft,
} from '../../lib/inquiry-form';
import styles from './InquiryForm.module.css';

const T = INQUIRY_FORM_TEXTS;

export function InquiryForm({
  reference,
  brand,
  country,
  duplicate,
  busy,
  error,
  onSubmit,
  onCancel,
  initialQuantity = '',
  initialNotes = '',
}: {
  reference: string;
  brand: string;
  country: string;
  duplicate: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: InquiryDraft) => void;
  onCancel: () => void;
  /** Valores con los que arranca el formulario (VERA los rellena, F-249; el usuario los revisa). */
  initialQuantity?: string;
  initialNotes?: string;
}) {
  const [quantityText, setQuantityText] = useState(initialQuantity);
  const [notesText, setNotesText] = useState(initialNotes);

  const uid = useId();
  const titleId = `${uid}-title`;
  const referenceId = `${uid}-reference`;
  const brandId = `${uid}-brand`;
  const countryId = `${uid}-country`;
  const quantityId = `${uid}-quantity`;
  const notesId = `${uid}-notes`;

  const view = inquiryFormView(quantityText, notesText, { duplicate, busy });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const draft = inquiryDraft(quantityText, notesText);
    if (view.canSubmit && draft !== null) onSubmit(draft);
  };

  return (
    <form className={styles.form} aria-labelledby={titleId} noValidate onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {T.title}
        </h2>
        <p className={styles.subtitle}>{T.subtitle}</p>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <div className={styles.group}>
            <label htmlFor={referenceId} className={styles.label}>
              {T.referenceLabel}
              <span aria-hidden="true" className={styles.required}>
                *
              </span>
            </label>
            <input
              id={referenceId}
              type="text"
              readOnly
              className={`${styles.input} ${styles.readonly}`}
              value={reference}
            />
            <span className={styles.hint}>{T.inheritedHint}</span>
          </div>

          <div className={styles.group}>
            <label htmlFor={brandId} className={styles.label}>
              {T.brandLabel}
              <span aria-hidden="true" className={styles.required}>
                *
              </span>
            </label>
            <input
              id={brandId}
              type="text"
              readOnly
              className={`${styles.input} ${styles.readonly}`}
              value={brand}
            />
            <span className={styles.hint}>{T.inheritedHint}</span>
          </div>
        </div>

        <div className={`${styles.row} ${styles.rowFull}`}>
          <div className={styles.group}>
            <label htmlFor={countryId} className={styles.label}>
              {T.countryLabel}
              <span aria-hidden="true" className={styles.required}>
                *
              </span>
            </label>
            <input
              id={countryId}
              type="text"
              readOnly
              className={`${styles.input} ${styles.readonly}`}
              value={country}
            />
            <span className={styles.hint}>{T.countryHint}</span>
          </div>
        </div>

        <div className={`${styles.row} ${styles.rowFull}`}>
          <div className={styles.group}>
            <label htmlFor={quantityId} className={styles.label}>
              {T.quantityLabel}
              <span aria-hidden="true" className={styles.required}>
                *
              </span>
            </label>
            <input
              id={quantityId}
              type="number"
              inputMode="numeric"
              step={1}
              className={styles.input}
              value={quantityText}
              aria-invalid={view.quantityError !== null}
              onChange={(e) => setQuantityText(e.target.value)}
            />
            <span className={styles.hint}>{T.quantityHint}</span>
            {view.quantityError !== null && (
              <span className={styles.fieldError}>{view.quantityError}</span>
            )}
          </div>
        </div>

        <div className={`${styles.row} ${styles.rowFull}`}>
          <div className={styles.group}>
            <label htmlFor={notesId} className={styles.label}>
              {T.notesLabel}
            </label>
            <textarea
              id={notesId}
              className={styles.textarea}
              maxLength={NOTES_MAX}
              placeholder={T.notesPlaceholder}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
        </div>

        {duplicate && (
          <div role="alert" className={styles.banner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7.4v5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="12" cy="16.3" r="1" fill="currentColor" />
            </svg>
            {T.duplicateWarning}
          </div>
        )}

        {error !== null && (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="submit" className={styles.submit} disabled={!view.canSubmit}>
          {busy ? T.sending : T.submit}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          {T.cancel}
        </button>
        <span className={styles.encrypt}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="4.5"
              y="10.5"
              width="15"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {T.encryptHint}
        </span>
      </div>
    </form>
  );
}
