import type { NegotiationAction, NegotiationRow, Role } from '../../lib/negotiation-rows';
import styles from './NegotiationTable.module.css';

/**
 * MARCADOR. La tabla de Soy cliente o Soy proveedor (`amend-msg-hilos-pestanas-y-etiqueta`).
 * La sustituye entera la corrida del arnés (`harness/tasks/MSG-HILO-PESTANAS.json`); hasta
 * entonces no pinta nada, y el montaje de `Thread.tsx` ya le pasa lo que necesita.
 */
export function NegotiationTable(_props: {
  role: Role;
  rows: NegotiationRow[];
  onAction: (row: NegotiationRow, action: NegotiationAction) => void;
  onWrite: (row: NegotiationRow) => void;
}) {
  return <div className={styles.root} />;
}
