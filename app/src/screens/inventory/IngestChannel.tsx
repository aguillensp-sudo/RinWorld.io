import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
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
  removeIngestSender,
  RESULT_LABELS,
  rotateIngestAddress,
  ROTATED_MESSAGE,
  SENDER_DOMAIN_AUTH_HINT,
  type IngestEventRow,
  type IngestResult,
  type IngestSender,
} from '../../lib/ingest';
import styles from './IngestChannel.module.css';

const EYEBROW = 'Módulo 02 · Gestión de Inventario';
const TITLE = 'Canal de ingestión por email';
const SUBTITLE =
  'Envía tu archivo de inventario directamente por email a tu dirección única de ingestión. El sistema lo procesará automáticamente.';

const ADDRESS_TITLE = 'Dirección de ingestión';
const COPY_LABEL = 'Copiar';
const COPIED_LABEL = 'Copiado';
const ROTATE_LABEL = 'Rotar dirección';

const ROTATE_DIALOG_TITLE = '¿Seguro que quieres rotar la dirección?';
const ROTATE_DIALOG_TEXT =
  'La dirección actual quedará anulada de forma inmediata. Cualquier sistema que la use deberá actualizarse.';
const CANCEL_LABEL = 'Cancelar';
const CONFIRM_ROTATE_LABEL = 'Sí, rotar';

const SENDERS_TITLE = 'Remitentes autorizados';
const PROTECTED_LABEL = 'Administrador — no eliminable';
const ADD_SENDER_LABEL = '+ Añadir remitente';
const SENDER_FIELD_LABEL = 'Email del remitente';
const SENDER_PLACEHOLDER = 'email@empresa.com';
const ADD_SUBMIT_LABEL = 'Añadir';
const INVALID_SENDER_EMAIL = 'El email del remitente no es válido.';

const HISTORY_TITLE = 'Historial de ingestiones';
const EMPTY_HISTORY = 'Todavía no se ha recibido ningún correo en esta dirección.';
const EMPTY_CELL = '—';
const HISTORY_COLUMNS = ['Fecha y hora', 'Remitente', 'Archivo', 'Resultado', 'Filas importadas'];

/** Milisegundos que el botón `Copiar` se queda en «Copiado». */
const COPIED_MS = 2000;

/** `new Date(iso).toLocaleString('es-ES', …)`, y cadena vacía si la fecha no vale. */
function defaultFormatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

/** PROCESADO verde, ERROR roja, RECHAZADO neutra (spec §3 y design-system §1.5). */
function resultBadgeClass(result: IngestResult): string {
  if (result === 'PROCESADO') return styles.badgeSuccess ?? '';
  if (result === 'ERROR') return styles.badgeDanger ?? '';
  return styles.badgeNeutral ?? '';
}

interface Props {
  /** La sesión del miembro: de aquí sale el rol, y el rol decide si hay canal o aviso. */
  profile: MemberProfile;
  /** Formato de la columna «Fecha y hora». Por defecto, `es-ES` corto. */
  formatDate?: (iso: string) => string;
}

/**
 * INV-04 — Canal de ingestión por email. La pantalla posee TODO el estado: el token de
 * la dirección, la lista de remitentes, el historial, el diálogo de rotación y el
 * formulario de alta.
 *
 * Solo el ADMIN gestiona el canal (`canManageIngest`): las tablas y las funciones SQL
 * lo comprueban por su cuenta, y la pantalla existe para no ofrecer lo que la base va a
 * rechazar. El EDITOR ve la cabecera y el aviso de solo lectura — y ni una llamada de red.
 *
 * Al montar, y una sola vez: se abre el canal (`ensureIngestChannel`, idempotente) y
 * después se piden remitentes e historial en paralelo. Si algo falla no se pinta la
 * dirección: sin canal confirmado, una dirección a medias sería una mentira.
 */
