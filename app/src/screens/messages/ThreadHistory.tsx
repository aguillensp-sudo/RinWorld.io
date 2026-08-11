import type { ThreadItem } from '../../lib/thread-detail';

/** ESQUELETO — ver la cabecera de `Thread.tsx`. Lo sobrescribe el Coder. */
export function ThreadHistory(_props: {
  items: ThreadItem[];
  threadId: string;
  viewerOrgId: string;
  ownOrgName: string;
  counterpartyName: string;
  now?: Date;
  onAcceptOffer: (itemId: string) => void;
  onRejectOffer: (itemId: string) => void;
}) {
  return null;
}
