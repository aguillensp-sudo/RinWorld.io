import { useState } from 'react';
import {
  ENCRYPTED_NOTICE,
  asOfferCard,
  authorLabel,
  itemTypeLabel,
  validUntilLabel,
  type ItemContent,
  type OfferContent,
  type ThreadItem,
} from '../../lib/thread-detail';
import { expiryNotice, offerActions, shippingLine } from '../../lib/offers';
import { relativeTime } from '../../lib/threads';
import { OfferCounterForm } from './OfferCounterForm';
import styles from './ThreadHistory.module.css';

/**
 * Sin contenido descifrado no hay con qué prerellenar el formulario (D-07-05):
 * `OfferCounterForm` necesita la oferta original para prerellenarse, y
 * proponer una contraoferta a ciegas sobre cifras que no se pueden leer no
 * tiene sentido de producto. No es lo mismo que "fuera del MVP" — el botón
 * VUELVE a activarse solo con recargar la clave de sesión.
 */
const NO_CONTENT_REASON = 'No se puede leer esta oferta en esta sesión, así que no se puede contraofertar.';

const OFFER_STATE_CLASS: Record<string, string | undefined> = {
  Pendiente: styles.statePendiente,
  Aceptada: styles.stateAceptada,
  Rechazada: styles.stateRechazada,
  'Superada por contraoferta': styles.stateSuperada,
};

const INQUIRY_STATE_CLASS: Record<string, string | undefined> = {
  Pendiente: styles.statePendiente,
  'Respondida con oferta': styles.stateRespondida,
};

function offerStateClass(state: string): string {
  return OFFER_STATE_CLASS[state] ?? '';
}

function inquiryStateClass(state: string): string {
  return INQUIRY_STATE_CLASS[state] ?? '';
}

function formatQuantity(quantity: number): string {
  return `${quantity} ud.`;
}

function InquiryBody({ content }: { content: Extract<ItemContent, { kind: 'CONSULTA' }> }) {
  return (
    <>
      <div className={styles.cardRow}>
        <span className={styles.cardLabel}>Cantidad</span>
        <span className={styles.cardVal}>{formatQuantity(content.quantity)}</span>
      </div>
      {content.comment && <p className={styles.cardNote}>{content.comment}</p>}
    </>
  );
}

function OfferBody({ content, now }: { content: Extract<ItemContent, { kind: 'OFERTA' }>; now: Date }) {
  const shipping = shippingLine(content.shippingCost, content.currency);
  const expiry = expiryNotice(content.validUntil, now);

  return (
    <>
      <div className={styles.cardRow}>
        <span className={styles.cardLabel}>Precio unitario</span>
        <span className={styles.cardVal}>
          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: content.currency }).format(
            content.unitPrice,
          )}
          /ud.
        </span>
      </div>
      <div className={styles.cardRow}>
        <span className={styles.cardLabel}>Cantidad</span>
        <span className={styles.cardVal}>{formatQuantity(content.quantity)}</span>
      </div>
      {content.leadTimeDays !== null && content.leadTimeDays !== undefined && (
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Plazo de entrega</span>
          <span className={styles.cardVal}>{content.leadTimeDays} días</span>
        </div>
      )}
      {shipping && (
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Coste transporte</span>
          <span className={styles.cardVal}>{shipping}</span>
        </div>
      )}
      {content.validUntil && (
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>Válida hasta</span>
          {/* El artefacto pintaba `content.validUntil` en crudo, o sea un ISO
              entero -"2026-07-15T00:00:00.000Z"- en la cara del usuario. La
              rama descifrada no se ejercita hoy, así que ningún check lo veía. */}
          <span className={styles.cardVal}>{validUntilLabel(content.validUntil)}</span>
        </div>
      )}
      {expiry && <p className={styles.cardExpiry}>{expiry}</p>}
      {content.notes && <p className={styles.cardNote}>{content.notes}</p>}
    </>
  );
}

