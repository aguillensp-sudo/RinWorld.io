import type { ThreadDetail } from '../../lib/thread-detail';

/** ESQUELETO — ver la cabecera de `Thread.tsx`. Lo sobrescribe el Coder. */
export function ThreadHeader(_props: {
  detail: ThreadDetail;
  onBack: () => void;
  onOpenCounterparty: (orgId: string) => void;
  onClose: () => void;
  onRevert: () => void;
}) {
  return null;
}
