import type { WatcherRow } from '../../lib/watchers';

interface Props {
  row: WatcherRow;
  now: Date;
  busy: boolean;
  onPause: (row: WatcherRow) => void;
  onResume: (row: WatcherRow) => void;
  onEdit: (row: WatcherRow) => void;
  onDelete: (row: WatcherRow) => void;
  onRenew: (row: WatcherRow) => void;
  onLetExpire: (row: WatcherRow) => void;
  onViewResults: (row: WatcherRow) => void;
}

/**
 * SRCH-03 · tarjeta de un watcher -- MARCADOR (`WatcherCard.test.tsx` es el
 * contrato, en rojo a propósito hasta la corrida). La tarea del arnés sustituye
 * este fichero entero.
 */
export function WatcherCard(_props: Props) {
  return <div data-testid="watcher-card" />;
}