function Card({
  item,
  threadId,
  viewerOrgId,
  now,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
}: {
  item: ThreadItem;
  threadId: string;
  viewerOrgId: string;
  now: Date;
  onAcceptOffer: (itemId: string) => void;
  onRejectOffer: (itemId: string) => void;
  onCounterOffer: (itemId: string, threadId: string, content: OfferContent) => Promise<boolean>;
}) {
  const [contraofertando, setContraofertando] = useState(false);
  const isOffer = item.type === 'OFERTA';
  const card = asOfferCard(item, threadId);
  // Las acciones solo salen de offerActions: es lo único que sabe que sólo el
  // receptor decide. Una condición equivalente escrita aquí pondría la regla en
  // dos sitios (F-056).
  const actions = card ? offerActions(card, viewerOrgId) : [];
  const contenidoOferta = item.content && item.content.kind === 'OFERTA' ? item.content : null;
  const stateLabel = isOffer ? item.offerState : item.inquiryState;
  const stateClass = stateLabel
    ? isOffer
      ? offerStateClass(stateLabel)
      : inquiryStateClass(stateLabel)
    : '';
  const reference = [item.partNumber, item.brand].filter(Boolean).join(' · ');

  return (
    <article className={`${styles.card} ${item.isOwn ? styles.cardOwn : styles.cardOther}`}>
      <header
        className={`${styles.cardHeader} ${isOffer ? styles.cardHeaderOffer : styles.cardHeaderInquiry}`}
      >
        <span className={`${styles.typeBadge} ${isOffer ? styles.typeBadgeOffer : styles.typeBadgeInquiry}`}>
          {itemTypeLabel(item.type)}
        </span>
        {reference && <span className={styles.cardRef}>{reference}</span>}
      </header>

      <div className={styles.cardBody}>
        {item.content && item.content.kind === 'CONSULTA' && <InquiryBody content={item.content} />}
        {item.content && item.content.kind === 'OFERTA' && <OfferBody content={item.content} now={now} />}
        {!item.content && <div className={styles.encrypted}>{ENCRYPTED_NOTICE}</div>}
      </div>

      <footer className={styles.cardFooter}>
        {stateLabel && <span className={`${styles.cardState} ${stateClass}`}>{stateLabel}</span>}
        {actions.length > 0 && (
          <div className={styles.cardActions}>
            {actions.includes('aceptar') && (
              <button
                type="button"
                className={styles.acceptButton}
                onClick={() => onAcceptOffer(item.id)}
              >
                Aceptar oferta
              </button>
            )}
            {actions.includes('rechazar') && (
              <button
                type="button"
                className={styles.rejectButton}
                onClick={() => onRejectOffer(item.id)}
              >
                Rechazar
              </button>
            )}
            {actions.includes('contraofertar') &&
              (contenidoOferta ? (
                <button
                  type="button"
                  className={styles.counterButton}
                  onClick={() => setContraofertando(true)}
                >
                  Contra-ofertar
                </button>
              ) : (
                <span className={styles.counterWrap}>
                  <button type="button" className={styles.counterButton} disabled>
                    Contra-ofertar
                  </button>
                  <span className={styles.reason}>{NO_CONTENT_REASON}</span>
                </span>
              ))}
          </div>
        )}
      </footer>

      {contraofertando && contenidoOferta && (
        <OfferCounterForm
          partNumber={item.partNumber ?? ''}
          brand={item.brand ?? ''}
          original={contenidoOferta}
          onCancel={() => setContraofertando(false)}
          onSubmit={async (content) => {
            const ok = await onCounterOffer(item.id, threadId, content);
            if (ok) setContraofertando(false);
            return ok;
          }}
        />
      )}
    </article>
  );
}

/**
 * Historial de MSG-02, puramente presentacional.
 *
 * Recibe los elementos ya ordenados ascendentemente por la capa de datos y no
 * carga nada. El estado vacío vive aquí, no en la pantalla.
 */
export function ThreadHistory({
  items,
  threadId,
  viewerOrgId,
  ownOrgName,
  counterpartyName,
  now,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
}: {
  items: ThreadItem[];
  threadId: string;
  viewerOrgId: string;
  ownOrgName: string;
  counterpartyName: string;
  now?: Date;
  onAcceptOffer: (itemId: string) => void;
  onRejectOffer: (itemId: string) => void;
  onCounterOffer: (itemId: string, threadId: string, content: OfferContent) => Promise<boolean>;
}) {
  if (items.length === 0) {
    return <div className={styles.empty}>Este hilo no tiene elementos todavía.</div>;
  }

  // El reloj se resuelve UNA vez y baja ya concreto. El artefacto propagaba
  // `now?: Date` a los subcomponentes y `exactOptionalPropertyTypes` lo rechaza:
  // `Date | undefined` no es asignable a una prop opcional. Dos errores de C1 que
  // el modelo tuvo delante en el feedback de los intentos 2 y 3 sin resolverlos.
  const clock = now ?? new Date();

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const author = authorLabel(item, { ownOrgName, counterpartyName });
        return (
          <li
            key={item.id}
            className={`${styles.item} ${item.isOwn ? styles.itemOwn : styles.itemOther}`}
            data-testid="thread-item"
            data-item-id={item.id}
            data-own={String(item.isOwn)}
            aria-label={item.isOwn ? `Elemento enviado por ${author}` : `Elemento de ${author}`}
          >
            {item.type === 'MENSAJE' ? (
              <div className={`${styles.bubble} ${item.isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
                {item.content && item.content.kind === 'MENSAJE' ? item.content.text : ENCRYPTED_NOTICE}
              </div>
            ) : (
              <Card
                item={item}
                threadId={threadId}
                viewerOrgId={viewerOrgId}
                now={clock}
                onAcceptOffer={onAcceptOffer}
                onRejectOffer={onRejectOffer}
                onCounterOffer={onCounterOffer}
              />
            )}
            <div className={styles.meta}>
              <span className={styles.author}>{author}</span>
              <span className={styles.timestamp}>{relativeTime(item.createdAt, clock)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
