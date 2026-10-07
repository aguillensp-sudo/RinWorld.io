import { useEffect, useRef, useState } from 'react';
import { expiryText } from '../../lib/invitation-link';
import styles from './RemoveMemberDialog.module.css';

interface Props {
  email: string;
  url: string;
  expiresAt: string;
  onClose: () => void;
  /** Para tests. */
  now?: Date;
}

const TITLE_ID = 'invitation-link-title';
const TITLE = 'Enlace de invitación';
const ONCE = 'Cópialo ahora: no se vuelve a mostrar.';

/**
 * El enlace de una invitación (INVT-02), visible UNA vez. Presentacional: no llama a la red.
 *
 * Sin proveedor de correo (F-212) el ADMIN es quien se lo pasa al invitado, así que el texto
 * nunca afirma que se ha enviado nada. Cerrarlo lo olvida: el servidor solo guarda el hash, y si
 * se pierde hay que pedir otro (`Nuevo enlace`), que revoca este.
 */
export function InvitationLinkDialog({ email, url, expiresAt, onClose, now }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const expiry = expiryText(expiresAt, now);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // Sin permiso de portapapeles: el campo ya está seleccionado para copiarlo a mano.
      setCopyFailed(true);
      inputRef.current?.select();
    }
  }

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className={styles.dialog}>
        <h2 id={TITLE_ID} className={styles.title}>
          {TITLE}
        </h2>
        <div className={styles.person}>
          <span className={styles.email}>{email}</span>
        </div>
        <input
          ref={inputRef}
          className={styles.email}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px' }}
          aria-label="Enlace de invitación"
          readOnly
          value={url}
        />
        <p className={styles.warning}>
          {ONCE} Pásaselo a {email}: vale hasta el {expiry.date} ({expiry.left}).
        </p>
        {copyFailed && (
          <p className={styles.error} role="alert">
            No se pudo copiar. Selecciona el enlace y cópialo a mano.
          </p>
        )}
        <div className={styles.actions}>
          <button ref={closeRef} type="button" className={styles.cancel} onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className={styles.confirm} onClick={() => void copy()}>
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>
      </div>
    </div>
  );
}
