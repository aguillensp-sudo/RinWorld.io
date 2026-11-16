import type { ThreadItem } from '../../lib/thread-detail';
import type { ThreadReference, ThreadReferenceOption, TimelineEntry } from '../../lib/negotiation-rows';
import styles from './MessagesTimeline.module.css';

/**
 * MARCADOR. La lista de la pestaña Mensajes (`amend-msg-hilos-pestanas-y-etiqueta`). La
 * sustituye entera la corrida del arnés (`harness/tasks/MSG-HILO-PESTANAS.json`).
 */
export function MessagesTimeline(_props: {
  entries: TimelineEntry[];
  allItems: ThreadItem[];
  references: ThreadReferenceOption[];
  filter: ThreadReference | null;
  onClearFilter: () => void;
  onRetag: (itemId: string, tag: ThreadReference | null) => void;
  authorOf: (item: ThreadItem) => string;
  now: Date;
}) {
  return <div className={styles.root} />;
}
