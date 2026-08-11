import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  fetchThreadDetail,
  fetchThreadItems,
  type ThreadDetail,
  type ThreadItem,
} from '../../lib/thread-detail';
// ⚠ Las cuatro escrituras viven en `offers.ts`, no en `thread-detail.ts`. El
// artefacto importaba `closeThreadWithoutAgreement` y `revertAgreement` del
// segundo, y como el `catch` de cada handler se traga lo que sea, **cerrar y
// revertir no hacían nada y lo decían con un banner de error**: dos de las tres
// acciones del hilo, muertas en silencio.
import {
  acceptOffer,
  closeThreadWithoutAgreement,
  rejectOffer,
  revertAgreement,
} from '../../lib/offers';
import { onThreadChanged } from '../../lib/realtime';
import { ThreadHeader } from './ThreadHeader';
import { ThreadHistory } from './ThreadHistory';
import { ThreadComposer } from './ThreadComposer';
import styles from './Thread.module.css';

/**
 * MSG-02 · Vista de un Hilo.
 *
 * La pantalla posee todo el estado: detalle, elementos, carga, error y el
 * diálogo de confirmación de «Cerrar sin acuerdo». Tras cada escritura se
 * vuelve a leer el hilo y sus elementos; el estado lo deriva la base (0007),
 * nunca el cliente (F-044).
 *
 * La navegación (`onBack`, `onOpenCounterparty`) es contrato del shell: aquí se
 * avisa por callback y nada más. DIR-02 queda fuera del alcance del MVP.
 */
export function Thread({
  profile,
  threadId,
  now,
  onBack,
}: {
  profile: MemberProfile;
  threadId: string;
  now?: Date;
  /** Vuelta a MSG-01 desde el breadcrumb. **Opcional**, por lo mismo que
   *  `Messages.onOpenThread`: el contrato de aceptación no lo pasa, y hacerlo
   *  obligatorio pondría C1 en rojo por el wiring y no por el artefacto. */
  onBack?: () => void;
}) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * Cerrojo de reentrada. El artefacto tenía un `busy` de estado que **ponía y
   * no leía nadie** —`tsc` lo cazó como TS6133— así que no protegía de nada:
   * dos clics seguidos en `Aceptar oferta` lanzaban dos escrituras.
   *
   * Va en un `ref` y no en un `useState` a propósito: el estado se aplica de
   * forma asíncrona, y dos clics en el mismo tick leerían los dos `false`. Un
   * cerrojo que se puede saltar en el caso que viene a evitar no es un cerrojo.
   *
   * La carrera es real y llega hoy con Realtime: `setOfferState` lanza *"La
   * oferta ya no estaba pendiente, o es tuya"* precisamente cuando la segunda
   * escritura pierde.
   */
  const writing = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDetail, nextItems] = await Promise.all([
        fetchThreadDetail(threadId, profile.orgId),
        fetchThreadItems(threadId, profile.orgId),
      ]);
      setDetail(nextDetail);
      setItems(nextItems);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [threadId, profile.orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Realtime (`Plan §3`, día 7). El evento es una **señal para releer**, no una
   * fuente de datos: no se mezcla ningún payload — ver la cabecera de
   * `lib/realtime.ts`.
   *
   * Se suscribe a los elementos del hilo **y a la fila del hilo**, porque el
   * badge de estado lo mueve el trigger de 0007 cuando la otra parte acepta una
   * oferta y esa fila no la toca nadie desde aquí.
   */
  useEffect(() => onThreadChanged(threadId, () => void reload()), [threadId, reload]);

  const handleClose = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  /** Una escritura, su relectura y su error. Nunca dos a la vez. */
  const write = useCallback(
    async (accion: () => Promise<unknown>) => {
      if (writing.current) return;
      writing.current = true;
      try {
        await accion();
        await reload();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        writing.current = false;
      }
    },
    [reload],
  );

  const confirmClose = useCallback(async () => {
    if (!detail) return;
    await write(() => closeThreadWithoutAgreement(detail.id));
    setConfirmOpen(false);
  }, [detail, write]);

  const handleRevert = useCallback(async () => {
    if (!detail) return;
    await write(() => revertAgreement(detail.id));
  }, [detail, write]);

  const handleAcceptOffer = useCallback(
    (itemId: string) => write(() => acceptOffer(itemId, profile.orgId)),
    [profile.orgId, write],
  );

  const handleRejectOffer = useCallback(
    (itemId: string) => write(() => rejectOffer(itemId, profile.orgId)),
    [profile.orgId, write],
  );

  // `now` es inyectable para los tests; por defecto se construye en cada render
  // porque los timestamps relativos son tan sensibles al reloj como SRCH-01.
  const nowDate = now ?? new Date();

  return (
    <div className={styles.screen}>
      {detail && (
        <ThreadHeader
          detail={detail}
          onBack={() => onBack?.()}
          onOpenCounterparty={() => {
            // DIR-02 (ficha pública) queda fuera del MVP: el botón se pinta y su
            // aviso no lleva a ninguna parte todavía, igual que `Consultar` y
            // `Contactar` en SRCH-01.
          }}
          onClose={handleClose}
          onRevert={() => {
            void handleRevert();
          }}
        />
      )}

      <div className={styles.body} data-testid="thread-body" aria-busy={loading ? 'true' : 'false'}>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {loading && !detail && <div className={styles.loading}>Cargando hilo…</div>}

        {detail && (
          <>
            <ThreadHistory
              items={items}
              threadId={threadId}
              viewerOrgId={profile.orgId}
              ownOrgName={profile.orgName}
              counterpartyName={detail.counterpartyName}
              now={nowDate}
              onAcceptOffer={(itemId) => {
                void handleAcceptOffer(itemId);
              }}
              onRejectOffer={(itemId) => {
                void handleRejectOffer(itemId);
              }}
            />
            {/* D-07-01: el pie se monta en los cinco estados del hilo, CERRADO
                SIN ACUERDO incluido. La reapertura ocurre cuando alguien vuelve
                a escribir (0009), así que el campo no puede desaparecer. */}
            <ThreadComposer />
          </>
        )}
      </div>

      {confirmOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="thread-close-title">
            <h2 className={styles.modalTitle} id="thread-close-title">
              ¿Cerrar sin acuerdo?
            </h2>
            <p className={styles.modalBody}>
              El hilo quedará cerrado. Si más adelante queréis retomarlo, cualquiera de las dos
              partes puede volver a escribir para reabrirlo.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setConfirmOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={() => {
                  void confirmClose();
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
