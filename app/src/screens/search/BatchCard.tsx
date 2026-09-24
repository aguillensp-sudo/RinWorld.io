import type { BatchResult } from '../../lib/batch';
import type { Sort, SortColumn } from '../../lib/search';

interface Props {
  result: BatchResult;
  expanded: boolean;
  sort: Sort | null;
  selected: ReadonlySet<string>;
  now: Date;
  onToggle: () => void;
  onSort: (column: SortColumn) => void;
  onToggleRow: (lineId: string) => void;
  onToggleFavorite: (orgId: string) => void;
  onConsult: (lineId: string) => void;
  onContact: (orgId: string) => void;
}

/**
 * SRCH-02 · tarjeta colapsable de una referencia -- MARCADOR
 * (`BatchCard.test.tsx` es el contrato, en rojo a propósito hasta la corrida). La
 * tarea del arnés sustituye este fichero entero.
 */
export function BatchCard(_props: Props) {
  return <div data-testid="batch-card" />;
}
