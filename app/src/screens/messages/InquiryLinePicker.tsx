import { useEffect, useRef, useState } from 'react';
import { SearchField } from '../../components/SearchField';
import { INQUIRY_PICKER_TEXTS as T } from '../../lib/inquiry-form';
import { ORG_LINES_LIMIT, countryName, fetchOrgLines, quantityLabel, type OrgLine } from '../../lib/search';
import { errorMessage } from '../../lib/session';
import styles from './InquiryLinePicker.module.css';

/**
 * `Crear consulta` dentro del hilo (MSG-03 §3.2, F-249): el paso previo al formulario. Una consulta
 * se hace SIEMPRE sobre una línea de inventario concreta (`create_inquiry` la exige), así que desde el
 * hilo hay que elegir primero cuál. Lista las líneas publicadas de la contraparte; las que ya tienen
 * una consulta mía pendiente salen apagadas y con su motivo, no ocultas.
 *
 * Escrito a mano: pide datos y decide qué se puede elegir, que no es trabajo del arnés.
 */
export function InquiryLinePicker({
  counterpartyId,
  counterpartyName,
  ownOrgId,
  onPick,
  onCancel,
  initialTerm = '',
  autoPick,
}: {
  counterpartyId: string;
  counterpartyName: string;
  ownOrgId: string;
  onPick: (line: OrgLine) => void;
  onCancel: () => void;
  /** Búsqueda con la que arranca (VERA la rellena con la referencia que dijo el usuario, F-249). */
  initialTerm?: string;
  /**
   * Si está, y tras la PRIMERA carga hay exactamente una línea elegible (sin consulta pendiente y, si se
   * dijo marca, de esa marca), se elige sola. Con cero o varias no se elige nada: lo decide el usuario.
   */
  autoPick?: { brand: string };
}) {
  const [draft, setDraft] = useState(initialTerm);
  /** Lo que se ha buscado de verdad (Intro o lupa), no lo que hay escrito. */
  const [term, setTerm] = useState(initialTerm);
  const [lines, setLines] = useState<OrgLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setLines(null);
    setError(null);
    fetchOrgLines(counterpartyId, ownOrgId, term)
      .then((l) => {
        if (vigente) setLines(l);
      })
      .catch((e: unknown) => {
        if (vigente) setError(errorMessage(e));
      });
    return () => {
      vigente = false;
    };
  }, [counterpartyId, ownOrgId, term]);

  const autoPicked = useRef(false);
  useEffect(() => {
    if (!autoPick || lines === null || autoPicked.current) return;
    autoPicked.current = true;
    const marca = autoPick.brand.trim().toLowerCase();
    const elegibles = lines.filter((l) => !l.consulted && (marca === '' || l.brand.toLowerCase() === marca));
    if (elegibles.length === 1 && elegibles[0]) onPick(elegibles[0]);
  }, [autoPick, lines, onPick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="inquiry-picker-title">
        <h2 id="inquiry-picker-title" className={styles.title}>
          {T.title}
        </h2>
        <p className={styles.hint}>{T.hint(counterpartyName)}</p>

        <SearchField
          value={draft}
          onChange={setDraft}
          onSubmit={() => setTerm(draft)}
          placeholder={T.searchPlaceholder}
          inputLabel={T.searchLabel}
          submitLabel={T.searchSubmit}
        />

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {error === null && lines === null && (
          <p className={styles.note} aria-busy="true">
            {T.loading}
          </p>
        )}

        {lines !== null && lines.length === 0 && (
          <p className={styles.note}>{term.trim() === '' ? T.empty : T.noMatches}</p>
        )}

        {lines !== null && lines.length > 0 && (
          <ul className={styles.list}>
            {lines.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className={styles.line}
                  disabled={l.consulted}
                  {...(l.consulted ? { title: T.pendingWhy } : {})}
                  onClick={() => onPick(l)}
                >
                  <span className={styles.ref}>{l.partNumber}</span>
                  <span className={styles.brand}>{l.brand}</span>
                  <span className={styles.meta}>
                    {countryName(l.country)} · {quantityLabel(l.quantity)} u
                  </span>
                  {l.consulted && <span className={styles.tag}>{T.pending}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {lines !== null && lines.length >= ORG_LINES_LIMIT && (
          <p className={styles.note}>{T.limit(ORG_LINES_LIMIT)}</p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {T.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
