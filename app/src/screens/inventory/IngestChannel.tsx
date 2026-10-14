import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCEPTED_FORMATS_NOTICE,
  addIngestSender,
  canManageIngest,
  ensureIngestChannel,
  fetchIngestEvents,
  fetchIngestSenders,
  ingestAddress,
  isValidSenderEmail,
  MAX_INGEST_SENDERS,
  READ_ONLY_NOTICE,
  reasonLabel,
  REJECTED_SILENTLY_HINT,
  SENDER_DOMAIN_AUTH_HINT,
  removeIngestSender,
  RESULT_LABELS,
  rotateIngestAddress,
  ROTATED_MESSAGE,
  type IngestEventRow,
  type IngestSender,
} from '../../lib/ingest';
import { errorMessage, type MemberProfile } from '../../lib/session';
import styles from './IngestChannel.module.css';

const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const TITLE = 'Canal de ingestión por email';
const SUBTITLE =
  'Envía tu archivo de inventario directamente por email a tu dirección única de ingestión. El sistema lo procesará automáticamente.';

const ROTATE_TITLE = '¿Seguro que quieres rotar la dirección?';
const ROTATE_TEXT =
  'La dirección actual quedará anulada de forma inmediata. Cualquier sistema que la use deberá actualizarse.';
const ADMIN_TAG = 'Administrador — no eliminable';

interface Props {
  /** La sesión del miembro: de aquí sale el rol. Todo lo demás lo decide la base por la sesión. */
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj o de la zona horaria. */
  formatDate?: (iso: string) => string;
}

function defaultFormatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * INV-04 — Canal de ingestión por email. Solo el ADMIN lo gestiona (las tablas y las funciones
 * son suyas); un EDITOR ve el aviso y nada más, sin pedir nada a la base.
 *
 * Al entrar, `ensure_ingest_channel` abre el canal si no existía (idempotente) y devuelve el
 * token; con él se pintan la dirección, la lista de remitentes y el historial. **Nada se escribe
 * sin que el miembro lo pida**, salvo ese «abrir»: la dirección no se inventa en el cliente.
 */
