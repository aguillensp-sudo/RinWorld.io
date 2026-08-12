import type { SentOffer, SortColumn, SortDirection } from '../../lib/sent-offers';

/**
 * ESQUELETO · la tabla de VND-01. Devuelve `null` a propósito; ver `SentOffers.tsx`.
 */
export function SentOffersTable(_props: {
  offers: SentOffer[];
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  onOpenThread: (threadId: string) => void;
  hasQuery: boolean;
}) {
  return null;
}