export function IngestChannel({ profile, formatDate = defaultFormatDate }: Props) {
  const canManage = canManageIngest(profile.role);

  /** El token vigente. Sin él no hay tarjeta de dirección (`ingestAddress(token)`). */
  const [token, setToken] = useState<string | null>(null);
  const [senders, setSenders] = useState<IngestSender[]>([]);
  const [events, setEvents] = useState<IngestEventRow[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  /** Error de gestión de remitentes (validación o base), siempre en un `role="alert"`. */
  const [senderError, setSenderError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotated, setRotated] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');

  /** Hay una escritura en vuelo: las bajas se deshabilitan mientras dura. */
  const [busy, setBusy] = useState(false);

  const copiedTimer = useRef<number | null>(null);

  /*
   * Una sola vez al montar, y solo el ADMIN. El `active` descarta la respuesta si la
   * pantalla se desmontó entre medias. El token se guarda al final, con los datos ya
   * dentro: si algo falla, no hay dirección que enseñar.
   */
  useEffect(() => {
    if (!canManage) return;
    let active = true;

    void (async () => {
      try {
        const ensured = await ensureIngestChannel();
        const [senderRows, eventRows] = await Promise.all([
          fetchIngestSenders(),
          fetchIngestEvents(),
        ]);
        if (!active) return;
        setToken(ensured);
        setSenders(senderRows);
        setEvents(eventRows);
      } catch (e: unknown) {
        if (!active) return;
        setLoadError(errorMessage(e));
      }
    })();

    return () => {
      active = false;
    };
  }, [canManage]);

  /** El temporizador de «Copiado» no debe sobrevivir a la pantalla. */
  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  /**
   * Portapapeles: si el navegador lo niega (permiso, contexto no seguro) no se pinta
   * «Copiado», porque el texto no está copiado. No hay aviso de fallo: no aporta nada.
   */
  async function handleCopy(): Promise<void> {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(ingestAddress(token));
    } catch {
      return;
    }
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  function openRotate(): void {
    setRotateError(null);
    setRotateOpen(true);
  }

  /** Cancelar no toca la red: cierra y olvida el error del intento anterior. */
  function cancelRotate(): void {
    setRotateOpen(false);
    setRotateError(null);
  }

  /**
   * Rotar es irreversible: la anterior deja de valer en la misma transacción. Si la
   * base falla, el diálogo NO se cierra y el error se queda dentro, junto al botón
   * que lo provocó.
   */
  async function handleRotate(): Promise<void> {
    setBusy(true);
    setRotateError(null);
    try {
      const next = await rotateIngestAddress();
      setToken(next);
      setRotateOpen(false);
      setRotated(true);
    } catch (e: unknown) {
      setRotateError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** Quitar un remitente: escribe y, si va bien, repide la lista entera. */
  async function handleRemoveSender(sender: IngestSender): Promise<void> {
    setBusy(true);
    setSenderError(null);
    try {
      await removeIngestSender(sender.id);
      setSenders(await fetchIngestSenders());
    } catch (e: unknown) {
      setSenderError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function openAddForm(): void {
    setSenderError(null);
    setAddOpen(true);
  }

  /** Cancelar cierra y vacía: lo escrito a medias no viaja a ninguna parte. */
  function cancelAddForm(): void {
    setAddOpen(false);
    setEmail('');
    setSenderError(null);
  }

  /**
   * Alta de remitente. La validación del cliente es la misma que la de
   * `add_ingest_sender`: con un email imposible no se va a la red.
   */
  async function handleAddSender(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = email.trim();
    if (!isValidSenderEmail(value)) {
      setSenderError(INVALID_SENDER_EMAIL);
      return;
    }

    setBusy(true);
    setSenderError(null);
    try {
      await addIngestSender(value);
      setSenders(await fetchIngestSenders());
      setEmail('');
      setAddOpen(false);
    } catch (e: unknown) {
      setSenderError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className={styles.screen}>
        <div className={styles.eyebrow}>{EYEBROW}</div>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.subtitle}>{SUBTITLE}</p>
        <p className={styles.readOnly}>{READ_ONLY_NOTICE}</p>
      </div>
    );
  }

  const address = token === null ? '' : ingestAddress(token);

  return (
    <div className={styles.screen}>
      <div className={styles.eyebrow}>{EYEBROW}</div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.subtitle}>{SUBTITLE}</p>

      {loadError !== null && (
        <p className={styles.alert} role="alert">
          {loadError}
        </p>
      )}

      {/* ── Dirección única: solo cuando el canal está abierto y confirmado. ── */}
      {token !== null && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{ADDRESS_TITLE}</h2>

          <div className={styles.addressRow}>
            <input
              type="text"
              readOnly
              className={styles.addressField}
              value={address}
              aria-label={ADDRESS_TITLE}
              data-testid="ingest-address"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className={styles.copy} onClick={handleCopy}>
              {copied ? COPIED_LABEL : COPY_LABEL}
            </button>
          </div>

          {/* Lo que el canal admite DE VERDAD (no lo que decía el mock): va importado. */}
          <div className={styles.brassBlock}>
            <p className={styles.brassText}>{ACCEPTED_FORMATS_NOTICE}</p>
          </div>

          <button type="button" className={styles.rotate} onClick={openRotate}>
            {ROTATE_LABEL}
          </button>

          {rotated && (
            <p className={styles.status} role="status">
              {ROTATED_MESSAGE}
            </p>
          )}
        </section>
      )}

      {/* ── Remitentes autorizados. ── Solo con el canal cargado: antes, o si la carga
           falló, una lista vacía y un historial «sin correos» afirmarían algo que no se
           ha consultado (revisión a mano, CLAUDE.md §7). */}
      {token !== null && (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{SENDERS_TITLE}</h2>

        <ul className={styles.senderList}>
          {senders.map((sender) => (
            <li key={sender.id} className={styles.senderRow}>
              <span className={styles.senderEmail}>{sender.email}</span>
              {sender.isProtected && (
                <span className={styles.protectedBadge}>{PROTECTED_LABEL}</span>
              )}
              <button
                type="button"
                className={styles.remove}
                disabled={sender.isProtected || busy}
                onClick={() => handleRemoveSender(sender)}
                aria-label={`Eliminar ${sender.email}`}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>

        {addOpen ? (
          /* `noValidate`: la validación la hace `isValidSenderEmail`, no el navegador.
             Con `type="email"` el motor nativo bloquearía el `submit` y el aviso de
             error no llegaría a pintarse nunca. */
          <form className={styles.addForm} onSubmit={handleAddSender} noValidate>
            <label className={styles.addLabel} htmlFor="ingest-sender-email">
              {SENDER_FIELD_LABEL}
            </label>
            <div className={styles.addRow}>
              <input
                id="ingest-sender-email"
                type="email"
                className={styles.addInput}
                placeholder={SENDER_PLACEHOLDER}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className={styles.submit} disabled={busy}>
                {ADD_SUBMIT_LABEL}
              </button>
              <button type="button" className={styles.cancelButton} onClick={cancelAddForm}>
                {CANCEL_LABEL}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={styles.addSender}
            disabled={senders.length >= MAX_INGEST_SENDERS}
            onClick={openAddForm}
          >
            {ADD_SENDER_LABEL}
          </button>
        )}

        {senderError !== null && (
          <p className={styles.alert} role="alert">
            {senderError}
          </p>
        )}

        <p className={styles.hint}>{REJECTED_SILENTLY_HINT}</p>
        {/* F-252: la puerta de SES. Va en prosa y no en mono porque es una frase larga. */}
        <p className={styles.hintProse}>{SENDER_DOMAIN_AUTH_HINT}</p>
      </section>
      )}

      {/* ── Historial: cinco columnas, el motivo del rechazo dentro del resultado. ── */}
      {token !== null && (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{HISTORY_TITLE}</h2>

        {events.length === 0 ? (
          <p className={styles.empty}>{EMPTY_HISTORY}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {HISTORY_COLUMNS.map((column) => (
                  <th key={column} scope="col" className={styles.th}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const reason = reasonLabel(event.reason);
                return (
                  <tr key={event.id}>
                    <td className={`${styles.td} ${styles.mono}`}>{formatDate(event.receivedAt)}</td>
                    <td className={`${styles.td} ${styles.mono}`}>{event.senderEmail}</td>
                    <td className={styles.td}>{event.fileName ?? EMPTY_CELL}</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${resultBadgeClass(event.result)}`}>
                        {RESULT_LABELS[event.result]}
                      </span>
                      {reason !== null && <span className={styles.reason}>{reason}</span>}
                    </td>
                    <td className={`${styles.td} ${styles.num}`}>
                      {event.rowsImported === null
                        ? EMPTY_CELL
                        : event.rowsImported.toLocaleString('es-ES')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      )}

      {/* ── Diálogo de rotación: no es `window.confirm`, y el error se queda dentro. ── */}
      {rotateOpen && (
        <div className={styles.overlay}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={ROTATE_DIALOG_TITLE}
          >
            <h2 className={styles.dialogTitle}>{ROTATE_DIALOG_TITLE}</h2>
            <p className={styles.dialogText}>{ROTATE_DIALOG_TEXT}</p>

            {rotateError !== null && (
              <p className={styles.alert} role="alert">
                {rotateError}
              </p>
            )}

            <div className={styles.dialogActions}>
              <button type="button" className={styles.cancelButton} onClick={cancelRotate}>
                {CANCEL_LABEL}
              </button>
              <button type="button" className={styles.confirmRotate} onClick={handleRotate} disabled={busy}>
                {CONFIRM_ROTATE_LABEL}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
