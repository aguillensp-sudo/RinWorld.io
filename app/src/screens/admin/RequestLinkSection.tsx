import { useEffect, useRef, useState } from 'react';
import { requestDateLabel, type RequestLinkStatus } from '../../lib/admin-requests';
import styles from './RequestDetailPanel.module.css';

/**
 * Lo que la sección tiene que pintar. Lo decide `AdminRequests`, que es quien habla
 * con la red; este componente es presentacional.
 *
 * `issued` es el ÚNICO estado que lleva el enlace. Se guarda solo el hash del token
 * (`0040`), así que el enlace se ve una vez, en el momento de generarlo, y no se
 * puede recuperar después: al reabrir la solicitud llega `status`, sin enlace.
 */
export type LinkView =
  | { kind: 'loading' }
  | { kind: 'issued'; url: string; expiresAt: string }
  | { kind: 'status'; status: RequestLinkStatus | null }
  | { kind: 'error'; message: string };

interface Props {
  link: LinkView;
  busy: boolean;
  onGenerate: () => void;
}

const COPIED_MS = 2000;

/**
 * «Enlace de acceso» del panel de ADMIN-01 (F-223). Sin proveedor de correo, el
 * Operador copia el enlace y lo envía por su cuenta. Solo se pinta en solicitudes
 * `INVITED_APPROVED`; el panel decide cuándo.
 */
export function RequestLinkSection({ link, busy, onGenerate }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Enlace de acceso</div>
      {link.kind === 'loading' ? (
        <p className={styles.historyLoading}>Cargando enlace…</p>
      ) : link.kind === 'error' ? (
        <div role="alert" className={styles.actionError}>
          {link.message}
        </div>
      ) : link.kind === 'issued' ? (
        <IssuedLinkView url={link.url} expiresAt={link.expiresAt} />
      ) : (
        <StatusView status={link.status} busy={busy} onGenerate={onGenerate} />
      )}
    </div>
  );
}

function IssuedLinkView({ url, expiresAt }: { url: string; expiresAt: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // El aviso de "Copiado" se apaga solo; sin limpiar el temporizador, desmontar el
  // panel antes de que salte pintaría un estado en un componente que ya no existe.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: se deja el texto seleccionado para Ctrl+C.
      inputRef.current?.select();
      setCopyFailed(true);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        className={styles.linkField}
        type="text"
        readOnly
        value={url}
        aria-label="Enlace de registro"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className={styles.linkRow}>
        <button type="button" className={styles.plain} onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <span className={styles.linkMeta}>{`Válido hasta ${requestDateLabel(expiresAt)} · un solo uso`}</span>
      </div>
      {copyFailed && (
        <p className={styles.hint} role="status">
          No se pudo copiar: selecciónalo y cópialo a mano.
        </p>
      )}
      <p className={styles.hint}>Solo se muestra ahora. Si lo pierdes, genera otro.</p>
    </>
  );
}

function StatusView({
  status,
  busy,
  onGenerate,
}: {
  status: RequestLinkStatus | null;
  busy: boolean;
  onGenerate: () => void;
}) {
  // Canjeado: la organización ya nació de ese enlace y la base no genera otro.
  if (status !== null && status.status === 'Canjeado') {
    return (
      <p className={styles.linkStatus}>
        {`Enlace canjeado el ${requestDateLabel(status.usedAt ?? status.expiresAt)}`}
      </p>
    );
  }

  const text =
    status === null
      ? 'Sin enlace'
      : status.status === 'Vigente'
        ? `Enlace vigente hasta ${requestDateLabel(status.expiresAt)}`
        : status.status === 'Caducado'
          ? `Enlace caducado el ${requestDateLabel(status.expiresAt)}`
          : 'Enlace revocado';

  return (
    <>
      <p className={styles.linkStatus}>{text}</p>
      <div className={styles.linkRow}>
        <button type="button" className={styles.plain} disabled={busy} onClick={onGenerate}>
          {status === null ? 'Generar enlace' : 'Generar enlace nuevo'}
        </button>
      </div>
      {status !== null && status.status === 'Vigente' && (
        <p className={styles.hint}>Generar uno nuevo invalida el actual.</p>
      )}
    </>
  );
}
