import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  counterOffer,
  createOffer,
  markOutOfStock,
  fetchThreadDetail,
  fetchThreadItems,
  authorLabel,
  retagMessage,
  sendInquiries,
  sendMessage,
  type OfferContent,
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
import type { InquiryDraft } from '../../lib/inquiry-form';
import type { OrgLine } from '../../lib/search';
import type { VeraDraft } from '../../lib/vera-tools';
import {
  TAB_TEXTS,
  initialTag,
  messageTimeline,
  negotiationRows,
  referenceLabel,
  threadReferences,
  type NegotiationAction,
  type NegotiationRow,
  type ThreadReference,
} from '../../lib/negotiation-rows';
import { ThreadHeader } from './ThreadHeader';
import { ThreadComposer } from './ThreadComposer';
import { OfferCounterForm } from './OfferCounterForm';
import { NegotiationTable } from './NegotiationTable';
import { MessagesTimeline } from './MessagesTimeline';
import { ThreadSearch } from './ThreadSearch';
import styles from './Thread.module.css';

/** Las tres pestañas del hilo de una empresa, de izquierda a derecha (spec `thread-role-tabs`). */
type Tab = 'mensajes' | 'cliente' | 'proveedor';
const TABS: { key: Tab; label: string }[] = [
  { key: 'mensajes', label: TAB_TEXTS.messages },
  { key: 'cliente', label: TAB_TEXTS.cliente },
  { key: 'proveedor', label: TAB_TEXTS.proveedor },
];

/**
 * «Sobre:» todavía sin tocar por el miembro: sale lo que toque por defecto (la referencia
 * sola del hilo, la de la búsqueda activa…). En cuanto elige algo, manda lo que eligió.
 */
const SIN_ELEGIR = Symbol('sin-elegir');

