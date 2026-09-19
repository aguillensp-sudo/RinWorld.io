import type { BillingRow } from '../../lib/admin-billing';

interface Props {
  rows: BillingRow[];
  selectedId: string | null;
  emptyMessage: string;
  onSelect: (row: BillingRow) => void;
  onMarkPaid: (row: BillingRow) => void;
  onReactivate: (row: BillingRow) => void;
}

/**
 * ADMIN-02 · tabla de organizaciones -- MARCADOR (`BillingTable.test.tsx` es el
 * contrato, en rojo a propósito hasta la corrida). La tarea del arnés sustituye
 * este fichero entero.
 */
export function BillingTable(_props: Props) {
  return <div data-testid="billing-table" />;
}
