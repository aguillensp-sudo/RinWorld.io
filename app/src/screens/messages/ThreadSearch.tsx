import type { ThreadReference, ThreadReferenceOption } from '../../lib/negotiation-rows';
import styles from './ThreadSearch.module.css';

/**
 * MARCADOR. El buscador de referencias del hilo (`amend-msg-hilos-pestanas-y-etiqueta`). Lo
 * sustituye entero la corrida del arnés (`harness/tasks/MSG-HILO-PESTANAS.json`).
 */
export function ThreadSearch(_props: {
  references: ThreadReferenceOption[];
  onPick: (reference: ThreadReference) => void;
}) {
  return <div className={styles.root} />;
}