/**
 * MSG-02 · Vista de un Hilo, con las tres pestañas de `amend-msg-hilos-pestanas-y-etiqueta`:
 * Mensajes · Soy cliente · Soy proveedor, y el buscador de referencias abajo.
 *
 * Montaje escrito a mano: qué pestaña está abierta, qué dice «Sobre:», qué filtro tiene
 * Mensajes y qué formulario se abre con cada acción. Lo que se ve lo calcula
 * `lib/negotiation-rows.ts` y lo pintan `NegotiationTable`, `MessagesTimeline` y
 * `ThreadSearch` (del arnés). La pestaña vive en el estado de la pantalla, no en la URL: la
 * app no tiene rutas y los accesos (Vendiendo, Comprando, Empresas) abren el hilo montándolo,
 * así que siempre arranca en Mensajes (`thread-access-routing`).
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
  onOpenCounterparty,
  veraDraft,
  onVeraDraftHandled,
}: {
  profile: MemberProfile;
  threadId: string;
  now?: Date;
  /** Vuelta a MSG-01 desde el breadcrumb. **Opcional**, por lo mismo que
   *  `Messages.onOpenThread`: el contrato de aceptación no lo pasa, y hacerlo
   *  obligatorio pondría C1 en rojo por el wiring y no por el artefacto. */
  onBack?: () => void;
  /** El nombre de la contraparte abre su ficha pública (DIR-02). **Opcional**: sin él el
   *  clic no hace nada, que es lo que ve el contrato de aceptación de MSG-02. */
  onOpenCounterparty?: (orgId: string) => void;
  /** Lo que VERA ha pedido preparar en este hilo (consulta u oferta); se lo pasa al pie y se consume una vez. Opcional. */
  veraDraft?: VeraDraft | null;
  onVeraDraftHandled?: () => void;
}) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('mensajes');
  /** La búsqueda del hilo: Mensajes enseña solo esta referencia hasta que se quita. */
  const [refFilter, setRefFilter] = useState<ThreadReference | null>(null);
  /** Lo elegido en «Sobre:»: una referencia, o `null` = conversación general. */
  const [tagChoice, setTagChoice] = useState<ThreadReference | null | typeof SIN_ELEGIR>(SIN_ELEGIR);
  /** Los formularios de oferta que abren las acciones de las tablas. */
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const tabsId = useId();

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

  /**
   * Número de la última relectura lanzada (F-250). Tras cada escritura hay una relectura propia y el
   * evento de Realtime que esa misma escritura provoca lanza otra: dos solapadas por diseño, y la más
   * lenta pisaba a la más nueva. Solo la última lanzada escribe detalle, elementos, error o fin de carga.
   */
  const lastReload = useRef(0);

  const reload = useCallback(async () => {
    const mia = ++lastReload.current;
    setLoading(true);
    setError(null);
    try {
      const [nextDetail, nextItems] = await Promise.all([
        fetchThreadDetail(threadId, profile.orgId),
        fetchThreadItems(threadId, profile.orgId),
      ]);
      if (mia !== lastReload.current) return;
      setDetail(nextDetail);
      setItems(nextItems);
    } catch (err) {
      if (mia !== lastReload.current) return;
      setError(errorMessage(err));
    } finally {
      if (mia === lastReload.current) setLoading(false);
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

  /**
   * Una escritura, su relectura y su error. Nunca dos a la vez.
   *
   * Devuelve si salió bien. Lo necesita el pie de composición, que solo vacía el
   * campo cuando el mensaje llegó de verdad: borrar lo escrito porque la red
   * falló sería perder el texto del usuario para tapar un error.
   */
  const write = useCallback(
    async (accion: () => Promise<unknown>): Promise<boolean> => {
      if (writing.current) return false;
      writing.current = true;
      try {
        await accion();
        await reload();
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
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

  /**
   * La contraoferta (`Plan §3`, día 10). Va por el mismo `write` que las otras
   * dos decisiones de oferta: hereda el cerrojo de reentrada, la relectura y el
   * banner de error de una sola pieza. La relectura es la que hace que la
   * tarjeta superada y la nueva Pendiente aparezcan juntas — las escribe la
   * base en la misma transacción (0013), pero este navegador no se entera hasta
   * que vuelve a leer.
   */
  const handleCounterOffer = useCallback(
    (itemId: string, threadId: string, content: OfferContent) =>
      write(() => counterOffer(itemId, threadId, content)),
    [write],
  );

  /** 0055 · responder a una consulta con oferta. */
  const handleRespondWithOffer = useCallback(
    (inquiryId: string, content: OfferContent) =>
      write(() => createOffer(threadId, inquiryId, null, content)),
    [threadId, write],
  );

  /** 0055 · oferta directa desde el pie del hilo. */
  const handleCreateOffer = useCallback(
    (reference: { partNumber: string; brand: string }, content: OfferContent) =>
      write(() => createOffer(threadId, null, reference, content)),
    [threadId, write],
  );

  /**
   * `Crear consulta` desde el pie del hilo (MSG-03 §3.2, F-249): una consulta nueva sobre una línea de la
   * contraparte, con la cantidad y las notas del formulario. Mismo cerrojo de reentrada que `write`, pero
   * devuelve el motivo del fallo en vez de pintarlo en el banner del hilo: el formulario está abierto
   * encima y es ahí donde el comprador tiene que verlo, conservando lo que escribió.
   */
  const handleCreateInquiry = useCallback(
    async (line: OrgLine, draft: InquiryDraft): Promise<string | null> => {
      if (!detail) return 'El hilo no está cargado.';
      if (writing.current) return 'Hay otra operación en curso. Inténtalo de nuevo.';
      writing.current = true;
      try {
        const [resultado] = await sendInquiries(
          [{ lineId: line.id, distributorOrgId: detail.counterpartyId, quantity: draft.quantity, notes: draft.notes }],
          profile.orgId,
        );
        if (!resultado?.ok) return resultado?.error ?? 'No se pudo enviar la consulta.';
        await reload();
        return null;
      } catch (err) {
        return errorMessage(err);
      } finally {
        writing.current = false;
      }
    },
    [detail, profile.orgId, reload],
  );

  const handleOutOfStock = useCallback(
    (inquiryId: string) => {
      void write(() => markOutOfStock(inquiryId, profile.orgId));
    },
    [profile.orgId, write],
  );

  /**
   * D-08-02 · el mensaje libre cifrado.
   *
   * Va por el mismo `write` que las tres acciones de oferta, y no por un camino
   * propio: hereda el cerrojo de reentrada, la relectura y el banner de error de
   * una sola pieza. Y la relectura importa más aquí que en ninguna otra acción,
   * porque **escribir en un hilo cerrado lo reabre** (D-07-01, `0009`): el badge
   * de la cabecera cambia por un trigger que este navegador no ejecuta, así que
   * sin volver a leer se quedaría diciendo `CERRADO SIN ACUERDO` encima de un
   * hilo que acaba de abrirse.
   */
  // `now` es inyectable para los tests; por defecto se construye en cada render
  // porque los timestamps relativos son tan sensibles al reloj como SRCH-01.
  const nowDate = now ?? new Date();

  const references = useMemo(() => threadReferences(items), [items]);
  const tables = negotiationRows(items, { viewerOrgId: profile.orgId, now: nowDate });
  const timeline = useMemo(() => messageTimeline(items, refFilter), [items, refFilter]);

  /**
   * Lo que dice «Sobre:». Si el miembro no ha elegido: la referencia de la búsqueda activa; si
   * no, la única del hilo, o conversación general si no hay ninguna; con varias, sin elegir
   * (`undefined`), y entonces no se envía (spec `message-reference-tag`).
   */
  const tag: ThreadReference | null | undefined =
    tagChoice !== SIN_ELEGIR ? tagChoice : (refFilter ?? initialTag(references));

  const handleSend = useCallback(
    (text: string) => {
      if (tag === undefined) return Promise.resolve(false);
      return write(() => sendMessage(threadId, text, tag));
    },
    [threadId, write, tag],
  );

  /** Cambiar la etiqueta de un mensaje propio. Lo que es legal lo decide la base (0080). */
  const handleRetag = useCallback(
    (itemId: string, next: ThreadReference | null) => {
      void write(() => retagMessage(itemId, next));
    },
    [write],
  );

  const handleAction = useCallback(
    (row: NegotiationRow, action: NegotiationAction) => {
      switch (action) {
        case 'responder':
          setRespondingId(row.itemId);
          return;
        case 'sin-stock':
          handleOutOfStock(row.itemId);
          return;
        case 'aceptar':
        case 'aceptar-igualmente':
          void handleAcceptOffer(row.itemId);
          return;
        case 'contraofertar':
          setCounteringId(row.itemId);
          return;
        case 'rechazar':
          void handleRejectOffer(row.itemId);
          return;
      }
    },
    [handleOutOfStock, handleAcceptOffer, handleRejectOffer],
  );

  /** Pulsar la Referencia de una fila: a Mensajes, con esa referencia en «Sobre:». */
  const handleWrite = useCallback((row: NegotiationRow) => {
    setTagChoice({ partNumber: row.partNumber, brand: row.brand });
    setTab('mensajes');
  }, []);

  /** Elegir una referencia en el buscador: a Mensajes, filtrado, sin pulsar nada más. */
  const handlePick = useCallback((reference: ThreadReference) => {
    setRefFilter(reference);
    setTagChoice({ partNumber: reference.partNumber, brand: reference.brand });
    setTab('mensajes');
  }, []);

  const responding = respondingId ? items.find((i) => i.id === respondingId) : undefined;
  const countering = counteringId ? items.find((i) => i.id === counteringId) : undefined;
  const counterContent = countering?.content?.kind === 'OFERTA' ? countering.content : null;

  const tabId = (t: Tab) => `${tabsId}-tab-${t}`;
  const panelId = (t: Tab) => `${tabsId}-panel-${t}`;
  const tagValue = tag === undefined ? '' : tag === null ? TAB_TEXTS.generalConversation : referenceLabel(tag);

  return (
    <div className={styles.screen}>
      {detail && (
        <ThreadHeader
          detail={detail}
          onBack={() => onBack?.()}
          onOpenCounterparty={(orgId) => onOpenCounterparty?.(orgId)}
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
            <div className={styles.tablist} role="tablist" aria-label={TAB_TEXTS.tablistLabel}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={tabId(t.key)}
                  aria-selected={tab === t.key}
                  aria-controls={panelId(t.key)}
                  tabIndex={tab === t.key ? 0 : -1}
                  className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={styles.panel} role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
              {tab === 'mensajes' ? (
                <>
                  {/* D-07-01: el campo de escribir se monta en los cinco estados del hilo, CERRADO
                      SIN ACUERDO incluido: escribir es lo que lo reabre (0009). Va ARRIBA, encima
                      de los mensajes (spec `thread-role-tabs`). */}
                  <div className={styles.tagRow}>
                    <label className={styles.tagLabel}>
                      {TAB_TEXTS.tagLabel}
                      <select
                        className={styles.tagSelect}
                        aria-label={TAB_TEXTS.tagLabel}
                        value={tagValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === TAB_TEXTS.generalConversation) {
                            setTagChoice(null);
                            return;
                          }
                          const r = references.find((x) => x.label === v);
                          if (r) setTagChoice({ partNumber: r.partNumber, brand: r.brand });
                        }}
                      >
                        {tag === undefined && (
                          <option value="" disabled>
                            {TAB_TEXTS.tagPlaceholder}
                          </option>
                        )}
                        {references.map((r) => (
                          <option key={r.label} value={r.label}>
                            {r.label}
                          </option>
                        ))}
                        <option value={TAB_TEXTS.generalConversation}>{TAB_TEXTS.generalConversation}</option>
                      </select>
                    </label>
                  </div>
                  <ThreadComposer
                    onSend={handleSend}
                    sendBlocked={tag === undefined}
                    onCreateOffer={handleCreateOffer}
                    {...(veraDraft !== undefined ? { veraDraft } : {})}
                    {...(onVeraDraftHandled ? { onVeraDraftHandled } : {})}
                    inquiry={{
                      counterpartyId: detail.counterpartyId,
                      counterpartyName: detail.counterpartyName,
                      ownOrgId: profile.orgId,
                      onSubmit: handleCreateInquiry,
                    }}
                  />
                  <MessagesTimeline
                    entries={timeline}
                    allItems={items}
                    references={references}
                    filter={refFilter}
                    onClearFilter={() => setRefFilter(null)}
                    onRetag={handleRetag}
                    authorOf={(item) =>
                      authorLabel(item, { ownOrgName: profile.orgName, counterpartyName: detail.counterpartyName })
                    }
                    now={nowDate}
                  />
                </>
              ) : (
                <NegotiationTable
                  key={tab}
                  role={tab}
                  rows={tab === 'cliente' ? tables.cliente : tables.proveedor}
                  onAction={handleAction}
                  onWrite={handleWrite}
                />
              )}
            </div>

            <ThreadSearch references={references} onPick={handlePick} />

            {responding && (
              <OfferCounterForm
                partNumber={responding.partNumber ?? ''}
                brand={responding.brand ?? ''}
                title="Responder con oferta"
                hint="Tu oferta responde a esta consulta y la marca como respondida."
                submitLabel="Enviar oferta"
                initialQuantity={responding.content?.kind === 'CONSULTA' ? responding.content.quantity : undefined}
                onCancel={() => setRespondingId(null)}
                onSubmit={async (content) => {
                  const ok = await handleRespondWithOffer(responding.id, content);
                  if (ok) setRespondingId(null);
                  return ok;
                }}
              />
            )}

            {countering && counterContent && (
              <OfferCounterForm
                partNumber={countering.partNumber ?? ''}
                brand={countering.brand ?? ''}
                original={counterContent}
                onCancel={() => setCounteringId(null)}
                onSubmit={async (content) => {
                  const ok = await handleCounterOffer(countering.id, threadId, content);
                  if (ok) setCounteringId(null);
                  return ok;
                }}
              />
            )}
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
