import { useState } from 'react';
import {
  TAB_TEXTS,
  referenceLabel,
  type ThreadReference,
  type ThreadReferenceOption,
  type TimelineEntry,
} from '../../lib/negotiation-rows';
import { ENCRYPTED_NOTICE, type ThreadItem } from '../../lib/thread-detail';
import { relativeTime } from '../../lib/threads';
import styles from './MessagesTimeline.module.css';

interface MessagesTimelineProps {
  entries: TimelineEntry[];
  allItems: ThreadItem[];
  references: ThreadReferenceOption[];
  filter: ThreadReference | null;
  onClearFilter: () => void;
  onRetag: (itemId: string, tag: ThreadReference | null) => void;
  authorOf: (item: ThreadItem) => string;
  now: Date;
}

/**
 * La pestaña Mensajes: la línea de tiempo del hilo.
 *
 * Presentacional: recibe las entradas ya calculadas por `messageTimeline` y las
 * pinta en el orden en que llegan. El único estado propio es el panel «Ver lo que
 * ve el servidor», cerrado al abrir. Cada mensaje libre muestra su etiqueta de
 * referencia (si la lleva) y, solo si es propio, el selector para cambiarla. El
 * texto del mensaje nunca se recalcula.
 *
 * El panel del servidor enseña `raw.ciphertext` y `raw.iv` TAL CUAL llegan, cada
 * uno en su propio nodo de texto: es lo que la base guarda, y el contenido
 * descifrado (`content`) no aparece nunca ahí.
 */
export function MessagesTimeline({
  entries,
  allItems,
  references,
  filter,
  onClearFilter,
  onRetag,
  authorOf,
  now,
}: MessagesTimelineProps) {
  const [serverOpen, setServerOpen] = useState(false);

  return (
    <div className={styles.timeline}>
      {filter !== null && (
        <div className={styles.chip}>
          <span>{TAB_TEXTS.filterChip(referenceLabel(filter))}</span>
          <button
            type="button"
            aria-label={TAB_TEXTS.clearFilter}
            className={styles.clearFilter}
            onClick={onClearFilter}
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.serverToggle}
        aria-expanded={serverOpen}
        onClick={() => setServerOpen((open) => !open)}
      >
        {serverOpen ? TAB_TEXTS.serverViewClose : TAB_TEXTS.serverViewOpen}
      </button>

      {serverOpen && (
        <div data-testid="server-view" className={styles.serverView}>
          {allItems.map((item) => (
            <div key={item.id} className={styles.serverItem}>
              <div className={styles.serverRow}>
                <span className={styles.serverKey}>item_type</span>
                <span className={styles.serverValue}>{item.type}</span>
              </div>
              <div className={styles.serverRow}>
                <span className={styles.serverKey}>part_number</span>
                <span className={styles.serverValue}>{item.partNumber ?? '—'}</span>
              </div>
              <div className={styles.serverRow}>
                <span className={styles.serverKey}>brand</span>
                <span className={styles.serverValue}>{item.brand ?? '—'}</span>
              </div>
              <div className={styles.serverRow}>
                <span className={styles.serverKey}>content_ciphertext</span>
                <span className={styles.serverValue}>{item.raw?.ciphertext ?? '—'}</span>
              </div>
              <div className={styles.serverRow}>
                <span className={styles.serverKey}>content_iv</span>
                <span className={styles.serverValue}>{item.raw?.iv ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className={styles.empty}>
          {filter ? TAB_TEXTS.noTimelineForReference : TAB_TEXTS.noMessages}
        </p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const item = entry.item;
            const isMessage = item.type === 'MENSAJE';
            const content = item.content;
            const text = content && content.kind === 'MENSAJE' ? content.text : ENCRYPTED_NOTICE;
            const tag =
              isMessage && item.partNumber && item.brand
                ? referenceLabel({ partNumber: item.partNumber, brand: item.brand })
                : null;
            const currentTag = tag ?? TAB_TEXTS.generalConversation;

            return (
              <li
                key={item.id}
                data-testid="thread-item"
                data-item-id={item.id}
                className={styles.item}
              >
                {isMessage ? (
                  <div
                    className={`${styles.bubble ?? ''} ${
                      item.isOwn ? (styles.bubbleOwn ?? '') : (styles.bubbleOther ?? '')
                    }`.trim()}
                  >
                    {text}
                  </div>
                ) : (
                  <div
                    className={`${styles.cardLine ?? ''} ${
                      item.type === 'CONSULTA' ? (styles.cardConsulta ?? '') : (styles.cardOferta ?? '')
                    }`.trim()}
                  >
                    <span className={styles.cardSummary}>{entry.summary}</span>
                    {entry.stateLabel !== null && (
                      <span className={styles.cardState}>{entry.stateLabel}</span>
                    )}
                  </div>
                )}

                {tag !== null && (
                  <span data-testid="message-tag" className={styles.tag}>
                    {tag}
                  </span>
                )}

                {isMessage && item.isOwn && (
                  <select
                    aria-label={TAB_TEXTS.retagLabel}
                    className={styles.retag}
                    value={currentTag}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === TAB_TEXTS.generalConversation) {
                        onRetag(item.id, null);
                        return;
                      }
                      const ref = references.find((r) => r.label === value);
                      if (ref) onRetag(item.id, { partNumber: ref.partNumber, brand: ref.brand });
                    }}
                  >
                    <option value={TAB_TEXTS.generalConversation}>
                      {TAB_TEXTS.generalConversation}
                    </option>
                    {references.map((r) => (
                      <option key={r.label} value={r.label}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                )}

                <div className={styles.meta}>
                  <span className={styles.author}>{authorOf(item)}</span>
                  <span className={styles.time}>{relativeTime(item.createdAt, now)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
