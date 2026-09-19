import type { BillingPayment, BillingRow, BillingStatusEvent } from '../../lib/admin-billing';

interface Props {
  row: BillingRow;
  contactEmail: string | null;
  payments: BillingPayment[];
  events: BillingStatusEvent[];
  loading: boolean;
  actionBusy: boolean;
  actionError: string | null;
  feedback: string | null;
  onClose: () => void;
  onMarkPaid: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}

/**
 * ADMIN-02 · panel lateral de detalle -- MARCADOR (`BillingDetailPanel.test.tsx`
 * es el contrato, en rojo a propósito hasta la corrida). La tarea del arnés
 * sustituye este fichero entero.
 */
export function BillingDetailPanel(_props: Props) {
  return <div data-testid="billing-detail-panel" />;
}
