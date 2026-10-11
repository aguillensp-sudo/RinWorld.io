import { useState } from 'react';
import {
  ENCRYPTED_NOTICE,
  authorLabel,
  itemTypeLabel,
  type OfferContent,
  type ThreadItem,
} from '../../lib/thread-detail';
import {
  inquiryRows,
  offerRows,
  type InquiryRow,
  type OfferRow,
} from '../../lib/negotiation-tables';
import { relativeTime } from '../../lib/threads';
import { InquiriesTable } from './InquiriesTable';
import { OfferCounterForm } from './OfferCounterForm';
import { OffersTable } from './OffersTable';
import styles from './ThreadHistory.module.css';

/**
 * El panel de vista-servidor (`Plan §3`, día 11): lo que Postgres tiene de
 * verdad para este elemento, sin descifrar, junto a lo que la tarjeta de
 * arriba ya pinta ya legible. Un toggle y no una pantalla propia — no está en
 * las 8 de `Plan §9`, y el único requisito cerrado (`Plan §10`, sesión 1,
 * paso 6) es "abrir el panel... y verificar que los campos comerciales salen
 * cifrados" desde el hilo mismo, no desde una ruta nueva.
 *
 * Vive a nivel de `<li>`, no dentro de `Card`: cubre MENSAJE, CONSULTA y
 * OFERTA con una sola implementación, coherente con que
 * `e2ee-content-encryption` habla de "cualquier elemento del hilo".
 *
 * `raw.ciphertext`/`raw.iv` llegan tal cual los devuelve PostgREST (hex
 * `\x…`) — no se reformatean, porque reformatearlos sería maquillar lo que el
 * servidor de verdad guarda.
 */
function RawServerView({ raw }: { raw: ThreadItem['raw'] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={styles.serverView}>
      <button
        type="button"
        className={styles.serverToggle}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        {abierto ? 'Ocultar lo que ve el servidor' : 'Ver lo que ve el servidor'}
      </button>
      {abierto && (
        <dl className={styles.serverRaw}>
          <dt>content_ciphertext</dt>
          <dd>{raw.ciphertext ?? '—'}</dd>
          <dt>content_iv</dt>
          <dd>{raw.iv ?? '—'}</dd>
          <dt>thread_item_keys visibles para ti</dt>
          <dd>{raw.wrappedKeyCount}</dd>
        </dl>
      )}
    </div>
  );
}

/**
 * Historial de MSG-02, con las dos tablas de MSG-03 v1.2 encima.
 *
 * MSG-03 v1.2 sustituye las tarjetas de consulta y oferta por **dos tablas** (spec
 * `MSG-03` §3 y §4). Las filas las calcula `lib/negotiation-tables.ts` y las pintan
 * `InquiriesTable` y `OffersTable`; aquí solo se monta: qué callback recibe cada
 * botón y qué formulario se abre. Los formularios siguen siendo `OfferCounterForm`.
 *
 * El historial cronológico se queda, con los mensajes y **una línea por cada
 * consulta u oferta**: es donde vive «Ver lo que ve el servidor» de cada elemento
 * (`Plan §3`, día 11), que la spec de las tablas no menciona y la demo enseña.
 *
 * Puramente presentacional: recibe los elementos ya ordenados ascendentemente por la
 * capa de datos y no carga nada. El estado vacío vive aquí, no en la pantalla.
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
  onRespondWithOffer,
  onOutOfStock,
  onOpenOrganization,
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
  onRespondWithOffer?: ((inquiryId: string, content: OfferContent) => Promise<boolean>) | undefined;
  onOutOfStock?: ((inquiryId: string) => void) | undefined;
  onOpenOrganization?: ((orgId: string) => void) | undefined;
}) {
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [counteringId, setCounteringId] = useState<string | null>(null);

  if (items.length === 0) {
    return <div className={styles.empty}>Este hilo no tiene elementos todavía.</div>;
  }

  // El reloj se resuelve UNA vez y baja ya concreto (`exactOptionalPropertyTypes`).
  const clock = now ?? new Date();
  const ctx = { viewerOrgId, ownOrgName, counterpartyName, now: clock };

  // Un botón sin callback fallaría al pulsarlo: si quien monta no pasa el de una
  // acción, la acción no se pinta.
  const inquiries: InquiryRow[] = inquiryRows(items, ctx).map((row) => ({
    ...row,
    actions: row.actions.filter((a) => (a === 'responder' ? !!onRespondWithOffer : !!onOutOfStock)),
  }));
  const offers: OfferRow[] = offerRows(items, ctx);
  const badgeOf = new Map<string, string>([
    ...inquiries.map((r) => [r.id, r.badge.label] as const),
    ...offers.map((r) => [r.id, r.badge.label] as const),
  ]);

  const responding = respondingId ? items.find((i) => i.id === respondingId) : undefined;
  const countering = counteringId ? items.find((i) => i.id === counteringId) : undefined;
  const counterContent = countering?.content?.kind === 'OFERTA' ? countering.content : null;

  return (
    <>
      {(inquiries.length > 0 || offers.length > 0) && (
        <div className={styles.tables}>
          {inquiries.length > 0 && (
            <InquiriesTable
              rows={inquiries}
              onRespond={(id) => setRespondingId(id)}
              onOutOfStock={(id) => onOutOfStock?.(id)}
              onOpenOrganization={(orgId) => onOpenOrganization?.(orgId)}
            />
          )}
          {offers.length > 0 && (
            <OffersTable
              rows={offers}
              onAccept={onAcceptOffer}
              onReject={onRejectOffer}
              onCounter={(id) => setCounteringId(id)}
              onOpenOrganization={(orgId) => onOpenOrganization?.(orgId)}
            />
          )}
        </div>
      )}

      <ul className={styles.list}>
        {items.map((item) => {
          const author = authorLabel(item, { ownOrgName, counterpartyName });
          const reference = [item.partNumber, item.brand].filter(Boolean).join(' · ');
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
                <div className={styles.itemLine}>
                  {[itemTypeLabel(item.type), reference, badgeOf.get(item.id)].filter(Boolean).join(' · ')}
                  {/* La tabla de ofertas de la spec no tiene columna de notas (§4.1), y
                      las notas de una oferta llevan incoterm y forma de pago (§4.2):
                      sin esto no se verían en ningún sitio. Las de la consulta ya
                      tienen su columna. */}
                  {item.content?.kind === 'OFERTA' && item.content.notes && (
                    <p className={styles.itemNote}>{item.content.notes}</p>
                  )}
                </div>
              )}
              <div className={styles.meta}>
                <span className={styles.author}>{author}</span>
                <span className={styles.timestamp}>{relativeTime(item.createdAt, clock)}</span>
              </div>
              <RawServerView raw={item.raw} />
            </li>
          );
        })}
      </ul>

      {responding && onRespondWithOffer && (
        <OfferCounterForm
          partNumber={responding.partNumber ?? ''}
          brand={responding.brand ?? ''}
          title="Responder con oferta"
          hint="Tu oferta responde a esta consulta y la marca como respondida."
          submitLabel="Enviar oferta"
          initialQuantity={responding.content?.kind === 'CONSULTA' ? responding.content.quantity : undefined}
          onCancel={() => setRespondingId(null)}
          onSubmit={async (content) => {
            const ok = await onRespondWithOffer(responding.id, content);
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
            const ok = await onCounterOffer(countering.id, threadId, content);
            if (ok) setCounteringId(null);
            return ok;
          }}
        />
      )}
    </>
  );
}
