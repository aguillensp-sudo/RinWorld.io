import { useCallback, useEffect, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  closeThreadWithoutAgreement,
  fetchThreadDetail,
  fetchThreadItems,
  revertAgreement,
  type ThreadDetail,
  type ThreadItem,
} from '../../lib/thread-detail';
import { acceptOffer, rejectOffer } from '../../lib/offers';
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
}: {
  profile: MemberProfile;
  threadId: string;
  now?: Date;
}) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const handleClose = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const confirmClose = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await closeThreadWithoutAgreement(detail.id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }, [detail, reload]);

  const handleRevert = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await revertAgreement(detail.id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [detail, reload]);

  const handleAcceptOffer = useCallback(
    async (itemId: string) => {
      setBusy(true);
      try {
        await acceptOffer(itemId, profile.orgId);
        await reload();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [profile.orgId, reload],
  );

  const handleRejectOffer = useCallback(
    async (itemId: string) => {
      setBusy(true);
      try {
        await rejectOffer(itemId, profile.orgId);
        await reload();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [profile.orgId, reload],
  );

  // `now` es inyectable para los tests; por defecto se construye en cada render
  // porque los timestamps relativos son tan sensibles al reloj como SRCH-01.
  const nowDate = now ?? new Date();

  return (
    <div className={styles.screen}>
      {detail && (
        <ThreadHeader
          detail={detail}
          onBack={() => {
            // La navegación a MSG-01 es decisión del shell.
          }}
          onOpenCounterparty={() => {
            // DIR-02 (ficha pública) queda fuera del MVP.
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