export function IngestChannel({ profile, formatDate = defaultFormatDate }: Props) {
  const canManage = canManageIngest(profile.role);

  const [token, setToken] = useState<string | null>(null);
  const [senders, setSenders] = useState<IngestSender[]>([]);
  const [events, setEvents] = useState<IngestEventRow[]>([]);
  const [loading, setLoading] = useState(canManage);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newSender, setNewSender] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotated, setRotated] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    (async () => {
      try {
        const t = await ensureIngestChannel();
        const [s, e] = await Promise.all([fetchIngestSenders(), fetchIngestEvents()]);
        if (!active) return;
        setToken(t);
        setSenders(s);
        setEvents(e);
      } catch (err: unknown) {
        if (active) setLoadError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canManage, profile.orgId]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const address = token ? ingestAddress(token) : null;

  const copy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles (contexto inseguro o permiso denegado): el campo sigue seleccionable.
    }
  }, [address]);

  async function reloadSenders(): Promise<void> {
    setSenders(await fetchIngestSenders());
  }

  async function handleAdd(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!isValidSenderEmail(newSender)) {
      setError('El email del remitente no es válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addIngestSender(newSender.trim());
      await reloadSenders();
      setNewSender('');
      setAdding(false);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(s: IngestSender): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await removeIngestSender(s.id);
      await reloadSenders();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setToken(await rotateIngestAddress());
      setConfirmRotate(false);
      setRotated(true);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>{EYEBROW}</p>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {!canManage && <p className={styles.readOnly}>{READ_ONLY_NOTICE}</p>}
      {loadError !== null && (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      )}
      {canManage && loading && <p className={styles.readOnly}>Cargando el canal…</p>}

      {canManage && address !== null && (
        <>
          {rotated && (
            <p className={styles.status} role="status">
              {ROTATED_MESSAGE}
            </p>
          )}
          {error !== null && !confirmRotate && (
            <p className={styles.alert} role="alert">
              {error}
            </p>
          )}

          <section className={styles.card} aria-labelledby="ingest-address-title">
            <h2 className={styles.cardTitle} id="ingest-address-title">
              Dirección de ingestión
            </h2>
            <div className={styles.addrRow}>
              <input
                type="text"
                readOnly
                className={styles.addr}
                value={address}
                aria-label="Dirección de ingestión"
                data-testid="ingest-address"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className={styles.copy} onClick={() => void copy()}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className={styles.brassBlock}>{ACCEPTED_FORMATS_NOTICE}</p>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={busy}
              onClick={() => {
                setRotated(false);
                setConfirmRotate(true);
              }}
            >
              Rotar dirección
            </button>
          </section>

          <section className={styles.card} aria-labelledby="ingest-senders-title">
            <h2 className={styles.cardTitle} id="ingest-senders-title">
              Remitentes autorizados
            </h2>
            <ul className={styles.senderList}>
              {senders.map((s) => (
                <li key={s.id} className={styles.sender}>
                  <span className={styles.senderEmail}>{s.email}</span>
                  {s.isProtected && <span className={styles.senderTag}>{ADMIN_TAG}</span>}
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Eliminar ${s.email}`}
                    disabled={s.isProtected || busy}
                    onClick={() => void handleRemove(s)}
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {adding ? (
              <form className={styles.addForm} noValidate onSubmit={(e) => void handleAdd(e)}>
                <label className={styles.fieldLabel} htmlFor="ingest-new-sender">
                  Email del remitente
                </label>
                <input
                  id="ingest-new-sender"
                  type="email"
                  className={styles.input}
                  placeholder="email@empresa.com"
                  value={newSender}
                  onChange={(e) => setNewSender(e.target.value)}
                  autoFocus
                />
                <button type="submit" className={styles.primary} disabled={busy}>
                  Añadir
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  disabled={busy}
                  onClick={() => {
                    setAdding(false);
                    setNewSender('');
                    setError(null);
                  }}
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                className={styles.linkBtn}
                disabled={busy || senders.length >= MAX_INGEST_SENDERS}
                onClick={() => setAdding(true)}
              >
                + Añadir remitente
              </button>
            )}
            <p className={styles.hint}>{REJECTED_SILENTLY_HINT}</p>
            <p className={styles.domainHint}>{SENDER_DOMAIN_AUTH_HINT}</p>
          </section>

          <section className={styles.card} aria-labelledby="ingest-history-title">
            <h2 className={styles.cardTitle} id="ingest-history-title">
              Historial de ingestiones
            </h2>
            {events.length === 0 ? (
              <p className={styles.empty}>Todavía no se ha recibido ningún correo en esta dirección.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Remitente</th>
                    <th scope="col">Archivo</th>
                    <th scope="col">Resultado</th>
                    <th scope="col" className={styles.num}>
                      Filas importadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const why = reasonLabel(ev.reason);
                    return (
                      <tr key={ev.id}>
                        <td>{formatDate(ev.receivedAt)}</td>
                        <td className={styles.mono}>{ev.senderEmail}</td>
                        <td className={styles.mono}>{ev.fileName ?? '—'}</td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              ev.result === 'PROCESADO' ? styles.badgeOk : ev.result === 'ERROR' ? styles.badgeErr : styles.badgeNeutral
                            }`}
                          >
                            {RESULT_LABELS[ev.result]}
                          </span>
                          {why !== null && <span className={styles.why}>{why}</span>}
                        </td>
                        <td className={styles.num}>
                          {ev.rowsImported === null ? '—' : ev.rowsImported.toLocaleString('es-ES')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {confirmRotate && (
        <RotateDialog busy={busy} error={error} onConfirm={() => void handleRotate()} onCancel={() => setConfirmRotate(false)} />
      )}
    </div>
  );
}

function RotateDialog({
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby="rotate-title" className={styles.dialog}>
        <h2 id="rotate-title" className={styles.dialogTitle}>
          {ROTATE_TITLE}
        </h2>
        <p className={styles.warning}>{ROTATE_TEXT}</p>
        {error !== null && (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>
            Sí, rotar
          </button>
        </div>
      </div>
    </div>
  );
}
