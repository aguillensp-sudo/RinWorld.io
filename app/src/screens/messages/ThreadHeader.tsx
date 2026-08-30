import { useEffect, useRef, useState } from 'react';
import { AGREEMENT_DISABLED_REASON, type ThreadDetail } from '../../lib/thread-detail';
import { canCloseThread, canRevertAgreement } from '../../lib/offers';
import { stateTone, type StateTone } from '../../lib/threads';
import styles from './ThreadHeader.module.css';

const STATE_CLASS: Record<StateTone, string | undefined> = {
  neutral: styles.stateNeutral,
  info: styles.stateInfo,
  warn: styles.stateWarn,
  success: styles.stateSuccess,
  closed: styles.stateClosed,
};

/**
 * Cabecera de MSG-02: breadcrumb, contraparte, badges de estado y país, y el
 * desplegable de acciones del hilo. Puramente presentacional; no monta ningún
 * diálogo — avisa por callback y la pantalla decide.
 */
export function ThreadHeader({
  detail,
  onBack,
  onOpenCounterparty,
  onClose,
  onRevert,
}: {
  detail: ThreadDetail;
  onBack: () => void;
  onOpenCounterparty: (orgId: string) => void;
  onClose: () => void;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.header}>
      {/*
        F-135 · el breadcrumb es un `nav` CON NOMBRE, y no es cosmética. En la
        aplicación entera hay TRES botones que se llaman `Hilos` —la barra
        superior, el menú lateral y este—, y sin nada que los separe el e2e solo
        podía cogerlo por `.first()`, que en orden de DOM es el de la barra: el
        test `el breadcrumb vuelve a la lista` llevaba desde que se escribió sin
        pulsar el breadcrumb ni una vez. Un landmark con `aria-label` es además
        el patrón estándar de un breadcrumb, así que se paga solo.
      */}
      <nav className={styles.breadcrumb} aria-label="Ruta">
        <button type="button" className={styles.crumbLink} onClick={onBack}>
          Hilos
        </button>
        <span className={styles.crumbSep}>›</span>
        <span className={styles.crumbCurrent}>{detail.counterpartyName}</span>
      </nav>

      <div className={styles.eyebrow}>Módulo 04 · Mensajería E2EE</div>

      <div className={styles.headRow}>
        <button
          type="button"
          className={styles.orgLink}
          onClick={() => onOpenCounterparty(detail.counterpartyId)}
        >
          {detail.counterpartyName}
        </button>
        <span className={`${styles.stateBadge} ${STATE_CLASS[stateTone(detail.state)] ?? ''}`}>
          {detail.state}
        </span>
        {/* F-041: el badge de país es el código ISO de dos letras, no el nombre. */}
        <span className={styles.countryBadge}>{detail.counterpartyCountry}</span>

        <div className={styles.actions} ref={rootRef}>
          <button
            type="button"
            className={styles.actionsButton}
            aria-expanded={open ? 'true' : 'false'}
            aria-haspopup="true"
            onClick={() => setOpen((value) => !value)}
          >
            Acciones del hilo
          </button>
          <div className={`${styles.dropdown} ${open ? styles.dropdownOpen : ''}`}>
            <div className={styles.actionItem}>
              <button type="button" className={styles.actionButton} disabled>
                Marcar acuerdo alcanzado
              </button>
              <span className={styles.reason}>{AGREEMENT_DISABLED_REASON}</span>
            </div>
            <div className={styles.actionItem}>
              <button
                type="button"
                className={styles.actionButton}
                disabled={!canCloseThread(detail.state)}
                onClick={onClose}
              >
                Cerrar sin acuerdo
              </button>
            </div>
            <div className={styles.actionItem}>
              <button
                type="button"
                className={styles.actionButton}
                disabled={!canRevertAgreement(detail.state)}
                onClick={onRevert}
              >
                Revertir a abierto
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
